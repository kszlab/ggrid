/* ===== FREEZE-AWARE SOLVER V2 (COMPACT) =====
   Experimental, isolated solver. Keeps solveDetailed() and Freeze Solver v1 intact.
   V2 uses compact Int16Array states and prunes Freeze candidates to objects that
   would actually move on the corresponding normal command. */
const FREEZE_SOLVER_V2='freeze-solver-v2';

function compileFreezeCompactStateV2(s){
 const w=s.width,h=s.height,n=s.objects.length,balls=[];
 const shapes=s.objects.map(o=>o.cells||[{x:0,y:0}]);
 const wall=Uint8Array.from(s.objects,o=>o.type==='wall'?1:0);
 const isBall=Uint8Array.from(s.objects,o=>o.type==='ball'?1:0);
 s.objects.forEach((o,i)=>{if(o.type==='ball')balls.push(i)});
 if(balls.some(i=>shapes[i].length!==1||shapes[i][0].x!==0||shapes[i][0].y!==0))return null;
 const ids=s.objects.map(o=>o.id),exit=s.exit.x+s.exit.y*w,exitDir=DIR_NAMES.indexOf(s.exit.dir);
 const start=Int16Array.from(s.objects,o=>o.exited?-1:o.x+o.y*w);
 const occ=new Int16Array(w*h),memo=new Int8Array(n),visiting=new Uint8Array(n);
 function key(p,used){
  let k=String.fromCharCode(used+1,65535);
  // Identity-preserving positions keep returned freezeId unambiguous.
  for(let i=0;i<n;i++)k+=String.fromCharCode(p[i]+1);
  return k;
 }
 function won(p){for(const i of balls)if(p[i]>=0)return false;return true}
 function advance(p,d,frozen=-1){
  const dx=COMPACT_DIRS[d].dx,dy=COMPACT_DIRS[d].dy;
  occ.fill(-1);memo.fill(0);visiting.fill(0);
  for(let i=0;i<n;i++)if(p[i]>=0){
   const ox=p[i]%w,oy=(p[i]-ox)/w;
   for(const cell of shapes[i])occ[ox+cell.x+(oy+cell.y)*w]=i;
  }
  function canMove(i){
   if(memo[i])return memo[i]===1;
   if(wall[i]||i===frozen){memo[i]=2;return false}
   if(visiting[i])return true;
   visiting[i]=1;
   const ox=p[i]%w,oy=(p[i]-ox)/w;
   for(const cell of shapes[i]){
    const x=ox+cell.x,y=oy+cell.y,nx=x+dx,ny=y+dy;
    if(nx<0||ny<0||nx>=w||ny>=h){
     if(isBall[i]&&x+y*w===exit&&d===exitDir)continue;
     visiting[i]=0;memo[i]=2;return false;
    }
    const hit=occ[nx+ny*w];
    if(hit>=0&&hit!==i&&!canMove(hit)){visiting[i]=0;memo[i]=2;return false}
   }
   visiting[i]=0;memo[i]=1;return true;
  }
  for(let i=0;i<n;i++)if(p[i]>=0)canMove(i);
  const out=p.slice();
  for(let i=0;i<n;i++)if(p[i]>=0&&memo[i]===1){
   if(isBall[i]&&p[i]===exit&&d===exitDir){
    const ox=p[i]%w,oy=(p[i]-ox)/w,nx=ox+dx,ny=oy+dy;
    if(nx<0||ny<0||nx>=w||ny>=h){out[i]=-1;continue}
   }
   out[i]+=dx+dy*w;
  }
  return out;
 }
 return{w,h,n,ids,wall,start,key,won,advance};
}
function freezeSolverV2Actions(parents,dirs,freezes,index,lastDir,lastFreeze){
 const out=[{dir:DIR_NAMES[lastDir],freezeId:lastFreeze>=0?freezes.ids[lastFreeze]:null}];
 while(parents[index]>=0){
  out.push({dir:DIR_NAMES[dirs[index]],freezeId:freezes.at[index]>=0?freezes.ids[freezes.at[index]]:null});
  index=parents[index];
 }
 return out.reverse();
}
function solveDetailedWithFreezeV2(initial,{
 maxDepth=48,
 maxStates=180000,
 timeBudgetMs=2500,
 maxFreezeUses=1,
 preferNoFreeze=true
}={}){
 const started=solverNow(),elapsed=()=>Math.round(solverNow()-started),freezeLimit=Math.max(0,Math.floor(maxFreezeUses));
 if(preferNoFreeze){
  const normalBudget=timeBudgetMs>0?Math.max(1,Math.min(900,Math.floor(timeBudgetMs*.28))):0;
  const normal=solveDetailed(initial,{maxDepth,maxStates:Math.min(maxStates,120000),timeBudgetMs:normalBudget});
  if(normal.status==='solved'){
   const actions=(normal.path||[]).map(dir=>({dir,freezeId:null}));
   return{...normal,solverVersion:FREEZE_SOLVER_V2,actions,freezeUses:0,firstFreezeIndex:-1};
  }
  if(freezeLimit===0)return{...normal,solverVersion:FREEZE_SOLVER_V2,actions:null,freezeUses:0,firstFreezeIndex:-1};
 }
 const c=compileFreezeCompactStateV2(initial);
 if(!c)return solveDetailedWithFreezeV1(initial,{maxDepth,maxStates,timeBudgetMs,maxFreezeUses,preferNoFreeze:false});
 if(c.won(c.start))return{status:'solved',path:[],actions:[],states:1,elapsedMs:0,solverVersion:FREEZE_SOLVER_V2,freezeUses:0,firstFreezeIndex:-1};

 const queue=[c.start],used=[0],parents=[-1],dirs=[-1],freezeAt=[-1],depths=[0],seen=new Set([c.key(c.start,0)]);
 let depthLimited=false;
 const freezes={ids:c.ids,at:freezeAt};
 function finish(parentIndex,d,freezeIndex,nextUsed){
  const actions=freezeSolverV2Actions(parents,dirs,freezes,parentIndex,d,freezeIndex);
  const firstFreezeIndex=actions.findIndex(a=>a.freezeId!=null);
  return{status:'solved',path:actions.map(a=>a.dir),actions,states:seen.size+1,elapsedMs:elapsed(),solverVersion:FREEZE_SOLVER_V2,freezeUses:nextUsed,firstFreezeIndex};
 }
 for(let qi=0;qi<queue.length;qi++){
  if(timeBudgetMs>0&&solverNow()-started>=timeBudgetMs)
   return{status:'limit',reason:'time',path:null,actions:null,states:seen.size,elapsedMs:elapsed(),solverVersion:FREEZE_SOLVER_V2,freezeUses:null,firstFreezeIndex:-1};
  if(depths[qi]>=maxDepth){depthLimited=true;continue}
  const p=queue[qi],u=used[qi];
  for(let d=0;d<4;d++){
   const normal=c.advance(p,d,-1),nk=c.key(normal,u);
   let changed=false;for(let i=0;i<c.n;i++)if(normal[i]!==p[i]){changed=true;break}
   if(changed&&!seen.has(nk)){
    if(c.won(normal))return finish(qi,d,-1,u);
    if(seen.size>=maxStates)return{status:'limit',reason:'states',path:null,actions:null,states:seen.size,elapsedMs:elapsed(),solverVersion:FREEZE_SOLVER_V2,freezeUses:null,firstFreezeIndex:-1};
    seen.add(nk);queue.push(normal);used.push(u);parents.push(qi);dirs.push(d);freezeAt.push(-1);depths.push(depths[qi]+1);
   }
   if(u>=freezeLimit||!changed)continue;
   // Freezing an object that would already stay put cannot alter this command.
   for(let fi=0;fi<c.n;fi++){
    if(c.wall[fi]||p[fi]<0||normal[fi]===p[fi])continue;
    const frozen=c.advance(p,d,fi);
    let sameCurrent=true,sameNormal=true;
    for(let i=0;i<c.n;i++){if(frozen[i]!==p[i])sameCurrent=false;if(frozen[i]!==normal[i])sameNormal=false;if(!sameCurrent&&!sameNormal)break}
    if(sameCurrent||sameNormal)continue;
    const nu=u+1,fk=c.key(frozen,nu);if(seen.has(fk))continue;
    if(c.won(frozen))return finish(qi,d,fi,nu);
    if(seen.size>=maxStates)return{status:'limit',reason:'states',path:null,actions:null,states:seen.size,elapsedMs:elapsed(),solverVersion:FREEZE_SOLVER_V2,freezeUses:null,firstFreezeIndex:-1};
    seen.add(fk);queue.push(frozen);used.push(nu);parents.push(qi);dirs.push(d);freezeAt.push(fi);depths.push(depths[qi]+1);
   }
  }
 }
 return{status:depthLimited?'limit':'unsolvable',reason:depthLimited?'depth':null,path:null,actions:null,states:seen.size,elapsedMs:elapsed(),solverVersion:FREEZE_SOLVER_V2,freezeUses:null,firstFreezeIndex:-1};
}
