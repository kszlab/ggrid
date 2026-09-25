/* GGrid v0.15.23 - isolated library for Fast Generator v2 output. */
const GeneratedTestLibrary=(()=>{
 let levels=null,cursor=new Map(),catalogLoaded=false,loadPromise=null;
 const SUPPORTED_FEATURES=new Set(['core.movement','core.exit','object.ball','object.rigid-body','object.wall','ability.freeze','rule.multi-ball']);
 function parse(){if(levels)return levels;levels=[];return levels}
 function fromFullLevel(r){
  const exit=r.board.exit,entities=r.entities||[],objects=entities.map((e,i)=>({id:e.id||('e'+i),type:e.type==='rigid-body'?'brick':e.type,x:e.position?.x??0,y:e.position?.y??0,cells:structuredClone(e.properties?.cells||[{x:0,y:0}]),glueEdges:[],glued:(e.properties?.cells||[]).length>1}));
  const balls=objects.filter(o=>o.type==='ball').length,d=r.difficulty?.class,sol=r.analysis?.solution||[];
  return{format:'ggrid-level',formatVersion:r.formatVersion||2,levelId:r.levelId,rulesVersion:r.rulesVersion||1,requires:r.requires||{features:['core.movement','core.exit','object.ball']},difficulty:r.difficulty||{},content:r.content||{},generator:r.generator||{},board:{width:r.board.width,height:r.board.height,exit:{dir:exit.direction||exit.dir,x:exit.x,y:exit.y}},initialResources:r.initialResources||{freeze:0},analysis:{...(r.analysis||{}),testDifficultyClass:d,rawDifficulty:r.difficulty?.score??null,difficultyModelVersion:r.difficulty?.modelVersion||'',solution:sol,ballCount:balls},_state:{width:r.board.width,height:r.board.height,exit:{dir:exit.direction||exit.dir,x:exit.x,y:exit.y},moves:0,won:false,glueCount:objects.filter(o=>o.type==='brick'&&o.cells.length>1).length,brickCount:objects.filter(o=>o.type==='brick').length,wallCount:objects.filter(o=>o.type==='wall').length,objects}};
 }
 async function init(){
  if(catalogLoaded)return levels||parse();if(loadPromise)return loadPromise;parse();
  loadPromise=(async()=>{try{
   const base='content/levels/generated-test/catalog.json',res=await fetch(base,{cache:'no-cache'});if(!res.ok)throw Error('GENERATED_TEST_CATALOG_FETCH');
   const cat=await res.json();if(cat.format!=='ggrid-level-catalog')throw Error('INVALID_GENERATED_TEST_CATALOG');
   const packs=await Promise.all((cat.packs||[]).map(async p=>{const pr=await fetch(new URL(p.src,new URL(base,location.href)),{cache:'no-cache'});if(!pr.ok)throw Error('GENERATED_TEST_PACK_FETCH '+p.src);const pack=await pr.json();return pack.levels||[]}));
   const next=[],ids=new Set();for(const pack of packs)for(const r of pack){const l=fromFullLevel(r);if(ids.has(l.levelId))throw Error('DUPLICATE_GENERATED_LEVEL '+l.levelId);ids.add(l.levelId);next.push(l)}levels=next;catalogLoaded=true;
  }catch(e){console.warn('Generated test library',e);catalogLoaded=true}finally{loadPromise=null}return levels})();return loadPromise;
 }
 function compatible(l){const balls=l._state.objects.filter(o=>o.type==='ball').length;return l.formatVersion<=2&&l.rulesVersion<=1&&balls>=1&&balls<=2&&(l.requires?.features||[]).every(f=>SUPPORTED_FEATURES.has(f))}
 function candidates(w,h,d){return parse().filter(l=>compatible(l)&&l.board.width===w&&l.board.height===h&&l.analysis.testDifficultyClass===d)}
 function has(w,h,d){return candidates(w,h,d).length>0}
 function hasAny(){return parse().some(compatible)}
 function firstAvailable(){const l=parse().find(compatible);return l?{w:l.board.width,h:l.board.height,d:l.analysis.testDifficultyClass}:null}
 function next(w,h,d){const a=candidates(w,h,d);if(!a.length)return null;const k=w+'x'+h+'|'+d,n=cursor.get(k)||0;cursor.set(k,n+1);return a[n%a.length]}
 function toGame(l){return{state:structuredClone(l._state),solution:[...l.analysis.solution],code:l.levelId,level:l}}
 function coverage(){const out={};for(const l of parse()){if(!compatible(l))continue;const k=l.board.width+'x'+l.board.height,d=l.analysis.testDifficultyClass;(out[k]??=Array(10).fill(0))[d-1]++}return out}
 return{init,next,has,hasAny,firstAvailable,candidates,toGame,coverage,all:parse};
})();
