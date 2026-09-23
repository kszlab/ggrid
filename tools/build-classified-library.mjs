#!/usr/bin/env node
/* Deterministically expand the LF2 calibration set without modifying old IDs. */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {builtins,classify} from './classify-level.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
let seed=20260924;function rand(n){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%n}
const sizes=[[3,3],[4,4],[5,5],[5,6],[5,7],[5,8]],targets=new Map(),added=[],existing=builtins();
const results=existing.map(classify);if(results.some(x=>x.status!=='ok'))throw Error('Existing level analysis failed');
const map=Object.fromEntries(results.map(r=>[r.levelId,{class:r.difficulty,raw:r.raw,model:r.model}]));
const sizeKey=(w,h)=>`${w}x${h}`,key=(w,h,g)=>`${sizeKey(w,h)}|${g}`;
for(const [w,h] of sizes)for(let g=1;g<=10;g++)targets.set(key(w,h,g),0);
for(let i=0;i<results.length;i++){const s=existing[i].state;targets.set(key(s.width,s.height,results[i].difficulty),targets.get(key(s.width,s.height,results[i].difficulty))+1)}
function fingerprint(s){return JSON.stringify([s.width,s.height,s.exit,[...s.objects].map(o=>[o.type,o.x,o.y,[...o.cells].map(c=>[c.x,c.y]).sort()]).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)))]).replaceAll(' ', '')}
const seen=new Set(existing.map(e=>fingerprint(e.state)));
const dirMaps=[{left:'right',right:'left',up:'up',down:'down'},{left:'left',right:'right',up:'down',down:'up'},{left:'right',right:'left',up:'down',down:'up'},{left:'up',right:'down',up:'left',down:'right'},{left:'up',right:'down',up:'right',down:'left'},{left:'down',right:'up',up:'left',down:'right'},{left:'down',right:'up',up:'right',down:'left'}];
function symmetry(s,kind){
 const w=s.width,h=s.height,transform=([x,y])=>kind===0?[w-1-x,y]:kind===1?[x,h-1-y]:kind===2?[w-1-x,h-1-y]:kind===3?[y,x]:kind===4?[w-1-y,x]:kind===5?[y,h-1-x]:[w-1-y,h-1-x];
 const axisSwap=kind>=3;if(axisSwap&&w!==h)return null;
 const objects=s.objects.map(o=>{const absolute=o.cells.map(c=>transform([o.x+c.x,o.y+c.y])),x=Math.min(...absolute.map(c=>c[0])),y=Math.min(...absolute.map(c=>c[1]));return {...o,x,y,cells:absolute.map(([a,b])=>({x:a-x,y:b-y}))}});
 const [x,y]=transform([s.exit.x,s.exit.y]);return {...s,exit:{x,y,dir:dirMaps[kind][s.exit.dir]},objects,moves:0,won:false};
}
function add(s,known){
 const sig=fingerprint(s);if(seen.has(sig))return false;seen.add(sig);
 let out;try{out=classify({id:'candidate',state:s})}catch{return false}
 if(out.status!=='ok'||targets.get(key(s.width,s.height,out.difficulty))>=5)return false;
 const g=out.difficulty;targets.set(key(s.width,s.height,g),targets.get(key(s.width,s.height,g))+1);
 const id=`LC1-${s.width}X${s.height}-${String(added.length+1).padStart(4,'0')}`;
 added.push({id,state:s,analysis:out});return true;
}
for(let i=0;i<existing.length;i++){
 const e=existing[i],original=results[i];
 const s=e.state;if([...targets].every(([k,n])=>!k.startsWith(sizeKey(s.width,s.height)+'|')||n>=5))continue;
 for(let kind=0;kind<7;kind++){const transformed=symmetry(s,kind);if(transformed&&targets.get(key(s.width,s.height,original.difficulty))<5)add(transformed,{...original,optimalSolution:original.optimalSolution.map(dir=>dirMaps[kind][dir])})}
}
function direct(w,h){
 const dirs=['left','right','up','down'],dir=dirs[rand(4)],x=dir==='left'?0:dir==='right'?w-1:rand(w),y=dir==='up'?0:dir==='down'?h-1:rand(h);
 const offset=1+rand(dir==='left'||dir==='right'?w:h),bx=dir==='left'?Math.min(w-1,offset-1):dir==='right'?Math.max(0,w-offset):x,by=dir==='up'?Math.min(h-1,offset-1):dir==='down'?Math.max(0,h-offset):y;
 const objects=[{id:'ball1',type:'ball',x:bx,y:by,cells:[{x:0,y:0}]}];
 return {width:w,height:h,exit:{x,y,dir},objects,moves:0,won:false};
}
for(const [w,h] of sizes)for(let attempts=0;targets.get(key(w,h,1))<5&&attempts<300;attempts++)add(direct(w,h));
let attempts=0;
while([...targets.values()].some(x=>x<5)&&attempts++<1000){
 const missing=[...targets].filter(([,v])=>v<5);const [wanted]=missing[rand(missing.length)],parts=wanted.split('|'),[w,h]=parts[0].split('x').map(Number),grade=+parts[1];
 const local=[...existing.map((e,i)=>({...e,analysis:results[i]})),...added].filter(e=>e.state.width===w&&e.state.height===h);
 const pool=local.filter(e=>Math.abs(e.analysis.difficulty-grade)<=1);if(!pool.length)continue;
 let e=pool[rand(pool.length)],s=structuredClone(e.state);s.moves=0;s.won=false;
 if(rand(4)===0){const k=rand(w===h?7:3),t=symmetry(s,k);if(t)s=t}
 const occ=new Set(s.objects.flatMap(o=>o.cells.map(c=>`${o.x+c.x},${o.y+c.y}`)));
 const movable=s.objects.filter(o=>o.type!=='ball'&&o.cells.length===1);
 if(rand(4)===0&&s.objects.length<w*h/2){const cells=[];for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(!occ.has(`${x},${y}`))cells.push([x,y]);if(!cells.length)continue;const [x,y]=cells[rand(cells.length)];s.objects.push({id:'new'+s.objects.length,type:rand(3)?'brick':'wall',x,y,cells:[{x:0,y:0}]})}
 else if(movable.length){const o=movable[rand(movable.length)],cells=[];for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(!occ.has(`${x},${y}`))cells.push([x,y]);if(!cells.length)continue;const [x,y]=cells[rand(cells.length)];o.x=x;o.y=y}
 else continue;
 add(s);
 if(attempts%1000===0)console.error('attempts',attempts,'remaining',[...targets.values()].reduce((a,n)=>a+Math.max(0,5-n),0));
}
const missing=[...targets].filter(([,n])=>n<5);console.error('generated',added.length,'attempts',attempts,'missing',missing);
const outDir=path.join(root,'content/levels/packs');fs.mkdirSync(outDir,{recursive:true});
const levels=added.map(({id,state:s,analysis:a})=>({format:'ggrid-level',formatVersion:2,levelId:id,rulesVersion:1,requires:{features:['core.movement','core.exit','object.ball','object.rigid-body','object.wall']},board:{width:s.width,height:s.height,exit:{direction:s.exit.dir,x:s.exit.x,y:s.exit.y}},entities:s.objects.map(o=>({id:o.id,type:o.type==='brick'?'rigid-body':o.type,position:{x:o.x,y:o.y},properties:{cells:o.cells}})),initialResources:{freeze:0},difficulty:{class:a.difficulty,score:a.raw,modelVersion:a.model},analysis:{solution:a.optimalSolution,metrics:a.metrics}}));
fs.writeFileSync(path.join(outDir,'classified-v1.json'),JSON.stringify({format:'ggrid-level-pack',formatVersion:1,levels}));
fs.writeFileSync(path.join(root,'content/levels/classification-v1.js'),'/* Generated by tools/build-classified-library.mjs */\nconst GGRID_CLASSIFICATION_V1='+JSON.stringify(map)+';\n');
if(missing.length)process.exitCode=1;
