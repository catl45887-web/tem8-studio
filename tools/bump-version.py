#!/usr/bin/env python3
"""
更新 index.html 里所有本地 CSS / JS 链接的版本号（?v=...），让手机浏览器去取新文件。

每次改完 CSS 或 JS、准备上线前，在仓库根目录运行一次：
    python3 tools/bump-version.py
版本号用当前时间，例如 ?v=202611031420。
"""
import pathlib, re, time

ROOT = pathlib.Path(__file__).resolve().parent.parent
p = ROOT / 'index.html'
s = p.read_text(encoding='utf-8')
v = time.strftime('%Y%m%d%H%M')


def fix(m):
    url = m.group(2)
    if url.startswith(('http:', 'https:', '//')):
        return m.group(0)
    url = re.sub(r'\?v=[^"]*$', '', url)
    return m.group(1) + url + '?v=' + v + m.group(3)


s, n1 = re.subn(r'(<link rel="stylesheet" href=")([^"]+\.css(?:\?v=[^"]*)?)(")', fix, s)
s, n2 = re.subn(r'(<script(?: type="module")? src=")([^"]+\.m?js(?:\?v=[^"]*)?)(")', fix, s)
p.write_text(s, encoding='utf-8')
print('已更新 %d 个链接，版本号 %s' % (n1 + n2, v))
