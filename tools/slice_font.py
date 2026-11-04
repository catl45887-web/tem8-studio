"""把思源宋体切成按字分片的 woff 文件，并生成带 unicode-range 的 @font-face。
用法：python3 slice_font.py <站点目录> <字体目录> <输出目录>
"""
import sys, re, pathlib, collections
from fontTools.ttLib import TTFont
from fontTools import subset

site, fontdir, out = map(pathlib.Path, sys.argv[1:4])
out.mkdir(parents=True, exist_ok=True)

CJK = re.compile(r'[㐀-鿿豈-﫿]')
freq = collections.Counter()
ui = collections.Counter()
for f in list(site.glob('*.js')) + list(site.glob('*.html')) + list(site.glob('cloud-sync/*.mjs')) + list(site.glob('dictionary/*.js')):
    t = f.read_text(encoding='utf-8', errors='ignore')
    chars = CJK.findall(t)
    freq.update(chars)
    if f.name in ('index.html', 'app.js', 'home.js', 'appnav.js', 'workflow.js', 'review.js', 'intensive.js', 'backup.js', 'themes.js', 'annotations.js', 'wordpop.js', 'client.mjs'):
        ui.update(chars)

# GB2312 一、二级汉字：保证用户自己写的笔记也基本有字
gb = set()
for hi in range(0xB0, 0xF8):
    for lo in range(0xA1, 0xFF):
        try:
            gb.add(bytes([hi, lo]).decode('gb2312'))
        except UnicodeDecodeError:
            pass

base_ranges = [(0x20, 0x7E), (0xA0, 0xFF), (0x2000, 0x206F), (0x2190, 0x21FF), (0x2460, 0x24FF), (0x25A0, 0x25FF), (0x3000, 0x303F), (0xFF00, 0xFFEF)]

def ranges_of(cps):
    cps = sorted(set(cps)); out = []
    for c in cps:
        if out and c == out[-1][1] + 1: out[-1][1] = c
        else: out.append([c, c])
    return ','.join(f'U+{a:X}' if a == b else f'U+{a:X}-{b:X}' for a, b in out)

def build(weight, otf):
    font = TTFont(otf)
    cmap = font.getBestCmap()
    have = lambda ch: ord(ch) in cmap
    core_cjk = [c for c, _ in ui.most_common() if have(c)][:500]
    base = [cp for a, b in base_ranges for cp in range(a, b + 1) if cp in cmap]
    chunks = [base + [ord(c) for c in core_cjk]]
    rest = sorted((set(freq) | gb) - set(core_cjk), key=lambda c: (-freq.get(c, 0), ord(c)))
    rest = [c for c in rest if have(c)]
    for i in range(0, len(rest), 300):
        chunks.append([ord(c) for c in rest[i:i + 300]])
    css = []
    total = 0
    for i, cps in enumerate(chunks):
        name = f'serif-{weight}-{i:02d}.woff'
        opts = subset.Options()
        opts.flavor = 'woff'
        opts.layout_features = ['kern', 'liga', 'locl', 'vert', 'palt', 'halt']
        opts.name_IDs = []
        opts.hinting = False
        opts.desubroutinize = True
        s = subset.Subsetter(opts)
        f2 = TTFont(otf)
        s.populate(unicodes=cps)
        s.subset(f2)
        f2.flavor = 'woff'
        f2.save(out / name)
        total += (out / name).stat().st_size
        css.append(f"@font-face{{font-family:'Shiye Song Serif';font-style:normal;font-weight:{weight};font-display:swap;src:url('fonts/serif/{name}') format('woff');unicode-range:{ranges_of(cps)}}}")
    print(weight, len(chunks), 'chunks', round(total / 1024 / 1024, 2), 'MB', 'chars', sum(len(c) for c in chunks))
    return css

css = []
css += build(400, fontdir / 'NotoSerifSC-Regular.otf')
css += build(600, fontdir / 'NotoSerifSC-SemiBold.otf')
(out.parent.parent / 'serif.css').write_text('/* 思源宋体（Noto Serif SC，SIL OFL 1.1）按字分片：浏览器只下载页面上用到的那几片。由 slice_font.py 生成，不要手改。 */\n' + '\n'.join(css) + '\n', encoding='utf-8')
