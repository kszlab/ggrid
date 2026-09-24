/* GGrid v0.12.98 - separate two-ball Level Library */
const MultiBallLibrary=(()=>{
 let levels=null,cursor=new Map(),catalogLoaded=false,loadPromise=null;
 const SUPPORTED_FEATURES=new Set(['core.movement','core.exit','object.ball','object.rigid-body','object.wall','ability.freeze','rule.multi-ball']);
 function parse(){if(levels)return levels;levels=[];return levels}
 function fromFullLevel(r){
  const exit=r.board?.exit||r.exit,entities=r.entities||r.objects||[];
  const objects=entities.map((e,i)=>({id:e.id||('e'+i),type:e.type==='rigid-body'?'brick':e.type,x:e.position?.x??e.x??0,y:e.position?.y??e.y??0,cells:structuredClone(e.properties?.cells||e.cells||[{x:0,y:0}]),glueEdges:[],glued:(e.properties?.cells||e.cells||[]).length>1}));
  const d=r.difficulty?.class,sol=r.analysis?.solution||[];
  return{format:'ggrid-level',formatVersion:r.formatVersion||2,levelId:r.levelId,rulesVersion:r.rulesVersion||1,requires:r.requires||{features:['core.movement','core.exit','object.ball','rule.multi-ball']},difficulty:r.difficulty||{},board:{width:r.board.width,height:r.board.height,exit:{dir:exit.direction||exit.dir,x:exit.x,y:exit.y}},initialResources:r.initialResources||{freeze:0},analysis:{...(r.analysis||{}),testDifficultyClass:d,rawDifficulty:r.difficulty?.score??null,difficultyModelVersion:r.difficulty?.modelVersion||'puzzle-v3-multiball',solution:sol},_state:{width:r.board.width,height:r.board.height,exit:{dir:exit.direction||exit.dir,x:exit.x,y:exit.y},moves:0,won:false,glueCount:objects.filter(o=>o.type==='brick'&&o.cells.length>1).length,brickCount:objects.filter(o=>o.type==='brick').length,wallCount:objects.filter(o=>o.type==='wall').length,objects}};
 }
 async function init(){
  if(catalogLoaded)return levels||parse();if(loadPromise)return loadPromise;parse();
  loadPromise=(async()=>{try{
   const res=await fetch('content/levels/multiball/catalog.json',{cache:'no-cache'});if(!res.ok)throw Error('MULTIBALL_CATALOG_FETCH');
   const cat=await res.json();if(cat.format!=='ggrid-level-catalog')throw Error('INVALID_MULTIBALL_CATALOG');
   const packs=await Promise.all((cat.packs||[]).map(async p=>{const pr=await fetch(new URL(p.src,new URL('content/levels/multiball/catalog.json',location.href)),{cache:'no-cache'});if(!pr.ok)throw Error('MULTIBALL_PACK_FETCH '+p.src);const pack=await pr.json();if(pack.format!=='ggrid-level-pack')throw Error('INVALID_MULTIBALL_PACK '+p.src);return pack.levels||[]}));
   const next=[],ids=new Set();for(const pack of packs)for(const r of pack){const l=fromFullLevel(r);if(ids.has(l.levelId))throw Error('DUPLICATE_MULTIBALL_LEVEL '+l.levelId);ids.add(l.levelId);next.push(l)}levels=next;catalogLoaded=true;
  }catch(e){console.error('Multi-ball catalog',e)}finally{loadPromise=null}return levels})();return loadPromise;
 }
 function compatible(l){return l.formatVersion<=2&&l.rulesVersion<=1&&(l.requires?.features||[]).every(f=>SUPPORTED_FEATURES.has(f))&&l._state.objects.filter(o=>o.type==='ball').length===2}
 function candidates(w,h,d){return parse().filter(l=>compatible(l)&&l.board.width===w&&l.board.height===h&&l.analysis.testDifficultyClass===d)}
 function has(w,h,d){return candidates(w,h,d).length>0}
 function next(w,h,d){const a=candidates(w,h,d);if(!a.length)return null;const k=w+'x'+h+'|'+d,n=cursor.get(k)||0;cursor.set(k,n+1);return a[n%a.length]}
 function coverage(){const out={};for(const l of parse()){if(!compatible(l))continue;const k=l.board.width+'x'+l.board.height,d=l.analysis.testDifficultyClass;(out[k]??=Array(10).fill(0))[d-1]++}return out}
 function health(){const all=parse(),ids=new Set(),duplicates=[],invalid=[],unsupported=[];for(const l of all){if(ids.has(l.levelId))duplicates.push(l.levelId);ids.add(l.levelId);if(!Number.isInteger(l.board.width)||!Number.isInteger(l.board.height)||!(l.analysis.testDifficultyClass>=1&&l.analysis.testDifficultyClass<=10)||l._state.objects.filter(o=>o.type==='ball').length!==2)invalid.push(l.levelId);if(!compatible(l))unsupported.push(l.levelId)}const cov=coverage(),missing=[];for(const size of ['3x3','4x4','5x5','5x6','5x7','5x8']){const a=cov[size]||Array(10).fill(0);for(let d=1;d<=10;d++)if(a[d-1]<4)missing.push(size+' D'+d+' ('+a[d-1]+'/4)')}return{total:all.length,duplicates,invalid,unsupported,coverage:cov,missing,ok:!duplicates.length&&!invalid.length&&!unsupported.length&&!missing.length}}
 function toGame(l){return{state:structuredClone(l._state),solution:[...l.analysis.solution],code:l.levelId,level:l}}
 return{init,all:parse,candidates,next,toGame,compatible,coverage,has,health,supportedFeatures:()=>[...SUPPORTED_FEATURES]};
})();
