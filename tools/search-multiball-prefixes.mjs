import fs from 'node:fs';
import {analyzeState} from './classify-multiball-v2.mjs';
import {step,signature} from './multiball-physics.mjs';
import {workFile} from './multiball-workspace.mjs';
const size=process.argv[2],file=workFile(`mb2-${size}.json`),data=JSON.parse(fs.readFileSync(file,'utf8')),seen=new Set(data.checked);
const coverage=()=>Array.from({length:10},(_,i)=>data.accepted.filter(p=>p.a.difficulty===i+1).length);
function save(){data.checked=[...seen];fs.writeFileSync(file+'.tmp',JSON.stringify(data));fs.renameSync(file+'.tmp',file);}
for(const p of [...data.accepted]){let s=p.s;
 for(const dir of p.a.optimalSolution){s=step(s,dir).state;if(s.objects.some(o=>o.type==='ball'&&o.exited))break;
  s={...s,moves:0,won:false};const sig=signature(s);if(seen.has(sig))continue;seen.add(sig);data.attempts++;
  const a=analyzeState(s);if(a.status==='ok'&&coverage()[a.difficulty-1]<4){data.accepted.push({s,a});save();console.log(JSON.stringify({size,grade:a.difficulty,coverage:coverage()}));}
 }
}save();console.log(JSON.stringify({size,coverage:coverage()}));
