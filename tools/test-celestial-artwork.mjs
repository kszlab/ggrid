import assert from 'node:assert/strict';
import fs from 'node:fs';

const theme=JSON.parse(fs.readFileSync('content/themes/celestial-library/theme.json','utf8'));
const index=JSON.parse(fs.readFileSync('content/themes/index.json','utf8'));
const ref=JSON.parse(fs.readFileSync('content/themes/celestial-library/approved-reference.json','utf8'));
const entry=index.themes.find(t=>t.id==='celestial-library');

assert.equal(theme.formatVersion,2);
assert.equal(theme.renderMode,'artwork');
assert.equal(theme.textPolicy?.themeIdentity,'theme-selector-only');
assert.equal(ref.textPolicy?.themeTitleInGameplay,false);
assert.ok(entry?.preview?.description,'theme selector must contain a short description');
assert.ok(entry?.preview?.image,'theme selector must contain artwork');

const shapes=['2H','2V','3H','3V','L3-TL','L3-TR','L3-BL','L3-BR'];
for(const id of shapes)assert.ok(theme.artwork?.pieces?.rigidShapes?.[id]?.asset,'missing artwork rigid shape '+id);

for(const dir of ['up','right','down','left'])assert.ok(theme.artwork?.pieces?.exit?.directions?.[dir],'missing directional exit '+dir);

assert.equal(theme.artwork?.board?.fitMode?.portrait,'expand-height','portrait artwork must expand vertically for tall boards');
assert.equal(theme.artwork?.board?.fitMode?.landscape,'contain','landscape artwork keeps contain behavior');
assert.ok(theme.artwork?.board?.frame?.asset,'missing board frame artwork');
assert.ok((theme.artwork?.board?.cellVariants||[]).length>=4,'need at least four cell artwork variants');
assert.equal(ref.portrait?.hud?.hintCounter,false);
assert.equal(ref.portrait?.hud?.freezeCounter,true);
assert.equal(ref.portrait?.controls?.fullBandHitTarget,true);
assert.equal(ref.exit?.textRequiredForRecognition,false);

console.log('Celestial Library artwork contract passed.');
