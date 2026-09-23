/* GGrid Scene Renderer 2 – v0.12.51
   Presentation-only layer. Never changes Game State or physics. */
const SceneRenderer=(()=>{
 let theme=null,wrap=null,back=null,front=null,frame=null,boardRef=null,componentOverlays=[];
 function ensure(){
  wrap=document.querySelector('.board-wrap');if(!wrap)return;
  if(!back){back=document.createElement('div');back.className='scene-layer scene-back';wrap.prepend(back)}
  if(!frame){frame=document.createElement('div');frame.className='scene-frame';wrap.append(frame)}
  if(!front){front=document.createElement('div');front.className='scene-layer scene-front';wrap.append(front)}
 }
 function markup(type){
  if(theme?.scene?.markup)return{back:theme.scene.markup.back||'',front:theme.scene.markup.front||''};
  if(type==='clockwork-sanctum')return {
   back:'<i class="sr-stars"></i><i class="sr-arch"></i><i class="sr-gear sg1"></i><i class="sr-gear sg2"></i><i class="sr-orrery"></i>',
   front:'<i class="sr-steam ss1"></i><i class="sr-steam ss2"></i><span class="sr-caption">AETHERIUM OBSERVATORY <b>03:17</b></span>'};
  if(type==='neon-noir')return {
   back:'<i class="sr-city"></i><i class="sr-holo">九<small>SECTOR 9</small></i><i class="sr-glow"></i>',
   front:'<i class="sr-rain"></i><i class="sr-vapor"></i><span class="sr-caption neon">ACID RAIN // ROOFTOP 09 <b>EVAC</b></span>'};
  if(type==='microchip-lab')return {
   back:'<i class="sr-pcb"></i><i class="sr-trace tr1"></i><i class="sr-trace tr2"></i><i class="sr-capacitor"></i>',
   front:'<i class="sr-signal"></i><span class="sr-caption circuit">MICROCORE // BUS 16 <b>CLK 4.77</b></span>'};
  if(type==='moonlit-zen')return {
   back:'<i class="sr-moon"></i><i class="sr-mountain"></i><i class="sr-water"></i>',
   front:'<i class="sr-mist"></i><i class="sr-fireflies"></i><span class="sr-caption zen">MOON GARDEN // 静 <b>水</b></span>'};
  return{back:'',front:''};
 }
 function apply(t){
  /* A restart re-applies the same theme while the board DOM has already been
     rebuilt. Composite overlays belong to that old board, so discard the
     cached nodes before rendering the restarted state. */
  clearComponentOverlays();boardRef=null;
  theme=t||null;ensure();const type=t?.scene?.type||'';
  document.body.dataset.scene=type;wrap.dataset.scene=type;document.body.dataset.uiSkin=t?.ui?.skin||'';document.body.classList.toggle('full-ui-skin',t?.ui?.skin==='full');const st=wrap.querySelector('.skin-scene-title');if(st){st.querySelector('strong').textContent=(t?.name||'GGrid').split('//')[0].trim();st.querySelector('span').textContent=document.body.classList.contains('scenario-mode')?'Forgatókönyv':'Szabad játék'}
  const m=markup(type);back.innerHTML=m.back;front.innerHTML=m.front;frame.innerHTML='';
  wrap.classList.toggle('scene-showcase',t?.scene?.tier==='showcase');
 }
 function decorateExit(el){
  if(!el||!theme)return;const type=theme.scene?.type;
  if(theme?.pieces?.exit?.markup!=null){el.classList.add('sr-exit');el.innerHTML=theme.pieces.exit.markup;return}
  if(type==='clockwork-sanctum'){el.classList.add('sr-exit','sr-astrolabe');el.innerHTML='<i></i><b>✦</b>'}
  if(type==='neon-noir'){el.classList.add('sr-exit','sr-evac');el.innerHTML='<b>09</b><small>EVAC</small>'}
  if(type==='microchip-lab'){el.classList.add('sr-exit','sr-socket');el.innerHTML='<b>DATA</b><i></i>'}
  if(type==='moonlit-zen'){el.classList.add('sr-exit','sr-torii');el.innerHTML='<i></i><b>鳥居</b>'}
 }
 function componentInfo(o,ci){
  const cells=o.cells||[],c=cells[ci]||{x:0,y:0},xs=cells.map(q=>q.x),ys=cells.map(q=>q.y);
  const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
  return{count:cells.length,x:c.x-minX,y:c.y-minY,w:maxX-minX+1,h:maxY-minY+1,
   left:!cells.some(q=>q.x===c.x-1&&q.y===c.y),right:!cells.some(q=>q.x===c.x+1&&q.y===c.y),
   top:!cells.some(q=>q.x===c.x&&q.y===c.y-1),bottom:!cells.some(q=>q.x===c.x&&q.y===c.y+1)};
 }
 function decoratePiece(el,o,ci){
  if(!el||!theme)return;const type=theme.scene?.type,cp=componentInfo(o,ci);
  el.dataset.part=String(ci);el.dataset.componentSize=String(cp.count);
  el.classList.toggle('sr-component',cp.count>1);
  for(const k of ['left','right','top','bottom'])el.classList.toggle('sr-open-'+k,cp[k]);
  el.classList.toggle('sr-horizontal',cp.count>1&&cp.h===1);el.classList.toggle('sr-vertical',cp.count>1&&cp.w===1);
  el.classList.toggle('sr-rigid-cell',o.type==='brick'&&cp.count>1);
  const spec=theme?.pieces?.[o.type];if(spec?.className)el.classList.add(...String(spec.className).split(/\s+/).filter(Boolean));if(spec?.markup!=null){el.innerHTML=spec.markup;return}
  if(type==='clockwork-sanctum'){
   el.classList.add('sr-piece');
   if(o.type==='ball')el.innerHTML='<i class="aether-ring r1"></i><i class="aether-ring r2"></i><b class="aether-light"></b>';
   else if(o.type==='brick')el.innerHTML='<i class="rivet rv1"></i><i class="rivet rv2"></i><b class="piece-glyph">'+(cp.count>1?(ci===0?'CHRONO':'⚙'):'⚙')+'</b>';
   else if(o.type==='wall')el.innerHTML='<i class="pillar-cap"></i><b class="piece-glyph">◆</b>';
  }
  if(type==='microchip-lab'){
   el.classList.add('sr-piece');
   if(o.type==='ball')el.innerHTML='<i class="electron-orbit"></i><b class="electron-core">e−</b>';
   else if(o.type==='brick')el.innerHTML='<i class="chip-pins"></i><b class="chip-label">IC</b>';
   else if(o.type==='wall')el.innerHTML='<i class="sink-fins"></i><b>HS</b>';
  }
  if(type==='moonlit-zen'){
   el.classList.add('sr-piece');
   if(o.type==='ball')el.innerHTML='<i class="koi-tail"></i><b class="koi-body">◉</b>';
   else if(o.type==='brick')el.innerHTML='<i class="lotus-leaf"></i><b class="lotus-flower">✿</b>';
   else if(o.type==='wall')el.innerHTML='<i class="stone-cap"></i><b>灯</b>';
  }
  if(type==='neon-noir'){
   el.classList.add('sr-piece');
   if(o.type==='ball')el.innerHTML='<i class="drone-wing dw1"></i><i class="drone-wing dw2"></i><b class="drone-eye"></b><em>K7</em>';
   else if(o.type==='brick')el.innerHTML='<i class="cargo-line"></i><b>'+(cp.count>1?(ci===0?'HEAVY':'CARGO'):'CARGO')+'</b><em>'+(cp.count>1?'C-47':'47')+'</em>';
   else if(o.type==='wall')el.innerHTML='<i class="tower-light"></i><b>HVAC</b>';
  }
 }
 function clearComponentOverlays(){componentOverlays.forEach(el=>el.remove());componentOverlays=[]}
 function compositeMarkup(type){
  if(theme?.scene?.compositeMarkup!=null)return theme.scene.compositeMarkup;
  if(type==='clockwork-sanctum')return '<i class="co-rail"></i><i class="co-gear cg1"></i><i class="co-gear cg2"></i><b>CHRONO ENGINE</b>';
  if(type==='neon-noir')return '<i class="co-window cw1"></i><i class="co-window cw2"></i><i class="co-thruster"></i><b>HEAVY CARGO</b><em>C-47</em>';
  if(type==='microchip-lab')return '<i class="co-chip-pins"></i><b>74GGRID</b><em>LOGIC ARRAY</em>';
  if(type==='moonlit-zen')return '<i class="co-moss"></i><i class="co-lotus">✿</i><b>浮島</b>';
  return '';
 }
 function buildComponentOverlays(board){
  const type=theme?.scene?.type;if(!type)return;
  const live=new Set(),w=state?.width||1,h=state?.height||w,cellX=100/w,cellY=100/h,inset=1.8;
  for(const o of (state?.objects||[])){
   if(o.exited||o.type!=='brick'||(o.cells||[]).length<2)continue;
   const id=String(o.id);live.add(id);
   const xs=o.cells.map(q=>q.x),ys=o.cells.map(q=>q.y),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
   /* A single rectangular composite may only cover a completely filled footprint.
      L/U/sparse rigid bodies have legal empty cells inside their bounding box; a
      bounding-box overlay would visually cover balls or other pieces in those cells. */
   const boxArea=(maxX-minX+1)*(maxY-minY+1);
   if(o.cells.length!==boxArea)continue;
   let ov=componentOverlays.find(el=>el.isConnected&&el.parentElement===board&&el.dataset.objectId===id);
   if(!ov){ov=document.createElement('div');ov.className='sr-composite sr-composite-'+type;ov.dataset.objectId=id;ov.innerHTML=compositeMarkup(type);board.append(ov);componentOverlays.push(ov);}
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