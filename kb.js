/* 主观题打字：题目不被键盘挡住
 *  方案 A「系统键盘」：照常弹系统键盘，题目（简答题题干 / 翻译原文 / 写作要求 / 改错那一行 / 听力那一行提纲）
 *         钉在屏幕上方的一条里，输入框接在它下面，键盘弹多高都看得到题
 *  方案 B「内置键盘」：不弹系统键盘，网站自己在底部画一个紧凑的英文键盘（专八主观题都写英文），
 *         上面同样钉着题目；这个模式下只能用屏幕上的键盘打字，外接键盘、粘贴、语音输入都不进输入框
 *  只在触屏（手机、iPad）上生效；电脑上照常。做题页顶部「键盘」按钮切换，记在 localStorage['tem8_kb'] */
;(function () {
  'use strict'
  var PREF = 'tem8_kb'
  var touch = window.matchMedia && matchMedia('(pointer: coarse)').matches
  if (/[?&]kbtest\b/.test(location.search)) touch = true
  var vv = window.visualViewport
  var FIELDS = '[data-workflow-short],[data-workflow-text],[data-workflow-blank],[data-workflow-error-text]'
  function mode() { try { return localStorage.getItem(PREF) === 'builtin' ? 'builtin' : 'system' } catch (e) { return 'system' } }
  function setMode(m) { try { localStorage.setItem(PREF, m) } catch (e) {} }
  function owns(el) { return touch && !!(el && el.matches && el.matches(FIELDS) && el.closest('#workflow-session-view')) }
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] }) }

  /* ---------- 题目从哪儿来 ---------- */
  function sourceOf(el) {
    var q = el.closest('.pq-q')
    if (q && q.querySelector('h4')) return { label: (q.querySelector('.pq-qhead span') || {}).textContent || '题目', html: esc(q.querySelector('h4').textContent) }
    if (el.matches('[data-workflow-text]')) {
      var k = el.dataset.workflowText
      if (/^translation/.test(k)) { var s = document.querySelector('#workflow-session-view .pq-src'); if (s) return { label: '翻译原文', html: s.innerHTML } }
      var w = document.querySelector('#workflow-session-view .px-wmat .workflow-prompt'); if (w) return { label: '写作要求', html: w.innerHTML }
    }
    if (el.matches('[data-workflow-error-text]')) {
      var row = el.closest('.pq-pl,.pq-proof-row,li,tr,p'); var t = row && row.querySelector('.pq-pl-t,.pq-pl-text')
      if (t || row) return { label: '改错 · 这一行', html: esc((t || row).textContent.replace(/\s+/g, ' ').trim()) }
    }
    if (el.matches('[data-workflow-blank]')) {
      var gap = document.getElementById('gap-' + el.dataset.workflowBlank)
      var line = gap && (gap.closest('p,li,.px-oline') || gap.parentElement)
      if (line) return { label: '提纲 · 这一空', html: line.innerHTML }
    }
    return null
  }

  /* ---------- 钉在上方的题目条 ---------- */
  var pin = null, kb = null, cur = null, shift = false, layer = 'abc', auto = true
  function ensurePin() {
    if (pin) return pin
    pin = document.createElement('div'); pin.className = 'kb-pin'; pin.hidden = true
    pin.innerHTML = '<div class="kb-pin-h"><b></b><button type="button" data-kb-pinfold aria-label="收起题目">收起</button></div><div class="kb-pin-body"></div>'
    pin.addEventListener('pointerdown', function (e) { if (e.target.closest('button')) e.preventDefault() })
    pin.addEventListener('click', function (e) { if (e.target.closest('[data-kb-pinfold]')) { pin.classList.toggle('folded'); pin.querySelector('[data-kb-pinfold]').textContent = pin.classList.contains('folded') ? '展开' : '收起'; layout() } })
    document.body.appendChild(pin)
    return pin
  }
  function showPin(el) {
    var s = sourceOf(el); ensurePin()
    if (!s) { pin.hidden = true; return }
    pin.querySelector('b').textContent = s.label
    pin.querySelector('.kb-pin-body').innerHTML = s.html
    pin.hidden = false
    var mk = pin.querySelector('mark'); if (mk) setTimeout(function () { mk.scrollIntoView({ block: 'nearest' }) }, 30)
  }

  /* ---------- 内置键盘 ---------- */
  var ROWS = {
    abc: ['qwertyuiop', 'asdfghjkl', '⇧zxcvbnm⌫', ['123', ',', '␣', '.', '⏎']],
    num: ['1234567890', ['-', '/', ':', ';', '(', ')', '"', "'", '?', '!'], ['∧', '—', '&', '%', '$', '@', '#', '*', '⌫'], ['ABC', ',', '␣', '.', '⏎']]
  }
  function keyHTML(k) {
    var cls = 'kb-k', lab = k
    if (k === '⇧') { cls += ' kb-fn kb-shift' + (shift ? ' on' : ''); lab = '⇧' }
    else if (k === '⌫') { cls += ' kb-fn'; lab = '⌫' }
    else if (k === '123' || k === 'ABC') cls += ' kb-fn kb-w15'
    else if (k === '␣') { cls += ' kb-space'; lab = 'space' }
    else if (k === '⏎') { cls += ' kb-fn kb-enter kb-w15'; lab = cur && cur.tagName === 'TEXTAREA' ? '换行' : '下一个' }
    else if (shift && /^[a-z]$/.test(k)) lab = k.toUpperCase()
    return '<button type="button" class="' + cls + '" data-k="' + esc(k) + '">' + esc(lab) + '</button>'
  }
  function drawKb() {
    if (!kb) {
      kb = document.createElement('div'); kb.className = 'kb'; kb.hidden = true; kb.setAttribute('role', 'group'); kb.setAttribute('aria-label', '内置英文键盘')
      kb.addEventListener('pointerdown', onKey)
      kb.addEventListener('pointerup', stopRepeat); kb.addEventListener('pointercancel', stopRepeat); kb.addEventListener('pointerleave', stopRepeat)
      kb.addEventListener('click', function (e) { e.preventDefault() })
      document.body.appendChild(kb)
    }
    kb.innerHTML = '<div class="kb-bar"><span>内置键盘</span><button type="button" class="kb-hide" data-k="hide">完成</button></div>' +
      ROWS[layer].map(function (r) { return '<div class="kb-row">' + (typeof r === 'string' ? r.split('') : r).map(keyHTML).join('') + '</div>' }).join('')
  }
  function insert(txt) {
    var el = cur; if (!el) return
    var a = el.selectionStart, b = el.selectionEnd
    if (a == null) { el.value += txt } else el.setRangeText(txt, a, b, 'end')
    el.dispatchEvent(new Event('input', { bubbles: true }))
  }
  function backspace() {
    var el = cur; if (!el) return
    var a = el.selectionStart, b = el.selectionEnd
    if (a !== b) el.setRangeText('', a, b, 'end')
    else if (a > 0) el.setRangeText('', a - 1, a, 'end')
    el.dispatchEvent(new Event('input', { bubbles: true }))
  }
  function sentenceStart() {
    var el = cur; if (!el || el.tagName !== 'TEXTAREA') return false
    var before = el.value.slice(0, el.selectionStart)
    return !before.trim() || /[.!?]\s+$/.test(before) || /\n\s*$/.test(before)
  }
  var rep = 0, repT = 0
  function stopRepeat() { clearTimeout(repT); clearInterval(rep); rep = 0 }
  function onKey(e) {
    var b = e.target.closest('[data-k]')
    e.preventDefault()  // 不抢输入框的焦点
    if (!b || !cur) return
    var k = b.dataset.k
    b.classList.add('down'); setTimeout(function () { b.classList.remove('down') }, 120)
    if (k === 'hide') { cur.blur(); return }
    if (k === '⌫') { backspace(); stopRepeat(); repT = setTimeout(function () { rep = setInterval(backspace, 70) }, 380); return }
    if (k === '⇧') { shift = !shift; auto = false; drawKb(); return }
    if (k === '123') { layer = 'num'; drawKb(); return }
    if (k === 'ABC') { layer = 'abc'; drawKb(); return }
    if (k === '⏎') {
      if (cur.tagName === 'TEXTAREA') insert('\n')
      else cur.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
      afterChar(); return
    }
    if (k === '␣') {
      // 连按两下空格 = 句号 + 空格（和手机键盘一样）
      var el = cur, a = el.selectionStart
      if (a > 1 && el.value[a - 1] === ' ' && /[a-z0-9]/i.test(el.value[a - 2]) && Date.now() - lastSpace < 450) { el.setRangeText('. ', a - 1, a, 'end'); el.dispatchEvent(new Event('input', { bubbles: true })) }
      else insert(' ')
      lastSpace = Date.now(); afterChar(); return
    }
    if (k === '∧') { if (cur.matches('[data-workflow-error-text]')) { var v = cur.value.replace(/^\s*[∧^\/／]\s*/, ''); cur.value = '∧ ' + v; cur.dispatchEvent(new Event('input', { bubbles: true })) } else insert('∧'); return }
    insert(shift && /^[a-z]$/.test(k) ? k.toUpperCase() : k)
    if (layer === 'num' && /[.,?!]/.test(k)) { layer = 'abc' }
    afterChar()
  }
  var lastSpace = 0
  function afterChar() {
    var want = sentenceStart()
    if (shift !== want || layer === 'abc') { shift = want; drawKb() }
  }

  /* ---------- 布局：题目条在上，输入框紧跟，键盘在下 ---------- */
  function layout() {
    if (!cur) return
    var top = vv ? vv.offsetTop : 0, h = vv ? vv.height : innerHeight
    var kbH = 0
    if (kb && !kb.hidden) { kbH = kb.offsetHeight; document.documentElement.style.setProperty('--kb-h', kbH + 'px') }
    var avail = h - kbH
    if (pin && !pin.hidden) {
      pin.style.top = top + 'px'
      pin.style.maxHeight = Math.round(avail * (cur.tagName === 'TEXTAREA' && cur.classList.contains('px-long') ? 0.42 : 0.36)) + 'px'
    }
    var pinH = pin && !pin.hidden ? pin.offsetHeight : 0
    // 输入框浮在题目条和键盘之间，像一张单独的答题纸；页面怎么排版都不影响
    cur.classList.add('kb-float')
    cur.style.top = (top + pinH) + 'px'
    if (cur.tagName === 'TEXTAREA') cur.style.height = Math.max(96, avail - pinH) + 'px'
    var cnt = floatCount()
    if (cnt) { cnt.hidden = false; cnt.style.top = (top + avail - 26) + 'px'; cnt.textContent = words(cur.value) + ' 词' }
  }
  var countEl = null
  function words(v) { return String(v || '').trim().split(/\s+/).filter(Boolean).length }
  function floatCount() {
    if (!cur || cur.tagName !== 'TEXTAREA') { if (countEl) countEl.hidden = true; return null }
    if (!countEl) { countEl = document.createElement('div'); countEl.className = 'kb-count'; document.body.appendChild(countEl) }
    return countEl
  }
  var lt = 0
  function relayout() { clearTimeout(lt); lt = setTimeout(layout, 60) }

  function onFocus(e) {
    var el = e.target
    if (!owns(el)) return
    cur = el
    document.body.classList.add('kb-active')
    showPin(el)
    if (mode() === 'builtin') {
      el.setAttribute('inputmode', 'none')
      layer = 'abc'; shift = sentenceStart(); drawKb(); kb.hidden = false
      document.body.classList.add('kb-builtin')
    } else {
      el.removeAttribute('inputmode')
      if (kb) kb.hidden = true
      document.body.classList.remove('kb-builtin')
    }
    setTimeout(layout, mode() === 'builtin' ? 20 : 320)
  }
  function onBlur(e) {
    if (e.target !== cur) return
    setTimeout(function () {
      if (owns(document.activeElement)) return
      var el = cur; cur = null
      if (el) { el.classList.remove('kb-float'); el.style.top = ''; el.style.height = '' }
      if (countEl) countEl.hidden = true
      if (pin) pin.hidden = true
      if (kb) kb.hidden = true
      document.body.classList.remove('kb-active', 'kb-builtin')
      document.documentElement.style.removeProperty('--kb-h')
    }, 0)
  }
  if (touch) {
    // 内置键盘：在手指按下、还没聚焦时就告诉系统“别弹键盘”
    document.addEventListener('pointerdown', function (e) { var el = e.target.closest && e.target.closest(FIELDS); if (el && owns(el)) { if (mode() === 'builtin') el.setAttribute('inputmode', 'none'); else el.removeAttribute('inputmode') } }, true)
    document.addEventListener('focusin', onFocus)
    document.addEventListener('focusout', onBlur)
    // 内置键盘模式：外接键盘按键、粘贴、语音输入、系统自动更正一律不进输入框（屏幕键盘用 setRangeText 写入，不经过这里）
    function locked(e) { return cur && e.target === cur && mode() === 'builtin' }
    document.addEventListener('beforeinput', function (e) { if (locked(e)) e.preventDefault() }, true)
    document.addEventListener('paste', function (e) { if (locked(e)) e.preventDefault() }, true)
    document.addEventListener('drop', function (e) { if (locked(e)) e.preventDefault() }, true)
    document.addEventListener('keydown', function (e) {
      if (!locked(e) || !e.isTrusted) return   // 屏幕键盘的“下一个”是脚本发的回车，放行
      if (/^Arrow|^(Home|End|PageUp|PageDown|Tab|Escape|Shift|Control|Alt|Meta|CapsLock)$/.test(e.key)) return  // 移动光标可以
      e.preventDefault(); e.stopImmediatePropagation()
    }, true)
    if (vv) { vv.addEventListener('resize', relayout); vv.addEventListener('scroll', relayout) }
    document.addEventListener('input', function (e) { if (e.target === cur && cur.tagName === 'TEXTAREA') relayout() })
  }

  /* ---------- 做题页顶部的「键盘」切换 ---------- */
  function button() {
    if (!touch) return ''
    var b = mode() === 'builtin'
    return '<button type="button" class="pq-ghost kb-switch" data-kb-switch aria-label="切换键盘：现在是' + (b ? '内置键盘' : '系统键盘') + '">' + (b ? '内置键盘' : '系统键盘') + '</button>'
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-kb-switch]'); if (!b) return
    e.stopPropagation()
    var m = mode() === 'builtin' ? 'system' : 'builtin'; setMode(m)
    b.textContent = m === 'builtin' ? '内置键盘' : '系统键盘'
    var t = document.createElement('div'); t.className = 'kb-toast'
    t.textContent = m === 'builtin' ? '已换成内置键盘：打字时不弹系统键盘，题目钉在上方' : '已换回系统键盘：题目同样钉在上方'
    document.body.appendChild(t); setTimeout(function () { t.remove() }, 2200)
  }, true)

  window.TEM8_KB = { owns: owns, button: button, mode: mode, setMode: setMode }
})()
