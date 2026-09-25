#!/usr/bin/env node
// Migrates every catalog-referenced GGrid level pack to unified metadata schema v3.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {familyIdFor,enrichLevel,packMetadata,LEVEL_METADATA_VERSION} from './level-metadata-v3.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const catalogs=[
 {path:'content/levels/catalog.json',library:'core'},
 {path:'content/levels/multiball/catalog.json',library:'multiball'},
 {path:'content/levels/generated-test/catalog.json',library:'generated-test'}
];
const read=rel=>JSON.parse(fs.readFileSync(path.join(root,rel),'utf8'));
const write=(rel,obj)=>fs.writeFileSync(path.join(root,rel),JSON.stringify(obj,null,2)+'\n');
const packRefs=[];

for(const spec of catalogs){
 const cat=read(spec.path),base=path.dirname(spec.path);
 for(const p of cat.packs||[])packRefs.push({catalog:spec.path,library:spec.library,packId:p.id,rel:path.posix.join(base,p.src),entry:p});
}

const packs=packRefs.map(ref=>({...ref,data:read(ref.rel)}));
const familyCounts=new Map();
let total=0;
for(const p of packs)for(const level of p.data.levels||[]){
 const id=familyIdFor(level);familyCounts.set(id,(familyCounts.get(id)||0)+1);total++;
}

const report={metadataVersion:LEVEL_METADATA_VERSION,totalLevels:total,packs:[],families:familyCounts.size,libraries:{}};
for(const p of packs){
 const levels=(p.data.levels||[]).map(level=>{
  const familyId=familyIdFor(level);
  return enrichLevel(level,{packId:p.packId,library:p.library,familyCount:familyCounts.get(familyId)||1});
 });
 p.data.metadata={...(p.data.metadata||{}),...packMetadata(p.packId,p.library,levels.length)};
 p.data.levels=levels;
 write(p.rel,p.data);
 report.packs.push({packId:p.packId,library:p.library,file:p.rel,levels:levels.length});
 report.libraries[p.library]=(report.libraries[p.library]||0)+levels.length;
}

for(const spec of catalogs){
 const cat=read(spec.path);
 cat.metadataVersion=LEVEL_METADATA_VERSION;
 cat.packs=(cat.packs||[]).map(p=>{
  const ref=packRefs.find(x=>x.catalog===spec.path&&x.packId===p.id);
  const pack=ref?packs.find(x=>x.rel===ref.rel):null;
  return {...p,metadataVersion:LEVEL_METADATA_VERSION,contentType:'level-pack',status:'active',
   access:{...(p.access||{}),entitlement:p.access?.entitlement??null,visibility:p.access?.visibility||'public'},
   levelCount:pack?.data?.levels?.length??p.levelCount??0};
 });
 write(spec.path,cat);
}

write('tools/level-metadata-v3-report.json',report);
console.log(JSON.stringify(report,null,2));
