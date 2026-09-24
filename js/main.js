/* ===== UI ===== */
let state,initial,optimal=[],freezeArmed=false,freezeId=null,currentLevelId='',busy=false,lastEvents=[],hintVisible=false,freezeUsed=0;
const board=document.querySelector('#board'),status=document.querySelector('#status'),meta=document.querySelector('#meta'),codeEl=document.querySelector('#code'),toast=document.querySelector('#toast');
const freezeBtn=document.querySelector('#freeze'),difficultyEl=document.querySelector('#difficulty'),sizeEl=document.querySelector('#size'),freezeLimitEl=document.querySelector('#freezeLimit'),soundBtn=document.querySelector('#sound'),ambientBtn=document.querySelector('#ambientSound'),motionBtn=document.querySelector('#motion'),motionNote=document.querySelector('#motionNote');
const victoryOverlay=document.querySelector('#victoryOverlay'),victoryMoves=document.querySelector('#victoryMoves'),victoryScore=document.querySelector('#victoryScore'),victoryNext=document.querySelector('#victoryNext'),victoryRestart=document.querySelector('#victoryRestart'),victoryChoose=document.querySelector('#victoryChoose');
let victoryTimer=null,victoryPending=false,solverUsedThisRun=false;

/* Browsers suspend Web Audio until a genuine user gesture. Capture the first
   pointer/key gesture and let AudioManager start the selected theme ambient. */
const unlockAudio=()=>AudioManager?.userGesture?.();
addEventListener('pointerdown',unlockAudio,{capture:true,passive:true});
addEventListener('keydown',unlockAudio,{capture:true});
const angleValue=document.querySelector('#angleValue');
function setBusy(v){busy=v;document.querySelectorAll('[data-dir]').forEach(b=>b.disabled=v);}
/* Free play wallet v1: only this browser stores points. A level's best reward
   prevents repeated runs from minting unlimited points. */
const SCORE_KEY='ggrid.freeplay.score.v2',scoreValue=document.querySelector('#scoreValue'),hintBtn=document.querySelector('#hint');
let scoreData={balance:0,best:{}},rewardedThisRun=false;
try{const saved=JSON.parse(localStorage.getItem(SCORE_KEY)||'null');if(saved&&Number.isSafeInteger(saved.balance)&&saved.balance>=0&&saved.best&&typeof saved.best==='object'&&!Array.isArray(saved.best))scoreData=saved;}catch(_){}
function saveScore(){try{localStorage.setItem(SCORE_KEY,JSON.stringify(scoreData))}catch(e){console.warn('Pontok helyi mentése sikertelen',e)}}
function inFreePlay(){return !document.body.classList.contains('scenario-mode')}
function inMultiBallTest(){return document.body.classList.contains('multiball-test-mode')}
function isScoredFreePlay(){return inFreePlay()&&!inMultiBallTest()}
function totalBalls(s=state){return s?.objects?.filter(o=>o.type==='ball').length||0}
function remainingBalls(s=state){return s?.objects?.filter(o=>o.type==='ball'&&!o.exited).length||0}
function scoreBase(){const d=Math.max(1,Math.min(10,Number(currentLevelRecord?.analysis?.testDifficultyClass)||Number(difficultyEl.value)||1));return 5+Math.ceil(state.width*state.height/5)+2*d+Math.ceil(optimal.length/3)}
function scoreReward(){const optimum=Math.max(1,optimal.length),steps=Math.max(optimum,state.moves);return Math.max(1,Math.round(scoreBase()*(0.5+0.5*optimum/steps)))}
function updateLevelScore(){
 if(!state||!currentLevelId||!isScoredFreePlay())return;
 const best=Math.max(0,Math.min(scoreBase(),Number(scoreData.best[currentLevelId])||0)),done=best>0;
 const levelClass=Number(currentLevelRecord?.analysis?.testDifficultyClass)||Number(difficultyEl.value);
 const label=`${done?'✓ ':''}${currentLevelId} · D${levelClass} · ${best}/${scoreBase()} pont`;
 for(const id of ['homeLevelId','playLevelId']){const el=document.querySelector('#'+id);if(!el)continue;el.textContent=label;el.classList.toggle('completed',done);el.title=done?`Teljesített pálya · legjobb eredmény: ${best}/${scoreBase()} pont`:`Még nem teljesített pálya · maximum: ${scoreBase()} pont`}
}
function updateScore(){
 const won=!!state?.won,test=inMultiBallTest();
 if(scoreValue){
  if(test){scoreValue.textContent='TESZT';scoreValue.dataset.size='sm'}
  else{
   scoreValue.textContent=scoreData.balance.toLocaleString('hu-HU');
   const digits=String(Math.abs(scoreData.balance)).length;
   scoreValue.dataset.size=digits<=3?'lg':digits===4?'md':digits===5?'sm':digits===6?'xs':'xxs';
  }
 }
 const hintDisabled=won||test;
 if(hintBtn){hintBtn.disabled=hintDisabled;hintBtn.title=test?'A megoldási segítség a kétgolyós tesztben még nem aktív.':won?'A pálya már kész.':isScoredFreePlay()?'Rövid nyomás: súgó (1 pont). 3 másodperc: automatikus megoldás (0 pont).':''}
 const visibleHint=document.querySelector('#playHint');
 if(visibleHint){visibleHint.disabled=hintDisabled;visibleHint.title=test?'A megoldási segítség a kétgolyós tesztben még nem aktív.':won?'A pálya már kész.':'Rövid nyomás: súgó. 3 másodperc nyomva tartás: automatikus megoldás, pont nélkül.'}
 freezeBtn.disabled=won||!canUseFreeze()||(isScoredFreePlay()&&scoreData.balance<10);
 freezeBtn.dataset.freezeState=freezeBtn.disabled?'unavailable':freezeArmed?'active':'available';
 freezeBtn.title=won?'A pálya már kész.':freezeBtn.disabled?'Freeze: 10 pont szükséges':freezeArmed?'Freeze aktív: válassz elemet, vagy nyomd meg újra a kilépéshez':test?'Freeze teszt: pontlevonás nélkül':isScoredFreePlay()?'Freeze: 10 pont a kijelölt elemmel kiadott irányparancsért':'Freeze: elem kijelölése';
}
function spendScore(cost){if(scoreData.balance<cost)return false;scoreData.balance-=cost;saveScore();updateScore();return true}
function awardWin(){
 if(!isScoredFreePlay()||rewardedThisRun||!state?.won||!currentLevelId)return null;
 rewardedThisRun=true;
 const reward=scoreReward(),previous=Math.max(0,Number(scoreData.best[currentLevelId])||0),earned=Math.max(0,reward-previous);
 if(reward>previous)scoreData.best[currentLevelId]=reward;
 scoreData.balance+=earned;saveScore();updateScore();updateLevelScore();
 return{reward,previous,earned,balance:scoreData.balance};
}
function hideVictory(){
 if(victoryTimer)clearTimeout(victoryTimer);victoryTimer=null;victoryPending=false;
 victoryOverlay.hidden=true;document.body.classList.remove('victory-state');
}
function resetWinState(){hideVictory();solverUsedThisRun=false;rewardedThisRun=false;}
function enterVictory(automatic=false,rewardInfo=null){
 if(!state?.won||victoryPending||!victoryOverlay.hidden)return;
 victoryPending=true;freezeArmed=false;freezeId=null;hintVisible=false;toast.textContent='';
 stopHold();clearHintHold();MotionControl?.pause?.();
 if(autoSolveTimer)clearTimeout(autoSolveTimer);autoSolveTimer=null;autoSolveToken++;autoSolveActive=false;
 document.body.classList.add('victory-state');updateScore();
 victoryMoves.textContent=String(state.moves);
 const test=inMultiBallTest();
 if(test)victoryScore.textContent='Kétgolyós tesztpálya · pontozás nélkül';
 else if(solverUsedThisRun||automatic)victoryScore.textContent='Automatikus megoldás · 0 pont';
 else if(isScoredFreePlay()&&rewardInfo)victoryScore.textContent=rewardInfo.earned?`+${rewardInfo.earned} pont · Egyenleg: ${rewardInfo.balance}`:`Korábbi legjobb eredmény: ${rewardInfo.previous} pont`;
 else victoryScore.textContent='Pálya teljesítve';
 victoryChoose.hidden=!!ScenarioMode?.active;
 victoryNext.hidden=test;
 victoryNext.textContent=(ScenarioMode?.active&&!ScenarioMode?.hasNext)?'Befejezés':'Következő →';
 victoryTimer=setTimeout(()=>{victoryTimer=null;victoryPending=false;victoryOverlay.hidden=false;(test?victoryChoose:victoryNext).focus();},380);
}
function freezeLimit(){return Infinity;}
function freezesLeft(){const lim=freezeLimit();return lim===Infinity?Infinity:Math.max(0,lim-freezeUsed);}
function canUseFreeze(){return freezesLeft()>0;}
function cancelFreezeSelection(){if(!freezeArmed&&!freezeId)return;freezeArmed=false;freezeId=null;MotionControl?.resume?.();render({preservePieces:true});}
function syncSoundControls(){soundBtn.setAttribute('aria-checked',String(AudioManager.effectsEnabled));ambientBtn.setAttribute('aria-checked',String(AudioManager.ambientEnabled))}
function selectedDims(){const v=String(sizeEl.value);if(v.includes('x')){const [w,h]=v.split('x').map(Number);return{w,h}}const n=+v;return{w:n,h:n}}
function pctPos(x,y,w,h){const inset=1.8,cx=100/w,cy=100/h;return{left:`calc(${x*cx}% + ${inset}px)`,top:`calc(${y*cy}% + ${inset}px)`,width:`calc(${cx}% - ${inset*2}px)`,height:`calc(${cy}% - ${inset*2}px)`};}
function outerEdgeClasses(o,ci){
 const c=o.cells[ci],all=new Set(o.cells.map(q=>key(q.x,q.y))),cl=[];
 const sides=[['t',0,-1],['r',1,0],['b',0,1],['l',-1,0]];
 for(const [n,dx,dy] of sides)cl.push((all.has(key(c.x+dx,c.y+dy))?'join-':'edge-')+n);
 return cl.join(' ');
}
function render(opts={}){
 if(!state)return;
 board.style.setProperty('--cols',state.width);board.style.setProperty('--rows',state.height);board.style.aspectRatio=`${state.width}/${state.height}`;
 if(!opts.preservePieces){board.innerHTML='';for(let y=0;y<state.height;y++)for(let x=0;x<state.width;x++){const c=document.createElement('div');c.className='cell';c.style.gridColumn=x+1;c.style.gridRow=y+1;board.append(c);}
  const e=document.createElement('div');e.className=`exit exit-${state.exit.dir}`;e.style.gridColumn=state.exit.x+1;e.style.gridRow=state.exit.y+1;board.append(e);
  // The visual waypoint remains separate from the theme's decorative exit.
  // Its position follows the real exit, including every board size/direction.
  const beacon=document.createElement('div');beacon.className=`exit-beacon exit-beacon-${state.exit.dir}`;
  beacon.style.gridColumn=state.exit.x+1;beacon.style.gridRow=state.exit.y+1;
  beacon.setAttribute('role','img');beacon.setAttribute('aria-label',`Kijárat ${({up:'felül',down:'alul',left:'balra',right:'jobbra'})[state.exit.dir]||''}`);
  const label=document.createElement('span');label.textContent='KIJÁRAT';label.setAttribute('aria-hidden','true');beacon.append(label);board.append(beacon);
 }
 const existing=new Map([...board.querySelectorAll('.piece')].map(el=>[el.dataset.cellkey,el]));
 const wanted=new Set();
 for(const o of state.objects){
  for(let ci=0;ci<o.cells.length;ci++){
   const ck=`${o.id}:${ci}`;wanted.add(ck);let el=existing.get(ck);
   if(o.exited){if(el){el.style.opacity='0';el.style.transform='scale(.45)';setTimeout(()=>el.remove(),180)}continue;}
   if(!el){el=document.createElement('button');el.type='button';el.dataset.cellkey=ck;el.dataset.id=o.id;el.dataset.bodyid=o.id;el.ariaLabel=o.type==='ball'?'Golyó':o.type==='wall'?'Fix blokk':(o.cells.length>1?'Ragasztott tégla':'Tégla');
    el.addEventListener('click',()=>{if(o.type!=='wall'&&freezeArmed&&!busy&&!state.won){freezeId=freezeId===o.id?null:o.id;if(freezeId){AudioManager.freeze();SceneRenderer?.event?.('freeze');MotionControl.resume();}else MotionControl.pause();render({preservePieces:true});}});board.append(el);}
   const c=o.cells[ci],p=pctPos(o.x+c.x,o.y+c.y,state.width,state.height);
   el.style.left=p.left;el.style.top=p.top;el.style.width=p.width;el.style.height=p.height;
   el.className=`piece ${o.type} ${o.cells.length>1?'glued '+outerEdgeClasses(o,ci):''} ${freezeId===o.id?'selected':''}`;
   el.setAttribute('aria-pressed',String(freezeArmed&&freezeId===o.id));
  }
 }
 for(const [ck,el] of existing)if(!wanted.has(ck))el.remove();
 status.textContent='';
 const diff='D'+difficultyEl.value,glues=state.glueCount||0,walls=state.wallCount||0;
 const modeLabel=document.querySelector('#playModeLabel'),levelLabel=document.querySelector('#playLevelId');
 if(inMultiBallTest()){
  if(modeLabel)modeLabel.textContent='Kétgolyós teszt';
  if(levelLabel){levelLabel.textContent=`${remainingBalls()}/${totalBalls(initial)} golyó`;levelLabel.classList.remove('completed');levelLabel.title='Hátralévő golyók / induló golyók'}
  meta.textContent=`TESZT · golyók: ${remainingBalls()}/${totalBalls(initial)} · fix: ${walls}`;
 }else meta.textContent=`${diff} · modell: ${currentLevelRecord?.analysis?.rawDifficulty??'-'} · optimum: ${optimal.length} · fix: ${walls}`;
 codeEl.textContent=`Pálya: ${currentLevelId}`;
 const left=freezesLeft();
 freezeBtn.classList.toggle('active',freezeArmed);
 freezeBtn.setAttribute('aria-pressed',String(freezeArmed));
 freezeBtn.setAttribute('aria-label',freezeArmed?freezeId?'Freeze aktív, elem kijelölve; ismételt nyomásra kilép':'Freeze aktív: válassz elemet':`Freeze, hátralévő: ${left===Infinity?'korlátlan':left}${isScoredFreePlay()?' · 10 pont':''}`);updateScore();
 syncSoundControls();
 SceneRenderer?.afterBoardRender?.(board);
 board.querySelectorAll('.freeze-selection-marker').forEach(el=>el.remove());
 if(freezeArmed&&freezeId!=null){const selected=state.objects.find(o=>o.id===freezeId&&!o.exited);if(selected)for(const c of selected.cells){const marker=document.createElement('div'),p=pctPos(selected.x+c.x,selected.y+c.y,state.width,state.height);marker.className='freeze-selection-marker';marker.style.left=p.left;marker.style.top=p.top;marker.style.width=p.width;marker.style.height=p.height;marker.setAttribute('aria-hidden','true');board.append(marker)}}
}
/* ===== v0.12.95 MULTI-BALL ENGINE TEST =====
   Isolated from the scored Level Library: fixed geometry, selected free-play
   theme, no difficulty class, no points and no solver assistance. */
async function startMultiBallTest(){
 cancelAutoSolve();resetWinState();
 try{
  const r=await fetch('content/levels/test-multiball-01.json?v=0.12.95',{cache:'no-cache'});
  if(!r.ok)throw Error('MULTIBALL_TEST_FETCH');
  const l=await r.json();
  if(l.format!=='ggrid-level'||l.formatVersion!==1)throw Error('INVALID_MULTIBALL_TEST_FORMAT');
  const s={width:l.board.width,height:l.board.height,exit:{x:l.exit.x,y:l.exit.y,dir:l.exit.direction},objects:structuredClone(l.objects),moves:0,won:false};
  validateLevel(s);
  if(totalBalls(s)!==2)throw Error('MULTIBALL_TEST_REQUIRES_TWO_BALLS');
  document.body.classList.add('multiball-test-mode');
  state=s;initial=cloneState(s);optimal=[];currentLevelId=l.id||'test-multiball-01';currentLevelRecord=null;
  freezeLimitEl.value='inf';freezeArmed=false;freezeId=null;freezeUsed=0;hintVisible=false;rewardedThisRun=true;solverUsedThisRun=false;toast.textContent='';
  render();MotionControl?.onNewLevel?.();return true;
 }catch(e){
  console.error('Multi-ball test',e);toast.textContent='A kétgolyós tesztpálya nem tölthető be.';return false;
 }
}
function leaveMultiBallTest(){
 document.body.classList.remove('multiball-test-mode');
 const modeLabel=document.querySelector('#playModeLabel');if(modeLabel)modeLabel.textContent='Szabad játék';
}
globalThis.startMultiBallTest=startMultiBallTest;
globalThis.inMultiBallTest=inMultiBallTest;

/* ===== PRE-GENERATED LEVEL LIBRARY =====
   A player kizárólag előre generált, elemzett pályákat tölt a Level Libraryból.
   A pályagenerálás a fejlesztői/content pipeline feladata, nem runtime funkció. */
let currentLevelRecord=null;
function applyLibraryLevel(g){
 cancelAutoSolve();leaveMultiBallTest();
 resetWinState();state=g.state;validateLevel(state);initial=cloneState(state);optimal=g.solution||[];currentLevelId=g.code;currentLevelRecord=g.level||null;updateLevelScore();
 freezeLimitEl.value='inf';
 freezeArmed=false;freezeId=null;freezeUsed=0;hintVisible=false;toast.textContent='';
 render();MotionControl?.onNewLevel?.();
}
function requestLibraryLevel(){
 const d=selectedDims(),difficulty=Math.max(1,Math.min(10,parseInt(difficultyEl.value,10)||1));
 try{
  const l=LevelLibrary.next(d.w,d.h,difficulty);if(!l)throw Error('NO_LIBRARY_LEVEL');
  applyLibraryLevel(LevelLibrary.toGame(l));return true;
 }catch(e){
  console.error('Level library',e);toast.textContent='Nincs kompatibilis tesztpálya ehhez a mérethez és nehézséghez.';return false;
 }
}
function newLevel(){return requestLibraryLevel()}
function playEvents(events){
 const moves=events.filter(e=>e.type==='move').length,blocked=events.some(e=>e.type==='blocked'),exited=events.some(e=>e.type==='exit'),won=events.some(e=>e.type==='win');
 if(blocked){AudioManager.blocked();SceneRenderer?.event?.('blocked')}else if(moves){AudioManager.move(moves);SceneRenderer?.event?.('move')}
 if(exited){AudioManager.exit();SceneRenderer?.event?.('exit')}if(won){AudioManager.win();SceneRenderer?.event?.('win')}
 if(blocked){board.classList.remove('blocked');void board.offsetWidth;board.classList.add('blocked');setTimeout(()=>board.classList.remove('blocked'),190)}
 if(won){board.classList.add('winner');setTimeout(()=>board.classList.remove('winner'),600)}
}
function move(dir,automatic=false){
 if(!state||state.won||busy||(autoSolveActive&&!automatic))return;
 const usedFreeze=freezeArmed&&freezeId!=null,wasArmed=freezeArmed;
 if(usedFreeze&&isScoredFreePlay()&&scoreData.balance<10){cancelFreezeSelection();return}
 SceneRenderer?.setDirection?.(dir);if(hintVisible){hintVisible=false;toast.textContent='';}
 setBusy(true);const r=step(state,dir,usedFreeze?freezeId:null);
 if(usedFreeze){stopHold();if(isScoredFreePlay())spendScore(10);freezeUsed++;}
 state=r.state;lastEvents=r.events;freezeArmed=false;freezeId=null;
 if(wasArmed&&!state.won)MotionControl.resume();
 render({preservePieces:true});playEvents(r.events);
 if(state.won){
  const rewardInfo=automatic||solverUsedThisRun?null:awardWin();
  enterVictory(automatic,rewardInfo);
 }else if(usedFreeze)toast.textContent=isScoredFreePlay()?'Freeze felhasználva · −10 pont':'Freeze felhasználva';
 setTimeout(()=>{setBusy(false);render({preservePieces:true});},155);
}
let autoSolveActive=false,autoSolveTimer=null,autoSolveToken=0;
function cancelAutoSolve(){autoSolveToken++;if(autoSolveTimer)clearTimeout(autoSolveTimer);autoSolveTimer=null;if(autoSolveActive){autoSolveActive=false;MotionControl?.resume?.()}}
function startAutoSolve(){
 if(inMultiBallTest()){toast.textContent='Az automatikus megoldás a kétgolyós tesztben még nem aktív.';return}
 if(!state||state.won||autoSolveActive)return;
 stopHold();cancelFreezeSelection();hintVisible=false;
 const token=++autoSolveToken;toast.textContent='Automatikus megoldás számítása…';
 setTimeout(()=>{
  if(token!==autoSolveToken||!state)return;
  const route=state.moves===0?optimal:solve(state,40);
  if(token!==autoSolveToken)return;
  if(!route?.length){toast.textContent='Innen Freeze nélkül nincs megoldás.';return}
  // A demonstration cannot earn points, even if it is interrupted before victory.
  solverUsedThisRun=true;rewardedThisRun=true;autoSolveActive=true;MotionControl?.pause?.();render({preservePieces:true});
  let index=0;
  function next(){
   if(token!==autoSolveToken)return;
   if(index>=route.length||state.won){autoSolveActive=false;if(!state.won)MotionControl?.resume?.();return}
   if(busy){autoSolveTimer=setTimeout(next,80);return}
   toast.textContent=`Automatikus megoldás: ${index+1}/${route.length} · 0 pont`;
   move(route[index++],true);
   autoSolveTimer=setTimeout(next,680);
  }
  next();
 },0);
}
function hint(){
 if(inMultiBallTest()){toast.textContent='A megoldási javaslat a kétgolyós tesztben még nem aktív.';return}
 if(!state||state.won||autoSolveActive)return;
 cancelFreezeSelection();
 if(hintVisible){hintVisible=false;toast.textContent='';updateScore();return;}
 if(isScoredFreePlay()&&scoreData.balance<1)return;
 hintVisible=true;
 if(state.won){toast.textContent='A pálya már kész.';return}
 toast.textContent='Solver számol…';
 setTimeout(()=>{if(!hintVisible)return;const sol=solve(state,30);if(!sol)toast.textContent='Innen Freeze nélkül nincs megoldás.';else{if(isScoredFreePlay()&&!spendScore(1)){hintVisible=false;return}const arrows={up:'↑',down:'↓',left:'←',right:'→'};toast.textContent=`Innen minimum ${sol.length} lépés. Következő optimális irány: ${arrows[sol[0]]}`;}updateScore()},0);
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
 if(!state||state.won)return;
 if(e){e.preventDefault();try{source.setPointerCapture?.(e.pointerId)}catch(_){}}
 stopHold();holdDir=dir;holdSource=source;source.classList.add('pressed');setBoardTilt(dir,true);
 const oneShotFreeze=freezeArmed&&freezeId!=null;
 move(dir);if(oneShotFreeze){stopHold();return}const token=++holdToken;holdTimer=setTimeout(()=>holdTick(token),HOLD_FIRST_DELAY);
}
document.querySelectorAll('[data-hold-dir]').forEach(b=>{
 b.addEventListener('pointerdown',e=>startHold(b.dataset.holdDir,b,e));
 b.addEventListener('pointerup',stopHold);b.addEventListener('pointercancel',stopHold);
 b.addEventListener('lostpointercapture',stopHold);b.addEventListener('contextmenu',e=>e.preventDefault());
});

/* ===== Discrete screen-direction gestures: tilt and optional slide ===== */
const MotionControl=(()=>{
 const SETTINGS_KEY='ggrid.motion.gesture.v4',LEGACY_SETTINGS_KEY='ggrid.motion.gesture.v3',LEGACY_V2_KEY='ggrid.motion.gesture.v2',PROFILE_KEY='ggrid.motion.profile.v1';
 const SENSITIVITY_FACTORS=[.85,.70,.58,.48,.40,.36,.33,.30,.27,.24];
 const SETTLE_MS=[50,80,115,150,180,200,220,240,270,300],SENSOR_STALE_MS=3000,START_GRACE_MS=4000;
 let enabled=false,wanted=false,paused=true,sensorReady=false,capability='checking',sensitivity=5,settle=5,allowSlides=false,recognizer=null,lastSensorAt=0,lastOrientationAt=0,healthTimer=null,graceUntil=0,probeTimer=null;
 const settleValue=document.querySelector('#settleValue'),slideMotion=document.querySelector('#slideMotion'),availabilityEl=document.querySelector('#motionAvailability'),motionSection=document.querySelector('#motionSettingsSection');
 const dependentControls=['angleMinus','anglePlus','slideMotion','settleMinus','settlePlus','calibrate'].map(id=>document.querySelector('#'+id)).filter(Boolean);
 function note(t=''){motionNote.textContent=t}
 function apiPresent(){return 'DeviceMotionEvent' in window&&'DeviceOrientationEvent' in window}
 function permissionPromptNeeded(){return typeof window.DeviceMotionEvent?.requestPermission==='function'||typeof window.DeviceOrientationEvent?.requestPermission==='function'}
 function uiAllowsMotion(){
  if(document.body.dataset.uiContext!=='game'||state?.won)return false;
  return ['settingsPanel','gameMenuPanel','helpPanel','freePlaySetup','calibration','scenarioPanel'].every(id=>{const el=document.getElementById(id);return !el||el.hidden});
 }
 function label(){
  motionBtn.setAttribute('aria-checked',String(wanted&&capability!=='unavailable'));
  motionBtn.dataset.motionState=capability==='unavailable'?'unavailable':!wanted?'off':paused?'paused':sensorReady?'active':'waiting';
 }
 function setAvailability(value){
  capability=value;
  const unavailable=value==='unavailable';
  motionBtn.disabled=unavailable;
  dependentControls.forEach(el=>el.disabled=unavailable);
  motionSection?.classList.toggle('motion-unavailable',unavailable);
  if(availabilityEl)availabilityEl.textContent=unavailable?'Ezen az eszközön nincs elérhető mozgásérzékelés':value==='checking'?'Mozgásérzékelő ellenőrzése…':'Mozgásos irányítás be / ki';
  label();
 }
 function nearestIndex(values,target){let best=0,diff=Infinity;for(let i=0;i<values.length;i++){const d=Math.abs(values[i]-target);if(d<diff){best=i;diff=d}}return best+1}
 function migrateSensitivity(v){const oldFactor=.85-(Math.max(1,Math.min(10,v))-1)*.05;return nearestIndex(SENSITIVITY_FACTORS,oldFactor)}
 function migrateSettle(v){const oldMs=40+Math.max(1,Math.min(10,v))*20;return nearestIndex(SETTLE_MS,oldMs)}
 function loadSettings(){
  let migrated=false,s={};
  try{
   const saved=JSON.parse(localStorage.getItem(SETTINGS_KEY)||'null');
   if(saved)s=saved;
   else{
    const legacy=JSON.parse(localStorage.getItem(LEGACY_SETTINGS_KEY)||'null');
    if(legacy){s={sensitivity:legacy.sensitivity,settle:legacy.settle,allowSlides:legacy.allowSlides===true,motionWanted:false};migrated=true}
    else{
     const legacy2=JSON.parse(localStorage.getItem(LEGACY_V2_KEY)||'null');
     if(legacy2){s={sensitivity:Number.isInteger(legacy2.sensitivity)?migrateSensitivity(legacy2.sensitivity):5,settle:Number.isInteger(legacy2.settle)?migrateSettle(legacy2.settle):5,allowSlides:legacy2.allowSlides===true,motionWanted:false};migrated=true}
    }
   }
   if(Number.isInteger(s.sensitivity))sensitivity=Math.max(1,Math.min(10,s.sensitivity));
   if(Number.isInteger(s.settle))settle=Math.max(1,Math.min(10,s.settle));
   allowSlides=s.allowSlides===true;wanted=s.motionWanted===true;
   if(migrated)saveSettings();
  }catch(_){}
  angleValue.textContent=sensitivity+'/10';settleValue.textContent=settle+'/10';slideMotion.checked=allowSlides;
 }
 function saveSettings(){try{localStorage.setItem(SETTINGS_KEY,JSON.stringify({sensitivity,settle,allowSlides,motionWanted:wanted}))}catch(_){}}
 function profile(){
  let p=MotionGestureDefaultProfile;
  try{const saved=JSON.parse(localStorage.getItem(PROFILE_KEY)||'null');if(isMotionGestureProfile(saved))p=saved}catch(_){}
  const factor=SENSITIVITY_FACTORS[sensitivity-1];
  return {...p,minimumRate:Math.max(25,p.minimumRate*factor),minimumExcursion:Math.max(2,p.minimumExcursion*factor),
   slideAcceleration:Math.max(.1,p.slideAcceleration*factor),triggerRate:Math.max(20,p.triggerRate*factor),
   triggerAcceleration:Math.max(.7,p.triggerAcceleration*factor),quietMs:SETTLE_MS[settle-1]};
 }
 function newRecognizer(){recognizer=new MotionGestureRecognizer(profile(),stepOnce,{allowSlides})}
 function screenAngle(){return (screen.orientation&&typeof screen.orientation.angle==='number'?screen.orientation.angle:(typeof window.orientation==='number'?window.orientation:0))||0}
 function reset(){recognizer?.reset();setBoardTilt(null,false)}
 function refreshSensorReady(now){
  if(paused||document.hidden||!enabled)return;
  const ready=lastSensorAt>0&&lastOrientationAt>0&&now-lastSensorAt<SENSOR_STALE_MS&&now-lastOrientationAt<SENSOR_STALE_MS;
  if(ready&&!sensorReady){sensorReady=true;reset();label();note('Mozgás aktív · egy billentés, egy lépés')}
 }
 function stepOnce(dir){if(paused||!sensorReady||busy||!state||state.won)return;setBoardTilt(dir,true);move(dir);setTimeout(()=>setBoardTilt(null,false),180)}
 function onOrientation(e){
  if(!enabled||document.hidden||![e.beta,e.gamma].every(Number.isFinite))return;
  const now=performance.now();lastOrientationAt=now;refreshSensorReady(now);
  if(paused||!sensorReady||!recognizer)return;
  recognizer.orientation(e,now,screenAngle());
 }
 function onMotion(e){
  if(!enabled||document.hidden)return;
  const a=e.acceleration||{},r=e.rotationRate||{};
  if(![a.x,a.y,a.z,r.alpha,r.beta,r.gamma].every(Number.isFinite))return;
  const now=performance.now();lastSensorAt=now;refreshSensorReady(now);
  if(paused||!sensorReady||!recognizer)return;
  recognizer.motion({ax:a.x,ay:a.y,az:a.z,alpha:r.alpha,beta:r.beta,gamma:r.gamma},now,screenAngle());
 }
 function health(){
  if(!enabled||paused||document.hidden||performance.now()<graceUntil)return;
  const now=performance.now();
  if(now-lastSensorAt>SENSOR_STALE_MS||now-lastOrientationAt>SENSOR_STALE_MS){
   if(sensorReady)reset();
   sensorReady=false;label();
   note('A szenzoradat átmenetileg szünetel; a vezérlés automatikusan visszatér, ha újra érkezik adat.');
  }
 }
 function startRuntime(){
  if(enabled||capability==='unavailable')return;
  newRecognizer();enabled=true;paused=!uiAllowsMotion();sensorReady=false;lastSensorAt=lastOrientationAt=0;graceUntil=performance.now()+START_GRACE_MS;
  addEventListener('deviceorientation',onOrientation,true);addEventListener('devicemotion',onMotion,true);
  clearInterval(healthTimer);healthTimer=setInterval(health,1200);
  label();note(paused?'Mozgás szünetel':'Mozgásérzékelő indítása…');
 }
 function stopRuntime(){
  enabled=false;paused=true;sensorReady=false;removeEventListener('deviceorientation',onOrientation,true);removeEventListener('devicemotion',onMotion,true);
  clearInterval(healthTimer);healthTimer=null;lastSensorAt=lastOrientationAt=0;reset();recognizer=null;label();
 }
 async function requestPermissions(){
  if(typeof window.DeviceOrientationEvent?.requestPermission==='function'&&await window.DeviceOrientationEvent.requestPermission()!=='granted')return false;
  if(typeof window.DeviceMotionEvent?.requestPermission==='function'&&await window.DeviceMotionEvent.requestPermission()!=='granted')return false;
  return true;
 }
 async function enable(setPreference=true,allowPrompt=true){
  if(setPreference){wanted=true;saveSettings()}
  if(!apiPresent()){setAvailability('unavailable');return}
  if(capability==='unavailable')return;
  try{
   if(permissionPromptNeeded()){
    if(!allowPrompt){label();note('Mozgásvezérlés bekapcsolva · játék közben érintésre aktiválódik.');return}
    if(!await requestPermissions()){wanted=false;saveSettings();label();note('A mozgásérzékelő engedélye hiányzik.');return}
   }
   setAvailability('available');startRuntime();
   if(uiAllowsMotion())resume();
  }catch(err){
   if(setPreference){wanted=false;saveSettings()}
   stopRuntime();label();note('A mozgásvezérlés nem indítható: '+(err?.message||'ismeretlen hiba'));
  }
 }
 function disable(){
  wanted=false;saveSettings();stopRuntime();note('');
 }
 async function toggle(){if(wanted)disable();else await enable(true,true)}
 function pause(){if(enabled){paused=true;sensorReady=false;reset();label();note('Mozgás szünetel')}}
 function resume(){
  if(!wanted||capability==='unavailable')return;
  if(!enabled){
   if(!permissionPromptNeeded())startRuntime();
   else{label();note('Mozgásvezérlés bekapcsolva · játék közben érintésre aktiválódik.');return}
  }
  if(!uiAllowsMotion()){paused=true;label();return}
  paused=false;sensorReady=false;lastSensorAt=lastOrientationAt=0;graceUntil=performance.now()+START_GRACE_MS;reset();label();note('Mozgásérzékelő újraindítása…');
 }
 function adjustAngle(delta){sensitivity=Math.max(1,Math.min(10,sensitivity+delta));angleValue.textContent=sensitivity+'/10';saveSettings();if(enabled)newRecognizer()}
 function adjustSettle(delta){settle=Math.max(1,Math.min(10,settle+delta));settleValue.textContent=settle+'/10';saveSettings();if(enabled)newRecognizer()}
 function setSlides(value){allowSlides=value;saveSettings();if(enabled)newRecognizer()}
 function probeCapability(){
  if(!apiPresent()){setAvailability('unavailable');return}
  if(permissionPromptNeeded()){setAvailability('available');return}
  if(document.hidden){probeTimer=setTimeout(probeCapability,1000);return}
  let gotMotion=false,gotOrientation=false,done=false;
  const po=e=>{if([e.beta,e.gamma].every(Number.isFinite))gotOrientation=true};
  const pm=e=>{const a=e.acceleration||{},r=e.rotationRate||{};if([a.x,a.y,a.z,r.alpha,r.beta,r.gamma].every(Number.isFinite))gotMotion=true};
  const finish=()=>{
   if(done)return;done=true;removeEventListener('deviceorientation',po,true);removeEventListener('devicemotion',pm,true);probeTimer=null;
   if(gotMotion&&gotOrientation)setAvailability('available');
   else{setAvailability('unavailable');if(enabled)stopRuntime();if(wanted)note('Ezen az eszközön nem érkezik használható mozgásérzékelő adat.');}
  };
  addEventListener('deviceorientation',po,true);addEventListener('devicemotion',pm,true);
  probeTimer=setTimeout(finish,3500);
 }
 async function userGesture(){
  if(!wanted||enabled||capability==='unavailable'||document.body.dataset.uiContext!=='game')return;
  await enable(false,true);
 }
 function onVisibility(){
  if(!enabled)return;
  sensorReady=false;reset();label();
  if(document.hidden)return;
  lastSensorAt=lastOrientationAt=0;graceUntil=performance.now()+START_GRACE_MS;
  if(!paused)note('Mozgásérzékelő újraindítása…');
 }
 loadSettings();label();probeCapability();
 if(wanted&&!permissionPromptNeeded()&&apiPresent())startRuntime();
 document.addEventListener('visibilitychange',onVisibility);
 return{toggle,pause,resume,userGesture,adjustAngle,adjustSettle,setSlides,recalibrate:reset,onNewLevel:reset,get enabled(){return enabled},get wanted(){return wanted}};
})();
motionBtn.addEventListener('click',()=>MotionControl.toggle());
const restoreMotionFromGesture=()=>MotionControl.userGesture();
addEventListener('pointerdown',restoreMotionFromGesture,{capture:true,passive:true});
addEventListener('keydown',restoreMotionFromGesture,{capture:true});
document.querySelector('#angleMinus').addEventListener('click',()=>MotionControl.adjustAngle(-1));
document.querySelector('#anglePlus').addEventListener('click',()=>MotionControl.adjustAngle(1));
document.querySelector('#settleMinus').addEventListener('click',()=>MotionControl.adjustSettle(-1));
document.querySelector('#settlePlus').addEventListener('click',()=>MotionControl.adjustSettle(1));
document.querySelector('#slideMotion').addEventListener('change',e=>MotionControl.setSlides(e.target.checked));


/* ===== v0.10.4 MOTION CALIBRATION LAB ===== */
const CalibrationLab=(()=>{
 const panel=document.querySelector('#calibration'),phaseEl=document.querySelector('#calPhase'),arrowEl=document.querySelector('#calArrow'),
 instructionEl=document.querySelector('#calInstruction'),progressEl=document.querySelector('#calProgress'),statsEl=document.querySelector('#calStats'),
 startBtn=document.querySelector('#calStart'),exportBtn=document.querySelector('#calExport');
 const prompts={up:'↑',down:'↓',left:'←',right:'→',lift:'EMEL',lower:'SÜLLYESZT',slideRight:'CSÚSZTASD JOBBRA',slideLeft:'CSÚSZTASD BALRA',slideUp:'CSÚSZTASD FEL',slideDown:'CSÚSZTASD LE'};
 const negativeTargets=new Set(['lift','lower','slideRight','slideLeft','slideUp','slideDown']);
 /* Three tilts per direction, two vertical translations and two straight slides
    per axis and direction. Slide the screen in its own plane, facing the player. */
 const sequence=['right','slideLeft','left','lift','up','slideUp','down','lower','slideRight','left','right','slideDown','up','down','lift','slideUp','right','slideRight','slideDown','slideLeft','left','lower','down','up'];
 const BASELINE_MS=500,POST_MS=450,PAUSE_MS=650,QUIET_MS=170,WAIT_LIMIT_MS=15000,ACTIVE_LIMIT_MS=4500;
 const START_ACCEL=2.2,START_RATE=75,START_ORIENTATION_RATE=75,QUIET_ACCEL=.85,QUIET_RATE=23;
 let running=false,samples=[],segments=[],currentTarget=null,currentFrom='neutral',phase='idle',phaseStarted=0,timer=null,watchdog=null;
 let baselineStartSample=0,movementStartSample=0,movementEndSample=0,baselineStartT=0,movementStartT=0,movementEndT=0;
 let candidateAt=null,candidateSample=0,candidateSource='',quietSince=null,lastMotionAt=0,lastOrientation=null,peakAccel=0,peakRate=0;
 let lastO={alpha:null,beta:null,gamma:null,absolute:null},lastM={gx:null,gy:null,gz:null,ax:null,ay:null,az:null,rrAlpha:null,rrBeta:null,rrGamma:null};
 function screenAngle(){return (screen.orientation&&typeof screen.orientation.angle==='number'?screen.orientation.angle:(typeof window.orientation==='number'?window.orientation:0))||0}
 function sample(source){
  if(!running)return;
  samples.push({t:Math.round(performance.now()*10)/10,phase,from:currentFrom,to:currentTarget,source,screenAngle:screenAngle(),
   alpha:lastO.alpha,beta:lastO.beta,gamma:lastO.gamma,absolute:lastO.absolute,
   gx:lastM.gx,gy:lastM.gy,gz:lastM.gz,ax:lastM.ax,ay:lastM.ay,az:lastM.az,rrAlpha:lastM.rrAlpha,rrBeta:lastM.rrBeta,rrGamma:lastM.rrGamma});
 }
 function onO(e){lastO={alpha:e.alpha,beta:e.beta,gamma:e.gamma,absolute:e.absolute};sample('orientation');
  const now=performance.now(),prev=lastOrientation;lastOrientation={beta:e.beta,gamma:e.gamma,t:now};
  if((now-lastMotionAt<250&&[lastM.rrBeta,lastM.rrGamma].every(Number.isFinite))||!prev||![prev.beta,prev.gamma,e.beta,e.gamma].every(Number.isFinite))return;
  const dt=now-prev.t;if(dt<8||dt>250)return;
  const delta=a=>((a+540)%360)-180;
  const speed=Math.hypot(delta(e.beta-prev.beta),delta(e.gamma-prev.gamma))*1000/dt;
  detectGesture(now,0,speed,'orientation');
 }
 function onM(e){const g=e.accelerationIncludingGravity||{},a=e.acceleration||{},r=e.rotationRate||{};
  lastM={gx:g.x,gy:g.y,gz:g.z,ax:a.x,ay:a.y,az:a.z,rrAlpha:r.alpha,rrBeta:r.beta,rrGamma:r.gamma};sample('motion');
  const now=lastMotionAt=performance.now();
  const accel=[a.x,a.y,a.z].every(Number.isFinite)?Math.hypot(a.x,a.y,a.z):0;
  const rate=[r.beta,r.gamma].every(Number.isFinite)?Math.hypot(r.beta,r.gamma):0;
  detectGesture(now,accel,rate,'motion');
 }
 function ensureListeners(){addEventListener('deviceorientation',onO,true);addEventListener('devicemotion',onM,true)}
 function removeListeners(){removeEventListener('deviceorientation',onO,true);removeEventListener('devicemotion',onM,true)}
 async function permissions(){
  if(typeof DeviceOrientationEvent!=='undefined'&&typeof DeviceOrientationEvent.requestPermission==='function'){
   if(await window.DeviceOrientationEvent.requestPermission()!=='granted')throw Error('DeviceOrientation engedély megtagadva');
  }
  if(typeof DeviceMotionEvent!=='undefined'&&typeof DeviceMotionEvent.requestPermission==='function'){
   if(await window.DeviceMotionEvent.requestPermission()!=='granted')throw Error('DeviceMotion engedély megtagadva');
  }
 }
 function open(){panel.hidden=false;MotionControl.pause();statsEl.textContent='12 rövid billentés, 4 emelés/süllyesztés és 8 csúsztatás rögzítése. A mérés után töltsd le a JSON-fájlt.'}
 function close(){if(running)finish(false);panel.hidden=true;if(document.querySelector('#settingsPanel').hidden)MotionControl.resume();document.querySelector('#calibrate').focus()}
 function setProgress(i,f=0){progressEl.style.width=Math.min(100,Math.max(0,((i+f)/sequence.length)*100))+'%'}
 function fail(reason){finish(false,reason)}
 function beginWaiting(i){
  phase='waiting';currentTarget=sequence[i];currentFrom=i?sequence[i-1]:'neutral';phaseStarted=performance.now();
  candidateAt=null;quietSince=null;peakAccel=0;peakRate=0;
  arrowEl.textContent=prompts[currentTarget];arrowEl.classList.toggle('cal-word',negativeTargets.has(currentTarget));arrowEl.classList.toggle('cal-slide',currentTarget.startsWith('slide'));
  phaseEl.textContent='Mozdulat '+(i+1)+' / '+sequence.length;setProgress(i);
  clearTimeout(watchdog);watchdog=setTimeout(()=>fail('Nem érkezett felismerhető mozdulat. Indíts új mérést, és engedélyezd a mozgásérzékelőt.'),WAIT_LIMIT_MS);
 }
 function beginMove(now,source){
  phase='transition';phaseStarted=movementStartT=candidateAt;movementStartSample=candidateSample;
  baselineStartT=Math.max(0,candidateAt-BASELINE_MS);
  baselineStartSample=samples.findIndex(s=>s.t>=baselineStartT);
  if(baselineStartSample<0)baselineStartSample=0;
  candidateSource=source;quietSince=null;
  clearTimeout(watchdog);watchdog=setTimeout(()=>fail('A mozdulat nem ért véget vagy megszakadt az érzékelő jele. Indíts új mérést.'),ACTIVE_LIMIT_MS);
 }
 function beginPost(now){
  clearTimeout(watchdog);watchdog=null;
  phase='post';phaseStarted=movementEndT=now;movementEndSample=samples.length;
  arrowEl.textContent='';arrowEl.classList.remove('cal-word','cal-slide');setProgress(segments.length,.7);
  timer=setTimeout(()=>{
   segments.push({to:currentTarget,expectedDirection:negativeTargets.has(currentTarget)?null:currentTarget,detectedBy:candidateSource,peakAcceleration:peakAccel,peakRotationRate:peakRate,baselineStartSample,movementStartSample,movementEndSample,endSample:samples.length,baselineStartT,movementStartT,movementEndT,endT:performance.now()});
   const i=segments.length;if(i<sequence.length){phase='pause';timer=setTimeout(()=>beginWaiting(i),PAUSE_MS)}else finish(true);
  },POST_MS);
 }
 function detectGesture(now,accel,rate,source){
  if(!running||!['waiting','transition'].includes(phase))return;
  const start=accel>=START_ACCEL||rate>=(source==='orientation'?START_ORIENTATION_RATE:START_RATE);
  const quiet=accel<QUIET_ACCEL&&rate<QUIET_RATE;
  if(phase==='waiting'){
   if(!start){candidateAt=null;return}
   if(candidateAt===null||now-candidateAt>140){candidateAt=now;candidateSample=Math.max(0,samples.length-1);return}
   beginMove(now,source);
  }
  peakAccel=Math.max(peakAccel,accel);peakRate=Math.max(peakRate,rate);
  if(!quiet){quietSince=null;return}
  if(quietSince===null)quietSince=now;
  if(now-quietSince>=QUIET_MS&&now-movementStartT>=180)beginPost(now);
 }
 function summarize(){
  const motion=samples.filter(s=>s.source==='motion'&&[s.gx,s.gy,s.gz].every(v=>Number.isFinite(v))).length;
  const orient=samples.filter(s=>s.source==='orientation'&&Number.isFinite(s.beta)&&Number.isFinite(s.gamma)).length;
  const rates=samples.filter(s=>s.source==='motion'&&[s.rrBeta,s.rrGamma].every(Number.isFinite)).length;
  return{samples:samples.length,motionSamples:motion,orientationSamples:orient,rotationRateSamples:rates,completedMovements:segments.length,negativeExamples:segments.filter(s=>s.expectedDirection===null).length,screenAngles:[...new Set(samples.map(s=>s.screenAngle))]};
 }
 function profilePreview(){
  /* Raw measurements are for offline research; this is not a gameplay profile. */
  return{version:4,created:new Date().toISOString(),summary:summarize()};
 }
 function finish(ok,reason='A mérés megszakítva.'){
  clearTimeout(timer);clearTimeout(watchdog);watchdog=null;running=false;removeListeners();phase=ok?'done':'cancelled';currentTarget=null;panel.classList.remove('is-measuring');arrowEl.classList.remove('cal-word','cal-slide');
  if(ok){setProgress(sequence.length);arrowEl.textContent='✓';instructionEl.textContent='Mérés elkészült';const s=summarize();
   statsEl.textContent='Nyers minták: '+s.samples+'\nMozgás: '+s.motionSamples+' · tájolás: '+s.orientationSamples+' · forgási sebesség: '+s.rotationRateSamples+'\nRögzített mozdulatok: '+s.completedMovements+'/'+sequence.length+' · ebből elutasítandó: '+s.negativeExamples+' (4 emelés/süllyesztés, 8 csúsztatás)';
   exportBtn.disabled=!s.motionSamples&&!s.orientationSamples;startBtn.textContent='Új mérés';
  }else{arrowEl.textContent='•';instructionEl.textContent=reason;statsEl.textContent=reason;startBtn.textContent='Mérés újraindítása'}
 }
 async function start(){
  if(running){finish(false);return}try{await permissions()}catch(e){statsEl.textContent='Nem indítható: '+e.message;return}
  MotionControl.pause();samples=[];segments=[];running=true;exportBtn.disabled=true;startBtn.textContent='Mérés megszakítása';ensureListeners();panel.classList.add('is-measuring');
  phase='prepare';arrowEl.textContent='';instructionEl.textContent='';statsEl.textContent='';progressEl.style.width='0%';
  timer=setTimeout(()=>beginWaiting(0),1000);
 }
 function exportData(){
  if(!samples.length)return;const payload={format:'GGrid Motion Calibration Raw',version:4,created:new Date().toISOString(),
   userAgent:navigator.userAgent,sequence,parameters:{baselineMs:BASELINE_MS,postMs:POST_MS,pauseMs:PAUSE_MS,quietMs:QUIET_MS,startAcceleration:START_ACCEL,startRotationRate:START_RATE,startOrientationRate:START_ORIENTATION_RATE,quietAcceleration:QUIET_ACCEL,quietRotationRate:QUIET_RATE,waitLimitMs:WAIT_LIMIT_MS,activeLimitMs:ACTIVE_LIMIT_MS},summary:summarize(),profilePreview:profilePreview(),segments,samples};
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download='GGrid-calibration-'+new Date().toISOString().replace(/[:.]/g,'-')+'.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 document.querySelector('#calibrate').addEventListener('click',open);document.querySelector('#calClose').addEventListener('click',close);
 startBtn.addEventListener('click',start);exportBtn.addEventListener('click',exportData);
 return{open};
})();

freezeBtn.addEventListener('click',()=>{if(state?.won||autoSolveActive||freezeBtn.disabled)return;if(freezeArmed){cancelFreezeSelection();return}freezeArmed=true;freezeId=null;stopHold();MotionControl.pause();render({preservePieces:true});});
document.querySelector('#restart').addEventListener('click',()=>{if(busy)return;cancelAutoSolve();resetWinState();state=cloneState(initial);freezeArmed=false;freezeId=null;freezeUsed=0;hintVisible=false;toast.textContent='';render();MotionControl.onNewLevel();MotionControl.resume();});
document.querySelector('#new').addEventListener('click',()=>{hideVictory();if(inMultiBallTest()){state=cloneState(initial);freezeArmed=false;freezeId=null;freezeUsed=0;hintVisible=false;toast.textContent='';render();MotionControl.onNewLevel();}else newLevel();MotionControl.resume();});
victoryRestart.addEventListener('click',()=>document.querySelector('#restart').click());
victoryChoose.addEventListener('click',()=>{hideVictory();AppUI?.openFreeSetup?.()});
victoryNext.addEventListener('click',async()=>{
 if(inMultiBallTest())return;
 if(ScenarioMode?.active){
  hideVictory();await ScenarioMode.advanceAfterWin();MotionControl.resume();return;
 }
 hideVictory();newLevel();MotionControl.resume();
});
document.querySelector('#hint').addEventListener('click',hint);
// Short click still requests a hint; a three-second pointer hold runs the demo.
const playHintBtn=document.querySelector('#playHint');let hintHoldTimer=null,hintHoldFired=false,hintHoldPointer=null;
function clearHintHold(){if(hintHoldTimer)clearTimeout(hintHoldTimer);hintHoldTimer=null;hintHoldPointer=null;playHintBtn.classList.remove('pressed')}
playHintBtn.addEventListener('pointerdown',e=>{
 if(state?.won||e.button!==0||hintHoldPointer!==null)return;
 clearHintHold();hintHoldFired=false;hintHoldPointer=e.pointerId;
 // Keep receiving the release even if the finger drifts off this small button.
 try{playHintBtn.setPointerCapture(e.pointerId)}catch(_){}
 playHintBtn.classList.add('pressed');
 hintHoldTimer=setTimeout(()=>{hintHoldTimer=null;hintHoldFired=true;playHintBtn.classList.remove('pressed');startAutoSolve()},3000);
});
for(const event of ['pointerup','pointercancel','lostpointercapture'])playHintBtn.addEventListener(event,e=>{if(e.pointerId===hintHoldPointer)clearHintHold()});
// Some mobile browsers issue a context menu on long touch; CSS disables that gesture.
playHintBtn.addEventListener('click',e=>{if(!hintHoldFired)return;e.preventDefault();e.stopImmediatePropagation();hintHoldFired=false},true);
playHintBtn.addEventListener('contextmenu',e=>e.preventDefault());
soundBtn.addEventListener('click',async()=>{await AudioManager.toggleEffects();syncSoundControls()});
ambientBtn.addEventListener('click',async()=>{await AudioManager.toggleAmbient();syncSoundControls()});
syncSoundControls();
function changeLevelProfile(){
 cancelAutoSolve();leaveMultiBallTest();
 
 /* A régi pálya ne maradjon látható, miközben az új méret készül. */
 state=null;initial=null;optimal=[];currentLevelId='';
 board.innerHTML='';board.style.setProperty('--cols',selectedDims().w);board.style.setProperty('--rows',selectedDims().h);
 board.style.aspectRatio=`${selectedDims().w}/${selectedDims().h}`;
 toast.textContent=`Tesztpálya betöltése: ${selectedDims().w}×${selectedDims().h} · D${difficultyEl.value}…`;
 newLevel();
}
difficultyEl.addEventListener('change',changeLevelProfile);sizeEl.addEventListener('change',changeLevelProfile);
freezeLimitEl.addEventListener('change',()=>{freezeUsed=0;freezeArmed=false;freezeId=null;render({preservePieces:true});});
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
 if(m){e.preventDefault();if(state?.won)return;keyboardDirs.delete(m);keyboardDirs.add(m);refreshKeyboardTilt();move(m);}
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

finishStartup();
