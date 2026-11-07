/* 生成 zhenti.js：词书里每个词在站内真题（阅读原文 + 听力原文）里出现几次，取两句原句和出处。
   用法：node tools/build_zhenti.js（在仓库根目录） */
const fs = require('fs'), vm = require('vm'), path = require('path')
const root = path.join(__dirname, '..'), ctx = { window: {} }
vm.createContext(ctx)
for (const f of ['wordbooks.js', 'articles2026.js', 'articles2025.js', 'articlesArchive.js', 'articlesArchive2.js', 'transcripts.js'])
  vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx)
const W = ctx.window, sents = []
const NUM = ['', '一', '二', '三', '四', '五', '六']
for (const k of ['TEM8_2026_ARTICLES', 'TEM8_2025_ARTICLES', 'TEM8_ARCHIVE_ARTICLES', 'TEM8_ARCHIVE_ARTICLES2'])
  for (const a of W[k] || []) {
    const n = (/(\d+)/.exec(a.label || '') || [])[1]
    for (const s of a.segments || []) for (const t of String(s.en || '').split(/(?<=[.!?"”])\s+(?=[A-Z"“])/))
      sents.push({ t: t.trim(), src: a.year + ' 阅读 第' + (NUM[n] || n) + '篇', read: 1 })
  }
for (const [y, secs] of Object.entries(W.TEM8_TRANSCRIPTS || {}))
  for (const [s, arr] of Object.entries(secs)) if (Array.isArray(arr))
    for (const c of arr) if (c && c.en && !/test for english|grade eight|section [ab]\b|answer sheet/i.test(c.en)) sents.push({ t: c.en.trim(), src: y + ' 听力 ' + (s === 'A' ? '讲座' : s === 'B' ? '访谈' : 'Section ' + s), read: 0 })
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
function pattern(w) {
  w = String(w).toLowerCase().replace(/\(.*?\)|（.*?）/g, ' ').split('/')[0].replace(/\.{2,}|…/g, ' ').trim()
  if (!w || w.length < 3) return null
  if (/\s/.test(w)) {
    const parts = w.split(/\s+/).map(p => /^(sb|sth|one's|oneself|sb's|do|doing)$/.test(p) ? "[\\w'’-]+(?:\\s[\\w'’-]+)?" : /^be$/.test(p) ? '(?:be|is|are|was|were|been|being)' : esc(p) + '\\w{0,3}')
    return new RegExp('\\b' + parts.join('\\s+') + '\\b', 'i')
  }
  const forms = [esc(w) + "(?:s|es|ed|d|ing|ly|er|ers|ment|ments)?"]
  if (/e$/.test(w)) forms.push(esc(w.slice(0, -1)) + '(?:ing|ed|ion|ions)')
  if (/y$/.test(w)) forms.push(esc(w.slice(0, -1)) + 'i(?:es|ed|er|est|ly)')
  if (/[^aeiou][aeiou][bdgmnprt]$/.test(w)) forms.push(esc(w) + w.slice(-1) + '(?:ing|ed|er)')
  return new RegExp('\\b(?:' + forms.join('|') + ')\\b', 'i')
}
const out = {}
for (const b of W.TEM8_WORDBOOKS) for (const u of b.units) for (const it of u.items) {
  const list = b.kind === 'confuse' ? it.map(x => x[0]) : [it[0]]
  for (const w of list) {
    const key = String(w).toLowerCase(); if (out[key]) continue
    const re = pattern(w); if (!re) continue
    const hits = sents.filter(s => re.test(s.t)); if (!hits.length) continue
    const good = hits.filter(s => s.t.length >= 30 && s.t.length <= 240).sort((a, b) => b.read - a.read)
    const pick = []
    for (const s of good) { if (pick.length >= 2) break; if (pick.some(p => p[1] === s.src) && good.some(g => !pick.some(p => p[1] === g.src) && g !== s)) continue; pick.push([s.t, s.src]) }
    for (const s of good) { if (pick.length >= 2) break; if (!pick.some(p => p[0] === s.t)) pick.push([s.t, s.src]) }
    if (pick.length) out[key] = [hits.length, pick]
  }
}
const body = '/* 真题出处：词书里的词在站内真题原文中出现的次数和两句原句。由 tools/build_zhenti.js 生成，不要手改。 */\nwindow.TEM8_ZHENTI=' + JSON.stringify(out) + ';\n'
fs.writeFileSync(path.join(root, 'zhenti.js'), body)
console.log(Object.keys(out).length, 'words,', (body.length / 1024).toFixed(0), 'KB')
