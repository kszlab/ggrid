/* GGrid Scenario Editor v0.6 – GGrid v0.12.8 */
(()=>{
const $=s=>document.querySelector(s), rowsEl=$('#rows'), log=$('#log'), summary=$('#summary');
const STORE='ggrid.local.scenarios.v1';
const THEMES={
 classic:{format:'ggrid-theme',formatVersion:1,id:'classic',version:1,name:'GGrid Classic',colors:{background:'#10283d',board:'#2b3034'}},
 mine:{format:'ggrid-theme',formatVersion:1,id:'mine',version:1,name:'Elhagyott bánya',colors:{background:'#241b14',board:'#3a3026'},pieces:{ball:{name:'Csille'},brick:{name:'Láda'},wall:{name:'Szikla'},exit:{name:'Tárnakijárat'}},abilities:{freeze:{name:'Fék'}}}
};
const TITLES=['Alapok','Kerülőút','Freeze próba','Mélyebbre','Időpróba','Ragasztott test','Új kihívás','Szűk járat','Akadálypálya','Finálé'];
const opt=(vals,val)=>vals.map(v=>'<option value="'+v+'" '+(String(v)===String(val)?'selected':'')+'>'+v+'</option>').join('');
let specs=[],generated=[],lastPackage=null;
let themeCatalog=[],themeDocs=new Map(),previewRow=null,previewIndex=0;

function defaultSpec(i=0){return{chapter:i<3?'1':'2',name:TITLES[i]||'Új kihívás',size:'4',difficulty:String(Math.min(10,2+i)),bricks:'auto',walls:'auto',glue:'allowed',freeze:'1',freezeRole:'optional',timer:'0',theme:i<3?'classic':'mine',status:'empty'}}

function renderRows(){
 rowsEl.innerHTML='';
 specs.forEach((s,i)=>{
  const tr=document.createElement('tr');tr.dataset.i=i;
  tr.innerHTML='<td>'+(i+1)+'</td>'+
   '<td><select data-k="chapter">'+opt(['1','2','3','4','5'],s.chapter)+'</select></td>'+
   '<td><select data-k="name">'+opt(TITLES,s.name)+'</select></td>'+
   '<td><select data-k="size">'+opt(['3','4','5'],s.size)+'</select></td>'+
   '<td><select data-k="difficulty">'+opt(['1','2','3','4','5','6','7','8','9','10'],s.difficulty)+'</select></td>'+
   '<td><select data-k="bricks">'+opt(['auto','1','2','3','4','5'],s.bricks)+'</select></td>'+
   '<td><select data-k="walls">'+opt(['auto','0','1','2','3'],s.walls)+'</select></td>'+
   '<td><select data-k="glue">'+opt(['none','allowed','required'],s.glue)+'</select></td>'+
   '<td><select data-k="freeze">'+opt(['0','1','2','3'],s.freeze)+'</select></td>'+
   '<td><select data-k="freezeRole">'+opt(['none','optional','required'],s.freezeRole)+'</select></td>'+
   '<td><select data-k="timer">'+opt(['0','30','60','90','120','180'],s.timer)+'</select></td>'+
   '<td><select data-k="theme">'+opt((themeCatalog.length?themeCatalog.map(t=>t.id):['classic','mine']),s.theme)+'</select></td>'+
   '<td class="status '+(s.status==='ok'?'ok':s.status==='bad'?'bad':'wait')+'">'+({ok:'✓ kész',bad:'✕ nincs találat',working:'⟳ keresés',dirty:'○ újra',empty:'○ nincs'}[s.status]||'○ nincs')+'</td>'+
   '<td><div class="row-actions"><button data-act="dup">⧉</button><button data-act="up">↑</button><button data-act="down">↓</button><button data-act="regen">↻</button><button data-act="del">✕</button></div></td>';
  tr.querySelectorAll('select').forEach(el=>el.onchange=()=>{s[el.dataset.k]=el.value;s.status='dirty';generated[i]=null;lastPackage=null;$('#publishBundle').disabled=true;if(el.dataset.k==='theme')openThemePreview(i,el.value);renderRows()});
  tr.querySelectorAll('button').forEach(b=>b.onclick=()=>rowAction(i,b.dataset.act));
  rowsEl.append(tr);
 });
}
function rowAction(i,a){
 if(a==='del'){specs.splice(i,1);generated.splice(i,1)}
 if(a==='dup'){specs.splice(i+1,0,{...specs[i],status:'dirty'});generated.splice(i+1,0,null)}
 if(a==='up'&&i>0){[specs[i-1],specs[i]]=[specs[i],specs[i-1]];[generated[i-1],generated[i]]=[generated[i],generated[i-1]]}
 if(a==='down'&&i<specs.length-1){[specs[i+1],specs[i]]=[specs[i],specs[i+1]];[generated[i+1],generated[i]]=[generated[i],generated[i+1]]}
 if(a==='regen'){generated[i]=null;specs[i].status='dirty';lastPackage=null;generateOne(i).then(()=>{buildPackage();setBusy(false);renderRows()})}
 lastPackage=null;renderRows();
}
const GEN_LIMITS={maxAttempts:2500,maxMs:12000};
let genWorker=null,genRequest=0,genBusy=false,genCancelled=false;
function ensureWorker(){
 if(genWorker)return genWorker;
 genWorker=new Worker('js/scenario-editor-worker.js?v=0.12.8');
 return genWorker;
}
function setBusy(v){
 genBusy=v;$('#generateAll').disabled=v;$('#cancelGenerate').hidden=!v;
 rowsEl.querySelectorAll('button,select').forEach(el=>el.disabled=v);
}
function formatProgress(i,st){
 const sec=(st.elapsedMs/1000).toFixed(1),best=st.bestMetric==null?'–':st.bestMetric;
 log.textContent='Stage '+(i+1)+' generálása… '+st.attempts+'/'+GEN_LIMITS.maxAttempts+' jelölt · '+sec+' s · megoldható: '+st.solvable+' · legjobb: '+best;
}
function runWorker(i){
 const s=specs[i],requestId=++genRequest,seed=($('#scenarioId').value||'scenario')+'-'+(i+1);
 return new Promise(resolve=>{
  const w=ensureWorker();
  const onMessage=e=>{
   const m=e.data||{};if(m.requestId!==requestId)return;
   if(m.type==='progress'){formatProgress(i,m.stats);return}
   w.removeEventListener('message',onMessage);
   if(m.type==='result'){resolve({ok:true,...m});return}
   if(m.type==='cancelled'){resolve({ok:false,cancelled:true,...m});return}
   if(m.type==='notFound'){resolve({ok:false,notFound:true,...m});return}
   resolve({ok:false,error:m.message||'Ismeretlen generálási hiba.'});
  };
  w.addEventListener('message',onMessage);
  w.postMessage({type:'generateScenarioStage',requestId,spec:s,seed,maxAttempts:GEN_LIMITS.maxAttempts,maxMs:GEN_LIMITS.maxMs});
 });
}
function levelFromResult(i,best){
 const s=specs[i],st=best.st,id=($('#scenarioId').value||'scenario')+'-'+String(i+1).padStart(2,'0');
 return{state:st,metric:best.metric,attempt:best.attempt,level:{format:'ggrid-level',formatVersion:1,id,version:1,name:s.name,board:{width:st.width,height:st.height},exit:{x:st.exit.x,y:st.exit.y,direction:st.exit.dir},objects:st.objects.map(o=>{const q=structuredClone(o);delete q.glued;return q})}}
}
async function generateOne(i){
 const s=specs[i];s.status='working';renderRows();setBusy(true);
 const result=await runWorker(i);
 if(result.cancelled){s.status=generated[i]?'ok':'dirty';log.textContent='Generálás megszakítva a '+(i+1)+'. stage-nél.';return false}
 if(result.ok){
  generated[i]=levelFromResult(i,result.best);s.status='ok';
  const st=result.stats;log.textContent='✓ Stage '+(i+1)+' kész · '+st.attempts+' jelölt · '+(st.elapsedMs/1000).toFixed(1)+' s · optimális/értékelt hossz: '+result.best.metric+'.';renderRows();return true
 }
 generated[i]=null;s.status='bad';
 if(result.notFound){
  const st=result.stats,b=result.best?.metric;
  log.textContent='✕ Stage '+(i+1)+': a keresési korláton belül nem találtam minden feltételnek megfelelő pályát.\nCél nehézségi tartomány: '+st.target[0]+'–'+st.target[1]+' lépés · próbált jelöltek: '+st.attempts+' · idő: '+(st.elapsedMs/1000).toFixed(1)+' s · megoldható jelöltek: '+st.solvable+(b!=null?' · legközelebbi talált: '+b+' lépés':'')+'.\nMódosítsd a feltételeket, vagy használd a ↻ gombot az újrapróbáláshoz.'
 }else log.textContent='✕ Stage '+(i+1)+': '+result.error;
 renderRows();return false
}
function project(){return{format:'ggrid-scenario-project',formatVersion:1,editorVersion:3,engineVersion:'0.12.8',meta:{id:$('#scenarioId').value,name:$('#scenarioName').value,description:$('#scenarioDesc').value,version:+$('#scenarioVersion').value},stages:specs.map(({status,...s})=>s)}}
function roman(n){return['','I','II','III','IV','V'][n]||String(n)}
function buildPackage(){
 if(generated.length!==specs.length||generated.some(x=>!x)){lastPackage=null;return null}
 const p=project(),chapters=[],by=new Map();
 specs.forEach((s,i)=>{if(!by.has(s.chapter)){const ch={id:'chapter-'+s.chapter,name:roman(+s.chapter)+'. fejezet – '+(s.theme==='mine'?'A bánya':s.theme==='classic'?'A raktár':'Kaland'),stages:[]};by.set(s.chapter,ch);chapters.push(ch)}
  const abilities=+s.freeze>0?[{type:'freeze',count:+s.freeze}]:[];
  const st={id:'stage-'+String(i+1).padStart(2,'0'),name:s.name,level:{key:'level:'+generated[i].level.id,version:1},theme:{key:'theme:'+s.theme,version:1},abilities,timer:+s.timer?{mode:'countdown',seconds:+s.timer,onExpire:'fail'}:null};
  by.get(s.chapter).stages.push(st);
 });
 const scenario={format:'ggrid-scenario',formatVersion:1,id:p.meta.id,version:p.meta.version,name:p.meta.name,description:p.meta.description,rules:['Juttasd ki az összes golyót.','A téglák nem hagyhatják el a pályát.'],defaults:{theme:{key:'theme:classic',version:1},abilities:[],timer:null,completion:{type:'allBallsExited'}},chapters,scoring:null};
 const resources={};for(const s of specs){const t=themeDocs.get(s.theme)||THEMES[s.theme];if(t)resources['theme:'+s.theme]=structuredClone(t)}generated.forEach(g=>resources['level:'+g.level.id]=g.level);
 lastPackage={format:'ggrid-scenario-package',formatVersion:1,packageVersion:1,engineVersion:'0.12.8',scenario,resources,editorProject:p};
 $('#downloadScenario').disabled=false;$('#installScenario').disabled=false;$('#publishBundle').disabled=false;
 summary.textContent=specs.length+' stage · minden pálya legenerálva és solverrel ellenőrizve.';
 return lastPackage
}
function publicationBundle(){
 if(!lastPackage||generated.some(x=>!x))throw Error('A publikáláshoz előbb minden stage-et le kell generálni.');
 if(!validate(false))throw Error('A projekt ellenőrzése sikertelen.');
 const id=lastPackage.scenario.id,version=lastPackage.scenario.version,base='content/scenarios/'+id+'/',files={};
 const pub=structuredClone(lastPackage.scenario);
 pub.defaults.theme={src:'../../themes/classic/theme.json',version:1};
 let stageNo=0;
 pub.chapters.forEach(ch=>ch.stages.forEach(st=>{
  const i=stageNo++,spec=specs[i],theme=spec.theme,tmeta=themeCatalog.find(t=>t.id===theme),tsrc=tmeta?.src||theme+'/theme.json';
  st.level={src:'levels/stage-'+String(i+1).padStart(2,'0')+'.json',version:1};
  st.theme={src:'../../themes/'+tsrc,version:tmeta?.version||1};
 }));
 files[base+'scenario.json']=pub;
 generated.forEach((g,i)=>files[base+'levels/stage-'+String(i+1).padStart(2,'0')+'.json']=g.level);
 files[base+'editor-project.json']=project();
 const indexEntry={id,version,name:pub.name,description:pub.description,manifest:id+'/scenario.json'};
 return{format:'ggrid-publication-bundle',formatVersion:1,bundleVersion:1,engineVersion:'0.12.8',createdAt:new Date().toISOString(),scenarioId:id,scenarioVersion:version,indexEntry,repository:{repository:'kszlab/ggrid',branch:'main',root:'content/scenarios/',files},validation:{allStagesGenerated:true,editorValidated:true,solverChecked:true},instructions:['A repository.files minden kulcsa a cél GitHub repository relatív útvonala.','A content/scenarios/index.json scenarios tömbjéhez az indexEntry rekordot kell hozzáadni, vagy azonos id esetén verziófrissítésként cserélni.','Publikálás előtt a fogadó fél ismét validálja a csomagot.']};
}
function exportPublication(){
 try{
  const b=publicationBundle(),name=b.scenarioId+'-v'+b.scenarioVersion+'.ggrid-publish.json';
  download(b,name);log.textContent='✓ Publikálási csomag elkészült: '+name+'\nA csomag tartalmazza a scenario.json-t, a konkrét stage JSON-okat, az Editor projektet és a Scenario Library index-bejegyzést.';
 }catch(e){log.textContent='Publikálási hiba: '+e.message}
}
async function generateAll(){
 lastPackage=null;genCancelled=false;setBusy(true);
 for(let i=0;i<specs.length;i++){
  if(genCancelled)break;
  if(generated[i]&&specs[i].status==='ok')continue;
  const ok=await generateOne(i);if(!ok)break;
 }
 setBusy(false);const p=buildPackage();
 if(p)log.textContent='✓ Kész: '+specs.length+' stage generálva és ellenőrizve. A scenario exportálható vagy hozzáadható a játékhoz.';
 else if(!genCancelled&&!specs.some(s=>s.status==='bad'))log.textContent='A generálás nem fejeződött be.'
}
function validate(show=true){
 const errs=[];if(!specs.length)errs.push('Nincs stage.');specs.forEach((s,i)=>{if(s.freeze==='0'&&s.freezeRole!=='none')errs.push('Stage '+(i+1)+': Freeze=0 mellett a szerep csak Nincs lehet.');if(s.freezeRole==='required'&&s.freeze==='0')errs.push('Stage '+(i+1)+': szükséges Freeze-hez legalább 1 Freeze kell.')});
 if(generated.some((g,i)=>g&&!solve(g.state,30)&&specs[i].freezeRole!=='required'&&!analyzeOneFreeze(g.state,30).bestFreeze))errs.push('Van nem megoldható generált stage.');
 if(show)log.textContent=errs.length?'ELLENŐRZÉSI HIBÁK:\n'+errs.join('\n'):'✓ A projekt szerkezete érvényes'+(lastPackage?', a scenario csomag elkészült.':'. A konkrét pályákhoz futtasd a generálást.');
 return !errs.length
}
function download(obj,name){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(obj,null,2)],{type:'application/json'}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
async function install(){
 if(!lastPackage)return;
 const id=lastPackage.scenario.id;
 if(!/^[a-z0-9][a-z0-9-]{1,47}$/.test(id)){log.textContent='✕ Érvénytelen scenario azonosító. Használj kisbetűt, számot és kötőjelet.';return}
 let publicItem=null;try{const r=await fetch('content/scenarios/index.json',{cache:'no-cache'});if(r.ok){const x=await r.json();publicItem=(x.scenarios||[]).find(s=>s.id===id)}}catch(_){}
 if(publicItem&&Number(publicItem.version)>=Number(lastPackage.scenario.version||0)){log.textContent='✕ Ez az azonosító már publikus: '+id+' v'+publicItem.version+'. A helyi példány a játékban rejtve lenne. Adj a forgatókönyvnek új, egyedi azonosítót (pl. '+id+'-teszt), majd generáld újra.';return}
 let arr=[];try{arr=JSON.parse(localStorage.getItem(STORE)||'[]')}catch(_){}
 arr=arr.filter(x=>x?.scenario?.id!==lastPackage.scenario.id);arr.push(lastPackage);localStorage.setItem(STORE,JSON.stringify(arr));log.textContent='✓ A forgatókönyv hozzáadva ehhez a böngészőhöz. A GGrid „Játék indítása” listájában megjelenik.'
}
async function loadThemes(){
 try{
  const r=await fetch('content/themes/index.json',{cache:'no-cache'});if(!r.ok)throw Error('theme index');const idx=await r.json();themeCatalog=idx.themes||[];
  await Promise.all(themeCatalog.map(async t=>{const rr=await fetch('content/themes/'+t.src,{cache:'no-cache'});if(rr.ok)themeDocs.set(t.id,await rr.json())}));
 }catch(_){themeCatalog=[{id:'classic',name:'GGrid Classic'},{id:'mine',name:'Elhagyott bánya'}];for(const [id,t] of Object.entries(THEMES))themeDocs.set(id,t)}
 renderRows();
}
function demoMarkup(){return Array.from({length:16},()=>'<i class="dcell"></i>').join('')+'<i class="demo-piece demo-ball"></i><i class="demo-piece demo-brick"></i><i class="demo-piece demo-glue-a"></i><i class="demo-piece demo-glue-b"></i><i class="demo-piece demo-wall"></i><i class="demo-exit"></i>'}
function paintThemePreview(id){
 const meta=themeCatalog.find(t=>t.id===id)||themeCatalog[0],t=themeDocs.get(meta?.id)||THEMES[meta?.id];if(!meta||!t)return;
 previewIndex=Math.max(0,themeCatalog.findIndex(x=>x.id===meta.id));$('#themePreviewName').textContent=t.name||meta.name;$('#themePreviewDesc').textContent=meta.description||'';
 const d=$('#themeDemo'),c=t.colors||{};for(const [k,v] of Object.entries({wrap:c.wrap||c.background,board:c.board,c1:c.cell1||c.board,c2:c.cell2||c.background,accent:c.accent||'#e3b05b',ball1:c.ball1,ball2:c.ball2,ball3:c.ball3,b1:c.brick1,b2:c.brick2,be:c.brickEdge,w1:c.wall1,w2:c.wall2}))if(v)d.style.setProperty('--'+k,v);
 d.innerHTML=demoMarkup();const p=t.pieces||{};$('#themeLegend').textContent=(p.ball?.name||'Golyó')+' · '+(p.brick?.name||'Tégla')+' · '+(p.wall?.name||'Fal')+' · '+(p.exit?.name||'Kijárat')+' · '+(t.abilities?.freeze?.name||'Freeze');
}
function openThemePreview(row,id){previewRow=row;$('#themePreview').hidden=false;paintThemePreview(id)}
function closeThemePreview(){$('#themePreview').hidden=true}
function stepTheme(n){if(!themeCatalog.length)return;previewIndex=(previewIndex+n+themeCatalog.length)%themeCatalog.length;paintThemePreview(themeCatalog[previewIndex].id)}
function usePreviewTheme(){if(previewRow!=null&&specs[previewRow]){specs[previewRow].theme=themeCatalog[previewIndex].id;specs[previewRow].status='dirty';generated[previewRow]=null;lastPackage=null;renderRows()}closeThemePreview()}
function localPackages(){try{const a=JSON.parse(localStorage.getItem(STORE)||'[]');return Array.isArray(a)?a:[]}catch(_){return[]}}
function renderLocalScenarios(){
 const box=$('#localScenarios'),arr=localPackages();box.innerHTML='';
 if(!arr.length){box.textContent='Nincs helyileg telepített scenario.';return}
 arr.forEach(p=>{
  const s=p?.scenario;if(!s)return;
  const row=document.createElement('div');row.className='local-scenario-row';
  const label=document.createElement('span');label.textContent=(s.name||s.id)+' · v'+(s.version||'?')+' · '+s.id;
  const del=document.createElement('button');del.type='button';del.textContent='Törlés';
  del.onclick=()=>{const next=localPackages().filter(x=>!(x?.scenario?.id===s.id&&Number(x?.scenario?.version)===Number(s.version)));localStorage.setItem(STORE,JSON.stringify(next));renderLocalScenarios();log.textContent='✓ Helyi scenario törölve: '+(s.name||s.id)+' v'+s.version+'. A publikus GitHub-példányt ez nem érinti.'};
  row.append(label,del);box.append(row);
 });
}
function toggleLocalScenarios(){const box=$('#localScenarios');box.hidden=!box.hidden;if(!box.hidden)renderLocalScenarios()}
function loadProject(p){
 const pr=p.format==='ggrid-scenario-package'?p.editorProject:p;if(!pr||pr.format!=='ggrid-scenario-project')throw Error('Nem támogatott projektfájl.');
 $('#scenarioId').value=pr.meta.id||'custom-01';
 $('#scenarioName').value=pr.meta.name||'Saját forgatókönyv 1';
 $('#scenarioDesc').value=pr.meta.description||'GGrid egyedi próbakampány.';
 $('#scenarioVersion').value=String(pr.meta.version||1);specs=pr.stages.map(s=>({...s,status:'empty'}));generated=Array(specs.length).fill(null);lastPackage=null;renderRows();summary.textContent='Projekt betöltve; a pályákat újra kell generálni.'
}
function example(){
 $('#scenarioId').value='lost-mine';$('#scenarioName').value='Az elveszett járat';$('#scenarioDesc').value='Hat pályás próbakaland a raktártól az elhagyott bányáig.';$('#scenarioVersion').value='2';
 specs=[
 {chapter:'1',name:'Alapok',size:'4',difficulty:'2',bricks:'1',walls:'0',glue:'none',freeze:'1',freezeRole:'optional',timer:'0',theme:'classic'},
 {chapter:'1',name:'Kerülőút',size:'4',difficulty:'3',bricks:'1',walls:'1',glue:'none',freeze:'1',freezeRole:'optional',timer:'0',theme:'classic'},
 {chapter:'1',name:'Freeze próba',size:'4',difficulty:'4',bricks:'2',walls:'0',glue:'none',freeze:'1',freezeRole:'optional',timer:'0',theme:'classic'},
 {chapter:'2',name:'Mélyebbre',size:'4',difficulty:'4',bricks:'1',walls:'1',glue:'none',freeze:'1',freezeRole:'optional',timer:'0',theme:'mine'},
 {chapter:'2',name:'Időpróba',size:'4',difficulty:'5',bricks:'2',walls:'1',glue:'required',freeze:'1',freezeRole:'optional',timer:'90',theme:'mine'},
 {chapter:'2',name:'Ragasztott test',size:'4',difficulty:'6',bricks:'3',walls:'1',glue:'required',freeze:'1',freezeRole:'optional',timer:'0',theme:'mine'}
 ].map(s=>({...s,status:'empty'}));generated=Array(specs.length).fill(null);lastPackage=null;renderRows();summary.textContent='Az elveszett járat szerkezeti mintája betöltve.'
}
$('#addRow').onclick=()=>{specs.push(defaultSpec(specs.length));generated.push(null);renderRows()};
$('#generateAll').onclick=generateAll;$('#cancelGenerate').onclick=()=>{genCancelled=true;genWorker?.postMessage({type:'cancel'});log.textContent+='\nMegszakítás…'};$('#validateAll').onclick=validate;$('#loadExample').onclick=example;
$('#newProject').onclick=()=>{specs=[defaultSpec(0)];generated=[null];lastPackage=null;$('#publishBundle').disabled=true;renderRows()};
$('#saveProject').onclick=()=>download(project(),($('#scenarioId').value||'scenario')+'.ggrid-project.json');
$('#downloadScenario').onclick=()=>lastPackage&&download(lastPackage,($('#scenarioId').value||'scenario')+'.ggrid-scenario.json');
$('#publishBundle').onclick=exportPublication;
$('#installScenario').onclick=install;
$('#manageLocal').onclick=toggleLocalScenarios;
$('#themePreviewClose').onclick=closeThemePreview;$('#themePrev').onclick=()=>stepTheme(-1);$('#themeNext').onclick=()=>stepTheme(1);$('#themeUse').onclick=usePreviewTheme;
$('#importFile').onchange=async e=>{try{loadProject(JSON.parse(await e.target.files[0].text()));log.textContent='✓ Import sikeres.'}catch(err){log.textContent='Import hiba: '+err.message}e.target.value=''};
$('#scenarioId').addEventListener('input',()=>{const clean=$('#scenarioId').value.toLowerCase().replace(/[^a-z0-9-]/g,'-').replace(/-+/g,'-');if(clean!==$('#scenarioId').value)$('#scenarioId').value=clean});
example();loadThemes();
})();