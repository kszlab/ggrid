#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateMetadataV3,familyIdFor,structureMetadata,qualityFor} from './level-metadata-v3.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const specs=[
 ['content/levels/catalog.json','core'],
 ['content/levels/multiball/catalog.json','multiball'],
 ['content/levels/generated-test/catalog.json','generated-test']
];
const read=rel=>JSON.parse(fs.readFileSync(path.join(root,rel),'utf8'));
let levels=0,packs=0,errors=[],largeRigid=0,oneBall=0,twoBall=0;const levelIds=new Set();

for(const [catPath,library] of specs){
 const cat=read(catPath),base=path.dirname(catPath);
 if(cat.metadataVersion!==3)errors.push(catPath+': metadataVersion');
 for(const entry of cat.packs||[]){
  packs++;
  if(entry.metadataVersion!==3)errors.push(catPath+': '+entry.id+' metadataVersion');
  if(!entry.access||!('entitlement' in entry.access))errors.push(catPath+': '+entry.id+' access');
  const packPath=path.posix.join(base,entry.src),pack=read(packPath);
  if(pack.metadata?.metadataVersion!==3)errors.push(packPath+': pack metadataVersion');
  if(pack.metadata?.packId!==entry.id)errors.push(packPath+': packId');
  if(pack.metadata?.library!==library)errors.push(packPath+': library');
  if(pack.metadata?.levelCount!==(pack.levels||[]).length)errors.push(packPath+': levelCount');
  for(const level of pack.levels||[]){
   levels++;
   if(levelIds.has(level.levelId))errors.push(packPath+' '+level.levelId+': duplicate global levelId');else levelIds.add(level.levelId);
   const e=validateMetadataV3(level,{packId:entry.id});if(e.length)errors.push(packPath+' '+level.levelId+': '+e.join(', '));
   if(level.content.library!==library)errors.push(packPath+' '+level.levelId+': wrong library');
   if(level.content.familyId!==familyIdFor(level))errors.push(packPath+' '+level.levelId+': stale familyId');
   const structure=structureMetadata(level);
   if(JSON.stringify(level.content.structure)!==JSON.stringify(structure))errors.push(packPath+' '+level.levelId+': stale structure');
   const q=qualityFor({...level,analysis:{...(level.analysis||{}),qualityScore:undefined}});
   if(q!==null&&Math.abs((level.analysis.qualityScore??-1)-q)>1e-9)errors.push(packPath+' '+level.levelId+': stale qualityScore');
   if(structure.largeRigidCount>0)largeRigid++;
   if(structure.ballCount===1)oneBall++;else if(structure.ballCount===2)twoBall++;
  }
 }
}
if(errors.length){console.error(errors.slice(0,100).join('\n'));throw Error('Metadata v3 validation failed: '+errors.length+' error(s)')}
console.log(JSON.stringify({metadataV3:'passed',packs,levels,oneBall,twoBall,largeRigid},null,2));
