/* GGrid Artwork 9-slice Frame – v0.15.2 */
(function(root,factory){
 const api=factory();
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 if(root)root.ThemeFrame=api;
})(typeof globalThis!=='undefined'?globalThis:this,()=>{
 function n(v,f=0){const x=Number(v);return Number.isFinite(x)?x:f}
 function quad(v,fallback=0){
  if(Array.isArray(v)){
   if(v.length===1)return{top:n(v[0],fallback),right:n(v[0],fallback),bottom:n(v[0],fallback),left:n(v[0],fallback)};
   if(v.length===2)return{top:n(v[0],fallback),right:n(v[1],fallback),bottom:n(v[0],fallback),left:n(v[1],fallback)};
   if(v.length===3)return{top:n(v[0],fallback),right:n(v[1],fallback),bottom:n(v[2],fallback),left:n(v[1],fallback)};
   if(v.length>=4)return{top:n(v[0],fallback),right:n(v[1],fallback),bottom:n(v[2],fallback),left:n(v[3],fallback)};
  }
  if(v&&typeof v==='object')return{top:n(v.top,fallback),right:n(v.right,fallback),bottom:n(v.bottom,fallback),left:n(v.left,fallback)};
  const x=n(v,fallback);return{top:x,right:x,bottom:x,left:x};
 }
 function frameBox(board,expand=0){
  const e=quad(expand,0);
  return{x:board.x-e.left,y:board.y-e.top,width:board.width+e.left+e.right,height:board.height+e.top+e.bottom};
 }
 function clear(el){
  if(!el)return;el.hidden=true;el.style.cssText='';el.className='scene-artwork-frame';
 }
 function apply(el,rootEl,theme,spec,geometry){
  if(!el||!rootEl||!spec||!geometry?.board||!geometry?.design){clear(el);return null}
  const mode=geometry.mode||rootEl.dataset.artLayout||'portrait',src=globalThis.ThemeAssets?.source?.(spec,{layout:mode})||'';
  if(!src){clear(el);return null}
  const box=frameBox(geometry.board,spec.expand??spec.inset??0);globalThis.ThemeLayout?.applyBoxStyle?.(el,box,geometry.design);
  const source=globalThis.ThemeAssets?.resolveUrl?.(theme,src)||src,slice=quad(spec.slice,64),width=quad(spec.width??spec.borderWidth,18);
  const rect=rootEl.getBoundingClientRect(),sx=rect.width/geometry.design.width,sy=rect.height/geometry.design.height;
  el.hidden=false;el.className='scene-artwork-frame'+(spec.className?' '+spec.className:'');
  el.style.borderStyle='solid';
  el.style.borderTopWidth=Math.max(1,width.top*sy)+'px';el.style.borderRightWidth=Math.max(1,width.right*sx)+'px';
  el.style.borderBottomWidth=Math.max(1,width.bottom*sy)+'px';el.style.borderLeftWidth=Math.max(1,width.left*sx)+'px';
  el.style.borderImageSource=`url("${String(source).replace(/"/g,'\\\"')}")`;
  el.style.borderImageSlice=`${slice.top} ${slice.right} ${slice.bottom} ${slice.left}${spec.fill?' fill':''}`;
  el.style.borderImageRepeat=spec.repeat||'stretch';el.style.pointerEvents='none';
  return{box,slice,width,source};
 }
 return{quad,frameBox,clear,apply};
});
