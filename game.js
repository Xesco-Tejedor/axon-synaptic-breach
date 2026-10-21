'use strict';
/* ============================================================
   AXON: SYNAPTIC BREACH
   Plataformas 2.5D de precision y accion. Obra de ficcion.
   Volt, un pulso bioelectrico consciente, recorre cinco
   entornos fantasticos inspirados en un circuito neural.
   Personajes, graficos y musica son originales.
   ============================================================ */

// ---------- Canvas ----------
var CV = document.getElementById('game');
var CX = CV.getContext('2d');
var W = 960, H = 540;

function fitCanvas(){
  var s = Math.min(window.innerWidth / W, window.innerHeight / H);
  CV.style.width = Math.floor(W * s) + 'px';
  CV.style.height = Math.floor(H * s) + 'px';
}
window.addEventListener('resize', fitCanvas);
fitCanvas();

// ---------- Utilidades ----------
function clamp(v,a,b){ return v<a?a:(v>b?b:v); }
function lerp(a,b,t){ return a+(b-a)*t; }
function rnd(a,b){ return a + Math.random()*(b-a); }
function irnd(a,b){ return Math.floor(rnd(a,b+1)); }
function overlap(a,b){
  return a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y;
}
function rect(x,y,w,h){ return {x:x,y:y,w:w,h:h}; }
function dist(ax,ay,bx,by){ var dx=ax-bx, dy=ay-by; return Math.sqrt(dx*dx+dy*dy); }

// ---------- Entrada (teclado + tactil) ----------
var IN = {
  left:false, right:false, jump:false, action:false, sprint:false,
  jbuf:0, abuf:0, jumpHeld:false
};
var KEYMAP = {
  ArrowLeft:'left', KeyA:'left',
  ArrowRight:'right', KeyD:'right',
  ArrowUp:'jump', KeyW:'jump', Space:'jump', KeyZ:'jump',
  KeyX:'action', KeyJ:'action', KeyK:'action',
  ShiftLeft:'sprint', ShiftRight:'sprint'
};
window.addEventListener('keydown', function(e){
  if (e.repeat) { if (KEYMAP[e.code]) e.preventDefault(); return; }
  var k = KEYMAP[e.code];
  if (k) {
    IN[k] = true;
    if (k==='jump'){ IN.jbuf = 0.12; IN.jumpHeld = true; }
    if (k==='action'){ IN.abuf = 0.12; }
    e.preventDefault();
  }
  if (e.code==='KeyP' || e.code==='Escape') { pausePressed = true; e.preventDefault(); }
  menuKey(e.code);
});
window.addEventListener('keyup', function(e){
  var k = KEYMAP[e.code];
  if (k) {
    IN[k] = false;
    if (k==='jump') IN.jumpHeld = false;
  }
});
var pausePressed = false;

function bindTouch(id, name){
  var el = document.getElementById(id);
  function on(e){ e.preventDefault(); el.classList.add('press');
    IN[name]=true; if(name==='jump'){IN.jbuf=0.12;IN.jumpHeld=true;} if(name==='action'){IN.abuf=0.12;} }
  function off(e){ e.preventDefault(); el.classList.remove('press');
    IN[name]=false; if(name==='jump') IN.jumpHeld=false; }
  el.addEventListener('touchstart', on, {passive:false});
  el.addEventListener('touchend', off, {passive:false});
  el.addEventListener('touchcancel', off, {passive:false});
  el.addEventListener('mousedown', on);
  el.addEventListener('mouseup', off);
  el.addEventListener('mouseleave', off);
}
bindTouch('tLeft','left'); bindTouch('tRight','right');
bindTouch('tJump','jump'); bindTouch('tAction','action'); bindTouch('tSprint','sprint');
document.getElementById('tPause').addEventListener('touchstart', function(e){ e.preventDefault(); pausePressed=true; }, {passive:false});
document.getElementById('tPause').addEventListener('mousedown', function(e){ pausePressed=true; });

function applyTouchUI(){
  var t = document.getElementById('touch');
  t.className = '';
  if (G.touchUI==='on') t.className = 'on';
  else if (G.touchUI==='auto') t.className = 'auto';
  else t.className = '';
}

// Tap en canvas para menus tactiles
var tapX=-1, tapY=-1;
CV.addEventListener('touchstart', function(e){
  e.preventDefault();
  var r = CV.getBoundingClientRect();
  var t = e.changedTouches[0];
  tapX = (t.clientX - r.left) * (W / r.width);
  tapY = (t.clientY - r.top) * (H / r.height);
}, {passive:false});
CV.addEventListener('mousedown', function(e){
  var r = CV.getBoundingClientRect();
  tapX = (e.clientX - r.left) * (W / r.width);
  tapY = (e.clientY - r.top) * (H / r.height);
});

// ---------- Audio procedural (original, sintetizado) ----------
var AC = null, musicOn = false, musicTimer = null, musicStep = 0;
function ensureAudio(){
  if (!AC) {
    try { AC = new (window.AudioContext||window.webkitAudioContext)(); } catch(e){ AC=null; }
  }
  if (AC && AC.state==='suspended') AC.resume();
}
function tone(freq, dur, type, vol, slide){
  if (!AC || !G.sound) return;
  var o = AC.createOscillator(), g = AC.createGain();
  o.type = type||'square';
  o.frequency.setValueAtTime(freq, AC.currentTime);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20,slide), AC.currentTime+dur);
  g.gain.setValueAtTime(vol||0.12, AC.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, AC.currentTime+dur);
  o.connect(g); g.connect(AC.destination);
  o.start(); o.stop(AC.currentTime+dur+0.02);
}
function sfx(n){
  if (!G.sound) return; ensureAudio(); if(!AC) return;
  if (n==='jump') tone(300,0.16,'square',0.10,560);
  else if (n==='djump') tone(420,0.16,'square',0.10,760);
  else if (n==='atp') tone(880,0.09,'triangle',0.12,1320);
  else if (n==='hurt') tone(180,0.28,'sawtooth',0.16,70);
  else if (n==='stomp') tone(200,0.12,'square',0.14,90);
  else if (n==='zap') tone(1200,0.08,'sawtooth',0.08,300);
  else if (n==='charge') tone(520,0.1,'triangle',0.1,780);
  else if (n==='cp') { tone(523,0.1,'triangle',0.1); setTimeout(function(){tone(784,0.14,'triangle',0.1);},90); }
  else if (n==='clear') { var nts=[523,659,784,1046]; nts.forEach(function(f,i){ setTimeout(function(){tone(f,0.18,'triangle',0.12);}, i*110); }); }
  else if (n==='bosshit') tone(90,0.3,'sawtooth',0.18,45);
  else if (n==='alarm') tone(660,0.12,'square',0.08,440);
  else if (n==='pump') tone(392,0.08,'sine',0.14);
  else if (n==='pumpok') { tone(392,0.08,'sine',0.12); setTimeout(function(){tone(523,0.12,'sine',0.12);},70); }
}
// Mini secuenciador: motivo por fase (original)
var MUSIC = [
  {bpm:112, bass:[0,0,7,0,5,5,7,10], arp:[12,15,19,15,12,15,19,24], root:110},   // P1 azul
  {bpm:96,  bass:[0,3,0,3,5,3,2,1],   arp:[12,10,8,10,12,15,12,10],  root:98},   // P2 tenso
  {bpm:104, bass:[0,0,3,0,0,3,5,3],   arp:[7,12,7,12,15,12,7,3],     root:87},   // P3 metalico
  {bpm:90,  bass:[0,5,3,5,0,5,7,5],   arp:[12,17,15,12,10,12,15,17], root:104},  // P4 Ambar
  {bpm:76,  bass:[0,0,1,0,0,1,3,1],   arp:[12,13,12,10,12,13,15,13], root:82}    // P5 apagon
];
function stf(root, semi){ return root * Math.pow(2, semi/12); }
function startMusic(){
  stopMusic();
  if (!G.sound) return;
  ensureAudio(); if(!AC) return;
  musicOn = true; musicStep = 0;
  var conf = MUSIC[(G.phase-1)%MUSIC.length];
  var stepDur = 60/conf.bpm/2;
  musicTimer = setInterval(function(){
    if (!G.sound || document.hidden) return;
    var i = musicStep % 8;
    if (musicStep % 2 === 0) tone(stf(conf.root, conf.bass[i]), stepDur*1.7, 'triangle', 0.055);
    if (musicStep % 3 !== 2) tone(stf(conf.root*2, conf.arp[i]), stepDur*0.9, 'square', 0.028);
    musicStep++;
  }, stepDur*1000);
}
function stopMusic(){ if (musicTimer){ clearInterval(musicTimer); musicTimer=null; } musicOn=false; }

// ---------- Guardado ----------
var SAVE_KEY = 'axon-synaptic-breach-v1';
function loadSave(){
  try {
    var s = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (s && s.unlocked) return s;
  } catch(e){}
  return { unlocked:{1:1}, best:{}, totalAtp:0, sound:true, touch:'auto' };
}
function persist(){
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      unlocked:G.unlocked, best:G.best, totalAtp:G.totalAtp, sound:G.sound, touch:G.touchUI
    }));
  } catch(e){}
}

// ---------- Estado global ----------
var save = loadSave();
var G = {
  screen:'title', sel:0, guidePage:0, optSel:0,
  phase:1, level:1,
  unlocked:save.unlocked, best:save.best, totalAtp:save.totalAtp,
  sound:save.sound!==false, touchUI:save.touch||'auto',
  atp:0, hp:3, time:0, deaths:0,
  camX:0, camY:0, shake:0, flash:0,
  msg:'', msgT:0, banner:'', bannerSub:'', bannerT:0,
  levelAtp:0, levelAtpMax:1, levelTime:0,
  selPhase:1, selLevel:1,
  endingT:0
};
applyTouchUI();

// ---------- Temas visuales por fase ----------
var THEMES = {
  1:{ sky0:'#06121f', sky1:'#0a2740', glow:'#3ec6ff', plat:'#123a5c', platTop:'#2f9fd8',
      accent:'#8fe8ff', fog:'rgba(20,80,120,0.10)', name:'LA AUTOPISTA AXONAL',
      sub:'El sistema y la mielina' },
  2:{ sky0:'#170d12', sky1:'#33131f', glow:'#ff5f6e', plat:'#4a2430', platTop:'#8a4453',
      accent:'#ffb3ba', fog:'rgba(120,30,45,0.12)', name:'LAS VIAS DESNUDAS',
      sub:'Conduccion degradada' },
  3:{ sky0:'#141007', sky1:'#2b2110', glow:'#ffb347', plat:'#4a3a1a', platTop:'#96793a',
      accent:'#ffd98f', fog:'rgba(140,100,30,0.10)', name:'LA FORJA NEGRA DE DOPAMINA',
      sub:'Temblor y rigidez' },
  4:{ sky0:'#100e16', sky1:'#241c33', glow:'#c9a2ff', plat:'#352a4d', platTop:'#6f5a9e',
      accent:'#e4d2ff', fog:'rgba(90,60,140,0.12)', name:'EL LABERINTO ENREDADO',
      sub:'La estructura colapsa' },
  5:{ sky0:'#050608', sky1:'#101418', glow:'#ff4d4d', plat:'#1c2a30', platTop:'#3d5a64',
      accent:'#ff9d9d', fog:'rgba(30,40,50,0.16)', name:'EL APAGON SINAPTICO',
      sub:'Relevo contra el apagado' }
};
function TH(){ return THEMES[G.phase]; }

// ---------- Datos de fases / niveles ----------
var PHASE_INFO = [
  { tit:'FASE 1', nom:'La Autopista Axonal',
    intro:'Volt despierta en el soma de una neurona motora. La senal se disipa por microfisuras en las vainas. Aprende a polarizarte y a calcular la inercia.',
    boss:'MACROFAGO PRIMARIO' },
  { tit:'FASE 2', nom:'Las Vias Desnudas',
    intro:'El revestimiento protector se deshilacha. La conduccion saltatoria falla: el movimiento ya no es fluido. Niebla, placas cicatriciales y patrullas aereas.',
    boss:'FALANGE AUTOINMUNE' },
  { tit:'FASE 3', nom:'La Forja Negra de Dopamina',
    intro:'Las fabricas de la forja colapsan. Sin senal moduladora, las terminales entran en bloqueo o en vibracion descontrolada. El escenario tiembla.',
    boss:'EL PRISMA DE LEWY' },
  { tit:'FASE 4', nom:'El Laberinto Enredado',
    intro:'Los rieles de transporte se deshacen y la informacion espacial se reconfigura. Memoriza el trazado: lo que dejas de ver sigue estando ahi.',
    boss:'EL NUDO NEUROFIBRILAR' },
  { tit:'FASE 5', nom:'El Apagon Sinaptico',
    intro:'Redes enteras se apagan a tu paso. Administra el oxigeno, encadena los peligros de todas las fases y reactiva las bombas de sodio-potasio.',
    boss:'EL SILENCIO ISQUEMICO' }
];

// ---------- Constructores de niveles ----------
// Plataforma: {x,y,w,h,k, ...}  k: solid|crumble|fragile|mover|rotate|charged|rhythm|vanish
function PL(x,y,w,h,k){ var p={x:x,y:y,w:w,h:h||18,k:k||'solid'}; return p; }
function buildLevel(ph, lv){
  var L = {
    ph:ph, lv:lv, plats:[], zones:[], spikes:[], foes:[], items:[],
    cps:[], goal:null, boss:0, len:3600, spawn:{x:60,y:380},
    flags:{ chase:false, tremor:false, anoxia:false }, waveX:-400,
    name:'', desc:''
  };
  var builders = LEVEL_BUILDERS[ph];
  builders[lv-1](L);
  L.atpMax = 0;
  L.items.forEach(function(it){ if (it.k==='atp') L.atpMax++; });
  return L;
}

// Helpers usados por los constructores
function atpLine(L, x, y, n, dx, dy){
  for (var i=0;i<n;i++) L.items.push({k:'atp', x:x+i*(dx||34), y:y+i*(dy||0), got:false, t:rnd(0,6)});
}
function atpArc(L, cx, cy, n, r){
  for (var i=0;i<n;i++){ var a=Math.PI*(0.15+0.7*i/(n-1));
    L.items.push({k:'atp', x:cx+Math.cos(a)*r, y:cy-Math.sin(a)*r, got:false, t:rnd(0,6)}); }
}
function crawl(L, x, y, range){ L.foes.push({k:'crawler', x:x, y:y, w:30, h:26, vx:0.8, x0:x, range:range||120, pol:-1, stun:0, dead:false, t:rnd(0,6)}); }
function fly(L, x, y, range, amp){ L.foes.push({k:'flyer', x:x, y:y, w:28, h:24, x0:x, y0:y, range:range||140, amp:amp||50, t:rnd(0,6), sp:rnd(0.9,1.3), stun:0, dead:false}); }
function spikes(L, x, y, w){ L.spikes.push({x:x, y:y, w:w, h:18}); }
function zone(L, k, x, y, w, h){ L.zones.push({x:x,y:y,w:w,h:h||400,k:k}); }
function cpFlag(L, x, y){ L.cps.push({x:x,y:y,w:20,h:44,on:false}); }

var LEVEL_BUILDERS = { 1:[], 2:[], 3:[], 4:[], 5:[] };

// ============ FASE 1: LA AUTOPISTA AXONAL ============
LEVEL_BUILDERS[1][0] = function(L){ // 1.1 Plataformeo basico + polaridad en paredes
  L.name='1.1 Nodulos de Ranvier'; L.len=3400;
  L.plats.push(PL(-40,460,560,80));
  var x=620;
  var ys=[430,400,430,380,350,390,430];
  for (var i=0;i<ys.length;i++){ L.plats.push(PL(x,ys[i],110)); atpArc(L,x+55,ys[i]-10,3,44); x+=190; }
  L.plats.push(PL(x,460,240,80)); crawl(L,x+60,434,120); x+=340;
  // Pared cargada para aprender adhesion: sube alternando saltos
  var cw1=PL(x,180,20,280,'charged'); cw1.pol=1; L.plats.push(cw1);
  var cw2=PL(x+220,260,20,200,'charged'); cw2.pol=1; L.plats.push(cw2);
  atpArc(L,x+110,300,4,60);
  L.plats.push(PL(x+20,460,300,80));
  x+=430;
  L.plats.push(PL(x,410,100)); L.plats.push(PL(x+170,360,100)); L.plats.push(PL(x+340,410,130));
  crawl(L,x+340+30,384,90);
  atpArc(L,x+220,340,4,50);
  L.plats.push(PL(x+560,460,420,80));
  L.goal={x:x+560+340,y:392};
  cpFlag(L,x+560+40,416);
};
LEVEL_BUILDERS[1][1] = function(L){ // 1.2 Plataformas moviles (gliales) + picos
  L.name='1.2 Glia Extraviada'; L.len=3600;
  L.plats.push(PL(-40,460,480,80));
  var x=560;
  for (var i=0;i<3;i++){
    var m=PL(x,400,120,18,'mover'); m.x1=x; m.y1=400; m.x2=x; m.y2=250; m.t=i*0.8; m.sp=0.9;
    L.plats.push(m);
    atpArc(L,x+60,240,3,40);
    spikes(L,x-50,492,50);
    x+=220;
  }
  L.plats.push(PL(x,440,200,80)); crawl(L,x+40,414,140);
  cpFlag(L,x+150,396);
  x+=320;
  for (var j=0;j<4;j++){
    var m2=PL(x,380,100,18,'mover'); m2.x1=x; m2.y1=380; m2.x2=x+150; m2.y2=380; m2.t=j; m2.sp=1.2;
    L.plats.push(m2);
    if (j<3) spikes(L,x+110,492,90);
    x+=260;
  }
  atpLine(L,x-260*2+50,320,6,60);
  L.plats.push(PL(x,420,140)); fly(L,x+70,300,120,40);
  L.plats.push(PL(x+240,460,420,80));
  L.goal={x:x+240+340,y:392};
};
LEVEL_BUILDERS[1][2] = function(L){ // 1.3 Suelo quebradizo, inercia
  L.name='1.3 Fisuras del Suelo'; L.len=3800;
  L.plats.push(PL(-40,460,460,80));
  var x=520;
  for (var i=0;i<6;i++){
    L.plats.push(PL(x,440,140,80,'crumble'));
    if (i%2===0) crawl(L,x+40,414,80);
    atpArc(L,x+70,410,3,44);
    x+=250;
  }
  L.plats.push(PL(x,460,300,80)); cpFlag(L,x+40,416);
  x+=420;
  for (var j=0;j<5;j++){
    L.plats.push(PL(x,430-(j%2)*60,100,18,'crumble'));
    x+=210;
  }
  atpLine(L,x-210*4,300,5,210,-30);
  spikes(L,x-210*2,492,380);
  L.plats.push(PL(x,460,420,80));
  fly(L,x+150,340,130,60);
  L.goal={x:x+340,y:392};
};
LEVEL_BUILDERS[1][3] = function(L){ // 1.4 Carrera contra la onda
  L.name='1.4 Onda de Despolarizacion'; L.len=4200;
  L.flags.chase=true; L.waveX=-300;
  L.plats.push(PL(-40,460,500,80));
  var x=560;
  var pat=[0,-30,0,-60,0,-30,-70,0];
  for (var i=0;i<10;i++){
    L.plats.push(PL(x,440+pat[i%pat.length],130));
    atpLine(L,x+20,400+pat[i%pat.length],3,40);
    x+=220;
  }
  L.plats.push(PL(x,460,260,80)); cpFlag(L,x+40,416);
  x+=360;
  for (var j=0;j<7;j++){
    var yy=(j%2===0)?400:330;
    L.plats.push(PL(x,yy,110));
    x+=200;
  }
  L.plats.push(PL(x,460,380,80));
  crawl(L,x+60,434,120);
  L.goal={x:x+300,y:392};
};
LEVEL_BUILDERS[1][4] = function(L){ // JEFE 1
  L.name='JEFE: MACROFAGO PRIMARIO'; L.len=960; L.boss=1;
  L.plats.push(PL(-40,470,1040,80));
  L.plats.push(PL(-40,0,40,540)); L.plats.push(PL(960,0,40,540));
  L.pads=[ {x:180,y:452,w:90,on:0}, {x:435,y:452,w:90,on:0}, {x:690,y:452,w:90,on:0} ];
  L.spawn={x:120,y:400};
  L.goal=null;
};

// ============ FASE 2: LAS VIAS DESNUDAS ============
LEVEL_BUILDERS[2][0] = function(L){ // 2.1 Conduccion degradada (-40%)
  L.name='2.1 Conduccion Degradada'; L.len=3600;
  L.plats.push(PL(-40,460,500,80));
  var x=560;
  zone(L,'slow',x-40,100,900,440);
  for (var i=0;i<4;i++){
    L.plats.push(PL(x,430,160,18));
    atpLine(L,x+30,395,3,40);
    if (i===1) crawl(L,x+50,404,90);
    x+=230;
  }
  L.plats.push(PL(x,460,300,80)); cpFlag(L,x+40,416);
  x+=400;
  zone(L,'slow',x-30,100,800,440);
  for (var j=0;j<4;j++){
    L.plats.push(PL(x,410-(j%2)*50,120,18));
    x+=210;
  }
  fly(L,x-420,300,120,50);
  L.plats.push(PL(x,460,420,80));
  spikes(L,x+100,492,120);
  L.goal={x:x+340,y:392};
};
LEVEL_BUILDERS[2][1] = function(L){ // 2.2 Linfocitos T aereos
  L.name='2.2 Patrulla de Linfocitos'; L.len=3700;
  L.plats.push(PL(-40,460,440,80));
  var x=520;
  for (var i=0;i<5;i++){
    L.plats.push(PL(x,430-(i%3)*45,110));
    fly(L,x+55,280-(i%2)*40,150,60);
    atpArc(L,x+55,390-(i%3)*45,3,40);
    x+=220;
  }
  L.plats.push(PL(x,460,300,80)); cpFlag(L,x+40,416);
  x+=400;
  for (var j=0;j<4;j++){
    var m=PL(x,420,120,18,'mover'); m.x1=x; L.plats.push(m);
    m.y1=420; m.x2=x+160; m.y2=330; m.t=j*0.7; m.sp=1.1;
    fly(L,x+80,240,120,45);
    x+=280;
  }
  spikes(L,x-280*2,492,500);
  L.plats.push(PL(x,460,420,80));
  L.goal={x:x+340,y:392};
};
LEVEL_BUILDERS[2][2] = function(L){ // 2.3 Niebla de citoquinas
  L.name='2.3 Niebla de Citoquinas'; L.len=3700;
  L.plats.push(PL(-40,460,460,80));
  var x=540;
  zone(L,'fog',x-40,60,1500,480);
  for (var i=0;i<6;i++){
    L.plats.push(PL(x,440-(i%2)*70,120,18));
    atpLine(L,x+25,400-(i%2)*70,3,40);
    x+=240;
  }
  crawl(L,x-240*2+30,344,90);
  L.plats.push(PL(x,460,300,80)); cpFlag(L,x+40,416);
  x+=400;
  zone(L,'fog',x-30,60,1100,480);
  for (var j=0;j<4;j++){
    L.plats.push(PL(x,420-(j%2)*80,110,18));
    if (j===2) fly(L,x+55,280,110,40);
    x+=230;
  }
  L.plats.push(PL(x,460,420,80));
  L.goal={x:x+340,y:392};
};
LEVEL_BUILDERS[2][3] = function(L){ // 2.4 Mielina que se autodestruye (1.5s)
  L.name='2.4 Mielina Inestable'; L.len=3900;
  L.plats.push(PL(-40,460,440,80));
  var x=540;
  for (var i=0;i<7;i++){
    L.plats.push(PL(x,430-(i%3)*40,110,18,'crumble'));
    atpLine(L,x+25,395-(i%3)*40,2,50);
    x+=210;
  }
  L.plats.push(PL(x,460,260,80)); cpFlag(L,x+40,416);
  x+=360;
  for (var j=0;j<8;j++){
    var yy=(j%2===0)?410:340;
    L.plats.push(PL(x,yy,95,18,'crumble'));
    if (j===3) fly(L,x+40,240,120,50);
    x+=190;
  }
  spikes(L,x-190*3,492,560);
  L.plats.push(PL(x,460,420,80));
  L.goal={x:x+340,y:392};
};
LEVEL_BUILDERS[2][4] = function(L){ // JEFE 2
  L.name='JEFE: FALANGE AUTOINMUNE'; L.len=960; L.boss=2;
  L.plats.push(PL(-40,470,1040,80));
  L.plats.push(PL(-40,0,40,540)); L.plats.push(PL(960,0,40,540));
  var bw1=PL(60,140,20,330,'charged'); bw1.pol=1; L.plats.push(bw1);
  var bw2=PL(880,140,20,330,'charged'); bw2.pol=1; L.plats.push(bw2);
  L.spawn={x:120,y:400};
};

// ============ FASE 3: LA FORJA NEGRA DE DOPAMINA ============
LEVEL_BUILDERS[3][0] = function(L){ // 3.1 Temblor cada 6s
  L.name='3.1 Ritmo del Temblor'; L.len=3600;
  L.flags.tremor=true;
  L.plats.push(PL(-40,460,500,80));
  var x=560;
  for (var i=0;i<5;i++){
    L.plats.push(PL(x,430-(i%2)*40,130));
    atpLine(L,x+25,395-(i%2)*40,3,40);
    if (i===2) crawl(L,x+40,364,90);
    x+=230;
  }
  L.plats.push(PL(x,460,300,80)); cpFlag(L,x+40,416);
  x+=400;
  for (var j=0;j<4;j++){
    L.plats.push(PL(x,420-(j%2)*60,110,18));
    x+=220;
  }
  spikes(L,x-220,492,200);
  L.plats.push(PL(x,460,420,80));
  L.goal={x:x+340,y:392};
};
LEVEL_BUILDERS[3][1] = function(L){ // 3.2 Bloques rompibles con inercia
  L.name='3.2 Depositos de la Forja'; L.len=3700;
  L.flags.tremor=true;
  L.plats.push(PL(-40,460,480,80));
  var x=580;
  // subida para ganar inercia y romper deposito
  L.plats.push(PL(x,400,120)); L.plats.push(PL(x+150,340,120)); L.plats.push(PL(x+300,280,120));
  atpArc(L,x+210,260,4,60);
  L.plats.push(PL(x+470,460,40,80,'breakable'));
  L.plats.push(PL(x+470,380,40,80,'breakable'));
  L.plats.push(PL(x+510,460,160,80));
  crawl(L,x+560,434,90);
  x+=780;
  cpFlag(L,x,416); L.plats.push(PL(x-40,460,220,80));
  x+=280;
  L.plats.push(PL(x,400,120)); L.plats.push(PL(x+150,330,120));
  L.plats.push(PL(x+320,460,40,80,'breakable'));
  L.plats.push(PL(x+320,380,40,80,'breakable'));
  L.plats.push(PL(x+320,300,40,80,'breakable'));
  atpLine(L,x+380,300,4,36);
  L.plats.push(PL(x+360,460,420,80));
  fly(L,x+430,340,120,50);
  L.goal={x:x+360+340,y:392};
};
LEVEL_BUILDERS[3][2] = function(L){ // 3.3 Congelamiento de la marcha + trampa de iones
  L.name='3.3 Marcha Congelada'; L.len=3700;
  L.flags.tremor=true;
  L.plats.push(PL(-40,460,2400,80));
  zone(L,'freeze',700,300,260,180);
  zone(L,'freeze',1300,300,260,180);
  zone(L,'freeze',1900,300,260,180);
  L.iontrap={x:200, y:430, w:26, h:50, sp:52};
  atpLine(L,760,420,5,40); atpLine(L,1360,420,5,40); atpLine(L,1960,420,5,40);
  cpFlag(L,1160,416);
  var x=2460;
  L.plats.push(PL(x,430,120)); L.plats.push(PL(x+180,380,120)); L.plats.push(PL(x+360,430,120));
  crawl(L,x+390,404,70);
  L.plats.push(PL(x+580,460,420,80));
  L.goal={x:x+580+340,y:392};
};
LEVEL_BUILDERS[3][3] = function(L){ // 3.4 Plataformas ritmicas irregulares
  L.name='3.4 Espasmos de la Forja'; L.len=3800;
  L.flags.tremor=true;
  L.plats.push(PL(-40,460,440,80));
  var x=540;
  for (var i=0;i<6;i++){
    var m=PL(x,420,110,18,'rhythm'); m.y0=420; m.amp=70; m.t=i*1.3; m.pat=[1.1,0.6,1.6,0.8];
    L.plats.push(m);
    atpArc(L,x+55,320,3,42);
    x+=220;
  }
  L.plats.push(PL(x,460,280,80)); cpFlag(L,x+40,416);
  x+=380;
  for (var j=0;j<5;j++){
    var m2=PL(x,400,100,18,'rhythm'); m2.y0=400; m2.amp=90; m2.t=j*0.9; m2.pat=[0.7,1.4,0.9,1.8];
    L.plats.push(m2);
    x+=210;
  }
  spikes(L,x-210*2,492,420);
  L.plats.push(PL(x,460,420,80));
  L.goal={x:x+340,y:392};
};
LEVEL_BUILDERS[3][4] = function(L){ // JEFE 3
  L.name='JEFE: EL PRISMA DE LEWY'; L.len=1440; L.boss=3;
  L.plats.push(PL(-40,470,1520,80));
  L.plats.push(PL(-40,0,40,540)); L.plats.push(PL(1440,0,40,540));
  L.plats.push(PL(660,120,120,18));
  L.terms=[ {x:90,y:442,w:70,on:false,ch:0}, {x:1280,y:442,w:70,on:false,ch:0}, {x:685,y:92,w:70,on:false,ch:0} ];
  L.spawn={x:200,y:400};
};

// ============ FASE 4: EL LABERINTO ENREDADO ============
LEVEL_BUILDERS[4][0] = function(L){ // 4.1 Microtubulos giratorios
  L.name='4.1 Puentes Giratorios'; L.len=3700;
  L.plats.push(PL(-40,460,460,80));
  var x=560;
  for (var i=0;i<4;i++){
    var r=PL(x,430,150,16,'rotate'); r.cx=x+75; r.cy=430+8; r.len=150; r.a=i*0.8; r.sp=0.9;
    L.plats.push(r);
    atpArc(L,x+75,340,3,42);
    x+=260;
  }
  L.plats.push(PL(x,460,300,80)); cpFlag(L,x+40,416);
  x+=400;
  for (var j=0;j<4;j++){
    var r2=PL(x,420,170,16,'rotate'); r2.cx=x+85; r2.cy=428; r2.len=170; r2.a=j*1.2+0.5; r2.sp=-1.1;
    L.plats.push(r2);
    x+=280;
  }
  crawl(L,x-280,404,80);
  L.plats.push(PL(x,460,420,80));
  L.goal={x:x+340,y:392};
};
LEVEL_BUILDERS[4][1] = function(L){ // 4.2 Placas adhesivas
  L.name='4.2 Placas Ambar'; L.len=3600;
  L.plats.push(PL(-40,460,2000,80));
  zone(L,'sticky',600,440,180,40);
  zone(L,'sticky',1050,440,220,40);
  zone(L,'sticky',1550,440,200,40);
  atpLine(L,640,400,4,36); atpLine(L,1100,400,4,36); atpLine(L,1600,400,4,36);
  crawl(L,880,434,100); crawl(L,1400,434,100);
  cpFlag(L,960,416);
  var x=2060;
  L.plats.push(PL(x,430,110)); L.plats.push(PL(x+170,380,110)); L.plats.push(PL(x+340,430,110));
  zone(L,'sticky',x+480,300,200,240);
  L.plats.push(PL(x+480,460,200,80));
  L.plats.push(PL(x+760,460,420,80));
  fly(L,x+560,330,110,45);
  L.goal={x:x+760+340,y:392};
};
LEVEL_BUILDERS[4][2] = function(L){ // 4.3 Memoria espacial (plataformas invisibles)
  L.name='4.3 Memoria Espacial'; L.len=3800;
  L.plats.push(PL(-40,460,460,80));
  var x=560;
  for (var i=0;i<6;i++){
    var p=PL(x,430-(i%2)*60,110,18,'vanish'); p.seen=-1;
    L.plats.push(p);
    atpLine(L,x+25,395-(i%2)*60,3,40);
    x+=220;
  }
  L.plats.push(PL(x,460,300,80)); cpFlag(L,x+40,416);
  x+=400;
  for (var j=0;j<6;j++){
    var yy=400-(j%3)*45;
    var p2=PL(x,yy,100,18,'vanish'); p2.seen=-1;
    L.plats.push(p2);
    if (j===3) fly(L,x+50,270,110,45);
    x+=210;
  }
  L.plats.push(PL(x,460,420,80));
  L.goal={x:x+340,y:392};
};
LEVEL_BUILDERS[4][3] = function(L){ // 4.4 Inversiones de gravedad
  L.name='4.4 Gravedad Rota'; L.len=3800;
  L.plats.push(PL(-40,460,500,80));
  var x=560;
  zone(L,'flip',x-20,0,700,540);
  L.plats.push(PL(x,60,500,18));         // techo caminable dentro de la zona
  L.plats.push(PL(x,430,140,18));
  L.plats.push(PL(x+220,430,140,18));
  L.plats.push(PL(x+440,430,140,18));
  atpLine(L,x+40,100,6,70);
  atpLine(L,x+40,395,4,110);
  x+=720;
  L.plats.push(PL(x-40,460,300,80)); cpFlag(L,x+20,416);
  x+=360;
  zone(L,'flip',x-20,0,760,540);
  L.plats.push(PL(x,60,620,18));
  L.plats.push(PL(x+80,420,120,18));
  L.plats.push(PL(x+300,420,120,18));
  L.plats.push(PL(x+500,420,120,18));
  fly(L,x+260,260,130,60);
  atpLine(L,x+40,100,7,80);
  x+=760;
  L.plats.push(PL(x,460,420,80));
  L.goal={x:x+340,y:392};
};
LEVEL_BUILDERS[4][4] = function(L){ // JEFE 4: torre vertical
  L.name='JEFE: EL NUDO NEUROFIBRILAR'; L.len=960; L.boss=4;
  L.vert=true; L.height=1900;
  L.plats.push(PL(-40,1860,1040,80));
  L.plats.push(PL(-40,0,40,2000)); L.plats.push(PL(960,0,40,2000));
  var ys=[1760,1640,1520,1400,1280,1160,1040,920,800,680,560,440,330];
  for (var i=0;i<ys.length;i++){
    var xx=(i%2===0)?120:520; var ww=(i%3===0)?300:220;
    L.plats.push(PL(xx,ys[i],ww,18));
    atpLine(L,xx+40,ys[i]-40,3,50);
  }
  L.plats.push(PL(300,240,360,18));
  L.anchors=[ {x:140,y:200,cut:false}, {x:400,y:200,cut:false}, {x:660,y:200,cut:false}, {x:840,y:200,cut:false} ];
  L.spawn={x:120,y:1800};
};

// ============ FASE 5: EL APAGON SINAPTICO ============
LEVEL_BUILDERS[5][0] = function(L){ // 5.1 Vacios de presion
  L.name='5.1 Vacios de Presion'; L.len=3600;
  L.plats.push(PL(-40,460,460,80));
  var x=560;
  zone(L,'vacuum',x-30,100,1000,440);
  for (var i=0;i<4;i++){
    L.plats.push(PL(x,430-(i%2)*50,130));
    atpLine(L,x+30,395-(i%2)*50,3,40);
    x+=250;
  }
  L.plats.push(PL(x,460,300,80)); cpFlag(L,x+40,416);
  x+=400;
  zone(L,'vacuum',x-30,100,900,440);
  for (var j=0;j<4;j++){
    L.plats.push(PL(x,410-(j%2)*60,110,18));
    x+=220;
  }
  fly(L,x-440,290,120,50);
  L.plats.push(PL(x,460,420,80));
  L.goal={x:x+340,y:392};
};
LEVEL_BUILDERS[5][1] = function(L){ // 5.2 Fusion de peligros
  L.name='5.2 Fusion de Peligros'; L.len=3900;
  L.flags.tremor=true;
  L.plats.push(PL(-40,460,1800,80));
  zone(L,'slow',500,100,400,440);
  zone(L,'sticky',950,440,200,40);
  zone(L,'fog',1250,60,600,480);
  crawl(L,600,434,100); crawl(L,1150,434,80);
  fly(L,1400,300,130,50); fly(L,1650,260,120,55);
  atpLine(L,540,400,5,40); atpLine(L,1000,400,4,40); atpLine(L,1330,400,5,44);
  cpFlag(L,900,416);
  var x=1900;
  for (var i=0;i<5;i++){
    L.plats.push(PL(x,420-(i%2)*50,110,18,'crumble'));
    x+=200;
  }
  zone(L,'freeze',x-20,300,240,180);
  L.plats.push(PL(x-40,460,700,80));
  atpLine(L,x+40,420,5,44);
  L.goal={x:x+620,y:392};
};
LEVEL_BUILDERS[5][2] = function(L){ // 5.3 Zonas de anoxia
  L.name='5.3 Zonas de Anoxia'; L.len=3900;
  L.plats.push(PL(-40,460,2600,80));
  zone(L,'anoxia',480,60,1000,480);
  L.items.push({k:'o2', x:900, y:400, got:false, t:0});
  zone(L,'anoxia',1700,60,900,480);
  L.items.push({k:'o2', x:1300, y:400, got:false, t:0});
  L.items.push({k:'o2', x:2100, y:400, got:false, t:0});
  atpLine(L,560,400,5,44); atpLine(L,1150,400,4,44); atpLine(L,1800,400,5,44); atpLine(L,2300,400,4,44);
  crawl(L,700,434,110); crawl(L,1550,434,100);
  cpFlag(L,1450,416);
  var x=2700;
  L.plats.push(PL(x,430,110)); L.plats.push(PL(x+170,370,110)); L.plats.push(PL(x+340,420,110));
  fly(L,x+230,260,120,50);
  L.plats.push(PL(x+540,460,460,80));
  L.goal={x:x+540+380,y:392};
};
LEVEL_BUILDERS[5][3] = function(L){ // 5.4 Guantelete final (fragmentos que se extinguen)
  L.name='5.4 Guantelete Final'; L.len=4200;
  L.flags.tremor=true;
  L.plats.push(PL(-40,460,440,80));
  var x=540;
  for (var i=0;i<8;i++){
    L.plats.push(PL(x,430-(i%3)*40,100,18,'fragile'));
    atpLine(L,x+22,395-(i%3)*40,2,50);
    x+=200;
  }
  L.plats.push(PL(x,460,260,80)); cpFlag(L,x+40,416);
  x+=360;
  for (var j=0;j<9;j++){
    var yy=(j%2===0)?410:340;
    L.plats.push(PL(x,yy,90,18,'fragile'));
    if (j===4) fly(L,x+40,230,120,50);
    x+=185;
  }
  spikes(L,x-185*3,492,560);
  L.plats.push(PL(x,460,420,80));
  L.goal={x:x+340,y:392};
};
LEVEL_BUILDERS[5][4] = function(L){ // JEFE FINAL
  L.name='JEFE: EL SILENCIO ISQUEMICO'; L.len=960; L.boss=5;
  L.plats.push(PL(-40,470,1040,80));
  L.plats.push(PL(-40,0,40,540)); L.plats.push(PL(960,0,40,540));
  var pts=[ [180,380],[420,340],[660,380],[300,260],[560,240],[760,300],[120,300],[840,380] ];
  L.bplats=[];
  for (var i=0;i<pts.length;i++){
    var p=PL(pts[i][0],pts[i][1],110,16,'bosslit'); p.lit=true; p.id=i;
    L.plats.push(p); L.bplats.push(p);
  }
  L.spawn={x:120,y:400};
};

// ---------- Jugador ----------
var P = null, L = null, B = null, particles=[], projectiles=[];
var GRAV = 0.7;

function newPlayer(sp){
  return {
    x:sp.x, y:sp.y, w:24, h:32, vx:0, vy:0, face:1, pol:1, grav:1,
    onGround:false, coyote:0, jumps:2, jumpsMax:2,
    canSprint:true, canDjump:true,
    hp:3, inv:0, dead:false, deadT:0,
    stuck:0, invertT:0, frozen:false, mash:0, freezeImmune:0, o2:1, inFog:false, inSlow:false,
    cling:false, spawnX:sp.x, spawnY:sp.y, trail:[]
  };
}

function startLevel(ph, lv){
  G.phase=ph; G.level=lv;
  L = buildLevel(ph, lv);
  P = newPlayer(L.spawn);
  B = null; particles=[]; projectiles=[];
  G.hp=3; G.levelAtp=0; G.levelTime=0; G.deaths=0;
  G.camX=0; G.camY=(L.vert)?(L.height-H):0;
  G.shake=0; G.flash=0;
  G.banner = L.name; G.bannerSub = PHASE_INFO[ph-1].nom; G.bannerT=3.2;
  seedBg();
  if (L.boss) initBoss(L.boss);
  G.screen='play';
  startMusic();
}

function respawn(){
  P.x=P.spawnX; P.y=P.spawnY; P.vx=0; P.vy=0; P.grav=1; P.dead=false; P.deadT=0;
  P.hp=3; P.inv=2; P.o2=1; P.stuck=0; P.invertT=0; P.frozen=false; P.mash=0;
  if (L.flags.chase) L.waveX = Math.min(L.waveX, P.x-700);
  if (L.iontrap) L.iontrap.x = Math.min(L.iontrap.x, P.x-500);
}

function hurt(n, kx){
  if (P.inv>0 || P.dead) return;
  P.hp -= (n||1); P.inv=1.6; G.flash=0.35; G.shake=0.4;
  sfx('hurt');
  P.vx = kx||(-P.face*4); P.vy = -6*P.grav;
  burst(P.x+P.w/2, P.y+P.h/2, '#ff6b6b', 10);
  if (P.hp<=0){ P.dead=true; P.deadT=1.4; G.deaths++; sfx('bosshit'); }
}

function burst(x,y,col,n){
  for (var i=0;i<n;i++) particles.push({x:x,y:y,vx:rnd(-3,3),vy:rnd(-4,1),t:rnd(0.3,0.8),col:col,r:rnd(1.5,3.5)});
}

function inZone(k){
  var pr={x:P.x,y:P.y,w:P.w,h:P.h};
  for (var i=0;i<L.zones.length;i++) if (L.zones[i].k===k && overlap(pr,L.zones[i])) return L.zones[i];
  return null;
}

// ---------- Actualizacion de plataformas ----------
function updatePlats(dt){
  for (var i=0;i<L.plats.length;i++){
    var p=L.plats[i];
    if (p.k==='mover'){
      p.t += dt*p.sp;
      var s=(Math.sin(p.t)+1)/2;
      p.x=lerp(p.x1,p.x2,s); p.y=lerp(p.y1,p.y2,s);
    } else if (p.k==='rhythm'){
      p.t += dt;
      var pat=p.pat, total=0, k;
      for (k=0;k<pat.length;k++) total+=pat[k];
      var tt=p.t%total, acc=0, idx=0;
      for (k=0;k<pat.length;k++){ if (tt<acc+pat[k]){ idx=k; break; } acc+=pat[k]; }
      var frac=(tt-acc)/pat[idx];
      var dir=(idx%2===0)?1:-1;
      p.y=p.y0 + dir*p.amp*frac + (idx%2===0?0:0);
      if (idx%2===1) p.y=p.y0+p.amp-p.amp*frac;
    } else if (p.k==='rotate'){
      p.a += dt*p.sp;
      p.x = p.cx - Math.cos(p.a)*p.len/2 - p.w/2 + Math.cos(p.a)*p.len/2;
      // posicion de extremos para colision aproximada
      p.rx1 = p.cx - Math.cos(p.a)*p.len/2; p.ry1 = p.cy - Math.sin(p.a)*p.len/2;
      p.rx2 = p.cx + Math.cos(p.a)*p.len/2; p.ry2 = p.cy + Math.sin(p.a)*p.len/2;
    } else if ((p.k==='crumble'||p.k==='fragile') && p.step>0){
      p.step -= dt;
      if (p.step<=0){
        p.gone=true;
        burst(p.x+p.w/2,p.y,TH().platTop,8);
        if (p.k==='crumble') p.resp=3;
      }
    } else if (p.gone && p.resp!==undefined){
      p.resp-=dt;
      if (p.resp<=0){ p.gone=false; p.step=0; }
    } else if (p.k==='vanish'){
      if (p.seen<0 && p.x+p.w>G.camX && p.x<G.camX+W) p.seen=0;
      if (p.seen>=0 && p.seen<2){ p.seen+=dt; }
    } else if (false && p.k==='vanish' && p.seen>=0 && p.seen<2){
      p.seen+=dt;
    } else if (p.k==='breakable' && p.gone && p.resp===undefined){
      // permanente
    }
  }
}

// ---------- Fisica del jugador ----------
function updatePlayer(dt){
  if (P.dead){
    P.deadT-=dt;
    if (P.deadT<=0){
      if (G.deaths>=5 && false) {}
      respawn();
    }
    return;
  }
  var th=TH();
  // Zonas
  var zSlow=inZone('slow'), zFog=inZone('fog'), zSticky=inZone('sticky'),
      zFreeze=inZone('freeze'), zVac=inZone('vacuum'), zAnox=inZone('anoxia'),
      zFlip=inZone('flip');
  P.inSlow=!!zSlow; P.inFog=!!zFog;
  var targetGrav = zFlip?-1:1;
  if (targetGrav!==P.grav){ P.grav=targetGrav; P.vy=0; sfx('zap'); }

  // Temblor de fase 3/5
  if (L.flags.tremor){
    L.tremorT=(L.tremorT||0)+dt;
    var cyc=L.tremorT%6;
    if (cyc>5.4 && cyc<6 && !L.tremorDone){
      L.tremorDone=true; G.shake=0.5; sfx('alarm');
      if (P.onGround){ P.vy=-3.5*P.grav; P.vx+=rnd(-2,2); }
    }
    if (cyc<1) L.tremorDone=false;
  }
  // Vacios de presion
  if (zVac){
    L.vacT=(L.vacT||0)+dt;
    if (L.vacT>1.2){ L.vacT=0; P.vx+=rnd(-4,4); P.vy+=rnd(-2.5,2.5); burst(P.x+P.w/2,P.y+P.h/2,'#9db4c0',4); }
  }
  // Anoxia
  if (zAnox){
    P.o2-=dt/14;
    if (P.o2<=0){ P.o2=0; hurt(1); }
  } else {
    P.o2=Math.min(1,P.o2+dt/6);
  }
  // Placas adhesivas
  if (zSticky && P.onGround && P.stuck<=0){ P.stuck=4; sfx('zap'); }
  if (P.stuck>0) P.stuck-=dt;
  // Inversion de controles (jefe 2)
  if (P.invertT>0) P.invertT-=dt;

  // Congelamiento
  if (P.freezeImmune>0) P.freezeImmune-=dt;
  if (zFreeze && !P.frozen && P.onGround && P.freezeImmune<=0){ P.frozen=true; P.mash=0; sfx('alarm'); }
  if (P.frozen){
    if (IN.jbuf>0 || IN.abuf>0){ P.mash++; IN.jbuf=0; IN.abuf=0; sfx('pump'); burst(P.x+P.w/2,P.y+P.h/2,th.glow,3); }
    if (P.mash>=6){ P.frozen=false; P.freezeImmune=1.5; sfx('pumpok'); burst(P.x+P.w/2,P.y+P.h/2,th.accent,12); }
    P.vx=0;
    if (L.iontrap && L.iontrap.x+L.iontrap.w>P.x && L.iontrap.x<P.x+P.w) hurt(1);
  }

  var inv = P.invertT>0 ? -1 : 1;
  var maxRun = (IN.sprint&&P.canSprint?5.2:3.4) * (P.inSlow?0.6:1) * (P.stuck>0?0.35:1);
  var accel = P.onGround?0.55:0.35;
  if (!P.frozen){
    if (IN.left){ P.vx-=accel; P.face=(inv>0)?-1:1; }
    if (IN.right){ P.vx+=accel; P.face=(inv>0)?1:-1; }
    if (!IN.left && !IN.right){ P.vx*=P.onGround?0.78:0.96; if (Math.abs(P.vx)<0.05) P.vx=0; }
  }
  P.vx=clamp(P.vx,-maxRun,maxRun);

  // Gravedad
  P.vy += GRAV*P.grav;
  P.vy=clamp(P.vy,-13,13);
  if (IN.jumpHeld && ((P.grav>0&&P.vy<0)||(P.grav<0&&P.vy>0))) P.vy -= 0.12*P.grav;

  // Salto
  if (P.coyote>0) P.coyote-=dt;
  var canJump = P.stuck<=0 && !P.frozen;
  if (IN.jbuf>0){
    IN.jbuf-=dt;
    if (canJump && (P.onGround||P.coyote>0)){
      P.vy=-9.2*P.grav; P.onGround=false; P.coyote=0; IN.jbuf=0; P.jumps=P.canDjump&&!P.inFog?1:0;
      sfx('jump'); burst(P.x+P.w/2,P.y+(P.grav>0?P.h:0),th.glow,5);
    } else if (canJump && P.jumps>0){
      P.jumps--; P.vy=-8.2*P.grav; IN.jbuf=0;
      sfx('djump'); burst(P.x+P.w/2,P.y+P.h/2,th.accent,8);
    } else if (P.cling){
      // salto desde pared cargada
      P.vy=-8.6*P.grav; P.vx=-P.clingDir*2.2; P.cling=false; IN.jbuf=0;
      sfx('djump'); burst(P.x+P.w/2,P.y+P.h/2,th.accent,8);
    }
  }
  // Polaridad: alternar carga
  if (IN.abuf>0){
    IN.abuf-=dt;
    if (IN.abuf>0.05 && !actionConsumed){ P.pol*=-1; actionConsumed=true; sfx('charge');
      burst(P.x+P.w/2,P.y+P.h/2,P.pol>0?'#ffd166':'#4dd8ff',8); }
  } else actionConsumed=false;

  // Movimiento y colisiones
  var ox=P.x, oy=P.y;
  P.cling=false;
  P.x+=P.vx;
  collideAxis(true);
  P.y+=P.vy;
  P.onGround=false;
  collideAxis(false);

  // Limites del nivel
  var floorY = L.vert? L.height : 540;
  if (P.x<0){P.x=0;P.vx=0;}
  if (P.x>L.len-P.w){P.x=L.len-P.w;P.vx=0;}
  var voidY = L.vert? L.height+200 : 720;
  if ((P.grav>0&&P.y>voidY)||(P.grav<0&&P.y<-260)){
    hurt(1); respawn(); return;
  }

  // Trampa de iones (3.3)
  if (L.iontrap){
    L.iontrap.x += L.iontrap.sp*dt;
    if (overlap(P,L.iontrap)) hurt(1);
  }
  // Onda de despolarizacion
  if (L.flags.chase){
    L.waveX += (P.x>2000?78:66)*dt;
    if (P.x < L.waveX) { hurt(3); }
    if (P.x - L.waveX < 260 && Math.random()<0.1) sfx('alarm');
  }

  // Estela
  P.trail.push({x:P.x+P.w/2,y:P.y+P.h/2,t:0.35});
  if (P.trail.length>24) P.trail.shift();
  for (var i=0;i<P.trail.length;i++) P.trail[i].t-=dt;
  while (P.trail.length&&P.trail[0].t<=0) P.trail.shift();

  // Enemigos
  updateFoes(dt);
  // Recogibles
  updateItems(dt);
  // Checkpoints
  for (var c=0;c<L.cps.length;c++){
    var cp=L.cps[c];
    if (!cp.on && overlap(P,cp)){
      cp.on=true; P.spawnX=cp.x; P.spawnY=cp.y-40; sfx('cp');
      setMsg('PUNTO DE RELEVO');
      burst(cp.x+10,cp.y,th.accent,10);
    }
  }
  // Meta
  if (L.goal && overlap(P,{x:L.goal.x,y:L.goal.y,w:44,h:68})) levelClear();
  // Jefe
  if (B) updateBoss(dt);
  // Pads de suelo (jefe 1)
  if (L.pads){
    for (var pd=0;pd<L.pads.length;pd++){
      var pad=L.pads[pd];
      if (pad.on>0) pad.on-=dt;
      if (actionConsumed && overlap(P,{x:pad.x-10,y:pad.y-20,w:pad.w+20,h:40})) { pad.on=2.2; sfx('zap'); }
    }
  }
  // Terminales (jefe 3)
  if (L.terms){
    for (var tm=0;tm<L.terms.length;tm++){
      var t=L.terms[tm];
      if (!t.on && overlap(P,{x:t.x-8,y:t.y-24,w:t.w+16,h:44}) && IN.action){
        t.ch+=dt;
        if (Math.random()<0.3) burst(t.x+t.w/2,t.y,'#4dd8ff',2);
        if (t.ch>1){ t.on=true; sfx('clear'); burst(t.x+t.w/2,t.y,'#ffd166',16); if (B&&B.kind===3) bossPulse(); }
      } else if (!t.on) t.ch=Math.max(0,t.ch-dt*2);
    }
  }
  // Anclajes (jefe 4)
  if (L.anchors){
    for (var an=0;an<L.anchors.length;an++){
      var a=L.anchors[an];
      if (!a.cut && overlap(P,{x:a.x-16,y:a.y-16,w:60,h:60}) && actionConsumed===false && IN.abuf>0){}
      if (!a.cut && overlap(P,{x:a.x-16,y:a.y-16,w:60,h:60}) && IN.action){
        a.cut=true; sfx('bosshit'); G.shake=0.5;
        burst(a.x+14,a.y+14,'#c9a2ff',18);
        setMsg('ANCLAJE CORTADO ('+countCut()+'/4)');
        if (B&&B.kind===4) bossAnchor();
      }
    }
  }
  if (P.inv>0) P.inv-=dt;
  G.levelTime+=dt;
}
var actionConsumed=false;

function countCut(){ var n=0; for (var i=0;i<L.anchors.length;i++) if (L.anchors[i].cut) n++; return n; }

function collideAxis(isX){
  for (var i=0;i<L.plats.length;i++){
    var p=L.plats[i];
    if (p.gone) continue;
    var pr = p;
    if (p.k==='rotate'){
      // aproximacion: caja entre extremos
      var rx=Math.min(p.rx1,p.rx2), ry=Math.min(p.ry1,p.ry2);
      pr={x:rx-6,y:ry-6,w:Math.abs(p.rx2-p.rx1)+12,h:Math.abs(p.ry2-p.ry1)+12};
    }
    if (!overlap(P,pr)) continue;
    if (p.k==='breakable'){
      // se rompe con inercia electrica: velocidad alta
      if (Math.abs(P.vx)>4.4 || Math.abs(P.vy)>8){
        p.gone=true; G.shake=0.3; sfx('stomp'); burst(p.x+p.w/2,p.y+p.h/2,'#ffb347',12);
        continue;
      }
    }
    if (p.k==='charged' && isX){
      // adhesion si la polaridad coincide
      if (P.pol===p.pol){
        P.cling=true; P.clingDir=(P.x+P.w/2 < p.x+p.w/2)?-1:1;
        P.vy=clamp(P.vy,-1.2,1.2);
        P.jumps=P.canDjump?1:0;
      } else {
        P.vx = (P.x+P.w/2 < p.x+p.w/2)?-6:6; // repele
        sfx('zap');
      }
      if (P.x+P.w/2 < p.x+p.w/2) P.x=p.x-P.w; else P.x=p.x+p.w;
      continue;
    }
    if (isX){
      if (P.vx>0) P.x=pr.x-P.w; else if (P.vx<0) P.x=pr.x+pr.w;
      P.vx=0;
    } else {
      var falling = P.grav>0 ? P.vy>0 : P.vy<0;
      if (falling && ((P.grav>0 && P.y+P.h-P.vy<=pr.y+2)||(P.grav<0 && P.y-P.vy>=pr.y+pr.h-2))){
        if (P.grav>0) P.y=pr.y-P.h; else P.y=pr.y+pr.h;
        P.vy=0; P.onGround=true; P.coyote=0.12; P.jumps=P.canDjump&&!P.inFog?1:0;
        if ((p.k==='crumble'||p.k==='fragile') && !p.step) p.step=(p.k==='crumble'?1.5:0.35);
      } else if (!falling && ((P.grav>0 && P.y-P.vy>=pr.y+pr.h-2)||(P.grav<0 && P.y+P.h-P.vy<=pr.y+2))){
        if (P.grav>0) P.y=pr.y+pr.h; else P.y=pr.y-P.h;
        P.vy=0;
      }
    }
  }
  // Picos
  for (var s=0;s<L.spikes.length;s++){
    if (overlap(P,L.spikes[s])) { hurt(1, P.x<L.spikes[s].x?-4:4); }
  }
}

// ---------- Enemigos ----------
function updateFoes(dt){
  for (var i=0;i<L.foes.length;i++){
    var f=L.foes[i];
    if (f.dead) continue;
    if (f.stun>0){ f.stun-=dt; continue; }
    if (f.k==='crawler'){
      f.x+=f.vx;
      if (f.x<f.x0-f.range||f.x>f.x0+f.range) f.vx*=-1;
    } else if (f.k==='flyer'){
      f.t+=dt*f.sp;
      f.x=f.x0+Math.sin(f.t)*f.range;
      f.y=f.y0+Math.sin(f.t*2.3)*f.amp;
    }
    if (overlap(P,f)){
      var falling = P.grav>0 ? P.vy>2 : P.vy<-2;
      if (falling){
        f.dead=true; P.vy=-8*P.grav; sfx('stomp');
        burst(f.x+f.w/2,f.y+f.h/2,'#baffc9',10); G.atp+=2;
      } else if (P.pol!==f.pol && actionConsumed===false && IN.action){
        f.stun=2.5; sfx('zap'); burst(f.x+f.w/2,f.y+f.h/2,'#4dd8ff',8);
      } else hurt(1, P.x<f.x?-4:4);
    }
    // sobrecarga a distancia corta con polaridad opuesta
    if (P.pol!==f.pol && IN.action && dist(P.x,P.y,f.x,f.y)<70 && f.stun<=0){
      f.stun=2.5; sfx('zap'); burst(f.x+f.w/2,f.y+f.h/2,'#4dd8ff',6);
    }
  }
}

function updateItems(dt){
  for (var i=0;i<L.items.length;i++){
    var it=L.items[i];
    if (it.got) continue;
    it.t+=dt;
    var box={x:it.x-11,y:it.y-11,w:22,h:22};
    if (overlap(P,box)){
      it.got=true;
      if (it.k==='atp'){ G.atp++; G.levelAtp++; G.totalAtp++; sfx('atp'); burst(it.x,it.y,'#ffd166',6); }
      else if (it.k==='o2'){ P.o2=1; sfx('cp'); setMsg('OXIGENO MITOCONDRIAL'); burst(it.x,it.y,'#7ef7ff',10); }
    }
  }
  for (var j=particles.length-1;j>=0;j--){
    var q=particles[j];
    q.x+=q.vx; q.y+=q.vy; q.vy+=0.1; q.t-=dt;
    if (q.t<=0) particles.splice(j,1);
  }
  for (var k=projectiles.length-1;k>=0;k--){
    var b=projectiles[k];
    b.x+=b.vx; b.y+=b.vy; b.t-=dt;
    if (b.grav) b.vy+=0.15;
    if (overlap(P,{x:b.x-6,y:b.y-6,w:12,h:12})){
      if (b.kind==='ring'){ P.invertT=3; setMsg('CONTROLES INVERTIDOS'); sfx('alarm'); projectiles.splice(k,1); }
      else { hurt(1); projectiles.splice(k,1); }
      continue;
    }
    if (b.t<=0 || b.y>700 || b.x<-40 || b.x>L.len+40) projectiles.splice(k,1);
  }
}

function setMsg(m){ G.msg=m; G.msgT=1.8; }

// ---------- Jefes ----------
function initBoss(kind){
  B={kind:kind, t:0, hp:[0,3,4,3,4,3][kind], maxhp:[0,3,4,3,4,3][kind], state:'intro', st:2.2,
     x:0,y:0,vx:0,vy:0, dashDir:1, stun:0, inv:0, ringT:0, pulseT:0, beams:0,
     knotY:0, core:{x:480,y:300}, phaseB:0, shadows:[], pumps:[], pumpT:0, won:false};
  if (kind===1){ B.x=480; B.y=180; }
  if (kind===2){ B.x=480; B.y=200; B.phaseB=1; }
  if (kind===3){ B.x=720; B.y=280; B.beams=0; }
  if (kind===4){ B.knotY=L.height+120; }
  if (kind===5){ B.phaseB=0; B.core={x:480,y:150}; }
  G.banner=L.name; G.bannerT=3;
}

function bossPulse(){ if (B&&B.kind===3){ B.hp--; B.inv=1; G.shake=0.6; sfx('bosshit');
  burst(B.x,B.y,'#ffd166',24); setMsg('PULSO DE RECARGA ('+(3-B.hp)+'/3)');
  if (B.hp<=0) bossWin(); } }
function bossAnchor(){ if (B&&B.kind===4 && countCut()>=4){ bossWin(); } }

function updateBoss(dt){
  B.t+=dt; if (B.inv>0)B.inv-=dt;
  if (B.state==='intro'){ B.st-=dt; if (B.st<=0) B.state='fight'; return; }
  if (B.won) return;
  if (B.kind===1) boss1(dt);
  else if (B.kind===2) boss2(dt);
  else if (B.kind===3) boss3(dt);
  else if (B.kind===4) boss4(dt);
  else if (B.kind===5) boss5(dt);
}

// Jefe 1: Macrofago Primario
function boss1(dt){
  B.ringT-=dt;
  if (B.stun>0){
    B.stun-=dt; B.vx=0; B.vy=0; B.y=430;
    // golpear el nucleo saltando encima
    if (overlap(P,{x:B.x-30,y:B.y-46,w:60,h:40}) && P.vy>1){
      B.hp--; B.stun=0; B.inv=1; B.y=180; sfx('bosshit'); G.shake=0.6;
      burst(B.x,B.y-30,'#ff9d9d',20); P.vy=-9;
      setMsg('IMPACTO EN EL NUCLEO ('+(3-B.hp)+'/3)');
      if (B.hp<=0){ bossWin(); return; }
    }
    return;
  }
  // ciclo: flotar -> telegrafiar -> embestida
  if (B.state==='fight'){ B.state='tele'; B.st=1.1; B.dashDir=irnd(0,2); }
  else if (B.state==='tele'){
    B.st-=dt;
    B.x=lerp(B.x, clamp(P.x,120,840), dt*2);
    if (B.st<=0){
      B.state='dash'; B.st=1.4;
      if (B.dashDir===0){ B.vx=-7; B.vy=1.2; }
      else if (B.dashDir===1){ B.vx=7; B.vy=1.2; }
      else { B.vx=(P.x>B.x?5:-5); B.vy=5; }
      sfx('alarm');
    }
  } else if (B.state==='dash'){
    B.st-=dt; B.x+=B.vx; B.y+=B.vy;
    if (B.x<80){B.x=80;B.vx*=-1;}
    if (B.x>880){B.x=880;B.vx*=-1;}
    // impacto con suelo
    if (B.y>=430){
      B.y=430;
      // pads electrificados?
      var stunned=false;
      for (var i=0;i<L.pads.length;i++){
        var pd=L.pads[i];
        if (pd.on>0 && Math.abs(B.x-(pd.x+pd.w/2))<90) stunned=true;
      }
      G.shake=0.5;
      if (stunned){ B.stun=3.2; setMsg('RECEPTOR SOBRECARGADO: GOLPEA EL NUCLEO'); sfx('clear'); }
      else { B.state='rise'; B.st=1; }
      burst(B.x,440,'#ffb3ba',10);
    }
    if (B.st<=0){ B.state='rise'; B.st=1; }
    // enzimas corrosivas
    if (B.ringT<=0){ B.ringT=1.6; projectiles.push({x:B.x,y:B.y-20,vx:(P.x-B.x)/60,vy:-2,grav:true,t:4,kind:'enz'}); sfx('zap'); }
    if (overlap(P,{x:B.x-34,y:B.y-40,w:68,h:70})) hurt(1,P.x<B.x?-5:5);
  } else if (B.state==='rise'){
    B.y=lerp(B.y,180,dt*3); B.st-=dt;
    if (B.st<=0) B.state='fight';
  }
}

// Jefe 2: Falange Autoinmune
function boss2(dt){
  B.pulseT-=dt;
  B.x=480+Math.sin(B.t*0.8)*140;
  B.y=200+Math.sin(B.t*1.7)*50;
  if (B.phaseB===2 && B.pulseT<=0){
    B.pulseT=2.4;
    projectiles.push({x:B.x,y:B.y,vx:-3.4,vy:0,t:3,kind:'ring'});
    projectiles.push({x:B.x,y:B.y,vx:3.4,vy:0,t:3,kind:'ring'});
    sfx('alarm');
  }
  // dano: caer sobre el nucleo desde arriba con rebote cargado
  if (B.inv<=0 && overlap(P,{x:B.x-36,y:B.y-44,w:72,h:60})){
    if (P.vy>5 && P.superBounce>0){
      B.hp--; B.inv=1.2; G.shake=0.6; sfx('bosshit');
      burst(B.x,B.y-20,'#ffb3ba',22); P.vy=-11;
      setMsg('BRECHA EN LA CORAZA ('+(4-B.hp)+'/4)');
      if (B.hp===2){ B.phaseB=2; setMsg('LA FALANGE EMITE PULSOS DE INFLAMACION'); }
      if (B.hp<=0){ bossWin(); return; }
    } else hurt(1,P.x<B.x?-5:5);
  }
  // rebote potenciado en paredes cicatrizadas
  if (P.cling){ P.superBounce=1.6; }
  if (P.superBounce>0) P.superBounce-=dt;
}

// Jefe 3: Prisma de Lewy
function boss3(dt){
  B.beams+=dt*1.1;
  // campo gravitatorio hacia el centro
  var dx=B.x-(P.x+P.w/2), dy=B.y-(P.y+P.h/2);
  var d=Math.max(60,Math.sqrt(dx*dx+dy*dy));
  var f=clamp(3000/(d*d)*10,0,0.8);
  P.vx+=dx/d*f; P.vy+=dy/d*f;
  // zarcillos rotatorios
  for (var i=0;i<2;i++){
    var a=B.beams+i*Math.PI;
    var ex=B.x+Math.cos(a)*190, ey=B.y+Math.sin(a)*190;
    // colision segmento-punto aproximada
    for (var s=0.25;s<=1;s+=0.25){
      var sx=lerp(B.x,ex,s), sy=lerp(B.y,ey,s);
      if (Math.abs(P.x+P.w/2-sx)<16 && Math.abs(P.y+P.h/2-sy)<16) hurt(1,(P.x<B.x?-5:5));
    }
  }
  if (overlap(P,{x:B.x-40,y:B.y-40,w:80,h:80})) hurt(1,P.x<B.x?-6:6);
}

// Jefe 4: Nudo Neurofibrilar (vertical)
function boss4(dt){
  if (B.state==='fight') B.state='rise';
  var speed=26+countCut()*10;
  B.knotY-=speed*dt;
  // destruye plataformas al pasar
  for (var i=0;i<L.plats.length;i++){
    var p=L.plats[i];
    if (p.gone||(p.k==='solid'&&p.y>1840)||p.h>40) continue;
    if (p.y>B.knotY-30 && p.y<B.knotY+90 && !p.gone && p.y>200){
      p.gone=true; burst(p.x+p.w/2,p.y,'#c9a2ff',8);
    }
  }
  // deforma plataformas cercanas en trampas
  for (var j=0;j<L.plats.length;j++){
    var q=L.plats[j];
    if (!q.gone && q.k==='solid' && q.h<=40 && q.y<1850 && q.y>B.knotY-260 && q.y<B.knotY-40 && !q.trap){
      q.trap=true; L.spikes.push({x:q.x+6,y:q.y-12,w:q.w-12,h:12});
    }
  }
  if (P.y+P.h>B.knotY-40){ hurt(1,0); P.vy=-10; }
  G.camY=clamp(P.y-300, 0, L.height-H);
}

// Jefe 5: El Silencio Isquemico
function boss5(dt){
  if (B.phaseB===0){ // Fase A: plataformas se apagan por ciclos
    B.ringT-=dt;
    if (B.ringT<=0){
      B.ringT=2.6;
      var litIdx=irnd(0,L.bplats.length-1), litIdx2=(litIdx+irnd(2,4))%L.bplats.length;
      for (var i=0;i<L.bplats.length;i++){ L.bplats[i].lit=(i===litIdx||i===litIdx2); }
      sfx('alarm');
    }
    // plataformas apagadas no colisionan: las marcamos gone temporal
    for (var j=0;j<L.bplats.length;j++){ L.bplats[j].gone=!L.bplats[j].lit; }
    if (overlap(P,{x:B.core.x-30,y:B.core.y-30,w:60,h:60}) && IN.action){
      B.hp--; B.inv=1; sfx('bosshit'); G.shake=0.7;
      burst(B.core.x,B.core.y,'#ff4d4d',24);
      setMsg('CORTOCIRCUITO PARCIAL ('+(3-B.hp)+'/3)');
      if (B.hp===1){ B.phaseB=1; B.shadows=[{x:200,y:300,vx:0,vy:0},{x:760,y:300,vx:0,vy:0}]; setMsg('SOMBRAS RESIDUALES'); }
      if (B.hp<=0){ B.phaseB=2; B.pumps=[{x:200,y:430,ok:0},{x:480,y:430,ok:0},{x:760,y:430,ok:0}]; B.pumpT=0;
        P.canSprint=false; setMsg('SPRINT PERDIDO - ACTIVA LAS BOMBAS Na/K'); }
      P.vy=-9; IN.action=false;
    }
    // nucleo absorbe luz: dano por contacto
    if (overlap(P,{x:B.core.x-34,y:B.core.y-34,w:68,h:68}) && !IN.action) hurt(1,P.x<B.core.x?-5:5);
  } else if (B.phaseB===1){
    // sombras rapidas persiguen
    for (var s=0;s<B.shadows.length;s++){
      var sh=B.shadows[s];
      var dx=(P.x-sh.x), dy=(P.y-sh.y), d=Math.max(1,Math.sqrt(dx*dx+dy*dy));
      sh.vx=lerp(sh.vx,dx/d*3.4,dt*2); sh.vy=lerp(sh.vy,dy/d*3.4,dt*2);
      sh.x+=sh.vx; sh.y+=sh.vy;
      if (overlap(P,{x:sh.x-14,y:sh.y-14,w:28,h:28})) hurt(1,P.x<sh.x?-5:5);
    }
    B.ringT-=dt;
    if (B.ringT<=0){
      B.ringT=2.2;
      var li=irnd(0,L.bplats.length-1), li2=(li+3)%L.bplats.length;
      for (var i=0;i<L.bplats.length;i++){ L.bplats[i].lit=(i===li||i===li2); L.bplats[i].gone=!L.bplats[i].lit; }
    }
    if (overlap(P,{x:B.core.x-30,y:B.core.y-30,w:60,h:60}) && IN.action){
      B.hp--; sfx('bosshit'); G.shake=0.7; burst(B.core.x,B.core.y,'#ff4d4d',24);
      if (B.hp<=0){ B.phaseB=2; B.pumps=[{x:200,y:430,ok:0},{x:480,y:430,ok:0},{x:760,y:430,ok:0}]; B.pumpT=0;
        P.canSprint=false; setMsg('SPRINT PERDIDO - ACTIVA LAS BOMBAS Na/K'); }
      P.vy=-9; IN.action=false;
    }
  } else if (B.phaseB===2){
    // Fase C: bombas de sodio-potasio ritmicas
    B.pumpT+=dt;
    if (B.pumpT>14){ P.canDjump=false; setMsg('DOBLE SALTO PERDIDO'); B.pumpT=-9999; }
    for (var p=0;p<B.pumps.length;p++){
      var pu=B.pumps[p];
      if (pu.ok>=3) continue;
      pu.ph=(pu.ph||0)+dt*1.4;
      var ring=(pu.ph%1);
      // pulsar B cuando el anillo llega al borde
      if (IN.abuf>0 && overlap(P,{x:pu.x-30,y:pu.y-50,w:80,h:70})){
        IN.abuf=0;
        if (ring>0.82||ring<0.1){ pu.ok++; sfx('pumpok'); burst(pu.x+10,pu.y-20,'#7ef7ff',10); }
        else sfx('pump');
      }
    }
    var done=0; for (var q=0;q<B.pumps.length;q++) if (B.pumps[q].ok>=3) done++;
    if (done>=3){ bossWin(); return; }
  }
}

function bossWin(){
  B.won=true; G.flash=0.8; G.shake=0.8;
  sfx('clear');
  burst(B.x||480,B.y||300,'#ffd166',40);
  setTimeout(function(){ levelClear(); }, 1200);
}

function levelClear(){
  var key='p'+G.phase+'l'+G.level;
  var atpPct=Math.round(100*G.levelAtp/Math.max(1,L.atpMax));
  var grade = (G.deaths===0&&atpPct>=70)?'MATRICULA DE HONOR':(G.deaths<=2&&atpPct>=40)?'NOTABLE':'APROBADO';
  var isBoss = L.boss>0;
  if (!G.best[key] || G.levelTime<G.best[key]) G.best[key]=Math.round(G.levelTime);
  // desbloquear siguiente
  var nextLv = G.level+1;
  if (nextLv>5){
    var np=G.phase+1;
    if (np<=5 && (G.unlocked[np]||0)<1) G.unlocked[np]=1;
  } else {
    if ((G.unlocked[G.phase]||0)<nextLv) G.unlocked[G.phase]=nextLv;
  }
  persist();
  G.clearInfo={atp:G.levelAtp, atpMax:L.atpMax, pct:atpPct, time:Math.round(G.levelTime), grade:grade, boss:isBoss,
    last: G.phase===5&&G.level===5 };
  sfx('clear');
  G.screen = G.clearInfo.last ? 'ending' : 'clear';
  G.endingT=0;
  stopMusic();
}

// ---------- Renderizado ----------
var bgParts=[];
function seedBg(){
  bgParts=[];
  for (var i=0;i<70;i++) bgParts.push({x:rnd(0,L?L.len:W), y:rnd(0,L&&L.vert?L.height:H), r:rnd(1,3), s:rnd(0.1,0.5), t:rnd(0,6)});
}
function drawBg(){
  var th=TH();
  var g=CX.createLinearGradient(0,0,0,H);
  g.addColorStop(0,th.sky0); g.addColorStop(1,th.sky1);
  CX.fillStyle=g; CX.fillRect(0,0,W,H);
  // conductos / estructuras de fondo (parallax)
  CX.save();
  CX.globalAlpha=0.35;
  for (var i=0;i<4;i++){
    var off=G.camX*(0.15+i*0.12);
    CX.strokeStyle=th.platTop; CX.lineWidth=22-i*4; CX.globalAlpha=0.10+i*0.03;
    CX.beginPath();
    for (var x=-50;x<W+50;x+=40){
      var yy=H*0.25+i*90+Math.sin((x+off)*0.008+i)*40;
      if (x===-50) CX.moveTo(x,yy); else CX.lineTo(x,yy);
    }
    CX.stroke();
  }
  CX.restore();
  // particulas de fondo
  for (var j=0;j<bgParts.length;j++){
    var b=bgParts[j];
    b.t+=0.016;
    var bx=b.x-G.camX*b.s, by=b.y-(L&&L.vert?G.camY*b.s:0)+Math.sin(b.t)*6;
    var sx=((bx%W)+W)%W;
    CX.globalAlpha=0.25+0.2*Math.sin(b.t*2);
    CX.fillStyle=TH().glow;
    CX.beginPath(); CX.arc(sx,by,b.r,0,7); CX.fill();
  }
  CX.globalAlpha=1;
}
function drawZones(){
  for (var i=0;i<L.zones.length;i++){
    var z=L.zones[i];
    var x=z.x-G.camX, y=z.y-(L.vert?G.camY:0);
    if (x>W||x+z.w<0) continue;
    if (z.k==='slow'){ CX.fillStyle='rgba(255,95,110,0.10)'; }
    else if (z.k==='sticky'){ CX.fillStyle='rgba(255,179,71,0.16)'; }
    else if (z.k==='freeze'){ CX.fillStyle='rgba(160,220,255,0.10)'; }
    else if (z.k==='flip'){ CX.fillStyle='rgba(201,162,255,0.08)'; }
    else if (z.k==='vacuum'){ CX.fillStyle='rgba(157,180,192,0.08)'; }
    else if (z.k==='anoxia'){ CX.fillStyle='rgba(40,50,60,0.28)'; }
    else if (z.k==='fog'){ CX.fillStyle='rgba(120,40,60,0.10)'; }
    else continue;
    CX.fillRect(x,y,z.w,z.h);
    CX.strokeStyle='rgba(255,255,255,0.07)';
    CX.strokeRect(x,y,z.w,z.h);
  }
}
function drawPlats(){
  var th=TH();
  for (var i=0;i<L.plats.length;i++){
    var p=L.plats[i];
    if (p.gone) continue;
    var x=p.x-G.camX, y=p.y-(L.vert?G.camY:0);
    if (x>W+80||x+p.w<-80) continue;
    var alpha=1;
    if (p.k==='vanish'){
      if (p.seen<0) alpha=1;
      else if (p.seen<2) alpha=1;
      else alpha=0.06; // memorizada: casi invisible
    }
    CX.globalAlpha=alpha;
    if (p.k==='rotate' && p.rx1!==undefined){
      CX.strokeStyle=th.platTop; CX.lineWidth=10; CX.lineCap='round';
      CX.beginPath(); CX.moveTo(p.rx1-G.camX,p.ry1-(L.vert?G.camY:0)); CX.lineTo(p.rx2-G.camX,p.ry2-(L.vert?G.camY:0)); CX.stroke();
      CX.fillStyle=th.glow;
      CX.beginPath(); CX.arc(p.cx-G.camX,p.cy-(L.vert?G.camY:0),7,0,7); CX.fill();
      CX.globalAlpha=1; continue;
    }
    var wob=0;
    if ((p.k==='crumble'||p.k==='fragile')&&p.step>0) wob=Math.sin(p.step*40)*2;
    if (p.k==='bosslit' && !p.lit) CX.globalAlpha=0.12;
    CX.fillStyle=p.k==='charged'?(p.pol>0?'#3a2f10':'#0f2f3a'):th.plat;
    CX.fillRect(x,y+wob,p.w,p.h);
    CX.fillStyle=p.k==='charged'?(p.pol>0?'#ffd166':'#4dd8ff'):th.platTop;
    CX.fillRect(x,y+wob,p.w,4);
    if (p.k==='charged'){
      CX.font='bold 16px Courier New'; CX.textAlign='center'; CX.fillStyle=p.pol>0?'#ffd166':'#4dd8ff';
      CX.fillText(p.pol>0?'+':'-', x+p.w/2, y+p.h/2+24);
    }
    if (p.trap){ CX.fillStyle='#ff5f6e'; for (var t2=0;t2<p.w;t2+=14){ CX.beginPath(); CX.moveTo(x+t2,y); CX.lineTo(x+t2+7,y-10); CX.lineTo(x+t2+14,y); CX.fill(); } }
    CX.globalAlpha=1;
  }
  // picos
  CX.fillStyle=TH().glow;
  for (var s=0;s<L.spikes.length;s++){
    var sp=L.spikes[s], sx=sp.x-G.camX, sy=sp.y-(L.vert?G.camY:0);
    if (sx>W||sx+sp.w<0) continue;
    for (var k=0;k<sp.w;k+=16){
      CX.beginPath(); CX.moveTo(sx+k,sy+sp.h); CX.lineTo(sx+k+8,sy); CX.lineTo(sx+k+16,sy+sp.h); CX.fill();
    }
  }
}
function drawItems(){
  for (var i=0;i<L.items.length;i++){
    var it=L.items[i];
    if (it.got) continue;
    var x=it.x-G.camX, y=it.y-(L.vert?G.camY:0)+Math.sin(it.t*3)*3;
    if (x<-30||x>W+30) continue;
    if (it.k==='atp'){
      var p=1+0.15*Math.sin(it.t*5);
      CX.save(); CX.translate(x,y); CX.scale(p,p);
      CX.fillStyle='#ffd166';
      CX.beginPath(); CX.arc(0,0,8,0,7); CX.fill();
      CX.fillStyle='#fff3c4';
      CX.beginPath(); CX.arc(-2,-2,3.5,0,7); CX.fill();
      CX.restore();
    } else if (it.k==='o2'){
      CX.fillStyle='#7ef7ff';
      CX.beginPath(); CX.arc(x,y,11,0,7); CX.fill();
      CX.fillStyle='#053040'; CX.font='bold 11px Courier New'; CX.textAlign='center';
      CX.fillText('O2',x,y+4);
    }
  }
  // checkpoints
  for (var c=0;c<L.cps.length;c++){
    var cp=L.cps[c], cx2=cp.x-G.camX, cy2=cp.y-(L.vert?G.camY:0);
    CX.strokeStyle=cp.on?'#7ef7ff':'#5a7a8a'; CX.lineWidth=3;
    CX.beginPath(); CX.moveTo(cx2+10,cy2); CX.lineTo(cx2+10,cy2+44); CX.stroke();
    CX.fillStyle=cp.on?'#7ef7ff':'#3a4a55';
    CX.beginPath(); CX.moveTo(cx2+10,cy2); CX.lineTo(cx2+34,cy2+10); CX.lineTo(cx2+10,cy2+20); CX.fill();
  }
  // meta
  if (L.goal){
    var gx=L.goal.x-G.camX, gy=L.goal.y-(L.vert?G.camY:0);
    var pulse=1+0.1*Math.sin(G.levelTime*4);
    CX.save(); CX.translate(gx+22,gy+34); CX.scale(pulse,pulse);
    CX.strokeStyle=TH().glow; CX.lineWidth=4;
    CX.beginPath(); CX.arc(0,0,26,0,7); CX.stroke();
    CX.beginPath(); CX.arc(0,0,14,0,7); CX.stroke();
    CX.fillStyle=TH().accent;
    CX.beginPath(); CX.arc(0,0,6,0,7); CX.fill();
    CX.restore();
  }
}
function drawFoes(){
  for (var i=0;i<L.foes.length;i++){
    var f=L.foes[i];
    if (f.dead) continue;
    var x=f.x-G.camX, y=f.y-(L.vert?G.camY:0);
    if (x<-60||x>W+60) continue;
    var stun=f.stun>0;
    if (f.k==='crawler'){
      CX.fillStyle=stun?'#5a6a70':'#c96a7a';
      CX.beginPath(); CX.ellipse(x+15,y+16,15,12,0,0,7); CX.fill();
      CX.fillStyle=stun?'#8a9aa0':'#ff8f9e';
      for (var s=0;s<5;s++){ var a=s/5*Math.PI-Math.PI;
        CX.beginPath(); CX.moveTo(x+15+Math.cos(a)*10,y+8+Math.sin(a)*6);
        CX.lineTo(x+15+Math.cos(a)*17,y+4+Math.sin(a)*13); CX.lineTo(x+15+Math.cos(a+0.5)*10,y+8+Math.sin(a+0.5)*6); CX.fill(); }
      CX.fillStyle='#fff'; CX.beginPath(); CX.arc(x+15+(f.vx>0?5:-5),y+13,3,0,7); CX.fill();
      CX.fillStyle='#000'; CX.beginPath(); CX.arc(x+15+(f.vx>0?5:-5),y+13,1.4,0,7); CX.fill();
    } else if (f.k==='flyer'){
      var wob=Math.sin(f.t*10)*4;
      CX.fillStyle=stun?'#5a6a70':'#e8b4ff';
      CX.beginPath(); CX.ellipse(x+14-wob*0.5,y+10,10,5,-0.5,0,7); CX.fill();
      CX.beginPath(); CX.ellipse(x+14+wob*0.5,y+10,10,5,0.5,0,7); CX.fill();
      CX.fillStyle=stun?'#7a8a90':'#b04fd0';
      CX.beginPath(); CX.arc(x+14,y+14,9,0,7); CX.fill();
      CX.fillStyle='#2a0a33'; CX.beginPath(); CX.arc(x+14,y+14,4,0,7); CX.fill();
    }
    if (stun){ CX.fillStyle='#4dd8ff'; CX.font='10px Courier New'; CX.textAlign='center'; CX.fillText('~',x+14,y-4); }
  }
}
function drawPlayer(){
  if (P.dead) return;
  var x=P.x-G.camX+P.w/2, y=P.y-(L.vert?G.camY:0)+P.h/2;
  // estela
  for (var i=0;i<P.trail.length;i++){
    var t=P.trail[i];
    CX.globalAlpha=Math.max(0,t.t)*0.7;
    CX.fillStyle=P.pol>0?'#ffd166':'#4dd8ff';
    CX.beginPath(); CX.arc(t.x-G.camX,t.y-(L.vert?G.camY:0),6*t.t*2.4,0,7); CX.fill();
  }
  CX.globalAlpha=1;
  if (P.inv>0 && Math.floor(P.inv*12)%2===0) CX.globalAlpha=0.35;
  var col=P.pol>0?'#ffd166':'#4dd8ff';
  var tt=G.levelTime;
  var hurt=P.inv>0.4;
  // squash & stretch segun estado
  var sq=1, st=1;
  if (!P.onGround && !P.cling){ st=Math.min(1.22, 1+Math.abs(P.vy)*0.018); sq=1/Math.sqrt(st); }
  else if (P.onGround && Math.abs(P.vx)>2.5){ sq=1.08; st=0.93; }
  CX.save();
  CX.translate(x,y);
  if (P.grav<0) CX.scale(1,-1);
  CX.scale(sq,st);
  // nucleo luminoso
  CX.shadowColor=col; CX.shadowBlur=18;
  CX.fillStyle=col;
  CX.beginPath(); CX.arc(0,0,11,0,7); CX.fill();
  CX.shadowBlur=0;
  CX.fillStyle='#fff';
  CX.beginPath(); CX.arc(0,0,6.6,0,7); CX.fill();
  // bracitos de chispa (gestos al correr, saltar y caer)
  var run=P.onGround && Math.abs(P.vx)>1.5;
  var air=!P.onGround && !P.cling;
  var wob=run?Math.sin(tt*18)*3:0;
  var armUp=air?(P.vy<0?5:2):1;
  CX.strokeStyle=col; CX.lineWidth=2; CX.lineCap='round';
  CX.beginPath(); CX.moveTo(-8,0); CX.quadraticCurveTo(-12,-2-wob,-14.5,-3-armUp-wob); CX.stroke();
  CX.beginPath(); CX.moveTo(8,0); CX.quadraticCurveTo(12,-2+wob,14.5,-3-armUp+wob); CX.stroke();
  // ojos expresivos (mirada hacia el movimiento)
  var blink=(tt%3.4)<0.12 && P.onGround && !hurt;
  var lookX=P.face*1.5, lookY=air?(P.vy>2?1.3:(P.vy<-2?-1.1:0)):0;
  for (var e=-1;e<=1;e+=2){
    var ex=e*3.1+lookX*0.4, ey=-2.1;
    if (blink){ CX.strokeStyle='#0a1420'; CX.lineWidth=1.4;
      CX.beginPath(); CX.moveTo(ex-1.8,ey); CX.lineTo(ex+1.8,ey); CX.stroke(); }
    else if (hurt){ CX.strokeStyle='#0a1420'; CX.lineWidth=1.3;
      CX.beginPath(); CX.moveTo(ex-1.6,ey-1.5); CX.lineTo(ex+1.6,ey+1.5);
      CX.moveTo(ex+1.6,ey-1.5); CX.lineTo(ex-1.6,ey+1.5); CX.stroke(); }
    else {
      CX.fillStyle='#fff'; CX.beginPath(); CX.arc(ex,ey,2.7,0,7); CX.fill();
      CX.strokeStyle='rgba(10,20,32,0.4)'; CX.lineWidth=0.7;
      CX.beginPath(); CX.arc(ex,ey,2.7,0,7); CX.stroke();
      CX.fillStyle='#0a1420'; CX.beginPath(); CX.arc(ex+lookX*0.9,ey+lookY*0.9,1.5,0,7); CX.fill();
      CX.fillStyle='#fff'; CX.beginPath(); CX.arc(ex+lookX*0.9-0.5,ey+lookY*0.9-0.6,0.55,0,7); CX.fill();
    }
  }
  // cejas
  if (!blink && !hurt){
    CX.strokeStyle='#0a1420'; CX.lineWidth=1.1;
    var by=-5.7, tl=air?0.7:0;
    CX.beginPath(); CX.moveTo(-4.6+lookX*0.4,by+tl); CX.lineTo(-1.8+lookX*0.4,by-tl); CX.stroke();
    CX.beginPath(); CX.moveTo(1.8+lookX*0.4,by-tl); CX.lineTo(4.6+lookX*0.4,by+tl); CX.stroke();
  }
  // boca
  CX.strokeStyle='#0a1420'; CX.lineWidth=1.3; CX.lineCap='round';
  if (hurt){ CX.beginPath(); CX.arc(0,4.6,1.9,Math.PI*1.15,Math.PI*1.85); CX.stroke(); }
  else if (air && P.vy>4){ CX.fillStyle='#0a1420'; CX.beginPath(); CX.arc(0,3.1,1.5,0,7); CX.fill(); }
  else { CX.beginPath(); CX.arc(0,1.5,2.5,Math.PI*0.2,Math.PI*0.8); CX.stroke(); }
  CX.restore();
  // chispas orbitales
  CX.strokeStyle=col; CX.lineWidth=2; CX.lineCap='round';
  for (var s=0;s<4;s++){
    var a=tt*6+s*Math.PI/2;
    CX.beginPath(); CX.moveTo(x+Math.cos(a)*13,y+Math.sin(a)*13);
    CX.lineTo(x+Math.cos(a)*18,y+Math.sin(a)*18); CX.stroke();
  }
  CX.globalAlpha=1;
}
function drawBoss(){
  if (!B||B.won) return;
  var bx=B.x-G.camX, by=B.y-(L&&L.vert?G.camY:0);
  CX.save();
  if (B.kind===1){
    var st=B.stun>0;
    CX.shadowColor='#ff8f9e'; CX.shadowBlur=24;
    CX.fillStyle=st?'#7a5a60':'#c96a7a';
    CX.beginPath(); CX.arc(bx,by-14,40,0,7); CX.fill();
    CX.shadowBlur=0;
    CX.fillStyle=st?'#aaffc9':'#8a2438';
    CX.beginPath(); CX.arc(bx,by-14,17,0,7); CX.fill(); // nucleo
    CX.fillStyle='#fff';
    CX.beginPath(); CX.arc(bx-14,by-26,6,0,7); CX.fill();
    CX.beginPath(); CX.arc(bx+14,by-26,6,0,7); CX.fill();
    CX.fillStyle='#000';
    CX.beginPath(); CX.arc(bx-14,by-26,2.6,0,7); CX.fill();
    CX.beginPath(); CX.arc(bx+14,by-26,2.6,0,7); CX.fill();
    if (B.state==='tele'){ CX.strokeStyle='#ff4d4d'; CX.lineWidth=3; CX.setLineDash([6,6]);
      CX.beginPath(); CX.arc(bx,by-14,52,0,7); CX.stroke(); CX.setLineDash([]); }
  } else if (B.kind===2){
    CX.shadowColor='#e8b4ff'; CX.shadowBlur=26;
    CX.fillStyle='#8a4f9e';
    CX.beginPath(); CX.arc(bx,by,38,0,7); CX.fill();
    CX.beginPath(); CX.arc(bx-24,by+12,22,0,7); CX.fill();
    CX.beginPath(); CX.arc(bx+24,by+12,22,0,7); CX.fill();
    CX.shadowBlur=0;
    CX.strokeStyle='#ffd6ff'; CX.lineWidth=4;
    CX.beginPath(); CX.arc(bx,by,50+Math.sin(B.t*4)*4,0,7); CX.stroke(); // escudo
    CX.fillStyle='#2a0a33'; CX.beginPath(); CX.arc(bx,by,12,0,7); CX.fill();
  } else if (B.kind===3){
    CX.shadowColor='#ffb347'; CX.shadowBlur=30;
    CX.fillStyle='#5a4a2a';
    CX.beginPath(); CX.arc(bx,by,44,0,7); CX.fill();
    CX.shadowBlur=0;
    CX.strokeStyle='#ffb347'; CX.lineWidth=2;
    for (var f=0;f<6;f++){ var a0=f*Math.PI/3+B.t*0.5;
      CX.beginPath(); CX.moveTo(bx,by);
      CX.lineTo(bx+Math.cos(a0)*(30+8*Math.sin(B.t*3+f)),by+Math.sin(a0)*(30+8*Math.sin(B.t*3+f))); CX.stroke(); }
    CX.strokeStyle='#ff8f4d'; CX.lineWidth=7; CX.lineCap='round';
    for (var i=0;i<2;i++){ var a=B.beams+i*Math.PI;
      CX.beginPath(); CX.moveTo(bx,by); CX.lineTo(bx+Math.cos(a)*190,by+Math.sin(a)*190); CX.stroke(); }
    CX.fillStyle='#1a1005'; CX.beginPath(); CX.arc(bx,by,16,0,7); CX.fill();
  } else if (B.kind===4){
    var ky=B.knotY-(L.vert?G.camY:0);
    CX.shadowColor='#c9a2ff'; CX.shadowBlur=30;
    CX.fillStyle='#3a2f55';
    CX.beginPath();
    for (var s2=0;s2<12;s2++){ var a2=s2/12*Math.PI*2;
      var r2=60+18*Math.sin(B.t*3+s2);
      var px2=480-G.camX+Math.cos(a2)*r2, py2=ky+Math.sin(a2)*r2*0.6;
      if (s2===0) CX.moveTo(px2,py2); else CX.lineTo(px2,py2); }
    CX.closePath(); CX.fill();
    CX.shadowBlur=0;
    CX.fillStyle='#c9a2ff';
    CX.beginPath(); CX.arc(480-G.camX,ky,14,0,7); CX.fill();
  } else if (B.kind===5){
    var cx3=B.core.x-G.camX, cy3=B.core.y;
    CX.shadowColor='#ff4d4d'; CX.shadowBlur=30;
    CX.fillStyle='#14080a';
    CX.beginPath(); CX.arc(cx3,cy3,34+4*Math.sin(B.t*2),0,7); CX.fill();
    CX.shadowBlur=0;
    CX.strokeStyle='#ff4d4d'; CX.lineWidth=3;
    CX.beginPath(); CX.arc(cx3,cy3,40+6*Math.sin(B.t*2),0,7); CX.stroke();
    if (B.phaseB===1){
      for (var s3=0;s3<B.shadows.length;s3++){
        var sh=B.shadows[s3];
        CX.fillStyle='rgba(255,77,77,0.7)';
        CX.beginPath(); CX.arc(sh.x-G.camX,sh.y,14,0,7); CX.fill();
        CX.fillStyle='#fff'; CX.beginPath(); CX.arc(sh.x-G.camX,sh.y,4,0,7); CX.fill();
      }
    }
  }
  CX.restore();
}

function drawPadsTerms(){
  var th=TH();
  if (L.pads) for (var i=0;i<L.pads.length;i++){
    var p=L.pads[i], x=p.x-G.camX;
    CX.fillStyle=p.on>0?'#ffd166':'#3a3f4a';
    CX.fillRect(x,p.y,p.w,10);
    if (p.on>0){ CX.fillStyle='rgba(255,209,102,0.4)'; CX.fillRect(x,p.y-16,p.w,16); }
  }
  if (L.terms) for (var t=0;t<L.terms.length;t++){
    var m=L.terms[t], x2=m.x-G.camX;
    CX.fillStyle=m.on?'#7ef7ff':(m.ch>0?'#4dd8ff':'#3a3f4a');
    CX.fillRect(x2,m.y,m.w,10);
    CX.fillStyle=m.on?'#7ef7ff':'#22303a';
    CX.fillRect(x2+10,m.y-14,m.w-20,14);
    if (!m.on&&m.ch>0){ CX.fillStyle='#4dd8ff'; CX.fillRect(x2,m.y+12,m.w*m.ch,4); }
  }
  if (L.anchors) for (var a=0;a<L.anchors.length;a++){
    var an=L.anchors[a], x3=an.x-G.camX, y3=an.y-(L.vert?G.camY:0);
    CX.strokeStyle=an.cut?'#5a4a7a':'#c9a2ff'; CX.lineWidth=4;
    CX.beginPath(); CX.moveTo(x3+14,0-(L.vert?G.camY:0)+200-200+y3-40); CX.lineTo(x3+14,y3); CX.stroke();
    CX.fillStyle=an.cut?'#3a2f4d':'#c9a2ff';
    CX.beginPath(); CX.arc(x3+14,y3+8,10,0,7); CX.fill();
    if (an.cut){ CX.strokeStyle='#7a6a9a'; CX.beginPath(); CX.moveTo(x3+6,y3+18); CX.lineTo(x3+22,y3+26); CX.stroke(); }
  }
  if (B&&B.kind===5&&B.phaseB===2&&B.pumps){
    for (var pu=0;pu<B.pumps.length;pu++){
      var pum=B.pumps[pu], x4=pum.x-G.camX;
      CX.fillStyle=pum.ok>=3?'#7ef7ff':'#3a4a55';
      CX.fillRect(x4,pum.y,40,40);
      CX.fillStyle='#0a1420'; CX.font='bold 10px Courier New'; CX.textAlign='center';
      CX.fillText('Na/K',x4+20,pum.y+24);
      if (pum.ok<3){
        var ring=(pum.ph%1);
        CX.strokeStyle='rgba(126,247,255,'+(1-ring)+')'; CX.lineWidth=3;
        CX.beginPath(); CX.arc(x4+20,pum.y-20,8+ring*40,0,7); CX.stroke();
        CX.strokeStyle='#ffd166'; CX.lineWidth=1;
        CX.beginPath(); CX.arc(x4+20,pum.y-20,44,0,7); CX.stroke();
        CX.fillStyle='#ffd166'; CX.fillText(pum.ok+'/3',x4+20,pum.y-70);
      }
    }
  }
}
function drawChaseAndTraps(){
  if (L.flags.chase){
    var x=L.waveX-G.camX;
    var g=CX.createLinearGradient(x-120,0,x+30,0);
    g.addColorStop(0,'rgba(62,198,255,0)');
    g.addColorStop(1,'rgba(120,230,255,0.75)');
    CX.fillStyle=g; CX.fillRect(x-120,0,150,H);
    CX.fillStyle='rgba(220,250,255,0.9)';
    for (var i=0;i<8;i++) CX.fillRect(x+rnd(-8,8), rnd(0,H), 3, rnd(10,30));
  }
  if (L.iontrap){
    var t=L.iontrap, x2=t.x-G.camX;
    CX.fillStyle='#a0e8ff';
    CX.fillRect(x2,t.y,t.w,t.h);
    CX.fillStyle='#fff'; CX.fillRect(x2+6,t.y+6,t.w-12,8);
  }
}
function drawParticles(){
  for (var i=0;i<particles.length;i++){
    var q=particles[i];
    CX.globalAlpha=Math.min(1,q.t*2);
    CX.fillStyle=q.col;
    CX.beginPath(); CX.arc(q.x-G.camX,q.y-(L&&L.vert?G.camY:0),q.r,0,7); CX.fill();
  }
  CX.globalAlpha=1;
  for (var k=0;k<projectiles.length;k++){
    var b=projectiles[k];
    var x=b.x-G.camX, y=b.y-(L&&L.vert?G.camY:0);
    CX.fillStyle=b.kind==='ring'?'#ff9d9d':'#baffc9';
    CX.beginPath(); CX.arc(x,y,b.kind==='ring'?10:6,0,7); CX.fill();
    if (b.kind==='ring'){ CX.strokeStyle='#ff4d4d'; CX.lineWidth=2; CX.beginPath(); CX.arc(x,y,14,0,7); CX.stroke(); }
  }
}
function drawFogMask(){
  if (!P.inFog) return;
  var x=P.x-G.camX+P.w/2, y=P.y+P.h/2;
  var g=CX.createRadialGradient(x,y,60,x,y,210);
  g.addColorStop(0,'rgba(0,0,0,0)');
  g.addColorStop(1,'rgba(10,4,8,0.88)');
  CX.fillStyle=g; CX.fillRect(0,0,W,H);
}
function drawHUD(){
  var th=TH();
  CX.fillStyle='rgba(5,8,14,0.55)'; CX.fillRect(0,0,W,44);
  CX.fillStyle=th.accent; CX.font='bold 16px Courier New'; CX.textAlign='left';
  CX.fillText('ATP '+G.atp, 14, 28);
  // carga vital
  for (var i=0;i<3;i++){
    CX.fillStyle=i<G.hp?th.glow:'#2a3440';
    CX.beginPath(); CX.arc(110+i*24,22,8,0,7); CX.fill();
  }
  // polaridad
  CX.fillStyle=P.pol>0?'#ffd166':'#4dd8ff';
  CX.font='bold 18px Courier New';
  CX.fillText(P.pol>0?'POL +':'POL -', 200, 28);
  CX.fillStyle='#8fa8b8'; CX.font='13px Courier New';
  CX.fillText(PHASE_INFO[G.phase-1].tit+'-'+G.level+'  '+L.name, 300, 27);
  CX.textAlign='right'; CX.fillStyle='#8fa8b8';
  CX.fillText(Math.floor(G.levelTime)+'s', W-14, 28);
  // barra O2
  if (inZoneHudAnoxia() || P.o2<0.999){
    CX.fillStyle='#22303a'; CX.fillRect(W/2-110,52,220,12);
    CX.fillStyle=P.o2>0.3?'#7ef7ff':'#ff4d4d'; CX.fillRect(W/2-108,54,216*P.o2,8);
    CX.fillStyle='#cfe8f4'; CX.font='11px Courier New'; CX.textAlign='center';
    CX.fillText('OXIGENO', W/2, 78);
  }
  // barra jefe
  if (B&&!B.won&&B.state!=='intro'){
    CX.fillStyle='rgba(5,8,14,0.55)'; CX.fillRect(W/2-160,H-30,320,18);
    CX.fillStyle='#3a1420'; CX.fillRect(W/2-156,H-27,312,12);
    CX.fillStyle='#ff4d4d'; CX.fillRect(W/2-156,H-27,312*Math.max(0,B.hp)/B.maxhp,12);
  }
  // mensajes
  if (G.msgT>0){
    CX.fillStyle='rgba(5,8,14,0.7)';
    CX.font='bold 17px Courier New'; CX.textAlign='center';
    var tw=CX.measureText(G.msg).width+30;
    CX.fillRect(W/2-tw/2,90,tw,32);
    CX.fillStyle=th.accent;
    CX.fillText(G.msg,W/2,112);
  }
  // banner de nivel
  if (G.bannerT>0){
    CX.globalAlpha=Math.min(1,G.bannerT);
    CX.fillStyle='rgba(5,8,14,0.75)'; CX.fillRect(0,H/2-70,W,110);
    CX.fillStyle=th.glow; CX.font='bold 30px Courier New'; CX.textAlign='center';
    CX.fillText(G.banner,W/2,H/2-24);
    CX.fillStyle=th.accent; CX.font='16px Courier New';
    CX.fillText(G.bannerSub,W/2,H/2+8);
    CX.globalAlpha=1;
  }
  if (G.flash>0){ CX.fillStyle='rgba(255,255,255,'+G.flash*0.5+')'; CX.fillRect(0,0,W,H); }
}
function inZoneHudAnoxia(){
  if (!L) return false;
  for (var i=0;i<L.zones.length;i++) if (L.zones[i].k==='anoxia') return true;
  return false;
}
function drawPlay(){
  CX.save();
  if (G.shake>0){ CX.translate(rnd(-1,1)*G.shake*10, rnd(-1,1)*G.shake*10); }
  drawBg();
  drawZones();
  drawPlats();
  drawPadsTerms();
  drawItems();
  drawFoes();
  drawBoss();
  drawPlayer();
  drawParticles();
  drawChaseAndTraps();
  drawFogMask();
  CX.restore();
  drawHUD();
}

// ---------- Pantallas y menus ----------
var MENU_TITLE=['JUGAR','GUIA','OPCIONES'];
var MENU_PAUSE=['REANUDAR','GUIA','REINICIAR NIVEL','SALIR AL MENU'];
var MENU_OPT=['SONIDO: ','CONTROLES TACTILES: ','BORRAR PROGRESO','VOLVER'];
var OPT_TOUCH=['AUTO','SIEMPRE','NUNCA'];
var MENU_CLEAR=['CONTINUAR','REPETIR NIVEL','SALIR AL MENU'];

function menuItems(){
  if (G.screen==='title') return MENU_TITLE;
  if (G.screen==='pause') return MENU_PAUSE;
  if (G.screen==='options') return MENU_OPT;
  if (G.screen==='clear') return MENU_CLEAR;
  return [];
}
function menuKey(code){
  var items=menuItems();
  if (G.screen==='guide'){
    if (code==='ArrowRight'||code==='Space') G.guidePage=(G.guidePage+1)%GUIDE.length;
    if (code==='ArrowLeft') G.guidePage=(G.guidePage+GUIDE.length-1)%GUIDE.length;
    if (code==='Escape'||code==='KeyP'||code==='Enter') G.screen=G.guideFrom||'title';
    return;
  }
  if (G.screen==='phases'){
    if (code==='ArrowLeft') G.selPhase=Math.max(1,G.selPhase-1);
    if (code==='ArrowRight') G.selPhase=Math.min(5,G.selPhase+1);
    if (code==='ArrowUp') G.selLevel=Math.max(1,G.selLevel-1);
    if (code==='ArrowDown') G.selLevel=Math.min(5,G.selLevel+1);
    if (code==='Enter'||code==='Space') tryStartSel();
    if (code==='Escape') G.screen='title';
    return;
  }
  if (G.screen==='ending'){ if (code==='Enter'||code==='Space'||code==='Escape') G.screen='title'; return; }
  if (!items.length) return;
  if (code==='ArrowUp'){ G.sel=(G.sel+items.length-1)%items.length; sfx('pump'); }
  if (code==='ArrowDown'){ G.sel=(G.sel+1)%items.length; sfx('pump'); }
  if (code==='ArrowLeft'&&G.screen==='options') optAdjust(-1);
  if (code==='ArrowRight'&&G.screen==='options') optAdjust(1);
  if (code==='Enter'||code==='Space') menuConfirm();
  if (code==='Escape'&&G.screen==='options'){ G.screen='title'; G.sel=0; }
}
function tryStartSel(){
  var ok=(G.unlocked[G.selPhase]||0)>=G.selLevel;
  if (ok){ G.screen='play'; startLevel(G.selPhase,G.selLevel); }
  else { setMsg('NIVEL BLOQUEADO'); sfx('alarm'); }
}
function menuConfirm(){
  ensureAudio();
  if (G.screen==='title'){
    if (G.sel===0){ G.screen='phases'; G.selPhase=1; G.selLevel=1; }
    if (G.sel===1){ G.guideFrom='title'; G.guidePage=0; G.screen='guide'; }
    if (G.sel===2){ G.screen='options'; G.sel=0; }
  } else if (G.screen==='pause'){
    if (G.sel===0){ G.screen='play'; startMusic(); }
    if (G.sel===1){ G.guideFrom='pause'; G.guidePage=0; G.screen='guide'; }
    if (G.sel===2){ startLevel(G.phase,G.level); }
    if (G.sel===3){ G.screen='title'; G.sel=0; stopMusic(); }
  } else if (G.screen==='options'){
    if (G.sel===0){ G.sound=!G.sound; persist(); if(G.sound){ensureAudio();startMusic();} else stopMusic(); }
    if (G.sel===1){ cycleTouch(); }
    if (G.sel===2){ G.unlocked={1:1}; G.best={}; G.totalAtp=0; persist(); setMsg('PROGRESO BORRADO'); }
    if (G.sel===3){ G.screen='title'; G.sel=0; }
  } else if (G.screen==='clear'){
    if (G.sel===0){
      var nl=G.level+1, np=G.phase;
      if (nl>5){ nl=1; np=G.phase+1; }
      if (np>5){ G.screen='title'; }
      else { G.selPhase=np; G.selLevel=nl; startLevel(np,nl); }
    }
    if (G.sel===1) startLevel(G.phase,G.level);
    if (G.sel===2){ G.screen='title'; G.sel=0; }
  }
}
function cycleTouch(){
  var i=OPT_TOUCH.indexOf(G.touchUI==='on'?'SIEMPRE':G.touchUI==='off'?'NUNCA':'AUTO');
  i=(i+1)%3;
  G.touchUI=(['auto','on','off'])[i];
  applyTouchUI(); persist();
}
function optAdjust(dir){
  if (G.sel===0){ G.sound=!G.sound; persist(); if(G.sound){ensureAudio();startMusic();} else stopMusic(); }
  if (G.sel===1) cycleTouch();
}

// Tap tactil en menus
function handleTap(){
  if (tapX<0) return;
  var x=tapX, y=tapY; tapX=-1; tapY=-1;
  ensureAudio();
  if (G.screen==='guide'){ G.guidePage=(G.guidePage+1)%GUIDE.length; return; }
  if (G.screen==='ending'){ G.screen='title'; return; }
  if (G.screen==='phases'){
    // fases arriba, niveles abajo
    for (var p=1;p<=5;p++){
      var bx=W/2-350+(p-1)*175;
      if (x>bx&&x<bx+150&&y>150&&y<230){ G.selPhase=p; return; }
    }
    for (var l=1;l<=5;l++){
      var bx2=W/2-350+(l-1)*175;
      if (x>bx2&&x<bx2+150&&y>312&&y<368){ G.selLevel=l; tryStartSel(); return; }
    }
    if (y>H-70) G.screen='title';
    return;
  }
  var items=menuItems();
  if (!items.length) return;
  for (var i=0;i<items.length;i++){
    var my=240+i*52;
    if (x>W/2-200&&x<W/2+200&&y>my-20&&y<my+24){ G.sel=i;
      if (G.screen==='options'&&(i===0||i===1)) optAdjust(1); else menuConfirm();
      return; }
  }
}

// ---------- Guia in-app ----------
var GUIDE=[
  { t:'VOLT, PULSO BIOELECTRICO', lines:[
    'Eres Volt, un pulso bioelectrico consciente atrapado',
    'en un circuito neural de ficcion. Tu energia vital',
    'son 3 cargas. Si las pierdes, vuelves al relevo.',
    '',
    'Recoge vesiculas de ATP para subir tu marca.',
    'Al final de cada nivel recibes un grado:',
    'APROBADO / NOTABLE / MATRICULA DE HONOR.' ]},
  { t:'CONTROLES', lines:[
    'MOVERSE:      flechas o A/D        (tactil: < y >)',
    'SALTAR:       espacio, W o Z       (tactil: A)',
    'DOBLE SALTO:  salta otra vez en el aire',
    'SPRINT:       manten Shift         (tactil: R)',
    'POLARIDAD:    X o J alterna + / -  (tactil: B)',
    'PAUSA:        P o Escape           (tactil: II)' ]},
  { t:'POLARIDAD + / -', lines:[
    'Alterna la carga de Volt con el boton de accion.',
    '',
    '- Paredes marcadas con tu MISMA carga: te adhieres',
    '  y puedes saltar desde ellas.',
    '- Carga OPUESTA: la pared te repele.',
    '- Enemigos con carga opuesta a la tuya: sobrecargalos',
    '  de cerca con B para aturdirlos, o saltalos encima.' ]},
  { t:'TERMINALES Y RECEPTORES', lines:[
    'Los receptores del suelo se electrifican pulsando B',
    'encima: usalos contra el Macrofago Primario.',
    '',
    'Las terminales inactivas se canalizan manteniendo B',
    'sobre ellas: recargan el circuito contra el Prisma.',
    '',
    'Las bombas Na/K piden pulsar B cuando el anillo',
    'azul llega al anillo ambar. Tres aciertos por bomba.' ]},
  { t:'CINCO ENTORNOS', lines:[
    'F1 La Autopista Axonal: aprende inercia y polaridad.',
    'F2 Las Vias Desnudas: zonas lentas, niebla, mielina',
    '   que se autodestruye.',
    'F3 La Forja Negra: temblor, bloques rompibles,',
    '   congelamiento (machaca salto o B para liberarte).',
    'F4 El Laberinto: puentes giratorios, placas adhesivas,',
    '   plataformas que se vuelven invisibles (memorizalas),',
    '   gravedad invertida.',
    'F5 El Apagon: vacios de presion, anoxia (recarga O2),',
    '   fragmentos que se extinguen tras pisarlos.' ]},
  { t:'FICCION, NO MEDICINA', lines:[
    'Axon: Synaptic Breach es una obra de ficcion.',
    'Sus entornos, criaturas y mecanismos son fantasticos',
    'y no describen procesos biologicos reales ni sirven',
    'como informacion medica.',
    '',
    'Juego original en HTML, CSS y JS. Sin recursos ajenos.',
    'Musica y efectos sintetizados en tiempo real.' ]}
];

function drawGuide(){
  var th=TH();
  CX.fillStyle='#05070d'; CX.fillRect(0,0,W,H);
  CX.strokeStyle=th.glow; CX.lineWidth=2; CX.strokeRect(30,30,W-60,H-60);
  CX.fillStyle=th.glow; CX.font='bold 26px Courier New'; CX.textAlign='center';
  CX.fillText(GUIDE[G.guidePage].t, W/2, 90);
  CX.fillStyle='#cfe0ea'; CX.font='17px Courier New';
  for (var i=0;i<GUIDE[G.guidePage].lines.length;i++)
    CX.fillText(GUIDE[G.guidePage].lines[i], W/2, 140+i*30);
  CX.fillStyle='#8fa8b8'; CX.font='14px Courier New';
  CX.fillText((G.guidePage+1)+'/'+GUIDE.length+'   -   < > o toca para pasar, Esc para volver', W/2, H-50);
}

function drawTitle(){
  var th=THEMES[1];
  var g=CX.createLinearGradient(0,0,0,H);
  g.addColorStop(0,'#06121f'); g.addColorStop(1,'#0d2036');
  CX.fillStyle=g; CX.fillRect(0,0,W,H);
  // axon decorativo
  CX.strokeStyle='rgba(62,198,255,0.25)'; CX.lineWidth=18; CX.beginPath();
  for (var x=-20;x<W+20;x+=30){ var y=H*0.32+Math.sin(x*0.01+performance.now()*0.0006)*36;
    if (x===-20) CX.moveTo(x,y); else CX.lineTo(x,y); }
  CX.stroke();
  // Volt decorativo
  var vx=W/2+Math.sin(performance.now()*0.001)*180, vy=H*0.32+Math.cos(performance.now()*0.0013)*30;
  CX.save(); CX.shadowColor='#ffd166'; CX.shadowBlur=22;
  CX.fillStyle='#ffd166'; CX.beginPath(); CX.arc(vx,vy,12,0,7); CX.fill(); CX.restore();
  CX.fillStyle='#fff'; CX.beginPath(); CX.arc(vx,vy,6,0,7); CX.fill();

  CX.textAlign='center';
  CX.fillStyle='#3ec6ff'; CX.font='bold 58px Courier New';
  CX.fillText('AXON', W/2, 150);
  CX.fillStyle='#8fe8ff'; CX.font='bold 22px Courier New';
  CX.fillText('SYNAPTIC  BREACH', W/2, 185);
  CX.fillStyle='#5a7a8a'; CX.font='13px Courier New';
  CX.fillText('un plataformas de ficcion bioelectrica', W/2, 212);
  drawMenu(MENU_TITLE,240);
  CX.fillStyle='#4a5f6d'; CX.font='12px Courier New';
  CX.fillText('Obra de ficcion. No es contenido medico.', W/2, H-56);
  CX.fillText('ATP total acumulado: '+G.totalAtp, W/2, H-34);
}
function drawMenu(items, y0){
  CX.textAlign='center'; CX.font='bold 22px Courier New';
  for (var i=0;i<items.length;i++){
    var y=y0+i*52;
    var label=items[i];
    if (G.screen==='options'){
      if (i===0) label='SONIDO: '+(G.sound?'SI':'NO');
      if (i===1) label='CONTROLES TACTILES: '+(G.touchUI==='on'?'SIEMPRE':G.touchUI==='off'?'NUNCA':'AUTO');
    }
    if (i===G.sel){
      CX.fillStyle='rgba(62,198,255,0.15)'; CX.fillRect(W/2-200,y-22,400,40);
      CX.fillStyle='#ffd166'; CX.fillText('> '+label+' <', W/2, y+6);
    } else {
      CX.fillStyle='#9fc4d8'; CX.fillText(label, W/2, y+6);
    }
  }
}
function drawPhases(){
  CX.fillStyle='#05070d'; CX.fillRect(0,0,W,H);
  CX.textAlign='center';
  CX.fillStyle='#3ec6ff'; CX.font='bold 26px Courier New';
  CX.fillText('SELECCION DE FASE', W/2, 70);
  CX.font='14px Courier New'; CX.fillStyle='#5a7a8a';
  CX.fillText('flechas para elegir, Enter para jugar', W/2, 96);
  for (var p=1;p<=5;p++){
    var bx=W/2-350+(p-1)*175;
    var info=PHASE_INFO[p-1];
    var un=(G.unlocked[p]||0)>=1;
    CX.fillStyle=(p===G.selPhase)?'rgba(62,198,255,0.18)':'rgba(20,30,44,0.8)';
    CX.fillRect(bx,150,150,80);
    CX.strokeStyle=un?THEMES[p].glow:'#2a3440'; CX.strokeRect(bx,150,150,80);
    CX.fillStyle=un?THEMES[p].glow:'#3a4a55'; CX.font='bold 16px Courier New';
    CX.fillText(info.tit,bx+75,180);
    CX.font='11px Courier New';
    CX.fillText(un?info.nom:'BLOQUEADA',bx+75,205);
  }
  var info=PHASE_INFO[G.selPhase-1];
  CX.fillStyle='#9fc4d8'; CX.font='13px Courier New';
  wrapText(info.intro, W/2, 256, 700, 18);
  for (var l=1;l<=5;l++){
    var bx2=W/2-350+(l-1)*175;
    var ok=(G.unlocked[G.selPhase]||0)>=l;
    CX.fillStyle=(l===G.selLevel&&ok)?'rgba(255,209,102,0.2)':'rgba(20,30,44,0.8)';
    CX.fillRect(bx2,312,150,56);
    CX.strokeStyle=ok?'#9fc4d8':'#2a3440'; CX.strokeRect(bx2,312,150,56);
    CX.fillStyle=ok?'#cfe0ea':'#3a4a55'; CX.font='bold 14px Courier New';
    CX.fillText(l===5?'JEFE':('Nivel '+l), bx2+75,337);
    var key='p'+G.selPhase+'l'+l;
    if (G.best[key]){ CX.font='11px Courier New'; CX.fillText('mejor: '+G.best[key]+'s', bx2+75,356); }
  }
  CX.fillStyle='#5a7a8a'; CX.font='13px Courier New';
  CX.fillText('Esc para volver', W/2, H-40);
}
function wrapText(txt,x,y,maxw,lh){
  var words=txt.split(' '), line='', yy=y;
  for (var i=0;i<words.length;i++){
    var test=line+words[i]+' ';
    if (CX.measureText(test).width>maxw){ CX.fillText(line,x,yy); line=words[i]+' '; yy+=lh; }
    else line=test;
  }
  CX.fillText(line,x,yy);
}
function drawPause(){
  drawPlay();
  CX.fillStyle='rgba(5,8,14,0.8)'; CX.fillRect(0,0,W,H);
  CX.textAlign='center'; CX.fillStyle='#3ec6ff'; CX.font='bold 30px Courier New';
  CX.fillText('PAUSA', W/2, 160);
  drawMenu(MENU_PAUSE,240);
}
function drawOptions(){
  CX.fillStyle='#05070d'; CX.fillRect(0,0,W,H);
  CX.textAlign='center'; CX.fillStyle='#3ec6ff'; CX.font='bold 30px Courier New';
  CX.fillText('OPCIONES', W/2, 150);
  drawMenu(MENU_OPT,240);
  CX.fillStyle='#5a7a8a'; CX.font='13px Courier New';
  CX.fillText('< > para cambiar, Enter para confirmar, Esc para volver', W/2, H-50);
}
function drawClear(){
  CX.fillStyle='#05070d'; CX.fillRect(0,0,W,H);
  var ci=G.clearInfo, th=THEMES[G.phase];
  CX.textAlign='center';
  CX.fillStyle=th.glow; CX.font='bold 34px Courier New';
  CX.fillText(ci.boss?'JEFE SUPERADO':'NIVEL SUPERADO', W/2, 130);
  CX.fillStyle='#cfe0ea'; CX.font='18px Courier New';
  CX.fillText('Vesiculas ATP: '+ci.atp+'/'+ci.atpMax+' ('+ci.pct+'%)', W/2, 185);
  CX.fillText('Tiempo: '+ci.time+'s', W/2, 215);
  CX.fillStyle='#ffd166'; CX.font='bold 22px Courier New';
  CX.fillText(ci.grade, W/2, 258);
  drawMenu(MENU_CLEAR,330);
}
function drawEnding(){
  G.endingT+=0.016;
  var a=clamp(G.endingT/2,0,1);
  CX.fillStyle='#05070d'; CX.fillRect(0,0,W,H);
  CX.globalAlpha=a;
  var vx=W/2, vy=H*0.34;
  CX.save(); CX.shadowColor='#ffd166'; CX.shadowBlur=30;
  CX.fillStyle='#ffd166'; CX.beginPath(); CX.arc(vx,vy,16,0,7); CX.fill(); CX.restore();
  CX.fillStyle='#fff'; CX.beginPath(); CX.arc(vx,vy,8,0,7); CX.fill();
  CX.strokeStyle='rgba(62,198,255,0.5)'; CX.lineWidth=6; CX.beginPath();
  CX.moveTo(vx-300,vy+Math.sin(performance.now()*0.002)*10); CX.lineTo(vx+300,vy); CX.stroke();
  CX.textAlign='center';
  CX.fillStyle='#8fe8ff'; CX.font='bold 30px Courier New';
  CX.fillText('SINAPSIS RESTABLECIDA', W/2, H*0.52);
  CX.fillStyle='#cfe0ea'; CX.font='16px Courier New';
  CX.fillText('El cortocircuito liberador abre una via de escape', W/2, H*0.52+36);
  CX.fillText('hacia un nuevo circuito sano. Volt sigue viajando.', W/2, H*0.52+60);
  CX.fillStyle='#ffd166'; CX.font='18px Courier New';
  CX.fillText('ATP total: '+G.totalAtp, W/2, H*0.52+104);
  CX.fillStyle='#4a5f6d'; CX.font='13px Courier New';
  CX.fillText('Gracias por jugar. Obra de ficcion interactiva.', W/2, H*0.52+140);
  CX.fillText('Pulsa Enter para volver al menu', W/2, H-50);
  CX.globalAlpha=1;
}

// ---------- Bucle principal ----------
var lastT=0;
function frame(t){
  requestAnimationFrame(frame);
  var dt=Math.min(0.05,(t-lastT)/1000||0.016);
  lastT=t;
  handleTap();
  if (pausePressed){
    pausePressed=false;
    if (G.screen==='play'){ G.screen='pause'; G.sel=0; stopMusic(); }
    else if (G.screen==='pause'){ G.screen='play'; startMusic(); }
    else if (G.screen==='guide'&&G.guideFrom==='pause'){ G.screen='pause'; }
  }
  if (G.msgT>0) G.msgT-=dt;
  if (G.bannerT>0) G.bannerT-=dt;
  if (G.shake>0) G.shake-=dt;
  if (G.flash>0) G.flash-=dt;

  if (G.screen==='play'){
    if (!L) startLevel(G.phase,G.level);
    updatePlats(dt);
    updatePlayer(dt);
    if (!L.vert){
      var target=clamp(P.x-W*0.42,0,Math.max(0,L.len-W));
      G.camX=lerp(G.camX,target,clamp(dt*6,0,1));
    } else {
      G.camY=clamp(P.y-300,0,L.height-H);
    }
    drawPlay();
  }
  else if (G.screen==='title') drawTitle();
  else if (G.screen==='phases') drawPhases();
  else if (G.screen==='guide') drawGuide();
  else if (G.screen==='options') drawOptions();
  else if (G.screen==='pause') drawPause();
  else if (G.screen==='clear') drawClear();
  else if (G.screen==='ending') drawEnding();
}
// primer gesto activa audio
window.addEventListener('pointerdown', function once(){ ensureAudio(); window.removeEventListener('pointerdown',once); });
seedBg();
requestAnimationFrame(frame);
