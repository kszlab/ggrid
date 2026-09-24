import fs from 'node:fs';
import {analyzeState,calibration} from './classify-multiball-v2.mjs';
import {signature,validateLevel,step} from './multiball-physics.mjs';
import {workFile} from './multiball-workspace.mjs';
const size=process.argv[2],file=workFile(`mb2-${size}.json`),data=JSON.parse(fs.readFileSync(file,'utf8')),seen=new Set(data.checked);
const count=()=>data.accepted.filter(p=>p.a.difficulty===10).length;
function save(){data.checked=[...seen];fs.writeFileSync(file+'.tmp',JSON.stringify(data));fs.renameSync(file+'.tmp',file);}
let trials=0;data.reserve??=[];
function attempt(s){
 if(count()>=4||trials>=1800)return;try{validateLevel(s);}catch{return;}
 const sig=signature(s);if(seen.has(sig))return;seen.add(sig);trials++;data.attempts++;
 const a=analyzeState(s);
 if(a.status==='ok'){
  if(a.difficulty===10){data.accepted.push({s,a});save();console.log(JSON.stringify({size,D10:count(),raw:a.raw,trials}));}
  else if(a.raw>=calibration[size][8]-.6){data.reserve.push({s,a});data.reserve.sort((p,q)=>q.a.raw-p.a.raw);data.reserve=data.reserve.slice(0,40);}
 }
 if(trials%20===0){save();console.log(JSON.stringify({size,trials,best:data.reserve[0]?.a.raw,D10:count()}));}
}
const processed=new Set();
while(count()<4&&trials<1800){
 const parents=[...data.accepted.filter(p=>p.a.difficulty>=9),...data.reserve].sort((p,q)=>q.a.raw-p.a.raw);
 const p=parents.find(p=>!processed.has(signature(p.s)));if(!p)break;processed.add(signature(p.s));
 // Search starts a few moves into an existing hard puzzle, then local geometry.
 let prefix=p.s;for(const d of p.a.optimalSolution.slice(0,5)){prefix=step(prefix,d).state;if(prefix.objects.some(o=>o.type==='ball'&&o.exited))break;attempt({...prefix,moves:0,won:false});}
 for(let i=0;i<p.s.objects.length;i++){
  for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const s=structuredClone(p.s);s.objects[i].x+=dx;s.objects[i].y+=dy;attempt(s);}
  if(p.s.objects[i].type!=='ball'){const s=structuredClone(p.s);s.objects[i].type=s.objects[i].type==='wall'?'brick':'wall';if(s.objects.some(o=>o.type==='brick'&&o.cells.length>1))attempt(s);}
 }
 for(let y=0;y<p.s.height;y++)for(let x=0;x<p.s.width;x++)for(const type of ['wall','brick']){const s=structuredClone(p.s);s.objects.push({id:'hard'+s.objects.length,type,x,y,cells:[{x:0,y:0}]});attempt(s);}
}
save();console.log(JSON.stringify({size,finished:true,trials,D10:count()}));
