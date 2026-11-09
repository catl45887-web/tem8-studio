/* 查词小卡片：贴在被点击的单词旁边，先给核心释义，点“查看完整释义”再展开词典 */
;(function () {
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
  let pop = null, anchor = null, opts = null, lastDown = { el: null, at: 0 }

  // 记住最近一次按下的单词按钮，用来定位卡片
  document.addEventListener('pointerdown', e => {
    if (pop && pop.contains(e.target)) return
    const b = e.target.closest && e.target.closest('button,[data-word]')
    lastDown = { el: b, at: Date.now() }
    // 点卡片以外的地方就收起（点到另一个单词会直接换成新词）
    if (pop && !pop.hidden) {
      const isWord = b && (b.dataset.word !== undefined || b.dataset.workflowWord !== undefined || b.dataset.iword !== undefined)
      if (!isWord) close()
    }
  }, true)

  function build() {
    pop = document.createElement('div')
    pop.className = 'wpop'
    pop.hidden = true
    pop.setAttribute('role', 'dialog')
    pop.innerHTML = `
      <div class="wpop-head">
        <div class="wpop-title"><strong class="wpop-word"></strong><span class="wpop-phon"></span></div>
        <div class="wpop-icons">
          <button class="wpop-ic" data-wp="speak" title="发音" aria-label="发音"><svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6"/><path d="M18 6.5a7.5 7.5 0 0 1 0 11"/></svg></button>
          <button class="wpop-ic" data-wp="save" title="加入单词本" aria-label="加入单词本"><svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 3.8l2.5 5.1 5.6.8-4 4 1 5.6-5.1-2.7-5.1 2.7 1-5.6-4-4 5.6-.8z"/></svg></button>
          <button class="wpop-ic wpop-x" data-wp="close" title="关闭" aria-label="关闭">×</button>
        </div>
      </div>
      <div class="wpop-meta"></div>
      <div class="wpop-core">
        <span class="wpop-tag">核心释义</span>
        <p class="wpop-mean"></p>
      </div>
      <div class="wpop-tools"></div>
      <div class="wpop-full"><div class="wpop-full-inner"></div></div>
      <button class="wpop-more" data-wp="more"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/></svg><span>查看完整释义</span><i>›</i></button>`
    document.body.appendChild(pop)
    pop.addEventListener('click', onClick)
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !pop.hidden) close() })
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
  }

  function onClick(e) {
    const b = e.target.closest('[data-wp]')
    if (!b) return
    const act = b.dataset.wp
    if (act === 'close') return close()
    if (act === 'speak') {
      const src = opts.us || opts.uk
      if (src) { try { new Audio(src).play().catch(() => opts.onSpeak && opts.onSpeak()) } catch (err) { opts.onSpeak && opts.onSpeak() } }
      else opts.onSpeak && opts.onSpeak()
      return
    }
    if (act === 'save') { const on = opts.onSave ? opts.onSave() : false; setSaved(on); return }
    if (act === 'more') {
      const open = !pop.classList.contains('expanded')
      pop.classList.toggle('expanded', open)
      pop.querySelector('.wpop-more span').textContent = open ? '收起完整释义' : '查看完整释义'
      if (open) pop.querySelector('.wpop-full').scrollTop = 0
      place()
      return
    }
    if (act === 'unmark') {
      const el = anchor
      close()
      window.TEM8_ANNO && window.TEM8_ANNO.unmarkAt(el)
      return
    }
  }

  function setSaved(on) {
    const b = pop.querySelector('[data-wp="save"]')
    b.classList.toggle('on', !!on)
    b.title = on ? '已加入单词本（再点取消）' : '加入单词本'
    b.querySelector('path').setAttribute('fill', on ? 'currentColor' : 'none')
  }

  function open(o) {
    if (!pop) build()
    opts = o || {}
    if (anchor) anchor.classList.remove('wpop-anchor')
    const recent = lastDown.el && Date.now() - lastDown.at < 2000 && lastDown.el.isConnected && !pop.contains(lastDown.el)
    anchor = opts.anchor?.isConnected ? opts.anchor : recent ? lastDown.el : null
    if (anchor) anchor.classList.add('wpop-anchor')

    if (!pop._base) { pop._base = 1; pop.addEventListener('click', function (e) { var b = e.target.closest && e.target.closest('[data-wpop-base]'); if (b && window.TEM8_SHOW_WORD) { e.stopPropagation(); window.TEM8_SHOW_WORD(b.dataset.wpopBase, null, anchor) } }) }
    pop.querySelector('.wpop-word').textContent = opts.word || ''
    pop.querySelector('.wpop-phon').textContent = opts.phon ? `/${opts.phon}/` : ''
    const meta = []
    if (opts.freq > 0) meta.push(`<span class="wpop-freq"><b>考频</b>在真题阅读中出现 <em>${opts.freq}</em> 次</span>`)
    if (opts.form) meta.push(`<span class="wpop-lemma">原文是 <b>${esc(opts.form)}</b>${opts.formLabel ? ' · ' + esc(opts.formLabel) : ''}</span>`)
    else if (opts.lemma && opts.lemma !== opts.word) meta.push(`<button type="button" class="wpop-lemma wpop-baselink" data-wpop-base="${esc(opts.lemma)}">也可能是 <b>${esc(opts.lemma)}</b> 的变形${opts.baseMeaning ? '：' + esc(opts.baseMeaning) : ''} ›</button>`)
    const metaEl = pop.querySelector('.wpop-meta')
    metaEl.innerHTML = meta.join('')
    metaEl.hidden = !meta.length
    pop.querySelector('.wpop-mean').innerHTML = (opts.pos ? `<span class="wpop-pos">${esc(opts.pos)}</span>` : '') + esc(opts.meaning || '')

    const marked = anchor && window.TEM8_ANNO && window.TEM8_ANNO.isMarked && window.TEM8_ANNO.isMarked(anchor)
    const tools = pop.querySelector('.wpop-tools')
    tools.innerHTML = marked ? `<button class="wpop-unmark" data-wp="unmark">✕ 取消这处高亮</button>` : ''
    tools.hidden = !marked

    pop.querySelector('.wpop-full-inner').innerHTML = opts.fullHTML || '<p class="wd-empty">暂无更多释义。</p>'
    pop.classList.remove('expanded')
    pop.querySelector('.wpop-more span').textContent = '查看完整释义'
    setSaved(opts.saved)
    pop.hidden = false
    place()
  }

  function place() {
    if (!pop || pop.hidden) return
    const vw = window.innerWidth, vh = window.innerHeight
    if (vw <= 640) { pop.classList.add('sheet'); pop.style.left = pop.style.top = ''; return }
    pop.classList.remove('sheet')
    const w = pop.offsetWidth, h = pop.offsetHeight, gap = 10
    let r = anchor && anchor.isConnected ? anchor.getBoundingClientRect() : null
    if (r && (r.bottom < 0 || r.top > vh)) { close(); return } // 单词被滚出屏幕就收起
    let left, top
    if (r) {
      left = r.left + r.width / 2 - w / 2
      top = r.bottom + gap
      if (top + h > vh - 12) {
        const above = r.top - gap - h
        top = above >= 12 ? above : Math.max(12, vh - h - 12)
      }
    } else {
      left = (vw - w) / 2; top = Math.max(12, (vh - h) / 2)
    }
    left = Math.max(12, Math.min(vw - w - 12, left))
    pop.style.left = left + 'px'
    pop.style.top = top + 'px'
  }

  function close() {
    if (!pop) return
    pop.hidden = true
    pop.classList.remove('expanded')
    if (anchor) anchor.classList.remove('wpop-anchor')
    anchor = null
  }

  window.TEM8_WORDPOP = { open, close }
})()
