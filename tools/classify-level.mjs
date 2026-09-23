#!/usr/bin/env node
/* Offline GGrid difficulty estimator v1. Uses the game's own step() physics. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const context=vm.createContext({structuredClone});
vm.runInContext(fs.readFileSync(path.join(root,'js/game-core.js'),'utf8')+'\nthis.physics={step,validateLevel,stateKey:s=>s.objects.map(o=>`${o.id}:${o.exited?"X":o.x+","+o.y}`).join("|")}',context);
const {step,validateLevel,stateKey}=context.physics;
const directions=['up','down','left','right'];
const letter={U:'up',D:'down',L:'left',R:'right'};
const clamp=(x,lo=0,hi=1)=>Math.max(lo,Math.min(hi,x));
const MAX_STATES=50000,MAX_DEPTH=40;
let calibration={};try{calibration=JSON.parse(fs.readFileSync(path.join(root,'tools/difficulty-calibration-v2.json'),'utf8'))}catch(_){}

function builtins(){
 vm.runInContext(fs.readFileSync(path.join(root,'content/levels/test-library-v1.js'),'utf8')+'\nthis.rows=GGRID_TEST_LEVELS_V2',context);
 return context.rows.map(r=>({id:r.id,state:{width:r.w,height:r.h,exit:{dir:letter[r.e[0]],x:r.e[1],y:r.e[2]},objects:r.o.map((p,i)=>({id:p[0]==='B'?'ball1':`${p[0]}${i}`,type:p[0]==='B'?'ball':p[0]==='W'?'wall':'brick',x:p[1],y:p[2],cells:p[3].map(([x,y])=>({x,y}))})),moves:0,won:false},storedClass:r.d,storedRaw:r.raw}));
}
function fromJson(file){
 const d=JSON.parse(fs.readFileSync(file,'utf8'));
 if(d.format==='ggrid-level-pack')return d.levels.map((r,i)=>fromRecord(r,i));
 return [fromRecord(d,0)];
}
function fromRecord(r,i){
 const board=r.board||r.state||r,exit=board.exit||r.exit,entities=r.entities||r.objects||r.state?.objects;
 if(!board.width||!board.height||!exit||!Array.isArray(entities))throw Error('Expected Level Data Model v2 or a game state');
 if((r.initialResources?.freeze||0)>0||r.requires?.features?.includes('ability.freeze'))throw Error('Freeze-dependent levels need a resource-aware solver; this classifier is freeze-free');
 return {id:r.levelId||r.id||path.basename(process.argv[2])+':'+i,state:{width:board.width,height:board.height,exit:{dir:exit.dir||exit.direction,x:exit.x,y:exit.y},objects:entities.map((e,j)=>({id:e.id||'object'+j,type:e.type==='rigid-body'?'brick':e.type,x:e.position?.x??e.x,y:e.position?.y??e.y,cells:e.properties?.cells||e.cells||[{x:0,y:0}]})),moves:0,won:false}};
}
function shortest(start,maxStates=MAX_STATES){
 const initial=structuredClone(start);initial.moves=0;
 if(initial.objects.every(o=>o.type!=='ball'||o.exited))return {path:[],states:1};
 const queue=[{s:initial,path:[]}],seen=new Set([stateKey(initial)]);
 let depthLimited=false;
 for(let i=0;i<queue.length;i++){
  const {s,path:p}=queue[i];if(p.length>=MAX_DEPTH){depthLimited=true;continue}
  for(const dir of directions){const next=step(s,dir).state,k=stateKey(next);if(seen.has(k))continue;
   const route=[...p,dir];if(next.won)return {path:route,states:seen.size+1};
   seen.add(k);if(seen.size>maxStates)return {error:'search_limit',states:seen.size};
   queue.push({s:next,path:route});
  }
 }
 return {error:depthLimited?'search_limit':'unsolvable',states:seen.size};
}
function directRoutes(s){
 const ball=s.objects.find(o=>o.type==='ball'&&!o.exited);
 if(!ball)return {count:0,valid:0,baseline:0};
 const dx=s.exit.x-ball.x,dy=s.exit.y-ball.y;
 const horizontal=Array(Math.abs(dx)).fill(dx<0?'left':'right');
 const vertical=Array(Math.abs(dy)).fill(dy<0?'up':'down');
 const routes=[];
 function make(h,v,p){if(routes.length>4000)throw Error('Too many geometric shortest routes (>4000)');if(!h.length&&!v.length){routes.push([...p,s.exit.dir]);return}if(h.length)make(h.slice(1),v,[...p,h[0]]);if(v.length)make(h,v.slice(1),[...p,v[0]])}
 make(horizontal,vertical,[]);
 let valid=0;
 for(const route of routes){let cur=s;for(const dir of route)cur=step(cur,dir).state;if(cur.won)valid++}
 return {count:routes.length,valid,baseline:Math.abs(dx)+Math.abs(dy)+1};
}
function metrics(s,route){
 const ballId=s.objects.find(o=>o.type==='ball')?.id;let cur=structuredClone(s),turns=0,setup=0,retreat=0,choice=0,forced=0,prevDistance=null;
 function distance(x){const b=x.objects.find(o=>o.id===ballId);return b?.exited?0:Math.abs(b.x-x.exit.x)+Math.abs(b.y-x.exit.y)+1}
 prevDistance=distance(cur);
 for(let i=0;i<route.length;i++){
  const before=cur,possible=directions.filter(dir=>stateKey(step(before,dir).state)!==stateKey(before));
  choice+=Math.max(0,possible.length-1)/3;if(possible.length===1)forced++;
  if(i&&route[i]!==route[i-1])turns++;
  cur=step(before,route[i]).state;
  const prior=before.objects.find(o=>o.id===ballId),after=cur.objects.find(o=>o.id===ballId);
  if(!after.exited&&after.x===prior.x&&after.y===prior.y)setup++;
  else if(distance(cur)>prevDistance)retreat++;
  prevDistance=distance(cur);
 }
 return {turns,setup,retreat,averageAlternatives:+(choice/route.length).toFixed(3),forcedMoves:forced};
}
function mistakeRisk(s,route){
 let cur=structuredClone(s),sum=0,count=0,worst=0;
 const checked=Math.min(route.length,5);
 for(let i=0;i<checked;i++){
  const good=step(cur,route[i]).state,remaining=route.length-i-1;
  for(const dir of directions){if(dir===route[i])continue;
   const alt=step(cur,dir).state;if(stateKey(alt)===stateKey(cur)||stateKey(alt)===stateKey(good))continue;
   const found=shortest(alt,1800);
   const penalty=found.error?1:clamp((1+found.path.length-(1+remaining))/5);
   sum+=penalty;count++;worst=Math.max(worst,penalty);
  }
  cur=good;
 }
 return {risk:count?.6*sum/count+.4*worst:0,examinedAlternatives:count};
}
function classify(entry){
 const s=entry.state;validateLevel(s);
 if(s.objects.filter(o=>o.type==='ball').length!==1)throw Error('This classifier supports exactly one ball');
 const solved=shortest(s);if(solved.error)return {levelId:entry.id,status:solved.error,searchedStates:solved.states};
 const route=solved.path,{turns,setup,retreat,averageAlternatives,forcedMoves}=metrics(s,route);
 const direct=directRoutes(s),detour=route.length-direct.baseline;
 const routeConstraint=direct.count?1-direct.valid/direct.count:0;
 const risk=mistakeRisk(s,route);
 // An obstacle is causally necessary when removing it creates a shorter route.
 // A level with no setup or detour remains a geometric navigation problem.
 const baselineSize=s.width+s.height;
 const solution=clamp(.38*clamp((route.length-2)/(1.35*baselineSize))+.36*clamp(turns/5)+.26*clamp((setup+retreat)/3));
 const dependency=clamp(.50*clamp(detour/4)+.35*clamp(setup/3)+.15*routeConstraint);
 const decision=clamp(.6*averageAlternatives+.4*routeConstraint);
 const mistakes=risk.risk;
 const uniqueness=clamp(routeConstraint+.2*(forcedMoves/route.length));
 const challenge=.45*clamp(detour/2)+.35*clamp(setup)+.20*routeConstraint;
 const score=.25*solution+.35*dependency+.15*decision+.15*mistakes+.10*uniqueness;
 const raw=1+9*(score-.24)/.72,size=s.width+'x'+s.height,limits=calibration[size];
 const grade=Array.isArray(limits)&&limits.length===9?1+limits.filter(boundary=>raw>=boundary).length:clamp(Math.round(raw),1,10);
 const measured={optimalMoves:route.length,baselineMoves:direct.baseline,detourMoves:detour,directionChanges:turns,setupMoves:setup,retreatMoves:retreat,geometricShortestRoutes:direct.count,feasibleGeometricRoutes:direct.valid,averageAlternatives,forcedMoves,searchedStates:solved.states,mistakeAlternatives:risk.examinedAlternatives,challengeSignal:+challenge.toFixed(4)};
 if(challenge<.08)return {levelId:entry.id,status:'trivial',raw:+raw.toFixed(3),metrics:measured,optimalSolution:route,model:'puzzle-v2'};
 return {levelId:entry.id,status:'ok',difficulty:grade,raw:+raw.toFixed(3),
  metrics:measured,
  components:{solution:+solution.toFixed(3),dependency:+dependency.toFixed(3),decision:+decision.toFixed(3),mistakes:+mistakes.toFixed(3),uniqueness:+uniqueness.toFixed(3)},
  optimalSolution:route,priorClass:entry.storedClass??null,priorRaw:entry.storedRaw??null,model:'puzzle-v2'};
}
export {builtins,classify};
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const input=process.argv[2];if(!input){console.error('Usage: node tools/classify-level.mjs LEVEL_ID | level.json | --all [--json]');process.exit(2)}
 const entries=input==='--all'||input.startsWith('LF2-')?builtins():fromJson(input);
 const selected=input==='--all'?entries:input.startsWith('LF2-')?entries.filter(e=>e.id===input):entries;
 if(!selected.length){console.error('Level not found:',input);process.exit(2)}
 const results=selected.map(classify);
 if(process.argv.includes('--json'))console.log(JSON.stringify(results.length===1?results[0]:results,null,2));
 else for(const r of results)console.log(`${r.levelId}: ${r.status==='ok'?`D${r.difficulty} (raw ${r.raw}, old D${r.priorClass??'?'}) · ${r.metrics.optimalMoves} moves, detour ${r.metrics.detourMoves}, setup ${r.metrics.setupMoves}`:r.status}`);
 if(results.some(r=>r.status!=='ok'))process.exitCode=1;
}
