/* 改错考点：考点分布 + 检查顺序（练习前看），交卷后自动标考点、对错可改、全文译文 */
(function(){
  const D=window.TEM8_PROOF;if(!D)return
  const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))
  const MIN=5  // 一类至少做过这么多题才给“我的”结论
  const TIPS={
    '词义与搭配':'意思说不通、搭配不地道：近义词换错（have→preserve）、动宾搭配（make→conduct sessions）、多余的词（share common elements）。',
    '连词与逻辑衔接':'前后是转折、让步、因果还是递进？but / while / although / because 互换最常见；两个句子只用逗号连着，缺 and。',
    '冠词/限定词':'泛指名词前多了 the，固定表达缺 the（in the case of），a / the 用反，some 这类多余的限定词。',
    '比较与固定结构':'成对的结构缺一半或多一半：more…than、rather than、as…as、neither…nor、sooner or later。',
    '谓语动词':'主谓一致（contain→contains）、时态（is→was）、语态（designing→designed）、多余的 be。每行先找谓语。',
    '介词':'固定搭配的介词：depend on、adhere to、in depth、on the contrary。缺、多、换都考过。',
    '代词':'先回头找它指谁：their / its 单复数互换考过 5 次，还有形式主语 it、指代的单复数。',
    '从句引导词':'非限定定语从句用 which 不用 that；同位语从句缺 that；the way how 里的 how 多余。',
    '形近词':'specially / especially 考过 3 次；还有 imaginary / imaginative、raise / rise、intelligent / intelligible。',
    '非谓语':'分词的主动和被动（Looked→Looking），并列成分形式要一致，介词 to 后面接动名词（key to understanding）。',
    '词性转换':'形容词和副词互换（dramatic→dramatically），形容词和名词互换（dominated→dominant）。'
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
  const all=[];for(const y in D.items)D.items[y].forEach(([n,line,fix])=>all.push({y:+y,n,line,fix,t:typeOf(y,n)}))
  const byType=()=>{const o={};all.forEach(x=>{x.t=typeOf(x.y,x.n);(o[x.t]||(o[x.t]=[])).push(x)});return o}
  const years=Object.keys(D.items)

  // 答案里的错词，在行里标出来
  function errWord(fix){
    const f=String(fix).replace(/（.*?）/g,'')
    let m=/删[除去]\s+(\S+)/.exec(f);if(m)return {w:m[1],how:'del'}
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
  // 标准答案拆成几种可接受的改法：{k:删/加/换, w:[要出现的词]}
  function wants(fix){
    const raw=String(fix),alts=[]
    raw.replace(/（或\s*(.+?)）/g,(_,x)=>{alts.push(x);return ''})
    const base=raw.replace(/（.*?）/g,'').trim(),segs=base.split(/\s+\/\s+/)
    if(segs.length>1&&segs.every(x=>/→|加|删/.test(x)))alts.push(...segs);else alts.push(base)
    const out=[]
    for(const f of alts){
      if(/删[除去]/.test(f)){const m=/删[除去]\s+(\S+)/.exec(f);if(m)out.push({k:'del',w:[m[1].toLowerCase()]});continue}
      const ins=/加\s+(.+)$/.exec(f)?.[1],tail=ins||(f.includes('→')?f.split('→').pop():'')
      tail.split('/').map(x=>x.trim().toLowerCase().split(/\s+/).filter(Boolean)).filter(a=>a.length).forEach(w=>out.push({k:ins?'ins':'rep',w}))
    }
    return out
  }
  // 删除要写 /，加词要写 ∧，换词不能带这两个符号；再看答案词在不在
  function autoJudge(fix,text){
    const v=String(text||'').toLowerCase().trim();if(!v)return 'none'
    const toks=v.replace(/[^a-z'\-]/g,' ').split(/\s+/).filter(Boolean)
    const del=/^\/|删|×/.test(v),ins=/[∧^]|加/.test(v)
    const ws=wants(fix);if(!ws.length)return 'bad'
    return ws.some(a=>a.w.every(w=>toks.includes(w))&&(a.k==='del'?del:a.k==='ins'?ins:!del&&!ins))?'ok':'bad'
  }
  // 当前判定：有记录用记录（可能是手动改过的），否则自动比对
  function judge(it,answers){
    const r=getLog()[it.key]?.r
    if(r==='ok'||r==='bad'||r==='none')return r
    return autoJudge(it.fix,answers?.[it.key]?.text)
  }

  // —— 练习前：考点卡 ——
  function doneYears(){
    const s=new Set(),log=getLog()
    for(const k in log)s.add(String(log[k].y))
    try{for(const r of window.TEM8_WORKFLOW?.history?.()||[])for(const g of r.groups||[])if(g.kind==='language')s.add(String(g.year))}catch(e){}
    return s
  }
  function myStats(){
    const log=getLog(),s={}
    for(const k in log){const r=log[k];if(r.r==='none')continue;const t=typeOf(r.y,r.n);if(!t)continue;const o=s[t]||(s[t]={n:0,bad:0});o.n++;if(r.r!=='ok')o.bad++}
    return s
  }
  function configHTML(){
    const BT=byType(),types=Object.keys(BT).sort((a,b)=>BT[b].length-BT[a].length)
    const total=all.length,max=BT[types[0]].length,mine=myStats(),hasMine=Object.keys(mine).length,done=doneYears()
    const rows=types.map(t=>{const list=BT[t],m=mine[t]
      const sorted=[...list].sort((a,b)=>b.y-a.y||a.n-b.n),open=sorted.filter(x=>done.has(String(x.y))),lock=sorted.length-open.length
      const ex=open.map(x=>`<li><button type="button" class="pp-ex" data-pp-ex aria-expanded="false"><span class="pp-ex-y">${x.y} · ${x.n}</span><span class="pp-ex-l" data-raw="${esc(x.line)}" data-mark="${esc(markLine(x.line,x.fix))}">${esc(x.line)}</span><span class="pp-ex-a">${esc(x.fix)}</span></button></li>`).join('')
      const lk=lock?`<li class="pp-lock">还有 ${lock} 句在没做过的年份里，做完那一套才显示，免得提前知道考点</li>`:''
      const mineCell=!hasMine?'':!m?'<span class="pp-mine">—</span>':m.n<MIN?`<span class="pp-mine" title="至少做 ${MIN} 题才给结论">做过 ${m.n}</span>`:`<span class="pp-mine ${m.bad/m.n>=.5?'hi':''}">错 ${m.bad}/${m.n}</span>`
      return `<details class="pp-row"><summary><span class="pp-name">${esc(t)}</span><span class="pp-bar"><i style="width:${list.length/max*100}%"></i></span><span class="pp-num">${list.length}<small>${Math.round(list.length/total*100)}%</small></span>${mineCell}</summary><p class="pp-tip">${esc(TIPS[t]||'')}</p><ol class="pp-exs">${ex}${lk}</ol></details>`}).join('')
    const order=ORDER.map((o,i)=>`<li><b>${i+1}</b><div><strong>${o[0]}</strong><span>${o[1]}</span><small>${o[2].split(',').map(t=>`${t} ${BT[t]?.length||0}`).join(' · ')}</small></div></li>`).join('')
    return `<section class="pq-step pp-card"><h2>改错考点<em>${years.length} 套 · ${total} 处</em></h2>
      <details class="pp-fold" open><summary>检查顺序<small>每行按这个顺序扫</small></summary><ol class="pp-order">${order}</ol>
        <p class="pp-why">顺序按好不好找排，不按考了多少次排。“词义与搭配”考得最多，但只有读懂意思才发现得了，所以放在最后，等语法都排查完再看。这个顺序是根据题型特点总结的做题建议，不是统计出来的规律。</p></details>
      <details class="pp-fold"><summary>考点分布<small>点开一类看说明和真题例句${hasMine?` · 右边一列是你的成绩，满 ${MIN} 题才统计`:''}</small></summary>
        <p class="pp-spoil">只显示你做过的年份的例句；点一下例句，才会标出错在哪里。分类是按主要考点人工标注的，有的题可以算两类。</p>
        <div class="pp-rows">${rows}</div></details></section>`
  }

  // —— 交卷后 ——
  function rowExtra(it,v){
    const m=/^language-(\d{4})-/.exec(it.key);if(!m)return {chip:'',body:''}
    const y=m[1],t=typeOf(y,it.no),cur=judge(it,{[it.key]:v})
    const chip=t?`<span class="pp-chip">${esc(t)}</span>`:''
    const seg=cur==='none'?`<div class="pp-judge"><span>没作答，不计入考点统计</span></div>`
      :`<div class="pp-judge" data-pp-key="${it.key}" data-y="${y}" data-n="${it.no}"><span>已按答案自动判定，判得不对可以改</span><button type="button" data-pp-r="ok" class="${cur==='ok'?'on':''}" aria-pressed="${cur==='ok'}">改对了</button><button type="button" data-pp-r="bad" class="${cur==='bad'?'on':''}" aria-pressed="${cur==='bad'}">没改对</button></div>`
    const tip=t&&TIPS[t]?`<p class="pp-rtip"><b>${esc(t)}</b>${esc(TIPS[t])}</p>`:''
    const line=itemOf(y,it.no)
    return {chip,body:`${line?`<p class="wf-prompt pp-marked">${markLine(line[1],line[2])}</p>`:''}${seg}${tip}`,hasLine:!!line}
  }
  // 交卷后记下每题结果；同一次交卷重复打开报告不会覆盖手动改判
  function recordItems(items,answers,runId){
    const log=getLog()
    for(const it of items){const m=/^language-(\d{4})-/.exec(it.key);if(!m)continue
      const prev=log[it.key];if(prev&&prev.run===runId)continue
      log[it.key]={y:+m[1],n:it.no,r:autoJudge(it.fix,answers?.[it.key]?.text),at:Date.now(),run:runId}}
    setLog(log)
  }
  function sectionHTML(year,items,part){
    const log=getLog(),miss={};let none=0
    items.forEach(it=>{const r=log[it.key]?.r;if(r==='none'){none++;return}if(r==='bad'){const t=typeOf(year,it.no);if(t)miss[t]=(miss[t]||0)+1}})
    const mk=Object.entries(miss).sort((a,b)=>b[1]-a[1])
    const sum=`<div class="pp-sum" data-pp-sum="${year}">${mk.length?`<b>这次没改出的考点</b>${mk.map(([t,c])=>`<span class="pp-chip bad">${esc(t)} ${c}</span>`).join('')}`:`<b>${none?'做了的都改对了':'10 处都改对了'}</b>`}${none?`<span class="pp-chip">没作答 ${none} 题</span>`:''}<small>已按答案自动判定，每题下面可以改判。没作答的题不计入考点统计。</small></div>`
    const tr=D.tr[year]||[]
    const trans=tr.length?`<details class="pp-trans"><summary>全文译文<small>按改正后的原文逐句对照</small></summary><ol>${tr.map(([en,zh])=>`<li><p class="pp-en">${esc(en)}</p><p class="pp-zh">${esc(zh)}</p></li>`).join('')}</ol></details>`:''
    return part==='sum'?sum:part==='trans'?trans:sum+trans
  }
  function refreshSum(el){
    const sec=el.closest('.rp-sec');const box=sec?.querySelector('[data-pp-sum]');if(!box)return
    const y=box.dataset.ppSum,keys=[...sec.querySelectorAll('.pq-row[id^="rp-language-"]')].map(x=>({key:x.id.slice(3),no:+x.querySelector('.wf-qno').textContent}))
    const tmp=document.createElement('div');tmp.innerHTML=sectionHTML(y,keys,'sum');box.replaceWith(tmp.firstElementChild)
  }

  document.addEventListener('click',e=>{
    const ex=e.target.closest('[data-pp-ex]')
    if(ex){const l=ex.querySelector('.pp-ex-l'),on=ex.getAttribute('aria-expanded')!=='true';ex.setAttribute('aria-expanded',on);l.innerHTML=on?l.dataset.mark:esc(l.dataset.raw);return}
    const b=e.target.closest('[data-pp-r]')
    if(b){const box=b.closest('[data-pp-key]'),key=box.dataset.ppKey,r=b.dataset.ppR,log=getLog()
      log[key]={y:+box.dataset.y,n:+box.dataset.n,r,at:Date.now(),run:(log[key]||{}).run,manual:1};setLog(log)
      box.querySelectorAll('[data-pp-r]').forEach(x=>{const on=x===b;x.classList.toggle('on',on);x.setAttribute('aria-pressed',on)})
      // 题目行和答题卡的颜色跟着变
      const row=document.getElementById('rp-'+key);if(row){row.classList.remove('r-ok','r-bad','r-self');row.classList.add('r-'+r)}
      document.querySelectorAll(`.rp-cell[data-pq-goto="${key}"]`).forEach(c=>{c.classList.remove('r-ok','r-bad','r-self');c.classList.add('r-'+r)})
      refreshSum(box)}
  })
  window.TEM8_PROOFPTS={configHTML,rowExtra,recordItems,sectionHTML,autoJudge,judge,markLine}
})()
