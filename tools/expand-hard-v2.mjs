#!/usr/bin/env node
/* Search genuinely harder puzzles than the previous library's ceiling. */
import fs from 'node:fs';
import {classify} from './classify-level.mjs';
const base=JSON.parse(fs.readFileSync('content/levels/packs/classified-v2.json','utf8'));
const audits=[...JSON.parse(fs.readFileSync('tools/audit-original-v2.json','utf8')),...JSON.parse(fs.readFileSync('tools/audit-extra-v2.json','utf8'))];
const sizes=['3x3','4x4','5x5','5x6','5x7','5x8'];
function raw(a){const c=a.components;return 1+9*((.25*c.solution+.35*c.dependency+.15*c.decision+.15*c.mistakes+.1*c.uniqueness)-.24)/.72}
const gates=Object.fromEntries(sizes.map(size=>[size,Math.max(...audits.filter(a=>a.levelId.includes(size.toUpperCase())&&a.status==='ok').map(raw))+.012]));
function state(l){return {width:l.board.width,height:l.board.height,exit:{...l.board.exit,dir:l.board.exit.direction},objects:l.entities.map(e=>({id:e.id,type:e.type==='rigid-body'?'brick':e.type,x:e.position.x,y:e.position.y,cells:e.properties.cells})),moves:0,won:false}}
function fingerprint(s){return JSON.stringify([s.width,s.height,s.exit.x,s.exit.y,s.exit.dir,[...s.objects].map(o=>[o.type,o.x,o.y,o.cells.map(c=>[c.x,c.y]).sort()]).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)))])}
const seen=new Set(base.levels.map(l=>fingerprint(state(l))));
let seed=20260925;const rand=n=>(seed=(Math.imul(seed,1664525)+1013904223)>>>0)%n;
const maps=[{left:'right',right:'left',up:'up',down:'down'},{left:'left',right:'right',up:'down',down:'up'},{left:'right',right:'left',up:'down',down:'up'},{left:'up',right:'down',up:'left',down:'right'},{left:'up',right:'down',up:'right',down:'left'},{left:'down',right:'up',up:'left',down:'right'},{left:'down',right:'up',up:'right',down:'left'}];
function reflect(s,k){let w=s.width,h=s.height;if(k>=3&&w!==h)return null;const tf=([x,y])=>k===0?[w-1-x,y]:k===1?[x,h-1-y]:k===2?[w-1-x,h-1-y]:k===3?[y,x]:k===4?[w-1-y,x]:k===5?[y,h-1-x]:[w-1-y,h-1-x];let objs=s.objects.map(o=>{let cells=o.cells.map(c=>tf([o.x+c.x,o.y+c.y])),x=Math.min(...cells.map(c=>c[0])),y=Math.min(...cells.map(c=>c[1]));return {...o,x,y,cells:cells.map(([a,b])=>({x:a-x,y:b-y}))}}),[x,y]=tf([s.exit.x,s.exit.y]);return {...s,exit:{x,y,dir:maps[k][s.exit.dir]},objects:objs}}
const added=[];
function add(s,a,size){let sig=fingerprint(s);if(seen.has(sig))return false;seen.add(sig);if(a.status!=='ok'||a.raw<gates[size])return false;added.push({size,state:s,analysis:a});return true}
for(const size of sizes){
 let pool=base.levels.filter(l=>l.board.width+'x'+l.board.height===size).sort((a,b)=>b.difficulty.score-a.difficulty.score).slice(0,20).map(l=>({s:state(l),raw:l.difficulty.score}));
 let attempts=0;
 while(added.filter(x=>x.size===size).length<5&&attempts++<1600){
  const candidate=pool[rand(Math.min(pool.length,30))],s=structuredClone(candidate.s),movable=s.objects.filter(o=>o.type!=='ball'&&o.cells.length===1),free=[];
  if(!movable.length)continue;
  const old=movable[rand(movable.length)],occ=new Set(s.objects.filter(o=>o!==old).flatMap(o=>o.cells.map(c=>`${o.x+c.x},${o.y+c.y}`)));
  for(let y=0;y<s.height;y++)for(let x=0;x<s.width;x++)if(!occ.has(`${x},${y}`))free.push([x,y]);if(!free.length)continue;
  const [x,y]=free[rand(free.length)];old.x=x;old.y=y;
  if(seen.has(fingerprint(s)))continue;
  let a;try{a=classify({id:'candidate',state:s})}catch{continue}
  if(a.status!=='ok')continue;
  if(a.raw>gates[size]-.3){pool.push({s,raw:a.raw});pool.sort((a,b)=>b.raw-a.raw);pool=pool.slice(0,50)}
  if(a.raw<gates[size])continue;
  add(s,a,size);
  for(let k=0;k<7;k++){if(added.filter(x=>x.size===size).length>=5)break;const mirror=reflect(s,k);if(!mirror||seen.has(fingerprint(mirror)))continue;try{add(mirror,classify({id:'candidate',state:mirror}),size)}catch{}}
  if(attempts%100===0)console.error(size,'attempts',attempts,'hard',added.filter(x=>x.size===size).length);
 }
 console.error(size,'hard',added.filter(x=>x.size===size).length,'attempts',attempts,'gate',gates[size].toFixed(3));
 fs.writeFileSync('tools/hard-candidates-v2.json',JSON.stringify({gates,added}));
 if(added.filter(x=>x.size===size).length<5){process.exitCode=1;break}
}
