/* 精听学习
 * 顶部：年份（有原文的）· Section · Aa 文本设置 · 听写
 * 原文：点词查词（生词本里的词加下划线），点序号或句子空白处从这句播放
 * 文本设置：原文 正常 / 点击显示 / 遮盖 / 隐藏，字号
 * 听写：一次一句的卡片，回车核对、再回车下一句
 * 底部一行播放条：播放进度 · 上一句 / 下一句 · 单句循环 · 倍速 · 更多（A–B、±15 秒）
 * 记录存 tem8_intensive_v1：year section show fs rate pos{} dict{} dscore{} corrections{}
 */
(() => {
  'use strict'
  const scripts = window.TEM8_TRANSCRIPTS || {}
  const listening = { ...(window.TEM8_LISTENING_ARCHIVE || {}), ...(window.TEM8_LISTENING_2026 || {}), ...(window.TEM8_MID_LISTENING || {}) }
  const allYears = [...new Set([...Object.keys(listening).map(Number), ...Object.keys(scripts).map(Number)])].sort((a, b) => b - a)
  const hasAudio = y => !!listening[y]?.audio
  const hasScript = (y, s) => !!scripts[y]?.[s]?.length
  const anyScript = y => hasScript(y, 'A') || hasScript(y, 'B')
  const KEY = 'tem8_intensive_v1'
  const RATES = [1, 1.25, 0.75]
  const SHOWS = [['normal', '正常'], ['tap', '点击显示'], ['cover', '遮盖'], ['hide', '隐藏']]
  const FS = [[0.9, '小'], [1, '标准'], [1.15, '大']]
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
  const fmt = n => { n = Number(n) || 0; return `${Math.floor(n / 60)}:${String(Math.floor(n % 60)).padStart(2, '0')}` }
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {} } catch { return {} } }
  let saved = read()
  const playable = allYears.filter(hasAudio)
  let year = playable.includes(Number(saved.year)) ? Number(saved.year) : (playable.find(anyScript) || playable[0])
  let section = saved.section === 'B' ? 'B' : 'A'
  let show = SHOWS.some(s => s[0] === saved.show) ? saved.show : (saved.mode === 'hide' ? 'tap' : 'normal')
  let view = 'read', dIdx = 0, dChecked = false
  let selected = -1, active = -1, loopOn = false, loopIdx = -1, ab = { a: null, b: null }, stopAt = null, raf = 0, opening = false, lastPosSave = 0
  let revealed = new Set(), book = new Set(), zhOpen = new Set()
  const host = () => document.querySelector('#intensive-content')
  const rows = () => scripts[year]?.[section] || []
  const track = () => listening[year] || {}
  const start = () => section === 'B' ? Number(track().sectionBStart) || 0 : 0
  const end = () => section === 'A' ? Number(track().sectionAEnd) || Number(track().sectionBStart) || 0 : Number(track().audioDuration) || 0
  const key = i => `${year}-${section}-${i}`
  const posKey = () => `${year}-${section}`
  const baseTime = i => Number(rows()[i]?.t ?? 0)
  const A = () => window.TEM8_AUDIO
  function time(i) {
    const exact = saved.corrections?.[key(i)]
    if (exact != null) return Number(exact)
    const anchors = [{ i: 0, t: baseTime(0) }, { i: rows().length, t: end() }]
    for (let n = 0; n < rows().length; n++) { const t = saved.corrections?.[key(n)]; if (t != null) anchors.push({ i: n, t: Number(t) }) }
    anchors.sort((a, b) => a.i - b.i)
    let left = anchors[0], right = anchors[anchors.length - 1]
    for (let n = 0; n < anchors.length - 1; n++) if (anchors[n].i <= i && i <= anchors[n + 1].i) { left = anchors[n]; right = anchors[n + 1]; break }
    const a = left.i === rows().length ? end() : baseTime(left.i)
    const b = right.i === rows().length ? end() : baseTime(right.i)
    const ratio = b > a ? (baseTime(i) - a) / (b - a) : 0
    return Math.round((left.t + (right.t - left.t) * Math.max(0, Math.min(1, ratio))) * 10) / 10
  }
  const lineEnd = i => i + 1 < rows().length ? time(i + 1) : end()
  function save() { saved.year = year; saved.section = section; saved.show = show; try { localStorage.setItem(KEY, JSON.stringify(saved)) } catch {} document.dispatchEvent(new Event('tem8:study-changed')) }
  const quiet = () => { try { localStorage.setItem(KEY, JSON.stringify(saved)) } catch {} }
  function indexAt(ct) { const d = rows(); let idx = -1; for (let i = 0; i < d.length; i++) { if (ct >= time(i) - 0.12) idx = i; else break } return idx }
  function loadBook() { try { const w = JSON.parse(localStorage.getItem('tem8_studio_web_v1') || '{}').wordbook; book = new Set(Array.isArray(w) ? w.map(x => String(x).toLowerCase()) : []) } catch { book = new Set() } }
  const inBook = w => { const l = w.toLowerCase().replace(/[’]/g, "'"); return book.has(l) || book.has(l.replace(/'s$/, '')) || book.has(l.replace(/(ies)$/, 'y')) || book.has(l.replace(/(es|s|ed|ing|ly)$/, '')) || book.has(l.replace(/(ed|ing)$/, 'e')) }

  /* ---------- 逐词比对 ---------- */
  const toks = s => String(s || '').toLowerCase().replace(/[’']/g, "'").match(/[a-z0-9']+/g) || []
  function diff(ref, mine) {
    const r = toks(ref), m = toks(mine), R = r.length, M = m.length
    const L = Array.from({ length: R + 1 }, () => new Uint16Array(M + 1))
    for (let i = R - 1; i >= 0; i--) for (let j = M - 1; j >= 0; j--) L[i][j] = r[i] === m[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1])
    const hitR = new Set(), hitM = new Set(); let i = 0, j = 0
    while (i < R && j < M) { if (r[i] === m[j]) { hitR.add(i); hitM.add(j); i++; j++ } else if (L[i + 1][j] >= L[i][j + 1]) i++; else j++ }
    let n = 0
    const html = String(ref).split(/([A-Za-z0-9’']+)/).map((t, k) => k % 2 ? `<span class="${hitR.has(n++) ? 'hit' : 'miss'}">${esc(t)}</span>` : esc(t)).join('')
    return { html, extra: m.filter((_, k) => !hitM.has(k)), score: R ? Math.round(hitR.size / R * 100) : 0 }
  }

  /* ---------- 原文 ---------- */
  function textHTML(en) {
    return String(en).split(/([A-Za-z]+(?:[’'][A-Za-z]+)?)/).map((t, k) => k % 2 ? `<span class="ix-w${inBook(t) ? ' nb' : ''}" data-ix-w="${esc(t)}">${esc(t)}</span>` : esc(t)).join('')
  }
  function lineHTML(row, i) {
    const part = section === 'B' && (i === 0 || row.part !== rows()[i - 1].part) ? `<div class="ix-part">Part ${row.part === 2 ? 'Two' : 'One'}</div>` : ''
    const sp = row.sp ? `<span class="ix-sp ${row.sp === 'W' ? 'w' : 'm'}">${row.sp === 'W' ? '主持人' : '嘉宾'}</span>` : ''
    const masked = (show === 'tap' || show === 'cover') && !revealed.has(i)
    const body = show === 'hide' && !revealed.has(i) ? `<span class="ix-slot">第 ${i + 1} 句 · 点击播放</span>` : `<span class="ix-text">${textHTML(row.en)}</span>`
    const zh = (window.TEM8_LISTENING_ZH || {})[year]?.[section]?.[i] || row.zh
    const translation = zh ? `<button type="button" class="ix-zh-toggle" data-ix-zh="${i}" aria-expanded="${zhOpen.has(i)}">${zhOpen.has(i) ? '收起译文' : '查看译文'}</button>${zhOpen.has(i) ? `<p class="ix-zh">${esc(zh)}</p>` : ''}` : ''
    return `${part}<div class="ix-line ${masked ? 'm-' + show : ''} ${i === active ? 'playing' : ''} ${i === selected ? 'selected' : ''}" data-ix-line="${i}"><button type="button" class="ix-no" data-ix-seek="${i}" aria-label="从第 ${i + 1} 句播放">${String(i + 1).padStart(2, '0')}</button><div class="ix-copy">${sp}${body}${translation}</div><time class="ix-t" data-intensive-time="${i}">${fmt(time(i))}</time></div>`
  }
  function header() {
    const main = allYears.filter(y => hasAudio(y) && anyScript(y))
    const more = allYears.filter(y => hasAudio(y) && !anyScript(y))
    const moreSel = more.includes(year)
    return `<div class="ix-top">
      <div class="ix-years" role="group" aria-label="真题年份">${main.map(y => `<button type="button" class="pq-chip sm ${y === year ? 'on' : ''}" data-intensive-year="${y}" aria-pressed="${y === year}">${y}</button>`).join('')}
        ${more.length ? `<label class="ix-more ${moreSel ? 'on' : ''}"><select data-ix-more aria-label="更多年份（只有音频）"><option value="">${moreSel ? year : '更多年份'}</option>${more.map(y => `<option value="${y}">${y} · 只有音频</option>`).join('')}</select></label>` : ''}</div>
      <div class="ix-row2"><div class="pq-seg sm" role="group" aria-label="听力部分">${['A', 'B'].map(s => `<button type="button" data-intensive-section="${s}" class="${section === s ? 'on' : ''}" aria-pressed="${section === s}">${s === 'A' ? 'Section A · 讲座' : 'Section B · 访谈'}</button>`).join('')}</div>
        ${rows().length ? `<span class="ix-tools"><button type="button" class="ix-tool ${view === 'dict' ? 'on' : ''}" data-ix-dict-toggle aria-pressed="${view === 'dict'}">听写</button><button type="button" class="ix-tool" data-ix-aa aria-label="文本设置" title="文本设置">Aa</button></span>` : ''}</div>
      <div class="ix-sheet" id="ix-sheet" hidden><div class="ix-sheet-row"><span>原文显示</span><div class="pq-seg sm">${SHOWS.map(([v, l]) => `<button type="button" data-ix-show="${v}" class="${show === v ? 'on' : ''}" aria-pressed="${show === v}">${l}</button>`).join('')}</div></div><div class="ix-sheet-row"><span>字号</span><div class="pq-seg sm">${FS.map(([v, l]) => `<button type="button" data-ix-fs="${v}" class="${(saved.fs || 1) === v ? 'on' : ''}" aria-pressed="${(saved.fs || 1) === v}">${l}</button>`).join('')}</div></div><p class="ix-sheet-tip">点单词查词，点序号从这句开始播。键盘：← → 切句，空格播放，L 单句循环。</p></div></div>`
  }
  function bar(script) {
    return `<div class="ix-bar" role="region" aria-label="播放控制"><div id="intensive-audio"></div><div class="ix-ctrl">
      <button type="button" data-ix-prev ${script ? '' : 'disabled'} aria-label="上一句" title="上一句（←）"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 5v14M18 6l-9 6 9 6z"/></svg></button>
      <button type="button" data-ix-next ${script ? '' : 'disabled'} aria-label="下一句" title="下一句（→）"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 5v14M6 6l9 6-9 6z"/></svg></button>
      <button type="button" data-ix-loop ${script ? '' : 'disabled'} aria-pressed="false" aria-label="单句循环" title="单句循环（L）"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17 2l3 3-3 3M4 11V9a4 4 0 0 1 4-4h12M7 22l-3-3 3-3M20 13v2a4 4 0 0 1-4 4H4"/></svg></button>
      <button type="button" class="ix-rate" data-ix-rate aria-label="倍速">${saved.rate || 1}×</button>
      <button type="button" data-ix-menu aria-haspopup="true" aria-label="更多播放控制">⋯</button>
      <div class="ix-menu" id="ix-menu" hidden><button type="button" data-ix-ab><span data-ix-ab-label>A–B 复读</span></button><button type="button" data-ix-skip="-15">后退 15 秒</button><button type="button" data-ix-skip="15">前进 15 秒</button></div>
    </div></div>`
  }
  function render() {
    if (!host()) return
    loadBook()
    const data = rows(), script = data.length > 0
    selected = -1; active = -1; loopOn = false; loopIdx = -1; ab = { a: null, b: null }; stopAt = null; revealed = new Set()
    if (!script) view = 'read'
    document.body.classList.add('ix-on')
    host().style.setProperty('--ix-fs', saved.fs || 1)
    const pos = saved.pos?.[posKey()]
    const body = !script ? `<div class="rv-empty sm"><strong>这一年还没有逐句原文</strong><p>可以用下方播放条整段精听。</p></div>`
      : view === 'dict' ? '<div id="ix-dict"></div>'
      : `${pos ? `<p class="ix-hint">上次听到 ${fmt(pos)}</p>` : ''}<div class="ix-list" id="intensive-lines">${data.map(lineHTML).join('')}</div>
        <details class="ix-cal" data-ix-cal><summary>句子时间不准？手动校准</summary><p class="intensive-note">选中一句，在它开头的时候点“设为起点”，结果只存在本机。</p><div class="intensive-calibration"><button type="button" data-intensive-calibrate disabled>把当前播放点设为选中句起点</button><label>选中句起点 <input type="text" id="intensive-time-input" inputmode="decimal" placeholder="13:24.5" disabled></label><button type="button" data-intensive-save disabled>保存</button><button type="button" data-intensive-reset disabled>恢复初始</button></div></details>`
    host().innerHTML = header() + body + bar(script)
    mountAudio()
    if (view === 'dict') renderDict()
    follow(); save()
  }
  function mountAudio() {
    const data = track(), el = host().querySelector('#intensive-audio')
    if (!data.audio) { el.innerHTML = '<p class="ix-hint">这一年没有录音。</p>'; return }
    A()?.mount(el, { src: data.audio, mode: 'practice', replay: true, title: `${year} · Section ${section}`, duration: Number(data.audioDuration) || 0, start: start(), end: end(), note: '' })
    applyRate()
    const pos = saved.pos?.[posKey()], audio = A()?.element
    if (pos && audio && view === 'read') { const go = () => { if (A().currentTime < pos - 1 || A().currentTime > pos + 1) A().seekTo(pos, false) }; if (audio.readyState >= 1) go(); else audio.addEventListener('loadedmetadata', () => setTimeout(go, 0), { once: true }) }
  }
  function applyRate() { const a = A()?.element; if (a) { a.playbackRate = saved.rate || 1; a.preservesPitch = true } }
  function paintActive(idx) {
    const list = host()?.querySelector('#intensive-lines'); if (!list) return
    list.querySelector('.playing')?.classList.remove('playing')
    const now = list.querySelector(`[data-ix-line="${idx}"]`)
    now?.classList.add('playing')
    const a = A()?.element
    if (now && a && !a.paused) now.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }
  function follow() {
    if (raf) cancelAnimationFrame(raf)
    const tick = () => {
      if (!host() || !document.querySelector('#intensive-view')?.classList.contains('active')) { raf = 0; return }
      const audio = A(), el = audio?.element, ct = audio?.currentTime || 0, playing = el && !el.paused
      if (playing) {
        if (stopAt != null && ct >= stopAt - 0.05) { el.pause(); stopAt = null }
        else if (ab.a != null && ab.b != null && ct >= ab.b) audio.seekTo(ab.a)
        else if (loopOn && loopIdx >= 0 && ct >= lineEnd(loopIdx) - 0.08 && ct > time(loopIdx) + 0.2) audio.seekTo(time(loopIdx))
        const now = Date.now(); if (now - lastPosSave > 4000 && view === 'read') { lastPosSave = now; (saved.pos ||= {})[posKey()] = Math.round(ct * 10) / 10; quiet() }
      }
      const idx = rows().length ? indexAt(ct) : -1
      if (idx !== active) { active = idx; paintActive(idx); if (loopOn && !playing) loopIdx = idx }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
  }
  function select(i, seek) {
    if (i < 0 || i >= rows().length) return
    selected = i; if (loopOn) loopIdx = i
    host().querySelectorAll('[data-ix-line]').forEach((el, n) => el.classList.toggle('selected', n === i))
    for (const s of ['[data-intensive-calibrate]', '[data-intensive-save]', '[data-intensive-reset]', '#intensive-time-input']) { const el = host().querySelector(s); if (el) el.disabled = false }
    const input = host().querySelector('#intensive-time-input'); if (input) input.value = fmt(time(i))
    if (seek) { stopAt = null; A()?.seekTo(time(i)) }
  }
  function playLine(i) { if (i < 0 || i >= rows().length) return; A()?.seekTo(time(i)); stopAt = lineEnd(i) }
  function step(dir) {
    const n = rows().length; if (!n) return
    if (view === 'dict') { dGo(dIdx + dir); return }
    const ct = A()?.currentTime || 0, cur = indexAt(ct)
    let target = dir < 0 ? (cur >= 0 && ct - time(cur) > 1.5 ? cur : cur - 1) : cur + 1
    target = Math.max(0, Math.min(n - 1, target))
    select(target, true)
  }
  function setLoop(on) { loopOn = on; loopIdx = on ? (selected >= 0 && Math.abs(time(selected) - (A()?.currentTime || 0)) < 30 ? selected : Math.max(0, active)) : -1; if (on) ab = { a: null, b: null }; paintCtrl() }
  function paintCtrl() {
    const h = host(); if (!h) return
    const l = h.querySelector('[data-ix-loop]'); if (l) { l.classList.toggle('on', loopOn); l.setAttribute('aria-pressed', String(loopOn)) }
    const lab = h.querySelector('[data-ix-ab-label]'), st = ab.a == null ? 0 : ab.b == null ? 1 : 2
    if (lab) lab.textContent = st === 0 ? 'A–B 复读' : st === 1 ? `已设 A ${fmt(ab.a)} · 再点设 B` : `复读 ${fmt(ab.a)}–${fmt(ab.b)} · 点击取消`
    h.querySelector('[data-ix-menu]')?.classList.toggle('on', st > 0)
    const r = h.querySelector('[data-ix-rate]'); if (r) { r.textContent = `${saved.rate || 1}×`; r.classList.toggle('on', (saved.rate || 1) !== 1) }
  }
  function parseTime(s) { const m = String(s).trim().match(/^(?:(\d+):)?(\d{1,2})(?:\.(\d))?$/); if (!m) return NaN; return (Number(m[1] || 0) * 60) + Number(m[2]) + Number(m[3] || 0) / 10 }
  function refreshTime(i) { const el = host()?.querySelector(`[data-intensive-time="${i}"]`); if (el) el.textContent = fmt(time(i)); const input = host()?.querySelector('#intensive-time-input'); if (input && selected === i) input.value = fmt(time(i)) }
  function setCorrection(t) {
    if (selected < 0 || !Number.isFinite(t) || t < start() || t > end()) return false
    const fixed = Object.keys(saved.corrections || {}).filter(k => k.startsWith(`${year}-${section}-`)).map(k => ({ i: Number(k.split('-').pop()), t: Number(saved.corrections[k]) })).filter(x => x.i !== selected)
    if (fixed.some(x => (x.i < selected && x.t >= t) || (x.i > selected && x.t <= t))) return false
    saved.corrections ||= {}; saved.corrections[key(selected)] = Math.round(t * 10) / 10
    save(); rows().forEach((_, i) => refreshTime(i)); return true
  }
  function rerenderLine(i) { const el = host()?.querySelector(`[data-ix-line="${i}"]`); if (!el) return; const tmp = document.createElement('div'); tmp.innerHTML = lineHTML(rows()[i], i); el.replaceWith(tmp.querySelector('[data-ix-line]')) }
  function savePos() { const ct = A()?.currentTime; if (ct && year && view === 'read') { (saved.pos ||= {})[posKey()] = Math.round(ct * 10) / 10; save() } }

  /* ---------- 听写：一次一句 ---------- */
  function dGo(i) { const n = rows().length; dIdx = Math.max(0, Math.min(n, i)); dChecked = false; saved.dpos ||= {}; saved.dpos[posKey()] = dIdx; quiet(); renderDict(); if (dIdx < n) setTimeout(() => playLine(dIdx), 120) }
  function renderDict() {
    const box = host()?.querySelector('#ix-dict'); if (!box) return
    const data = rows(), n = data.length, sc = saved.dscore || {}
    if (dIdx >= n) {
      const got = data.map((_, i) => ({ i, s: sc[key(i)] })).filter(x => x.s != null)
      const avg = got.length ? Math.round(got.reduce((a, b) => a + b.s, 0) / got.length) : 0
      const worst = [...got].sort((a, b) => a.s - b.s).slice(0, 5)
      box.innerHTML = `<div class="ixd-card done"><b class="ixd-big">${avg}%</b><p>完成 ${got.length} / ${n} 句的听写，平均正确率</p>${worst.length ? `<div class="ixd-worst"><h5>最该重听的句子</h5>${worst.map(x => `<button type="button" data-ixd-jump="${x.i}"><span>${x.i + 1}</span><em>${esc(data[x.i].en)}</em><b>${x.s}%</b></button>`).join('')}</div>` : ''}<div class="ixd-acts"><button type="button" class="secondary-btn" data-ixd-jump="0">从头再来</button><button type="button" class="primary-btn" data-ix-dict-toggle>回到原文</button></div></div>`
      return
    }
    const row = data[dIdx], k = key(dIdx), v = saved.dict?.[k] || ''
    const res = dChecked ? diff(row.en, v) : null
    box.innerHTML = `<div class="ixd-head"><span>第 ${dIdx + 1} / ${n} 句</span><div class="ixd-prog"><i style="width:${Math.round(dIdx / n * 100)}%"></i></div></div>
      <div class="ixd-card"><div class="ixd-play"><button type="button" class="ixd-btn" data-ixd-play aria-label="播放这句"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg></button><button type="button" class="ixd-slow ${(saved.rate || 1) < 1 ? 'on' : ''}" data-ixd-slow>慢放 0.75×</button>${row.sp ? `<span class="ix-sp ${row.sp === 'W' ? 'w' : 'm'}">${row.sp === 'W' ? '主持人' : '嘉宾'}</span>` : ''}</div>
      <textarea class="ixd-in" rows="2" data-ixd-in placeholder="听到什么写什么，回车核对" spellcheck="false" autocapitalize="off" autocomplete="off">${esc(v)}</textarea>
      ${res ? `<div class="ixd-res"><span class="ix-score ${res.score >= 90 ? 'good' : res.score >= 60 ? 'mid' : 'low'}">${res.score}%</span><p class="ix-diff">${res.html}</p>${res.extra.length ? `<p class="ix-extra">多写或听错：${res.extra.map(esc).join('、')}</p>` : ''}</div>` : ''}
      <div class="ixd-acts"><button type="button" class="secondary-btn" data-ixd-prev ${dIdx ? '' : 'disabled'}>上一句</button>${res ? '<button type="button" class="primary-btn" data-ixd-next>下一句 <span>↵</span></button>' : '<button type="button" class="primary-btn" data-ixd-check>核对 <span>↵</span></button>'}</div></div>`
    const ta = box.querySelector('[data-ixd-in]'); if (ta && !res) { ta.focus({ preventScroll: true }); grow(ta) }
  }
  const grow = t => { t.style.height = 'auto'; t.style.height = Math.min(220, t.scrollHeight + 2) + 'px' }
  function dCheck() { const k = key(dIdx), v = saved.dict?.[k] || ''; if (!v.trim()) { host().querySelector('[data-ixd-in]')?.focus(); return } (saved.dscore ||= {})[k] = diff(rows()[dIdx].en, v).score; dChecked = true; save(); renderDict(); host().querySelector('[data-ixd-next]')?.focus() }
  function toggleDict() {
    savePos()
    view = view === 'dict' ? 'read' : 'dict'
    if (view === 'dict') { dIdx = Math.min(rows().length - 1, Number(saved.dpos?.[posKey()]) || 0); if (dIdx < 0) dIdx = 0; dChecked = false }
    render()
  }

  /* ---------- 事件 ---------- */
  host()?.addEventListener('click', e => {
    const w = e.target.closest('[data-ix-w]')
    const lineEl = e.target.closest('[data-ix-line]')
    if (w && lineEl && !lineEl.className.includes('m-')) { e.stopPropagation(); window.TEM8_SHOW_WORD?.(w.dataset.ixW, null, w); return }
    const b = e.target.closest('button')
    if (!b && lineEl) { const i = Number(lineEl.dataset.ixLine); if (show !== 'normal' && !revealed.has(i)) { revealed.add(i); rerenderLine(i) } select(i, true); return }
    if (!b || b.disabled) return
    const d = b.dataset
    if (!b.closest('#ix-sheet') && d.ixAa === undefined) { const sh = host().querySelector('#ix-sheet'); if (sh) sh.hidden = true }
    if (!b.closest('#ix-menu') && d.ixMenu === undefined) { const m = host().querySelector('#ix-menu'); if (m) m.hidden = true }
    if (d.intensiveYear) { savePos(); year = Number(d.intensiveYear); zhOpen = new Set(); if (!hasScript(year, section) && hasScript(year, section === 'A' ? 'B' : 'A')) section = section === 'A' ? 'B' : 'A'; render(); return }
    if (d.intensiveSection) { savePos(); section = d.intensiveSection; zhOpen = new Set(); render(); return }
    if (d.ixZh !== undefined) { const i = Number(d.ixZh); zhOpen.has(i) ? zhOpen.delete(i) : zhOpen.add(i); rerenderLine(i); return }
    if (d.ixAa !== undefined) { const sh = host().querySelector('#ix-sheet'); sh.hidden = !sh.hidden; return }
    if (d.ixShow) { show = d.ixShow; revealed = new Set(); save(); host().querySelectorAll('[data-ix-show]').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', String(x === b)) }); if (view === 'read') { const l = host().querySelector('#intensive-lines'); if (l) { l.innerHTML = rows().map(lineHTML).join(''); paintActive(active) } } return }
    if (d.ixFs) { saved.fs = Number(d.ixFs); save(); host().style.setProperty('--ix-fs', saved.fs); host().querySelectorAll('[data-ix-fs]').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', String(x === b)) }); return }
    if (d.ixDictToggle !== undefined) { toggleDict(); return }
    if (d.ixSeek !== undefined) { const i = Number(d.ixSeek); if (show !== 'normal' && !revealed.has(i)) { revealed.add(i); rerenderLine(i) } select(i, true); return }
    if (d.ixPrev !== undefined) { step(-1); return }
    if (d.ixNext !== undefined) { step(1); return }
    if (d.ixLoop !== undefined) { setLoop(!loopOn); return }
    if (d.ixRate !== undefined) { const r = saved.rate || 1; saved.rate = RATES[(RATES.indexOf(r) + 1) % RATES.length]; applyRate(); save(); paintCtrl(); return }
    if (d.ixMenu !== undefined) { const m = host().querySelector('#ix-menu'); m.hidden = !m.hidden; return }
    if (d.ixAb !== undefined) { const ct = A()?.currentTime || 0; if (ab.a == null) ab = { a: ct, b: null }; else if (ab.b == null) { if (ct > ab.a + 0.5) { ab.b = ct; loopOn = false; A()?.seekTo(ab.a) } } else ab = { a: null, b: null }; paintCtrl(); return }
    if (d.ixSkip) { const a = A(); if (a?.element) a.seekTo(Math.max(start(), (a.currentTime || 0) + Number(d.ixSkip)), !a.element.paused); return }
    if (d.ixdPlay !== undefined) { playLine(dIdx); return }
    if (d.ixdSlow !== undefined) { saved.rate = (saved.rate || 1) < 1 ? 1 : 0.75; applyRate(); save(); paintCtrl(); b.classList.toggle('on', saved.rate < 1); return }
    if (d.ixdCheck !== undefined) { dCheck(); return }
    if (d.ixdNext !== undefined) { dGo(dIdx + 1); return }
    if (d.ixdPrev !== undefined) { dGo(dIdx - 1); return }
    if (d.ixdJump !== undefined) { dGo(Number(d.ixdJump)); return }
    if (d.intensiveCalibrate !== undefined) { setCorrection(A()?.currentTime); return }
    if (d.intensiveSave !== undefined) { const input = host().querySelector('#intensive-time-input'); if (!setCorrection(parseTime(input.value))) { input.focus(); input.classList.add('invalid') } else input.classList.remove('invalid'); return }
    if (d.intensiveReset !== undefined && selected >= 0) { delete saved.corrections?.[key(selected)]; save(); rows().forEach((_, i) => refreshTime(i)) }
  })
  host()?.addEventListener('change', e => { if (e.target.dataset?.ixMore !== undefined && e.target.value) { savePos(); year = Number(e.target.value); render() } })
  host()?.addEventListener('toggle', e => { if (e.target.matches?.('[data-ix-cal]')) host().classList.toggle('ix-cal-on', e.target.open) }, true)
  host()?.addEventListener('input', e => { if (e.target.dataset?.ixdIn !== undefined) { (saved.dict ||= {})[key(dIdx)] = e.target.value; quiet(); grow(e.target) } })
  host()?.addEventListener('keydown', e => {
    if (e.target.dataset?.ixdIn !== undefined && e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); dChecked ? dGo(dIdx + 1) : dCheck() }
  })
  document.addEventListener('keydown', e => {
    if (!document.querySelector('#intensive-view')?.classList.contains('active') || e.metaKey || e.ctrlKey || e.altKey) return
    const tag = (e.target.tagName || '').toLowerCase(); if (['input', 'textarea', 'select'].includes(tag) || document.querySelector('dialog[open]')) return
    if (view === 'dict' && e.key === 'Enter' && dChecked) { e.preventDefault(); dGo(dIdx + 1); return }
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { if (!rows().length) return; e.preventDefault(); step(e.key === 'ArrowRight' ? 1 : -1) }
    else if (e.key === ' ') { if (e.target.closest?.('button')) return; e.preventDefault(); const a = A()?.element; if (a) { if (view === 'dict') playLine(dIdx); else a.paused ? A().play() : A().pause() } }
    else if (e.key.toLowerCase() === 'l' && rows().length) { e.preventDefault(); setLoop(!loopOn) }
  })
  document.addEventListener('click', e => { if (!host()?.contains(e.target)) { const sh = host()?.querySelector('#ix-sheet'), m = host()?.querySelector('#ix-menu'); if (sh) sh.hidden = true; if (m) m.hidden = true } })
  document.addEventListener('tem8:study-changed', () => { if (!document.querySelector('#intensive-view.active') || view !== 'read') return; const before = book.size; loadBook(); if (book.size !== before) host()?.querySelectorAll('[data-ix-w]').forEach(s => s.classList.toggle('nb', inBook(s.dataset.ixW))) })
  document.addEventListener('tem8:view', e => { if (e.detail !== 'intensive') document.body.classList.remove('ix-on') })
  window.TEM8_INTENSIVE = {
    open() { if (opening) return; opening = true; render(); opening = false },
    close() { savePos(); if (raf) cancelAnimationFrame(raf); raf = 0; document.body.classList.remove('ix-on'); A()?.stop() }
  }
})()
