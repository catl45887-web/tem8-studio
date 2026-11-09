/* 精读页「题目」：在原文旁边看题目和选项，只看不答
 *  - 右上角工具栏「题目」开关，默认关，打开后记住
 *  - 宽屏（≥1000px）：原文和题目栏并排、整组居中，和笔记抽屉共用右侧位置（同时只开一个）；窄屏是底部抽屉，三档：一行 / 半屏 / 全部
 *  - 每道题一行三个按钮：提示（解析里的【定位】，并标出那一段）/ 答案 / 解析，互不依赖，点一下展开、再点收起
 *  - 选中原文 → 底部浮条「设为依据」→ 选题号；依据句由 annotations.js 画成紫色下划线 + 句尾题号，题卡里也显示
 *  - 题卡上也能手写（和原文同一套笔），笔迹挂在题干 / 选项上，跟着题卡走
 *  - 「设为依据」的用法只在题目栏顶部提示一次
 * 记录存 localStorage['tem8_reader_q_v1'] = { open, sheet, tip, tog:{[文章-题号]:{h,a,w}}, ev:{[文章]:{[题号]:{ranges,quote,i}}}, cur:{[文章]:下标} } */
;(function () {
  'use strict'
  var KEY = 'tem8_reader_q_v1'
  var W = window
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] }) }
  var LET = ['A', 'B', 'C', 'D', 'E', 'F']
  function $(id) { return document.getElementById(id) }
  function load() { try { return JSON.parse(localStorage.getItem(KEY) || 'null') || {} } catch (e) { return {} } }
  var S = load()
  S.tog = S.tog || {}; S.ev = S.ev || {}; S.cur = S.cur || {}
  delete S.step
  if (!S.sheet) S.sheet = 'half'
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); document.dispatchEvent(new Event('tem8:study-changed')) } catch (e) {} }

  /* ---------- 数据 ---------- */
  var ALL = null
  function allQ() {
    if (!ALL) ALL = [].concat(W.TEM8_2026_QUESTIONS || [], W.TEM8_2025_QUESTIONS || [], W.TEM8_MID_QUESTIONS || [], W.TEM8_ARCHIVE_QUESTIONS || [], W.TEM8_ARCHIVE_QUESTIONS2 || [])
    return ALL
  }
  var aid = '', mode = '', qs = []
  function cnNum(s) {
    if (/^\d+$/.test(s)) return Number(s)
    var d = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 }
    if (s === '十') return 10
    if (s[0] === '十') return 10 + (d[s[1]] || 0)
    if (s[1] === '十') return (d[s[0]] || 0) * 10 + (d[s[2]] || 0)
    return d[s] || 0
  }
  // 解析拆成【定位】和其余部分；从【定位】里找“第 N 段”
  function parts(q) {
    var a = String(q.analysis || '').trim()
    var m = a.match(/【定位】([\s\S]*?)(?=\n?【|$)/)
    var loc = m ? m[1].trim() : ''
    var rest = m ? a.replace(m[0], '').trim() : a
    var para = 0
    if (loc) {
      var p = loc.match(/第\s*([0-9一二三四五六七八九十]+)\s*段/) || loc.match(/Para(?:graph)?\.?\s*(\d+)/i)
      if (p) para = cnNum(p[1])
      else if (/首段|第一段/.test(loc)) para = 1
      else if (/末段|最后一段|尾段/.test(loc)) para = -1
    }
    return { loc: loc, rest: rest, para: para }
  }
  function isChoice(q) { return q.type === 'choice' && Array.isArray(q.options) && Number.isInteger(q.answer) }
  function ansText(q) { return isChoice(q) ? LET[q.answer] : String(q.referenceAnswer || '').trim() }
  function qKey(q) { return aid + '-' + q.number }
  function tog(q) { return S.tog[qKey(q)] || {} }

  /* ---------- 原文：段落定位、依据下划线 ---------- */
  function paraEl(n) {
    var list = document.querySelectorAll('#reader-content [data-anno-p]')
    if (!list.length) return null
    return list[n === -1 ? list.length - 1 : n - 1] || null
  }
  var flashT = 0
  function flashPara(n) {
    var el = paraEl(n); if (!el) return
    document.querySelectorAll('.rq-flash').forEach(function (x) { x.classList.remove('rq-flash') })
    void el.offsetWidth
    el.classList.add('rq-flash')
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    clearTimeout(flashT); flashT = setTimeout(function () { el.classList.remove('rq-flash') }, 2600)
  }
  // annotations.js 画原文时来问：这一段里哪些字是某道题的依据
  W.TEM8_ANNO_EXTRA = function (articleId, seg) {
    if (articleId !== aid || mode !== 'free') return []
    var ev = S.ev[articleId], out = []
    if (!ev) return out
    var byNum = {}
    Object.keys(ev).forEach(function (num) {
      ;(ev[num].ranges || []).forEach(function (g) {
        if (Number(g.i) !== Number(seg)) return
        var k = g.s + '-' + g.e
        if (byNum[k]) byNum[k].label += ' Q' + num
        else out.push(byNum[k] = { s: g.s, e: g.e, label: 'Q' + num })
      })
    })
    return out
  }
  function repaintEv() {
    if (W.TEM8_ANNO && W.TEM8_ANNO.repaint && aid) W.TEM8_ANNO.repaint(aid)
    document.dispatchEvent(new CustomEvent('tem8:reader-layout', { detail: 'rq-ev' }))
  }

  /* ---------- 面板 ---------- */
  var panel = null, btn = null, picker = null, headBox = null, scrollBox = null, inkBox = null, cardsBox = null, navBox = null
  var qPane = null
  function wide() { return W.innerWidth >= 1000 }
  function readerActive() { var v = $('reader-view'); return !!v && v.classList.contains('active') }
  function available() { return readerActive() && mode === 'free' && qs.length > 0 }
  function isOpen() { return !!S.open && available() }

  function buildPanel() {
    if (panel) return
    panel = document.createElement('aside')
    panel.className = 'rq-panel'
    panel.hidden = true
    panel.setAttribute('aria-label', '题目')
    panel.innerHTML = '<div class="rq-headbox"></div><div class="rq-scroll"><div class="rq-ink"><div class="rq-cards"></div></div></div><nav class="rq-nav" hidden></nav>'
    document.body.appendChild(panel)
    headBox = panel.querySelector('.rq-headbox')
    scrollBox = panel.querySelector('.rq-scroll')
    inkBox = panel.querySelector('.rq-ink')
    cardsBox = panel.querySelector('.rq-cards')
    navBox = panel.querySelector('.rq-nav')
    panel.addEventListener('click', onPanelClick)
  }
  function optsHTML(q, show) {
    var n = esc(q.number)
    if (!isChoice(q)) {
      return show ? '<div class="rq-ref" data-ink-a="q' + n + ':a"><b>参考答案</b>' + esc(ansText(q)) + '</div>' : ''
    }
    return '<ol class="rq-opts">' + q.options.map(function (o, i) {
      var ok = show && i === q.answer
      return '<li class="' + (ok ? 'ok' : '') + '" data-ink-a="q' + n + ':o' + i + '"><span class="rq-l">' + LET[i] + '.</span><span class="rq-o">' + esc(o) + '</span>' + (ok ? '<em>正确答案</em>' : '') + '</li>'
    }).join('') + '</ol>'
  }
  function cardHTML(q, idx) {
    var p = parts(q), t = tog(q), n = esc(q.number)
    var hasHint = !!p.loc, hasAns = !!ansText(q), hasWhy = !!p.rest
    var ev = (S.ev[aid] || {})[q.number]
    var evHTML = ev ? '<div class="rq-ev" data-ink-a="q' + n + ':e"><div class="rq-ev-h"><span>我的依据 · 第 ' + (Number(ev.i) + 1) + ' 段</span><button type="button" data-rq-ev-go="' + n + '">看原文</button><button type="button" data-rq-ev-del="' + n + '">移除</button></div><p>' + esc(ev.quote) + '</p></div>' : ''
    var b = function (k, label, has, on) {
      return '<button type="button" class="rq-t" data-rq-tog="' + idx + '" data-k="' + k + '" aria-pressed="' + (has && on ? 'true' : 'false') + '"' + (has ? '' : ' disabled title="这道题没有' + label + '"') + '>' + label + '</button>'
    }
    var hint = hasHint && t.h ? '<div class="rq-box" data-ink-a="q' + n + ':h"><b>提示</b>' + esc(p.loc) + (p.para ? '<button type="button" class="rq-go" data-rq-para="' + p.para + '">' + (p.para === -1 ? '看末段' : '看第 ' + p.para + ' 段') + '</button>' : '') + '</div>' : ''
    var why = hasWhy && t.w ? '<div class="rq-box" data-ink-a="q' + n + ':w"><b>解析</b>' + esc(p.rest).replace(/\n/g, '<br>') + '</div>' : ''
    return '<article class="rq-card" data-rq-card="' + idx + '">' +
      '<div class="rq-no" data-ink-a="q' + n + ':n"><b>Q' + n + '</b><span>' + (isChoice(q) ? '选择题' : '简答题') + '</span></div>' +
      '<p class="rq-stem" data-ink-a="q' + n + ':s">' + lk(q.prompt) + '</p>' +
      optsHTML(q, hasAns && t.a) + evHTML +
      '<div class="rq-tgl" role="group" aria-label="提示、答案和解析" data-ink-a="q' + n + ':b">' + b('h', '提示', hasHint, t.h) + b('a', '答案', hasAns, t.a) + b('w', '解析', hasWhy, t.w) + '</div>' +
      hint + why + noteBox(q) +
      '</article>'
  }
  // 题干、选项里的词也能点开查（和原文同一个查词卡）
  function lk(t) { return W.TEM8_QNOTES && W.TEM8_QNOTES.lk ? W.TEM8_QNOTES.lk(t) : esc(t) }
  // 每题下面的小笔记：和交卷后写的记在同一道题下面
  function noteBox(q) {
    var Q = W.TEM8_QNOTES; if (!Q) return ''
    var a = (W.TEM8_2026_ARTICLES || []).concat(W.TEM8_2025_ARTICLES || [], W.TEM8_MID_ARTICLES || [], W.TEM8_ARCHIVE_ARTICLES || [], W.TEM8_ARCHIVE_ARTICLES2 || []).find(function (x) { return x.id === aid })
    var info = W.TEM8_WORKFLOW && W.TEM8_WORKFLOW.itemInfo ? W.TEM8_WORKFLOW.itemInfo(qKey(q)) : null
    var label = info ? info.label : ((a ? a.year + ' · ' : '') + 'Q' + q.number)
    return '<div class="rq-qn">' + Q.box(qKey(q), { label: label, kind: '阅读', prompt: String(q.prompt || '').slice(0, 120), aid: aid, num: q.number }, '精读') + '</div>'
  }
  function tipHTML() {
    if (S.tip) return ''
    return '<div class="rq-tip"><span>小技巧：选中原文一句话，在底部浮条点「设为依据」，就能把它记成某道题的依据。</span><button type="button" data-rq-tip>知道了</button></div>'
  }
  function curIdx() { var c = Number(S.cur[aid]) || 0; return Math.max(0, Math.min(qs.length - 1, c)) }
  var lastView = ''
  function render() {
    buildPanel()
    var on = isOpen()
    document.body.classList.toggle('rq-open', on)
    document.body.classList.toggle('rq-sheet', on && !wide())
    if (btn) { btn.hidden = !available(); btn.setAttribute('aria-pressed', String(on)) }
    if (!on) { panel.hidden = true; dropPane(); dock(); return }
    panel.hidden = false
    var sheet = !wide(), sm = sheet ? S.sheet : 'full'
    panel.className = 'rq-panel ' + (sheet ? 'rq-as-sheet rq-' + sm : 'rq-as-side')
    var c = curIdx(), q = qs[c]
    headBox.innerHTML = '<header class="rq-head">' +
      (sheet ? '<button type="button" class="rq-grab" data-rq-grab aria-label="调整题目栏高度"><i></i></button>' : '') +
      '<b>题目</b><span class="rq-sub">' + qs.length + ' 题 · 只看不答</span>' +
      (sheet && sm === 'half' ? '<button type="button" class="rq-link" data-rq-sheet="full">全部</button>' : '') +
      (sheet && sm === 'full' ? '<button type="button" class="rq-link" data-rq-sheet="half">收起</button>' : '') +
      '<button type="button" class="rq-x" data-rq-close aria-label="关闭题目栏">×</button></header>' +
      (sheet && sm === 'peek' ? '<button type="button" class="rq-peek" data-rq-sheet="half"><b>Q' + esc(q.number) + '</b><span>' + esc(q.prompt) + '</span></button>' : '')
    scrollBox.hidden = sheet && sm === 'peek'
    var view = (sheet ? sm : 'side') + '|' + aid + '|' + (sm === 'half' ? c : '')
    var top = view === lastView ? scrollBox.scrollTop : 0
    lastView = view
    cardsBox.innerHTML = tipHTML() + (sheet && sm === 'half' ? cardHTML(q, c) : qs.map(cardHTML).join(''))
    scrollBox.scrollTop = top
    if (sheet && sm === 'half') {
      navBox.hidden = false
      navBox.innerHTML = '<button type="button" data-rq-nav="-1"' + (c === 0 ? ' disabled' : '') + '>上一题</button><span>' + (c + 1) + ' / ' + qs.length + '</span><button type="button" data-rq-nav="1"' + (c === qs.length - 1 ? ' disabled' : '') + '>下一题</button>'
    } else navBox.hidden = true
    ensurePane()
    dock()
    if (W.TEM8_MARK_BOOK) W.TEM8_MARK_BOOK()
  }
  function dock() { if (W.TEM8_RP && W.TEM8_RP.dock) W.TEM8_RP.dock() }

  /* ---------- 题卡上的手写：和原文同一套笔（scope reader），笔迹挂在最近的题干 / 选项上 ---------- */
  var rng = document.createRange()
  function rel(pane, el) {
    rng.selectNodeContents(el)
    var r = rng.getBoundingClientRect(), b = pane.inner.getBoundingClientRect()
    if (!r.width) r = el.getBoundingClientRect()
    return { x: r.left - b.left, y: r.top - b.top, w: r.width, h: r.height }
  }
  var acache = null
  function abuild(pane) {
    var map = Object.create(null), list = []
    pane.inner.querySelectorAll('[data-ink-a]').forEach(function (el) { var k = el.getAttribute('data-ink-a'); map[k] = el; list.push([k, el]) })
    return { map: map, list: list }
  }
  var Q_ANCHOR = {
    prepare: function () { acache = null },
    pick: function (pane, x, y) {
      var c = abuild(pane), best = null, bd = Infinity
      c.list.forEach(function (it) {
        var r = rel(pane, it[1])
        var dx = x < r.x ? r.x - x : x > r.x + r.w ? x - r.x - r.w : 0
        var dy = y < r.y ? r.y - y : y > r.y + r.h ? y - r.y - r.h : 0
        var d = dx * dx + dy * dy * 4
        if (d < bd) { bd = d; best = { ref: it[0], x: r.x, y: r.y, u: 16 } }
      })
      return best
    },
    locate: function (pane, ref) {
      if (!acache) acache = abuild(pane)
      var el = acache.map[ref]
      if (!el) return null
      var r = rel(pane, el)
      return { x: r.x, y: r.y, u: 16 }
    }
  }
  function ensurePane() {
    var ink = W.TEM8_INK
    if (!ink || !inkBox) return
    if (qPane && qPane._aid === aid && qPane.inner && qPane.inner.isConnected) { qPane.redraw(); return }
    dropPane()
    qPane = ink.mount(inkBox, 'rq:' + aid, 'q', { scope: 'reader', zoom: false, anchor: Q_ANCHOR, noTap: true })
    qPane._aid = aid
  }
  function dropPane() {
    if (qPane && W.TEM8_INK) { W.TEM8_INK.unmount(qPane); qPane = null }
  }

  function setOpen(v) {
    S.open = !!v; save()
    if (v) {
      var ap = document.querySelector('.anno-panel')
      if (ap && !ap.hidden && W.TEM8_ANNO) W.TEM8_ANNO.closeDrawer()
      if (!wide() && S.sheet === 'peek') S.sheet = 'half'
    }
    render()
  }
  function scrollToCard(idx) {
    if (!panel) return
    var el = panel.querySelector('[data-rq-card="' + idx + '"]')
    if (el && scrollBox) scrollBox.scrollTop = el.getBoundingClientRect().top - scrollBox.getBoundingClientRect().top + scrollBox.scrollTop - 8
  }
  function onPanelClick(e) {
    var b = e.target.closest ? e.target.closest('button') : null
    if (!b || b.disabled) return
    if (b.hasAttribute('data-rq-close')) { setOpen(false); return }
    if (b.hasAttribute('data-rq-tip')) { S.tip = true; save(); render(); return }
    if (b.hasAttribute('data-rq-grab')) { S.sheet = { peek: 'half', half: 'full', full: 'peek' }[S.sheet] || 'half'; save(); render(); return }
    if (b.dataset.rqSheet) { S.sheet = b.dataset.rqSheet; save(); render(); return }
    if (b.dataset.rqNav) { S.cur[aid] = curIdx() + Number(b.dataset.rqNav); save(); render(); return }
    if (b.dataset.rqPara) { flashPara(Number(b.dataset.rqPara)); return }
    if (b.dataset.rqTog != null) {
      var q = qs[Number(b.dataset.rqTog)]; if (!q) return
      var k = b.dataset.k, t = Object.assign({}, tog(q))
      t[k] = !t[k]
      if (!t[k]) delete t[k]
      if (Object.keys(t).length) S.tog[qKey(q)] = t; else delete S.tog[qKey(q)]
      if (k === 'h' && t.h) { var p = parts(q); if (p.para) flashPara(p.para) }
      save(); render(); return
    }
    if (b.dataset.rqEvGo) { var ev = (S.ev[aid] || {})[b.dataset.rqEvGo]; if (ev) flashPara(Number(ev.i) + 1); return }
    if (b.dataset.rqEvDel) { if (S.ev[aid]) delete S.ev[aid][b.dataset.rqEvDel]; save(); render(); repaintEv(); return }
  }

  /* ---------- 工具栏按钮 ---------- */
  function ensureBtn() {
    var rail = document.querySelector('#reader-view .rp-rail')
    if (!rail) return
    if (btn && rail.contains(btn)) return
    btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'rp-rb rq-btn'
    btn.setAttribute('data-rq-toggle', '')
    btn.setAttribute('aria-label', '题目')
    btn.textContent = '题目'
    var note = rail.querySelector('[data-rd-notes]')
    rail.insertBefore(btn, note || null)
    btn.addEventListener('click', function () { setOpen(!isOpen()) })
  }

  /* ---------- 选区浮条：设为依据 ---------- */
  function ensureChipBtn() {
    var chip = document.querySelector('.anno-chip')
    if (!chip) return null
    var b = chip.querySelector('[data-rq-ev]')
    if (!b) {
      b = document.createElement('button')
      b.type = 'button'
      b.className = 'anno-chip-ev'
      b.setAttribute('data-rq-ev', '')
      b.textContent = '设为依据'
      chip.appendChild(b)
      b.addEventListener('click', function (e) { e.stopPropagation(); startPick() })
    }
    b.hidden = !(readerActive() && mode === 'free' && qs.length)
    return b
  }
  var pickFrom = null
  function startPick() {
    var p = W.TEM8_ANNO && W.TEM8_ANNO._pending ? W.TEM8_ANNO._pending() : null
    if (!p || p.id !== aid || !p.ranges || !p.ranges.length) return
    pickFrom = { ranges: p.ranges.map(function (r) { return { i: r.i, s: r.s, e: r.e } }), quote: p.quote, i: p.ranges[0].i }
    var chip = document.querySelector('.anno-chip'); if (chip) chip.hidden = true
    if (!picker) {
      picker = document.createElement('div')
      picker.className = 'rq-pick'
      document.body.appendChild(picker)
      picker.addEventListener('mousedown', function (e) { e.preventDefault() })
      picker.addEventListener('click', onPick)
    }
    var c = curIdx()
    picker.innerHTML = '<span>这句是哪道题的依据？</span><div class="rq-pick-qs">' + qs.map(function (q, i) {
      return '<button type="button" data-rq-pick="' + i + '"' + (i === c ? ' class="cur"' : '') + '>Q' + esc(q.number) + '</button>'
    }).join('') + '</div><button type="button" class="rq-pick-x" data-rq-pick-x>取消</button>'
    picker.hidden = false
  }
  function endPick() { if (picker) picker.hidden = true; pickFrom = null }
  function onPick(e) {
    var b = e.target.closest ? e.target.closest('button') : null
    if (!b) return
    if (b.hasAttribute('data-rq-pick-x')) { endPick(); return }
    if (b.dataset.rqPick == null || !pickFrom) return
    var idx = Number(b.dataset.rqPick), q = qs[idx]; if (!q) return
    ;(S.ev[aid] = S.ev[aid] || {})[q.number] = pickFrom
    S.cur[aid] = idx
    endPick()
    try { W.getSelection().removeAllRanges() } catch (err) {}
    if (W.TEM8_ANNO && W.TEM8_ANNO.toast) W.TEM8_ANNO.toast('已设为 Q' + q.number + ' 的依据')
    if (!S.open) S.open = true
    if (!wide() && S.sheet === 'peek') S.sheet = 'half'
    save(); render(); repaintEv()
    if (wide()) scrollToCard(idx)
  }

  /* ---------- 跟着阅读页 ---------- */
  function setArticle(id, m) {
    if (id !== aid) endPick()
    aid = id || ''; mode = m || ''
    qs = aid ? allQ().filter(function (q) { return q.articleId === aid }).sort(function (a, b) { return a.number - b.number }) : []
  }
  // 原文渲染之前就要知道是哪篇（依据下划线是画原文时一起画的），所以打开文章时先记下
  document.addEventListener('click', function (e) {
    var t = e.target.closest ? e.target.closest('[data-open-reader][data-article]') : null
    if (t) setArticle(String(t.dataset.article), t.dataset.mode === 'practice' ? 'practice' : 'free')
  }, true)
  document.addEventListener('tem8:reader-render', function (e) {
    var d = e.detail || {}, id = String(d.id || ''), changed = id !== aid || d.mode !== mode
    setArticle(id, d.mode)
    // 第一次渲染时还不知道是哪篇：补画一次依据
    if (changed && S.ev[aid]) setTimeout(repaintEv, 0)
    setTimeout(function () {
      ensureBtn(); ensureChipBtn()
      // 从笔记页“去这题”过来：打开题目栏并停在那道题
      if (want && want.aid === aid) {
        var i = qs.findIndex(function (q) { return String(q.number) === String(want.num) })
        if (i >= 0) S.cur[aid] = i
        S.open = true; if (!wide()) S.sheet = 'half'; save()
        var wi = i; want = null
        render(); if (wide() && wi >= 0) setTimeout(function () { scrollToCard(wi) }, 60)
        return
      }
      render()
    }, 40)
  })
  var want = null
  function openAt(id, num) {
    want = { aid: String(id), num: num }
    var tab = document.querySelector('.tabbar [data-tab="library"]'); if (tab) tab.click()
    var b = document.querySelector('[data-open-reader][data-mode="free"][data-article="' + String(id).replace(/"/g, '') + '"]')
    if (b) b.click()
    else if (W.TEM8_ANNO && W.TEM8_ANNO.jumpTo) W.TEM8_ANNO.jumpTo(String(id), -1)
  }
  document.addEventListener('tem8:view', function (e) {
    if (e.detail === 'reader') { setTimeout(function () { ensureBtn(); render() }, 60); return }
    endPick()
    document.body.classList.remove('rq-open', 'rq-sheet')
    if (panel) panel.hidden = true
    dropPane()
    dock()
  })
  document.addEventListener('tem8:theme', function () { if (qPane) qPane.redraw() })
  // 笔记抽屉打开时，题目栏让位（两个都停在右侧）
  function watchAnno() {
    var ap = document.querySelector('.anno-panel'); if (!ap || ap._rqWatch) return
    ap._rqWatch = true
    new MutationObserver(function () {
      if (!ap.hidden && S.open && available()) { S.open = false; save(); render() }
    }).observe(ap, { attributes: true, attributeFilter: ['hidden'] })
  }
  // 浮条每次弹出时决定显不显示「设为依据」
  document.addEventListener('selectionchange', ensureChipBtn)
  var lastWide = wide()
  W.addEventListener('resize', function () { if (wide() !== lastWide) { lastWide = wide(); render() } })
  function init() { watchAnno(); ensureChipBtn() }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(init, 0) })
  else setTimeout(init, 0)

  W.TEM8_RQ = { isOpen: isOpen, render: render, openAt: openAt }
})()
