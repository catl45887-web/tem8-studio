/* 拾页 · 听写与背诵
   词书来自 wordbooks.js（window.TEM8_WORDBOOKS）。
   - 首页「听写」分段：词书方块 → 词书内按组列出 → 每组可「背诵」或「听写」
   - 背诵：仿不背单词，看词选释义，不认识就看详情，错的排到后面再来
   - 听写：核心词/听力词听音拼写（也可纸笔连播）；形近词听音选词；固定搭配看中文补关键词
   - 发音优先用词典里的真人录音，没有就用浏览器朗读
   记录单独存在 tem8_dict_v1，不动原来的学习记录。 */
(function () {
  'use strict'
  var BOOKS = window.TEM8_WORDBOOKS || []
  var KEY = 'tem8_dict_v1'
  var $ = function (id) { return document.getElementById(id) }
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] }) }
  var DAY = 864e5, INT = [1, 2, 4, 7, 15, 30]

  // ---------- 记录 ----------
  var st = load()
  function load() {
    var d = {}
    try { d = JSON.parse(localStorage.getItem(KEY) || '{}') || {} } catch (e) {}
    d.size = [10, 20, 40].indexOf(d.size) >= 0 ? d.size : 20
    d.accent = d.accent === 'us' ? 'us' : 'uk'
    d.dmode = d.dmode === 'paper' ? 'paper' : 'type'
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
  function book(id) { for (var i = 0; i < BOOKS.length; i++) if (BOOKS[i].id === id) return BOOKS[i]; return null }
  // 统一成卡片：{b 词书, k 类型, w 词/搭配, p 音标, m 释义, ex 例句, exc 例句译文, sib 同组形近词}
  function cardsOf(b, items) {
    var out = []
    items.forEach(function (it) {
      if (b.kind === 'confuse') {
        it.forEach(function (x) { out.push({ b: b.id, k: 'confuse', w: x[0], p: x[1], m: x[2], ex: x[3], exc: x[4], sib: it }) })
      } else if (b.kind === 'phrase') out.push({ b: b.id, k: 'phrase', w: it[0], p: '', m: it[1] })
      else out.push({ b: b.id, k: 'word', w: it[0], p: it[1], m: it[2] })
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
  function dueKeys() { var t = today(), out = []; for (var k in st.srs) if (st.srs[k].due <= t && book(k.slice(0, k.indexOf('|')))) out.push(k); return out }

  // ---------- 发音 ----------
  var dict = window.TEM8_DICTIONARY || (window.TEM8_DICTIONARY = {}), loading = {}
  function loadDict(w) {
    w = String(w).toLowerCase()
    if (!/^[a-z]/.test(w)) return Promise.resolve()
    var P = window.TEM8_DICTIONARY_PREFIXES, b = P ? w.slice(0, 2) : w[0]
    if (P && !P.has(b)) b = w[0]
    if (P && !P.has(b)) return Promise.resolve()
    var src = P ? 'dictionary/prefix/' + b + '.js' : 'dictionary/' + b + '.js'
    if (document.querySelector('script[src^="' + src + '"]')) return loading[src] || Promise.resolve()
    if (!loading[src]) loading[src] = new Promise(function (res) {
      var s = document.createElement('script'); s.src = src; s.onload = s.onerror = function () { res() }; document.head.appendChild(s)
    })
    return loading[src]
  }
  function entry(w) { var e = dict[String(w).toLowerCase()]; return e && e.media ? e : null }
  var audio = null
  function stop() { try { if (audio) audio.pause() } catch (e) {} ; try { speechSynthesis.cancel() } catch (e) {} }
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
      var single = /^[a-z][a-z'-]*$/i.test(text)
      var mapped = (window.TEM8_AUDIOMAP || {})[w]
      var play = function (src) {
        audio = new Audio(src); audio.playbackRate = slow ? 0.7 : 1
        audio.onended = function () { done() }
        audio.onerror = function () { speak() }
        audio.play().catch(function () { speak() })
      }
      var go = function () {
        var e = single && entry(text), src = e && (e.media[st.accent] || e.media.uk || e.media.us)
        if (src) play(src); else speak()
      }
      var speak = function () {
        if (!('speechSynthesis' in window)) { done(); return }
        var u = new SpeechSynthesisUtterance(text)
        u.lang = st.accent === 'us' ? 'en-US' : 'en-GB'; u.rate = slow ? 0.6 : 0.85
        u.onend = u.onerror = function () { done() }
        speechSynthesis.speak(u)
        setTimeout(done, 4000)
      }
      if (mapped) play(mapped[st.accent === 'us' ? 1 : 0])
      else if (single) loadDict(text).then(go); else speak()
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
    var due = dueKeys().length, wrong = st.wrong.length
    var quick = ''
    if (due || wrong) {
      quick = '<div class="dk-quick">' +
        (due ? '<button type="button" class="dk-q" data-dk-review><b>今天要复习</b><span>' + due + ' 个词</span></button>' : '') +
        (wrong ? '<button type="button" class="dk-q" data-dk-wrong><b>听错的词</b><span>' + wrong + ' 个，再听一遍</span></button>' : '') + '</div>'
    }
    var cards = BOOKS.map(function (b) {
      var n = countOf(b), learned = learnedIn(b), units = ' · ' + b.units.length + (b.kind === 'confuse' ? ' 类' : b.kind === 'phrase' ? ' 个词块' : ' 个主题')
      return '<button type="button" class="dk-bk" data-dk-book="' + b.id + '"><span class="dk-bk-t"><b>' + esc(b.name) + '</b><span>' + n + (b.kind === 'phrase' ? ' 条' : ' 词') + units + ' · ' + BOOK_NOTE[b.id] + '</span></span>' + (learned ? '<em>已背 ' + learned + '</em>' : '') + '<i aria-hidden="true">›</i></button>'
    }).join('')
    return quick + '<div class="dk-opts"><span>每组</span>' + seg('size', [[10, '10'], [20, '20'], [40, '40']], st.size) + '<span class="dk-gap"></span>' + seg('accent', [['uk', '英音'], ['us', '美音']], st.accent) + '</div>' +
      '<div class="dk-books">' + cards + '</div>'
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
          '<button type="button" class="dk-act" data-dk-go="recite" data-dk-sec="' + si + '" data-dk-grp="' + gi + '">背诵</button><button type="button" class="dk-act dk-act-2" data-dk-go="dictate" data-dk-sec="' + si + '" data-dk-grp="' + gi + '">听写</button></div>'
      }).join('')
      return (s.name ? '<h3 class="dk-sec">' + esc(s.name) + (s.sub ? '<small>' + esc(s.sub) + '</small>' : '') + '</h3>' : '') + '<div class="dk-group">' + rows + '</div>'
    }).join('')
    return '<div class="dk-bookhead"><button type="button" class="dk-back" data-dk-home aria-label="返回词书">‹</button><div><h2>' + esc(b.name) + '</h2><p>' + countOf(b) + (b.kind === 'phrase' ? ' 条' : ' 词') + ' · 每组 ' + (b.kind === 'confuse' ? '约 ' : '') + st.size + (b.kind === 'phrase' ? ' 条' : ' 词') + '</p></div></div>' + body
  }
  function render() {
    var el = $('dictation-content'); if (!el) return
    el.innerHTML = screen.name === 'book' ? renderBook() : renderHome()
  }

  // ---------- 练习 ----------
  var S = null // 当前一轮
  function showView(name) {
    document.querySelectorAll('.view').forEach(function (v) { v.classList.toggle('active', v.id === name + '-view') })
    window.scrollTo(0, 0)
  }
  function start(mode, cards, meta) {
    if (!cards.length) return
    S = { mode: mode, cards: cards, meta: meta || {}, queue: [], i: 0, phase: 'ask', first: {}, wrong: {}, done: 0, total: cards.length }
    if (mode === 'recite') S.queue = shuffle(cards).map(function (c) { return { c: c, tries: 0 } })
    else S.queue = shuffle(cards).map(function (c) { return { c: c } })
    if (mode === 'dictate' && cards[0].k === 'word' && st.dmode === 'paper') { S.paper = true }
    showView('dictation-session')
    // 先把这组词的词典分片取回来，发音和例句都靠它
    Promise.all(cards.filter(function (c) { return /^[a-z]/i.test(c.w) && c.w.indexOf(' ') < 0 }).map(function (c) { return loadDict(c.w) })).then(function () { if (S && ((S.paper && !S.started) || S.mode === 'recite')) renderSession() })
    renderSession()
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
    var e = c.k === 'word' && entry(c.w)
    if (e && e.examples && e.examples[0]) return e.examples[0]
    return null
  }
  function detail(c) {
    var ex = example(c)
    var sib = c.sib && c.sib.length > 1 ? '<div class="dk-sibs">' +  c.sib.map(function (x) { return '<div class="dk-sib' + (x[0] === c.w ? ' on' : '') + '"><b>' + esc(x[0]) + (x[1] ? ' <i>/' + esc(x[1]) + '/</i>' : '') + '</b><span>' + esc(x[2]) + '</span>' + (x[3] ? '<span class="dk-sib-ex">' + esc(x[3]) + '</span>' : '') + '</div>' }).join('') + '</div>' : ''
    if (sib) return '<div class="dk-detail dk-detail-sib">' + sib + '</div>'
    return '<div class="dk-detail"><p class="dk-mean">' + esc(c.m) + '</p>' + (ex ? '<p class="dk-ex">' + esc(ex.en) + (ex.cn ? '<span>' + esc(ex.cn) + '</span>' : '') + '</p>' : '') + sib + '</div>'
  }
  function phonOf(c) { if (c.p) return c.p; var e = c.k === 'word' && entry(c.w); return e && e.oxford && e.oxford.phon || '' }
  function wordHead(c, hide) {
    var ph = phonOf(c)
    return '<div class="dk-word"><h2' + (hide ? ' class="dk-hidden"' : '') + '>' + esc(c.w) + '</h2>' + (ph ? '<p class="dk-phon">/' + esc(ph) + '/</p>' : '') +
      '<button type="button" class="dk-say" data-dk-say aria-label="发音">' + SPEAK + '</button></div>'
  }

  function renderSession() {
    var el = $('dictation-session-content'); if (!el || !S) return
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
    var modeSw = c.k === 'word' && S.i === 0 && S.phase === 'ask' && !S.touched ? '<div class="dk-modesw">' + seg('dmode', [['type', '键盘拼写'], ['paper', '纸笔连播']], st.dmode) + '</div>' : ''
    el.innerHTML = bar(title) + '<div class="dk-card dk-card-d">' + modeSw + inner + foot + '</div>'
    var input = $('dk-in')
    if (input && S.phase === 'ask') setTimeout(function () { try { input.focus({ preventScroll: true }) } catch (e) {} }, 30)
    if (S.phase === 'ask' && !q.said && c.k !== 'phrase') { q.said = 1; setTimeout(function () { say(c.w) }, 200) }
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
    el.innerHTML = bar(title) + '<div class="dk-card dk-card-d"><div class="dk-modesw">' + (S.started ? '' : seg('dmode', [['type', '键盘拼写'], ['paper', '纸笔连播']], st.dmode)) + '</div>' +
      '<p class="dk-papern">' + (S.started ? '第 <b>' + Math.min(n + 1, S.cards.length) + '</b> 个' : '准备好纸笔') + '</p>' +
      '<p class="dk-tip">' + (S.started ? '每个词读两遍，' + st.gap + ' 秒后下一个' : '共 ' + S.cards.length + ' 个词，每个读两遍，按序号写下来') + '</p>' +
      '<div class="dk-gaps">' + (S.started ? '' : '间隔 ' + seg('gap', [[3, '3 秒'], [5, '5 秒'], [8, '8 秒']], st.gap)) + '</div>' +
      '<button type="button" class="dk-next" data-dk-paper>' + (S.started ? (S.paused ? '继续' : '暂停') : '开始') + '</button>' +
      (S.started ? '<button type="button" class="dk-dunno" data-dk-paperend>直接对答案</button>' : '') + '</div>'
  }
  function paperTick() {
    if (!S || !S.paper || S.paused || S.phase === 'mark') return
    var n = S.pi || 0, token = S.token = (S.token || 0) + 1
    if (n >= S.cards.length) { S.phase = 'mark'; S.done = S.total; renderSession(); return }
    renderSession()
    var w = S.cards[n].w
    say(w).then(function () { return wait(1200) }).then(function () { if (S && S.token === token && !S.paused) return say(w) })
      .then(function () { return wait(st.gap * 1000) }).then(function () {
        if (!S || S.token !== token || S.paused) return
        S.pi = n + 1; S.done = S.pi; paperTick()
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
  function renderResult(el) {
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
      if (S.mode === 'dictate') {
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
  function openGroup(mode, bid, si, gi) {
    var b = book(bid), g = b && groupAt(b, si, gi)
    if (g) start(mode, g.cards, g.meta)
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
    if (d.dkBook) { screen = { name: 'book', book: d.dkBook }; render(); window.scrollTo(0, 0); return }
    if (t.hasAttribute('data-dk-home')) { screen = { name: 'home' }; render(); window.scrollTo(0, 0); return }
    if (d.dkGo) { openGroup(d.dkGo, screen.book, Number(d.dkSec), Number(d.dkGrp)); return }
    if (t.hasAttribute('data-dk-review')) {
      var cards = dueKeys().map(findCard).filter(Boolean).slice(0, st.size)
      start('recite', cards, { title: '今天复习' }); return
    }
    if (t.hasAttribute('data-dk-wrong')) {
      var cs = st.wrong.map(findCard).filter(Boolean)
      var w = cs.filter(function (c) { return c.k === 'word' }), o = cs.filter(function (c) { return c.k !== 'word' })
      start('dictate', (w.length ? w : o).slice(0, 40), { title: '听错的词', fromWrong: 1 }); return
    }
    if (!S) return
    var q = cur()
    if (t.hasAttribute('data-dk-exit')) { stop(); S = null; showView('dictation'); render(); return }
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
    if (t.hasAttribute('data-dk-paperend')) { stop(); S.token = (S.token || 0) + 1; S.phase = 'mark'; S.done = S.total; renderSession(); return }
    if (d.dkMark != null) { var c = S.cards[Number(d.dkMark)], k = keyOf(c); if (S.wrong[k]) delete S.wrong[k]; else S.wrong[k] = 1; renderSession(); return }
    if (t.hasAttribute('data-dk-markdone')) { S.i = S.queue.length; renderSession(); return }
    if (d.dkAgain) {
      var src = d.dkAgain === 'bad' ? S.cards.filter(function (c) { return S.wrong[keyOf(c)] }) : S.cards
      var meta = Object.assign({}, S.meta); if (d.dkAgain === 'bad') { meta.gid = ''; meta.fromWrong = S.mode === 'dictate' }
      start(S.mode, src, meta); return
    }
    if (t.hasAttribute('data-dk-switch')) { start('dictate', S.cards, S.meta); return }
    if (t.hasAttribute('data-dk-nextgroup')) { var m = S.meta; openGroup(S.mode, m.book, m.nextGroup[0], m.nextGroup[1]); return }
  })
  document.addEventListener('keydown', function (e) {
    if (!S || !document.getElementById('dictation-session-view').classList.contains('active')) return
    if (e.key !== 'Enter' || e.isComposing) return
    var q = cur(); if (!q) return
    if (S.phase === 'ask' && e.target.id === 'dk-in') { e.preventDefault(); judge(q, e.target.value); return }
    if (S.phase === 'show') { e.preventDefault(); next() }
  })
  st.gap = [3, 5, 8].indexOf(st.gap) >= 0 ? st.gap : 5
  document.addEventListener('tem8:view', function (e) { if (e.detail === 'dictation') { if (S) { stop(); S = null } render() } })
  render()
  window.TEM8_DICTATION = { render: render }
})();
