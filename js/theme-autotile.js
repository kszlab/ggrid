/* GGrid Theme Autotile v2
   Renders arbitrary multi-cell rigid bodies as ONE continuous silhouette.
   The body receives one continuous block texture and a textured outline sampled
   from the ring material. Physics/state are untouched. Legacy per-cell helpers
   remain exported for compatibility and regression tests. */
(function(root,factory){
 const api=factory();
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 if(root)root.ThemeAutotile=api;
})(typeof globalThis!=='undefined'?globalThis:this,()=>{
 const QUARTERS=['tl','tr','bl','br'];
 const RING={
  outer:{tl:[0,0],tr:[2,0],bl:[0,2],br:[2,2]},
  edgeH:{tl:[1,0],tr:[1,0],bl:[1,2],br:[1,2]},
  edgeV:{tl:[0,1],tr:[2,1],bl:[0,1],br:[2,1]},
  inner:{tl:[2,2],tr:[0,2],bl:[2,0],br:[0,0]}
 };
 const key=(x,y)=>x+','+y;
 function quarterTypes(cells,ci){
  const set=new Set(cells.map(c=>key(c.x,c.y))),c=cells[ci],out={};
  for(const q of QUARTERS){
   const dx=q[1]==='r'?1:-1,dy=q[0]==='b'?1:-1;
   const H=set.has(key(c.x+dx,c.y)),V=set.has(key(c.x,c.y+dy)),D=set.has(key(c.x+dx,c.y+dy));
   out[q]=!H&&!V?'outer':H&&!V?'edgeH':!H&&V?'edgeV':D?'fill':'inner';
  }
  return out;
 }
 function quarterSource(type,q){
  if(type==='fill')return{image:'block',qx:2+(q[1]==='r'?1:0),qy:2+(q[0]==='b'?1:0)};
  const [cx,cy]=RING[type][q];
  return{image:'ring',qx:cx*2+(q[1]==='r'?1:0),qy:cy*2+(q[0]==='b'?1:0)};
 }
 const position=(qx,qy)=>`${qx/5*100}% ${qy/5*100}%`;

 function bounds(cells){
  const xs=cells.map(c=>c.x),ys=cells.map(c=>c.y);
  const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
  return{minX,minY,maxX,maxY,cols:maxX-minX+1,rows:maxY-minY+1};
 }
 function boundaryLoops(cells){
  if(!Array.isArray(cells)||!cells.length)return[];
  const b=bounds(cells),set=new Set(cells.map(c=>key(c.x,c.y))),edges=[];
  const add=(a,b)=>edges.push({a,b,used:false});
  for(const c of cells){
   const x=c.x-b.minX,y=c.y-b.minY,gx=c.x,gy=c.y;
   if(!set.has(key(gx,gy-1)))add([x,y],[x+1,y]);
   if(!set.has(key(gx+1,gy)))add([x+1,y],[x+1,y+1]);
   if(!set.has(key(gx,gy+1)))add([x+1,y+1],[x,y+1]);
   if(!set.has(key(gx-1,gy)))add([x,y+1],[x,y]);
  }
  const outgoing=new Map();
  edges.forEach((e,i)=>{const k=key(e.a[0],e.a[1]);if(!outgoing.has(k))outgoing.set(k,[]);outgoing.get(k).push(i)});
  const loops=[];
  for(let start=0;start<edges.length;start++){
   if(edges[start].used)continue;
   const pts=[],first=edges[start].a.slice();let idx=start,guard=0;
   while(idx!=null&&!edges[idx].used&&guard++<edges.length+4){
    const e=edges[idx];e.used=true;if(!pts.length)pts.push(e.a.slice());pts.push(e.b.slice());
    if(e.b[0]===first[0]&&e.b[1]===first[1])break;
    const choices=(outgoing.get(key(e.b[0],e.b[1]))||[]).filter(i=>!edges[i].used);
    idx=choices.length?choices[0]:null;
   }
   if(pts.length>=4)loops.push(pts);
  }
  return loops;
 }
 function shapePath(cells){
  return boundaryLoops(cells).map(loop=>'M '+loop.map(p=>p[0]+' '+p[1]).join(' L ')+' Z').join(' ');
 }
 function clear(el){
  if(!el)return;
  if(el.classList.contains('sr-autotile')){
   el.classList.remove('sr-autotile');el.querySelectorAll(':scope>.sr-q').forEach(q=>q.remove());
  }
  if(el.classList.contains('sr-rigid-silhouette')){
   el.classList.remove('sr-rigid-silhouette');el.querySelectorAll(':scope>svg.sr-rigid-svg').forEach(q=>q.remove());
  }
 }
 /* Legacy per-cell renderer. Kept only as compatibility fallback. */
 function apply(el,o,ci,urls){
  if(!el||!o||!urls?.ring||!urls?.block)return false;
  const types=quarterTypes(o.cells,ci);
  el.classList.remove('sr-asset-visual');el.style.removeProperty('--sr-asset-image');
  el.classList.add('sr-autotile');el.innerHTML='';
  for(const q of QUARTERS){
   const s=quarterSource(types[q],q),i=document.createElement('i');
   i.className=`sr-q sr-q-${q} sr-q-${types[q]}`;i.setAttribute('aria-hidden','true');
   i.style.backgroundImage=`url("${String(urls[s.image]).replace(/"/g,'\\"')}")`;
   i.style.backgroundPosition=position(s.qx,s.qy);el.append(i);
  }
  return true;
 }
 function svgEl(name){return document.createElementNS('http://www.w3.org/2000/svg',name)}
 function applyComposite(el,o,urls){
  if(!el||!o||!Array.isArray(o.cells)||o.cells.length<2||!urls?.ring||!urls?.block)return false;
  clear(el);el.innerHTML='';el.classList.add('sr-rigid-silhouette');
  const b=bounds(o.cells),d=shapePath(o.cells),uid='sr-'+String(o.id||'rigid').replace(/[^a-zA-Z0-9_-]/g,'-')+'-'+Math.random().toString(36).slice(2,8);
  const svg=svgEl('svg');svg.classList.add('sr-rigid-svg');svg.setAttribute('viewBox',`0 0 ${b.cols} ${b.rows}`);svg.setAttribute('preserveAspectRatio','none');svg.setAttribute('aria-hidden','true');
  const defs=svgEl('defs');
  const clip=svgEl('clipPath');clip.id=uid+'-clip';clip.setAttribute('clipPathUnits','userSpaceOnUse');
  const cp=svgEl('path');cp.setAttribute('d',d);cp.setAttribute('fill-rule','evenodd');clip.append(cp);defs.append(clip);
  const pat=svgEl('pattern');pat.id=uid+'-ring';pat.setAttribute('patternUnits','userSpaceOnUse');pat.setAttribute('x','0');pat.setAttribute('y','0');pat.setAttribute('width',String(b.cols));pat.setAttribute('height',String(b.rows));
  const pi=svgEl('image');pi.setAttribute('href',urls.ring);pi.setAttribute('x','0');pi.setAttribute('y','0');pi.setAttribute('width',String(b.cols));pi.setAttribute('height',String(b.rows));pi.setAttribute('preserveAspectRatio','xMidYMid slice');pat.append(pi);defs.append(pat);svg.append(defs);
  const fill=svgEl('image');fill.classList.add('sr-rigid-fill');fill.setAttribute('href',urls.block);fill.setAttribute('x','0');fill.setAttribute('y','0');fill.setAttribute('width',String(b.cols));fill.setAttribute('height',String(b.rows));fill.setAttribute('preserveAspectRatio','xMidYMid slice');fill.setAttribute('clip-path',`url(#${uid}-clip)`);svg.append(fill);
  const shadow=svgEl('path');shadow.classList.add('sr-rigid-outline-shadow');shadow.setAttribute('d',d);shadow.setAttribute('fill','none');shadow.setAttribute('fill-rule','evenodd');shadow.setAttribute('vector-effect','non-scaling-stroke');svg.append(shadow);
  const outline=svgEl('path');outline.classList.add('sr-rigid-outline');outline.setAttribute('d',d);outline.setAttribute('fill','none');outline.setAttribute('fill-rule','evenodd');outline.setAttribute('vector-effect','non-scaling-stroke');outline.setAttribute('stroke',`url(#${uid}-ring)`);svg.append(outline);
  el.append(svg);return true;
 }
 return{quarterTypes,quarterSource,position,bounds,boundaryLoops,shapePath,apply,applyComposite,clear};
});
