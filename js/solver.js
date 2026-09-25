/* ===== SOLVER =====
   v0.12.96: bounded detailed search + interchangeable-ball state keys.
   solve() remains backward compatible for offline tools and Freeze analysis. */
function solverNow(){return globalThis.performance?.now?.()??Date.now()}
function stateKey(s){
 const balls=s.objects.filter(o=>o.type==='ball');
 const activeBalls=balls.filter(o=>!o.exited).map(o=>{
  const shape=(o.cells||[{x:0,y:0}]).map(c=>c.x+','+c.y).sort().join(';');
  return o.x+','+o.y+'@'+shape;
 }).sort();
 const exitedBalls=balls.length-activeBalls.length;
 const others=s.objects.filter(o=>o.type!=='ball').map(o=>`${o.id}:${o.exited?'X':o.x+','+o.y}`).join('|');
 return `${s.width}x${s.height}@${s.exit.x},${s.exit.y},${s.exit.dir}|B:${exitedBalls}:${activeBalls.join('/')}${others?'|'+others:''}`;
}
function solverPath(node){
 const out=[];for(let n=node;n?.parent;n=n.parent)out.push(n.dir);
 return out.reverse();
}
function solveDetailedLegacy(initial,{maxDepth=30,maxStates=Infinity,timeBudgetMs=0}={}){
 const started=solverNow(),start=cloneState(initial);start.moves=0;
 if(start.objects.every(o=>o.type!=='ball'||o.exited))return{status:'solved',path:[],states:1,elapsedMs:0};
 const startKey=stateKey(start),q=[{s:start,key:startKey,parent:null,dir:null,depth:0}],seen=new Set([startKey]);
 let qi=0,depthLimited=false;
 while(qi<q.length){
  if(timeBudgetMs>0&&solverNow()-started>=timeBudgetMs)return{status:'limit',reason:'time',path:null,states:seen.size,elapsedMs:Math.round(solverNow()-started)};
  const n=q[qi++];
  if(n.depth>=maxDepth){depthLimited=true;continue}
  for(const dir of DIR_NAMES){
   const ns=step(n.s,dir,null).state,k=stateKey(ns);
   if(k===n.key||seen.has(k))continue;
   const child={s:ns,key:k,parent:n,dir,depth:n.depth+1};
   if(ns.won)return{status:'solved',path:solverPath(child),states:seen.size+1,elapsedMs:Math.round(solverNow()-started)};
   if(seen.size>=maxStates)return{status:'limit',reason:'states',path:null,states:seen.size,elapsedMs:Math.round(solverNow()-started)};
   seen.add(k);q.push(child);
  }
 }
 return{status:depthLimited?'limit':'unsolvable',reason:depthLimited?'depth':null,path:null,states:seen.size,elapsedMs:Math.round(solverNow()-started)};
}
/* ===== COMPACT RUNTIME SOLVER (v0.15.21) =====
   Same breadth-first search, same move order, same state identity and the same
   result object as solveDetailedLegacy(), but without structuredClone() and
   string-heavy state keys on every edge. Geometry is fixed during a search, so a
   state is just one Int16Array of object positions (-1 = exited).
   tools/test-runtime-solver.mjs checks path/states/status equality with the
   legacy search on every library level and along every stored solution. */
const COMPACT_DIRS=DIR_NAMES.map(n=>DIRS[n]);
function compileCompactState(s){
 const w=s.width,h=s.height,n=s.objects.length,balls=[],others=[];
 const shapes=s.objects.map(o=>o.cells||[{x:0,y:0}]),wall=s.objects.map(o=>o.type==='wall');
 s.objects.forEach((o,i)=>(o.type==='ball'?balls:others).push(i));
 if(balls.some(i=>shapes[i].length!==1||shapes[i][0].x!==0||shapes[i][0].y!==0))return null;
 const isBall=new Uint8Array(n);for(const i of balls)isBall[i]=1;
 const exit=s.exit.x+s.exit.y*w,exitDir=DIR_NAMES.indexOf(s.exit.dir);
 const start=Int16Array.from(s.objects,o=>o.exited?-1:o.x+o.y*w);
 const occ=new Int16Array(w*h),memo=new Uint8Array(n),visiting=new Uint8Array(n),ballPos=new Array(balls.length);
 function key(p){
  for(let b=0;b<balls.length;b++)ballPos[b]=p[balls[b]]+1;
  if(balls.length>1)ballPos.sort((a,b)=>a-b);
  let k=String.fromCharCode(...ballPos,65535);
  for(const i of others)k+=String.fromCharCode(p[i]+1);
  return k;
 }
 function advance(p,d){
  const dx=COMPACT_DIRS[d].dx,dy=COMPACT_DIRS[d].dy;
  occ.fill(-1);memo.fill(0);visiting.fill(0);
  for(let i=0;i<n;i++)if(p[i]>=0){const ox=p[i]%w,oy=(p[i]-ox)/w;for(const cell of shapes[i])occ[ox+cell.x+(oy+cell.y)*w]=i}
  function canMove(i){
   if(memo[i])return memo[i]===1;
   if(wall[i]){memo[i]=2;return false}
   if(visiting[i])return true;
   visiting[i]=1;
   const ox=p[i]%w,oy=(p[i]-ox)/w;
   for(const cell of shapes[i]){
    const x=ox+cell.x,y=oy+cell.y,nx=x+dx,ny=y+dy;
    if(nx<0||ny<0||nx>=w||ny>=h){if(isBall[i]&&x+y*w===exit&&d===exitDir)continue;visiting[i]=0;memo[i]=2;return false}
    const hit=occ[nx+ny*w];
    if(hit>=0&&hit!==i&&!canMove(hit)){visiting[i]=0;memo[i]=2;return false}
   }
   visiting[i]=0;memo[i]=1;return true;
  }
  for(let i=0;i<n;i++)if(p[i]>=0)canMove(i);
  const out=p.slice();
  for(let i=0;i<n;i++)if(p[i]>=0&&memo[i]===1){
   if(isBall[i]&&p[i]===exit&&d===exitDir){const ox=p[i]%w,oy=(p[i]-ox)/w,nx=ox+dx,ny=oy+dy;if(nx<0||ny<0||nx>=w||ny>=h){out[i]=-1;continue}}
   out[i]+=dx+dy*w;
  }
  return out;
 }
 function won(p){for(const i of balls)if(p[i]>=0)return false;return true}
 return{start,key,advance,won};
}
function solveDetailed(initial,{maxDepth=30,maxStates=Infinity,timeBudgetMs=0}={}){
 const c=compileCompactState(initial);
 if(!c)return solveDetailedLegacy(initial,{maxDepth,maxStates,timeBudgetMs});
 const started=solverNow(),elapsed=()=>Math.round(solverNow()-started);
 if(c.won(c.start))return{status:'solved',path:[],states:1,elapsedMs:0};
 const queue=[c.start],parents=[-1],directions=[-1],depths=[0],seen=new Set([c.key(c.start)]);
 let depthLimited=false;
 function route(i,d){const out=[DIR_NAMES[d]];while(parents[i]>=0){out.push(DIR_NAMES[directions[i]]);i=parents[i]}return out.reverse()}
 for(let qi=0;qi<queue.length;qi++){
  if(timeBudgetMs>0&&solverNow()-started>=timeBudgetMs)return{status:'limit',reason:'time',path:null,states:seen.size,elapsedMs:elapsed()};
  if(depths[qi]>=maxDepth){depthLimited=true;continue}
  for(let d=0;d<4;d++){
   const p=c.advance(queue[qi],d),k=c.key(p);
   if(seen.has(k))continue;
   if(c.won(p))return{status:'solved',path:route(qi,d),states:seen.size+1,elapsedMs:elapsed()};
   if(seen.size>=maxStates)return{status:'limit',reason:'states',path:null,states:seen.size,elapsedMs:elapsed()};
   seen.add(k);queue.push(p);parents.push(qi);directions.push(d);depths.push(depths[qi]+1);
  }
 }
 return{status:depthLimited?'limit':'unsolvable',reason:depthLimited?'depth':null,path:null,states:seen.size,elapsedMs:elapsed()};
}
function solve(initial,maxDepth=30){
 const result=solveDetailed(initial,{maxDepth});
 return result.status==='solved'?result.path:null;
}

/* ===== FREEZE ANALYZER =====
   v0.4: egy összeragasztott téglatest egyetlen többcellás objektum/komponens. */
function movableComponents(s){
 return s.objects.filter(o=>!o.exited&&o.type!=='wall').map(o=>({componentId:o.id,objectIds:[o.id],cellCount:o.cells.length}));
}
function stepWithFrozenComponent(state,dir,component){
 if(!component||component.objectIds.length!==1)return null;
 return step(state,dir,component.objectIds[0]);
}
function analyzeOneFreeze(state,maxDepth=30){
 const normal=solve(state,maxDepth);
 const result={normalSolution:normal,freezeOptions:[],bestFreeze:null};
 if(normal)return result;
 for(const component of movableComponents(state)){
  for(const dir of DIR_NAMES){
   const r=stepWithFrozenComponent(state,dir,component);
   if(!r)continue;
   const meaningful=r.events.some(e=>e.type==='move'||e.type==='exit');
   if(!meaningful)continue;
   const continuation=solve(r.state,maxDepth);
   if(!continuation)continue;
   result.freezeOptions.push({
    componentId:component.componentId,objectIds:[...component.objectIds],direction:dir,
    continuationMoves:continuation.length,totalMoves:1+continuation.length,continuation:[...continuation]
   });
  }
 }
 result.freezeOptions.sort((a,b)=>a.totalMoves-b.totalMoves||a.componentId.localeCompare(b.componentId)||DIR_NAMES.indexOf(a.direction)-DIR_NAMES.indexOf(b.direction));
 result.bestFreeze=result.freezeOptions[0]||null;
 return result;
}
