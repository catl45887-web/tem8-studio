/* 拾页 · 冬日主题的小动效：日期、状态行、窗外小雪、卡片跟随鼠标的微光。不改动任何练习功能。 */
(function(){
  var $=function(id){return document.getElementById(id)}
  // 英文日期
  var d=new Date(),days=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'],
      mo=['January','February','March','April','May','June','July','August','September','October','November','December']
  if($('w-date'))$('w-date').textContent=days[d.getDay()]+', '+d.getDate()+' '+mo[d.getMonth()]

  // 状态行跟着统计数字走
  function status(){
    var s=$('w-status');if(!s)return
    var n=parseInt(($('stat-sessions')||{}).textContent,10)||0,m=parseInt(($('stat-mistakes')||{}).textContent,10)||0
    s.innerHTML=(n?'已完成 '+n+' 次练习':'尚未开始练习')+'<i>·</i>待复习 '+m+' 题'
  }
  status()
  ;['stat-sessions','stat-mistakes'].forEach(function(id){var el=$(id);if(el&&window.MutationObserver)new MutationObserver(status).observe(el,{childList:true,characterData:true,subtree:true})})

  // 卡片：鼠标在哪里，哪里就被点亮
  document.addEventListener('pointermove',function(e){
    var c=e.target.closest&&e.target.closest('.category-card');if(!c)return
    var r=c.getBoundingClientRect();c.style.setProperty('--mx',(e.clientX-r.left)+'px');c.style.setProperty('--my',(e.clientY-r.top)+'px')
  },{passive:true})

  // 窗外的小雪：很稀、很慢，只在首页可见时运行
  var cv=document.querySelector('.w-snow');if(!cv||!cv.getContext)return
  if(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches)return
  var x=cv.getContext('2d'),W=0,H=0,f=[],dpr=Math.min(window.devicePixelRatio||1,2),home=$('home-view')
  function size(){W=cv.clientWidth;H=cv.clientHeight;cv.width=W*dpr;cv.height=H*dpr;x.setTransform(dpr,0,0,dpr,0,0)}
  size();addEventListener('resize',size)
  for(var i=0;i<55;i++)f.push({x:Math.random()*1400,y:Math.random()*700,r:Math.random()*1.6+.5,s:Math.random()*.3+.12,w:Math.random()*6.3,a:Math.random()*.45+.15})
  ;(function tick(){
    if(home&&home.classList.contains('active')&&!document.hidden){
      if(!W)size()
      x.clearRect(0,0,W,H)
      for(var i=0;i<f.length;i++){var p=f[i];p.y+=p.s;p.w+=.009;p.x+=Math.sin(p.w)*.22
        if(p.y>H+3){p.y=-3;p.x=Math.random()*W} if(p.x>W)p.x-=W
        x.beginPath();x.arc(p.x,p.y,p.r,0,7);x.fillStyle='rgba(255,243,225,'+p.a+')';x.fill()}
    }
    requestAnimationFrame(tick)
  })()
})();

/* 阅读真题卡片：只留 “Passage N” 与 精读 / 做题 */
(function(){
  var list=document.getElementById('real-article-list');if(!list)return
  function tidy(){
    list.querySelectorAll('.real-article-card').forEach(function(c){
      var h=c.querySelector('h3');if(h&&!h.dataset.w){h.textContent=h.textContent.replace(/^\s*\d{4}\s*[·・]\s*/,'');h.dataset.w=1}
      var p=c.querySelector('.primary-btn');if(p&&!p.dataset.w){p.firstChild.nodeValue='精读';p.dataset.w=1}
      var s=c.querySelector('.secondary-btn');if(s&&!s.dataset.w){s.textContent='做题';s.dataset.w=1}
    })
  }
  tidy();if(window.MutationObserver)new MutationObserver(tidy).observe(list,{childList:true,subtree:true})
})();

/* 点击时散出几颗星星和雪花 */
(function(){
  if(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches)return
  var sel='.primary-btn,.secondary-btn,.w-btn,.submit-btn,.category-card,.mock-card,.real-article-card button,.library-year-nav button,.nav-item,.mobile-nav button'
  var glyph=['✦','✧','❄','✦','·','❅']
  document.addEventListener('click',function(e){
    var t=e.target.closest&&e.target.closest(sel);if(!t)return
    var x=e.clientX,y=e.clientY;if(!x&&!y){var r=t.getBoundingClientRect();x=r.left+r.width/2;y=r.top+r.height/2}
    for(var i=0;i<9;i++){
      var s=document.createElement('span'),a=Math.random()*Math.PI*2,d=26+Math.random()*34,g=glyph[i%glyph.length]
      s.className='w-spark'+(g==='❄'||g==='❅'?' s':'');s.textContent=g
      s.style.fontSize=(8+Math.random()*8)+'px'
      s.style.setProperty('--x0',x+'px');s.style.setProperty('--y0',y+'px')
      s.style.setProperty('--x1',(x+Math.cos(a)*d)+'px');s.style.setProperty('--y1',(y+Math.sin(a)*d+10)+'px')
      s.style.setProperty('--r',(Math.random()*180-90)+'deg')
      document.body.appendChild(s);setTimeout(function(n){n.remove()},950,s)
    }
  },true)
})();

/* 年份：一根有重量的麻绳 + 一只挂着的圣诞袜（简单的物理：弹簧 + 单摆） */
(function(){
  var nav=document.getElementById('library-year-nav');if(!nav)return
  var reduce=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches
  var wrap=document.createElement('div');wrap.className='w-yearwrap'
  nav.parentNode.insertBefore(wrap,nav);wrap.appendChild(nav)
  var cv=document.createElement('canvas');cv.className='w-line';wrap.appendChild(cv)
  var BULBS=[.07,.21,.36,.52,.66,.81,.94].map(function(u,i){var b=document.createElement('i');b.className='w-bulb'+(i%2?' s':'');b.style.animationDelay=(-i*0.47).toFixed(2)+'s';b.style.animationDuration=(2.6+(i*0.37)%1.3).toFixed(2)+'s';wrap.appendChild(b);return {u:u,el:b,dy:(i%3)-1}})
  var ctx=cv.getContext('2d')
  var sock=document.createElement('div');sock.className='w-sock';sock.setAttribute('aria-hidden','true')
  sock.innerHTML='<img src="winter/img/stocking.webp" alt="" draggable="false">'
  wrap.appendChild(sock)

  var W=0,H=0,dpr=Math.min(window.devicePixelRatio||1,2),ROPE_Y=62,BASE_SAG=6,DIP=16,PX=35,PY=5
  function resize(){W=wrap.clientWidth;H=wrap.clientHeight;cv.width=W*dpr;cv.height=H*dpr;cv.style.height=H+'px';ctx.setTransform(dpr,0,0,dpr,0,0)}
  function ropeY(x,ax){
    var t=x/W,y=ROPE_Y+BASE_SAG*4*t*(1-t),span=x<ax?Math.max(40,ax):Math.max(40,W-ax),r=12
    var k=1-(Math.sqrt((x-ax)*(x-ax)+r*r)-r)/span;if(k<0)k=0
    return y+DIP*k
  }
  // 两股麻线拧成的细绳：按深度先画背面、再画正面，形成真实的“捻”
  function draw(ax){
    ctx.clearRect(0,0,W,H)
    BULBS.forEach(function(b){var x=b.u*W;b.el.style.left=x.toFixed(1)+'px';b.el.style.top=(ropeY(x,ax)-2+b.dy).toFixed(1)+'px'})
    var pts=[],x,y
    for(x=-8;x<=W+8;x+=1){pts.push([x,ropeY(x,ax)])}
    // 柔和的投影
    ctx.save();ctx.filter='blur(4px)';ctx.strokeStyle='rgba(0,0,0,.5)';ctx.lineWidth=5;ctx.beginPath()
    pts.forEach(function(p,i){i?ctx.lineTo(p[0],p[1]+7):ctx.moveTo(p[0],p[1]+7)});ctx.stroke();ctx.restore()
    // 底色（股与股之间的暗缝）
    ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle='#4a3826';ctx.lineWidth=5.4;ctx.beginPath()
    pts.forEach(function(p,i){i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1])});ctx.stroke()
    var R=1.45,P=9,len=0
    for(var pass=0;pass<2;pass++){
      for(var s=0;s<2;s++){
        len=0
        for(var i=1;i<pts.length;i++){
          var p0=pts[i-1],p1=pts[i],dx=p1[0]-p0[0],dy=p1[1]-p0[1],l=Math.hypot(dx,dy);len+=l
          var ph=len/P*Math.PI*2+s*Math.PI,depth=Math.sin(ph)
          if(pass===0?depth>0:depth<=0)continue
          var nx=-dy/l,ny=dx/l,o=Math.cos(ph)*R
          var light=pass===0?.35+.25*(1+depth):.55+.45*depth
          var r=Math.round(118+92*light),g=Math.round(92+72*light),b=Math.round(60+48*light)
          ctx.strokeStyle='rgb('+r+','+g+','+b+')';ctx.lineWidth=pass===0?2.4:2.9
          ctx.beginPath();ctx.moveTo(p0[0]+nx*o,p0[1]+ny*o);ctx.lineTo(p1[0]+nx*o,p1[1]+ny*o);ctx.stroke()
        }
      }
    }
    // 顶部一道很淡的受光
    ctx.strokeStyle='rgba(255,236,205,.18)';ctx.lineWidth=1;ctx.beginPath()
    pts.forEach(function(p,i){i?ctx.lineTo(p[0],p[1]-1.8):ctx.moveTo(p[0],p[1]-1.8)});ctx.stroke()
  }

  // 物理状态
  var ax=null,av=0,th=0,tw=0,target=null,held=false,px=0,sleeping=true,raf=0,lastA=0
  function centerOf(b){return Math.round(nav.offsetLeft+b.offsetLeft-nav.scrollLeft+b.offsetWidth/2)}
  function clampX(x){return Math.max(nav.offsetLeft+16,Math.min(nav.offsetLeft+nav.clientWidth-16,x))}
  function updateTarget(){var b=nav.querySelector('button.active');target=b?clampX(centerOf(b)):null;if(ax==null&&target!=null)ax=target}
  function wake(){if(sleeping){sleeping=false;raf=requestAnimationFrame(step)}}
  function step(){
    if(!W)resize()
    var prev=av
    if(held){var nx=ax+(px-ax)*.55;av=nx-ax;ax=nx}
    else if(target!=null){
      if(reduce){ax=target;av=0}
      else{av+=(target-ax)*.055;av*=.78;ax+=av}
    }
    var acc=Math.max(-4,Math.min(4,av-prev))
    // 单摆：水平加速度带动摆角，阻尼慢慢让它停下
    if(!reduce){tw+=-.04*Math.sin(th)-acc*.005;tw*=.92;th+=tw}else{th=0}
    th=Math.max(-.6,Math.min(.6,th))
    var ty=ropeY(ax,ax)
    draw(ax)
    sock.style.transform='translate('+(ax-PX).toFixed(2)+'px,'+(ty-PY).toFixed(2)+'px) rotate('+(th*57.3).toFixed(2)+'deg)'
    var still=!held&&target!=null&&Math.abs(target-ax)<.2&&Math.abs(av)<.05&&Math.abs(th)<.002&&Math.abs(tw)<.002
    if(still){ax=target;th=0;tw=0;draw(ax);sock.style.transform='translate('+(ax-PX)+'px,'+(ropeY(ax,ax)-PY).toFixed(2)+'px)';sleeping=true;return}
    raf=requestAnimationFrame(step)
  }
  function edges(){
    wrap.classList.toggle('w-left',nav.scrollLeft>4)
    wrap.classList.toggle('w-right',nav.scrollLeft<nav.scrollWidth-nav.clientWidth-4)
  }
  var lastYear=null
  function sync(){
    var b=nav.querySelector('button.active'),y=b&&b.textContent.trim(),changed=lastYear!==null&&y!==lastYear;lastYear=y
    if(changed&&b){var r=b.offsetLeft-nav.scrollLeft;if(r<40||r+b.offsetWidth>nav.clientWidth-40)nav.scrollTo({left:b.offsetLeft-nav.clientWidth/2+b.offsetWidth/2,behavior:'smooth'})}
    updateTarget();edges();wake()
  }
  if(window.MutationObserver)new MutationObserver(sync).observe(nav,{childList:true,subtree:true,attributes:true,attributeFilter:['class']})
  nav.addEventListener('scroll',function(){
    // 年份滚动时，袜子跟着年份走（不甩动）
    var old=target;updateTarget();if(old!=null&&target!=null&&!held){ax+=target-old}edges();wake()
  },{passive:true})
  addEventListener('resize',function(){resize();updateTarget();if(target!=null)ax=target;wake()})
  var view=document.getElementById('library-view')
  if(view&&window.MutationObserver)new MutationObserver(function(){if(view.classList.contains('active'))requestAnimationFrame(function(){resize();updateTarget();if(target!=null)ax=target;edges();wake()})}).observe(view,{attributes:true,attributeFilter:['class']})
  setTimeout(function(){resize();sync()},0)

  // 按住袜子拖：沿绳子走，松手选最近的年份；拖到两端自动滚动
  var aim=null,loop=0
  function nearest(x){
    var best=null,bd=1e9
    nav.querySelectorAll('button').forEach(function(b){var c=centerOf(b),d=Math.abs(c-x);if(c<nav.offsetLeft-4||c>nav.offsetLeft+nav.clientWidth+4)return;if(d<bd){bd=d;best=b}})
    return best
  }
  function mark(x){var b=nearest(x);if(b!==aim){if(aim)aim.classList.remove('w-aim');aim=b;if(aim&&!aim.classList.contains('active'))aim.classList.add('w-aim')}}
  function autoscroll(){
    if(!held)return
    var L=nav.offsetLeft,R=L+nav.clientWidth,e=60,sp=0
    if(px<L+e)sp=-(L+e-px)/4;else if(px>R-e)sp=(px-(R-e))/4
    if(sp){nav.scrollLeft+=sp;mark(px)}
    loop=requestAnimationFrame(autoscroll)
  }
  sock.addEventListener('pointerdown',function(e){
    held=true;sock.setPointerCapture(e.pointerId);sock.classList.add('w-held')
    px=clampX(e.clientX-wrap.getBoundingClientRect().left);mark(px);wake();loop=requestAnimationFrame(autoscroll);e.preventDefault()
  })
  sock.addEventListener('pointermove',function(e){if(!held)return;px=clampX(e.clientX-wrap.getBoundingClientRect().left);mark(px)})
  function release(){
    if(!held)return
    held=false;cancelAnimationFrame(loop);sock.classList.remove('w-held')
    var b=nearest(px);if(aim)aim.classList.remove('w-aim');aim=null
    if(b&&!b.classList.contains('active'))b.click();else{updateTarget();wake()}
  }
  sock.addEventListener('pointerup',release);sock.addEventListener('pointercancel',release)

  // 鼠标滚轮上下滚 → 年份左右滑
  nav.addEventListener('wheel',function(e){
    if(nav.scrollWidth<=nav.clientWidth)return
    if(Math.abs(e.deltaY)>Math.abs(e.deltaX)){nav.scrollLeft+=e.deltaY;e.preventDefault()}
  },{passive:false})
  // 按住年份拖动也能滑；拖动过的那一下不算点击
  var down=false,sx0=0,sl=0,moved=false
  nav.addEventListener('pointerdown',function(e){if(e.pointerType!=='mouse')return;down=true;moved=false;sx0=e.clientX;sl=nav.scrollLeft})
  addEventListener('pointermove',function(e){if(!down)return;var d=e.clientX-sx0;if(Math.abs(d)>5){moved=true;nav.classList.add('w-drag')}if(moved)nav.scrollLeft=sl-d})
  addEventListener('pointerup',function(){down=false;nav.classList.remove('w-drag')})
  nav.addEventListener('click',function(e){if(moved){e.stopPropagation();e.preventDefault();moved=false}},true)
})();

/* 整卷模考：一整面书架（画），把每个年份挂到其中一本书上 */
(function(){
  var g=document.getElementById('mock-list');if(!g)return
  // 原图坐标：x0,x1,书顶y,书底y（按从左到右、从上到下的阅读顺序）
  var SLOTS=[
    [41,111,90,297],[150,213,94,297],[279,334,65,297],[721,786,60,297],[963,1024,72,297],[1459,1507,61,297],
    [59,114,373,596],[149,207,391,596],[511,564,413,596],[679,757,407,596],[1119,1198,386,596],[1394,1443,366,596],
    [207,271,657,868],[493,550,657,868],[687,750,669,868],[921,971,667,868],[1430,1481,657,868],
    [286,329,404,596],[1323,1366,677,868],[786,829,79,297],[1026,1087,94,297]
  ]
  var building=false
  function build(){
    var cards=[].slice.call(g.querySelectorAll('.mock-card'));if(!cards.length)return
    building=true
    var sc=document.createElement('div');sc.className='w-wallscroll'
    var wall=document.createElement('div');wall.className='w-wall'
    cards.slice(0,SLOTS.length).forEach(function(c,i){
      var s=SLOTS[i],y=c.dataset.mockYear||''
      c.style.setProperty('--x0',s[0]);c.style.setProperty('--x1',s[1]);c.style.setProperty('--y0',s[2]);c.style.setProperty('--y1',s[3])
      c.setAttribute('aria-label',y+' 年整卷模考')
      var st=c.querySelector('strong');if(st)st.textContent=y
      if(!c.querySelector('.w-book')){var b=document.createElement('i');b.className='w-book';b.setAttribute('aria-hidden','true');c.insertBefore(b,c.firstChild)
        var r=document.createElement('i');r.className='w-string';r.setAttribute('aria-hidden','true');c.appendChild(r)}
      wall.appendChild(c)
    })
    sc.appendChild(wall)
    var hint=document.createElement('p');hint.className='w-wallhint';hint.textContent='← swipe the shelf →'
    g.innerHTML='';g.appendChild(sc);g.appendChild(hint)
    setTimeout(function(){building=false},0)
  }
  build()
  if(window.MutationObserver)new MutationObserver(function(){if(!building&&g.querySelector(':scope > .mock-card'))build()}).observe(g,{childList:true})
})();

/* 全站飘雪：很少、很慢、半透明；切到后台时暂停 */
(function(){
  if(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches)return
  var cv=document.createElement('canvas');cv.className='w-flakes';cv.setAttribute('aria-hidden','true')
  document.body.insertBefore(cv,document.body.firstChild)
  var x=cv.getContext('2d'),W,H,dpr=Math.min(window.devicePixelRatio||1,2),f=[]
  function size(){W=innerWidth;H=innerHeight;cv.width=W*dpr;cv.height=H*dpr;x.setTransform(dpr,0,0,dpr,0,0)}
  size();addEventListener('resize',size)
  var N=W<700?22:42
  for(var i=0;i<N;i++)f.push({x:Math.random()*W,y:Math.random()*H,r:Math.random()*1.5+.6,s:Math.random()*.28+.12,w:Math.random()*6.3,ws:Math.random()*.008+.004,a:Math.random()*.32+.12})
  ;(function t(){
    if(!document.hidden){
      x.clearRect(0,0,W,H)
      for(var i=0;i<f.length;i++){var p=f[i];p.y+=p.s;p.w+=p.ws;p.x+=Math.sin(p.w)*.25
        if(p.y>H+4){p.y=-4;p.x=Math.random()*W}
        var g=x.createRadialGradient(p.x,p.y,0,p.x,p.y,p.r*2.2);g.addColorStop(0,'rgba(255,246,232,'+p.a+')');g.addColorStop(1,'rgba(255,246,232,0)')
        x.fillStyle=g;x.beginPath();x.arc(p.x,p.y,p.r*2.2,0,7);x.fill()}
    }
    requestAnimationFrame(t)
  })()
})();

/* 按题型练习：把题型卡换成文件夹；鼠标悬停时播放动画 */
(function(){
  var grid=document.getElementById('paper-categories');if(!grid)return
  var L={lecture:['听力 · Section A','Mini-lecture'],interview:['听力 · Section B','Interview'],'reading-group':['阅读专项','Reading'],
         language:['改错专项','Proofreading'],translation:['翻译 · 中译英','Translation'],writing:['写作','Writing']}
  var hover=window.matchMedia&&matchMedia('(hover: hover)').matches
  var reduce=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches
  function dress(){
    grid.querySelectorAll('.category-card').forEach(function(c){
      var t=c.dataset.workflowType,l=L[t];if(!l||c.querySelector('.w-folder'))return
      var f=document.createElement('div');f.className='w-folder';f.setAttribute('aria-hidden','true')
      f.innerHTML='<img src="winter/folder/'+t+'.webp" alt="" loading="lazy">'
      var lb=document.createElement('div');lb.className='w-flabel';lb.innerHTML='<b>'+l[0]+'</b><i>'+l[1]+'</i>'
      c.appendChild(f);c.appendChild(lb);c.setAttribute('aria-label',l[0]+' '+l[1])
      if(!hover||reduce)return
      // 视频第一帧与静态图完全一致：视频真正开始播放的那一刻再瞬间切换，避免两层叠在一起产生重影
      var v
      c.addEventListener('mouseenter',function(){
        if(!v){
          v=document.createElement('video');v.muted=true;v.loop=true;v.playsInline=true;v.preload='auto';v.src='winter/folder/'+t+'.mp4'
          v.addEventListener('playing',function(){f.classList.add('w-vid')})
          f.appendChild(v)
        }
        var p=v.play();if(p&&p.catch)p.catch(function(){})
      })
      c.addEventListener('mouseleave',function(){if(v)v.pause()})   // 停在当前这一帧，不切回静态图
    })
  }
  dress();if(window.MutationObserver)new MutationObserver(dress).observe(grid,{childList:true})
})();

/* =====================================================================
   沉浸式首页：侧栏收起 / 视差景深 / 窗景视频 / 法式台灯 / 风雪声
   ===================================================================== */
(function(){
  var home=document.getElementById('home-view');if(!home||!home.querySelector('.w-stage'))return
  var body=document.body,side=document.querySelector('.sidebar'),edge=document.querySelector('.w-edge'),stage=home.querySelector('.w-stage')
  var reduce=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches
  var hover=window.matchMedia&&matchMedia('(hover: hover)').matches
  function sync(){var on=home.classList.contains('active');if(on!==body.classList.contains('w-home')&&side)side.classList.remove('w-open');body.classList.toggle('w-home',on)}
  sync();if(window.MutationObserver)new MutationObserver(sync).observe(home,{attributes:true,attributeFilter:['class']})
  if(edge&&side){
    edge.addEventListener('mouseenter',function(){if(body.classList.contains('w-home'))side.classList.add('w-open')})
    edge.addEventListener('click',function(){side.classList.add('w-open')})
    document.addEventListener('mousemove',function(e){if(side.classList.contains('w-open')&&e.clientX>side.offsetWidth+40)side.classList.remove('w-open')},{passive:true})
  }

  // 视差：窗外的景比书房移动得多一点，形成景深
  var view=home.querySelector('.w-view'),room=home.querySelector('.w-room')
  if(view&&room&&hover&&!reduce){
    home.addEventListener('mousemove',function(e){
      var x=(e.clientX/innerWidth-.5),y=(e.clientY/innerHeight-.5)
      view.style.transform='translate('+(-x*26).toFixed(1)+'px,'+(-y*14).toFixed(1)+'px)'
      room.style.transform='translate('+(-x*8).toFixed(1)+'px,'+(-y*5).toFixed(1)+'px)'
    })
  }
  // 法式台灯：点一下拉灯绳开/关，记住上次的状态
  var lamp=home.querySelector('.w-lamp');if(lamp){
    var KEY='tem8_lamp',on=true;try{on=localStorage.getItem(KEY)!=='off'}catch(e){}
    function paint(){lamp.classList.toggle('w-on',on);stage.classList.toggle('w-lamp-off',!on);lamp.setAttribute('aria-pressed',on);lamp.dataset.tip=on?'拉一下灯绳 · 关灯':'拉一下灯绳 · 开灯'}
    paint()
    lamp.addEventListener('click',function(){
      lamp.classList.remove('w-pull');void lamp.offsetWidth;lamp.classList.add('w-pull')
      setTimeout(function(){on=!on;try{localStorage.setItem(KEY,on?'on':'off')}catch(e){};paint();click()},180)
      setTimeout(function(){lamp.classList.remove('w-pull')},460)
    })
    function click(){try{var C=window.AudioContext||window.webkitAudioContext;if(!C)return;var a=click.ac||(click.ac=new C()),n=a.createBufferSource(),b=a.createBuffer(1,a.sampleRate*.04,a.sampleRate),d=b.getChannelData(0);for(var i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/d.length,6);n.buffer=b;var g=a.createGain();g.gain.value=.25;var f=a.createBiquadFilter();f.type='highpass';f.frequency.value=1800;n.connect(f).connect(g).connect(a.destination);n.start()}catch(e){}}
  }

  // 风雪声：浏览器合成的低沉风声，默认关闭
  var btn=home.querySelector('.w-sound'),ac=null,gain=null
  if(btn)btn.addEventListener('click',function(){
    var on=btn.getAttribute('aria-pressed')!=='true'
    btn.setAttribute('aria-pressed',on)
    if(on){
      if(!ac){
        var C=window.AudioContext||window.webkitAudioContext;if(!C)return
        ac=new C();var len=ac.sampleRate*4,buf=ac.createBuffer(1,len,ac.sampleRate),d=buf.getChannelData(0),last=0
        for(var i=0;i<len;i++){var w=Math.random()*2-1;last=(last+.02*w)/1.02;d[i]=last*3.2}
        var src=ac.createBufferSource();src.buffer=buf;src.loop=true
        var lp=ac.createBiquadFilter();lp.type='lowpass';lp.frequency.value=520;lp.Q.value=.6
        var lfo=ac.createOscillator(),lg=ac.createGain();lfo.frequency.value=.07;lg.gain.value=260;lfo.connect(lg).connect(lp.frequency);lfo.start()
        gain=ac.createGain();gain.gain.value=0
        src.connect(lp).connect(gain).connect(ac.destination);src.start()
      }
      ac.resume();gain.gain.setTargetAtTime(.32,ac.currentTime,.8)
    }else if(gain){gain.gain.setTargetAtTime(0,ac.currentTime,.5)}
  })
})();
