/* GGrid Artwork Theme Layout – v0.15.4
   Converts approved artwork coordinates into responsive geometry.
   Board cells stay square; directional hit zones are independent from their visual cue. */
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
  if(value&&typeof value==='object'&&('x'in value||'width'in value||'w'in value))return{x:finite(value.x),y:finite(value.y),width:finite(value.width??value.w),height:finite(value.height??value.h)};
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
  for(const key of ['board','boardSafe','hud','scene','header','victory']){const b=normalizeBox(src?.[key]);if(b)boxes[key]=b}
  if(!boxes.board&&boxes.boardSafe)boxes.board=boxes.boardSafe;
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
  root.style.setProperty('--art-design-width',String(r.design.width));root.style.setProperty('--art-design-height',String(r.design.height));
  root.style.setProperty('--art-design-ratio',String(r.design.width/r.design.height));
  for(const [name,box] of Object.entries(r.boxes))setBoxVars(root,name,box,r.design);
  return r;
 }
 function fitBoard(theme,cols,rows,width,height){
  const r=resolve(theme,width,height),safe=r.boxes.board||{x:0,y:0,width:r.design.width,height:r.design.height};
  const aspect=Math.max(.01,finite(cols,1)/Math.max(.01,finite(rows,1)));
  let bw=safe.width,bh=bw/aspect;
  if(bh>safe.height){bh=safe.height;bw=bh*aspect}
  return{...r,board:{x:safe.x+(safe.width-bw)/2,y:safe.y+(safe.height-bh)/2,width:bw,height:bh}};
 }
 function controlConfig(r,theme){
  const v=r.raw?.controlZones||r.raw?.controls||theme?.artwork?.controlZones||{};
  return{
   band:Math.max(36,finite(v.band??v.thickness,52)),
   gap:Math.max(0,finite(v.gap,6)),
   extend:Math.max(0,finite(v.extend,0))
  };
 }
 function controlZones(theme,boardBox,width,height){
  const r=resolve(theme,width,height),b=boardBox||r.boxes.board||{x:0,y:0,width:r.design.width,height:r.design.height},c=controlConfig(r,theme),e=c.extend;
  return{...r,zones:{
   up:{x:b.x-e,y:b.y-c.gap-c.band,width:b.width+e*2,height:c.band},
   down:{x:b.x-e,y:b.y+b.height+c.gap,width:b.width+e*2,height:c.band},
   left:{x:b.x-c.gap-c.band,y:b.y-e,width:c.band,height:b.height+e*2},
   right:{x:b.x+b.width+c.gap,y:b.y-e,width:c.band,height:b.height+e*2}
  }};
 }
 function applyBoxStyle(el,box,design){
  if(!el||!box)return;
  const p=pctBox(box,design);el.style.position='absolute';el.style.left=p.x+'%';el.style.top=p.y+'%';el.style.width=p.width+'%';el.style.height=p.height+'%';
 }
 function applyGameplay(root,board,theme,cols,rows,width,height){
  if(!root||!board)return null;
  const fit=fitBoard(theme,cols,rows,width,height),zones=controlZones(theme,fit.board,width,height).zones;
  apply(root,theme,width,height);applyBoxStyle(board,fit.board,fit.design);
  for(const dir of ['up','down','left','right'])applyBoxStyle(root.querySelector('.edge-'+dir),zones[dir],fit.design);
  root.style.setProperty('--art-board-aspect',String(Math.max(.01,finite(cols,1)/Math.max(.01,finite(rows,1)))));
  return{...fit,zones};
 }
 function clearBoxStyle(el){if(!el)return;for(const p of ['position','left','top','width','height'])el.style.removeProperty(p)}
 function clearGameplay(root,board){
  if(!root)return;clearBoxStyle(board||root.querySelector('.board'));for(const dir of ['up','down','left','right'])clearBoxStyle(root.querySelector('.edge-'+dir));
  const props=[];for(let i=0;i<root.style.length;i++)props.push(root.style[i]);for(const p of props)if(p.startsWith('--art-'))root.style.removeProperty(p);delete root.dataset.artLayout;
 }
 return{designSize,normalizeBox,layouts,modeFor,resolve,pctBox,apply,fitBoard,controlZones,applyBoxStyle,applyGameplay,clearBoxStyle,clearGameplay};
});
