#!/usr/bin/env node
/* GGrid Fast Generator v2.
   Examples:
   node tools/generate-levels-v2.mjs --target "100@5x8:D1-D10:B1,B2"
   node tools/generate-levels-v2.mjs --target "100@5x8:D1-D10:B1" --target "100@4x8:D1-D10:B1,B2"
   node tools/generate-levels-v2.mjs --size 5x8 --classes 1-10 --balls 1,2 --count 100
*/
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {Worker} from 'node:worker_threads';
import {root,step,validateLevel,solveDetailed,readJson} from './level-generator-v2/engine.mjs';
import {fingerprint,libraryFingerprints,toRecord} from './level-generator-v2/layout.mjs';

function parseRange(txt,prefix=''){
 const out=new Set();
 for(const raw of String(txt).split(',')){const part=raw.toUpperCase().split(String(prefix).toUpperCase()).join('');const [a,b]=part.split('-').map(Number);for(let x=a;x<=(b||a);x++)out.add(x)}
 return [...out].filter(Number.isFinite).sort((a,b)=>a-b);
}
function parseTarget(txt){
 const m=String(txt).match(/^(\d+)@(\d+)x(\d+):D([0-9D,-]+):B([0-9B,]+)$/i);
 if(!m)throw Error('Invalid --target '+txt+'; expected e.g. 100@5x8:D1-D10:B1,B2');
 const count=+m[1],w=+m[2],h=+m[3],classes=parseRange(m[4],'D'),balls=parseRange(m[5],'B');
 return {count,w,h,classes,balls,label:txt};
}
function parseArgs(argv){
 const o={targets:[],size:null,classes:'1-10',balls:'1',count:100,minutes:5,workers:Math.max(1,Math.min(4,os.availableParallelism?.()||os.cpus().length)),seed:1,out:null,idPrefix:'FG2',minMoves:3,maxMoves:65,samples:18,stateCap:180000,largeShapes:'auto',familyCap:2,publishTest:false,quiet:false};
 for(let i=2;i<argv.length;i++){const a=argv[i],v=()=>argv[++i];
  if(a==='--target')o.targets.push(parseTarget(v()));else if(a==='--size')o.size=v();else if(a==='--classes')o.classes=v();else if(a==='--balls')o.balls=v();else if(a==='--count')o.count=+v();
  else if(a==='--minutes')o.minutes=+v();else if(a==='--workers')o.workers=+v();else if(a==='--seed')o.seed=+v();else if(a==='--out')o.out=v();else if(a==='--id-prefix')o.idPrefix=v();
  else if(a==='--min-moves')o.minMoves=+v();else if(a==='--max-moves')o.maxMoves=+v();else if(a==='--samples-per-layout')o.samples=+v();else if(a==='--state-cap')o.stateCap=+v();
  else if(a==='--large-shapes')o.largeShapes=v();else if(a==='--family-cap')o.familyCap=+v();else if(a==='--publish-test')o.publishTest=true;else if(a==='--quiet')o.quiet=true;else if(a==='--help'||a==='-h')o.help=true;else throw Error('Unknown option '+a);
 }
 if(!['auto','on','off'].includes(o.largeShapes))throw Error('--large-shapes must be auto|on|off');
 if(!o.targets.length&&o.size)o.targets.push({count:o.count,w:+o.size.split('x')[0],h:+o.size.split('x')[1],classes:parseRange(o.classes),balls:parseRange(o.balls),label:'legacy-options'});
 return o;
}
const HELP=`GGrid Fast Generator v2

  --target "100@5x8:D1-D10:B1,B2"   total target count, board, classes, ball counts
  --target may be repeated
  --size 5x8 --classes 1-10 --balls 1,2 --count 100   equivalent simple form
  --minutes 5            time limit for each size/ball-count job
  --workers N            default min(4, CPU cores)
  --state-cap 180000     per-worker memory guard
  --large-shapes auto|on|off   4-6 cell rigid bodies; auto enables them on larger boards
  --family-cap 2         maximum accepted starts from the same structural family
  --seed 1               base seed; use --workers 1 for fully repeatable output
  --out FILE             output pack
  --publish-test         write under content/levels/generated-test/packs and register in test catalog
`;
const log=(o,...m)=>{if(!o.quiet)console.error(...m)};

function quotas(count,classes){
 const q=new Map(classes.map(d=>[d,Math.floor(count/classes.length)])),rem=count%classes.length;
 for(let i=0;i<rem;i++)q.set(classes[i],q.get(classes[i])+1);return q;
}
function verify(s,a){
 try{validateLevel(s);let cur=s;for(const dir of a.optimalSolution){if(cur.won)return false;cur=step(cur,dir).state}if(!cur.won)return false;
  const best=solveDetailed(s,{maxDepth:Math.max(70,a.optimalSolution.length+2),maxStates:2e6});return best.status==='solved'&&best.path.length===a.optimalSolution.length;
 }catch(_){return false}
}
async function generateJob(o,t,balls,targetCount,excluded,families,usedIds,seqRef,packId){
 const shared=new SharedArrayBuffer(4*11),needed=new Int32Array(shared),q=quotas(targetCount,t.classes);
 for(const [d,n] of q)needed[d]=n;
 const accepted=[],perWorker=new Map(),rejected={duplicate:0,family:0,classFull:0,verification:0},started=Date.now();
 const workers=Array.from({length:o.workers},(_,i)=>new Worker(new URL('./level-generator-v2/worker.mjs',import.meta.url),{workerData:{w:t.w,h:t.h,balls,seed:o.seed*10000+t.w*100+t.h*10+balls*1000+i,minMoves:o.minMoves,maxMoves:o.maxMoves,samplesPerLayout:o.samples,stateCap:o.stateCap,largeShapes:o.largeShapes,shared}}));
 const remaining=()=>t.classes.reduce((n,d)=>n+Math.max(0,Atomics.load(needed,d)),0);
 await new Promise(resolve=>{
  let finished=0;const timer=setTimeout(()=>Atomics.store(needed,0,1),o.minutes*60000),progress=setInterval(()=>log(o,`  ${t.w}x${t.h} B${balls} · accepted ${accepted.length} · need ${remaining()}`),10000);
  workers.forEach((wk,i)=>{wk.on('message',m=>{if(m.type==='stats'){perWorker.set(i,m.stats);return}
    const d=m.analysis.difficulty;if(excluded.has(m.fingerprint)){rejected.duplicate++;return}if((families.get(m.family)||0)>=o.familyCap){rejected.family++;return}
    if(Atomics.load(needed,d)<=0){rejected.classFull++;return}if(!verify(m.state,m.analysis)){rejected.verification++;return}
    excluded.add(m.fingerprint);families.set(m.family,(families.get(m.family)||0)+1);Atomics.sub(needed,d,1);
    let id;do id=`${o.idPrefix}-${t.w}X${t.h}-B${balls}-${String(++seqRef.n).padStart(5,'0')}`;while(usedIds.has(id));usedIds.add(id);
    accepted.push(toRecord(m.state,m.analysis,id,{tool:'tools/generate-levels-v2.mjs',version:2,seed:o.seed,method:'state-space-reverse-bfs',largeShapes:o.largeShapes},{packId,familyId:m.family,noveltyScore:1/(1+(families.get(m.family)||1)-1),library:o.publishTest?'generated-test':'generated'}));
    if(remaining()===0)Atomics.store(needed,0,1);
   });wk.on('error',e=>{console.error(e);Atomics.store(needed,0,1)});wk.on('exit',()=>{if(++finished===workers.length){clearTimeout(timer);clearInterval(progress);resolve()}})});
 });
 return {levels:accepted,seconds:Math.round((Date.now()-started)/1000),coverage:Object.fromEntries(t.classes.map(d=>['D'+d,accepted.filter(l=>l.difficulty.class===d).length])),rejected,stats:[...perWorker.values()]};
}
function writeTestCatalog(abs){
 const dir=path.join(root,'content/levels/generated-test'),catFile=path.join(dir,'catalog.json');fs.mkdirSync(dir,{recursive:true});
 let cat={format:'ggrid-level-catalog',formatVersion:1,description:'Fast Generator v2 isolated test library',packs:[]};
 try{cat=JSON.parse(fs.readFileSync(catFile,'utf8'))}catch(_){}
 const src=path.relative(dir,abs).split(path.sep).join('/'),id=path.basename(abs,'.json');
 cat.packs=cat.packs.filter(p=>p.id!==id&&p.src!==src);cat.packs.push({id,src});
 fs.writeFileSync(catFile,JSON.stringify(cat,null,2)+'\n');
}
async function main(){
 const o=parseArgs(process.argv);if(o.help||!o.targets.length){console.log(HELP);process.exit(o.help?0:2)}
 const excluded=libraryFingerprints(),families=new Map(),usedIds=new Set(),seqRef={n:0},all=[],reports=[],multiballSizes=new Set(['3x3','4x4','5x5','5x6','5x7','5x8']);
 for(const t of o.targets){
  if(t.w<3||t.h<3||t.w>8||t.h>8)throw Error('First test version supports board dimensions 3..8');
  for(let bi=0;bi<t.balls.length;bi++){const balls=t.balls[bi];if(![1,2].includes(balls))throw Error('First test version supports B1 and B2 only');if(balls===2&&!multiballSizes.has(t.w+'x'+t.h))throw Error('B2 difficulty is not calibrated for '+t.w+'x'+t.h+' yet; use B1 or a calibrated multiball size');
   const targetCount=Math.floor(t.count/t.balls.length)+(bi<t.count%t.balls.length?1:0),packId=`${o.idPrefix.toLowerCase()}-${t.w}x${t.h}-b${balls}-s${o.seed}`,r=await generateJob(o,t,balls,targetCount,excluded,families,usedIds,seqRef,packId);all.push(...r.levels);reports.push({target:t.label,balls,targetCount,...r,levels:undefined,stats:undefined})}
 }
 const tag=o.targets.length===1?`${o.targets[0].w}x${o.targets[0].h}`:'mixed';
 let out=o.out||path.join('generated-levels',`${o.idPrefix.toLowerCase()}-${tag}-s${o.seed}.json`);
 if(o.publishTest&&!o.out)out=path.join('content/levels/generated-test/packs',`${o.idPrefix.toLowerCase()}-${tag}-s${o.seed}.json`);
 const abs=path.resolve(root,out);fs.mkdirSync(path.dirname(abs),{recursive:true});
 const payload={format:'ggrid-level-pack',formatVersion:1,metadata:{id:path.basename(abs,'.json'),generatorVersion:2,seed:o.seed,access:{entitlement:null},purpose:o.publishTest?'generator-test':'generated'},levels:all};
 fs.writeFileSync(abs,JSON.stringify(payload)+'\n');if(o.publishTest)writeTestCatalog(abs);
 console.log(JSON.stringify({output:path.relative(root,abs),levels:all.length,targets:o.targets,reports},null,2));
}
main().catch(e=>{console.error(e.stack||e);process.exit(1)});
