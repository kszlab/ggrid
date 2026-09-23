#!/usr/bin/env node
/* Regenerate a nontrivial library from the independent structural classifier. */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {builtins,classify} from './classify-level.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const old=JSON.parse(fs.readFileSync(path.join(root,'content/levels/packs/classified-v1.json'),'utf8')).levels;
const audits=[JSON.parse(fs.readFileSync(path.join(root,'tools/audit-original-v2.json'),'utf8')),JSON.parse(fs.readFileSync(path.join(root,'tools/audit-extra-v2.json'),'utf8'))];
const hard=JSON.parse(fs.readFileSync(path.join(root,'tools/hard-candidates-v2.json'),'utf8'));
for(const a of audits.flat())if(a.status==='ok'){const c=a.components;a.raw=+(1+9*((.25*c.solution+.35*c.dependency+.15*c.decision+.15*c.mistakes+.10*c.uniqueness)-.24)/.72).toFixed(3)}
const originals=builtins().concat(old.map(l=>({id:l.levelId,state:{width:l.board.width,height:l.board.height,exit:{x:l.board.exit.x,y:l.board.exit.y,dir:l.board.exit.direction},objects:l.entities.map(e=>({id:e.id,type:e.type==='rigid-body'?'brick':e.type,x:e.position.x,y:e.position.y,cells:e.properties.cells})),moves:0,won:false}})));
const audit=audits.flat();if(audit.length!==originals.length||audit.some((a,i)=>a.levelId!==originals[i].id))throw Error('Audit does not match the source levels');
const sizes=['3x3','4x4','5x5','5x6','5x7','5x8'],dirMaps=[{left:'right',right:'left',up:'up',down:'down'},{left:'left',right:'right',up:'down',down:'up'},{left:'right',right:'left',up:'down',down:'up'},{left:'up',right:'down',up:'left',down:'right'},{left:'up',right:'down',up:'right',down:'left'},{left:'down',right:'up',up:'left',down:'right'},{left:'down',right:'up',up:'right',down:'left'}];
let seed=20260924;function rand(n){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%n}
const key=s=>s.width+'x'+s.height;
function fingerprint(s){return JSON.stringify([s.width,s.height,s.exit,[...s.objects].map(o=>[o.type,o.x,o.y,[...o.cells].map(c=>[c.x,c.y]).sort((a,b)=>a.x-b.x||a.y-b.y)]).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)))])}
const seen=new Set(),selected=[];
function add(state,result){const sig=fingerprint(state);if(seen.has(sig))return false;seen.add(sig);if(result.status!=='ok')return false;selected.push({state,analysis:result});return true}
for(let i=0;i<originals.length;i++)add(originals[i].state,audit[i]);
function symmetry(s,k){
 const w=s.width,h=s.height;if(k>=3&&w!==h)return null;
 const tf=([x,y])=>k===0?[w-1-x,y]:k===1?[x,h-1-y]:k===2?[w-1-x,h-1-y]:k===3?[y,x]:k===4?[w-1-y,x]:k===5?[y,h-1-x]:[w-1-y,h-1-x];
 const objects=s.objects.map(o=>{const cells=o.cells.map(c=>tf([o.x+c.x,o.y+c.y])),x=Math.min(...cells.map(v=>v[0])),y=Math.min(...cells.map(v=>v[1]));return {...o,x,y,cells:cells.map(([a,b])=>({x:a-x,y:b-y}))}});
 const [x,y]=tf([s.exit.x,s.exit.y]);return {...s,exit:{x,y,dir:dirMaps[k][s.exit.dir]},objects,moves:0,won:false};
}
for(const e of [...selected])for(let k=0;k<7;k++){if(selected.filter(v=>key(v.state)===key(e.state)).length>=72)break;const s=symmetry(e.state,k);if(s&&!seen.has(fingerprint(s))){let a;try{a=classify({id:'candidate',state:s})}catch{continue}add(s,a)}}
function enoughDiversity(size){try{boundaries(selected.filter(x=>key(x.state)===size&&x.analysis.raw<hard.gates[size]),size,9);return true}catch{return false}}
for(const size of sizes){
 let attempts=0;
 while((selected.filter(v=>key(v.state)===size).length<72||!enoughDiversity(size))&&attempts++<3000){
  const pool=selected.filter(v=>key(v.state)===size);if(!pool.length)break;
  let s=structuredClone(pool[rand(pool.length)].state);s.moves=0;s.won=false;
  const occupied=new Set(s.objects.flatMap(o=>o.cells.map(c=>`${o.x+c.x},${o.y+c.y}`))),free=[];
  for(let y=0;y<s.height;y++)for(let x=0;x<s.width;x++)if(!occupied.has(`${x},${y}`))free.push([x,y]);
  if(!free.length)continue;
  const movable=s.objects.filter(o=>o.type!=='ball'&&o.cells.length===1);
  if(movable.length&&rand(4)!==0){const ob=movable[rand(movable.length)],[x,y]=free[rand(free.length)];ob.x=x;ob.y=y}
  else {const [x,y]=free[rand(free.length)];s.objects.push({id:'new'+s.objects.length,type:rand(3)?'brick':'wall',x,y,cells:[{x:0,y:0}]})}
  if(seen.has(fingerprint(s)))continue;
  let a;try{a=classify({id:'candidate',state:s})}catch{continue}add(s,a);
 }
 console.error(size,selected.filter(v=>key(v.state)===size).length,'mutation attempts',attempts);
}
for(const e of hard.added){if(e.analysis.raw<hard.gates[e.size])throw Error('Hard candidate below its measured threshold');add(e.state,e.analysis)}
// Measure the final states again: cached source audits round component scores,
// and even a small rounding difference can move a level across a class boundary.
for(const e of selected){e.analysis=classify({id:'final',state:e.state});if(e.analysis.status!=='ok')throw Error('Invalid final candidate')}
function boundaries(rows,size,groups=9){
 const values=[...new Set(rows.map(x=>x.analysis.raw))].sort((a,b)=>a-b),counts=values.map(v=>rows.filter(x=>x.analysis.raw===v).length),n=counts.length,total=rows.length;
 if(total<groups*5||n<groups)throw Error(`${size}: insufficient qualified diversity ${total} / ${n}`);
 const prefix=[0];for(const c of counts)prefix.push(prefix.at(-1)+c);
 const dp=Array.from({length:groups+1},()=>Array(n+1).fill(Infinity)),prev=Array.from({length:groups+1},()=>Array(n+1).fill(-1));dp[0][0]=0;
 for(let g=1;g<=groups;g++)for(let j=g;j<=n;j++)for(let i=g-1;i<j;i++){
  const amount=prefix[j]-prefix[i];if(amount<5)continue;
  const cost=dp[g-1][i]+(amount-total/groups)**2;
  if(cost<dp[g][j]){dp[g][j]=cost;prev[g][j]=i}
 }
 if(!Number.isFinite(dp[groups][n]))throw Error(`${size}: cannot split distinct scores into ${groups} groups of five`);
 let j=n,cut=[];for(let g=groups;g>1;g--){const i=prev[g][j];cut.unshift((values[i-1]+values[i])/2);j=i}
 return cut;
}
const calibration={};for(const size of sizes)calibration[size]=[...boundaries(selected.filter(x=>key(x.state)===size&&x.analysis.raw<hard.gates[size]),size,9),hard.gates[size]];
const counters=Object.fromEntries(sizes.map(s=>[s,0]));
const levels=selected.map(({state:s,analysis:a})=>{
 const size=key(s),grade=1+calibration[size].filter(x=>a.raw>=x).length,id=`LV3-${size.toUpperCase()}-${String(++counters[size]).padStart(4,'0')}`;
 return {format:'ggrid-level',formatVersion:2,levelId:id,rulesVersion:1,requires:{features:['core.movement','core.exit','object.ball','object.rigid-body','object.wall']},board:{width:s.width,height:s.height,exit:{direction:s.exit.dir,x:s.exit.x,y:s.exit.y}},entities:s.objects.map(o=>({id:o.id,type:o.type==='brick'?'rigid-body':o.type,position:{x:o.x,y:o.y},properties:{cells:o.cells}})),initialResources:{freeze:0},difficulty:{class:grade,score:a.raw,modelVersion:'puzzle-v2'},analysis:{solution:a.optimalSolution,metrics:a.metrics}};
});
const counts={};for(const l of levels){const k=l.board.width+'x'+l.board.height;counts[k]??=Array(10).fill(0);counts[k][l.difficulty.class-1]++}
if(Object.values(counts).some(a=>a.some(x=>x<5)))throw Error('Coverage check failed: '+JSON.stringify(counts));
fs.writeFileSync(path.join(root,'tools/difficulty-calibration-v2.json'),JSON.stringify(calibration,null,2)+'\n');
fs.writeFileSync(path.join(root,'content/levels/packs/classified-v2.json'),JSON.stringify({format:'ggrid-level-pack',formatVersion:1,levels}));
for(const size of sizes)fs.writeFileSync(path.join(root,`content/levels/packs/classified-v2-${size}.json`),JSON.stringify({format:'ggrid-level-pack',formatVersion:1,levels:levels.filter(l=>`${l.board.width}x${l.board.height}`===size)}));
console.log(JSON.stringify({total:levels.length,coverage:counts},null,2));
