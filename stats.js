/* 拾页 · 学习统计（我的 → 学习统计）
   - 学习时长：页面在前台、最近 2 分钟内有操作才计时（听力、模考页放宽到 10 分钟），按模块记在 tem8_time_v1
   - 做题：读 tem8_workflow_v2 的交卷记录；背词：读听写页的记录（TEM8_DICTATION）
   - 范围：日 / 周 / 月 / 备考以来 */
(function () {
  'use strict'
  var KEY = 'tem8_time_v1', TICK = 15
  var $ = function (id) { return document.getElementById(id) }
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] }) }
  function pad(n) { return ('0' + n).slice(-2) }
  function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) }
  function day0(d) { d = new Date(d); d.setHours(0, 0, 0, 0); return d }
  function addDays(d, n) { d = new Date(d); d.setDate(d.getDate() + n); return d }
  function readJSON(k, d) { try { return JSON.parse(localStorage.getItem(k) || 'null') || d } catch (e) { return d } }

  // ---------- 计时 ----------
  var MOD = { library: 'read', reader: 'read', papers: 'practice', 'workflow-config': 'practice', 'workflow-session': 'practice', 'workflow-report': 'practice',
    mock: 'mock', exam: 'mock', 'paper-archive': 'mock', result: 'mock', intensive: 'listen', dictation: 'word', 'dictation-session': 'word' }
  var LONG = { listen: 1, mock: 1 }
  var NAME = { read: '精读', practice: '题型练习', mock: '模考', listen: '精听', word: '单词' }
  var lastAct = Date.now()
  ;['pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll'].forEach(function (ev) { addEventListener(ev, function () { lastAct = Date.now() }, { passive: true, capture: true }) })
  function curMod() { var v = document.querySelector('.view.active'); return v ? MOD[v.id.replace(/-view$/, '')] : '' }
  function tick() {
    if (document.visibilityState !== 'visible') return
    var m = curMod(); if (!m) return
    if (Date.now() - lastAct > (LONG[m] ? 600000 : 120000)) return
    var t = readJSON(KEY, {}), k = ymd(new Date()), o = t[k] || (t[k] = {})
    o[m] = (o[m] || 0) + TICK
    var keys = Object.keys(t).sort(); while (keys.length > 800) delete t[keys.shift()]
    try { localStorage.setItem(KEY, JSON.stringify(t)) } catch (e) {}
  }
  setInterval(tick, TICK * 1000)

  // ---------- 取数 ----------
  var R = { range: 'week', off: 0 }
  function rangeOf() {
    var now = day0(new Date()), a, b, label
    if (R.range === 'day') { a = addDays(now, R.off); b = addDays(a, 1); label = R.off === 0 ? '今天 · ' + (a.getMonth() + 1) + '月' + a.getDate() + '日' : R.off === -1 ? '昨天 · ' + (a.getMonth() + 1) + '月' + a.getDate() + '日' : (a.getMonth() + 1) + '月' + a.getDate() + '日' }
    else if (R.range === 'week') { var w = (now.getDay() + 6) % 7; a = addDays(now, -w + R.off * 7); b = addDays(a, 7); var e = addDays(b, -1); label = (R.off === 0 ? '本周 · ' : R.off === -1 ? '上周 · ' : '') + (a.getMonth() + 1) + '.' + a.getDate() + ' – ' + (e.getMonth() + 1) + '.' + e.getDate() }
    else if (R.range === 'month') { a = new Date(now.getFullYear(), now.getMonth() + R.off, 1); b = new Date(a.getFullYear(), a.getMonth() + 1, 1); label = a.getFullYear() + '年' + (a.getMonth() + 1) + '月' }
    else { a = startDay(); b = addDays(now, 1); label = (a.getMonth() + 1) + '月' + a.getDate() + '日开始备考' }
    return { a: a, b: b, label: label }
  }
  // 备考从哪天算：最早的学习记录
  function startDay() {
    var c = [], t = readJSON(KEY, {}), days = readJSON('tem8_days', []), D = window.TEM8_DICTATION
    Object.keys(t).forEach(function (k) { c.push(k) })
    if (Array.isArray(days)) days.forEach(function (k) { c.push(k) })
    if (D) Object.keys(D.log()).forEach(function (k) { c.push(k) })
    var h = runs(); if (h.length) c.push(ymd(new Date(h[0].finishedAt)))
    c.sort()
    if (!c.length) return day0(new Date())
    var p = c[0].split('-'); return new Date(+p[0], p[1] - 1, +p[2])
  }
  function runs() {
    var W = window.TEM8_WORKFLOW, h = W && W.history ? W.history() : (readJSON('tem8_workflow_v2', {}).history || [])
    return h.filter(function (r) { return r && r.finishedAt && Array.isArray(r.groups) }).sort(function (x, y) { return x.finishedAt - y.finishedAt })
  }
  function eachDay(a, b, fn) { for (var d = new Date(a); d < b; d = addDays(d, 1)) fn(ymd(d), d) }
  function collect(a, b) {
    var t = readJSON(KEY, {}), D = window.TEM8_DICTATION, log = D ? D.log() : {}, W = window.TEM8_WORKFLOW
    var out = { sec: 0, mods: {}, perDay: {}, nw: 0, rv: 0, n: 0, ok: 0, g: 0, kinds: {}, runs: [], words: [], days: 0 }
    eachDay(a, b, function (k) {
      var o = t[k] || {}, s = 0
      for (var m in o) { s += o[m]; out.mods[m] = (out.mods[m] || 0) + o[m] }
      out.perDay[k] = s; out.sec += s
      var l = log[k]; if (l) { out.nw += l.nw || 0; out.rv += l.rv || 0; (l.ev || []).forEach(function (e) { out.words.push(e) }) }
      if (s >= 60 || (l && (l.nw || l.rv))) out.days++
    })
    runs().forEach(function (r) {
      if (r.finishedAt < a.getTime() || r.finishedAt >= b.getTime()) return
      var x = W && W.runBreakdown ? W.runBreakdown(r) : { n: 0, ok: 0, g: 0, kinds: {} }
      out.n += x.n; out.ok += x.ok; out.g += x.g; out.runs.push({ r: r, x: x })
      for (var k in x.kinds) { var o = out.kinds[k] || (out.kinds[k] = { ok: 0, n: 0 }); o.ok += x.kinds[k].ok; o.n += x.kinds[k].n }
      var dk = ymd(new Date(r.finishedAt)); if (!out.perDay[dk] && r.elapsed) out.perDay[dk] = 0
    })
    return out
  }
  function fmtDur(sec) {
    var m = Math.round(sec / 60)
    if (m < 60) return [String(m), '分钟']
    var h = sec / 3600
    return [h >= 10 ? String(Math.round(h)) : h.toFixed(1).replace(/\.0$/, ''), '小时']
  }
  function fmtMin(sec) { var f = fmtDur(sec); return f[0] + ' ' + f[1] }

  // ---------- 画 ----------
  var KIND = [['lang', '改错'], ['read', '阅读'], ['lecture', '听力 · 讲座'], ['interview', '听力 · 访谈']]
  var RUN_NAME = { reading: '阅读', lecture: '听力讲座', interview: '听力访谈', language: '改错', translation: '翻译', writing: '写作', mock: '模考' }
  function runTitle(r) {
    if (r.label) return r.label
    var kinds = []; r.groups.forEach(function (g) { var n = RUN_NAME[g.kind] || g.kind; if (kinds.indexOf(n) < 0) kinds.push(n) })
    return (r.year ? r.year + ' ' : '') + kinds.slice(0, 2).join('、')
  }
  function render() {
    var el = $('stats-content'); if (!el) return
    var D = window.TEM8_DICTATION
    if (D && D.ready && !render.waited) { render.waited = 1; D.ready().then(render, render) }
    var rg = rangeOf(), c = collect(rg.a, rg.b)
    var head = '<div class="stx-range" role="tablist">' + [['day', '日'], ['week', '周'], ['month', '月'], ['all', '备考以来']].map(function (x) { return '<button type="button" role="tab" data-stx-range="' + x[0] + '" class="' + (R.range === x[0] ? 'on' : '') + '" aria-selected="' + (R.range === x[0]) + '">' + x[1] + '</button>' }).join('') + '</div>' +
      (R.range === 'all' ? '<div class="stx-period"><span>' + esc(rg.label) + '</span></div>'
        : '<div class="stx-period"><button type="button" data-stx-off="-1" aria-label="上一段">‹</button><span>' + esc(rg.label) + '</span><button type="button" data-stx-off="1" aria-label="下一段"' + (R.off >= 0 ? ' disabled' : '') + '>›</button></div>')
    var empty = !c.sec && !c.n && !c.nw && !c.rv
    if (empty) { el.innerHTML = head + '<p class="stx-empty">' + { day: '这天还没开始', week: '这周还没开始', month: '这个月还没开始', all: '还没有学习记录' }[R.range] + '</p>'; return }
    // 和上一段比
    var cmp = ''
    if (R.range === 'day' || R.range === 'week') {
      var span = R.range === 'day' ? 1 : 7, p = collect(addDays(rg.a, -span), rg.a), diff = Math.round((c.sec - p.sec) / 60), word = R.range === 'day' ? '昨天' : '上周'
      if (R.off !== 0) word = R.range === 'day' ? '前一天' : '前一周'
      cmp = diff === 0 ? '和' + word + '一样' : '比' + word + (diff > 0 ? '多 ' : '少 ') + fmtMin(Math.abs(diff) * 60)
    } else cmp = '学了 ' + c.days + ' 天'
    var d = fmtDur(c.sec)
    var big = '<div class="stx-big">' +
      '<div><small>学习时长</small><b>' + d[0] + '<i>' + d[1] + '</i></b><em>' + cmp + '</em></div>' +
      '<div><small>做题</small><b>' + c.n + '<i>题</i></b><em>' + (c.g ? '正确率 ' + Math.round(c.ok / c.g * 100) + '%' : '没有可判分的题') + '</em></div>' +
      '<div><small>背词</small><b>' + (c.nw + c.rv) + '<i>个</i></b><em>新词 ' + c.nw + ' · 复习 ' + c.rv + '</em></div></div>'
    var chart = ''
    if (R.range === 'day') {
      var ev = []
      c.runs.forEach(function (x) { ev.push({ t: x.r.finishedAt, s: '题型练习 · ' + runTitle(x.r), e: x.x.g ? x.x.ok + ' / ' + x.x.g + ' 对' : x.x.n + ' 题' }) })
      c.words.forEach(function (w) { ev.push({ t: w.t, s: '背单词' + (w.nw ? ' · 新词 ' + w.nw : '') + (w.rv ? ' · 复习 ' + w.rv : ''), e: w.m + ' 分钟' }) })
      ev.sort(function (x, y) { return x.t - y.t })
      chart = '<section class="stx-panel"><h3>这天做了什么</h3>' + (ev.length ? '<ul class="stx-log">' + ev.map(function (x) { var dt = new Date(x.t); return '<li><time>' + pad(dt.getHours()) + ':' + pad(dt.getMinutes()) + '</time><span>' + esc(x.s) + '</span><em>' + esc(x.e) + '</em></li>' }).join('') + '</ul>' : '<p class="stx-none">只有阅读、精听这类计时记录，具体见下面的时间分布。</p>') + '</section>'
    } else if (R.range === 'week') {
      var keys = Object.keys(c.perDay), mx = Math.max.apply(null, keys.map(function (k) { return c.perDay[k] }).concat([1800])), todayK = ymd(new Date())
      chart = '<section class="stx-panel"><h3>每天学习时长<small>分钟</small></h3><div class="stx-bars">' + keys.map(function (k, i) {
        var v = c.perDay[k] || 0, m = Math.round(v / 60)
        return '<div class="stx-bar' + (k === todayK ? ' cur' : '') + '"><b>' + (m || '') + '</b><i style="height:' + (v / mx * 100) + '%"></i><span>' + (k === todayK ? '今天' : '周' + '一二三四五六日'[i]) + '</span></div>'
      }).join('') + '</div></section>'
    } else if (R.range === 'month') {
      var first = rg.a, lead = (first.getDay() + 6) % 7, cells = '一二三四五六日'.split('').map(function (x) { return '<span class="h">' + x + '</span>' }).join('')
      for (var i = 0; i < lead; i++) cells += '<span class="pad"></span>'
      var tk = ymd(new Date())
      eachDay(rg.a, rg.b, function (k, dt) {
        var v = c.perDay[k] || 0, lv = !v ? 0 : v < 900 ? 1 : v < 1800 ? 2 : v < 3600 ? 3 : 4
        cells += '<span class="l' + lv + (k === tk ? ' today' : '') + (k > tk ? ' fut' : '') + '" title="' + (v ? fmtMin(v) : '') + '">' + dt.getDate() + '</span>'
      })
      chart = '<section class="stx-panel"><h3>每天学了多久</h3><div class="stx-cal">' + cells + '</div><div class="stx-key">少<i class="l0"></i><i class="l1"></i><i class="l2"></i><i class="l3"></i><i class="l4"></i>多</div></section>'
    } else {
      var weeks = [], ws = addDays(rg.a, -((rg.a.getDay() + 6) % 7))
      for (var w = ws; w < rg.b; w = addDays(w, 7)) { var s = 0; eachDay(w, addDays(w, 7), function (k) { s += c.perDay[k] || 0 }); weeks.push(s) }
      weeks = weeks.slice(-26)
      var wm = Math.max.apply(null, weeks.concat([3600])), step = Math.ceil(weeks.length / 7)
      chart = '<section class="stx-panel"><h3>每周学习时长<small>小时' + (weeks.length >= 26 ? ' · 最近 26 周' : '') + '</small></h3><div class="stx-bars many">' + weeks.map(function (v, i) {
        var last = i === weeks.length - 1, h = v / 3600
        return '<div class="stx-bar' + (last ? ' cur' : '') + '"><b>' + (h >= 0.1 ? (h >= 10 ? Math.round(h) : h.toFixed(1).replace(/\.0$/, '')) : '') + '</b><i style="height:' + (v / wm * 100) + '%"></i><span>' + (last ? '本周' : (weeks.length - 1 - i) % step === 0 ? (weeks.length - 1 - i) + ' 周前' : '') + '</span></div>'
      }).join('') + '</div></section>'
    }
    var mods = Object.keys(c.mods).filter(function (m) { return NAME[m] && c.mods[m] >= 60 }).sort(function (x, y) { return c.mods[y] - c.mods[x] })
    var timeP = '<section class="stx-panel"><h3>时间花在哪</h3>' + (mods.length ? mods.map(function (m) {
      return '<div class="stx-row"><span>' + NAME[m] + '</span><span class="tr"><i style="width:' + (c.mods[m] / c.mods[mods[0]] * 100) + '%"></i></span><em>' + fmtMin(c.mods[m]) + '</em></div>'
    }).join('') : '<p class="stx-none">还没有计时记录。页面开着、有操作时才计时。</p>') + '</section>'
    var wordP = ''
    if (D && D.mastery) {
      var ms = D.mastery(), tot = ms.m + ms.l + ms.e + ms.n
      if (tot && !(ms.m + ms.l + ms.e)) wordP = '<section class="stx-panel"><h3>单词</h3><p class="stx-none">还没开始背。在首页「听写」里点「开始」。</p></section>'
      else if (tot) wordP = '<section class="stx-panel"><h3>单词<small>全部词书累计</small></h3>' +
        '<div class="stx-stack"><i class="m" style="flex:' + ms.m + '"></i><i class="l" style="flex:' + ms.l + '"></i><i class="e" style="flex:' + ms.e + '"></i><i class="n" style="flex:' + ms.n + '"></i></div>' +
        '<div class="stx-stack-k"><div><b>' + ms.m + '</b>已掌握</div><div><b>' + ms.l + '</b>学习中</div><div class="e"><b>' + ms.e + '</b>易错</div><div><b>' + ms.n + '</b>未学</div></div>' +
        (ms.e ? '<button type="button" class="stx-go" data-stx-hard>背易错的 ' + ms.e + ' 个<i aria-hidden="true">›</i></button>' : '') + '</section>'
    }
    var acc = KIND.filter(function (k) { return c.kinds[k[0]] && c.kinds[k[0]].n }).map(function (k) { var o = c.kinds[k[0]]; return [k[1], Math.round(o.ok / o.n * 100), o.n] })
    var weak = acc.length > 1 ? acc.reduce(function (x, y) { return y[1] < x[1] ? y : x }) : null
    var accP = '<section class="stx-panel"><h3>各题型正确率</h3>' + (acc.length ? acc.map(function (a) {
      return '<div class="stx-row' + (a === weak ? ' weak' : '') + '"><span>' + a[0] + '</span><span class="tr"><i style="width:' + a[1] + '%"></i></span><em>' + a[1] + '%</em></div>'
    }).join('') + (weak ? '<p class="stx-foot">最弱的是' + weak[0] + '，单独标了颜色。</p>' : '') : '<p class="stx-none">这段时间没有可判分的题。</p>') + '</section>'
    el.innerHTML = head + big + '<div class="stx-cols"><div>' + chart + timeP + '</div><div>' + wordP + accP + '</div></div>' +
      '<p class="stx-foot">学习时长只算页面开着、最近有操作的时间，切到别的应用就暂停。</p>'
  }
  document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('button'); if (!t) return
    if (t.dataset.stxRange) { R.range = t.dataset.stxRange; R.off = 0; render(); return }
    if (t.dataset.stxOff) { R.off = Math.min(0, R.off + Number(t.dataset.stxOff)); render(); return }
    if (t.hasAttribute('data-stx-hard') && window.TEM8_DICTATION) { window.TEM8_DICTATION.startHard(); return }
  })
  document.addEventListener('tem8:view', function (e) { if (e.detail === 'stats') { render.waited = 0; render() } })
  if ($('stats-view') && $('stats-view').classList.contains('active')) render()
  window.TEM8_STATS = { render: render }
})();
