/* ===== FREEZE-AWARE SOLVER V1 =====
   Experimental, isolated solver. It does not replace solveDetailed().
   A Freeze use is modelled as one direction command where exactly one active
   non-wall object is held in place. V1 supports a bounded number of Freeze uses
   (runtime UI currently requests maxFreezeUses=1). */
const FREEZE_SOLVER_V1='freeze-solver-v1';

function freezeSolverActionPath(node){
 const out=[];
 for(let n=node;n?.parent;n=n.parent)out.push(n.action);
 return out.reverse();
}
function freezeSolverTargets(s){
 return s.objects.filter(o=>!o.exited&&o.type!=='wall').map(o=>o.id);
}
function freezeSolverResultPath(actions){
 return actions.map(a=>a.dir);
}
function solveDetailedWithFreezeV1(initial,{
 maxDepth=40,
 maxStates=80000,
 timeBudgetMs=1200,
 maxFreezeUses=1,
 preferNoFreeze=true
}={}){
 const started=solverNow(),freezeLimit=Math.max(0,Math.floor(maxFreezeUses));
 if(preferNoFreeze){
  const normal=solveDetailed(initial,{maxDepth,maxStates,timeBudgetMs:timeBudgetMs>0?Math.max(1,Math.floor(timeBudgetMs*.35)):0});
  if(normal.status==='solved'){
   const actions=(normal.path||[]).map(dir=>({dir,freezeId:null}));
   return{...normal,solverVersion:FREEZE_SOLVER_V1,actions,freezeUses:0,firstFreezeIndex:-1};
  }
  if(freezeLimit===0)return{...normal,solverVersion:FREEZE_SOLVER_V1,actions:null,freezeUses:0,firstFreezeIndex:-1};
 }
 const start=cloneState(initial);start.moves=0;
 if(start.won||start.objects.every(o=>o.type!=='ball'||o.exited))
  return{status:'solved',path:[],actions:[],states:1,elapsedMs:0,solverVersion:FREEZE_SOLVER_V1,freezeUses:0,firstFreezeIndex:-1};

 const keyOf=(s,used)=>stateKey(s)+'|F'+used;
 const startKey=keyOf(start,0),q=[{s:start,key:startKey,parent:null,action:null,depth:0,used:0}],seen=new Set([startKey]);
 let qi=0,depthLimited=false;
 while(qi<q.length){
  if(timeBudgetMs>0&&solverNow()-started>=timeBudgetMs)
   return{status:'limit',reason:'time',path:null,actions:null,states:seen.size,elapsedMs:Math.round(solverNow()-started),solverVersion:FREEZE_SOLVER_V1,freezeUses:null,firstFreezeIndex:-1};
  const n=q[qi++];
  if(n.depth>=maxDepth){depthLimited=true;continue}
  const normalByDir=new Map();
  for(const dir of DIR_NAMES){
   const ns=step(n.s,dir,null).state,k=stateKey(ns);normalByDir.set(dir,{state:ns,key:k});
   if(k===stateKey(n.s))continue;
   const vk=keyOf(ns,n.used);if(seen.has(vk))continue;
   const child={s:ns,key:vk,parent:n,action:{dir,freezeId:null},depth:n.depth+1,used:n.used};
   if(ns.won){
    const actions=freezeSolverActionPath(child),firstFreezeIndex=actions.findIndex(a=>a.freezeId!=null);
    return{status:'solved',path:freezeSolverResultPath(actions),actions,states:seen.size+1,elapsedMs:Math.round(solverNow()-started),solverVersion:FREEZE_SOLVER_V1,freezeUses:child.used,firstFreezeIndex};
   }
   if(seen.size>=maxStates)return{status:'limit',reason:'states',path:null,actions:null,states:seen.size,elapsedMs:Math.round(solverNow()-started),solverVersion:FREEZE_SOLVER_V1,freezeUses:null,firstFreezeIndex:-1};
   seen.add(vk);q.push(child);
  }
  if(n.used>=freezeLimit)continue;
  const targets=freezeSolverTargets(n.s);
  for(const freezeId of targets)for(const dir of DIR_NAMES){
   if(timeBudgetMs>0&&solverNow()-started>=timeBudgetMs)
    return{status:'limit',reason:'time',path:null,actions:null,states:seen.size,elapsedMs:Math.round(solverNow()-started),solverVersion:FREEZE_SOLVER_V1,freezeUses:null,firstFreezeIndex:-1};
   const ns=step(n.s,dir,freezeId).state,k=stateKey(ns),normal=normalByDir.get(dir);
   // Skip ineffective Freeze actions: no movement, or identical to the normal command.
   if(k===stateKey(n.s)||k===normal?.key)continue;
   const used=n.used+1,vk=keyOf(ns,used);if(seen.has(vk))continue;
   const child={s:ns,key:vk,parent:n,action:{dir,freezeId},depth:n.depth+1,used};
   if(ns.won){
    const actions=freezeSolverActionPath(child),firstFreezeIndex=actions.findIndex(a=>a.freezeId!=null);
    return{status:'solved',path:freezeSolverResultPath(actions),actions,states:seen.size+1,elapsedMs:Math.round(solverNow()-started),solverVersion:FREEZE_SOLVER_V1,freezeUses:used,firstFreezeIndex};
   }
   if(seen.size>=maxStates)return{status:'limit',reason:'states',path:null,actions:null,states:seen.size,elapsedMs:Math.round(solverNow()-started),solverVersion:FREEZE_SOLVER_V1,freezeUses:null,firstFreezeIndex:-1};
   seen.add(vk);q.push(child);
  }
 }
 return{status:depthLimited?'limit':'unsolvable',reason:depthLimited?'depth':null,path:null,actions:null,states:seen.size,elapsedMs:Math.round(solverNow()-started),solverVersion:FREEZE_SOLVER_V1,freezeUses:null,firstFreezeIndex:-1};
}
