// Fast Generator v2 single-ball classifier: exact puzzle-v2 port.
import {compile,DIRECTIONS,validateLevel,readJson} from './engine.mjs';
const clamp=(x,lo=0,hi=1)=>Math.max(lo,Math.min(hi,x));
const MAX_STATES=50000,MAX_DEPTH=40,MISTAKE_STATES=1800;
let calibration={};try{calibration=readJson('tools/difficulty-calibration-v2.json')}catch(_){}
function shortest(c,start,maxStates=MAX_STATES){
 if(c.won(start))return {path:[],states:1};
 const queue=[start],parents=[-1],dirs=[-1],depths=[0],seen=new Set([c.key(start)]);let depthLimited=false;
 const route=(i,d)=>{const out=[DIRECTIONS[d]];while(parents[i]>=0){out.push(DIRECTIONS[dirs[i]]);i=parents[i]}return out.reverse()};
 for(let i=0;i<queue.length;i++){
  if(depths[i]>=MAX_DEPTH){depthLimited=true;continue}
  for(let d=0;d<4;d++){
   const next=c.advance(queue[i],d),k=c.key(next);if(seen.has(k))continue;
   if(c.won(next))return {path:route(i,d),states:seen.size+1};
   seen.add(k);if(seen.size>maxStates)return {error:'search_limit',states:seen.size};
   queue.push(next);parents.push(i);dirs.push(d);depths.push(depths[i]+1);
  }
 }
 return {error:depthLimited?'search_limit':'unsolvable',states:seen.size};
}
const dirIndex=d=>DIRECTIONS.indexOf(d);
function directRoutes(s,c){
 const ball=s.objects.find(o=>o.type==='ball'&&!o.exited);if(!ball)return {count:0,valid:0,baseline:0};
 const dx=s.exit.x-ball.x,dy=s.exit.y-ball.y,horizontal=Array(Math.abs(dx)).fill(dx<0?'left':'right'),vertical=Array(Math.abs(dy)).fill(dy<0?'up':'down'),routes=[];
 function make(h,v,p){if(routes.length>4000)throw Error('Too many shortest routes');if(!h.length&&!v.length){routes.push([...p,s.exit.dir]);return}if(h.length)make(h.slice(1),v,[...p,h[0]]);if(v.length)make(h,v.slice(1),[...p,v[0]])}
 make(horizontal,vertical,[]);let valid=0;
 for(const route of routes){let cur=c.start;for(const dir of route)cur=c.advance(cur,dirIndex(dir));if(c.won(cur))valid++}
 return {count:routes.length,valid,baseline:Math.abs(dx)+Math.abs(dy)+1};
}
function metrics(s,c,ballIndex,route){
 const w=s.width,ex=s.exit.x,ey=s.exit.y,distance=p=>p[ballIndex]<0?0:Math.abs(p[ballIndex]%w-ex)+Math.abs(Math.floor(p[ballIndex]/w)-ey)+1;
 let cur=c.start,turns=0,setup=0,retreat=0,choice=0,forced=0,prevDistance=distance(cur);
 for(let i=0;i<route.length;i++){
  const before=cur,beforeKey=c.key(before),possible=DIRECTIONS.filter((_,d)=>c.key(c.advance(before,d))!==beforeKey);
  choice+=Math.max(0,possible.length-1)/3;if(possible.length===1)forced++;
  if(i&&route[i]!==route[i-1])turns++;
  cur=c.advance(before,dirIndex(route[i]));
  if(cur[ballIndex]>=0&&cur[ballIndex]===before[ballIndex])setup++;else if(distance(cur)>prevDistance)retreat++;prevDistance=distance(cur);
 }
 return {turns,setup,retreat,averageAlternatives:+(choice/route.length).toFixed(3),forcedMoves:forced};
}
function mistakeRisk(c,route){
 let cur=c.start,sum=0,count=0,worst=0;
 for(let i=0;i<Math.min(route.length,5);i++){
  const good=c.advance(cur,dirIndex(route[i])),remaining=route.length-i-1,curKey=c.key(cur),goodKey=c.key(good);
  for(let d=0;d<4;d++){if(DIRECTIONS[d]===route[i])continue;const alt=c.advance(cur,d),altKey=c.key(alt);if(altKey===curKey||altKey===goodKey)continue;
   const found=shortest(c,alt,MISTAKE_STATES),penalty=found.error?1:clamp((1+found.path.length-(1+remaining))/5);sum+=penalty;count++;worst=Math.max(worst,penalty)}
  cur=good;
 }
 return {risk:count?.6*sum/count+.4*worst:0,examinedAlternatives:count};
}
export function classifyFast(entry){
 const s=entry.state;validateLevel(s);const balls=s.objects.filter(o=>o.type==='ball');if(balls.length!==1)throw Error('single-ball classifier only');
 const c=compile(s),ballIndex=s.objects.indexOf(balls[0]),solved=shortest(c,c.start);if(solved.error)return {levelId:entry.id,status:solved.error,searchedStates:solved.states};
 const route=solved.path,{turns,setup,retreat,averageAlternatives,forcedMoves}=metrics(s,c,ballIndex,route),direct=directRoutes(s,c),detour=route.length-direct.baseline;
 const routeConstraint=direct.count?1-direct.valid/direct.count:0,risk=mistakeRisk(c,route),baselineSize=s.width+s.height;
 const solution=clamp(.38*clamp((route.length-2)/(1.35*baselineSize))+.36*clamp(turns/5)+.26*clamp((setup+retreat)/3));
 const dependency=clamp(.50*clamp(detour/4)+.35*clamp(setup/3)+.15*routeConstraint),decision=clamp(.6*averageAlternatives+.4*routeConstraint),mistakes=risk.risk,uniqueness=clamp(routeConstraint+.2*(forcedMoves/route.length)),challenge=.45*clamp(detour/2)+.35*clamp(setup)+.20*routeConstraint;
 const score=.25*solution+.35*dependency+.15*decision+.15*mistakes+.10*uniqueness,raw=1+9*(score-.24)/.72,size=s.width+'x'+s.height,limits=calibration[size];
 const grade=Array.isArray(limits)&&limits.length===9?1+limits.filter(boundary=>raw>=boundary).length:Math.max(1,Math.min(10,Math.round(raw)));
 const measured={optimalMoves:route.length,baselineMoves:direct.baseline,detourMoves:detour,directionChanges:turns,setupMoves:setup,retreatMoves:retreat,geometricShortestRoutes:direct.count,feasibleGeometricRoutes:direct.valid,averageAlternatives,forcedMoves,searchedStates:solved.states,mistakeAlternatives:risk.examinedAlternatives,challengeSignal:+challenge.toFixed(4)};
 if(challenge<.08)return {levelId:entry.id,status:'trivial',raw:+raw.toFixed(3),metrics:measured,optimalSolution:route,model:'puzzle-v2'};
 return {levelId:entry.id,status:'ok',difficulty:grade,raw:+raw.toFixed(3),metrics:measured,components:{solution:+solution.toFixed(3),dependency:+dependency.toFixed(3),decision:+decision.toFixed(3),mistakes:+mistakes.toFixed(3),uniqueness:+uniqueness.toFixed(3)},optimalSolution:route,model:'puzzle-v2'};
}
