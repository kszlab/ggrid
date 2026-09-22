/* GGrid Scene Renderer 2 – v0.12.12
   Presentation-only layer. Never changes Game State or physics. */
const SceneRenderer=(()=>{
 let theme=null,wrap=null,back=null,front=null,frame=null;
 function ensure(){
  wrap=document.querySelector('.board-wrap');if(!wrap)return;
  if(!back){back=document.createElement('div');back.className='scene-layer scene-back';wrap.prepend(back)}
  if(!frame){frame=document.createElement('div');frame.className='scene-frame';wrap.append(frame)}
  if(!front){front=document.createElement('div');front.className='scene-layer scene-front';wrap.append(front)}
 }
 function markup(type){
  if(type==='clockwork-sanctum')return {
   back:'<i class="sr-stars"></i><i class="sr-arch"></i><i class="sr-gear sg1"></i><i class="sr-gear sg2"></i><i class="sr-orrery"></i>',
   front:'<i class="sr-steam ss1"></i><i class="sr-steam ss2"></i><span class="sr-caption">AETHERIUM OBSERVATORY <b>03:17</b></span>'};
  if(type==='neon-noir')return {
   back:'<i class="sr-city"></i><i class="sr-holo">九<small>SECTOR 9</small></i><i class="sr-glow"></i>',
   front:'<i class="sr-rain"></i><i class="sr-vapor"></i><span class="sr-caption neon">ACID RAIN // ROOFTOP 09 <b>EVAC</b></span>'};
  return{back:'',front:''};
 }
 function apply(t){
  theme=t||null;ensure();const type=t?.scene?.type||'';
  document.body.dataset.scene=type;wrap.dataset.scene=type;
  const m=markup(type);back.innerHTML=m.back;front.innerHTML=m.front;frame.innerHTML='';
  wrap.classList.toggle('scene-showcase',t?.scene?.tier==='showcase');
 }
 function decorateExit(el){
  if(!el||!theme)return;const type=theme.scene?.type;
  if(type==='clockwork-sanctum'){el.classList.add('sr-exit','sr-astrolabe');el.innerHTML='<i></i><b>✦</b>'}
  if(type==='neon-noir'){el.classList.add('sr-exit','sr-evac');el.innerHTML='<b>09</b><small>EVAC</small>'}
 }
 function decoratePiece(el,o,ci){
  if(!el||!theme)return;const type=theme.scene?.type;
  el.dataset.part=String(ci);
  if(type==='clockwork-sanctum'){
   el.classList.add('sr-piece');
   if(o.type==='ball')el.innerHTML='<i class="aether-ring r1"></i><i class="aether-ring r2"></i><b class="aether-light"></b>';
   else if(o.type==='brick')el.innerHTML='<i class="rivet rv1"></i><i class="rivet rv2"></i><b class="piece-glyph">⚙</b>';
   else if(o.type==='wall')el.innerHTML='<i class="pillar-cap"></i><b class="piece-glyph">◆</b>';
  }
  if(type==='neon-noir'){
   el.classList.add('sr-piece');
   if(o.type==='ball')el.innerHTML='<i class="drone-wing dw1"></i><i class="drone-wing dw2"></i><b class="drone-eye"></b><em>K7</em>';
   else if(o.type==='brick')el.innerHTML='<i class="cargo-line"></i><b>CARGO</b><em>47</em>';
   else if(o.type==='wall')el.innerHTML='<i class="tower-light"></i><b>HVAC</b>';
  }
 }
 function afterBoardRender(board){
  if(!theme)return;decorateExit(board.querySelector('.exit'));
  const byId=new Map((state?.objects||[]).map(o=>[String(o.id),o]));
  board.querySelectorAll('.piece').forEach(el=>{const o=byId.get(String(el.dataset.id));if(o)decoratePiece(el,o,+(el.dataset.cellkey?.split(':')[1]||0))});
 }
 function event(kind){
  ensure();if(!wrap||!theme)return;
  wrap.classList.remove('fx-move','fx-blocked','fx-freeze','fx-exit','fx-win');void wrap.offsetWidth;
  wrap.classList.add('fx-'+kind);setTimeout(()=>wrap?.classList.remove('fx-'+kind),kind==='win'?900:420);
 }
 function clear(){theme=null;ensure();document.body.dataset.scene='';wrap.dataset.scene='';wrap.classList.remove('scene-showcase');back.innerHTML='';front.innerHTML='';frame.innerHTML=''}
 return{apply,afterBoardRender,event,clear,get theme(){return theme}};
})();