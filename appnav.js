/* 拾页 · App 式导航
   - 浅色/深色：底部 3 栏 首页 / 复习 / 我的；首页顶部是倒计时、继续条和 精读|题型练习|模考|精听 四个分段
   - 圣诞主题：底部 5 栏 首页 / 阅读 / 练习 / 复习 / 我的（保持原样）
   - 练习、复习、我的 各有顶部分段切换；底栏记住上次停在哪一段
   - 阅读页、做题页是沉浸页：隐藏底栏
   - 阅读页顶栏：字号与背景面板、笔记按钮
   只看当前显示的是哪个 .view，不改动各模块原有的跳转逻辑。 */
(function () {
  'use strict'
  var $ = function (id) { return document.getElementById(id) }
  var TAB = {
    home: 'home',
    library: 'library', reader: 'library',
    papers: 'practice', mock: 'practice', intensive: 'practice', dictation: 'practice', 'dictation-session': 'practice',
    'workflow-config': 'practice', 'workflow-session': 'practice', 'workflow-report': 'practice',
    'paper-archive': 'practice', exam: 'practice', result: 'practice',
    mistakes: 'review', words: 'review', bookmarks: 'review', notes: 'review',
    my: 'my', settings: 'my'
  }
  var SEG = { practice: ['papers', 'mock', 'intensive', 'dictation'], review: ['mistakes', 'words', 'bookmarks', 'notes'], my: ['my', 'settings'] }
  // 浅色/深色：阅读和练习并进首页
  var HOME_SEG = ['library', 'papers', 'mock', 'intensive', 'dictation']
  function xmas() { return document.documentElement.dataset.theme === 'xmas' }
  function tabOf(view) {
    if (!xmas() && (TAB[view] === 'library' || TAB[view] === 'practice')) return 'home'
    return TAB[view] || ''
  }
  function lastHomeSeg() { var v = get('tem8_tab_home', 'library'); return HOME_SEG.indexOf(v) >= 0 ? v : 'library' }
  var homeTop = $('home-top'), homeTopHome = homeTop && homeTop.parentNode
  function placeHomeTop(view) {
    if (!homeTop) return
    var target = !xmas() && HOME_SEG.indexOf(view) >= 0 ? $(view + '-view') : homeTopHome
    if (target && homeTop.parentNode !== target) target.insertBefore(homeTop, target.firstChild)
    document.body.classList.toggle('app-home-seg', target !== homeTopHome)
  }
  function homeBtn() {
    var b = document.querySelector('.tabbar [data-tab="home"]')
    if (b) b.dataset.view = xmas() ? 'home' : lastHomeSeg()
  }
  var IMMERSIVE = { 'dictation-session': 1, reader: 1, 'workflow-session': 1, 'workflow-config': 1, exam: 1 }
  var WIDE = { 'workflow-session': 1, exam: 1, 'workflow-report': 1, 'paper-archive': 1 }

  function get(k, d) { try { var v = localStorage.getItem(k); return v == null ? d : v } catch (e) { return d } }
  function set(k, v) { try { localStorage.setItem(k, v) } catch (e) {} }

  // 底栏按钮记住每组上次停留的那一段
  Object.keys(SEG).forEach(function (tab) {
    var last = get('tem8_tab_' + tab, '')
    var btn = document.querySelector('.tabbar [data-tab="' + tab + '"]')
    if (btn && SEG[tab].indexOf(last) >= 0) btn.dataset.view = last
  })

  homeBtn()
  var current = ''
  function activeView() {
    var v = document.querySelector('.view.active')
    return v ? v.id.replace(/-view$/, '') : ''
  }
  function sync() {
    var view = activeView()
    if (!view || view === current) return
    // 浅色/深色没有单独的首页：直接进上次停留的分段
    if (view === 'home' && !xmas()) {
      var go = document.querySelector('.home-tabs [data-view="' + lastHomeSeg() + '"]')
      if (go) { go.click(); return }
    }
    current = view
    var tab = tabOf(view)
    placeHomeTop(view)
    if (!xmas() && HOME_SEG.indexOf(view) >= 0) {
      set('tem8_tab_home', view); homeBtn()
      setTimeout(function () {
        var row = document.querySelector('.home-tabs'), b = row && row.querySelector('[data-view="' + view + '"]')
        if (b && row.scrollWidth > row.clientWidth) row.scrollTo({ left: Math.max(0, b.offsetLeft - (row.clientWidth - b.offsetWidth) / 2), behavior: 'smooth' })
      }, 0)
    }
    var body = document.body
    body.className = body.className.replace(/\bapp-v-[\w-]+/g, '').trim()
    body.classList.add('app-v-' + view)
    body.classList.toggle('app-immersive', !!IMMERSIVE[view])
    body.classList.toggle('app-wide', !!WIDE[view])
    document.querySelectorAll('.tabbar [data-tab]').forEach(function (b) {
      var on = b.dataset.tab === tab
      b.classList.toggle('on', on)
      if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current')
    })
    // 分段按钮的选中状态（工作流页面不经过 app.js，会清掉 active，这里补上）
    document.querySelectorAll('.seg-tabs [data-view]').forEach(function (b) { b.classList.toggle('active', b.dataset.view === view) })
    if (SEG[tab] && SEG[tab].indexOf(view) >= 0) {
      set('tem8_tab_' + tab, view)
      var btn = document.querySelector('.tabbar [data-tab="' + tab + '"]')
      if (btn) btn.dataset.view = view
    }
    if (view === 'notes' && window.TEM8_ANNO && window.TEM8_ANNO.renderPage) window.TEM8_ANNO.renderPage($('notes-content'))
    closePanel()
    if (view === 'reader') setTimeout(updateCount, 0)
  }
  var views = document.querySelectorAll('.view')
  if (window.MutationObserver) {
    var mo = new MutationObserver(sync)
    views.forEach(function (v) { mo.observe(v, { attributes: true, attributeFilter: ['class'] }) })
  }
  sync()
  // 切换主题时重新安排
  document.addEventListener('tem8:theme', function () { var v = current; current = ''; homeBtn(); if (xmas() && v !== 'home') placeHomeTop(''); sync() })

  // ---------- 阅读页顶栏 ----------
  var panel = $('rd-panel'), aa = document.querySelector('[data-rd-panel]')
  function closePanel() { if (panel && !panel.hidden) { panel.hidden = true; if (aa) aa.setAttribute('aria-expanded', 'false') } }
  function articleId() { var el = document.querySelector('#reader-view [data-anno-article]'); return el ? el.dataset.annoArticle : '' }
  function updateCount() {
    var b = document.querySelector('[data-rd-count]'); if (!b || !window.TEM8_ANNO) return
    var id = articleId(), n = id ? (window.TEM8_ANNO.get(id).notes || []).length : 0
    b.hidden = !n; b.textContent = n ? String(n) : ''
  }
  document.addEventListener('click', function (e) {
    var t = e.target.closest ? e.target.closest('button') : null
    if (t && t.hasAttribute('data-rd-panel')) {
      var open = panel.hidden
      panel.hidden = !open; t.setAttribute('aria-expanded', String(open))
      return
    }
    if (t && t.hasAttribute('data-rd-notes')) {
      var A = window.TEM8_ANNO; if (!A) return
      var drawer = document.querySelector('.anno-panel')
      if (drawer && !drawer.hidden) A.closeDrawer(); else { A.refresh(articleId()); A.openDrawer() }
      return
    }
    if (panel && !panel.hidden && !(e.target.closest && e.target.closest('#rd-panel'))) closePanel()
    if (current === 'reader') setTimeout(updateCount, 50)
  })
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closePanel() })

  // ---------- 屏幕键盘弹出时：把正在输入的框挪到键盘上方，并在上面留出几行原文 ----------
  var vv = window.visualViewport, touch = window.matchMedia && matchMedia('(pointer: coarse)').matches
  function typing(el) { return el && el.matches && el.matches('input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=file]),textarea') }
  function reveal() {
    var el = document.activeElement
    if (!vv || !typing(el) || el.closest('.anno-panel,.wpop')) return
    var r = el.getBoundingClientRect(), top = vv.offsetTop, h = vv.height
    var head = 64, roomAbove = Math.min(h * 0.35, 220)
    if (r.top < top + head || r.bottom > top + h - 16) {
      var box = el.closest('.workflow-reading-passage,.pq-pane,.pq-proof-sheet,[data-scroll-box]')
      if (box && box.scrollHeight > box.clientHeight) el.scrollIntoView({ block: 'nearest' })
      r = el.getBoundingClientRect()
      window.scrollBy({ top: r.top - (top + roomAbove), behavior: 'smooth' })
    }
  }
  if (vv && touch) {
    var t = 0
    document.addEventListener('focusin', function (e) { if (typing(e.target)) { clearTimeout(t); t = setTimeout(reveal, 320) } })
    vv.addEventListener('resize', function () { clearTimeout(t); t = setTimeout(reveal, 80) })
    document.addEventListener('focusin', function (e) { document.body.classList.toggle('kb-open', typing(e.target)) })
    document.addEventListener('focusout', function () { setTimeout(function () { document.body.classList.toggle('kb-open', typing(document.activeElement)) }, 0) })
  }
})();
