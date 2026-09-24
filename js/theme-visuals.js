/* GGrid Theme Visuals V3
   Deterministic presentation helpers. No game-state or physics logic. */
(function(root,factory){
 const api=factory();
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 if(root)root.ThemeVisuals=api;
})(typeof globalThis!=='undefined'?globalThis:this,()=>{
 function hash(value){
  const s=String(value??'');let h=2166136261;
  for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}
  return h>>>0;
 }
 function finiteNumber(value,fallback,min=-Infinity,max=Infinity){
  const n=Number(value);if(!Number.isFinite(n))return fallback;
  return Math.min(max,Math.max(min,n));
 }
 function pieceInset(theme){return finiteNumber(theme?.render?.pieceInsetPx,1.8,0,20)}
 function rigidInset(theme){
  const raw=theme?.render?.rigidInsetPx;
  return raw==null?pieceInset(theme):finiteNumber(raw,pieceInset(theme),0,20);
 }
 function moveMs(theme){return finiteNumber(theme?.render?.moveMs,190,0,2000)}
 function variantIndex(list,key){
  return Array.isArray(list)&&list.length?hash(key)%list.length:-1;
 }
 function choose(list,key){
  const i=variantIndex(list,key);return i<0?null:list[i];
 }
 function classes(value){return String(value||'').split(/\s+/).filter(Boolean)}
 function mergeSpec(base,variant){
  if(!base&&!variant)return null;
  const a=base&&typeof base==='object'?base:{},b=variant&&typeof variant==='object'?variant:{};
  const out={...a,...b};delete out.variants;
  const merged=[...new Set([...classes(a.className),...classes(b.className)])];
  if(merged.length)out.className=merged.join(' ');else delete out.className;
  if(b.markup==null&&a.markup!=null)out.markup=a.markup;
  return out;
 }
 function resolveSpec(spec,key){
  if(!spec||typeof spec!=='object')return spec||null;
  const selected=choose(spec.variants,key);
  return mergeSpec(spec,selected);
 }
 function cellVariant(theme,x,y,w,h){
  return choose(theme?.board?.cellVariants,`${theme?.id||'theme'}:cell:${w}x${h}:${x},${y}`);
 }
 return{hash,finiteNumber,pieceInset,rigidInset,moveMs,variantIndex,choose,mergeSpec,resolveSpec,cellVariant};
});
