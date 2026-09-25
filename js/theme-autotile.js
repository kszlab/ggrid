/* GGrid Theme Autotile v1
   Renders arbitrary multi-cell rigid bodies from two painted 3x3 material samples.
   Presentation only; physics/state are untouched. */
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
 function clear(el){
  if(!el||!el.classList.contains('sr-autotile'))return;
  el.classList.remove('sr-autotile');el.querySelectorAll(':scope>.sr-q').forEach(q=>q.remove());
 }
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
 return{quarterTypes,quarterSource,position,apply,clear};
});
