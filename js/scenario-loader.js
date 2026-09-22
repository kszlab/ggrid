/* ===== v0.12.20 SCENARIO + THEME LOADER ===== */
const ScenarioMode=(()=>{
 const ROOT='content/',progressKey='ggrid.scenario.progress.v1',localStore='ggrid.local.scenarios.v1';
 let active=false,scenario=null,chapterIndex=0,stageIndex=0,effective=null,timerId=null,timeLeft=null;
 const freeThemeEl=document.querySelector('#freeTheme');let freeThemeIndex=null;
 const panel=document.querySelector('#scenarioPanel'),list=document.querySelector('#scenarioList'),title=document.querySelector('#scenarioTitle'),desc=document.querySelector('#scenarioDesc'),info=document.querySelector('#scenarioInfo');
 const playBtn=document.querySelector('#playScenario'),closeBtn=document.querySelector('#scenarioClose'),freeBtn=document.querySelector('#freePlay'),newBtn=document.querySelector('#new'),topbar=document.querySelector('.topbar'),loadrow=document.querySelector('.loadrow'),scenarioOpenBtn=document.querySelector('#scenarioOpen'),exitScenarioBtn=document.querySelector('#exitScenario');
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
  if(ref?.key&&scenario?.__package){
   const d=structuredClone(scenario.__package.resources?.[ref.key]);
   if(!d)throw Error('INVALID_REFERENCE '+ref.key);checkDoc(d,format);
   if(d.version!==ref.version)throw Error('CONTENT_VERSION_MISMATCH');
   d.__url='local:'+ref.key;return d;
  }
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
  const c=t.colors||{},root=document.documentElement.style;
  root.setProperty('--scenario-bg',c.background||'');root.setProperty('--scenario-board',c.board||'');
  for(const [k,v] of Object.entries({wrap:c.wrap,board:c.board,cell1:c.cell1,cell2:c.cell2,accent:c.accent,ball1:c.ball1,ball2:c.ball2,ball3:c.ball3,brick1:c.brick1,brick2:c.brick2,'brick-edge':c.brickEdge,wall1:c.wall1,wall2:c.wall2}))root.setProperty('--theme-'+k,v||'');
  AudioManager?.setThemeAudio?.(t.audio||null);
  SceneRenderer?.apply?.(t);
 }
 async function loadFreeTheme(id=freeThemeEl?.value||'classic'){
  try{
   if(!freeThemeIndex){freeThemeIndex=await fetchJson(ROOT+'themes/index.json');checkDoc(freeThemeIndex,'ggrid-theme-index')}
   const entry=(freeThemeIndex.themes||[]).find(t=>t.id===id)||(freeThemeIndex.themes||[]).find(t=>t.id==='classic');
   if(!entry)throw Error('INVALID_REFERENCE theme '+id);
   const url=refUrl(ROOT+'themes/index.json',entry.src),t=await fetchJson(url);checkDoc(t,'ggrid-theme');applyTheme(t);
   try{localStorage.setItem('ggrid.freeplay.theme.v1',entry.id)}catch(_){}
   return t;
  }catch(e){console.error(e);SceneRenderer?.clear?.();AudioManager?.setThemeAudio?.(null)}
 }
 async function initFreeThemes(){
  if(!freeThemeEl)return;
  try{
   freeThemeIndex=await fetchJson(ROOT+'themes/index.json');checkDoc(freeThemeIndex,'ggrid-theme-index');
   const saved=localStorage.getItem('ggrid.freeplay.theme.v1')||'classic';
   freeThemeEl.innerHTML='';
   for(const t of (freeThemeIndex.themes||[])){const o=document.createElement('option');o.value=t.id;o.textContent=t.name+(t.showcase?' ✦':'');freeThemeEl.append(o)}
   freeThemeEl.value=(freeThemeIndex.themes||[]).some(t=>t.id===saved)?saved:'classic';
   freeThemeEl.addEventListener('change',async()=>{if(!active){await loadFreeTheme();render({preservePieces:true})}});
   if(!active)await loadFreeTheme();
  }catch(e){console.error('Theme index',e)}
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
  active=true;document.body.classList.add('scenario-mode');AppUI?.enterGame?.();newBtn.hidden=true;topbar.hidden=true;loadrow.hidden=true;scenarioOpenBtn.hidden=true;exitScenarioBtn.hidden=false;applyAbilities();hintVisible=false;toast.textContent='';render();paintInfo();startTimer();scheduleFreezeAnalysis();MotionControl?.onNewLevel?.();
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
 function localPackages(){try{const a=JSON.parse(localStorage.getItem(localStore)||'[]');return Array.isArray(a)?a:[]}catch(_){return[]}}
 function saveLocalPackage(p){
  if(p?.format!=='ggrid-scenario-package'||p.formatVersion!==1||!p.scenario)throw Error('INVALID_CONTENT_FORMAT');
  checkDoc(p.scenario,'ggrid-scenario');let a=localPackages();a=a.filter(x=>x?.scenario?.id!==p.scenario.id);a.push(p);localStorage.setItem(localStore,JSON.stringify(a));
 }
 function addChoice(s,loader,tag=''){
  const b=document.createElement('button');b.type='button';b.className='scenario-choice';
  const strong=document.createElement('strong');strong.textContent=s.name+(tag?' · '+tag:'');
  const span=document.createElement('span');span.textContent=s.description||'';b.append(strong,span);
  b.onclick=async()=>{try{const d=await loader();scenario=d;title.textContent=d.name;desc.textContent=d.description||'';playBtn.disabled=false;[...list.querySelectorAll('.scenario-choice')].forEach(x=>x.classList.remove('selected'));b.classList.add('selected')}catch(e){showError(e)}};
  list.append(b);
 }
 async function open(){
  panel.hidden=false;MotionControl.pause();list.innerHTML='<div>Forgatókönyvek betöltése…</div>';playBtn.disabled=true;
  try{
   const idx=await fetchJson(ROOT+'scenarios/index.json');checkDoc(idx,'ggrid-scenario-index');list.innerHTML='';
   const publicScenarios=idx.scenarios||[],publicById=new Map(publicScenarios.map(s=>[s.id,s]));
   for(const s of publicScenarios)addChoice(s,async()=>{const url=refUrl(ROOT+'scenarios/index.json',s.manifest),d=await fetchJson(url);checkDoc(d,'ggrid-scenario');d.__url=url;return d});
   for(const p of localPackages()){
    const s=p?.scenario;if(!s)continue;
    const pub=publicById.get(s.id);
    if(pub&&Number(pub.version)>=Number(s.version||0))continue;
    const tag=pub?'saját teszt · v'+s.version:'saját';
    addChoice(s,async()=>{const d=structuredClone(s);d.__url='local:'+d.id;d.__package=p;return d},tag);
   }
   const importBtn=document.createElement('button');importBtn.type='button';importBtn.textContent='＋ Scenario fájl importálása';importBtn.className='scenario-choice';
   importBtn.onclick=()=>{const inp=document.createElement('input');inp.type='file';inp.accept='.json,.ggrid-scenario';inp.onchange=async()=>{try{const p=JSON.parse(await inp.files[0].text());saveLocalPackage(p);await open();toast.textContent='Scenario importálva.'}catch(e){showError(e)}};inp.click()};list.append(importBtn);
  }catch(e){list.textContent='A forgatókönyvek nem tölthetők be.';showError(e)}
 }
 function close(){panel.hidden=true;MotionControl.resume()}
 async function start(){if(!scenario)return;panel.hidden=true;try{await loadStage(0,0)}catch(e){showError(e);active=false;MotionControl.resume()}}
 async function freePlay(){active=false;scenario=null;effective=null;stopTimer();document.body.classList.remove('scenario-mode');AppUI?.enterGame?.();newBtn.hidden=false;topbar.hidden=false;loadrow.hidden=false;scenarioOpenBtn.hidden=false;exitScenarioBtn.hidden=true;info.textContent='';panel.hidden=true;freezeLimitEl.value='inf';await loadFreeTheme();changeLevelProfile();MotionControl.resume()}
 initFreeThemes();
 scenarioOpenBtn.addEventListener('click',open);closeBtn.addEventListener('click',close);playBtn.addEventListener('click',start);freeBtn.addEventListener('click',freePlay);exitScenarioBtn.addEventListener('click',freePlay);
 const baseMove=move;move=function(dir){const wasWon=!!state?.won;baseMove(dir);if(active&&!wasWon)setTimeout(onWin,180)};
 return{open,loadFreeTheme,get freeThemes(){return freeThemeIndex?.themes||[]},get active(){return active}};
})();