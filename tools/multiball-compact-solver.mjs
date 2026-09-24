// Offline-only exact BFS. Runtime physics/solver are unchanged. The transition
// rules mirror game-core.js, with fixed geometry and compact object positions.
const names=['up','down','left','right'],dx=[0,0,-1,1],dy=[-1,1,0,0];
export function compile(s){
 const w=s.width,h=s.height,n=s.objects.length,balls=[],others=[];
 const shapes=s.objects.map(o=>o.cells),wall=s.objects.map(o=>o.type==='wall');
 s.objects.forEach((o,i)=>(o.type==='ball'?balls:others).push(i));
 if(balls.some(i=>shapes[i].length!==1||shapes[i][0].x!==0||shapes[i][0].y!==0))throw Error('Compact solver requires normalized single-cell balls');
 const ballSet=new Set(balls),exit=s.exit.x+s.exit.y*w,exitDir=names.indexOf(s.exit.dir);
 const start=Int16Array.from(s.objects,o=>o.exited?-1:o.x+o.y*w);
 function key(p){return String.fromCharCode(...balls.map(i=>p[i]+1).sort((a,b)=>a-b),127,...others.map(i=>p[i]+1));}
 function step(p,d){
  const occ=new Int16Array(w*h);occ.fill(-1);
  for(let i=0;i<n;i++)if(p[i]>=0)for(const c of shapes[i])occ[p[i]+c.x+c.y*w]=i;
  const memo=new Uint8Array(n),visiting=new Uint8Array(n);
  function canMove(i){
   if(memo[i])return memo[i]===1;
   if(wall[i]){memo[i]=2;return false;}
   if(visiting[i])return true;visiting[i]=1;
   const ox=p[i]%w,oy=Math.floor(p[i]/w);
   for(const c of shapes[i]){const x=ox+c.x,y=oy+c.y,nx=x+dx[d],ny=y+dy[d];
    if(nx<0||ny<0||nx>=w||ny>=h){if(ballSet.has(i)&&x+y*w===exit&&d===exitDir)continue;visiting[i]=0;memo[i]=2;return false;}
    const hit=occ[nx+ny*w];if(hit>=0&&hit!==i&&!canMove(hit)){visiting[i]=0;memo[i]=2;return false;}
   }visiting[i]=0;memo[i]=1;return true;
  }
  for(let i=0;i<n;i++)if(p[i]>=0)canMove(i);
  const out=p.slice();
  for(let i=0;i<n;i++)if(p[i]>=0&&memo[i]===1){
   const x=p[i]%w+dx[d],y=Math.floor(p[i]/w)+dy[d];
   if(ballSet.has(i)&&(x<0||y<0||x>=w||y>=h)&&p[i]===exit&&d===exitDir)out[i]=-1;
   else out[i]+=dx[d]+dy[d]*w;
  }return out;
 }
 const won=p=>balls.every(i=>p[i]<0);
 return {start,key,step,won};
}
export function solveCompact(s,{maxDepth=30,maxStates=Infinity,timeBudgetMs=0}={}){
 const started=Date.now(),c=compile(s);
 if(c.won(c.start))return {status:'solved',path:[],states:1,elapsedMs:0};
 const queue=[c.start],parents=[-1],directions=[-1],depths=[0],seen=new Set([c.key(c.start)]);
 let depthLimited=false;
 function route(i,d){const out=[names[d]];while(parents[i]>=0){out.push(names[directions[i]]);i=parents[i];}return out.reverse();}
 const result=(status,reason,path=null,states=seen.size)=>({status,reason,path,states,elapsedMs:Date.now()-started});
 for(let qi=0;qi<queue.length;qi++){
  if(timeBudgetMs>0&&Date.now()-started>=timeBudgetMs)return result('limit','time');
  if(depths[qi]>=maxDepth){depthLimited=true;continue;}
  for(let d=0;d<4;d++){
   const p=c.step(queue[qi],d),k=c.key(p);if(seen.has(k))continue;
   if(c.won(p))return result('solved',null,route(qi,d),seen.size+1);
   if(seen.size>=maxStates)return result('limit','states');
   seen.add(k);queue.push(p);parents.push(qi);directions.push(d);depths.push(depths[qi]+1);
  }
 }return result(depthLimited?'limit':'unsolvable',depthLimited?'depth':null);
}
