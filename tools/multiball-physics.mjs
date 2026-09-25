import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
const core=fs.readFileSync(new URL('../js/game-core.js',import.meta.url),'utf8');
const solver=fs.readFileSync(new URL('../js/solver.js',import.meta.url),'utf8');
// Execute the unchanged production engine in Node's realm (no cross-realm clones).
// step only changes object positions/exited and top-level moves/won. Geometry
// is immutable during search; sharing it avoids cloning every cell at every edge.
const searchClone=s=>({...s,objects:s.objects.map(o=>({...o}))});
export const production=new Function(core+'\n'+solver+'\nreturn {step,validateLevel,solveDetailed,stateKey}')();
const engine=new Function('structuredClone','searchStep',core+'\n'+solver.replace(/\bstep\(/g,'searchStep(')+'\nreturn {step,validateLevel,solveDetailed:solveDetailedLegacy,stateKey}')(searchClone,searchStep);
export const {step,validateLevel,stateKey}=engine;
let cache=new Map(),geometries=new Map(),geometry=0;
export function resetSearchCache(){cache=new Map();geometries=new Map();}
function searchStep(s,d){
 const k=geometry+'|'+d+'|'+s.objects.map(o=>o.exited?'X':o.x+','+o.y).join('|');
 const previous=cache.get(k);if(previous)return previous;
 const result=engine.step(s,d);if(cache.size<20000)cache.set(k,result);return result;
}
export function solveDetailed(s,options){
 const k=JSON.stringify([s.width,s.height,s.exit,s.objects.map(o=>[o.id,o.type,o.cells])]);
 if(!geometries.has(k))geometries.set(k,geometries.size);geometry=geometries.get(k);
 return engine.solveDetailed(s,options);
}
export function stateFromRecord(r){return {width:r.board.width,height:r.board.height,exit:{x:r.board.exit.x,y:r.board.exit.y,dir:r.board.exit.direction||r.board.exit.dir},moves:0,won:false,objects:r.entities.map(e=>({id:e.id,type:e.type==='rigid-body'?'brick':e.type,x:e.position.x,y:e.position.y,cells:e.properties.cells}))};}
export function signature(s){return JSON.stringify([s.width,s.height,s.exit.x,s.exit.y,s.exit.dir,s.objects.map(o=>[o.type,o.x,o.y,o.cells.map(c=>[c.x,c.y]).sort()]).sort()]);}
