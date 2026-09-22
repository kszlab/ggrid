/* ===== UI ===== */
let state,initial,optimal=[],freezeArmed=false,freezeId=null,currentCode='',busy=false,lastEvents=[],hintVisible=false,freezeUsed=0,freezeAnalysis=null;
const board=document.querySelector('#board'),status=document.querySelector('#status'),meta=document.querySelector('#meta'),codeEl=document.querySelector('#code'),toast=document.querySelector('#toast');
const freezeBtn=document.querySelector('#freeze'),difficultyEl=document.querySelector('#difficulty'),sizeEl=document.querySelector('#size'),freezeLimitEl=document.querySelector('#freezeLimit'),soundBtn=document.querySelector('#sound'),motionBtn=document.querySelector('#motion'),motionNote=document.querySelector('#motionNote');
const codeInput=document.querySelector('#codeInput');
const angleValue=document.querySelector('#angleValue'),tempoValue=document.querySelector('#tempoValue');
function setBusy(v){busy=v;document.querySelectorAll('[data-dir]').forEach(b=>b.disabled=v);}
function freezeLimit(){const v=freezeLimitEl.value;return v==='inf'?Infinity:Math.max(0,parseInt(v,10)||0);}
function freezesLeft(){const lim=freezeLimit();return lim===Infinity?Infinity:Math.max(0,lim-freezeUsed);}
function canUseFreeze(){return freezesLeft()>0;}
let freezeAnalysisSeq=0;
function scheduleFreezeAnalysis(){
 freezeAnalysis=null;
 if(!state)return;
 const snapshot=cloneState(state),snapshotKey=stateKey(snapshot),requestId='freeze-'+(++freezeAnalysisSeq);
 ensureGeneratorWorker().postMessage({type:'analyzeFreeze',requestId,state:snapshot,stateKey:snapshotKey,maxDepth:30});
}
function pctPos(x,y,n){const inset=1.8,cell=100/n;return{left:`calc(${x*cell}% + ${inset}px)`,top:`calc(${y*cell}% + ${inset}px)`,size:`calc(${cell}% - ${inset*2}px)`};}
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
 board.style.setProperty('--n',state.width);
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
    el.addEventListener('click',()=>{if(o.type!=='wall'&&freezeArmed&&!busy){freezeId=o.id;freezeArmed=false;AudioManager.freeze();MotionControl.resume();render({preservePieces:true});}});board.append(el);}
   const c=o.cells[ci],p=pctPos(o.x+c.x,o.y+c.y,state.width);
   el.style.left=p.left;el.style.top=p.top;el.style.width=p.size;el.style.height=p.size;
   el.className=`piece ${o.type} ${o.cells.length>1?'glued '+outerEdgeClasses(o,ci):''} ${freezeId===o.id?'selected':''}`;
  }
 }
 for(const [ck,el] of existing)if(!wanted.has(ck))el.remove();
 status.textContent=state.won?`Siker! ${state.moves} lépésből.`:`Lépések: ${state.moves} · ${state.width}×${state.height}`;
 const diff={easy:'Könnyű',medium:'Közepes',hard:'Nehéz'}[difficultyEl.value],glues=state.glueCount||0,walls=state.wallCount||0;
 meta.textContent=`${diff} · kezdő optimum: ${optimal.length} lépés · ragasztás: ${glues} · fix: ${walls}`;
 codeEl.textContent=`Pályakód: ${currentCode}`;
 const left=freezesLeft(),suffix=left===Infinity?' ∞':` ${left}`;
 freezeBtn.classList.toggle('active',freezeArmed);freezeBtn.disabled=!canUseFreeze();
 freezeBtn.textContent=freezeArmed?(freezeId?`❄ Lefogva${suffix}`:`❄ Válassz elemet${suffix}`):`❄ Freeze${suffix}`;
 soundBtn.textContent=AudioManager.muted?'🔇 Hang ki':'🔊 Hang be';
}
/* ===== BACKGROUND LEVEL PREFETCH =====
   Három kész W-pályát tartunk az aktuális méret+nehézség kombinációhoz.
   A generálás Web Workerben fut, így nem blokkolja a játék/UI főszálát. */
const PREFETCH_TARGET=3,levelBuffer=[];
let generatorWorker=null,prefetchGeneration=0,prefetchPending=0,prefetchSeq=0,pendingNewLevel=false;
function currentPrefetchKey(){return sizeEl.value+'|'+difficultyEl.value}
function ensureGeneratorWorker(){
 if(generatorWorker)return generatorWorker;
 generatorWorker=new Worker('js/generator-worker.js');
 generatorWorker.onmessage=e=>{
  const m=e.data||{};
  if(m.type==='freezeAnalysis'){
   if(state&&m.stateKey===stateKey(state))freezeAnalysis=m.analysis;
   return;
  }
  if(m.type==='level'){
   prefetchPending=Math.max(0,prefetchPending-1);
   if(m.requestId?.generation===prefetchGeneration&&m.requestId?.key===currentPrefetchKey()){
    if(pendingNewLevel){
     pendingNewLevel=false;
     applyGeneratedLevel(m.g);
    }else levelBuffer.push(m.g);
   }
   fillLevelBuffer();
  }
 };
 generatorWorker.onerror=()=>{prefetchPending=Math.max(0,prefetchPending-1);};
 return generatorWorker;
}
function fillLevelBuffer(){
 const need=PREFETCH_TARGET-levelBuffer.length-prefetchPending;
 if(need<=0)return;
 const w=ensureGeneratorWorker(),keyNow=currentPrefetchKey(),generation=prefetchGeneration;
 for(let k=0;k<need;k++){
  prefetchPending++;
  w.postMessage({type:'generate',n:+sizeEl.value,difficulty:difficultyEl.value,prefix:'W',seed:seedText(),requestId:{generation,key:keyNow,seq:++prefetchSeq}});
 }
}
function resetLevelBuffer(){
 prefetchGeneration++;levelBuffer.length=0;prefetchPending=0;pendingNewLevel=false;
 if(generatorWorker){generatorWorker.terminate();generatorWorker=null;}
 fillLevelBuffer();
}
function applyGeneratedLevel(g){
 state=g.state;validateLevel(state);initial=cloneState(state);optimal=g.solution;currentCode=g.code;
 freezeArmed=false;freezeId=null;freezeUsed=0;freezeAnalysis=null;hintVisible=false;toast.textContent='';
 render();scheduleFreezeAnalysis();MotionControl?.onNewLevel?.();
}
function newLevel(seed=null,prefix='W'){
 /* Pályakód betöltése determinisztikus marad; normál Új pálya a pufferből jön. */
 if(seed||prefix!=='W'){
  const g=generateLevel(+sizeEl.value,difficultyEl.value,seed||seedText(),prefix);
  applyGeneratedLevel(g);return;
 }
 const g=levelBuffer.shift();
 if(g){applyGeneratedLevel(g);fillLevelBuffer();return;}
 /* Csak induláskor / extrém gyors kattintásnál lehet üres. A Worker elkészíti
    a következőt; nem fagyasztjuk le a főszálat szinkron generálással. */
 pendingNewLevel=true;
 toast.textContent='A következő pálya készül…';
 fillLevelBuffer();
}
function playEvents(events){
 const moves=events.filter(e=>e.type==='move').length,blocked=events.some(e=>e.type==='blocked'),exited=events.some(e=>e.type==='exit'),won=events.some(e=>e.type==='win');
 if(blocked)AudioManager.blocked();else if(moves)AudioManager.move(moves);
 if(exited)AudioManager.exit();if(won)AudioManager.win();
 if(blocked){board.classList.remove('blocked');void board.offsetWidth;board.classList.add('blocked');setTimeout(()=>board.classList.remove('blocked'),190)}
 if(won){board.classList.add('winner');setTimeout(()=>board.classList.remove('winner'),600)}
}
function move(dir){if(state.won||busy||freezeArmed)return;if(hintVisible){hintVisible=false;toast.textContent='';}setBusy(true);const usedFreeze=!!freezeId,r=step(state,dir,freezeId);state=r.state;lastEvents=r.events;if(usedFreeze)freezeUsed++;freezeArmed=false;freezeId=null;freezeAnalysis=null;render({preservePieces:true});playEvents(r.events);scheduleFreezeAnalysis();setTimeout(()=>{setBusy(false);render({preservePieces:true});},155);}
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

/* ===== v0.10.2 MOBILE TILT INPUT – gravity-vector first =====
   DeviceMotion accelerationIncludingGravity is preferred because it remains meaningful
   when the phone is held far from horizontal. DeviceOrientation is retained as fallback.
   All user tuning is persisted in localStorage. */
const MotionControl=(()=>{
 const SETTINGS_KEY='ggrid.motion.v1';
 let enabled=false,orientationListener=false,motionListener=false;
 let baseBeta=0,baseGamma=0,haveOrientationBase=false,filteredBeta=null,filteredGamma=null;
 let gravity=null,baseGravity=null,haveGravityBase=false,lastGravityAt=0;
 let activeDir=null,lastStep=0,armingUntil=0,armedNeedsNeutral=false,stableSince=0;
 let enterAngle=6,tempoPct=100;
 const EXIT_DEG=3,ARM_MS=700,STABLE_MS=250,FILTER=.22,GRAVITY_FILTER=.18,GRAVITY_FRESH_MS=350;
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
 function stop(){activeDir=null;setBoardTilt(null,false)}
 function beginArming(msg='Stabilizálás…'){
  if(!enabled)return;stop();armingUntil=performance.now()+ARM_MS;armedNeedsNeutral=true;stableSince=0;
  haveOrientationBase=false;haveGravityBase=false;baseGravity=null;filteredBeta=null;filteredGamma=null;note(msg);
 }
 function screenVector(x,y){
  const a=(screen.orientation&&typeof screen.orientation.angle==='number'?screen.orientation.angle:(typeof window.orientation==='number'?window.orientation:0))||0;
  if(a===90)return{x:y,y:-x}; if(a===270||a===-90)return{x:-y,y:x}; if(a===180)return{x:-x,y:-y}; return{x,y};
 }
 function orientationVector(){
  if(filteredBeta==null||filteredGamma==null)return null;
  if(!haveOrientationBase){baseBeta=filteredBeta;baseGamma=filteredGamma;haveOrientationBase=true;return{x:0,y:0,mag:0,source:'orientation'}}
  const p=screenVector(norm180(filteredGamma-baseGamma),norm180(filteredBeta-baseBeta));
  return{x:p.x,y:p.y,mag:Math.hypot(p.x,p.y),source:'orientation'};
 }
 function gravityVector(){
  if(!gravity||performance.now()-lastGravityAt>GRAVITY_FRESH_MS)return null;
  if(!haveGravityBase){baseGravity={...gravity};haveGravityBase=true;return{x:0,y:0,mag:0,source:'gravity'}}
  /* Difference of normalized gravity vectors: robust to a naturally tilted holding pose.
     Scale to approximate degrees so the existing sensitivity control remains intuitive. */
  const len=Math.hypot(gravity.x,gravity.y,gravity.z)||1,bLen=Math.hypot(baseGravity.x,baseGravity.y,baseGravity.z)||1;
  const gx=gravity.x/len,gy=gravity.y/len,bx=baseGravity.x/bLen,by=baseGravity.y/bLen;
  const p=screenVector((gx-bx)*57.2958,(gy-by)*57.2958);
  return{x:p.x,y:p.y,mag:Math.hypot(p.x,p.y),source:'gravity'};
 }
 function controlVector(){return gravityVector()||orientationVector()}
 function choose(v){
  const ax=Math.abs(v.x),ay=Math.abs(v.y);
  if(activeDir){const q=activeDir==='left'||activeDir==='right'?ax:ay;if(q<EXIT_DEG)return null;return activeDir}
  if(v.mag<enterAngle)return null;
  if(ax>ay)return v.x>0?'right':'left';
  return v.y>0?'down':'up';
 }
 function repeatDelay(mag){const excess=Math.max(0,mag-enterAngle),t=Math.min(1,excess/14);return Math.round((420-300*t)*tempoPct/100)}
 function setDynamicZero(msg){
  if(gravity)baseGravity={...gravity},haveGravityBase=true;
  if(filteredBeta!=null&&filteredGamma!=null){baseBeta=filteredBeta;baseGamma=filteredGamma;haveOrientationBase=true}
  activeDir=null;lastStep=0;armedNeedsNeutral=false;stableSince=0;setBoardTilt(null,false);note(msg);
 }
 function tryTiltStep(dir){
  if(busy||!state||state.won)return;
  const probe=step(state,dir,freezeId),meaningful=probe.events.some(e=>e.type==='move'||e.type==='exit');
  if(!meaningful){setDynamicZero('Véghelyzet · új középhelyzet rögzítve');return}
  move(dir);
 }
 function process(){
  if(!enabled)return;const now=performance.now(),v=controlVector();if(!v)return;
  if(now<armingUntil){if(v.source==='gravity'&&gravity)baseGravity={...gravity},haveGravityBase=true;
   if(filteredBeta!=null){baseBeta=filteredBeta;baseGamma=filteredGamma;haveOrientationBase=true}return}
  if(armedNeedsNeutral){
   if(v.mag<EXIT_DEG){if(!stableSince)stableSince=now;if(now-stableSince>=STABLE_MS){armedNeedsNeutral=false;note('Mozgás aktív · '+(v.source==='gravity'?'gravitációs':'orientációs')+' szenzor')}}
   else{stableSince=0;if(gravity)baseGravity={...gravity};if(filteredBeta!=null){baseBeta=filteredBeta;baseGamma=filteredGamma}}
   return;
  }
  const dir=choose(v);if(!dir){if(activeDir)stop();return}
  if(dir!==activeDir){activeDir=dir;lastStep=now;setBoardTilt(dir,true);tryTiltStep(dir);return}
  if(now-lastStep>=repeatDelay(v.mag)){lastStep=now;tryTiltStep(dir)}
 }
 function onMotion(e){
  if(!enabled)return;const g=e.accelerationIncludingGravity;
  if(!g||![g.x,g.y,g.z].every(Number.isFinite))return;
  if(!gravity)gravity={x:g.x,y:g.y,z:g.z};
  else{gravity.x+=(g.x-gravity.x)*GRAVITY_FILTER;gravity.y+=(g.y-gravity.y)*GRAVITY_FILTER;gravity.z+=(g.z-gravity.z)*GRAVITY_FILTER}
  lastGravityAt=performance.now();process();
 }
 function onOrientation(e){
  if(!enabled||typeof e.beta!=='number'||typeof e.gamma!=='number')return;
  filteredBeta=filteredBeta==null?e.beta:filteredBeta+norm180(e.beta-filteredBeta)*FILTER;
  filteredGamma=filteredGamma==null?e.gamma:filteredGamma+norm180(e.gamma-filteredGamma)*FILTER;
  /* Orientation drives only when gravity data is absent/stale. */
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
   enabled=true;stop();
   if('DeviceOrientationEvent' in window&&!orientationListener){addEventListener('deviceorientation',onOrientation,true);orientationListener=true}
   if('DeviceMotionEvent' in window&&!motionListener){addEventListener('devicemotion',onMotion,true);motionListener=true}
   label();beginArming('Stabilizálás… tartsd kényelmesen a telefont');
  }catch(err){enabled=false;label();note('A mozgásvezérlés nem indítható: '+(err?.message||'ismeretlen hiba'))}
 }
 function disable(){enabled=false;armedNeedsNeutral=false;stop();label();note('')}
 async function toggle(){if(enabled)disable();else await enable()}
 function recalibrate(){if(enabled)beginArming('Stabilizálás… új középhelyzet')}
 function onNewLevel(){if(enabled)beginArming('Stabilizálás… új pálya')}
 function pause(){if(enabled){stop();note('Freeze kiválasztás · mozgás szünetel')}}
 function resume(){
  if(!enabled)return;
  /* Freeze után nem kérünk új neutral→tilt ciklust: a kiválasztás pillanatában
     mért testhelyzet lesz az új közép, így a következő valódi döntés az elsőre működik. */
  stop();armingUntil=0;armedNeedsNeutral=false;stableSince=0;
  if(gravity){baseGravity={...gravity};haveGravityBase=true}else{haveGravityBase=false}
  if(filteredBeta!=null&&filteredGamma!=null){baseBeta=filteredBeta;baseGamma=filteredGamma;haveOrientationBase=true}else haveOrientationBase=false;
  note('Freeze kész · mozgás aktív');
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

freezeBtn.addEventListener('click',()=>{if(!canUseFreeze())return;freezeArmed=!freezeArmed;if(freezeArmed){stopHold();MotionControl.pause();}else{freezeId=null;MotionControl.resume();}render({preservePieces:true});});
document.querySelector('#restart').addEventListener('click',()=>{if(busy)return;state=cloneState(initial);freezeArmed=false;freezeId=null;freezeUsed=0;freezeAnalysis=null;hintVisible=false;toast.textContent='';render();scheduleFreezeAnalysis();MotionControl.onNewLevel();});
document.querySelector('#new').addEventListener('click',()=>newLevel());
document.querySelector('#hint').addEventListener('click',hint);
soundBtn.addEventListener('click',()=>{AudioManager.toggle();render({preservePieces:true});});
function changeLevelProfile(){
 resetLevelBuffer();
 toast.textContent='Új pályák előkészítése…';
 const wait=()=>{
  const g=levelBuffer.shift();
  if(g){applyGeneratedLevel(g);fillLevelBuffer();}
  else setTimeout(wait,25);
 };
 wait();
}
difficultyEl.addEventListener('change',changeLevelProfile);sizeEl.addEventListener('change',changeLevelProfile);
freezeLimitEl.addEventListener('change',()=>{freezeUsed=0;freezeArmed=false;freezeId=null;render({preservePieces:true});scheduleFreezeAnalysis();});
document.querySelector('#loadCode').addEventListener('click',()=>{const p=parseCode(codeInput.value);if(!p){toast.textContent='Hibás pályakód. Példa: W4H-01ABC23';return}sizeEl.value=String(p.n);difficultyEl.value=p.difficulty;try{newLevel(p.seed,p.prefix);toast.textContent='Pálya betöltve.'}catch(e){toast.textContent='A pálya nem tölthető be.'}});
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
resetLevelBuffer();
const startWhenReady=()=>{
 const g=levelBuffer.shift();
 if(g){applyGeneratedLevel(g);fillLevelBuffer();finishStartup();}
 else setTimeout(startWhenReady,25);
};
startWhenReady();
