/* 标注模块：词句级标记 + 右侧笔记抽屉
 * 数据：localStorage['tem8_annotations_v1'] = {v, drawer, articles:{ [articleId]: {marks:[{i,s,e,t,c,at}], notes:[{id,i,text,quote,at}]} }}
 * i = 段落下标（0 起），s/e = 该段纯文本的字符偏移，t = 标记文字（便于列表展示）
 */
(() => {
  'use strict'
  const KEY = 'tem8_annotations_v1'
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
  const ARTICLES = [
    ...(window.TEM8_2026_ARTICLES || []),
    ...(window.TEM8_2025_ARTICLES || []),
    ...(window.TEM8_MID_ARTICLES || []),
    ...(window.TEM8_ARCHIVE_ARTICLES || []),
    ...(window.TEM8_ARCHIVE_ARTICLES2 || [])
  ]
  const articleOf = id => ARTICLES.find(a => a.id === id) || null
  const srcText = id => { const a = articleOf(id); return a ? `${a.year} · ${a.label || 'Passage'}` : String(id || '') }
  const srcFull = id => {
    const a = articleOf(id)
    if (!a) return String(id || '')
    const t = String(a.title || '').trim()
    return t && t !== `${a.year} · ${a.label}` ? `${a.year} · ${a.label} · ${t}` : `${a.year} · ${a.label || 'Passage'}`
  }

  /* ============ 存储 ============ */
  let db = loadDb()
  const cache = Object.create(null)      // 'articleId#seg' -> 原文
  let pending = null                      // 当前选区 {id, ranges, quote, anchor}
  let lastArticle = ''
  let composeArticle = ''
  let composeAnchor = null
  let drawerTab = 'this'
  let opener = null
  let chip = null, drawer = null, toggle = null, listEl = null, whereEl = null, inputEl = null, toastEl = null
  let dragging = false

  function loadDb() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) || 'null')
      if (raw && raw.articles) return { v: 1, drawer: !!raw.drawer, articles: raw.articles }
    } catch (e) { }
    const out = { v: 1, drawer: false, articles: {} }
    const take = tools => {
      for (const [id, t] of Object.entries(tools || {})) {
        const notes = t && t.notes
        if (notes && !Array.isArray(notes)) {
          for (const [seg, text] of Object.entries(notes)) {
            const val = String(text || '').trim()
            if (!val) continue
            const rec = out.articles[id] || (out.articles[id] = { marks: [], notes: [] })
            rec.notes.push({ id: uid('n'), i: Number(seg), text: val, quote: '', at: Date.now() })
          }
        }
      }
    }
    try { take(JSON.parse(localStorage.getItem('tem8_studio_web_v1') || '{}').readingTools) } catch (e) { }
    try { take(JSON.parse(localStorage.getItem('tem8_workflow_v2') || '{}').tools) } catch (e) { }
    try { localStorage.setItem(KEY, JSON.stringify(out)) } catch (e) { }
    return out
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(db)); document.dispatchEvent(new Event('tem8:study-changed')) } catch (e) { } }
  const uid = p => p + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3)
  function ensure(id) {
    const rec = db.articles[id] || (db.articles[id] = { marks: [], notes: [] })
    rec.marks ||= []; rec.notes ||= []
    return rec
  }
  function get(id) { const r = db.articles[id] || { marks: [], notes: [] }; return { marks: r.marks || [], notes: r.notes || [] } }
  const marksOf = (id, i) => get(id).marks.filter(m => Number(m.i) === Number(i)).sort((a, b) => a.s - b.s)
  const noteCount = (id, i) => get(id).notes.filter(n => n.i != null && Number(n.i) === Number(i)).length

  /* ============ 文本渲染 ============ */
  const WORD_RE = /[A-Za-z]+(?:[’'][A-Za-z]+)?/g
  function paint(text, marks, from, to) {
    const bounds = [from, to]
    for (const m of marks) {
      if (m.e > from && m.s < to) { bounds.push(Math.max(from, m.s), Math.min(to, m.e)) }
    }
    const pts = [...new Set(bounds)].sort((a, b) => a - b)
    let html = ''
    for (let k = 0; k < pts.length - 1; k++) {
      const s = pts[k], e = pts[k + 1]
      if (e <= s) continue
      const piece = esc(text.slice(s, e)).replace(/\n/g, '<br>')
      const hit = marks.find(m => m.s <= s && m.e >= e)
      html += hit ? `<mark class="anno-hl ${esc(hit.c || 'y')}">${piece}</mark>` : piece
    }
    return html
  }
  function textHTML(articleId, seg, text, opts) {
    text = String(text ?? '')
    const o = opts || {}
    cache[articleId + '#' + seg] = text
    const marks = marksOf(articleId, seg)
    if (o.word === false) return paint(text, marks, 0, text.length)
    const attr = o.attr || 'data-word'
    const segAttr = o.segAttr ? ` ${o.segAttr}="${seg}"` : ''
    // 单词和紧挨着的标点包在一个不换行的 span 里，避免标点被挤到下一行
    let html = '', pos = 0, m, open = false
    const on = () => { if (!open) { html += '<span class="anno-nb">'; open = true } }
    const off = () => { if (open) { html += '</span>'; open = false } }
    const gap = (a, b, last) => {
      if (b <= a) return
      const g = text.slice(a, b), i = g.search(/\s/)
      if (i < 0) { on(); html += paint(text, marks, a, b); return }
      const j = g.length - (g.match(/\S*$/)[0].length)
      if (i > 0) html += paint(text, marks, a, a + i)
      off()
      html += paint(text, marks, a + i, a + j)
      if (a + j < b) { if (!last) on(); html += paint(text, marks, a + j, b) }
    }
    WORD_RE.lastIndex = 0
    while ((m = WORD_RE.exec(text))) {
      const s = m.index, e = s + m[0].length
      gap(pos, s, false)
      on()
      html += `<button ${attr}="${esc(m[0].toLowerCase().replace(/[’']/g, "'"))}"${segAttr}>${paint(text, marks, s, e)}</button>`
      pos = e
    }
    gap(pos, text.length, true)
    off()
    return html
  }

  /* ============ 选区 -> 字符偏移 ============ */
  function charLen(node) {
    if (!node) return 0
    if (node.nodeType === 3) return node.data.length
    if (node.nodeName === 'BR') return 1
    let n = 0
    for (const c of node.childNodes) n += charLen(c)
    return n
  }
  function pointOffset(box, container, offset) {
    const len = charLen(box)
    if (container === box) {
      const kids = [...box.childNodes]
      let acc = 0
      for (let k = 0; k < offset && k < kids.length; k++) acc += charLen(kids[k])
      return acc
    }
    if (box.contains(container)) {
      let acc = 0, hit = false
      const walk = n => {
        if (hit) return
        if (n.nodeType === 3) {
          if (n === container) { acc += Math.min(offset, n.data.length); hit = true; return }
          acc += n.data.length; return
        }
        if (n.nodeName === 'BR') { if (n === container) { hit = true; return } acc += 1; return }
        if (n === container) {
          const kids = [...n.childNodes]
          for (let k = 0; k < offset && k < kids.length; k++) acc += charLen(kids[k])
          hit = true; return
        }
        for (const c of n.childNodes) { walk(c); if (hit) break }
      }
      walk(box)
      return hit ? acc : len
    }
    try {
      const r = document.createRange(); r.selectNodeContents(box)
      return r.comparePoint(container, offset) < 0 ? 0 : len
    } catch (e) { return len }
  }
  function collect() {
    const sel = window.getSelection()
    if (!sel || !sel.rangeCount || sel.isCollapsed) return null
    const r = sel.getRangeAt(0)
    const node = r.commonAncestorContainer
    const host = node.nodeType === 1 ? node : node.parentElement
    const scope = host && host.closest ? host.closest('[data-anno-scope]') : null
    if (!scope) return null
    const id = scope.dataset.annoArticle
    if (!id) return null
    const out = []
    for (const p of scope.querySelectorAll('[data-anno-p]')) {
      const box = p.querySelector('.anno-text')
      if (!box) continue
      let inter = true
      try { inter = r.intersectsNode(box) } catch (e) { inter = false }
      if (!inter) continue
      const i = Number(p.dataset.annoP)
      const text = cache[id + '#' + i]
      if (text === undefined) continue
      const len = charLen(box)
      let s = pointOffset(box, r.startContainer, r.startOffset)
      let e = pointOffset(box, r.endContainer, r.endOffset)
      s = Math.max(0, Math.min(len, s)); e = Math.max(0, Math.min(len, e))
      while (s < e && /\s/.test(text[s])) s++
      while (e > s && /\s/.test(text[e - 1])) e--
      if (e > s) out.push({ i, s, e, t: text.slice(s, e) })
    }
    if (!out.length) return null
    return { id, ranges: out, quote: out.map(x => x.t).join(' ').slice(0, 180), anchor: out[0].i }
  }

  /* ============ 选区浮条 ============ */
  function buildChip() {
    chip = document.createElement('div')
    chip.className = 'anno-chip'
    chip.hidden = true
    chip.innerHTML = `<button class="anno-chip-main" data-anno-mark="y" title="标记选中的文字">✎ 标记</button><span class="anno-colors"><button data-anno-mark="g" class="g" title="绿色标记"></button><button data-anno-mark="b" class="b" title="蓝色标记"></button><button data-anno-mark="r" class="r" title="红色标记"></button></span><button class="anno-chip-erase" data-anno-erase hidden title="去掉选中部分的标记">✕ 取消标记</button><button class="anno-chip-note" data-anno-note>笔记</button>`
    document.body.appendChild(chip)
  }
  // 标记条固定在屏幕底部：浏览器和划词插件的菜单都贴着选中的文字弹出，放在底部就不会被它们挡住
  function showChipAt() {
    chip.hidden = false
    chip.classList.add('docked')
    chip.style.top = ''
    chip.style.left = ''
  }
  function hideChip() { if (chip) chip.hidden = true }

  /* ============ 标记 ============ */
  function toggleMark(ranges, color) {
    if (!ranges || !ranges.length || !pending) return
    const id = pending.id, rec = ensure(id), segs = new Set()
    for (const rg of ranges) {
      segs.add(rg.i)
      const same = rec.marks.find(m => m.i === rg.i && m.s === rg.s && m.e === rg.e)
      if (same && (same.c || 'y') === color) rec.marks = rec.marks.filter(m => m !== same)
      else if (same) { same.c = color; same.at = Date.now() }
      else rec.marks.push({ i: rg.i, s: rg.s, e: rg.e, t: rg.t, c: color || 'y', at: Date.now() })
    }
    rec.marks = rec.marks
    save()
    repaint(id, [...segs])
    renderDrawer()
    hideChip()
    try { window.getSelection().removeAllRanges() } catch (e) { }
    toast(ranges.length > 1 ? `已标记 ${ranges.length} 处` : '已标记')
    pending = null
  }

  /* ============ 取消标记 ============ */
  function overlaps(id, ranges) {
    const rec = get(id)
    return ranges.some(rg => rec.marks.some(m => Number(m.i) === rg.i && m.e > rg.s && m.s < rg.e))
  }
  function trimPiece(id, i, s, e) {
    const text = cache[id + '#' + i] || ''
    while (s < e && /\s/.test(text[s])) s++
    while (e > s && /\s/.test(text[e - 1])) e--
    return e > s ? { s, e, t: text.slice(s, e) } : null
  }
  // 从已有标记里“挖掉”选中的部分：整段被选中就删掉，部分选中就拆成两半
  function eraseRanges(id, ranges) {
    const rec = ensure(id), segs = new Set()
    let n = 0
    for (const rg of ranges) {
      const next = []
      for (const m of rec.marks) {
        if (Number(m.i) !== rg.i || !(m.e > rg.s && m.s < rg.e)) { next.push(m); continue }
        n++; segs.add(rg.i)
        const left = m.s < rg.s ? trimPiece(id, rg.i, m.s, rg.s) : null
        const right = m.e > rg.e ? trimPiece(id, rg.i, rg.e, m.e) : null
        if (left) next.push({ ...m, ...left })
        if (right) next.push({ ...m, ...right })
      }
      rec.marks = next
    }
    if (!n) return 0
    save(); repaint(id, [...segs]); renderDrawer()
    return n
  }
  // 点到已标记的单词时，把它所在的整条标记去掉
  function unmarkAt(el) {
    if (!el || !el.closest) return false
    const scope = el.closest('[data-anno-scope]'), p = el.closest('[data-anno-p]')
    const box = p && p.querySelector('.anno-text')
    if (!scope || !box || !box.contains(el)) return false
    const id = scope.dataset.annoArticle, i = Number(p.dataset.annoP)
    const s = pointOffset(box, el, 0), e = s + charLen(el)
    // 扩大到整条标记的范围，整条一起去掉
    let lo = s, hi = e
    for (const m of get(id).marks) if (Number(m.i) === i && m.e > s && m.s < e) { lo = Math.min(lo, m.s); hi = Math.max(hi, m.e) }
    const n = eraseRanges(id, [{ i, s: lo, e: hi }])
    if (n) toast('已取消标记')
    return !!n
  }
  function isMarked(el) {
    return !!(el && el.querySelector && (el.querySelector('mark.anno-hl') || (el.closest && el.closest('mark.anno-hl'))))
  }

  /* ============ DOM 重绘（只重画改动的那一段） ============ */
  function scopes() {
    const all = [...document.querySelectorAll('[data-anno-scope]')].filter(el => el.isConnected !== false)
    const vis = all.filter(el => el.offsetParent !== null || (el.getClientRects && el.getClientRects().length))
    return vis.length ? vis : all
  }
  function activeScope(id) {
    const list = scopes()
    if (id) { const hit = list.find(s => s.dataset.annoArticle === id); if (hit) return hit }
    return list[0] || null
  }
  function currentId() {
    const s = activeScope()
    return (s && s.dataset.annoArticle) || lastArticle || ''
  }
  function scopeOpts(scope) {
    return { word: scope.dataset.annoWord === '1', attr: scope.dataset.annoWordAttr || 'data-word', segAttr: scope.dataset.annoSeg === '1' ? 'data-segment' : '' }
  }
  function updateBadge(p, id, i) {
    const b = p.querySelector('.anno-pbtn')
    if (!b) return
    const n = noteCount(id, i)
    b.textContent = '✎' + (n || '')
    b.classList.toggle('has', !!n)
    b.title = n ? `第 ${i + 1} 段有 ${n} 条笔记` : `在第 ${i + 1} 段记笔记`
  }
  function paintSegment(scope, id, i) {
    const p = scope.querySelector(`[data-anno-p="${i}"]`)
    if (!p) return
    const box = p.querySelector('.anno-text')
    const text = cache[id + '#' + i]
    if (!box || text === undefined) return
    box.innerHTML = textHTML(id, i, text, scopeOpts(scope))
    updateBadge(p, id, i)
  }
  function repaint(id, segs) {
    const list = scopes().filter(s => s.dataset.annoArticle === id)
    for (const scope of list) {
      const idx = segs && segs.length ? segs : Object.keys(cache).filter(k => k.startsWith(id + '#')).map(k => Number(k.split('#')[1]))
      for (const i of idx) paintSegment(scope, id, i)
    }
  }
  function flash(el) {
    if (!el) return
    el.classList.add('anno-flash')
    setTimeout(() => el.classList.remove('anno-flash'), 1200)
  }

  /* ============ 抽屉 ============ */
  function buildDrawer() {
    drawer = document.createElement('aside')
    drawer.className = 'anno-panel'
    drawer.hidden = true
    drawer.innerHTML = `<header class="anno-head"><div><strong>标记与笔记</strong><small>选中原文即可标记，笔记自动保存</small></div><button class="anno-x" data-anno-close aria-label="收起">×</button></header>
      <div class="anno-tabs"><button data-anno-tab="this" class="active">本篇</button><button data-anno-tab="all">全部笔记</button></div>
      <div class="anno-compose"><div class="anno-where" data-anno-where>全篇</div><textarea data-anno-input rows="3" placeholder="写笔记：生词、结构、出题点…"></textarea><button class="anno-save" data-anno-save>保存笔记</button></div>
      <div class="anno-list" data-anno-list></div>`
    document.body.appendChild(drawer)
    toggle = document.createElement('button')
    toggle.className = 'anno-toggle'
    toggle.type = 'button'
    toggle.innerHTML = '✎<span>笔记</span><b data-anno-count hidden></b>'
    toggle.title = '打开标记与笔记'
    document.body.appendChild(toggle)
    drawer.querySelectorAll('[data-anno-tab]').forEach(b => b.addEventListener('click', () => {
      drawerTab = b.dataset.annoTab
      drawer.querySelectorAll('[data-anno-tab]').forEach(x => x.classList.toggle('active', x === b))
      renderDrawer()
    }))
    listEl = drawer.querySelector('[data-anno-list]')
    whereEl = drawer.querySelector('[data-anno-where]')
    inputEl = drawer.querySelector('[data-anno-input]')
    inputEl.addEventListener('input', () => { whereEl.dataset.dirty = inputEl.value ? '1' : '' })
    toggle.addEventListener('click', () => { drawer.hidden ? openDrawer() : closeDrawer() })
  }
  function openDrawer(opts) {
    if (!drawer) return
    drawer.hidden = false
    document.body.classList.add('anno-dock')
    db.drawer = true; save()
    if (opts && opts.anchor != null) { composeAnchor = Number(opts.anchor); composeArticle = currentId() }
    renderDrawer()
    if (opts && opts.focus) setTimeout(() => inputEl && inputEl.focus(), 60)
  }
  function closeDrawer() {
    if (!drawer) return
    drawer.hidden = true
    document.body.classList.remove('anno-dock')
    db.drawer = false; save()
  }
  const fmtDate = t => { const d = new Date(t || Date.now()); return `${d.getMonth() + 1}/${d.getDate()}` }
  function noteItem(id, n) {
    const seg = n.i == null ? '全篇' : `第 ${Number(n.i) + 1} 段`
    return `<article class="anno-item" data-anno-note="${esc(n.id)}">
      <div class="anno-src"><span class="anno-tag">${esc(srcText(id))}</span><i>${seg}</i><time>${fmtDate(n.at)}</time><button class="anno-del" data-anno-del="${esc(n.id)}" data-anno-aid="${esc(id)}" title="删除这条笔记">×</button></div>
      ${n.quote ? `<blockquote>${esc(n.quote)}</blockquote>` : ''}
      <p>${esc(n.text).replace(/\n/g, '<br>')}</p>
      <div class="anno-foot"><button data-anno-edit="${esc(n.id)}" data-anno-aid="${esc(id)}">编辑</button><button data-anno-jump="${esc(id)}|${n.i == null ? -1 : Number(n.i)}">回到原文</button></div>
    </article>`
  }
  function markRow(id, m, k) {
    const key = `${Number(m.i)}|${Number(m.s)}|${Number(m.e)}`
    return `<div class="anno-mark"><span class="anno-swatch ${esc(m.c || 'y')}"></span><button class="anno-mark-text" data-anno-jump="${esc(id)}|${Number(m.i)}" title="回到原文">${esc(String(m.t || '').slice(0, 70) || '（整段）')}</button><i>第 ${Number(m.i) + 1} 段</i><button class="anno-del" data-anno-mark-del="${key}" data-anno-aid="${esc(id)}" title="取消这条标记">×</button></div>`
  }
  function thisHTML(id) {
    const r = get(id)
    const notes = [...r.notes].sort((a, b) => (b.at || 0) - (a.at || 0))
    const marks = [...r.marks].sort((a, b) => a.i - b.i || a.s - b.s)
    return `<div class="anno-sec">笔记 <b>${notes.length}</b></div>
      ${notes.length ? notes.map(n => noteItem(id, n)).join('') : '<p class="anno-empty">本篇还没有笔记。选中原文后点“笔记”，或直接在下面写。</p>'}
      <div class="anno-sec">标记 <b>${marks.length}</b></div>
      ${marks.length ? marks.map((m, k) => markRow(id, m, k)).join('') : '<p class="anno-empty">还没有标记。选中想记的单词或句子，点“标记”。</p>'}`
  }
  function allHTML() {
    const ids = Object.keys(db.articles).filter(id => {
      const r = db.articles[id]; return (r.notes && r.notes.length) || (r.marks && r.marks.length)
    }).sort((a, b) => {
      const la = Math.max(0, ...(db.articles[a].notes || []).map(n => n.at || 0))
      const lb = Math.max(0, ...(db.articles[b].notes || []).map(n => n.at || 0))
      return lb - la
    })
    if (!ids.length) return '<p class="anno-empty">还没有任何标记或笔记。读文章时选中句子，就能标记或写笔记。</p>'
    return ids.map(id => {
      const r = get(id)
      const notes = [...r.notes].sort((a, b) => (b.at || 0) - (a.at || 0))
      return `<div class="anno-group"><h4>${esc(srcFull(id))}</h4>${notes.map(n => noteItem(id, n)).join('')}${r.marks.length ? `<details class="anno-marks"><summary>${r.marks.length} 处标记</summary>${[...r.marks].sort((a, b) => a.i - b.i || a.s - b.s).map((m, k) => markRow(id, m, k)).join('')}</details>` : ''}</div>`
    }).join('')
  }
  function renderDrawer() {
    if (pageEl && pageEl.offsetParent) pageEl.innerHTML = allHTML()
    if (!toggle) return
    const id = currentId()
    const notes = id ? get(id).notes.length : 0
    const badge = toggle.querySelector('[data-anno-count]')
    if (badge) { badge.hidden = !notes; badge.textContent = notes ? String(notes) : '' }
    if (!drawer || drawer.hidden) return
    const target = composeArticle || id
    const where = composeAnchor == null ? '全篇' : `第 ${composeAnchor + 1} 段`
    if (whereEl) whereEl.innerHTML = target ? `<b>${esc(srcText(target))}</b> · ${where}` : '打开一篇文章后再记笔记'
    if (listEl) listEl.innerHTML = drawerTab === 'this' ? (target ? thisHTML(target) : '<p class="anno-empty">打开一篇文章后，这里会列出它的标记与笔记。</p>') : allHTML()
  }
  function addNote() {
    if (!inputEl) return
    const text = inputEl.value.trim()
    if (!text) { toast('先写点什么'); inputEl.focus(); return }
    const id = composeArticle || currentId()
    if (!id) { toast('请先打开一篇文章'); return }
    const rec = ensure(id)
    const quote = pending && pending.id === id ? pending.quote : ''
    const anchor = composeAnchor != null ? composeAnchor : (pending && pending.id === id ? pending.anchor : null)
    rec.notes.unshift({ id: uid('n'), i: anchor, text, quote, at: Date.now() })
    save()
    inputEl.value = ''
    composeAnchor = null
    repaint(id, anchor != null ? [anchor] : [])
    renderDrawer()
    toast('笔记已保存')
  }
  function deleteNote(id, nid) {
    const rec = ensure(id)
    const note = rec.notes.find(n => n.id === nid)
    if (!note) return
    if (!window.confirm(`删除这条笔记？\n\n${String(note.text).slice(0, 60)}`)) return
    rec.notes = rec.notes.filter(n => n.id !== nid)
    save()
    if (note.i != null) repaint(id, [Number(note.i)])
    renderDrawer()
  }
  function editNote(id, nid) {
    const rec = ensure(id)
    const note = rec.notes.find(n => n.id === nid)
    if (!note) return
    const v = window.prompt('修改笔记', note.text)
    if (v === null) return
    note.text = v.trim()
    if (!note.text) { rec.notes = rec.notes.filter(n => n.id !== nid) }
    save()
    if (note.i != null) repaint(id, [Number(note.i)])
    renderDrawer()
  }
  function deleteMark(id, key) {
    const [i, s, e] = String(key).split('|').map(Number)
    const rec = ensure(id)
    const m = rec.marks.find(x => Number(x.i) === i && Number(x.s) === s && Number(x.e) === e)
    if (!m) return
    rec.marks = rec.marks.filter(x => x !== m)
    save()
    repaint(id, [i])
    renderDrawer()
  }

  /* ============ 跳转 ============ */
  function jumpTo(id, seg) {
    const scope = activeScope(id)
    if (scope) {
      if (seg == null || seg < 0) { scope.scrollIntoView({ behavior: 'smooth', block: 'start' }); return }
      const p = scope.querySelector(`[data-anno-p="${seg}"]`)
      if (p) { p.scrollIntoView({ behavior: 'smooth', block: 'center' }); flash(p); return }
      scope.scrollIntoView({ behavior: 'smooth', block: 'start' }); return
    }
    if (opener) { opener(id, seg); return }
    toast('这篇的原文还没打开')
  }

  /* ============ 提示条 ============ */
  let toastTimer = null
  function toast(msg) {
    if (!toastEl) {
      toastEl = document.createElement('div')
      toastEl.className = 'anno-toast'
      toastEl.hidden = true
      document.body.appendChild(toastEl)
    }
    toastEl.textContent = msg
    toastEl.hidden = false
    clearTimeout(toastTimer)
    toastTimer = setTimeout(() => { toastEl.hidden = true }, 1600)
  }

  /* ============ 事件 ============ */
  function onSelectionDone() {
    const found = collect()
    if (!found) { hideChip(); return }
    pending = found
    const sel = window.getSelection()
    const rect = sel.rangeCount ? sel.getRangeAt(0).getBoundingClientRect() : null
    if (!rect || (!rect.width && !rect.height)) { hideChip(); return }
    const er = chip.querySelector('[data-anno-erase]')
    if (er) er.hidden = !overlaps(found.id, found.ranges)
    showChipAt(rect)
  }
  function bind() {
    // 段末 ✎：统一在这里接，做完就停，避免两个视图各自再处理一遍
    document.addEventListener('click', e => {
      const b = e.target.closest && e.target.closest('[data-anno-open]')
      if (!b) return
      e.stopImmediatePropagation(); e.preventDefault()
      pending = null
      openDrawer({ anchor: Number(b.dataset.annoOpen), focus: true })
    }, true)
    // 侧边栏入口：直接看全部笔记
    document.addEventListener('click', e => {
      const b = e.target.closest && e.target.closest('[data-anno-all]')
      if (!b) return
      e.stopImmediatePropagation(); e.preventDefault()
      drawerTab = 'all'
      if (drawer) drawer.querySelectorAll('[data-anno-tab]').forEach(x => x.classList.toggle('active', x.dataset.annoTab === 'all'))
      openDrawer()
    }, true)
    // 选区浮条：先不许选区在按钮 mousedown 时塌掉
    document.addEventListener('mousedown', e => {
      dragging = true
      if (chip && chip.contains(e.target)) e.preventDefault()
    }, true)
    document.addEventListener('mouseup', e => {
      dragging = false
      if (chip && chip.contains(e.target)) return
      if (drawer && drawer.contains(e.target)) return
      if (e.target.closest && e.target.closest('textarea,input')) return
      setTimeout(onSelectionDone, 0)
    })
    document.addEventListener('keyup', e => {
      if (e.key === 'Escape') { hideChip(); return }
      if (e.shiftKey || e.key === 'a' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') setTimeout(onSelectionDone, 0)
    })
    window.addEventListener('scroll', hideChip, true)
    // 触屏长按与键盘扩选不会触发 mouseup
    document.addEventListener('selectionchange', () => {
      clearTimeout(bind._t)
      bind._t = setTimeout(() => {
        const sel = window.getSelection()
        if (!sel || sel.isCollapsed) { hideChip(); return }
        if (!dragging) onSelectionDone()
      }, 260)
    })
    chip.addEventListener('click', e => {
      const b = e.target.closest('button')
      if (!b) return
      if (b.dataset.annoMark) { toggleMark(pending && pending.ranges, b.dataset.annoMark); return }
      if (b.dataset.annoErase !== undefined) {
        if (pending) { const n = eraseRanges(pending.id, pending.ranges); toast(n ? '已取消标记' : '这里没有标记') }
        hideChip(); pending = null
        try { window.getSelection().removeAllRanges() } catch (e) { }
        return
      }
      if (b.dataset.annoNote !== undefined) {
        if (pending) { composeArticle = pending.id; composeAnchor = pending.anchor }
        openDrawer({ anchor: pending ? pending.anchor : null, focus: true })
        hideChip()
        return
      }
    })
    drawer.addEventListener('click', onListClick)
  }
  function onListClick(e) {
      const b = e.target.closest('button')
      if (!b) return
      const id = b.dataset.annoAid || composeArticle || currentId()
      if (b.dataset.annoClose !== undefined) { closeDrawer(); return }
      if (b.dataset.annoSave !== undefined) { addNote(); return }
      if (b.dataset.annoDel) { deleteNote(id, b.dataset.annoDel); return }
      if (b.dataset.annoEdit) { editNote(id, b.dataset.annoEdit); return }
      if (b.dataset.annoMarkDel !== undefined) { deleteMark(id, b.dataset.annoMarkDel); return }
      if (b.dataset.annoJump) {
        const [aid, seg] = b.dataset.annoJump.split('|')
        jumpTo(aid, Number(seg))
        return
      }
  }
  /* 复习页里的"笔记"：列出全部标记与笔记 */
  let pageEl = null
  function renderPage(el) {
    if (el && el !== pageEl) { pageEl = el; el.addEventListener('click', onListClick) }
    if (pageEl) pageEl.innerHTML = allHTML()
  }

  function init() {
    if (!document.body) return
    buildChip(); buildDrawer(); bind()
    if (db.drawer) openDrawer()
  }

  window.TEM8_ANNO = {
    textHTML, noteCount, get, repaint, renderDrawer, renderPage,
    unmarkAt, isMarked, eraseRanges,
    openDrawer: (o) => openDrawer(o), closeDrawer,
    jumpTo, toast,
    refresh(articleId) {
      const id = articleId ? String(articleId) : currentId()
      if (id) { lastArticle = id; composeArticle = id }
      renderDrawer()
    },
    setOpener(fn) { opener = fn },
    _cache: cache, _collect: collect, _pending: () => pending
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init)
  else init()
})()
