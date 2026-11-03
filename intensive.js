/* 精听学习
 * 底部固定播放条：上一句 / 下一句、单句循环、A–B 复读、倍速（记住偏好）
 * 三种看稿方式：原文 / 遮挡（点句揭晓）/ 逐句听写（逐词比对）
 * 记录存 tem8_intensive_v1：year section rate mode pos{} dict{} corrections{}
 */
(() => {
  'use strict'
  const scripts = window.TEM8_TRANSCRIPTS || {}
  const listening = { ...(window.TEM8_LISTENING_ARCHIVE || {}), ...(window.TEM8_LISTENING_2026 || {}), ...(window.TEM8_MID_LISTENING || {}) }
  const allYears = [...new Set([...Object.keys(listening).map(Number), ...Object.keys(scripts).map(Number)])].sort((a, b) => b - a)
  const hasAudio = y => !!listening[y]?.audio
  const hasScript = (y, s) => !!scripts[y]?.[s]?.length
  const KEY = 'tem8_intensive_v1'
  const RATES = [0.75, 1, 1.25]
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
  const fmt = n => { n = Number(n) || 0; return `${Math.floor(n / 60)}:${String(Math.floor(n % 60)).padStart(2, '0')}` }
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {} } catch { return {} } }
  let saved = read()
  const playable = allYears.filter(hasAudio)
  let year = playable.includes(Number(saved.year)) ? Number(saved.year) : (playable.find(y => hasScript(y, 'A')) || playable[0])
  let section = saved.section === 'B' ? 'B' : 'A'
  let mode = ['text', 'hide', 'dict'].includes(saved.mode) ? saved.mode : 'text'
  let selected = -1, active = -1, loopOn = false, loopIdx = -1, ab = { a: null, b: null }, stopAt = null, raf = 0, opening = false, lastPosSave = 0
  let revealed = new Set(), checked = new Set()
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
  const corrected = i => saved.corrections?.[key(i)] != null
  const timeMark = i => { const src = rows()[i]?.tSource; return corrected(i) ? ' ✓' : ['word-anchor', 'anchor'].includes(src) ? ' ◆' : ['asr', 'asr2'].includes(src) ? ' ●' : ['anchor-interpolated', 'interp', 'transcript-interpolated'].includes(src) ? ' ~' : '' }
  function save() { saved.year = year; saved.section = section; saved.mode = mode; try { localStorage.setItem(KEY, JSON.stringify(saved)) } catch {} document.dispatchEvent(new Event('tem8:study-changed')) }
  function indexAt(ct) { const d = rows(); let idx = -1; for (let i = 0; i < d.length; i++) { if (ct >= time(i) - 0.12) idx = i; else break } return idx }

  /* ---------- 逐词比对 ---------- */
  const toks = s => String(s || '').toLowerCase().replace(/[’']/g, "'").match(/[a-z0-9']+/g) || []
  function diff(ref, mine) {
    const r = toks(ref), m = toks(mine), R = r.length, M = m.length
    const L = Array.from({ length: R + 1 }, () => new Uint16Array(M + 1))
    for (let i = R - 1; i >= 0; i--) for (let j = M - 1; j >= 0; j--) L[i][j] = r[i] === m[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1])
    const hitR = new Set(), hitM = new Set(); let i = 0, j = 0
    while (i < R && j < M) { if (r[i] === m[j]) { hitR.add(i); hitM.add(j); i++; j++ } else if (L[i + 1][j] >= L[i][j + 1]) i++; else j++ }
    // 按原句的词顺序标色（保留标点与大小写）
    let n = 0
    const html = esc(ref).replace(/[A-Za-z0-9’']+/g, w => `<span class="${hitR.has(n++) ? 'hit' : 'miss'}">${w}</span>`)
    const extra = m.filter((_, k) => !hitM.has(k))
    return { html, extra, score: R ? Math.round(hitR.size / R * 100) : 0 }
  }

  /* ---------- 渲染 ---------- */
  function lineHTML(row, i) {
    const t = `<time data-intensive-time="${i}">${fmt(time(i))}${timeMark(i)}</time>`
    const sp = row.sp ? `<span class="intensive-speaker">${row.sp === 'W' ? '主持人' : '嘉宾'}</span>` : ''
    const part = section === 'B' && (i === 0 || row.part !== rows()[i - 1].part) ? `<div class="intensive-part-title">Interview · Part ${row.part === 2 ? 'Two' : 'One'}</div>` : ''
    if (mode === 'dict') {
      const k = key(i), v = saved.dict?.[k] || '', done = checked.has(i)
      const res = done ? diff(row.en, v) : null
      return `${part}<div class="ix-dline ${i === active ? 'playing' : ''}" data-ix-row="${i}"><div class="ix-dhead"><span class="intensive-line-no">${String(i + 1).padStart(2, '0')}</span>${sp}<button type="button" class="ix-mini" data-ix-play="${i}">▶ 听这句</button>${t}</div><textarea rows="2" data-ix-dict="${i}" placeholder="听写这一句…" spellcheck="false" autocapitalize="off">${esc(v)}</textarea><div class="ix-dact"><button type="button" class="ix-mini" data-ix-check="${i}">${done ? '重新核对' : '核对'}</button>${done ? `<span class="ix-score ${res.score >= 90 ? 'good' : res.score >= 60 ? 'mid' : 'low'}">${res.score}%</span>` : ''}</div>${done ? `<p class="ix-diff">${res.html}</p>${res.extra.length ? `<p class="ix-extra">多写或听错：${res.extra.map(esc).join('、')}</p>` : ''}` : ''}</div>`
    }
    const hide = mode === 'hide' && !revealed.has(i)
    return `${part}<button type="button" class="intensive-line ${hide ? 'ix-hidden' : ''} ${i === active ? 'playing' : ''} ${i === selected ? 'selected' : ''}" data-intensive-line="${i}" aria-label="${hide ? `第 ${i + 1} 句（已遮挡，点击揭晓并播放）` : `跳到第 ${i + 1} 句`}"><span class="intensive-line-no">${String(i + 1).padStart(2, '0')}</span><span class="intensive-line-copy">${sp}<span class="ix-text">${esc(row.en)}</span></span>${t}</button>`
  }
  function render() {
    if (!host()) return
    const data = rows(), script = data.length > 0
    selected = -1; active = -1; loopOn = false; loopIdx = -1; ab = { a: null, b: null }; stopAt = null; revealed = new Set(); checked = new Set()
    document.body.classList.add('ix-on')
    const yearChips = allYears.map(y => { const ok = hasAudio(y), tx = hasScript(y, 'A') || hasScript(y, 'B')
      return `<button type="button" class="pq-chip sm ${y === year ? 'on' : ''} ${ok && tx ? '' : 'dim'}" data-intensive-year="${y}" ${ok ? '' : 'disabled'} aria-pressed="${y === year}" title="${!ok ? '这一年没有录音' : tx ? '' : '这一年只有录音，没有逐句原文'}">${y}${!ok ? '<small>无音频</small>' : tx ? '' : '<small>无原文</small>'}</button>` }).join('')
    const pos = saved.pos?.[posKey()]
    host().innerHTML = `<div class="ix-top"><div class="ix-years" role="group" aria-label="真题年份">${yearChips}</div>
      <div class="ix-row2"><div class="pq-seg" role="group" aria-label="听力部分">${['A', 'B'].map(s => `<button type="button" data-intensive-section="${s}" class="${section === s ? 'on' : ''}" aria-pressed="${section === s}">${s === 'A' ? 'Section A · 讲座' : 'Section B · 访谈'}</button>`).join('')}</div>
      ${script ? `<div class="pq-seg sm" role="group" aria-label="看稿方式">${[['text', '原文'], ['hide', '遮挡'], ['dict', '逐句听写']].map(([v, l]) => `<button type="button" data-ix-mode="${v}" class="${mode === v ? 'on' : ''}" aria-pressed="${mode === v}">${l}</button>`).join('')}</div>` : ''}</div></div>
      ${script ? `<p class="ix-hint">${mode === 'hide' ? '原文先遮住，听完一句点它揭晓。' : mode === 'dict' ? '每句先听再写，点“核对”逐词比对，没听出的词标红。' : '点句子从那句开始播；播放时当前句高亮。'}${pos ? `　上次听到 ${fmt(pos)}。` : ''}<span class="ix-keys">← → 切句 · 空格 播放 · L 循环</span></p>
      <div class="intensive-transcript ix-list" id="intensive-lines">${data.map(lineHTML).join('')}</div>
      <details class="ix-cal"><summary>句子时间不准？手动校准</summary><p class="intensive-note">${year === 2026 ? '◆ 已核对，~ 估算。' : [2024, 2025].includes(year) ? '◆ 已核对，● 自动对齐，~ 估算。' : '时间为初步定位，可能有偏差。'}选中一句，在它开头的时候点“设为起点”，结果只存在本机。</p><div class="intensive-calibration"><button type="button" data-intensive-calibrate disabled>把当前播放点设为选中句起点</button><label>选中句起点 <input type="text" id="intensive-time-input" inputmode="decimal" placeholder="例：13:24.5" disabled></label><button type="button" data-intensive-save disabled>保存</button><button type="button" data-intensive-reset disabled>恢复初始</button></div></details>`
        : `<div class="rv-empty sm"><strong>这一年还没有逐句原文</strong><p>可以用下方播放条整段精听。</p></div>`}
      <div class="ix-bar" role="region" aria-label="播放控制"><div id="intensive-audio"></div><div class="ix-ctrl">
        <button type="button" data-ix-prev ${script ? '' : 'disabled'} aria-label="上一句" title="上一句（←）">⏮<span>上一句</span></button>
        <button type="button" data-ix-next ${script ? '' : 'disabled'} aria-label="下一句" title="下一句（→）">⏭<span>下一句</span></button>
        <button type="button" data-ix-loop ${script ? '' : 'disabled'} aria-pressed="false" title="单句循环（L）">🔁<span>单句</span></button>
        <button type="button" data-ix-ab aria-pressed="false" title="A–B 复读：先点设 A，再点设 B">A–B<span data-ix-ab-label>复读</span></button>
        <div class="ix-rates" role="group" aria-label="倍速">${RATES.map(r => `<button type="button" data-ix-rate="${r}" class="${(saved.rate || 1) === r ? 'on' : ''}" aria-pressed="${(saved.rate || 1) === r}">${r}×</button>`).join('')}</div>
      </div></div>`
    mountAudio()
    follow(); save()
  }
  function mountAudio() {
    const data = track(), el = host().querySelector('#intensive-audio')
    if (!data.audio) { el.innerHTML = '<p class="ix-hint">这一年没有录音。</p>'; return }
    A()?.mount(el, { src: data.audio, mode: 'practice', replay: true, title: `${year} 年真题 · Section ${section}`, duration: Number(data.audioDuration) || 0, start: start(), end: end(), note: '' })
    applyRate()
    const pos = saved.pos?.[posKey()]
    const audio = A()?.element
    if (pos && audio) { const go = () => { if (A().currentTime < pos - 1 || A().currentTime > pos + 1) A().seekTo(pos, false) }; if (audio.readyState >= 1) go(); else audio.addEventListener('loadedmetadata', () => setTimeout(go, 0), { once: true }) }
  }
  function applyRate() { const a = A()?.element; if (a) { a.playbackRate = saved.rate || 1; a.preservesPitch = true } }
  function paintActive(idx) {
    const list = host()?.querySelector('#intensive-lines'); if (!list) return
    list.querySelector('.playing')?.classList.remove('playing')
    const now = list.querySelector(`[data-intensive-line="${idx}"],[data-ix-row="${idx}"]`)
    now?.classList.add('playing')
    const a = A()?.element
    if (now && a && !a.paused && mode !== 'dict') now.scrollIntoView({ block: 'center', behavior: 'smooth' })
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
        const now = Date.now(); if (now - lastPosSave > 4000) { lastPosSave = now; (saved.pos ||= {})[posKey()] = Math.round(ct * 10) / 10; try { localStorage.setItem(KEY, JSON.stringify(saved)) } catch {} }
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
    host().querySelectorAll('[data-intensive-line]').forEach((el, n) => el.classList.toggle('selected', n === i))
    for (const s of ['[data-intensive-calibrate]', '[data-intensive-save]', '[data-intensive-reset]', '#intensive-time-input']) { const el = host().querySelector(s); if (el) el.disabled = false }
    const input = host().querySelector('#intensive-time-input'); if (input) input.value = fmt(time(i))
    if (seek) { stopAt = null; A()?.seekTo(time(i)) }
  }
  function step(dir) {
    const n = rows().length; if (!n) return
    const ct = A()?.currentTime || 0, cur = indexAt(ct)
    let target
    if (dir < 0) target = cur >= 0 && ct - time(cur) > 1.5 ? cur : cur - 1
    else target = cur + 1
    target = Math.max(0, Math.min(n - 1, target))
    if (mode === 'hide') revealed.delete(target)
    select(target, true)
  }
  function setLoop(on) {
    loopOn = on; loopIdx = on ? (selected >= 0 && Math.abs(time(selected) - (A()?.currentTime || 0)) < 30 ? selected : Math.max(0, active)) : -1
    if (on) ab = { a: null, b: null }
    paintCtrl()
  }
  function paintCtrl() {
    const h = host(); if (!h) return
    const l = h.querySelector('[data-ix-loop]'); if (l) { l.classList.toggle('on', loopOn); l.setAttribute('aria-pressed', String(loopOn)) }
    const b = h.querySelector('[data-ix-ab]'), lab = h.querySelector('[data-ix-ab-label]')
    if (b) { const st = ab.a == null ? 0 : ab.b == null ? 1 : 2; b.classList.toggle('on', st > 0); b.setAttribute('aria-pressed', String(st === 2)); lab.textContent = st === 0 ? '复读' : st === 1 ? `A ${fmt(ab.a)} · 设 B` : `${fmt(ab.a)}–${fmt(ab.b)} ✕` }
    h.querySelectorAll('[data-ix-rate]').forEach(x => { const on = Number(x.dataset.ixRate) === (saved.rate || 1); x.classList.toggle('on', on); x.setAttribute('aria-pressed', String(on)) })
  }
  function parseTime(s) { const m = String(s).trim().match(/^(?:(\d+):)?(\d{1,2})(?:\.(\d))?$/); if (!m) return NaN; return (Number(m[1] || 0) * 60) + Number(m[2]) + Number(m[3] || 0) / 10 }
  function refreshTime(i) { const el = host()?.querySelector(`[data-intensive-time="${i}"]`); if (el) el.textContent = fmt(time(i)) + timeMark(i); const input = host()?.querySelector('#intensive-time-input'); if (input && selected === i) input.value = fmt(time(i)) }
  function setCorrection(t) {
    if (selected < 0 || !Number.isFinite(t) || t < start() || t > end()) return false
    const fixed = Object.keys(saved.corrections || {}).filter(k => k.startsWith(`${year}-${section}-`)).map(k => ({ i: Number(k.split('-').pop()), t: Number(saved.corrections[k]) })).filter(x => x.i !== selected)
    if (fixed.some(x => (x.i < selected && x.t >= t) || (x.i > selected && x.t <= t))) return false
    saved.corrections ||= {}; saved.corrections[key(selected)] = Math.round(t * 10) / 10
    save(); rows().forEach((_, i) => refreshTime(i)); return true
  }
  function rerenderList() { const list = host()?.querySelector('#intensive-lines'); if (list) { list.innerHTML = rows().map(lineHTML).join(''); paintActive(active) } }
  function savePos() { const ct = A()?.currentTime; if (ct && year) { (saved.pos ||= {})[posKey()] = Math.round(ct * 10) / 10; save() } }

  host()?.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || b.disabled) return
    const d = b.dataset
    if (d.intensiveYear) { savePos(); year = Number(d.intensiveYear); if (!hasScript(year, section) && hasScript(year, section === 'A' ? 'B' : 'A')) section = section === 'A' ? 'B' : 'A'; render(); return }
    if (d.intensiveSection) { savePos(); section = d.intensiveSection; render(); return }
    if (d.ixMode) { mode = d.ixMode; save(); render(); return }
    if (d.intensiveLine !== undefined) { const i = Number(d.intensiveLine); if (mode === 'hide' && !revealed.has(i)) { revealed.add(i); b.classList.remove('ix-hidden') } select(i, true); return }
    if (d.ixPlay !== undefined) { const i = Number(d.ixPlay); selected = i; A()?.seekTo(time(i)); stopAt = lineEnd(i); return }
    if (d.ixCheck !== undefined) { const i = Number(d.ixCheck); checked.add(i); const row = b.closest('[data-ix-row]'); if (row) { const tmp = document.createElement('div'); tmp.innerHTML = lineHTML(rows()[i], i); row.replaceWith(...tmp.children) } return }
    if (d.ixPrev !== undefined) { step(-1); return }
    if (d.ixNext !== undefined) { step(1); return }
    if (d.ixLoop !== undefined) { setLoop(!loopOn); return }
    if (d.ixAb !== undefined) { const ct = A()?.currentTime || 0; if (ab.a == null) ab = { a: ct, b: null }; else if (ab.b == null) { if (ct > ab.a + 0.5) { ab.b = ct; loopOn = false; A()?.seekTo(ab.a) } } else ab = { a: null, b: null }; paintCtrl(); return }
    if (d.ixRate) { saved.rate = Number(d.ixRate); applyRate(); save(); paintCtrl(); return }
    if (d.intensiveCalibrate !== undefined) { setCorrection(A()?.currentTime); return }
    if (d.intensiveSave !== undefined) { const input = host().querySelector('#intensive-time-input'); if (!setCorrection(parseTime(input.value))) { input.focus(); input.classList.add('invalid') } else input.classList.remove('invalid'); return }
    if (d.intensiveReset !== undefined && selected >= 0) { delete saved.corrections?.[key(selected)]; save(); rows().forEach((_, i) => refreshTime(i)) }
  })
  host()?.addEventListener('input', e => { const i = e.target.dataset?.ixDict; if (i === undefined) return; (saved.dict ||= {})[key(Number(i))] = e.target.value; try { localStorage.setItem(KEY, JSON.stringify(saved)) } catch {} })
  host()?.addEventListener('keydown', e => { const i = e.target.dataset?.ixDict; if (i !== undefined && e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); host().querySelector(`[data-ix-check="${i}"]`)?.click() } })
  document.addEventListener('keydown', e => {
    if (!document.querySelector('#intensive-view')?.classList.contains('active') || e.metaKey || e.ctrlKey || e.altKey) return
    const tag = (e.target.tagName || '').toLowerCase(); if (['input', 'textarea', 'select'].includes(tag) || document.querySelector('dialog[open]')) return
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { if (!rows().length) return; e.preventDefault(); step(e.key === 'ArrowRight' ? 1 : -1) }
    else if (e.key === ' ') { if (e.target.closest?.('button')) return; e.preventDefault(); const a = A()?.element; if (a) a.paused ? A().play() : A().pause() }
    else if (e.key.toLowerCase() === 'l' && rows().length) { e.preventDefault(); setLoop(!loopOn) }
  })
  document.addEventListener('ratechange', e => { if (document.querySelector('#intensive-view.active') && e.target === A()?.element && RATES.includes(e.target.playbackRate) && e.target.playbackRate !== (saved.rate || 1)) { saved.rate = e.target.playbackRate; save(); paintCtrl() } }, true)
  document.addEventListener('tem8:view', e => { if (e.detail !== 'intensive') document.body.classList.remove('ix-on') })
  window.TEM8_INTENSIVE = {
    open() { if (opening) return; opening = true; render(); opening = false },
    close() { savePos(); if (raf) cancelAnimationFrame(raf); raf = 0; document.body.classList.remove('ix-on'); A()?.stop() }
  }
})()
