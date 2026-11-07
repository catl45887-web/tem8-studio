/* 精读页「题目」：在原文旁边看题目和选项，只看不答
 *  - 右上角工具栏「题目」开关，默认关，打开后记住
 *  - 宽屏（≥1000px）停在右侧，和笔记抽屉共用这个位置，同时只开一个；窄屏是底部抽屉，三档：一行 / 半屏 / 全部
 *  - 每道题一个按钮，一步一步点开：提示（解析里的【定位】，并标出那一段）→ 看答案 → 看解析
 *  - 选中原文 → 底部浮条「设为依据」→ 选题号；依据句在原文下划线（CSS Highlight API），题卡里也显示
 *  - 「设为依据」的用法只在题目栏顶部提示一次
 * 记录存 localStorage['tem8_reader_q_v1'] = { open, sheet, tip, step:{[文章-题号]:n}, ev:{[文章]:{[题号]:{ranges,quote,i}}}, cur:{[文章]:下标} } */
;(function () {
  'use strict'
  var KEY = 'tem8_reader_q_v1'
  var W = window
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] }) }
  var LET = ['A', 'B', 'C', 'D', 'E', 'F']
  function $(id) { return document.getElementById(id) }
  function load() { try { return JSON.parse(localStorage.getItem(KEY) || 'null') || {} } catch (e) { return {} } }
  var S = load()
  S.step = S.step || {}; S.ev = S.ev || {}; S.cur = S.cur || {}
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
  function seqOf(q) {
    var p = parts(q), seq = []
    if (p.loc) seq.push('hint')
    if (ansText(q)) seq.push('ans')
    if (p.rest) seq.push('why')
    return seq
  }
  var LABEL = { hint: '提示', ans: '看答案', why: '看解析' }
  function qKey(q) { return aid + '-' + q.number }

  /* ---------- 原文：段落定位、依据下划线 ---------- */
  function paraEl(n) {
    var list = document.querySelectorAll('#reader-content [data-anno-p]')
    if (!list.length) return null
    var i = n === -1 ? list.length - 1 : n - 1
    return list[i] || null
  }
  var flashT = 0
  function flashPara(n) {
    var el = paraEl(n); if (!el) return
    document.querySelectorAll('.rq-flash').forEach(function (x) { x.classList.remove('rq-flash') })
    el.classList.add('rq-flash')
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    clearTimeout(flashT); flashT = setTimeout(function () { el.classList.remove('rq-flash') }, 2600)
  }
  function rangeIn(box, s, e) {
    var r = document.createRange(), acc = 0, started = false, done = false
    function walk(n) {
      if (done) return
      if (n.nodeType === 3) {
        var L = n.data.length
        if (!started && s <= acc + L) { r.setStart(n, Math.max(0, s - acc)); started = true }
        if (started && e <= acc + L) { r.setEnd(n, Math.max(0, e - acc)); done = true; return }
        acc += L; return
      }
      if (n.nodeName === 'BR') { acc += 1; return }
      for (var c = n.firstChild; c; c = c.nextSibling) { walk(c); if (done) return }
    }
    walk(box)
    return started && done ? r : null
  }
  function paintEv() {
    if (!W.CSS || !CSS.highlights || typeof W.Highlight !== 'function') return
    var h = new Highlight()
    var ev = S.ev[aid] || {}
    if (mode === 'free') {
      Object.keys(ev).forEach(function (num) {
        (ev[num].ranges || []).forEach(function (g) {
          var p = document.querySelector('#reader-content [data-anno-p="' + g.i + '"] .anno-text')
          if (!p) return
          try { var r = rangeIn(p, g.s, g.e); if (r) h.add(r) } catch (e) {}
        })
      })
    }
    CSS.highlights.set('rq-ev', h)
  }
  var paintT = 0
  function paintSoon() { clearTimeout(paintT); paintT = setTimeout(paintEv, 80) }

  /* ---------- 面板 ---------- */
  var panel = null, btn = null, picker = null
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
    document.body.appendChild(panel)
    panel.addEventListener('click', onPanelClick)
  }
  function optsHTML(q, show) {
    if (!isChoice(q)) {
      return show ? '<div class="rq-ref"><b>参考答案</b>' + esc(ansText(q)) + '</div>' : ''
    }
    return '<ol class="rq-opts">' + q.options.map(function (o, i) {
      var ok = show && i === q.answer
      return '<li class="' + (ok ? 'ok' : '') + '"><span class="rq-l">' + LET[i] + '.</span><span class="rq-o">' + esc(o) + '</span>' + (ok ? '<em>正确答案</em>' : '') + '</li>'
    }).join('') + '</ol>'
  }
  function cardHTML(q, idx) {
    var p = parts(q), seq = seqOf(q), k = Math.min(S.step[qKey(q)] || 0, seq.length)
    var shown = seq.slice(0, k)
    var showAns = shown.indexOf('ans') >= 0
    var ev = (S.ev[aid] || {})[q.number]
    var evHTML = ev ? '<div class="rq-ev"><div class="rq-ev-h"><span>我的依据 · 第 ' + (Number(ev.i) + 1) + ' 段</span><button type="button" data-rq-ev-go="' + q.number + '">看原文</button><button type="button" data-rq-ev-del="' + q.number + '">移除</button></div><p>' + esc(ev.quote) + '</p></div>' : ''
    var hint = shown.indexOf('hint') >= 0 ? '<div class="rq-box"><b>提示</b>' + esc(p.loc) + (p.para ? '<button type="button" class="rq-go" data-rq-para="' + p.para + '">' + (p.para === -1 ? '看末段' : '看第 ' + p.para + ' 段') + '</button>' : '') + '</div>' : ''
    var why = shown.indexOf('why') >= 0 ? '<div class="rq-box"><b>解析</b>' + esc(p.rest).replace(/\n/g, '<br>') + '</div>' : ''
    var label = !seq.length ? '' : k < seq.length ? LABEL[seq[k]] : '收起'
    return '<article class="rq-card" data-rq-card="' + idx + '">' +
      '<div class="rq-no"><b>Q' + esc(q.number) + '</b><span>' + (isChoice(q) ? '选择题' : '简答题') + '</span></div>' +
      '<p class="rq-stem">' + esc(q.prompt) + '</p>' +
      optsHTML(q, showAns) + evHTML + hint + why +
      (label ? '<button type="button" class="rq-step" data-rq-step="' + idx + '">' + label + '</button>' : '') +
      '</article>'
  }
  function tipHTML() {
    if (S.tip) return ''
    return '<div class="rq-tip"><span>小技巧：选中原文一句话，在底部浮条点「设为依据」，就能把它记成某道题的依据。</span><button type="button" data-rq-tip>知道了</button></div>'
  }
  function curIdx() { var c = Number(S.cur[aid]) || 0; return Math.max(0, Math.min(qs.length - 1, c)) }
  function render() {
    buildPanel()
    var on = isOpen()
    document.body.classList.toggle('rq-open', on)
    document.body.classList.toggle('rq-sheet', on && !wide())
    if (btn) { btn.hidden = !available(); btn.setAttribute('aria-pressed', String(on)) }
    if (!on) { panel.hidden = true; dock(); return }
    panel.hidden = false
    var sheet = !wide(), sm = sheet ? S.sheet : 'full'
    panel.className = 'rq-panel ' + (sheet ? 'rq-as-sheet rq-' + sm : 'rq-as-side')
    var head = '<header class="rq-head">' +
      (sheet ? '<button type="button" class="rq-grab" data-rq-grab aria-label="调整题目栏高度"><i></i></button>' : '') +
      '<b>题目</b><span class="rq-sub">' + qs.length + ' 题 · 只看不答</span>' +
      (sheet && sm === 'half' ? '<button type="button" class="rq-link" data-rq-sheet="full">全部</button>' : '') +
      (sheet && sm === 'full' ? '<button type="button" class="rq-link" data-rq-sheet="half">收起</button>' : '') +
      '<button type="button" class="rq-x" data-rq-close aria-label="关闭题目栏">×</button></header>'
    var body = ''
    var c = curIdx(), q = qs[c]
    if (sheet && sm === 'peek') {
      body = '<button type="button" class="rq-peek" data-rq-sheet="half"><b>Q' + esc(q.number) + '</b><span>' + esc(q.prompt) + '</span></button>'
    } else if (sheet && sm === 'half') {
      body = '<div class="rq-scroll">' + tipHTML() + cardHTML(q, c) + '</div>' +
        '<nav class="rq-nav"><button type="button" data-rq-nav="-1"' + (c === 0 ? ' disabled' : '') + '>上一题</button><span>' + (c + 1) + ' / ' + qs.length + '</span><button type="button" data-rq-nav="1"' + (c === qs.length - 1 ? ' disabled' : '') + '>下一题</button></nav>'
    } else {
      body = '<div class="rq-scroll">' + tipHTML() + qs.map(cardHTML).join('') + '</div>'
    }
    // 同一视图里重画时保留滚动位置；半屏换了一道题就回到顶部
    var view = (sheet ? sm : 'side') + '|' + aid + '|' + (sm === 'half' ? c : '')
    var keep = panel.querySelector('.rq-scroll'), top = keep && view === lastView ? keep.scrollTop : 0
    lastView = view
    panel.innerHTML = head + body
    var sc = panel.querySelector('.rq-scroll'); if (sc) sc.scrollTop = top
    dock()
  }
  var lastView = ''
  function dock() { if (W.TEM8_RP && W.TEM8_RP.dock) W.TEM8_RP.dock() }

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
    var el = panel.querySelector('[data-rq-card="' + idx + '"]'), sc = panel.querySelector('.rq-scroll')
    if (el && sc) sc.scrollTop = el.offsetTop - 8
  }
  function onPanelClick(e) {
    var b = e.target.closest ? e.target.closest('button') : null
    if (!b) return
    if (b.hasAttribute('data-rq-close')) { setOpen(false); return }
    if (b.hasAttribute('data-rq-tip')) { S.tip = true; save(); render(); return }
    if (b.hasAttribute('data-rq-grab')) { S.sheet = { peek: 'half', half: 'full', full: 'peek' }[S.sheet] || 'half'; save(); render(); return }
    if (b.dataset.rqSheet) { S.sheet = b.dataset.rqSheet; save(); render(); return }
    if (b.dataset.rqNav) { S.cur[aid] = curIdx() + Number(b.dataset.rqNav); save(); render(); var s = panel.querySelector('.rq-scroll'); if (s) s.scrollTop = 0; return }
    if (b.dataset.rqPara) { flashPara(Number(b.dataset.rqPara)); return }
    if (b.dataset.rqStep) {
      var idx = Number(b.dataset.rqStep), q = qs[idx]; if (!q) return
      var seq = seqOf(q), k = Math.min(S.step[qKey(q)] || 0, seq.length)
      if (k < seq.length) {
        if (seq[k] === 'hint') { var p = parts(q); if (p.para) flashPara(p.para) }
        S.step[qKey(q)] = k + 1
      } else delete S.step[qKey(q)]
      save(); render(); return
    }
    if (b.dataset.rqEvGo) { var ev = (S.ev[aid] || {})[b.dataset.rqEvGo]; if (ev) flashPara(Number(ev.i) + 1); return }
    if (b.dataset.rqEvDel) { if (S.ev[aid]) delete S.ev[aid][b.dataset.rqEvDel]; save(); render(); paintEv(); return }
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
    save(); render(); paintEv()
    if (wide()) scrollToCard(idx)
  }

  /* ---------- 跟着阅读页 ---------- */
  function setArticle(id, m) {
    if (id !== aid) { endPick() }
    aid = id || ''; mode = m || ''
    qs = aid ? allQ().filter(function (q) { return q.articleId === aid }).sort(function (a, b) { return a.number - b.number }) : []
  }
  document.addEventListener('tem8:reader-render', function (e) {
    var d = e.detail || {}
    setArticle(String(d.id || ''), d.mode)
    setTimeout(function () { ensureBtn(); ensureChipBtn(); render(); paintEv() }, 40)
  })
  document.addEventListener('tem8:view', function (e) {
    if (e.detail === 'reader') { setTimeout(function () { ensureBtn(); render() }, 60); return }
    endPick()
    document.body.classList.remove('rq-open', 'rq-sheet')
    if (panel) panel.hidden = true
    dock()
  })
  // 笔记抽屉打开时，题目栏让位（两个都停在右侧）
  function watchAnno() {
    var ap = document.querySelector('.anno-panel'); if (!ap || ap._rqWatch) return
    ap._rqWatch = true
    new MutationObserver(function () {
      if (!ap.hidden && S.open && available()) { S.open = false; save(); render() }
    }).observe(ap, { attributes: true, attributeFilter: ['hidden'] })
  }
  // 原文重画（换字号、加标记）后重新画依据下划线
  function watchContent() {
    var c = $('reader-content'); if (!c || c._rqWatch) return
    c._rqWatch = true
    new MutationObserver(paintSoon).observe(c, { childList: true, subtree: true })
  }
  // 浮条每次弹出时决定显不显示「设为依据」
  document.addEventListener('selectionchange', ensureChipBtn)
  var lastWide = wide()
  W.addEventListener('resize', function () { if (wide() !== lastWide) { lastWide = wide(); render() } })
  function init() { watchAnno(); watchContent(); ensureChipBtn() }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(init, 0) })
  else setTimeout(init, 0)

  W.TEM8_RQ = { isOpen: isOpen, render: render }
})()
