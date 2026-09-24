import fs from 'node:fs';
import path from 'node:path';
import RigidShapes from '../js/rigid-shapes.js';

const ROOT=process.cwd();
const SEARCH_ROOTS=['content/levels','content/scenarios'];
const OUTPUT='content/shapes/rigid-shapes.json';

function walk(dir,out=[]){
 if(!fs.existsSync(dir))return out;
 for(const ent of fs.readdirSync(dir,{withFileTypes:true})){
  const p=path.join(dir,ent.name);
  if(ent.isDirectory())walk(p,out);
  else if(ent.isFile()&&ent.name.endsWith('.json'))out.push(p);
 }
 return out;
}
function rel(p){return path.relative(ROOT,p).split(path.sep).join('/')}
function cellsOf(entity){
 if(entity?.type==='rigid-body')return entity.properties?.cells||[];
 if(entity?.type==='brick')return entity.cells||entity.properties?.cells||[];
 return[];
}
function scanLevel(level,source,shapes){
 const entities=Array.isArray(level?.entities)?level.entities:Array.isArray(level?.objects)?level.objects:[];
 for(const entity of entities){
  const cells=cellsOf(entity);
  if(cells.length<2)continue;
  const id=RigidShapes.identify(cells),norm=RigidShapes.normalize(cells),b=RigidShapes.bounds(cells);
  let rec=shapes.get(id);
  if(!rec){
   rec={id,cells:norm,bounds:{width:b.width,height:b.height},rectangular:RigidShapes.isRectangular(cells)};
   shapes.set(id,rec);
  }
  if(!rec.sources.includes(source))rec.sources.push(source);
 }
}
function visit(node,source,shapes){
 if(!node||typeof node!=='object')return;
 if(node.format==='ggrid-level'||Array.isArray(node.entities)||Array.isArray(node.objects)){
  scanLevel(node,source,shapes);
  if(node.format==='ggrid-level')return;
 }
 if(Array.isArray(node)){for(const item of node)visit(item,source,shapes);return}
 for(const value of Object.values(node))if(value&&typeof value==='object')visit(value,source,shapes);
}

const shapes=new Map(),files=[...new Set(SEARCH_ROOTS.flatMap(r=>walk(path.join(ROOT,r))))].sort();
for(const file of files){
 let data;try{data=JSON.parse(fs.readFileSync(file,'utf8'))}catch(e){console.warn('Skipping invalid JSON:',rel(file),e.message);continue}
 visit(data,rel(file),shapes);
}
const result={
 format:'ggrid-rigid-shape-catalog',
 formatVersion:1,
 note:'Generated from repository level/scenario JSON files. Do not edit by hand; run node tools/scan-rigid-shapes.mjs.',
 shapes:[...shapes.values()].sort((a,b)=>a.cells.length-b.cells.length||a.id.localeCompare(b.id))
};
const text=JSON.stringify(result,null,2)+'\n';
const outPath=path.join(ROOT,OUTPUT);
if(process.argv.includes('--check')){
 const old=fs.existsSync(outPath)?fs.readFileSync(outPath,'utf8'):'';
 if(old!==text){console.error('Rigid shape catalog is stale. Run: node tools/scan-rigid-shapes.mjs');process.exit(1)}
 console.log('Rigid shape catalog is current:',result.shapes.map(s=>s.id).join(', '));
}else{
 fs.mkdirSync(path.dirname(outPath),{recursive:true});fs.writeFileSync(outPath,text);
 console.log('Wrote',OUTPUT,'with',result.shapes.length,'shapes:',result.shapes.map(s=>s.id).join(', '));
}
