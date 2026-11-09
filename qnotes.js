/* 做题笔记：每道题下面一条条的小笔记（错因标签 + 一两句话）
 *  - 只在“看答案”的时候出现：精读页题目栏、交卷后的解析里；做题过程中没有
 *  - 同一道题在精读里写的、交卷后写的，都记在同一道题下面，按时间排在一起
 *  - 复习 › 笔记页：按题型（阅读 / 听力 / 改错 / 翻译 / 写作）和场景（精读 / 练习 / 模考 / 错题复习）筛选，
 *    按错因标签筛选，点“去这题”回到原题
 * 数据放在 tem8_workflow_v2.qnotes（随做题记录一起云同步）：
 *   { [题目key]: { meta:{label,kind,prompt,aid,num}, entries:[{id,t,tags[],from,at,up}] } } */
;(function () {
  'use strict'
  var KEY = 'tem8_workflow_v2'
  var TAGS = ['没读懂', '定位错', '同义替换', '干扰项', '推断过度', '词汇', '粗心', '时间不够', '好方法']
  var KINDS = ['阅读', '听力', '改错', '翻译', '写作']
  var FROMS = ['精读', '练习', '模考', '错题复习']
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] }) }
  function load() { try { return JSON.parse(localStorage.getItem(KEY)) || {} } catch (e) { return {} } }
  function write(fn) {
    var s = load(); fn(s)
    try { localStorage.setItem(KEY, JSON.stringify(s)) } catch (e) {}
    if (!window.TEM8_SYNC_FLUSHING) document.dispatchEvent(new Event('tem8:study-changed'))
  }
  function all() { return load().qnotes || {} }
  function rec(key) { return all()[key] || null }
  function day(t) { var d = new Date(t); return (d.getFullYear() !== new Date().getFullYear() ? d.getFullYear() + '年' : '') + (d.getMonth() + 1) + '月' + d.getDate() + '日' }
  function count(key) { var r = rec(key); return r ? r.entries.length : 0 }

  /* ---------- 题下的笔记框 ---------- */
  // meta: { label:'2023 · Passage One · Q3', kind:'阅读', prompt:'…', aid, num }  from: '精读' | '练习' | '模考' | '错题复习'
  function entryHTML(key, e) {
    return '<div class="qn-e" data-qn-id="' + esc(e.id) + '"><div class="qn-e-h"><time>' + day(e.at) + '</time><span class="qn-from">' + esc(e.from || '') + '</span>' +
      (e.tags || []).map(function (t) { return '<span class="qn-tag' + (t === '好方法' ? ' good' : '') + '">' + esc(t) + '</span>' }).join('') +
      '<span class="qn-sp"></span><button type="button" data-qn-edit="' + esc(e.id) + '">修改</button><button type="button" data-qn-del="' + esc(e.id) + '">删除</button></div>' +
      (e.t ? '<p>' + esc(e.t).replace(/\n/g, '<br>') + '</p>' : '') + '</div>'
  }
  function box(key, meta, from) {
    var r = rec(key), list = r ? r.entries : []
    return '<div class="qn" data-qn="' + esc(key) + '" data-qn-from="' + esc(from || '') + '" data-qn-meta="' + esc(JSON.stringify(meta || {})) + '">' +
      '<div class="qn-list">' + list.map(function (e) { return entryHTML(key, e) }).join('') + '</div>' +
      '<button type="button" class="qn-add" data-qn-add>' + (list.length ? '＋ 再记一条' : '＋ 记笔记 · 这题错在哪 / 学到什么') + '</button></div>'
  }
  function formHTML(e) {
    var on = (e && e.tags) || []
    return '<div class="qn-form"><div class="qn-tags" role="group" aria-label="错因标签">' + TAGS.map(function (t) {
      var sel = on.indexOf(t) >= 0
      return '<button type="button" class="qn-chip' + (t === '好方法' ? ' good' : '') + (sel ? ' on' : '') + '" data-qn-tag="' + esc(t) + '" aria-pressed="' + sel + '">' + esc(t) + '</button>'
    }).join('') + '</div><textarea rows="3" data-qn-text placeholder="一两句话：错在哪、正确思路是什么、下次怎么避免">' + esc(e ? e.t : '') + '</textarea>' +
      '<div class="qn-acts"><button type="button" class="qn-cancel" data-qn-cancel>取消</button><button type="button" class="qn-save" data-qn-save' + (e ? ' data-qn-edit-id="' + esc(e.id) + '"' : '') + '>保存</button></div></div>'
  }
  function repaint(el) {
    var key = el.dataset.qn, meta = {}
    try { meta = JSON.parse(el.dataset.qnMeta || '{}') } catch (x) {}
    var tmp = document.createElement('div'); tmp.innerHTML = box(key, meta, el.dataset.qnFrom)
    el.replaceWith(tmp.firstChild)
  }
  function openForm(el, e) {
    el.querySelector('.qn-form') && el.querySelector('.qn-form').remove()
    var add = el.querySelector('.qn-add'); if (add) add.hidden = true
    if (e) { var row = el.querySelector('[data-qn-id="' + e.id + '"]'); if (row) row.hidden = true }
    el.insertAdjacentHTML('beforeend', formHTML(e))
    var ta = el.querySelector('[data-qn-text]'); if (ta) { ta.focus({ preventScroll: true }); ta.setSelectionRange(ta.value.length, ta.value.length) }
  }
  function syncReason(key, tags) {
    // 错题本里的“错因”沿用第一个对得上的标签
    var R = (window.TEM8_WORKFLOW && window.TEM8_WORKFLOW.REASONS) || []
    var r = (tags || []).filter(function (t) { return R.indexOf(t) >= 0 })[0]
    if (!r) return
    write(function (s) { var m = s.tools && s.tools['m:' + key]; if (m) m.r = r })
  }
  function save(el, editId) {
    var key = el.dataset.qn, meta = {}
    try { meta = JSON.parse(el.dataset.qnMeta || '{}') } catch (x) {}
    var t = String((el.querySelector('[data-qn-text]') || {}).value || '').trim()
    var tags = [].map.call(el.querySelectorAll('.qn-chip.on'), function (b) { return b.dataset.qnTag })
    if (!t && !tags.length) { repaint(el); return }
    var now = Date.now()
    write(function (s) {
      s.qnotes = s.qnotes || {}
      var r = s.qnotes[key] = s.qnotes[key] || { entries: [] }
      r.meta = Object.assign({}, r.meta || {}, meta)
      if (editId) { var e = r.entries.find(function (x) { return x.id === editId }); if (e) { e.t = t; e.tags = tags; e.up = now } }
      else r.entries.push({ id: now.toString(36) + Math.random().toString(36).slice(2, 5), t: t, tags: tags, from: el.dataset.qnFrom || '', at: now })
    })
    syncReason(key, tags)
    repaint(el)
    if (pageEl && pageEl.isConnected) renderPage()
  }
  function del(el, id) {
    if (!window.confirm('删除这条笔记？')) return
    var key = el.dataset.qn
    write(function (s) {
      var r = s.qnotes && s.qnotes[key]; if (!r) return
      r.entries = r.entries.filter(function (x) { return x.id !== id })
      if (!r.entries.length) delete s.qnotes[key]
    })
    repaint(el)
  }

  /* ---------- 复习 › 笔记页 ---------- */
  var pageEl = null, fKind = '', fFrom = '', fTag = ''
  function flat() {
    var out = [], A = all()
    Object.keys(A).forEach(function (k) {
      var r = A[k]; if (!r || !r.entries || !r.entries.length) return
      out.push({ key: k, meta: r.meta || {}, entries: r.entries.slice().sort(function (a, b) { return a.at - b.at }), last: Math.max.apply(null, r.entries.map(function (e) { return e.up || e.at })) })
    })
    return out.sort(function (a, b) { return b.last - a.last })
  }
  function match(q) {
    if (fKind && q.meta.kind !== fKind) return false
    return q.entries.some(function (e) { return (!fFrom || e.from === fFrom) && (!fTag || (e.tags || []).indexOf(fTag) >= 0) })
  }
  function chips(name, list, cur, counts) {
    return '<div class="qnp-row" role="group"><button type="button" class="qnp-chip' + (!cur ? ' on' : '') + '" data-qnp="' + name + '" data-v="">全部</button>' +
      list.filter(function (v) { return counts[v] }).map(function (v) {
        return '<button type="button" class="qnp-chip' + (cur === v ? ' on' : '') + '" data-qnp="' + name + '" data-v="' + esc(v) + '">' + esc(v) + ' <small>' + counts[v] + '</small></button>'
      }).join('') + '</div>'
  }
  function pageHTML() {
    var L = flat()
    if (!L.length) return '<div class="qnp-empty"><p>还没有做题笔记。</p><p>交卷后在每道题的解析下面，或者精读页的题目栏里，点“记笔记”写下这题错在哪、学到什么。考前在这里按错因翻一遍。</p></div>'
    var ck = {}, cf = {}, ct = {}
    L.forEach(function (q) {
      ck[q.meta.kind] = (ck[q.meta.kind] || 0) + 1
      var seenF = {}, seenT = {}
      q.entries.forEach(function (e) { seenF[e.from] = 1; (e.tags || []).forEach(function (t) { seenT[t] = 1 }) })
      Object.keys(seenF).forEach(function (f) { cf[f] = (cf[f] || 0) + 1 })
      Object.keys(seenT).forEach(function (t) { ct[t] = (ct[t] || 0) + 1 })
    })
    var shown = L.filter(match)
    var n = shown.reduce(function (s, q) { return s + q.entries.length }, 0)
    return '<div class="qnp-filters">' + chips('kind', KINDS, fKind, ck) + chips('from', FROMS, fFrom, cf) +
      (Object.keys(ct).length ? '<div class="qnp-tagrow"><span>错因</span>' + chips('tag', TAGS, fTag, ct) + '</div>' : '') + '</div>' +
      '<p class="qnp-sum">' + shown.length + ' 道题 · ' + n + ' 条笔记</p>' +
      (shown.length ? shown.map(function (q) {
        var m = q.meta
        return '<article class="qnp-card"><header><b>' + esc(m.label || q.key) + '</b><button type="button" class="qnp-go" data-qnp-go="' + esc(q.key) + '">去这题 →</button></header>' +
          (m.prompt ? '<p class="qnp-prompt">' + esc(m.prompt) + '</p>' : '') +
          box(q.key, m, '').replace('<button type="button" class="qn-add" data-qn-add>', '<button type="button" class="qn-add" data-qn-add hidden>') + '</article>'
      }).join('') : '<p class="qnp-none">没有符合筛选的笔记。</p>')
  }
  function renderPage(el) {
    if (el) pageEl = el
    if (pageEl) pageEl.innerHTML = pageHTML()
  }
  function goTo(key) {
    var r = rec(key), m = (r && r.meta) || {}
    if (m.aid && window.TEM8_RQ && window.TEM8_RQ.openAt) { window.TEM8_RQ.openAt(m.aid, m.num); return }
    var W = window.TEM8_WORKFLOW
    if (W && W.startKeys && W.startKeys([key], '笔记回看')) return
    if (W && W.openConfig && m.kind) {
      var y = /^(\w+)-(\d{4})/.exec(key)
      W.openConfig(y ? y[1] : 'reading-group')
    }
  }

  /* ---------- 事件 ---------- */
  document.addEventListener('click', function (ev) {
    var b = ev.target.closest && ev.target.closest('button'); if (!b) return
    var d = b.dataset
    if (d.qnp !== undefined) { if (d.qnp === 'kind') fKind = d.v; else if (d.qnp === 'from') fFrom = d.v; else fTag = d.v; renderPage(); return }
    if (d.qnpGo) { ev.stopPropagation(); goTo(d.qnpGo); return }
    var el = b.closest('.qn'); if (!el) return
    ev.stopPropagation()
    if (d.qnAdd !== undefined) { openForm(el, null); return }
    if (d.qnTag) { var on = !b.classList.contains('on'); b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); return }
    if (d.qnCancel !== undefined) { repaint(el); return }
    if (d.qnSave !== undefined) { save(el, d.qnEditId); return }
    if (d.qnDel) { del(el, d.qnDel); return }
    if (d.qnEdit) {
      var r = rec(el.dataset.qn), e = r && r.entries.find(function (x) { return x.id === d.qnEdit })
      if (e) openForm(el, e)
    }
  }, true)
  // 笔记框里打字不要触发做题页的快捷键（A–D、F）
  document.addEventListener('keydown', function (ev) { if (ev.target.closest && ev.target.closest('.qn-form')) ev.stopPropagation() }, true)

  // 把一段英文里的单词变成可点的按钮（交给 app.js 的查词）
  function lk(text) {
    text = String(text == null ? '' : text)
    var out = '', pos = 0, m, re = /[A-Za-z]+(?:[’'][A-Za-z]+)?/g
    while ((m = re.exec(text))) {
      out += esc(text.slice(pos, m.index)) + '<button type="button" class="lk" data-word="' + esc(m[0].toLowerCase().replace(/[’']/g, "'")) + '">' + esc(m[0]) + '</button>'
      pos = m.index + m[0].length
    }
    return '<span class="lkw">' + out + esc(text.slice(pos)) + '</span>'
  }

  // 复习 › 笔记：「做题笔记」「原文笔记」两页
  var hubTab = 'q'
  function renderHub(el) {
    if (!el) return
    var n = Object.keys(all()).length
    el.innerHTML = '<div class="qnp-tabs" role="tablist"><button type="button" role="tab" data-qnp-tab="q" aria-selected="' + (hubTab === 'q') + '">做题笔记' + (n ? ' <small>' + n + '</small>' : '') + '</button><button type="button" role="tab" data-qnp-tab="a" aria-selected="' + (hubTab === 'a') + '">原文标记</button></div><div class="qnp-body"></div>'
    var body = el.querySelector('.qnp-body')
    if (hubTab === 'q') renderPage(body)
    else if (window.TEM8_ANNO && window.TEM8_ANNO.renderPage) window.TEM8_ANNO.renderPage(body)
    if (!el._qnp) { el._qnp = 1; el.addEventListener('click', function (e) { var b = e.target.closest('[data-qnp-tab]'); if (b) { hubTab = b.dataset.qnpTab; renderHub(el) } }) }
  }

  window.TEM8_QNOTES = { box: box, count: count, renderPage: renderPage, renderHub: renderHub, lk: lk, TAGS: TAGS }
})()
