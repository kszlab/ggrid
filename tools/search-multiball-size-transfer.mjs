import fs from 'node:fs';
import {analyzeState} from './classify-multiball-v2.mjs';
import {signature,validateLevel} from './multiball-physics.mjs';
import {workFile} from './multiball-workspace.mjs';
const found=[],seen=new Set();let tested=0;
for(const size of ['5x7','5x6','5x5']){
 const data=JSON.parse(fs.readFileSync(workFile(`mb2-${size}.json`),'utf8'));
 for(const p of [...data.accepted,...(data.reserve||[])].filter(p=>p.a.difficulty>=8).sort((p,q)=>q.a.raw-p.a.raw)){
  const oldH=p.s.height;
  for(let offset=0;offset<=8-oldH;offset++){
   const s=structuredClone(p.s);s.height=8;s.objects.forEach(o=>o.y+=offset);
   s.exit.y=s.exit.dir==='down'?7:s.exit.dir==='up'?0:s.exit.y+offset;
   try{validateLevel(s)}catch{continue;}
   const sig=signature(s);if(seen.has(sig))continue;seen.add(sig);tested++;
   const a=analyzeState(s);
   if(a.status==='ok'&&a.difficulty===10){found.push({s,a});fs.writeFileSync(workFile('transferred-5x8.json'),JSON.stringify(found));console.log(JSON.stringify({from:size,tested,D10:found.length,raw:a.raw}));}
   if(tested%10===0)console.log(JSON.stringify({tested,D10:found.length}));
  }
 }
}
fs.writeFileSync(workFile('transferred-5x8.json'),JSON.stringify(found));console.log(JSON.stringify({complete:true,tested,D10:found.length}));
