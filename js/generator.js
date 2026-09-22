/* ===== DETERMINISTIC GENERATOR / LEVEL CODE ===== */
const ranges={easy:[1,4],medium:[5,7],hard:[8,14]}, DIFFCODE={easy:'E',medium:'M',hard:'H'}, CODEDIFF={E:'easy',M:'medium',H:'hard'};
function hash32(str){let h=2166136261>>>0;for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0;}
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296}}
function seedText(){const a=new Uint32Array(1);if(globalThis.crypto&&crypto.getRandomValues)crypto.getRandomValues(a);else a[0]=(Date.now()^Math.floor(Math.random()*0xffffffff))>>>0;return a[0].toString(36).toUpperCase().padStart(7,'0').slice(-7);}
function rngFor(seed,attempt){return mulberry32(hash32(seed+'|'+attempt));}
function randomExit(w,h,rng){const dir=DIR_NAMES[Math.floor(rng()*4)];if(dir==='left'||dir==='right')return{x:dir==='left'?0:w-1,y:Math.floor(rng()*h),dir};return{x:Math.floor(rng()*w),y:dir==='up'?0:h-1,dir};}
function shuffle(a,rng){for(let i=a.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}

/* N tégla-cellából pontosan glueCount összevonás készül.
   3 cellánál: 0 => 1+1+1, 1 => 2+1, 2 => 3.
   A többcellás alakzatot véletlen, él-szomszédos növesztéssel készítjük. */
function componentSizes(brickCount,glueCount,rng){
 const sizes=Array(brickCount).fill(1);
 for(let g=0;g<glueCount;g++){
  const live=sizes.map((v,i)=>v?i:-1).filter(i=>i>=0);
  const a=live[Math.floor(rng()*live.length)];
  const others=live.filter(i=>i!==a),b=others[Math.floor(rng()*others.length)];
  sizes[a]+=sizes[b];sizes[b]=0;
 }
 return shuffle(sizes.filter(Boolean),rng);
}
function randomShape(cellCount,rng){
 const cells=[{x:0,y:0}],used=new Set(['0,0']),rawEdges=[];
 while(cells.length<cellCount){
  const ai=Math.floor(rng()*cells.length),base=cells[ai],d=DIRS[DIR_NAMES[Math.floor(rng()*4)]];
  const c={x:base.x+d.dx,y:base.y+d.dy},k=key(c.x,c.y);
  if(!used.has(k)){used.add(k);rawEdges.push([ai,cells.length]);cells.push(c);}
 }
 const minx=Math.min(...cells.map(c=>c.x)),miny=Math.min(...cells.map(c=>c.y));
 const norm=cells.map(c=>({x:c.x-minx,y:c.y-miny}));
 return{cells:norm,glueEdges:rawEdges};
}
function placeShape(w,h,shape,occupied,rng){
 const maxx=Math.max(...shape.map(c=>c.x)),maxy=Math.max(...shape.map(c=>c.y));
 const anchors=[];for(let y=0;y<h-maxy;y++)for(let x=0;x<w-maxx;x++){
  if(shape.every(c=>!occupied.has(key(x+c.x,y+c.y))))anchors.push({x,y});
 }
 if(!anchors.length)return null;
 const a=anchors[Math.floor(rng()*anchors.length)];
 for(const c of shape)occupied.add(key(a.x+c.x,a.y+c.y));
 return a;
}
function wallCandidate(w,h,seed,attempt){
 const rng=rngFor(seed,attempt),brickCount=3,glueCount=Math.floor(rng()*brickCount);
 const occupied=new Set(),objects=[];
 /* Fix blokkok: 3×3 max 1, 4×4 max 2, 5×5 max 3. A darabszám
    0..max között egyenletesen véletlen; nem a nehézséghez kötött. */
 const wallMax=Math.max(1,Math.min(3,w-2)),wallCount=Math.floor(rng()*(wallMax+1));
 for(let i=0;i<wallCount;i++){
  const free=[];for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(!occupied.has(key(x,y)))free.push({x,y});
  if(!free.length)return null;const w=free[Math.floor(rng()*free.length)];occupied.add(key(w.x,w.y));
  objects.push({id:'w'+(i+1),type:'wall',x:w.x,y:w.y,cells:[{x:0,y:0}]});
 }
 const sizes=componentSizes(brickCount,glueCount,rng);
 for(let i=0;i<sizes.length;i++){
  const built=randomShape(sizes[i],rng),shape=built.cells,a=placeShape(w,h,shape,occupied,rng);if(!a)return null;
  objects.push({id:'b'+(i+1),type:'brick',x:a.x,y:a.y,cells:shape,glueEdges:built.glueEdges,glued:shape.length>1});
 }
 const free=[];for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(!occupied.has(key(x,y)))free.push({x,y});
 if(!free.length)return null;const ball=free[Math.floor(rng()*free.length)];
 objects.unshift({id:'ball1',type:'ball',x:ball.x,y:ball.y,cells:[{x:0,y:0}]});
 return{width:w,height:h,exit:randomExit(w,h,rng),moves:0,won:false,glueCount,brickCount,wallCount,objects};
}
function gluedCandidate(w,h,seed,attempt){
 const rng=rngFor(seed,attempt),brickCount=3,glueCount=Math.floor(rng()*brickCount);
 const occupied=new Set(),objects=[],sizes=componentSizes(brickCount,glueCount,rng);
 for(let i=0;i<sizes.length;i++){const built=randomShape(sizes[i],rng),shape=built.cells,a=placeShape(w,h,shape,occupied,rng);if(!a)return null;objects.push({id:'b'+(i+1),type:'brick',x:a.x,y:a.y,cells:shape,glueEdges:built.glueEdges,glued:shape.length>1});}
 const free=[];for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(!occupied.has(key(x,y)))free.push({x,y});
 if(!free.length)return null;const ball=free[Math.floor(rng()*free.length)];objects.unshift({id:'ball1',type:'ball',x:ball.x,y:ball.y,cells:[{x:0,y:0}]});
 return{width:w,height:h,exit:randomExit(w,h,rng),moves:0,won:false,glueCount,brickCount,wallCount:0,objects};
}
/* Régi B-kódok kompatibilitása: v0.3 szórt 3 téglás generátor. */
function legacyCandidate(w,h,seed,attempt){
 const rng=rngFor(seed,attempt),cells=shuffle(Array.from({length:w*h},(_,i)=>({x:i%w,y:Math.floor(i/w)})),rng),ball=cells.pop(),objects=[{id:'ball1',type:'ball',x:ball.x,y:ball.y,cells:[{x:0,y:0}]}];
 for(let i=0;i<3;i++){const c=cells.pop();objects.push({id:'b'+(i+1),type:'brick',x:c.x,y:c.y,cells:[{x:0,y:0}]});}
 return{width:w,height:h,exit:randomExit(w,h,rng),moves:0,won:false,glueCount:0,brickCount:3,objects};
}
function makeCode(w,h,difficulty,seed,prefix='G'){return w===h?`${prefix}${w}${DIFFCODE[difficulty]}-${seed}`:`${prefix}${w}X${h}${DIFFCODE[difficulty]}-${seed}`;}
function parseCode(raw){const s=String(raw).trim().toUpperCase(),m=s.match(/^([BGW])([345])([EMH])-([0-9A-Z]{1,7})$/);if(m)return{prefix:m[1],w:+m[2],h:+m[2],n:+m[2],difficulty:CODEDIFF[m[3]],seed:m[4].padStart(7,'0')};const r=s.match(/^([BGW])5X([678])([EMH])-([0-9A-Z]{1,7})$/);if(!r)return null;return{prefix:r[1],w:5,h:+r[2],difficulty:CODEDIFF[r[3]],seed:r[4].padStart(7,'0')};}
/* v0.12.37 – constructive free-play generator.
   A normál W-pálya nem brute-force BFS kereséssel készül. Előbb egy biztosan
   kijárható golyófolyosót hozunk létre, majd a maradék mezőkre tesszük a
   téglákat/falakat. Így a játék indítása determinisztikusan gyors és a pálya
   garantáltan megoldható. A solver továbbra is használható hinthez és
   tartalom-validáláshoz. */
function constructiveCandidate(w,h,seed,difficulty){
 const rng=rngFor(seed,0),exit=randomExit(w,h,rng),occupied=new Set(),objects=[];
 const horizontal=exit.dir==='left'||exit.dir==='right';
 let ball;
 if(horizontal){
  const minX=exit.dir==='left'?0:Math.max(0,w-3),maxX=exit.dir==='left'?Math.min(w-1,2):w-1;
  ball={x:minX+Math.floor(rng()*(maxX-minX+1)),y:exit.y};
  for(let x=Math.min(ball.x,exit.x);x<=Math.max(ball.x,exit.x);x++)occupied.add(key(x,exit.y));
 }else{
  const minY=exit.dir==='up'?0:Math.max(0,h-3),maxY=exit.dir==='up'?Math.min(h-1,2):h-1;
  ball={x:exit.x,y:minY+Math.floor(rng()*(maxY-minY+1))};
  for(let y=Math.min(ball.y,exit.y);y<=Math.max(ball.y,exit.y);y++)occupied.add(key(exit.x,y));
 }
 objects.push({id:'ball1',type:'ball',x:ball.x,y:ball.y,cells:[{x:0,y:0}]});
 const free=()=>shuffle(Array.from({length:w*h},(_,i)=>({x:i%w,y:Math.floor(i/w)})).filter(c=>!occupied.has(key(c.x,c.y))),rng);
 let cells=free();
 const brickCount=Math.min(3,cells.length);
 for(let n=0;n<brickCount;n++){const a=cells.pop();occupied.add(key(a.x,a.y));objects.push({id:'b'+(n+1),type:'brick',x:a.x,y:a.y,cells:[{x:0,y:0}],glueEdges:[],glued:false});}
 cells=free();
 const wallTarget=difficulty==='hard'?Math.min(3,Math.max(1,w-2)):difficulty==='medium'?Math.min(2,Math.max(1,w-2)):Math.min(1,Math.max(0,w-2));
 const wallCount=Math.min(Math.floor(rng()*(wallTarget+1)),cells.length);
 for(let n=0;n<wallCount;n++){const a=cells.pop();occupied.add(key(a.x,a.y));objects.push({id:'w'+(n+1),type:'wall',x:a.x,y:a.y,cells:[{x:0,y:0}]});}
 return{width:w,height:h,exit,moves:0,won:false,glueCount:0,brickCount,wallCount,objects};
}
function directSolution(s){
 const b=s.objects.find(o=>o.type==='ball'&&!o.exited);if(!b)return[];
 const n=s.exit.dir==='left'||s.exit.dir==='right'?Math.abs(b.x-s.exit.x)+1:Math.abs(b.y-s.exit.y)+1;
 return Array(n).fill(s.exit.dir);
}
function generateLevel(w,difficulty,seed=seedText(),prefix='W',h=w){
 if(prefix==='W'){
  const s=constructiveCandidate(w,h,seed,difficulty),solution=directSolution(s);
  return{state:s,solution,attempt:0,seed,code:makeCode(w,h,difficulty,seed,prefix),constructive:true};
 }
 const [lo,hi]=ranges[difficulty];let fallback=null,cand=prefix==='B'?legacyCandidate:gluedCandidate;
 const maxTries=(w*h<=16)?900:(w*h<=25?450:220);
 for(let tries=0;tries<maxTries;tries++){
  const s=cand(w,h,seed,tries);if(!s)continue;const sol=solve(s,24);if(!sol)continue;
  if(!fallback||Math.abs(sol.length-(lo+hi)/2)<Math.abs(fallback.solution.length-(lo+hi)/2))fallback={state:s,solution:sol,attempt:tries};
  if(sol.length>=lo&&sol.length<=hi)return{state:s,solution:sol,attempt:tries,seed,code:makeCode(w,h,difficulty,seed,prefix)};
 }
 if(fallback)return{...fallback,seed,code:makeCode(w,h,difficulty,seed,prefix),fallback:true};
 throw Error("Nem sikerült megoldható pályát generálni.");
}
