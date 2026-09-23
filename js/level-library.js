/* GGrid v0.12.46 - data-driven Level Library with capability + coverage validation */
const LevelLibrary=(()=>{
 const dm={U:'up',D:'down',L:'left',R:'right'};
 let levels=null,cursor=new Map();
 const SUPPORTED_FEATURES=new Set(['core.movement','core.exit','object.ball','object.rigid-body','object.wall','ability.freeze']);
 function parse(){
  if(levels)return levels;
  levels=GGRID_TEST_LEVELS_V2.map(r=>{
   const objects=r.o.map((p,i)=>({id:p[0]==='B'?'ball1':p[0]==='K'?'b'+i:'w'+i,type:p[0]==='B'?'ball':p[0]==='K'?'brick':'wall',x:p[1],y:p[2],cells:p[3].map(c=>({x:c[0],y:c[1]})),glueEdges:[],glued:p[3].length>1}));
   const glueCount=objects.filter(o=>o.type==='brick'&&o.cells.length>1).length;
   return{format:'ggrid-level',formatVersion:2,levelId:r.id,rulesVersion:1,requires:{features:['core.movement','core.exit','object.ball','object.rigid-body','object.wall']},board:{width:r.w,height:r.h,exit:{dir:dm[r.e[0]],x:r.e[1],y:r.e[2]}},initialResources:{freeze:0},analysis:{testDifficultyClass:r.d,rawDifficulty:r.raw,difficultyModelVersion:2,solution:[...r.sol].map(x=>dm[x])},_state:{width:r.w,height:r.h,exit:{dir:dm[r.e[0]],x:r.e[1],y:r.e[2]},moves:0,won:false,glueCount,brickCount:objects.filter(o=>o.type==='brick').length,wallCount:objects.filter(o=>o.type==='wall').length,objects}};
  });
  return levels;
 }
 function compatible(l){
  return l.formatVersion<=2&&l.rulesVersion<=1&&(l.requires?.features||[]).every(f=>SUPPORTED_FEATURES.has(f));
 }
 function coverage(){
  const out={};
  for(const l of parse()){if(!compatible(l))continue;const k=l.board.width+'x'+l.board.height,d=l.analysis.testDifficultyClass;(out[k]??=Array(10).fill(0))[d-1]++;}
  return out;
 }
 function has(w,h,d){return candidates(w,h,d).length>0}
 function health(){
  const all=parse(),ids=new Set(),duplicates=[],invalid=[],unsupported=[];
  for(const l of all){
   if(ids.has(l.levelId))duplicates.push(l.levelId);ids.add(l.levelId);
   if(!Number.isInteger(l.board.width)||!Number.isInteger(l.board.height)||!(l.analysis.testDifficultyClass>=1&&l.analysis.testDifficultyClass<=10))invalid.push(l.levelId);
   if(!compatible(l))unsupported.push(l.levelId);
  }
  const cov=coverage(),missing=[];
  for(const [size,a] of Object.entries(cov))for(let d=1;d<=10;d++)if(!a[d-1])missing.push(size+' D'+d);
  return{total:all.length,compatible:all.length-unsupported.length,duplicates,invalid,unsupported,coverage:cov,missing,ok:!duplicates.length&&!invalid.length&&!unsupported.length&&!missing.length};
 }
 function candidates(w,h,d){return parse().filter(l=>compatible(l)&&l.board.width===w&&l.board.height===h&&l.analysis.testDifficultyClass===d)}
 function next(w,h,d){const a=candidates(w,h,d);if(!a.length)return null;const k=w+'x'+h+'|'+d,n=cursor.get(k)||0;cursor.set(k,n+1);return a[n%a.length]}
 function toGame(l){return{state:structuredClone(l._state),solution:[...l.analysis.solution],code:l.levelId,level:l}}
 return{all:parse,candidates,next,toGame,compatible,coverage,has,health,supportedFeatures:()=>[...SUPPORTED_FEATURES]};
})();