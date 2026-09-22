/* ===== GAME CORE ===== */
const DIRS={up:{dx:0,dy:-1},down:{dx:0,dy:1},left:{dx:-1,dy:0},right:{dx:1,dy:0}};
const DIR_NAMES=Object.keys(DIRS), key=(x,y)=>`${x},${y}`, cloneState=s=>structuredClone(s);
function bodyCells(o,x=o.x,y=o.y){return o.cells.map(c=>({x:x+c.x,y:y+c.y}));}
function isExitStep(s,c,dir){return c.x===s.exit.x&&c.y===s.exit.y&&dir===s.exit.dir;}
function validateLevel(s){const occ=new Set();for(const o of s.objects)for(const c of bodyCells(o)){let k=key(c.x,c.y);if(c.x<0||c.y<0||c.x>=s.width||c.y>=s.height||occ.has(k))throw Error("Hibás pálya");occ.add(k);}return true;}
function step(state,dir,freezeId=null){
 const d=DIRS[dir];if(!d)return{state,events:[]};const s=cloneState(state),objs=s.objects.filter(o=>!o.exited),byCell=new Map();
 for(const o of objs)for(const c of bodyCells(o))byCell.set(key(c.x,c.y),o.id);
 const memo=new Map(),visiting=new Set(),objMap=new Map(objs.map(o=>[o.id,o]));
 function canMove(o){
  if(memo.has(o.id))return memo.get(o.id);if(o.type==='wall'){memo.set(o.id,false);return false;}if(o.id===freezeId){memo.set(o.id,false);return false;}if(visiting.has(o.id))return true;visiting.add(o.id);
  for(const c of bodyCells(o)){const nx=c.x+d.dx,ny=c.y+d.dy;
   if(nx<0||ny<0||nx>=s.width||ny>=s.height){if(o.type==='ball'&&o.cells.length===1&&isExitStep(s,c,dir))continue;visiting.delete(o.id);memo.set(o.id,false);return false;}
   const hit=byCell.get(key(nx,ny));if(hit&&hit!==o.id&&!canMove(objMap.get(hit))){visiting.delete(o.id);memo.set(o.id,false);return false;}
  }visiting.delete(o.id);memo.set(o.id,true);return true;
 }
 objs.forEach(canMove);const events=[];
 for(const o of objs){if(!memo.get(o.id))continue;const old={x:o.x,y:o.y};
  if(o.type==='ball'){const c=bodyCells(o)[0],nx=c.x+d.dx,ny=c.y+d.dy;if((nx<0||ny<0||nx>=s.width||ny>=s.height)&&isExitStep(s,c,dir)){o.exited=true;events.push({type:'exit',id:o.id,from:old,dir});continue;}}
  o.x+=d.dx;o.y+=d.dy;events.push({type:'move',id:o.id,from:old,to:{x:o.x,y:o.y}});
 }
 s.moves=(s.moves||0)+1;s.won=s.objects.every(o=>o.type!=='ball'||o.exited);
 if(events.length===0)events.push({type:'blocked'});
 if(s.won)events.push({type:'win'});
 return{state:s,events};
}
