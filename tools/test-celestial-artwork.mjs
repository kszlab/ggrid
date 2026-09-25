import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const root=process.cwd(),dir=path.join(root,'content/themes/celestial-library');
const theme=JSON.parse(fs.readFileSync(path.join(dir,'theme.json')));
const index=JSON.parse(fs.readFileSync('content/themes/index.json'));
const A=require(path.join(root,'js/theme-assets.js'));
const V=require(path.join(root,'js/theme-visuals.js'));
const L=require(path.join(root,'js/theme-layout.js'));
assert.equal(theme.renderMode,'artwork');
assert.equal(index.themes.find(t=>t.id===theme.id).version,theme.version);
for(const src of A.collect(theme))assert.ok(fs.existsSync(path.join(dir,src)),src+' missing');
const pieces=theme.artwork.pieces;
for(const id of ['2H','2V','3H','3V','L3-TL','L3-TR','L3-BL','L3-BR']){
 const spec=pieces.rigidShapes[id];assert.ok(spec,id+' missing');
 for(const variant of spec.variants||[spec]){
  const svg=fs.readFileSync(path.join(dir,variant.asset),'utf8');
  const payload=svg.match(/data:image\/webp;base64,([^"\s]+)/)?.[1];
  assert.ok(payload,id+' must contain illustrated artwork');
  const bytes=Buffer.from(payload,'base64');
  assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',8,12),'WEBP');
  assert.ok(bytes.length>20000,id+' unexpectedly small raster');
 }
}
assert.match(V.resolveSpec(pieces.rigidShapes['3H'],'celestial-library:rigid:3H:K6').asset,/blue/);
assert.match(V.resolveSpec(pieces.rigidShapes['3H'],'celestial-library:rigid:3H:K9').asset,/red/);
assert.ok(theme.artwork.board.cellVariants.length>=3,'varied parchment');
for(const [w,h]of [[3,3],[5,5],[5,8]]){
 const fit=L.fitBoard(theme,w,h,412,880),zones=L.controlZones(theme,fit.board,412,880).zones;
 assert.ok(Math.abs(fit.board.width/w-fit.board.height/h)<.001,'square cells');
 for(const d of ['up','down','left','right']){
  assert.ok(zones[d].x>=0&&zones[d].y>=0,d+' outside scene');
  assert.ok(theme.artwork.controls[d].cue.asset.endsWith('control-'+d+'.svg'));
 }
}
const level=JSON.parse(fs.readFileSync('content/levels/packs/classified-v2-5x8.json')).levels.find(l=>l.levelId==='LV3-5X8-0073');
assert.deepEqual([level.board.width,level.board.height],[5,8]);
assert.deepEqual(level.board.exit,{direction:'up',x:4,y:0});
assert.equal(level.entities.find(e=>e.id==='K9').position.y,7,'do not delete the eighth row to imitate the mockup');
console.log('Celestial illustrated assets, color variants, control geometry and reference-level invariants passed.');
