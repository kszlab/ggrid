/* GGrid Scene Renderer 3 – v0.15.0
   Presentation-only layer. Never changes Game State or physics.
   Legacy CSS themes remain supported; artwork themes use explicit asset/layout layers. */
const SceneRenderer=(()=>{
 let theme=null,wrap=null,back=null,front=null,frame=null,boardRef=null,componentOverlays=[],warnedMissingShapes=new Set();
 let artworkLayers=new Map(),resizeBound=false;

 function ensure(){
  wrap=document.querySelector('.board-wrap');if(!wrap)return;
  if(!back){back=document.createElement('div');back.className='scene-layer scene-back';wrap.prepend(back)}
  if(!frame){frame=document.createElement('div');frame.className='scene-frame';wrap.append(frame)}
  if(!front){front=document.createElement('div');front.className='scene-layer scene-front';wrap.append(front)}
  ensureArtworkLayers();
  if(!resizeBound&&typeof addEventListener==='function'){addEventListener('resize',refreshArtworkLayout,{passive:true});resizeBound=true}
 }
 function ensureArtworkLayers(){
  if(!wrap)return;
  const defs=[
   ['background','scene-artwork-layer scene-artwork-background'],
   ['environment','scene-artwork-layer scene-artwork-environment'],
   ['boardBack','scene-artwork-layer scene-artwork-board-back'],
   ['boardFront','scene-artwork-layer scene-artwork-board-front'],
   ['foreground','scene-artwork-layer scene-artwork-foreground'],
   ['effects','scene-artwork-layer scene-artwork-effects']
  ];
  for(const [key,cl] of defs){
   let el=artworkLayers.get(key);
   if(!el||!el.isConnected){el=document.createElement('div');el.className=cl;el.dataset.artLayer=key;wrap.append(el);artworkLayers.set(key,el)}
  }
 }
 function renderMode(){return globalThis.ThemeAssets?.renderMode?.(theme)||(theme?.renderMode||'legacy')}
 function artworkLayout(){
  if(renderMode()!=='artwork'||!wrap)return null;
  return globalThis.ThemeLayout?.apply?.(wrap,theme,innerWidth,innerHeight)||null;
 }
 function layerSpec(key){
  const layers=theme?.artwork?.layers||{};
  return layers[key]??null;
 }
 function renderArtworkLayer(key,layoutMode){
  const el=artworkLayers.get(key);if(!el)return;
  const spec=layerSpec(key);el.innerHTML='';el.style.removeProperty('--art-layer-image');el.hidden=!spec;
  if(!spec)return;
  el.className='scene-artwork-layer scene-artwork-'+key.replace(/[A-Z]/g,m=>'-'+m.toLowerCase());
  if(spec?.className)el.classList.add(...String(spec.className).split(/\s+/).filter(Boolean));
  const src=globalThis.ThemeAssets?.source?.(spec,{layout:layoutMode})||'';
  if(src){
   const img=document.createElement('img');img.alt='';img.draggable=false;img.decoding='async';
   img.src=globalThis.ThemeAssets?.resolveUrl?.(theme,src)||src;el.append(img);
  }
  if(spec?.markup!=null)el.insertAdjacentHTML('beforeend',spec.markup);
 }
 function refreshArtworkLayout(){
  if(!theme||renderMode()!=='artwork'||!wrap)return;
  const r=artworkLayout(),mode=r?.mode||'portrait';
  for(const key of artworkLayers.keys())renderArtworkLayer(key,mode);
 }
 function clearArtwork(){
  for(const el of artworkLayers.values()){el.innerHTML='';el.hidden=true}
  if(wrap){delete wrap.dataset.artLayout;wrap.classList.remove('scene-artwork')}
 }
 function apply(t){
  /* A restart re-applies the same theme while the board DOM has already been
     rebuilt. Composite overlays belong to that old board, so discard the
     cached nodes before rendering the restarted state. */
  clearComponentOverlays();boardRef=null;warnedMissingShapes.clear();
  theme=t||null;ensure();const type=t?.scene?.type||t?.id||'',mode=globalThis.ThemeAssets?.renderMode?.(t)||(t?.renderMode||'legacy');
  document.body.dataset.scene=type;wrap.dataset.scene=type;document.body.dataset.themeRender=mode;wrap.dataset.themeRender=mode;
  document.body.dataset.uiSkin=t?.ui?.skin||'';document.body.classList.toggle('full-ui-skin',t?.ui?.skin==='full');
  const st=wrap.querySelector('.skin-scene-title');
  if(st){
   st.hidden=mode==='artwork';
   if(mode!=='artwork'){st.querySelector('strong').textContent=(t?.name||'GGrid').split('//')[0].trim();st.querySelector('span').textContent=t?.scene?.subtitle||(document.body.classList.contains('scenario-mode')?'Forgatókönyv':'Szabad játék')}
  }
  wrap.style.setProperty('--ggrid-piece-move',`${globalThis.ThemeVisuals?.moveMs?.(t)??190}ms`);
  wrap.classList.toggle('scene-artwork',mode==='artwork');
  wrap.classList.toggle('scene-showcase',mode==='artwork'||t?.scene?.tier==='showcase');
  if(mode==='artwork'){
   back.innerHTML='';front.innerHTML='';frame.innerHTML='';refreshArtworkLayout();
  }else{
   clearArtwork();const m=t?.scene?.markup||{};back.innerHTML=m.back||'';front.innerHTML=m.front||'';frame.innerHTML=m.frame||'';
  }
 }
 function artworkPieceSpec(type){
  const p=theme?.artwork?.pieces||{};
  if(type==='brick')return p.brickSingle||p.brick||null;
  return p[type]||null;
 }
 function applyAsset(el,spec,context={}){
  el.classList.remove('sr-asset-visual');el.style.removeProperty('--sr-asset-image');
  const src=globalThis.ThemeAssets?.source?.(spec?.asset??spec,{layout:wrap?.dataset?.artLayout||'',...context})||'';
  if(!src)return false;
  const url=globalThis.ThemeAssets?.resolveUrl?.(theme,src)||src;
  el.classList.add('sr-asset-visual');el.style.setProperty('--sr-asset-image',`url("${String(url).replace(/"/g,'\\\"')}")`);return true;
 }
 function decorateExit(el){
  if(!el||!theme)return;
  const prev=String(el.dataset.srExitClasses||'').split(/\s+/).filter(Boolean);if(prev.length)el.classList.remove(...prev);delete el.dataset.srExitClasses;el.innerHTML='';
  const raw=artworkPieceSpec('exit')||theme.pieces?.exit,spec=resolvedSpec(raw,`${theme?.id||'theme'}:exit:${state?.exit?.x??0},${state?.exit?.y??0}:${state?.exit?.dir||''}`);if(!spec)return;
  const cl=String(spec.className||'').split(/\s+/).filter(Boolean);if(cl.length){el.classList.add(...cl);el.dataset.srExitClasses=cl.join(' ')}
  if(spec.markup!=null)el.innerHTML=spec.markup;
  applyAsset(el,spec,{direction:state?.exit?.dir||''});
 }
 function componentInfo(o,ci){
  const cells=o.cells||[],c=cells[ci]||{x:0,y:0},xs=cells.map(q=>q.x),ys=cells.map(q=>q.y);
  const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
  return{count:cells.length,x:c.x-minX,y:c.y-minY,w:maxX-minX+1,h:maxY-minY+1,
   left:!cells.some(q=>q.x===c.x-1&&q.y===c.y),right:!cells.some(q=>q.x===c.x+1&&q.y===c.y),
   top:!cells.some(q=>q.x===c.x&&q.y===c.y-1),bottom:!cells.some(q=>q.x===c.x&&q.y===c.y+1)};
 }
 function pieceMarkup(template,cp,ci){
  return template.replace(/\{\{(first|multi):([^|{}]*)\|([^{}]*)\}\}/g,(_,condition,yes,no)=>
   (condition==='first'?cp.count>1&&ci===0:cp.count>1)?yes:no);
 }
 function resolvedSpec(spec,key){return globalThis.ThemeVisuals?.resolveSpec?.(spec,key)||spec}
 function clearCellDecorations(board){
  board?.querySelectorAll?.('.cell').forEach(el=>{const prev=String(el.dataset.srCellClasses||'').split(/\s+/).filter(Boolean);if(prev.length)el.classList.remove(...prev);delete el.dataset.srCellClasses;delete el.dataset.themeCellVariant;el.innerHTML='';el.classList.remove('sr-asset-visual');el.style.removeProperty('--sr-asset-image')});
 }
 function decorateCells(board){
  clearCellDecorations(board);
  const art=theme?.artwork?.board?.cellVariants,legacy=theme?.board?.cellVariants,variants=Array.isArray(art)&&art.length?art:legacy;
  if(!Array.isArray(variants)||!variants.length)return;
  const w=state?.width||1,h=state?.height||1;
  board.querySelectorAll('.cell').forEach((el,i)=>{const x=Number(el.dataset.x??i%w),y=Number(el.dataset.y??Math.floor(i/w)),v=globalThis.ThemeVisuals?.choose?.(variants,`${theme?.id||'theme'}:cell:${w}x${h}:${x},${y}`)||null;if(!v)return;const cl=String(v.className||'').split(/\s+/).filter(Boolean);if(cl.length){el.classList.add(...cl);el.dataset.srCellClasses=cl.join(' ')}if(v.markup!=null)el.innerHTML=v.markup;applyAsset(el,v);el.dataset.themeCellVariant=String(globalThis.ThemeVisuals?.variantIndex?.(variants,`${theme?.id||'theme'}:cell:${w}x${h}:${x},${y}`)??'')});
 }
 function decoratePiece(el,o,ci){
  if(!el||!theme)return;const cp=componentInfo(o,ci);
  el.dataset.part=String(ci);el.dataset.componentSize=String(cp.count);
  el.classList.toggle('sr-component',cp.count>1);
  for(const k of ['left','right','top','bottom'])el.classList.toggle('sr-open-'+k,cp[k]);
  el.classList.toggle('sr-horizontal',cp.count>1&&cp.h===1);el.classList.toggle('sr-vertical',cp.count>1&&cp.w===1);
  el.classList.toggle('sr-rigid-cell',o.type==='brick'&&cp.count>1);
  const raw=artworkPieceSpec(o.type)||theme.pieces?.[o.type],spec=resolvedSpec(raw,`${theme?.id||'theme'}:${o.type}:${o.id}`);if(!spec)return;
  if(spec.className)el.classList.add(...String(spec.className).split(/\s+/).filter(Boolean));
  if(spec.markup!=null)el.innerHTML=pieceMarkup(spec.markup,cp,ci);
  applyAsset(el,spec);
 }
 function clearComponentOverlays(){componentOverlays.forEach(el=>el.remove());componentOverlays=[]}
 function buildComponentOverlays(board){
  const artPieces=theme?.artwork?.pieces||{},baseSpec=artPieces.rigidBody||theme?.pieces?.rigidBody;
  const variants=artPieces.rigidShapes||artPieces.rigidBodyVariants||theme?.pieces?.rigidBodyVariants||{},hasVariants=Object.keys(variants).length>0;
  if(!baseSpec&&!hasVariants)return;
  const live=new Set(),w=state?.width||1,h=state?.height||w,cellX=100/w,cellY=100/h,inset=globalThis.ThemeVisuals?.rigidInset?.(theme)??1.8;
  for(const o of (state?.objects||[])){
   if(o.exited||o.type!=='brick'||(o.cells||[]).length<2)continue;
   const id=String(o.id),shapeId=globalThis.RigidShapes?.identify?.(o.cells)||'';
   const xs=o.cells.map(q=>q.x),ys=o.cells.map(q=>q.y),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
   const boxArea=(maxX-minX+1)*(maxY-minY+1);
   const rectangular=globalThis.RigidShapes?.isRectangular?.(o.cells)??(o.cells.length===boxArea);
   const rawVariant=shapeId?variants[shapeId]:null,useComposite=!!rawVariant||!!baseSpec&&rectangular,rawSpec=rawVariant||baseSpec,spec=resolvedSpec(rawSpec,`${theme?.id||'theme'}:rigid:${shapeId}:${o.id}`);
   board.querySelectorAll('.piece[data-id="'+CSS.escape(id)+'"]').forEach(el=>el.classList.toggle('sr-composite-source',useComposite));
   if(!useComposite){
    if(hasVariants&&shapeId){
     const warnKey=(theme?.id||'theme')+':'+shapeId;
     if(!warnedMissingShapes.has(warnKey)){warnedMissingShapes.add(warnKey);console.warn('[GGrid Theme] Missing rigid-body variant:',theme?.id||'unknown',shapeId,'-> cell fallback')}
    }
    continue;
   }
   live.add(id);
   if(hasVariants&&!rawVariant&&shapeId){
    const warnKey=(theme?.id||'theme')+':'+shapeId;
    if(!warnedMissingShapes.has(warnKey)){warnedMissingShapes.add(warnKey);console.warn('[GGrid Theme] Missing rigid-body variant:',theme?.id||'unknown',shapeId,'-> generic composite fallback')}
   }
   let ov=componentOverlays.find(el=>el.isConnected&&el.parentElement===board&&el.dataset.objectId===id);
   if(!ov){ov=document.createElement('div');ov.dataset.objectId=id;board.append(ov);componentOverlays.push(ov);}
   ov.className=spec?.className||'sr-composite';
   if(shapeId){ov.dataset.shapeId=shapeId;const shapeClass=globalThis.RigidShapes?.cssClass?.(shapeId);if(shapeClass)ov.classList.add(shapeClass)}else delete ov.dataset.shapeId;
   ov.innerHTML=spec?.markup??'';applyAsset(ov,spec);
   ov.classList.toggle('sr-wide',maxX-minX>maxY-minY);ov.classList.toggle('sr-tall',maxY-minY>maxX-minX);ov.classList.toggle('sr-square',maxX-minX===maxY-minY);
   ov.style.left=`calc(${(o.x+minX)*cellX}% + ${inset}px)`;ov.style.top=`calc(${(o.y+minY)*cellY}% + ${inset}px)`;
   ov.style.width=`calc(${(maxX-minX+1)*cellX}% - ${inset*2}px)`;ov.style.height=`calc(${(maxY-minY+1)*cellY}% - ${inset*2}px)`;
   ov.style.setProperty('--sg-tile-w',`${100/(maxX-minX+1)}%`);ov.style.setProperty('--sg-tile-h',`${100/(maxY-minY+1)}%`);
   ov.style.setProperty('--sr-shape-cols',String(maxX-minX+1));ov.style.setProperty('--sr-shape-rows',String(maxY-minY+1));
  }
  componentOverlays=componentOverlays.filter(el=>{if(live.has(el.dataset.objectId))return true;el.remove();return false});
 }
 function afterBoardRender(board){
  boardRef=board;if(!theme)return;decorateCells(board);decorateExit(board.querySelector('.exit'));
  const byId=new Map((state?.objects||[]).map(o=>[String(o.id),o]));
  board.querySelectorAll('.piece').forEach(el=>{const o=byId.get(String(el.dataset.id));if(o)decoratePiece(el,o,+(el.dataset.cellkey?.split(':')[1]||0))});
  buildComponentOverlays(board);
 }
 function setDirection(dir){if(!wrap)return;wrap.dataset.moveDir=dir||''}
 function event(kind){
  ensure();if(!wrap||!theme)return;wrap.classList.remove('fx-move','fx-blocked','fx-freeze','fx-exit','fx-win');void wrap.offsetWidth;
  wrap.classList.add('fx-'+kind);setTimeout(()=>wrap?.classList.remove('fx-'+kind),kind==='win'?900:420);
 }
 function clear(){
  clearComponentOverlays();warnedMissingShapes.clear();if(boardRef)clearCellDecorations(boardRef);theme=null;ensure();
  document.body.dataset.scene='';document.body.dataset.uiSkin='';document.body.dataset.themeRender='';document.body.classList.remove('full-ui-skin');
  wrap.dataset.scene='';wrap.dataset.themeRender='';wrap.classList.remove('scene-showcase','scene-artwork');wrap.style.removeProperty('--ggrid-piece-move');
  back.innerHTML='';front.innerHTML='';frame.innerHTML='';clearArtwork();
 }
 return{apply,afterBoardRender,event,setDirection,refreshArtworkLayout,clear,get theme(){return theme}};
})();
