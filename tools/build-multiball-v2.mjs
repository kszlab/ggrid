import fs from 'node:fs';
import {analyzeState,model} from './classify-multiball-v2.mjs';
import {stateFromRecord,signature} from './multiball-physics.mjs';
import {workFile} from './multiball-workspace.mjs';
const size=process.argv[2]||'3x3',limit=Number(process.argv[3]||1000),[w,h]=size.split('x').map(Number);
const checkpoint=workFile(`mb2-${size}.json`);
let data=fs.existsSync(checkpoint)?JSON.parse(fs.readFileSync(checkpoint,'utf8')):{model,size,attempts:0,seed:240926+w*100+h,accepted:[],checked:[],stats:{}};
if(data.model!==model)throw Error('Checkpoint model mismatch');
const seen=new Set(data.checked),pool=data.accepted;data.reserve??=[];
const files=fs.readdirSync('content/levels/packs').filter(f=>f.endsWith('-'+size+'.json'));
const anchors=files.flatMap(f=>JSON.parse(fs.readFileSync('content/levels/packs/'+f,'utf8')).levels).map(l=>({s:stateFromRecord(l),d:l.difficulty.class}));
const rand=n=>{data.seed=(Math.imul(data.seed,1664525)+1013904223)>>>0;return Math.floor(data.seed/4294967296*n)};
const free=(s,exclude)=>{const occ=new Set(s.objects.filter(o=>o!==exclude).flatMap(o=>o.cells.map(c=>(o.x+c.x)+','+(o.y+c.y))));const out=[];for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(!occ.has(x+','+y))out.push({x,y});return out};
function candidate(){
 const counts=coverage(),missing=counts.map((n,i)=>n<4?i+1:null).filter(Boolean),target=missing[rand(missing.length)];
 const useRandom=rand(5)===0;
 const useMutation=!useRandom&&pool.length&&rand(3)!==0;
 let s;
 if(useRandom){
  const dir=['up','down','left','right'][rand(4)];s={width:w,height:h,exit:{dir,x:dir==='left'?0:dir==='right'?w-1:rand(w),y:dir==='up'?0:dir==='down'?h-1:rand(h)},moves:0,won:false,objects:[]};
  const n=2+rand(Math.max(2,Math.floor(w*h*.50)));
  for(let i=0;i<n;i++){const spots=free(s);if(!spots.length)break;s.objects.push({id:i<2?'ball'+(i+1):'o'+i,type:i<2?'ball':rand(4)===0?'wall':'brick',...spots[rand(spots.length)],cells:[{x:0,y:0}]});}
 }else if(useMutation){const parents=[...pool,...data.reserve],near=parents.filter(p=>Math.abs(p.a.difficulty-target)<=1);s=structuredClone((near.length?near:parents)[rand((near.length?near:parents).length)].s);
  const o=s.objects[rand(s.objects.length)],spots=free(s,o).filter(p=>o.cells.every(c=>p.x+c.x>=0&&p.y+c.y>=0&&p.x+c.x<w&&p.y+c.y<h&&free(s,o).some(q=>q.x===p.x+c.x&&q.y===p.y+c.y)));
  if(spots.length)Object.assign(o,spots[rand(spots.length)]);
 }else{const near=anchors.filter(p=>Math.abs(p.d-target)<=1),p=(near.length?near:anchors)[rand((near.length?near:anchors).length)];s=structuredClone(p.s);const spots=free(s);if(!spots.length)return null;
  const ball=s.objects.find(o=>o.type==='ball'),nearBall=spots.filter(p=>Math.abs(p.x-ball.x)+Math.abs(p.y-ball.y)<=2),choices=target>=8&&nearBall.length?nearBall:spots;
  s.objects.push({id:'ball2',type:'ball',...choices[rand(choices.length)],cells:[{x:0,y:0}]});
 }
 // Enrich large boards with a connected movable domino/L/triomino.
 if(w>=5&&!s.objects.some(o=>o.type==='brick'&&o.cells.length>1)){
  const shapes=[[{x:0,y:0},{x:1,y:0}],[{x:0,y:0},{x:0,y:1}],[{x:0,y:0},{x:1,y:0},{x:0,y:1}],[{x:0,y:0},{x:1,y:0},{x:2,y:0}]];
  const shape=shapes[rand(shapes.length)],spots=free(s),positions=spots.filter(p=>shape.every(c=>spots.some(q=>q.x===p.x+c.x&&q.y===p.y+c.y)));
  if(!positions.length)return null;
  s.objects.push({id:'shape'+s.objects.length,type:'brick',...positions[rand(positions.length)],cells:shape});
 }
 return s;
}
function coverage(){return Array.from({length:10},(_,i)=>pool.filter(p=>p.a.difficulty===i+1).length)}
function save(){data.checked=[...seen];fs.writeFileSync(checkpoint+'.tmp',JSON.stringify(data));fs.renameSync(checkpoint+'.tmp',checkpoint);}
const start=data.attempts;
if(data.riskStates!==10000){
 for(const p of pool)if(p.a.metrics.unknownMistakeAlternatives)p.a=analyzeState(p.s);
 data.riskStates=10000;save();console.log(JSON.stringify({size,refined:true,coverage:coverage()}));
}
while(data.attempts<start+limit&&coverage().some(n=>n<4)){
 data.attempts++;const s=candidate();if(!s)continue;const sig=signature(s);if(seen.has(sig))continue;seen.add(sig);
 const t=Date.now();let a=analyzeState(s);data.stats[a.status]=(data.stats[a.status]||0)+1;
 if(a.status==='ok'&&coverage()[a.difficulty-1]<4){pool.push({s,a});save();console.log(JSON.stringify({size,attempt:data.attempts,grade:a.difficulty,ms:Date.now()-t,coverage:coverage()}));}
 else if(a.status==='ok'&&a.difficulty>=8){data.reserve.push({s,a});data.reserve.sort((p,q)=>q.a.raw-p.a.raw);data.reserve=data.reserve.slice(0,40);}
 if(data.attempts%10===0){save();console.log(JSON.stringify({size,attempt:data.attempts,stats:data.stats,coverage:coverage()}));}
}
save();console.log(JSON.stringify({size,complete:coverage().every(n=>n>=4),attempts:data.attempts,coverage:coverage()}));
