(() => {
  'use strict'
  const scripts = window.TEM8_TRANSCRIPTS || {}
  const listening = { ...(window.TEM8_LISTENING_ARCHIVE || {}), ...(window.TEM8_LISTENING_2026 || {}) }
  const years = Object.keys(scripts).map(Number).filter(y => listening[y]?.audio).sort((a,b) => b-a)
  const KEY = 'tem8_intensive_v1'
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
  const fmt = n => { n = Number(n)||0; return `${Math.floor(n/60)}:${String(Math.floor(n%60)).padStart(2,'0')}` }
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {} } catch { return {} } }
  let saved = read()
  let year = years.includes(Number(saved.year)) ? Number(saved.year) : years[0]
  let section = saved.section === 'B' ? 'B' : 'A'
  let selected = -1, active = -1, loop = false, raf = 0, opening = false
  const host = () => document.querySelector('#intensive-content')
  const rows = () => scripts[year]?.[section] || []
  const track = () => listening[year] || {}
  const start = () => section === 'B' ? Number(track().sectionBStart)||0 : 0
  const end = () => section === 'A' ? Number(track().sectionAEnd)||0 : Number(track().audioDuration)||0
  const key = i => `${year}-${section}-${i}`
  const baseTime = i => Number(rows()[i]?.t ?? 0)
  function time(i) {
    const exact=saved.corrections?.[key(i)]
    if(exact!=null)return Number(exact)
    const anchors=[{i:0,t:baseTime(0)},{i:rows().length,t:end()}]
    for(let n=0;n<rows().length;n++){
      const t=saved.corrections?.[key(n)]
      if(t!=null)anchors.push({i:n,t:Number(t)})
    }
    anchors.sort((a,b)=>a.i-b.i)
    let left=anchors[0],right=anchors[anchors.length-1]
    for(let n=0;n<anchors.length-1;n++)if(anchors[n].i<=i&&i<=anchors[n+1].i){left=anchors[n];right=anchors[n+1];break}
    const a=left.i===rows().length?end():baseTime(left.i)
    const b=right.i===rows().length?end():baseTime(right.i)
    const ratio=b>a?(baseTime(i)-a)/(b-a):0
    return Math.round((left.t+(right.t-left.t)*Math.max(0,Math.min(1,ratio)))*10)/10
  }
  const corrected = i => saved.corrections?.[key(i)] != null
  const timeMark = i => {
    const src=rows()[i]?.tSource
    return corrected(i) ? ' ✓' : ['word-anchor','anchor'].includes(src) ? ' ◆' : ['asr','asr2'].includes(src) ? ' ●' : ['anchor-interpolated','interp','transcript-interpolated'].includes(src) ? ' ~' : ''
  }
  const timeTitle = i => {
    const src=rows()[i]?.tSource
    return corrected(i) ? '已手动校准' : ['word-anchor','anchor'].includes(src) ? '时间已核对' : ['asr','asr2'].includes(src) ? '时间为自动对齐' : src==='interp' ? '时间为估算' : ['anchor-interpolated','transcript-interpolated'].includes(src) ? '时间为估算，可手动校准' : '时间为初步定位，可能与录音有偏差'
  }
  function save() { saved.year=year; saved.section=section; localStorage.setItem(KEY,JSON.stringify(saved)); document.dispatchEvent(new Event('tem8:study-changed')) }
  function audioSlot() {
    const data=track()
    window.TEM8_AUDIO?.mount(host().querySelector('#intensive-audio'),{
      src:data.audio,mode:'practice',replay:true,title:`${year} 年真题 · Section ${section}`,
      duration:Number(data.audioDuration)||0,start:start(),end:end(),
      note:'精听模式 · 可暂停、拖动和倍速'
    })
  }
  function render() {
    if (!host()) return
    const data=rows()
    if (!data.length) { host().innerHTML='<p class="intensive-empty">这年的听力原文尚未录入。</p>'; return }
    selected=-1; active=-1; loop=false
    host().innerHTML=`<div class="intensive-toolbar"><div class="intensive-years" role="group" aria-label="真题年份">${years.map(y=>`<button type="button" data-intensive-year="${y}" class="${y===year?'active':''}">${y} 年</button>`).join('')}</div><div class="intensive-sections" role="group" aria-label="听力部分"><button type="button" data-intensive-section="A" class="${section==='A'?'active':''}">Section A · Mini-lecture</button><button type="button" data-intensive-section="B" class="${section==='B'?'active':''}">Section B · Interview</button></div></div>
      <div class="intensive-player" id="intensive-audio"></div>
      <div class="intensive-studybar"><div><strong>听力原文 · ${data.length} 句</strong><span>点击句子跳转并继续播放；当前句随播放高亮。</span></div><div class="intensive-study-actions"><button type="button" data-intensive-loop aria-pressed="false">单句循环</button><button type="button" data-intensive-calibrate disabled>将当前播放点设为选中句起点</button></div></div>
      <div class="intensive-note">${year===2026?'句子时间：带 ◆ 的已核对，带 ~ 的为估算。':[2024,2025].includes(year)?'句子时间：◆ 已核对，● 自动对齐，~ 估算。':'句子时间为初步定位，可能与录音有偏差。'}听到一句的开头时，选中该句并点“设为起点”即可校准，结果保存在本机。</div>
      <div class="intensive-transcript" id="intensive-lines">${data.map((row,i)=>`${section==='B'&&(i===0||row.part!==data[i-1].part)?`<div class="intensive-part-title">Interview · Part ${row.part===2?'Two':'One'}</div>`:''}<button type="button" class="intensive-line" data-intensive-line="${i}" aria-label="跳转到第 ${i+1} 句"><span class="intensive-line-no">${String(i+1).padStart(2,'0')}</span><span class="intensive-line-copy">${row.sp?`<span class="intensive-speaker">${row.sp==='W'?'主持人':'嘉宾'}</span>`:''}${esc(row.en)}</span><time data-intensive-time="${i}" title="${timeTitle(i)}">${fmt(time(i))}${timeMark(i)}</time></button>`).join('')}</div>
      <div class="intensive-calibration"><label>选中句起点 <input type="text" id="intensive-time-input" inputmode="decimal" placeholder="例：13:24.5" disabled></label><button type="button" data-intensive-save disabled>保存时间</button><button type="button" data-intensive-reset disabled>恢复初始定位</button></div>`
    audioSlot(); follow(); save()
  }
  function select(i, seek) {
    if (i<0 || i>=rows().length) return
    selected=i
    host().querySelectorAll('[data-intensive-line]').forEach((el,n)=>el.classList.toggle('selected',n===i))
    for (const selector of ['[data-intensive-calibrate]','[data-intensive-save]','[data-intensive-reset]','#intensive-time-input']) {
      const el=host().querySelector(selector); if(el)el.disabled=false
    }
    host().querySelector('#intensive-time-input').value=fmt(time(i))
    if (seek) window.TEM8_AUDIO?.seekTo(time(i))
  }
  function refreshTime(i) {
    const el=host()?.querySelector(`[data-intensive-time="${i}"]`)
    if(el){ el.textContent=fmt(time(i))+timeMark(i); el.title=timeTitle(i) }
    const input=host()?.querySelector('#intensive-time-input'); if(input&&selected===i)input.value=fmt(time(i))
  }
  function follow() {
    if(raf)cancelAnimationFrame(raf)
    const tick=()=>{
      if(!host() || !document.querySelector('#intensive-view')?.classList.contains('active')){raf=0;return}
      const audio=window.TEM8_AUDIO
      const ct=audio?.currentTime||0
      const data=rows()
      let index=-1
      for(let i=0;i<data.length;i++){if(ct>=time(i)-0.12)index=i;else break}
      if(loop&&selected>=0&&audio?.element&&!audio.element.paused){
        const next=selected+1<data.length?time(selected+1):end()
        if(ct>=next-0.08&&ct>time(selected)+0.2)audio.seekTo(time(selected))
      }
      if(index!==active){
        const old=host().querySelector(`[data-intensive-line="${active}"]`)
        const now=host().querySelector(`[data-intensive-line="${index}"]`)
        old?.classList.remove('playing');now?.classList.add('playing');active=index
        if(now && audio?.element && !audio.element.paused) now.scrollIntoView({block:'nearest',behavior:'smooth'})
      }
      raf=requestAnimationFrame(tick)
    }
    raf=requestAnimationFrame(tick)
  }
  function parseTime(s){
    const m=String(s).trim().match(/^(?:(\d+):)?(\d{1,2})(?:\.(\d))?$/)
    if(!m)return NaN
    return (Number(m[1]||0)*60)+Number(m[2])+Number(m[3]||0)/10
  }
  function setCorrection(t){
    if(selected<0||!Number.isFinite(t)||t<start()||t>end())return false
    const fixed=Object.keys(saved.corrections||{}).filter(k=>k.startsWith(`${year}-${section}-`)).map(k=>({i:Number(k.split('-').pop()),t:Number(saved.corrections[k])})).filter(x=>x.i!==selected)
    if(fixed.some(x=>(x.i<selected&&x.t>=t)||(x.i>selected&&x.t<=t)))return false
    saved.corrections ||= {};saved.corrections[key(selected)]=Math.round(t*10)/10
    save();rows().forEach((_,i)=>refreshTime(i));return true
  }
  host()?.addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b)return
    if(b.dataset.intensiveYear){year=Number(b.dataset.intensiveYear);render();return}
    if(b.dataset.intensiveSection){section=b.dataset.intensiveSection;render();return}
    if(b.dataset.intensiveLine!==undefined){select(Number(b.dataset.intensiveLine),true);return}
    if(b.dataset.intensiveLoop!==undefined){loop=!loop;b.classList.toggle('active',loop);b.setAttribute('aria-pressed',String(loop));return}
    if(b.dataset.intensiveCalibrate!==undefined){setCorrection(window.TEM8_AUDIO?.currentTime);return}
    if(b.dataset.intensiveSave!==undefined){const input=host().querySelector('#intensive-time-input');if(!setCorrection(parseTime(input.value))){input.focus();input.classList.add('invalid')}else input.classList.remove('invalid');return}
    if(b.dataset.intensiveReset!==undefined&&selected>=0){delete saved.corrections?.[key(selected)];save();rows().forEach((_,i)=>refreshTime(i))}
  })
  window.TEM8_INTENSIVE={open(){if(opening)return;opening=true;render();opening=false},close(){if(raf)cancelAnimationFrame(raf);raf=0;window.TEM8_AUDIO?.stop()}}
})()
