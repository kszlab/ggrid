#!/usr/bin/env node
/* GGrid two-ball difficulty estimator v1 (puzzle-v3-multiball). */
import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),context=vm.createContext({structuredClone});
vm.runInContext(fs.readFileSync(path.join(root,'js/game-core.js'),'utf8')+'\n'+fs.readFileSync(path.join(root,'js/solver.js'),'utf8')+'\nthis.physics={step,validateLevel,solveDetailed}',context);
const {step,validateLevel,solveDetailed}=context.physics,clamp=x=>Math.max(0,Math.min(1,x));
function hash32(str){let h=2166136261>>>0;for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
function tieBreak(s){const sig=JSON.stringify([s.width,s.height,s.exit,[...s.objects].map(o=>[o.type,o.x,o.y,[...o.cells].map(c=>[c.x,c.y]).sort((a,b)=>a[0]-b[0]||a[1]-b[1])]).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)))]);return(hash32(sig)/4294967296)*1e-6}
const calibration=JSON.parse(fs.readFileSync(path.join(root,'tools/difficulty-calibration-multiball-v1.json'),'utf8'));
function stateFromRecord(r){const exit=r.board?.exit||r.exit,entities=r.entities||r.objects||[];return{width:r.board.width,height:r.board.height,exit:{x:exit.x,y:exit.y,dir:exit.direction||exit.dir},moves:0,won:false,objects:entities.map((e,i)=>({id:e.id||'e'+i,type:e.type==='rigid-body'?'brick':e.type,x:e.position?.x??e.x,y:e.position?.y??e.y,cells:e.properties?.cells||e.cells||[{x:0,y:0}]}))}}
function distance(o,s){return o.exited?0:Math.abs(o.x-s.exit.x)+Math.abs(o.y-s.exit.y)+1}
function analyzeState(s){
 validateLevel(s);if(s.objects.filter(o=>o.type==='ball').length!==2)return{status:'unsupported_ball_count'};
 const solved=solveDetailed(s,{maxDepth:55,maxStates:60000,timeBudgetMs:0});if(solved.status!=='solved'||!solved.path.length)return{status:solved.status,reason:solved.reason||null,searchedStates:solved.states};
 const base=structuredClone(s);base.objects=base.objects.filter(o=>o.type==='ball');const bs=solveDetailed(base,{maxDepth:40,maxStates:10000,timeBudgetMs:0});if(bs.status!=='solved')return{status:'baseline_'+bs.status};
 let cur=structuredClone(s),turns=0,setup=0,retreat=0,conflict=0,firstExit=0,firstExitId=null;
 const startBalls=cur.objects.filter(o=>o.type==='ball'),minD=Math.min(...startBalls.map(o=>distance(o,cur))),nearest=new Set(startBalls.filter(o=>distance(o,cur)===minD).map(o=>o.id));
 for(let i=0;i<solved.path.length;i++){if(i&&solved.path[i]!==solved.path[i-1])turns++;const before=cur,bd=new Map(before.objects.filter(o=>o.type==='ball'&&!o.exited).map(o=>[o.id,distance(o,before)]));cur=step(cur,solved.path[i],null).state;const deltas=[];for(const o of cur.objects.filter(o=>o.type==='ball')){const prev=bd.get(o.id);if(prev==null)continue;deltas.push(prev-distance(o,cur));if(o.exited&&!firstExit){firstExit=i+1;firstExitId=o.id}}if(!deltas.some(x=>x>0))setup++;if(deltas.some(x=>x>0)&&deltas.some(x=>x<0))conflict++;if(deltas.reduce((a,x)=>a+x,0)<0)retreat++}
 const L=solved.path.length,B=bs.path.length,det=Math.max(0,L-B),late=(firstExit||L)/L,counter=firstExitId&&!nearest.has(firstExitId)?1:0;
 const signal=clamp(.24*clamp((L-2)/(1.6*(s.width+s.height)))+.24*clamp(det/Math.max(2,B))+.14*clamp(turns/Math.max(1,L-1))+.12*clamp(setup/Math.max(1,L))+.10*clamp(conflict/Math.max(1,L))+.06*clamp(retreat/Math.max(1,L))+.05*late+.05*counter),raw=1+9*signal;
 return{status:'ok',raw,rankScore:raw+tieBreak(s),optimalSolution:solved.path,metrics:{optimalMoves:L,baselineMoves:B,detourMoves:det,directionChanges:turns,setupMoves:setup,retreatMoves:retreat,conflictMoves:conflict,firstExitMove:firstExit||L,secondPhaseMoves:L-(firstExit||L),counterIntuitiveFirstExit:counter,searchedStates:solved.states}};
}
function classifyRecord(r){const s=stateFromRecord(r),a=analyzeState(s);if(a.status!=='ok')return a;const bounds=calibration[s.width+'x'+s.height];if(!bounds)throw Error('No calibration for '+s.width+'x'+s.height);return{...a,difficulty:1+bounds.filter(x=>a.rankScore>=x).length,model:'puzzle-v3-multiball'}}
export{stateFromRecord,analyzeState,classifyRecord};
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){const file=process.argv[2];if(!file)throw Error('Usage: node tools/classify-multiball-level.mjs level-or-pack.json');const d=JSON.parse(fs.readFileSync(file,'utf8')),rows=d.format==='ggrid-level-pack'?d.levels:[d],out=rows.map(classifyRecord);console.log(JSON.stringify(out.length===1?out[0]:out,null,2));if(out.some(x=>x.status!=='ok'))process.exitCode=1}
