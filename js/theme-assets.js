/* GGrid Artwork Theme Assets – v0.15.0
   Resolves and preloads artwork assets without coupling them to game logic. */
(function(root,factory){
 const api=factory();
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 if(root)root.ThemeAssets=api;
})(typeof globalThis!=='undefined'?globalThis:this,()=>{
 const IMAGE_RE=/\.(?:avif|gif|jpe?g|png|svg|webp)(?:\?.*)?$/i;
 function renderMode(theme){return theme?.renderMode||((theme?.artwork&&typeof theme.artwork==='object')?'artwork':'legacy')}
 function baseUrl(theme,fallback=''){
  return theme?.__url||fallback||'';
 }
 function resolveUrl(theme,src,fallback=''){
  if(typeof src!=='string'||!src.trim())return'';
  if(/^(?:data:|https?:|blob:|#)/i.test(src))return src;
  const base=baseUrl(theme,fallback);
  // Opt-in cache key for themes replacing artwork at existing file paths.
  // This leaves source paths stable for catalog validation and offline tooling.
  const version=theme?.artwork?.assetVersion;
  const versioned=url=>version==null?url:url+(url.includes('?')?'&':'?')+'art='+encodeURIComponent(version);
  try{
   if(typeof location!=='undefined')return versioned(new URL(src,new URL(base||location.href,location.href)).href);
   if(/^https?:/i.test(base))return versioned(new URL(src,base).href);
  }catch(_){}
  return versioned(src);
 }
 function source(spec,context={}){
  if(typeof spec==='string')return spec;
  if(!spec||typeof spec!=='object')return'';
  const dir=context.direction;
  if(dir&&spec.directions&&spec.directions[dir]!=null)return source(spec.directions[dir],context);
  if(dir&&spec[dir]!=null)return source(spec[dir],context);
  const layout=context.layout;
  if(layout&&spec.layouts&&spec.layouts[layout]!=null)return source(spec.layouts[layout],context);
  if(layout&&spec[layout]!=null)return source(spec[layout],context);
  if(spec.asset!=null)return source(spec.asset,context);
  if(spec.src!=null)return source(spec.src,context);
  if(spec.file!=null)return source(spec.file,context);
  return'';
 }
 function collect(theme){
  const out=new Set(),add=v=>{if(typeof v==='string'&&IMAGE_RE.test(v.trim()))out.add(v.trim())};
  for(const v of theme?.assets?.preload||[])add(v);
  const seen=new Set();
  function walk(v){
   if(v==null)return;
   if(typeof v==='string'){add(v);return}
   if(typeof v!=='object'||seen.has(v))return;
   seen.add(v);
   if(Array.isArray(v)){v.forEach(walk);return}
   for(const [k,x] of Object.entries(v)){
    if(['src','file','asset','portrait','landscape','up','down','left','right'].includes(k))walk(x);
    else if(typeof x==='object')walk(x);
   }
  }
  walk(theme?.artwork);
  return[...out];
 }
 async function preload(theme,fallback=''){
  if(typeof Image==='undefined')return[];
  const loaded=[];
  await Promise.allSettled(collect(theme).map(src=>new Promise(resolve=>{
   const url=resolveUrl(theme,src,fallback),img=new Image();let done=false;
   const finish=()=>{if(done)return;done=true;loaded.push(url);resolve(url)};
   img.onload=finish;img.onerror=finish;img.src=url;if(img.complete)finish();
  })));
  return loaded;
 }
 return{renderMode,baseUrl,resolveUrl,source,collect,preload};
});
