/* ===== DETERMINISTIC GENERATOR / LEVEL CODE ===== */
const ranges={easy:[1,4],medium:[5,7],hard:[8,14]}, DIFFCODE={easy:'E',medium:'M',hard:'H'}, CODEDIFF={E:'easy',M:'medium',H:'hard'};
function hash32(str){let h=2166136261>>>0;for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0;}
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296}}
function seedText(){const a=new Uint32Array(1);if(globalThis.crypto&&crypto.getRandomValues)crypto.getRandomValues(a);else a[0]=(Date.now()^Math.floor(Math.random()*0xffffffff))>>>0;return a[0].toString(36).toUpperCase().padStart(7,'0').slice(-7);}
function rngFor(seed,attempt){return mulberry32(hash32(seed+'|'+attempt));}
function randomExit(n,rng){const dir=DIR_NAMES[Math.floor(rng()*4)];if(dir==='left'||dir==='right')return{x:dir==='left'?0:n-1,y:Math.floor(rng()*n),dir};return{x:Math.floor(rng()*n),y:dir==='up'?0:n-1,dir};}
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
function placeShape(n,shape,occupied,rng){
 const maxx=Math.max(...shape.map(c=>c.x)),maxy=Math.max(...shape.map(c=>c.y));
 const anchors=[];for(let y=0;y<n-maxy;y++)for(let x=0;x<n-maxx;x++){
  if(shape.every(c=>!occupied.has(key(x+c.x,y+c.y))))anchors.push({x,y});
 }
 if(!anchors.length)return null;
 const a=anchors[Math.floor(rng()*anchors.length)];
 for(const c of shape)occupied.add(key(a.x+c.x,a.y+c.y));
 return a;
}
function wallCandidate(n,seed,attempt){
 const rng=rngFor(seed,attempt),brickCount=3,glueCount=Math.floor(rng()*brickCount);
 const occupied=new Set(),objects=[];
 /* Fix blokkok: 3×3 max 1, 4×4 max 2, 5×5 max 3. A darabszám
    0..max között egyenletesen véletlen; nem a nehézséghez kötött. */
 const wallMax=Math.max(1,n-2),wallCount=Math.floor(rng()*(wallMax+1));
 for(let i=0;i<wallCount;i++){
  const free=[];for(let y=0;y<n;y++)for(let x=0;x<n;x++)if(!occupied.has(key(x,y)))free.push({x,y});
  if(!free.length)return null;const w=free[Math.floor(rng()*free.length)];occupied.add(key(w.x,w.y));
  objects.push({id:'w'+(i+1),type:'wall',x:w.x,y:w.y,cells:[{x:0,y:0}]});
 }
 const sizes=componentSizes(brickCount,glueCount,rng);
 for(let i=0;i<sizes.length;i++){
  const built=randomShape(sizes[i],rng),shape=built.cells,a=placeShape(n,shape,occupied,rng);if(!a)return null;
  objects.push({id:'b'+(i+1),type:'brick',x:a.x,y:a.y,cells:shape,glueEdges:built.glueEdges,glued:shape.length>1});
 }
 const free=[];for(let y=0;y<n;y++)for(let x=0;x<n;x++)if(!occupied.has(key(x,y)))free.push({x,y});
 if(!free.length)return null;const ball=free[Math.floor(rng()*free.length)];
 objects.unshift({id:'ball1',type:'ball',x:ball.x,y:ball.y,cells:[{x:0,y:0}]});
 return{width:n,height:n,exit:randomExit(n,rng),moves:0,won:false,glueCount,brickCount,wallCount,objects};
}
function gluedCandidate(n,seed,attempt){
 const rng=rngFor(seed,attempt),brickCount=3,glueCount=Math.floor(rng()*brickCount);
 const occupied=new Set(),objects=[],sizes=componentSizes(brickCount,glueCount,rng);
 for(let i=0;i<sizes.length;i++){const built=randomShape(sizes[i],rng),shape=built.cells,a=placeShape(n,shape,occupied,rng);if(!a)return null;objects.push({id:'b'+(i+1),type:'brick',x:a.x,y:a.y,cells:shape,glueEdges:built.glueEdges,glued:shape.length>1});}
 const free=[];for(let y=0;y<n;y++)for(let x=0;x<n;x++)if(!occupied.has(key(x,y)))free.push({x,y});
 if(!free.length)return null;const ball=free[Math.floor(rng()*free.length)];objects.unshift({id:'ball1',type:'ball',x:ball.x,y:ball.y,cells:[{x:0,y:0}]});
 return{width:n,height:n,exit:randomExit(n,rng),moves:0,won:false,glueCount,brickCount,wallCount:0,objects};
}
/* Régi B-kódok kompatibilitása: v0.3 szórt 3 téglás generátor. */
function legacyCandidate(n,seed,attempt){
 const rng=rngFor(seed,attempt),cells=shuffle(Array.from({length:n*n},(_,i)=>({x:i%n,y:Math.floor(i/n)})),rng),ball=cells.pop(),objects=[{id:'ball1',type:'ball',x:ball.x,y:ball.y,cells:[{x:0,y:0}]}];
 for(let i=0;i<3;i++){const c=cells.pop();objects.push({id:'b'+(i+1),type:'brick',x:c.x,y:c.y,cells:[{x:0,y:0}]});}
 return{width:n,height:n,exit:randomExit(n,rng),moves:0,won:false,glueCount:0,brickCount:3,objects};
}
function makeCode(n,difficulty,seed,prefix='G'){return `${prefix}${n}${DIFFCODE[difficulty]}-${seed}`;}
function parseCode(raw){const m=String(raw).trim().toUpperCase().match(/^([BGW])([345])([EMH])-([0-9A-Z]{1,7})$/);if(!m)return null;return{prefix:m[1],n:+m[2],difficulty:CODEDIFF[m[3]],seed:m[4].padStart(7,'0')};}
function generateLevel(n,difficulty,seed=seedText(),prefix='W'){
 const [lo,hi]=ranges[difficulty];let fallback=null,cand=prefix==='B'?legacyCandidate:prefix==='G'?gluedCandidate:wallCandidate;
 for(let tries=0;tries<5000;tries++){const s=cand(n,seed,tries);if(!s)continue;const sol=solve(s,24);if(!sol)continue;
  if(!fallback||Math.abs(sol.length-(lo+hi)/2)<Math.abs(fallback.solution.length-(lo+hi)/2))fallback={state:s,solution:sol,attempt:tries};
  if(sol.length>=lo&&sol.length<=hi)return{state:s,solution:sol,attempt:tries,seed,code:makeCode(n,difficulty,seed,prefix)};
 }
 if(!fallback)throw Error("Nem sikerült pályát generálni.");
 return{...fallback,seed,code:makeCode(n,difficulty,seed,prefix),fallback:true};
}
