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
function solveDetailed(initial,{maxDepth=30,maxStates=Infinity,timeBudgetMs=0}={}){
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
