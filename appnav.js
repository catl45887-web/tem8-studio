/* 拾页 · App 式导航
   - 底部 5 栏：首页 / 阅读 / 练习 / 复习 / 我的（所有主题、所有屏幕宽度）
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
    papers: 'practice', mock: 'practice', intensive: 'practice',
    'workflow-config': 'practice', 'workflow-session': 'practice', 'workflow-report': 'practice',
    'paper-archive': 'practice', exam: 'practice', result: 'practice',
    mistakes: 'review', words: 'review', bookmarks: 'review', notes: 'review',
    my: 'my', settings: 'my'
  }
  var SEG = { practice: ['papers', 'mock', 'intensive'], review: ['mistakes', 'words', 'bookmarks', 'notes'], my: ['my', 'settings'] }
  var IMMERSIVE = { reader: 1, 'workflow-session': 1, exam: 1 }
  var WIDE = { 'workflow-session': 1, exam: 1, 'workflow-report': 1, 'paper-archive': 1 }

  function get(k, d) { try { var v = localStorage.getItem(k); return v == null ? d : v } catch (e) { return d } }
  function set(k, v) { try { localStorage.setItem(k, v) } catch (e) {} }

  // 底栏按钮记住每组上次停留的那一段
  Object.keys(SEG).forEach(function (tab) {
    var last = get('tem8_tab_' + tab, '')
    var btn = document.querySelector('.tabbar [data-tab="' + tab + '"]')
    if (btn && SEG[tab].indexOf(last) >= 0) btn.dataset.view = last
  })

  var current = ''
  function activeView() {
    var v = document.querySelector('.view.active')
    return v ? v.id.replace(/-view$/, '') : ''
  }
  function sync() {
    var view = activeView()
    if (!view || view === current) return
    current = view
    var tab = TAB[view] || ''
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
})();
