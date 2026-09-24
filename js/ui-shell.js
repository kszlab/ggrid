/* ===== v0.12.49 DATA-DRIVEN APPLICATION UI SHELL ===== */
const AppUI=(()=>{
 const home=document.querySelector('#homeScreen'),menu=document.querySelector('#gameMenuPanel'),settings=document.querySelector('#settingsPanel'),freeSetup=document.querySelector('#freePlaySetup'),help=document.querySelector('#helpPanel');
 const topbar=document.querySelector('.topbar'),loadrow=document.querySelector('.loadrow');
 const code=document.querySelector('#settingsCode'),freeSettings=document.querySelector('#freeSettings');
 const shellSelect=document.querySelector('#shellThemeSelect'),shellSection=document.querySelector('#shellThemeSection');
 let shellTheme='classic';try{shellTheme=localStorage.getItem('ggrid.shell.theme.v1')||'classic'}catch(_){}
 if(!['classic','warm'].includes(shellTheme))shellTheme='classic';
 document.body.dataset.shellTheme=shellTheme;shellSelect.value=shellTheme;
 shellSelect.addEventListener('change',()=>{document.body.dataset.shellTheme=shellSelect.value;try{localStorage.setItem('ggrid.shell.theme.v1',shellSelect.value)}catch(_){}});
 code.append(loadrow);if(freeSettings)freeSettings.hidden=true;
 const infos=[...settings.querySelectorAll('.settings-info')];
 function closeInfos(except=null){for(const b of infos)if(b!==except){b.classList.remove('is-open');b.setAttribute('aria-expanded','false')}}
 function placeInfo(b){const r=b.getBoundingClientRect(),tip=b.querySelector('.settings-tooltip'),w=Math.min(270,innerWidth-28),h=tip.scrollHeight||92;b.style.setProperty('--tip-left',Math.max(14,Math.min(innerWidth-w-14,r.left+r.width/2-w/2))+'px');b.style.setProperty('--tip-top',Math.max(12,r.bottom+h+12<innerHeight?r.bottom+9:r.top-h-9)+'px')}
 infos.forEach(b=>{b.setAttribute('aria-description',b.querySelector('.settings-tooltip').textContent.trim());b.addEventListener('pointerenter',()=>placeInfo(b));b.addEventListener('focus',()=>placeInfo(b));b.addEventListener('click',e=>{e.stopPropagation();placeInfo(b);const open=!b.classList.contains('is-open');closeInfos(b);b.classList.toggle('is-open',open);b.setAttribute('aria-expanded',String(open))})});
 settings.addEventListener('click',e=>{if(!e.target.closest('.settings-info'))closeInfos()});
 settings.addEventListener('keydown',e=>{if(e.key==='Escape')closeInfos()});

 function syncPlayActions(){const choose=document.querySelector('#playChoose'),next=document.querySelector('#playNext');if(choose)choose.hidden=!!ScenarioMode?.active;if(next)next.hidden=!!ScenarioMode?.active}
 function enterGame(){document.body.dataset.uiContext='game';home.hidden=true;menu.hidden=true;settings.hidden=true;freeSetup.hidden=true;help.hidden=true;syncPlayActions();AudioManager?.setThemeAudio?.(SceneRenderer?.theme?.audio||null);MotionControl?.resume?.()}
 function showHome(){cancelAutoSolve();cancelFreezeSelection();document.body.dataset.uiContext='shell';menu.hidden=true;settings.hidden=true;freeSetup.hidden=true;help.hidden=true;home.hidden=false;AudioManager?.stopAmbient?.();MotionControl?.pause?.()}
 function openMenu(){
  cancelAutoSolve();
  cancelFreezeSelection();
  menu.hidden=false;MotionControl?.pause?.();
  const active=!!ScenarioMode?.active;
  document.querySelector('#menuTitle').textContent=active?'Játék':'Szabad játék';
  document.querySelector('#menuStage').textContent=active?(document.querySelector('#scenarioInfo').textContent||'Forgatókönyv'):'Aktuális pálya';
  document.querySelector('#menuNew').hidden=active;
 }
 function closeMenu(){menu.hidden=true;MotionControl?.resume?.()}
 function openSettings(){cancelFreezeSelection();document.body.dataset.uiContext=home.hidden?'game':'shell';shellSection.hidden=home.hidden;menu.hidden=true;settings.hidden=false;closeInfos();MotionControl?.pause?.()}
 function closeSettings(){closeInfos();settings.hidden=true;if(home.hidden)MotionControl?.resume?.()}
 let helpOpenedFromMenu=false;
 function openHelp(fromMenu=false){
  helpOpenedFromMenu=fromMenu;menu.hidden=true;settings.hidden=true;help.hidden=false;
  help.querySelector('.help-content').scrollTop=0;
  MotionControl?.pause?.();document.querySelector('#helpClose').focus();
 }
 function closeHelp(){
  help.hidden=true;
  if(helpOpenedFromMenu){menu.hidden=false;document.querySelector('#menuHelp').focus()}
  else if(home.hidden)MotionControl?.resume?.();
  else document.querySelector('#homeHelp').focus();
  helpOpenedFromMenu=false;
 }

 const themeEl=document.querySelector('#freeTheme'),preview=document.querySelector('#themePreview'),previewName=document.querySelector('#themePreviewName'),previewTag=document.querySelector('#themePreviewTag'),dots=document.querySelector('#themeDots');
 let themeIndex=0,touchX=null;
 /* Theme registry is owned by ScenarioMode; the setup UI only consumes its
    data-driven index. This accessor was accidentally removed in v0.12.46. */
 const themes=()=>ScenarioMode?.freeThemes||[];
 function previewBoard(id){
  const t=themes().find(x=>x.id===id),q=t?.preview?.symbols||['●','▣','▣','◆'];
  const cells=[['','','','',''],['',q[1],'',q[3],''],['','','','',''],[q[0],'',q[2],q[2],''],['','','','','']];
  let h='<div class="mini-board" aria-hidden="true">';
  for(let y=0;y<5;y++)for(let x=0;x<5;x++){const v=cells[y][x];let k='';if(v===q[0])k=' target';else if(v===q[3])k=' gate';else if(v)k=' block';h+='<i class="mini-cell'+k+'">'+v+'</i>'}
  return h+'</div><span class="mini-exit">›</span>';
 }
 function paintTheme(){
  const a=themes();if(!a.length)return;themeIndex=(themeIndex+a.length)%a.length;const t=a[themeIndex];
  themeEl.value=t.id;preview.dataset.theme=t.id;previewName.textContent=t.preview?.shortName||t.name;previewTag.textContent=t.preview?.tag||(t.showcase?'SHOWCASE WORLD':'GGRID WORLD');preview.querySelector('.theme-preview-art').innerHTML=previewBoard(t.id);
  dots.innerHTML='';a.forEach((_,i)=>{const d=document.createElement('i');if(i===themeIndex)d.className='active';dots.append(d)});
 }
 function selectTheme(delta){themeIndex+=delta;paintTheme()}
 function syncLevelAvailability(){
  const d=selectedDims(),box=document.querySelector('#quickDifficulty');let any=false;
  box.querySelectorAll('button[data-value]').forEach(b=>{const ok=LevelLibrary.has(d.w,d.h,+b.dataset.value);b.disabled=!ok;b.classList.toggle('unavailable',!ok);if(ok)any=true;});
  const chosen=box.querySelector('button[data-value="'+difficultyEl.value+'"]');if(chosen?.disabled){const first=[...box.querySelectorAll('button[data-value]')].find(b=>!b.disabled);if(first)difficultyEl.value=first.dataset.value;}
  document.querySelector('#freeSetupPlay').disabled=!any||!LevelLibrary.has(d.w,d.h,+difficultyEl.value);
 }
 function bindSegments(id,select,onChange){
  const box=document.querySelector(id),paint=()=>{box.querySelectorAll('button').forEach(b=>b.classList.toggle('active',b.dataset.value===select.value));onChange?.()};
  box.addEventListener('click',e=>{const b=e.target.closest('button[data-value]');if(!b||b.disabled)return;select.value=b.dataset.value;paint()});paint();return paint;
 }
 const paintSize=bindSegments('#quickSize',sizeEl,syncLevelAvailability),paintDiff=bindSegments('#quickDifficulty',difficultyEl,syncLevelAvailability);
 async function openFreeSetup(){
  cancelFreezeSelection();
  await LevelLibrary.init();
  if(ScenarioMode?.active){document.querySelector('#exitScenario').click()}
  document.body.dataset.uiContext='shell';home.hidden=true;menu.hidden=true;settings.hidden=true;freeSetup.hidden=false;AudioManager?.stopAmbient?.();MotionControl?.pause?.();
  for(let i=0;i<20&&!themes().length;i++)await new Promise(r=>setTimeout(r,50));
  const a=themes(),saved=themeEl.value||'classic',idx=a.findIndex(t=>t.id===saved);themeIndex=idx>=0?idx:0;paintTheme();paintSize();paintDiff();syncLevelAvailability();
 }
 async function launchFreePlay(){
  document.body.classList.remove('scenario-mode');await ScenarioMode?.loadFreeTheme?.(themeEl.value);changeLevelProfile();enterGame();
 }
 document.querySelector('#playHint').addEventListener('click',()=>document.querySelector('#hint').click());
 document.querySelector('#playRestart').addEventListener('click',()=>document.querySelector('#restart').click());
 document.querySelector('#playNext').addEventListener('click',()=>document.querySelector('#new').click());
 document.querySelector('#playChoose').addEventListener('click',openFreeSetup);
 document.querySelector('#themePrev').addEventListener('click',()=>selectTheme(-1));document.querySelector('#themeNext').addEventListener('click',()=>selectTheme(1));
 preview.addEventListener('pointerdown',e=>{touchX=e.clientX});preview.addEventListener('pointerup',e=>{if(touchX==null)return;const dx=e.clientX-touchX;touchX=null;if(Math.abs(dx)>42)selectTheme(dx<0?1:-1)});
 document.querySelector('#freeSetupClose').addEventListener('click',showHome);document.querySelector('#freeSetupPlay').addEventListener('click',launchFreePlay);
 document.querySelector('#homeFreePlay').addEventListener('click',openFreeSetup);
 document.querySelector('#homeSettings').addEventListener('click',openSettings);
 document.querySelector('#homeHelp').addEventListener('click',()=>openHelp());
 document.querySelector('#menuHelp').addEventListener('click',()=>openHelp(true));
 document.querySelector('#helpClose').addEventListener('click',closeHelp);
 help.addEventListener('click',e=>{if(e.target===help)closeHelp()});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!help.hidden){e.preventDefault();closeHelp()}});
 document.querySelector('#gameMenu').addEventListener('click',openMenu);
 document.querySelector('#menuClose').addEventListener('click',closeMenu);
 document.querySelector('#menuRestart').addEventListener('click',()=>{document.querySelector('#restart').click();closeMenu()});
 document.querySelector('#menuNew').addEventListener('click',()=>{document.querySelector('#new').click();closeMenu()});
 document.querySelector('#menuSettings').addEventListener('click',openSettings);
 document.querySelector('#menuHome').addEventListener('click',()=>{if(ScenarioMode?.active)document.querySelector('#exitScenario').click();showHome()});
 document.querySelector('#settingsClose').addEventListener('click',closeSettings);
 return{enterGame,showHome,openSettings,openFreeSetup};
})();
