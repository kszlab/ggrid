// Runtime solver equivalence: the compact solveDetailed() used by the game must
// return exactly what the original clone-based BFS (solveDetailedLegacy) returns.
// Checked on every single- and two-ball library level, and on every intermediate
// state of the stored solution for a deterministic sample of levels.
import assert from 'node:assert/strict';
import fs from 'node:fs';
const src=f=>fs.readFileSync(new URL('../'+f,import.meta.url),'utf8');
const engine=new Function(src('js/game-core.js')+'\n'+src('js/solver.js')+'\nreturn {step,solveDetailed,solveDetailedLegacy}')();
const state=r=>({width:r.board.width,height:r.board.height,exit:{x:r.board.exit.x,y:r.board.exit.y,dir:r.board.exit.direction||r.board.exit.dir},moves:0,won:false,
 objects:r.entities.map(e=>({id:e.id,type:e.type==='rigid-body'?'brick':e.type,x:e.position.x,y:e.position.y,cells:e.properties.cells}))});
const records=[];
for(const root of ['content/levels','content/levels/multiball']){
 const cat=JSON.parse(src(root+'/catalog.json'));
 for(const p of cat.packs)records.push(...JSON.parse(src(root+'/'+p.src)).levels);
}
const options={maxDepth:40,maxStates:8000};
const strip=r=>({status:r.status,reason:r.reason??null,path:r.path,states:r.states});
let compared=0,started=Date.now();
records.forEach((r,idx)=>{
 let s=state(r);
 const walk=idx%30===0?r.analysis.solution:[];
 for(let i=0;i<=walk.length;i++){
  assert.deepEqual(strip(engine.solveDetailed(s,options)),strip(engine.solveDetailedLegacy(s,options)),r.levelId+' step '+i);
  compared++;
  if(i<walk.length)s=engine.step(s,walk[i]).state;
 }
 if(idx%25===0){const tight={maxDepth:3,maxStates:40};assert.deepEqual(strip(engine.solveDetailed(state(r),tight)),strip(engine.solveDetailedLegacy(state(r),tight)),r.levelId+' tight');compared++}
});
console.log(JSON.stringify({runtimeSolverEquivalence:'passed',levels:records.length,comparisons:compared,seconds:Math.round((Date.now()-started)/1000)}));
