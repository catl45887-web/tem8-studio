/* 听力音频播放条
 * 全局只用一个 Audio 实例，界面节点也只建一次：做题页每次重绘只是把同一个
 * 节点重新挂到新的容器里，所以播放进度不会因为重绘、切题组而丢失。
 * 用法：TEM8_AUDIO.mount(hostEl, {src, mode, replay, title, duration, start, end, autoplay})
 * start/end：整份音频里的时间窗口（秒）。一份录音含 Section A+B 时，
 * A 传 {start:0,end:sectionBStart}，B 传 {start:sectionBStart,end:空}，
 * 进度条只显示窗口内区间，播到 end 自动停。
 */
(() => {
  'use strict'
  const fmt = s => {
    if (!isFinite(s) || s < 0) s = 0
    const m = Math.floor(s / 60), x = Math.floor(s % 60)
    return `${m}:${String(x).padStart(2, '0')}`
  }
  let audio = null, root = null, ui = {}, raf = 0, dragging = false, started = false
  const cfg = { src: '', mode: 'practice', replay: false, title: '', duration: 0, start: 0, end: 0, autoplay: false, onEnded: null, note: '' }

  const winStart = () => (isFinite(cfg.start) && cfg.start > 0 ? cfg.start : 0)
  const fileDur = () => (audio && isFinite(audio.duration) && audio.duration > 0 ? audio.duration : cfg.duration || 0)
  const winEnd = () => {
    if (isFinite(cfg.end) && cfg.end > winStart()) return cfg.end
    const d = fileDur()
    return d > winStart() ? d : 0
  }
  // 音频文件当前位置 → 窗口内相对秒数（进度条显示用）
  const rel = t => Math.min(winEnd(), Math.max(winStart(), t || 0)) - winStart()
  const winLen = () => winEnd() - winStart()

  const locked = () => cfg.mode === 'exam' && cfg.replay === false
  const seekable = () => !locked()
  const lockNote = () => (started ? '考试模式 · 只能顺放，不能暂停或回退' : '考试模式 · 开始后不能暂停或回退')

  // 播到窗口末尾自动停（文件真实 ended 事件只在整个文件播完才触发）
  function hitEnd() {
    const e = winEnd()
    if (!e || !audio || audio.paused || audio.ended) return false
    if (audio.currentTime >= e - 0.05) {
      try { audio.currentTime = e } catch {}
      audio.pause()
      paint()
      if (typeof cfg.onEnded === 'function') { try { cfg.onEnded() } catch {} }
      return true
    }
    return false
  }

  function ensure() {
    if (audio) return
    audio = window.Audio ? new window.Audio() : document.createElement('audio')
    audio.preload = 'metadata'
    audio.addEventListener('loadedmetadata', () => { paint() })
    audio.addEventListener('durationchange', () => { paint() })
    audio.addEventListener('timeupdate', () => { if (!dragging) { hitEnd(); paint() } })
    audio.addEventListener('progress', () => { paintBuffer() })
    audio.addEventListener('play', () => { started = true; paint(); loop() })
    audio.addEventListener('pause', () => { paint(); stopLoop() })
    audio.addEventListener('ended', () => { started = true; paint(); stopLoop(); if (typeof cfg.onEnded === 'function') { try { cfg.onEnded() } catch {} } })
    audio.addEventListener('error', () => { if (ui.note) ui.note.textContent = '音频加载失败，请确认 audio 目录下的文件存在' })
    audio.addEventListener('ratechange', () => { if (ui.rate) ui.rate.value = String(audio.playbackRate) })
  }

  function loop() {
    stopLoop()
    const tick = () => {
      if (!audio || audio.paused || audio.ended) { raf = 0; return }
      hitEnd()
      paint()
      raf = nextFrame(tick)
    }
    raf = nextFrame(tick)
  }
  function stopLoop() { if (raf) cancelFrame(raf); raf = 0 }
  const nextFrame = cb => (window.requestAnimationFrame ? window.requestAnimationFrame(cb) : setTimeout(cb, 16))
  const cancelFrame = id => (window.cancelAnimationFrame ? window.cancelAnimationFrame(id) : clearTimeout(id))

  function build() {
    if (root) return
    ensure()
    root = document.createElement('div')
    root.className = 'wf-audio'
    root.setAttribute('data-audio-root', '')
    root.innerHTML = [
      '<button class="wf-audio-play" type="button" data-audio-toggle aria-label="播放或暂停"><span></span></button>',
      '<div class="wf-audio-body">',
      '<div class="wf-audio-meta"><strong data-audio-title>听力音频</strong><span data-audio-badge></span></div>',
      '<div class="wf-audio-track" data-audio-track role="slider" tabindex="0" aria-label="播放进度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">',
      '<span class="wf-audio-buf" data-audio-buf></span>',
      '<span class="wf-audio-fill" data-audio-fill></span>',
      '<span class="wf-audio-knob" data-audio-knob></span>',
      '</div>',
      '<div class="wf-audio-foot"><span data-audio-time>0:00 / 0:00</span><span data-audio-note></span></div>',
      '</div>',
      '<div class="wf-audio-tools">',
      '<button type="button" class="wf-audio-skip" data-audio-back="15" title="后退 15 秒">↺ 15</button>',
      '<button type="button" class="wf-audio-skip" data-audio-fwd="15" title="前进 15 秒">15 ↻</button>',
      '<select data-audio-rate aria-label="播放速度"><option value="0.75">0.75×</option><option value="1" selected>1×</option><option value="1.25">1.25×</option><option value="1.5">1.5×</option></select>',
      '</div>'
    ].join('')

    ui = {
      play: root.querySelector('[data-audio-toggle]'),
      title: root.querySelector('[data-audio-title]'),
      badge: root.querySelector('[data-audio-badge]'),
      track: root.querySelector('[data-audio-track]'),
      buf: root.querySelector('[data-audio-buf]'),
      fill: root.querySelector('[data-audio-fill]'),
      knob: root.querySelector('[data-audio-knob]'),
      time: root.querySelector('[data-audio-time]'),
      note: root.querySelector('[data-audio-note]'),
      back: root.querySelector('[data-audio-back]'),
      fwd: root.querySelector('[data-audio-fwd]'),
      rate: root.querySelector('[data-audio-rate]')
    }

    const ratioOf = e => {
      const r = ui.track.getBoundingClientRect()
      if (!r.width) return 0
      return Math.min(1, Math.max(0, (e.clientX - r.left) / r.width))
    }
    const nudge = sec => {
      if (!audio.src) return
      const next = Math.min(winEnd() || Infinity, Math.max(winStart(), (audio.currentTime || winStart()) + sec))
      if (locked() && started && next < audio.currentTime) return
      audio.currentTime = next
      paint()
    }

    ui.play.addEventListener('click', e => {
      e.stopPropagation()
      if (audio.paused) { if (locked() && started && audio.currentTime > 0) return; play() }
      else if (!locked()) audio.pause()
    })
    ui.back.addEventListener('click', e => { e.stopPropagation(); nudge(-15) })
    ui.fwd.addEventListener('click', e => { e.stopPropagation(); nudge(15) })
    ui.rate.addEventListener('change', () => { audio.playbackRate = Number(ui.rate.value) || 1; audio.preservesPitch = true })

    ui.track.addEventListener('pointerdown', e => {
      e.stopPropagation()
      if (!seekable() || !audio.src) return
      dragging = true
      ui.track.setPointerCapture?.(e.pointerId)
      paint(ratioOf(e))
    })
    ui.track.addEventListener('pointermove', e => {
      if (!dragging) return
      e.stopPropagation()
      paint(ratioOf(e))
    })
    ui.track.addEventListener('pointerup', e => {
      if (!dragging) return
      dragging = false
      e.stopPropagation()
      const r = ratioOf(e)
      if (seekable()) applySeek(r)
      paint()
    })
    ui.track.addEventListener('pointercancel', () => { dragging = false; paint() })
    ui.track.addEventListener('keydown', e => {
      if (e.key === 'ArrowRight') { e.preventDefault(); nudge(5) }
      if (e.key === 'ArrowLeft') { e.preventDefault(); nudge(-5) }
      if (e.key === ' ') { e.preventDefault(); ui.play.click() }
    })
  }

  function applySeek(ratio) {
    const len = winLen()
    if (!len) return
    const target = winStart() + ratio * len
    if (locked() && started && target < audio.currentTime) return
    audio.currentTime = target
  }

  function paint(dragRatio) {
    if (!root || !audio) return
    const len = winLen()
    const cur = dragRatio != null ? dragRatio * len : rel(audio.currentTime || 0)
    const pct = len ? Math.min(100, Math.max(0, (cur / len) * 100)) : 0
    ui.fill.style.width = pct + '%'
    ui.knob.style.left = pct + '%'
    ui.time.textContent = `${fmt(cur)} / ${fmt(len)}`
    ui.track.setAttribute('aria-valuenow', String(Math.round(pct)))
    const playing = !audio.paused && !audio.ended
    ui.play.classList.toggle('on', playing)
    ui.play.disabled = false
    const lock = locked() && started
    ui.play.disabled = lock && playing
    ui.back.disabled = locked()
    ui.fwd.disabled = locked()
    ui.rate.disabled = locked()
    ui.track.classList.toggle('locked', locked())
    ui.note.textContent = !audio.src ? '未加载音频' : locked() ? lockNote() : (cfg.note || '')
    ui.badge.textContent = cfg.mode === 'exam' ? '考试' : '可回听'
    ui.badge.className = 'wf-audio-badge ' + (cfg.mode === 'exam' ? 'exam' : '')
    paintBuffer()
  }

  function paintBuffer() {
    if (!ui.buf || !audio) return
    const len = winLen()
    if (!len || !audio.buffered || !audio.buffered.length) { ui.buf.style.width = '0%'; return }
    let end = 0
    try { end = audio.buffered.end(audio.buffered.length - 1) } catch { end = 0 }
    ui.buf.style.width = Math.min(100, Math.max(0, ((end - winStart()) / len) * 100)) + '%'
  }

  function play() {
    if (!audio || !audio.src) return
    // 本节已播完再按播放：练习模式从头重播本节（考试锁定状态进不来这里）
    if (winEnd() && !locked() && audio.currentTime >= winEnd() - 0.05) {
      try { audio.currentTime = winStart() } catch {}
    }
    try {
      const p = audio.play()
      if (p && p.catch) p.catch(() => { if (ui.note) ui.note.textContent = '浏览器拦截了自动播放，请再点一次播放' })
    } catch { if (ui.note) ui.note.textContent = '当前环境无法播放音频' }
  }

  let pendingSeek = false
  function mount(host, config) {
    if (!host) return
    build()
    const prev = { src: cfg.src, start: winStart(), end: winEnd() }
    // 每次挂载未提供的字段回到默认，避免上一次的窗口/提示残留
    Object.assign(cfg, { start: 0, end: 0, note: '' }, config || {})
    const srcChanged = config && config.src && prev.src !== config.src
    // 同组重绘会重新挂载：只有换了文件或窗口边界变了、或当前位置越出窗口才回跳，否则保留进度
    const winChanged = !srcChanged && (winStart() !== prev.start || winEnd() !== prev.end)
    const cur = audio.currentTime || 0
    const outside = !!audio.src && (cur < winStart() - 0.5 || (winEnd() && cur > winEnd() + 0.5))
    if (srcChanged) {
      audio.src = config.src
      audio.load()
      started = false
      audio.playbackRate = 1
      if (ui.rate) ui.rate.value = '1'
    }
    pendingSeek = srcChanged || winChanged || outside
    ui.title.textContent = cfg.title || '听力音频'
    host.appendChild(root)
    paint()
    if (pendingSeek) {
      const target = winStart()
      let done = false
      const jump = () => {
        if (done) return
        done = true
        // 已被其他逻辑带到窗口内就不动它，否则拉回窗口起点
        const within = audio.currentTime >= target - 0.5 && (!winEnd() || audio.currentTime <= winEnd() + 0.5)
        if (!within) { try { audio.currentTime = target } catch {} }
        pendingSeek = false
        paint()
      }
      if (audio.readyState >= 1) jump()
      else {
        // metadata 未就绪：规范允许先设 currentTime（作为默认起播位置），loadedmetadata 后兜底校验
        try { audio.currentTime = target } catch {}
        if (audio.readyState >= 1) { done = true; pendingSeek = false }
        else audio.addEventListener('loadedmetadata', jump, { once: true })
      }
      paint()
    } else pendingSeek = false
    if (cfg.autoplay) play()
  }

  function stop() {
    if (!audio) return
    try { audio.pause() } catch {}
    try { audio.currentTime = winStart() } catch {}
    started = false
    paint()
  }

  // 跳到音频文件绝对位置 t（秒）；考试锁定下不允许跳转（原文面板在考试模式不渲染，此为兜底）
  function seekTo(t, autoplay) {
    if (!audio || !audio.src || !isFinite(t)) return
    if (locked()) return
    const last = winEnd() > winStart() ? winEnd() - 0.05 : Number(t)
    const target = Math.max(winStart(), Math.min(last, Number(t)))
    try { audio.currentTime = target } catch {}
    started = true
    paint()
    if (autoplay !== false) play()
  }

  function unload() {
    stop()
    if (audio) { try { audio.removeAttribute('src'); audio.load() } catch {} }
    if (root && root.parentNode) root.parentNode.removeChild(root)
  }

  window.TEM8_AUDIO = { mount, stop, unload, play, pause: () => audio && audio.pause(), seekTo, get element() { return audio }, get mounted() { return !!root }, get config() { return cfg }, get currentTime() { return audio ? audio.currentTime : 0 } }
})()
