// GGrid Fast Generator v3 worker.
// Hybrid state-space + direct local search with adaptive strategy selection.
import {parentPort,workerData} from 'node:worker_threads';
import {explore,stateAt,activeBalls,graphSolver} from './statespace.mjs';
import {randomLayoutV3,mutateLayoutV3,rng,fingerprint,familyFingerprint} from './layout.mjs';
import {classifyFast} from '../level-generator-v2/classify-fast.mjs';
import {step,solveDetailed} from '../level-generator-v2/engine.mjs';

const {
 w,h,balls,seed,minMoves,maxMoves,samplesPerLayout,stateCap,largeShapesMode,
 shared,eliteSeeds=[],strategyMode='auto'
}=workerData;
const {analyzeState}=balls===2?await import('../classify-multiball-v2.mjs'):{};
const needed=new Int32Array(shared),rand=rng(seed),seen=new Set(),DIRS=['up','down','left','right'];
const stats={layouts:0,exploredStates:0,classified:0,trivial:0,candidates:0,oversize:0,invalidCandidates:0,strategies:{}};
let lastReport=Date.now();
const isOpen=d=>Atomics.load(needed,d)>0;
const openClasses=()=>{let n=0;for(let d=1;d<=10;d++)if(isOpen(d))n++;return n};

function classify(s,solve=null){
 let a;try{
  a=balls===2?analyzeState(s,{maxStates:70000,riskStates:8000,solve:solve||solveDetailed}):classifyFast({id:'candidate',state:s});
 }catch(_){stats.invalidCandidates++;return null}
 stats.classified++;if(a.status!=='ok')stats.trivial++;return a;
}
const elites=[],ELITES=32;
function remember(s,raw){
 if(!Number.isFinite(raw))return;
 if(elites.length>=ELITES&&raw<=elites[elites.length-1].raw)return;
 elites.push({s:structuredClone(s),raw});elites.sort((a,b)=>b.raw-a.raw);if(elites.length>ELITES)elites.pop();
}
for(const e of eliteSeeds)remember(e.state,e.raw);

function offer(s,a,used=null){
 if(!a||a.status!=='ok')return false;
 remember(s,a.raw);
 if(used?.has(a.difficulty)||!isOpen(a.difficulty))return false;
 used?.add(a.difficulty);stats.candidates++;
 parentPort.postMessage({type:'candidate',state:s,analysis:a,fingerprint:fingerprint(s),family:familyFingerprint(s)});
 return true;
}

const seenByLength=new Map();
function learn(length,cls){(seenByLength.get(length)??seenByLength.set(length,new Int32Array(11)).get(length))[cls]++}
function weight(length){
 const hist=seenByLength.get(length);if(!hist)return 1;
 let total=0,open=0;for(let d=0;d<=10;d++){total+=hist[d];if(d&&isOpen(d))open+=hist[d]}
 return (open+.5)/(total+1);
}
function pickWeighted(items,weights){
 let total=weights.reduce((a,b)=>a+b,0);if(total<=0)return 0;
 let r=(rand(1e6)/1e6)*total,i=0;while(i<items.length-1&&(r-=weights[i])>0)i++;return i;
}
function chooseLengths(lengths){
 const pool=[...lengths],ws=pool.map(weight),out=[];
 while(out.length<samplesPerLayout&&pool.length){const k=pickWeighted(pool,ws);out.push(pool[k]);pool.splice(k,1);ws.splice(k,1)}
 return out;
}

function spaceStrategy(styleName){
 const layout=randomLayoutV3(w,h,rand,{balls,largeShapesMode,styleName});if(!layout)return 0;
 stats.layouts++;
 const r=explore(layout,stateCap);if(!r){stats.oversize++;return 0}
 stats.exploredStates+=r.states.length;
 const byLength=new Map();
 for(let i=0;i<r.dist.length;i++){
  const d=r.dist[i];
  if(d>=minMoves&&d<=maxMoves&&activeBalls(layout,r.states[i])===balls)(byLength.get(d)??byLength.set(d,[]).get(d)).push(i);
 }
 if(!byLength.size)return 0;
 const used=new Set(),solve=balls===2?graphSolver(layout,r):null;let hits=0;
 for(const len of chooseLengths([...byLength.keys()])){
  if(Atomics.load(needed,0))break;
  const list=byLength.get(len),s=stateAt(layout,r.states[list[rand(list.length)]]),f=fingerprint(s);
  if(seen.has(f))continue;seen.add(f);
  const a=classify(s,solve);learn(len,a?.status==='ok'?a.difficulty:0);
  if(offer(s,a,used))hits++;
 }
 return hits;
}
function directStrategy(mode){
 let s;
 if(mode==='mutate'){
  if(!elites.length)return 0;
  s=mutateLayoutV3(elites[rand(elites.length)].s,rand,{balls,largeShapesMode,aggressive:true});
 }else{
  s=randomLayoutV3(w,h,rand,{balls,largeShapesMode,styleName:mode==='hard'?'hardMulti':'open'});
 }
 if(!s)return 0;
 stats.layouts++;
 for(let k=rand(7);k-->0;){
  const x=step(s,DIRS[rand(4)]).state;
  if(x.objects.some(o=>o.type==='ball'&&o.exited))break;
  s={...x,moves:0,won:false};
 }
 const f=fingerprint(s);if(seen.has(f))return 0;seen.add(f);
 return offer(s,classify(s),null)?1:0;
}

const STRATEGIES=balls===2?{
 'space-mixed':()=>spaceStrategy('mixed'),
 'space-walled':()=>spaceStrategy('walled'),
 'direct-open':()=>directStrategy('open'),
 'direct-hard':()=>directStrategy('hard'),
 'direct-mutate':()=>directStrategy('mutate')
}:{
 'space-mixed':()=>spaceStrategy('mixed'),
 'space-walled':()=>spaceStrategy('walled')
};
const names=Object.keys(STRATEGIES),perf=Object.fromEntries(names.map(k=>[k,{ms:1,hits:0}]));
function chooseStrategy(){
 if(strategyMode!=='auto'&&STRATEGIES[strategyMode])return strategyMode;
 const highOpen=[8,9,10].some(isOpen);
 const rates=names.map(k=>{
  let rate=(perf[k].hits+.5)/(perf[k].ms/1000+5);
  if(highOpen&&balls===2&&k==='direct-mutate')rate*=2.6;
  if(highOpen&&balls===2&&k==='direct-hard')rate*=1.8;
  return rate;
 });
 const top=Math.max(...rates);return names[pickWeighted(names,rates.map(r=>Math.max(r,top*.08)))];
}

while(!Atomics.load(needed,0)&&openClasses()){
 const name=chooseStrategy(),t=Date.now(),hits=STRATEGIES[name]();
 const p=perf[name];p.ms+=Date.now()-t;p.hits+=hits;
 if(p.ms>60000){p.ms/=2;p.hits/=2}
 stats.strategies[name]=(stats.strategies[name]||0)+1;
 if(Date.now()-lastReport>2000){parentPort.postMessage({type:'stats',stats:structuredClone(stats)});lastReport=Date.now()}
}
parentPort.postMessage({type:'stats',stats:structuredClone(stats),done:true});
