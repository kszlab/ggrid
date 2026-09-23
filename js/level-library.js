/* GGrid v0.12.39 - Level Data Model v2 calibration loader */
const LevelLibrary=(()=>{
 const dm={U:'up',D:'down',L:'left',R:'right'};
 let levels=null, cursor=new Map();
 function parse(){
  if(levels)return levels;
  levels=GGRID_TEST_LEVEL_ROWS.trim().split(/\n+/).map(row=>{
   const [id,wh,ex,parts,dclass,raw,sol]=row.split('|'),w=+wh[0],h=+wh[1];
   const objects=parts.split(',').map((p,i)=>({id:p[0]==='B'?'ball1':p[0]==='K'?'b'+i:'w'+i,type:p[0]==='B'?'ball':p[0]==='K'?'brick':'wall',x:+p[1],y:+p[2],cells:[{x:0,y:0}],glueEdges:[],glued:false}));
   return{format:'ggrid-level',formatVersion:2,levelId:id,rulesVersion:1,requires:{features:['core.movement','core.exit','object.ball','object.rigid-body','object.wall']},board:{width:w,height:h,exit:{dir:dm[ex[0]],x:+ex[1],y:+ex[2]}},initialResources:{freeze:0},analysis:{testDifficultyClass:+dclass,rawDifficulty:+raw,solution:[...sol].map(x=>dm[x])},_state:{width:w,height:h,exit:{dir:dm[ex[0]],x:+ex[1],y:+ex[2]},moves:0,won:false,glueCount:0,brickCount:objects.filter(o=>o.type==='brick').length,wallCount:objects.filter(o=>o.type==='wall').length,objects}};
  });
  return levels;
 }
 function compatible(l){return l.formatVersion<=2&&l.rulesVersion<=1}
 function candidates(w,h,d){return parse().filter(l=>compatible(l)&&l.board.width===w&&l.board.height===h&&l.analysis.testDifficultyClass===d)}
 function next(w,h,d){
  const a=candidates(w,h,d);if(!a.length)return null;const k=w+'x'+h+'|'+d,n=cursor.get(k)||0;cursor.set(k,n+1);return a[n%a.length];
 }
 function toGame(l){return{state:structuredClone(l._state),solution:[...l.analysis.solution],code:l.levelId,level:l}}
 return{all:parse,candidates,next,toGame};
})();