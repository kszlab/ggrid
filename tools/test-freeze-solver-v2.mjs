import assert from 'node:assert/strict';
import fs from 'node:fs';
const src=f=>fs.readFileSync(new URL('../'+f,import.meta.url),'utf8');
const engine=new Function(src('js/game-core.js')+'\n'+src('js/solver.js')+'\n'+src('js/freeze-solver-v1.js')+'\n'+src('js/freeze-solver-v2.js')+'\nreturn {step,solveDetailed,solveDetailedWithFreezeV1,solveDetailedWithFreezeV2,stateKey}')();
const state=r=>({width:r.board.width,height:r.board.height,exit:{x:r.board.exit.x,y:r.board.exit.y,dir:r.board.exit.direction||r.board.exit.dir},moves:0,won:false,objects:r.entities.map(e=>({id:e.id,type:e.type==='rigid-body'?'brick':e.type,x:e.position.x,y:e.position.y,exited:false,cells:e.properties.cells}))});
const pack=JSON.parse(src('content/levels/generated-test/packs/fastgen-v2-600-mixed-20260925.json'));
const levels=pack.levels.filter(r=>r.board.width===3&&r.board.height===3);
const dirs=['up','down','left','right'];
let rescue=null;
outer: for(const r of levels.slice(0,80)){
 let s=state(r),walk=r.analysis.solution||[];
 for(let p=0;p<Math.min(walk.length,8);p++){
  for(const dir of dirs){
   if(dir===walk[p])continue;
   const candidate=engine.step(s,dir,null).state;if(engine.stateKey(candidate)===engine.stateKey(s))continue;
   const normal=engine.solveDetailed(candidate,{maxDepth:35,maxStates:50000,timeBudgetMs:0});
   if(normal.status!=='unsolvable')continue;
   const v1=engine.solveDetailedWithFreezeV1(candidate,{maxDepth:40,maxStates:100000,timeBudgetMs:0,maxFreezeUses:1,preferNoFreeze:false});
   if(v1.status!=='solved'||v1.freezeUses!==1)continue;
   const v2=engine.solveDetailedWithFreezeV2(candidate,{maxDepth:40,maxStates:100000,timeBudgetMs:0,maxFreezeUses:1,preferNoFreeze:false});
   assert.equal(v2.status,'solved');assert.equal(v2.freezeUses,1);
   let cur=candidate;for(const a of v2.actions)cur=engine.step(cur,a.dir,a.freezeId).state;assert.equal(cur.won,true);
   rescue={levelId:r.levelId,v1States:v1.states,v2States:v2.states,v1Actions:v1.actions.length,v2Actions:v2.actions.length};break outer;
  }
  s=engine.step(s,walk[p],null).state;
 }
}
assert.ok(rescue,'No deterministic one-Freeze rescue state found');
const bench=JSON.parse(src('content/levels/generated-test/packs/fastgen-v3-d10-benchmark.json')).levels.filter(r=>r.board.width===5&&r.board.height===8);
let benchmarkChecked=0;
for(const r of bench.slice(0,2)){
 const s=state(r),normal=engine.solveDetailed(s,{maxDepth:70,maxStates:150000,timeBudgetMs:1200});
 const v2=engine.solveDetailedWithFreezeV2(s,{maxDepth:70,maxStates:220000,timeBudgetMs:2200,maxFreezeUses:1});
 assert.equal(v2.status,'solved');assert.equal(v2.freezeUses,0);
 if(normal.status==='solved')assert.deepEqual(v2.path,normal.path);benchmarkChecked++;
}
console.log(JSON.stringify({freezeSolverV2:'passed',rescue,benchmarkChecked},null,2));
