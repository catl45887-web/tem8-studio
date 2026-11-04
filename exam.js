/* 做题页公用能力
 *  TEM8_PRELOAD  听力音频整份下载到本地（Cache Storage），播放时不再走网络
 *  TEM8_INK      手写批注层：Apple Pencil 写字，手指照常滚动、点选项；手写模式下可双指缩放
 *  另外：锁定页面缩放；做题页高度跟随可见区域（键盘弹出时不乱跳）
 */
(() => {
  'use strict'
  const CACHE = 'tem8-audio-v1'
  const abs = s => new URL(s, location.href).href
  const mime = s => /\.m4a(\?|$)/i.test(s) ? 'audio/mp4' : /\.mp3(\?|$)/i.test(s) ? 'audio/mpeg' : ''

  /* ---------------- 禁止缩放页面 ---------------- */
  // iOS Safari 会忽略 user-scalable=no，要拦手势事件；手写层的缩放自己实现，不受影响
  ;['gesturestart', 'gesturechange', 'gestureend'].forEach(t => document.addEventListener(t, e => e.preventDefault(), { passive: false }))
  document.addEventListener('touchmove', e => { if (e.scale !== undefined && e.scale !== 1) e.preventDefault() }, { passive: false })
  // 双击放大用 CSS touch-action: manipulation 关掉（exam.css），不拦 touchend，免得快速连点失灵

  /* ---------------- 可见区域高度（键盘弹出时跟着变） ---------------- */
  const vv = window.visualViewport
  function syncVH() {
    const h = vv ? vv.height : innerHeight
    document.documentElement.style.setProperty('--px-h', h + 'px')
    document.documentElement.style.setProperty('--px-top', (vv ? vv.offsetTop : 0) + 'px')
    document.body?.classList.toggle('vv-short', h < (window.innerHeight || h) * 0.78)
  }
  syncVH()
  ;(vv || window).addEventListener('resize', syncVH)
  vv?.addEventListener('scroll', syncVH)

  /* ---------------- 音频预加载 ---------------- */
  const urls = new Map()
  async function openCache() { try { return 'caches' in window ? await caches.open(CACHE) : null } catch { return null } }
  // 已缓存且文件没换过就直接用；联网时用 HEAD 比对 Last-Modified/ETag，换了新音频会自动重新下载
  async function fromCache(src) {
    const c = await openCache(); if (!c) return null
    const r = await c.match(abs(src)); if (!r) return null
    const tag = r.headers.get('x-src-tag') || ''
    if (navigator.onLine !== false && tag) {
      try {
        const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 3000)
        const h = await fetch(src, { method: 'HEAD', cache: 'no-store', signal: ctl.signal })
        clearTimeout(t)
        const now = h.headers.get('etag') || h.headers.get('last-modified') || ''
        if (h.ok && now && now !== tag) { await c.delete(abs(src)); return null }
      } catch {}
    }
    const b = await r.blob()
    return b.size > 1000 ? b : null
  }
  async function load(src, onProgress) {
    if (urls.has(src)) return urls.get(src)
    let blob = await fromCache(src).catch(() => null)
    if (!blob) {
      const res = await fetch(src, { cache: 'no-cache' })
      if (!res.ok) throw new Error('HTTP ' + res.status)
      const total = Number(res.headers.get('content-length')) || 0
      const tag = res.headers.get('etag') || res.headers.get('last-modified') || ''
      if (res.body && res.body.getReader) {
        const rd = res.body.getReader(), parts = []
        let got = 0
        for (;;) {
          const { done, value } = await rd.read()
          if (done) break
          parts.push(value); got += value.length
          onProgress?.(got, total)
        }
        blob = new Blob(parts, { type: mime(src) || res.headers.get('content-type') || '' })
      } else blob = await res.blob()
      const c = await openCache()
      if (c) {
        try {
          await c.put(abs(src), new Response(blob, { headers: { 'content-type': blob.type, 'x-src-tag': tag } }))
          // 只留最近 4 份，省空间
          const keys = await c.keys()
          for (const k of keys.slice(0, Math.max(0, keys.length - 4))) await c.delete(k)
        } catch {}
      }
    }
    if (mime(src) && blob.type !== mime(src)) blob = new Blob([blob], { type: mime(src) })
    const u = URL.createObjectURL(blob)
    urls.set(src, u)
    return u
  }
  window.TEM8_PRELOAD = { load, url: src => urls.get(src) || '', has: src => urls.has(src) }

  /* ---------------- 手写批注层 ---------------- */
  const INK_KEY = 'tem8_ink_v1', PREF_KEY = 'tem8_ink_prefs'
  const COLORS = { k: null, b: '#2c5aa8', r: '#c23a2b', y: 'rgba(240,200,40,.42)' }
  const WIDTHS = { pen: [1.4, 2.2, 3.4], hl: [12, 16, 22] }
  const readJSON = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) || d } catch { return d } }
  const prefs = Object.assign({ on: false, tool: 'pen', color: 'k', size: 1 }, readJSON(PREF_KEY, {}))
  const savePrefs = () => { try { localStorage.setItem(PREF_KEY, JSON.stringify(prefs)) } catch {} }
  let db = readJSON(INK_KEY, {}), sid = '', saveT = 0
  const strokes = key => ((db[sid] ||= {})[key] ||= [])
  function save() {
    clearTimeout(saveT)
    saveT = setTimeout(() => { try { localStorage.setItem(INK_KEY, JSON.stringify(db)) } catch {} }, 400)
  }
  const history = [], redo = []
  const panes = new Set()
  const inkColor = () => getComputedStyle(document.documentElement).getPropertyValue('--ink').trim() || '#2a2118'

  function drawStroke(ctx, s) {
    const p = s.p; if (!p || p.length < 2) return
    ctx.save()
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'
    ctx.strokeStyle = s.c === 'k' ? inkColor() : COLORS[s.c] || inkColor()
    ctx.lineWidth = s.w
    if (s.t === 'hl') { ctx.lineCap = 'butt'; ctx.globalCompositeOperation = 'multiply' }
    ctx.beginPath(); ctx.moveTo(p[0], p[1])
    if (p.length === 2) ctx.lineTo(p[0] + .01, p[1])
    for (let i = 2; i < p.length - 2; i += 2) {
      const mx = (p[i] + p[i + 2]) / 2, my = (p[i + 1] + p[i + 3]) / 2
      ctx.quadraticCurveTo(p[i], p[i + 1], mx, my)
    }
    if (p.length >= 4) ctx.lineTo(p[p.length - 2], p[p.length - 1])
    ctx.stroke(); ctx.restore()
  }

  class Pane {
    constructor(el, key) {
      this.el = el; this.key = key; this.z = 1
      // 结构：pane(滚动) > sizer(按缩放后的尺寸撑开) > inner(内容 + 画布，整体 scale)
      const sizer = document.createElement('div'), inner = document.createElement('div')
      sizer.className = 'ink-sizer'; inner.className = 'ink-inner'
      while (el.firstChild) inner.appendChild(el.firstChild)
      const cv = document.createElement('canvas'); cv.className = 'ink-canvas'; cv.setAttribute('aria-hidden', 'true')
      inner.appendChild(cv); sizer.appendChild(inner); el.appendChild(sizer)
      Object.assign(this, { sizer, inner, cv, ctx: cv.getContext('2d') })
      this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(inner)
      this.bind()
      this.resize()
    }
    get list() { return strokes(this.key) }
    resize() {
      const w = this.inner.offsetWidth, h = this.inner.offsetHeight
      if (!w || !h) return
      // iOS 画布像素上限约 1600 万，长文章时降低清晰度保证能画
      const dpr = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(15e6 / (w * h)))
      if (this.cw === w && this.ch === h && this.dpr === dpr) return
      Object.assign(this, { cw: w, ch: h, dpr })
      this.cv.width = Math.round(w * dpr); this.cv.height = Math.round(h * dpr)
      this.cv.style.width = w + 'px'; this.cv.style.height = h + 'px'
      this.applyZoom(this.z)
      this.redraw()
    }
    redraw() {
      const { ctx, dpr } = this; if (!ctx) return
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, this.cv.width, this.cv.height)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      for (const s of this.list) drawStroke(ctx, s)
    }
    point(e) {
      const r = this.inner.getBoundingClientRect(), z = this.z
      return [Math.round((e.clientX - r.left) / z * 2) / 2, Math.round((e.clientY - r.top) / z * 2) / 2]
    }
    applyZoom(z, ax, ay) {
      const el = this.el, old = this.z
      z = Math.max(1, Math.min(3, z))
      // 以手指中点为锚：缩放前后这个点在屏幕上不动
      const r = el.getBoundingClientRect()
      const cx = ax === undefined ? 0 : ax - r.left, cy = ay === undefined ? el.clientHeight / 2 : ay - r.top
      const contentX = (el.scrollLeft + cx) / old, contentY = (el.scrollTop + cy) / old
      this.z = z
      if (z === 1) {
        this.inner.style.transform = ''; this.inner.style.width = ''
        this.sizer.style.width = ''; this.sizer.style.height = ''
        el.classList.remove('ink-zoomed')
      } else {
        if (!this.inner.style.width) this.inner.style.width = this.inner.offsetWidth + 'px'
        this.inner.style.transform = `scale(${z})`
        this.sizer.style.width = this.inner.offsetWidth * z + 'px'; this.sizer.style.height = this.inner.offsetHeight * z + 'px'
        el.classList.add('ink-zoomed')
      }
      if (old !== z) { el.scrollLeft = contentX * z - cx; el.scrollTop = contentY * z - cy }
      document.dispatchEvent(new CustomEvent('tem8:ink-zoom', { detail: { z } }))
    }
    bind() {
      const el = this.el
      const isField = t => t?.closest?.('input,textarea,select,[contenteditable="true"]')
      let pinch = null
      // 触摸：笔的触摸一律拦下（不滚动、不触发点击）；双指在手写模式下缩放
      el.addEventListener('touchstart', e => {
        if (!prefs.on) return
        const stylus = [...e.touches].some(t => t.touchType === 'stylus')
        if (stylus && !isField(e.target) && prefs.tool !== 'none') { e.preventDefault(); return }
        if (e.touches.length === 2 && !stylus) {
          const [a, b] = e.touches
          pinch = { d: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), z: this.z }
          e.preventDefault()
        }
      }, { passive: false })
      el.addEventListener('touchmove', e => {
        if (!prefs.on) return
        if ([...e.touches].some(t => t.touchType === 'stylus') && prefs.tool !== 'none' && !isField(e.target)) { e.preventDefault(); return }
        if (pinch && e.touches.length === 2) {
          e.preventDefault()
          const [a, b] = e.touches, d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
          this.applyZoom(pinch.z * d / pinch.d, (a.clientX + b.clientX) / 2, (a.clientY + b.clientY) / 2)
        }
      }, { passive: false })
      el.addEventListener('touchend', e => { if (e.touches.length < 2) pinch = null })

      let cur = null
      el.addEventListener('pointerdown', e => {
        if (!prefs.on || prefs.tool === 'none') return
        if (e.pointerType === 'touch' || (e.pointerType === 'mouse' && e.button !== 0)) return
        if (isField(e.target)) return
        e.preventDefault(); e.stopPropagation()
        try { el.setPointerCapture(e.pointerId) } catch {}
        const [x, y] = this.point(e)
        cur = { id: e.pointerId, t0: Date.now(), x0: e.clientX, y0: e.clientY, cx: e.clientX, cy: e.clientY, erased: [] }
        if (prefs.tool === 'eraser') { this.erase(x, y, cur); return }
        const hl = prefs.tool === 'hl'
        cur.s = { t: hl ? 'hl' : 'pen', c: hl ? 'y' : prefs.color, w: (hl ? WIDTHS.hl : WIDTHS.pen)[prefs.size] || 2, p: [x, y] }
        this.list.push(cur.s)
        this.redraw()
      }, true)
      el.addEventListener('pointermove', e => {
        if (!cur || e.pointerId !== cur.id) return
        e.preventDefault()
        cur.cx = e.clientX; cur.cy = e.clientY
        const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e]
        for (const ev of evs.length ? evs : [e]) {
          const [x, y] = this.point(ev)
          if (prefs.tool === 'eraser') { this.erase(x, y, cur); continue }
          const p = cur.s.p, lx = p[p.length - 2], ly = p[p.length - 1]
          if (Math.hypot(x - lx, y - ly) < 1.2) continue
          p.push(x, y)
          // 只画新的一小段，长笔画也不卡
          const ctx = this.ctx
          ctx.save(); ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
          drawStroke(ctx, { ...cur.s, p: p.slice(-6) }); ctx.restore()
        }
      }, true)
      const end = e => {
        if (!cur || e.pointerId !== cur.id) return
        const c = cur; cur = null
        if (c.s) {
          const tap = Date.now() - c.t0 < 260 && Math.hypot(c.cx - c.x0, c.cy - c.y0) < 6
          if (tap) {
            // 笔尖轻点 = 点击（选选项、点按钮），不留墨点
            this.list.pop(); this.redraw()
            if (e.pointerType === 'pen') tapAt(c.x0, c.y0)
            return
          }
          history.push({ pane: this, op: 'add', s: c.s }); redo.length = 0
          this.redraw()
        } else if (c.erased.length) { history.push({ pane: this, op: 'erase', list: c.erased }); redo.length = 0 }
        save(); sync()
      }
      el.addEventListener('pointerup', end, true)
      el.addEventListener('pointercancel', end, true)
    }
    erase(x, y, c) {
      const r = 10 / this.z, list = this.list
      for (let i = list.length - 1; i >= 0; i--) {
        const p = list[i].p, rr = r + list[i].w / 2
        for (let j = 0; j < p.length; j += 2) {
          if (Math.abs(p[j] - x) < rr && Math.abs(p[j + 1] - y) < rr) { c.erased.push({ s: list[i], i }); list.splice(i, 1); this.redraw(); break }
        }
      }
    }
  }
  function tapAt(x, y) {
    // 画布本身不接收事件（pointer-events:none），直接取下面的元素
    const el = document.elementFromPoint(x, y)
    if (!el) return
    const f = el.closest('input,textarea'); if (f) { f.focus(); return }
    el.click()
  }

  let bar = null
  function sync() {
    document.body.classList.toggle('ink-on', prefs.on)
    document.querySelectorAll('[data-ink-tool]').forEach(b => {
      const t = b.dataset.inkTool, on = t === 'pen' ? prefs.tool === 'pen' && prefs.color === b.dataset.c : prefs.tool === t
      b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on))
    })
    document.querySelectorAll('[data-ink-size]').forEach(b => { const on = Number(b.dataset.inkSize) === prefs.size; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)) })
    document.querySelectorAll('[data-ink-toggle]').forEach(b => { b.classList.toggle('on', prefs.on); b.setAttribute('aria-pressed', String(prefs.on)) })
    document.querySelectorAll('[data-ink-undo]').forEach(b => { b.disabled = !history.some(h => panes.has(h.pane)) })
    document.querySelectorAll('[data-ink-redo]').forEach(b => { b.disabled = !redo.some(h => panes.has(h.pane)) })
    const z = Math.max(1, ...[...panes].map(p => p.z))
    document.querySelectorAll('[data-ink-zoomval]').forEach(b => { b.textContent = Math.round(z * 100) + '%' })
  }
  function undoOne(from, to) {
    for (let i = from.length - 1; i >= 0; i--) {
      const h = from[i]; if (!panes.has(h.pane)) continue
      from.splice(i, 1)
      const l = h.pane.list
      const forward = to === redo
      if (h.op === 'add') { if (forward) { const k = l.lastIndexOf(h.s); if (k >= 0) l.splice(k, 1) } else l.push(h.s) }
      else if (h.op === 'erase') { if (forward) [...h.list].reverse().forEach(x => l.splice(Math.min(x.i, l.length), 0, x.s)); else h.list.forEach(x => { const k = l.indexOf(x.s); if (k >= 0) l.splice(k, 1) }) }
      else if (h.op === 'clear') { if (forward) l.push(...h.list); else l.length = 0 }
      to.push(h); h.pane.redraw(); save(); break
    }
    sync()
  }
  document.addEventListener('click', e => {
    const b = e.target.closest?.('[data-ink-tool],[data-ink-size],[data-ink-toggle],[data-ink-undo],[data-ink-redo],[data-ink-clear],[data-ink-zoom]')
    if (!b) return
    e.preventDefault(); e.stopPropagation()
    const d = b.dataset
    if (d.inkToggle !== undefined) {
      prefs.on = !prefs.on
      if (!prefs.on) panes.forEach(p => p.applyZoom(1))
    }
    if (d.inkTool) { prefs.tool = d.inkTool; if (d.c) prefs.color = d.c }
    if (d.inkSize) prefs.size = Number(d.inkSize)
    if (d.inkUndo !== undefined) undoOne(history, redo)
    if (d.inkRedo !== undefined) undoOne(redo, history)
    if (d.inkClear !== undefined) {
      const has = [...panes].some(p => p.list.length)
      if (has && confirm('清空这一组的手写笔迹？')) panes.forEach(p => { if (p.list.length) { history.push({ pane: p, op: 'clear', list: [...p.list] }); p.list.length = 0; p.redraw() } })
      save()
    }
    if (d.inkZoom) {
      const step = d.inkZoom === 'in' ? 1.25 : d.inkZoom === 'out' ? 0.8 : 0
      panes.forEach(p => p.applyZoom(step ? p.z * step : 1))
    }
    savePrefs(); sync()
  }, true)

  window.TEM8_INK = {
    // 每次重绘做题页后调用：给 [data-ink] 面板挂上画布
    attach(root, sessionId, groupIndex) {
      sid = String(sessionId || 'x')
      panes.forEach(p => p.ro.disconnect()); panes.clear()
      root.querySelectorAll('[data-ink]').forEach(el => panes.add(new Pane(el, `${groupIndex}:${el.dataset.ink}`)))
      sync()
    },
    drop(sessionId) { if (db[sessionId]) { delete db[sessionId]; save() } },
    // 只保留还在进行中的那份
    prune(keep) { for (const k of Object.keys(db)) if (k !== String(keep)) delete db[k]; save() },
    sync,
    get on() { return prefs.on },
    barHTML() {
      const pen = (c, label) => `<button type="button" class="ink-b ink-pen" data-ink-tool="pen" data-c="${c}" title="${label}" aria-label="${label}"><i class="ink-dot c-${c}"></i></button>`
      return `<div class="ink-bar" role="toolbar" aria-label="手写工具">
        <button type="button" class="ink-b" data-ink-tool="none" title="不写字，只点选和滚动">点选</button>
        <span class="ink-sep"></span>${pen('k', '黑笔')}${pen('b', '蓝笔')}${pen('r', '红笔')}
        <button type="button" class="ink-b ink-hl" data-ink-tool="hl" title="荧光笔" aria-label="荧光笔"><i></i></button>
        <button type="button" class="ink-b" data-ink-tool="eraser" title="橡皮：划过笔迹即擦除">橡皮</button>
        <span class="ink-sep"></span>
        <button type="button" class="ink-b ink-size" data-ink-size="0" aria-label="细"><i style="--s:3px"></i></button>
        <button type="button" class="ink-b ink-size" data-ink-size="1" aria-label="中"><i style="--s:5px"></i></button>
        <button type="button" class="ink-b ink-size" data-ink-size="2" aria-label="粗"><i style="--s:8px"></i></button>
        <span class="ink-sep"></span>
        <button type="button" class="ink-b" data-ink-undo title="撤销" aria-label="撤销">↶</button>
        <button type="button" class="ink-b" data-ink-redo title="重做" aria-label="重做">↷</button>
        <span class="ink-sep"></span>
        <button type="button" class="ink-b" data-ink-zoom="out" aria-label="缩小">−</button>
        <button type="button" class="ink-b ink-zv" data-ink-zoom="reset" data-ink-zoomval title="恢复原大小">100%</button>
        <button type="button" class="ink-b" data-ink-zoom="in" aria-label="放大">＋</button>
        <span class="ink-grow"></span>
        <button type="button" class="ink-b" data-ink-clear>清空本组</button>
      </div>`
    }
  }
})()
