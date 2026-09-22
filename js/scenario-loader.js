/* ===== v0.11.0 SCENARIO + THEME LOADER ===== */
const ScenarioMode=(()=>{
 const ROOT='content/',progressKey='ggrid.scenario.progress.v1';
 let active=false,scenario=null,chapterIndex=0,stageIndex=0,effective=null,timerId=null,timeLeft=null;
 const panel=document.querySelector('#scenarioPanel'),list=document.querySelector('#scenarioList'),title=document.querySelector('#scenarioTitle'),desc=document.querySelector('#scenarioDesc'),info=document.querySelector('#scenarioInfo');
 const playBtn=document.querySelector('#playScenario'),closeBtn=document.querySelector('#scenarioClose'),freeBtn=document.querySelector('#freePlay');
 const fetchJson=async src=>{const r=await fetch(src,{cache:'no-cache'});if(!r.ok)throw Error('CONTENT_FETCH_FAILED '+src);return r.json()};
 const refUrl=(base,src)=>new URL(src,new URL(base,location.href)).href;
 function checkDoc(d,format){if(!d||d.format!==format||d.formatVersion!==1)throw Error('INVALID_CONTENT_FORMAT');}
 function merge(parent,obj){
  const r={...parent};
  for(const k of ['theme','abilities','timer','completion'])if(Object.prototype.hasOwnProperty.call(obj,k))r[k]=obj[k];
  return r;
 }
 function stageAt(ci=chapterIndex,si=stageIndex){return scenario.chapters[ci].stages[si]}
 function resolveStage(){
  const ch=scenario.chapters[chapterIndex],st=stageAt(),base=scenario.__url;
  const cfg=merge(merge(scenario.defaults||{},ch),st);
  return{...cfg,chapter:ch,stage:st,base};
 }
 async function loadRef(ref,base,format){
  if(!ref?.src)throw Error('INVALID_REFERENCE');
  const url=refUrl(base,ref.src),d=await fetchJson(url);checkDoc(d,format);
  if(d.version!==ref.version)throw Error('CONTENT_VERSION_MISMATCH');
  d.__url=url;return d;
 }
 function toState(l){
  if(!Number.isInteger(l.board?.width)||!Number.isInteger(l.board?.height))throw Error('INVALID_LEVEL_GEOMETRY');
  const s={width:l.board.width,height:l.board.height,exit:{x:l.exit.x,y:l.exit.y,dir:l.exit.direction},objects:structuredClone(l.objects),moves:0,won:false};
  validateLevel(s);return s;
 }
 function applyTheme(t){
  document.body.dataset.theme=t.id||'classic';
  document.documentElement.style.setProperty('--scenario-bg',t.colors?.background||'');
  document.documentElement.style.setProperty('--scenario-board',t.colors?.board||'');
 }
 function abilityCount(type){const a=(effective?.abilities||[]).find(x=>x.type===type);return a?Math.max(0,a.count|0):0}
 function applyAbilities(){
  const n=abilityCount('freeze');
  freezeLimitEl.value=n<=3?String(n):'3';
  freezeUsed=0;freezeArmed=false;freezeId=null;
 }
 function stopTimer(){if(timerId){clearInterval(timerId);timerId=null}timeLeft=null}
 function startTimer(){
  stopTimer();const t=effective.timer;if(!t)return;
  if(t.mode!=='countdown'||!(t.seconds>0))throw Error('UNSUPPORTED_TIMER');
  timeLeft=t.seconds;paintInfo();
  timerId=setInterval(()=>{timeLeft--;paintInfo();if(timeLeft<=0){stopTimer();toast.textContent='Lejárt az idő. A pálya újraindul.';setTimeout(()=>loadStage(chapterIndex,stageIndex),500)}},1000);
 }
 function paintInfo(){
  if(!active||!effective){info.textContent='';return}
  const ch=effective.chapter,st=effective.stage,parts=[ch.name,st.name];
  if(timeLeft!=null)parts.push('⏱ '+timeLeft+' s');
  info.textContent=parts.join(' · ');
 }
 async function loadStage(ci,si){
  chapterIndex=ci;stageIndex=si;effective=resolveStage();
  if(effective.completion?.type&&effective.completion.type!=='allBallsExited')throw Error('UNSUPPORTED_COMPLETION');
  const theme=await loadRef(effective.theme,effective.base,'ggrid-theme');applyTheme(theme);
  const lvl=await loadRef(effective.stage.level,effective.base,'ggrid-level'),s=toState(lvl);
  state=s;initial=cloneState(s);optimal=solve(s,30)||[];currentCode='Scenario: '+scenario.id+' / '+effective.stage.id;
  active=true;applyAbilities();hintVisible=false;toast.textContent='';render();paintInfo();startTimer();scheduleFreezeAnalysis();MotionControl?.onNewLevel?.();
  try{localStorage.setItem(progressKey,JSON.stringify({scenarioId:scenario.id,version:scenario.version,chapterIndex,stageIndex}))}catch(_){}
 }
 async function nextStage(){
  let ci=chapterIndex,si=stageIndex+1;
  if(si>=scenario.chapters[ci].stages.length){ci++;si=0}
  if(ci>=scenario.chapters.length){stopTimer();toast.textContent='Forgatókönyv teljesítve: '+scenario.name;return}
  await loadStage(ci,si);
 }
 function onWin(){if(!active||!state?.won)return;stopTimer();setTimeout(()=>nextStage().catch(showError),700)}
 function showError(e){console.error(e);toast.textContent='Forgatókönyv-hiba: '+(e.message||e)}
 async function open(){
  panel.hidden=false;MotionControl.pause();list.innerHTML='<div>Forgatókönyvek betöltése…</div>';
  try{
   const idx=await fetchJson(ROOT+'scenarios/index.json');checkDoc(idx,'ggrid-scenario-index');list.innerHTML='';
   for(const s of idx.scenarios||[]){
    const b=document.createElement('button');b.type='button';b.className='scenario-choice';
    b.innerHTML='<strong>'+s.name+'</strong><span>'+s.description+'</span>';
    b.onclick=async()=>{try{const url=refUrl(ROOT+'scenarios/index.json',s.manifest),d=await fetchJson(url);checkDoc(d,'ggrid-scenario');d.__url=url;scenario=d;title.textContent=d.name;desc.textContent=d.description||'';playBtn.disabled=false;[...list.children].forEach(x=>x.classList.remove('selected'));b.classList.add('selected')}catch(e){showError(e)}};
    list.append(b);
   }
  }catch(e){list.textContent='A forgatókönyvek nem tölthetők be.';showError(e)}
 }
 function close(){panel.hidden=true;MotionControl.resume()}
 async function start(){if(!scenario)return;panel.hidden=true;try{await loadStage(0,0)}catch(e){showError(e);active=false;MotionControl.resume()}}
 function freePlay(){active=false;scenario=null;effective=null;stopTimer();document.body.dataset.theme='classic';info.textContent='';panel.hidden=true;freezeLimitEl.value='inf';changeLevelProfile();MotionControl.resume()}
 document.querySelector('#scenarioOpen').addEventListener('click',open);closeBtn.addEventListener('click',close);playBtn.addEventListener('click',start);freeBtn.addEventListener('click',freePlay);
 const baseMove=move;move=function(dir){const wasWon=!!state?.won;baseMove(dir);if(active&&!wasWon)setTimeout(onWin,180)};
 return{open,get active(){return active}};
})();