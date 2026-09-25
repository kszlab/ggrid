// GGrid Fast Generator v2 state-space explorer.
import {compile} from './engine.mjs';

export function explore(state,cap=180000){
 const c=compile(state),WIN=-1,states=[c.start],index=new Map([[c.key(c.start),0]]),from=[],to=[];
 for(let i=0;i<states.length;i++){
  for(let d=0;d<4;d++){
   const p=c.advance(states[i],d);
   if(c.won(p)){from.push(i);to.push(WIN);continue}
   const k=c.key(p);let j=index.get(k);
   if(j===undefined){if(states.length>=cap)return null;j=states.length;index.set(k,j);states.push(p)}
   if(j!==i){from.push(i);to.push(j)}
  }
 }
 const n=states.length,dist=new Int32Array(n).fill(-1),head=new Int32Array(n).fill(-1),next=new Int32Array(from.length),queue=[];
 for(let e=0;e<from.length;e++){
  if(to[e]===WIN){if(dist[from[e]]<0){dist[from[e]]=1;queue.push(from[e])}}
  else{next[e]=head[to[e]];head[to[e]]=e}
 }
 for(let qi=0;qi<queue.length;qi++){const v=queue[qi];for(let e=head[v];e>=0;e=next[e]){const u=from[e];if(dist[u]<0){dist[u]=dist[v]+1;queue.push(u)}}}
 return {c,states,dist};
}
export function allBallsPresent(seed,p){
 for(let i=0;i<seed.objects.length;i++)if(seed.objects[i].type==='ball'&&p[i]<0)return false;
 return true;
}
export function stateAt(seed,p){
 const s=structuredClone(seed);
 s.objects.forEach((o,i)=>{
  if(p[i]<0){o.exited=true;o.x=-1;o.y=-1}
  else{o.exited=false;o.x=p[i]%s.width;o.y=(p[i]-o.x)/s.width}
 });
 s.won=s.objects.filter(o=>o.type==='ball').every(o=>o.exited);
 return s;
}
