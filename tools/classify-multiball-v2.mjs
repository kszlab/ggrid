import fs from 'node:fs';
import {step,validateLevel,stateKey,stateFromRecord} from './multiball-physics.mjs';
import {solveCompact as solveDetailed} from './multiball-compact-solver.mjs';
export const model='puzzle-v3-multiball-anchored-v2';
export const calibration=JSON.parse(fs.readFileSync(new URL('./difficulty-calibration-v2.json',import.meta.url),'utf8'));
const dirs=['up','down','left','right'],clamp=x=>Math.max(0,Math.min(1,x));
const distance=(o,s)=>o.exited?0:Math.abs(o.x-s.exit.x)+Math.abs(o.y-s.exit.y)+1;
// Same geometric route constraint as puzzle-v2, evaluated for each ball with
// the other ball still present. No sampled quantiles or batch-dependent gates.
function directConstraint(s){let count=0,valid=0;
 for(const ball of s.objects.filter(o=>o.type==='ball')){
  const dx=s.exit.x-ball.x,dy=s.exit.y-ball.y;
  function visit(cur,h,v){if(!h&&!v){count++;if(step(cur,s.exit.dir).state.objects.find(o=>o.id===ball.id).exited)valid++;return;}
   if(h)visit(step(cur,dx<0?'left':'right').state,h-1,v);
   if(v)visit(step(cur,dy<0?'up':'down').state,h,v-1);
  }visit(s,Math.abs(dx),Math.abs(dy));
 }return {count,valid,constraint:count?1-valid/count:0};
}
export function analyzeState(s,{maxStates=60000,riskStates=10000,solve=solveDetailed}={}){
 const solveDetailed=solve;
 validateLevel(s);if(s.objects.filter(o=>o.type==='ball').length!==2)return {status:'unsupported_ball_count'};
 const solved=solveDetailed(s,{maxDepth:65,maxStates});
 if(solved.status!=='solved')return {status:solved.status,reason:solved.reason};
 const path=solved.path,L=path.length;
 const bare={...s,objects:s.objects.filter(o=>o.type==='ball')};
 const baseline=solveDetailed(bare,{maxDepth:65,maxStates:10000});
 if(baseline.status!=='solved')return {status:'baseline_'+baseline.status};
 const B=baseline.path.length,detour=L-B;
 let cur=s,turns=0,setup=0,retreat=0,conflict=0,choice=0,forced=0,firstExit=0;
 const states=[];
 for(let i=0;i<L;i++){
  states.push(cur);const possible=dirs.filter(d=>stateKey(step(cur,d).state)!==stateKey(cur));
  choice+=Math.max(0,possible.length-1)/3;if(possible.length===1)forced++;
  if(i&&path[i]!==path[i-1])turns++;
  const next=step(cur,path[i]).state,balls=cur.objects.filter(o=>o.type==='ball'&&!o.exited);
  const delta=balls.map(o=>distance(o,cur)-distance(next.objects.find(n=>n.id===o.id),next));
  if(balls.every(o=>{const n=next.objects.find(n=>n.id===o.id);return !n.exited&&n.x===o.x&&n.y===o.y}))setup++;
  if(delta.reduce((a,b)=>a+b,0)<0)retreat++;
  if(delta.some(x=>x>0)&&delta.some(x=>x<0))conflict++;
  if(!firstExit&&next.objects.some(o=>o.type==='ball'&&o.exited))firstExit=i+1;
  cur=next;
 }
 // Require demonstrable obstacle-dependent work, as well as direction changes.
 if(!turns||detour<=0)return {status:'trivial',metrics:{optimalMoves:L,baselineMoves:B,detourMoves:detour,directionChanges:turns}};
 const direct=directConstraint(s),constraint=direct.constraint;
 let sum=0,count=0,worst=0,unknown=0;
 for(let i=0;i<Math.min(L,5);i++){
  const st=states[i],good=step(st,path[i]).state;
  for(const d of dirs){if(d===path[i])continue;const alt=step(st,d).state;
   if(stateKey(alt)===stateKey(st)||stateKey(alt)===stateKey(good))continue;
   const a=solveDetailed(alt,{maxDepth:65,maxStates:riskStates});
   // An exhausted search is NOT proof of a dead end. Unknowns add no risk.
   let penalty=0;if(a.status==='unsolvable')penalty=1;
   else if(a.status==='solved')penalty=clamp((a.path.length-(L-i-1))/5);
   else unknown++;
   sum+=penalty;count++;worst=Math.max(worst,penalty);
  }
 }
 const solution=clamp(.38*clamp((L-2)/(1.35*(s.width+s.height)))+.36*clamp(turns/5)+.26*clamp((setup+retreat)/3));
 const dependency=clamp(.50*clamp(detour/4)+.35*clamp(setup/3)+.15*constraint);
 const decision=clamp(.6*(choice/L)+.4*constraint);
 const mistakes=count?.6*sum/count+.4*worst:0;
 const uniqueness=clamp(constraint+.2*forced/L);
 const challenge=.45*clamp(detour/2)+.35*clamp(setup)+.2*constraint;
 const raw=+(1+9*((.25*solution+.35*dependency+.15*decision+.15*mistakes+.1*uniqueness)-.24)/.72).toFixed(3);
 return {status:'ok',difficulty:1+calibration[s.width+'x'+s.height].filter(v=>raw>=v).length,raw,model,
  optimalSolution:path,components:{solution,dependency,decision,mistakes,uniqueness},
  metrics:{optimalMoves:L,baselineMoves:B,detourMoves:detour,directionChanges:turns,setupMoves:setup,retreatMoves:retreat,conflictMoves:conflict,firstExitMove:firstExit,secondPhaseMoves:L-firstExit,geometricShortestRoutes:direct.count,feasibleGeometricRoutes:direct.valid,averageAlternatives:choice/L,forcedMoves:forced,mistakeAlternatives:count,unknownMistakeAlternatives:unknown,challengeSignal:challenge,searchedStates:solved.states}};
}
export const classifyRecord=r=>analyzeState(stateFromRecord(r));
