import fs from 'node:fs';
import path from 'node:path';

const ROOT=process.cwd();
const CATALOG='content/shapes/rigid-shapes.json';
const THEME_INDEX='content/themes/index.json';
const OUTPUT='tools/theme-shape-audit.json';

const read=p=>JSON.parse(fs.readFileSync(path.join(ROOT,p),'utf8'));
const catalog=read(CATALOG),index=read(THEME_INDEX);
const report={
 format:'ggrid-theme-shape-audit',
 formatVersion:1,
 shapeCatalog:CATALOG,
 shapes:catalog.shapes.map(s=>s.id),
 themes:[]
};
for(const entry of index.themes||[]){
 const themePath=path.posix.join('content/themes',entry.src),theme=read(themePath);
 const variants=theme.pieces?.rigidBodyVariants||{},hasGeneric=!!theme.pieces?.rigidBody;
 const coverage={};
 let custom=0,genericComposite=0,cellFallback=0;
 for(const shape of catalog.shapes){
  if(variants[shape.id]){coverage[shape.id]='custom';custom++;continue}
  if(hasGeneric&&shape.rectangular){coverage[shape.id]='generic-composite';genericComposite++;continue}
  coverage[shape.id]='cell-fallback';cellFallback++;
 }
 report.themes.push({
  id:theme.id||entry.id,
  theme:themePath,
  showcase:theme.scene?.tier==='showcase'||!!entry.showcase,
  coverage,
  summary:{custom,genericComposite,cellFallback,total:catalog.shapes.length}
 });
}
const text=JSON.stringify(report,null,2)+'\n',outPath=path.join(ROOT,OUTPUT);
if(process.argv.includes('--check')){
 const old=fs.existsSync(outPath)?fs.readFileSync(outPath,'utf8'):'';
 if(old!==text){console.error('Theme shape audit is stale. Run: node tools/audit-theme-shapes.mjs');process.exit(1)}
 console.log('Theme shape audit is current.');
}else{
 fs.writeFileSync(outPath,text);console.log('Wrote',OUTPUT);
 for(const t of report.themes)console.log(t.id,JSON.stringify(t.summary));
}
