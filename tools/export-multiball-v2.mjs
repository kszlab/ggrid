import fs from 'node:fs';
import assert from 'node:assert/strict';
import {analyzeState,model} from './classify-multiball-v2.mjs';
import {production,step,signature} from './multiball-physics.mjs';
import {compile} from './multiball-compact-solver.mjs';
import {workFile} from './multiball-workspace.mjs';
const size=process.argv[2],data=JSON.parse(fs.readFileSync(workFile(`mb2-${size}.json`),'utf8'));
const selected=[];
for(let d=1;d<=10;d++){
 const matches=data.accepted.filter(p=>p.a.difficulty===d);
 assert(matches.length>=4,`${size} D${d}: only ${matches.length}/4`);
 // Prefer different obstacle layouts before different starts on the same board.
 const layouts=new Set();matches.sort((p,q)=>p.a.metrics.unknownMistakeAlternatives-q.a.metrics.unknownMistakeAlternatives);
 const chosen=[];
 for(const p of matches){const k=signature({...p.s,objects:p.s.objects.filter(o=>o.type!=='ball')});if(!layouts.has(k)){layouts.add(k);chosen.push(p);}if(chosen.length===4)break;}
 for(const p of matches)if(chosen.length<4&&!chosen.includes(p))chosen.push(p);
 selected.push(...chosen);
}
const ids=new Set(),signatures=new Set(),levels=[];let transitions=0;
for(const p of selected){
 const a=analyzeState(p.s);assert.equal(a.status,'ok');assert.equal(a.difficulty,p.a.difficulty,'Reclassification mismatch');assert.equal(a.raw,p.a.raw,'Score mismatch');
 assert(a.metrics.detourMoves>0&&a.metrics.directionChanges>0);
 assert.equal(p.s.objects.filter(o=>o.type==='ball').length,2);
 if(p.s.width>=5)assert(p.s.objects.some(o=>o.type==='brick'&&o.cells.length>1),'Large board lacks polyomino');
 const sig=signature(p.s);assert(!signatures.has(sig));signatures.add(sig);
 let cur=p.s;
 for(const dir of a.optimalSolution){for(const d of ['up','down','left','right']){const real=production.step(cur,d);assert.deepEqual(step(cur,d),real);const c=compile(cur),p=c.step(c.start,['up','down','left','right'].indexOf(d));assert.deepEqual([...p],real.state.objects.map(o=>o.exited?-1:o.x+o.y*cur.width));transitions++;}cur=production.step(cur,dir).state;}
 assert.equal(cur.won,true);assert(cur.objects.filter(o=>o.type==='ball').every(o=>o.exited));
 const n=levels.filter(l=>l.difficulty.class===a.difficulty).length+1,id=`MB2-${size.toUpperCase()}-D${String(a.difficulty).padStart(2,'0')}-${n}`;
 assert(!ids.has(id));ids.add(id);
 levels.push({format:'ggrid-level',formatVersion:2,levelId:id,rulesVersion:1,requires:{features:['core.movement','core.exit','object.ball','object.rigid-body','object.wall','rule.multi-ball']},
  board:{width:p.s.width,height:p.s.height,exit:{direction:p.s.exit.dir,x:p.s.exit.x,y:p.s.exit.y}},
  entities:p.s.objects.map(o=>({id:o.id,type:o.type==='brick'?'rigid-body':o.type,position:{x:o.x,y:o.y},properties:{cells:o.cells}})),initialResources:{freeze:0},
  difficulty:{class:a.difficulty,score:a.raw,modelVersion:model},analysis:{solution:a.optimalSolution,metrics:a.metrics,components:a.components,limits:{maxStates:60000,riskStates:10000,maxDepth:65},calibration:'puzzle-v2-frozen-size-thresholds'}});
 console.log(JSON.stringify({size,verified:id,moves:a.optimalSolution.length}));
}
const pack={format:'ggrid-level-pack',formatVersion:1,description:`Two-ball v2 ${size}: nontrivial, anchored to frozen puzzle-v2 thresholds`,levels};
fs.writeFileSync(`content/levels/multiball/packs/multiball-v2-${size}.json`,JSON.stringify(pack));
const report={size,levels:levels.length,coverage:Array(10).fill(4),productionEquivalentTransitions:transitions,minMoves:Math.min(...levels.map(l=>l.analysis.solution.length)),maxMoves:Math.max(...levels.map(l=>l.analysis.solution.length)),polyominoLevels:levels.filter(l=>l.entities.some(e=>e.type==='rigid-body'&&e.properties.cells.length>1)).length,reclassification:'passed',optimality:'BFS with the production transition function',solutionReplay:'passed',attempts:data.attempts};
fs.writeFileSync(workFile(`verified-${size}.json`),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
