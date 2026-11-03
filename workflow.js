(() => {
  'use strict'
  const articles=[...(window.TEM8_2026_ARTICLES||[]),...(window.TEM8_2025_ARTICLES||[]),...(window.TEM8_MID_ARTICLES||[]),...(window.TEM8_ARCHIVE_ARTICLES||[]),...(window.TEM8_ARCHIVE_ARTICLES2||[])]
  const questions=[...(window.TEM8_2026_QUESTIONS||[]),...(window.TEM8_2025_QUESTIONS||[]),...(window.TEM8_MID_QUESTIONS||[]),...(window.TEM8_ARCHIVE_QUESTIONS||[]),...(window.TEM8_ARCHIVE_QUESTIONS2||[])]
  const papers={...(window.TEM8_PAPER_EXTRAS||{}),...(window.TEM8_PAPER_EXTRAS2||{}),...(window.TEM8_PAPER_EXTRAS_2025||{}),...(window.TEM8_PAPER_EXTRAS_2026||{}),...(window.TEM8_MID_EXTRAS||{})}
  const listening={...(window.TEM8_LISTENING_ARCHIVE||{}),...(window.TEM8_LISTENING_2026||{}),...(window.TEM8_MID_LISTENING||{})}
  const audioOf=y=>listening[y]?.audio||''
  function mockPlan(year){
    const y=Number(year),track=listening[y],paper=papers[y],passages=articles.filter(a=>Number(a.year)===y)
    const groups=[]
    if(track?.miniLecture?.blanks?.length)groups.push({kind:'lecture',year:y})
    if(track?.interview?.questions?.length)groups.push({kind:'interview',year:y})
    passages.forEach(a=>groups.push({kind:'reading',year:y,articleId:a.id,questionNumbers:byType(a,'reading-group').map(q=>q.number)}))
    if(paper?.languageLines?.length)groups.push({kind:'language',year:y})
    if(paper?.translation?.length)groups.push({kind:'translation',year:y})
    if(paper?.writing?.length)groups.push({kind:'writing',year:y})
    const missing=[]
    if(!track?.audio)missing.push('听力音频')
    if(!track?.miniLecture?.blanks?.length)missing.push('Section A')
    if(!track?.interview?.questions?.length)missing.push('Section B')
    if(!passages.length||passages.some(a=>!byType(a,'reading-group').length))missing.push('阅读')
    if(!paper?.languageLines?.length)missing.push('改错')
    if(!paper?.translation?.length)missing.push('翻译')
    if(!paper?.writing?.length)missing.push('写作')
    return {year:y,groups,missing,ready:missing.length===0}
  }
  const mockYears=()=>Object.keys(listening).map(Number).filter(y=>mockPlan(y).ready).sort((a,b)=>b-a)
  const isListening=id=>id==='lecture'||id==='interview'
  let trFollowRaf=0
  const types=[
    {id:'lecture',name:'听力 Section A',sub:'Mini-lecture 填空',icon:'◖'},
    {id:'interview',name:'听力 Section B',sub:'Interview 选择',icon:'♫'},
    {id:'reading-group',name:'阅读专项',sub:'按 Passage 筛选 · 选择题＋简答题',icon:'▧'},
    {id:'language',name:'改错专项',sub:'整套逐行作答',icon:'⌁'},
    {id:'translation',name:'翻译：中译英',sub:'译文与草稿',icon:'↗'},
    {id:'writing',name:'写作：摘要＋观点',sub:'材料阅读与作文',icon:'✒'}
  ]
  const isReading=id=>id.startsWith('reading-')
  const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
  const words=s=>String(s||'').trim().split(/\s+/).filter(Boolean).length
  const yearList=id=>isReading(id)?[...new Set(articles.filter(a=>byType(a,id).length).map(a=>a.year))].sort((a,b)=>b-a):id==='lecture'||id==='interview'?Object.keys(listening).map(Number).filter(y=>!listening[y]?.intensiveOnly).sort((a,b)=>b-a):id==='mock'?mockYears():Object.keys(papers).map(Number).sort((a,b)=>b-a)
  const articleQuestions=a=>questions.filter(q=>q.articleId===a.id)
  const byType=(a,type)=>articleQuestions(a)
  const title=id=>types.find(t=>t.id===id)?.name||(id==='mock'?'整卷模考':id)
  const KEY='tem8_workflow_v2'
  const saved=()=>{try{return JSON.parse(localStorage.getItem(KEY))||{}}catch{return {}}}
  let state={type:'reading-group',year:2026,range:'one',articleId:'2026-1',customIds:[],mode:'practice',durationMinutes:0,allowWord:true,showTranscript:false,replay:false,showReference:false,showShortAnswer:false,showLocator:false,combineReading:true}
  let session=null
  let wordKey=''
  function persist(){if(session)localStorage.setItem(KEY,JSON.stringify({...saved(),session}))}
  document.addEventListener('tem8:flush-records', persist)
  const anno=()=>window.TEM8_ANNO
  function show(id,label){if(id!=='workflow-session-view')window.TEM8_AUDIO?.stop();document.querySelectorAll('.view').forEach(el=>el.classList.toggle('active',el.id===id));document.querySelectorAll('[data-view]').forEach(el=>el.classList.remove('active'));document.querySelector('#crumb').textContent=label;window.scrollTo(0,0)}
  function renderCards(){
    const html=types.map(t=>`<button class="category-card" data-workflow-type="${t.id}"><span class="category-icon">${t.icon}</span><h3>${escape(t.name)}</h3><p>${escape(t.sub)}</p><span class="card-foot">${t.id==='mock'?'查看模考设置':'配置练习'} <b>↗</b></span></button>`).join('')
    document.querySelector('#home-categories').innerHTML=html
    document.querySelector('#paper-categories').innerHTML=html
  }
  function readerActions(article){
    const qs=articleQuestions(article),choice=qs.filter(q=>q.type==='choice'),short=qs.filter(q=>q.type==='short')
    const btn=(type,label)=>`<button class="${type==='reading-group'?'primary-btn':'secondary-btn'}" data-start-passage="${escape(article.id)}" data-passage-type="${type}">${label}</button>`
    return `<div class="workflow-reader-actions"><h3>读完后做题</h3><p>${choice.length} 道选择题 · ${short.length} 道简答题，题号以本卷数据为准。</p>${qs.length?btn('reading-group','做本篇阅读题组 →'):''}</div>`
  }
  function openConfig(type,articleId){
    const years=yearList(type),year=articleId?Number(articleId.slice(0,4)):(years.includes(state.year)?state.year:years[0]);state={...state,type,year,articleId:articleId||'',customIds:[],range:'one',mode:type==='mock'?'exam':'practice',durationMinutes:type==='mock'?listening[year]?.timeLimitMinutes||0:0}
    if(!state.articleId)state.articleId=articles.find(a=>a.year===state.year)?.id||''
    renderConfig();show('workflow-config-view',title(type))
  }
  function rangeOptions(){
    if(!isReading(state.type))return ''
    return `<div class="workflow-range"><label><input type="radio" name="workflow-range" value="one" ${state.range==='one'?'checked':''}> 一篇 Passage 题组</label><label><input type="radio" name="workflow-range" value="all" ${state.range==='all'?'checked':''}> 本年全部文章依次</label><label><input type="radio" name="workflow-range" value="custom" ${state.range==='custom'?'checked':''}> 自定义选择文章</label></div>`
  }
  function articleCards(){
    if(!isReading(state.type))return ''
    const filtered=articles.filter(a=>a.year===state.year&&byType(a,state.type).length)
    return `<div class="workflow-passage-list">${filtered.map((a,i)=>{
      const qs=articleQuestions(a),choice=qs.filter(q=>q.type==='choice'),short=qs.filter(q=>q.type==='short')
      const nums=arr=>arr.length?arr.map(q=>q.number).join('、'):'无'
      return `<label class="workflow-passage-option ${(state.range==='custom'?state.customIds.includes(a.id):state.articleId===a.id)?'selected':''}"><input type="${state.range==='custom'?'checkbox':'radio'}" name="workflow-article" value="${a.id}" ${(state.range==='custom'?state.customIds.includes(a.id):state.articleId===a.id)?'checked':''} ${state.range==='all'?'disabled':''}><span><strong>Passage ${['One','Two','Three','Four','Five'][i]||i+1}</strong><small>选择题 ${choice.length} 道：${nums(choice)}<br>简答题 ${short.length} 道：${nums(short)}</small></span></label>`
    }).join('')}</div>`
  }
  function configSwitch(key,label,available,checked){return `<label class="workflow-toggle ${available?'':'unavailable'}"><input type="checkbox" data-workflow-switch="${key}" ${checked?'checked':''} ${available?'':'disabled'}><span>${label}${available?'':' · 待资料'}</span></label>`}
  function unavailablePreview(type){
    const src=listening[state.year]
    if(type==='lecture'&&src){const x=src.miniLecture,hasAns=x.blanks.some(b=>b.answer)
      const rawTitle=String(x.title||'').trim(),badTitle=/…|\.{3,}|_{3,}|^[IVX]+[.、]/i.test(rawTitle)
      const outline=x.outline.filter((l,i)=>!(i===0&&!badTitle&&l.trim()===rawTitle)).map(l=>{const t=l.trim()
        const lv=t.startsWith('-')?2:t.startsWith('●')?1:(/_{3,}/.test(t)?1:0)
        const text=t.replace(/^[-●]\s*/,'')
        return `<p class="wf-ol lv${lv}">${escape(text)}</p>`}).join('')
      const heading=badTitle?'':`<h2>${escape(rawTitle)}${x.answerSheet?' · '+escape(x.answerSheet):''}</h2>`
      return `<div class="workflow-card">${heading}<p class="workflow-hint">原卷提纲已录入，${x.blanks.length} 个填空。${src.audio?'音频已导入，点“开始作答”即可边听边填；':'音频尚未提供，可先纸面作答；'}${hasAns?'下方可展开答案与详解。':'答案待补充。'}</p><div class="workflow-prompt wf-outline">${outline}</div>${hasAns?`<div class="wf-answer-list">${x.blanks.map(b=>`<details class="wf-answer-row"><summary><span class="wf-qno">${b.number}</span><span class="wf-right">${escape(b.answer)}</span></summary>${b.analysis?`<p class="wf-analysis">${escape(b.analysis)}</p>`:''}</details>`).join('')}</div>`:''}</div>`}
    if(type==='interview'&&src){const qs=src.interview.questions
      const item=q=>`<article class="wf-intv-item"><div class="wf-intv-body"><span class="wf-intv-no">${q.number>15?q.number:q.number+15}</span><ol class="wf-intv-options">${q.options.map((o,i)=>`<li><b>${'ABCD'[i]}.</b><span>${escape(o)}</span></li>`).join('')}</ol></div></article>`
      return `<div class="workflow-card"><p class="workflow-hint">Section B · Interview，共 ${qs.length} 道选择题。原卷只印选项，题干由听力音频给出。${src.audio?'音频已导入，点“开始作答”边听边选，交卷后才给出答案与解析。':'音频尚未提供，可先按纸面选择；交卷后给出答案与解析。'}</p><div class="workflow-interview-preview">${qs.map(item).join('')}</div></div>`}
    if(type==='language'&&papers[state.year]){const x=papers[state.year],rows=x.languageLines||[],ans=x.languageAnswers||[],gaps=rows.filter(r=>/(\d+)/.test(r[1]||'')).length
      const list=rows.map((row,i)=>{const n=(/(\d+)/.exec(row[1]||'')||[])[1]
        return `<div class="wf-lang-line${n?' has-gap':''}"><span class="wf-lang-no${n?'':' empty'}">${n||''}</span><p>${escape(row[0])}</p></div>`}).join('')
      return `<div class="workflow-card"><h2>Language Usage · 改错</h2><p class="workflow-hint">原题共 ${gaps} 处待改，作答时逐行判断并填写修改。${ans.length?'答案与解析已录入，提交后可对照。':'答案待补充。'}</p><div class="wf-lang-preview">${list}</div></div>`}
    if(type==='translation'&&papers[state.year]){const x=papers[state.year],full=(x.translation||[]).join('\n'),target=x.translationTarget
      const src=target&&full.includes(target)?escape(full.slice(0,full.indexOf(target)))+`<mark>${escape(target)}</mark>`+escape(full.slice(full.indexOf(target)+target.length)):escape(full)
      return `<div class="workflow-card"><h2>Translation · 汉译英</h2><p class="workflow-hint">${target?'划线部分为本题要求翻译的内容。':'原卷划线范围尚未录入，请对照原卷确认翻译范围。'}${x.translationReference?'参考译文已录入。':''}</p><div class="workflow-prompt">${src}</div></div>`}
    if(type==='writing'&&papers[state.year]){const x=papers[state.year]
      return `<div class="workflow-card"><h2>Writing · 摘要＋观点</h2><p class="workflow-hint">原卷要求与材料已录入${x.writingMinWords?`，最低 ${x.writingMinWords} 词`:''}。${x.writingGuide?'后方附写作指南。':''}</p><div class="workflow-prompt wf-preview-scroll">${(x.writing||[]).map(l=>`<p>${escape(l)}</p>`).join('')}</div></div>`}
    return ''
  }
  const mmss=s=>s?`${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`:''
  const normAns=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'')
  const cjkAns=s=>/[\u4e00-\u9fa5]/.test(String(s||''))
  const okBlank=(ans,mine)=>{const m=normAns(mine);return String(ans||'').split('//').map(x=>normAns(x)).filter(Boolean).some(a=>a===m)}
  function renderConfig(){
    const type=state.type,audio=audioOf(state.year),hasAudio=!!audio,missingAudio=isListening(type)&&!hasAudio,noSelection=isReading(type)&&state.range==='custom'&&!state.customIds.length,noDuration=state.mode==='exam'&&!state.durationMinutes
    const years=yearList(type)
    const count=isReading(type)?articles.filter(a=>a.year===state.year).length:papers[state.year]?1:0
    const audioCard=isListening(type)?(hasAudio
      ?`<div class="wf-audio-file"><div><strong>听力音频已就绪</strong><span>${escape(listening[state.year].audioNote||`${state.year} 年真题听力`)}</span></div><time>${mmss(listening[state.year].audioDuration)}</time></div>`
      :`<p class="workflow-hint">本年音频尚未导入：Section ${type==='lecture'?'A':'B'} 仍可按纸面作答，${type==='lecture'?'但填空专项需要音频才能启动。':'交卷后给出答案与解析。'}</p>`):''
    document.querySelector('#workflow-config-content').innerHTML=`
      <button class="back-link" data-workflow-back="${type==='mock'?'mock':'papers'}">← ${type==='mock'?'返回模考列表':'返回题库'}</button>
      <div class="page-head"><span class="eyebrow">PRACTICE SETUP</span><h1>${escape(title(type))}</h1><p>按试卷数据选择范围和作答方式。</p></div>
      <div class="workflow-config-grid"><section class="workflow-card"><h2>来源与范围</h2><label class="workflow-field">真题年份<select id="workflow-year">${years.map(y=>`<option value="${y}" ${y===state.year?'selected':''}>${y} 年真题</option>`).join('')}</select></label><p class="workflow-hint">模拟题资料尚未录入，当前仅可选择已导入的真题。${count?'':'本年暂无该题型。'}</p>${audioCard}${rangeOptions()}${articleCards()}</section>
      <section class="workflow-card"><h2>作答模式</h2><div class="workflow-mode-list"><label><input type="radio" name="workflow-mode" value="practice" ${state.mode==='practice'?'checked':''} ${type==='mock'?'disabled':''}> 练习模式</label><label><input type="radio" name="workflow-mode" value="exam" ${state.mode==='exam'?'checked':''}> 考试模式</label><label class="unavailable"><input type="radio" name="workflow-mode" value="instant" disabled> 即时解析 · 待解析资料</label></div>${state.mode==='exam'?`<label class="workflow-field">本次倒计时（分钟）<input type="number" id="workflow-duration" min="1" max="300" value="${state.durationMinutes||''}" placeholder="按这次练习需要填写"></label>`:''}<h2>辅助设置</h2><div class="workflow-switch-list">${configSwitch('allowWord','阅读查词',(isReading(type)||type==='mock')&&state.mode!=='exam',state.allowWord&&state.mode!=='exam')}${configSwitch('showTranscript','显示听力原文',false,false)}${configSwitch('replay','考试模式允许回听',isListening(type)&&hasAudio,state.replay)}${configSwitch('showReference','显示参考译文或范文',false,false)}${configSwitch('showShortAnswer','显示简答参考答案',false,false)}${configSwitch('showLocator','显示定位句',false,false)}</div>${type==='mock'?`<div class="workflow-alert ok">${state.year} 年整卷 · ${mockPlan(state.year).groups.length} 个连续题组，严格按本年度资料加载：Section A → Section B → ${articles.filter(a=>Number(a.year)===state.year).length} 篇阅读 → 改错 → 翻译 → 写作。音频与每个题组均按 ${state.year} 年数据关联。</div>`:''}${isListening(type)&&hasAudio?`<p class="workflow-alert ok">音频时长 ${mmss(listening[state.year].audioDuration)}，含 Section A 与 Section B${listening[state.year].sectionAEnd?`（A 至 ${mmss(listening[state.year].sectionAEnd)}，B 自 ${mmss(listening[state.year].sectionBStart)} 起）`:''}。练习模式可随时暂停、拖动、倍速；考试模式下若未开启回听，开始后只能一直播到本节结尾。</p>`:''}${missingAudio?'<p class="workflow-alert">音频尚未提供：Section B 可先按纸面选好答案，交卷后给出答案与解析；播放与回放暂不可用。</p>':''}${type==='mock'?'<label class="workflow-toggle"><input type="checkbox" data-workflow-switch="combineReading" '+(state.combineReading?'checked':'')+'> 阅读按文章题组合并作答</label>':''}${(saved().session?.type===type&&(type!=='mock'||Number(saved().session?.year)===Number(state.year)))?'<button class="secondary-btn" data-workflow-resume>继续上次题组</button> ':''}${type==='mock'?`<button class="primary-btn" data-workflow-start ${noDuration?'disabled':''}>${noDuration?'填写倒计时':'开始 '+state.year+' 年整卷模考'} <span>→</span></button>`:type==='lecture'&&!hasAudio?'<button class="primary-btn" disabled>音频未提供 · 暂不可启动</button>':`<button class="primary-btn" data-workflow-start ${noSelection||noDuration?'disabled':''}>${noSelection?'请先选择文章':noDuration?'填写倒计时':'开始作答'} <span>→</span></button>`}</section></div>${unavailablePreview(type)}`
  }
  function makeGroups(){
    if(state.type==='mock')return mockPlan(state.year).groups
    if(isReading(state.type)){
      const source=articles.filter(a=>a.year===state.year&&byType(a,state.type).length)
      const selected=state.range==='all'?source:state.range==='custom'?source.filter(a=>state.customIds.includes(a.id)):source.filter(a=>a.id===state.articleId)
      return selected.map(a=>({kind:'reading',articleId:a.id,questionNumbers:byType(a,state.type).map(q=>q.number)}))
    }
    return [{kind:state.type,year:state.year}]
  }
  function openMock(year){const y=Number(year);if(!mockYears().includes(y))return;openConfig('mock');state.year=y;state.durationMinutes=listening[y]?.timeLimitMinutes||papers[y]?.timeLimitMinutes||0;renderConfig()}
  function start(){
    if(state.type==='mock'&&!mockPlan(state.year).ready)return
    if(state.type==='lecture'&&!audioOf(state.year))return
    const groups=makeGroups();if(!groups.length)return
    if(state.type==='mock'&&groups.some(g=>Number(g.year)!==Number(state.year)))return
    session={groups,current:0,answers:{},marks:{},started:Date.now(),deadline:state.mode==='exam'?Date.now()+state.durationMinutes*60000:null,mode:state.mode,allowWord:state.allowWord&&state.mode!=='exam',replay:state.replay,type:state.type,year:state.year}
    persist();renderSession();show('workflow-session-view',title(state.type))
  }
  function group(){return session.groups[session.current]}
  function article(){return articles.find(a=>a.id===group().articleId)}
  function qid(q){return `${q.articleId}-${q.number}`}
  function questionRows(qs){
    const choice=qs.filter(q=>q.type==='choice'),short=qs.filter(q=>q.type==='short')
    let html=''
    if(choice.length)html+=`<h3 class="workflow-section-title">选择题 <small>${choice.length} 道</small></h3>`+choice.map(q=>`<article class="workflow-question" id="wf-q-${qid(q)}"><div class="workflow-question-head"><span>Q${q.number} · 选择题</span><button data-workflow-mark="${qid(q)}" class="${session.marks[qid(q)]?'marked':''}">${session.marks[qid(q)]?'★':'☆'} 标记</button></div><h4>${escape(q.prompt)}</h4><div class="workflow-options">${q.options.map((option,i)=>`<label class="${session.answers[qid(q)]===i?'selected':''}"><input type="radio" name="wf-${qid(q)}" data-workflow-choice="${qid(q)}" value="${i}" ${session.answers[qid(q)]===i?'checked':''}><b>${'ABCD'[i]}</b><span>${escape(option)}</span></label>`).join('')}</div></article>`).join('')
    if(short.length)html+=`<h3 class="workflow-section-title">简答题 <small>${short.length} 道</small></h3>`+short.map(q=>{
      const limit=q.wordLimit,value=session.answers[qid(q)]||'',count=words(value)
      return `<article class="workflow-question" id="wf-q-${qid(q)}"><div class="workflow-question-head"><span>Q${q.number} · 简答题</span><button data-workflow-mark="${qid(q)}" class="${session.marks[qid(q)]?'marked':''}">${session.marks[qid(q)]?'★':'☆'} 标记</button></div><h4>${escape(q.prompt)}</h4><textarea data-workflow-short="${qid(q)}" placeholder="在此作答">${escape(value)}</textarea><div class="workflow-question-foot">${q.locatorParagraph||/Para\.\s*\d+/i.test(q.prompt)?`<button data-workflow-locate="${qid(q)}">查看原文对应段落</button>`:'<span></span>'}<span data-count-for="${qid(q)}" class="${limit&&count>limit?'over':''}">${count}${limit?` / ${limit} 词${count>limit?' · 超出限制':''}`:' 词 · 上限未录入'}</span></div></article>`
    }).join('')
    return html
  }
  function passageText(a){
    const A=anno(),allow=!!session.allowWord
    return `<div class="workflow-article" data-anno-scope data-anno-article="${a.id}" data-anno-word="${allow?1:0}" data-anno-word-attr="data-workflow-word">${a.segments.map((s,i)=>{
      const n=A?A.noteCount(a.id,i):0
      const body=A?A.textHTML(a.id,i,s.en,{word:allow,attr:'data-workflow-word'}):escape(s.en)
      return `<p id="wf-p-${i+1}" data-anno-p="${i}"><b>${String(s.number||i+1).padStart(2,'0')}</b><span class="anno-text">${body}</span><span class="anno-tools"><button class="anno-pbtn${n?' has':''}" type="button" data-anno-open="${i}" title="${n?`第 ${i+1} 段有 ${n} 条笔记`:`在第 ${i+1} 段记笔记`}">✎${n||''}</button></span></p>`}).join('')}</div>`
  }
  function renderReading(){
    const a=article(),qs=byType(a,session.type)
    return `<div class="workflow-reading-layout"><section class="workflow-reading-passage"><div class="workflow-sticky-head"><strong>${a.year} · ${a.label}</strong><span>选中原文即可标记 · 笔记在右侧</span></div>${passageText(a)}</section><section class="workflow-reading-questions"><div class="workflow-sticky-head"><strong>本篇题组</strong><span>${qs.length} 题 · 自动保存</span></div>${questionRows(qs)}</section></div>`
  }
  const blankW=v=>Math.min(300,Math.max(158,String(v||'').length*7.2+26))
  function blankInput(year,n){
    const key=`lecture-${year}-${n}`,val=session.answers[key]||''
    return `<span class="wf-blank-no">(${n})</span><input class="wf-blank${val?' filled':''}" id="wf-b-${key}" data-workflow-blank="${key}" value="${escape(val)}" style="width:${blankW(val)}px" placeholder="" autocomplete="off" spellcheck="false">`
  }
  function renderLecture(){
    const g=group(),src=listening[g.year],x=src?.miniLecture
    if(!x)return '<div class="workflow-card"><p class="workflow-hint">本年暂无 Section A 数据。</p></div>'
    const raw=String(x.title||'').trim(),bad=/…|\.{3,}|_{3,}|^[IVX]+[.、]/i.test(raw)
    const rows=x.outline.map((line,i)=>{
      if(i===0&&!bad&&line.trim()===raw)return ''
      const t=line.trim(),lv=t.startsWith('-')?2:t.startsWith('●')?1:(/_{3,}/.test(t)?1:0),body=t.replace(/^[-●]\s*/,'')
      const has=/(\d+)\)\s*_{2,}/.test(body)
      const html=escape(body).replace(/\((\d+)\)\s*_{2,}/g,(m,num)=>blankInput(g.year,num))
      return `<p class="wf-ol lv${lv}${has?' has-blank':''}">${html}</p>`
    }).join('')
    const filled=x.blanks.filter(b=>String(session.answers[`lecture-${g.year}-${b.number}`]||'').trim()).length
    return `<div class="workflow-card"><div class="wf-lecture-head"><h2>${escape(raw)}${x.answerSheet?' · '+escape(x.answerSheet):''}</h2><span class="wf-lecture-count" id="wf-lecture-count">已填 ${filled} / ${x.blanks.length}</span></div><p class="workflow-hint">边听边填，共 ${x.blanks.length} 空${x.blanks[0]?.wordLimit?`，每空不超过 ${x.blanks[0].wordLimit} 词`:''}。交卷后逐空对照答案与详解。</p><div class="workflow-prompt wf-outline wf-lecture-outline">${rows}</div></div>`
  }
  function renderInterview(){
    const g=group(),src=listening[g.year],qs=src?.interview?.questions||[]
    return `<div class="workflow-card"><p class="workflow-hint">Section B · Interview，共 ${qs.length} 道选择题。原卷只印选项，题干由听力音频给出。${src?.audio?'音频在页面上方可暂停、回听；交卷后给出答案与解析。':'音频尚未提供，本次为纸面作答；交卷后给出答案与解析。'}</p><div class="workflow-interview-preview">${qs.map(q=>{
      const key=`interview-${g.year}-${q.number}`,mine=session.answers[key]
      return `<article class="wf-intv-item" id="wf-q-${key}"><div class="wf-intv-body"><span class="wf-intv-no">${q.number>15?q.number:q.number+15}</span><div class="workflow-options">${q.options.map((o,i)=>`<label class="${mine===i?'selected':''}"><input type="radio" name="wf-${key}" data-workflow-choice="${key}" value="${i}" ${mine===i?'checked':''}><b>${'ABCD'[i]}</b><span>${escape(o)}</span></label>`).join('')}</div></div></article>`}).join('')}</div></div>`
  }
  function renderLanguage(){
    const source=papers[group().year],rows=source?.languageLines||[]
    return `<div class="workflow-card"><h2>Language Usage · 改错</h2><p class="workflow-hint">逐行判断错误类型并填写修改内容；提交后可在报告页对照答案与解析自查。</p><div class="workflow-language">${rows.map((row,i)=>{
      const key=`language-${group().year}-${i+1}`,ans=session.answers[key]||{}
      return `<div class="workflow-language-row" id="wf-row-${i+1}"><b>${i+1}</b><p>${escape(row[0])}</p><div class="workflow-language-input"><select data-workflow-error-kind="${key}"><option value="">选择操作</option><option value="replace" ${ans.kind==='replace'?'selected':''}>改词</option><option value="insert" ${ans.kind==='insert'?'selected':''}>缺词 ^</option><option value="delete" ${ans.kind==='delete'?'selected':''}>多余词 /</option></select><input data-workflow-error-text="${key}" value="${escape(ans.text||'')}" placeholder="输入原词与修改词"></div></div>`
    }).join('')}</div></div>`
  }
  function renderTranslation(){const src=papers[group().year],full=src.translation.join('\n'),target=src.translationTarget,source=target&&full.includes(target)?escape(full.slice(0,full.indexOf(target)))+`<mark>${escape(target)}</mark>`+escape(full.slice(full.indexOf(target)+target.length)):escape(full);return `<div class="workflow-card"><h2>翻译 · 中译英</h2>${target?'':'<p class="workflow-hint">本年原文划线范围尚未录入，请对照原卷确认翻译范围。</p>'}<div class="workflow-prompt">${source}</div><textarea class="workflow-long-answer" data-workflow-text="translation-${group().year}" placeholder="在这里写英文译文">${escape(session.answers[`translation-${group().year}`]||'')}</textarea><p class="workflow-word-count" id="wf-long-count">${words(session.answers[`translation-${group().year}`])} 词 · 草稿自动保存</p></div>`}
  function renderWriting(){const src=papers[group().year],value=session.answers[`writing-${group().year}`]||'',limit=src.writingMinWords;return `<div class="workflow-card"><h2>写作 · 摘要＋观点</h2><details open><summary>写作要求与 Excerpts</summary><div class="workflow-prompt">${src.writing.map(x=>`<p>${escape(x)}</p>`).join('')}</div></details><textarea class="workflow-long-answer" data-workflow-text="writing-${group().year}" placeholder="在这里写作文">${escape(value)}</textarea><p class="workflow-word-count ${limit&&words(value)<limit?'under':''}" id="wf-long-count">${words(value)} 词${limit?` · 最低 ${limit} 词`:''} · 草稿自动保存</p></div>`}
  function answerCard(){
    if(group().kind==='reading'){
      const qs=byType(article(),session.type)
      return `<div class="workflow-answer-card"><strong>答题卡 · ${article().label}</strong><div>${qs.map(q=>`<button data-workflow-jump="${qid(q)}" class="${session.answers[qid(q)]!==undefined&&session.answers[qid(q)]!==''?'answered':''} ${session.marks[qid(q)]?'marked':''}" title="${q.type==='choice'?'选择题':'简答题'}">${q.type==='choice'?'◉':'✎'} ${q.number}</button>`).join('')}</div></div>`
    }
    if(group().kind==='lecture'){const x=listening[group().year]?.miniLecture
      return `<div class="workflow-answer-card"><strong>答题卡 · Section A</strong><div>${(x?.blanks||[]).map(b=>{const key=`lecture-${group().year}-${b.number}`,done=String(session.answers[key]||'').trim()
        return `<button data-workflow-jump="${key}" class="${done?'answered':''}" title="第 ${b.number} 空">${b.number}</button>`}).join('')}</div></div>`}
    if(group().kind==='interview'){const qs=listening[group().year]?.interview?.questions||[]
      return `<div class="workflow-answer-card"><strong>答题卡 · Section B</strong><div>${qs.map(q=>{const key=`interview-${group().year}-${q.number}`,done=session.answers[key]!==undefined
        return `<button data-workflow-jump="${key}" class="${done?'answered':''}" title="Section B 第 ${q.number>15?q.number:q.number+15} 题">${q.number>15?q.number:q.number+15}</button>`}).join('')}</div></div>`}
    if(group().kind==='language')return `<div class="workflow-answer-card"><strong>答题卡 · 改错</strong><div>${(papers[group().year]?.languageLines||[]).map((_,i)=>`<button data-workflow-jump="language-${group().year}-${i+1}" class="${session.answers[`language-${group().year}-${i+1}`]?.text?'answered':''}">行 ${i+1}</button>`).join('')}</div></div>`
    return ''
  }
  function groupLabel(g){return g.kind==='lecture'?'Part I · Section A：Mini-lecture':g.kind==='interview'?'Part I · Section B：Interview':g.kind==='reading'?`Part II · ${article().label}`:g.kind==='language'?'Part III · 改错':g.kind==='translation'?'Part IV · 翻译':'Part V · 写作'}
  function renderSession(){
    const g=group(),elapsed=session.deadline?Math.max(0,Math.ceil((session.deadline-Date.now())/1000)):Math.floor((Date.now()-session.started)/1000)
    const body=g.kind==='reading'?renderReading():g.kind==='lecture'?renderLecture():g.kind==='interview'?renderInterview():g.kind==='language'?renderLanguage():g.kind==='translation'?renderTranslation():renderWriting()
    const track=isListening(g.kind)?listening[g.year]:null
    const slot=track?.audio?'<div id="wf-audio-slot"></div>':''
    const trSec=g.kind==='lecture'?'A':'B'
    const showTr = isListening(g.kind) && session.mode!=='exam' && !!(window.TEM8_TRANSCRIPTS && window.TEM8_TRANSCRIPTS[g.year] && window.TEM8_TRANSCRIPTS[g.year][trSec] && window.TEM8_TRANSCRIPTS[g.year][trSec].length)
    document.querySelector('#workflow-session-content').innerHTML=`<div class="workflow-session-top"><button class="back-link" data-workflow-back="config">← 配置</button><div><strong>${session.type==='mock'?`${session.year} 年整卷模考 · ${escape(groupLabel(g))}`:escape(title(session.type))}</strong><span>${session.current+1} / ${session.groups.length} 组 · ${session.mode==='exam'?'考试':'练习'}模式</span></div>${g.kind==='reading'&&session.mode!=='exam'?'<button class="secondary-btn" data-workflow-study>进入精读</button>':''}<time id="workflow-time">${Math.floor(elapsed/60).toString().padStart(2,'0')}:${(elapsed%60).toString().padStart(2,'0')}</time></div>${slot}${showTr?'<div id="wf-transcript"></div>':''}${answerCard()}${body}<div class="workflow-session-actions"><button class="secondary-btn" data-workflow-prev ${session.current===0?'disabled':''}>上一组</button><button class="primary-btn" data-workflow-next>${session.current<session.groups.length-1?'保存并进入下一组':'交卷'} <span>→</span></button></div><p class="workflow-hint">记录保存在当前浏览器，换设备或清理缓存前，请先在「我的」中导出备份；本次试卷与答题记录均绑定 ${session.year} 年。</p>`
    if(slot){
      // 一份录音含 A+B：A 播 0→讲座结束(sectionAEnd)，B 播指令开始(sectionBStart)→结尾。
      // 中间的"3 分钟检查"静音段两边都不放（真题里是留给考生填空的时间，App 里自己掌控）。
      const bStart=Number(track.sectionBStart)||0
      const aEnd=Number(track.sectionAEnd)||0
      const start=g.kind==='interview'?bStart:0
      const end=g.kind==='lecture'?(aEnd>0?aEnd:(bStart>0?bStart:(track.audioDuration||0))):0
      const hint=g.kind==='interview'&&bStart>0?`已从 Section B 起点（第 ${mmss(bStart)}）开始播放`:g.kind==='lecture'&&aEnd>0?`Section A 至第 ${mmss(aEnd)}（讲座结束即停）`:''
      window.TEM8_AUDIO?.mount(document.querySelector('#wf-audio-slot'),{src:track.audio,mode:session.mode,replay:session.mode==='exam'?!!session.replay:true,title:`${g.year} 真题听力 · Section ${g.kind==='lecture'?'A':'B'}`,duration:track.audioDuration||0,start,end,note:hint})
    }
    if(showTr){ const c=document.querySelector('#wf-transcript'); if(c) renderTranscript(g.year, trSec, c) }
    anno()?.refresh(g.kind==='reading'?article().id:'')
  }
  // 听力原文面板：点句子跳转 + 自动跟读高亮 + 单句循环
  function renderTranscript(year, sec, container){
    const data=(window.TEM8_TRANSCRIPTS && window.TEM8_TRANSCRIPTS[year] && window.TEM8_TRANSCRIPTS[year][sec]) || []
    if(!data.length){ container.style.display='none'; return }
    container.classList.add('wf-transcript')
    container.innerHTML=`<div class="wf-transcript-head"><strong>听力原文</strong><span class="wf-transcript-tip">点击句子跳转 · 自动跟读高亮</span><button type="button" class="wf-tr-loop" data-wf-tr-loop>单句循环</button></div><div class="wf-transcript-body">`+
      data.map((s,i)=>`<p class="wf-tr-line${s.sp?(' sp-'+s.sp):''}" data-wf-tr="${i}" data-t="${s.t}">${s.sp?`<span class="wf-tr-sp">${escape(s.sp)}</span>`:''}<span class="wf-tr-txt">${escape(s.en)}</span></p>`).join('')+
      `</div>`
    const lines=[...container.querySelectorAll('[data-wf-tr]')]
    container._loopOn=false
    lines.forEach(el=>{
      el.addEventListener('click',()=>{
        const t=parseFloat(el.getAttribute('data-t'))
        window.TEM8_AUDIO?.seekTo(t)
      })
    })
    const loopBtn=container.querySelector('[data-wf-tr-loop]')
    if(loopBtn) loopBtn.addEventListener('click',()=>{
      container._loopOn=!container._loopOn
      loopBtn.classList.toggle('on',container._loopOn)
      loopBtn.textContent=container._loopOn?'单句循环 · 开':'单句循环'
    })
    startTranscriptFollow(container, data, lines)
  }
  function startTranscriptFollow(container, data, lines){
    if(trFollowRaf) cancelAnimationFrame(trFollowRaf)
    let last=-2
    const body=container.querySelector('.wf-transcript-body')
    const tick=()=>{
      const A=window.TEM8_AUDIO
      if(!A || !A.mounted){ trFollowRaf=0; return }
      const ct=A.currentTime||0
      let cur=-1
      for(let i=0;i<data.length;i++){ if(ct>=data[i].t-0.15) cur=i; else break }
      if(cur!==last){
        lines.forEach((el,i)=>el.classList.toggle('active', i===cur))
        if(cur>=0 && container._loopOn){
          const boundary=(cur+1<data.length)?data[cur+1].t:Infinity
          if(ct>=boundary-0.12) A.seekTo(data[cur].t)
        }
        if(cur>=0 && body){
          const el=lines[cur]
          if(el){
            const target=el.offsetTop - body.clientHeight/2 + el.clientHeight/2
            body.scrollTo({top:Math.max(0,target),behavior:'smooth'})
          }
        }
        last=cur
      }
      trFollowRaf=requestAnimationFrame(tick)
    }
    trFollowRaf=requestAnimationFrame(tick)
  }

  function report(){
    persist()
    const cards=session.groups.map(g=>{
      if(g.kind==='reading'){
        const a=articles.find(x=>x.id===g.articleId),qs=byType(a,session.type),c=qs.filter(q=>q.type==='choice'),s=qs.filter(q=>q.type==='short')
      const graded=c.filter(q=>typeof q.answer==='number'),ok=graded.filter(q=>session.answers[qid(q)]===q.answer).length
      const rows=[...c,...s].map(q=>{
        if(q.type==='choice'){
          const mine=session.answers[qid(q)],has=typeof q.answer==='number'
          const myText=mine===undefined||mine===''?'未作答':'ABCD'[mine],right=has?'ABCD'[q.answer]:'待补充'
          const mark=!has?'':(mine===undefined||mine===''?'未作答':(mine===q.answer?'正确':'错误'))
          return `<details class="wf-answer-row" ${mark==='错误'?'open':''}><summary><span class="wf-qno">Q${q.number}</span><span class="wf-mine">你的答案 ${myText}</span><span class="wf-right">正确答案 ${right}</span><span class="wf-mark ${mark==='正确'?'ok':mark==='错误'?'bad':''}">${mark}</span></summary><p class="wf-prompt">${escape(q.prompt)}</p>${q.analysis?`<p class="wf-analysis">${escape(q.analysis).replace(/\n/g,'<br>')}</p>`:'<p class="wf-analysis">该题解析待补充。</p>'}</details>`
        }
        const mine=String(session.answers[qid(q)]||'').trim()
        return `<details class="wf-answer-row"><summary><span class="wf-qno">Q${q.number}</span><span class="wf-mine">你的作答 ${words(mine)} 词${q.wordLimit?` / 上限 ${q.wordLimit}`:''}</span><span class="wf-mark">简答 · 自查</span></summary><p class="wf-prompt">${escape(q.prompt)}</p>${q.referenceAnswer?`<p class="wf-analysis"><strong>参考答案：</strong>${escape(q.referenceAnswer)}</p>`:'<p class="wf-analysis">该题参考答案待补充（解析文档未收录）。</p>'}${q.analysis?`<p class="wf-analysis">${escape(q.analysis).replace(/\n/g,'<br>')}</p>`:''}</details>`
      }).join('')
      return `<div class="workflow-report-card"><h3>${a.year} · ${a.label}</h3><p>选择题 <strong>${ok} / ${graded.length}</strong> 正确${graded.length<c.length?`（另有 ${c.length-graded.length} 题答案待补充）`:''}；简答题已答 ${s.filter(q=>String(session.answers[qid(q)]||'').trim()).length} / ${s.length}</p><div class="wf-answer-list">${rows}</div></div>`
      }
      if(g.kind==='lecture'){const x=listening[g.year]?.miniLecture,blanks=x?.blanks||[]
        const gradeable=blanks.filter(b=>b.answer&&!cjkAns(b.answer))
        const ok=gradeable.filter(b=>okBlank(b.answer,session.answers[`lecture-${g.year}-${b.number}`])).length
        const answered=blanks.filter(b=>String(session.answers[`lecture-${g.year}-${b.number}`]||'').trim()).length
        const rows=blanks.map(b=>{
          const key=`lecture-${g.year}-${b.number}`,mine=String(session.answers[key]||'').trim(),self=cjkAns(b.answer)||!b.answer
          const right=okBlank(b.answer,mine)
          const mark=!mine?'':self?'对照':right?'正确':'错误'
          const shown=String(b.answer||'').replace(/\s*\/\/\s*/g,' 或 ')
          return `<details class="wf-answer-row" ${mark==='错误'?'open':''}><summary><span class="wf-qno">${b.number}</span><span class="wf-mine">你的答案 ${escape(mine||'—')}</span><span class="wf-right">${escape(shown||'待补充')}</span>${mark?`<span class="wf-mark ${mark==='正确'?'right':mark==='错误'?'bad':'self'}">${mark}</span>`:''}</summary>${b.analysis?`<p class="wf-analysis">${escape(b.analysis).replace(/\n/g,'<br>')}</p>`:''}</details>`}).join('')
        return `<div class="workflow-report-card"><h3>${g.year} · Listening Section A</h3><p>已填 ${answered} / ${blanks.length}；可比对 ${gradeable.length} 空，其中 <strong>${ok}</strong> 空正确${gradeable.length<blanks.length?`（另有 ${blanks.length-gradeable.length} 空为多答案或任选，请对照自查）`:''}</p><div class="wf-answer-list">${rows}</div></div>`}
      if(g.kind==='language'){const src=papers[g.year],rows=src.languageLines,ans=src.languageAnswers||[]
        const blanks=rows.map((row,i)=>({row,i,n:(/(\d+)/.exec(row[1]||'')||[])[1]})).filter(x=>x.n)
        const answered=blanks.filter(x=>session.answers[`language-${g.year}-${x.i+1}`]?.text).length
        const list=blanks.map(x=>{const key=`language-${g.year}-${x.i+1}`,mine=(session.answers[key]||{}).text||'',a=ans.find(y=>y.number===Number(x.n))
          return `<details class="wf-answer-row"><summary><span class="wf-qno">${x.n}</span><span class="wf-mine">你的修改 ${escape(mine.trim()||'未作答')}</span><span class="wf-right">${a?escape(a.fix):'待补充'}</span></summary><p class="wf-prompt">${escape(x.row[0])}</p>${a&&a.analysis?`<p class="wf-analysis">${escape(a.analysis)}</p>`:''}</details>`}).join('')
        return `<div class="workflow-report-card"><h3>Language Usage · 改错</h3><p>已答 ${answered} / ${blanks.length} 行</p><div class="wf-answer-list">${list}</div></div>`}
      if(g.kind==='interview'){const qs=listening[g.year]?.interview?.questions||[]
        const graded=qs.filter(q=>typeof q.answer==='number')
        const ok=qs.filter(q=>typeof q.answer==='number'&&session.answers[`interview-${g.year}-${q.number}`]===q.answer).length
        const rows=qs.map(q=>{const key=`interview-${g.year}-${q.number}`,mine=session.answers[key],has=typeof q.answer==='number'
          const myText=mine===undefined||mine===''?'未作答':'ABCD'[mine],right=has?'ABCD'[q.answer]:'待补充'
          const mark=!has?'':(mine===undefined||mine===''?'未作答':(mine===q.answer?'正确':'错误'))
          return `<details class="wf-answer-row" ${mark==='错误'?'open':''}><summary><span class="wf-qno">${q.number>15?q.number:q.number+15}</span><span class="wf-mine">你的答案 ${myText}</span><span class="wf-right">正确答案 ${right}</span><span class="wf-mark ${mark==='正确'?'ok':mark==='错误'?'bad':''}">${mark}</span></summary><p class="wf-prompt">${q.options.map((o,i)=>`${'ABCD'[i]}. ${escape(o)}`).join('　')}</p>${q.analysis?`<p class="wf-analysis">${escape(q.analysis).replace(/\n/g,'<br>')}</p>`:'<p class="wf-analysis">该题解析待补充。</p>'}</details>`}).join('')
        return `<div class="workflow-report-card"><h3>${g.year} · Listening Section B</h3><p>选择题 <strong>${ok} / ${graded.length}</strong> 正确${graded.length<qs.length?`（另有 ${qs.length-graded.length} 题答案待补充）`:''}</p><div class="wf-answer-list">${rows}</div></div>`}
      const count=words(session.answers[`${g.kind}-${g.year}`]),min=papers[g.year]?.writingMinWords
      const ref=g.kind==='translation'?papers[g.year]?.translationReference:papers[g.year]?.writingReference
      const guide=g.kind==='translation'?papers[g.year]?.translationAnalysis:papers[g.year]?.writingAnalysis
      return `<div class="workflow-report-card"><h3>${g.kind==='translation'?'翻译':'写作'}</h3><p>已写 ${count} 词${g.kind==='writing'&&min&&count<min?` · 未达到最低 ${min} 词`:''}</p>${ref?`<details class="wf-answer-row" open><summary><span class="wf-qno">参考${g.kind==='translation'?'译文':'范文'}</span><span class="wf-mark">对照自查</span></summary><p class="wf-analysis">${escape(ref).replace(/\n/g,'<br>')}</p></details>`:'<small>参考译文 / 范文待补充。</small>'}${guide?`<details class="wf-answer-row"><summary>${g.kind==='translation'?'翻译解析':'写作指南'}</summary><p class="wf-analysis">${escape(guide).replace(/\n/g,'<br>')}</p></details>`:''}</div>`
    }).join('')
    document.querySelector('#workflow-report-content').innerHTML=`<div class="page-head"><span class="eyebrow">PRACTICE REPORT</span><h1>${session.type==='mock'?`${session.year} 年整卷模考已交卷`:'题组已提交'}</h1><p>用时 ${Math.floor((Date.now()-session.started)/60000)} 分钟。选择题已自动判分；简答题、翻译和写作可对照参考资料自查。此报告仅汇总 ${session.year} 年试卷数据。</p></div>${cards}<button class="primary-btn" data-workflow-back="${session.type==='mock'?'mock':'papers'}">${session.type==='mock'?'返回模考列表':'返回题库'} →</button>`
    const old=saved();localStorage.setItem(KEY,JSON.stringify({...old,session:null,history:[...(old.history||[]),{type:session.type,year:session.year,finishedAt:Date.now(),groups:session.groups,answers:session.answers,marks:session.marks}].slice(-50)}))
    show('workflow-report-view','题组报告')
  }
  function wordPopup(key){
    wordKey=String(key||'').toLowerCase()
    // 统一复用主查词弹窗（带图片、英美发音、多词典释义、例句）
    if(typeof window.TEM8_SHOW_WORD === 'function'){ window.TEM8_SHOW_WORD(wordKey, 0); return }
    const item=window.TEM8_DICTIONARY?.[wordKey]||{},ox=item.oxford,co=item.collins
    const meaning=ox?.senses?.[0]?.cn||co?.senses?.[0]?.cn||'词典暂未收录'
    const d=document.querySelector('#workflow-word-dialog')
    d.innerHTML=`<div class="dialog-inner"><button class="workflow-close" data-workflow-word-close>×</button><h3>${escape(wordKey)}</h3><p>${escape([ox?.phon,ox?.pos].filter(Boolean).join(' · '))}</p><p>${escape(meaning)}</p>${ox?.senses?.[0]?.en?`<p>${escape(ox.senses[0].en)}</p>`:''}<button class="secondary-btn" data-workflow-word-save>加入生词本</button></div>`
    d.showModal()
  }
  function renderReviewGroups(){
    const target=document.querySelector('#mistakes-content');if(!target)return
    const runs=[...(saved().history||[]),...(saved().session?[saved().session]:[])]
    const groups=new Map()
    for(const run of runs)for(const [id,marked] of Object.entries(run.marks||{})){
      if(!marked)continue
      const q=questions.find(item=>qid(item)===id);if(!q)continue
      const key=`${q.articleId}-${q.type}`
      if(!groups.has(key))groups.set(key,{article:q.articleId,type:q.type,items:new Map()})
      groups.get(key).items.set(q.number,q)
    }
    const html=[...groups.values()].map(g=>`<div class="workflow-report-card"><h3>${escape(g.article.replace('-',' 年 Passage '))} · ${g.type==='choice'?'选择题':'简答题'} · 待复习</h3>${[...g.items.values()].map(q=>`<p>Q${q.number} ${escape(q.prompt)}</p>`).join('')}</div>`).join('')
    target.insertAdjacentHTML('beforeend',`<div class="section-heading"><div><span class="section-index">真</span><h2>真题手动标记</h2></div></div>${html||'<p class="workflow-hint">尚无标记题目。做题时点击题目右上角的星标，可按 Passage 和题型归档在这里。</p>'}`)
  }
  document.addEventListener('click',e=>{
    const t=e.target.closest('button');if(!t)return
    if(t.id==='reader-back'||(t.dataset.openReader!==undefined&&t.dataset.mode==='free'))document.querySelector('[data-workflow-return]').hidden=true
    if(t.dataset.view==='mistakes')setTimeout(renderReviewGroups,0)
    if(t.dataset.workflowType){e.stopPropagation();openConfig(t.dataset.workflowType);return}
    if(t.dataset.startPassage){e.stopPropagation();openConfig(t.dataset.passageType,t.dataset.startPassage);start();return}
    if(t.dataset.openReader!==undefined&&t.dataset.mode==='practice'&&t.dataset.article&&t.dataset.article!=='sample'){
      e.stopPropagation();openConfig('reading-group',t.dataset.article);start();return
    }
    if(t.dataset.articleMode==='practice'&&document.querySelector('#reader-view').classList.contains('active')){
      const a=document.querySelector('#reader-mode-badge').textContent.match(/(\d{4})/)
      const selected=articles.find(x=>x.year===Number(a?.[1])&&x.title===document.querySelector('.reader-title').textContent)
      if(selected){e.stopPropagation();openConfig('reading-group',selected.id);start();return}
    }
    if(t.dataset.workflowBack){e.stopPropagation();if(t.dataset.workflowBack==='config')openConfig(session.type,session.groups[0]?.articleId);else{document.querySelector(`[data-view="${t.dataset.workflowBack}"]`).click()}return}
    if(t.dataset.workflowStart!==undefined){e.stopPropagation();start();return}
    if(t.dataset.workflowStudy!==undefined){e.stopPropagation();persist();const a=article();document.querySelector('.side-nav [data-view="library"]')?.click();document.querySelector(`[data-open-reader][data-mode="free"][data-article="${a.id}"]`)?.click();document.querySelector('[data-workflow-return]').hidden=false;return}
    if(t.dataset.workflowReturn!==undefined){e.stopPropagation();t.hidden=true;renderSession();show('workflow-session-view',title(session.type));return}
    if(t.dataset.workflowResume!==undefined){e.stopPropagation();session=saved().session;if(session){renderSession();show('workflow-session-view',title(session.type))}return}
    if(t.dataset.workflowNext!==undefined){e.stopPropagation();if(isListening(group().kind))window.TEM8_AUDIO?.stop();if(session.current<session.groups.length-1){session.current++;persist();renderSession();window.scrollTo(0,0)}else report();return}
    if(t.dataset.workflowPrev!==undefined){e.stopPropagation();if(isListening(group().kind))window.TEM8_AUDIO?.stop();session.current--;persist();renderSession();window.scrollTo(0,0);return}
    if(t.dataset.workflowMark){e.stopPropagation();const y=window.scrollY;session.marks[t.dataset.workflowMark]=!session.marks[t.dataset.workflowMark];persist();renderSession();window.scrollTo(0,y);return}
    if(t.dataset.workflowJump){e.stopPropagation();const id=t.dataset.workflowJump
      const el=id.startsWith('language')?document.getElementById(`wf-row-${id.split('-').at(-1)}`):id.startsWith('lecture')?document.getElementById(`wf-b-${id}`):document.getElementById(`wf-q-${id}`)
      el?.scrollIntoView({behavior:'smooth',block:'center'});el?.focus?.({preventScroll:true});return}
    if(t.dataset.workflowLocate){e.stopPropagation();const q=questions.find(x=>qid(x)===t.dataset.workflowLocate),m=q?.prompt.match(/Para\.\s*(\d+)/i),n=q?.locatorParagraph||Number(m?.[1]);if(n)document.getElementById(`wf-p-${n}`)?.scrollIntoView({behavior:'smooth',block:'center'});return}
    if(t.dataset.workflowWord){e.stopPropagation();const sel=window.getSelection();if(sel&&!sel.isCollapsed&&String(sel).trim())return;wordPopup(t.dataset.workflowWord);return}
    if(t.dataset.workflowWordClose!==undefined){e.stopPropagation();document.querySelector('#workflow-word-dialog').close();return}
    if(t.dataset.workflowWordSave!==undefined){e.stopPropagation();const key='tem8_studio_web_v1',old=JSON.parse(localStorage.getItem(key)||'{}');old.wordbook=[...new Set([...(old.wordbook||[]),wordKey])];localStorage.setItem(key,JSON.stringify(old));t.textContent='已加入单词本';return}
  },true)
  document.addEventListener('change',e=>{
    const t=e.target
    if(t.id==='workflow-year'){state.year=Number(t.value);state.articleId=articles.find(a=>a.year===state.year)?.id||'';if(state.type==='mock')state.durationMinutes=listening[state.year]?.timeLimitMinutes||0;renderConfig();return}
    if(t.id==='workflow-duration'){state.durationMinutes=Math.max(0,Math.min(300,Number(t.value)||0));renderConfig();return}
    if(t.name==='workflow-range'){state.range=t.value;renderConfig();return}
    if(t.name==='workflow-article'){if(state.range==='custom')state.customIds=t.checked?[...new Set([...state.customIds,t.value])]:state.customIds.filter(x=>x!==t.value);else state.articleId=t.value;renderConfig();return}
    if(t.name==='workflow-mode'){state.mode=t.value;renderConfig();return}
    if(t.dataset.workflowSwitch){state[t.dataset.workflowSwitch]=t.checked;return}
    if(t.dataset.workflowChoice){session.answers[t.dataset.workflowChoice]=Number(t.value);persist();t.closest('.workflow-options').querySelectorAll('label').forEach(x=>x.classList.toggle('selected',x.querySelector('input').checked));const card=document.querySelector(`[data-workflow-jump="${t.dataset.workflowChoice}"]`);card?.classList.add('answered');return}
    if(t.dataset.workflowErrorKind){session.answers[t.dataset.workflowErrorKind]||={};session.answers[t.dataset.workflowErrorKind].kind=t.value;persist();return}
  })
  document.addEventListener('input',e=>{
    const t=e.target
    if(t.dataset.workflowBlank){const key=t.dataset.workflowBlank;session.answers[key]=t.value;persist();t.classList.toggle('filled',!!t.value.trim());t.style.width=blankW(t.value)+'px'
      const btn=document.querySelector(`[data-workflow-jump="${key}"]`);btn?.classList.toggle('answered',!!t.value.trim())
      const x=listening[group().year]?.miniLecture
      if(x){const n=x.blanks.filter(b=>String(session.answers[`lecture-${group().year}-${b.number}`]||'').trim()).length,el=document.querySelector('#wf-lecture-count');if(el)el.textContent=`已填 ${n} / ${x.blanks.length}`}
      return}
    if(t.dataset.workflowShort){session.answers[t.dataset.workflowShort]=t.value;persist();const q=questions.find(x=>qid(x)===t.dataset.workflowShort),limit=q?.wordLimit,n=words(t.value),el=document.querySelector(`[data-count-for="${t.dataset.workflowShort}"]`);el.textContent=limit?`${n} / ${limit} 词${n>limit?' · 超出限制':''}`:`${n} 词 · 上限未录入`;el.classList.toggle('over',!!limit&&n>limit);document.querySelector(`[data-workflow-jump="${t.dataset.workflowShort}"]`)?.classList.toggle('answered',!!t.value.trim());return}
    if(t.dataset.workflowErrorText){session.answers[t.dataset.workflowErrorText]||={};session.answers[t.dataset.workflowErrorText].text=t.value;persist();return}
    if(t.dataset.workflowText){session.answers[t.dataset.workflowText]=t.value;persist();const n=words(t.value),el=document.querySelector('#wf-long-count'),min=t.dataset.workflowText.startsWith('writing')?papers[group().year]?.writingMinWords:null;el.textContent=`${n} 词${min?` · 最低 ${min} 词`:''} · 草稿自动保存`;el.classList.toggle('under',!!min&&n<min);return}
  })
  setInterval(()=>{if(!session||!document.querySelector('#workflow-session-view').classList.contains('active'))return;const n=session.deadline?Math.max(0,Math.ceil((session.deadline-Date.now())/1000)):Math.floor((Date.now()-session.started)/1000),el=document.querySelector('#workflow-time');if(el)el.textContent=`${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;if(session.deadline&&n===0)report()},1000)
  window.TEM8_WORKFLOW={renderCards,readerActions,openConfig,openMock}
})()
