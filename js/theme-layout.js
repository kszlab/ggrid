/* GGrid Artwork Theme Layout – v0.15.0
   Converts approved artwork coordinates into responsive CSS variables. */
(function(root,factory){
 const api=factory();
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 if(root)root.ThemeLayout=api;
})(typeof globalThis!=='undefined'?globalThis:this,()=>{
 function finite(v,fallback=0){const n=Number(v);return Number.isFinite(n)?n:fallback}
 function designSize(layout){
  const v=layout?.designSize||layout?.size;
  if(Array.isArray(v)&&v.length>=2)return{width:Math.max(1,finite(v[0],1)),height:Math.max(1,finite(v[1],1))};
  return{width:Math.max(1,finite(v?.width,1)),height:Math.max(1,finite(v?.height,1))};
 }
 function normalizeBox(value){
  if(Array.isArray(value)&&value.length>=4)return{x:finite(value[0]),y:finite(value[1]),width:finite(value[2]),height:finite(value[3])};
  if(value&&typeof value==='object')return{x:finite(value.x),y:finite(value.y),width:finite(value.width??value.w),height:finite(value.height??value.h)};
  return null;
 }
 function layouts(theme){return theme?.artwork?.layouts||theme?.layout||{}}
 function modeFor(theme,width,height){
  const all=layouts(theme),hasP=!!all.portrait,hasL=!!all.landscape;
  if(hasP&&!hasL)return'portrait';if(hasL&&!hasP)return'landscape';
  const threshold=Math.max(.5,finite(theme?.artwork?.landscapeMinAspect,1.05));
  return width/Math.max(1,height)>=threshold?'landscape':'portrait';
 }
 function resolve(theme,width=0,height=0){
  const mode=modeFor(theme,width,height),all=layouts(theme),raw=all[mode]||all.portrait||all.landscape||{};
  const design=designSize(raw),boxes={};
  const src=raw.boxes||raw;
  for(const key of ['board','hud','controls','scene','header','victory']){const b=normalizeBox(src?.[key]);if(b)boxes[key]=b}
  return{mode,design,boxes,raw};
 }
 function pctBox(box,design){
  if(!box)return null;
  return{x:100*box.x/design.width,y:100*box.y/design.height,width:100*box.width/design.width,height:100*box.height/design.height};
 }
 function setBoxVars(root,name,box,design){
  const p=pctBox(box,design);if(!p)return;
  for(const [k,v] of Object.entries(p))root.style.setProperty(`--art-${name}-${k}`,v+'%');
 }
 function apply(root,theme,width,height){
  if(!root)return null;
  const w=finite(width,typeof innerWidth!=='undefined'?innerWidth:1),h=finite(height,typeof innerHeight!=='undefined'?innerHeight:1);
  const r=resolve(theme,w,h);root.dataset.artLayout=r.mode;
  root.style.setProperty('--art-design-width',String(r.design.width));
  root.style.setProperty('--art-design-height',String(r.design.height));
  for(const [name,box] of Object.entries(r.boxes))setBoxVars(root,name,box,r.design);
  return r;
 }
 return{designSize,normalizeBox,layouts,modeFor,resolve,pctBox,apply};
});
