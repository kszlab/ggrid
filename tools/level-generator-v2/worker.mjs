import {parentPort,workerData} from 'node:worker_threads';
import {explore,stateAt,allBallsPresent} from './statespace.mjs';
import {randomLayout,rng,fingerprint,familyFingerprint} from './layout.mjs';
import {classifyFast} from './classify-fast.mjs';
import {analyzeState as classifyMulti} from '../classify-multiball-v2.mjs';

const {w,h,balls,seed,minMoves,maxMoves,samplesPerLayout,stateCap,largeShapes,shared}=workerData;
const needed=new Int32Array(shared),rand=rng(seed),seen=new Set();
const stats={layouts:0,exploredStates:0,classified:0,trivial:0,candidates:0,oversize:0,invalidCandidates:0};
let lastReport=Date.now();
const open=()=>{let n=0;for(let d=1;d<=10;d++)if(Atomics.load(needed,d)>0)n++;return n};

while(!Atomics.load(needed,0)&&open()){
 const layout=randomLayout(w,h,rand,{balls,largeShapes});if(!layout)continue;stats.layouts++;
 const r=explore(layout,stateCap);if(!r){stats.oversize++;continue}stats.exploredStates+=r.states.length;
 const byLength=new Map();
 for(let i=0;i<r.dist.length;i++){const d=r.dist[i];if(d>=minMoves&&d<=maxMoves&&allBallsPresent(layout,r.states[i]))(byLength.get(d)??byLength.set(d,[]).get(d)).push(i)}
 const lengths=[...byLength.keys()].sort((a,b)=>a-b);
 const picks=lengths.length<=samplesPerLayout?lengths:Array.from({length:samplesPerLayout},(_,k)=>lengths[Math.min(lengths.length-1,Math.floor((k+rand(1000)/1000)*lengths.length/samplesPerLayout))]);
 const usedClasses=new Set();
 for(const len of new Set(picks)){
  if(Atomics.load(needed,0))break;
  const list=byLength.get(len),s=stateAt(layout,r.states[list[rand(list.length)]]),f=fingerprint(s);if(seen.has(f))continue;seen.add(f);
  let a;try{a=balls===1?classifyFast({id:'candidate',state:s}):classifyMulti(s,{maxStates:70000,riskStates:8000})}catch(_){stats.invalidCandidates++;continue}stats.classified++;
  if(a.status!=='ok'){stats.trivial++;continue}
  if(usedClasses.has(a.difficulty)||Atomics.load(needed,a.difficulty)<=0)continue;
  usedClasses.add(a.difficulty);stats.candidates++;
  parentPort.postMessage({type:'candidate',state:s,analysis:a,fingerprint:f,family:familyFingerprint(s)});
 }
 if(Date.now()-lastReport>2500){parentPort.postMessage({type:'stats',stats:{...stats}});lastReport=Date.now()}
}
parentPort.postMessage({type:'stats',stats:{...stats},done:true});
