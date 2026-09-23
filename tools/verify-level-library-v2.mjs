#!/usr/bin/env node
/* Validate all catalog packs using the actual GGrid game physics. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {classify} from './classify-level.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const catalog=read('content/levels/catalog.json'),calibration=read('tools/difficulty-calibration-v2.json');
const context=vm.createContext({structuredClone});vm.runInContext(fs.readFileSync(path.join(root,'js/game-core.js'),'utf8')+'\nthis.core={step,validateLevel}',context);
const {step,validateLevel}=context.core;
const signature=s=>JSON.stringify([s.width,s.height,s.exit.x,s.exit.y,s.exit.dir,s.objects.map(o=>[o.type,o.x,o.y,o.cells.map(c=>[c.x,c.y]).sort((a,b)=>a[0]-b[0]||a[1]-b[1])]).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)))]);
const ids=new Set(),structures=new Set(),counts={},expansion={};let total=0;
for(const packInfo of catalog.packs){
 const file='content/levels/'+packInfo.src,pack=read(file);if(pack.format!=='ggrid-level-pack')throw Error('Invalid pack: '+file);
 for(const l of pack.levels){
  if(ids.has(l.levelId))throw Error('Duplicate ID '+l.levelId);ids.add(l.levelId);
  const size=`${l.board.width}x${l.board.height}`,grade=l.difficulty.class;
  const state={width:l.board.width,height:l.board.height,exit:{x:l.board.exit.x,y:l.board.exit.y,dir:l.board.exit.direction},objects:l.entities.map(e=>({id:e.id,type:e.type==='rigid-body'?'brick':e.type,x:e.position.x,y:e.position.y,cells:e.properties.cells})),moves:0,won:false};
  validateLevel(state);const sig=signature(state);if(structures.has(sig))throw Error('Duplicate puzzle '+l.levelId);structures.add(sig);
  if(grade!==1+calibration[size].filter(c=>l.difficulty.score>=c).length)throw Error('Incorrect difficulty '+l.levelId);
  let current=state;for(const dir of l.analysis.solution)current=step(current,dir).state;if(!current.won)throw Error('Invalid solution '+l.levelId);
  (counts[size]??=Array(10).fill(0))[grade-1]++;
  if(file.includes('expansion-v2-')){
   (expansion[size]??=Array(10).fill(0))[grade-1]++;
   if(process.argv.includes('--deep')){const measurement=classify({id:l.levelId,state});if(measurement.status!=='ok'||measurement.difficulty!==grade||measurement.raw!==l.difficulty.score)throw Error('Classifier mismatch '+l.levelId)}
  }
  total++;
 }
}
if(total!==762||Object.keys(counts).length!==6||Object.values(counts).some(a=>a.length!==10||a.some(n=>n<10))||Object.values(expansion).some(a=>a.some(n=>n!==5)))throw Error('Coverage failed: '+JSON.stringify({total,counts,expansion}));
console.log(JSON.stringify({total,coverage:counts,newLevels:expansion,deep:process.argv.includes('--deep')},null,2));
