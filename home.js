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
    if (!$('h-days')) return
    today = new Date()
    var CN = '日一二三四五六'

    // 倒计时
    var exam = parse(get('tem8_exam_date', ''))
    var left = exam ? dayNo(exam) - dayNo(today) : null
    if (exam && left >= 0) {
      $('h-days').textContent = left
      $('h-days-cap').textContent = left === 0 ? '今天考试，加油' : '距离专八'
      $('h-date-btn').textContent = '改日期'
      if (input) input.value = ymd(exam)
      var d0 = parse(days()[0]) || parse(get('tem8_exam_set', '')) || today
      var setDay = parse(get('tem8_exam_set', ''))
      if (setDay && setDay < d0) d0 = setDay
      var total = Math.max(1, dayNo(exam) - dayNo(d0)), gone = Math.min(total, Math.max(0, dayNo(today) - dayNo(d0)))
      var pct = Math.round(gone / total * 100)
      $('h-track-fill').style.width = pct + '%'
      $('h-track-start').textContent = (d0.getMonth() + 1) + '月' + d0.getDate() + '日 开始'
      $('h-track-pct').textContent = '已走过 ' + pct + '%'
      document.querySelector('.h-count').classList.remove('h-unset')
    } else {
      $('h-days').textContent = '—'
      $('h-days-cap').textContent = exam ? '考试日期已过' : '距离专八'
      $('h-date-btn').textContent = '设定考试日期'
      $('h-track-fill').style.width = '0%'
      $('h-track-start').textContent = (today.getMonth() + 1) + '月' + today.getDate() + '日 · 星期' + CN[today.getDay()]
      $('h-track-pct').textContent = ''
      document.querySelector('.h-count').classList.add('h-unset')
    }

    // 今日推荐
    var a = todaysPick()
    if (a) {
      $('h-pick').hidden = false
      $('h-pick-label').textContent = '今日推荐 · ' + a.year + ' 阅读 ' + String(a.label || '').toUpperCase()
      $('h-pick-text').textContent = opening(a, 120)
      var st = stateOf(a.id), q = qCount(a)
      $('h-pick-meta').textContent = words(a) + ' 词 · ' + a.segments.length + ' 段' + (q ? ' · ' + q + ' 题' : '') + (st.completed ? ' · 已读完' : (st.progress ? ' · 读到第 ' + Math.min(st.progress, a.segments.length) + ' 段' : ''))
      $('h-pick-read').dataset.article = a.id
      $('h-pick-read').textContent = st.progress && !st.completed ? '接着精读' : '开始精读'
      $('h-pick-do').dataset.article = a.id
      $('h-pick-do').hidden = !q
    }

    // 今天：复习
    var mistakes = parseInt(($('stat-mistakes') || {}).textContent, 10) || 0
    var wb = (store().wordbook || []).length
    var rv = $('h-review')
    if (mistakes || wb) {
      var parts = []
      if (mistakes) parts.push('<b class="h-red">' + mistakes + '</b> 道错题')
      if (wb) parts.push('<b>' + wb + '</b> 个生词')
      $('h-review-text').innerHTML = '复习 ' + parts.join('、')
      $('h-review-end').textContent = '约 ' + Math.max(2, Math.round(mistakes * 1.5 + wb * 0.2)) + ' 分钟 →'
      rv.dataset.view = mistakes ? 'mistakes' : 'words'
    } else {
      $('h-review-text').textContent = '还没有错题和生词'
      $('h-review-end').textContent = '去做一组题 →'
      rv.dataset.view = 'papers'
    }

    // 今天：接着读
    var lastId = get('tem8_last_article', '')
    var going = articles.filter(function (x) { var s = stateOf(x.id); return s.progress > 0 && !s.completed })
    var cont = going.filter(function (x) { return x.id === lastId })[0] || going[0]
    var cb = $('h-continue')
    if (cont && (!a || cont.id !== a.id)) {
      var cs = stateOf(cont.id), tot = cont.segments.length, n = Math.min(cs.progress, tot)
      cb.hidden = false
      cb.dataset.article = cont.id
      $('h-continue-text').textContent = '接着读 ' + cont.year + ' ' + (cont.label || '')
      $('h-continue-end').textContent = n + ' / ' + tot + ' 段 →'
      $('h-continue-fill').style.width = Math.round(n / tot * 100) + '%'
    } else cb.hidden = true

    // 连续天数：用一句话说
    var n2 = streak(), all = days().length
    $('h-streak').innerHTML = all
      ? (n2 ? '你已经连续学习 <b>' + n2 + '</b> 天' : '昨天没有学习，今天重新开始') + (all > n2 ? '，一共学了 <b>' + all + '</b> 天。' : '。')
      : '读完一段、做一道题，都会记作今天学过。'
  }

  // 让开屏也能用到"今日推荐"
  window.TEM8_TODAY = {
    pick: todaysPick,
    opening: opening
  }

  render()
  document.addEventListener('tem8:view', function (e) { if (e.detail === 'home') render() })
  document.addEventListener('tem8:theme', render)
  var sm = $('stat-mistakes')
  if (sm && window.MutationObserver) new MutationObserver(render).observe(sm, { childList: true, characterData: true, subtree: true })
})();
