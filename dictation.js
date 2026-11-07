/* 拾页 · 听写与背诵
   词书来自 wordbooks.js（window.TEM8_WORDBOOKS），发音路径在 audiomap.js，真题原句在 zhenti.js，都是进听写页才加载。
   - 首页「听写」分段：「在背」哪本词书 + 今天复习 / 新词 + 开始；下面是全部词书，点开按组「背诵」或「听写」
   - 生词本（做题、阅读时加入的词）也算一本词书，释义取自词典
   - 背诵：新词当天过三关（看词选义 → 看中文选词 → 拼写），和到期的复习词穿插；复习词自评 不认识 / 模糊 / 认识
   - 听写：先弹「听写设置」选方式——逐个拼写 / 纸笔连播 / 词表（中文词表写英文、英文词表写释义、听音词表整组连播）
     形近词逐个拼写时是听音选词；固定搭配是看中文补关键词。首页和背完的结束页可以直接听写今天背的词
   - 每组开始前先把整组音频下载好；下载失败的词用浏览器朗读
   记录单独存在 tem8_dict_v1，不动原来的学习记录。 */
(function () {
  'use strict'
  var BOOKS = []
  var KEY = 'tem8_dict_v1'
  var $ = function (id) { return document.getElementById(id) }
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] }) }
  var DAY = 864e5, INT = [1, 2, 4, 7, 15, 30]

  // ---------- 记录 ----------
  var st = load()
  function load() {
    var d = {}
    try { d = JSON.parse(localStorage.getItem(KEY) || '{}') || {} } catch (e) {}
    d.size = d.size === 20 || d.size === 40 ? 20 : 10
    d.book = d.book || 'core'; d.log = d.log || {}
    d.accent = d.accent === 'us' ? 'us' : 'uk'
    d.dmode = d.dmode === 'paper' ? 'paper' : 'type'
    // 听写设置：方式 dtype（type 逐个拼写 / paper 纸笔连播 / table 词表），词表 tbl（cn / en / ear），播放次数 times，自动下一个 auto，打乱顺序 shuf
    d.dtype = ['type', 'paper', 'table'].indexOf(d.dtype) >= 0 ? d.dtype : d.dmode
    d.tbl = ['cn', 'en', 'ear'].indexOf(d.tbl) >= 0 ? d.tbl : 'cn'
    d.times = [1, 2, 3].indexOf(d.times) >= 0 ? d.times : 2
    d.auto = d.auto !== false; d.shuf = !!d.shuf
    d.srs = d.srs || {}; d.wrong = d.wrong || []; d.groups = d.groups || {}
    // 已经删掉的词书（高频 700）留下的记录一并清掉
    for (var k in d.srs) if (k.indexOf('h700|') === 0) delete d.srs[k]
    d.wrong = d.wrong.filter(function (k) { return k.indexOf('h700|') !== 0 })
    for (var g in d.groups) if (g.indexOf('h700:') === 0) delete d.groups[g]
    return d
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(st)) } catch (e) {} }
  function today() { var d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime() }

  // ---------- 词书整理成组 ----------
  function book(id) { if (id === 'mine') return mineBook(); for (var i = 0; i < BOOKS.length; i++) if (BOOKS[i].id === id) return BOOKS[i]; return null }
  // 生词本：做题、阅读时加入的词，释义和音标从词典取
  var MINE = null, mineSig = ''
  function mineWords() { try { var w = JSON.parse(localStorage.getItem('tem8_studio_web_v1') || '{}').wordbook; return Array.isArray(w) ? w : [] } catch (e) { return [] } }
  function mineBook() {
    var words = mineWords(), D = window.TEM8_DICT, sig = words.join('|') + (D ? 1 : 0)
    if (MINE && sig === mineSig) return MINE
    mineSig = sig
    var items = words.map(function (w) {
      var e = D && D.entry ? D.entry(w) : { word: w }, raw = D && D.raw ? D.raw(w) : null, ex = raw && raw.examples && raw.examples[0]
      return [w, e.phon || '', ((e.pos ? e.pos + ' ' : '') + (e.cn || '')).trim() || '（词典暂未收录）', ex ? ex.en : '', ex ? ex.cn || '' : '']
    })
    MINE = { id: 'mine', name: '生词本', kind: 'word', units: [{ name: '', sub: '', items: items }] }
    return MINE
  }
  function allBooks() { return (mineWords().length ? [mineBook()] : []).concat(BOOKS) }
  // 搭配、形近词索引：详情页用
  var PHR = {}, FORM = {}
  function buildIndex() {
    BOOKS.forEach(function (b) {
      b.units.forEach(function (u) { u.items.forEach(function (it) {
        if (b.kind === 'phrase') String(it[0]).toLowerCase().split(/[\s\/]+/).forEach(function (w) { w = w.replace(/[^a-z-]/g, ''); if (w.length > 3 && !/^(with|from|into|upon|over|that|than|this|what|something|somebody|oneself)$/.test(w)) (PHR[w] || (PHR[w] = [])).push([it[0], it[1]]) })
        if (b.kind === 'confuse') it.forEach(function (x) { FORM[String(x[0]).toLowerCase()] = it.filter(function (y) { return y[0] !== x[0] }) })
      }) })
    })
  }
  // 统一成卡片：{b 词书, k 类型, w 词/搭配, p 音标, m 释义, ex 例句, exc 例句译文, sib 同组形近词}
  function cardsOf(b, items) {
    var out = []
    items.forEach(function (it) {
      if (b.kind === 'confuse') {
        it.forEach(function (x) { out.push({ b: b.id, k: 'confuse', w: x[0], p: x[1], m: x[2], ex: x[3], exc: x[4], sib: it }) })
      } else if (b.kind === 'phrase') out.push({ b: b.id, k: 'phrase', w: it[0], p: '', m: it[1] })
      else out.push({ b: b.id, k: 'word', w: it[0], p: it[1], m: it[2], ex: it[3] || '', exc: it[4] || '' })
    })
    return out
  }
  function chunk(arr, n) {
    var out = []
    for (var i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n))
    // 最后剩得太少就并进上一组
    if (out.length > 1 && out[out.length - 1].length < n / 2) { var last = out.pop(); out[out.length - 1] = out[out.length - 1].concat(last) }
    return out
  }
  // 返回 [{name, sub, groups:[{id, items}]}]
  function sections(b) {
    var n = st.size, per = b.kind === 'confuse' ? Math.max(1, Math.round(n / 2)) : n
    var units = b.units
    return units.map(function (u, ui) {
      return { name: u.name, sub: u.rule || u.sub || '', groups: chunk(u.items, per).map(function (g, gi) { return { id: b.id + ':' + n + ':' + ui + ':' + gi, items: g } }) }
    })
  }
  function countOf(b) { return b.units.reduce(function (a, u) { return a + (b.kind === 'confuse' ? u.items.reduce(function (s, g) { return s + g.length }, 0) : u.items.length) }, 0) }
  function keyOf(c) { return c.b + '|' + c.w }
  function learnedIn(b) { var p = b.id + '|', n = 0; for (var k in st.srs) if (k.indexOf(p) === 0 && st.srs[k].seen) n++; return n }
  function findCard(key) {
    var i = key.indexOf('|'), b = book(key.slice(0, i)), w = key.slice(i + 1)
    if (!b) return null
    for (var u = 0; u < b.units.length; u++) {
      var cs = cardsOf(b, b.units[u].items)
      for (var j = 0; j < cs.length; j++) if (cs[j].w === w) return cs[j]
    }
    return null
  }
  // 到期的词：原定间隔短、拖得久的排前面（最容易忘）
  function dueKeys() {
    var t = today(), out = []
    for (var k in st.srs) { var r = st.srs[k]; if (r.seen && r.due <= t && book(k.slice(0, k.indexOf('|')))) out.push(k) }
    function risk(k) { var r = st.srs[k], ivl = Math.max(1, (r.due - (r.last || r.due - DAY)) / DAY); return (t - (r.last || r.due - DAY)) / DAY / ivl }
    return out.sort(function (a, b) { return risk(b) - risk(a) })
  }

  // 词书和发音表有几百 KB，进到听写页才去取
  var dataP = null
  function loadScript(src) { return new Promise(function (res, rej) { var s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s) }) }
  function ensureData() {
    if (!dataP) {
      var v = (document.querySelector('script[src*="dictation.js"]') || {}).src || '', q = v.indexOf('?') >= 0 ? v.slice(v.indexOf('?')) : ''
      dataP = Promise.all([window.TEM8_WORDBOOKS ? 0 : loadScript('wordbooks.js' + q), window.TEM8_AUDIOMAP ? 0 : loadScript('audiomap.js' + q), window.TEM8_ZHENTI ? 0 : loadScript('zhenti.js' + q).catch(function () {})])
        .then(function () { BOOKS = window.TEM8_WORDBOOKS || []; buildIndex() }, function () { dataP = null; throw new Error('load') })
        .then(function () { var w = mineWords(), D = window.TEM8_DICT; if (w.length && D && D.needs && D.needs(w)) return D.ensure(w).then(function () { MINE = null }, function () {}) })
    }
    return dataP
  }

  // ---------- 发音 ----------
  // 音频先整组下载成 blob，播放时不再等网络
  var blobs = {}, pending = {}
  function srcOf(w) { var m = (window.TEM8_AUDIOMAP || {})[w]; return m ? m[st.accent === 'us' ? 1 : 0] : '' }
  function fetchAudio(src) {
    if (blobs[src]) return Promise.resolve(true)
    if (pending[src]) return pending[src]
    var ctl = window.AbortController ? new AbortController() : null, timer = setTimeout(function () { if (ctl) ctl.abort() }, 15000)
    pending[src] = fetch(src, ctl ? { signal: ctl.signal } : {}).then(function (r) { if (!r.ok) throw 0; return r.blob() })
      .then(function (b) { blobs[src] = URL.createObjectURL(b); return true }, function () { return false })
      .then(function (ok) { clearTimeout(timer); delete pending[src]; return ok })
    return pending[src]
  }
  // 一次最多同时下 6 个，onStep 每完成一个回调一次
  function preload(cards, onStep) {
    var list = [], seen = {}
    cards.forEach(function (c) { var s = srcOf(c.w); if (s && !seen[s]) { seen[s] = 1; list.push(s) } })
    var i = 0, done = 0, failed = 0
    return new Promise(function (res) {
      if (!list.length) return res({ total: 0, failed: 0 })
      function next() {
        if (i >= list.length) return
        fetchAudio(list[i++]).then(function (ok) {
          done++; if (!ok) failed++
          onStep && onStep(done, list.length)
          if (done === list.length) res({ total: list.length, failed: failed }); else next()
        })
      }
      for (var k = 0; k < 6; k++) next()
    })
  }
  var audio = null
  // iOS 只允许在点按里第一次出声：开始一组时用同一个 audio 元素先放一段静音，之后自动发音才不会被拦
  var SILENT = 'data:audio/mpeg;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjYwLjE2LjEwMAAAAAAAAAAAAAAA//OEwAAAAAAAAAAAAEluZm8AAAAPAAAABQAAAqAAbW1tbW1tbW1tbW1tbW1tbW1tbZKSkpKSkpKSkpKSkpKSkpKSkpKStra2tra2tra2tra2tra2tra2trbb29vb29vb29vb29vb29vb29vb2///////////////////////////AAAAAExhdmM2MC4zMQAAAAAAAAAAAAAAACQEUAAAAAAAAAKgvT9A1gAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA//NExAAAAANIAAAAAExBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVTEFNRTMu//NExFMAAANIAAAAADEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVTEFNRTMu//NExKYAAANIAAAAADEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//NExKwAAANIAAAAAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//NExKwAAANIAAAAAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV'
  function unlock() {
    try { audio = audio || new Audio(); audio.src = SILENT; var p = audio.play(); if (p && p.catch) p.catch(function () {}) } catch (e) {}
    try { if ('speechSynthesis' in window) speechSynthesis.speak(new SpeechSynthesisUtterance('')) } catch (e) {}
  }
  var sayTok = 0
  function stop() { sayTok++; try { if (audio) audio.pause() } catch (e) {} ; try { speechSynthesis.cancel() } catch (e) {} }
  // 按设置读 N 遍，中间停一下；换词或停止时作废
  function sayN(w, n) {
    n = n || st.times || 1
    var tok = ++sayTok, k = 0
    ;(function one() { if (tok !== sayTok) return; var t0 = sayTok; say(w).then(function () { if (sayTok === t0 && ++k < n) setTimeout(one, 900) }) })()
  }
  function tts(text, slow) {
    if (!('speechSynthesis' in window)) return
    var u = new SpeechSynthesisUtterance(text)
    u.lang = st.accent === 'us' ? 'en-US' : 'en-GB'; u.rate = slow ? 0.6 : 0.85
    speechSynthesis.speak(u)
  }
  // 返回 Promise，放完（或失败）时结束；真人录音不存在就换成朗读
  function say(w, slow) {
    stop()
    var text = String(w).replace(/\.{2,}|…+/g, ' ').replace(/\bsb'?s?\b|\bsth\b/g, ' ').replace(/\s+/g, ' ').trim()
    return new Promise(function (done) {
      var src = srcOf(w)
      var play = function (src) {
        audio = audio || new Audio()
        audio.src = blobs[src] || src; audio.playbackRate = slow ? 0.7 : 1
        audio.onended = function () { done() }
        audio.onerror = function () { speak() }
        audio.play().catch(function () { speak() })
        if (!blobs[src]) fetchAudio(src)
      }
      var speak = function () {
        if (!('speechSynthesis' in window)) { done(); return }
        var u = new SpeechSynthesisUtterance(text)
        u.lang = st.accent === 'us' ? 'en-US' : 'en-GB'; u.rate = slow ? 0.6 : 0.85
        u.onend = u.onerror = function () { done() }
        speechSynthesis.speak(u)
        setTimeout(done, 4000)
      }
      if (src) play(src); else speak()
    })
  }

  // ---------- 小工具 ----------
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t } return a }
  // 释义只取前两个义项，选项里太长看不过来
  function shortMean(m) {
    var parts = String(m).split(/[；;]/)
    var s = parts.slice(0, 2).join('；')
    return s.length > 28 ? s.slice(0, 27) + '…' : s
  }
  function norm(s) { return String(s).toLowerCase().replace(/[’‘]/g, "'").replace(/[.…]+/g, ' ').replace(/[^a-z' -]/g, ' ').replace(/\s+/g, ' ').trim() }
  // "cultural difference/discrepancy" 两种都算对
  function answers(w) {
    var toks = String(w).replace(/\(.*?\)|（.*?）/g, ' ').split(/\s+/).filter(Boolean), out = ['']
    toks.forEach(function (t) {
      var alts = t.split('/'), next = []
      alts = alts.map(function (a, i) { return i && a[0] === '-' ? alts[0].slice(0, -(a.length - 1)) + a.slice(1) : a })
      out.forEach(function (o) { alts.forEach(function (a) { next.push((o + ' ' + a).trim()) }) })
      out = next.slice(0, 16)
    })
    return out.map(norm)
  }
  var PART = ['to', 'of', 'in', 'on', 'at', 'for', 'with', 'from', 'by', 'about', 'into', 'out', 'up', 'off', 'over', 'down', 'away', 'back', 'through', 'under', 'against', 'upon', 'toward', 'towards', 'as', 'between', 'among', 'without', 'within', 'beyond', 'behind', 'across', 'along', 'around']
  // 固定搭配：挖掉最后一个介词/副词小品词，没有就挖最长的那个词
  function blankOf(w) {
    var toks = String(w).split(/\s+/), idx = -1
    for (var i = toks.length - 1; i >= 0; i--) if (PART.indexOf(toks[i].toLowerCase().replace(/[^a-z]/g, '')) >= 0) { idx = i; break }
    if (idx < 0) { var best = 0; toks.forEach(function (t, i) { var l = t.replace(/[^a-z]/gi, '').length; if (l > best && !/^(sb|sth|one'?s|be)$/i.test(t)) { best = l; idx = i } }) }
    if (idx < 0) idx = 0
    var ans = toks[idx].replace(/[^a-z'\/-]/gi, '')
    return { before: toks.slice(0, idx).join(' '), ans: ans, after: toks.slice(idx + 1).join(' ') }
  }
  var SPEAK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/></svg>'

  // ---------- 列表页 ----------
  var screen = { name: 'home', book: '' }
  var BOOK_NOTE = { core: '按话题记', listen: '听力常考主题', phrase: '看中文补搭配', confuse: '听音辨形近' }
  function seg(name, opts, cur) {
    return '<div class="dk-seg" role="group">' + opts.map(function (o) { return '<button type="button" data-dk-set="' + name + '" data-v="' + o[0] + '" class="' + (String(cur) === String(o[0]) ? 'on' : '') + '">' + o[1] + '</button>' }).join('') + '</div>'
  }
  function renderHome() {
    var b = book(st.book); if (!b || (b.id === 'mine' && !mineWords().length)) { st.book = 'core'; b = book('core') || BOOKS[0] }
    var due = dueKeys().length, neu = nextNew().length, n = countOf(b), done = learnedIn(b), pct = n ? Math.round(done / n * 100) : 0
    var mins = Math.round(due * 0.35 + neu * 1.2), todayN = todayCards().length
    var note = due > 40 ? '<p class="dk-note">有 <b>' + due + '</b> 个词到期，今天一次复习完，最容易忘的排在前面。</p>' : ''
    if (!neu && done >= n) note += '<p class="dk-note">这本已经背完了，可以换一本。</p>'
    var today = '<div class="dk-today">' +
      '<div class="dk-cur"><span>在背</span><b>' + esc(b.name) + '</b><button type="button" data-dk-sheet>换词书</button></div>' +
      '<div class="dk-bprog"><span><i style="width:' + Math.max(pct, done ? 1 : 0) + '%"></i></span>' + done + ' / ' + n + '</div>' +
      '<div class="dk-tn"><div><b>' + due + '</b><span>复习</span></div><div><b>' + neu + '</b><span>新词</span></div>' + (due + neu ? '<em>约 ' + Math.max(1, mins) + ' 分钟</em>' : '') + '</div>' + note +
      '<button type="button" class="dk-start" data-dk-today' + (due + neu ? '' : ' disabled') + '>' + (due + neu ? '开始' : '今天的都做完了') + '</button>' +
      (todayN ? '<button type="button" class="dk-tdict" data-dk-tdict><span>今天背的 <b>' + todayN + '</b> 个词</span><em>听写 ›</em></button>' : '') + '</div>'
    var wrong = st.wrong.length ? '<button type="button" class="dk-q dk-q-row" data-dk-wrong><b>听错的词</b><span>' + st.wrong.length + ' 个，再听一遍</span></button>' : ''
    var cards = allBooks().map(function (x) {
      var cnt = countOf(x), learned = learnedIn(x), unit = x.kind === 'phrase' ? ' 条' : ' 词'
      var sub = x.id === 'mine' ? '做题和阅读时加入' : BOOK_NOTE[x.id] || ''
      return '<button type="button" class="dk-bk" data-dk-book="' + x.id + '"><span class="dk-bk-t"><b>' + esc(x.name) + (x.id === b.id ? '<em class="dk-tag">在背</em>' : '') + '</b><span>' + cnt + unit + (sub ? ' · ' + sub : '') + '</span></span>' + (learned ? '<em>已背 ' + learned + '</em>' : '') + '<i aria-hidden="true">›</i></button>'
    }).join('')
    return today + '<div class="dk-opts"><span>每组新词</span>' + seg('size', [[10, '10'], [20, '20']], st.size) + '<span class="dk-gap"></span>' + seg('accent', [['uk', '英音'], ['us', '美音']], st.accent) + '</div>' +
      '<p class="dk-hint">复习包括所有词书里到期的词</p>' + wrong +
      '<h3 class="dk-sec">全部词书<small>点开可按组背诵或听写</small></h3><div class="dk-books">' + cards + '</div>' + (screen.sheet ? sheet() : '')
  }
  function sheet() {
    return '<div class="dk-mask" data-dk-close><div class="dk-sheet" role="dialog" aria-label="换一本词书"><h3>换一本词书</h3><p>换书后，新词从这本里出；已经背过的词照常复习，进度不会丢。</p>' +
      allBooks().map(function (x) {
        var n = countOf(x), d = learnedIn(x), unit = x.kind === 'phrase' ? ' 条' : ' 词'
        return '<button type="button" class="dk-bk' + (x.id === st.book ? ' on' : '') + '" data-dk-pickbook="' + x.id + '"><span class="dk-bk-t"><b>' + esc(x.name) + '</b><span>' + (d ? '已背 ' + d + ' / ' + n : n + unit + ' · 还没开始') + '</span></span>' + (x.id === st.book ? '<em>在背</em>' : '') + '</button>'
      }).join('') + '</div></div>'
  }
  function groupState(g) {
    var r = st.groups[g.id] || {}
    var bits = []
    if (r.r) bits.push('已背')
    if (r.d) bits.push('听写 ' + r.d)
    return bits.join(' · ')
  }
  function renderBook() {
    var b = book(screen.book); if (!b) { screen.name = 'home'; return renderHome() }
    var secs = sections(b), no = 0
    var body = secs.map(function (s, si) {
      var rows = s.groups.map(function (g, gi) {
        no++
        var cs = cardsOf(b, g.items), from = cs[0] ? cs[0].w : ''
        var preview = cs.slice(0, 3).map(function (c) { return c.w }).join(' · ')
        var stt = groupState(g)
        return '<div class="dk-row"><div class="dk-row-t"><b>第 ' + no + ' 组<small>' + cs.length + (b.kind === 'phrase' ? ' 条' : ' 词') + '</small></b><span>' + esc(preview) + '</span>' + (stt ? '<em>' + stt + '</em>' : '') + '</div>' +
          '<button type="button" class="dk-act" data-dk-go="learn" data-dk-sec="' + si + '" data-dk-grp="' + gi + '">背诵</button><button type="button" class="dk-act dk-act-2" data-dk-go="dictate" data-dk-sec="' + si + '" data-dk-grp="' + gi + '">听写</button></div>'
      }).join('')
      return (s.name ? '<h3 class="dk-sec">' + esc(s.name) + (s.sub ? '<small>' + esc(s.sub) + '</small>' : '') + '</h3>' : '') + '<div class="dk-group">' + rows + '</div>'
    }).join('')
    return '<div class="dk-bookhead"><button type="button" class="dk-back" data-dk-home aria-label="返回词书">‹</button><div><h2>' + esc(b.name) + '</h2><p>' + countOf(b) + (b.kind === 'phrase' ? ' 条' : ' 词') + ' · 每组 ' + (b.kind === 'confuse' ? '约 ' : '') + st.size + (b.kind === 'phrase' ? ' 条' : ' 词') + '</p></div></div>' + body
  }
  function render() {
    var el = $('dictation-content'); if (!el) return
    if (!BOOKS.length) {
      if (!el.innerHTML) el.innerHTML = '<p class="dk-wait">词书加载中…</p>'
      ensureData().then(render, function () { el.innerHTML = '<p class="dk-wait">词书没加载上，<button type="button" class="dk-retry" data-dk-retry>再试一次</button></p>' })
      return
    }
    el.innerHTML = screen.name === 'book' ? renderBook() : renderHome()
  }

  // ---------- 练习 ----------
  var S = null // 当前一轮
  function showView(name) {
    document.querySelectorAll('.view').forEach(function (v) { v.classList.toggle('active', v.id === name + '-view') })
    window.scrollTo(0, 0)
  }
  function start(mode, cards, meta, olds) {
    olds = olds || []
    if (!cards.length && !olds.length) return
    unlock()
    S = { mode: mode, cards: cards, meta: meta || {}, queue: [], i: 0, phase: 'ask', first: {}, wrong: {}, done: 0, total: cards.length }
    if (mode === 'learn') {
      S.newCards = cards.slice()
      S.queue = interleave(shuffle(cards), olds); S.cards = cards.concat(olds); S.total = S.cards.length
      S.checks = 0; S.passed = 0; S.newDone = 0; S.revDone = 0; S.t0 = Date.now(); cards = S.cards
    } else if (mode === 'recite') S.queue = shuffle(cards).map(function (c) { return { c: c, tries: 0 } })
    else {
      // 听写、词表：按设置决定打不打乱
      var ord = st.shuf ? shuffle(cards) : cards.slice()
      S.queue = ord.map(function (c) { return { c: c } })
      if (mode === 'table') { S.cards = ord; S.tbl = st.tbl; S.vals = []; S.pi = 0; S.self = {}; S.res = {} }
    }
    if (mode === 'dictate' && st.dtype === 'paper') { S.paper = true }
    showView('dictation-session')
    // 先把这组词的词典分片取回来，发音和例句都靠它
    // 先把这组的音频全部下好再开始
    var mine = S
    S.loading = { done: 0, total: 0 }
    renderSession()
    preload(cards, function (d, n) { if (S === mine && S.loading) { S.loading = { done: d, total: n }; renderLoading() } }).then(function (r) {
      if (S !== mine || !S.loading) return
      S.loading = null; S.failed = r.failed
      renderSession()
    })
  }
  function cur() { return S && S.queue[S.i] }
  function progress() { return '<span class="dk-prog"><i style="width:' + Math.round(S.done / S.total * 100) + '%"></i></span><span class="dk-count">' + S.done + ' / ' + S.total + '</span>' }
  function bar(title) {
    return '<header class="dk-bar"><button type="button" class="dk-back" data-dk-exit aria-label="退出">‹</button><span class="dk-bar-t">' + esc(title) + '</span>' + progress() + '</header>'
  }
  function options(q) {
    var c = q.c, pool = []
    if (c.sib) c.sib.forEach(function (x) { if (x[0] !== c.w) pool.push(x[2]) })
    var all = S.meta.pool || S.cards
    shuffle(all).forEach(function (x) { if (pool.length < 8 && x.w !== c.w && x.m && x.m !== c.m) pool.push(x.m) })
    var opts = [c.m]
    pool.forEach(function (m) { if (opts.length < 4 && opts.map(shortMean).indexOf(shortMean(m)) < 0) opts.push(m) })
    return shuffle(opts)
  }
  function example(c) {
    if (c.ex) return { en: c.ex, cn: c.exc }
    return null
  }
  function detail(c) {
    var ex = example(c)
    var sib = c.sib && c.sib.length > 1 ? '<div class="dk-sibs">' +  c.sib.map(function (x) { return '<div class="dk-sib' + (x[0] === c.w ? ' on' : '') + '"><b>' + esc(x[0]) + (x[1] ? ' <i>/' + esc(x[1]) + '/</i>' : '') + '</b><span>' + esc(x[2]) + '</span>' + (x[3] ? '<span class="dk-sib-ex">' + esc(x[3]) + '</span>' : '') + '</div>' }).join('') + '</div>' : ''
    if (sib) return '<div class="dk-detail dk-detail-sib">' + sib + '</div>'
    return '<div class="dk-detail"><p class="dk-mean">' + esc(c.m) + '</p>' + (ex ? '<p class="dk-ex">' + esc(ex.en) + (ex.cn ? '<span>' + esc(ex.cn) + '</span>' : '') + '</p>' : '') + sib + '</div>'
  }
  function phonOf(c) { return c.p || '' }
  function wordHead(c, hide) {
    var ph = phonOf(c)
    return '<div class="dk-word"><h2' + (hide ? ' class="dk-hidden"' : '') + '>' + esc(c.w) + '</h2>' + (ph ? '<p class="dk-phon">/' + esc(ph) + '/</p>' : '') +
      '<button type="button" class="dk-say" data-dk-say aria-label="发音">' + SPEAK + '</button></div>'
  }

  function renderLoading() {
    var el = $('dictation-session-content'); if (!el || !S || !S.loading) return
    var L = S.loading, pct = L.total ? Math.round(L.done / L.total * 100) : 0
    var box = el.querySelector('.dk-loading')
    if (box) { box.querySelector('i').style.width = pct + '%'; box.querySelector('b').textContent = L.total ? L.done + ' / ' + L.total : ''; return }
    el.innerHTML = '<header class="dk-bar"><button type="button" class="dk-back" data-dk-exit aria-label="退出">‹</button><span class="dk-bar-t">' + esc(S.meta.title || '') + '</span></header>' +
      '<div class="dk-card dk-loading"><p class="dk-load-t">正在准备这组的发音</p><span class="dk-load-bar"><i style="width:' + pct + '%"></i></span><b>' + (L.total ? L.done + ' / ' + L.total : '') + '</b>' +
      '<button type="button" class="dk-dunno" data-dk-skipload>不等了，先开始</button></div>'
  }
  function renderSession() {
    var el = $('dictation-session-content'); if (!el || !S) return
    el.classList.toggle('dk-lmode', S.mode === 'learn' && !S.loading)
    if (S.mode !== 'table') el.classList.remove('dk-twide')
    document.body.classList.toggle('dk-learning', S.mode === 'learn')
    if (S.loading) return renderLoading()
    if (S.mode === 'learn') return renderLearn(el)
    if (S.mode === 'table') return renderTable(el)
    if (S.i >= S.queue.length) return renderResult(el)
    var q = cur(), c = q.c, title = S.meta.title || ''
    if (S.mode === 'recite') {
      var body
      if (S.phase === 'ask') {
        q.opts = q.opts || options(q)
        body = wordHead(c) + (c.k === 'word' && example(c) ? '<p class="dk-ex dk-ex-q">' + esc(example(c).en) + '</p>' : '') +
          '<div class="dk-opts-list">' + q.opts.map(function (m, i) { return '<button type="button" class="dk-opt" data-dk-pick="' + i + '">' + esc(shortMean(m)) + '</button>' }).join('') + '</div>' +
          '<button type="button" class="dk-dunno" data-dk-dunno>不认识</button>'
      } else {
        body = wordHead(c) + (q.opts ? '<div class="dk-opts-list">' + q.opts.map(function (m, i) { return '<button type="button" class="dk-opt' + (m === c.m ? ' right' : i === q.picked ? ' wrong' : '') + '" disabled>' + esc(shortMean(m)) + '</button>' }).join('') + '</div>' : '') +
          detail(c) + '<button type="button" class="dk-next" data-dk-next>下一个</button>'
      }
      el.innerHTML = bar(title) + '<div class="dk-card">' + body + '</div>'
      if (S.phase === 'ask' && !q.said) { q.said = 1; say(c.w) }
      return
    }
    // 听写
    if (S.paper) return renderPaper(el, title)
    var inner = ''
    if (c.k === 'phrase') {
      var bl = q.bl || (q.bl = blankOf(c.w))
      inner = '<p class="dk-cn">' + esc(c.m) + '</p><div class="dk-fill">' + (bl.before ? '<span>' + esc(bl.before) + '</span>' : '') +
        '<input id="dk-in" class="dk-in dk-in-s" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="done" size="' + Math.max(4, bl.ans.length + 1) + '"' + (S.phase !== 'ask' ? ' disabled value="' + esc(q.typed || '') + '" data-ok="' + (q.ok ? 1 : 0) + '"' : '') + '>' +
        (bl.after ? '<span>' + esc(bl.after) + '</span>' : '') + '</div>'
      if (S.phase !== 'ask') inner += '<p class="dk-verdict ' + (q.ok ? 'ok' : 'bad') + '">' + (q.ok ? '对了' : '应为 <b>' + esc(bl.ans) + '</b>') + '</p><p class="dk-full">' + esc(c.w) + '<button type="button" class="dk-say dk-say-s" data-dk-say aria-label="发音">' + SPEAK + '</button></p>'
    } else if (c.k === 'confuse') {
      if (!q.order) q.order = shuffle(c.sib)
      var sib = c.sib.length > 1 ? c.sib : null
      inner = '<button type="button" class="dk-big-play" data-dk-say>' + SPEAK + '<span>再听一遍</span></button>'
      if (sib) inner += '<div class="dk-pick">' + q.order.map(function (x) {
        var cls = S.phase === 'ask' ? '' : x[0] === c.w ? ' right' : x[0] === q.typed ? ' wrong' : ''
        return '<button type="button" class="dk-opt dk-opt-w' + cls + '" data-dk-word="' + esc(x[0]) + '"' + (S.phase === 'ask' ? '' : ' disabled') + '>' + esc(x[0]) + '</button>'
      }).join('') + '</div>'
      else inner += typeBox(q)
      if (S.phase !== 'ask') inner += detail(c)
    } else {
      inner = '<button type="button" class="dk-big-play" data-dk-say>' + SPEAK + '<span>再听一遍</span></button>' +
        '<div class="dk-tools"><button type="button" data-dk-slow>慢速</button><button type="button" data-dk-hint' + (q.hint ? ' class="on"' : '') + '>中文提示</button></div>' +
        (q.hint || S.phase !== 'ask' ? '<p class="dk-cn">' + esc(shortMean(c.m)) + '</p>' : '') + typeBox(q)
      if (S.phase !== 'ask') inner += '<p class="dk-verdict ' + (q.ok ? 'ok' : 'bad') + '">' + (q.ok ? '对了' : '应为') + ' <b>' + esc(c.w) + '</b>' + (phonOf(c) ? ' <span>/' + esc(phonOf(c)) + '/</span>' : '') + '</p>'
    }
    var foot = S.phase === 'ask'
      ? (c.k === 'confuse' && c.sib.length > 1 ? '' : '<button type="button" class="dk-next" data-dk-check>确定</button>')
      : '<button type="button" class="dk-next" data-dk-next>下一个</button>'
    var modeSw = ''
    el.innerHTML = bar(title) + '<div class="dk-card dk-card-d">' + modeSw + inner + foot + '</div>'
    var input = $('dk-in')
    if (input && S.phase === 'ask') setTimeout(function () { try { input.focus({ preventScroll: true }) } catch (e) {} }, 30)
    if (S.phase === 'ask' && !q.said && c.k !== 'phrase') { q.said = 1; setTimeout(function () { sayN(c.w) }, 200) }
  }
  function typeBox(q) {
    return '<input id="dk-in" class="dk-in" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="done" placeholder="听到什么写什么"' +
      (S.phase !== 'ask' ? ' disabled value="' + esc(q.typed || '') + '" data-ok="' + (q.ok ? 1 : 0) + '"' : '') + '>'
  }

  // 纸笔连播：每个词读两遍，中间停 5 秒；放完一起对答案
  function renderPaper(el, title) {
    if (S.phase === 'mark') {
      var rows = S.cards.map(function (c, i) {
        var bad = S.wrong[keyOf(c)]
        return '<button type="button" class="dk-mark' + (bad ? ' bad' : '') + '" data-dk-mark="' + i + '"><span class="n">' + (i + 1) + '</span><b>' + esc(c.w) + '</b><small>' + esc(shortMean(c.m)) + '</small><i>' + (bad ? '错' : '') + '</i></button>'
      }).join('')
      el.innerHTML = bar(title) + '<div class="dk-card dk-card-d"><p class="dk-tip">对照纸上写的，点一下标出写错的词</p><div class="dk-marks">' + rows + '</div><button type="button" class="dk-next" data-dk-markdone>标好了</button></div>'
      return
    }
    S.cards = S.order || (S.order = S.queue.map(function (q) { return q.c }))
    var n = S.pi || 0
    var rule = '每个词读 ' + st.times + ' 遍，间隔 ' + st.gap + ' 秒' + (st.auto ? '' : '，每个放完停下')
    el.innerHTML = bar(title) + '<div class="dk-card dk-card-d">' +
      '<p class="dk-papern">' + (S.started ? '第 <b>' + Math.min(n + 1, S.cards.length) + '</b> 个' : '准备好纸笔') + '</p>' +
      '<p class="dk-tip">' + (S.started ? rule : '共 ' + S.cards.length + ' 个词，' + rule + '，按序号写下来') + '</p>' +
      '<button type="button" class="dk-next" data-dk-paper>' + (S.started ? (S.paused ? '继续' : '暂停') : '开始') + '</button>' +
      (S.started ? '<button type="button" class="dk-dunno" data-dk-paperre>重听这个</button><button type="button" class="dk-dunno" data-dk-paperend>直接对答案</button>' : '') + '</div>'
  }
  function paperTick() {
    if (!S || !S.paper || S.paused || S.phase === 'mark') return
    var n = S.pi || 0, token = S.token = (S.token || 0) + 1
    if (n >= S.cards.length) { S.phase = 'mark'; S.done = S.total; renderSession(); return }
    renderSession()
    var w = S.cards[n].w, k = 0
    function one() { return say(w).then(function () { if (S && S.token === token && !S.paused && ++k < st.times) return wait(1200).then(one) }) }
    one().then(function () { return wait(st.gap * 1000) }).then(function () {
      if (!S || S.token !== token || S.paused) return
      S.pi = n + 1; S.done = S.pi
      if (!st.auto && S.pi < S.cards.length) { S.paused = true; renderSession(); return }
      paperTick()
    })
  }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms) }) }

  function judge(q, typed) {
    var c = q.c
    q.typed = typed
    if (c.k === 'phrase') q.ok = answers(q.bl.ans).indexOf(norm(typed)) >= 0
    else q.ok = answers(c.w).indexOf(norm(typed)) >= 0
    finish(q, q.ok)
  }
  function finish(q, ok) {
    var k = keyOf(q.c)
    S.phase = 'show'
    if (!ok) S.wrong[k] = 1
    S.done++
    renderSession()
    if (ok && S.mode === 'dictate' && q.c.k === 'word') setTimeout(function () { if (S && cur() === q && S.phase === 'show') next() }, 900)
    if (q.c.k === 'phrase') say(q.c.w)
  }
  function next() {
    if (!S) return
    S.i++; S.phase = 'ask'; S.touched = 1
    renderSession(); window.scrollTo(0, 0)
  }

  // 一轮结束：记 SRS、错词、组状态
  function saveRound() {
    var t = today(), keys = S.cards.map(keyOf), bad = keys.filter(function (k) { return S.wrong[k] })
    if (!S.saved) {
      S.saved = 1
      keys.forEach(function (k) {
        var had = st.srs[k]
        if (S.mode !== 'recite' && !had && !S.wrong[k]) return
        var r = had || { lv: 0 }
        r.lv = S.wrong[k] ? 0 : had ? Math.min(INT.length - 1, r.lv + 1) : 1
        r.due = t + INT[r.lv] * DAY
        if (S.mode === 'recite') r.seen = 1
        st.srs[k] = r
      })
      if (S.mode === 'dictate' || S.mode === 'table') {
        var set = {}; st.wrong.forEach(function (k) { set[k] = 1 })
        keys.forEach(function (k) { if (S.wrong[k]) set[k] = 1; else if (S.meta.fromWrong) delete set[k] })
        st.wrong = Object.keys(set)
      }
      if (S.meta.gid) {
        var g = st.groups[S.meta.gid] || (st.groups[S.meta.gid] = {})
        if (S.mode === 'recite') g.r = 1; else g.d = (keys.length - bad.length) + '/' + keys.length
      }
      save()
    }
  }
  function renderResult(el) {
    saveRound()
    var keys = S.cards.map(keyOf), bad = keys.filter(function (k) { return S.wrong[k] })
    var right = keys.length - bad.length
    var head = S.mode === 'recite'
      ? '<h2>' + (bad.length ? '一次就认出 ' + right + ' 个' : '全部一次认出') + '</h2><p>这组 ' + keys.length + ' 个' + (bad.length ? '，下面 ' + bad.length + ' 个明天再见' : '') + '</p>'
      : '<h2>' + (S.paper ? '写对' : '对了') + ' ' + right + ' / ' + keys.length + '</h2><p>' + (bad.length ? '错的已放进「听错的词」' : '一个没错') + '</p>'
    var list = bad.length ? '<div class="dk-group dk-res">' + bad.map(function (k) {
      var c = S.cards.filter(function (x) { return keyOf(x) === k })[0]
      return '<div class="dk-row"><div class="dk-row-t"><b>' + esc(c.w) + '</b><span>' + esc(shortMean(c.m)) + '</span></div><button type="button" class="dk-say dk-say-s" data-dk-sayw="' + esc(c.w) + '" aria-label="发音">' + SPEAK + '</button></div>'
    }).join('') + '</div>' : ''
    var acts = '<div class="dk-res-acts">' +
      (bad.length ? '<button type="button" class="dk-next" data-dk-again="bad">' + (S.mode === 'recite' ? '再背错的 ' : '只重听错的 ') + bad.length + ' 个</button>' : '') +
      (S.mode === 'recite' && S.meta.gid ? '<button type="button" class="dk-next' + (bad.length ? ' dk-next-2' : '') + '" data-dk-switch>听写这组</button>' : '') +
      '<button type="button" class="dk-next dk-next-2" data-dk-again="all">再来一遍</button>' +
      (S.meta.nextGroup ? '<button type="button" class="dk-next dk-next-2" data-dk-nextgroup>下一组</button>' : '') +
      '<button type="button" class="dk-dunno" data-dk-exit>返回</button></div>'
    el.innerHTML = bar(S.meta.title || '') + '<div class="dk-card dk-result">' + head + list + acts + '</div>'
  }

  // ---------- 背诵：每个新词当天过三关，和复习词穿插 ----------
  // 新词：看词选义 → 看中文选词 → 拼写（搭配是补关键词）。答对往后排 3 / 6 个再考，答错退一关、隔 2 个再来
  // 复习词：自评 不认识 / 模糊 / 认识；不认识的隔 3 个再看一遍
  var STAGE = ['看词选义', '看中文选词', '拼写'], STAGE_P = ['看搭配选义', '看中文选搭配', '补关键词']
  var KEYS_NUM = ['1', '2', '3', '4']
  function interleave(news, olds) {
    var q = news.map(function (c) { return { c: c, st: 0 } })
    var head = olds.length > 5 ? olds.slice(0, olds.length - 3) : []
    var mix = olds.slice(head.length)
    if (!q.length) return olds.map(function (c) { return { c: c, old: 1 } })
    mix.forEach(function (c, i) { q.splice(Math.min(q.length, 3 + i * 4), 0, { c: c, old: 1 }) })
    return head.map(function (c) { return { c: c, old: 1 } }).concat(q)
  }
  function learnLeft() { return S.queue.slice(S.i).reduce(function (a, x) { return a + (x.old ? 1 : 3 - x.st) }, 0) }
  function poolOf(c) {
    var b = book(c.b); if (!b) return []
    if (!b._pool) b._pool = cardsOf(b, b.units.reduce(function (a, u) { return a.concat(u.items) }, []))
    return b._pool
  }
  function meanOpts(c) {
    var pool = [], seen = {}
    seen[shortMean(c.m)] = 1
    if (c.sib) c.sib.forEach(function (x) { if (x[0] !== c.w) pool.push(x[2]) })
    shuffle(poolOf(c)).forEach(function (x) { if (pool.length < 12 && x.w !== c.w && x.m) pool.push(x.m) })
    var out = [c.m]
    pool.forEach(function (m) { var s = shortMean(m); if (out.length < 4 && !seen[s]) { seen[s] = 1; out.push(m) } })
    return shuffle(out)
  }
  function wordOpts(c) {
    var out = [c.w], seen = {}; seen[c.w.toLowerCase()] = 1
    var sib = c.sib ? c.sib.map(function (x) { return x[0] }) : (FORM[c.w.toLowerCase()] || []).map(function (x) { return x[0] })
    sib.concat(shuffle(poolOf(c)).map(function (x) { return x.w })).forEach(function (w) { var k = String(w).toLowerCase(); if (out.length < 4 && !seen[k]) { seen[k] = 1; out.push(w) } })
    return shuffle(out)
  }
  function meanOf(w, c) {
    if (c.sib) for (var i = 0; i < c.sib.length; i++) if (c.sib[i][0] === w) return c.sib[i][2]
    var p = poolOf(c); for (var j = 0; j < p.length; j++) if (p[j].w === w) return p[j].m
    return ''
  }
  var cnOnly = function (m) { return shortMean(m).replace(/^([a-z]+\.\s*\/?\s*(&\s*)?)+/i, '').replace(/\s[a-z]+\.\s*/gi, '；') }
  var posSplit = function (m) { var x = /^((?:[a-z]+\.\s*[\/&]?\s*)+)/i.exec(m); return x ? [x[1].trim(), m.slice(x[0].length)] : ['', m] }

  // 记忆间隔：认识就往后拉，模糊不超过 4 天，不认识明天见；隔得久还认识，按实际隔的天数算；不超过离考试的天数
  var LV = [1, 2, 4, 7, 15, 30, 60]
  function examLeft() {
    var v = ''; try { v = localStorage.getItem('tem8_exam_date') || '' } catch (e) {}
    var m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(v); if (!m) return 0
    return Math.round((new Date(+m[1], m[2] - 1, +m[3]).getTime() - today()) / DAY)
  }
  function nextIvl(r, rating, fuzz) {
    var lv = r.lv || 0, ivl
    if (rating === 1) ivl = 1
    else if (rating === 2) ivl = LV[Math.max(1, Math.min(lv - 1, 2))]
    else {
      var nl = Math.min(LV.length - 1, lv + 1), gone = r.last ? Math.round((today() - r.last) / DAY) : 0
      ivl = LV[nl]
      if (gone > LV[lv]) ivl = Math.max(ivl, Math.min(LV[LV.length - 1], Math.round(gone * 1.5)))
    }
    if (fuzz && ivl >= 4) ivl = Math.round(ivl * (0.9 + Math.random() * 0.2))
    var left = examLeft(); if (left > 2 && ivl >= left) ivl = Math.max(1, left - 1)
    return ivl
  }
  function schedule(k, rating) {
    var r = st.srs[k] || (st.srs[k] = { lv: 0 })
    var ivl = nextIvl(r, rating, true)
    if (rating === 1) { r.lv = 0; r.lapse = (r.lapse || 0) + 1 }
    else if (rating === 2) r.lv = Math.max(1, Math.min((r.lv || 0) - 1, 2))
    else r.lv = Math.min(LV.length - 1, (r.lv || 0) + 1)
    r.seen = 1; r.first = r.first || today(); r.last = today(); r.due = today() + ivl * DAY
  }
  function firstLearn(k, wrong) {
    var r = st.srs[k]
    if (r && r.seen) { schedule(k, wrong ? 1 : 3); return }
    r = st.srs[k] = { lv: wrong ? 0 : 1, seen: 1, first: today(), last: today() }
    r.due = today() + LV[r.lv] * DAY
  }
  function ivlText(n) { return n <= 1 ? '明天再见' : n + ' 天后' }
  function logDay(field, n) {
    var d = new Date(), k = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2)
    var o = st.log[k] || (st.log[k] = { nw: 0, rv: 0, ev: [] })
    o[field] = (o[field] || 0) + n
  }
  function logSession() {
    if (!S || S.logged || !(S.newDone + S.revDone)) return
    S.logged = 1
    if (S.meta.gid && S.i >= S.queue.length) { var g = st.groups[S.meta.gid] || (st.groups[S.meta.gid] = {}); g.r = 1 }
    var d = new Date(), k = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2)
    var o = st.log[k] || (st.log[k] = { nw: 0, rv: 0, ev: [] })
    o.ev = (o.ev || []).concat([{ t: S.t0, nw: S.newDone, rv: S.revDone, m: Math.max(1, Math.round((Date.now() - S.t0) / 60000)) }]).slice(-20)
    var keys = Object.keys(st.log).sort(); while (keys.length > 800) delete st.log[keys.shift()]
    save()
  }
  // 一个词过关 / 复习词评完，立刻记下，中途退出也不丢
  function passNew(q) {
    var k = keyOf(q.c); firstLearn(k, !!S.wrong[k]); S.newDone++; S.passed++; logDay('nw', 1); save()
  }
  function rateOld(q, rating) {
    var k = keyOf(q.c)
    if (!q.again) { schedule(k, rating); S.revDone++; logDay('rv', 1); save() }
    if (rating === 1) { S.wrong[k] = (S.wrong[k] || 0) + 1; S.queue.splice(Math.min(S.queue.length, S.i + 4), 0, { c: q.c, old: 1, again: 1 }) }
    else S.passed++
  }

  function lshell(main, foot) {
    var pct = S.i >= S.queue.length ? 100 : Math.round(S.checks / Math.max(1, S.checks + learnLeft()) * 100)
    return '<div class="dk-l"><div class="dk-l-in">' +
      '<header class="dk-l-top"><button type="button" class="dk-back" data-dk-exit aria-label="退出">‹</button><span class="dk-l-t">' + esc(S.meta.title || '') + '</span><span class="dk-l-n">' + S.passed + ' / ' + S.total + '</span></header>' +
      '<div class="dk-l-line"><i style="width:' + pct + '%"></i></div>' +
      '<main class="dk-l-main">' + main + '</main><footer class="dk-l-foot">' + (foot || '') + '</footer></div></div>'
  }
  function act(attr, label, cls) { return '<button type="button" class="dk-act-b ' + (cls || '') + '" ' + attr + '>' + label + '</button>' }
  function lhead(c) {
    var ph = phonOf(c)
    return '<div class="dk-l-word"><h2>' + esc(c.w) + '</h2><button type="button" class="dk-say" data-dk-say aria-label="发音">' + SPEAK + '</button>' + (ph ? '<p class="dk-phon">/' + esc(ph) + '/</p>' : '') + '</div>'
  }
  function lkind(q) {
    if (q.old) {
      var r = st.srs[keyOf(q.c)], ago = r && r.last ? Math.round((today() - r.last) / DAY) : 0
      return '<p class="dk-l-k"><b>复习</b>' + (q.again ? ' · 再看一遍' : ago ? ' · 上次是 ' + (ago === 1 ? '昨天' : ago + ' 天前') : '') + '</p>'
    }
    return '<p class="dk-l-k"><b>新词</b> · 第 ' + (q.st + 1) + ' 关 · ' + (q.c.k === 'phrase' ? STAGE_P : STAGE)[q.st] + '</p>'
  }
  function hlWord(t, w) {
    var base = String(w).toLowerCase().split(/[\s\/(]/)[0].replace(/[^a-z'-]/g, '')
    if (base.length < 3) return esc(t)
    var stem = base.length > 4 ? base.replace(/(e|y)$/, '') : base
    return esc(t).replace(new RegExp('\\b(' + stem.replace(/[-']/g, '\\$&') + '[a-z]*)', 'i'), '<u>$1</u>')
  }
  function ldetail(q) {
    var c = q.c, tabs = [], zt = (window.TEM8_ZHENTI || {})[String(c.w).toLowerCase()]
    var ph = c.k === 'phrase' ? [] : (PHR[String(c.w).toLowerCase()] || []).slice(0, 4)
    var cf = c.sib ? c.sib.filter(function (x) { return x[0] !== c.w }).map(function (x) { return [x[0], x[2]] }) : (FORM[String(c.w).toLowerCase()] || []).map(function (x) { return [x[0], x[2]] })
    if (zt) tabs.push(['zt', '真题 ' + zt[0] + ' 次'])
    if (ph.length) tabs.push(['ph', '搭配'])
    if (cf.length) tabs.push(['cf', '形近'])
    if (!S.tab || !tabs.some(function (t) { return t[0] === S.tab })) S.tab = tabs.length ? tabs[0][0] : ''
    var b = ''
    if (S.tab === 'zt') b = zt[1].map(function (z) { return '<div class="dk-zt"><p>' + hlWord(z[0], c.w) + '</p><small>' + esc(z[1]) + '</small></div>' }).join('')
    if (S.tab === 'ph') b = ph.map(function (p) { return '<div class="dk-kv"><b>' + esc(p[0]) + '</b><span>' + esc(p[1]) + '</span></div>' }).join('')
    if (S.tab === 'cf') b = cf.map(function (p) { return '<div class="dk-kv"><b>' + esc(p[0]) + '</b><span>' + esc(p[1]) + '</span></div>' }).join('')
    var ex = example(c)
    return lhead(c) + '<p class="dk-l-mean">' + esc(c.m) + '</p>' +
      (ex ? '<div class="dk-blk"><p class="dk-l-ex">' + esc(ex.en) + (ex.cn ? '<span>' + esc(ex.cn) + '</span>' : '') + '</p></div>' : '') +
      (tabs.length ? '<div class="dk-blk"><div class="dk-dtabs">' + tabs.map(function (t) { return '<button type="button" data-dk-tab="' + t[0] + '" class="' + (S.tab === t[0] ? 'on' : '') + '">' + t[1] + '</button>' }).join('') + '</div><div class="dk-dbody">' + b + '</div></div>' : '')
  }
  function renderLearn(el) {
    if (S.i >= S.queue.length) return renderLearnResult(el)
    var q = cur(), c = q.c, show = S.phase !== 'ask', html
    if (S.phase === 'detail') {
      html = lshell(ldetail(q), q.old && q.rating === 3 ? act('data-dk-oops', '记错了', 'warn') + act('data-dk-lnext', '下一词') : act('data-dk-lnext', '下一词'))
    } else if (q.old) {
      var r = st.srs[keyOf(c)] || { lv: 0 }
      html = lshell(lkind(q) + lhead(c) + '<p class="dk-l-tip">先回想意思，再如实选</p><div class="dk-grow"></div>' +
        '<div class="dk-rate"><button type="button" data-dk-rate="1">不认识<small>' + ivlText(1) + '</small></button><button type="button" data-dk-rate="2">模糊<small>' + ivlText(nextIvl(r, 2)) + '</small></button><button type="button" data-dk-rate="3" class="r3">认识<small>' + ivlText(nextIvl(r, 3)) + '</small></button></div>' +
        '<p class="dk-kbd">键盘 1 / 2 / 3</p>', '')
    } else if (q.st === 0) {
      q.opts = q.opts || meanOpts(c)
      html = lshell(lkind(q) + lhead(c) + '<p class="dk-l-tip">先想一下意思再选，想不起来就点「不认识」</p><div class="dk-grow"></div><div class="dk-chs">' + q.opts.map(function (m, i) {
        var right = m === c.m, picked = i === q.picked, ps = posSplit(shortMean(m)), cls = '', lab = ''
        if (show) {
          cls = right ? ' right' : picked ? ' wrong' : ' dim'
          if (right) lab = c.w
          else if (picked) { var o = poolOf(c).filter(function (x) { return x.m === m })[0] || (c.sib || []).map(function (x) { return { w: x[0], m: x[2] } }).filter(function (x) { return x.m === m })[0]; lab = o ? o.w : '' }
        }
        return '<button type="button" class="dk-ch' + cls + (lab ? ' lab' : '') + '" data-dk-lpick="' + i + '"' + (show ? ' disabled' : '') + '>' + (lab ? '<span class="w">' + esc(lab) + '</span>' : '') + (ps[0] ? '<span class="p">' + esc(ps[0]) + '</span>' : '') + '<span class="m">' + esc(ps[1]) + '</span></button>'
      }).join('') + '</div>', show ? (S.lastOk ? '' : act('data-dk-todetail', '继续')) : act('data-dk-ldunno', '不认识', 'quiet'))
    } else if (q.st === 1) {
      q.opts = q.opts || wordOpts(c)
      html = lshell(lkind(q) + '<p class="dk-l-cn">' + esc(c.k === 'phrase' ? c.m : cnOnly(c.m)) + '</p><p class="dk-l-tip">哪个' + (c.k === 'phrase' ? '搭配' : '词') + '是这个意思？</p><div class="dk-grow"></div><div class="dk-chs">' + q.opts.map(function (w, i) {
        var right = w === c.w, picked = i === q.picked, cls = show ? (right ? ' right' : picked ? ' wrong' : ' dim') : ''
        var sub = show && picked && !right ? '<span class="m">' + esc(shortMean(meanOf(w, c))) + '</span>' : ''
        return '<button type="button" class="dk-ch dk-ch-w' + cls + '" data-dk-lpick="' + i + '"' + (show ? ' disabled' : '') + '><span class="w">' + esc(w) + '</span>' + sub + '</button>'
      }).join('') + '</div>', show ? (S.lastOk ? '' : act('data-dk-todetail', '继续')) : act('data-dk-ldunno', '想不起来', 'quiet'))
    } else {
      var ph = c.k === 'phrase', bl = ph ? (q.bl || (q.bl = blankOf(c.w))) : null
      var input = '<input id="dk-lin" class="dk-l-in-t' + (show ? (q.ok ? ' ok' : ' bad') : '') + '" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="done"' + (q.hint && !show ? ' placeholder="' + esc((ph ? bl.ans : c.w).charAt(0)) + '…"' : '') + (show ? ' disabled value="' + esc(q.typed || '') + '"' : '') + '>'
      var box = ph ? '<div class="dk-l-fill">' + (bl.before ? '<span>' + esc(bl.before) + '</span>' : '') + input + (bl.after ? '<span>' + esc(bl.after) + '</span>' : '') + '</div>' : input
      html = lshell(lkind(q) + '<p class="dk-l-cn">' + esc(ph ? c.m : cnOnly(c.m)) + '</p><p class="dk-l-tip">' + (ph ? '补上空着的那个词' : '听发音，把词拼出来') + '</p><div class="dk-grow"></div>' +
        '<form class="dk-l-spell" data-dk-lspell>' + box + '</form>' +
        (show ? '<p class="dk-verdict ' + (q.ok ? 'ok' : 'bad') + '">' + (q.ok ? '对了' : '应为') + ' <b>' + esc(ph ? c.w : c.w) + '</b></p>' : '<div class="dk-l-tools">' + (ph ? '' : '<button type="button" data-dk-say>再听一遍</button>') + '<button type="button" data-dk-lhint>首字母</button></div>') + '<div class="dk-grow"></div>',
        show ? (q.ok ? '' : act('data-dk-todetail', '继续')) : act('data-dk-lcheck', '确定'))
    }
    el.innerHTML = html
    var inp = $('dk-lin')
    if (inp && S.phase === 'ask') setTimeout(function () { try { inp.focus({ preventScroll: true }) } catch (e) {} }, 40)
    if (S.phase === 'ask' && !q.said && (q.old || q.st === 0 || (q.st === 2 && c.k !== 'phrase'))) { q.said = 1; setTimeout(function () { say(c.w) }, 200) }
  }
  function lanswer(ok) { var q = cur(), k = keyOf(q.c); S.checks++; if (!ok) S.wrong[k] = (S.wrong[k] || 0) + 1; S.phase = 'show'; S.lastOk = ok }
  function ladvance() {
    var q = cur(); S.tab = ''
    if (!q.old) {
      if (S.lastOk) {
        if (q.st < 2) S.queue.splice(Math.min(S.queue.length, S.i + 1 + [3, 6][q.st]), 0, { c: q.c, st: q.st + 1 })
        else passNew(q)
      } else S.queue.splice(Math.min(S.queue.length, S.i + 3), 0, { c: q.c, st: Math.max(0, q.st - 1) })
    }
    S.i++; S.phase = 'ask'; S.lastOk = false
    if (S.i >= S.queue.length) logSession()
    renderSession()
  }
  function lcheck() {
    var q = cur(), inp = $('dk-lin'); if (!inp || S.phase !== 'ask') return
    var v = inp.value; if (!norm(v)) return
    q.typed = v
    q.ok = answers(q.c.k === 'phrase' ? (q.bl || blankOf(q.c.w)).ans : q.c.w).indexOf(norm(v)) >= 0
    lanswer(q.ok); renderSession()
    if (q.c.k === 'phrase' || !q.ok) say(q.c.w)
    if (q.ok) setTimeout(function () { if (S && cur() === q && S.phase === 'show') ladvance() }, 800)
  }
  function renderLearnResult(el) {
    var bad = S.cards.filter(function (c) { return S.wrong[keyOf(c)] })
    var mins = Math.max(1, Math.round((Date.now() - S.t0) / 60000))
    var main = '<p class="dk-res-h">' + (S.newDone ? '这组学完了' : '复习完了') + '</p><p class="dk-res-sub">' +
      [S.newDone ? S.newDone + ' 个新词各过了三关' : '', S.revDone ? S.revDone + ' 个词复习完' : ''].filter(Boolean).join('，') + '。</p>' +
      '<div class="dk-res-n"><div><b>' + mins + '</b><span>分钟</span></div><div><b>' + (S.cards.length - bad.length) + '</b><span>一次没错</span></div><div><b>' + bad.length + '</b><span>错过</span></div></div>' +
      (bad.length ? '<div class="dk-res-list">' + bad.map(function (c) { return '<div class="dk-res-row"><b>' + esc(c.w) + '</b><span>' + esc(shortMean(c.m)) + '</span><em>错 ' + S.wrong[keyOf(c)] + ' 次</em></div>' }).join('') + '</div>' : '') +
      '<p class="dk-res-plan">' + (bad.length ? '错过的 ' + bad.length + ' 个明天再见；' : '') + '其余的按记忆间隔排好了，越记得牢隔得越久。</p>' +
      (S.newDone && S.newCards && S.newCards.length ? '<button type="button" class="dk-tdict dk-tdict-r" data-dk-tdict data-v="s"><span>听写这 <b>' + S.newCards.length + '</b> 个新词</span><em>听写 ›</em></button>' : '')
    var more = S.meta.today && (dueKeys().length || nextNew().length)
    el.innerHTML = lshell(main, (bad.length ? act('data-dk-lagain', '再练错的', 'quiet') : act('data-dk-exit', '返回', 'quiet')) +
      (S.meta.nextGroup ? act('data-dk-nextgroup', '下一组') : more ? act('data-dk-today', '再来一组') : act('data-dk-exit', '完成')))
  }
  // 当前词书里还没背过的词，按词书顺序取一组
  function nextNew() {
    var b = book(st.book) || BOOKS[0]; if (!b) return []
    var out = []
    poolOf({ b: b.id }).some(function (c) { var r = st.srs[keyOf(c)]; if (!(r && r.seen)) out.push(c); return out.length >= st.size })
    return out
  }
  function startToday() {
    var olds = dueKeys().map(findCard).filter(Boolean), news = nextNew()
    if (!olds.length && !news.length) return
    start('learn', news, { title: olds.length && !news.length ? '今天复习' : '第 ' + (Math.floor(learnedIn(book(st.book) || BOOKS[0]) / st.size) + 1) + ' 组 · ' + (book(st.book) || BOOKS[0]).name, today: 1 }, olds)
  }
  function startHard() {
    var olds = Object.keys(st.srs).filter(function (k) { var r = st.srs[k]; return r.seen && (r.lapse || 0) >= 2 && (r.lv || 0) < 4 }).map(findCard).filter(Boolean)
    if (olds.length) { showView('dictation-session'); start('learn', [], { title: '易错词' }, olds) }
  }

  // ---------- 听写设置：逐个拼写 / 纸笔连播 / 词表 ----------
  var DS = null // { cards, meta }
  var DMODES = [['type', '逐个拼写', '听一个打一个，写对出释义'], ['paper', '纸笔连播', '只放音频，在纸上写'], ['table', '词表', '一张表整组写完再核对']]
  var TBLS = [['cn', '中文词表', '给释义，写英文单词。交卷后系统自动判对错。'], ['en', '英文词表', '给单词，写中文释义。交卷后显示参考释义，你自己点 ✓ / ✗（意思对就算对）。'], ['ear', '听音词表', '表里只有序号，连续播放整组，按序号写下听到的词。交卷后系统自动判。']]
  function askDictate(cards, meta) {
    if (!cards || !cards.length) return
    DS = { cards: cards, meta: meta || {} }
    renderDS()
  }
  function dpills(name, opts, cur) {
    return '<div class="dk-dpills">' + opts.map(function (o) { return '<button type="button" data-dk-dset="' + name + '" data-v="' + o[0] + '" aria-pressed="' + (String(cur) === String(o[0])) + '">' + o[1] + '</button>' }).join('') + '</div>'
  }
  function dswitch(name, on, label) {
    return '<div class="dk-drow"><span>' + label + '</span><button type="button" class="dk-dsw" role="switch" aria-checked="' + !!on + '" aria-label="' + label + '" data-dk-dset="' + name + '" data-v="toggle"><i></i></button></div>'
  }
  function renderDS() {
    var box = $('dk-dsheet')
    if (!DS) { if (box) box.remove(); document.body.classList.remove('dk-dopen'); return }
    if (!box) { box = document.createElement('div'); box.id = 'dk-dsheet'; box.className = 'dk dk-dmask'; document.body.appendChild(box) }
    document.body.classList.add('dk-dopen')
    var m = st.dtype, tb = st.tbl, n = DS.cards.length
    var tblInfo = TBLS.filter(function (x) { return x[0] === tb })[0]
    var opts = ''
    if (m === 'table') opts += '<div class="dk-dblk"><span class="dk-dk">词表</span><div class="dk-dtabs">' + TBLS.map(function (x) { return '<button type="button" data-dk-dset="tbl" data-v="' + x[0] + '" aria-pressed="' + (tb === x[0]) + '">' + x[1] + '</button>' }).join('') + '</div><p class="dk-dnote">' + tblInfo[2] + '</p></div>'
    if (m !== 'table' || tb === 'ear') opts += '<div class="dk-drow"><span>播放次数</span>' + dpills('times', [[1, '1 遍'], [2, '2 遍'], [3, '3 遍']], st.times) + '</div>'
    if (m === 'paper' || (m === 'table' && tb === 'ear')) opts += '<div class="dk-drow"><span>间隔</span>' + dpills('gap', [[2, '2 秒'], [4, '4 秒'], [6, '6 秒'], [8, '8 秒']], st.gap) + '</div>'
    if (m === 'paper') opts += dswitch('auto', st.auto, '自动播放下一个')
    opts += dswitch('shuf', st.shuf, '打乱顺序')
    var go = m === 'type' ? '开始听写' : m === 'paper' ? '准备好纸笔，开始' : '打开' + tblInfo[1]
    box.innerHTML = '<div class="dk-dsheet" role="dialog" aria-modal="true" aria-label="听写设置">' +
      '<div class="dk-dhead"><b>听写设置</b><span>' + esc(DS.meta.title || '') + ' · ' + n + ' 个</span><button type="button" class="dk-dx" data-dk-dclose aria-label="关闭">×</button></div>' +
      '<div class="dk-dmodes">' + DMODES.map(function (x) { return '<button type="button" data-dk-dset="dtype" data-v="' + x[0] + '" aria-pressed="' + (m === x[0]) + '"><b>' + x[1] + '</b><span>' + x[2] + '</span></button>' }).join('') + '</div>' +
      '<div class="dk-dopts">' + opts + '</div>' +
      '<button type="button" class="dk-start" data-dk-dgo>' + go + '</button></div>'
  }
  function dsetClick(name, v) {
    if (v === 'toggle') st[name] = !st[name]
    else st[name] = name === 'times' || name === 'gap' ? Number(v) : v
    if (name === 'dtype' && v !== 'table') st.dmode = v
    save(); renderDS()
  }
  function dgo() {
    if (!DS) return
    var p = DS; DS = null; renderDS()
    start(st.dtype === 'table' ? 'table' : 'dictate', p.cards, p.meta)
  }

  // ---------- 词表：中文词表写英文 / 英文词表写释义 / 听音词表整组连播 ----------
  function tblIs(id) { return TBLS.filter(function (x) { return x[0] === id })[0] }
  function earLabel() { var n = S.cards.length; return S.playing ? '暂停' : S.pi >= n ? '重放' : S.pi > 0 ? '继续' : '开始播放' }
  function renderTable(el) {
    var tb = S.tbl, info = tblIs(tb), n = S.cards.length, sub = !!S.sub
    var sub2 = { cn: '看释义写英文', en: '看单词写释义', ear: '听写整组' }[tb]
    var head = '<header class="dk-tbar"><button type="button" class="dk-back" data-dk-exit aria-label="退出">‹</button>' +
      '<div class="dk-tbar-t"><b>' + info[1] + '</b><span>' + esc(S.meta.title || '') + ' · ' + sub2 + '</span></div>' +
      '<button type="button" class="dk-tbtn" data-dk-print>打印</button>' +
      (sub ? '<button type="button" class="dk-tbtn" data-dk-tredo>再写一遍</button>' : '<button type="button" class="dk-tbtn dk-tbtn-p" data-dk-tsub>交卷</button>') + '</header>'
    var player = tb === 'ear' && !sub ? '<div class="dk-tplay"><button type="button" class="dk-tbtn dk-tbtn-p" data-dk-tplay id="dk-tp-btn">' + earLabel() + '</button>' +
      '<span id="dk-tp-no">第 ' + Math.min(n, S.pi + 1) + ' / ' + n + ' 个</span><span class="dk-prog"><i id="dk-tp-bar" style="width:' + Math.round(Math.min(n, S.pi) / n * 100) + '%"></i></span>' +
      '<button type="button" class="dk-tlink" data-dk-treplay>重听</button></div>' : ''
    var summary = ''
    if (sub) {
      var marked = 0, ok = 0
      S.cards.forEach(function (c, i) { var r = tb === 'en' ? S.self[i] : S.res[i]; if (r) marked++; if (r === 'ok') ok++ })
      var bad = marked - ok
      if (tb === 'en' && marked < n) summary = '<div class="dk-tsum">对照参考释义，逐个点 ✓ 或 ✗。已标 ' + marked + ' / ' + n + '，标完自动记录。</div>'
      else summary = '<div class="dk-tsum"><p><b>对 ' + ok + ' / ' + n + '</b>　' + (bad ? '错的 ' + bad + ' 个已加进「听错的词」，下次复习提前。' : '一个没错。') + '</p>' +
        '<div class="dk-tsum-acts">' + (bad ? '<button type="button" class="dk-tbtn dk-tbtn-p" data-dk-again="bad">只写错的 ' + bad + ' 个</button>' : '') + '<button type="button" class="dk-tbtn" data-dk-exit>返回</button></div></div>'
    }
    var rows = S.cards.map(function (c, i) {
      var v = S.vals[i] || '', r = tb === 'en' ? (S.self[i] || '') : sub ? S.res[i] : ''
      var given = tb === 'cn' ? '<span class="dk-tgiv cn">' + esc(shortMean(c.m)) + '</span>' : tb === 'en' ? '<span class="dk-tgiv en">' + esc(c.w) + '</span>' : ''
      var extra = ''
      if (sub && tb !== 'en' && r === 'bad') extra = '<p class="dk-tfix">→ ' + esc(c.w) + (tb === 'ear' ? '　<span>' + esc(shortMean(c.m)) + '</span>' : '') + '</p>'
      if (sub && tb === 'en') extra = '<div class="dk-tref"><span>参考：' + esc(shortMean(c.m)) + '</span>' +
        '<button type="button" class="dk-tmk ok" data-dk-self="' + i + '" data-v="ok" aria-pressed="' + (r === 'ok') + '" aria-label="写对了"' + (S.saved ? ' disabled' : '') + '>✓</button>' +
        '<button type="button" class="dk-tmk bad" data-dk-self="' + i + '" data-v="bad" aria-pressed="' + (r === 'bad') + '" aria-label="写错了"' + (S.saved ? ' disabled' : '') + '>✗</button></div>'
      return '<div class="dk-trow' + (r ? ' ' + r : '') + (tb === 'en' ? ' wide' : '') + '" data-dk-row="' + i + '"><span class="dk-tno">' + (i + 1) + '</span>' + given +
        '<div class="dk-tcell"><input id="dk-t-' + i + '" class="dk-tin" data-dk-ti="' + i + '" value="' + esc(v) + '" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="next" aria-label="第 ' + (i + 1) + ' 个"' +
        ' placeholder="' + (tb === 'en' ? '写中文释义' : '写英文') + '"' + (sub ? ' disabled' : '') + '>' + (tb === 'en' ? '' : extra) + '</div>' + (tb === 'en' ? extra : '') + '</div>'
    }).join('')
    var half = Math.ceil(n / 2)
    el.innerHTML = '<div class="dk-tsheet">' + head + player + summary +
      '<div class="dk-tgrid" style="--dk-trows:' + half + '">' + rows + '</div>' +
      '<p class="dk-tfoot">' + (sub ? '' : '写完一格按回车跳到下一格，最后一格按回车就是交卷') + '</p></div>'
    el.classList.add('dk-twide')
    if (!sub && tb !== 'ear' && !S.focused) { S.focused = 1; setTimeout(function () { var f = $('dk-t-0'); if (f) try { f.focus({ preventScroll: true }) } catch (e) {} }, 60) }
    earUI()
  }
  function tableSubmit() {
    if (!S || S.mode !== 'table' || S.sub) return
    document.querySelectorAll('.dk-tin').forEach(function (x) { S.vals[Number(x.dataset.dkTi)] = x.value })
    stopEar(); S.sub = 1; S.res = {}; S.self = {}
    if (S.tbl !== 'en') {
      S.cards.forEach(function (c, i) { var ok = answers(c.w).indexOf(norm(S.vals[i] || '')) >= 0; S.res[i] = ok ? 'ok' : 'bad'; if (!ok) S.wrong[keyOf(c)] = 1 })
      tableSave()
    }
    renderSession(); window.scrollTo(0, 0)
  }
  function tableSave() { S.i = S.queue.length; S.done = S.total; saveRound() }
  function tableClick(t, d) {
    if (t.hasAttribute('data-dk-tsub')) { tableSubmit(); return true }
    if (t.hasAttribute('data-dk-tredo')) { stopEar(); start('table', S.cards, Object.assign({}, S.meta)); return true }
    if (t.hasAttribute('data-dk-print')) { document.body.classList.add('dk-printing'); setTimeout(function () { window.print() }, 30); return true }
    if (t.hasAttribute('data-dk-tplay')) { if (S.playing) { stopEar(); earUI() } else earPlay(S.pi >= S.cards.length ? 0 : S.pi); return true }
    if (t.hasAttribute('data-dk-treplay')) { earPlay(Math.min(S.pi, S.cards.length - 1)); return true }
    if (d.dkSelf != null && S.sub && !S.saved) {
      var i = Number(d.dkSelf), k = keyOf(S.cards[i])
      S.self[i] = d.v
      if (d.v === 'bad') S.wrong[k] = 1; else delete S.wrong[k]
      if (Object.keys(S.self).length >= S.cards.length) tableSave()
      renderSession(); return true
    }
    return false
  }
  // 听音词表：整组连播，正在读的那一行高亮
  function stopEar() { if (S) { S.etok = (S.etok || 0) + 1; S.playing = 0 } stop() }
  function earPlay(from) {
    stopEar()
    var tok = S.etok, mine = S
    S.playing = 1
    ;(function step(i) {
      if (S !== mine || S.etok !== tok) return
      if (i >= S.cards.length) { S.playing = 0; S.pi = S.cards.length; earUI(); return }
      S.pi = i; earUI()
      var w = S.cards[i].w, k = 0
      ;(function one() {
        say(w).then(function () {
          if (S !== mine || S.etok !== tok) return
          if (++k < st.times) setTimeout(one, 1200)
          else setTimeout(function () { step(i + 1) }, st.gap * 1000)
        })
      })()
    })(from)
  }
  function earUI() {
    if (!S || S.mode !== 'table') return
    var n = S.cards.length
    document.querySelectorAll('.dk-trow.hot').forEach(function (x) { x.classList.remove('hot') })
    if (S.playing) { var r = document.querySelector('[data-dk-row="' + S.pi + '"]'); if (r) r.classList.add('hot') }
    var b = $('dk-tp-btn'); if (b) b.textContent = earLabel()
    var no = $('dk-tp-no'); if (no) no.textContent = '第 ' + Math.min(n, S.pi + 1) + ' / ' + n + ' 个'
    var bar2 = $('dk-tp-bar'); if (bar2) bar2.style.width = Math.round(Math.min(n, S.pi) / n * 100) + '%'
  }

  // ---------- 入口 ----------
  function groupAt(b, si, gi) {
    var secs = sections(b), s = secs[si], g = s && s.groups[gi]
    if (!g) return null
    var no = 0
    for (var i = 0; i < si; i++) no += secs[i].groups.length
    no += gi + 1
    var nxt = s.groups[gi + 1] ? [si, gi + 1] : secs[si + 1] ? [si + 1, 0] : null
    var pool = cardsOf(b, b.units.reduce(function (a, u) { return a.concat(u.items) }, []))
    return { cards: cardsOf(b, g.items), meta: { title: b.name + ' · 第 ' + no + ' 组', gid: g.id, book: b.id, si: si, gi: gi, nextGroup: nxt, pool: pool } }
  }
  function openGroup(mode, bid, si, gi, direct) {
    var b = book(bid), g = b && groupAt(b, si, gi)
    if (!g) return
    if (mode === 'dictate' && !direct) askDictate(g.cards, g.meta)
    else start(mode, g.cards, g.meta)
  }
  // 今天第一次背的词（首页那行和背完的结束页用）
  function todayCards() {
    var t = today(), out = []
    for (var k in st.srs) if (st.srs[k].seen && st.srs[k].first === t) { var c = findCard(k); if (c) out.push(c) }
    return out
  }

  document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('button')
    if (!t) return
    var d = t.dataset
    if (d.dkSet) {
      var v = d.v; if (d.dkSet === 'size' || d.dkSet === 'gap') v = Number(v)
      st[d.dkSet] = v; save()
      if (S && document.getElementById('dictation-session-view').classList.contains('active')) {
        if (d.dkSet === 'dmode') { S.paper = v === 'paper'; S.touched = 0 }
        renderSession()
      } else render()
      return
    }
    if (d.dkDset) { dsetClick(d.dkDset, d.v); return }
    if (t.hasAttribute('data-dk-dclose')) { DS = null; renderDS(); return }
    if (t.hasAttribute('data-dk-dgo')) { dgo(); return }
    if (t.hasAttribute('data-dk-tdict')) {
      var tc = d.v === 's' && S && S.newCards ? S.newCards : todayCards()
      askDictate(tc, { title: d.v === 's' ? '这组新词' : '今天背的词' }); return
    }
    if (t.hasAttribute('data-dk-retry')) { render(); return }
    if (d.dkBook) { screen = { name: 'book', book: d.dkBook }; render(); window.scrollTo(0, 0); return }
    if (t.hasAttribute('data-dk-home')) { screen = { name: 'home' }; render(); window.scrollTo(0, 0); return }
    if (d.dkGo) { openGroup(d.dkGo, screen.book, Number(d.dkSec), Number(d.dkGrp)); return }
    if (t.hasAttribute('data-dk-sheet')) { screen.sheet = 1; render(); return }
    if (d.dkPickbook) { st.book = d.dkPickbook; save(); screen.sheet = 0; render(); return }
    if (t.hasAttribute('data-dk-today')) { if (S) logSession(); startToday(); return }
    if (t.hasAttribute('data-dk-review')) {
      var cards = dueKeys().map(findCard).filter(Boolean).slice(0, st.size)
      start('recite', cards, { title: '今天复习' }); return
    }
    if (t.hasAttribute('data-dk-wrong')) {
      var cs = st.wrong.map(findCard).filter(Boolean)
      var w = cs.filter(function (c) { return c.k === 'word' }), o = cs.filter(function (c) { return c.k !== 'word' })
      askDictate((w.length ? w : o).slice(0, 40), { title: '听错的词', fromWrong: 1 }); return
    }
    if (!S) return
    var q = cur()
    if (t.hasAttribute('data-dk-exit')) { stopEar(); var sc = $('dictation-session-content'); if (sc) sc.classList.remove('dk-twide'); logSession(); S = null; document.body.classList.remove('dk-learning'); showView('dictation'); render(); return }
    if (S.mode === 'learn') {
      if (d.dkTab) { S.tab = d.dkTab; renderSession(); return }
      if (d.dkLpick != null && S.phase === 'ask') {
        var li = Number(d.dkLpick), lok = q.st === 0 ? q.opts[li] === q.c.m : q.opts[li] === q.c.w
        q.picked = li; lanswer(lok); renderSession()
        if (lok) setTimeout(function () { if (S && cur() === q && S.phase === 'show') ladvance() }, 700)
        return
      }
      if (t.hasAttribute('data-dk-ldunno') && S.phase === 'ask') { q.picked = -1; lanswer(false); renderSession(); return }
      if (t.hasAttribute('data-dk-todetail')) { S.phase = 'detail'; renderSession(); return }
      if (t.hasAttribute('data-dk-lhint')) { q.hint = 1; renderSession(); return }
      if (t.hasAttribute('data-dk-lcheck')) { lcheck(); return }
      if (d.dkRate && S.phase === 'ask') { var rt = Number(d.dkRate); q.rating = rt; S.checks++; rateOld(q, rt); S.phase = 'detail'; renderSession(); return }
      if (t.hasAttribute('data-dk-oops')) {
        var ok2 = keyOf(q.c); schedule(ok2, 1); S.passed--; S.wrong[ok2] = (S.wrong[ok2] || 0) + 1; save()
        S.queue.splice(Math.min(S.queue.length, S.i + 4), 0, { c: q.c, old: 1, again: 1 }); ladvance(); return
      }
      if (t.hasAttribute('data-dk-lnext')) { ladvance(); return }
      if (t.hasAttribute('data-dk-lagain')) { var bad = S.cards.filter(function (c) { return S.wrong[keyOf(c)] }), mm = Object.assign({}, S.meta, { today: 0, nextGroup: null }); start('learn', [], mm, bad); return }
    }
    if (t.hasAttribute('data-dk-skipload')) { S.loading = null; renderSession(); return }
    if (t.hasAttribute('data-dk-say')) { if (q) say(q.c.w); return }
    if (d.dkSayw) { say(d.dkSayw); return }
    if (t.hasAttribute('data-dk-slow')) { if (q) say(q.c.w, true); return }
    if (t.hasAttribute('data-dk-hint')) { q.hint = !q.hint; renderSession(); return }
    if (d.dkPick != null && S.phase === 'ask') {
      var i = Number(d.dkPick), ok = q.opts[i] === q.c.m
      q.picked = i; q.tries++
      if (ok) {
        if (q.tries === 1 && !S.wrong[keyOf(q.c)]) { t.classList.add('right'); S.done++; setTimeout(function () { if (S && cur() === q) next() }, 450); return }
        S.phase = 'show'; S.done++; renderSession(); return
      }
      S.wrong[keyOf(q.c)] = 1; S.phase = 'show'
      S.queue.splice(Math.min(S.queue.length, S.i + 4), 0, { c: q.c, tries: 1 })
      renderSession(); return
    }
    if (t.hasAttribute('data-dk-dunno') && S.mode === 'recite' && S.phase === 'ask') {
      S.wrong[keyOf(q.c)] = 1; S.phase = 'show'; q.opts = null
      S.queue.splice(Math.min(S.queue.length, S.i + 4), 0, { c: q.c, tries: 1 })
      renderSession(); return
    }
    if (t.hasAttribute('data-dk-check')) { var inp = $('dk-in'); if (inp && S.phase === 'ask') judge(q, inp.value); return }
    if (d.dkWord && S.phase === 'ask') { q.typed = d.dkWord; finish(q, d.dkWord === q.c.w); return }
    if (t.hasAttribute('data-dk-next')) { next(); return }
    if (t.hasAttribute('data-dk-paper')) {
      if (!S.started) { S.started = 1; S.pi = 0; S.done = 0; paperTick(); return }
      S.paused = !S.paused
      if (S.paused) { stop(); S.token++; renderSession() } else paperTick()
      return
    }
    if (t.hasAttribute('data-dk-paperre')) { stop(); S.token = (S.token || 0) + 1; S.paused = false; paperTick(); return }
    if (S.mode === 'table' && tableClick(t, d)) return
    if (t.hasAttribute('data-dk-paperend')) { stop(); S.token = (S.token || 0) + 1; S.phase = 'mark'; S.done = S.total; renderSession(); return }
    if (d.dkMark != null) { var c = S.cards[Number(d.dkMark)], k = keyOf(c); if (S.wrong[k]) delete S.wrong[k]; else S.wrong[k] = 1; renderSession(); return }
    if (t.hasAttribute('data-dk-markdone')) { S.i = S.queue.length; renderSession(); return }
    if (d.dkAgain) {
      var src = d.dkAgain === 'bad' ? S.cards.filter(function (c) { return S.wrong[keyOf(c)] }) : S.cards
      var meta = Object.assign({}, S.meta); if (d.dkAgain === 'bad') { meta.gid = ''; meta.fromWrong = S.mode === 'dictate' || S.mode === 'table' }
      start(S.mode, src, meta); return
    }
    if (t.hasAttribute('data-dk-switch')) { askDictate(S.cards, S.meta); return }
    if (t.hasAttribute('data-dk-nextgroup')) { var m = S.meta; openGroup(S.mode, m.book, m.nextGroup[0], m.nextGroup[1], true); return }
  })
  document.addEventListener('keydown', function (e) {
    if (!S || !document.getElementById('dictation-session-view').classList.contains('active')) return
    if (S.mode === 'learn' && !S.loading && S.i < S.queue.length && !e.isComposing && !e.metaKey && !e.ctrlKey) {
      var lq = cur(), tag = e.target.tagName
      if (S.phase === 'ask' && tag !== 'INPUT') {
        var n = KEYS_NUM.indexOf(e.key)
        if (lq.old && n >= 0 && n < 3) { e.preventDefault(); var rb = document.querySelector('[data-dk-rate="' + (n + 1) + '"]'); if (rb) rb.click(); return }
        if (!lq.old && lq.opts && n >= 0 && lq.st < 2) { e.preventDefault(); var pb = document.querySelector('[data-dk-lpick="' + n + '"]'); if (pb) pb.click(); return }
      }
      if (e.key === 'Enter') {
        if (S.phase === 'ask' && e.target.id === 'dk-lin') { e.preventDefault(); lcheck(); return }
        if (S.phase === 'show' && !S.lastOk) { e.preventDefault(); S.phase = 'detail'; renderSession(); return }
        if (S.phase === 'detail') { e.preventDefault(); ladvance(); return }
      }
      return
    }
    if (e.key !== 'Enter' || e.isComposing) return
    if (S.mode === 'table') {
      if (e.target.classList && e.target.classList.contains('dk-tin')) { e.preventDefault(); var ni = Number(e.target.dataset.dkTi) + 1, nx = $('dk-t-' + ni); if (nx) nx.focus(); else tableSubmit() }
      return
    }
    var q = cur(); if (!q) return
    if (S.phase === 'ask' && e.target.id === 'dk-in') { e.preventDefault(); judge(q, e.target.value); return }
    if (S.phase === 'show') { e.preventDefault(); next() }
  })
  st.gap = [2, 4, 6, 8].indexOf(st.gap) >= 0 ? st.gap : 4
  document.addEventListener('tem8:view', function (e) {
    if (e.detail !== 'dictation-session') document.body.classList.remove('dk-learning')
    if (e.detail === 'dictation') { if (S) { stop(); logSession(); S = null } screen.sheet = 0; render() }
    if (DS && e.detail !== 'dictation' && e.detail !== 'dictation-session') { DS = null; renderDS() }
  })
  document.addEventListener('submit', function (e) { if (e.target.matches && e.target.matches('[data-dk-lspell]')) { e.preventDefault(); lcheck() } })
  document.addEventListener('click', function (e) {
    if (e.target.hasAttribute && e.target.hasAttribute('data-dk-close')) { screen.sheet = 0; render() }
    if (e.target.id === 'dk-dsheet') { DS = null; renderDS() }
  })
  // 词表里打的字随时记下（重画时不丢）
  document.addEventListener('input', function (e) { var t = e.target; if (S && S.mode === 'table' && t.classList && t.classList.contains('dk-tin')) S.vals[Number(t.dataset.dkTi)] = t.value })
  window.addEventListener('afterprint', function () { document.body.classList.remove('dk-printing') })
  // 只有听写页正在显示时才去取词书
  var dv = $('dictation-view')
  if (dv && window.MutationObserver) new MutationObserver(function () { if (dv.classList.contains('active') && !BOOKS.length) render() }).observe(dv, { attributes: true, attributeFilter: ['class'] })
  if (dv && dv.classList.contains('active')) render()
  // 学习统计用：每天背了多少、掌握程度
  window.TEM8_DICTATION = {
    render: render,
    ready: function () { return ensureData() },
    log: function () { return st.log || {} },
    mastery: function () {
      var out = { m: 0, l: 0, e: 0, n: 0, total: 0 }
      allBooks().forEach(function (b) { out.total += countOf(b) })
      var seenW = {}
      for (var k in st.srs) {
        var r = st.srs[k]; if (!r.seen || !book(k.slice(0, k.indexOf('|')))) continue
        seenW[k] = 1
        if ((r.lapse || 0) >= 2 && (r.lv || 0) < 4) out.e++; else if ((r.lv || 0) >= 4) out.m++; else out.l++
      }
      out.n = Math.max(0, out.total - out.m - out.l - out.e)
      return out
    },
    startHard: function () { ensureData().then(startHard) }
  }
})();
