#!/usr/bin/env node
/* Add five distinct solvable levels to each existing size/class without changing old IDs. */
import fs from 'node:fs';
import {classify} from './classify-level.mjs';
const sizeArg=process.argv[2];
const sizes=sizeArg?[sizeArg]:['3x3','4x4','5x5','5x6','5x7','5x8'];
const base=JSON.parse(fs.readFileSync('content/levels/packs/classified-v2.json','utf8')).levels;
const calibration=JSON.parse(fs.readFileSync('tools/difficulty-calibration-v2.json','utf8'));
const originalState=l=>({width:l.board.width,height:l.board.height,exit:{x:l.board.exit.x,y:l.board.exit.y,dir:l.board.exit.direction},objects:l.entities.map(e=>({id:e.id,type:e.type==='rigid-body'?'brick':e.type,x:e.position.x,y:e.position.y,cells:e.properties.cells.map(c=>({...c}))})),moves:0,won:false});
function signature(s){return JSON.stringify([s.width,s.height,s.exit.x,s.exit.y,s.exit.dir,s.objects.map(o=>[o.type,o.x,o.y,o.cells.map(c=>[c.x,c.y]).sort((a,b)=>a[0]-b[0]||a[1]-b[1])]).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)))]);}
const direction=[{left:'right',right:'left',up:'up',down:'down'},{left:'left',right:'right',up:'down',down:'up'},{left:'right',right:'left',up:'down',down:'up'},{left:'up',right:'down',up:'left',down:'right'},{left:'up',right:'down',up:'right',down:'left'},{left:'down',right:'up',up:'left',down:'right'},{left:'down',right:'up',up:'right',down:'left'}];
function mirror(s,k){const w=s.width,h=s.height;if(k>=3&&w!==h)return null;
 const tf=([x,y])=>k===0?[w-1-x,y]:k===1?[x,h-1-y]:k===2?[w-1-x,h-1-y]:k===3?[y,x]:k===4?[w-1-y,x]:k===5?[y,h-1-x]:[w-1-y,h-1-x];
 const objects=s.objects.map(o=>{const cells=o.cells.map(c=>tf([o.x+c.x,o.y+c.y])),x=Math.min(...cells.map(c=>c[0])),y=Math.min(...cells.map(c=>c[1]));return {...o,x,y,cells:cells.map(([cx,cy])=>({x:cx-x,y:cy-y}))}});
 const [x,y]=tf([s.exit.x,s.exit.y]);return {...s,exit:{x,y,dir:direction[k][s.exit.dir]},objects};
}
function record(s,a,id){return {format:'ggrid-level',formatVersion:2,levelId:id,rulesVersion:1,requires:{features:['core.movement','core.exit','object.ball','object.rigid-body','object.wall']},board:{width:s.width,height:s.height,exit:{direction:s.exit.dir,x:s.exit.x,y:s.exit.y}},entities:s.objects.map(o=>({id:o.id,type:o.type==='brick'?'rigid-body':o.type,position:{x:o.x,y:o.y},properties:{cells:o.cells}})),initialResources:{freeze:0},difficulty:{class:a.difficulty,score:a.raw,modelVersion:'puzzle-v2'},analysis:{solution:a.optimalSolution,metrics:a.metrics}}}
for(const size of sizes){
 if(!calibration[size])throw Error('Unknown size: '+size);
 let seed=(20261001+size.split('x').reduce((a,n)=>a*37+Number(n),0))>>>0;
 const rand=n=>(seed=(Math.imul(seed,1664525)+1013904223)>>>0)%n;
 const source=base.filter(l=>`${l.board.width}x${l.board.height}`===size);
 const seen=new Set(source.map(l=>signature(originalState(l)))),checked=new Set(seen),added=[],target=Array(10).fill(0),pool=source.map(l=>({state:originalState(l),grade:l.difficulty.class}));
 let attempts=0,solved=0;
 function tryCandidate(s,desired){if(!s)return false;const sig=signature(s);if(checked.has(sig))return false;checked.add(sig);attempts++;
  let a;try{a=classify({id:'expansion-candidate',state:s})}catch{return false}
  if(a.status!=='ok')return false;
  if(a.difficulty===desired){const id=`LV3-${size.toUpperCase()}-${String(78+added.length).padStart(4,'0')}`;
   added.push(record(s,a,id));seen.add(sig);pool.push({state:s,grade:desired});target[desired-1]++;solved++;return true}
  // Near-target structures provide better mutation parents, without altering grade cutoffs.
  if(Math.abs(a.difficulty-desired)<=1&&pool.length<250)pool.push({state:s,grade:a.difficulty});
  return false;
 }
 function mutate(input){const s=structuredClone(input),mode=rand(6),movable=s.objects.filter(o=>o.type!=='wall'&&o.type!=='ball'&&o.cells.length===1),other=s.objects.filter(o=>o.type!=='ball'&&o.cells.length===1);
  if(mode===5){const exits=[];for(let x=0;x<s.width;x++){exits.push({x,y:0,dir:'up'},{x,y:s.height-1,dir:'down'})}for(let y=0;y<s.height;y++){exits.push({x:0,y,dir:'left'},{x:s.width-1,y,dir:'right'})}s.exit=exits[rand(exits.length)];return s}
  const moveObject=mode===2?s.objects.find(o=>o.type==='ball'):other.length?other[rand(other.length)]:null;
  if(mode===4||!moveObject){const taken=new Set(s.objects.flatMap(o=>o.cells.map(c=>`${o.x+c.x},${o.y+c.y}`))),free=[];for(let y=0;y<s.height;y++)for(let x=0;x<s.width;x++)if(!taken.has(`${x},${y}`))free.push({x,y});if(!free.length)return null;const p=free[rand(free.length)];s.objects.push({id:'extra'+s.objects.length,type:rand(3)?'brick':'wall',x:p.x,y:p.y,cells:[{x:0,y:0}]});return s}
  if(mode===3){if(movable.length){const o=movable[rand(movable.length)];o.type=rand(2)?'brick':'wall'}return s}
  const taken=new Set(s.objects.filter(o=>o!==moveObject).flatMap(o=>o.cells.map(c=>`${o.x+c.x},${o.y+c.y}`))),free=[];for(let y=0;y<s.height;y++)for(let x=0;x<s.width;x++)if(!taken.has(`${x},${y}`))free.push({x,y});if(!free.length)return null;const p=free[rand(free.length)];moveObject.x=p.x;moveObject.y=p.y;return s;
 }
 for(let d=10;d>=1;d--){
  // Start with symmetry variants: exact physics-equivalent levels, with fresh grade verification.
  const parents=pool.filter(x=>x.grade===d);
  for(const p of parents)for(let k=0;k<7&&target[d-1]<5;k++)tryCandidate(mirror(p.state,k),d);
  const maxAttempts=d===10?5000:2500;let trials=0;
  while(target[d-1]<5&&trials++<maxAttempts){
   const candidates=pool.filter(p=>Math.abs(p.grade-d)<=1);const parent=candidates[rand(candidates.length)];
   const s=mutate(parent.state);if(!s)continue;tryCandidate(s,d);
   if(trials%250===0)console.error(size,'D'+d,target[d-1]+'/5',trials,'trials');
  }
  console.error(size,'D'+d,target[d-1]+'/5','tested',attempts);
  if(target[d-1]!==5)throw Error(size+' D'+d+' needs '+(5-target[d-1])+' more levels');
 }
 const file=`content/levels/packs/expansion-v2-${size}.json`;
 fs.writeFileSync(file,JSON.stringify({format:'ggrid-level-pack',formatVersion:1,levels:added}));
 console.log(JSON.stringify({size,added:added.length,byDifficulty:target,attempts,file}));
}
