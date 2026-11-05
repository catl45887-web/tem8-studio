#!/usr/bin/env python3
"""
生成浅色 / 深色主题的配色层：theme-light.css、theme-dark.css。

做法和 winter-base.css 一样：读取原始样式文件，只挑出带颜色的声明，
换成新主题的颜色，并加上 html[data-theme=...] 前缀。版式完全沿用原样式。

用法：在仓库根目录运行  python3 tools/gen-themes.py
改原样式后重新运行一次即可，生成的两个文件不要手改（手写部分放在 themes.css）。
"""
import colorsys, re, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
SOURCES = ['styles.css', 'reader.css', 'workflow.css', 'annotate.css', 'intensive.css', 'wordpop.css']

# 对 / 错 这类有含义的颜色保持色相不变，避免"答对"和"答错"看起来一样
SEMANTIC = re.compile(r'correct|right|success|wrong|incorrect|error|danger|\.ok\b|good|bad|miss|del\b|warn', re.I)
COLOR = re.compile(r'#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)')
COLOR_PROPS = re.compile(r'color|background|border|outline|shadow|fill|stroke|caret|decoration')

EXACT = {
    # 浅色 = 雾蓝：底 #F0F7F6 / 浅 #D1E3EB / 主 #AFD1DB / 深 #93A5AB；强调色用深色加深后的 #4E6670
    'light': {'#f6f3ec': '#f0f7f6', '#273630': '#22303a', '#fffefa': '#ffffff', '#f9f7f1': '#e6f0f1',
              '#284c3d': '#22303a', '#e7e7dc': '#d8e5ea', '#e9b678': '#4e6670', '#7b857e': '#5f6e75'},
    'dark':  {'#f6f3ec': '#1c1b19', '#273630': '#e6e1d8', '#fffefa': '#252320', '#f9f7f1': '#211f1d',
              '#284c3d': '#e6e1d8', '#e7e7dc': '#34312d', '#e9b678': '#ec6a52'},
}


def parse(c):
    c = c.strip().lower()
    if c.startswith('#'):
        h = c[1:]
        if len(h) in (3, 4):
            h = ''.join(x * 2 for x in h)
        r, g, b = (int(h[i:i + 2], 16) for i in (0, 2, 4))
        a = int(h[6:8], 16) / 255 if len(h) == 8 else 1.0
        return r, g, b, a
    nums = [x.strip() for x in c[c.index('(') + 1:-1].replace('/', ',').split(',') if x.strip()]
    vals = [float(x[:-1]) * 2.55 if x.endswith('%') else float(x) for x in nums[:3]]
    a = float(nums[3][:-1]) / 100 if len(nums) > 3 and nums[3].endswith('%') else (float(nums[3]) if len(nums) > 3 else 1.0)
    return vals[0], vals[1], vals[2], a


def fmt(r, g, b, a):
    r, g, b = (max(0, min(255, round(x))) for x in (r, g, b))
    if a >= 0.999:
        return '#%02x%02x%02x' % (r, g, b)
    return 'rgba(%d,%d,%d,%s)' % (r, g, b, ('%.3f' % a).rstrip('0').rstrip('.'))


def is_green(h, s):
    deg = h * 360
    return s > 0.04 and 60 <= deg <= 200


def map_light(r, g, b, a, semantic):
    h, l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
    if semantic:
        return r, g, b, a
    if is_green(h, s) or s < 0.12:
        if l < 0.45 and s > 0.2 and is_green(h, s):   # 深绿：原品牌色 → 墨蓝
            h, s = 205 / 360, 0.26
        else:                                     # 浅绿、灰绿、灰 → 雾蓝灰
            h, s = 196 / 360, min(0.28, s * 0.9 + 0.04)
    r2, g2, b2 = colorsys.hls_to_rgb(h, l, s)
    return r2 * 255, g2 * 255, b2 * 255, a


def dark_l(l):
    if l >= 0.9:                       # 底色、卡片：越白 → 越亮一点的深色，卡片会比底色略亮
        return 0.10 + (l - 0.9) * 1.0
    return 0.21 + (0.9 - l) / 0.9 * 0.68   # 线条、文字：反转明度


def map_dark(r, g, b, a, semantic, prop):
    if 'shadow' in prop:
        return 0, 0, 0, min(0.6, a * 2.2)
    h, l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
    if semantic:
        l2 = dark_l(l)
        r2, g2, b2 = colorsys.hls_to_rgb(h, l2, min(s, 0.5))
        return r2 * 255, g2 * 255, b2 * 255, a
    l2 = dark_l(l)
    if is_green(h, s) and l >= 0.85:    # 浅绿底：原来的悬停 / 选中底色 → 比卡片略亮的抬起面
        l2 = 0.19 + (0.97 - min(l, 0.97)) * 0.4
    if is_green(h, s) and l < 0.45 and s > 0.2:   # 深绿：品牌色 → 象牙白
        h, s = 38 / 360, 0.16
        l2 = max(l2, 0.80)
    elif is_green(h, s) or s < 0.15:    # 其他绿 / 灰 → 中性略暖
        h, s = 36 / 360, min(s, 0.10)
    elif s > 0.35 and 0.45 < l < 0.85:  # 金色、琥珀这类强调色：深色底上原样保留
        return r, g, b, a
    else:
        s = min(s, 0.6)
    r2, g2, b2 = colorsys.hls_to_rgb(h, l2, s)
    return r2 * 255, g2 * 255, b2 * 255, a


def recolor(value, theme, semantic, prop):
    def sub(m):
        raw = m.group(0)
        key = raw.lower()
        if len(key) == 4 and key.startswith('#'):
            key = '#' + ''.join(x * 2 for x in key[1:])
        if key in EXACT[theme] and not semantic:
            return EXACT[theme][key]
        try:
            r, g, b, a = parse(raw)
        except Exception:
            return raw
        if theme == 'light':
            return fmt(*map_light(r, g, b, a, semantic))
        return fmt(*map_dark(r, g, b, a, semantic, prop))
    return COLOR.sub(sub, value)


def blocks(css):
    """把 CSS 拆成 (前导, 内容) 块，支持一层 @media 嵌套。"""
    css = re.sub(r'/\*.*?\*/', '', css, flags=re.S)
    i, n, out = 0, len(css), []
    while i < n:
        j = css.find('{', i)
        if j < 0:
            break
        head = css[i:j].strip()
        depth, k = 1, j + 1
        while k < n and depth:
            if css[k] == '{':
                depth += 1
            elif css[k] == '}':
                depth -= 1
            k += 1
        out.append((head, css[j + 1:k - 1]))
        i = k
    return out


def scope(selectors, theme):
    pre = 'html[data-theme=%s]' % theme
    out = []
    for s in selectors.split(','):
        s = s.strip()
        if not s:
            continue
        if s.startswith(':root') or s == 'html':
            out.append(pre + s[5:] if s.startswith(':root') else pre)
        elif s.startswith('html'):
            out.append(pre + s[4:])
        else:
            out.append(pre + ' ' + s)
    return ','.join(out)


def decls(body):
    parts, cur, depth = [], '', 0
    for ch in body:
        if ch == '(':
            depth += 1
        elif ch == ')':
            depth -= 1
        if ch == ';' and depth == 0:
            parts.append(cur)
            cur = ''
        else:
            cur += ch
    parts.append(cur)
    return [p.strip() for p in parts if ':' in p]


def rule(head, body, theme):
    semantic = bool(SEMANTIC.search(head))
    keep = []
    for d in decls(body):
        prop, val = d.split(':', 1)
        prop = prop.strip().lower()
        if (COLOR_PROPS.search(prop) or prop.startswith('--')) and COLOR.search(val):
            keep.append('%s:%s' % (prop, recolor(val.strip(), theme, semantic, prop)))
    if not keep:
        return ''
    return '%s{%s}\n' % (scope(head, theme), ';'.join(keep))


def build(theme):
    out = ['/* 自动生成：tools/gen-themes.py。勿手改，手写部分在 themes.css */\n']
    for name in SOURCES:
        out.append('/* —— %s —— */\n' % name)
        for head, body in blocks((ROOT / name).read_text(encoding='utf-8')):
            if head.startswith('@keyframes') or head.startswith('@font-face') or head.startswith('@import'):
                continue
            if head.startswith('@media') or head.startswith('@supports'):
                inner = ''.join(rule(h, b, theme) for h, b in blocks(body) if not h.startswith('@'))
                if inner:
                    out.append('%s{\n%s}\n' % (head, inner))
                continue
            out.append(rule(head, body, theme))
    (ROOT / ('theme-%s.css' % theme)).write_text(''.join(out), encoding='utf-8')


if __name__ == '__main__':
    for t in ('light', 'dark'):
        build(t)
    print('ok')
