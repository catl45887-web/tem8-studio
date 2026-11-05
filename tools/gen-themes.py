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
    # 浅色主题有四套配色（雾蓝 / 薄荷 / 奶油 / 灰紫），具体色值在 palettes.css 的 --p-* 变量里
    'light': {'#f6f3ec': 'var(--p-bg)', '#273630': 'var(--p-ink)', '#fffefa': 'var(--p-card)', '#f9f7f1': 'var(--p-soft)',
              '#284c3d': 'var(--p-ink)', '#e7e7dc': 'var(--p-line)', '#e9b678': 'var(--p-strong)', '#7b857e': 'var(--p-muted)'},
    # 深色主题同样有四套配色（墨黑 / 石墨 / 深蓝 / 咖啡），色值在 palettes.css
    'dark':  {'#f6f3ec': 'var(--p-bg)', '#273630': 'var(--p-ink)', '#fffefa': 'var(--p-card)', '#f9f7f1': 'var(--p-soft)',
              '#284c3d': 'var(--p-ink)', '#e7e7dc': 'var(--p-line)', '#e9b678': 'var(--p-strong)'},
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


def hsl_var(s, l, a):
    """灰阶输出成 hsl(var(--p-h) …)：色相、饱和度系数由当前配色决定（palettes.css）"""
    alpha = '' if a >= 0.999 else ' / %s' % ('%.3f' % a).rstrip('0').rstrip('.')
    return 'hsl(var(--p-h) calc(%.1f%% * var(--p-s)) %.1f%%%s)' % (s * 100, l * 100, alpha)


def map_light(r, g, b, a, semantic):
    h, l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
    if semantic:
        return r, g, b, a
    if is_green(h, s) or s < 0.12:
        # 灰、灰绿 → 跟随当前配色的色相（--p-h）和饱和度系数（--p-s）
        s2 = 0.26 if (l < 0.45 and s > 0.2 and is_green(h, s)) else min(0.28, s * 0.9 + 0.04)
        return hsl_var(s2, l, a)
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
    if is_green(h, s) and l < 0.45 and s > 0.2:   # 深绿：品牌色 → 浅色正文，跟随配色色相
        return hsl_var(0.16, max(l2, 0.80), a)
    elif is_green(h, s) or s < 0.15:    # 其他绿 / 灰 → 跟随配色色相
        return hsl_var(min(s, 0.10), l2, a)
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
            out = map_light(r, g, b, a, semantic)
            return out if isinstance(out, str) else fmt(*out)
        out = map_dark(r, g, b, a, semantic, prop)
        return out if isinstance(out, str) else fmt(*out)
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
