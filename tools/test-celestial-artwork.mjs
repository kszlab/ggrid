import assert from 'node:assert/strict';
import fs from 'node:fs';

const theme=JSON.parse(fs.readFileSync('content/themes/celestial-library/theme.json','utf8'));
const index=JSON.parse(fs.readFileSync('content/themes/index.json','utf8'));
const ref=JSON.parse(fs.readFileSync('content/themes/celestial-library/approved-reference.json','utf8'));
const qa=JSON.parse(fs.readFileSync('content/themes/celestial-library/high-fidelity-qa.json','utf8'));
const entry=index.themes.find(t=>t.id==='celestial-library');

assert.equal(theme.formatVersion,2);
assert.equal(theme.renderMode,'artwork');
assert.equal(theme.version,17);
assert.equal(theme.artwork?.version,2);
assert.equal(theme.artwork?.layoutMode,'portrait');
assert.equal(theme.textPolicy?.themeIdentity,'theme-selector-only');
assert.equal(ref.textPolicy?.themeTitleInGameplay,false);
assert.equal(entry?.version,17);
assert.ok(entry?.preview?.description);
assert.ok(entry?.preview?.image);

const assetPath=asset=>'content/themes/celestial-library/'+asset;
const checkAsset=(asset,label)=>{
 assert.equal(typeof asset,'string',label+' asset must be a string');
 assert.ok(asset.length>0,label+' asset must not be empty');
 assert.ok(fs.existsSync(assetPath(asset)),label+' asset missing: '+asset);
};

checkAsset(theme.artwork.layers.background.portrait,'portrait background');
checkAsset(theme.artwork.layers.environment.portrait,'portrait environment');
checkAsset(theme.artwork.board.frame.asset,'board frame');
for(const [i,spec] of theme.artwork.board.cellVariants.entries())checkAsset(spec.asset,'cell '+i);
checkAsset(theme.artwork.pieces.ball.asset,'ball');
checkAsset(theme.artwork.pieces.wall.asset,'wall');
theme.artwork.pieces.brickSingle.variants.forEach((spec,i)=>checkAsset(spec.asset,'single '+i));

const shapes=['2H','2V','3H','3V','L3-TL','L3-TR','L3-BL','L3-BR'];
for(const id of shapes)checkAsset(theme.artwork.pieces.rigidShapes[id]?.asset,id);

for(const dir of ['up','right','down','left']){
 checkAsset(theme.artwork.pieces.exit.directions[dir],'exit '+dir);
 const control=theme.artwork.controls[dir];
 assert.equal(control?.target,'zone','control target '+dir);
 checkAsset(control?.asset,'control zone '+dir);
 checkAsset(control?.cue?.asset,'control cue '+dir);
}

assert.equal(theme.artwork.board.fitMode.portrait,'expand-height');
assert.ok(theme.artwork.layouts.portrait.boxes.boardSafe[2]>=440);
assert.equal(theme.artwork.layouts.portrait.controls.band,42);
assert.equal(ref.portrait.hud.hintCounter,false);
assert.equal(ref.portrait.hud.freezeCounter,true);
assert.equal(ref.portrait.controls.fullBandHitTarget,true);

const css=fs.readFileSync('content/themes/celestial-library/artwork.css','utf8');
assert.match(css,/-webkit-tap-highlight-color:transparent!important/);
assert.match(css,/\.scene-artwork \.exit\s*\{[^}]*z-index:2;/s);
assert.match(css,/\.scene-artwork \.ball\s*\{z-index:9!important\}/s);

assert.equal(qa.version,'0.15.15');
assert.equal(qa.verdict,'pass');
assert.ok(qa.metrics.pieceMaterialFidelity>=0.99);
assert.ok(qa.metrics.overallMoodSimilarity>=0.68);
assert.ok(qa.metrics.edgeDensityRatio>=0.78);

console.log('Celestial Library artwork contract passed.');
