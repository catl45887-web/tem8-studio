/* 精读阅读设置：排版面板 + 对照排版 + 右侧悬浮工具栏 + 宽屏笔记停靠
 * 偏好存在 localStorage['tem8_reader_prefs']，第一次打开时从旧的 readingFont / readingLine / readingBackground 迁移
 *   size 字号(px)  lh 行距  margin 边距档  ws 词距档  font 英文字体  bg 背景  zh 译文(tap 点开看 / all 全部显示 / off 不看)
 *   layout 对照排版(auto / side / stack)  more 「更多排版」是否展开  marks 标注是否显示（面板里「标注」一行）
 * 对照排版：手机上一律上下；平板/电脑「自动」= 左右分栏；笔记停靠在右侧时自动改成上下 */
;(function () {
  'use strict'
  var KEY = 'tem8_reader_prefs', MAIN = 'tem8_studio_web_v1'
  var DEF = { size: 18, lh: 1.8, margin: 2, ws: 0, font: 'georgia', bg: 'auto', zh: 'tap', layout: 'auto', more: false, marks: true }
  var FONTS = {
    georgia: { name: 'Georgia', css: "Georgia,'Times New Roman',serif" },
    charter: { name: 'Charter', css: "Charter,'Bitstream Charter','Iowan Old Style',Georgia,serif" },
    palatino: { name: 'Palatino', css: "Palatino,'Palatino Linotype','Book Antiqua',Georgia,serif" },
    sans: { name: '无衬线', css: "-apple-system,'Helvetica Neue','Segoe UI',Roboto,Arial,sans-serif" }
  }
  // 背景：浅色、深色主题各给一组（第一个都是跟随当前配色）
  var BGS = {
    light: [['auto', '跟随', ''], ['white', '纸白', '#FFFFFF'], ['sepia', '米黄', '#F4ECD8'], ['green', '豆绿', '#E3EDDA']],
    dark: [['auto', '跟随', ''], ['black', '纯黑', '#0D0D0D'], ['brown', '暗褐', '#231E19'], ['green', '墨绿', '#1A2420']]
  }
  var MARGINS = ['窄', '较窄', '标准', '较宽', '宽'], SPACINGS = ['标准', '稍松', '松', '更松']
  var root = document.documentElement
  function $(id) { return document.getElementById(id) }
  function read(k) { try { return JSON.parse(localStorage.getItem(k) || 'null') } catch (e) { return null } }
  function write(k, v) { try { localStorage.setItem(k, JSON.stringify(v)) } catch (e) {} }

  var P = read(KEY)
  if (!P) {
    var m = read(MAIN) || {}
    P = Object.assign({}, DEF, {
      size: Number(m.readingFont) || DEF.size,
      lh: Number(m.readingLine) || DEF.lh,
      bg: m.readingBackground === 'sepia' ? 'sepia' : 'auto'
    })
    write(KEY, P)
  }
  P = Object.assign({}, DEF, P)
  function save() { write(KEY, P) }

  function tone() { return root.dataset.theme === 'light' ? 'light' : 'dark' }
  function wide() { return window.innerWidth >= 760 }
  function docked() { return document.body.classList.contains('rp-docked') }
  // 实际用的对照排版
  function layoutNow() {
    if (!wide() || docked()) return 'stack'
    return P.layout === 'stack' ? 'stack' : 'side'
  }

  /* ---------- 套用到页面 ---------- */
  function apply() {
    var v = $('reader-view'); if (!v) return
    v.style.setProperty('--reader-font-size', P.size + 'px')
    v.style.setProperty('--reader-lh', P.lh)
    v.style.setProperty('--rp-pad', (P.margin * 12) + 'px')
    v.style.setProperty('--rp-ws', (P.ws * 0.08) + 'em')
    v.style.setProperty('--rp-font', (FONTS[P.font] || FONTS.georgia).css)
    var bgs = BGS[tone()], ok = bgs.some(function (b) { return b[0] === P.bg })
    root.dataset.rpBg = ok && P.bg !== 'auto' ? tone() + '-' + P.bg : ''
    if (!root.dataset.rpBg) delete root.dataset.rpBg
    v.classList.toggle('rp-zh-all', P.zh === 'all')
    v.classList.toggle('rp-side', P.zh === 'all' && layoutNow() === 'side')
    v.classList.toggle('rp-marks-off', !P.marks)
    syncPanel(); syncRail()
    // 排版一变，手写笔迹换一层（tem8:reader-layout，readerink.js 接）
    var sg = sig()
    if (sg !== lastSig) { lastSig = sg; document.dispatchEvent(new CustomEvent('tem8:reader-layout', { detail: sg })) }
  }
  var lastSig = ''
  // 当前排版的指纹：字号、行距、字体、边距、词距、译文、对照、正文宽度（取整到 20px）
  function sig() {
    var c = $('reader-content'), w = c ? Math.round(c.clientWidth / 20) * 20 : 0
    return [P.size, P.lh, P.font, P.margin, P.ws, P.zh, P.zh === 'all' ? layoutNow() : '-', w].join('_')
  }

  /* ---------- 面板 ---------- */
  function seg(name, items, cur) {
    return '<div class="rp-seg" role="radiogroup">' + items.map(function (it) {
      return '<button type="button" role="radio" data-rp-set="' + name + '" data-v="' + it[0] + '" aria-checked="' + (String(cur) === String(it[0])) + '">' + it[1] + '</button>'
    }).join('') + '</div>'
  }
  function slider(name, label, min, max, step, val, show) {
    return '<div class="rp-row rp-slide" data-row="' + name + '"><span class="rp-k">' + label + '</span>' +
      '<input type="range" min="' + min + '" max="' + max + '" step="' + step + '" value="' + val + '" data-rp-range="' + name + '" aria-label="' + label + '">' +
      '<span class="rp-v" data-rp-val="' + name + '">' + show + '</span></div>'
  }
  function sizeRow() {
    return '<div class="rp-row rp-slide rp-size" data-row="size"><span class="rp-k">字号</span>' +
      '<button type="button" class="rp-step" data-rp-step="-1" aria-label="字号变小">A</button>' +
      '<input type="range" min="14" max="26" step="1" value="' + P.size + '" data-rp-range="size" aria-label="字号">' +
      '<button type="button" class="rp-step big" data-rp-step="1" aria-label="字号变大">A</button>' +
      '<span class="rp-v" data-rp-val="size">' + P.size + '</span></div>'
  }
  function hasZh() { return !!document.querySelector('#reader-view .rd-zh') }
  function render() {
    var panel = $('rd-panel'); if (!panel) return
    var bgs = BGS[tone()]
    panel.className = 'rd-panel rp-panel'
    panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', '阅读设置')
    panel.innerHTML =
      '<div class="rp-grab" aria-hidden="true"></div>' +
      '<div class="rp-head"><b>阅读设置</b><button type="button" class="rp-reset" data-rp-reset>恢复默认</button></div>' +
      sizeRow() +
      '<div class="rp-row" data-row="bg"><span class="rp-k">背景</span><div class="rp-bgs" role="radiogroup">' + bgs.map(function (b) {
        return '<button type="button" role="radio" data-rp-set="bg" data-v="' + b[0] + '" aria-checked="' + (P.bg === b[0]) + '" aria-label="' + b[1] + '"><i' + (b[2] ? ' style="background:' + b[2] + '"' : ' class="auto"') + '></i><small>' + b[1] + '</small></button>'
      }).join('') + '</div></div>' +
      '<div class="rp-row" data-row="zh" data-need-zh><span class="rp-k">译文</span>' + seg('zh', [['tap', '点开看'], ['all', '对照显示'], ['off', '不看']], P.zh) + '</div>' +
      '<div class="rp-row" data-row="layout" data-need-zh><span class="rp-k">对照</span>' + seg('layout', [['auto', '自动'], ['side', '左右'], ['stack', '上下']], P.layout) + '</div>' +
      '<div class="rp-row" data-row="marks"><span class="rp-k">标注</span>' + seg('marks', [['true', '显示'], ['false', '隐藏']], P.marks) + '</div>' +
      '<p class="rp-note" data-rp-note></p>' +
      '<button type="button" class="rp-more" data-rp-more aria-expanded="' + P.more + '"><span>更多排版</span><small data-rp-more-sum></small><i aria-hidden="true">›</i></button>' +
      '<div class="rp-adv"' + (P.more ? '' : ' hidden') + '>' +
        '<div class="rp-row rp-fonts-row" data-row="font"><span class="rp-k">字体</span><div class="rp-fonts" role="radiogroup">' + Object.keys(FONTS).map(function (k) {
          return '<button type="button" role="radio" data-rp-set="font" data-v="' + k + '" aria-checked="' + (P.font === k) + '"><b style="font-family:' + FONTS[k].css.replace(/"/g, "'") + '">Reading</b><small>' + FONTS[k].name + '</small></button>'
        }).join('') + '</div></div>' +
        slider('lh', '行距', 1.4, 2.4, 0.1, P.lh, P.lh.toFixed(1)) +
        slider('margin', '边距', 0, 4, 1, P.margin, MARGINS[P.margin]) +
        slider('ws', '词距', 0, 3, 1, P.ws, SPACINGS[P.ws]) +
      '</div>'
    syncPanel()
  }
  function moreSummary() {
    return (FONTS[P.font] || FONTS.georgia).name + ' · 行距 ' + P.lh.toFixed(1) + ' · 边距' + MARGINS[P.margin]
  }
  function setHidden(el, h) { if (el && el.hidden !== h) el.hidden = h }
  function syncPanel() {
    var panel = $('rd-panel'); if (!panel || !panel.querySelector('.rp-head')) return
    panel.querySelectorAll('[data-rp-set]').forEach(function (b) { b.setAttribute('aria-checked', String(String(P[b.dataset.rpSet]) === b.dataset.v)) })
    var z = hasZh()
    panel.querySelectorAll('[data-need-zh]').forEach(function (r) { setHidden(r, !z) })
    var lay = panel.querySelector('[data-row=layout]'); setHidden(lay, !z || P.zh !== 'all')
    var note = panel.querySelector('[data-rp-note]'), msg = ''
    if (z && P.zh === 'all') {
      if (!wide()) msg = '手机屏幕窄，对照固定为上下排布。'
      else if (docked()) msg = '笔记停在右侧时，对照暂时改为上下排布。'
    }
    if (!z) msg = '这篇还没有译文。'
    if (note) { note.textContent = msg; setHidden(note, !msg) }
    if (lay) lay.classList.toggle('rp-locked', !wide() || docked())
    var sum = panel.querySelector('[data-rp-more-sum]'); if (sum) sum.textContent = P.more ? '' : moreSummary()
    var mb = panel.querySelector('[data-rp-more]'); if (mb) mb.setAttribute('aria-expanded', String(P.more))
    setHidden(panel.querySelector('.rp-adv'), !P.more)
  }
  function setVal(name, v) {
    if (name === 'size') v = Math.max(14, Math.min(26, Math.round(v)))
    if (name === 'lh') v = Math.round(v * 10) / 10
    if (name === 'margin' || name === 'ws') v = Math.round(v)
    P[name] = v; save(); apply()
    var panel = $('rd-panel'); if (!panel) return
    var r = panel.querySelector('[data-rp-range="' + name + '"]'); if (r && Number(r.value) !== v) r.value = v
    var out = panel.querySelector('[data-rp-val="' + name + '"]')
    if (out) out.textContent = name === 'lh' ? v.toFixed(1) : name === 'margin' ? MARGINS[v] : name === 'ws' ? SPACINGS[v] : v
  }
  function rerender() { if (typeof window.TEM8_RERENDER_READER === 'function') window.TEM8_RERENDER_READER() }

  document.addEventListener('input', function (e) {
    var r = e.target.closest && e.target.closest('[data-rp-range]'); if (!r) return
    setVal(r.dataset.rpRange, Number(r.value))
    peek(r.closest('.rp-row'))
  })
  // 拖动滑块时，面板其他部分变透明，能看清正文的变化
  var peekT = 0
  function peek(row) {
    var panel = $('rd-panel'); if (!panel) return
    panel.classList.add('rp-peeking')
    panel.querySelectorAll('.rp-row').forEach(function (x) { x.classList.toggle('rp-peek-row', x === row) })
    clearTimeout(peekT); peekT = setTimeout(endPeek, 900)
  }
  function endPeek() { var p = $('rd-panel'); if (p) { p.classList.remove('rp-peeking'); p.querySelectorAll('.rp-peek-row').forEach(function (x) { x.classList.remove('rp-peek-row') }) } }
  document.addEventListener('pointerup', function () { clearTimeout(peekT); peekT = setTimeout(endPeek, 250) })

  document.addEventListener('click', function (e) {
    var t = e.target.closest ? e.target.closest('button') : null; if (!t) return
    if (t.dataset.rpSet) {
      var n = t.dataset.rpSet, v = t.dataset.v
      if (n === 'marks') v = v === 'true'
      P[n] = v; save(); apply()
      if (n === 'zh') rerender()
      return
    }
    if (t.dataset.rpStep) { setVal('size', P.size + Number(t.dataset.rpStep)); return }
    if (t.hasAttribute('data-rp-more')) { P.more = !P.more; save(); syncPanel(); return }
    if (t.hasAttribute('data-rp-reset')) {
      var keepMore = P.more; P = Object.assign({}, DEF, { more: keepMore }); save(); render(); apply(); rerender(); return
    }
    if (t.hasAttribute('data-rp-marks')) { P.marks = !P.marks; save(); apply(); return }
    if (t.hasAttribute('data-rp-tone')) {
      var b = document.querySelector('[data-theme-pick]')
      var target = tone() === 'light' ? 'dark' : 'light'
      try { localStorage.setItem('tem8_theme_follow', '0'); localStorage.setItem('tem8_theme', target) } catch (err) {}
      var fake = document.createElement('button'); fake.type = 'button'; fake.dataset.themePick = target; fake.hidden = true
      document.body.appendChild(fake); fake.click(); fake.remove()
      return
    }
  })

  /* ---------- 右侧悬浮工具栏 ---------- */
  var ICON = {
    moon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19.5 14.6A7.8 7.8 0 0 1 9.4 4.5a7.9 7.9 0 1 0 10.1 10.1z"/></svg>',
    sun: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7"/></svg>',
    mark: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19.5h16"/><path d="M7 16l5-11 5 11"/><path d="M8.8 12h6.4"/></svg>',
    ink: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20l1.2-4.6L15.6 5a2 2 0 0 1 2.8 0l.6.6a2 2 0 0 1 0 2.8L8.6 18.8z"/><path d="M13.8 6.8l3.4 3.4"/></svg>',
    note: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="3.5" width="14" height="17" rx="2.5"/><path d="M8.5 8.5h7M8.5 12h7M8.5 15.5h4"/></svg>'
  }
  var rail = null
  function buildRail() {
    var v = $('reader-view'); if (!v || rail) return
    rail = document.createElement('div')
    rail.className = 'rp-rail'; rail.setAttribute('role', 'toolbar'); rail.setAttribute('aria-label', '阅读工具')
    rail.innerHTML =
      '<button type="button" class="rp-rb rp-rb-aa" data-rd-panel aria-label="阅读设置" aria-expanded="false">Aa</button>' +
      '<button type="button" class="rp-rb" data-rp-tone aria-label="切换深浅色"></button>' +
      '<button type="button" class="rp-rb" data-ink-toggle aria-label="手写" title="手写">' + ICON.ink + '</button>' +
      '<button type="button" class="rp-rb rp-rb-note" data-rd-notes aria-label="笔记">' + ICON.note + '<b class="rp-badge" data-rd-count hidden></b></button>'
    // 放在阅读页顶栏右边（跟着顶栏吸顶，不浮在文字上）
    var top = v.querySelector('.rd-bar'); (top || v).appendChild(rail)
    // 顶栏原来的 Aa / 笔记按钮交给工具栏
    v.querySelectorAll('.rd-bar .rd-aa,.rd-bar .rd-notes-txt').forEach(function (b) { b.hidden = true; b.removeAttribute('data-rd-count'); var c = b.querySelector('[data-rd-count]'); if (c) c.removeAttribute('data-rd-count') })
  }
  function syncRail() {
    if (!rail) return
    var tb = rail.querySelector('[data-rp-tone]')
    if (tb) { tb.innerHTML = tone() === 'light' ? ICON.moon : ICON.sun; tb.setAttribute('aria-label', tone() === 'light' ? '切换到深色' : '切换到浅色') }
    var mb = rail.querySelector('[data-rp-marks]'); if (mb) mb.setAttribute('aria-pressed', String(!!P.marks))
    var panel = $('rd-panel'), aa = rail.querySelector('[data-rd-panel]')
    if (aa && panel) aa.setAttribute('aria-expanded', String(!panel.hidden))
  }
  // 面板在宽屏上从 Aa 按钮正下方弹出（手机上从底部升起，见 CSS）
  function placePanel() {
    var p = $('rd-panel'), aa = rail && rail.querySelector('[data-rd-panel]')
    if (!p || p.hidden || !aa) return
    if (window.innerWidth <= 640) { p.style.top = p.style.right = ''; return }
    var r = aa.getBoundingClientRect()
    p.style.top = Math.round(r.bottom + 8) + 'px'
    p.style.right = Math.max(12, Math.round(window.innerWidth - r.right - 6)) + 'px'
  }
  window.addEventListener('resize', placePanel)
  window.addEventListener('scroll', placePanel, { passive: true })

  /* ---------- 宽屏：笔记抽屉停靠在右侧，和正文同屏 ---------- */
  function watchDrawer() {
    var d = document.querySelector('.anno-panel'); if (!d || d._rpWatch) return
    d._rpWatch = true
    var mo = new MutationObserver(updateDock); mo.observe(d, { attributes: true, attributeFilter: ['hidden', 'class', 'style'] })
    updateDock()
  }
  function updateDock() {
    var d = document.querySelector('.anno-panel'), v = $('reader-view')
    var open = !!d && !d.hidden && getComputedStyle(d).display !== 'none'
    // 题目栏（readerq.js）也停在右侧
    if (document.body.classList.contains('rq-open')) open = true
    var on = open && window.innerWidth >= 1000 && v && v.classList.contains('active')
    if (on === docked()) return
    document.body.classList.toggle('rp-docked', on)
    apply()
  }

  /* ---------- 面板跟着阅读页的打开/关闭 ---------- */
  function onReader() {
    var pn = $('rd-panel'); if (pn && pn.parentNode !== document.body) document.body.appendChild(pn)
    buildRail(); render(); apply(); watchDrawer()
  }
  document.addEventListener('tem8:view', function (e) {
    if (e.detail === 'reader') setTimeout(onReader, 30)
    else document.body.classList.remove('rp-docked')
  })
  document.addEventListener('tem8:theme', function () { if (rail) { render(); apply() } })
  window.addEventListener('resize', function () { updateDock(); apply() })
  // 打开 / 收起面板时同步 Aa 按钮状态；面板里点的东西不冒泡关掉面板
  var panelEl = $('rd-panel')
  if (panelEl) new MutationObserver(function () { syncRail(); if (!panelEl.hidden) { syncPanel(); endPeek(); placePanel() } }).observe(panelEl, { attributes: true, attributeFilter: ['hidden'] })

  window.TEM8_RP = {
    zhAll: function () { return P.zh === 'all' },
    zhOff: function () { return P.zh === 'off' },
    apply: apply,
    dock: updateDock,
    prefs: function () { return Object.assign({}, P) },
    sig: sig
  }
  if ($('reader-view') && $('reader-view').classList.contains('active')) onReader()
})()
