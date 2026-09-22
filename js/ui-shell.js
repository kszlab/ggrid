/* ===== v0.12.32 APPLICATION UI SHELL ===== */
const AppUI=(()=>{
 const home=document.querySelector('#homeScreen'),menu=document.querySelector('#gameMenuPanel'),settings=document.querySelector('#settingsPanel'),freeSetup=document.querySelector('#freePlaySetup');
 const topbar=document.querySelector('.topbar'),mini=document.querySelector('.mini-tools'),tune=document.querySelector('.motion-tune'),loadrow=document.querySelector('.loadrow');
 const controls=document.querySelector('#settingsControls'),code=document.querySelector('#settingsCode'),freeSettings=document.querySelector('#freeSettings');
 controls.append(mini,tune);code.append(loadrow);if(freeSettings)freeSettings.hidden=true;

 function syncPlayActions(){const choose=document.querySelector('#playChoose');if(choose)choose.hidden=!!ScenarioMode?.active}
 function enterGame(){home.hidden=true;menu.hidden=true;settings.hidden=true;freeSetup.hidden=true;syncPlayActions();MotionControl?.resume?.()}
 function showHome(){menu.hidden=true;settings.hidden=true;freeSetup.hidden=true;home.hidden=false;MotionControl?.pause?.()}
 function openMenu(){
  menu.hidden=false;MotionControl?.pause?.();
  const active=!!ScenarioMode?.active;
  document.querySelector('#menuTitle').textContent=active?'Játék':'Szabad játék';
  document.querySelector('#menuStage').textContent=active?(document.querySelector('#scenarioInfo').textContent||'Forgatókönyv'):'Aktuális pálya';
  document.querySelector('#menuNew').hidden=active;
 }
 function closeMenu(){menu.hidden=true;MotionControl?.resume?.()}
 function openSettings(){menu.hidden=true;settings.hidden=false;MotionControl?.pause?.()}
 function closeSettings(){settings.hidden=true;if(home.hidden)MotionControl?.resume?.()}

 const themeEl=document.querySelector('#freeTheme'),preview=document.querySelector('#themePreview'),previewName=document.querySelector('#themePreviewName'),previewTag=document.querySelector('#themePreviewTag'),dots=document.querySelector('#themeDots');
 let themeIndex=0,touchX=null;
 const shortNames={'classic':'CLASSIC','mine':'BÁNYA','space-station':'ORBITAL','ancient-temple':'TEMPLOM','ice-cavern':'JÉGBARLANG','cybergrid':'CYBERGRID','pirate-ship':'KALÓZHAJÓ','ghost-manor':'ÉJFÉLI KASTÉLY','traffic-rescue':'MENTŐAKCIÓ','orbital-breach':'ORBITAL // BREACH','abyssal-lab':'ABYSS','clockwork-sanctum':'AETHERIUM','neon-noir':'NEON RAIN','microchip-lab':'MICROCORE','moonlit-zen':'HOLDKERT'};
 function themes(){return ScenarioMode?.freeThemes||[]}
 const previewKinds={
  'classic':['●','▣','▣','◆'],'mine':['●','▤','▤','▥'],'space-station':['◉','▰','▰','◎'],'ancient-temple':['✦','▧','▧','◇'],'ice-cavern':['❄','◆','◆','◈'],
  'cybergrid':['●','▣','▣','◇'],'pirate-ship':['●','▤','▤','⚓'],'ghost-manor':['◉','▥','▥','✧'],'traffic-rescue':['✚','▰','▰','▥'],'orbital-breach':['◉','▰','▰','◎'],
  'abyssal-lab':['◉','▣','▣','◌'],'clockwork-sanctum':['✦','⚙','⚙','◉'],'neon-noir':['K7','CARGO','C-47','EVAC'],'microchip-lab':['e−','IC','74G','DATA'],'moonlit-zen':['◉','✿','浮島','鳥居']
 };
 function previewBoard(id){
  const q=previewKinds[id]||previewKinds.classic;
  const cells=[['','','','',''],['',q[1],'',q[3],''],['','','','',''],[q[0],'',q[2],q[2],''],['','','','','']];
  let h='<div class="mini-board" aria-hidden="true">';
  for(let y=0;y<5;y++)for(let x=0;x<5;x++){const v=cells[y][x];let k='';if(v===q[0])k=' target';else if(v===q[3])k=' gate';else if(v)k=' block';h+='<i class="mini-cell'+k+'">'+v+'</i>'}
  return h+'</div><span class="mini-exit">›</span>';
 }
 function paintTheme(){
  const a=themes();if(!a.length)return;themeIndex=(themeIndex+a.length)%a.length;const t=a[themeIndex];
  themeEl.value=t.id;preview.dataset.theme=t.id;previewName.textContent=shortNames[t.id]||t.name;previewTag.textContent=t.showcase?'SHOWCASE WORLD':'GGRID WORLD';preview.querySelector('.theme-preview-art').innerHTML=previewBoard(t.id);
  dots.innerHTML='';a.forEach((_,i)=>{const d=document.createElement('i');if(i===themeIndex)d.className='active';dots.append(d)});
 }
 function selectTheme(delta){themeIndex+=delta;paintTheme()}
 function bindSegments(id,select){
  const box=document.querySelector(id),paint=()=>box.querySelectorAll('button').forEach(b=>b.classList.toggle('active',b.dataset.value===select.value));
  box.addEventListener('click',e=>{const b=e.target.closest('button[data-value]');if(!b)return;select.value=b.dataset.value;paint()});paint();return paint;
 }
 const paintSize=bindSegments('#quickSize',sizeEl),paintDiff=bindSegments('#quickDifficulty',difficultyEl),paintFreeze=bindSegments('#quickFreeze',freezeLimitEl);
 async function openFreeSetup(){
  if(ScenarioMode?.active){document.querySelector('#exitScenario').click()}
  home.hidden=true;menu.hidden=true;settings.hidden=true;freeSetup.hidden=false;MotionControl?.pause?.();
  for(let i=0;i<20&&!themes().length;i++)await new Promise(r=>setTimeout(r,50));
  const a=themes(),saved=themeEl.value||'classic',idx=a.findIndex(t=>t.id===saved);themeIndex=idx>=0?idx:0;paintTheme();paintSize();paintDiff();paintFreeze();
 }
 async function launchFreePlay(){
  document.body.classList.remove('scenario-mode');await ScenarioMode?.loadFreeTheme?.(themeEl.value);changeLevelProfile();enterGame();
 }
 document.querySelector('#playHint').addEventListener('click',()=>document.querySelector('#hint').click());
 document.querySelector('#playRestart').addEventListener('click',()=>document.querySelector('#restart').click());
 document.querySelector('#playChoose').addEventListener('click',openFreeSetup);
 document.querySelector('#themePrev').addEventListener('click',()=>selectTheme(-1));document.querySelector('#themeNext').addEventListener('click',()=>selectTheme(1));
 preview.addEventListener('pointerdown',e=>{touchX=e.clientX});preview.addEventListener('pointerup',e=>{if(touchX==null)return;const dx=e.clientX-touchX;touchX=null;if(Math.abs(dx)>42)selectTheme(dx<0?1:-1)});
 document.querySelector('#freeSetupClose').addEventListener('click',showHome);document.querySelector('#freeSetupPlay').addEventListener('click',launchFreePlay);
 document.querySelector('#homeFreePlay').addEventListener('click',openFreeSetup);
 document.querySelector('#homeSettings').addEventListener('click',openSettings);
 document.querySelector('#gameMenu').addEventListener('click',openMenu);
 document.querySelector('#menuClose').addEventListener('click',closeMenu);
 document.querySelector('#menuRestart').addEventListener('click',()=>{document.querySelector('#restart').click();closeMenu()});
 document.querySelector('#menuNew').addEventListener('click',()=>{document.querySelector('#new').click();closeMenu()});
 document.querySelector('#menuHint').addEventListener('click',()=>{document.querySelector('#hint').click();closeMenu()});
 document.querySelector('#menuSettings').addEventListener('click',openSettings);
 document.querySelector('#menuHome').addEventListener('click',()=>{if(ScenarioMode?.active)document.querySelector('#exitScenario').click();showHome()});
 document.querySelector('#settingsClose').addEventListener('click',closeSettings);
 return{enterGame,showHome,openSettings,openFreeSetup};
})();
