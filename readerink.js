/* 精读页手写：
 *  1. 原文上直接写（右侧工具栏的笔按钮开关）。每一笔挂在离它最近的单词（或那段译文）上，
 *     位置按字号的倍数记：改字号、换行、切换左右/上下对照，笔迹都跟着词走
 *  2. 笔记抽屉的「手写」页：一张横线纸，每篇文章一张，打开就能写，不用先开手写开关
 * 画布、工具条都来自 exam.js 的 TEM8_INK */
;(function () {
  'use strict'
  var pane = null, sheet = null, bar = null
  function I() { return window.TEM8_INK }
  function $(id) { return document.getElementById(id) }
  function readerOn() { var v = $('reader-view'); return !!v && v.classList.contains('active') }

  /* ---------- 原文 ---------- */
  function ensureBar() {
    var v = $('reader-view'); if (!v || bar || !I()) return
    bar = document.createElement('div')
    bar.className = 'rp-inkbar'
    bar.innerHTML = I().barHTML({
      scope: 'reader', zoom: false, grip: true, clearText: '确定要清除这篇文章上的所有笔迹吗？',
      note: '笔迹挂在旁边的单词上，改字号、换排版都会跟着走。'
    })
    document.body.appendChild(bar)   // 不放进带动画的阅读页里，否则「固定在屏幕上」会失效
    I().sync()
    bindDrag()
    placeBar()
  }

  /* ---------- 拖动工具条：按住把手拖；收起成小胶囊时按住胶囊拖，轻点仍是展开。位置记在本机 ---------- */
  var POS = 'tem8_inkbar_pos'
  function readPos() { try { return JSON.parse(localStorage.getItem(POS) || 'null') } catch (e) { return null } }
  function placeBar(pos) {
    if (!bar) return
    pos = pos || readPos()
    if (!pos) { bar.style.left = bar.style.top = bar.style.right = bar.style.transform = ''; return }
    var w = bar.offsetWidth || 300, h = bar.offsetHeight || 50
    var x = Math.max(6, Math.min(window.innerWidth - w - 6, pos.x * window.innerWidth))
    var y = Math.max(6, Math.min(window.innerHeight - h - 6, pos.y * window.innerHeight))
    bar.style.left = x + 'px'; bar.style.top = y + 'px'; bar.style.right = 'auto'; bar.style.transform = 'none'
  }
  function bindDrag() {
    var d = null
    bar.addEventListener('pointerdown', function (e) {
      var inner = bar.querySelector('.ink-bar2')
      var grip = e.target.closest('[data-ink-grip]'), pill = inner && inner.classList.contains('folded') && e.target.closest('.ib-unfold')
      if (!grip && !pill) return
      var r = bar.getBoundingClientRect()
      d = { id: e.pointerId, x0: e.clientX, y0: e.clientY, l: r.left, t: r.top, moved: false }
      if (grip) e.preventDefault()
    })
    // 真正开始移动才接管指针：只是轻点时，点击照常落到按钮上
    window.addEventListener('pointermove', function (e) {
      if (!d || e.pointerId !== d.id) return
      var dx = e.clientX - d.x0, dy = e.clientY - d.y0
      if (!d.moved && Math.hypot(dx, dy) < 6) return
      if (!d.moved) { try { bar.setPointerCapture(e.pointerId) } catch (err) {} }
      d.moved = true; e.preventDefault()
      bar.querySelector('.ink-bar2').classList.add('dragging')
      placeBar({ x: (d.l + dx) / window.innerWidth, y: (d.t + dy) / window.innerHeight })
    })
    function end(e) {
      if (!d || e.pointerId !== d.id) return
      var moved = d.moved; d = null
      bar.querySelector('.ink-bar2').classList.remove('dragging')
      if (!moved) return
      var r = bar.getBoundingClientRect()
      try { localStorage.setItem(POS, JSON.stringify({ x: r.left / window.innerWidth, y: r.top / window.innerHeight })) } catch (err) {}
      // 拖完松手不算点击（不然收起的小胶囊一拖就展开）
      function stop(ev) { ev.stopPropagation(); ev.preventDefault(); window.removeEventListener('click', stop, true) }
      window.addEventListener('click', stop, true)
      setTimeout(function () { window.removeEventListener('click', stop, true) }, 300)
    }
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
    // 双击把手：回到默认位置
    bar.addEventListener('dblclick', function (e) { if (e.target.closest('[data-ink-grip]')) { try { localStorage.removeItem(POS) } catch (err) {} placeBar() } })
    window.addEventListener('resize', function () { placeBar() })
    // 展开 / 收起后宽度变了：重新卡回屏幕内
    var inner = bar.querySelector('.ink-bar2')
    if (inner) new MutationObserver(function () { if (!d) requestAnimationFrame(function () { if (!d) placeBar() }) }).observe(inner, { attributes: true, attributeFilter: ['class'] })
  }
  function mountArticle() {
    var ink = I(); if (!ink) return
    if (pane) { ink.unmount(pane); pane = null }
    var el = document.querySelector('#reader-content .rd-ink')
    if (!el || !readerOn()) return hint()
    var a = el.querySelector('[data-anno-article]'), id = a ? a.dataset.annoArticle : ''
    if (!id) return hint()
    ensureBar()
    pane = ink.mount(el, 'read:' + id, 'a', { scope: 'reader', zoom: false, anchor: ANCHOR, noTap: true })
    pane._id = id
    widen()
  }
  /* ---------- 画布铺满整个阅读区：画布层左右伸到阅读区边上（正文位置不动） ----------
   * 阅读区 = 阅读页去掉右侧给题目栏 / 笔记让出的位置。笔迹仍挂在最近的词上，所以边上写的字也跟着那一行走 */
  function widen() {
    if (!pane || !pane.inner || !pane.inner.isConnected) return false
    var v = $('reader-view'), inner = pane.inner
    if (!v) return false
    var rv = v.getBoundingClientRect(), cs = getComputedStyle(v)
    var r = pane.el.getBoundingClientRect()
    var left = rv.left, right = rv.right - (parseFloat(cs.paddingRight) || 0)
    var L = Math.max(0, Math.round(r.left - left)), R = Math.max(0, Math.round(right - r.right))
    if (pane._lr === L + ',' + R) return false
    pane._lr = L + ',' + R
    inner.style.marginLeft = -L + 'px'; inner.style.paddingLeft = L + 'px'
    inner.style.marginRight = -R + 'px'; inner.style.paddingRight = R + 'px'
    return true
  }
  var widenT = 0
  function widenSoon() { clearTimeout(widenT); widenT = setTimeout(function () { if (widen() && pane) pane.redraw() }, 60) }
  window.addEventListener('resize', widenSoon)
  // 题目栏 / 笔记抽屉开关会改阅读页的留白
  new MutationObserver(widenSoon).observe(document.body, { attributes: true, attributeFilter: ['class'] })
  function hint() {}

  /* ---------- 笔迹挂到词上 ----------
   * ref：'w:段:第几个词'（英文单词）或 'z:段'（这一段的译文块）
   * u：那个词的字号（px），位置都按 u 的倍数记 */
  var cache = null
  // 用字形本身的框（不是按钮的整行高度），否则贴在词下面的横线会被算到下一行
  var rng = document.createRange()
  function rel(pane, el) {
    rng.selectNodeContents(el)
    var r = rng.getBoundingClientRect(), b = pane.inner.getBoundingClientRect()
    if (!r.width) r = el.getBoundingClientRect()
    return { x: r.left - b.left, y: r.top - b.top, w: r.width, h: r.height }
  }
  function build(pane) {
    var map = Object.create(null), list = []
    pane.inner.querySelectorAll('[data-anno-p]').forEach(function (p) {
      var i = p.dataset.annoP
      p.querySelectorAll('[data-word]').forEach(function (w, k) { map['w:' + i + ':' + k] = w; list.push(['w:' + i + ':' + k, w]) })
      var z = p.querySelector('.rd-zh-all .rd-zh-text,.rd-zh.open .rd-zh-text'); if (z) { map['z:' + i] = z; list.push(['z:' + i, z]) }
    })
    return { map: map, list: list, u: Object.create(null) }
  }
  function size(c, el) {
    var k = el.tagName + el.className
    return c.u[k] || (c.u[k] = parseFloat(getComputedStyle(el).fontSize) || 16)
  }
  var ANCHOR = {
    prepare: function () { cache = null },
    pick: function (pane, x, y) {
      var c = build(pane), best = null, bd = Infinity
      c.list.forEach(function (it) {
        var r = rel(pane, it[1])
        var dx = x < r.x ? r.x - x : x > r.x + r.w ? x - r.x - r.w : 0
        var dy = y < r.y ? r.y - y : y > r.y + r.h ? y - r.y - r.h : 0
        var cx = x - r.x - r.w / 2
        if (y > r.y + r.h) dy *= .35    // 写在词下面（下划线）比写在上一行词的头顶更常见
        var d = dx * dx + dy * dy * 4 + cx * cx * .01   // 同一行的优先；一样近时取中心更近的词
        if (d < bd) { bd = d; best = { ref: it[0], x: r.x, y: r.y, u: size(c, it[1]) } }
      })
      return best
    },
    locate: function (pane, ref) {
      if (!cache) cache = build(pane)
      var el = cache.map[ref]
      // 译文收起时，写在译文上的笔迹先不显示，展开后回来
      if (!el && ref.charAt(0) === 'z') return null
      if (!el) return null
      var r = rel(pane, el)
      return { x: r.x, y: r.y, u: size(cache, el) }
    }
  }

  document.addEventListener('tem8:reader-render', function () { setTimeout(mountArticle, 0) })
  // 排版变了：重新按词的位置画一遍
  document.addEventListener('tem8:reader-layout', function () { if (pane) requestAnimationFrame(function () { widen(); pane.redraw() }) })
  document.addEventListener('tem8:view', function (e) {
    if (e.detail !== 'reader') { if (pane && I()) { I().unmount(pane); pane = null } }
  })
  document.addEventListener('tem8:theme', function () { if (pane) pane.redraw(); if (sheet) sheet.redraw() })

  /* ---------- 笔记抽屉里的手写纸 ---------- */
  document.addEventListener('tem8:anno-sheet', function (e) {
    var ink = I(); if (!ink) return
    var id = e.detail && e.detail.id
    var wrap = document.querySelector('[data-anno-sheet]')
    if (!id || !wrap) { if (sheet) { ink.unmount(sheet); sheet = null } return }
    var barBox = wrap.querySelector('[data-anno-sheet-bar]')
    if (!barBox.firstChild) barBox.innerHTML = ink.barHTML({ scope: 'sheet', zoom: false, clearText: '确定要清除这一页手写笔记吗？' })
    if (sheet && sheet._id === id) return
    if (sheet) { ink.unmount(sheet); sheet = null }
    var paper = wrap.querySelector('[data-anno-paper]')
    sheet = ink.mount(paper, 'note:' + id, 'sheet', { scope: 'sheet', always: true, zoom: false })
    sheet._id = id
  })
})()
