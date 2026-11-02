(() => {
  'use strict'
  const { questions, categories } = window.TEM8_DATA
  const reading = window.TEM8_READING
  const articles2026 = window.TEM8_2026_ARTICLES || []
  const questions2026 = window.TEM8_2026_QUESTIONS || []
  const articles2025 = window.TEM8_2025_ARTICLES || []
  const questions2025 = window.TEM8_2025_QUESTIONS || []
  const archiveArticles = window.TEM8_ARCHIVE_ARTICLES || []
  const archiveQuestions = window.TEM8_ARCHIVE_QUESTIONS || []
  const archiveArticles2 = window.TEM8_ARCHIVE_ARTICLES2 || []
  const archiveQuestions2 = window.TEM8_ARCHIVE_QUESTIONS2 || []
  const paperExtras = { ...(window.TEM8_PAPER_EXTRAS || {}), ...(window.TEM8_PAPER_EXTRAS2 || {}), ...(window.TEM8_PAPER_EXTRAS_2025 || {}), ...(window.TEM8_PAPER_EXTRAS_2026 || {}), ...(window.TEM8_MID_EXTRAS || {}) }
  const midArticles = window.TEM8_MID_ARTICLES || []
  const midQuestions = window.TEM8_MID_QUESTIONS || []
  const allArticles = [...articles2026,...articles2025,...midArticles,...archiveArticles,...archiveArticles2]
  const allRealQuestions = [...questions2026,...questions2025,...midQuestions,...archiveQuestions,...archiveQuestions2]
  const dictionary = window.TEM8_DICTIONARY || {}
  const wordLemmas = { became:'become', bought:'buy', came:'come', chose:'choose', clung:'cling', gave:'give', held:'hold', kept:'keep', lying:'lie', sank:'sink', took:'take', undid:'undo', went:'go', brakemen:'brakeman', neighborhoods:'neighborhood',
    better:'good', best:'good', worse:'bad', worst:'bad', children:'child', men:'man', women:'woman', feet:'foot', teeth:'tooth', mice:'mouse', geese:'goose', oxen:'ox', lives:'life', knives:'knife', wives:'wife', leaves:'leaf', halves:'half', shelves:'shelf', wolves:'wolf', thieves:'thief', selves:'self', data:'datum', criteria:'criterion', phenomena:'phenomenon', analyses:'analysis', bases:'basis', crises:'crisis', theses:'thesis', hypotheses:'hypothesis', media:'medium', stimuli:'stimulus', curricula:'curriculum', alumni:'alumnus', cacti:'cactus', fungi:'fungus', nuclei:'nucleus', radii:'radius', formulae:'formula', was:'be', were:'be', is:'be', are:'be', am:'be', been:'be', being:'be', had:'have', has:'have', having:'have', does:'do', did:'do', done:'do', doing:'do', said:'say', made:'make', knew:'know', known:'know', got:'get', gotten:'get', fell:'fall', fallen:'fall', felt:'feel', found:'find', left:'leave', lost:'lose', met:'meet', paid:'pay', ran:'run', rose:'rise', risen:'rise', saw:'see', seen:'see', sold:'sell', sent:'send', spoke:'speak', spoken:'speak', spent:'spend', stood:'stand', swam:'swim', swum:'swim', thought:'think', told:'tell', wrote:'write', written:'write', wore:'wear', worn:'wear', won:'win', threw:'throw', thrown:'throw', grew:'grow', grown:'grow', drew:'draw', drawn:'draw', flew:'fly', flown:'fly', blew:'blow', blown:'blow', broke:'break', broken:'break', drove:'drive', driven:'drive', ate:'eat', eaten:'eat', drank:'drink', drunk:'drink', bit:'bite', bitten:'bite', hid:'hide', hidden:'hide', led:'lead', laid:'lay', lain:'lie', fled:'flee', dealt:'deal', meant:'mean', slept:'sleep', swept:'sweep', wept:'weep', crept:'creep', leapt:'leap', bent:'bend', lent:'lend', spent2:'spend', built:'build', caught:'catch', taught:'teach', fought:'fight', sought:'seek', brought:'bring', forgot:'forget', forgotten:'forget', chose:'choose', chosen:'choose', froze:'freeze', frozen:'freeze', stole:'steal', stolen:'steal', shook:'shake', shaken:'shake', woke:'wake', woken:'wake', bore:'bear', born:'bear', borne:'bear', tore:'tear', torn:'tear', wore2:'wear', swore:'swear', sworn:'swear', began:'begin', begun:'begin', rang:'ring', rung:'ring', sang:'sing', sung:'sing', drank2:'drink', shrank:'shrink', shrunk:'shrink', sprang:'spring', sprung:'spring', stuck:'stick', struck:'strike', stung:'sting', dug:'dig', hung:'hang', spun:'spin', slid:'slide', sought2:'seek', fled2:'flee', shone:'shine', shot:'shoot', fed:'feed', bled:'bleed', bred:'breed', sped:'speed', dwelt:'dwell' }
  // 词形还原：所有格、复数、过去式/进行时、比较级、连字符复合词都尽量还原到词典原形
  // 只有带真实释义的条目才算命中，避免"只有发音的空壳条目"抢占原形
  function hasDef(w){ const e = dictionary[w]; return !!e && !!(e.oxford || e.collins || e.ldoce || e.vocab || e.collocations) }
  function dictionaryForm(word){
    let w = String(word || '').toLowerCase().replace(/[’]/g,"'").replace(/^[^a-z]+|[^a-z'-]+$/g,'')
    if (!w) return w
    if (hasDef(w)) return w
    if (wordLemmas[w] && hasDef(wordLemmas[w])) return wordLemmas[w]

    const tryList = list => { for (const x of list) if (x && x !== w && hasDef(x)) return x; return null }

    // 1) 所有格/缩写：british's -> british, it's -> it, o'clock 不动
    if (/'s$/.test(w) && w.length > 3) {
      const base = w.slice(0, -2)
      if (hasDef(base)) return base
      const r = tryList(stem(base)); if (r) return r
    }
    // 撇号复数：students' -> students -> student ；撇号缩略：don't -> do, we're -> we
    if (/'$/.test(w)) { const base = w.slice(0, -1); if (hasDef(base)) return base }
    if (/^[a-z]+'[a-z]+$/.test(w)) {
      const head = w.split("'")[0]
      if (hasDef(head)) return head
    }
    // 2) 连字符复合词：well-known -> well / known；self-esteem -> self / esteem
    if (w.includes('-')) {
      const parts = w.split('-').filter(Boolean)
      for (let i = parts.length - 1; i >= 0; i--) {
        if (hasDef(parts[i])) return parts[i]
        const r = tryList(stem(parts[i])); if (r) return r
      }
    }
    // 3) 常规词形变化
    const r = tryList(stem(w))
    if (r) return r
    // 4) 兜底：去掉末尾 s 再试一次（处理不规则复数残留）
    if (/s$/.test(w) && w.length > 3) {
      const b = w.slice(0, -1)
      if (hasDef(b)) return b
      const r2 = tryList(stem(b)); if (r2) return r2
    }
    return w
  }
  // 生成候选原形（按优先级排序）
  function stem(w){
    const c = []
    // 复数 / 三单
    if (/ies$/.test(w)) c.push(w.slice(0,-3)+'y')
    if (/ves$/.test(w)) c.push(w.slice(0,-3)+'f', w.slice(0,-3)+'fe')
    if (/(ches|shes|xes|zes|sses|oes)$/.test(w)) c.push(w.slice(0,-2))
    if (/s$/.test(w) && !/ss$/.test(w)) c.push(w.slice(0,-1))
    // 过去式 / 过去分词 / 进行时
    if (/ied$/.test(w)) c.push(w.slice(0,-3)+'y')
    if (/ed$/.test(w)) {
      const b = w.slice(0,-2)
      c.push(b, b+'e')
      if (b.endsWith('i')) c.push(b.slice(0,-1)+'y')
      if (/([bcdfghjklmnpqrstvwxz])\1$/.test(b)) c.push(b.slice(0,-1))
    }
    if (/ing$/.test(w)) {
      const b = w.slice(0,-3)
      c.push(b, b+'e')
      if (b.endsWith('i')) c.push(b.slice(0,-1)+'y')
      if (/([bcdfghjklmnpqrstvwxz])\1$/.test(b)) c.push(b.slice(0,-1))
      if (b.length > 2) c.push(b+'e')
    }
    // 比较级 / 最高级
    if (/ier$/.test(w)) c.push(w.slice(0,-3)+'y')
    if (/iest$/.test(w)) c.push(w.slice(0,-4)+'y')
    if (/er$/.test(w)) { const b = w.slice(0,-2); c.push(b, b+'e'); if (/([bcdfghjklmnpqrstvwxz])\1$/.test(b)) c.push(b.slice(0,-1)) }
    if (/est$/.test(w)) { const b = w.slice(0,-3); c.push(b, b+'e'); if (/([bcdfghjklmnpqrstvwxz])\1$/.test(b)) c.push(b.slice(0,-1)) }
    // 副词 -ly
    if (/ily$/.test(w)) c.push(w.slice(0,-3)+'y')
    if (/ly$/.test(w)) { const b = w.slice(0,-2); c.push(b, b+'e', b+'le') }
    // 名词化 / 其他派生
    if (/ness$/.test(w)) c.push(w.slice(0,-4))
    if (/ment$/.test(w)) c.push(w.slice(0,-4))
    if (/able$/.test(w)) c.push(w.slice(0,-4), w.slice(0,-4)+'e')
    return c.filter(x => x && x.length > 1)
  }
  const extras = window.TEM8_2025_EXTRAS || { descriptions:{}, glossary:{}, notes:{} }
  const sampleArticle = { id:'sample', title:'A Library That Stayed Open', segments:reading.segments }
  const KEY = 'tem8_studio_web_v1'
  const letters = ['A','B','C','D']
  const labels = { home:'学习首页', library:'阅读真题', papers:'按题型练习', mock:'整卷模考', intensive:'精听学习', words:'生词本', 'paper-archive':'历年真题', mistakes:'错题本', bookmarks:'我的收藏', exam:'正在练习', result:'练习结果', reader:'阅读文章' }
  const defaultStore = { sessions:0, correct:0, attempted:0, mistakes:[], bookmarks:[], wordbook:[], readingProgress:0, readingCompleted:false, readingStates:{}, readingTools:{}, readingBackground:'paper', practiceAnswers:{}, practiceIndex:{}, paperWork:{}, readingFont:17, draft:null, lastResult:null }
  let store = load()
  let session = null
  let view = 'home'
  let readerFrom = 'papers'
  let readerMode = 'practice'
  let readerTab = 'translate'
  let translations = [false,false,false,false]
  let readerAnswers = {}
  let activeWord = null
  let activeArticle = sampleArticle
  let selectedLibraryYear = 2026
  let paperYear = 2026
  let paperTab = 'language'

  function articleState(id) {
    if (id === 'sample') return { progress:Number(store.readingProgress)||0, completed:!!store.readingCompleted }
    return store.readingStates?.[id] || { progress:0, completed:false }
  }
  function setArticleState(id,state) {
    if (id === 'sample') { store.readingProgress=state.progress; store.readingCompleted=state.completed }
    else { store.readingStates ||= {}; store.readingStates[id]=state }
    save()
  }

  function $(id) { return document.getElementById(id) }
  function esc(v) { return String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])) }
  function load() { try { return { ...defaultStore, ...(JSON.parse(localStorage.getItem(KEY)) || {}) } } catch { return { ...defaultStore } } }
  function save() { localStorage.setItem(KEY, JSON.stringify(store)) }
  function time(n) { return String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0') }
  function elapsed() { return session ? session.elapsed + Math.floor((Date.now()-session.startedAt)/1000) : 0 }
  function persist() { if (session) { store.draft = { ids:session.ids, title:session.title, answers:session.answers, current:session.current, elapsed:elapsed() }; save() } }
  function find(id) { return questions.find(q => q.id === id) }
  function page(name) {
    if (view === 'intensive' && name !== 'intensive') window.TEM8_INTENSIVE?.close()
    view = name
    document.querySelectorAll('.view').forEach(el => el.classList.toggle('active', el.id === name+'-view'))
    document.querySelectorAll('[data-view]').forEach(el => el.classList.toggle('active', el.dataset.view === name))
    $('crumb').textContent = labels[name]
    window.scrollTo(0,0)
    renderDashboard()
    if (name === 'papers') renderCategories()
    if (name === 'mock') renderMock()
    if (name === 'intensive') window.TEM8_INTENSIVE?.open()
    if (name === 'words') renderWordbook()
    if (name === 'paper-archive') renderArchivePaper()
    if (name === 'library') renderLibrary()
    if (name === 'mistakes') renderReview('mistakes')
    if (name === 'bookmarks') renderReview('bookmarks')
  }
  function categoryCard(c) {
    const count = questions.filter(q => q.type === c.id).length
    return `<button class="category-card" data-start="${esc(c.id)}"><span class="category-icon">${esc(c.icon)}</span><h3>${esc(c.name)}</h3><p>${esc(c.en)} · ${count} 题</p><span class="card-foot">${esc(c.desc)} <b>↗</b></span></button>`
  }
  function renderCategories() {
    if (window.TEM8_WORKFLOW) window.TEM8_WORKFLOW.renderCards()
    else {
      const html = categories.map(categoryCard).join('')
      $('home-categories').innerHTML = html
      $('paper-categories').innerHTML = html
    }
    if ($('resume-draft')) $('resume-draft').innerHTML = store.draft ? `<div class="review-resume"><span><strong>上次的练习还没完成</strong><small>进度已保存在此浏览器</small></span><button data-action="resume">继续 →</button></div>` : ''
    if ($('archive-paper-list')) $('archive-paper-list').innerHTML=Object.keys(paperExtras).sort((a,b)=>b-a).map(year=>`<button class="archive-paper-card" data-paper-year="${year}"><span class="pill">${year} 年真题</span><strong>${year} · 书面部分</strong><small>语言运用 / 翻译 / 写作</small><b>打开 →</b></button>`).join('')
  }
  function syncWordbook() { try { const raw = JSON.parse(localStorage.getItem(KEY) || '{}'); if (Array.isArray(raw.wordbook)) store.wordbook = raw.wordbook } catch {} }
  function wordEntry(w) {
    const lemma = dictionaryForm(w), e = dictionary[w] || dictionary[lemma] || {}, ox = e.oxford, co = e.collins
    const s0 = ox?.senses?.[0] || co?.senses?.[0] || null
    return { word:w, lemma, phon:(ox?.phon || '').replace(/^\/|\/$/g, ''), pos:ox?.pos || s0?.pos || '', cn:s0?.cn || (extras.glossary && extras.glossary[lemma]) || '', en:s0?.en || '' }
  }
  function renderWordbook() {
    syncWordbook()
    const list = $('wordbook-list'), bar = $('wordbook-toolbar')
    const words = store.wordbook || []
    if (bar) bar.innerHTML = words.length
      ? `<span class="muted">共 <strong>${words.length}</strong> 词</span><button class="primary-btn" data-word-export="txt">导出 txt <span>↓</span></button><button class="secondary-btn" data-word-export="docx">导出 Word</button><button class="secondary-btn" data-word-clear>清空</button>`
      : ''
    if (!list) return
    if (!words.length) { list.innerHTML = '<div class="review-empty"><strong>生词本还是空的</strong>阅读或做题时点开单词，点“加入单词本”就会出现在这里。</div>'; return }
    list.innerHTML = `<div class="wordbook-grid">${words.map(w => { const e = wordEntry(w)
      return `<article class="wordbook-row"><div class="wb-head"><strong>${esc(e.word)}</strong>${e.phon?`<span class="wb-phon">/${esc(e.phon)}/</span>`:''}${e.pos?`<span class="wb-pos">${esc(e.pos)}</span>`:''}<button class="wb-del" data-word-remove="${esc(w)}" title="移出生词本">×</button></div><p>${esc(e.cn || '词典暂未收录')}</p>${e.en?`<small>${esc(e.en)}</small>`:''}</article>` }).join('')}</div>`
  }
  function downloadBlob(blob, name) { const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1500) }
  const CRC_TABLE = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0 } return t })()
  function crc32(u8) { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = CRC_TABLE[(c ^ u8[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0 }
  function zipBlob(files) {
    const enc = new TextEncoder(), parts = [], central = []; let offset = 0
    for (const f of files) {
      const name = enc.encode(f.name), data = enc.encode(f.data), crc = crc32(data), size = data.length
      const lh = new Uint8Array(30 + name.length), dv = new DataView(lh.buffer)
      dv.setUint32(0, 0x04034b50, true); dv.setUint16(4, 20, true); dv.setUint16(6, 0x0800, true); dv.setUint16(8, 0, true)
      dv.setUint16(10, 0, true); dv.setUint16(12, 0x21, true); dv.setUint32(14, crc, true)
      dv.setUint32(18, size, true); dv.setUint32(22, size, true); dv.setUint16(26, name.length, true); dv.setUint16(28, 0, true)
      lh.set(name, 30); parts.push(lh, data)
      const ch = new Uint8Array(46 + name.length), cv = new DataView(ch.buffer)
      cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true); cv.setUint16(8, 0x0800, true)
      cv.setUint16(10, 0, true); cv.setUint16(12, 0, true); cv.setUint16(14, 0x21, true); cv.setUint32(16, crc, true)
      cv.setUint32(20, size, true); cv.setUint32(24, size, true); cv.setUint16(28, name.length, true)
      cv.setUint16(30, 0, true); cv.setUint16(32, 0, true); cv.setUint16(34, 0, true); cv.setUint16(36, 0, true)
      cv.setUint32(38, 0, true); cv.setUint32(42, offset, true)
      ch.set(name, 46); central.push(ch); offset += lh.length + size
    }
    const cdSize = central.reduce((a, b) => a + b.length, 0)
    const eocd = new Uint8Array(22), ev = new DataView(eocd.buffer)
    ev.setUint32(0, 0x06054b50, true); ev.setUint16(4, 0, true); ev.setUint16(6, 0, true)
    ev.setUint16(8, files.length, true); ev.setUint16(10, files.length, true)
    ev.setUint32(12, cdSize, true); ev.setUint32(16, offset, true); ev.setUint16(20, 0, true)
    return new Blob([...parts, ...central, eocd], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
  }
  function xmlEsc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;' }[c])) }
  function exportWords(kind) {
    syncWordbook()
    const words = store.wordbook || []
    if (!words.length) { alert('生词本还是空的。'); return }
    const stamp = new Date().toLocaleDateString('zh-CN').replace(/\//g, '-')
    if (kind === 'txt') {
      const lines = words.map((w, i) => { const e = wordEntry(w)
        return `${String(i + 1).padStart(3, ' ')}. ${e.word}${e.phon ? '  /' + e.phon + '/' : ''}${e.pos ? '  ' + e.pos : ''}\n     ${e.cn || '（词典暂未收录）'}${e.en ? '\n     ' + e.en : ''}` })
      downloadBlob(new Blob([`专八生词本 · 共 ${words.length} 词 · 导出于 ${stamp}\n\n` + lines.join('\n') + '\n'], { type: 'text/plain;charset=utf-8' }), `专八生词本-${stamp}.txt`)
      return
    }
    const body = words.map((w, i) => { const e = wordEntry(w)
      const head = `${i + 1}. ${e.word}${e.phon ? '  /' + e.phon + '/' : ''}${e.pos ? '  ' + e.pos : ''}`
      return `<w:p><w:pPr><w:spacing w:before="160" w:after="40"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="24"/></w:rPr><w:t xml:space="preserve">${xmlEsc(head)}</w:t></w:r></w:p>`
        + (e.cn ? `<w:p><w:pPr><w:ind w:left="260"/></w:pPr><w:r><w:rPr><w:sz w:val="22"/></w:rPr><w:t xml:space="preserve">${xmlEsc(e.cn)}</w:t></w:r></w:p>` : '')
        + (e.en ? `<w:p><w:pPr><w:ind w:left="260"/></w:pPr><w:r><w:rPr><w:sz w:val="20"/><w:color w:val="6B7B6E"/></w:rPr><w:t xml:space="preserve">${xmlEsc(e.en)}</w:t></w:r></w:p>` : '')
    }).join('')
    const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:rPr><w:b/><w:sz w:val="36"/></w:rPr><w:t>专八生词本</w:t></w:r></w:p><w:p><w:r><w:rPr><w:sz w:val="20"/><w:color w:val="6B7B6E"/></w:rPr><w:t>共 ${words.length} 词 · 导出于 ${stamp}</w:t></w:r></w:p>${body}<w:p/><w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body></w:document>`
    const ct = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`
    const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`
    downloadBlob(zipBlob([{ name: '[Content_Types].xml', data: ct }, { name: '_rels/.rels', data: rels }, { name: 'word/document.xml', data: doc }]), `专八生词本-${stamp}.docx`)
  }
  function mockListening() { return { ...(window.TEM8_LISTENING_ARCHIVE || {}), ...(window.TEM8_LISTENING_2026 || {}), ...(window.TEM8_MID_LISTENING || {}) } }
  function renderMock() {
    const el = $('mock-list'); if (!el) return
    const L = mockListening()
    const years = Object.keys(L).map(Number).filter(y => !L[y]?.intensiveOnly && paperExtras[y] && allArticles.some(a=>Number(a.year)===y)).sort((a,b) => b-a)
    if (!years.length) { el.innerHTML = '<div class="review-empty"><strong>暂无整卷数据</strong>需要同时具备听力与书面部分。</div>'; return }
    el.innerHTML = years.map(y => {
      const it = L[y] || {}
      const mins = it.timeLimitMinutes ? `建议 ${it.timeLimitMinutes} 分钟` : '时长未录入'
      const source=paperExtras[y],hasReading=allArticles.some(a=>Number(a.year)===y)
      const ready=!!(it.audio&&it.miniLecture?.blanks?.length&&it.interview?.questions?.length&&hasReading&&source?.languageLines?.length&&source?.translation?.length&&source?.writing?.length)
      const parts = [it.miniLecture ? 'Section A 填空' : 'Section A 待补', it.interview ? 'Section B 选择' : 'Section B 待补', hasReading ? 'Part II 阅读' : '阅读待补', source?.languageLines?.length ? 'Part III 改错' : '改错待补', source?.translation?.length ? 'Part IV 翻译' : '翻译待补', source?.writing?.length ? 'Part V 写作' : '写作待补'].filter(Boolean)
      const missing=ready?'各部分资料齐全':!it.audio?'听力音频待补，暂不可启动':'整卷资料不全，暂不可启动'
      return `<button class="mock-card" data-mock-year="${y}" ${ready?'':'disabled'}><span class="pill">${y} 年整卷</span><strong>${y} · TEM-8 ${ready?'完整试卷':'资料待补'}</strong><small>${parts.join(' · ')}</small><em>${mins}</em><b>${ready?'配置模考 →':missing}</b></button>`
    }).join('')
  }
  function paperState() { store.paperWork ||= {};store.paperWork[paperYear] ||= {language:{},translation:'',writing:''};return store.paperWork[paperYear] }
  function renderArchivePaper() {
    const source=paperExtras[paperYear], state=paperState()
    if (!source) return
    $('archive-paper-title').textContent=`${paperYear} 年真题 · 书面部分`
    document.querySelectorAll('[data-paper-tab]').forEach(b=>b.classList.toggle('active',b.dataset.paperTab===paperTab))
    if (paperTab==='language') {
      $('archive-paper-content').innerHTML=`<div class="paper-task-intro"><strong>Language Usage · 改错</strong><span>${(source.languageAnswers||[]).length?`对照原文填写每处修改；本题 ${(source.languageAnswers||[]).length} 处答案与解析已录入，可在「改错专项」中作答并对照。`:'对照原文填写每处修改；答案待补充。'}</span></div><div class="paper-source paper-language">${source.languageLines.map((row,i)=>`<div class="paper-source-line"><span>${String(i+1).padStart(2,'0')}</span><p>${esc(row[0]||'')}</p><em>${esc(row[1]||'')}</em></div>`).join('')}</div><div class="paper-error-grid">${Array.from({length:10},(_,i)=>`<label>第 ${i+1} 处<input data-paper-error="${i+1}" value="${esc(state.language?.[i+1]||'')}" placeholder="填写修改后的词或说明"></label>`).join('')}</div>`
    } else if (paperTab==='translation') {
      $('archive-paper-content').innerHTML=`<div class="paper-task-intro"><strong>翻译 · 汉译英</strong><span>阅读原题，在下方写译文；内容自动保存在此浏览器。</span></div><div class="paper-source">${source.translation.map(p=>`<p>${esc(p)}</p>`).join('')}</div><textarea class="paper-write" data-paper-field="translation" placeholder="在这里输入英文译文">${esc(state.translation||'')}</textarea><div class="paper-count">${(state.translation||'').trim().split(/\s+/).filter(Boolean).length} 词</div>${source.translationReference?`<details><summary>参考译文</summary><div class="paper-source">${esc(source.translationReference).replace(/\n/g,'<br>')}</div></details>`:''}${source.translationAnalysis?`<details><summary>翻译解析</summary><div class="paper-source">${esc(source.translationAnalysis).replace(/\n/g,'<br>')}</div></details>`:''}`
    } else {
      $('archive-paper-content').innerHTML=`<div class="paper-task-intro"><strong>写作 · 300 词起</strong><span>题目与材料来自原试卷；正文自动保存在此浏览器。</span></div><div class="paper-source paper-writing">${source.writing.map(p=>`<p>${esc(p)}</p>`).join('')}</div><textarea class="paper-write" data-paper-field="writing" placeholder="在这里输入作文">${esc(state.writing||'')}</textarea><div class="paper-count">${(state.writing||'').trim().split(/\s+/).filter(Boolean).length} 词</div>${source.writingReference?`<details><summary>参考范文</summary><div class="paper-source">${esc(source.writingReference).replace(/\n/g,'<br>')}</div></details>`:''}${source.writingAnalysis?`<details><summary>写作指南</summary><div class="paper-source">${esc(source.writingAnalysis).replace(/\n/g,'<br>')}</div></details>`:''}`
    }
  }
  function renderDashboard() {
    let real={};try { real=JSON.parse(localStorage.getItem('tem8_workflow_v2')||'{}') } catch {}
    const review=new Set((real.history||[]).flatMap(run=>Object.keys(run.marks||{}).filter(id=>run.marks[id])))
    $('stat-sessions').textContent = store.sessions+(real.history||[]).length
    $('stat-accuracy').textContent = store.attempted ? Math.round(store.correct/store.attempted*100)+'%' : '—'
    $('stat-mistakes').textContent = store.mistakes.length+review.size
    $('mistake-nav-count').textContent = store.mistakes.length+review.size || ''
  }
  function renderLibrary() {
    const n = Math.min(4, Math.max(0, Number(store.readingProgress) || 0))
    $('reading-progress-label').textContent = store.readingCompleted ? '已读完，可随时重读' : (n ? `已读到第 ${n} 段` : '尚未开始')
    $('reading-progress-number').textContent = `${n} / 4 段`
    $('reading-progress-bar').style.width = (n*25)+'%'
    const yearArticles=allArticles.filter(a => a.year === selectedLibraryYear)
    $('library-year-heading').textContent=`${selectedLibraryYear} 年真题阅读`
    $('library-year-count').textContent=`${yearArticles.length} 篇文章 · ${allRealQuestions.filter(q => q.articleId.startsWith(selectedLibraryYear+'-')).length} 道题`
    $('library-year-nav').innerHTML=[...new Set(allArticles.map(a=>a.year))].sort((a,b)=>b-a).map(year=>`<button data-library-year="${year}" class="${year===selectedLibraryYear?'active':''}">${year}</button>`).join('')
    $('real-article-list').innerHTML = yearArticles.map(a => {
      const s=articleState(a.id), total=a.segments.length, n=Math.min(total,s.progress)
      return `<article class="real-article-card"><div class="real-article-top"><span class="pill">${a.year} 真题 · ${esc(a.label)}</span><span>${s.completed ? '✓ 已读完' : `${n} / ${total} 段`}</span></div><h3>${esc(a.title)}</h3><p>${esc(extras.descriptions[a.id] || '阅读原文与配套真题，作答可保存在本机。')}</p><div class="real-article-meta"><span>${total} 个段落</span><span>${allRealQuestions.filter(q=>q.articleId===a.id).length} 道题</span><span>点词查义</span></div><div class="progress-track"><i style="width:${Math.round(n/total*100)}%"></i></div><div class="article-entry-actions"><button class="primary-btn" data-open-reader data-mode="free" data-article="${esc(a.id)}">${n ? '继续精读' : '开始精读'} <span>↗</span></button><button class="secondary-btn" data-open-reader data-mode="practice" data-article="${esc(a.id)}">做题 →</button></div></article>`
    }).join('')
    const button = document.querySelector('#library-view [data-article="sample"]')
    button.innerHTML = n ? '继续阅读 <span>↗</span>' : '开始阅读 <span>↗</span>'
  }
  function renderReview(kind) {
    const ids = kind === 'mistakes' ? store.mistakes : store.bookmarks
    const target = $(kind+'-content')
    if (!ids.length) { target.innerHTML = `<div class="review-empty"><strong>${kind === 'mistakes' ? '错题本还是空的' : '还没有收藏题目'}</strong>${kind === 'mistakes' ? '完成选择题练习后，答错的题会保存在这里。' : '做题或看解析时，点击星标即可收藏。'}</div>`; return }
    const items = ids.map(id => find(id)).filter(Boolean)
    target.innerHTML = (kind === 'mistakes' ? `<button class="primary-btn" data-action="retry-all">回练全部错题 <span>↗</span></button><div style="height:18px"></div>` : '') + `<div class="review-list">${items.map(q => `<div class="review-item"><div><small>${esc(q.typeName)} · ${esc(q.id)}</small><h3>${esc(q.prompt)}</h3></div><button data-start-one="${esc(q.id)}">${kind === 'mistakes' ? '重做' : '练习'}</button></div>`).join('')}</div>`
  }
  function start(ids, title, draft) {
    if (!ids.length) return
    session = draft ? { ...draft, startedAt:Date.now() } : { ids, title, answers:{}, current:0, elapsed:0, startedAt:Date.now() }
    renderQuestion()
    page('exam')
    persist()
  }
  function startType(id) { const c = categories.find(x => x.id === id); if (c) start(questions.filter(q => q.type === id).map(q => q.id), c.name) }
  function answered(id) { const a = session.answers[id]; return a !== undefined && a !== '' }
  function renderQuestion() {
    if (!session) return
    const q = find(session.ids[session.current])
    if (!q) return
    $('exam-title').textContent = session.title
    $('question-counter').textContent = `第 ${session.current+1} / ${session.ids.length} 题`
    $('answer-status').textContent = `已答 ${session.ids.filter(answered).length} 题`
    $('timer').textContent = time(elapsed())
    $('prev-question').disabled = session.current === 0
    $('next-question').innerHTML = session.current === session.ids.length-1 ? '完成并提交 <span>→</span>' : '下一题 <span>→</span>'
    const selected = session.answers[q.id]
    const options = q.options ? `<div class="option-list">${q.options.map((o,i) => `<button class="option ${selected === i ? 'selected' : ''}" data-option="${i}"><span class="option-letter">${letters[i]}</span><span>${esc(o)}</span></button>`).join('')}</div>` : `<textarea class="answer-textarea" id="open-answer" placeholder="在这里输入你的答案。提交后可查看复盘提示。"></textarea><div class="word-count" id="word-count"></div>`
    $('question-area').innerHTML = `<span class="q-type">${esc(q.typeName)}</span>${q.type === 'reading' ? '<button class="exam-reader-link" data-open-reader>Aa　打开阅读辅助：译文 / 查词 / 精讲 →</button>' : ''}${q.passage ? `<div class="passage">${esc(q.passage)}</div>` : ''}<h2 class="question-prompt">${esc(q.prompt)}</h2>${options}<button class="bookmark-btn ${store.bookmarks.includes(q.id) ? 'saved' : ''}" data-bookmark="${esc(q.id)}" aria-label="${store.bookmarks.includes(q.id) ? '取消收藏' : '收藏题目'}">${store.bookmarks.includes(q.id) ? '★' : '☆'}</button>`
    if (!q.options) { $('open-answer').value = typeof selected === 'string' ? selected : ''; updateCount() }
    $('answer-grid').innerHTML = session.ids.map((id,i) => `<button class="${answered(id) ? 'answered' : ''} ${i === session.current ? 'current' : ''}" data-jump="${i}">${i+1}</button>`).join('')
    persist()
  }
  function updateCount() { const box = $('open-answer'); if (box) $('word-count').textContent = (box.value.trim() ? box.value.trim().split(/\s+/).length : 0)+' 词（按空格估算）' }
  function confirmSubmit() {
    if (!session) return
    const n = session.ids.filter(id => !answered(id)).length
    $('dialog-message').textContent = n ? `还有 ${n} 题未作答，仍要提交吗？` : '提交后可查看答案与解析。'
    $('confirm-dialog').showModal()
  }
  function submit() {
    if (!session) return
    const rows = session.ids.map(id => {
      const q = find(id), a = session.answers[id], isChoice = !!q.options
      return { id, typeName:q.typeName, prompt:q.prompt, analysis:q.analysis, isChoice, correct:isChoice && a === q.answer, unanswered:a === undefined || a === '', userAnswer:isChoice ? (a === undefined ? '未作答' : letters[a]) : (a ? '已作答，需自行核对' : '未作答'), rightAnswer:isChoice ? letters[q.answer] : '开放题' }
    })
    rows.forEach(r => { if (!r.isChoice || r.unanswered) return; store.mistakes = store.mistakes.filter(id => id !== r.id); if (!r.correct) store.mistakes.push(r.id) })
    const attempted = rows.filter(r => r.isChoice && !r.unanswered).length
    const correct = rows.filter(r => r.correct).length
    store.sessions++; store.attempted += attempted; store.correct += correct
    store.lastResult = { title:session.title, rows, attempted, correct, openCount:rows.filter(r => !r.isChoice).length, time:time(elapsed()) }
    store.draft = null; save(); session = null
    renderResult(); page('result')
  }
  function renderResult() {
    const r = store.lastResult
    if (!r) return
    $('result-content').innerHTML = `<div class="result-hero"><div><h2>${esc(r.title)}</h2><p>用时 ${esc(r.time)} · 开放题 ${r.openCount} 道需自行核对</p></div><div class="result-score">${r.correct}<small> / ${r.attempted}</small></div></div><p class="muted" style="margin:14px 0 20px">分数只统计已作答的选择题；未作答题不计入分母。</p><div class="result-list">${r.rows.map((row,i) => `<article class="result-item"><div class="result-top"><span>${i+1} · ${esc(row.typeName)}</span><span class="tag ${row.isChoice && !row.correct ? 'wrong' : ''}">${row.isChoice ? (row.unanswered ? '未作答' : (row.correct ? '正确' : '待复习')) : '自查'}</span></div><h3>${esc(row.prompt)}</h3><p>你的答案：${esc(row.userAnswer)} ${row.isChoice ? '　正确答案：'+esc(row.rightAnswer) : ''}</p><p><strong>解析 / 提示：</strong>${esc(row.analysis).replace(/\n/g,'<br>')}</p><button class="bookmark-btn ${store.bookmarks.includes(row.id) ? 'saved' : ''}" data-bookmark="${esc(row.id)}" aria-label="${store.bookmarks.includes(row.id) ? '取消收藏' : '收藏题目'}">${store.bookmarks.includes(row.id) ? '★' : '☆'}</button></article>`).join('')}</div><div class="result-actions"><button class="primary-btn" data-view="home">返回首页 <span>→</span></button></div>`
  }
  function openReader(mode,articleId) {
    readerFrom = view
    activeArticle = allArticles.find(a => a.id === articleId) || sampleArticle
    readerMode = mode === 'free' ? 'free' : 'practice'
    readerTab='translate'; translations=activeArticle.segments.map(()=>false); readerAnswers={}
    updateReaderChrome()
    $('reader-view').style.setProperty('--reader-font-size',store.readingFont+'px')
    renderReader(); page('reader')
    const state=articleState(activeArticle.id)
    if (readerMode === 'free' && state.progress > 0 && state.progress < activeArticle.segments.length) setTimeout(() => document.getElementById('reading-segment-'+(state.progress-1))?.scrollIntoView({behavior:'smooth',block:'start'}),200)
  }
  function updateReaderChrome() {
    const isSample = activeArticle.id === 'sample', state=articleState(activeArticle.id)
    document.body.classList.toggle('free-reader', readerMode === 'free')
    document.body.classList.toggle('real-practice', !isSample && readerMode === 'practice')
    $('reader-back').textContent = isSample && readerMode === 'practice' ? '← 返回练习' : '← 返回阅读目录'
    $('reader-mode-badge').textContent = isSample ? (readerMode === 'free' ? '自由阅读 · 原创示例' : '练习辅助 · 原创示例') : `${activeArticle.year} 专八真题 · ${readerMode === 'free' ? '精读' : '做题'}`
    $('reader-view').classList.toggle('reader-sepia',store.readingBackground==='sepia')
    document.querySelector('.reader-title').textContent=activeArticle.title
    document.querySelector('[data-reader-tab="translate"]').textContent=isSample ? '原文 / 译文' : '原文阅读'
    $('reader-subtitle').textContent = isSample ? (readerMode === 'free' ? '专注阅读，不做题。点击单词查义，选中文字可标记，笔记收在右侧。' : '点击单词查看语境释义；选中文字可标记。译文和讲解均为人工整理。') : (readerMode === 'free' ? `选中想记的词句点“标记”，笔记收在右侧抽屉里。点击单词查词。${activeArticle.year===2025?'精选句有人工句法讲解。':'本年尚无人工句法讲解。'}` : '左侧原文、右侧真题。选中原文即可标记，笔记在右侧抽屉。作答自动保存在本机。')
    $('article-mode-switch').hidden=isSample
    document.querySelectorAll('[data-article-mode]').forEach(b => b.classList.toggle('active',b.dataset.articleMode === readerMode))
    $('reading-done').hidden = readerMode !== 'free'
    $('reading-done').textContent = state.completed ? '✓ 已读完' : '标记读完'
    $('reading-done').classList.toggle('done',state.completed)
  }
  function readerIntro(title, desc) { return `<div class="reader-intro"><strong>${esc(title)}</strong><span>${esc(desc)}</span></div>` }
  function articleText() {
    const isSample=activeArticle.id === 'sample', state=articleState(activeArticle.id), A=window.TEM8_ANNO
    return `<div class="continuous-article" data-anno-scope data-anno-article="${activeArticle.id}" data-anno-word="1" data-anno-word-attr="data-word" data-anno-seg="1">${activeArticle.segments.map((s,i) => {
      const n=A?A.noteCount(activeArticle.id,i):0
      const body=A?A.textHTML(activeArticle.id,i,s.en,{word:true,attr:'data-word',segAttr:'data-segment'}):esc(s.en)
      return `<p class="continuous-paragraph" id="reading-segment-${i}" data-anno-p="${i}"><button class="paragraph-number ${state.progress > i ? 'done' : ''}" data-mark-read="${i+1}" title="标记读到第 ${i+1} 段" aria-label="标记读到第 ${i+1} 段">${String(i+1).padStart(2,'0')}</button><span class="reader-english anno-text">${body}</span>${isSample ? `<button class="inline-translation" data-translate="${i}">${translations[i] ? '收起译文' : '译文'}</button>${translations[i] ? `<span class="reader-chinese">${esc(s.zh)}</span>` : ''}` : ''}<span class="anno-tools"><button class="anno-pbtn${n?' has':''}" type="button" data-anno-open="${i}" title="${n?`第 ${i+1} 段有 ${n} 条笔记`:`在第 ${i+1} 段记笔记`}">✎${n||''}</button></span></p>`
    }).join('')}</div>`
  }
  function practiceQuestions() { return allRealQuestions.filter(q => q.articleId === activeArticle.id) }
  function practiceAnswerKey(q) { return `${q.articleId}-${q.number}` }
  function practiceAnswer(q) { const answers=store.practiceAnswers || {}; return answers[practiceAnswerKey(q)] ?? (q.articleId.startsWith('2025-') ? answers[q.number] : undefined) }
  function renderPractice() {
    const qs=practiceQuestions(), index=Math.max(0,Math.min(qs.length-1,Number(store.practiceIndex?.[activeArticle.id])||0)), q=qs[index]
    if (!q) return readerIntro('暂无题目','这篇文章的题目尚未导入。')
    const count=qs.filter(item => practiceAnswer(item) !== undefined && practiceAnswer(item) !== '').length
    const selected=practiceAnswer(q)
    const answerBox=q.type === 'choice' ? `<div class="practice-options">${q.options.map((option,i) => `<button class="practice-option ${selected === i ? 'selected' : ''}" data-practice-answer="${q.number}" data-choice="${i}"><b>${letters[i]}</b><span>${esc(option)}</span></button>`).join('')}</div>` : `<textarea id="practice-short-answer" data-practice-short="${q.number}" placeholder="在此输入简答（试卷要求不超过 10 词）">${esc(selected || '')}</textarea><div class="word-count">${String(selected || '').trim().split(/\s+/).filter(Boolean).length} / 10 词</div>`
    return `<div class="practice-layout"><div class="practice-passage"><div class="practice-pane-head"><strong>文章原文</strong><span>点击段号记进度 · 点击单词查词</span></div>${articleText()}</div><aside class="practice-panel"><div class="practice-pane-head"><strong>${activeArticle.year} 真题</strong><span>已答 ${count} / ${qs.length} · 自动保存</span></div><div class="practice-question"><span class="quiz-type">${q.type === 'choice' ? '选择题' : '简答题'} · Q${q.number}</span><h2>${esc(q.prompt)}</h2>${answerBox}${(q.analysis||q.referenceAnswer||Number.isInteger(q.answer))?`<details class="practice-review"><summary>查看答案与解析</summary><p><strong>参考答案：</strong>${q.type==='choice'?letters[q.answer]:esc(q.referenceAnswer||'待补充')}</p>${q.analysis?`<p>${esc(q.analysis).replace(/\n/g,'<br>')}</p>`:''}</details>`:''}</div><div class="practice-bottom"><div class="practice-number-grid">${qs.map((item,i) => `<button class="${i === index ? 'current' : ''} ${practiceAnswer(item) !== undefined && practiceAnswer(item) !== '' ? 'answered' : ''}" data-practice-jump="${i}">${item.number}</button>`).join('')}</div><div class="practice-step"><button data-practice-step="-1" ${index === 0 ? 'disabled' : ''}>← 上一题</button><button data-practice-step="1" ${index === qs.length-1 ? 'disabled' : ''}>下一题 →</button></div></div></aside></div>`
  }
  function renderReader() {
    if (readerTab === 'words') syncWordbook()
    document.querySelectorAll('[data-reader-tab]').forEach(b => b.classList.toggle('active',b.dataset.readerTab === readerTab))
    window.TEM8_ANNO?.refresh(activeArticle.id)
    if (activeArticle.id !== 'sample' && readerMode === 'practice') { $('reader-content').innerHTML=renderPractice(); return }
    const isSample=activeArticle.id === 'sample', segments=activeArticle.segments, state=articleState(activeArticle.id)
    const notes=extras.notes[activeArticle.id] || []
    let html = ''
    if (readerTab === 'translate') {
      html = `<div class="reader-toolbar"><span>${isSample ? '点击段号记进度，点击单词查义，按需展开译文' : '点击段号记进度，点击单词查义；真题暂未提供全文译文'}</span>${isSample ? `<button data-action="translate-all">${translations.every(Boolean) ? '收起全部' : '展开全部译文'}</button>` : ''}</div>` + articleText() + (!isSample && readerMode === 'free' ? (window.TEM8_WORKFLOW?.readerActions(activeArticle) || '') : '')
    } else if (readerTab === 'quiz') {
      html = readerIntro('读完练一遍','3 道题，定位原因、推断与词义。选择后显示解析。') + questions.filter(q => q.type === 'reading').map((q,i) => {
        const selected = readerAnswers[q.id]
        return `<article class="reader-quiz"><span class="quiz-type">${esc(reading.quizTypes[q.id])}</span><h3>${i+1}. ${esc(q.prompt)}</h3>${q.options.map((o,j) => `<button class="reader-choice ${selected !== undefined && j === q.answer ? 'correct' : ''} ${selected === j && j !== q.answer ? 'wrong' : ''}" data-reader-answer="${esc(q.id)}" data-index="${j}"><b>${letters[j]}</b>${esc(o)}</button>`).join('')}${selected !== undefined ? `<div class="reader-answer">${selected === q.answer ? '答对了。' : '再看一眼原文。'}${esc(q.analysis)}</div>` : ''}</article>`
      }).join('')
    } else if (readerTab === 'parse') {
      html = readerIntro('长难句解析',isSample ? '按句拆出主干、修饰和逻辑关系。' : notes.length ? '精选句子，人工整理主干与修饰关系。' : '本篇暂无人工长难句解析。') + (isSample ? segments.map((s,i) => `<article class="reader-note"><span class="reader-number">句子 0${i+1}</span><p>${esc(s.en)}</p><div class="note-label">句子结构</div><p>${esc(s.note)}</p><div class="note-label">参考译文</div><p>${esc(s.zh)}</p></article>`).join('') : notes.map(n => `<article class="reader-note"><span class="reader-number">第 ${n.paragraph} 段 · 精选句</span><p>${esc(n.excerpt)}</p><div class="note-label">拆解</div><p>${esc(n.note)}</p></article>`).join(''))
    } else if (readerTab === 'syntax') {
      html = readerIntro('句法结构',isSample || notes.length ? '看清主语、谓语、宾语以及修饰成分，再回到原文重读。' : '本篇暂无人工句法结构标注。') + (isSample ? segments.map((s,i) => `<article class="reader-note"><span class="reader-number">句子 0${i+1}</span><p>${esc(s.en)}</p>${s.syntax.map(([label,value]) => `<div class="syntax-row"><span class="syntax-label">${esc(label)}</span><span class="syntax-value">${esc(value)}</span></div>`).join('')}</article>`).join('') : notes.map(n => `<article class="reader-note"><span class="reader-number">第 ${n.paragraph} 段 · 精选句</span><p>${esc(n.excerpt)}</p>${n.syntax.map(([label,value]) => `<div class="syntax-row"><span class="syntax-label">${esc(label)}</span><span class="syntax-value">${esc(value)}</span></div>`).join('')}</article>`).join(''))
    } else if (readerTab === 'knowledge') {
      html = readerIntro('知识精讲',isSample ? '把这篇文章值得记住的表达整理成卡片。' : activeArticle.year===2025 ? '本篇精选词语与表达；点击原文中的词可查看更多已收录词义。' : '本篇暂无人工知识卡片；点击原文中的单词查词。') + (isSample ? segments.map((s,i) => `<article class="reader-note"><span class="reader-number">要点 0${i+1}</span><p class="note-focus">${esc(s.focus)}</p><p>原句：${esc(s.en)}</p></article>`).join('') : activeArticle.year===2025 ? `<div class="glossary-grid">${Object.entries(extras.glossary).filter(([word]) => segments.some(s => new RegExp(`\\b${word}\\b`,'i').test(s.en))).map(([word,meaning]) => `<div><strong>${esc(word)}</strong><span>${esc(meaning)}</span></div>`).join('')}</div>` : '')
    } else {
      html = readerIntro('我的单词本','点击文章中的单词，再点击“加入单词本”。') + ((store.wordbook || []).length ? store.wordbook.map(w => `<button class="word-list-row" data-word="${esc(w)}" data-segment="${Math.max(0,segments.findIndex(s => reading.tokenize(s.en).some(t => t.key === w)))}"><strong>${esc(w)}</strong><span>查看释义 →</span></button>`).join('') : '<div class="review-empty"><strong>还没有生词</strong>回到文章点击想记住的词。</div>')
    }
    $('reader-content').innerHTML = html
  }
  function showWord(key,index) {
    activeWord = String(key || '').toLowerCase().replace(/[’']s$/,'').replace(/[’']/g,'\'')
    const lemma = dictionaryForm(activeWord)
    const entry = dictionary[activeWord] || dictionary[lemma] || {}
    const ox = entry.oxford, co = entry.collins, coll = entry.collocations, ld = entry.ldoce, vb = entry.vocab
    const senses = [ox?.senses?.[0], co?.senses?.[0], ld?.senses?.[0], vb?.senses?.[0]].filter(Boolean)
    const primary = senses.map(s => s.cn).filter(Boolean)[0] || senses.map(s => s.en).filter(Boolean)[0]
      || (activeArticle.id === 'sample' ? reading.meanings[activeWord] : extras.glossary[lemma])
      || ({ freightyard:'铁路货运场', neighborhoods:'街区；社区' })[activeWord]

    // ---- 词头：单词 + 词性 + 音标 ----
    $('word-title').textContent = activeWord
    const pos = ox?.pos || co?.senses?.[0]?.pos || ld?.pos || vb?.pos || ''
    const posClean = String(pos).replace(/\[[^\]]*\]/g,'').replace(/[\u3400-\u9fff]/g,'').trim()
    const phon = ox?.phon || ld?.phon || ''
    $('word-detail').innerHTML = [
      lemma !== activeWord ? `<span class="wd-lemma">原形 <b>${esc(lemma)}</b></span>` : '',
      posClean ? `<span class="wd-pos">${esc(posClean)}</span>` : '',
      phon ? `<span class="wd-phon">/${esc(phon)}/</span>` : ''
    ].filter(Boolean).join('')
    $('word-meaning').textContent = primary || '词典暂未收录这个词。'

    // ---- 顶部：图片 + 发音 ----
    const md = entry.media || {}
    let top = ''
    if (md.img?.length) {
      top += `<div class="wd-pics">${md.img.map(s => `<img src="${esc(s)}" alt="词条插图" loading="lazy" onerror="this.style.display='none'">`).join('')}</div>`
    }
    const btns = []
    if (md.uk) btns.push(`<button class="wd-audio" data-audio="${esc(md.uk)}">英 /ʊ/</button>`)
    if (md.us) btns.push(`<button class="wd-audio" data-audio="${esc(md.us)}">美 /uː/</button>`)
    if (btns.length) top += `<div class="wd-audios">${btns.join('')}<span class="wd-audio-hint">真实发音（词典音库）</span></div>`

    // ---- 释义区（分词典来源）----
    const srcBlock = (name, list, kind) => {
      if (!list?.length) return ''
      const rows = list.map((s,i) => {
        if (kind === 'ox') return `<li><div class="wd-def">${esc(s.cn)}</div>${s.en ? `<div class="wd-en">${esc(s.en)}</div>` : ''}</li>`
        if (kind === 'co') return `<li>${s.pos ? `<div class="wd-sub">${esc(String(s.pos).replace(/\[[^\]]*\]/g,'').trim())}</div>` : ''}<div class="wd-def">${esc(s.cn)}</div>${s.en ? `<div class="wd-en">${esc(s.en)}</div>` : ''}</li>`
        if (kind === 'ld') return `<li><div class="wd-def">${esc(s.en)}</div>${s.cn ? `<div class="wd-en wd-cn">${esc(s.cn)}</div>` : ''}</li>`
        return `<li><div class="wd-def">${esc(s.en)}</div></li>`
      }).join('')
      return `<section class="wd-src"><h4>${name}</h4><ol class="wd-list">${rows}</ol></section>`
    }
    let body = ''
    body += srcBlock('牛津高阶英汉双解', ox?.senses, 'ox')
    body += srcBlock('柯林斯高阶双解', co?.senses, 'co')
    body += srcBlock('朗文当代高级', ld?.senses, 'ld')
    body += srcBlock('Vocabulary.com', vb?.senses, 'vb')
    if (coll?.phrases?.length) {
      body += `<section class="wd-src"><h4>牛津搭配词典</h4><div class="wd-collos">${coll.phrases.map(p => `<span>${esc(p)}</span>`).join('')}</div></section>`
    }

    // ---- 例句（中英对照）----
    if (entry.examples?.length) {
      const exs = entry.examples.map(x => {
        const hl = x.en.replace(new RegExp(`(${activeWord.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')})`,'gi'), '<em>$1</em>')
        return `<li><div class="wd-ex-en">${esc(hl).replace(/&lt;em&gt;/g,'<em>').replace(/&lt;\/em&gt;/g,'</em>')}</div>${x.cn ? `<div class="wd-ex-cn">${esc(x.cn)}</div>` : ''}</li>`
      }).join('')
      body += `<section class="wd-src wd-ex"><h4>例句</h4><ul class="wd-examples">${exs}</ul></section>`
    }

    if (!body) body = '<p class="wd-empty">这个词暂时没有收录释义，你可以点击“朗读单词”听发音，或把它加入单词本。</p>'

    // 新版：贴在单词旁边的小卡片（wordpop.js）；不可用时退回旧的大弹窗
    if (window.TEM8_WORDPOP) {
      const w = activeWord
      window.TEM8_WORDPOP.open({
        word: w, lemma, pos: posClean, phon, uk: md.uk, us: md.us,
        meaning: primary || '词典暂未收录这个词。',
        freq: examFreq(w, lemma),
        fullHTML: top + body,
        saved: (store.wordbook || []).includes(w),
        onSpeak: speak,
        onSave: () => { const set=new Set(store.wordbook || []); set.has(w) ? set.delete(w) : set.add(w); store.wordbook=[...set]; save(); if (readerTab==='words' && view==='reader') renderReader(); return set.has(w) }
      })
      return
    }
    $('word-dictionary').innerHTML = top + body
    $('word-save').textContent = (store.wordbook || []).includes(activeWord) ? '★ 已加入单词本' : '☆ 加入单词本'
    const dlg = $('word-dialog')
    if (!dlg.open) dlg.showModal()
    dlg.querySelector('.word-scroll')?.scrollTo(0,0)
  }
  // 统计单词在全部真题阅读原文里出现的次数（含常见变形），首次查词时建表
  let freqMap = null
  function examFreq(word, lemma) {
    try {
      if (!freqMap) {
        freqMap = new Map()
        for (const a of allArticles) for (const seg of (a.segments || [])) {
          const t = String(seg.en || seg.text || '').toLowerCase().match(/[a-z]+(?:'[a-z]+)?/g) || []
          for (const k of t) freqMap.set(k, (freqMap.get(k) || 0) + 1)
        }
      }
      const base = String(lemma || word)
      const forms = new Set([word, base, base+'s', base+'es', base+'ed', base+'d', base+'ing', base.replace(/e$/,'')+'ing', base.replace(/y$/,'ies'), base.replace(/y$/,'ied')])
      let n = 0
      for (const f of forms) n += freqMap.get(f) || 0
      return n
    } catch (e) { return 0 }
  }
  function speak() {
    if (!activeWord || !('speechSynthesis' in window)) { alert('当前浏览器不支持语音朗读。'); return }
    speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(activeWord)
    utterance.lang='en-US'; utterance.rate=.85
    speechSynthesis.speak(utterance)
  }
  function playAudio(src) {
    try { const a = new Audio(src); a.play().catch(()=>{}) } catch (e) {}
  }
  document.addEventListener('click', e => {
    const target = e.target.closest('button,[data-view]')
    if (!target) return
    if (target.dataset.audio) { playAudio(target.dataset.audio); return }
    if (target.dataset.view) { if (session && view !== 'exam') persist(); if (session && view !== 'reader') persist(); if (session && target.dataset.view !== 'exam') { persist(); session=null } page(target.dataset.view); return }
    if (target.dataset.openReader !== undefined) { openReader(target.dataset.mode,target.dataset.article); return }
    if (target.dataset.wordExport) { exportWords(target.dataset.wordExport); return }
    if (target.dataset.wordRemove) { syncWordbook(); store.wordbook = (store.wordbook || []).filter(w => w !== target.dataset.wordRemove); save(); renderWordbook(); return }
    if (target.dataset.wordClear !== undefined) { if (!confirm('清空生词本？此操作不可恢复。')) return; store.wordbook = []; save(); renderWordbook(); return }
    if (target.dataset.mockYear) { window.TEM8_WORKFLOW?.openMock(Number(target.dataset.mockYear)); return }
    if (target.dataset.paperYear) { paperYear=Number(target.dataset.paperYear);paperTab='language';page('paper-archive');return }
    if (target.dataset.paperBack !== undefined) { page('papers');return }
    if (target.dataset.paperTab) { paperTab=target.dataset.paperTab;renderArchivePaper();return }
    if (target.dataset.libraryYear) { selectedLibraryYear=Number(target.dataset.libraryYear); renderLibrary(); return }
    if (target.dataset.articleMode && activeArticle.id !== 'sample') { readerMode=target.dataset.articleMode; readerTab='translate'; updateReaderChrome(); renderReader(); window.scrollTo(0,0); return }
    if (target.dataset.practiceJump !== undefined) { store.practiceIndex ||= {}; store.practiceIndex[activeArticle.id]=Number(target.dataset.practiceJump); save(); renderReader(); return }
    if (target.dataset.practiceStep) { const qs=practiceQuestions(); store.practiceIndex ||= {}; store.practiceIndex[activeArticle.id]=Math.max(0,Math.min(qs.length-1,(Number(store.practiceIndex[activeArticle.id])||0)+Number(target.dataset.practiceStep))); save(); renderReader(); return }
    if (target.dataset.practiceAnswer) { store.practiceAnswers ||= {}; store.practiceAnswers[`${activeArticle.id}-${target.dataset.practiceAnswer}`]=Number(target.dataset.choice); save(); renderReader(); return }
    if (target.dataset.start) { target.dataset.start === 'all' ? start(questions.map(q=>q.id),'示例模拟卷') : startType(target.dataset.start); return }
    if (target.dataset.startOne) { start([target.dataset.startOne],'单题回练'); return }
    if (target.dataset.option !== undefined && session) { session.answers[session.ids[session.current]] = Number(target.dataset.option); renderQuestion(); return }
    if (target.dataset.jump !== undefined && session) { session.current=Number(target.dataset.jump); renderQuestion(); window.scrollTo(0,0); return }
    if (target.dataset.bookmark) { const set=new Set(store.bookmarks); set.has(target.dataset.bookmark) ? set.delete(target.dataset.bookmark) : set.add(target.dataset.bookmark); store.bookmarks=[...set]; save(); if (view==='exam') renderQuestion(); if (view==='result') renderResult(); return }
    if (target.dataset.readerTab) { readerTab=target.dataset.readerTab; renderReader(); return }
    if (target.dataset.font) { store.readingFont=Math.max(14,Math.min(24,store.readingFont+Number(target.dataset.font))); save(); $('reader-view').style.setProperty('--reader-font-size',store.readingFont+'px'); return }
    if (target.dataset.readingBackground !== undefined) { store.readingBackground=store.readingBackground==='sepia'?'paper':'sepia'; save(); updateReaderChrome(); return }
    if (target.dataset.translate !== undefined) { const i=Number(target.dataset.translate); translations[i]=!translations[i]; renderReader(); return }
    if (target.dataset.markRead) { const state=articleState(activeArticle.id); state.progress=Math.max(state.progress,Number(target.dataset.markRead)); setArticleState(activeArticle.id,state); renderReader(); return }
    if (target.dataset.word) { const sel=window.getSelection(); if (sel && !sel.isCollapsed && String(sel).trim()) return; showWord(target.dataset.word,Number(target.dataset.segment)); return }
    if (target.dataset.readerAnswer) { readerAnswers[target.dataset.readerAnswer]=Number(target.dataset.index); renderReader(); return }
    if (target.dataset.action === 'translate-all') { translations=translations.map(()=>!translations.every(Boolean)); renderReader(); return }
    if (target.dataset.action === 'reading-done') { setArticleState(activeArticle.id,{ progress:activeArticle.segments.length, completed:true }); $('reading-done').textContent='✓ 已读完'; $('reading-done').classList.add('done'); renderReader(); return }
    if (target.dataset.action === 'resume' && store.draft) { start(store.draft.ids,store.draft.title,store.draft); return }
    if (target.dataset.action === 'retry-all') { start(store.mistakes.slice(),'错题回练'); return }
  })
  $('exit-exam').addEventListener('click',()=>{ persist(); session=null; page('papers') })
  $('prev-question').addEventListener('click',()=>{ if (session && session.current>0) { session.current--; renderQuestion() } })
  $('next-question').addEventListener('click',()=>{ if (!session) return; if (session.current<session.ids.length-1) { session.current++; renderQuestion(); window.scrollTo(0,0) } else confirmSubmit() })
  $('submit-exam').addEventListener('click',confirmSubmit)
  $('dialog-cancel').addEventListener('click',()=>$('confirm-dialog').close())
  $('dialog-confirm').addEventListener('click',()=>{ $('confirm-dialog').close(); submit() })
  $('reader-back').addEventListener('click',()=>{ page(readerFrom); if (readerFrom==='exam') renderQuestion() })
  $('word-close').addEventListener('click',()=>$('word-dialog').close())
  $('word-speak').addEventListener('click',speak)
  $('word-save').addEventListener('click',()=>{ if (!activeWord) return; const set=new Set(store.wordbook || []); set.has(activeWord) ? set.delete(activeWord) : set.add(activeWord); store.wordbook=[...set]; save(); $('word-save').textContent=set.has(activeWord) ? '★ 已加入单词本' : '☆ 加入单词本'; if (readerTab==='words') renderReader() })
  document.addEventListener('input',e=>{ if (e.target.id==='open-answer' && session) { session.answers[session.ids[session.current]]=e.target.value; updateCount(); $('answer-status').textContent=`已答 ${session.ids.filter(answered).length} 题`; $('answer-grid').children[session.current].classList.toggle('answered',answered(session.ids[session.current])); persist() } })
  document.addEventListener('input',e=>{ if (e.target.dataset.practiceShort) { store.practiceAnswers ||= {}; store.practiceAnswers[`${activeArticle.id}-${e.target.dataset.practiceShort}`]=e.target.value; save(); const count=e.target.value.trim().split(/\s+/).filter(Boolean).length; e.target.nextElementSibling.textContent=`${count} / 10 词`; const q=practiceQuestions(); document.querySelector('.practice-panel .practice-pane-head span').textContent=`已答 ${q.filter(item => practiceAnswer(item) !== undefined && practiceAnswer(item) !== '').length} / ${q.length} · 自动保存` } })
  document.addEventListener('input',e=>{ if (e.target.dataset.paperError) { const state=paperState();state.language ||= {};state.language[e.target.dataset.paperError]=e.target.value;save() } else if (e.target.dataset.paperField) { const state=paperState();state[e.target.dataset.paperField]=e.target.value;save();e.target.nextElementSibling.textContent=`${e.target.value.trim().split(/\s+/).filter(Boolean).length} 词` } })
  setInterval(()=>{ if (session) { $('timer').textContent=time(elapsed()); if (elapsed()%10===0) persist() } },1000)
  window.addEventListener('beforeunload',persist)
  window.TEM8_ANNO?.setOpener((id,seg) => {
    if (!allArticles.some(a => a.id === id)) return
    openReader('free',id)
    if (seg >= 0) setTimeout(() => {
      const p=document.querySelector(`[data-anno-scope][data-anno-article="${id}"] [data-anno-p="${seg}"]`)
      if (p) { p.scrollIntoView({behavior:'smooth',block:'center'}); p.classList.add('anno-flash'); setTimeout(() => p.classList.remove('anno-flash'),1200) }
    },320)
  })
  $('today').textContent = new Intl.DateTimeFormat('zh-CN',{year:'numeric',month:'long',day:'numeric'}).format(new Date())
  // 暴露给其他模块（workflow.js / intensive.js 等）复用同一个查词弹窗
  window.TEM8_SHOW_WORD = (word) => {
    const w = String(word || '').toLowerCase().replace(/[’]/g,"'")
    if (!w) return
    // 独立来源（模考/精听）没有 activeArticle 语境，临时挂一个空上下文避免报错
    if (!activeArticle || !activeArticle.segments) activeArticle = sampleArticle
    showWord(w, 0)
  }
  renderCategories(); renderDashboard(); page('home')
})()
