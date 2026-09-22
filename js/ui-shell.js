/* ===== v0.12.0 APPLICATION UI SHELL ===== */
const AppUI=(()=>{
 const home=document.querySelector('#homeScreen'),menu=document.querySelector('#gameMenuPanel'),settings=document.querySelector('#settingsPanel');
 const topbar=document.querySelector('.topbar'),mini=document.querySelector('.mini-tools'),tune=document.querySelector('.motion-tune'),loadrow=document.querySelector('.loadrow');
 const controls=document.querySelector('#settingsControls'),free=document.querySelector('#settingsFree'),code=document.querySelector('#settingsCode');
 controls.append(mini,tune);free.append(topbar);code.append(loadrow);

 function enterGame(){home.hidden=true;menu.hidden=true;settings.hidden=true;MotionControl?.resume?.()}
 function showHome(){menu.hidden=true;settings.hidden=true;home.hidden=false;MotionControl?.pause?.()}
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
 function freePlayFromHome(){
  if(ScenarioMode?.active){document.querySelector('#exitScenario').click();return}
  document.body.classList.remove('scenario-mode');document.body.dataset.theme='classic';enterGame();
 }
 document.querySelector('#homeFreePlay').addEventListener('click',freePlayFromHome);
 document.querySelector('#homeSettings').addEventListener('click',openSettings);
 document.querySelector('#gameMenu').addEventListener('click',openMenu);
 document.querySelector('#menuClose').addEventListener('click',closeMenu);
 document.querySelector('#menuRestart').addEventListener('click',()=>{document.querySelector('#restart').click();closeMenu()});
 document.querySelector('#menuNew').addEventListener('click',()=>{document.querySelector('#new').click();closeMenu()});
 document.querySelector('#menuHint').addEventListener('click',()=>{document.querySelector('#hint').click();closeMenu()});
 document.querySelector('#menuSettings').addEventListener('click',openSettings);
 document.querySelector('#menuHome').addEventListener('click',()=>{if(ScenarioMode?.active)document.querySelector('#exitScenario').click();showHome()});
 document.querySelector('#settingsClose').addEventListener('click',closeSettings);
 return{enterGame,showHome,openSettings};
})();