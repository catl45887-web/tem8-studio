/* 拾页 · 浅色 / 深色主题的首页
   - 考试倒计时（日期由用户自己设定）
   - 今日推荐：每天从还没读完的真题里挑一篇，当天不变
   - 今天：复习错题和生词、接着读上次的文章
   - 学习天数：有学习操作的日子记一笔，算连续天数
   只读取已有的学习记录，不改动它们。新增的本机记录：tem8_days、tem8_exam_date、tem8_exam_set、tem8_pick、tem8_last_article */
(function () {
  var $ = function (id) { return document.getElementById(id) }
  function get(k, d) { try { var v = localStorage.getItem(k); return v == null ? d : v } catch (e) { return d } }
  function set(k, v) { try { localStorage.setItem(k, v) } catch (e) {} }
  function json(k, d) { try { return JSON.parse(get(k, '')) || d } catch (e) { return d } }

  // ---------- 日期工具（按本地时间） ----------
  function ymd(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') }
  function parse(s) { var p = String(s || '').split('-').map(Number); return p.length === 3 && p[0] ? new Date(p[0], p[1] - 1, p[2]) : null }
  function dayNo(d) { return Math.round(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() / 864e5) }
  var today = new Date()

  // ---------- 文章数据（与 app.js 同一来源） ----------
  var W = window
  var articles = [].concat(W.TEM8_2026_ARTICLES || [], W.TEM8_2025_ARTICLES || [], W.TEM8_MID_ARTICLES || [], W.TEM8_ARCHIVE_ARTICLES || [], W.TEM8_ARCHIVE_ARTICLES2 || [])
    .filter(function (a) { return a && a.id && a.segments && a.segments.length })
  var questions = [].concat(W.TEM8_2026_QUESTIONS || [], W.TEM8_2025_QUESTIONS || [], W.TEM8_MID_QUESTIONS || [], W.TEM8_ARCHIVE_QUESTIONS || [], W.TEM8_ARCHIVE_QUESTIONS2 || [])
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] }) }
  function store() { return json('tem8_studio_web_v1', {}) }
  function stateOf(id) { var s = store().readingStates || {}; return s[id] || { progress: 0, completed: false } }
  function words(a) { return a.segments.reduce(function (n, s) { return n + String(s.en || '').split(/\s+/).filter(Boolean).length }, 0) }
  function qCount(a) { return questions.filter(function (q) { return q.articleId === a.id }).length }
  function opening(a, max) {
    var t = String(a.segments[0].en || '').replace(/\s+/g, ' ').trim()
    var parts = t.match(/[^.!?]+[.!?]+["”’]?/g) || [t], out = ''
    for (var i = 0; i < parts.length; i++) {
      var next = (out + ' ' + parts[i]).trim()
      if (out && next.length > max) break
      out = next
      if (out.length > max * 0.6) break
    }
    if (out.length > max) out = out.slice(0, out.lastIndexOf(' ', max)) + '…'
    return out
  }

  // 今日推荐：当天固定；优先还没读完的
  function todaysPick() {
    var key = ymd(today), saved = json('tem8_pick', {})
    var found = saved.day === key && articles.filter(function (a) { return a.id === saved.id })[0]
    if (found) return found
    var pool = articles.filter(function (a) { return !stateOf(a.id).completed })
    if (!pool.length) pool = articles
    if (!pool.length) return null
    var a = pool[dayNo(today) % pool.length]
    set('tem8_pick', JSON.stringify({ day: key, id: a.id }))
    return a
  }

  // ---------- 学习天数 ----------
  function days() { var d = json('tem8_days', []); return Array.isArray(d) ? d : [] }
  function markToday() {
    var d = days(), k = ymd(new Date())
    if (d[d.length - 1] === k || d.indexOf(k) >= 0) return
    d.push(k); if (d.length > 800) d = d.slice(-800)
    set('tem8_days', JSON.stringify(d))
  }
  function streak() {
    var s = {}, n = 0; days().forEach(function (k) { s[k] = 1 })
    var d = new Date(); d.setHours(12)
    if (!s[ymd(d)]) d.setDate(d.getDate() - 1)          // 今天还没学，从昨天算起，不打断
    while (s[ymd(d)]) { n++; d.setDate(d.getDate() - 1) }
    return n
  }
  document.addEventListener('tem8:study-changed', function () { markToday(); render() })
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-open-reader][data-article]')
    if (b && b.dataset.article) { set('tem8_last_article', b.dataset.article); markToday() }
  }, true)

  // ---------- 倒计时 ----------
  var input = $('h-exam-date')
  if (input) {
    input.min = ymd(today)
    input.addEventListener('change', function () {
      if (!input.value) return
      set('tem8_exam_date', input.value)
      if (!get('tem8_exam_set', '')) set('tem8_exam_set', ymd(new Date()))
      render()
    })
  }

  function render() {
    if (!$('h-count-line')) return
    today = new Date()

    // 倒计时：一行小字
    var exam = parse(get('tem8_exam_date', ''))
    var left = exam ? dayNo(exam) - dayNo(today) : null
    var line = $('h-count-line')
    if (exam && left > 0) line.innerHTML = '距离专八还有 <b>' + left + '</b> 天'
    else if (exam && left === 0) line.innerHTML = '<b>今天考试，加油</b>'
    else line.textContent = exam ? '考试日期已过' : '距离专八'
    $('h-date-btn').textContent = exam && left >= 0 ? '改日期' : '设定考试日期'
    if (input && exam) input.value = ymd(exam)

    // 继续条：只在有没做完的东西时出现。没交卷的练习优先（继续做…），其次没读完的文章（继续读…）
    var card = $('h-cont')
    if (card) {
      var W = window.TEM8_WORKFLOW, live = W && W.session && W.session()
      var NAME = { lecture: '听力 Section A', interview: '听力 Section B', 'reading-group': '阅读', language: '改错', translation: '翻译', writing: '写作' }
      ;['data-open-reader', 'data-mode', 'data-article', 'data-workflow-resume', 'data-mock-year'].forEach(function (k) { card.removeAttribute(k) })
      var label = '', title = '', state = ''
      if (live && live.groups && live.groups.length) {
        var ys = []; live.groups.forEach(function (g) { if (g.year && ys.indexOf(g.year) < 0) ys.push(g.year) })
        label = '继续做'
        if (live.type === 'mock') { title = live.year + ' 整卷模考'; card.setAttribute('data-mock-year', String(live.year)) }
        else {
          title = (ys.length === 1 ? ys[0] + ' ' : '') + (live.type === 'review' ? (live.label || '错题复习') : (NAME[live.type] || '练习'))
          card.setAttribute('data-workflow-resume', '')
        }
        var answered = Object.keys(live.answers || {}).length
        state = answered ? '已答 ' + answered + ' 题' : ''
      } else {
        var lastId = get('tem8_last_article', '')
        var a = articles.filter(function (x) { return x.id === lastId })[0]
        if (!a || stateOf(a.id).completed || !(stateOf(a.id).progress > 0)) a = articles.filter(function (x) { var s = stateOf(x.id); return s.progress > 0 && !s.completed })[0]
        if (a) {
          var st = stateOf(a.id), total = a.segments.length, n = Math.min(total, st.progress || 0)
          label = '继续读'; title = a.year + ' ' + a.label; state = n + '/' + total + ' 段'
          card.setAttribute('data-open-reader', ''); card.setAttribute('data-mode', 'free'); card.setAttribute('data-article', a.id)
        }
      }
      card.hidden = !label
      card.innerHTML = label ? '<span class="hc-line"><span class="hc-tag">' + label + '</span><span class="hc-title">' + esc(title) + '</span><span class="hc-state">' + esc(state) + '</span><span class="hc-arrow" aria-hidden="true">›</span></span>' : ''
    }
    // 只说做到了的
    var week = $('h-week')
    if (week) {
      var since = dayNo(today) - 6, n7 = days().filter(function (k) { var d = parse(k); return d && dayNo(d) >= since }).length
      week.hidden = !n7
      week.textContent = n7 ? '这一周学了 ' + n7 + ' 天' : ''
    }

  }

  // 让开屏也能用到"今日推荐"
  window.TEM8_TODAY = {
    pick: todaysPick,
    opening: opening
  }

  render()
  document.addEventListener('tem8:view', function (e) { if ({ home: 1, library: 1, papers: 1, mock: 1, intensive: 1 }[e.detail]) render() })
  document.addEventListener('tem8:theme', render)
  var sm = $('stat-mistakes')
  if (sm && window.MutationObserver) new MutationObserver(render).observe(sm, { childList: true, characterData: true, subtree: true })
})();
