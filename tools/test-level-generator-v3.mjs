import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {explore,stateAt,graphSolver,activeBalls} from './level-generator-v3/statespace.mjs';
import {randomLayoutV3,rng,MULTIBALL_PROFILES,mutateLayoutV3} from './level-generator-v3/layout.mjs';
import {solveDetailed,root} from './level-generator-v2/engine.mjs';
import {analyzeState} from './classify-multiball-v2.mjs';

const strip=r=>({status:r.status,reason:r.reason??null,path:r.path,states:r.states});
const rand=rng(30303);let checks=0,analyses=0;
for(const [w,h] of [[3,3],[4,4],[5,5]]){
 let layout=null;for(let i=0;i<100&&!layout;i++)layout=randomLayoutV3(w,h,rand,{balls:2,largeShapesMode:'auto',styleName:'mixed'});
 assert.ok(layout,w+'x'+h+' B2 layout');
 assert.equal(layout.objects.filter(o=>o.type==='ball').length,2);
 const r=explore(layout,90000);if(!r)continue;const solve=graphSolver(layout,r);
 for(let k=0;k<Math.min(6,r.states.length);k++){
  const i=rand(r.states.length),s=stateAt(layout,r.states[i]);
  for(const opts of [{maxDepth:65,maxStates:70000},{maxDepth:4,maxStates:10000},{maxDepth:65,maxStates:80}]){
   assert.deepEqual(strip(solve(s,opts)),strip(solveDetailed(s,opts)));checks++;
  }
  if(activeBalls(layout,r.states[i])===2){
   assert.deepEqual(analyzeState(s,{maxStates:70000,riskStates:8000,solve}),analyzeState(s,{maxStates:70000,riskStates:8000}));analyses++;
  }
 }
 const m=mutateLayoutV3(layout,rand,{balls:2,largeShapesMode:'auto',aggressive:true});
 if(m)assert.equal(m.objects.filter(o=>o.type==='ball').length,2);
}
assert.ok(checks>0&&analyses>0);

const out=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'ggrid-v3-')),'pack.json');
execFileSync(process.execPath,[path.join(root,'tools/generate-levels-v3.mjs'),'--target','10@3x3:D1-D10:B2','--minutes','1','--workers','2','--seed','17','--novelty','off','--out',out,'--quiet'],{stdio:['ignore','ignore','inherit']});
const pack=JSON.parse(fs.readFileSync(out,'utf8'));
assert.equal(pack.metadata.generatorVersion,3);
assert.equal(pack.levels.length,10);
for(const l of pack.levels){
 assert.equal(l.content.metadataVersion,3);
 assert.equal(l.content.ballCount,2);
 assert.equal(l.analysis.solutionRequirements.freeze.status,'not-required');
 assert.equal(l.analysis.solutionRequirements.freeze.minimumUses,0);
 assert.ok(l.content.fingerprints?.canonicalHash);
 assert.ok(l.content.familyId?.startsWith('fam-'));
 assert.equal(l.generator.version,3);
}
const classes=new Set(pack.levels.map(l=>l.difficulty.class));assert.equal(classes.size,10);
console.log(JSON.stringify({fastGeneratorV3:'passed',graphSolverChecks:checks,multiballAnalysisChecks:analyses,endToEndLevels:pack.levels.length}));
