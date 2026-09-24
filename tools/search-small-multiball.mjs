import fs from 'node:fs';
import {analyzeState} from './classify-multiball-v2.mjs';
import {signature} from './multiball-physics.mjs';
import {workFile} from './multiball-workspace.mjs';
const file=workFile('mb2-3x3.json'),data=JSON.parse(fs.readFileSync(file,'utf8')),seen=new Set(data.checked);
let best=Infinity,tested=0;
function save(){data.checked=[...seen];fs.writeFileSync(file+'.tmp',JSON.stringify(data));fs.renameSync(file+'.tmp',file);}
outer:for(let n=1;n<=4;n++)for(const ey of [0,1,2])for(let a=0;a<9;a++)for(let b=a+1;b<9;b++){
 const other=Array.from({length:9},(_,i)=>i).filter(i=>i!==a&&i!==b);
 function visit(i,objs){
  if(data.accepted.filter(p=>p.a.difficulty===1).length>=4)return;
  if(objs.length===n){
   const s={width:3,height:3,exit:{x:2,y:ey,dir:'right'},moves:0,won:false,objects:[a,b].map((v,j)=>({id:'ball'+j,type:'ball',x:v%3,y:Math.floor(v/3),cells:[{x:0,y:0}]})).concat(objs)};
   const sig=signature(s);if(seen.has(sig))return;seen.add(sig);tested++;data.attempts++;
   const r=analyzeState(s);if(r.status==='ok'&&r.raw<best){best=r.raw;console.log(JSON.stringify({tested,best,grade:r.difficulty}));}
   if(r.status==='ok'&&r.difficulty===1){data.accepted.push({s,a:r});save();console.log('D1 found');}
   return;
  }
  for(let k=i;k<other.length;k++)for(const type of ['wall','brick']){const v=other[k];visit(k+1,[...objs,{id:'o'+k,type,x:v%3,y:Math.floor(v/3),cells:[{x:0,y:0}]}]);}
 }
 visit(0,[]);if(tested%100<10){save();console.log(JSON.stringify({tested,n,best}));}
 if(data.accepted.filter(p=>p.a.difficulty===1).length>=4)break outer;
}
save();console.log(JSON.stringify({tested,best,coverage:Array.from({length:10},(_,i)=>data.accepted.filter(p=>p.a.difficulty===i+1).length)}));
