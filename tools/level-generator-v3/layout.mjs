// GGrid Fast Generator v3 layout strategies.
// Keeps v2 shapes/records/metadata and adds multiball-specific profiles,
// layout styles and local mutations inspired by Claude's v2 proposal.
import {SHAPES as V2_SHAPES,rng,fingerprint,familyFingerprint,qualityScore,toRecord,libraryFingerprints,profileFor} from '../level-generator-v2/layout.mjs';

export {rng,fingerprint,familyFingerprint,qualityScore,toRecord,libraryFingerprints};
export const SHAPES=V2_SHAPES;

export const MULTIBALL_PROFILES={
 '3x3':{walls:[0,3],bricks:[0,2],polyomino:false},
 '4x4':{walls:[0,2],bricks:[2,3],polyomino:false},
 '5x5':{walls:[0,3],bricks:[2,4],polyomino:true},
 '5x6':{walls:[0,4],bricks:[2,7],polyomino:true},
 '5x7':{walls:[0,4],bricks:[3,9],polyomino:true},
 '5x8':{walls:[0,6],bricks:[3,10],polyomino:true}
};
export const STYLES={
 mixed:{walls:[0,1],bricks:[0,1],single:null,largeBias:.15},
 open:{walls:[0,.25],bricks:[.5,1],single:.68,largeBias:.08},
 walled:{walls:[.5,1],bricks:[0,.65],single:.28,largeBias:.20},
 hardMulti:{walls:[0,.4],bricks:[.72,1],single:.58,largeBias:.18}
};

const SINGLE=SHAPES.find(s=>s.cells.length===1)||SHAPES[0];
const multiShapes=SHAPES.filter(s=>s.cells.length>1);
const largeShapes=SHAPES.filter(s=>s.cells.length>=4);
const between=(rand,[a,b])=>a+rand(Math.max(1,b-a+1));
const part=([a,b],[f0,f1])=>{
 const lo=a+Math.round((b-a)*f0),hi=a+Math.round((b-a)*f1);
 return [Math.min(lo,hi),Math.max(lo,hi)];
};
export function profileForV3(w,h,balls=1){
 if(balls===2&&MULTIBALL_PROFILES[w+'x'+h])return MULTIBALL_PROFILES[w+'x'+h];
 return profileFor(w,h);
}
function chooseShape(rand,style,{allowLarge=true,forceMulti=false}={}){
 if(forceMulti&&multiShapes.length)return multiShapes[rand(multiShapes.length)];
 if(style.single!=null&&rand(1000)<style.single*1000)return SINGLE;
 if(allowLarge&&largeShapes.length&&rand(1000)<(style.largeBias||0)*1000)return largeShapes[rand(largeShapes.length)];
 return SHAPES[rand(SHAPES.length)];
}

export function randomLayoutV3(w,h,rand,{balls=1,largeShapesMode='auto',styleName='mixed'}={}){
 const profile=profileForV3(w,h,balls),style=STYLES[styleName]||STYLES.mixed;
 const side=rand(4),exit=side===0?{dir:'up',x:rand(w),y:0}:side===1?{dir:'down',x:rand(w),y:h-1}:side===2?{dir:'left',x:0,y:rand(h)}:{dir:'right',x:w-1,y:rand(h)};
 const occ=new Set(),objects=[],blockedForWall=exit.x+','+exit.y;
 const allowLarge=largeShapesMode==='on'||(largeShapesMode==='auto'&&w*h>=30);
 function place(type,shape){
  const cells=shape.cells||shape;
  for(let t=0;t<100;t++){
   const x=rand(w),y=rand(h),abs=cells.map(c=>[x+c.x,y+c.y]);
   if(abs.every(([a,b])=>a>=0&&b>=0&&a<w&&b<h&&!occ.has(a+','+b)&&!(type==='wall'&&a+','+b===blockedForWall))){
    abs.forEach(([a,b])=>occ.add(a+','+b));
    const n=objects.filter(o=>o.type===type).length+1;
    objects.push({id:type==='ball'?'ball'+n:(type==='wall'?'W':'K')+n,type,x,y,exited:false,cells:cells.map(c=>({x:c.x,y:c.y}))});
    return true;
   }
  }
  return false;
 }
 for(let i=0;i<balls;i++)if(!place('ball',SINGLE))return null;
 const walls=between(rand,part(profile.walls,style.walls)),bricks=between(rand,part(profile.bricks,style.bricks));
 for(let i=0;i<walls;i++)if(!place('wall',SINGLE))return null;
 const needPoly=!!profile.polyomino&&bricks>0;
 const needLarge=allowLarge&&w*h>=35&&bricks>0&&styleName!=='open';
 let placedSpecial=false;
 if(needLarge&&largeShapes.length){
  const fits=largeShapes.filter(s=>Math.max(...s.cells.map(c=>c.x))<w&&Math.max(...s.cells.map(c=>c.y))<h);
  if(fits.length&&place('brick',fits[rand(fits.length)]))placedSpecial=true;
 }
 if(needPoly&&!placedSpecial){
  const fits=multiShapes.filter(s=>Math.max(...s.cells.map(c=>c.x))<w&&Math.max(...s.cells.map(c=>c.y))<h);
  if(!fits.length||!place('brick',fits[rand(fits.length)]))return null;
  placedSpecial=true;
 }
 for(let i=placedSpecial?1:0;i<bricks;i++){
  let shape=chooseShape(rand,style,{allowLarge});
  if(w*h<20&&shape.cells.length>3)shape=SINGLE;
  if(!place('brick',shape))return null;
 }
 return {width:w,height:h,exit,moves:0,won:false,objects};
}

export function mutateLayoutV3(src,rand,{balls=1,largeShapesMode='auto',aggressive=false}={}){
 const s=structuredClone(src),w=s.width,h=s.height,profile=profileForV3(w,h,balls);
 const count=t=>s.objects.filter(o=>o.type===t).length;
 const abs=o=>o.cells.map(c=>[o.x+c.x,o.y+c.y]);
 const occupied=skip=>{const set=new Set();for(const o of s.objects)if(o!==skip)for(const [x,y] of abs(o))set.add(x+','+y);return set};
 const fits=(o,x,y,occ)=>o.cells.every(c=>{const a=x+c.x,b=y+c.y;return a>=0&&b>=0&&a<w&&b<h&&!occ.has(a+','+b)&&!(o.type==='wall'&&a===s.exit.x&&b===s.exit.y)});
 const relocate=o=>{const occ=occupied(o);for(let t=0;t<60;t++){const x=rand(w),y=rand(h);if(fits(o,x,y,occ)){o.x=x;o.y=y;return true}}return false};
 const pieces=s.objects.filter(o=>o.type!=='ball');
 const op=rand(aggressive?7:5);
 if(op===0){
  const movable=s.objects.filter(o=>o.type!=='wall'||!(o.x===s.exit.x&&o.y===s.exit.y));
  if(!movable.length||!relocate(movable[rand(movable.length)]))return null;
 } else if(op===1){
  const type=rand(4)===0&&count('wall')<profile.walls[1]?'wall':count('brick')<profile.bricks[1]?'brick':null;if(!type)return null;
  const style=aggressive?STYLES.hardMulti:STYLES.mixed,shape=type==='wall'?SINGLE:chooseShape(rand,style,{allowLarge:largeShapesMode!=='off'});
  const o={id:(type==='wall'?'W':'K')+'m'+rand(1e9),type,x:0,y:0,exited:false,cells:shape.cells.map(c=>({...c}))};
  s.objects.push(o);if(!relocate(o)){s.objects.pop();return null}
 } else if(op===2){
  const removable=pieces.filter(o=>o.type==='wall'?count('wall')>profile.walls[0]:count('brick')>profile.bricks[0]);if(!removable.length)return null;
  s.objects.splice(s.objects.indexOf(removable[rand(removable.length)]),1);
 } else if(op===3){
  const singles=pieces.filter(o=>o.cells.length===1);if(!singles.length)return null;
  const o=singles[rand(singles.length)],to=o.type==='wall'?'brick':'wall';
  if(to==='wall'&&(count('wall')>=profile.walls[1]||count('brick')<=profile.bricks[0]||(o.x===s.exit.x&&o.y===s.exit.y)))return null;
  if(to==='brick'&&(count('brick')>=profile.bricks[1]||count('wall')<=profile.walls[0]))return null;
  o.type=to;
 } else if(op===4){
  const side=rand(4);s.exit=side===0?{dir:'up',x:rand(w),y:0}:side===1?{dir:'down',x:rand(w),y:h-1}:side===2?{dir:'left',x:0,y:rand(h)}:{dir:'right',x:w-1,y:rand(h)};
  if(s.objects.some(o=>o.type==='wall'&&o.x===s.exit.x&&o.y===s.exit.y))return null;
 } else {
  const bricks=s.objects.filter(o=>o.type==='brick');if(!bricks.length)return null;
  const o=bricks[rand(bricks.length)],shape=chooseShape(rand,STYLES.hardMulti,{allowLarge:largeShapesMode!=='off',forceMulti:profile.polyomino});
  const old=o.cells;o.cells=shape.cells.map(c=>({...c}));if(!relocate(o)){o.cells=old;return null}
 }
 if(profile.polyomino&&!s.objects.some(o=>o.type==='brick'&&o.cells.length>1))return null;
 if(count('ball')!==balls)return null;
 const rank=o=>o.type==='ball'?0:o.type==='wall'?1:2;s.objects.sort((a,b)=>rank(a)-rank(b));
 let b=0,wc=0,k=0;for(const o of s.objects)o.id=o.type==='ball'?'ball'+(++b):o.type==='wall'?'W'+(++wc):'K'+(++k);
 return s;
}
