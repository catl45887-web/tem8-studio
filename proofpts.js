/* 改错考点：考点分布 + 检查顺序（练习前看），交卷后自动标考点、对错可改、全文译文 */
(function(){
  const D=window.TEM8_PROOF;if(!D)return
  const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))
  const TIPS={
    '词义与搭配':'意思说不通、搭配不地道：近义词换错（have→preserve）、动宾搭配（make→conduct sessions）。语法全对时最后读意思找它。',
    '连词与逻辑衔接':'前后句是转折、让步、因果还是递进？but / while / although / because 互换最常见，therefore↔however 也爱考。',
    '冠词/限定词':'泛指名词前多了 the，固定表达缺 the（in the case of），some / common 等多余限定词。',
    '比较与固定结构':'more…than、rather than、as…as、neither…nor 配对是否完整，缺一半或多一半。',
    '谓语动词':'主谓一致（contain→contains）、时态（is→was）、语态（designing→designed）。每行先找谓语。',
    '介词':'动词/形容词固定搭配的介词：depend on、adhere to、in depth、on the contrary，缺、多、换都有。',
    '代词':'指代对象单复数：their↔its 是十几年来的常客；先回头找它指谁。',
    '从句引导词':'非限定用 which 不用 that，介词后用 which，同位语缺 that，the way how 多余。',
    '形近词':'specially/especially 考过 4 次；imaginary/imaginative、raise/rise、intelligent/intelligible。',
    '非谓语':'分词作状语的主动/被动（Looked→Looking），并列结构前后形式一致（defining…and providing）。',
    '词性转换':'形容词和副词互换（dramatic→dramatically），名词/形容词（dominated→dominant）。'
  }
  const ORDER=[
    ['谓语','先找每行的谓语：主谓一致、时态、语态','谓语动词'],
    ['衔接','看句与句、分句与分句：逻辑词对不对，从句引导词对不对','连词与逻辑衔接,从句引导词'],
    ['名词前后','冠词、代词单复数、介词搭配','冠词/限定词,代词,介词'],
    ['词形','形近词、词性、分词形式','形近词,词性转换,非谓语'],
    ['读意思','语法都对还没找到，就读意思：用词、搭配、比较结构','词义与搭配,比较与固定结构']
  ]
  const LOG='tem8_proof_log'
  const getLog=()=>{try{return JSON.parse(localStorage.getItem(LOG)||'{}')}catch(e){return {}}}
  const setLog=o=>{try{localStorage.setItem(LOG,JSON.stringify(o))}catch(e){}}
  const typeOf=(y,n)=>D.tags[y]?.[n-1]||''
  const itemOf=(y,n)=>(D.items[y]||[]).find(x=>x[0]===n)
  // 汇总
  const all=[];for(const y in D.items)D.items[y].forEach(([n,line,fix])=>all.push({y:+y,n,line,fix,t:typeOf(y,n)}))
  const byType={};all.forEach(x=>(byType[x.t]||(byType[x.t]=[])).push(x))
  const types=Object.keys(byType).sort((a,b)=>byType[b].length-byType[a].length)
  const years=Object.keys(D.items)

  // 把答案里的“错词”在行里标出来
  function errWord(fix){
    const f=String(fix).replace(/（.*?）/g,'')
    let m=/删除\s+(\S+)/.exec(f);if(m)return {w:m[1],how:'del'}
    m=/^(\S+)\s+(前|后)加/.exec(f);if(m)return {w:m[1],how:m[2]==='前'?'before':'after'}
    m=/^(.+?)\s*→/.exec(f);if(m)return {w:m[1].trim(),how:'rep'}
    return null
  }
  function markLine(line,fix){
    const e=errWord(fix);if(!e)return esc(line)
    const re=new RegExp(`(^|[^A-Za-z])(${e.w.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')})(?![A-Za-z])`)
    const m=re.exec(line);if(!m)return esc(line)
    const i=m.index+m[1].length,j=i+m[2].length
    const cls=e.how==='del'?'pp-del':e.how==='rep'?'pp-rep':'pp-ins'
    const w=`<mark class="${cls}">${esc(line.slice(i,j))}</mark>`
    return esc(line.slice(0,i))+(e.how==='before'?'<i class="pp-caret">∧</i>':'')+w+(e.how==='after'?'<i class="pp-caret">∧</i>':'')+esc(line.slice(j))
  }
  // 自动比对：答案里的目标词出现在作答里
  function wants(fix){
    const f=String(fix).replace(/（.*?）/g,'')
    if(/删除|删去/.test(f)){const e=errWord(f);return e?[[e.w.toLowerCase()]]:[]}
    let tail=/加\s+(.+)$/.exec(f)?.[1]||(f.includes('→')?f.split('→').pop():'')
    return tail.split('/').map(s=>s.trim().toLowerCase().split(/\s+/).filter(Boolean)).filter(a=>a.length)
  }
  function autoJudge(fix,text){
    const v=String(text||'').toLowerCase();if(!v.trim())return 'none'
    const toks=v.replace(/[^a-z'\-]/g,' ').split(/\s+/).filter(Boolean)
    const ws=wants(fix);if(!ws.length)return ''
    return ws.some(a=>a.every(w=>toks.includes(w)))?'ok':'bad'
  }

  // —— 练习前：考点卡 ——
  function myStats(){
    const log=getLog(),s={}
    for(const k in log){const r=log[k];const t=typeOf(r.y,r.n);if(!t)continue;const o=s[t]||(s[t]={n:0,bad:0});o.n++;if(r.r!=='ok')o.bad++}
    return s
  }
  function configHTML(){
    const total=all.length,max=byType[types[0]].length,mine=myStats(),hasMine=Object.keys(mine).length
    const rows=types.map(t=>{const list=byType[t],m=mine[t]
      const ex=[...list].sort((a,b)=>b.y-a.y||a.n-b.n).map(x=>`<li><button type="button" class="pp-ex" data-pp-ex aria-expanded="false"><span class="pp-ex-y">${x.y} · ${x.n}</span><span class="pp-ex-l" data-raw="${esc(x.line)}" data-mark="${esc(markLine(x.line,x.fix))}">${esc(x.line)}</span><span class="pp-ex-a">${esc(x.fix)}</span></button></li>`).join('')
      return `<details class="pp-row"><summary><span class="pp-name">${esc(t)}</span><span class="pp-bar"><i style="width:${list.length/max*100}%"></i></span><span class="pp-num">${list.length}<small>${Math.round(list.length/total*100)}%</small></span>${hasMine?`<span class="pp-mine ${m&&m.bad/m.n>=.5?'hi':''}">${m?`错 ${m.bad}/${m.n}`:'—'}</span>`:''}</summary><p class="pp-tip">${esc(TIPS[t]||'')}</p><ol class="pp-exs">${ex}</ol></details>`}).join('')
    const order=ORDER.map((o,i)=>`<li><b>${i+1}</b><div><strong>${o[0]}</strong><span>${o[1]}</span><small>${o[2].split(',').map(t=>`${t} ${byType[t]?.length||0}`).join(' · ')}</small></div></li>`).join('')
    return `<section class="pq-step pp-card"><h2>改错考点<em>${years.length} 套 · ${total} 处</em></h2>
      <details class="pp-fold" open><summary>检查顺序<small>每行按这个顺序扫，越靠前越好找</small></summary><ol class="pp-order">${order}</ol></details>
      <details class="pp-fold"><summary>考点分布<small>点一类看历年真题例句${hasMine?' · 右列是你做过的':''}</small></summary>
        <p class="pp-spoil">例句来自真题，错处默认不显示，点一下才标出来。</p>
        <div class="pp-rows">${rows}</div></details></section>`
  }

  // —— 交卷后 ——
  function rowExtra(it,v){
    const m=/^language-(\d{4})-/.exec(it.key);if(!m)return {chip:'',body:''}
    const y=m[1],t=typeOf(y,it.no)
    const log=getLog(),cur=log[it.key]?.r||autoJudge(it.fix,v?.text)
    const chip=t?`<span class="pp-chip">${esc(t)}</span>`:''
    const seg=`<div class="pp-judge" data-pp-key="${it.key}" data-y="${y}" data-n="${it.no}"><span>${cur==='none'?'没作答，记为没改出':'和答案比对过，判得不对可以改'}</span><button type="button" data-pp-r="ok" class="${cur==='ok'?'on':''}" aria-pressed="${cur==='ok'}">改对了</button><button type="button" data-pp-r="bad" class="${cur!=='ok'?'on':''}" aria-pressed="${cur!=='ok'}">没改对</button></div>`
    const tip=t&&TIPS[t]?`<p class="pp-rtip"><b>${esc(t)}</b>${esc(TIPS[t])}</p>`:''
    const line=itemOf(y,it.no)
    return {chip,body:`${line?`<p class="wf-prompt pp-marked">${markLine(line[1],line[2])}</p>`:''}${seg}${tip}`,hasLine:!!line}
  }
  // 交卷时把本次每题结果记下来（用户改判时覆盖）
  function recordItems(items,answers,runId){
    const log=getLog()
    for(const it of items){const m=/^language-(\d{4})-/.exec(it.key);if(!m)continue
      const prev=log[it.key];if(prev&&prev.run===runId)continue
      const r=autoJudge(it.fix,answers?.[it.key]?.text)
      log[it.key]={y:+m[1],n:it.no,r:r==='ok'?'ok':'bad',at:Date.now(),run:runId}}
    setLog(log)
  }
  function sectionHTML(year,items,part){
    const log=getLog()
    const miss={};items.forEach(it=>{const r=log[it.key]?.r;if(r&&r!=='ok'){const t=typeOf(year,it.no);if(t)miss[t]=(miss[t]||0)+1}})
    const mk=Object.entries(miss).sort((a,b)=>b[1]-a[1])
    const sum=`<div class="pp-sum" data-pp-sum="${year}">${mk.length?`<b>这次没改出的考点</b>${mk.map(([t,c])=>`<span class="pp-chip bad">${esc(t)} ${c}</span>`).join('')}`:'<b>10 处都改出来了</b>'}<small>按答案自动比对，每题下面可以改判</small></div>`
    const tr=D.tr[year]||[]
    const trans=tr.length?`<details class="pp-trans"><summary>全文译文<small>按改正后的原文逐句对照</small></summary><ol>${tr.map(([en,zh])=>`<li><p class="pp-en">${esc(en)}</p><p class="pp-zh">${esc(zh)}</p></li>`).join('')}</ol></details>`:''
    return part==='sum'?sum:part==='trans'?trans:sum+trans
  }
  function refreshSum(el){
    const sec=el.closest('.rp-sec');const box=sec?.querySelector('[data-pp-sum]');if(!box)return
    const y=box.dataset.ppSum,keys=[...sec.querySelectorAll('[data-pp-key]')].map(x=>({key:x.dataset.ppKey,no:+x.dataset.n}))
    const tmp=document.createElement('div');tmp.innerHTML=sectionHTML(y,keys,'sum');box.replaceWith(tmp.firstElementChild)
  }

  document.addEventListener('click',e=>{
    const ex=e.target.closest('[data-pp-ex]')
    if(ex){const l=ex.querySelector('.pp-ex-l'),on=ex.getAttribute('aria-expanded')!=='true';ex.setAttribute('aria-expanded',on);l.innerHTML=on?l.dataset.mark:esc(l.dataset.raw);return}
    const b=e.target.closest('[data-pp-r]')
    if(b){const box=b.closest('[data-pp-key]'),log=getLog();log[box.dataset.ppKey]={y:+box.dataset.y,n:+box.dataset.n,r:b.dataset.ppR,at:Date.now(),run:(log[box.dataset.ppKey]||{}).run,manual:1};setLog(log)
      box.querySelectorAll('[data-pp-r]').forEach(x=>{const on=x===b;x.classList.toggle('on',on);x.setAttribute('aria-pressed',on)})
      refreshSum(box)}
  })
  window.TEM8_PROOFPTS={configHTML,rowExtra,recordItems,sectionHTML,autoJudge,markLine}
})()
