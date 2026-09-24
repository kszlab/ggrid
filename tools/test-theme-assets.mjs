import fs from 'node:fs';
import path from 'node:path';

const ROOT=process.cwd();
const exists=p=>fs.existsSync(path.join(ROOT,p));
const index=JSON.parse(fs.readFileSync(path.join(ROOT,'content/themes/index.json'),'utf8'));
const errors=[];

for(const entry of index.themes||[]){
 const base=path.posix.join('content/themes',path.posix.dirname(entry.src));
 const themePath=path.posix.join('content/themes',entry.src);
 if(!exists(themePath)){errors.push(entry.id+': missing '+themePath);continue}
 let theme;
 try{theme=JSON.parse(fs.readFileSync(path.join(ROOT,themePath),'utf8'))}
 catch(e){errors.push(entry.id+': invalid JSON '+themePath+' ('+e.message+')');continue}
 for(const [kind,rel] of [['index css',entry.css],['preview css',entry.previewCss],['theme css',theme.assets?.css||theme.css]]){
  if(!rel)continue;
  const p=kind==='theme css'?path.posix.join(base,rel):path.posix.join('content/themes',rel);
  const clean=p.split('?')[0];
  if(!exists(clean))errors.push(entry.id+': missing '+kind+' '+clean);
 }
 const preload=theme.assets?.preload;
 if(preload!=null){
  if(!Array.isArray(preload))errors.push(entry.id+': assets.preload must be an array');
  else for(const rel of preload){
   if(typeof rel!=='string'||!rel.trim()){errors.push(entry.id+': invalid assets.preload entry');continue}
   if(/^(data:|https?:|#)/.test(rel))continue;
   const clean=path.posix.normalize(path.posix.join(base,rel.split('?')[0]));
   if(!exists(clean))errors.push(entry.id+': missing preload asset '+clean);
  }
 }
 const cssRel=theme.assets?.css||theme.css;
 if(cssRel){
  const cssPath=path.posix.join(base,String(cssRel).split('?')[0]);
  if(exists(cssPath)){
   const css=fs.readFileSync(path.join(ROOT,cssPath),'utf8');
   for(const m of css.matchAll(/url\((['"]?)([^)'"]+)\1\)/g)){
    const ref=m[2];
    if(/^(data:|https?:|#)/.test(ref))continue;
    const asset=path.posix.normalize(path.posix.join(path.posix.dirname(cssPath),ref.split('?')[0]));
    if(!exists(asset))errors.push(entry.id+': '+cssPath+' references missing '+asset);
   }
   const opens=(css.match(/{/g)||[]).length,closes=(css.match(/}/g)||[]).length;
   if(opens!==closes)errors.push(entry.id+': unbalanced CSS braces in '+cssPath+' ('+opens+'/'+closes+')');
  }
 }
}
if(errors.length){console.error(errors.join('\n'));process.exit(1)}
console.log('Theme asset integrity passed for',index.themes.length,'themes.');
