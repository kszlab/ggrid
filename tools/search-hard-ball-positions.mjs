import fs from 'node:fs';
import {analyzeState} from './classify-multiball-v2.mjs';
import {signature,validateLevel} from './multiball-physics.mjs';
import {workFile} from './multiball-workspace.mjs';
const size=process.argv[2],data=JSON.parse(fs.readFileSync(workFile(`mb2-${size}.json`),'utf8')),seen=new Set(data.checked),found=[];
const out=workFile(`hard-positions-${size}.json`);let trials=0;
outer:for(const p of [...data.reserve,...data.accepted.filter(p=>p.a.difficulty>=9)].sort((p,q)=>q.a.raw-p.a.raw).slice(0,12)){
 for(let i=0;i<p.s.objects.length;i++){if(p.s.objects[i].type!=='ball')continue;
  for(let y=0;y<p.s.height;y++)for(let x=0;x<p.s.width;x++){
   const s=structuredClone(p.s);s.objects[i].x=x;s.objects[i].y=y;try{validateLevel(s)}catch{continue;}
   const sig=signature(s);if(seen.has(sig))continue;seen.add(sig);trials++;
   const a=analyzeState(s);if(a.status==='ok'&&a.difficulty===10){found.push({s,a});fs.writeFileSync(out,JSON.stringify(found));console.log(JSON.stringify({size,trials,found:found.length,raw:a.raw}));if(found.length>=4)break outer;}
   if(trials%20===0)console.log(JSON.stringify({size,trials,found:found.length}));
  }
 }
}fs.writeFileSync(out,JSON.stringify(found));console.log(JSON.stringify({size,complete:true,trials,found:found.length}));
