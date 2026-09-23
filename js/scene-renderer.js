/* GGrid Scene Renderer 2 – v0.12.52
   Presentation-only layer. Never changes Game State or physics. */
const SceneRenderer=(()=>{
 let theme=null,wrap=null,back=null,front=null,frame=null,boardRef=null,componentOverlays=[];
 function ensure(){
  wrap=document.querySelector('.board-wrap');if(!wrap)return;
  if(!back){back=document.createElement('div');back.className='scene-layer scene-back';wrap.prepend(back)}
  if(!frame){frame=document.createElement('div');frame.className='scene-frame';wrap.append(frame)}
  if(!front){front=document.createElement('div');front.className='scene-layer scene-front';wrap.append(front)}
 }
 function apply(t){
  /* A restart re-applies the same theme while the board DOM has already been
     rebuilt. Composite overlays belong to that old board, so discard the
     cached nodes before rendering the restarted state. */
  clearComponentOverlays();boardRef=null;
  theme=t||null;ensure();const type=t?.scene?.type||'';
  document.body.dataset.scene=type;wrap.dataset.scene=type;document.body.dataset.uiSkin=t?.ui?.skin||'';document.body.classList.toggle('full-ui-skin',t?.ui?.skin==='full');const st=wrap.querySelector('.skin-scene-title');if(st){st.querySelector('strong').textContent=(t?.name||'GGrid').split('//')[0].trim();st.querySelector('span').textContent=document.body.classList.contains('scenario-mode')?'Forgatókönyv':'Szabad játék'}
  const m=t?.scene?.markup||{};back.innerHTML=m.back||'';front.innerHTML=m.front||'';frame.innerHTML='';
  wrap.classList.toggle('scene-showcase',t?.scene?.tier==='showcase');
 }
 function decorateExit(el){
  if(!el||!theme)return;
  const spec=theme.pieces?.exit;if(!spec)return;
  if(spec.className)el.classList.add(...String(spec.className).split(/\s+/).filter(Boolean));
  if(spec.markup!=null)el.innerHTML=spec.markup;
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
 function decoratePiece(el,o,ci){
  if(!el||!theme)return;const cp=componentInfo(o,ci);
  el.dataset.part=String(ci);el.dataset.componentSize=String(cp.count);
  el.classList.toggle('sr-component',cp.count>1);
  for(const k of ['left','right','top','bottom'])el.classList.toggle('sr-open-'+k,cp[k]);
  el.classList.toggle('sr-horizontal',cp.count>1&&cp.h===1);el.classList.toggle('sr-vertical',cp.count>1&&cp.w===1);
  el.classList.toggle('sr-rigid-cell',o.type==='brick'&&cp.count>1);
  const spec=theme.pieces?.[o.type];if(!spec)return;
  if(spec.className)el.classList.add(...String(spec.className).split(/\s+/).filter(Boolean));
  if(spec.markup!=null)el.innerHTML=pieceMarkup(spec.markup,cp,ci);
 }
 function clearComponentOverlays(){componentOverlays.forEach(el=>el.remove());componentOverlays=[]}
 function buildComponentOverlays(board){
  const spec=theme?.pieces?.rigidBody;if(!spec?.markup&&!spec?.className)return;
  const live=new Set(),w=state?.width||1,h=state?.height||w,cellX=100/w,cellY=100/h,inset=1.8;
  for(const o of (state?.objects||[])){
   if(o.exited||o.type!=='brick'||(o.cells||[]).length<2)continue;
   const id=String(o.id);live.add(id);
   const xs=o.cells.map(q=>q.x),ys=o.cells.map(q=>q.y),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
   /* A single rectangular composite may only cover a completely filled footprint.
      L/U/sparse rigid bodies have legal empty cells inside their bounding box; a
      bounding-box overlay would visually cover balls or other pieces in those cells. */
   const boxArea=(maxX-minX+1)*(maxY-minY+1);
   /* Rectangular bodies use one showcase overlay. Irregular polyominoes stay
      cell-composed; their joined-edge classes fuse them into one uniformly
      themed body without painting over logical holes. */
   const rectangular=o.cells.length===boxArea;
   board.querySelectorAll('.piece[data-id="'+CSS.escape(id)+'"]').forEach(el=>el.classList.toggle('sr-composite-source',rectangular));
   if(!rectangular)continue;
   let ov=componentOverlays.find(el=>el.isConnected&&el.parentElement===board&&el.dataset.objectId===id);
   if(!ov){ov=document.createElement('div');ov.className=spec.className||'sr-composite';ov.dataset.objectId=id;ov.innerHTML=spec.markup||'';board.append(ov);componentOverlays.push(ov);}
   ov.style.left=`calc(${(o.x+minX)*cellX}% + ${inset}px)`;
   ov.style.top=`calc(${(o.y+minY)*cellY}% + ${inset}px)`;
   ov.style.width=`calc(${(maxX-minX+1)*cellX}% - ${inset*2}px)`;
   ov.style.height=`calc(${(maxY-minY+1)*cellY}% - ${inset*2}px)`;
  }
  componentOverlays=componentOverlays.filter(el=>{if(live.has(el.dataset.objectId))return true;el.remove();return false});
 }
 function afterBoardRender(board){
  boardRef=board;if(!theme)return;decorateExit(board.querySelector('.exit'));
  const byId=new Map((state?.objects||[]).map(o=>[String(o.id),o]));
  board.querySelectorAll('.piece').forEach(el=>{const o=byId.get(String(el.dataset.id));if(o)decoratePiece(el,o,+(el.dataset.cellkey?.split(':')[1]||0))});
  buildComponentOverlays(board);
 }
 function setDirection(dir){if(!wrap)return;wrap.dataset.moveDir=dir||''}
 function event(kind){
  ensure();if(!wrap||!theme)return;
  wrap.classList.remove('fx-move','fx-blocked','fx-freeze','fx-exit','fx-win');void wrap.offsetWidth;
  wrap.classList.add('fx-'+kind);setTimeout(()=>wrap?.classList.remove('fx-'+kind),kind==='win'?900:420);
 }
 function clear(){clearComponentOverlays();theme=null;ensure();document.body.dataset.scene='';document.body.dataset.uiSkin='';document.body.classList.remove('full-ui-skin');wrap.dataset.scene='';wrap.classList.remove('scene-showcase');back.innerHTML='';front.innerHTML='';frame.innerHTML=''}
 return{apply,afterBoardRender,event,setDirection,clear,get theme(){return theme}};
})();