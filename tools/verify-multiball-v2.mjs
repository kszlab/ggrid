import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {analyzeState,model} from './classify-multiball-v2.mjs';
import {stateFromRecord,production,signature} from './multiball-physics.mjs';
import {compile} from './multiball-compact-solver.mjs';
const sizes=['3x3','4x4','5x5','5x6','5x7','5x8'],ids=new Set(),signatures=new Set(),summary=[];let transitions=0;
for(const size of sizes){
 const file=`content/levels/multiball/packs/multiball-v2-${size}.json`,levels=JSON.parse(fs.readFileSync(file,'utf8')).levels;
 const coverage=Array(10).fill(0);
 for(const r of levels){
  assert.equal(r.difficulty.modelVersion,model);assert(!ids.has(r.levelId));ids.add(r.levelId);
  let s=stateFromRecord(r);production.validateLevel(s);assert.equal(s.objects.filter(o=>o.type==='ball').length,2);
  const sig=signature(s);assert(!signatures.has(sig));signatures.add(sig);
  const a=analyzeState(s);assert.equal(a.status,'ok');assert.equal(a.difficulty,r.difficulty.class);assert.equal(a.raw,r.difficulty.score);
  assert.deepEqual(a.optimalSolution,r.analysis.solution);assert(a.metrics.detourMoves>0&&a.metrics.directionChanges>0);
  if(s.width>=5)assert(s.objects.some(o=>o.type==='brick'&&o.cells.length>1));
  coverage[a.difficulty-1]++;
  for(const dir of r.analysis.solution){
   for(const [i,d] of ['up','down','left','right'].entries()){
    const c=compile(s),actual=c.step(c.start,i),expected=production.step(s,d).state;
    assert.deepEqual([...actual],expected.objects.map(o=>o.exited?-1:o.x+o.y*s.width));transitions++;
   }s=production.step(s,dir).state;
  }assert.equal(s.won,true);assert(s.objects.filter(o=>o.type==='ball').every(o=>o.exited));
 }
 assert.deepEqual(coverage,Array(10).fill(4));
 const row={size,levels:levels.length,coverage,minMoves:Math.min(...levels.map(r=>r.analysis.solution.length)),maxMoves:Math.max(...levels.map(r=>r.analysis.solution.length)),polyominoLevels:levels.filter(r=>r.entities.some(e=>e.type==='rigid-body'&&e.properties.cells.length>1)).length,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')};
 summary.push(row);console.log(JSON.stringify(row));
}
const fetchLocal=async url=>({ok:true,json:async()=>JSON.parse(fs.readFileSync(new URL(String(url),'https://example.invalid/').pathname.slice(1),'utf8'))});
const library=new Function('fetch','location',fs.readFileSync('js/multiball-library.js','utf8')+'\nreturn MultiBallLibrary;')(fetchLocal,{href:'https://example.invalid/'});
await library.init();const health=library.health();assert.equal(health.ok,true);assert.equal(health.total,240);
for(const size of sizes){const [w,h]=size.split('x').map(Number);for(let d=1;d<=10;d++){
 const cycle=Array.from({length:5},()=>library.next(w,h,d));assert.equal(new Set(cycle.slice(0,4).map(x=>x.levelId)).size,4);assert.equal(cycle[0].levelId,cycle[4].levelId);
 const game=library.toGame(cycle[0]);let s=game.state;for(const dir of game.solution)s=production.step(s,dir).state;assert.equal(s.won,true);
}}
const report={model,total:ids.size,verified:true,productionEquivalentTransitions:transitions,runtimeLibraryHealth:health,summary,calibrationSha256:crypto.createHash('sha256').update(fs.readFileSync('tools/difficulty-calibration-v2.json')).digest('hex')};
fs.writeFileSync('tools/multiball-verification-v2.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({verified:true,total:ids.size,transitions,runtimeLibrary:'passed'}));
