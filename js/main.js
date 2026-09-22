/* ===== UI ===== */
let state,initial,optimal=[],freezeArmed=false,freezeId=null,currentCode='',busy=false,lastEvents=[],hintVisible=false,freezeUsed=0,freezeAnalysis=null;
const board=document.querySelector('#board'),status=document.querySelector('#status'),meta=document.querySelector('#meta'),codeEl=document.querySelector('#code'),toast=document.querySelector('#toast');
const freezeBtn=document.querySelector('#freeze'),difficultyEl=document.querySelector('#difficulty'),sizeEl=document.querySelector('#size'),freezeLimitEl=document.querySelector('#freezeLimit'),soundBtn=document.querySelector('#sound'),motionBtn=document.querySelector('#motion'),motionNote=document.querySelector('#motionNote');
const codeInput=document.querySelector('#codeInput');
/* Browsers suspend Web Audio until a genuine user gesture. Capture the first
   pointer/key gesture and let AudioManager start the selected theme ambient. */
const unlockAudio=()=>AudioManager?.userGesture?.();
addEventListener('pointerdown',unlockAudio,{capture:true,passive:true});
addEventListener('keydown',unlockAudio,{capture:true});
const angleValue=document.querySelector('#angleValue'),tempoValue=document.querySelector('#tempoValue');
function setBusy(v){busy=v;document.querySelectorAll('[data-dir]').forEach(b=>b.disabled=v);}
function freezeLimit(){const v=freezeLimitEl.value;return v==='inf'?Infinity:Math.max(0,parseInt(v,10)||0);}
function freezesLeft(){const lim=freezeLimit();return lim===Infinity?Infinity:Math.max(0,lim-freezeUsed);}
function canUseFreeze(){return freezesLeft()>0;}
let freezeAnalysisSeq=0;
function scheduleFreezeAnalysis(){/* v0.12.29: analyzer result was not consumed by UI; avoid expensive BFS after every move. */freezeAnalysis=null;}
function selectedDims(){const v=String(sizeEl.value);if(v.includes('x')){const [w,h]=v.split('x').map(Number);return{w,h}}const n=+v;return{w:n,h:n}}
function pctPos(x,y,w,h){const inset=1.8,cx=100/w,cy=100/h;return{left:`calc(${x*cx}% + ${inset}px)`,top:`calc(${y*cy}% + ${inset}px)`,width:`calc(${cx}% - ${inset*2}px)`,height:`calc(${cy}% - ${inset*2}px)`};}
function gluedNeighbors(o,ci){
 const c=o.cells[ci],set=new Set();
 for(const [a,b] of (o.glueEdges||[])){
  if(a===ci)set.add(b);else if(b===ci)set.add(a);
 }
 return [...set].map(i=>o.cells[i]);
}
function outerEdgeClasses(o,ci){
 const c=o.cells[ci],all=new Set(o.cells.map(q=>key(q.x,q.y))),cl=[];
 if(!all.has(key(c.x,c.y-1)))cl.push('edge-t');
 if(!all.has(key(c.x+1,c.y)))cl.push('edge-r');
 if(!all.has(key(c.x,c.y+1)))cl.push('edge-b');
 if(!all.has(key(c.x-1,c.y)))cl.push('edge-l');
 return cl.join(' ');
}
function render(opts={}){
 if(!state)return;
 board.style.setProperty('--cols',state.width);board.style.setProperty('--rows',state.height);board.style.aspectRatio=`${state.width}/${state.height}`;
 if(!opts.preservePieces){board.innerHTML='';for(let y=0;y<state.height;y++)for(let x=0;x<state.width;x++){const c=document.createElement('div');c.className='cell';c.style.gridColumn=x+1;c.style.gridRow=y+1;board.append(c);}
  const e=document.createElement('div');e.className=`exit exit-${state.exit.dir}`;e.style.gridColumn=state.exit.x+1;e.style.gridRow=state.exit.y+1;board.append(e);
 }
 const existing=new Map([...board.querySelectorAll('.piece')].map(el=>[el.dataset.cellkey,el]));
 const wanted=new Set();
 for(const o of state.objects){
  for(let ci=0;ci<o.cells.length;ci++){
   const ck=`${o.id}:${ci}`;wanted.add(ck);let el=existing.get(ck);
   if(o.exited){if(el){el.style.opacity='0';el.style.transform='scale(.45)';setTimeout(()=>el.remove(),180)}continue;}
   if(!el){el=document.createElement('button');el.type='button';el.dataset.cellkey=ck;el.dataset.id=o.id;el.ariaLabel=o.type==='ball'?'Golyó':o.type==='wall'?'Fix blokk':(o.cells.length>1?'Ragasztott tégla':'Tégla');
    el.addEventListener('click',()=>{if(o.type!=='wall'&&freezeArmed&&!busy){freezeId=o.id;freezeArmed=false;AudioManager.freeze();SceneRenderer?.event?.('freeze');MotionControl.resume();render({preservePieces:true});}});board.append(el);}
   const c=o.cells[ci],p=pctPos(o.x+c.x,o.y+c.y,state.width,state.height);
   el.style.left=p.left;el.style.top=p.top;el.style.width=p.width;el.style.height=p.height;
   el.className=`piece ${o.type} ${o.cells.length>1?'glued '+outerEdgeClasses(o,ci):''} ${freezeId===o.id?'selected':''}`;
  }
 }
 for(const [ck,el] of existing)if(!wanted.has(ck))el.remove();
 status.textContent=state.won?`Siker! ${state.moves} lépésből.`:'';
 const diff={easy:'Könnyű',medium:'Közepes',hard:'Nehéz'}[difficultyEl.value],glues=state.glueCount||0,walls=state.wallCount||0;
 meta.textContent=`${diff} · kezdő optimum: ${optimal.length} lépés · ragasztás: ${glues} · fix: ${walls}`;
 codeEl.textContent=`Pályakód: ${currentCode}`;
 const left=freezesLeft(),suffix=left===Infinity?' ∞':` ${left}`;
 freezeBtn.classList.toggle('active',freezeArmed);freezeBtn.disabled=!canUseFreeze();
 const fc=document.querySelector('#freezeCount');if(fc)fc.textContent=left===Infinity?'∞':String(left);
 freezeBtn.setAttribute('aria-label',freezeArmed?'Freeze: válassz elemet':`Freeze, hátralévő: ${left===Infinity?'korlátlan':left}`);
 soundBtn.textContent=AudioManager.muted?'🔇 Hang kikapcsolva':'🔊 Hang bekapcsolva';soundBtn.setAttribute('aria-pressed',String(!AudioManager.muted));
 SceneRenderer?.afterBoardRender?.(board);
}
/* ===== BACKGROUND LEVEL PREFETCH =====
   Három kész W-pályát tartunk az aktuális méret+nehézség kombinációhoz.
   A generálás Web Workerben fut, így nem blokkolja a játék/UI főszálát. */
const levelBuffer=[];
function prefetchTarget(){const d=selectedDims();return d.w===d.h?2:1}
/* ===== v0.12.36 FREE-PLAY LEVEL CREATION =====
   A normál W-pálya szándékosan a főszálon készül: a v0.12.36 konstruktív
   generátor nem végez BFS-t, ezért azonnali. Ezzel a Worker/cache/request
   állapotlánc teljesen kiesik a normál Szabad játékból. */
const levelBuffer=[];
let prefetchGeneration=0,prefetchPending=0,pendingNewLevel=false;
function currentPrefetchKey(){return sizeEl.value+'|'+difficultyEl.value}
function stopGenerator(){prefetchPending=0;pendingNewLevel=false}
function fillLevelBuffer(){}
function resetLevelBuffer(){prefetchGeneration++;levelBuffer.length=0;stopGenerator()}
function applyGeneratedLevel(g){
 state=g.state;validateLevel(state);initial=cloneState(state);optimal=g.solution||[];currentCode=g.code;
 freezeArmed=false;freezeId=null;freezeUsed=0;freezeAnalysis=null;hintVisible=false;toast.textContent='';
 render();scheduleFreezeAnalysis();MotionControl?.onNewLevel?.();
}
function requestGeneratedLevel(seed=null,prefix='W'){
 const d=selectedDims();
 try{
  const g=generateLevel(d.w,difficultyEl.value,seed||seedText(),prefix,d.h);
  if(g?.state?.width!==d.w||g?.state?.height!==d.h)throw Error('GENERATOR_SIZE_MISMATCH');
  applyGeneratedLevel(g);return true;
 }catch(e){
  console.error('Level generation',e);
  toast.textContent='A pálya generálása nem sikerült: '+(e?.message||e);
  return false;
 }
}
function newLevel(seed=null,prefix='W'){return requestGeneratedLevel(seed,prefix)}
function playEvents(events){
 const moves=events.filter(e=>e.type==='move').length,blocked=events.some(e=>e.type==='blocked'),exited=events.some(e=>e.type==='exit'),won=events.some(e=>e.type==='win');
 if(blocked){AudioManager.blocked();SceneRenderer?.event?.('blocked')}else if(moves){AudioManager.move(moves);SceneRenderer?.event?.('move')}
 if(exited){AudioManager.exit();SceneRenderer?.event?.('exit')}if(won){AudioManager.win();SceneRenderer?.event?.('win')}
 if(blocked){board.classList.remove('blocked');void board.offsetWidth;board.classList.add('blocked');setTimeout(()=>board.classList.remove('blocked'),190)}
 if(won){board.classList.add('winner');setTimeout(()=>board.classList.remove('winner'),600)}
}
function move(dir){if(state.won||busy||freezeArmed)return;SceneRenderer?.setDirection?.(dir);if(hintVisible){hintVisible=false;toast.textContent='';}setBusy(true);const usedFreeze=!!freezeId,r=step(state,dir,freezeId);state=r.state;lastEvents=r.events;if(usedFreeze)freezeUsed++;freezeArmed=false;freezeId=null;freezeAnalysis=null;render({preservePieces:true});playEvents(r.events);scheduleFreezeAnalysis();setTimeout(()=>{setBusy(false);render({preservePieces:true});},155);}
function hint(){
 if(hintVisible){hintVisible=false;toast.textContent='';return;}
 hintVisible=true;
 if(state.won){toast.textContent='A pálya már kész.';return}
 toast.textContent='Solver számol…';
 setTimeout(()=>{if(!hintVisible)return;const sol=solve(state,30);if(!sol)toast.textContent='Innen Freeze nélkül nincs megoldás.';else{const arrows={up:'↑',down:'↓',left:'←',right:'→'};toast.textContent=`Innen minimum ${sol.length} lépés. Következő optimális irány: ${arrows[sol[0]]}`;}},0);
}

/* ===== v0.5 PRESS / HOLD INPUT =====
   Rövid nyomás = 1 lépés. Nyomva tartás = ismételt egycellás step(),
   tehát ugyanazt a fizikát használja, csak automatikusan újraparancsol. */
let holdTimer=null,holdDir=null,holdSource=null,holdToken=0;
const HOLD_FIRST_DELAY=260,HOLD_REPEAT=175;
function setBoardTilt(dir,on){
 board.classList.remove('tilt-up','tilt-down','tilt-left','tilt-right');
 if(on&&dir)board.classList.add('tilt-'+dir);
}
function stopHold(){
 holdToken++;if(holdTimer){clearTimeout(holdTimer);holdTimer=null;}
 if(holdSource)holdSource.classList.remove('pressed');
 holdDir=null;holdSource=null;setBoardTilt(null,false);
}
function holdTick(token){
 if(token!==holdToken||!holdDir)return;
 if(!busy&&!state.won)move(holdDir);
 holdTimer=setTimeout(()=>holdTick(token),HOLD_REPEAT);
}
function startHold(dir,source,e){
 if(e){e.preventDefault();try{source.setPointerCapture?.(e.pointerId)}catch(_){}}
 stopHold();holdDir=dir;holdSource=source;source.classList.add('pressed');setBoardTilt(dir,true);
 move(dir);const token=++holdToken;holdTimer=setTimeout(()=>holdTick(token),HOLD_FIRST_DELAY);
}
document.querySelectorAll('[data-hold-dir]').forEach(b=>{
 b.addEventListener('pointerdown',e=>startHold(b.dataset.holdDir,b,e));
 b.addEventListener('pointerup',stopHold);b.addEventListener('pointercancel',stopHold);
 b.addEventListener('lostpointercapture',stopHold);b.addEventListener('contextmenu',e=>e.preventDefault());
});

/* ===== v0.10.9 MOBILE TILT INPUT – relative H/V transitions =====
   Calibration-derived controller: DeviceMotion gravity is converted to two physical
   tilt angles. Each accepted direction becomes the next relative reference, so direct
   RIGHT→DOWN etc. transitions do not require returning to neutral. */
const MotionControl=(()=>{
 const SETTINGS_KEY='ggrid.motion.v1';
 let enabled=false,paused=false,orientationListener=false,motionListener=false;
 let filteredBeta=null,filteredGamma=null,refBeta=null,refGamma=null,haveOrientationRef=false;
 let gravity=null,refAngles=null,haveGravityRef=false,lastGravityAt=0;
 let activeDir=null,lastStep=0,armingUntil=0,stableSince=0,candidateDir=null,candidateSince=0;
 let enterAngle=6,tempoPct=100;
 const ARM_MS=700,STABLE_MS=250,FILTER=.22,GRAVITY_FILTER=.18,GRAVITY_FRESH_MS=350,CONFIRM_MS=60;
 function loadSettings(){
  try{const s=JSON.parse(localStorage.getItem(SETTINGS_KEY)||'{}');
   if(Number.isFinite(s.enterAngle))enterAngle=Math.max(3,Math.min(14,s.enterAngle));
   if(Number.isFinite(s.tempoPct))tempoPct=Math.max(50,Math.min(200,s.tempoPct));
  }catch(_){}
  angleValue.textContent=enterAngle+'°';tempoValue.textContent=tempoPct+'%';
 }
 function saveSettings(){try{localStorage.setItem(SETTINGS_KEY,JSON.stringify({enterAngle,tempoPct}))}catch(_){}}
 function norm180(a){while(a>180)a-=360;while(a<-180)a+=360;return a}
 function supported(){return 'DeviceOrientationEvent' in window||'DeviceMotionEvent' in window}
 function label(){motionBtn.classList.toggle('active',enabled);motionBtn.textContent=enabled?'📱 Mozgás be':'📱 Mozgás ki'}
 function note(t=''){motionNote.textContent=t}
 function stop(){activeDir=null;candidateDir=null;candidateSince=0;setBoardTilt(null,false)}
 function screenVector(x,y){
  const a=(screen.orientation&&typeof screen.orientation.angle==='number'?screen.orientation.angle:(typeof window.orientation==='number'?window.orientation:0))||0;
  if(a===90)return{x:y,y:-x};if(a===270||a===-90)return{x:-y,y:x};if(a===180)return{x:-x,y:-y};return{x,y};
 }
 function gravityAngles(g){
  if(!g)return null;const len=Math.hypot(g.x,g.y,g.z);if(!len)return null;
  const x=g.x/len,y=g.y/len,z=g.z/len;
  /* H: side tilt, V: fore/aft tilt. atan2 keeps the mapping usable far from horizontal. */
  const h=Math.atan2(-x,Math.hypot(y,z))*57.2957795;
  const v=Math.atan2(y,z)*57.2957795;
  return screenVector(h,v);
 }
 function snapshotReference(){
  const ga=gravityAngles(gravity);if(ga){refAngles=ga;haveGravityRef=true}else{refAngles=null;haveGravityRef=false}
  if(filteredBeta!=null&&filteredGamma!=null){refBeta=filteredBeta;refGamma=filteredGamma;haveOrientationRef=true}else haveOrientationRef=false;
  candidateDir=null;candidateSince=0;
 }
 function beginArming(msg='Stabilizálás…'){
  if(!enabled)return;paused=false;stop();armingUntil=performance.now()+ARM_MS;stableSince=0;
  haveGravityRef=false;haveOrientationRef=false;refAngles=null;note(msg);
 }
 function gravityVector(){
  if(!gravity||performance.now()-lastGravityAt>GRAVITY_FRESH_MS)return null;
  const a=gravityAngles(gravity);if(!a)return null;
  if(!haveGravityRef){refAngles=a;haveGravityRef=true;return{x:0,y:0,mag:0,source:'gravity'}}
  const p={x:a.x-refAngles.x,y:a.y-refAngles.y};return{x:p.x,y:p.y,mag:Math.hypot(p.x,p.y),source:'gravity'};
 }
 function orientationVector(){
  if(filteredBeta==null||filteredGamma==null)return null;
  if(!haveOrientationRef){refBeta=filteredBeta;refGamma=filteredGamma;haveOrientationRef=true;return{x:0,y:0,mag:0,source:'orientation'}}
  /* Match gravity convention: +x means RIGHT, +y means DOWN. */
  const p=screenVector(norm180(filteredGamma-refGamma),norm180(filteredBeta-refBeta));
  return{x:p.x,y:p.y,mag:Math.hypot(p.x,p.y),source:'orientation'};
 }
 function controlVector(){return gravityVector()||orientationVector()}
 function rawDirection(v){
  const ax=Math.abs(v.x),ay=Math.abs(v.y);if(Math.max(ax,ay)<enterAngle)return null;
  if(ax>ay)return v.x>0?'right':'left';return v.y>0?'down':'up';
 }
 function repeatDelay(mag){const excess=Math.max(0,mag-enterAngle),t=Math.min(1,excess/14);return Math.round((420-300*t)*tempoPct/100)}
 function acceptDirection(dir,now){
  activeDir=dir;lastStep=now;candidateDir=null;candidateSince=0;setBoardTilt(dir,true);
  snapshotReference();tryTiltStep(dir);
 }
 function tryTiltStep(dir){
  if(paused||busy||!state||state.won)return;
  const probe=step(state,dir,freezeId),meaningful=probe.events.some(e=>e.type==='move'||e.type==='exit');
  if(!meaningful){snapshotReference();lastStep=performance.now();note('Véghelyzet · új referencia');return}
  move(dir);
 }
 function process(){
  if(!enabled||paused)return;const now=performance.now(),v=controlVector();if(!v)return;
  if(now<armingUntil){snapshotReference();return}
  if(!haveGravityRef&&!haveOrientationRef){snapshotReference();return}
  if(!stableSince){stableSince=now;if(now-stableSince<STABLE_MS)return}
  const dir=rawDirection(v);
  if(dir&&dir!==activeDir){
   if(candidateDir!==dir){candidateDir=dir;candidateSince=now;return}
   if(now-candidateSince>=CONFIRM_MS){acceptDirection(dir,now);note('Mozgás aktív · relatív dőlés');return}
  }else{candidateDir=null;candidateSince=0}
  /* Same direction held after an accepted impulse: keep physical rolling/repeat behaviour. */
  if(activeDir&&dir===activeDir&&now-lastStep>=repeatDelay(v.mag)){lastStep=now;tryTiltStep(activeDir)}
 }
 function onMotion(e){
  if(!enabled||paused)return;const g=e.accelerationIncludingGravity;
  if(!g||![g.x,g.y,g.z].every(Number.isFinite))return;
  if(!gravity)gravity={x:g.x,y:g.y,z:g.z};
  else{gravity.x+=(g.x-gravity.x)*GRAVITY_FILTER;gravity.y+=(g.y-gravity.y)*GRAVITY_FILTER;gravity.z+=(g.z-gravity.z)*GRAVITY_FILTER}
  lastGravityAt=performance.now();process();
 }
 function onOrientation(e){
  if(!enabled||paused||typeof e.beta!=='number'||typeof e.gamma!=='number')return;
  filteredBeta=filteredBeta==null?e.beta:filteredBeta+norm180(e.beta-filteredBeta)*FILTER;
  filteredGamma=filteredGamma==null?e.gamma:filteredGamma+norm180(e.gamma-filteredGamma)*FILTER;
  if(!gravity||performance.now()-lastGravityAt>GRAVITY_FRESH_MS)process();
 }
 async function enable(){
  if(!supported()){note('Ezen a böngészőn nem érhető el a mozgásérzékelő.');return}
  try{
   if(typeof DeviceOrientationEvent!=='undefined'&&typeof DeviceOrientationEvent.requestPermission==='function'){
    const p=await DeviceOrientationEvent.requestPermission();if(p!=='granted'){note('A mozgásérzékelő engedélye nem lett megadva.');return}
   }
   if(typeof DeviceMotionEvent!=='undefined'&&typeof DeviceMotionEvent.requestPermission==='function'){
    try{await DeviceMotionEvent.requestPermission()}catch(_){}
   }
   enabled=true;paused=false;stop();
   if('DeviceOrientationEvent' in window&&!orientationListener){addEventListener('deviceorientation',onOrientation,true);orientationListener=true}
   if('DeviceMotionEvent' in window&&!motionListener){addEventListener('devicemotion',onMotion,true);motionListener=true}
   label();beginArming('Stabilizálás… tartsd kényelmesen a telefont');
  }catch(err){enabled=false;label();note('A mozgásvezérlés nem indítható: '+(err?.message||'ismeretlen hiba'))}
 }
 function disable(){enabled=false;paused=false;stop();label();note('')}
 async function toggle(){if(enabled)disable();else await enable()}
 function recalibrate(){if(enabled)beginArming('Stabilizálás… új referencia')}
 function onNewLevel(){if(enabled)beginArming('Stabilizálás… új pálya')}
 function pause(){if(enabled){paused=true;stop();note('Mozgás szünetel')}}
 function resume(){
  if(!enabled)return;paused=false;armingUntil=0;stableSince=performance.now()-STABLE_MS;stop();snapshotReference();note('Mozgás aktív · új referencia');
 }
 function adjustAngle(delta){enterAngle=Math.max(3,Math.min(14,enterAngle+delta));angleValue.textContent=enterAngle+'°';saveSettings();if(enabled)beginArming('Érzékenység: '+enterAngle+'° · stabilizálás…')}
 function adjustTempo(delta){tempoPct=Math.max(50,Math.min(200,tempoPct+delta));tempoValue.textContent=tempoPct+'%';saveSettings();note('Gurulási tempó: '+tempoPct+'%')}
 loadSettings();
 return{toggle,recalibrate,onNewLevel,pause,resume,adjustAngle,adjustTempo,get enabled(){return enabled}};
})();
motionBtn.addEventListener('click',()=>MotionControl.toggle());
document.querySelector('#angleMinus').addEventListener('click',()=>MotionControl.adjustAngle(-1));
document.querySelector('#anglePlus').addEventListener('click',()=>MotionControl.adjustAngle(1));
document.querySelector('#tempoMinus').addEventListener('click',()=>MotionControl.adjustTempo(-10));
document.querySelector('#tempoPlus').addEventListener('click',()=>MotionControl.adjustTempo(10));

/* ===== v0.10.4 MOTION CALIBRATION LAB ===== */
const CalibrationLab=(()=>{
 const panel=document.querySelector('#calibration'),phaseEl=document.querySelector('#calPhase'),arrowEl=document.querySelector('#calArrow'),
 instructionEl=document.querySelector('#calInstruction'),progressEl=document.querySelector('#calProgress'),statsEl=document.querySelector('#calStats'),
 startBtn=document.querySelector('#calStart'),exportBtn=document.querySelector('#calExport');
 const arrows={up:'↑',down:'↓',left:'←',right:'→'},names={up:'FEL',down:'LE',left:'BALRA',right:'JOBBRA'};
 /* Euler trail over the complete directed graph of four directions:
    every ordered direction→different direction transition occurs exactly once. */
 const sequence=['right','down','up','left','down','right','up','down','left','up','right','left','right'];
 const SETTLE_MS=650,HOLD_MS=850,COUNTDOWN_MS=1800;
 let running=false,samples=[],segments=[],currentTarget=null,currentFrom='neutral',phase='idle',phaseStarted=0,timer=null;
 let lastO={alpha:null,beta:null,gamma:null,absolute:null},lastM={gx:null,gy:null,gz:null,ax:null,ay:null,az:null,rrAlpha:null,rrBeta:null,rrGamma:null};
 function screenAngle(){return (screen.orientation&&typeof screen.orientation.angle==='number'?screen.orientation.angle:(typeof window.orientation==='number'?window.orientation:0))||0}
 function sample(source){
  if(!running)return;
  samples.push({t:Math.round(performance.now()*10)/10,phase,from:currentFrom,to:currentTarget,source,screenAngle:screenAngle(),
   alpha:lastO.alpha,beta:lastO.beta,gamma:lastO.gamma,absolute:lastO.absolute,
   gx:lastM.gx,gy:lastM.gy,gz:lastM.gz,ax:lastM.ax,ay:lastM.ay,az:lastM.az,rrAlpha:lastM.rrAlpha,rrBeta:lastM.rrBeta,rrGamma:lastM.rrGamma});
 }
 function onO(e){lastO={alpha:e.alpha,beta:e.beta,gamma:e.gamma,absolute:e.absolute};sample('orientation')}
 function onM(e){const g=e.accelerationIncludingGravity||{},a=e.acceleration||{},r=e.rotationRate||{};
  lastM={gx:g.x,gy:g.y,gz:g.z,ax:a.x,ay:a.y,az:a.z,rrAlpha:r.alpha,rrBeta:r.beta,rrGamma:r.gamma};sample('motion')}
 function ensureListeners(){addEventListener('deviceorientation',onO,true);addEventListener('devicemotion',onM,true)}
 function removeListeners(){removeEventListener('deviceorientation',onO,true);removeEventListener('devicemotion',onM,true)}
 async function permissions(){
  if(typeof DeviceOrientationEvent!=='undefined'&&typeof DeviceOrientationEvent.requestPermission==='function'){
   if(await DeviceOrientationEvent.requestPermission()!=='granted')throw Error('DeviceOrientation engedély megtagadva');
  }
  if(typeof DeviceMotionEvent!=='undefined'&&typeof DeviceMotionEvent.requestPermission==='function'){
   if(await DeviceMotionEvent.requestPermission()!=='granted')throw Error('DeviceMotion engedély megtagadva');
  }
 }
 function open(){panel.hidden=false;MotionControl.pause();statsEl.textContent='12 különböző irány→irány átmenetet fogunk megmérni.'}
 function close(){if(running)finish(false);panel.hidden=true;MotionControl.resume()}
 function setProgress(i,f=0){progressEl.style.width=Math.min(100,Math.max(0,((i+f)/sequence.length)*100))+'%'}
 function countdown(i){
  phase='countdown';currentTarget=sequence[i];currentFrom=i?sequence[i-1]:'neutral';phaseStarted=performance.now();
  arrowEl.textContent=arrows[currentTarget];instructionEl.textContent=(i?'A jelenlegi helyzetből ':'Kezdő helyzetből ')+names[currentTarget]+' döntés következik…';
  phaseEl.textContent='Mozdulat '+(i+1)+' / '+sequence.length;setProgress(i);
  let left=3;statsEl.textContent='Indulás: '+left;
  const tick=()=>{left--;if(left>0){statsEl.textContent='Indulás: '+left;timer=setTimeout(tick,COUNTDOWN_MS/3)}else beginMove(i)};
  timer=setTimeout(tick,COUNTDOWN_MS/3);
 }
 function beginMove(i){
  phase='transition';phaseStarted=performance.now();instructionEl.textContent=names[currentTarget]+' – döntsd át most';statsEl.textContent='Mozgás rögzítése…';
  timer=setTimeout(()=>beginHold(i),SETTLE_MS);
 }
 function beginHold(i){
  phase='hold';phaseStarted=performance.now();instructionEl.textContent=names[currentTarget]+' – tartsd ebben a helyzetben';statsEl.textContent='Véghelyzet mintavétele…';setProgress(i,.55);
  timer=setTimeout(()=>{segments.push({from:currentFrom,to:currentTarget,endSample:samples.length});if(i+1<sequence.length)countdown(i+1);else finish(true)},HOLD_MS);
 }
 function summarize(){
  const motion=samples.filter(s=>s.source==='motion'&&[s.gx,s.gy,s.gz].every(v=>Number.isFinite(v))).length;
  const orient=samples.filter(s=>s.source==='orientation'&&Number.isFinite(s.beta)&&Number.isFinite(s.gamma)).length;
  const transitions=new Set(segments.filter(s=>s.from!=='neutral').map(s=>s.from+'>'+s.to)).size;
  return{samples:samples.length,motionSamples:motion,orientationSamples:orient,transitionTypes:transitions,screenAngles:[...new Set(samples.map(s=>s.screenAngle))]};
 }
 function profilePreview(){
  /* Compact descriptive profile only. The raw export remains authoritative for
     offline analysis before this profile is allowed to drive gameplay. */
  const holds={};
  for(const d of ['up','down','left','right']){
   const a=samples.filter(s=>s.phase==='hold'&&s.to===d&&[s.gx,s.gy,s.gz].every(v=>Number.isFinite(v)));
   if(a.length)holds[d]={n:a.length,gravityMean:['gx','gy','gz'].map(k=>a.reduce((q,s)=>q+s[k],0)/a.length)};
  }
  return{version:1,created:new Date().toISOString(),holds,summary:summarize()};
 }
 function finish(ok){
  clearTimeout(timer);running=false;removeListeners();phase=ok?'done':'cancelled';currentTarget=null;
  if(ok){setProgress(sequence.length);arrowEl.textContent='✓';instructionEl.textContent='Mérés elkészült';const s=summarize();
   statsEl.textContent='Nyers minták: '+s.samples+'\nDeviceMotion: '+s.motionSamples+' · DeviceOrientation: '+s.orientationSamples+'\nMért irányátmenetek: '+s.transitionTypes+'/12';
   exportBtn.disabled=false;startBtn.textContent='Új mérés';try{localStorage.setItem('ggrid.calibration.preview.v1',JSON.stringify(profilePreview()))}catch(_){}
  }else{arrowEl.textContent='•';instructionEl.textContent='A mérés megszakítva.'}
 }
 async function start(){
  if(running)return;try{await permissions()}catch(e){statsEl.textContent='Nem indítható: '+e.message;return}
  MotionControl.pause();samples=[];segments=[];running=true;exportBtn.disabled=true;startBtn.textContent='Mérés folyamatban…';ensureListeners();
  phase='prepare';arrowEl.textContent='•';instructionEl.textContent='Tartsd a telefont a játék közbeni természetes kezdőhelyzetben.';statsEl.textContent='2 másodperc múlva indul.';progressEl.style.width='0%';
  timer=setTimeout(()=>countdown(0),2000);
 }
 function exportData(){
  if(!samples.length)return;const payload={format:'GGrid Motion Calibration Raw',version:1,created:new Date().toISOString(),
   userAgent:navigator.userAgent,sequence,parameters:{settleMs:SETTLE_MS,holdMs:HOLD_MS,countdownMs:COUNTDOWN_MS},summary:summarize(),profilePreview:profilePreview(),segments,samples};
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download='GGrid-calibration-'+new Date().toISOString().replace(/[:.]/g,'-')+'.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 document.querySelector('#calibrate').addEventListener('click',open);document.querySelector('#calClose').addEventListener('click',close);
 startBtn.addEventListener('click',start);exportBtn.addEventListener('click',exportData);
 return{open};
})();

freezeBtn.addEventListener('click',()=>{if(!canUseFreeze())return;freezeArmed=!freezeArmed;if(freezeArmed){stopHold();MotionControl.pause();}else{freezeId=null;MotionControl.resume();}render({preservePieces:true});});
document.querySelector('#restart').addEventListener('click',()=>{if(busy)return;state=cloneState(initial);freezeArmed=false;freezeId=null;freezeUsed=0;freezeAnalysis=null;hintVisible=false;toast.textContent='';render();scheduleFreezeAnalysis();MotionControl.onNewLevel();});
document.querySelector('#new').addEventListener('click',()=>newLevel());
document.querySelector('#hint').addEventListener('click',hint);
soundBtn.addEventListener('click',async()=>{await AudioManager.toggle();soundBtn.textContent=AudioManager.muted?'🔇 Hang kikapcsolva':'🔊 Hang bekapcsolva';soundBtn.setAttribute('aria-pressed',String(!AudioManager.muted));if(state)render({preservePieces:true});});
function changeLevelProfile(){
 resetLevelBuffer();
 /* A régi pálya ne maradjon látható, miközben az új méret készül. */
 state=null;initial=null;optimal=[];currentCode='';
 board.innerHTML='';board.style.setProperty('--cols',selectedDims().w);board.style.setProperty('--rows',selectedDims().h);
 board.style.aspectRatio=`${selectedDims().w}/${selectedDims().h}`;
 toast.textContent=`Pálya készítése: ${selectedDims().w}×${selectedDims().h}…`;
 newLevel();
}
difficultyEl.addEventListener('change',changeLevelProfile);sizeEl.addEventListener('change',changeLevelProfile);
freezeLimitEl.addEventListener('change',()=>{freezeUsed=0;freezeArmed=false;freezeId=null;render({preservePieces:true});scheduleFreezeAnalysis();});
document.querySelector('#loadCode').addEventListener('click',()=>{const p=parseCode(codeInput.value);if(!p){toast.textContent='Hibás pályakód. Példa: W4H-01ABC23';return}sizeEl.value=p.w===p.h?String(p.w):`${p.w}x${p.h}`;difficultyEl.value=p.difficulty;try{newLevel(p.seed,p.prefix);toast.textContent='Pálya betöltve.'}catch(e){toast.textContent='A pálya nem tölthető be.'}});
/* Billentyűzet: a kurzornyíl lenyomásakor ugyanaz a térbeli billenés látszik.
   Az operációs rendszer key-repeatje továbbra is ismételt egycellás move()-okat ad. */
const keyboardDirs=new Set();
function refreshKeyboardTilt(){
 const dirs=[...keyboardDirs];
 setBoardTilt(dirs.length?dirs[dirs.length-1]:null,dirs.length>0);
}
addEventListener('keydown',e=>{
 if(['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName))return;
 const m={ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right'}[e.key];
 if(m){e.preventDefault();keyboardDirs.delete(m);keyboardDirs.add(m);refreshKeyboardTilt();move(m);}
});
addEventListener('keyup',e=>{
 const m={ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right'}[e.key];
 if(m){e.preventDefault();keyboardDirs.delete(m);refreshKeyboardTilt();}
});
addEventListener('blur',()=>{keyboardDirs.clear();refreshKeyboardTilt();stopHold();});
addEventListener('orientationchange',()=>setTimeout(()=>MotionControl.recalibrate(),250));
const startupEl=document.querySelector('#startup'),STARTUP_MIN_MS=700,startupStarted=performance.now();
function finishStartup(){
 const wait=Math.max(0,STARTUP_MIN_MS-(performance.now()-startupStarted));
 setTimeout(()=>startupEl?.classList.add('done'),wait);
}
/* v0.12.30: az alkalmazás indulását soha nem blokkolja pályagenerálás. */
resetLevelBuffer();
finishStartup();
