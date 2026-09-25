import {createHash} from 'node:crypto';
// GGrid Fast Generator v2: random layouts, diversity fingerprints and records.
import {readJson,libraryRecords,stateFromRecord} from './engine.mjs';

const BASE_PROFILES={
 '3x3':{walls:[0,2],bricks:[1,3]},
 '4x4':{walls:[0,2],bricks:[2,4]},
 '5x5':{walls:[0,4],bricks:[2,5]},
 '5x6':{walls:[0,4],bricks:[2,6]},
 '5x7':{walls:[0,5],bricks:[2,6]},
 '5x8':{walls:[1,8],bricks:[2,7]},
};
export function profileFor(w,h){
 const key=w+'x'+h;if(BASE_PROFILES[key])return BASE_PROFILES[key];
 const area=w*h;
 return {walls:[Math.max(0,Math.floor(area/24)),Math.max(2,Math.floor(area/6))],
  bricks:[Math.max(2,Math.floor(area/14)),Math.max(4,Math.floor(area/6))]};
}
const norm=cells=>{const minX=Math.min(...cells.map(c=>c.x)),minY=Math.min(...cells.map(c=>c.y));return cells.map(c=>({x:c.x-minX,y:c.y-minY})).sort((a,b)=>a.y-b.y||a.x-b.x)};
const CATALOG_SHAPES=readJson('content/shapes/rigid-shapes.json').shapes.map(s=>({id:s.id,cells:norm(s.cells),large:s.cells.length>=4}));
const SINGLE={id:'1',cells:[{x:0,y:0}],large:false};
const EXTRA_LARGE=[
 {id:'4H',cells:[{x:0,y:0},{x:1,y:0},{x:2,y:0},{x:3,y:0}]},
 {id:'4V',cells:[{x:0,y:0},{x:0,y:1},{x:0,y:2},{x:0,y:3}]},
 {id:'O4',cells:[{x:0,y:0},{x:1,y:0},{x:0,y:1},{x:1,y:1}]},
 {id:'T4',cells:[{x:0,y:0},{x:1,y:0},{x:2,y:0},{x:1,y:1}]},
 {id:'L4',cells:[{x:0,y:0},{x:0,y:1},{x:0,y:2},{x:1,y:2}]},
 {id:'I5',cells:[{x:0,y:0},{x:1,y:0},{x:2,y:0},{x:3,y:0},{x:4,y:0}]},
 {id:'T5',cells:[{x:0,y:0},{x:1,y:0},{x:2,y:0},{x:1,y:1},{x:1,y:2}]},
 {id:'L5',cells:[{x:0,y:0},{x:0,y:1},{x:0,y:2},{x:0,y:3},{x:1,y:3}]},
 {id:'U5',cells:[{x:0,y:0},{x:2,y:0},{x:0,y:1},{x:1,y:1},{x:2,y:1}]},
 {id:'V5',cells:[{x:0,y:0},{x:0,y:1},{x:0,y:2},{x:1,y:2},{x:2,y:2}]},
 {id:'RECT6',cells:[{x:0,y:0},{x:1,y:0},{x:2,y:0},{x:0,y:1},{x:1,y:1},{x:2,y:1}]},
 {id:'L6',cells:[{x:0,y:0},{x:0,y:1},{x:0,y:2},{x:0,y:3},{x:0,y:4},{x:1,y:4}]}
].map(s=>({...s,cells:norm(s.cells),large:true}));
export const SHAPES=[SINGLE,...CATALOG_SHAPES,...EXTRA_LARGE];

export function rng(seed){let a=seed>>>0;return n=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return Math.floor(((t^t>>>14)>>>0)/4294967296*n)}}
const sig=cells=>norm(cells).map(c=>c.x+','+c.y).join(';');
function shapePool(w,h,largeMode='auto'){
 const area=w*h,allowLarge=largeMode==='on'||(largeMode==='auto'&&area>=30);
 return allowLarge?SHAPES:[SINGLE,...CATALOG_SHAPES];
}

export function randomLayout(w,h,rand,{balls=1,largeShapes='auto'}={}){
 const profile=profileFor(w,h),between=([a,b])=>a+rand(b-a+1);
 const side=rand(4),exit=side===0?{dir:'up',x:rand(w),y:0}:side===1?{dir:'down',x:rand(w),y:h-1}:side===2?{dir:'left',x:0,y:rand(h)}:{dir:'right',x:w-1,y:rand(h)};
 const occ=new Set(),objects=[],blockedForWall=exit.x+','+exit.y,pool=shapePool(w,h,largeShapes);
 function place(type,shape){
  const cells=shape.cells||shape;
  for(let t=0;t<100;t++){
   const x=rand(w),y=rand(h),abs=cells.map(c=>[x+c.x,y+c.y]);
   if(abs.every(([a,b])=>a>=0&&b>=0&&a<w&&b<h&&!occ.has(a+','+b)&&!(type==='wall'&&a+','+b===blockedForWall))){
    abs.forEach(([a,b])=>occ.add(a+','+b));
    const num=objects.filter(o=>o.type===type).length+1,id=type==='ball'?'ball'+num:(type==='wall'?'W':'K')+num;
    objects.push({id,type,x,y,exited:false,cells:cells.map(c=>({x:c.x,y:c.y}))});return true;
   }
  }return false;
 }
 for(let i=0;i<balls;i++)if(!place('ball',SINGLE))return null;
 const walls=between(profile.walls),bricks=between(profile.bricks);
 for(let i=0;i<walls;i++)if(!place('wall',SINGLE))return null;
 const requireLarge=(largeShapes==='on'||(largeShapes==='auto'&&w*h>=35))&&bricks>0;
 if(requireLarge){const lp=EXTRA_LARGE.filter(s=>Math.max(...s.cells.map(c=>c.x))<w&&Math.max(...s.cells.map(c=>c.y))<h);if(lp.length&&!place('brick',lp[rand(lp.length)]))return null}
 for(let i=requireLarge?1:0;i<bricks;i++){
  let candidates=pool;
  if(w*h<20)candidates=pool.filter(s=>s.cells.length<=3);
  const shape=candidates[rand(candidates.length)];if(!place('brick',shape))return null;
 }
 return {width:w,height:h,exit,moves:0,won:false,objects};
}

function transforms(s){
 const {width:w,height:h}=s,square=w===h;
 const T=[(x,y)=>[x,y],(x,y)=>[w-1-x,y],(x,y)=>[x,h-1-y],(x,y)=>[w-1-x,h-1-y]];
 if(square)T.push((x,y)=>[y,x],(x,y)=>[w-1-y,x],(x,y)=>[y,h-1-x],(x,y)=>[w-1-y,h-1-x]);
 return T;
}
const typeCode=t=>t==='ball'?'B':t==='brick'?'R':'W';
export function fingerprint(s){
 const w=s.width,h=s.height,vec={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]};let best=null;
 for(const t of transforms(s)){
  const [ex,ey]=t(s.exit.x,s.exit.y),[vx,vy]=vec[s.exit.dir],[ox,oy]=t(0,0),[px,py]=t(vx,vy);
  const exitDir=Object.keys(vec).find(k=>vec[k][0]===px-ox&&vec[k][1]===py-oy);
  const pieces=s.objects.map(o=>typeCode(o.type)+':'+o.cells.map(c=>t(o.x+c.x,o.y+c.y).join(',')).sort().join(';')).sort();
  const f=`${w}x${h}|${ex},${ey},${exitDir}|${pieces.join('|')}`;if(best===null||f<best)best=f;
 }return best;
}
export function familyFingerprint(s){
 const walls=s.objects.filter(o=>o.type==='wall').map(o=>o.x+','+o.y).sort().join(';');
 const movable=s.objects.filter(o=>o.type!=='wall').map(o=>typeCode(o.type)+':'+sig(o.cells)).sort().join('|');
 return `${s.width}x${s.height}|${s.exit.x},${s.exit.y},${s.exit.dir}|W:${walls}|M:${movable}`;
}
export function libraryFingerprints(){return new Set(libraryRecords().map(r=>fingerprint(stateFromRecord(r))))}

export function qualityScore(a){
 const m=a.metrics||{},turns=m.directionChanges||0,detour=m.detourMoves||0,setup=m.setupMoves||0,conflict=m.conflictMoves||0,alts=m.averageAlternatives||0,challenge=m.challengeSignal||0;
 return +Math.max(0,Math.min(1,.18*Math.min(1,turns/6)+.18*Math.min(1,detour/5)+.16*Math.min(1,setup/4)+.14*Math.min(1,conflict/3)+.14*Math.min(1,alts)+.20*Math.min(1,challenge))).toFixed(3);
}
export function toRecord(s,a,levelId,generator,{packId=null,familyId=null,noveltyScore=1,library='generated'}={}){
 let wall=0,brick=0,ball=0;
 const entities=s.objects.map(o=>{
  const id=o.type==='ball'?'ball'+(++ball):o.type==='wall'?'W'+(++wall):'K'+(++brick);
  return {id,type:o.type==='brick'?'rigid-body':o.type,position:{x:o.x,y:o.y},properties:{cells:o.cells.map(c=>({x:c.x,y:c.y}))}};
 });
 const features=['core.movement','core.exit','object.ball','object.rigid-body','object.wall'];if(ball>1)features.push('rule.multi-ball');
 const rigid=s.objects.filter(o=>o.type==='brick'),sizes=rigid.map(o=>o.cells.length),hist={};for(const n of sizes)hist[n]=1+(hist[n]||0);
 const structure={ballCount:ball,wallCount:s.objects.filter(o=>o.type==='wall').length,rigidBodyCount:rigid.length,rigidCellCount:sizes.reduce((x,y)=>x+y,0),multiCellRigidCount:sizes.filter(n=>n>1).length,largeRigidCount:sizes.filter(n=>n>=4).length,maxRigidCells:sizes.length?Math.max(...sizes):0,rigidSizeHistogram:hist};
 const normalizedFamily=familyId?(String(familyId).startsWith('fam-')?String(familyId):'fam-'+createHash('sha256').update(String(familyId)).digest('hex').slice(0,16)):null;
 return {format:'ggrid-level',formatVersion:2,levelId,rulesVersion:1,requires:{features},
  board:{width:s.width,height:s.height,exit:{direction:s.exit.dir,x:s.exit.x,y:s.exit.y}},entities,initialResources:{freeze:0},
  difficulty:{class:a.difficulty,score:a.raw,modelVersion:a.model},
  analysis:{solution:a.optimalSolution,metrics:a.metrics,qualityScore:qualityScore(a),noveltyScore,qualityMethod:'solver-metrics-v1',noveltyMethod:'family-frequency-v1'},
  content:{metadataVersion:3,packId,library,familyId:normalizedFamily,ballCount:ball,generatorVersion:2,structure,provenance:{origin:'generated',metadataMigratedBy:null,generatorTool:generator?.tool||null}},
  generator};
}
