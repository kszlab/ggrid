// GGrid Fast Generator v3 state-space explorer.
// Extends v2 with transition-table reuse and graph-backed solver acceleration.
import {compile,solveDetailed} from '../level-generator-v2/engine.mjs';

export function explore(state,cap=220000){
 const c=compile(state),WIN=-1,states=[c.start],index=new Map([[c.key(c.start),0]]);
 let trans=new Int32Array(Math.max(4,Math.min(cap,4096))*4).fill(-2);
 const ensure=n=>{if(n*4<=trans.length)return;let size=trans.length;while(size<n*4)size=Math.min(cap*4,Math.max(size*2,n*4));const next=new Int32Array(size).fill(-2);next.set(trans);trans=next};
 for(let i=0;i<states.length;i++){
  ensure(i+1);
  for(let d=0;d<4;d++){
   const p=c.advance(states[i],d);
   if(c.won(p)){trans[i*4+d]=WIN;continue}
   const k=c.key(p);let j=index.get(k);
   if(j===undefined){
    if(states.length>=cap)return null;
    j=states.length;index.set(k,j);states.push(p);ensure(states.length);
   }
   trans[i*4+d]=j;
  }
 }
 const n=states.length;trans=trans.slice(0,n*4);
 const head=new Int32Array(n).fill(-1),next=new Int32Array(n*4).fill(-1),dist=new Int32Array(n).fill(-1),queue=[];
 for(let e=0;e<n*4;e++){
  const i=(e/4)|0,j=trans[e];
  if(j===WIN){if(dist[i]<0){dist[i]=1;queue.push(i)}}
  else if(j!==i){next[e]=head[j];head[j]=e}
 }
 for(let qi=0;qi<queue.length;qi++){
  const v=queue[qi];
  for(let e=head[v];e>=0;e=next[e]){
   const u=(e/4)|0;
   if(dist[u]<0){dist[u]=dist[v]+1;queue.push(u)}
  }
 }
 return {c,states,index,trans,dist};
}

export function allBallsPresent(seed,p){
 for(let i=0;i<seed.objects.length;i++)if(seed.objects[i].type==='ball'&&p[i]<0)return false;
 return true;
}
export function activeBalls(seed,p){
 let n=0;for(let i=0;i<seed.objects.length;i++)if(seed.objects[i].type==='ball'&&p[i]>=0)n++;return n;
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

// Equivalent BFS over an already explored layout. Falls back to runtime solver
// when the state is outside the graph or a time budget was requested.
export function graphSolver(seed,r){
 const {c,index,trans}=r,n=r.states.length,w=seed.width,DIRS=['up','down','left','right'];
 const stamp=new Uint32Array(n);let generation=0;
 const queue=new Int32Array(n),parents=new Int32Array(n),dirs=new Int8Array(n),depths=new Int32Array(n);
 function locate(s){
  if(s.width!==seed.width||s.height!==seed.height||s.objects.length!==seed.objects.length||s.exit.x!==seed.exit.x||s.exit.y!==seed.exit.y||s.exit.dir!==seed.exit.dir)return -1;
  const p=new Int16Array(s.objects.length);
  for(let i=0;i<p.length;i++){
   const o=s.objects[i],g=seed.objects[i];
   if(o.type!==g.type||o.cells.length!==g.cells.length||o.cells.some((q,k)=>q.x!==g.cells[k].x||q.y!==g.cells[k].y))return -1;
   p[i]=o.exited?-1:o.x+o.y*w;
  }
  if(c.won(p))return -2;
  return index.get(c.key(p))??-1;
 }
 return function solve(s,{maxDepth=30,maxStates=Infinity,timeBudgetMs=0}={}){
  const start=locate(s);
  if(start===-2)return {status:'solved',path:[],states:1,elapsedMs:0};
  if(start<0||timeBudgetMs>0)return solveDetailed(s,{maxDepth,maxStates,timeBudgetMs});
  generation=(generation+1)>>>0;if(generation===0){stamp.fill(0);generation=1}
  let head=0,tail=0,seen=1,depthLimited=false;
  queue[tail++]=start;parents[start]=-1;depths[start]=0;stamp[start]=generation;
  const route=(v,d)=>{const out=[DIRS[d]];while(parents[v]>=0){out.push(DIRS[dirs[v]]);v=parents[v]}return out.reverse()};
  while(head<tail){
   const v=queue[head++];
   if(depths[v]>=maxDepth){depthLimited=true;continue}
   for(let d=0;d<4;d++){
    const j=trans[v*4+d];
    if(j===-1)return {status:'solved',path:route(v,d),states:seen+1,elapsedMs:0};
    if(stamp[j]===generation)continue;
    if(seen>=maxStates)return {status:'limit',reason:'states',path:null,states:seen,elapsedMs:0};
    stamp[j]=generation;seen++;parents[j]=v;dirs[j]=d;depths[j]=depths[v]+1;queue[tail++]=j;
   }
  }
  return {status:depthLimited?'limit':'unsolvable',reason:depthLimited?'depth':null,path:null,states:seen,elapsedMs:0};
 };
}
