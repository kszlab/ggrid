/* ===== SOLVER ===== */
function stateKey(s){return s.objects.map(o=>`${o.id}:${o.exited?'X':o.x+','+o.y}`).join('|');}
function solve(initial,maxDepth=30){
 const start=cloneState(initial);start.moves=0;if(start.objects.every(o=>o.type!=='ball'||o.exited))return[];
 const q=[{s:start,path:[]}],seen=new Set([stateKey(start)]);let qi=0;
 while(qi<q.length){const n=q[qi++];if(n.path.length>=maxDepth)continue;
  for(const dir of DIR_NAMES){const r=step(n.s,dir,null),ns=r.state,k=stateKey(ns);if(k===stateKey(n.s)||seen.has(k))continue;const p=[...n.path,dir];if(ns.won)return p;seen.add(k);q.push({s:ns,path:p});}
 }return null;
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
