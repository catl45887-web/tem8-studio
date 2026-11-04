/* 按题型练习：配置页 → 做题页 → 结果页
 * 数据仍存在 localStorage 的 tem8_workflow_v2：
 *   session  进行中的题组（可续做）
 *   history  已交卷记录
 *   prefs    上次的练习配置
 *   tools    'm:<题目key>' 错题本条目（逐条同步）
 */
(() => {
  'use strict'
  const articles=[...(window.TEM8_2026_ARTICLES||[]),...(window.TEM8_2025_ARTICLES||[]),...(window.TEM8_MID_ARTICLES||[]),...(window.TEM8_ARCHIVE_ARTICLES||[]),...(window.TEM8_ARCHIVE_ARTICLES2||[])]
  const questions=[...(window.TEM8_2026_QUESTIONS||[]),...(window.TEM8_2025_QUESTIONS||[]),...(window.TEM8_MID_QUESTIONS||[]),...(window.TEM8_ARCHIVE_QUESTIONS||[]),...(window.TEM8_ARCHIVE_QUESTIONS2||[])]
  const papers={...(window.TEM8_PAPER_EXTRAS||{}),...(window.TEM8_PAPER_EXTRAS2||{}),...(window.TEM8_PAPER_EXTRAS_2025||{}),...(window.TEM8_PAPER_EXTRAS_2026||{}),...(window.TEM8_MID_EXTRAS||{})}
  const listening={...(window.TEM8_LISTENING_ARCHIVE||{}),...(window.TEM8_LISTENING_2026||{}),...(window.TEM8_MID_LISTENING||{})}
  const KEY='tem8_workflow_v2'
  const LETTERS='ABCD'
  const REASONS=['没读懂','定位错','词汇','干扰项','粗心']

  /* ---------- 小工具 ---------- */
  const $=s=>document.querySelector(s)
  const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
  const words=s=>String(s||'').trim().split(/\s+/).filter(Boolean).length
  const mmss=s=>{s=Math.max(0,Math.floor(s||0));return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`}
  const clock=t=>new Date(t).toTimeString().slice(0,5)
  const day=t=>{const d=new Date(t);return `${d.getMonth()+1}月${d.getDate()}日`}
  const normAns=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'')
  const cjkAns=s=>/[一-龥]/.test(String(s||''))
  const okBlank=(ans,mine)=>{const m=normAns(mine);return !!m&&String(ans||'').split('//').map(normAns).filter(Boolean).some(a=>a===m)}
  const load=()=>{try{return JSON.parse(localStorage.getItem(KEY))||{}}catch{return {}}}
  function writeStore(fn){const s=load();fn(s);try{localStorage.setItem(KEY,JSON.stringify(s))}catch{}if(!window.TEM8_SYNC_FLUSHING)document.dispatchEvent(new Event('tem8:study-changed'))}

  /* ---------- 题目数据 ---------- */
  const articleQuestions=a=>a?questions.filter(q=>q.articleId===a.id):[]
  const art=id=>articles.find(a=>a.id===id)
  const qid=q=>`${q.articleId}-${q.number}`
  const qByKey=new Map(questions.map(q=>[qid(q),q]))
  const isListening=id=>id==='lecture'||id==='interview'
  const gapNo=row=>(/(\d+)/.exec(row?.[1]||'')||[])[1]
  const PASSAGE=['One','Two','Three','Four','Five']
  const passageName=a=>{const same=articles.filter(x=>x.year===a.year&&articleQuestions(x).length);const i=same.indexOf(a);return a.label||`Passage ${PASSAGE[i]||i+1}`}

  const TYPES=[
    {id:'lecture',group:'listen',name:'听力 Section A',sub:'Mini-lecture 填空',icon:'◖'},
    {id:'interview',group:'listen',name:'听力 Section B',sub:'Interview 选择',icon:'♫'},
    {id:'reading-group',group:'read',name:'阅读专项',sub:'按 Passage 筛选 · 选择题＋简答题',icon:'▧'},
    {id:'language',group:'lang',name:'改错专项',sub:'整套逐行作答',icon:'⌁'},
    {id:'translation',group:'trans',name:'翻译：中译英',sub:'译文与草稿',icon:'↗︎'},
    {id:'writing',group:'write',name:'写作：摘要＋观点',sub:'材料阅读与作文',icon:'✒'}
  ]
  const GROUPS=[
    {id:'listen',name:'听力',types:['lecture','interview']},
    {id:'read',name:'阅读',types:['reading-group']},
    {id:'lang',name:'语言运用',types:['language']},
    {id:'trans',name:'翻译',types:['translation']},
    {id:'write',name:'写作',types:['writing']}
  ]
  const title=id=>id==='review'?'错题复习':id==='mock'?'整卷模考':TYPES.find(t=>t.id===id)?.name||id

  function yearList(type){
    let ys
    if(type==='reading-group')ys=articles.filter(a=>articleQuestions(a).length).map(a=>a.year)
    else if(isListening(type))ys=Object.keys(listening).map(Number).filter(y=>!listening[y]?.intensiveOnly&&(type==='lecture'?listening[y]?.miniLecture?.blanks?.length:listening[y]?.interview?.questions?.length))
    else{const f=type==='language'?'languageLines':type==='translation'?'translation':'writing';ys=Object.keys(papers).map(Number).filter(y=>papers[y]?.[f]?.length)}
    return [...new Set(ys.map(Number))].sort((a,b)=>b-a)
  }
  function hasAnswers(type,y){
    if(type==='reading-group')return questions.some(q=>q.articleId.startsWith(y+'-')&&(typeof q.answer==='number'||q.referenceAnswer))
    if(type==='lecture')return !!listening[y]?.miniLecture?.blanks?.some(b=>b.answer)
    if(type==='interview')return !!listening[y]?.interview?.questions?.some(q=>typeof q.answer==='number')
    if(type==='language')return !!papers[y]?.languageAnswers?.length
    if(type==='translation')return !!papers[y]?.translationReference
    return !!papers[y]?.writingReference
  }
  const yearArticles=y=>articles.filter(a=>a.year===y&&articleQuestions(a).length)
  function countFor(type,y,passages){
    if(type==='reading-group'){let as=yearArticles(y);if(passages?.length)as=as.filter(a=>passages.includes(a.id));return as.reduce((n,a)=>n+articleQuestions(a).length,0)}
    if(type==='lecture')return listening[y]?.miniLecture?.blanks?.length||0
    if(type==='interview')return listening[y]?.interview?.questions?.length||0
    if(type==='language')return (papers[y]?.languageLines||[]).filter(gapNo).length
    return 1
  }
  function minutesFor(type,y,passages){
    const L=listening[y]||{}
    if(type==='reading-group'){let as=yearArticles(y);if(passages?.length)as=as.filter(a=>passages.includes(a.id));return as.length*15}
    if(type==='lecture')return Math.round((Number(L.sectionAEnd)||540)/60)+3
    if(type==='interview')return Math.round(Math.max(360,(Number(L.audioDuration)||0)-(Number(L.sectionBStart)||0))/60)+2
    return type==='language'?15:type==='translation'?30:45
  }

  /* ---------- 题组里的每道题，统一成 item ---------- */
  function gItems(g){
    const y=g.year
    if(g.kind==='reading'){
      const a=art(g.articleId);let qs=articleQuestions(a)
      if(g.only?.length)qs=qs.filter(q=>g.only.includes(q.number))
      return qs.map(q=>({key:qid(q),no:q.number,kind:q.type==='choice'?'choice':'short',q,a,answer:q.type==='choice'&&typeof q.answer==='number'?q.answer:undefined,prompt:q.prompt,options:q.options,analysis:q.analysis,ref:q.referenceAnswer,limit:q.wordLimit}))
    }
    if(g.kind==='interview'){
      let qs=listening[y]?.interview?.questions||[]
      if(g.only?.length)qs=qs.filter(q=>g.only.includes(q.number))
      return qs.map(q=>({key:`interview-${y}-${q.number}`,no:q.number>15?q.number:q.number+15,num:q.number,kind:'choice',answer:typeof q.answer==='number'?q.answer:undefined,prompt:q.prompt,options:q.options,analysis:q.analysis}))
    }
    if(g.kind==='lecture'){
      let bs=listening[y]?.miniLecture?.blanks||[]
      if(g.only?.length)bs=bs.filter(b=>g.only.includes(b.number))
      return bs.map(b=>({key:`lecture-${y}-${b.number}`,no:b.number,num:b.number,kind:'blank',answer:b.answer,analysis:b.analysis,limit:b.wordLimit}))
    }
    if(g.kind==='language'){
      const src=papers[y]||{},ans=src.languageAnswers||[]
      return (src.languageLines||[]).map((row,i)=>({row,i,n:gapNo(row)})).filter(x=>x.n).map(x=>{const a=ans.find(v=>v.number===Number(x.n));return {key:`language-${y}-${x.i+1}`,no:Number(x.n),kind:'line',row:x.row[0],fix:a?.fix,analysis:a?.analysis}})
    }
    return [{key:`${g.kind}-${y}`,no:1,kind:'long'}]
  }
  const allItems=(groups)=>groups.flatMap((g,gi)=>gItems(g).map(it=>({...it,gi})))
  function isAnswered(it,answers){
    const v=answers[it.key]
    if(it.kind==='choice')return v!==undefined&&v!==''&&v!==null
    if(it.kind==='line')return !!String(v?.text||'').trim()
    return !!String(v||'').trim()
  }
  // ok / bad / none（未答）/ self（需自查）/ na（无答案）
  function grade(it,answers){
    const v=answers[it.key]
    if(!isAnswered(it,answers))return it.kind==='choice'&&it.answer===undefined?'na':it.kind==='blank'&&(!it.answer||cjkAns(it.answer))?'na':(it.kind==='choice'||it.kind==='blank')?'none':'none'
    if(it.kind==='choice')return it.answer===undefined?'na':v===it.answer?'ok':'bad'
    if(it.kind==='blank'){if(!it.answer||cjkAns(it.answer))return 'self';return okBlank(it.answer,v)?'ok':'bad'}
    return 'self'
  }
  const gradable=it=>(it.kind==='choice'&&it.answer!==undefined)||(it.kind==='blank'&&it.answer&&!cjkAns(it.answer))

  function parseKey(k){
    let m=/^lecture-(\d{4})-(\d+)$/.exec(k);if(m)return {kind:'lecture',year:+m[1],number:+m[2]}
    m=/^interview-(\d{4})-(\d+)$/.exec(k);if(m)return {kind:'interview',year:+m[1],number:+m[2]}
    const q=qByKey.get(k);if(q)return {kind:'reading',year:Number(q.articleId.slice(0,4)),articleId:q.articleId,number:q.number}
    return null
  }
  function itemInfo(k){
    const p=parseKey(k);if(!p)return null
    const g=p.kind==='reading'?{kind:'reading',year:p.year,articleId:p.articleId,only:[p.number]}:{kind:p.kind,year:p.year,only:[p.number]}
    const it=gItems(g)[0];if(!it)return null
    const kindName=p.kind==='reading'?`阅读 · ${passageName(it.a)}`:p.kind==='lecture'?'听力 Section A':'听力 Section B'
    return {...it,p,typeName:p.kind==='reading'?'阅读':p.kind==='lecture'?'听力 A':'听力 B',label:`${p.year} · ${kindName} · ${p.kind==='lecture'?'第 '+it.no+' 空':'Q'+it.no}`}
  }
  function groupsFromKeys(keys){
    const map=new Map()
    for(const k of keys){const p=parseKey(k);if(!p)continue
      const gk=p.kind==='reading'?'r:'+p.articleId:p.kind+':'+p.year
      if(!map.has(gk))map.set(gk,p.kind==='reading'?{kind:'reading',year:p.year,articleId:p.articleId,only:[]}:{kind:p.kind,year:p.year,only:[]})
      const g=map.get(gk);if(!g.only.includes(p.number))g.only.push(p.number)}
    return [...map.values()].map(g=>({...g,only:g.only.sort((a,b)=>a-b)}))
  }

  /* ---------- 错题本条目（tools['m:key']） ---------- */
  const INTERVAL=[1,3,7,14]
  function mistakeUpdate(run){
    const items=allItems(run.groups),now=run.finishedAt
    writeStore(s=>{
      s.tools||={}
      for(const it of items){
        if(!['choice','blank'].includes(it.kind)||!parseKey(it.key))continue
        const r=grade(it,run.answers),id='m:'+it.key,old=s.tools[id]
        if(r==='bad'){
          const e={...(old||{}),k:it.key,n:(old?.n||0)+1,f:old?.f||now,l:now,st:0,due:now+864e5,s:old&&old.s&&old.s!=='new'?'learning':'new'}
          if(old?.rm)delete e.rm
          s.tools[id]=e
        }else if(r==='ok'&&old&&!old.rm){
          const st=(old.st||0)+1,rv=(old.rv||0)+1
          s.tools[id]={...old,st,rv,s:st>=2?'mastered':'learning',due:now+INTERVAL[Math.min(rv,INTERVAL.length)-1]*864e5,lr:now}
        }else if(run.marks?.[it.key]&&!old){
          s.tools[id]={k:it.key,n:0,f:now,l:now,st:0,due:now,s:'new',fl:1,r:'存疑'}
        }
      }
    })
  }

  /* ---------- 配置页 ---------- */
  let cfg={type:'reading-group',years:[],passages:[],mode:'practice',minutes:0,minutesTouched:false,instant:false,allowWord:true,replay:false}
  let session=null,lastRun=null,cur='',reportFilter=false,mobileTab='q',confirmBypass=false

  function prefs(){return load().prefs||{}}
  function savePrefs(){writeStore(s=>{const p=s.prefs||{};p.type=cfg.type;p.byType||={};p.byType[cfg.type]={years:cfg.years,mode:cfg.mode,minutes:cfg.minutesTouched?cfg.minutes:0};p.instant=cfg.instant;p.allowWord=cfg.allowWord;p.replay=cfg.replay;s.prefs=p})}
  function estimate(){
    const ys=cfg.years,single=ys.length===1
    let count=0,minutes=0
    for(const y of ys){const ps=single?cfg.passages:[];count+=countFor(cfg.type,y,ps);minutes+=minutesFor(cfg.type,y,ps)}
    return {count,minutes}
  }
  function openConfig(type,articleId){
    const p=prefs(),bt=p.byType?.[type]||{},valid=yearList(type)
    cfg={...cfg,type,passages:[],instant:!!p.instant,allowWord:p.allowWord!==false,replay:!!p.replay,mode:bt.mode==='exam'?'exam':'practice'}
    cfg.years=(bt.years||[]).map(Number).filter(y=>valid.includes(y))
    if(!cfg.years.length)cfg.years=valid.slice(0,1)
    if(articleId){cfg.years=[Number(articleId.slice(0,4))];cfg.passages=[articleId]}
    cfg.minutesTouched=!!bt.minutes;cfg.minutes=bt.minutes||estimate().minutes
    renderConfig();show('workflow-config-view','练习设置')
  }
  function setType(type){
    const keepMode=cfg.mode
    openConfig(type);cfg.mode=keepMode;if(!cfg.minutesTouched)cfg.minutes=estimate().minutes;renderConfig()
  }
  const ago=t=>{const d=Math.floor((new Date().setHours(0,0,0,0)-new Date(t).setHours(0,0,0,0))/864e5);return d<=0?'今天':d===1?'昨天':`${d} 天前`}
  function lastRunOf(types){const runs=(load().history||[]).filter(r=>types.includes(r.type)&&Array.isArray(r.groups));return runs.at(-1)}
  function cardStat(types){
    const r=lastRunOf(types);if(!r)return ''
    const st=stats(r),g=st.gradable.length
    return `上次 ${g?`${st.ok}/${g}`:'已完成'} · ${ago(r.finishedAt)}`
  }
  const CARD_GROUPS=[
    {name:'听力',type:'lecture',sub:'讲座填空 · 访谈 · 约 25 分钟',types:['lecture','interview']},
    {name:'阅读',type:'reading-group',sub:'选择 + 简答 · 约 45 分钟',types:['reading-group']},
    {name:'语言运用',type:'language',sub:'改错 10 处 · 约 15 分钟',types:['language']},
    {name:'翻译',type:'translation',sub:'汉译英 · 约 20 分钟',types:['translation']},
    {name:'写作',type:'writing',sub:'摘要 + 观点 · 约 45 分钟',types:['writing']}
  ]
  // 各题型客观题正确率（薄弱项分析用）
  function accuracyByKind(){
    const out={listen:{ok:0,n:0},read:{ok:0,n:0},lang:{ok:0,n:0}}
    for(const r of load().history||[]){if(!Array.isArray(r.groups))continue
      for(const it of allItems(r.groups)){
        const k=it.kind==='blank'||it.key.startsWith('interview')?'listen':it.kind==='choice'||it.kind==='short'?'read':it.kind==='line'?'lang':null
        if(!k)continue
        if(it.kind==='line'){const fix=String(it.fix||''),v=String(r.answers?.[it.key]?.text||'');if(!v.trim()||!/→/.test(fix))continue;const want=fix.split('→').pop().replace(/[^a-z]/gi,'').toLowerCase();if(!want)continue;out.lang.n++;if(v.toLowerCase().replace(/[^a-z]/g,' ').split(/\s+/).includes(want))out.lang.ok++;continue}
        if(!gradable(it))continue
        const g=grade(it,r.answers||{});if(g==='none')continue
        out[k].n++;if(g==='ok')out[k].ok++
      }}
    return out
  }
  function renderCards(){
    const html=TYPES.map(t=>`<button class="category-card" data-workflow-type="${t.id}"><span class="category-icon">${t.icon}</span><h3>${escape(t.name)}</h3><p>${escape(t.sub)}</p><span class="card-foot">配置练习 <b>↗︎</b></span></button>`).join('')
    const home=$('#home-categories');if(home)home.innerHTML=html
    const grid=$('#paper-categories');if(grid)grid.innerHTML=html
    let box=$('#paper-cards')
    if(!box&&grid){box=document.createElement('div');box.id='paper-cards';grid.before(box)}
    if(!box)return
    const live=load().session
    const resume=live?.groups?.length&&live.type!=='mock'?`<div class="pc-resume"><div><b>继续：${escape(live.type==='review'?(live.label||'错题复习'):title(live.type))}</b><small>${sessionSummary(live)}</small></div><button type="button" class="pc-btn" data-pq-discard>放弃</button><button type="button" class="pc-btn strong" data-workflow-resume>继续</button></div>`:''
    const mis=window.TEM8_REVIEW?.count?.()||0
    box.innerHTML=resume+`<div class="pc-grid">${CARD_GROUPS.map(G=>{
      const stat=cardStat(G.types)
      return `<button type="button" class="pc-card" data-workflow-type="${G.type}"><span class="pc-top"><b>${G.name}</b>${stat?'':'<span class="pc-new">新</span>'}</span><span class="pc-sub">${G.sub}</span>${stat?`<span class="pc-stat">${escape(stat)}</span>`:''}</button>`}).join('')}
      <button type="button" class="pc-card" data-pc-mistakes><span class="pc-top"><b>错题重练</b></span><span class="pc-sub">${mis?`${mis} 道待掌握 · 按间隔复习`:'答错的题会自动收进来'}</span>${mis?'<span class="pc-stat">开始复习</span>':''}</button></div>`
  }
  function sessionSummary(s){
    const items=allItems(s.groups),done=items.filter(it=>isAnswered(it,s.answers||{})).length
    const ys=[...new Set(s.groups.map(g=>g.year))]
    return `${escape(title(s.type))} · ${ys.length>2?ys.length+' 个年份':ys.join('、')+' 年'} · 已答 ${done} / ${items.length}`
  }
  function resumeBanner(){
    const s=load().session;if(!s?.groups?.length)return ''
    return `<div class="pq-resume"><div><strong>上次的练习还没交卷</strong><span>${sessionSummary(s)}</span></div><button class="secondary-btn" data-pq-discard>放弃</button><button class="primary-btn" data-workflow-resume>继续作答 <span>→</span></button></div>`
  }
  function renderConfig(){
    const type=cfg.type,group=TYPES.find(t=>t.id===type).group,years=yearList(type)
    const {count,minutes}=estimate()
    if(!cfg.minutesTouched)cfg.minutes=minutes
    const single=cfg.years.length===1
    const objective=['reading-group','lecture','interview'].includes(type)
    const typeCards=GROUPS.map(G=>`<button type="button" class="pq-type ${G.id===group?'on':''}" data-pq-group="${G.id}" aria-pressed="${G.id===group}"><b>${G.name}</b><small>${G.id==='listen'?'填空 · 访谈':G.id==='read'?'选择 · 简答':G.id==='lang'?'改错':G.id==='trans'?'汉译英':'摘要＋观点'}</small></button>`).join('')
    const sub=group==='listen'?`<div class="pq-seg" role="group" aria-label="听力部分">${['lecture','interview'].map(t=>`<button type="button" data-pq-type="${t}" class="${t===type?'on':''}" aria-pressed="${t===type}">${t==='lecture'?'Section A · 讲座填空':'Section B · 访谈选择'}</button>`).join('')}</div>`:''
    const chips=years.map(y=>{const on=cfg.years.includes(y),ans=hasAnswers(type,y)
      return `<button type="button" class="pq-chip ${on?'on':''} ${ans?'':'dim'}" data-pq-year="${y}" aria-pressed="${on}" title="${ans?'':'这一年暂无参考答案，可以做，但不能自动判分'}">${on?'<i aria-hidden="true">✓</i>':''}${y}${ans?'':'<small>无答案</small>'}</button>`}).join('')
    const passages=type==='reading-group'&&single?`<div class="pq-sub"><span class="pq-sublabel">篇章</span><div class="pq-chips">${[{id:'',name:'全部'},...yearArticles(cfg.years[0]).map(a=>({id:a.id,name:passageName(a),n:articleQuestions(a).length}))].map(p=>{const on=p.id?cfg.passages.includes(p.id):!cfg.passages.length
      return `<button type="button" class="pq-chip sm ${on?'on':''}" data-pq-passage="${p.id}" aria-pressed="${on}">${escape(p.name)}${p.n?`<small>${p.n} 题</small>`:''}</button>`}).join('')}</div></div>`:''
    const sw=(key,label,desc,on,avail=true)=>avail?`<label class="pq-switch"><span><b>${label}</b><small>${desc}</small></span><input type="checkbox" class="t-switch" data-pq-switch="${key}" ${on?'checked':''}></label>`:''
    const switches=[
      cfg.mode==='practice'&&objective?sw('instant','即时反馈','选完立刻显示对错和解析',cfg.instant):'',
      type==='reading-group'&&cfg.mode==='practice'?sw('allowWord','点词查义','阅读原文时点单词查词典',cfg.allowWord):'',
      isListening(type)&&cfg.mode==='exam'?sw('replay','允许回听','计时模式下也能暂停、拖动音频',cfg.replay):''
    ].filter(Boolean).join('')
    const noAudio=isListening(type)&&cfg.years.some(y=>!listening[y]?.audio)
    $('#workflow-config-content').innerHTML=`
      <button class="back-link" data-workflow-back="papers">← 返回题库</button>
      <div class="page-head pq-head"><h1>练习设置</h1></div>
      ${resumeBanner()}
      <div class="pq-config">
        <section class="pq-step"><h2><span>1</span>题型</h2><div class="pq-types">${typeCards}</div>${sub}</section>
        <section class="pq-step"><h2><span>2</span>年份<em>可多选</em><span class="pq-step-act"><button type="button" class="pq-link" data-pq-years="all">全选</button><button type="button" class="pq-link" data-pq-years="latest">只选最新</button></span></h2><div class="pq-chips">${chips}</div>${passages}${noAudio?'<p class="pq-note">所选年份中有的没有录音，只能按纸面作答。</p>':''}</section>
        <section class="pq-step"><h2><span>3</span>模式</h2><div class="pq-modes">
          <button type="button" class="pq-mode ${cfg.mode==='practice'?'on':''}" data-pq-mode="practice" aria-pressed="${cfg.mode==='practice'}"><b>练习</b><small>不限时，正计时可暂停；做完看答案</small></button>
          <button type="button" class="pq-mode ${cfg.mode==='exam'?'on':''}" data-pq-mode="exam" aria-pressed="${cfg.mode==='exam'}"><b>计时</b><small>倒计时，时间到自动交卷</small></button></div>
          ${cfg.mode==='exam'?`<div class="pq-stepper"><span>倒计时</span><button type="button" data-pq-min="-5" aria-label="减少 5 分钟">−</button><output>${cfg.minutes} 分钟</output><button type="button" data-pq-min="5" aria-label="增加 5 分钟">＋</button>${cfg.minutesTouched?'<button type="button" class="pq-link" data-pq-min="reset">按题量重算</button>':''}</div>`:''}
          ${switches?`<div class="pq-switches">${switches}</div>`:''}
        </section>
      </div>
      <div class="pq-startbar"><div class="pq-startinfo"><b>${cfg.years.length?`已选 ${cfg.years.length} 年 · 共 ${count} 题 · 约 ${cfg.mode==='exam'?cfg.minutes:minutes} 分钟`:'请至少选一个年份'}</b><small>${escape(title(type))} · ${cfg.mode==='exam'?'计时':'练习'}模式${cfg.instant&&cfg.mode==='practice'&&objective?' · 即时反馈':''}</small></div><button class="primary-btn" data-workflow-start ${cfg.years.length&&count?'':'disabled'}>开始 <span>→</span></button></div>`
  }
  function makeGroups(){
    const groups=[],single=cfg.years.length===1
    for(const y of [...cfg.years].sort((a,b)=>b-a)){
      if(cfg.type==='reading-group'){let as=yearArticles(y);if(single&&cfg.passages.length)as=as.filter(a=>cfg.passages.includes(a.id));as.forEach(a=>groups.push({kind:'reading',year:y,articleId:a.id}))}
      else groups.push({kind:cfg.type,year:y})
    }
    return groups
  }
  function newSession(groups,type,opts={}){
    const exam=opts.mode==='exam'
    session={v:3,groups,current:0,answers:{},marks:{},strikes:{},started:Date.now(),pausedMs:0,pausedAt:0,hideTimer:false,
      deadline:exam?Date.now()+opts.minutes*60000:null,durationMinutes:exam?opts.minutes:0,mode:exam?'exam':'practice',
      instant:!exam&&!!opts.instant,allowWord:!exam&&opts.allowWord!==false,replay:!!opts.replay,type,year:groups[0]?.year,years:[...new Set(groups.map(g=>g.year))]}
    cur='';mobileTab='p'
    persist();renderSession();show('workflow-session-view',title(type))
  }
  function start(){
    const groups=makeGroups();if(!groups.length)return
    newSession(groups,cfg.type,{mode:cfg.mode,minutes:cfg.minutes||estimate().minutes,instant:cfg.instant,allowWord:cfg.allowWord,replay:cfg.replay})
  }
  function startKeys(keys,label){
    const groups=groupsFromKeys(keys);if(!groups.length)return false
    newSession(groups,'review',{mode:'practice',instant:false,allowWord:true});session.label=label||'错题复习';persist();renderSession();return true
  }

  let pendingMock=null
  function openMock(year){
    const y=Number(year),L=listening[y]||{},p=papers[y]||{},groups=[]
    if(L.miniLecture?.blanks?.length)groups.push({kind:'lecture',year:y})
    if(L.interview?.questions?.length)groups.push({kind:'interview',year:y})
    yearArticles(y).forEach(a=>groups.push({kind:'reading',year:y,articleId:a.id}))
    if(p.languageLines?.length)groups.push({kind:'language',year:y})
    if(p.translation?.length)groups.push({kind:'translation',year:y})
    if(p.writing?.length)groups.push({kind:'writing',year:y})
    if(!groups.length)return
    const live=load().session
    if(live?.type==='mock'&&Number(live.year)===y){resume();return}
    const mins=Number(L.timeLimitMinutes)||Number(p.timeLimitMinutes)||150
    pendingMock=()=>newSession(groups,'mock',{mode:'exam',minutes:mins,replay:false})
    dialog(`<h3>${y} 年整卷模考</h3><p>将按考试顺序计时，共约 ${mins} 分钟；中途可以保存退出，下次接着做。</p>${live?.groups?.length?'<p class="pq-dlg-note">你还有一份练习没交卷，开始模考会替换它。</p>':''}<div class="pq-dlg-actions"><button type="button" class="secondary-btn" data-pq-dlg="close">取消</button><button type="button" class="primary-btn" data-pq-dlg="mock">开始</button></div>`)
  }
  /* ---------- 做题页 ---------- */
  const group=()=>session.groups[session.current]
  const article=()=>art(group().articleId)
  function elapsedMs(){if(!session)return 0;const now=Date.now();return Math.max(0,now-session.started-(session.pausedMs||0)-(session.pausedAt?now-session.pausedAt:0))}
  function persist(){
    if(!session)return
    session.elapsedMs=elapsedMs();if(session.deadline)session.remainingMs=Math.max(0,session.deadline-Date.now())
    session.savedAt=Date.now()
    writeStore(s=>{s.session=session})
    const el=$('#pq-saved');if(el)el.textContent=`已保存 ${clock(session.savedAt)}`
  }
  document.addEventListener('tem8:flush-records',()=>{if(session)persist()})
  function resume(){
    const s=load().session;if(!s?.groups?.length)return false
    session={...s,answers:s.answers||{},marks:s.marks||{},strikes:s.strikes||{}}
    const now=Date.now()
    session.started=now-(s.elapsedMs||Math.max(0,(s.savedAt||now)-s.started-(s.pausedMs||0)));session.pausedMs=0;session.pausedAt=0
    if(session.deadline)session.deadline=now+(s.remainingMs??Math.max(0,s.deadline-(s.savedAt||now)))
    cur='';renderSession();show('workflow-session-view',title(session.type));return true
  }
  const anno=()=>window.TEM8_ANNO
  function show(id,label){
    if(id!=='workflow-session-view')window.TEM8_AUDIO?.stop()
    document.querySelectorAll('.view').forEach(el=>el.classList.toggle('active',el.id===id))
    document.querySelectorAll('[data-view]').forEach(el=>el.classList.toggle('active',el.dataset.view==='papers'&&id!=='workflow-session-view'))
    document.body.classList.toggle('pq-in-session',id==='workflow-session-view')
    const c=$('#crumb');if(c)c.textContent=label
    window.scrollTo(0,0)
  }
  document.addEventListener('tem8:view',()=>{document.body.classList.remove('pq-in-session');closeDrawer()})

  function flagBtn(key){const on=!!session.marks[key];return `<button type="button" class="pq-flag ${on?'on':''}" data-workflow-mark="${key}" aria-pressed="${on}" title="标记存疑（F）">${on?'已存疑':'存疑'}</button>`}
  function feedback(it){
    if(!session.instant||it.kind!=='choice'||it.answer===undefined)return ''
    const v=session.answers[it.key];if(v===undefined||v==='')return ''
    const ok=v===it.answer
    return `<div class="pq-instant ${ok?'ok':'bad'}" role="status"><b>${ok?'✓ 答对了':'✗ 答错了'}</b> 正确答案 ${LETTERS[it.answer]}${it.analysis?`<details><summary>看解析</summary>${analysisHTML(it)}</details>`:''}</div>`
  }
  function optionsHTML(it){
    const v=session.answers[it.key],strikes=session.strikes[it.key]||[],showFb=session.instant&&it.answer!==undefined&&v!==undefined&&v!==''
    return `<div class="pq-opts" role="radiogroup" aria-label="选项">${(it.options||[]).map((o,i)=>{
      const sel=v===i,cls=[sel?'sel':'',strikes.includes(i)?'struck':'',showFb&&i===it.answer?'right':'',showFb&&sel&&i!==it.answer?'wrong':''].filter(Boolean).join(' ')
      return `<div class="pq-opt ${cls}"><label><input type="radio" name="o-${it.key}" data-workflow-choice="${it.key}" value="${i}" ${sel?'checked':''}><b>${LETTERS[i]}</b><span>${escape(o)}</span><i class="pq-check" aria-hidden="true">✓</i></label><button type="button" class="pq-strike" data-pq-strike="${it.key}" data-i="${i}" aria-pressed="${strikes.includes(i)}" title="${strikes.includes(i)?'恢复':'划掉'}选项 ${LETTERS[i]}">${strikes.includes(i)?'恢复':'排除'}</button></div>`}).join('')}</div>`
  }
  function readingItems(){
    const items=gItems(group()),choice=items.filter(i=>i.kind==='choice'),short=items.filter(i=>i.kind==='short')
    let html=''
    if(choice.length)html+=`<h3 class="workflow-section-title">选择题 <small>${choice.length} 道</small></h3>`+choice.map(it=>`<article class="pq-q ${it.key===cur?'cur':''}" id="it-${it.key}" data-item="${it.key}"><div class="pq-qhead"><span>Q${it.no}</span>${flagBtn(it.key)}</div><h4>${escape(it.prompt)}</h4>${optionsHTML(it)}${feedback(it)}</article>`).join('')
    if(short.length)html+=`<h3 class="workflow-section-title">简答题 <small>${short.length} 道</small></h3>`+short.map(it=>{
      const value=session.answers[it.key]||'',n=words(value),limit=it.limit
      return `<article class="pq-q ${it.key===cur?'cur':''}" id="it-${it.key}" data-item="${it.key}"><div class="pq-qhead"><span>Q${it.no} · 简答</span>${flagBtn(it.key)}</div><h4>${escape(it.prompt)}</h4><textarea data-workflow-short="${it.key}" placeholder="在此作答" rows="3">${escape(value)}</textarea><div class="workflow-question-foot">${it.q.locatorParagraph||/Para\.\s*\d+/i.test(it.prompt)?`<button type="button" data-workflow-locate="${it.key}">看原文对应段落</button>`:'<span></span>'}<span data-count-for="${it.key}" class="${limit&&n>limit?'over':''}">${n}${limit?` / ${limit} 词${n>limit?' · 超出':''}`:' 词'}</span></div></article>`}).join('')
    return html
  }
  function passageText(a){
    const A=anno(),allow=!!session.allowWord
    return `<div class="workflow-article" data-anno-scope data-anno-article="${a.id}" data-anno-word="${allow?1:0}" data-anno-word-attr="data-workflow-word">${a.segments.map((s,i)=>{
      const n=A?A.noteCount(a.id,i):0
      const body=A?A.textHTML(a.id,i,s.en,{word:allow,attr:'data-workflow-word'}):escape(s.en)
      return `<p id="wf-p-${i+1}" data-anno-p="${i}"><b>${String(s.number||i+1).padStart(2,'0')}</b><span class="anno-text">${body}</span><span class="anno-tools"><button class="anno-pbtn${n?' has':''}" type="button" data-anno-open="${i}" title="${n?`第 ${i+1} 段有 ${n} 条笔记`:`在第 ${i+1} 段记笔记`}">${n?`笔记 ${n}`:''}</button></span></p>`}).join('')}</div>`
  }
  function renderReading(){
    const a=article(),n=gItems(group()).length
    return `<div class="pq-tabs" role="tablist"><button type="button" role="tab" data-pq-tab="p" aria-selected="${mobileTab==='p'}" class="${mobileTab==='p'?'on':''}">文章</button><button type="button" role="tab" data-pq-tab="q" aria-selected="${mobileTab==='q'}" class="${mobileTab==='q'?'on':''}">题目 <small>${n}</small></button></div>
      <div class="pq-read" data-tab="${mobileTab}"><section class="pq-pass"><div class="pq-pane-head"><strong>${a.year} · ${escape(passageName(a))}</strong><span>${session.allowWord?'点词查义 · ':''}选中文字可标记</span></div>${passageText(a)}</section><section class="pq-qs"><div class="pq-pane-head"><strong>题目</strong><span>${n} 题 · 键盘 A–D 作答</span></div>${readingItems()}</section></div>`
  }
  const blankW=v=>Math.min(300,Math.max(150,String(v||'').length*7.2+26))
  function renderLecture(){
    const g=group(),x=listening[g.year]?.miniLecture
    if(!x)return '<div class="workflow-card"><p class="workflow-hint">本年暂无 Section A 数据。</p></div>'
    const only=g.only?.length?new Set(g.only.map(String)):null
    const raw=String(x.title||'').trim(),bad=/…|\.{3,}|_{3,}|^[IVX]+[.、]/i.test(raw)
    const rows=x.outline.map((line,i)=>{
      if(i===0&&!bad&&line.trim()===raw)return ''
      const t=line.trim(),lv=t.startsWith('-')?2:t.startsWith('●')?1:(/_{3,}/.test(t)?1:0),body=t.replace(/^[-●]\s*/,'')
      const html=escape(body).replace(/\((\d+)\)\s*_{2,}/g,(m,num)=>{
        const key=`lecture-${g.year}-${num}`,val=session.answers[key]||''
        if(only&&!only.has(num))return `<span class="wf-blank-no">(${num})</span><span class="pq-blank-off">······</span>`
        return `<span class="wf-blank-no">(${num})</span><input class="wf-blank${val?' filled':''}${key===cur?' cur':''}" id="it-${key}" data-item="${key}" data-workflow-blank="${key}" value="${escape(val)}" style="width:${blankW(val)}px" autocomplete="off" spellcheck="false" aria-label="第 ${num} 空">`})
      return `<p class="wf-ol lv${lv}">${html}</p>`}).join('')
    const items=gItems(g),filled=items.filter(it=>isAnswered(it,session.answers)).length
    return `<div class="workflow-card"><div class="wf-lecture-head"><h2>${bad?'Mini-lecture':escape(raw)}</h2><span class="wf-lecture-count" id="wf-lecture-count">已填 ${filled} / ${items.length}</span></div><p class="workflow-hint">边听边填${x.blanks[0]?.wordLimit?`，每空不超过 ${x.blanks[0].wordLimit} 词`:''}。${g.only?'灰色的空本次不用填。':''}</p><div class="workflow-prompt wf-outline wf-lecture-outline">${rows}</div></div>`
  }
  function renderInterview(){
    const g=group(),src=listening[g.year]
    return `<div class="workflow-card"><p class="workflow-hint">Section B · Interview。原卷只印选项，题干在录音里。</p><div class="pq-intv">${gItems(g).map(it=>`<article class="pq-q ${it.key===cur?'cur':''}" id="it-${it.key}" data-item="${it.key}"><div class="pq-qhead"><span>${it.no}</span>${flagBtn(it.key)}</div>${optionsHTML(it)}${feedback(it)}</article>`).join('')}</div>${src?.audio?'':'<p class="workflow-hint">本年录音暂缺，可按纸面作答。</p>'}</div>`
  }
  function renderLanguage(){
    const y=group().year,rows=papers[y]?.languageLines||[]
    return `<div class="workflow-card"><h2>Language Usage · 改错</h2><p class="workflow-hint">有题号的行有错。选择操作，再写“原词 → 改后”。</p><div class="workflow-language">${rows.map((row,i)=>{
      const key=`language-${y}-${i+1}`,n=gapNo(row),ans=session.answers[key]||{}
      if(!n)return `<div class="workflow-language-row pq-lang-plain"><b></b><p>${escape(row[0])}</p></div>`
      return `<div class="workflow-language-row pq-lang ${key===cur?'cur':''}" id="it-${key}" data-item="${key}"><b>${n}</b><p>${escape(row[0])}</p><div class="workflow-language-input"><select data-workflow-error-kind="${key}" aria-label="第 ${n} 行操作"><option value="">操作</option><option value="replace" ${ans.kind==='replace'?'selected':''}>改词</option><option value="insert" ${ans.kind==='insert'?'selected':''}>缺词 ∧</option><option value="delete" ${ans.kind==='delete'?'selected':''}>多余 /</option></select><input data-workflow-error-text="${key}" value="${escape(ans.text||'')}" placeholder="原词 → 改后" aria-label="第 ${n} 行修改"></div>${flagBtn(key)}</div>`}).join('')}</div></div>`
  }
  function translationSource(y){
    const src=papers[y],full=(src.translation||[]).join('\n'),target=src.translationTarget
    return target&&full.includes(target)?escape(full.slice(0,full.indexOf(target)))+`<mark>${escape(target)}</mark>`+escape(full.slice(full.indexOf(target)+target.length)):escape(full)
  }
  function renderTranslation(){
    const y=group().year,key=`translation-${y}`,v=session.answers[key]||''
    return `<div class="pq-trans"><section class="workflow-card"><h2>原文${papers[y].translationTarget?'<small>划线部分为翻译范围</small>':''}</h2><div class="workflow-prompt pq-src">${translationSource(y)}</div></section><section class="workflow-card"><h2>我的译文</h2><textarea class="workflow-long-answer" id="it-${key}" data-item="${key}" data-workflow-text="${key}" placeholder="在这里写英文译文">${escape(v)}</textarea><p class="workflow-word-count" id="wf-long-count">${words(v)} 词 · 自动保存</p></section></div>`
  }
  function writingTarget(y){const t=session.targets?.[y];return t||papers[y]?.writingMinWords||300}
  function writingCount(y,v){const n=words(v),t=writingTarget(y),pct=Math.min(100,Math.round(n/t*100));return `<div class="pq-wbar"><i style="width:${pct}%" class="${n>=t?'done':''}"></i></div><p class="workflow-word-count ${n<t?'under':''}" id="wf-long-count">${n} / ${t} 词${n>=t?' · 已达标':` · 还差 ${t-n} 词`} · 自动保存</p>`}
  function renderWriting(){
    const y=group().year,src=papers[y],key=`writing-${y}`,v=session.answers[key]||''
    return `<div class="workflow-card"><h2>写作 · 摘要＋观点</h2><details open><summary>写作要求与材料</summary><div class="workflow-prompt">${(src.writing||[]).map(x=>`<p>${escape(x)}</p>`).join('')}</div></details><div class="pq-target"><label>目标字数 <input type="number" min="50" max="1200" step="10" value="${writingTarget(y)}" data-pq-target="${y}"></label>${src.writingMinWords?`<small>原卷最低 ${src.writingMinWords} 词</small>`:''}</div><textarea class="workflow-long-answer pq-essay" id="it-${key}" data-item="${key}" data-workflow-text="${key}" placeholder="在这里写作文">${escape(v)}</textarea><div id="pq-wcount">${writingCount(y,v)}</div></div>`
  }
  function groupLabel(g){
    if(g.kind==='reading')return `${g.year} · ${passageName(art(g.articleId))}`
    return `${g.year} · ${g.kind==='lecture'?'Section A':g.kind==='interview'?'Section B':g.kind==='language'?'改错':g.kind==='translation'?'翻译':'写作'}`
  }
  function cardHTML(){
    const blocks=session.groups.map((g,gi)=>{
      const items=gItems(g)
      if(items.length===1&&items[0].kind==='long')return `<div class="pq-cgroup"><span>${escape(groupLabel(g))}</span><div class="pq-grid"><button type="button" class="pq-cell wide ${isAnswered(items[0],session.answers)?'answered':''} ${gi===session.current?'cur':''}" data-pq-jump="${items[0].key}" data-g="${gi}">${isAnswered(items[0],session.answers)?words(session.answers[items[0].key])+' 词':'未写'}</button></div></div>`
      return `<div class="pq-cgroup"><span>${escape(groupLabel(g))}</span><div class="pq-grid">${items.map(it=>{
        const st=[isAnswered(it,session.answers)?'answered':'',session.marks[it.key]?'flag':'',gi===session.current&&it.key===cur?'cur':''].filter(Boolean).join(' ')
        return `<button type="button" class="pq-cell ${st}" data-pq-jump="${it.key}" data-g="${gi}" aria-label="第 ${it.no} 题${session.marks[it.key]?'，存疑':''}${isAnswered(it,session.answers)?'，已作答':'，未作答'}">${it.no}</button>`}).join('')}</div></div>`}).join('')
    const all=allItems(session.groups),done=all.filter(it=>isAnswered(it,session.answers)).length
    return `<div class="pq-card-head"><strong>答题卡</strong><span>${done} / ${all.length}</span></div>${blocks}<div class="pq-legend"><span><i class="l-none"></i>未作答</span><span><i class="l-ans"></i>已作答</span><span><i class="l-flag"></i>存疑</span><span><i class="l-cur"></i>当前</span></div>`
  }
  function timerHTML(){
    const exam=!!session.deadline
    const secs=exam?Math.max(0,Math.ceil((session.deadline-Date.now())/1000)):Math.floor(elapsedMs()/1000)
    const hidden=session.hideTimer,paused=!!session.pausedAt
    return `<div class="pq-timer ${exam?'down':'up'} ${exam&&secs<=600?'warn':''} ${paused?'paused':''}"><button type="button" data-pq-timer="hide" title="${hidden?'显示':'隐藏'}计时" aria-label="${exam?'剩余时间':'已用时间'}"><time id="workflow-time">${hidden?'··:··':mmss(secs)}</time></button>${exam?'':`<button type="button" data-pq-timer="pause" title="${paused?'继续':'暂停'}计时" aria-label="${paused?'继续':'暂停'}计时">${paused?'继续':'暂停'}</button>`}</div>`
  }
  function renderSession(){
    const g=group(),kind=g.kind
    const body=kind==='reading'?renderReading():kind==='lecture'?renderLecture():kind==='interview'?renderInterview():kind==='language'?renderLanguage():kind==='translation'?renderTranslation():renderWriting()
    const track=isListening(kind)?listening[g.year]:null
    const slot=track?.audio?'<div id="wf-audio-slot" class="pq-audio"></div>':''
    const trSec=kind==='lecture'?'A':'B'
    const showTr=isListening(kind)&&session.mode!=='exam'&&!!window.TEM8_TRANSCRIPTS?.[g.year]?.[trSec]?.length
    const last=session.current===session.groups.length-1
    const name=session.type==='review'?(session.label||'错题复习'):title(session.type)
    const nav=`<div class="pq-gnav"><button type="button" class="secondary-btn" data-workflow-prev ${session.current===0?'disabled':''}>上一组</button>${last?'<button type="button" class="primary-btn" data-pq-submit>交卷 <span>→</span></button>':'<button type="button" class="primary-btn" data-workflow-next>下一组 <span>→</span></button>'}</div>`
    const all=allItems(session.groups),done=all.filter(it=>isAnswered(it,session.answers)).length
    $('#workflow-session-content').innerHTML=`<div class="pq-top"><button class="pq-back" type="button" data-workflow-back="config" aria-label="返回">←</button><div class="pq-title"><strong>${escape(name)}</strong><span>${escape(groupLabel(g))}${session.groups.length>1?` · 第 ${session.current+1}/${session.groups.length} 组`:''} · ${session.mode==='exam'?'计时':'练习'}</span></div>${kind==='reading'&&session.mode!=='exam'?'<button class="pq-ghost" type="button" data-workflow-study>精读</button>':''}<span class="pq-saved" id="pq-saved">${session.savedAt?'已保存 '+clock(session.savedAt):''}</span>${timerHTML()}</div>
      <div class="pq-shell ${kind==='reading'?'is-reading':''}"><div class="pq-main">${slot}${showTr?'<div id="wf-transcript"></div>':''}${body}<div class="pq-main-nav">${nav}</div></div><aside class="pq-aside" aria-label="答题卡"><div class="pq-cardwrap">${cardHTML()}</div><button type="button" class="pq-submit" data-pq-submit>交卷</button></aside></div>
      <div class="pq-bottom"><button type="button" class="pq-cardbtn" data-pq-drawer aria-haspopup="dialog"><b>答题卡</b><span>${done}/${all.length}</span></button>${nav}</div>
      <div class="pq-drawer" id="pq-drawer" hidden><button type="button" class="pq-drawer-bg" data-pq-drawer-close aria-label="关闭答题卡"></button><div class="pq-sheet" role="dialog" aria-label="答题卡"><div class="pq-grip"></div><div class="pq-cardwrap">${cardHTML()}</div><div class="pq-sheet-actions"><button type="button" class="secondary-btn" data-pq-drawer-close>关闭</button><button type="button" class="primary-btn" data-pq-submit>交卷 <span>→</span></button></div></div></div>`
    if(slot){
      const bStart=Number(track.sectionBStart)||0,aEnd=Number(track.sectionAEnd)||0
      const start=kind==='interview'?bStart:0
      const end=kind==='lecture'?(aEnd>0?aEnd:(bStart>0?bStart:(track.audioDuration||0))):0
      const hint=kind==='interview'&&bStart>0?`从 Section B 起点（${mmss(bStart)}）开始`:kind==='lecture'&&aEnd>0?`Section A 到 ${mmss(aEnd)} 结束`:''
      window.TEM8_AUDIO?.mount($('#wf-audio-slot'),{src:track.audio,mode:session.mode,replay:session.mode==='exam'?!!session.replay:true,title:`${g.year} 真题听力 · Section ${trSec}`,duration:track.audioDuration||0,start,end,note:hint})
    }
    if(showTr){const c=$('#wf-transcript');if(c)renderTranscript(g.year,trSec,c)}
    anno()?.refresh(kind==='reading'?article().id:'')
  }
  function paintCard(){
    const html=cardHTML()
    document.querySelectorAll('.pq-cardwrap').forEach(box=>{box.innerHTML=html})
    const all=allItems(session.groups),done=all.filter(it=>isAnswered(it,session.answers)).length
    const b=$('.pq-cardbtn span');if(b)b.textContent=`${done}/${all.length}`
  }
  function setCur(key,scroll){
    if(!key)return
    cur=key
    document.querySelectorAll('[data-item].cur').forEach(el=>el.classList.remove('cur'))
    const el=document.getElementById('it-'+key)
    if(el){el.classList.add('cur');if(scroll){
      if(group().kind==='reading'&&mobileTab!=='q'&&matchMedia('(max-width:760px)').matches)setTab('q')
      el.scrollIntoView({behavior:scroll==='key'?'auto':'smooth',block:'center'})}}
    paintCard()
  }
  function setTab(t){mobileTab=t;const r=$('.pq-read');if(r)r.dataset.tab=t;document.querySelectorAll('[data-pq-tab]').forEach(b=>{b.classList.toggle('on',b.dataset.pqTab===t);b.setAttribute('aria-selected',String(b.dataset.pqTab===t))});window.scrollTo({top:0})}
  function jump(key,gi){
    closeDrawer()
    if(gi!==undefined&&gi!==session.current){if(isListening(group().kind))window.TEM8_AUDIO?.stop();session.current=gi;persist();cur=key;renderSession()}
    setTimeout(()=>{setCur(key,true);const el=document.getElementById('it-'+key);if(el&&el.matches('input,textarea'))el.focus({preventScroll:true})},30)
  }
  function moveItem(dir){
    const items=gItems(group());if(!items.length)return
    let i=items.findIndex(it=>it.key===cur)
    i=i<0?(dir>0?0:items.length-1):Math.max(0,Math.min(items.length-1,i+dir))
    setCur(items[i].key,'key')
  }
  function openDrawer(){const d=$('#pq-drawer');if(d){d.hidden=false;requestAnimationFrame(()=>d.classList.add('open'))}}
  function closeDrawer(){const d=$('#pq-drawer');if(d&&!d.hidden){d.classList.remove('open');setTimeout(()=>{d.hidden=true},200)}}

  /* ---------- 对话框（交卷确认 / 离开保护） ---------- */
  function dialog(html){
    let d=$('#pq-dialog');if(!d){d=document.createElement('dialog');d.id='pq-dialog';d.className='pq-dialog';document.body.appendChild(d)}
    d.innerHTML=`<div class="pq-dialog-inner">${html}</div>`;if(!d.open)d.showModal();return d
  }
  function confirmSubmit(){
    persist()
    const all=allItems(session.groups),missing=all.filter(it=>!isAnswered(it,session.answers))
    const flagged=all.filter(it=>session.marks[it.key])
    const byG=new Map();for(const it of missing){if(!byG.has(it.gi))byG.set(it.gi,[]);byG.get(it.gi).push(it)}
    const list=missing.length?`<p>还有 <b>${missing.length}</b> 题未作答${byG.size===1&&missing.length<=12?'：'+missing.map(it=>it.no).join('、'):''}</p><div class="pq-missing">${[...byG].map(([gi,its])=>`${byG.size>1?`<span class="pq-mg">${escape(groupLabel(session.groups[gi]))}</span>`:''}${its.map(it=>`<button type="button" data-pq-dlg-jump="${it.key}" data-g="${it.gi}" aria-label="跳到第 ${it.no} 题">${it.no}</button>`).join('')}`).join('')}</div>`:'<p>全部题目都已作答。</p>'
    dialog(`<h3>${missing.length?'还有题没做完':'确认交卷？'}</h3>${list}${flagged.length?`<p class="pq-dlg-note">另有 ${flagged.length} 题标了存疑。</p>`:''}<div class="pq-dlg-actions"><button type="button" class="secondary-btn" data-pq-dlg="close" autofocus>回去检查</button><button type="button" class="primary-btn" data-pq-dlg="submit">${missing.length?'仍然提交':'交卷'}</button></div>`)
  }
  let pendingLeave=null
  function confirmLeave(target){
    pendingLeave=target
    dialog(`<h3>离开这次练习？</h3><p>进度已自动保存，下次在「按题型练习」里可以继续。</p><div class="pq-dlg-actions col"><button type="button" class="primary-btn" data-pq-dlg="keep">保存进度并离开</button><button type="button" class="secondary-btn danger" data-pq-dlg="discard">放弃本次练习</button><button type="button" class="pq-link" data-pq-dlg="close">留下继续做</button></div>`)
  }
  function leave(discard){
    const t=pendingLeave;pendingLeave=null;$('#pq-dialog')?.close()
    if(discard){writeStore(s=>{s.session=null});session=null}else persist()
    window.TEM8_AUDIO?.stop()
    if(t){confirmBypass=true;t.click();confirmBypass=false}
  }
  const inSession=()=>!!session&&$('#workflow-session-view')?.classList.contains('active')

  /* ---------- 听力原文面板（练习模式） ---------- */
  let trFollowRaf=0
  function renderTranscript(year,sec,container){
    const data=window.TEM8_TRANSCRIPTS?.[year]?.[sec]||[]
    if(!data.length){container.style.display='none';return}
    container.classList.add('wf-transcript')
    container.innerHTML=`<details class="pq-trdetails"><summary><strong>听力原文</strong><span class="wf-transcript-tip">做完再看；点句子跳转</span></summary><div class="wf-transcript-head"><button type="button" class="wf-tr-loop" data-wf-tr-loop>单句循环</button></div><div class="wf-transcript-body">`+
      data.map((s,i)=>`<p class="wf-tr-line${s.sp?(' sp-'+s.sp):''}" data-wf-tr="${i}" data-t="${s.t}">${s.sp?`<span class="wf-tr-sp">${escape(s.sp)}</span>`:''}<span class="wf-tr-txt">${escape(s.en)}</span></p>`).join('')+`</div></details>`
    const lines=[...container.querySelectorAll('[data-wf-tr]')]
    container._loopOn=false
    lines.forEach(el=>el.addEventListener('click',()=>window.TEM8_AUDIO?.seekTo(parseFloat(el.dataset.t))))
    const loopBtn=container.querySelector('[data-wf-tr-loop]')
    loopBtn?.addEventListener('click',()=>{container._loopOn=!container._loopOn;loopBtn.classList.toggle('on',container._loopOn);loopBtn.textContent=container._loopOn?'单句循环 · 开':'单句循环'})
    if(trFollowRaf)cancelAnimationFrame(trFollowRaf)
    let last=-2
    const body=container.querySelector('.wf-transcript-body')
    const tick=()=>{
      const A=window.TEM8_AUDIO
      if(!A||!A.mounted||!container.isConnected){trFollowRaf=0;return}
      const ct=A.currentTime||0;let c=-1
      for(let i=0;i<data.length;i++){if(ct>=data[i].t-0.15)c=i;else break}
      if(c>=0&&container._loopOn){const boundary=c+1<data.length?data[c+1].t:Infinity;if(ct>=boundary-0.12)A.seekTo(data[c].t)}
      if(c!==last){lines.forEach((el,i)=>el.classList.toggle('active',i===c))
        if(c>=0&&body&&container.querySelector('details')?.open){const el=lines[c];body.scrollTo({top:Math.max(0,el.offsetTop-body.clientHeight/2+el.clientHeight/2),behavior:'smooth'})}
        last=c}
      trFollowRaf=requestAnimationFrame(tick)
    }
    trFollowRaf=requestAnimationFrame(tick)
  }

  /* ---------- 交卷与结果页 ---------- */
  function submit(){
    if(!session)return
    persist()
    const run={type:session.type,year:session.year,years:session.years||[session.year],finishedAt:Date.now(),groups:session.groups,answers:session.answers,marks:session.marks,mode:session.mode,elapsed:Math.round(elapsedMs()/1000),durationMinutes:session.durationMinutes||0,label:session.label||'',eval:{}}
    writeStore(s=>{s.session=null;s.history=[...(s.history||[]),run].slice(-80)})
    mistakeUpdate(run)
    window.TEM8_AUDIO?.stop()
    session=null;lastRun=run;reportFilter=false
    renderReport();show('workflow-report-view','练习结果')
    document.dispatchEvent(new Event('tem8:mistakes-changed'))
  }
  const sig=r=>JSON.stringify((r.groups||[]).map(g=>[g.kind,g.year,g.articleId||'',g.only||[]]))
  function stats(run){
    const items=allItems(run.groups),g=items.filter(gradable)
    const ok=g.filter(it=>grade(it,run.answers)==='ok').length
    return {items,gradable:g,ok,wrong:g.filter(it=>grade(it,run.answers)==='bad'),none:g.filter(it=>grade(it,run.answers)==='none'),answered:items.filter(it=>isAnswered(it,run.answers)).length,pct:(()=>{const n=g.filter(it=>isAnswered(it,run.answers)).length;return n?Math.round(ok/n*100):null})()}
  }
  function ring(pct){
    const r=52,c=2*Math.PI*r,off=pct==null?c:c*(1-pct/100)
    return `<svg class="pq-ring" viewBox="0 0 120 120" role="img" aria-label="正确率 ${pct==null?'不适用':pct+'%'}"><circle cx="60" cy="60" r="${r}" class="bg"/><circle cx="60" cy="60" r="${r}" class="fg" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}"/><text x="60" y="58" text-anchor="middle">${pct==null?'—':pct+'%'}</text><text x="60" y="80" text-anchor="middle" class="sub">正确率</text></svg>`
  }
  // 解析：拆成【定位】【详解】【干扰排除】等段
  function analysisParts(text){
    const s=String(text||'').trim();if(!s)return []
    const re=/【([^】]{1,10})】/g,parts=[];let m,lastTag=null,lastIdx=0
    while((m=re.exec(s))){if(lastTag!==null||m.index>0){const body=s.slice(lastIdx,m.index).trim();if(body)parts.push({tag:lastTag,body})}lastTag=m[1];lastIdx=re.lastIndex}
    const tail=s.slice(lastIdx).trim();if(tail)parts.push({tag:lastTag,body:tail})
    return parts
  }
  function locatorHTML(it){
    if(!it.a)return ''
    const n=it.q?.locatorParagraph||Number((/Para\.\s*(\d+)/i.exec(it.prompt||'')||[])[1])
    if(!n)return ''
    const seg=it.a.segments[n-1];if(!seg)return ''
    let html=escape(seg.en)
    const quoted=(/[“"]([^”"]{6,})[”"]/.exec(it.prompt||'')||[])[1]
    if(quoted){const i=seg.en.toLowerCase().indexOf(quoted.toLowerCase());if(i>=0)html=escape(seg.en.slice(0,i))+'<mark>'+escape(seg.en.slice(i,i+quoted.length))+'</mark>'+escape(seg.en.slice(i+quoted.length))}
    return `<div class="pq-an-sec"><h5>原文定位 · 第 ${n} 段</h5><blockquote>${html}</blockquote></div>`
  }
  function analysisHTML(it){
    const parts=analysisParts(it.analysis)
    const pick=re=>parts.filter(p=>p.tag&&re.test(p.tag))
    const loc=pick(/定位/),why=pick(/详解|解析|分析|答案/),dis=pick(/干扰|排除|错项/),rest=parts.filter(p=>!loc.includes(p)&&!why.includes(p)&&!dis.includes(p))
    const sec=(h,ps)=>ps.length?`<div class="pq-an-sec"><h5>${h}</h5>${ps.map(p=>`<p>${escape(p.body).replace(/\n/g,'<br>')}</p>`).join('')}</div>`:''
    let html=''
    if(loc.length)html+=sec('原文定位',loc)
    html+=locatorHTML(it)
    html+=sec('为什么对',why)+sec('排除干扰项',dis)
    html+=rest.length?rest.map(p=>sec(p.tag?p.tag:(why.length?'补充':'解析'),[p])).join(''):''
    return html||'<p class="workflow-hint">该题暂无解析。</p>'
  }
  function reasonChips(it){
    const e=load().tools?.['m:'+it.key];if(!e)return ''
    return `<div class="pq-reasons"><span>错因</span>${REASONS.map(r=>`<button type="button" class="pq-chip xs ${e.r===r?'on':''}" data-pq-reason="${it.key}" data-r="${r}" aria-pressed="${e.r===r}">${r}</button>`).join('')}</div>`
  }
  function reportRow(it,run){
    const v=run.answers[it.key],r=grade(it,run.answers)
    const mark={ok:'正确',bad:'错误',none:'未作答',self:'自查',na:''}[r]
    if(it.kind==='choice'){
      const mine=v===undefined||v===''?'未作答':LETTERS[v],right=it.answer===undefined?'暂无':LETTERS[it.answer]
      return `<details class="wf-answer-row pq-row r-${r}" id="rp-${it.key}" ${r==='bad'?'open':''}><summary><span class="wf-qno">${it.kind==='choice'&&it.key.startsWith('interview')?it.no:'Q'+it.no}</span><span class="wf-mine">你的答案 ${mine}</span><span class="wf-right">正确 ${right}</span>${mark?`<span class="wf-mark ${r==='ok'?'ok':r==='bad'?'bad':''}">${mark}</span>`:''}</summary>${it.prompt?`<p class="wf-prompt">${escape(it.prompt)}</p>`:''}<ol class="pq-ropts">${(it.options||[]).map((o,i)=>`<li class="${i===it.answer?'right':''} ${i===v&&i!==it.answer?'wrong':''}"><b>${LETTERS[i]}</b>${escape(o)}</li>`).join('')}</ol><div class="pq-analysis">${it.answer!==undefined?`<div class="pq-an-sec"><h5>正确答案</h5><p><b>${right}</b>　${escape(it.options?.[it.answer]||'')}</p></div>`:''}${analysisHTML(it)}</div>${r==='bad'?reasonChips(it):''}</details>`
    }
    if(it.kind==='blank'){
      const shown=String(it.answer||'').replace(/\s*\/\/\s*/g,' 或 ')
      return `<details class="wf-answer-row pq-row r-${r}" id="rp-${it.key}" ${r==='bad'?'open':''}><summary><span class="wf-qno">${it.no}</span><span class="wf-mine">你的答案 ${escape(String(v||'').trim()||'—')}</span><span class="wf-right">${escape(shown||'暂无')}</span>${mark?`<span class="wf-mark ${r==='ok'?'ok':r==='bad'?'bad':'self'}">${mark}</span>`:''}</summary>${it.analysis?`<div class="pq-analysis">${analysisHTML(it)}</div>`:''}${r==='bad'?reasonChips(it):''}</details>`
    }
    if(it.kind==='short')return `<details class="wf-answer-row pq-row r-self" id="rp-${it.key}"><summary><span class="wf-qno">Q${it.no}</span><span class="wf-mine">你的作答 ${escape(String(v||'').trim()||'未作答')}</span><span class="wf-mark">简答 · 自查</span></summary><p class="wf-prompt">${escape(it.prompt)}</p><div class="pq-analysis">${it.ref?`<div class="pq-an-sec"><h5>参考答案</h5><p>${escape(it.ref)}</p></div>`:''}${analysisHTML(it)}</div></details>`
    if(it.kind==='line')return `<details class="wf-answer-row pq-row r-self" id="rp-${it.key}"><summary><span class="wf-qno">${it.no}</span><span class="wf-mine">你的修改 ${escape(String(v?.text||'').trim()||'未作答')}</span><span class="wf-right">${escape(it.fix||'暂无')}</span></summary><p class="wf-prompt">${escape(it.row)}</p>${it.analysis?`<p class="wf-analysis">${escape(it.analysis)}</p>`:''}</details>`
    return ''
  }
  /* 翻译、写作：参考对照 + 自评 */
  const sentences=t=>String(t||'').replace(/\s+/g,' ').match(/[^.!?。！？]+[.!?。！？]+["”’)]?|[^.!?。！？]+$/g)?.map(s=>s.trim()).filter(s=>s.length>2)||[]
  const RUBRIC=[['内容','摘要准确概括了材料要点'],['内容','观点明确，论据充分、切题'],['结构','段落清楚，首尾呼应'],['结构','衔接自然，逻辑连贯'],['语言','语法基本无误'],['语言','用词准确得体，句式有变化']]
  function selfEval(g,run){
    const y=g.year,key=`${g.kind}-${y}`,mine=String(run.answers[key]||''),ev=run.eval?.[key]||{}
    const ticks=ev.ticks||[]
    if(g.kind==='translation'){
      const ref=papers[y]?.translationReference,pts=sentences(ref)
      const box=`<div class="pq-compare"><section><h5>我的译文 · ${words(mine)} 词</h5><div class="pq-mytext">${mine.trim()?escape(mine).replace(/\n/g,'<br>'):'<span class="workflow-hint">未作答</span>'}</div></section><section><h5>参考译文</h5><div class="pq-mytext">${ref?escape(ref).replace(/\n/g,'<br>'):'<span class="workflow-hint">暂无参考译文</span>'}</div></section></div>`
      const done=ticks.filter(Boolean).length
      const check=pts.length?`<div class="pq-eval"><h5>逐句对照自评 <small>每句看意思是否译出、关键词和句型是否到位</small></h5>${pts.map((p,i)=>`<label class="pq-evrow"><input type="checkbox" data-pq-eval="${key}" data-i="${i}" ${ticks[i]?'checked':''}><span>${escape(p)}</span></label>`).join('')}<p class="pq-evscore">自评 <b>${done} / ${pts.length}</b> 句到位 · 估分约 <b>${Math.round(done/pts.length*100)}%</b></p></div>`:''
      const guide=papers[y]?.translationAnalysis
      return `<div class="workflow-report-card"><h3>${y} · 翻译</h3>${box}${check}${guide?`<details class="wf-answer-row"><summary>翻译解析</summary><p class="wf-analysis">${escape(guide).replace(/\n/g,'<br>')}</p></details>`:''}<div class="pq-export"><button type="button" class="secondary-btn" data-pq-export="txt" data-key="${key}">导出 txt</button><button type="button" class="secondary-btn" data-pq-export="docx" data-key="${key}">导出 Word</button></div></div>`
    }
    const ref=papers[y]?.writingReference,min=papers[y]?.writingMinWords,n=words(mine)
    const done=ticks.filter(Boolean).length+(min&&n>=min?1:0),total=RUBRIC.length+(min?1:0)
    return `<div class="workflow-report-card"><h3>${y} · 写作</h3><p>${n} 词${min?(n>=min?` · 达到最低 ${min} 词`:` · <b class="pq-bad">未达到最低 ${min} 词</b>`):''}</p><div class="pq-compare"><section><h5>我的作文</h5><div class="pq-mytext">${mine.trim()?escape(mine).replace(/\n/g,'<br>'):'<span class="workflow-hint">未作答</span>'}</div></section><section><h5>参考范文</h5><div class="pq-mytext">${ref?escape(ref).replace(/\n/g,'<br>'):'<span class="workflow-hint">暂无范文</span>'}</div></section></div>
      <div class="pq-eval"><h5>评分维度自评 <small>对照范文，逐条打勾</small></h5>${min?`<label class="pq-evrow auto"><input type="checkbox" disabled ${n>=min?'checked':''}><span><em>字数</em>达到 ${min} 词（自动判断）</span></label>`:''}${RUBRIC.map(([d,t],i)=>`<label class="pq-evrow"><input type="checkbox" data-pq-eval="${key}" data-i="${i}" ${ticks[i]?'checked':''}><span><em>${d}</em>${t}</span></label>`).join('')}<p class="pq-evscore">自评 <b>${done} / ${total}</b> 项 · 估分约 <b>${Math.round(done/total*100)}%</b></p></div>
      ${papers[y]?.writingAnalysis?`<details class="wf-answer-row"><summary>写作指南</summary><p class="wf-analysis">${escape(papers[y].writingAnalysis).replace(/\n/g,'<br>')}</p></details>`:''}<div class="pq-export"><button type="button" class="secondary-btn" data-pq-export="txt" data-key="${key}">导出 txt</button><button type="button" class="secondary-btn" data-pq-export="docx" data-key="${key}">导出 Word</button></div></div>`
  }
  function renderReport(){
    const run=lastRun;if(!run)return
    const st=stats(run)
    const hist=load().history||[]
    const prev=[...hist].reverse().find(h=>h.finishedAt<run.finishedAt&&sig(h)===sig(run))
    const prevPct=prev?stats(prev).pct:null
    const diff=st.pct!=null&&prevPct!=null?st.pct-prevPct:null
    const m=Math.floor((run.elapsed||0)/60),s=(run.elapsed||0)%60
    const bars=run.groups.map((g,gi)=>{const its=gItems(g).filter(gradable);if(!its.length)return '';const ok=its.filter(it=>grade(it,run.answers)==='ok').length,p=Math.round(ok/its.length*100)
      return `<div class="pq-bar"><span>${escape(groupLabel(g))}</span><div><i style="width:${p}%" class="${p<60?'low':p<80?'mid':''}"></i></div><b>${ok}/${its.length}</b></div>`}).join('')
    const grid=run.groups.map((g,gi)=>{const its=gItems(g).filter(it=>it.kind!=='long');if(!its.length)return ''
      return `<div class="pq-cgroup"><span>${escape(groupLabel(g))}</span><div class="pq-grid">${its.map(it=>{const r=grade(it,run.answers);return `<button type="button" class="pq-cell res r-${r}" data-pq-goto="${it.key}" aria-label="第 ${it.no} 题 ${({ok:'正确',bad:'错误',none:'未作答',self:'需自查',na:'无答案'})[r]}">${it.no}<i aria-hidden="true">${r==='ok'?'✓':r==='bad'?'✗':''}</i></button>`}).join('')}</div></div>`}).join('')
    const objective=st.items.some(it=>it.kind!=='long')
    const cards=run.groups.map(g=>{
      if(g.kind==='translation'||g.kind==='writing')return selfEval(g,run)
      let its=gItems(g)
      if(reportFilter)its=its.filter(it=>grade(it,run.answers)==='bad')
      if(!its.length)return ''
      return `<div class="workflow-report-card"><h3>${escape(groupLabel(g))}</h3><div class="wf-answer-list">${its.map(it=>reportRow(it,run)).join('')}</div></div>`}).join('')
    const name=run.type==='review'?(run.label||'错题复习'):title(run.type)
    $('#workflow-report-content').innerHTML=`<div class="page-head pq-head"><h1>${escape(name)} · 已交卷</h1></div>
      ${objective?`<div class="pq-hero">${ring(st.pct)}<div class="pq-hero-stats"><div><b>${st.ok}</b><span>答对</span></div><div><b>${st.wrong.length}</b><span>答错</span></div><div><b>${st.none.length}</b><span>未答</span></div><div><b>${st.gradable.length-st.none.length}/${st.gradable.length}</b><span>完成</span></div><div><b>${m}′${String(s).padStart(2,'0')}″</b><span>用时</span></div>${diff!=null?`<div class="pq-diff ${diff>0?'up':diff<0?'down':''}"><b>${diff>0?'+':''}${diff}%</b><span>比上次 ${prevPct}%</span></div>`:''}</div></div>
      ${bars?`<div class="pq-bars">${bars}</div>`:''}
      ${st.gradable.length<st.items.filter(it=>it.kind!=='long').length?`<p class="workflow-hint">简答、改错和部分填空需要对照答案自查，不计入正确率。</p>`:''}
      <div class="pq-res-grid">${grid}</div>
      <div class="pq-res-actions">${st.wrong.length?`<button type="button" class="secondary-btn ${reportFilter?'on':''}" data-pq-filter aria-pressed="${reportFilter}">${reportFilter?'显示全部题':'只看错题'}</button><button type="button" class="primary-btn" data-pq-redo>重做错题 <span>${st.wrong.length}</span></button><button type="button" class="secondary-btn" data-view="mistakes">去错题本</button>`:'<span class="workflow-hint">没有错题，做得不错。</span>'}</div>
      ${st.wrong.length?'<p class="workflow-hint">错题已自动收进错题本。展开错题可以给它标上错因，复习时能按错因筛选。</p>':''}`:`<p class="workflow-hint">用时 ${m} 分 ${s} 秒。</p>`}
      ${cards}
      <div class="pq-res-foot"><button class="secondary-btn" data-workflow-back="${run.type==='mock'?'mock':'papers'}">${run.type==='mock'?'返回模考':'返回题库'}</button>${run.type!=='review'&&run.type!=='mock'?'<button class="primary-btn" data-pq-again>再练一次 <span>→</span></button>':''}</div>`
  }
  function saveEval(key,i,on){
    const run=lastRun;if(!run)return
    run.eval||={};const ev=run.eval[key]||={ticks:[]};ev.ticks[i]=on
    writeStore(s=>{const h=(s.history||[]).find(x=>x.finishedAt===run.finishedAt);if(h)h.eval=run.eval})
  }
  function exportText(key,kind){
    const run=lastRun;if(!run)return
    const y=Number(key.split('-')[1]),isT=key.startsWith('translation'),mine=String(run.answers[key]||'')
    const ref=isT?papers[y]?.translationReference:papers[y]?.writingReference
    const name=`专八${y}${isT?'翻译':'写作'}`
    const E=window.TEM8_EXPORT;if(!E)return
    if(kind==='txt')E.txt(`${name}\n\n【我的${isT?'译文':'作文'}】\n${mine}\n\n${ref?`【参考${isT?'译文':'范文'}】\n${ref}\n`:''}`,`${name}.txt`)
    else E.docx([{text:name,size:32,bold:true},{text:`我的${isT?'译文':'作文'} · ${words(mine)} 词`,bold:true,before:240},...mine.split(/\n+/).map(t=>({text:t})),...(ref?[{text:`参考${isT?'译文':'范文'}`,bold:true,before:360},...ref.split(/\n+/).map(t=>({text:t,color:'5A5248'}))]:[])],`${name}.docx`)
  }

  /* ---------- 字典弹窗 ---------- */
  function wordPopup(key,el){
    const seg=Number(el?.closest('[data-anno-p]')?.dataset.annoP)
    if(typeof window.TEM8_SHOW_WORD==='function')window.TEM8_SHOW_WORD(String(key||'').toLowerCase(),{articleId:group()?.articleId||'',seg:Number.isFinite(seg)?seg:-1},el)
  }

  /* ---------- 精读页里的“做题”入口 ---------- */
  function readerActions(a){
    const qs=articleQuestions(a),choice=qs.filter(q=>q.type==='choice'),short=qs.filter(q=>q.type==='short')
    return `<div class="workflow-reader-actions"><h3>读完后做题</h3><p>${choice.length} 道选择题 · ${short.length} 道简答题</p>${qs.length?`<button class="primary-btn" data-start-passage="${escape(a.id)}" data-passage-type="reading-group">做本篇题目 →</button>`:''}</div>`
  }

  /* ---------- 事件 ---------- */
  document.addEventListener('click',e=>{
    const t=e.target.closest('button,[data-view]');if(!t)return
    // 离开保护：做题中点导航或返回
    if(!confirmBypass&&inSession()&&(t.dataset.view||t.dataset.workflowBack)&&!t.closest('#pq-dialog')){
      const any=Object.keys(session.answers).length
      if(any){e.preventDefault();e.stopPropagation();confirmLeave(t);return}
      persist()
    }
    if(!t.matches('button'))return
    const d=t.dataset
    if(d.pqDlg){e.stopPropagation()
      if(d.pqDlg==='close'){pendingLeave=null;$('#pq-dialog')?.close()}
      else if(d.pqDlg==='mock'){$('#pq-dialog')?.close();const f=pendingMock;pendingMock=null;f?.()}
      else if(d.pqDlg==='submit'){$('#pq-dialog')?.close();submit()}
      else if(d.pqDlg==='keep')leave(false)
      else if(d.pqDlg==='discard')leave(true)
      return}
    if(d.pqDlgJump){e.stopPropagation();$('#pq-dialog')?.close();jump(d.pqDlgJump,Number(d.g));return}
    if(t.id==='reader-back'||(d.openReader!==undefined&&d.mode==='free')){const r=$('[data-workflow-return]');if(r)r.hidden=true}
    if(d.workflowType){e.stopPropagation();openConfig(d.workflowType);return}
    if(d.startPassage){e.stopPropagation();openConfig(d.passageType||'reading-group',d.startPassage);start();return}
    if(d.openReader!==undefined&&d.mode==='practice'&&d.article&&d.article!=='sample'){e.stopPropagation();openConfig('reading-group',d.article);start();return}
    if(d.articleMode==='practice'&&$('#reader-view')?.classList.contains('active')){
      const yr=$('#reader-mode-badge').textContent.match(/(\d{4})/)
      const sel=articles.find(x=>x.year===Number(yr?.[1])&&x.title===$('.reader-title').textContent)
      if(sel){e.stopPropagation();openConfig('reading-group',sel.id);start();return}
    }
    if(d.pcMistakes!==undefined){e.stopPropagation();const b=document.querySelector('.tabbar [data-tab="review"]');confirmBypass=true;(document.querySelector('.seg-tabs [data-view="mistakes"]')||b)?.click();b?.click();confirmBypass=false;setTimeout(()=>document.querySelector('[data-rv-start]:not([disabled])')?.click(),80);return}
    if(d.pqGroup){e.stopPropagation();const G=GROUPS.find(x=>x.id===d.pqGroup);if(G&&!G.types.includes(cfg.type))setType(G.types[0]);return}
    if(d.pqType){e.stopPropagation();if(d.pqType!==cfg.type)setType(d.pqType);return}
    if(d.pqYear){e.stopPropagation();const y=Number(d.pqYear);cfg.years=cfg.years.includes(y)?cfg.years.filter(x=>x!==y):[...cfg.years,y];cfg.passages=[];if(!cfg.minutesTouched)cfg.minutes=0;renderConfig();return}
    if(d.pqYears){e.stopPropagation();const ys=yearList(cfg.type);cfg.years=d.pqYears==='all'?ys:ys.slice(0,1);cfg.passages=[];renderConfig();return}
    if(d.pqPassage!==undefined){e.stopPropagation();const id=d.pqPassage;cfg.passages=!id?[]:cfg.passages.includes(id)?cfg.passages.filter(x=>x!==id):[...cfg.passages,id];if(cfg.passages.length===yearArticles(cfg.years[0]).length)cfg.passages=[];renderConfig();return}
    if(d.pqMode){e.stopPropagation();cfg.mode=d.pqMode;renderConfig();return}
    if(d.pqMin){e.stopPropagation();if(d.pqMin==='reset'){cfg.minutesTouched=false}else{cfg.minutes=Math.max(5,Math.min(300,(cfg.minutes||estimate().minutes)+Number(d.pqMin)));cfg.minutesTouched=true}renderConfig();return}
    if(d.workflowBack){e.stopPropagation()
      if(d.workflowBack==='config'){if(session){persist();const s=session;session=null;if(s.type==='mock'){window.TEM8_AUDIO?.stop();confirmBypass=true;document.querySelector('.seg-tabs [data-view="mock"]')?.click();confirmBypass=false}else openConfig(s.type==='review'?'reading-group':s.type)}else openConfig(cfg.type)}
      else{const nav=document.querySelector(`.seg-tabs [data-view="${d.workflowBack}"],.tabbar [data-view="${d.workflowBack}"]`);confirmBypass=true;nav?.click();confirmBypass=false}
      return}
    if(d.workflowStart!==undefined){e.stopPropagation();savePrefs();start();return}
    if(d.workflowResume!==undefined){e.stopPropagation();resume();return}
    if(d.pqDiscard!==undefined){e.stopPropagation();if(confirm('放弃上次没交卷的练习？作答内容会被清除。')){writeStore(s=>{s.session=null});session=null;if($('#workflow-config-view').classList.contains('active'))renderConfig();renderCards()}return}
    if(d.pqAgain!==undefined){e.stopPropagation();if(lastRun){newSession(lastRun.groups,lastRun.type,{mode:lastRun.mode,minutes:lastRun.durationMinutes||30,instant:prefs().instant,allowWord:true,replay:prefs().replay})}return}
    if(d.pqRedo!==undefined){e.stopPropagation();if(lastRun)startKeys(stats(lastRun).wrong.map(it=>it.key),'重做错题');return}
    if(d.pqFilter!==undefined){e.stopPropagation();reportFilter=!reportFilter;renderReport();return}
    if(d.pqGoto){e.stopPropagation();if(reportFilter&&!document.getElementById('rp-'+d.pqGoto)){reportFilter=false;renderReport()}const el=document.getElementById('rp-'+d.pqGoto);if(el){el.open=true;el.scrollIntoView({behavior:'smooth',block:'center'});el.classList.add('pq-flash');setTimeout(()=>el.classList.remove('pq-flash'),1200)}return}
    if(d.pqReason){e.stopPropagation();const k=d.pqReason,r=d.r;writeStore(s=>{const e2=s.tools?.['m:'+k];if(e2)e2.r=e2.r===r?'':r});t.parentElement.querySelectorAll('[data-pq-reason]').forEach(b=>{const on=b===t&&!b.classList.contains('on');b.classList.toggle('on',on);b.setAttribute('aria-pressed',String(on))});return}
    if(d.pqExport){e.stopPropagation();exportText(d.key,d.pqExport);return}
    if(!session)return
    // —— 以下为做题页 ——
    if(d.pqSubmit!==undefined){e.stopPropagation();closeDrawer();confirmSubmit();return}
    if(d.pqDrawer!==undefined){e.stopPropagation();openDrawer();return}
    if(d.pqDrawerClose!==undefined){e.stopPropagation();closeDrawer();return}
    if(d.pqJump){e.stopPropagation();jump(d.pqJump,Number(d.g));return}
    if(d.pqTab){e.stopPropagation();setTab(d.pqTab);return}
    if(d.pqTimer){e.stopPropagation()
      if(d.pqTimer==='hide')session.hideTimer=!session.hideTimer
      else if(!session.deadline){if(session.pausedAt){session.pausedMs+=Date.now()-session.pausedAt;session.pausedAt=0}else session.pausedAt=Date.now()}
      const box=t.closest('.pq-timer');if(box)box.outerHTML=timerHTML();persist();return}
    if(d.pqStrike){e.stopPropagation();const k=d.pqStrike,i=Number(d.i),arr=session.strikes[k]||[];session.strikes[k]=arr.includes(i)?arr.filter(x=>x!==i):[...arr,i];persist();refreshItem(k);return}
    if(d.workflowStudy!==undefined){e.stopPropagation();persist();const a=article();confirmBypass=true;document.querySelector('.tabbar [data-tab="library"]')?.click();confirmBypass=false;document.querySelector(`[data-open-reader][data-mode="free"][data-article="${a.id}"]`)?.click();const r=$('[data-workflow-return]');if(r)r.hidden=false;return}
    if(d.workflowReturn!==undefined){e.stopPropagation();t.hidden=true;renderSession();show('workflow-session-view',title(session.type));return}
    if(d.workflowNext!==undefined){e.stopPropagation();if(isListening(group().kind))window.TEM8_AUDIO?.stop();if(session.current<session.groups.length-1){session.current++;cur='';persist();renderSession();window.scrollTo(0,0)}return}
    if(d.workflowPrev!==undefined){e.stopPropagation();if(isListening(group().kind))window.TEM8_AUDIO?.stop();if(session.current>0){session.current--;cur='';persist();renderSession();window.scrollTo(0,0)}return}
    if(d.workflowMark){e.stopPropagation();const k=d.workflowMark;session.marks[k]=!session.marks[k];persist();t.classList.toggle('on',session.marks[k]);t.setAttribute('aria-pressed',String(session.marks[k]));t.textContent=session.marks[k]?'已存疑':'存疑';setCur(k);return}
    if(d.workflowLocate){e.stopPropagation();const q=qByKey.get(d.workflowLocate),m=q?.prompt.match(/Para\.\s*(\d+)/i),n=q?.locatorParagraph||Number(m?.[1]);if(n){if(matchMedia('(max-width:760px)').matches)setTab('p');const p=document.getElementById(`wf-p-${n}`);p?.scrollIntoView({behavior:'smooth',block:'center'});p?.classList.add('anno-flash');setTimeout(()=>p?.classList.remove('anno-flash'),1400)}return}
    if(d.workflowWord){e.stopPropagation();const sel=window.getSelection();if(sel&&!sel.isCollapsed&&String(sel).trim())return;wordPopup(d.workflowWord,t);return}
  },true)
  function refreshItem(k){
    const el=document.getElementById('it-'+k);if(!el)return
    const it=gItems(group()).find(x=>x.key===k);if(!it||it.kind!=='choice')return
    const opts=el.querySelector('.pq-opts');if(opts)opts.outerHTML=optionsHTML(it)
    el.querySelector('.pq-instant')?.remove();const fb=feedback(it);if(fb)el.insertAdjacentHTML('beforeend',fb)
  }
  document.addEventListener('focusin',e=>{if(!inSession())return;const it=e.target.closest?.('[data-item]');if(it&&it.dataset.item!==cur){cur=it.dataset.item;document.querySelectorAll('[data-item].cur').forEach(x=>x.classList.toggle('cur',x===it));it.classList.add('cur');paintCard()}})
  document.addEventListener('pointerdown',e=>{if(!inSession())return;const it=e.target.closest?.('[data-item]');if(it&&it.dataset.item!==cur)setCur(it.dataset.item)})
  document.addEventListener('change',e=>{
    const t=e.target
    if(t.dataset.pqSwitch){cfg[t.dataset.pqSwitch]=t.checked;renderConfig();return}
    if(t.dataset.pqEval){saveEval(t.dataset.pqEval,Number(t.dataset.i),t.checked);const card=t.closest('.workflow-report-card');if(card){const run=lastRun,g=run.groups.find(x=>`${x.kind}-${x.year}`===t.dataset.pqEval);if(g)card.outerHTML=selfEval(g,run)}return}
    if(!session)return
    if(t.dataset.workflowChoice){const k=t.dataset.workflowChoice;session.answers[k]=Number(t.value);persist();refreshItem(k);setCur(k);return}
    if(t.dataset.workflowErrorKind){session.answers[t.dataset.workflowErrorKind]||={};session.answers[t.dataset.workflowErrorKind].kind=t.value;persist();return}
    if(t.dataset.pqTarget){const y=t.dataset.pqTarget;session.targets||={};session.targets[y]=Math.max(50,Math.min(1200,Number(t.value)||300));persist();const c=$('#pq-wcount');if(c)c.innerHTML=writingCount(Number(y),session.answers[`writing-${y}`]);return}
  })
  document.addEventListener('input',e=>{
    const t=e.target;if(!session)return
    if(t.dataset.workflowBlank){const k=t.dataset.workflowBlank;session.answers[k]=t.value;persist();t.classList.toggle('filled',!!t.value.trim());t.style.width=blankW(t.value)+'px'
      const items=gItems(group()),n=items.filter(it=>isAnswered(it,session.answers)).length,el=$('#wf-lecture-count');if(el)el.textContent=`已填 ${n} / ${items.length}`;paintCard();return}
    if(t.dataset.workflowShort){const k=t.dataset.workflowShort;session.answers[k]=t.value;persist();const it=gItems(group()).find(x=>x.key===k),limit=it?.limit,n=words(t.value),el=document.querySelector(`[data-count-for="${k}"]`);if(el){el.textContent=limit?`${n} / ${limit} 词${n>limit?' · 超出':''}`:`${n} 词`;el.classList.toggle('over',!!limit&&n>limit)}paintCard();return}
    if(t.dataset.workflowErrorText){const k=t.dataset.workflowErrorText;session.answers[k]||={};session.answers[k].text=t.value;persist();paintCard();return}
    if(t.dataset.workflowText){const k=t.dataset.workflowText;session.answers[k]=t.value;persist()
      if(k.startsWith('writing')){const c=$('#pq-wcount');if(c)c.innerHTML=writingCount(Number(k.split('-')[1]),t.value)}else{const el=$('#wf-long-count');if(el)el.textContent=`${words(t.value)} 词 · 自动保存`}
      paintCard();return}
  })
  // 键盘：A–D 选项，←/→ 切题，F 标记存疑
  document.addEventListener('keydown',e=>{
    if(!inSession()||e.metaKey||e.ctrlKey||e.altKey)return
    if($('#pq-dialog')?.open||document.querySelector('dialog[open]'))return
    const tag=(e.target.tagName||'').toLowerCase();if(['input','textarea','select'].includes(tag)||e.target.isContentEditable)return
    const k=e.key.toLowerCase()
    if(k==='arrowright'||k==='arrowleft'){e.preventDefault();moveItem(k==='arrowright'?1:-1);return}
    const items=gItems(group());if(!cur&&items[0])cur=items[0].key
    const it=items.find(x=>x.key===cur);if(!it)return
    if(k==='f'){e.preventDefault();document.querySelector(`[data-workflow-mark="${it.key}"]`)?.click();return}
    if(it.kind==='choice'&&'abcd'.includes(k)&&k.length===1){const i='abcd'.indexOf(k);if(i>=(it.options||[]).length)return;e.preventDefault();session.answers[it.key]=i;persist();refreshItem(it.key);setCur(it.key);return}
  })
  setInterval(()=>{
    if(!session||!$('#workflow-session-view')?.classList.contains('active'))return
    const exam=!!session.deadline,n=exam?Math.max(0,Math.ceil((session.deadline-Date.now())/1000)):Math.floor(elapsedMs()/1000)
    const el=$('#workflow-time');if(el&&!session.hideTimer)el.textContent=mmss(n)
    const box=$('.pq-timer');if(box&&exam)box.classList.toggle('warn',n<=600)
    if(exam&&n===0){submit();return}
    if(n%15===0)persist()
  },1000)
  window.addEventListener('beforeunload',()=>{if(session&&!window.TEM8_IMPORTING_BACKUP)persist()})

  // 一次性迁移：从旧的交卷记录里把错题、存疑标记整理进错题本
  ;(function migrate(){
    const s=load();if(s.mzv===1)return
    const runs=(s.history||[]).filter(r=>r&&Array.isArray(r.groups)).sort((x,y)=>(x.finishedAt||0)-(y.finishedAt||0))
    for(const r of runs){try{mistakeUpdate({...r,answers:r.answers||{},marks:r.marks||{},finishedAt:r.finishedAt||Date.now()})}catch{}}
    const live=s.session;if(live?.marks&&Array.isArray(live.groups)){try{mistakeUpdate({groups:live.groups,answers:{},marks:live.marks,finishedAt:Date.now()})}catch{}}
    writeStore(x=>{x.mzv=1})
  })()
  window.TEM8_WORKFLOW={renderCards,readerActions,openConfig,openMock,accuracyByKind,runScore:r=>stats(r).pct,history:()=>load().history||[],session:()=>load().session,itemInfo,startKeys,analysisHTML,parseKey,REASONS}
})()
