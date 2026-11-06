"""给词书里没有真人录音的单词和短语补发音。

做三件事：
  1. 找出 wordbooks.js 里哪些条目在词典 / media 里没有录音
  2. 用合成语音生成 mp3，放在 media/tts/uk/ 和 media/tts/us/（已有的跳过，可以中断后接着跑）
  3. 重写 audiomap.js：把「词 → 音频路径」写进去，网页播放时先查它

用法（在仓库根目录）：
  python3 tools/make_tts.py list                 只列出缺哪些，不生成
  python3 tools/make_tts.py azure                用微软 Azure 语音（需要环境变量 AZURE_SPEECH_KEY、AZURE_SPEECH_REGION）
  python3 tools/make_tts.py edge                 用 edge-tts（pip install edge-tts，不需要密钥）
  python3 tools/make_tts.py map                  不生成，只按现有文件重写 audiomap.js
"""
import sys, re, json, pathlib, time, asyncio, os

ROOT = pathlib.Path(__file__).resolve().parent.parent
VOICE = {'uk': ('en-GB', 'en-GB-SoniaNeural'), 'us': ('en-US', 'en-US-JennyNeural')}


def books():
    t = (ROOT / 'wordbooks.js').read_text(encoding='utf-8')
    return json.loads(t[t.index('=') + 1:].rstrip().rstrip(';'))


def items():
    """返回 [(条目原文)]，去重保序"""
    seen, out = set(), []
    for b in books():
        for u in b['units']:
            for it in u['items']:
                ws = [x[0] for x in it] if b['kind'] == 'confuse' else [it[0]]
                for w in ws:
                    if w not in seen:
                        seen.add(w); out.append(w)
    return out


def spoken(w):
    """读出来的文字：去掉省略号，sb/sth 读成完整的词，a/b 两种写法只读第一种"""
    s = re.sub(r'\(.*?\)|（.*?）', ' ', w)
    s = re.sub(r'\.{2,}|…+', ' ', s)
    s = re.sub(r"\bsb's\b", "somebody's", s)
    s = re.sub(r'\bsb\b', 'somebody', s)
    s = re.sub(r'\bsth\b', 'something', s)
    s = re.sub(r"\bone's\b", "one's", s)
    s = ' '.join(t.split('/')[0] for t in s.split())
    return re.sub(r'\s+', ' ', s).strip()


def slug(w):
    return re.sub(r'[^a-z0-9]+', '_', spoken(w).lower()).strip('_')[:80]


def real_audio():
    """词典条目里的录音，以及 media 里按文件名能找到的录音"""
    have = {}
    for f in (ROOT / 'dictionary').glob('*.js'):
        t = f.read_text(encoding='utf-8')
        for w, uk, us in re.findall(r'"([^"]+)":\{"media":\{"uk":"([^"]*)","us":"([^"]*)"', t):
            have.setdefault(w, (uk, us))
    files = {}
    for acc, tag in (('uk', 'gb'), ('us', 'us')):
        for f in (ROOT / 'media' / acc).glob('*__%s_1.mp3' % tag):
            files.setdefault(f.name.split('__')[0], {})[acc] = 'media/%s/%s' % (acc, f.name)
    return have, files


def plan():
    have, files = real_audio()
    in_dict, by_file, need = [], {}, []
    for w in items():
        k = w.lower()
        if re.fullmatch(r"[a-z][a-z'-]*", k) and k in have:
            in_dict.append(w); continue
        if re.fullmatch(r"[a-z][a-z'-]*", k) and k in files and len(files[k]) == 2:
            by_file[w] = [files[k]['uk'], files[k]['us']]; continue
        need.append(w)
    return in_dict, by_file, need


def write_map(by_file, need):
    m = dict(by_file)
    for w in need:
        s = slug(w)
        uk, us = ROOT / 'media/tts/uk' / (s + '.mp3'), ROOT / 'media/tts/us' / (s + '.mp3')
        if uk.exists() and us.exists():
            m[w] = ['media/tts/uk/%s.mp3' % s, 'media/tts/us/%s.mp3' % s]
    out = '/* 词书发音表：词典里查不到录音的条目 → [英音, 美音]。由 tools/make_tts.py 生成，不要手改。 */\n'
    out += 'window.TEM8_AUDIOMAP=' + json.dumps(m, ensure_ascii=False, separators=(',', ':')) + ';\n'
    (ROOT / 'audiomap.js').write_text(out, encoding='utf-8')
    print('audiomap.js:', len(m), 'entries;', len(m) - len(by_file), 'synthesized')


def ssml(lang, voice, text):
    t = text.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
    return f"<speak version='1.0' xml:lang='{lang}'><voice name='{voice}'><prosody rate='-8%'>{t}</prosody></voice></speak>"


def run_azure(need):
    import urllib.request
    key, region = os.environ.get('AZURE_SPEECH_KEY'), os.environ.get('AZURE_SPEECH_REGION')
    if not key or not region:
        sys.exit('需要先设置 AZURE_SPEECH_KEY 和 AZURE_SPEECH_REGION')
    url = f'https://{region}.tts.speech.microsoft.com/cognitiveservices/v1'
    for i, w in enumerate(need):
        for acc, (lang, voice) in VOICE.items():
            f = ROOT / 'media/tts' / acc / (slug(w) + '.mp3')
            if f.exists():
                continue
            f.parent.mkdir(parents=True, exist_ok=True)
            req = urllib.request.Request(url, data=ssml(lang, voice, spoken(w)).encode('utf-8'), headers={
                'Ocp-Apim-Subscription-Key': key, 'Content-Type': 'application/ssml+xml',
                'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3', 'User-Agent': 'tem8-studio-tts'})
            for attempt in range(5):
                try:
                    with urllib.request.urlopen(req, timeout=30) as r:
                        f.write_bytes(r.read())
                    break
                except Exception as e:
                    if attempt == 4:
                        raise
                    time.sleep(2 + attempt * 3)
        if i % 50 == 0:
            print(i, '/', len(need), w)


def run_edge(need):
    import edge_tts

    async def main():
        for i, w in enumerate(need):
            for acc, (lang, voice) in VOICE.items():
                f = ROOT / 'media/tts' / acc / (slug(w) + '.mp3')
                if f.exists():
                    continue
                f.parent.mkdir(parents=True, exist_ok=True)
                for attempt in range(5):
                    try:
                        await edge_tts.Communicate(spoken(w), voice, rate='-8%').save(str(f))
                        break
                    except Exception:
                        if attempt == 4:
                            raise
                        await asyncio.sleep(2 + attempt * 3)
            if i % 50 == 0:
                print(i, '/', len(need), w)
    asyncio.run(main())


if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'list'
    in_dict, by_file, need = plan()
    print('词典里有录音', len(in_dict), '| media 里按文件名找到', len(by_file), '| 需要合成', len(need),
          '| 字符数', sum(len(spoken(w)) for w in need) * 2)
    if cmd == 'list':
        for w in need:
            print(' ', w, '→', spoken(w), '→', slug(w))
    elif cmd == 'azure':
        run_azure(need); write_map(by_file, need)
    elif cmd == 'edge':
        run_edge(need); write_map(by_file, need)
    elif cmd == 'map':
        write_map(by_file, need)
