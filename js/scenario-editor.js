/* GGrid Scenario Editor v0.1 – GGrid v0.12.1 */
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
   '<td><select data-k="theme">'+opt(['classic','mine'],s.theme)+'</select></td>'+
   '<td class="status '+(s.status==='ok'?'ok':s.status==='bad'?'bad':'wait')+'">'+({ok:'✓ kész',bad:'✕ hiba',dirty:'○ újra',empty:'○ nincs'}[s.status]||'○ nincs')+'</td>'+
   '<td><div class="row-actions"><button data-act="dup">⧉</button><button data-act="up">↑</button><button data-act="down">↓</button><button data-act="regen">↻</button><button data-act="del">✕</button></div></td>';
  tr.querySelectorAll('select').forEach(el=>el.onchange=()=>{s[el.dataset.k]=el.value;s.status='dirty';generated[i]=null;lastPackage=null;renderRows()});
  tr.querySelectorAll('button').forEach(b=>b.onclick=()=>rowAction(i,b.dataset.act));
  rowsEl.append(tr);
 });
}
function rowAction(i,a){
 if(a==='del'){specs.splice(i,1);generated.splice(i,1)}
 if(a==='dup'){specs.splice(i+1,0,{...specs[i],status:'dirty'});generated.splice(i+1,0,null)}
 if(a==='up'&&i>0){[specs[i-1],specs[i]]=[specs[i],specs[i-1]];[generated[i-1],generated[i]]=[generated[i],generated[i-1]]}
 if(a==='down'&&i<specs.length-1){[specs[i+1],specs[i]]=[specs[i],specs[i+1]];[generated[i+1],generated[i]]=[generated[i],generated[i+1]]}
 if(a==='regen'){generated[i]=null;specs[i].status='dirty';generateOne(i).then(()=>{buildPackage();renderRows()})}
 lastPackage=null;renderRows();
}
function eHash(str){let h=2166136261>>>0;for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
function eRng(seed){let a=eHash(seed);return()=>{a|=0;a=a+0x6D2B79F5|0;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296}}
function shuffleE(a,r){for(let i=a.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function shapeE(count,r){
 const cells=[{x:0,y:0}],used=new Set(['0,0']),edges=[];
 while(cells.length<count){const ai=Math.floor(r()*cells.length),d=DIRS[DIR_NAMES[Math.floor(r()*4)]],b=cells[ai],c={x:b.x+d.dx,y:b.y+d.dy},k=key(c.x,c.y);if(!used.has(k)){used.add(k);edges.push([ai,cells.length]);cells.push(c)}}
 const minx=Math.min(...cells.map(c=>c.x)),miny=Math.min(...cells.map(c=>c.y));return{cells:cells.map(c=>({x:c.x-minx,y:c.y-miny})),glueEdges:edges}
}
function placeE(n,shape,occ,r){
 const mx=Math.max(...shape.map(c=>c.x)),my=Math.max(...shape.map(c=>c.y)),aa=[];
 for(let y=0;y<n-my;y++)for(let x=0;x<n-mx;x++)if(shape.every(c=>!occ.has(key(x+c.x,y+c.y))))aa.push({x,y});
 if(!aa.length)return null;const a=aa[Math.floor(r()*aa.length)];shape.forEach(c=>occ.add(key(a.x+c.x,a.y+c.y)));return a
}
function targetRange(d){const m=[[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,8],[8,10],[10,12],[12,16]];return m[Math.max(1,Math.min(10,+d))-1]}
function counts(s,r){
 const n=+s.size;
 const b=s.bricks==='auto'?Math.max(1,Math.min(5,Math.round((n*n)/6+r()*2))):+s.bricks;
 const wm=Math.max(0,n-2),w=s.walls==='auto'?Math.floor(r()*(wm+1)):Math.min(+s.walls,wm);
 return{b,w}
}
function candidate(s,seed,attempt){
 const r=eRng(seed+'|'+attempt),n=+s.size,{b,w}=counts(s,r),occ=new Set(),objects=[];
 for(let i=0;i<w;i++){const free=[];for(let y=0;y<n;y++)for(let x=0;x<n;x++)if(!occ.has(key(x,y)))free.push({x,y});if(!free.length)return null;const c=free[Math.floor(r()*free.length)];occ.add(key(c.x,c.y));objects.push({id:'w'+(i+1),type:'wall',x:c.x,y:c.y,cells:[{x:0,y:0}]})}
 let glueCells=0,remaining=b,bi=1;
 while(remaining>0){
  let sz=1;
  if(s.glue!=='none'&&remaining>=2&&((s.glue==='required'&&glueCells===0)||r()<.42))sz=Math.min(remaining,2+(r()<.28&&remaining>=3?1:0));
  const sh=shapeE(sz,r),a=placeE(n,sh.cells,occ,r);if(!a)return null;
  objects.push({id:'b'+bi++,type:'brick',x:a.x,y:a.y,cells:sh.cells,glueEdges:sh.glueEdges,glued:sz>1});if(sz>1)glueCells+=sz-1;remaining-=sz;
 }
 if(s.glue==='required'&&glueCells===0)return null;
 const free=[];for(let y=0;y<n;y++)for(let x=0;x<n;x++)if(!occ.has(key(x,y)))free.push({x,y});if(!free.length)return null;
 const ball=free[Math.floor(r()*free.length)],dir=DIR_NAMES[Math.floor(r()*4)],exit=(dir==='left'||dir==='right')?{x:dir==='left'?0:n-1,y:Math.floor(r()*n),dir}:{x:Math.floor(r()*n),y:dir==='up'?0:n-1,dir};
 objects.unshift({id:'ball1',type:'ball',x:ball.x,y:ball.y,cells:[{x:0,y:0}]});
 return{width:n,height:n,exit,moves:0,won:false,objects,brickCount:b,wallCount:w,glueCount:glueCells}
}
async function generateOne(i){
 const s=specs[i],seed=($('#scenarioId').value||'scenario')+'-'+(i+1),[lo,hi]=targetRange(s.difficulty),budget=+s.freeze;
 s.status='dirty';renderRows();log.textContent='Stage '+(i+1)+' generálása…';
 await new Promise(r=>setTimeout(r,0));
 let best=null;
 for(let a=0;a<9000;a++){
  const st=candidate(s,seed,a);if(!st)continue;let normal=solve(st,30),metric=normal?.length??999,freezeAnalysis=null,accepted=false;
  if(s.freezeRole==='required'){
   if(budget<1||normal)continue;freezeAnalysis=analyzeOneFreeze(st,30);if(!freezeAnalysis.bestFreeze)continue;metric=freezeAnalysis.bestFreeze.totalMoves;accepted=metric>=lo&&metric<=hi;
  }else{
   if(!normal&&budget>0){freezeAnalysis=analyzeOneFreeze(st,30);if(freezeAnalysis.bestFreeze)metric=freezeAnalysis.bestFreeze.totalMoves}
   if(metric!==999)accepted=metric>=lo&&metric<=hi;
  }
  if(metric!==999&&(!best||Math.abs(metric-(lo+hi)/2)<best.dist))best={st,metric,freezeAnalysis,dist:Math.abs(metric-(lo+hi)/2),attempt:a};
  if(accepted){best={st,metric,freezeAnalysis,attempt:a};break}
 }
 if(!best){s.status='bad';generated[i]=null;log.textContent='Stage '+(i+1)+': nem sikerült megfelelő pályát generálni.';return false}
 const id=($('#scenarioId').value||'scenario')+'-'+String(i+1).padStart(2,'0');
 generated[i]={state:best.st,metric:best.metric,attempt:best.attempt,level:{format:'ggrid-level',formatVersion:1,id,version:1,name:s.name,board:{width:best.st.width,height:best.st.height},exit:{x:best.st.exit.x,y:best.st.exit.y,direction:best.st.exit.dir},objects:best.st.objects.map(o=>{const q=structuredClone(o);delete q.glued;return q})}};
 s.status='ok';renderRows();return true
}
function project(){return{format:'ggrid-scenario-project',formatVersion:1,editorVersion:1,engineVersion:'0.12.1',meta:{id:$('#scenarioId').value,name:$('#scenarioName').value,description:$('#scenarioDesc').value,version:+$('#scenarioVersion').value},stages:specs.map(({status,...s})=>s)}}
function roman(n){return['','I','II','III','IV','V'][n]||String(n)}
function buildPackage(){
 if(generated.length!==specs.length||generated.some(x=>!x)){lastPackage=null;return null}
 const p=project(),chapters=[],by=new Map();
 specs.forEach((s,i)=>{if(!by.has(s.chapter)){const ch={id:'chapter-'+s.chapter,name:roman(+s.chapter)+'. fejezet',stages:[]};by.set(s.chapter,ch);chapters.push(ch)}
  const abilities=+s.freeze>0?[{type:'freeze',count:+s.freeze}]:[];
  const st={id:'stage-'+String(i+1).padStart(2,'0'),name:s.name,level:{key:'level:'+generated[i].level.id,version:1},theme:{key:'theme:'+s.theme,version:1},abilities,timer:+s.timer?{mode:'countdown',seconds:+s.timer,onExpire:'fail'}:null};
  by.get(s.chapter).stages.push(st);
 });
 const scenario={format:'ggrid-scenario',formatVersion:1,id:p.meta.id,version:p.meta.version,name:p.meta.name,description:p.meta.description,rules:['Juttasd ki az összes golyót.','A téglák nem hagyhatják el a pályát.'],defaults:{theme:{key:'theme:classic',version:1},abilities:[],timer:null,completion:{type:'allBallsExited'}},chapters,scoring:null};
 const resources={'theme:classic':THEMES.classic,'theme:mine':THEMES.mine};generated.forEach(g=>resources['level:'+g.level.id]=g.level);
 lastPackage={format:'ggrid-scenario-package',formatVersion:1,packageVersion:1,engineVersion:'0.12.1',scenario,resources,editorProject:p};
 $('#downloadScenario').disabled=false;$('#installScenario').disabled=false;
 summary.textContent=specs.length+' stage · minden pálya legenerálva és solverrel ellenőrizve.';
 return lastPackage
}
async function generateAll(){
 generated=Array(specs.length).fill(null);lastPackage=null;$('#generateAll').disabled=true;
 for(let i=0;i<specs.length;i++){const ok=await generateOne(i);if(!ok)break}
 $('#generateAll').disabled=false;const p=buildPackage();log.textContent=p?'Kész: '+specs.length+' stage generálva. A scenario exportálható vagy hozzáadható a játékhoz.':'A generálás nem fejeződött be.'
}
function validate(){
 const errs=[];if(!specs.length)errs.push('Nincs stage.');specs.forEach((s,i)=>{if(s.freeze==='0'&&s.freezeRole!=='none')errs.push('Stage '+(i+1)+': Freeze=0 mellett a szerep csak Nincs lehet.');if(s.freezeRole==='required'&&s.freeze==='0')errs.push('Stage '+(i+1)+': szükséges Freeze-hez legalább 1 Freeze kell.')});
 if(generated.some((g,i)=>g&&!solve(g.state,30)&&specs[i].freezeRole!=='required'&&!analyzeOneFreeze(g.state,30).bestFreeze))errs.push('Van nem megoldható generált stage.');
 log.textContent=errs.length?'ELLENŐRZÉSI HIBÁK:\n'+errs.join('\n'):'✓ A projekt szerkezete érvényes'+(lastPackage?', a scenario csomag elkészült.':'. A konkrét pályákhoz futtasd a generálást.');
 return !errs.length
}
function download(obj,name){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(obj,null,2)],{type:'application/json'}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
function install(){
 if(!lastPackage)return;let arr=[];try{arr=JSON.parse(localStorage.getItem(STORE)||'[]')}catch(_){}
 arr=arr.filter(x=>x?.scenario?.id!==lastPackage.scenario.id);arr.push(lastPackage);localStorage.setItem(STORE,JSON.stringify(arr));log.textContent='✓ A forgatókönyv hozzáadva ehhez a böngészőhöz. A GGrid „Játék indítása” listájában megjelenik.'
}
function loadProject(p){
 const pr=p.format==='ggrid-scenario-package'?p.editorProject:p;if(!pr||pr.format!=='ggrid-scenario-project')throw Error('Nem támogatott projektfájl.');
 $('#scenarioId').value=[...$('#scenarioId').options].some(o=>o.value===pr.meta.id)?pr.meta.id:'custom-01';
 $('#scenarioName').value=[...$('#scenarioName').options].some(o=>o.value===pr.meta.name)?pr.meta.name:'Saját forgatókönyv 1';
 $('#scenarioDesc').value=[...$('#scenarioDesc').options].some(o=>o.value===pr.meta.description)?pr.meta.description:'GGrid egyedi próbakampány.';
 $('#scenarioVersion').value=String(pr.meta.version||1);specs=pr.stages.map(s=>({...s,status:'empty'}));generated=Array(specs.length).fill(null);lastPackage=null;renderRows();summary.textContent='Projekt betöltve; a pályákat újra kell generálni.'
}
function example(){
 $('#scenarioId').value='lost-mine';$('#scenarioName').value='Az elveszett járat';$('#scenarioDesc').value='Hat pályás próbakaland a raktártól az elhagyott bányáig.';$('#scenarioVersion').value='2';
 specs=[
 {chapter:'1',name:'Alapok',size:'4',difficulty:'2',bricks:'1',walls:'0',glue:'none',freeze:'1',freezeRole:'optional',timer:'0',theme:'classic'},
 {chapter:'1',name:'Kerülőút',size:'4',difficulty:'3',bricks:'1',walls:'1',glue:'none',freeze:'1',freezeRole:'optional',timer:'0',theme:'classic'},
 {chapter:'1',name:'Freeze próba',size:'4',difficulty:'4',bricks:'2',walls:'0',glue:'none',freeze:'1',freezeRole:'required',timer:'0',theme:'classic'},
 {chapter:'2',name:'Mélyebbre',size:'4',difficulty:'4',bricks:'1',walls:'1',glue:'none',freeze:'1',freezeRole:'optional',timer:'0',theme:'mine'},
 {chapter:'2',name:'Időpróba',size:'4',difficulty:'5',bricks:'2',walls:'1',glue:'required',freeze:'1',freezeRole:'optional',timer:'90',theme:'mine'},
 {chapter:'2',name:'Ragasztott test',size:'4',difficulty:'6',bricks:'3',walls:'1',glue:'required',freeze:'1',freezeRole:'optional',timer:'0',theme:'mine'}
 ].map(s=>({...s,status:'empty'}));generated=Array(specs.length).fill(null);lastPackage=null;renderRows();summary.textContent='Az elveszett járat szerkezeti mintája betöltve.'
}
$('#addRow').onclick=()=>{specs.push(defaultSpec(specs.length));generated.push(null);renderRows()};
$('#generateAll').onclick=generateAll;$('#validateAll').onclick=validate;$('#loadExample').onclick=example;
$('#newProject').onclick=()=>{specs=[defaultSpec(0)];generated=[null];lastPackage=null;renderRows()};
$('#saveProject').onclick=()=>download(project(),($('#scenarioId').value||'scenario')+'.ggrid-project.json');
$('#downloadScenario').onclick=()=>lastPackage&&download(lastPackage,($('#scenarioId').value||'scenario')+'.ggrid-scenario.json');
$('#installScenario').onclick=install;
$('#importFile').onchange=async e=>{try{loadProject(JSON.parse(await e.target.files[0].text()));log.textContent='✓ Import sikeres.'}catch(err){log.textContent='Import hiba: '+err.message}e.target.value=''};
example();
})();