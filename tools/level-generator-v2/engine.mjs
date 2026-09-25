// GGrid Fast Generator v2 shared engine loader.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const engine=new Function(read('js/game-core.js')+'\n'+read('js/solver.js')+
 '\nreturn {step,validateLevel,cloneState,solveDetailed,'+
 'solveDetailedLegacy:typeof solveDetailedLegacy==="function"?solveDetailedLegacy:null,'+
 'compileCompactState:typeof compileCompactState==="function"?compileCompactState:null,DIR_NAMES}')();
if(!engine.compileCompactState)throw Error('Fast Generator v2 needs GGrid v0.15.21+ compact solver.');

export const {step,validateLevel,solveDetailed,solveDetailedLegacy,compileCompactState,DIR_NAMES}=engine;
export const DIRECTIONS=['up','down','left','right'];
if(DIR_NAMES.join()!==DIRECTIONS.join())throw Error('Unexpected direction order: '+DIR_NAMES.join());

export function compile(state){
 const c=compileCompactState(state);
 if(!c)throw Error('State needs legacy solver; Fast Generator v2 currently requires single-cell balls.');
 return c;
}
export function readJson(rel){return JSON.parse(read(rel))}
export function stateFromRecord(r){
 const exit=r.board.exit;
 return {width:r.board.width,height:r.board.height,exit:{dir:exit.direction||exit.dir,x:exit.x,y:exit.y},moves:0,won:false,
  objects:r.entities.map((e,i)=>({id:e.id||('e'+i),type:e.type==='rigid-body'?'brick':e.type,x:e.position.x,y:e.position.y,
   exited:false,cells:e.properties?.cells||[{x:0,y:0}]}))};
}
function recordsFromCatalog(rel){
 try{
  const cat=readJson(rel);
  const base=path.dirname(rel);
  return (cat.packs||[]).flatMap(p=>readJson(path.join(base,p.src).split(path.sep).join('/')).levels||[]);
 }catch(_){return []}
}
export function libraryRecords(){
 return [...recordsFromCatalog('content/levels/catalog.json'),...recordsFromCatalog('content/levels/multiball/catalog.json')];
}
