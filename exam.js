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
  // 每块画布（Pane）有自己的归属 sid（做题 = 会话 id；精读原文 = read:文章；笔记手写纸 = note:文章）和范围 scope，
  // 撤销 / 清除只作用于同一范围。笔迹存在 localStorage['tem8_ink_v1'][sid][key]。
  const INK_KEY = 'tem8_ink_v1', PREF_KEY = 'tem8_ink_prefs'
  const PEN = { k: null, r: '#E5483B', o: '#EE8A2E', y: '#E2B21F', g: '#3E9F57', b: '#2F6FDB', p: '#8E52D6', gr: '#8A8F93' }
  const HL = { y: [245, 205, 40], g: [120, 205, 120], b: [110, 170, 240], p: [240, 130, 180], o: [250, 160, 80] }
  const WIDTHS = { pen: [1.4, 2.2, 3.4], hl: [12, 16, 22] }
  const readJSON = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) || d } catch { return d } }
  const prefs = Object.assign({ on: false, tool: 'pen', color: 'k', hl: 'y', size: { pen: 1, hl: 1 }, input: 'pen', fold: false }, readJSON(PREF_KEY, {}))
  if (typeof prefs.size !== 'object') prefs.size = { pen: Number(prefs.size) || 1, hl: 1 }
  if (!['pen', 'hl', 'eraser'].includes(prefs.tool)) prefs.tool = 'pen'
  if (!(prefs.color in PEN)) prefs.color = 'k'
  const savePrefs = () => { try { localStorage.setItem(PREF_KEY, JSON.stringify(prefs)) } catch {} }
  let db = readJSON(INK_KEY, {}), saveT = 0
  function save() {
    clearTimeout(saveT)
    saveT = setTimeout(() => { try { localStorage.setItem(INK_KEY, JSON.stringify(db)) } catch {} }, 400)
  }
  const history = [], redo = []
  const panes = new Set()
  const inkColor = () => getComputedStyle(document.documentElement).getPropertyValue('--ink').trim() || '#2a2118'
  const darkBg = () => document.documentElement.dataset.theme !== 'light'

  function drawStroke(ctx, s) {
    const p = s.p; if (!p || p.length < 2) return
    ctx.save()
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'
    if (s.t === 'hl') {
      const c = HL[s.c] || HL.y
      ctx.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},${darkBg() ? .34 : .42})`
      ctx.lineCap = 'butt'; ctx.globalCompositeOperation = darkBg() ? 'source-over' : 'multiply'
    } else ctx.strokeStyle = PEN[s.c] || inkColor()
    ctx.lineWidth = s.w
    ctx.beginPath(); ctx.moveTo(p[0], p[1])
    if (p.length === 2) ctx.lineTo(p[0] + .01, p[1])
    for (let i = 2; i < p.length - 2; i += 2) {
      const mx = (p[i] + p[i + 2]) / 2, my = (p[i + 1] + p[i + 3]) / 2
      ctx.quadraticCurveTo(p[i], p[i + 1], mx, my)
    }
    if (p.length >= 4) ctx.lineTo(p[p.length - 2], p[p.length - 1])
    ctx.stroke(); ctx.restore()
  }
  // 两指滑动时要滚的那个容器
  function scrollerOf(el) {
    for (let n = el; n && n !== document.body; n = n.parentElement) {
      const o = getComputedStyle(n).overflowY
      if ((o === 'auto' || o === 'scroll') && n.scrollHeight > n.clientHeight + 2) return n
    }
    return document.scrollingElement || document.documentElement
  }

  class Pane {
    constructor(el, sid, key, opt = {}) {
      this.el = el; this.sid = String(sid); this.key = key; this.z = 1
      this.scope = opt.scope || 'main'; this.always = !!opt.always; this.zoomable = opt.zoom !== false
      // anchor：让笔迹跟着文字走。{ prepare(pane), pick(pane,x,y) -> {ref,x,y,u}, locate(pane,ref) -> {x,y,u} }
      // 有 anchor 时，一笔写完就换成「相对最近那个词的位置，按字号 u 计」存下来，重新排版后按词的新位置画
      this.anchor = opt.anchor || null
      // noTap：写字时只画画，轻点不当作点击（精读原文、题目栏用；做题页仍要靠轻点选选项）
      this.noTap = !!opt.noTap
      // 结构：pane(滚动) > sizer(按缩放后的尺寸撑开) > inner(内容 + 画布，整体 scale)
      const sizer = document.createElement('div'), inner = document.createElement('div')
      sizer.className = 'ink-sizer'; inner.className = 'ink-inner'
      while (el.firstChild) inner.appendChild(el.firstChild)
      const cv = document.createElement('canvas'); cv.className = 'ink-canvas'; cv.setAttribute('aria-hidden', 'true')
      inner.appendChild(cv); sizer.appendChild(inner); el.appendChild(sizer)
      el.classList.add('ink-pane')
      Object.assign(this, { sizer, inner, cv, ctx: cv.getContext('2d') })
      this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(inner)
      this.bind()
      this.resize()
      panes.add(this)
    }
    get list() { return ((db[this.sid] ||= {})[this.key] ||= []) }
    get active() { return prefs.on || this.always }
    destroy() {
      this.ro.disconnect(); this.ac.abort(); panes.delete(this)
      if (!this.el.isConnected) return
      this.applyZoom(1)
      this.cv.remove()
      while (this.inner.firstChild) this.el.appendChild(this.inner.firstChild)
      this.sizer.remove(); this.el.classList.remove('ink-pane')
    }
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
    // 一笔在当前排版下的实际样子（相对存的笔迹换算回画布坐标）
    view(s) {
      if (!s.a || !this.anchor) return s
      if (this._v && this._v.has(s)) return this._v.get(s)
      const L = this.anchor.locate(this, s.a)
      const v = L ? { t: s.t, c: s.c, w: s.w * L.u, p: s.p.map((n, i) => i % 2 ? L.y + n * L.u : L.x + n * L.u) } : null
      if (this._v) this._v.set(s, v)
      return v
    }
    // 写完一笔：挂到最近的词上
    anchorStroke(s) {
      if (!this.anchor) return
      const p = s.p; let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
      for (let i = 0; i < p.length; i += 2) { x0 = Math.min(x0, p[i]); x1 = Math.max(x1, p[i]); y0 = Math.min(y0, p[i + 1]); y1 = Math.max(y1, p[i + 1]) }
      // 以整笔的中心找最近的词（下划线的中心正好在被划的词下面）
      const A = this.anchor.pick(this, (x0 + x1) / 2, (y0 + y1) / 2)
      if (!A || !A.u) return
      s.p = p.map((n, i) => Math.round((n - (i % 2 ? A.y : A.x)) / A.u * 1000) / 1000)
      s.w = Math.round(s.w / A.u * 1000) / 1000
      s.a = A.ref
    }
    redraw() {
      const { ctx, dpr } = this; if (!ctx || !dpr) return
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, this.cv.width, this.cv.height)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      this._v = new Map()
      if (this.anchor && this.anchor.prepare) this.anchor.prepare(this)
      for (const s of this.list) { const v = this.view(s); if (v) drawStroke(ctx, v) }
    }
    point(e) {
      const r = this.inner.getBoundingClientRect(), z = this.z
      return [Math.round((e.clientX - r.left) / z * 2) / 2, Math.round((e.clientY - r.top) / z * 2) / 2]
    }
    applyZoom(z, ax, ay) {
      const el = this.el, old = this.z
      z = this.zoomable ? Math.max(1, Math.min(3, z)) : 1
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
      const el = this.el, ac = this.ac = new AbortController(), o = { signal: ac.signal }
      const isField = t => t?.closest?.('input,textarea,select,[contenteditable="true"]')
      const finger = () => prefs.input === 'finger' && prefs.tool !== 'none'
      let two = null, cur = null
      const cancelStroke = () => {
        if (!cur) return
        if (cur.s) { const l = this.list, k = l.lastIndexOf(cur.s); if (k >= 0) l.splice(k, 1); this.redraw() }
        cur = null
      }
      // 触摸：笔一律拦下（不滚动、不触发点击）。
      // 「仅笔书写」：手指照常滚动、点击，双指缩放；「笔和单指书写」：单指写字，双指滑动（并可缩放）
      el.addEventListener('touchstart', e => {
        if (!this.active || isField(e.target)) return
        const stylus = [...e.touches].some(t => t.touchType === 'stylus')
        if (stylus) { e.preventDefault(); return }
        if (e.touches.length === 2) {
          cancelStroke()
          const [a, b] = e.touches
          two = { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2, d: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), z: this.z, sc: scrollerOf(el) }
          e.preventDefault(); return
        }
        if (finger() && e.touches.length === 1) e.preventDefault()
      }, { passive: false, ...o })
      el.addEventListener('touchmove', e => {
        if (!this.active || isField(e.target)) return
        if ([...e.touches].some(t => t.touchType === 'stylus')) { e.preventDefault(); return }
        if (two && e.touches.length === 2) {
          e.preventDefault()
          const [a, b] = e.touches, d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
          const x = (a.clientX + b.clientX) / 2, y = (a.clientY + b.clientY) / 2
          if (Math.abs(d / two.d - 1) > .08 && this.zoomable) this.applyZoom(two.z * d / two.d, x, y)
          else if (finger()) { two.sc.scrollBy(two.x - x, two.y - y); two.x = x; two.y = y }
          return
        }
        if (finger() && e.touches.length === 1) e.preventDefault()
      }, { passive: false, ...o })
      el.addEventListener('touchend', e => { if (e.touches.length < 2) two = null }, o)

      el.addEventListener('pointerdown', e => {
        if (!this.active) return
        if (e.pointerType === 'touch' && !(finger() && e.isPrimary)) return
        if (e.pointerType === 'mouse' && e.button !== 0) return
        if (isField(e.target)) return
        e.preventDefault(); e.stopPropagation()
        this._downAt = Date.now()
        try { el.setPointerCapture(e.pointerId) } catch {}
        const [x, y] = this.point(e)
        cur = { id: e.pointerId, t0: Date.now(), x0: e.clientX, y0: e.clientY, cx: e.clientX, cy: e.clientY, erased: [], type: e.pointerType }
        if (prefs.tool === 'eraser') { this.erase(x, y, cur); return }
        const hl = prefs.tool === 'hl'
        cur.s = { t: hl ? 'hl' : 'pen', c: hl ? prefs.hl : prefs.color, w: (hl ? WIDTHS.hl : WIDTHS.pen)[prefs.size[hl ? 'hl' : 'pen']] || 2, p: [x, y] }
        this.list.push(cur.s)
        this.redraw()
      }, { capture: true, ...o })
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
      }, { capture: true, ...o })
      const end = e => {
        if (!cur || e.pointerId !== cur.id) return
        const c = cur; cur = null
        if (c.s) {
          const tap = Date.now() - c.t0 < 260 && Math.hypot(c.cx - c.x0, c.cy - c.y0) < 6
          if (tap) {
            // 轻点 = 点击（选选项、点单词），不留墨点
            this.list.pop(); this.redraw()
            if (c.type !== 'mouse' && !this.noTap) tapAt(c.x0, c.y0)
            return
          }
          this.anchorStroke(c.s)
          history.push({ pane: this, op: 'add', s: c.s }); redo.length = 0
          this.redraw()
        } else if (c.erased.length) { history.push({ pane: this, op: 'erase', list: c.erased }); redo.length = 0 }
        save(); sync()
      }
      el.addEventListener('pointerup', end, { capture: true, ...o })
      // noTap：鼠标 / 笔刚落下画过，浏览器自己补发的 click 也拦掉（不查词、不弹浮条、不点按钮）
      el.addEventListener('click', e => {
        if (this.noTap && this.active && Date.now() - (this._downAt || 0) < 1200) { e.preventDefault(); e.stopPropagation() }
      }, { capture: true, ...o })
      el.addEventListener('pointercancel', e => { if (cur && e.pointerId === cur.id) { cancelStroke(); sync() } }, { capture: true, ...o })
    }
    erase(x, y, c) {
      const r = 10 / this.z, list = this.list
      for (let i = list.length - 1; i >= 0; i--) {
        const v = this.view(list[i]); if (!v) continue
        const p = v.p, rr = r + v.w / 2
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

  /* ---- 清除确认：网站自己的弹窗 ---- */
  function confirmClear(text, ok) {
    const d = document.createElement('div')
    d.className = 'ink-dlg'
    d.innerHTML = `<div class="ink-dlg-box" role="alertdialog" aria-modal="true" aria-label="清除笔迹"><b>清除笔迹</b><p>${text}</p><div class="ink-dlg-btns"><button type="button" data-k="no">取消</button><button type="button" class="danger" data-k="yes">全部清除</button></div></div>`
    document.body.appendChild(d)
    const close = () => d.remove()
    d.addEventListener('click', e => {
      const k = e.target.closest('[data-k]')?.dataset.k
      if (k === 'yes') ok()
      if (k || e.target === d) close()
    })
    d.querySelector('[data-k=no]').focus()
  }

  // 工具条下方的一句小提示
  function inkToast(from, text) {
    const bar = from.closest('.ink-bar2'); if (!bar) return
    let t = bar.querySelector('.ink-toast')
    if (!t) { t = document.createElement('div'); t.className = 'ink-toast'; t.setAttribute('role', 'status'); bar.appendChild(t) }
    t.textContent = text; t.classList.add('show')
    clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 1600)
  }
  const scopeOf = el => el?.closest?.('[data-ink-scope]')?.dataset.inkScope || 'main'
  const inScope = s => [...panes].filter(p => p.scope === s)
  function sync() {
    document.body.classList.toggle('ink-on', prefs.on)
    document.body.classList.toggle('ink-finger', prefs.input === 'finger')
    document.querySelectorAll('.ink-bar2').forEach(bar => {
      bar.dataset.tool = prefs.tool
      bar.classList.toggle('folded', !!prefs.fold)
      const s = bar.dataset.inkScope || 'main', ps = inScope(s)
      bar.querySelectorAll('[data-ink-undo]').forEach(b => { b.disabled = !history.some(h => ps.includes(h.pane)) })
      bar.querySelectorAll('[data-ink-redo]').forEach(b => { b.disabled = !redo.some(h => ps.includes(h.pane)) })
      const z = Math.max(1, ...ps.map(p => p.z))
      bar.querySelectorAll('[data-ink-zoomval]').forEach(b => { b.textContent = Math.round(z * 100) + '%' })
    })
    const pick = (sel, on) => document.querySelectorAll(sel).forEach(b => { const v = on(b); b.classList.toggle('on', v); b.setAttribute('aria-pressed', String(v)) })
    pick('[data-ink-tool]', b => prefs.tool === b.dataset.inkTool)
    pick('[data-ink-color]', b => (b.dataset.for === 'hl' ? prefs.hl : prefs.color) === b.dataset.inkColor)
    pick('[data-ink-size]', b => prefs.size[b.dataset.for || 'pen'] === Number(b.dataset.inkSize))
    pick('[data-ink-toggle]', () => prefs.on)
    pick('[data-ink-input]', b => prefs.input === b.dataset.inkInput)
    // 收起时的小胶囊：当前工具的图标，用当前颜色画（墨色在深色工具条上看不见，改用白色）
    const h = HL[prefs.hl] || HL.y
    const cur = prefs.tool === 'pen' ? (PEN[prefs.color] || '#fff') : prefs.tool === 'hl' ? `rgb(${h[0]},${h[1]},${h[2]})` : '#fff'
    document.querySelectorAll('.ink-bar2').forEach(bar => bar.style.setProperty('--cur', cur))
  }
  function undoOne(from, to, scope) {
    for (let i = from.length - 1; i >= 0; i--) {
      const h = from[i]; if (!panes.has(h.pane) || h.pane.scope !== scope) continue
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
    const b = e.target.closest?.('[data-ink-tool],[data-ink-color],[data-ink-size],[data-ink-toggle],[data-ink-undo],[data-ink-redo],[data-ink-clear],[data-ink-zoom],[data-ink-menu],[data-ink-input],[data-ink-fold]')
    const bar = e.target.closest?.('.ink-bar2')
    // 点工具条以外的地方收起设置菜单
    document.querySelectorAll('.ink-menu:not([hidden])').forEach(m => { if (!m.contains(e.target) && !e.target.closest?.('[data-ink-menu]')) m.hidden = true })
    if (!b) return
    e.preventDefault(); e.stopPropagation()
    const d = b.dataset, scope = scopeOf(b)
    if (d.inkToggle !== undefined) {
      prefs.on = !prefs.on
      if (!prefs.on) panes.forEach(p => { if (!p.always) p.applyZoom(1) })
    }
    if (d.inkTool) { prefs.tool = d.inkTool; prefs.fold = false }
    if (d.inkColor) { if (d.for === 'hl') { prefs.hl = d.inkColor; prefs.tool = 'hl' } else { prefs.color = d.inkColor; prefs.tool = 'pen' } }
    if (d.inkSize) prefs.size[d.for || 'pen'] = Number(d.inkSize)
    if (d.inkInput) prefs.input = d.inkInput
    if (d.inkFold !== undefined) prefs.fold = !prefs.fold
    if (d.inkMenu !== undefined && bar) { const m = bar.querySelector('.ink-menu'); if (m) m.hidden = !m.hidden }
    if (d.inkUndo !== undefined) undoOne(history, redo, scope)
    if (d.inkRedo !== undefined) undoOne(redo, history, scope)
    if (d.inkClear !== undefined) {
      const ps = inScope(scope).filter(p => p.list.length)
      if (!ps.length) inkToast(b, '这一页还没有笔迹')
      else confirmClear(bar?.dataset.clearText || '确定要清除这一页的所有笔迹吗？', () => {
        ps.forEach(p => { history.push({ pane: p, op: 'clear', list: [...p.list] }); p.list.length = 0; p.redraw() })
        save(); sync()
      })
    }
    if (d.inkZoom) {
      const step = d.inkZoom === 'in' ? 1.25 : d.inkZoom === 'out' ? 0.8 : 0
      inScope(scope).forEach(p => p.applyZoom(step ? p.z * step : 1))
    }
    savePrefs(); sync()
  }, true)

  const ICO = {
    pen: '<svg viewBox="0 0 24 24"><path d="M4 20l1.2-4.6L15.6 5a2 2 0 0 1 2.8 0l.6.6a2 2 0 0 1 0 2.8L8.6 18.8z"/><path d="M13.8 6.8l3.4 3.4"/></svg>',
    hl: '<svg viewBox="0 0 24 24"><path d="M9.5 14.5l-3 3 0 2.5h4l2-2"/><path d="M8 13l6.5-8.5 5 5L11 16z"/><path d="M4 20.5h16"/></svg>',
    eraser: '<svg viewBox="0 0 24 24"><path d="M8.5 19.5h11"/><path d="M5.3 15.3l9.4-9.4a2 2 0 0 1 2.8 0l2.6 2.6a2 2 0 0 1 0 2.8l-7.6 7.6H8.7z"/><path d="M10 10.6l5.4 5.4"/></svg>',
    undo: '<svg viewBox="0 0 24 24"><path d="M9 7L5 11l4 4"/><path d="M5 11h9a5 5 0 0 1 0 10h-2"/></svg>',
    redo: '<svg viewBox="0 0 24 24"><path d="M15 7l4 4-4 4"/><path d="M19 11h-9a5 5 0 0 0 0 10h2"/></svg>',
    clear: '<svg viewBox="0 0 24 24"><path d="M4.5 6.5h15"/><path d="M9.5 6.5V4.5h5v2"/><path d="M6.6 6.5l.9 12.4a1.6 1.6 0 0 0 1.6 1.5h5.8a1.6 1.6 0 0 0 1.6-1.5l.9-12.4"/><path d="M10.2 10.5v6M13.8 10.5v6"/></svg>',
    gear: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 2.8l2 2.3 3-.4.6 3 2.6 1.6-1.2 2.7 1.2 2.7-2.6 1.6-.6 3-3-.4-2 2.3-2-2.3-3 .4-.6-3L2.8 14.7 4 12 2.8 9.3l2.6-1.6.6-3 3 .4z"/></svg>',
    fold: '<svg viewBox="0 0 24 24"><path d="M6 15l6-6 6 6"/></svg>'
  }

  window.TEM8_INK = {
    // 做题页：每次重绘后调用，给 [data-ink] 面板挂上画布（替换掉上一组做题画布）
    attach(root, sessionId, groupIndex) {
      ;[...panes].filter(p => p.scope === 'main').forEach(p => p.destroy())
      root.querySelectorAll('[data-ink]').forEach(el => new Pane(el, sessionId || 'x', `${groupIndex}:${el.dataset.ink}`, { scope: 'main' }))
      sync()
    },
    // 其他页面：单独挂一块画布，返回它（之后用 unmount 拆掉）
    mount(el, sid, key, opt) { const p = new Pane(el, sid, key, opt); sync(); return p },
    unmount(p) { if (p) p.destroy(); sync() },
    has(sid) { const r = db[sid]; return !!r && Object.values(r).some(l => l && l.length) },
    drop(sessionId) { if (db[sessionId]) { delete db[sessionId]; save() } },
    // 做题会话只保留进行中的那份；精读原文、笔记手写纸的笔迹不动
    prune(keep) { for (const k of Object.keys(db)) if (k !== String(keep) && !/^(read|note):/.test(k)) delete db[k]; save() },
    sync,
    get on() { return prefs.on },
    // 工具条：上面一排工具，下面一排随工具变化的颜色和粗细；齿轮里是输入方式（和缩放）
    barHTML(opt = {}) {
      const scope = opt.scope || 'main', zoom = opt.zoom !== false
      const tool = (t, label) => `<button type="button" class="ib" data-ink-tool="${t}" aria-label="${label}" title="${label}">${ICO[t]}</button>`
      const pens = Object.keys(PEN).map(c => `<button type="button" class="ib-c" data-ink-color="${c}" data-for="pen" aria-label="笔的颜色"><i class="c-${c}"></i></button>`).join('')
      const hls = Object.keys(HL).map(c => `<button type="button" class="ib-c" data-ink-color="${c}" data-for="hl" aria-label="荧光笔颜色"><i class="h-${c}"></i></button>`).join('')
      const sizes = f => [0, 1, 2].map(n => `<button type="button" class="ib-s" data-ink-size="${n}" data-for="${f}" aria-label="${['细', '中', '粗'][n]}"><i style="--w:${f === 'hl' ? [6, 9, 12][n] : [2.5, 4, 6][n]}px"></i></button>`).join('')
      return `<div class="ink-bar2" data-ink-scope="${scope}" data-clear-text="${opt.clearText || '确定要清除这一页的所有笔迹吗？'}" role="toolbar" aria-label="手写工具">
        <div class="ib-main">
          ${opt.grip ? '<span class="ib-grip" data-ink-grip title="按住拖动" aria-hidden="true"><i></i></span>' : ''}
          <button type="button" class="ib ib-unfold" data-ink-fold aria-label="展开手写工具" title="展开"><span class="uf-ico">${ICO.pen}${ICO.hl}${ICO.eraser}</span><svg class="uf-chev" viewBox="0 0 24 24"><path d="M7 10l5 5 5-5"/></svg></button>
          ${tool('pen', '笔')}${tool('hl', '荧光笔')}${tool('eraser', '橡皮：划过笔迹即擦除')}
          <span class="ib-sep"></span>
          <button type="button" class="ib" data-ink-undo aria-label="撤销" title="撤销">${ICO.undo}</button>
          <button type="button" class="ib" data-ink-redo aria-label="重做" title="重做">${ICO.redo}</button>
          <button type="button" class="ib" data-ink-clear aria-label="清除这一页的全部笔迹" title="清除全部笔迹">${ICO.clear}</button>
          <span class="ib-sep"></span>
          <button type="button" class="ib" data-ink-menu aria-label="手写设置" title="手写设置">${ICO.gear}</button>
          <button type="button" class="ib ib-fold" data-ink-fold aria-label="收起" title="收起">${ICO.fold}</button>
        </div>
        <div class="ib-sub ib-for-pen">${pens}<span class="ib-sep"></span>${sizes('pen')}</div>
        <div class="ib-sub ib-for-hl">${hls}<span class="ib-sep"></span>${sizes('hl')}</div>
        <div class="ink-menu" hidden>
          <button type="button" class="im-row" data-ink-input="pen"><span>仅笔书写，手指滑动</span><i>✓</i></button>
          <button type="button" class="im-row" data-ink-input="finger"><span>笔和单指书写，双指滑动</span><i>✓</i></button>
          ${zoom ? `<div class="im-zoom"><span>缩放</span><button type="button" data-ink-zoom="out" aria-label="缩小">−</button><button type="button" data-ink-zoom="reset" data-ink-zoomval>100%</button><button type="button" data-ink-zoom="in" aria-label="放大">＋</button></div>` : ''}
          ${opt.note ? `<p class="im-note">${opt.note}</p>` : ''}
        </div>
      </div>`
    }
  }
})()
