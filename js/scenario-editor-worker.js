/* GGrid v0.12.2 – Scenario Editor background generator */
importScripts('game-core.js','solver.js');

let cancelled=false;
self.onmessage=e=>{
 const m=e.data||{};
 if(m.type==='cancel'){cancelled=true;return}
 if(m.type!=='generateScenarioStage')return;
 cancelled=false;
 try{generate(m)}catch(err){self.postMessage({type:'error',requestId:m.requestId,message:err?.message||String(err)})}
};

function hash32(str){let h=2166136261>>>0;for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
function rng(seed){let a=hash32(seed);return()=>{a|=0;a=a+0x6D2B79F5|0;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296}}
function shape(count,r){
 const cells=[{x:0,y:0}],used=new Set(['0,0']),edges=[];
 while(cells.length<count){const ai=Math.floor(r()*cells.length),d=DIRS[DIR_NAMES[Math.floor(r()*4)]],b=cells[ai],c={x:b.x+d.dx,y:b.y+d.dy},k=key(c.x,c.y);if(!used.has(k)){used.add(k);edges.push([ai,cells.length]);cells.push(c)}}
 const minx=Math.min(...cells.map(c=>c.x)),miny=Math.min(...cells.map(c=>c.y));return{cells:cells.map(c=>({x:c.x-minx,y:c.y-miny})),glueEdges:edges}
}
function place(n,sh,occ,r){
 const mx=Math.max(...sh.map(c=>c.x)),my=Math.max(...sh.map(c=>c.y)),aa=[];
 for(let y=0;y<n-my;y++)for(let x=0;x<n-mx;x++)if(sh.every(c=>!occ.has(key(x+c.x,y+c.y))))aa.push({x,y});
 if(!aa.length)return null;const a=aa[Math.floor(r()*aa.length)];sh.forEach(c=>occ.add(key(a.x+c.x,a.y+c.y)));return a
}
function range(d){const m=[[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,8],[8,10],[10,12],[12,16]];return m[Math.max(1,Math.min(10,+d))-1]}
function counts(s,r){
 const n=+s.size,b=s.bricks==='auto'?Math.max(1,Math.min(5,Math.round(n*n/6+r()*2))):+s.bricks;
 const wm=Math.max(0,n-2),w=s.walls==='auto'?Math.floor(r()*(wm+1)):Math.min(+s.walls,wm);return{b,w}
}
function candidate(s,seed,a){
 const r=rng(seed+'|'+a),n=+s.size,{b,w}=counts(s,r),occ=new Set(),objects=[];
 for(let i=0;i<w;i++){const free=[];for(let y=0;y<n;y++)for(let x=0;x<n;x++)if(!occ.has(key(x,y)))free.push({x,y});if(!free.length)return null;const c=free[Math.floor(r()*free.length)];occ.add(key(c.x,c.y));objects.push({id:'w'+(i+1),type:'wall',x:c.x,y:c.y,cells:[{x:0,y:0}]})}
 let glueCells=0,remaining=b,bi=1;
 while(remaining>0){let sz=1;if(s.glue!=='none'&&remaining>=2&&((s.glue==='required'&&glueCells===0)||r()<.42))sz=Math.min(remaining,2+(r()<.28&&remaining>=3?1:0));
  const sh=shape(sz,r),p=place(n,sh.cells,occ,r);if(!p)return null;objects.push({id:'b'+bi++,type:'brick',x:p.x,y:p.y,cells:sh.cells,glueEdges:sh.glueEdges,glued:sz>1});if(sz>1)glueCells+=sz-1;remaining-=sz}
 if(s.glue==='required'&&!glueCells)return null;
 const free=[];for(let y=0;y<n;y++)for(let x=0;x<n;x++)if(!occ.has(key(x,y)))free.push({x,y});if(!free.length)return null;
 const ball=free[Math.floor(r()*free.length)],dir=DIR_NAMES[Math.floor(r()*4)],exit=(dir==='left'||dir==='right')?{x:dir==='left'?0:n-1,y:Math.floor(r()*n),dir}:{x:Math.floor(r()*n),y:dir==='up'?0:n-1,dir};
 objects.unshift({id:'ball1',type:'ball',x:ball.x,y:ball.y,cells:[{x:0,y:0}]});
 return{width:n,height:n,exit,moves:0,won:false,objects,brickCount:b,wallCount:w,glueCount:glueCells}
}
function generate(m){
 const s=m.spec,seed=m.seed,[lo,hi]=range(s.difficulty),budget=+s.freeze,maxAttempts=m.maxAttempts||2500,maxMs=m.maxMs||12000,start=Date.now();
 let best=null,solvable=0,inRange=0;
 for(let a=0;a<maxAttempts;a++){
  if(cancelled){self.postMessage({type:'cancelled',requestId:m.requestId,attempt:a});return}
  if(Date.now()-start>=maxMs)break;
  const st=candidate(s,seed,a);if(st){
   let normal=solve(st,30),metric=normal?.length??999,freezeAnalysis=null,accepted=false;
   if(s.freezeRole==='required'){if(budget>=1&&!normal){freezeAnalysis=analyzeOneFreeze(st,30);if(freezeAnalysis.bestFreeze){metric=freezeAnalysis.bestFreeze.totalMoves;solvable++;accepted=metric>=lo&&metric<=hi}}}
   else{if(!normal&&budget>0){freezeAnalysis=analyzeOneFreeze(st,30);if(freezeAnalysis.bestFreeze)metric=freezeAnalysis.bestFreeze.totalMoves}if(metric!==999){solvable++;accepted=metric>=lo&&metric<=hi}}
   if(accepted)inRange++;
   if(metric!==999&&(!best||Math.abs(metric-(lo+hi)/2)<best.dist))best={st,metric,dist:Math.abs(metric-(lo+hi)/2),attempt:a};
   if(accepted){self.postMessage({type:'result',requestId:m.requestId,best:{st,metric,attempt:a},stats:{attempts:a+1,solvable,inRange,elapsedMs:Date.now()-start,exact:true}});return}
  }
  if((a+1)%25===0)self.postMessage({type:'progress',requestId:m.requestId,stats:{attempts:a+1,solvable,inRange,elapsedMs:Date.now()-start,bestMetric:best?.metric??null}});
 }
 self.postMessage({type:'notFound',requestId:m.requestId,best:best?{st:best.st,metric:best.metric,attempt:best.attempt}:null,stats:{attempts:Math.min(maxAttempts,maxAttempts),solvable,inRange,elapsedMs:Date.now()-start,target:[lo,hi]}});
}