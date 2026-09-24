import assert from 'node:assert/strict';
import fs from 'node:fs';
import {production,step,solveDetailed,stateFromRecord,resetSearchCache} from './multiball-physics.mjs';
import {analyzeState} from './classify-multiball-v2.mjs';
import {compile,solveCompact} from './multiball-compact-solver.mjs';
let transitions=0,solutions=0;
for(const f of fs.readdirSync('content/levels/multiball/packs')){
 const pack=JSON.parse(fs.readFileSync('content/levels/multiball/packs/'+f,'utf8'));
 for(const r of pack.levels){let s=stateFromRecord(r);
  resetSearchCache();const options={maxDepth:65,maxStates:60000},compact=solveCompact(s,options),reference=solveDetailed(s,options);
  assert.deepEqual(compact.path,reference.path);assert.equal(compact.states,reference.states);
  if(r===pack.levels[0])assert.deepEqual(compact.path,production.solveDetailed(s,options).path);
  for(const d of r.analysis.solution){
   for(const direction of ['up','down','left','right']){
    const before=JSON.stringify(s);const official=production.step(s,direction).state;assert.deepEqual(step(s,direction).state,official);assert.equal(JSON.stringify(s),before);
    const c=compile(s),positions=c.step(c.start,['up','down','left','right'].indexOf(direction));
    assert.deepEqual([...positions],official.objects.map(o=>o.exited?-1:o.x+o.y*s.width));transitions++;
   }s=production.step(s,d).state;
  }assert.equal(s.won,true);solutions++;
 }
}
const plain={width:3,height:3,exit:{x:2,y:1,dir:'right'},moves:0,won:false,objects:[{id:'a',type:'ball',x:0,y:1,cells:[{x:0,y:0}]},{id:'b',type:'ball',x:1,y:1,cells:[{x:0,y:0}]}]};
assert.equal(analyzeState(plain).status,'trivial');
assert.equal(solveDetailed(plain,{maxStates:1}).status,'limit');
const bent=structuredClone(plain);bent.objects[0].y=0;assert.equal(analyzeState(bent).status,'trivial');
console.log(JSON.stringify({productionEquivalentTransitions:transitions,replayedSolutions:solutions,trivialAndLimitTests:'passed'}));
