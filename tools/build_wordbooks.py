"""把五份词表整理成 wordbooks.js。先把 docx 每段导出成 core/h700/listen/phrase/confuse.txt。
用法：python3 -I build_wordbooks.py <txt目录> <站点目录>
"""
import sys, re, json, pathlib

src, site = map(pathlib.Path, sys.argv[1:3])
CJK = re.compile(r'[㐀-鿿（(…]')
POS = r'(?:n|v|vt|vi|a|adj|ad|adv|prep|conj|pron|num|int|interj|aux|art|abbr|pl)\.'

def lines(name):
    return [l.strip() for l in (src / name).read_text(encoding='utf-8').split('\n') if l.strip()]

def clean(s):
    return re.sub(r'\s+', ' ', s).strip()

def split_word(rest):
    """'twilight  n. 微明' → (word, phon, meaning)"""
    phon = ''
    m = re.match(r'^(.+?)\s{2,}(.*)$', rest)
    if m:
        w, tail = m.group(1), m.group(2)
    else:
        m = re.match(r'^(.+?)\s+((?:' + POS + r'|[㐀-鿿]).*)$', rest)
        if not m:
            return clean(rest), '', ''
        w, tail = m.group(1), m.group(2)
    pm = re.match(r'^[\[/](.+?)[\]/]\s*(.*)$', tail)
    if pm:
        phon, tail = pm.group(1), pm.group(2)
    return clean(w), phon.strip(), clean(tail)

books = []

# 1. 核心词汇 1098（话题）
units, cur = [], None
for l in lines('core.txt')[3:]:
    m = re.match(r'^(\d\d)\s+(.+?)（\d+）$', l)
    if m:
        cur = {'name': m.group(2), 'sub': '', 'items': []}; units.append(cur); continue
    if l.startswith('▍'):
        cur['sub'] = l[1:].strip(); continue
    m = re.match(r'^\d+\.\s*(.+)$', l)
    if m and cur:
        w, p, mean = split_word(m.group(1))
        cur['items'].append([w, p, re.sub(r'([\u3400-\u9fff；）])((?:n|v|vt|vi|a|adj|ad|adv)\.)', r'\1 \2', mean)])
books.append({'id': 'core', 'name': '专八核心词汇', 'note': '按话题', 'kind': 'word', 'units': units})

# 2. 高频 700（原顺序分组）
units, cur = [], None
for l in lines('h700.txt')[2:]:
    m = re.match(r'^Group\s+(\d+)$', l)
    if m:
        cur = {'name': 'Group ' + m.group(1), 'sub': '', 'items': []}; units.append(cur); continue
    m = re.match(r'^\d+\.\s*(.+)$', l)
    if m and cur:
        w, p, mean = split_word(m.group(1))
        cur['items'].append([w, p, mean])
books.append({'id': 'h700', 'name': '高频 700 词', 'note': '原书顺序', 'kind': 'word', 'units': units})

# 3. 听力主题词汇
units, cur = [], None
for l in lines('listen.txt')[1:]:
    if l.startswith('※'):
        continue
    if re.match(r'^[\u3400-\u9fff/]{1,8}类$', l):
        cur = {'name': l, 'sub': '', 'items': []}; units.append(cur); continue
    if cur is None:
        continue
    w, p, mean = split_word(l)
    if not mean:
        m = re.match(r'^([A-Za-z][A-Za-z\'’\-/ .,]*?)\s*([㐀-鿿].*)$', l)
        if m:
            w, mean = clean(m.group(1)), clean(m.group(2))
    cur['items'].append([w, p, mean])
books.append({'id': 'listen', 'name': '听力主题词汇', 'note': '5 类主题', 'kind': 'word', 'units': units})

# 4. 固定搭配
units, cur = [], None
for l in lines('phrase.txt')[2:]:
    m = re.match(r'^[一二三四五六七八九十]+、(.+)$', l)
    if m:
        cur = {'name': clean(m.group(1)), 'sub': '', 'items': []}; units.append(cur); continue
    if l.startswith('记忆词块'):
        cur['sub'] = l.split('：', 1)[-1].strip('。'); continue
    l = re.sub(r'^〔[^〕]*〕\s*', '', l)
    l = re.sub(r'（源文件[^）]*）\s*', '', l)
    m = re.match(r'^(.+?)\s{2,}(.*)$', l)
    if m:
        p, mean = clean(m.group(1)), clean(m.group(2))
    else:
        m = re.match(r'^(.+?)\s*([㐀-鿿].*)$', l)
        p, mean = (clean(m.group(1)), clean(m.group(2))) if m else (clean(l), '')
    # 有的释义里串进了另一条搭配，如 'ask about 询问，打听ask for 要求，请求'：拆成两条
    extra = re.search(r'([㐀-鿿，。；])([a-z][a-z\'’ /.…]+?)\s+([㐀-鿿].*)$', mean)
    if extra:
        cur['items'].append([p, clean(mean[:extra.start(2)])])
        cur['items'].append([clean(extra.group(2)), clean(extra.group(3))])
    else:
        cur['items'].append([p, mean])
books.append({'id': 'phrase', 'name': '固定搭配', 'note': '200 组', 'kind': 'phrase', 'units': units})

# 5. 形近词：一组几行，开头的“〔原N〕”标出新组
units, cur, grp = [], None, None
raw = []
for l in lines('confuse.txt')[2:]:
    raw += re.split(r'(?<=）)\s+(?=[a-z][a-z]+[（\[])', l)
for l in raw:
    m = re.match(r'^[一二三四五六七八九十]+、(.+)$', l)
    if m:
        name = m.group(1)
        title, _, sub = name.partition('：')
        cur = {'name': clean(title), 'sub': clean(sub), 'items': []}; units.append(cur); continue
    if l.startswith('记忆规律'):
        cur['rule'] = l.split('：', 1)[-1]; continue
    if l.startswith('〔'):
        grp = []; cur['items'].append(grp)
        l = re.sub(r'^〔原\d+〕\s*', '', l)
    l = re.sub(r'^([a-z]+)（[^）]*）', r'\1', l)
    m = re.match(r'^(.+?)\s*\[(.+?)\]\s*(.*)$', l)
    if not m:
        print('skip?', l[:60]); continue
    w, p, rest = clean(m.group(1)), m.group(2), m.group(3)
    mean, ex, excn = rest, '', ''
    em = re.match(r'^(.*?)[：:]\s*(.+?)\s*[（(](.+)[）)]\s*$', rest)
    if not em:
        em = re.match(r'^(.*?)[：:]\s*([A-Z].+?[.!?])\s*()([\u3400-\u9fff].+)$', rest)
        if em:
            mean, ex, excn = clean(em.group(1)), clean(em.group(2)), em.group(4).replace(' ', '')
            em = None
    if em:
        mean, ex, excn = clean(em.group(1)), clean(em.group(2)), em.group(3).replace(' ', '')
    if any(x[0] == w for x in grp):
        continue
    mean = re.sub(r'([\u3400-\u9fff；）])((?:n|v|vt|vi|a|adj|ad|adv)\.)', r'\1 \2', mean)
    grp.append([w, p, mean, ex, excn])
books.append({'id': 'confuse', 'name': '形近词', 'note': '90 组', 'kind': 'confuse', 'units': units})

# 词典里有真人发音的词
have = set()
for f in (site / 'dictionary').glob('*.js'):
    t = f.read_text(encoding='utf-8')
    have.update(re.findall(r'"([^"]+)":\{"media"', t))
media = {f.name.split('__')[0] for f in (site / 'media' / 'uk').glob('*.mp3')}
for b in books:
    flat = []
    for u in b['units']:
        for it in u['items']:
            flat += [x[0] for x in it] if b['kind'] == 'confuse' else [it[0]]
    single = [w for w in flat if ' ' not in w]
    hit = sum(1 for w in single if w.lower() in have or w in have)
    hm = sum(1 for w in single if w.lower() in media)
    print(b['id'], len(b['units']), 'units', len(flat), 'items', f'dict {hit} media {hm} /{len(single)} single words')

out = '/* 词书：五份词表整理而来，由 build_wordbooks.py 生成。\n   word 条目 [词, 音标, 释义]；phrase [搭配, 释义]；confuse 每组 [[词, 音标, 释义, 例句, 例句译文], …] */\n'
out += 'window.TEM8_WORDBOOKS=' + json.dumps(books, ensure_ascii=False, separators=(',', ':')) + ';\n'
(site / 'wordbooks.js').write_text(out, encoding='utf-8')
print('wordbooks.js', round(len(out.encode()) / 1024), 'KB')
