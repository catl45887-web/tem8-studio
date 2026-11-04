/* 错题本 + 生词本
 * 错题条目：tem8_workflow_v2.tools['m:<题目key>']（由 workflow.js 在交卷时写入）
 *   n 错误次数 · l 上次错的时间 · s 状态 new/learning/mastered · r 错因 · st 连续答对 · due 下次复习 · rm 已移除
 * 生词出处与复习：tem8_workflow_v2.tools['w:<单词>']
 *   at 加入时间 · a 文章 id · seg 段落 · box 记忆等级 0–4 · due 下次复习 · n 复习次数
 * 单词列表本身仍在 tem8_studio_web_v1.wordbook
 */
(() => {
  'use strict'
  const WF = 'tem8_workflow_v2', MAIN = 'tem8_studio_web_v1', DAY = 864e5
  const $ = s => document.querySelector(s)
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
  const read = k => { try { return JSON.parse(localStorage.getItem(k)) || {} } catch { return {} } }
  function writeTools(fn) {
    const s = read(WF); s.tools ||= {}; fn(s.tools)
    try { localStorage.setItem(WF, JSON.stringify(s)) } catch {}
    if (!window.TEM8_SYNC_FLUSHING) document.dispatchEvent(new Event('tem8:study-changed'))
  }
  const day = t => { const d = new Date(t); return `${d.getMonth() + 1}月${d.getDate()}日` }
  const rel = t => { const d = Math.round((new Date(t).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / DAY); return d <= 0 ? '今天' : d === 1 ? '明天' : d < 7 ? `${d} 天后` : day(t) }
  const W = () => window.TEM8_WORKFLOW
  const allArticles = [...(window.TEM8_2026_ARTICLES || []), ...(window.TEM8_2025_ARTICLES || []), ...(window.TEM8_MID_ARTICLES || []), ...(window.TEM8_ARCHIVE_ARTICLES || []), ...(window.TEM8_ARCHIVE_ARTICLES2 || [])]

  /* ================= 错题本 ================= */
  const STATUS = { new: '未掌握', learning: '复习中', mastered: '已掌握' }
  const REASONS = ['没读懂', '定位错', '词汇', '干扰项', '粗心']
  let mf = { type: 'all', year: 'all', reason: 'all', status: 'open', sort: 'recent' }
  let selecting = false, picked = new Set(), opened = new Set()

  function entries() {
    const tools = read(WF).tools || {}
    const out = []
    for (const [k, v] of Object.entries(tools)) {
      if (!k.startsWith('m:') || !v || v.rm) continue
      const info = W()?.itemInfo(v.k || k.slice(2)); if (!info) continue
      out.push({ ...v, k: v.k || k.slice(2), s: v.s || 'new', info })
    }
    return out
  }
  const count = () => entries().filter(e => e.s !== 'mastered').length
  function filtered(list) {
    let l = list.filter(e =>
      (mf.type === 'all' || e.info.p.kind === mf.type) &&
      (mf.year === 'all' || e.info.p.year === Number(mf.year)) &&
      (mf.reason === 'all' || (mf.reason === 'none' ? !e.r : e.r === mf.reason)) &&
      (mf.status === 'all' || (mf.status === 'open' ? e.s !== 'mastered' : e.s === mf.status)))
    l.sort(mf.sort === 'most' ? (a, b) => (b.n || 0) - (a.n || 0) || (b.l || 0) - (a.l || 0) : (a, b) => (b.l || 0) - (a.l || 0))
    return l
  }
  const chip = (attr, val, label, on, extra = '') => `<button type="button" class="pq-chip sm ${on ? 'on' : ''}" ${attr}="${esc(val)}" aria-pressed="${on}">${label}${extra}</button>`
  function mistakeCard(e) {
    const it = e.info, isOpen = opened.has(e.k), now = Date.now()
    const title = it.kind === 'blank' ? `第 ${it.no} 空 · 正确答案 <span class="rv-hide">${esc(String(it.answer || '').replace(/\s*\/\/\s*/g, ' 或 '))}</span>` : esc(it.prompt || (it.options || []).join(' / '))
    const due = e.s !== 'mastered' && e.due ? (e.due <= now ? '<b class="rv-due">该复习了</b>' : `下次复习 ${rel(e.due)}`) : ''
    const detail = isOpen ? `<div class="rv-detail">${it.kind === 'choice' ? `<ol class="pq-ropts">${(it.options || []).map((o, i) => `<li class="${i === it.answer ? 'right' : ''}"><b>${'ABCD'[i]}</b>${esc(o)}</li>`).join('')}</ol>` : ''}<div class="pq-analysis">${it.answer !== undefined && it.kind === 'choice' ? `<div class="pq-an-sec"><h5>正确答案</h5><p><b>${'ABCD'[it.answer]}</b></p></div>` : ''}${W().analysisHTML(it)}</div>
      <div class="pq-reasons"><span>错因</span>${REASONS.map(r => `<button type="button" class="pq-chip xs ${e.r === r ? 'on' : ''}" data-rv-reason="${esc(e.k)}" data-r="${r}" aria-pressed="${e.r === r}">${r}</button>`).join('')}</div>
      <div class="rv-detail-actions"><button type="button" class="pq-link" data-rv-status="${esc(e.k)}">${e.s === 'mastered' ? '标为未掌握' : '标为已掌握'}</button><button type="button" class="pq-link danger" data-rv-remove="${esc(e.k)}">移出错题本</button></div></div>` : ''
    return `<article class="rv-card ${picked.has(e.k) ? 'picked' : ''} ${isOpen ? 'open' : ''}">
      ${selecting ? `<label class="rv-pick"><input type="checkbox" data-rv-pick="${esc(e.k)}" ${picked.has(e.k) ? 'checked' : ''} aria-label="选择这道题"></label>` : ''}
      <div class="rv-body"><div class="rv-meta"><span class="rv-tag t-${it.p.kind}">${it.typeName}</span><span>${esc(it.label.replace(/^\d{4} · [^·]+ · /, it.p.year + ' · '))}</span><span class="rv-status s-${e.s}">${e.fl && !e.n ? '存疑' : STATUS[e.s]}</span></div>
      <h4>${title}</h4>
      <div class="rv-foot"><span>${e.n ? `错 ${e.n} 次 · 上次 ${day(e.l)}` : `标记于 ${day(e.f || e.l)}`}</span>${due ? `<span>${due}</span>` : ''}${e.r ? `<span class="rv-reason">${esc(e.r)}</span>` : ''}<span class="rv-acts"><button type="button" class="pq-link" data-rv-open="${esc(e.k)}" aria-expanded="${isOpen}">${isOpen ? '收起' : '看解析'}</button><button type="button" class="pq-link" data-rv-redo="${esc(e.k)}">重做</button></span></div>${detail}</div></article>`
  }
  let legacyItems = []
  function renderMistakes(legacy) {
    if (legacy) legacyItems = legacy
    const box = $('#mistakes-content'); if (!box) return
    if (!W()) { box.innerHTML = ''; return }
    const all = entries(), now = Date.now()
    const list = filtered(all)
    const dueN = all.filter(e => e.s !== 'mastered' && (e.due || 0) <= now).length
    const legacyHTML = legacyItems.length ? `<div class="section-heading"><div><span class="section-index">例</span><h2>示例题错题</h2></div></div><div class="review-list">${legacyItems.map(q => `<div class="review-item"><div><small>${esc(q.typeName)}</small><h3>${esc(q.prompt)}</h3></div><button data-start-one="${esc(q.id)}">重做</button></div>`).join('')}</div>` : ''
    if (!all.length) {
      box.innerHTML = `<div class="rv-empty"><div class="rv-empty-ico" aria-hidden="true">◇</div><strong>还没有错题，去练一套吧</strong><p>交卷后答错的选择题和听力填空会自动收进来；做题时标了“存疑”的题也会在这里。</p><button type="button" class="primary-btn" data-view="papers">去练习 <span>→</span></button></div>${legacyHTML}`
      return
    }
    const years = [...new Set(all.map(e => e.info.p.year))].sort((a, b) => b - a)
    const types = [['all', '全部'], ['reading', '阅读'], ['lecture', '听力 A'], ['interview', '听力 B']].filter(([v]) => v === 'all' || all.some(e => e.info.p.kind === v))
    const reasonsUsed = REASONS.filter(r => all.some(e => e.r === r))
    const startPool = list.filter(e => e.s !== 'mastered')
    const pool = (startPool.some(e => (e.due || 0) <= now) ? startPool.filter(e => (e.due || 0) <= now) : startPool.length ? startPool : list).slice(0, 20)
    box.innerHTML = `<div class="rv-summary"><div><b>${all.filter(e => e.s !== 'mastered').length}</b><span>待掌握</span></div><div><b>${dueN}</b><span>今天该复习</span></div><div><b>${all.filter(e => e.s === 'mastered').length}</b><span>已掌握</span></div><button type="button" class="primary-btn" data-rv-start ${pool.length ? '' : 'disabled'}>开始复习 <span>${pool.length} 题</span></button></div>
      <p class="rv-tip">复习时连续答对 2 次自动标为“已掌握”；答对后按 1 / 3 / 7 / 14 天安排下次复习。</p>
      <div class="rv-filters">
        <div><span>题型</span>${types.map(([v, l]) => chip('data-rv-f-type', v, l, mf.type === v)).join('')}</div>
        <div><span>年份</span>${chip('data-rv-f-year', 'all', '全部', mf.year === 'all')}${years.map(y => chip('data-rv-f-year', y, y, String(mf.year) === String(y))).join('')}</div>
        <div><span>错因</span>${chip('data-rv-f-reason', 'all', '全部', mf.reason === 'all')}${REASONS.map(r => chip('data-rv-f-reason', r, r, mf.reason === r, reasonsUsed.includes(r) ? '' : '')).join('')}${chip('data-rv-f-reason', 'none', '未标注', mf.reason === 'none')}</div>
        <div><span>状态</span>${[['open', '待掌握'], ['new', '未掌握'], ['learning', '复习中'], ['mastered', '已掌握'], ['all', '全部']].map(([v, l]) => chip('data-rv-f-status', v, l, mf.status === v)).join('')}</div>
      </div>
      <div class="rv-toolbar"><div class="pq-seg sm"><button type="button" data-rv-sort="recent" class="${mf.sort === 'recent' ? 'on' : ''}">最近错</button><button type="button" data-rv-sort="most" class="${mf.sort === 'most' ? 'on' : ''}">错得最多</button></div><span class="rv-count">${list.length} 题</span>
        ${selecting ? `<button type="button" class="pq-link" data-rv-pickall>${picked.size === list.length && list.length ? '取消全选' : '全选'}</button><button type="button" class="pq-link danger" data-rv-batch-remove ${picked.size ? '' : 'disabled'}>移除所选 (${picked.size})</button><button type="button" class="pq-link" data-rv-select>完成</button>` : `<button type="button" class="pq-link" data-rv-select>批量管理</button><button type="button" class="pq-link" data-rv-export>导出</button>`}</div>
      <div class="rv-list">${list.length ? list.map(mistakeCard).join('') : '<div class="rv-empty sm"><strong>没有符合筛选条件的题</strong><button type="button" class="pq-link" data-rv-reset>清除筛选</button></div>'}</div>${legacyHTML}`
  }
  function exportMistakes() {
    const list = filtered(entries()), E = window.TEM8_EXPORT; if (!E || !list.length) return
    const strip = s => String(s || '').replace(/\n+/g, '\n')
    const txt = list.map((e, i) => { const it = e.info
      return `${i + 1}. ${it.label}　错 ${e.n || 0} 次${e.r ? '　错因：' + e.r : ''}\n${it.prompt ? it.prompt + '\n' : ''}${(it.options || []).map((o, j) => `   ${'ABCD'[j]}. ${o}`).join('\n')}${it.options ? '\n' : ''}正确答案：${it.kind === 'choice' ? 'ABCD'[it.answer] ?? '暂无' : String(it.answer || '暂无').replace(/\s*\/\/\s*/g, ' 或 ')}\n${it.analysis ? '解析：' + strip(it.analysis) + '\n' : ''}` }).join('\n')
    E.txt(`专八错题本 · ${list.length} 题 · 导出于 ${E.stamp()}\n\n${txt}`, `专八错题本-${E.stamp()}.txt`)
  }

  /* ================= 生词本 ================= */
  const BOX = [1, 2, 4, 7, 15]
  let wv = { view: 'list', q: '', sort: 'time', src: 'all' }
  let queue = [], qi = 0, flipped = false, sessionDone = 0
  const wordbook = () => { const w = read(MAIN).wordbook; return Array.isArray(w) ? w : [] }
  const metaAll = () => { const t = read(WF).tools || {}, m = {}; for (const [k, v] of Object.entries(t)) if (k.startsWith('w:')) m[k.slice(2)] = v || {}; return m }
  function noteWord(word, ctx) {
    const w = String(word || '').toLowerCase(); if (!w) return
    writeTools(t => { const old = t['w:' + w] || {}; t['w:' + w] = { ...old, at: Date.now(), ...(ctx && ctx.articleId ? { a: ctx.articleId, seg: Number.isFinite(ctx.seg) ? ctx.seg : -1 } : {}) } })
  }
  const art = id => allArticles.find(a => a.id === id)
  function srcLabel(m) { const a = m && art(m.a); if (!a) return ''; const same = allArticles.filter(x => x.year === a.year); const i = same.indexOf(a); return `${a.year} · P${i + 1}${m.seg >= 0 ? ` ¶${m.seg + 1}` : ''}` }
  function exampleFrom(w, m) {
    const a = m && art(m.a)
    const pick = text => { const ss = String(text || '').match(/[^.!?]+[.!?]+["”’]?/g) || [String(text || '')]; const re = new RegExp(`\\b${w.replace(/[^a-z'-]/g, '').slice(0, Math.max(3, w.length - 2))}[a-z]*`, 'i'); return (ss.find(s => re.test(s)) || '').trim() }
    if (a) {
      const segs = m.seg >= 0 && a.segments[m.seg] ? [a.segments[m.seg], ...a.segments] : a.segments
      for (const s of segs) { const hit = pick(s.en); if (hit) return { en: hit, src: true } }
    }
    const e = window.TEM8_DICT?.raw(w)?.examples?.[0]
    return e ? { en: e.en, cn: e.cn } : null
  }
  const hl = (text, w) => esc(text).replace(new RegExp(`\\b(${w.replace(/[^a-z'-]/g, '').slice(0, Math.max(3, w.length - 2))}[a-z]*)`, 'gi'), '<mark>$1</mark>')
  const level = m => m && Number.isFinite(m.box) ? m.box + 1 : 0
  function wordsSorted() {
    const list = wordbook(), meta = metaAll()
    let rows = list.map((w, i) => ({ w, i, m: meta[w] || {} }))
    if (wv.src !== 'all') rows = rows.filter(r => wv.src === 'none' ? !art(r.m.a) : String(art(r.m.a)?.year) === wv.src)
    if (wv.q) { const q = wv.q.toLowerCase(); rows = rows.filter(r => r.w.includes(q) || (window.TEM8_DICT?.entry(r.w).cn || '').includes(wv.q)) }
    const t = r => r.m.at || r.i
    rows.sort(wv.sort === 'alpha' ? (a, b) => a.w.localeCompare(b.w) : wv.sort === 'mastery' ? (a, b) => level(a.m) - level(b.m) || t(b) - t(a) : (a, b) => t(b) - t(a))
    return rows
  }
  function renderWords() {
    const bar = $('#wordbook-toolbar'), list = $('#wordbook-list'); if (!list) return
    const words = wordbook(), D = window.TEM8_DICT
    if (!words.length) { if (bar) bar.innerHTML = ''; list.innerHTML = `<div class="rv-empty"><div class="rv-empty-ico" aria-hidden="true">✎</div><strong>生词本还是空的</strong><p>阅读或做题时点开单词，点“加入单词本”就会出现在这里，还会记下它出自哪篇文章。</p><button type="button" class="primary-btn" data-view="library">去读真题 <span>→</span></button></div>`; return }
    if (D && D.needs(words)) {
      list.innerHTML = '<div class="rv-empty sm">正在加载词典…</div>'
      D.ensure(words).then(() => { if ($('#words-view')?.classList.contains('active')) renderWords() }).catch(() => { list.innerHTML = '<div class="rv-empty sm">词典加载失败，请刷新页面重试。</div>' })
      return
    }
    const meta = metaAll(), now = Date.now()
    const due = words.filter(w => !meta[w]?.due || meta[w].due <= now).length
    if (bar) bar.innerHTML = `<div class="pq-seg" role="tablist"><button type="button" role="tab" data-wv-view="list" class="${wv.view === 'list' ? 'on' : ''}" aria-selected="${wv.view === 'list'}">列表</button><button type="button" role="tab" data-wv-view="cards" class="${wv.view === 'cards' ? 'on' : ''}" aria-selected="${wv.view === 'cards'}">卡片复习 <small>${due}</small></button></div><span class="rv-count">共 ${words.length} 词</span><span class="rv-spacer"></span><button type="button" class="pq-link" data-wv-export="txt">导出 txt</button><button type="button" class="pq-link" data-wv-export="docx">导出 Word</button><button type="button" class="pq-link" data-wv-export="dictation">默写版</button><button type="button" class="pq-link danger" data-word-clear>清空</button>`
    if (wv.view === 'cards') { renderCards(); return }
    const rows = wordsSorted()
    const years = [...new Set(words.map(w => art(meta[w]?.a)?.year).filter(Boolean))].sort((a, b) => b - a)
    list.innerHTML = `<div class="wv-tools"><input type="search" class="wv-search" placeholder="搜索单词或释义" value="${esc(wv.q)}" data-wv-search aria-label="搜索生词"><div class="pq-seg sm">${[['time', '加入时间'], ['alpha', '字母'], ['mastery', '掌握度']].map(([v, l]) => `<button type="button" data-wv-sort="${v}" class="${wv.sort === v ? 'on' : ''}">${l}</button>`).join('')}</div></div>
      ${years.length ? `<div class="rv-filters one"><div><span>来源</span>${chip('data-wv-src', 'all', '全部', wv.src === 'all')}${years.map(y => chip('data-wv-src', String(y), y + ' 年', wv.src === String(y))).join('')}${chip('data-wv-src', 'none', '未记录', wv.src === 'none')}</div></div>` : ''}
      <div class="wordbook-grid wv-grid">${rows.map(({ w, m }) => { const e = D ? D.entry(w) : { word: w }, lv = level(m), src = srcLabel(m)
        return `<article class="wordbook-row wv-row"><div class="wb-head"><strong>${esc(e.word)}</strong>${e.phon ? `<span class="wb-phon">/${esc(e.phon)}/</span>` : ''}${e.pos ? `<span class="wb-pos">${esc(e.pos)}</span>` : ''}<button type="button" class="wv-say" data-wv-say="${esc(w)}" aria-label="朗读 ${esc(w)}">▶︎</button><button class="wb-del" data-word-remove="${esc(w)}" title="移出生词本" aria-label="移出生词本">×</button></div><p>${esc(e.cn || '词典暂未收录')}</p>${e.en ? `<small>${esc(e.en)}</small>` : ''}<div class="wv-foot"><span class="wv-level" title="掌握度 ${lv}/5" aria-label="掌握度 ${lv}/5">${[1, 2, 3, 4, 5].map(i => `<i class="${i <= lv ? 'on' : ''}"></i>`).join('')}</span>${src ? `<button type="button" class="wv-src" data-wv-open="${esc(m.a)}" data-seg="${m.seg}">${esc(src)} →</button>` : ''}</div></article>` }).join('') || '<div class="rv-empty sm"><strong>没有找到</strong></div>'}</div>`
  }
  function buildQueue(all) {
    const meta = metaAll(), now = Date.now()
    let ws = wordbook()
    if (!all) ws = ws.filter(w => !meta[w]?.due || meta[w].due <= now)
    queue = ws.sort((a, b) => (meta[a]?.due || 0) - (meta[b]?.due || 0)).slice(0, 30); qi = 0; flipped = false; sessionDone = 0
  }
  function renderCards() {
    const list = $('#wordbook-list'), D = window.TEM8_DICT
    if (!queue.length || qi >= queue.length) {
      if (qi && qi >= queue.length && queue.length) { list.innerHTML = `<div class="rv-empty"><div class="rv-empty-ico" aria-hidden="true">✓</div><strong>这一轮复习完了</strong><p>共 ${sessionDone} 张。到期的词会按 1、2、4、7、15 天再出现。</p><button type="button" class="secondary-btn" data-wv-again>再过一遍全部</button><button type="button" class="primary-btn" data-wv-view="list">回到列表</button></div>`; return }
      buildQueue(false)
      if (!queue.length) { list.innerHTML = `<div class="rv-empty"><div class="rv-empty-ico" aria-hidden="true">☼</div><strong>今天没有到期的词</strong><p>可以把整本再过一遍，加深印象。</p><button type="button" class="primary-btn" data-wv-again>全部过一遍 <span>→</span></button></div>`; return }
    }
    const w = queue[qi], e = D ? D.entry(w) : { word: w }, m = metaAll()[w] || {}, ex = exampleFrom(w, m), src = srcLabel(m)
    list.innerHTML = `<div class="wv-card-wrap"><div class="wv-progress"><span>${qi + 1} / ${queue.length}</span><div><i style="width:${Math.round(qi / queue.length * 100)}%"></i></div></div>
      <div class="wv-card ${flipped ? 'flipped' : ''}" data-wv-flip role="button" tabindex="0" aria-label="${flipped ? '' : '点击翻面看释义'}">
        <div class="wv-front"><strong>${esc(e.word)}</strong>${e.phon ? `<span>/${esc(e.phon)}/</span>` : ''}<button type="button" class="wv-say big" data-wv-say="${esc(w)}" aria-label="朗读">▶︎ 朗读</button>${flipped ? '' : '<small>想一想它的意思，点卡片翻面</small>'}</div>
        ${flipped ? `<div class="wv-back"><p class="wv-cn">${e.pos ? `<em>${esc(e.pos)}</em>` : ''}${esc(e.cn || '词典暂未收录')}</p>${e.en ? `<p class="wv-en">${esc(e.en)}</p>` : ''}${ex ? `<blockquote>${hl(ex.en, w)}${ex.cn ? `<small>${esc(ex.cn)}</small>` : ''}</blockquote>` : ''}${src && ex?.src ? `<button type="button" class="wv-src" data-wv-open="${esc(m.a)}" data-seg="${m.seg}">出处 ${esc(src)} · 回到原文 →</button>` : ''}</div>` : ''}
      </div>
      ${flipped ? `<div class="wv-grade"><button type="button" data-wv-grade="0" class="g0"><b>不认识</b><small>明天再来 · 1</small></button><button type="button" data-wv-grade="1" class="g1"><b>模糊</b><small>${BOX[Math.max(0, Math.min(4, Number.isFinite(m.box) ? m.box : 0))]} 天后 · 2</small></button><button type="button" data-wv-grade="2" class="g2"><b>认识</b><small>${BOX[Math.min(4, (Number.isFinite(m.box) ? m.box : -1) + 1)]} 天后 · 3</small></button></div>` : '<div class="wv-grade"><button type="button" class="wv-flipbtn" data-wv-flip>翻面 <small>空格</small></button></div>'}</div>`
  }
  function gradeWord(g) {
    const w = queue[qi]; if (!w) return
    const now = Date.now()
    writeTools(t => { const m = t['w:' + w] || { at: now }
      let box = Number.isFinite(m.box) ? m.box : -1
      box = g === 2 ? Math.min(4, box + 1) : g === 1 ? Math.max(0, box) : 0
      t['w:' + w] = { ...m, box, due: now + BOX[box] * DAY, last: now, n: (m.n || 0) + 1 } })
    if (g === 0) queue.push(w)
    sessionDone++; qi++; flipped = false; renderCards()
  }
  function exportWords(kind) {
    const words = wordbook(), E = window.TEM8_EXPORT, D = window.TEM8_DICT; if (!words.length || !E || !D) return
    if (D.needs(words)) { D.ensure(words).then(() => exportWords(kind)).catch(() => alert('词典加载失败，请刷新页面重试。')); return }
    const meta = metaAll(), rows = wordsSorted().map(r => { const e = D.entry(r.w), ex = exampleFrom(r.w, r.m); return { ...e, ex: ex?.en || '', src: srcLabel(r.m) } }), stamp = E.stamp()
    if (kind === 'txt') { E.txt(`专八生词本 · 共 ${rows.length} 词 · 导出于 ${stamp}\n\n` + rows.map((e, i) => `${String(i + 1).padStart(3, ' ')}. ${e.word}${e.phon ? '  /' + e.phon + '/' : ''}${e.pos ? '  ' + e.pos : ''}\n     ${e.cn || '（词典暂未收录）'}${e.ex ? '\n     例：' + e.ex : ''}${e.src ? '\n     出处：' + e.src : ''}`).join('\n') + '\n', `专八生词本-${stamp}.txt`); return }
    const x = E.xmlEsc, dict = kind === 'dictation', widths = [1900, 1700, 2600, 3500]
    const cell = (t, w, opt = {}) => `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/>${opt.fill ? `<w:shd w:val="clear" w:color="auto" w:fill="${opt.fill}"/>` : ''}<w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr><w:spacing w:before="40" w:after="40"/></w:pPr><w:r><w:rPr>${opt.b ? '<w:b/>' : ''}<w:sz w:val="${opt.sz || 20}"/>${opt.color ? `<w:color w:val="${opt.color}"/>` : ''}</w:rPr><w:t xml:space="preserve">${x(t)}</w:t></w:r></w:p></w:tc>`
    const head = `<w:tr><w:trPr><w:tblHeader/></w:trPr>${['单词', '音标', '释义', '例句'].map((h, i) => cell(h, widths[i], { b: true, fill: 'EFE9DE' })).join('')}</w:tr>`
    const body = rows.map(e => `<w:tr><w:trPr><w:cantSplit/><w:trHeight w:val="${dict ? 620 : 400}"/></w:trPr>${cell(e.word, widths[0], { b: true, sz: 22 })}${cell(e.phon ? '/' + e.phon + '/' : '', widths[1], { color: '6B6156' })}${cell(dict ? '' : [e.pos, e.cn].filter(Boolean).join(' '), widths[2])}${cell(e.ex, widths[3], { sz: 18, color: '5A5248' })}</w:tr>`).join('')
    const border = '<w:tblBorders>' + ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(b => `<w:${b} w:val="single" w:sz="4" w:space="0" w:color="CFC6B8"/>`).join('') + '</w:tblBorders>'
    const tbl = `<w:tbl><w:tblPr><w:tblW w:w="${widths.reduce((a, b) => a + b)}" w:type="dxa"/>${border}<w:tblLayout w:type="fixed"/><w:tblCellMar><w:left w:w="90" w:type="dxa"/><w:right w:w="90" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${widths.map(w => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>${head}${body}</w:tbl>`
    const title = E.paras([{ text: dict ? '专八生词本 · 默写版' : '专八生词本', size: 34, bold: true }, { text: `共 ${rows.length} 词 · 导出于 ${stamp}${dict ? ' · 看单词写释义' : ''}`, size: 18, color: '6B6156', before: 40 }])
    E.docxXml(title + tbl, `专八生词本${dict ? '-默写版' : ''}-${stamp}.docx`)
  }

  /* ================= 事件 ================= */
  document.addEventListener('click', e => {
    const b = e.target.closest('button,[data-wv-flip]'); if (!b) return
    const d = b.dataset
    // 错题本
    if (d.rvStart !== undefined) { const all = entries(), now = Date.now(), list = filtered(all).filter(x => x.s !== 'mastered'); const pool = (list.some(x => (x.due || 0) <= now) ? list.filter(x => (x.due || 0) <= now) : list.length ? list : filtered(all)).slice(0, 20); W()?.startKeys(pool.map(x => x.k), '错题复习'); return }
    for (const f of ['type', 'year', 'reason', 'status']) { const v = d['rvF' + f[0].toUpperCase() + f.slice(1)]; if (v !== undefined) { mf[f] = v; picked.clear(); renderMistakes(); return } }
    if (d.rvSort) { mf.sort = d.rvSort; renderMistakes(); return }
    if (d.rvReset !== undefined) { mf = { ...mf, type: 'all', year: 'all', reason: 'all', status: 'all' }; renderMistakes(); return }
    if (d.rvOpen) { opened.has(d.rvOpen) ? opened.delete(d.rvOpen) : opened.add(d.rvOpen); renderMistakes(); return }
    if (d.rvRedo) { W()?.startKeys([d.rvRedo], '单题重做'); return }
    if (d.rvReason) { const k = d.rvReason, r = d.r; writeTools(t => { if (t['m:' + k]) t['m:' + k].r = t['m:' + k].r === r ? '' : r }); renderMistakes(); return }
    if (d.rvStatus) { const k = d.rvStatus; writeTools(t => { const m = t['m:' + k]; if (m) { m.s = m.s === 'mastered' ? 'learning' : 'mastered'; m.st = m.s === 'mastered' ? 2 : 0; m.due = Date.now() + (m.s === 'mastered' ? 14 : 1) * DAY } }); renderMistakes(); window.TEM8_RENDER_DASH?.(); return }
    if (d.rvRemove) { const k = d.rvRemove; writeTools(t => { if (t['m:' + k]) t['m:' + k].rm = Date.now() }); opened.delete(k); renderMistakes(); window.TEM8_RENDER_DASH?.(); return }
    if (d.rvSelect !== undefined) { selecting = !selecting; picked.clear(); renderMistakes(); return }
    if (d.rvPickall !== undefined) { const l = filtered(entries()); picked = picked.size === l.length ? new Set() : new Set(l.map(x => x.k)); renderMistakes(); return }
    if (d.rvBatchRemove !== undefined) { if (!picked.size || !confirm(`把选中的 ${picked.size} 题移出错题本？再次答错时会重新收进来。`)) return; const ks = [...picked]; writeTools(t => { for (const k of ks) if (t['m:' + k]) t['m:' + k].rm = Date.now() }); picked.clear(); selecting = false; renderMistakes(); window.TEM8_RENDER_DASH?.(); return }
    if (d.rvExport !== undefined) { exportMistakes(); return }
    // 生词本
    if (d.wvView) { wv.view = d.wvView; if (wv.view === 'cards') { buildQueue(false) } renderWords(); return }
    if (d.wvSort) { wv.sort = d.wvSort; renderWords(); return }
    if (d.wvSrc) { wv.src = d.wvSrc; renderWords(); return }
    if (d.wvSay) { e.stopPropagation(); const raw = window.TEM8_DICT?.raw(d.wvSay); const src = raw?.media?.us || raw?.media?.uk; if (src) { try { new Audio(src).play().catch(() => window.TEM8_SPEAK?.(d.wvSay)) } catch { window.TEM8_SPEAK?.(d.wvSay) } } else window.TEM8_SPEAK?.(d.wvSay); return }
    if (d.wvOpen) { e.stopPropagation(); window.TEM8_OPEN_ARTICLE?.(d.wvOpen, Number(d.seg)); return }
    if (d.wvFlip !== undefined) { flipped = !flipped; renderCards(); return }
    if (d.wvGrade) { gradeWord(Number(d.wvGrade)); return }
    if (d.wvAgain !== undefined) { buildQueue(true); renderCards(); return }
    if (d.wvExport) { exportWords(d.wvExport); return }
  })
  document.addEventListener('change', e => { const k = e.target.dataset?.rvPick; if (k) { e.target.checked ? picked.add(k) : picked.delete(k); renderMistakes() } })
  document.addEventListener('input', e => { if (e.target.dataset?.wvSearch !== undefined) { wv.q = e.target.value.trim(); const pos = e.target.selectionStart; renderWords(); const s = $('[data-wv-search]'); if (s) { s.focus(); try { s.setSelectionRange(pos, pos) } catch {} } } })
  document.addEventListener('keydown', e => {
    if (!$('#words-view')?.classList.contains('active') || wv.view !== 'cards' || !queue.length || qi >= queue.length) return
    const tag = (e.target.tagName || '').toLowerCase(); if (['input', 'textarea', 'select'].includes(tag)) return
    if (e.key === ' ' || e.key === 'Enter') { if (e.target.closest?.('button')) return; e.preventDefault(); flipped = !flipped; renderCards() }
    else if (flipped && ['1', '2', '3'].includes(e.key)) { e.preventDefault(); gradeWord(Number(e.key) - 1) }
  })
  document.addEventListener('tem8:mistakes-changed', () => window.TEM8_RENDER_DASH?.())

  window.TEM8_REVIEW = { renderMistakes, renderWords, count, noteWord }
  window.TEM8_RENDER_DASH?.()
})()
/* 「我的」页：把备份 / 同步模块写出的状态文字，汇总到顶部状态行 */
;(() => {
  const $ = id => document.getElementById(id)
  if (!$('mx-last')) return
  function sync() {
    const last = $('backup-last')?.textContent || ''
    const m = last.match(/上次导出：(.+)$/)
    $('mx-last').textContent = m ? m[1].replace(/:\d\d$/, '') : '从未'
    $('mx-last').classList.toggle('warn', !m)
    const st = $('sync-status')?.textContent || ''
    const on = !$('sync-connected')?.hidden
    $('mx-sync').textContent = on ? (/失败|错误|无法/.test(st) ? '连接异常' : '已开启') : /未配置|不可用|暂不可用/.test(st) ? '不可用' : '未开启'
    const p = $('backup-persistence')?.textContent || ''
    const granted = /已授予/.test(p)
    $('mx-store').textContent = granted ? '已受保护' : /不支持|无法|不可用/.test(p) ? '未受保护' : /尚未/.test(p) ? '未受保护' : '检查中'
    $('mx-persist').hidden = granted
    $('mx-warn').hidden = !/无法写入/.test($('backup-summary')?.textContent || '')
  }
  const mo = new MutationObserver(sync)
  ;['backup-last', 'sync-status', 'backup-persistence', 'backup-summary', 'sync-connected'].forEach(id => { const el = $(id); if (el) mo.observe(el, { childList: true, characterData: true, subtree: true, attributes: true }) })
  sync()
})()
