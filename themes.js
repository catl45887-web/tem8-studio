/* 拾页 · 主题切换与外观设置
   - 主题：xmas（圣诞）/ dark（深色）/ light（浅色）；可跟随系统
   - 页面一打开就由 index.html 头部的小脚本先套上主题（不闪屏），这里负责设置页和切换
   - 偏好存在 localStorage：tem8_theme、tem8_theme_follow、tem8_font_scale、tem8_snow */
(function(){
  var root=document.documentElement
  var THEMES={xmas:'圣诞主题',dark:'深色主题',light:'浅色主题'}
  var META={xmas:'#2b1e17',dark:'#1c1b19',light:'#f0f7f6'}
  // 浅色、深色各四套配色；每种各记一份（tem8_palette_light / tem8_palette_dark），跟随系统时白天夜里各用各的
  var PAL={light:{fog:'#f0f7f6',mint:'#eef4ec',cream:'#f7efe3',winter:'#f1eff4'},dark:{ink:'#1c1b19',graphite:'#1f272b',navy:'#151c20',coffee:'#1d160f'}}
  var PAL_DEFAULT={light:'fog',dark:'ink'}
  function palette(t){if(!PAL[t])return '';var p=get('tem8_palette_'+t,PAL_DEFAULT[t]);return PAL[t][p]?p:PAL_DEFAULT[t]}
  function applyPalette(){
    var t=root.dataset.theme,p=palette(t)
    if(!p||p===PAL_DEFAULT[t])delete root.dataset.palette;else root.dataset.palette=p
    var m=document.querySelector('meta[name=theme-color]');if(m)m.content=p?PAL[t][p]:META[t]
  }
  var SCALES=[[0.9,'小'],[1,'标准'],[1.12,'大'],[1.25,'特大']]
  var sysDark=window.matchMedia?matchMedia('(prefers-color-scheme: dark)'):null
  function $(id){return document.getElementById(id)}
  function get(k,d){try{var v=localStorage.getItem(k);return v==null?d:v}catch(e){return d}}
  function set(k,v){try{localStorage.setItem(k,v)}catch(e){}}

  function chosen(){var t=get('tem8_theme','xmas');return THEMES[t]?t:'xmas'}
  function following(){return get('tem8_theme_follow','0')==='1'}
  function effective(){return following()?(sysDark&&sysDark.matches?'dark':'light'):chosen()}

  function apply(animate){
    var t=effective()
    if(root.dataset.theme===t)return syncUI()
    if(animate){root.classList.add('t-switching');setTimeout(function(){root.classList.remove('t-switching')},360)}
    root.dataset.theme=t
    ;['css-winter-base','css-winter'].forEach(function(id){var l=$(id);if(l)l.disabled=t!=='xmas'})
    applyPalette()
    if(t!=='xmas')stopSound()
    document.dispatchEvent(new CustomEvent('tem8:theme',{detail:t}))
    syncUI()
  }

  // ---------- 风雪声：离开首页、切到后台、换主题时自动停 ----------
  function soundBtn(){return document.querySelector('.w-sound')}
  function soundOn(){var b=soundBtn();return !!b&&b.getAttribute('aria-pressed')==='true'}
  function stopSound(){if(soundOn())soundBtn().click()}
  document.addEventListener('visibilitychange',function(){if(document.hidden)stopSound()})
  document.addEventListener('tem8:view',function(e){if(e.detail!=='home')stopSound();if(e.detail==='settings')syncUI()})

  // ---------- 飘雪开关 ----------
  function applySnow(){root.classList.toggle('t-no-snow',get('tem8_snow','on')==='off')}
  applySnow()

  // ---------- 字号 ----------
  function applyScale(){root.style.setProperty('--fs',parseFloat(get('tem8_font_scale','1'))||1)}
  applyScale()

  // ---------- 设置页与顶栏弹层的状态同步 ----------
  function syncUI(){
    var t=effective(),c=chosen(),f=following()
    var follow=$('t-follow');if(follow)follow.checked=f
    var group=$('t-theme-group');if(group)group.classList.toggle('t-locked',f)
    document.querySelectorAll('input[name=t-theme]').forEach(function(r){r.checked=r.value===(f?t:c);r.disabled=f})
    document.querySelectorAll('[data-theme-pick]').forEach(function(b){b.setAttribute('aria-checked',String(b.dataset.themePick===t))})
    var note=$('t-pop-note');if(note)note.hidden=!f
    // 选中哪种，就展开哪组色块，另一组收起；跟随系统时两组都展开
    ;['light','dark'].forEach(function(k){var el=$('t-pal-'+k);if(el)el.hidden=f?false:(c!==k)})
    document.querySelectorAll('[data-palette-pick]').forEach(function(b){b.setAttribute('aria-checked',String(b.dataset.palettePick===palette(b.dataset.paletteTheme)))})
    var s=String(parseFloat(get('tem8_font_scale','1'))||1)
    document.querySelectorAll('[data-font-scale]').forEach(function(b){b.setAttribute('aria-checked',String(b.dataset.fontScale===s))})
    var snow=$('t-snow');if(snow)snow.checked=get('tem8_snow','on')!=='off'
    var snd=$('t-sound');if(snd)snd.checked=soundOn()
    var sp=$('t-splash-toggle');if(sp)sp.checked=get('tem8_splash','on')!=='off'
  }

  function pick(t){set('tem8_theme',t);set('tem8_theme_follow','0');apply(true)}

  document.addEventListener('change',function(e){
    var el=e.target
    if(el.name==='t-theme'&&el.checked)pick(el.value)
    else if(el.id==='t-follow'){set('tem8_theme_follow',el.checked?'1':'0');apply(true)}
    else if(el.id==='t-snow'){set('tem8_snow',el.checked?'on':'off');applySnow()}
    else if(el.id==='t-splash-toggle'){set('tem8_splash',el.checked?'on':'off')}
    else if(el.id==='t-sound'){var b=soundBtn();if(b&&el.checked!==soundOn())b.click();syncUI()}
  })

  // 顶栏按钮：点开三套主题的快捷选择
  var quick=$('t-quick'),pop=$('t-pop')
  function closePop(){if(pop&&!pop.hidden){pop.hidden=true;quick.setAttribute('aria-expanded','false')}}
  // 选配色：存下来，并切到浅色主题
  document.addEventListener('click',function(e){
    var b=e.target.closest&&e.target.closest('[data-palette-pick]');if(!b)return
    var t=b.dataset.paletteTheme
    set('tem8_palette_'+t,b.dataset.palettePick)
    if(!following())set('tem8_theme',t)
    apply(true);applyPalette();syncUI()
  })
  applyPalette()
  document.addEventListener('click',function(e){
    var b=e.target.closest&&e.target.closest('[data-theme-pick],[data-font-scale],#t-quick')
    if(!b){if(pop&&!pop.hidden&&!e.target.closest('#t-pop'))closePop();return}
    if(b.id==='t-quick'){var open=pop.hidden;pop.hidden=!open;quick.setAttribute('aria-expanded',String(open));syncUI();return}
    if(b.dataset.themePick){pick(b.dataset.themePick);closePop();return}
    if(b.dataset.fontScale){set('tem8_font_scale',b.dataset.fontScale);applyScale();syncUI()}
  })
  document.addEventListener('keydown',function(e){if(e.key==='Escape')closePop()})
  document.addEventListener('click',function(e){if(e.target.closest&&e.target.closest('#t-pop [data-view]'))closePop()},true)

  // 跟随系统：系统切换深浅色时立即跟着变
  if(sysDark){var onSys=function(){if(following())apply(true)};sysDark.addEventListener?sysDark.addEventListener('change',onSys):sysDark.addListener(onSys)}

  // ---------- 浅色 / 深色首页：日期与学习统计 ----------
  var W=['星期日','星期一','星期二','星期三','星期四','星期五','星期六']
  var d=new Date(),dt=$('t-date');if(dt)dt.textContent=(d.getMonth()+1)+' 月 '+d.getDate()+' 日 · '+W[d.getDay()]
  function stats(){
    var map={'t-sessions':'stat-sessions','t-mistakes':'stat-mistakes','t-acc':'stat-accuracy'}
    Object.keys(map).forEach(function(k){var a=$(k),b=$(map[k]);if(a&&b)a.textContent=b.textContent})
  }
  stats()
  ;['stat-sessions','stat-mistakes','stat-accuracy'].forEach(function(id){var el=$(id);if(el&&window.MutationObserver)new MutationObserver(stats).observe(el,{childList:true,characterData:true,subtree:true})})

  // ---------- 手机底栏：给浅色 / 深色主题加线条图标（圣诞主题由 CSS 隐藏） ----------
  var ICONS = {
    home: 'M4 10.5 12 4l8 6.5V20H4z',
    library: 'M4 4.5h6a2 2 0 0 1 2 2V20a1.5 1.5 0 0 0-1.5-1.5H4zM20 4.5h-6a2 2 0 0 0-2 2V20a1.5 1.5 0 0 1 1.5-1.5H20z',
    papers: 'M14 4l6 6L9 21H3v-6zM12 6l6 6',
    intensive: 'M4 15v-3a8 8 0 0 1 16 0v3M4 15h3v5H4zM17 15h3v5h-3z',
    bookmarks: 'M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.8z',
    mistakes: 'M4 12a8 8 0 1 0 2.4-5.7L4 8.5M4 4v4.5h4.5',
    my: 'M12 12.5a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20.5a7.5 7.5 0 0 1 15 0'
  }
  document.querySelectorAll('.mobile-nav button[data-view]').forEach(function(b){
    var d=ICONS[b.dataset.view];if(!d||b.querySelector('.t-ico'))return
    var ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg'),p=document.createElementNS(ns,'path')
    svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('class','t-ico');svg.setAttribute('aria-hidden','true');p.setAttribute('d',d)
    svg.appendChild(p);b.insertBefore(svg,b.firstChild)
  })

  // 头部脚本已套好主题；这里补上开关的初始状态
  apply(false);syncUI()
  window.TEM8_THEME={apply:apply,effective:effective}
})();
