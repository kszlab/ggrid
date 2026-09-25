#!/usr/bin/env node
/* GGrid Fast Generator v3
   Hybrid generator: v2 state-space harvesting + adaptive direct/local search.
   Examples:
   node tools/generate-levels-v3.mjs --target "100@5x8:D1-D10:B1,B2"
   node tools/generate-levels-v3.mjs --target "10@5x8:D10:B2" --minutes 10 --official-check
*/
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {Worker} from 'node:worker_threads';
import {root,step,validateLevel,solveDetailed,readJson,stateFromRecord,libraryRecords} from './level-generator-v2/engine.mjs';
import {toRecord,fingerprint,familyFingerprint} from './level-generator-v3/layout.mjs';
import {createFingerprintIndex,classifyAgainstIndex,fingerprintsFor} from './level-fingerprint-v1.mjs';

function parseRange(txt,prefix=''){
 const out=new Set();
 for(const raw of String(txt).split(',')){const part=raw.toUpperCase().split(String(prefix).toUpperCase()).join('');const [a,b]=part.split('-').map(Number);for(let x=a;x<=(b||a);x++)out.add(x)}
 return [...out].filter(Number.isFinite).sort((a,b)=>a-b);
}
function parseTarget(txt){
 const m=String(txt).match(/^(\d+)@(\d+)x(\d+):D([0-9D,-]+):B([0-9B,]+)$/i);
 if(!m)throw Error('Invalid --target '+txt+'; expected 100@5x8:D1-D10:B1,B2');
 return {count:+m[1],w:+m[2],h:+m[3],classes:parseRange(m[4],'D'),balls:parseRange(m[5],'B'),label:txt};
}
function parseArgs(argv){
 const o={targets:[],size:null,classes:'1-10',balls:'1',count:100,minutes:5,workers:Math.max(1,Math.min(4,os.availableParallelism?.()||os.cpus().length)),seed:1,out:null,idPrefix:'FG3',minMoves:3,maxMoves:65,samples:20,stateCap:220000,largeShapes:'auto',familyCap:2,publishTest:false,quiet:false,officialCheck:false,novelty:'review',strategy:'auto'};
 for(let i=2;i<argv.length;i++){const a=argv[i],v=()=>argv[++i];
  if(a==='--target')o.targets.push(parseTarget(v()));else if(a==='--size')o.size=v();else if(a==='--classes')o.classes=v();else if(a==='--balls')o.balls=v();else if(a==='--count')o.count=+v();
  else if(a==='--minutes')o.minutes=+v();else if(a==='--workers')o.workers=+v();else if(a==='--seed')o.seed=+v();else if(a==='--out')o.out=v();else if(a==='--id-prefix')o.idPrefix=v();
  else if(a==='--min-moves')o.minMoves=+v();else if(a==='--max-moves')o.maxMoves=+v();else if(a==='--samples-per-layout')o.samples=+v();else if(a==='--state-cap')o.stateCap=+v();
  else if(a==='--large-shapes')o.largeShapes=v();else if(a==='--family-cap')o.familyCap=+v();else if(a==='--publish-test')o.publishTest=true;else if(a==='--official-check')o.officialCheck=true;
  else if(a==='--novelty')o.novelty=v();else if(a==='--strategy')o.strategy=v();else if(a==='--quiet')o.quiet=true;else if(a==='--help'||a==='-h')o.help=true;else throw Error('Unknown option '+a);
 }
 if(!['auto','on','off'].includes(o.largeShapes))throw Error('--large-shapes must be auto|on|off');
 if(!['strict','review','off'].includes(o.novelty))throw Error('--novelty must be strict|review|off');
 if(!o.targets.length&&o.size){const [w,h]=o.size.split('x').map(Number);o.targets.push({count:o.count,w,h,classes:parseRange(o.classes),balls:parseRange(o.balls),label:'simple-options'})}
 return o;
}
const HELP=`GGrid Fast Generator v3
 --target "100@5x8:D1-D10:B1,B2"  repeatable generation target
 --minutes 5        time limit per size/ball job
 --workers N        default min(4, CPU cores)
 --state-cap 220000 state-space memory guard
 --large-shapes auto|on|off
 --family-cap 2
 --novelty strict|review|off
 --strategy auto|space-mixed|space-walled|direct-open|direct-hard|direct-mutate
 --official-check   re-run accepted B2 levels with the official classifier backend
 --publish-test     register output in generated-test catalog
`;
const log=(o,...x)=>{if(!o.quiet)console.error(...x)};
function quotas(count,classes){const q=new Map(classes.map(d=>[d,Math.floor(count/classes.length)]));for(let i=0;i<count%classes.length;i++)q.set(classes[i],q.get(classes[i])+1);return q}

function recordsFromCatalog(rel){
 try{const cat=readJson(rel),base=path.dirname(rel);return (cat.packs||[]).flatMap(p=>readJson(path.posix.join(base,p.src)).levels||[])}catch(_){return []}
}
function allActiveRecords(){return [...libraryRecords(),...recordsFromCatalog('content/levels/generated-test/catalog.json')]}
function ballCountRecord(r){return r.content?.ballCount??(r.entities||[]).filter(e=>e.type==='ball').length}
function eliteSeedsFor(records,w,h,balls){
 return records.filter(r=>r.board?.width===w&&r.board?.height===h&&ballCountRecord(r)===balls)
  .map(r=>({state:stateFromRecord(r),raw:Number(r.difficulty?.score??r.analysis?.rawDifficulty??0)}))
  .filter(e=>Number.isFinite(e.raw)).sort((a,b)=>b.raw-a.raw).slice(0,32);
}
function verifyRuntime(s,a){
 try{
  validateLevel(s);let cur=s;for(const dir of a.optimalSolution||[]){if(cur.won)return false;cur=step(cur,dir).state}
  if(!cur.won)return false;
  const best=solveDetailed(s,{maxDepth:Math.max(70,(a.optimalSolution?.length||0)+2),maxStates:2e6});
  return best.status==='solved'&&best.path.length===a.optimalSolution.length;
 }catch(_){return false}
}
async function verifyOfficial(s,a,balls){
 if(balls!==2)return true;
 const {analyzeState}=await import('./classify-multiball-v2.mjs');
 const b=analyzeState(s,{maxStates:70000,riskStates:8000});
 return b.status==='ok'&&b.difficulty===a.difficulty&&b.optimalSolution?.length===a.optimalSolution?.length;
}
function addToIndex(index,level){
 const fp=level.content?.fingerprints||fingerprintsFor(level,{analysis:level.analysis}),id=level.levelId;
 index.items[id]={canonicalHash:fp.canonicalHash,simHash:fp.simHash,buckets:fp.buckets};
 (index.exact[fp.canonicalHash]??=[]).push(id);for(const b of fp.buckets)(index.buckets[b]??=[]).push(id);
}
function noveltyAccept(state,analysis,index,mode){
 if(mode==='off'){
  const fp=fingerprintsFor(state,{analysis});return !(index.exact?.[fp.canonicalHash]?.length);
 }
 const r=classifyAgainstIndex(state,index,{analysis});
 if(mode==='strict')return r.classification==='UNIQUE';
 return r.classification!=='DUPLICATE'&&r.classification!=='NEAR_DUPLICATE';
}

async function generateJob(o,t,balls,targetCount,records,index,families,usedIds,seqRef,packId){
 const shared=new SharedArrayBuffer(4*11),needed=new Int32Array(shared),q=quotas(targetCount,t.classes);for(const [d,n] of q)needed[d]=n;
 const accepted=[],perWorker=new Map(),rejected={duplicateOrSimilar:0,family:0,classFull:0,verification:0,official:0},started=Date.now(),eliteSeeds=eliteSeedsFor(records,t.w,t.h,balls);
 const workers=Array.from({length:o.workers},(_,i)=>new Worker(new URL('./level-generator-v3/worker.mjs',import.meta.url),{workerData:{w:t.w,h:t.h,balls,seed:o.seed*10000+t.w*100+t.h*10+balls*1000+i,minMoves:o.minMoves,maxMoves:o.maxMoves,samplesPerLayout:o.samples,stateCap:o.stateCap,largeShapesMode:o.largeShapes,shared,eliteSeeds,strategyMode:o.strategy}}));
 const remaining=()=>t.classes.reduce((n,d)=>n+Math.max(0,Atomics.load(needed,d)),0);
 await new Promise(resolve=>{
  let finished=0;const timer=setTimeout(()=>Atomics.store(needed,0,1),o.minutes*60000),progress=setInterval(()=>log(o,`  V3 ${t.w}x${t.h} B${balls} · accepted ${accepted.length} · need ${remaining()}`),10000);
  workers.forEach((wk,i)=>{
   wk.on('message',async m=>{
    if(m.type==='stats'){perWorker.set(i,m.stats);return}
    const d=m.analysis.difficulty;if(Atomics.load(needed,d)<=0){rejected.classFull++;return}
    if((families.get(m.family)||0)>=o.familyCap){rejected.family++;return}
    if(!noveltyAccept(m.state,m.analysis,index,o.novelty)){rejected.duplicateOrSimilar++;return}
    if(!verifyRuntime(m.state,m.analysis)){rejected.verification++;return}
    if(o.officialCheck&&!(await verifyOfficial(m.state,m.analysis,balls))){rejected.official++;return}
    if(Atomics.load(needed,d)<=0)return;
    families.set(m.family,(families.get(m.family)||0)+1);Atomics.sub(needed,d,1);
    let id;do id=`${o.idPrefix}-${t.w}X${t.h}-B${balls}-${String(++seqRef.n).padStart(6,'0')}`;while(usedIds.has(id));usedIds.add(id);
    const level=toRecord(m.state,m.analysis,id,{tool:'tools/generate-levels-v3.mjs',version:3,seed:o.seed,method:'hybrid-state-space-direct-bandit',largeShapes:o.largeShapes},{packId,familyId:m.family,noveltyScore:1/(families.get(m.family)||1),library:o.publishTest?'generated-test':'generated'});
    accepted.push(level);addToIndex(index,level);if(remaining()===0)Atomics.store(needed,0,1);
   });
   wk.on('error',e=>{console.error(e);Atomics.store(needed,0,1)});
   wk.on('exit',()=>{if(++finished===workers.length){clearTimeout(timer);clearInterval(progress);resolve()}});
  });
 });
 return {levels:accepted,seconds:Math.round((Date.now()-started)/1000),coverage:Object.fromEntries(t.classes.map(d=>['D'+d,accepted.filter(l=>l.difficulty.class===d).length])),rejected,stats:[...perWorker.values()]};
}
function writeTestCatalog(abs){
 const dir=path.join(root,'content/levels/generated-test'),catFile=path.join(dir,'catalog.json');const cat=readJson(path.relative(root,catFile));
 const src=path.relative(dir,abs).split(path.sep).join('/'),id=path.basename(abs,'.json');
 cat.packs=(cat.packs||[]).filter(p=>p.id!==id&&p.src!==src);cat.packs.push({id,src,metadataVersion:3,contentType:'level-pack',status:'active',access:{entitlement:null,visibility:'public'}});
 fs.writeFileSync(catFile,JSON.stringify(cat,null,2)+'\n');
}
async function main(){
 const o=parseArgs(process.argv);if(o.help||!o.targets.length){console.log(HELP);process.exit(o.help?0:2)}
 const records=allActiveRecords(),index=createFingerprintIndex(records),families=new Map(),usedIds=new Set(records.map(r=>r.levelId)),seqRef={n:0},all=[],reports=[],multiballSizes=new Set(['3x3','4x4','5x5','5x6','5x7','5x8']);
 for(const r of records){try{const f=familyFingerprint(stateFromRecord(r));families.set(f,(families.get(f)||0)+1)}catch(_){}}
 const tag=o.targets.length===1?`${o.targets[0].w}x${o.targets[0].h}`:'mixed';
 let out=o.out||path.join('generated-levels',`${o.idPrefix.toLowerCase()}-${tag}-s${o.seed}.json`);
 if(o.publishTest&&!o.out)out=path.join('content/levels/generated-test/packs',`${o.idPrefix.toLowerCase()}-${tag}-s${o.seed}.json`);
 const abs=path.resolve(root,out),packId=path.basename(abs,'.json');
 for(const t of o.targets){
  if(t.w<3||t.h<3||t.w>8||t.h>8)throw Error('V3 supports board dimensions 3..8');
  for(let bi=0;bi<t.balls.length;bi++){
   const balls=t.balls[bi];if(![1,2].includes(balls))throw Error('V3 currently supports B1 and B2');
   if(balls===2&&!multiballSizes.has(t.w+'x'+t.h))throw Error('B2 difficulty not calibrated for '+t.w+'x'+t.h);
   const targetCount=Math.floor(t.count/t.balls.length)+(bi<t.count%t.balls.length?1:0);
   const r=await generateJob(o,t,balls,targetCount,records,index,families,usedIds,seqRef,packId);all.push(...r.levels);reports.push({target:t.label,balls,targetCount,...r,levels:undefined,stats:undefined});
  }
 }
 fs.mkdirSync(path.dirname(abs),{recursive:true});
 const payload={format:'ggrid-level-pack',formatVersion:1,metadata:{metadataVersion:3,id:packId,packId,library:o.publishTest?'generated-test':'generated',levelCount:all.length,contentType:'level-pack',status:'active',access:{entitlement:null,visibility:'public'},generatorVersion:3,seed:o.seed,purpose:o.publishTest?'generator-test':'generated'},levels:all};
 fs.writeFileSync(abs,JSON.stringify(payload)+'\n');if(o.publishTest)writeTestCatalog(abs);
 console.log(JSON.stringify({output:path.relative(root,abs),levels:all.length,targets:o.targets,reports},null,2));
}
main().catch(e=>{console.error(e.stack||e);process.exit(1)});
