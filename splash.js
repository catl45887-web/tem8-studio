/* 拾页 · 水波开屏（浅色 / 深色主题；每天第一次打开时出现）
   浅水池底的波光、水面碎光、手指划出的水波；文字"躺"在水底。
   轻触进入，划动只起水波。以下情况不出现：圣诞主题、今天已经看过、
   在外观设置里关掉了、系统开了"减少动态效果"、设备不支持 WebGL。 */
(function () {
  var root = document.documentElement
  function get(k, d) { try { var v = localStorage.getItem(k); return v == null ? d : v } catch (e) { return d } }
  function set(k, v) { try { localStorage.setItem(k, v) } catch (e) {} }
  var now = new Date()
  var dayKey = now.getFullYear() + '-' + (now.getMonth() + 1) + '-' + now.getDate()
  var theme = root.dataset.theme
  if (theme !== 'light' && theme !== 'dark') return
  if (get('tem8_splash', 'on') === 'off' || get('tem8_splash_day', '') === dayKey) return
  if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return
  var test = document.createElement('canvas')
  if (!(test.getContext('webgl'))) return

  function runSplash(cv, opt) {
    const W = opt.w, H = opt.h;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const dark = !!opt.dark;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    const F = opt.fonts;
    const P = dark ? {
      floorTop: [0.06, 0.13, 0.18], floorBot: [0.03, 0.07, 0.11], water: [0.10, 0.30, 0.36],
      caus: [0.55, 0.85, 0.90], spark: [0.92, 0.97, 1.0], causK: 0.42,
      title: 'rgba(238,232,218,0.95)', ink: 'rgba(232,228,216,0.88)', small: 'rgba(232,228,216,0.66)'
    } : {
      floorTop: [0.90, 0.89, 0.85], floorBot: [0.80, 0.83, 0.80], water: [0.62, 0.80, 0.80],
      caus: [1.0, 0.99, 0.95], spark: [1.0, 1.0, 1.0], causK: 0.24,
      title: 'rgba(96,46,36,0.92)', ink: 'rgba(50,40,32,0.88)', small: 'rgba(50,40,32,0.68)'
    };

    // ---- 文字层（透明底）：之前的四样排版 ----
    const tc = document.createElement('canvas'); tc.width = cv.width; tc.height = cv.height;
    const g = tc.getContext('2d');
    const colW = Math.min(W, 460), ox = (W - colW) / 2, sx = colW / 390, sy = H / 844, k = Math.min(sx, sy * 1.08);
    const X = (x) => ox + x * sx, Y = (y) => y * sy, S = (n) => Math.round(n * k);
    const items = [{ t: opt.date, f: '400 ' + S(11) + 'px ' + F.sans, x: X(30), y: Math.max(Y(74), 54), c: P.small, ls: 4 }];
    g.font = 'italic 400 ' + S(22) + 'px ' + F.serif;
    const maxLine = colW * 0.8, lines = [];
    (opt.sentence || '').split(' ').forEach((w) => {
      const cur = lines.length ? lines[lines.length - 1] : null;
      if (cur !== null && g.measureText(cur + ' ' + w).width <= maxLine) lines[lines.length - 1] = cur + ' ' + w; else lines.push(w);
    });
    lines.slice(0, 4).forEach((t, i) => items.push({ t, f: 'italic 400 ' + S(22) + 'px ' + F.serif, x: X(34 + (i % 2) * 26), y: Y(236) + i * S(30), c: P.ink }));
    items.push({ t: '拾页', f: F.word.replace('112px', S(112) + 'px'), x: W / 2 + S(9), y: Y(488), c: P.title, ls: S(F.wordLs || 0), al: 'center' });
    items.push({ t: '拾起书页，也拾起自己。', f: '400 ' + S(12) + 'px ' + F.sans, x: W / 2 + 2, y: H - Math.max(Y(72), 64), c: P.small, ls: 4, al: 'center' });
    const STEP = 420, FADE = 1000;
    const paintText = (t) => {
      g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, tc.width, tc.height);
      g.setTransform(dpr, 0, 0, dpr, 0, 0); g.textBaseline = 'alphabetic';
      items.forEach((it, i) => {
        const a = Math.max(0, Math.min(1, (t - i * STEP) / FADE)); if (a <= 0) return;
        g.globalAlpha = a; g.font = it.f; g.fillStyle = it.c; g.textAlign = it.al || 'left';
        if ('letterSpacing' in g) g.letterSpacing = (it.ls || 0) + 'px';
        g.fillText(it.t, it.x, it.y + 6 * (1 - a));
      });
      g.globalAlpha = 1; if ('letterSpacing' in g) g.letterSpacing = '0px';
    };
    const INTRO = STEP * items.length + FADE;

    const gl = opt.reduce ? null : cv.getContext('webgl', { antialias: false, premultipliedAlpha: false, preserveDrawingBuffer: false });
    if (!gl) return null;

    const vs = 'attribute vec2 p;varying vec2 v;void main(){v=vec2(p.x*.5+.5,.5-p.y*.5);gl_Position=vec4(p,0.,1.);}';
    const fs = `
  precision highp float;
  varying vec2 v;
  uniform sampler2D uTxt; uniform sampler2D uH;
  uniform vec2 uTx; uniform float uT; uniform float uAsp; uniform float uScale;
  uniform vec3 floorTop; uniform vec3 floorBot; uniform vec3 water; uniform vec3 caus; uniform vec3 spark; uniform float causK; uniform float uDark;
  #define TAU 6.28318530718
  float caustic(vec2 uv, float time){
    vec2 p=mod(uv*TAU,TAU)-250.0; vec2 i=p; float c=1.0; float inten=.005;
    for(int n=0;n<5;n++){
      float t=time*(1.0-(3.5/float(n+1)));
      i=p+vec2(cos(t-i.x)+sin(t+i.y),sin(t-i.y)+cos(t+i.x));
      c+=1.0/length(vec2(p.x/(sin(i.x+t)/inten),p.y/(cos(i.y+t)/inten)));
    }
    c/=5.0; c=1.17-pow(c,1.4); return pow(abs(c),8.0);
  }
  float hash(vec2 p){p=fract(p*vec2(443.897,441.423));p+=dot(p,p.yx+19.19);return fract((p.x+p.y)*p.x);}
  vec2 surf(vec2 p,float t){
    vec2 gs=vec2(0.);
    float a=.9,f=34.,sp=1.7;
    for(int k=0;k<7;k++){
      float an=float(k)*2.39996+.4;
      vec2 d=vec2(cos(an),sin(an));
      gs+=d*cos(dot(p,d)*f+t*sp+float(k)*1.7)*a;
      a*=.78; f*=1.27; sp*=1.12;
    }
    return gs;
  }
  void main(){
    vec2 p=vec2(v.x,v.y*uAsp)*uScale;
    float l=texture2D(uH,v-vec2(uTx.x,0.)).r,r=texture2D(uH,v+vec2(uTx.x,0.)).r;
    float u=texture2D(uH,v-vec2(0.,uTx.y)).r,d=texture2D(uH,v+vec2(0.,uTx.y)).r;
    vec2 rg=vec2(r-l,d-u);
    vec2 sg=surf(p,uT)*.03+rg*1.6;
    vec3 n=normalize(vec3(-sg*1.4,1.));
    vec2 fuv=v+n.xy*.012+rg*.03;
    vec3 floorC=mix(floorTop,floorBot,smoothstep(0.,1.,fuv.y));
    vec3 col=mix(floorC,floorC*water*1.35,uDark>.5?.55:.28);
    vec4 t=texture2D(uTxt,fuv);
    col=mix(col,t.rgb/max(t.a,.001),t.a*.92);
    vec2 cuv=vec2(fuv.x,fuv.y*uAsp)*1.25*uScale;
    float c1=caustic(cuv+n.xy*.06,uT*.42);
    float c2=caustic(cuv*1.37+vec2(.31,.17),uT*.33+4.);
    float cs=min(c1*.65+c2*.45,1.6);
    col+=caus*cs*causK;
    vec3 L=normalize(vec3(.07,-.16,1.));
    float sp=max(dot(reflect(-L,n),vec3(0.,0.,1.)),0.);
    col+=spark*(pow(sp,1400.)*2.2+pow(sp,260.)*.18);
    vec3 rn=normalize(vec3(-rg*7.,1.));
    col+=spark*pow(max(dot(reflect(-L,rn),vec3(0.,0.,1.)),0.),300.)*1.1;
    col-=vec3(.06)*clamp(length(rg)*6.,0.,1.);
    vec2 q2=v-.5; col*=1.-dot(q2,q2)*(uDark>.5?.6:.25);
    gl_FragColor=vec4(col,1.);
  }`;
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(s)); return s; };
    const prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(prog); gl.useProgram(prog);
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const U = (n) => gl.getUniformLocation(prog, n);
    const tex = (unit) => { const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
      [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER].forEach(k => gl.texParameteri(gl.TEXTURE_2D, k, gl.LINEAR));
      [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T].forEach(k => gl.texParameteri(gl.TEXTURE_2D, k, gl.CLAMP_TO_EDGE)); return t; };
    const tTxt = tex(0), tH = tex(1);
    gl.uniform1i(U('uTxt'), 0); gl.uniform1i(U('uH'), 1);
    gl.uniform1f(U('uAsp'), H / W); gl.uniform1f(U('uScale'), Math.max(1, W / 390)); gl.uniform1f(U('uDark'), dark ? 1 : 0);
    ['floorTop', 'floorBot', 'water', 'caus', 'spark'].forEach(k => gl.uniform3fv(U(k), P[k]));
    gl.uniform1f(U('causK'), P.causK);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    const upTxt = () => { gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tTxt); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, tc); };

    const gw = W > H ? 240 : 160, gh = Math.max(40, Math.round(gw * H / W));
    gl.uniform2f(U('uTx'), 1 / gw, 1 / gh);
    let cur = new Float32Array(gw * gh), prev = new Float32Array(gw * gh);
    const bytes = new Uint8Array(gw * gh);
    const step = () => {
      for (let y = 1; y < gh - 1; y++) for (let x = 1; x < gw - 1; x++) {
        const i = y * gw + x;
        prev[i] = ((cur[i - 1] + cur[i + 1] + cur[i - gw] + cur[i + gw]) * 0.5 - prev[i]) * 0.988;
      }
      const t = cur; cur = prev; prev = t;
    };
    const upH = () => { for (let i = 0; i < bytes.length; i++) { const v = 128 + cur[i] * 70; bytes[i] = v < 0 ? 0 : v > 255 ? 255 : v; }
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, tH);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, gw, gh, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, bytes); };
    const drop = (px, py, amt, rad) => {
      const cx = px / W * gw, cy = py / H * gh, r = rad || 3;
      for (let y = Math.max(1, Math.floor(cy - r)); y <= Math.min(gh - 2, Math.ceil(cy + r)); y++)
        for (let x = Math.max(1, Math.floor(cx - r)); x <= Math.min(gw - 2, Math.ceil(cx + r)); x++) {
          const d = Math.hypot(x - cx, y - cy); if (d < r) cur[y * gw + x] += amt * 0.5 * (1 + Math.cos(Math.PI * d / r));
        }
    };

    let last = null, downAt = 0, downP = null;
    const pos = (e) => { const b = cv.getBoundingClientRect(); return [(e.clientX - b.left) / b.width * W, (e.clientY - b.top) / b.height * H]; };
    const onDown = (e) => { const p = pos(e); drop(p[0], p[1], 1.8, 3.5); last = p; downAt = performance.now(); downP = p;
      if (cv.setPointerCapture) try { cv.setPointerCapture(e.pointerId); } catch (x) {} };
    const onMove = (e) => { const p = pos(e), pressed = e.buttons || e.pointerType === 'touch', amt = pressed ? 0.32 : 0.12;
      if (last) { const dx = p[0] - last[0], dy = p[1] - last[1], n = Math.min(16, Math.ceil(Math.hypot(dx, dy) / 4));
        for (let k = 1; k <= n; k++) drop(last[0] + dx * k / n, last[1] + dy * k / n, amt / n * 2.4, 1.7); } else drop(p[0], p[1], amt, 1.7);
      last = p; };
    const onUp = (e) => { last = null; if (downP && opt.onTap) { const p = pos(e);
        if (Math.hypot(p[0] - downP[0], p[1] - downP[1]) < 10 && performance.now() - downAt < 300) opt.onTap(); } downP = null; };
    const onLeave = () => { last = null; };
    cv.addEventListener('pointerdown', onDown); cv.addEventListener('pointermove', onMove);
    cv.addEventListener('pointerup', onUp); cv.addEventListener('pointerleave', onLeave);

    let raf = 0, t0 = null, intro = true, first = false, dead = false, nextRain = 3500;
    paintText(0); upTxt();
    Promise.race([opt.fontsReady || Promise.resolve(), new Promise(r => setTimeout(r, 1800))]).then(() => { if (!dead) t0 = performance.now(); });
    const frame = (now) => {
      if (dead) return; raf = requestAnimationFrame(frame);
      if (document.hidden) return;
      const t = t0 === null ? 0 : now - t0;
      if (t0 !== null) {
        if (intro) { paintText(t); upTxt(); if (t > INTRO) intro = false; }
        if (!first && t > 2300) { first = true; drop(W / 2 + 6, Y(452), 1.8, 3.5); }
        if (t > nextRain) { drop(50 + Math.random() * (W - 100), H * 0.14 + Math.random() * H * 0.7, 0.9, 2.2); nextRain = t + 3000 + Math.random() * 3000; }
      }
      step(); step(); upH();
      gl.viewport(0, 0, cv.width, cv.height);
      gl.uniform1f(U('uT'), (opt.time0 || 0) + now / 1000);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };
    raf = requestAnimationFrame(frame);
    return {
      drop, stop: () => { dead = true; cancelAnimationFrame(raf);
        cv.removeEventListener('pointerdown', onDown); cv.removeEventListener('pointermove', onMove);
        cv.removeEventListener('pointerup', onUp); cv.removeEventListener('pointerleave', onLeave); }
    };
  }


  // ---------- 今天的那句话 ----------
  var CN = ['〇', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十']
  function cnNum(n) { return n <= 10 ? CN[n] : (n < 20 ? '十' + CN[n - 10] : CN[Math.floor(n / 10)] + '十' + (n % 10 ? CN[n % 10] : '')) }
  var date = cnNum(now.getMonth() + 1) + '月' + cnNum(now.getDate()) + '日'
  var pick = window.TEM8_TODAY && window.TEM8_TODAY.pick()
  var sentence = pick ? window.TEM8_TODAY.opening(pick, 70) : 'Read slowly, and the page will open.'

  // ---------- 盖在页面上的一层 ----------
  set('tem8_splash_day', dayKey)
  var dark = theme === 'dark'
  var wrap = document.createElement('div')
  wrap.id = 't-splash'
  wrap.setAttribute('role', 'dialog')
  wrap.setAttribute('aria-label', '拾页 · 今日开屏')
  wrap.style.cssText = 'position:fixed;inset:0;z-index:9999;background:' + (dark ? '#0b1720' : '#dfe7e3') + ';transition:opacity .5s ease;touch-action:none'
  var cv = document.createElement('canvas')
  cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block'
  cv.setAttribute('role', 'img')
  cv.setAttribute('aria-label', '拾页。' + sentence + ' 拾起书页，也拾起自己。')
  var btn = document.createElement('button')
  btn.type = 'button'
  btn.className = 't-splash-enter'
  btn.setAttribute('aria-label', '进入拾页')
  btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 14l6-6 6 6"/></svg>'
  btn.style.color = dark ? 'rgba(236,226,208,.85)' : 'rgba(50,40,32,.75)'
  wrap.appendChild(cv); wrap.appendChild(btn)
  document.body.appendChild(wrap)
  var prevOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'

  var run = null, gone = false
  function leave() {
    if (gone) return; gone = true
    wrap.style.opacity = '0'
    setTimeout(function () { if (run) run.stop(); wrap.remove(); document.body.style.overflow = prevOverflow }, 520)
  }
  btn.addEventListener('click', leave)
  wrap.addEventListener('keydown', function (e) { if (e.key === 'Escape' || e.key === 'Enter') { e.preventDefault(); leave() } })

  var SERIF = '"TS Italic", Georgia, "Times New Roman", serif'
  var fontsReady = (document.fonts && document.fonts.load)
    ? Promise.all([document.fonts.load('italic 400 22px "TS Italic"')]).catch(function () {})
    : Promise.resolve()
  run = runSplash(cv, {
    w: window.innerWidth, h: window.innerHeight, dark: dark, date: date, sentence: sentence,
    fonts: { serif: SERIF, sans: '-apple-system, "PingFang SC", "Noto Sans SC", sans-serif',
             word: '300 112px "Songti SC", "STSong", "Noto Serif SC", "Source Han Serif SC", "SimSun", serif', wordLs: 18 },
    fontsReady: fontsReady,
    onTap: function () { setTimeout(leave, 420) }
  })
  if (!run) { leave(); return }
  window.addEventListener('resize', function () { if (!gone && Math.abs(window.innerWidth - cv.width / Math.min(window.devicePixelRatio || 1, 2)) > 80) leave() })
})();
