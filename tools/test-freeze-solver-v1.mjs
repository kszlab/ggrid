import assert from 'node:assert/strict';
import fs from 'node:fs';
const src=f=>fs.readFileSync(new URL('../'+f,import.meta.url),'utf8');
const engine=new Function(src('js/game-core.js')+'\n'+src('js/solver.js')+'\n'+src('js/freeze-solver-v1.js')+'\nreturn {step,solveDetailed,solveDetailedWithFreezeV1,stateKey}')();
const state=r=>({width:r.board.width,height:r.board.height,exit:{x:r.board.exit.x,y:r.board.exit.y,dir:r.board.exit.direction||r.board.exit.dir},moves:0,won:false,
 objects:r.entities.map(e=>({id:e.id,type:e.type==='rigid-body'?'brick':e.type,x:e.position.x,y:e.position.y,exited:false,cells:e.properties.cells}))});
const pack=JSON.parse(src('content/levels/generated-test/packs/fastgen-v2-600-mixed-20260925.json'));
const levels=pack.levels.filter(r=>r.board.width===3&&r.board.height===3);
assert.ok(levels.length>0);

// Normal solutions must remain normal and identical when the Freeze solver is used.
{
 const s=state(levels[0]),normal=engine.solveDetailed(s,{maxDepth:40,maxStates:50000});
 const freeze=engine.solveDetailedWithFreezeV1(s,{maxDepth:40,maxStates:50000,timeBudgetMs:0,maxFreezeUses:1});
 assert.equal(normal.status,'solved');assert.equal(freeze.status,'solved');assert.equal(freeze.freezeUses,0);
 assert.deepEqual(freeze.path,normal.path);assert.ok(freeze.actions.every(a=>a.freezeId===null));
}

// Find a deterministic reachable dead-end which one Freeze can rescue.
const dirs=['up','down','left','right'];let rescue=null,checked=0;
outer: for(const r of levels.slice(0,80)){
 let s=state(r),walk=r.analysis.solution||[];
 for(let p=0;p<Math.min(walk.length,8);p++){
  for(const dir of dirs){
   if(dir===walk[p])continue;
   const candidate=engine.step(s,dir,null).state;if(engine.stateKey(candidate)===engine.stateKey(s))continue;
   checked++;
   const normal=engine.solveDetailed(candidate,{maxDepth:35,maxStates:50000,timeBudgetMs:0});
   if(normal.status!=='unsolvable')continue;
   const fr=engine.solveDetailedWithFreezeV1(candidate,{maxDepth:40,maxStates:100000,timeBudgetMs:0,maxFreezeUses:1,preferNoFreeze:false});
   if(fr.status!=='solved'||fr.freezeUses!==1||!fr.actions?.some(a=>a.freezeId))continue;
   let cur=candidate;for(const a of fr.actions)cur=engine.step(cur,a.dir,a.freezeId).state;
   assert.equal(cur.won,true);rescue={levelId:r.levelId,prefix:p,wrong:dir,actions:fr.actions.length,freezeIndex:fr.firstFreezeIndex,freezeId:fr.actions[fr.firstFreezeIndex].freezeId};break outer;
  }
  s=engine.step(s,walk[p],null).state;
 }
}
assert.ok(rescue,'No one-Freeze rescue state found in deterministic 3x3 sample');
console.log(JSON.stringify({freezeSolverV1:'passed',checked,rescue},null,2));
