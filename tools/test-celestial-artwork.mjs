import assert from 'node:assert/strict';
import fs from 'node:fs';

const theme=JSON.parse(fs.readFileSync('content/themes/celestial-library/theme.json','utf8'));
const index=JSON.parse(fs.readFileSync('content/themes/index.json','utf8'));
const ref=JSON.parse(fs.readFileSync('content/themes/celestial-library/approved-reference.json','utf8'));
const entry=index.themes.find(t=>t.id==='celestial-library');

assert.equal(theme.formatVersion,2);
assert.equal(theme.renderMode,'artwork');
assert.equal(theme.artwork?.layoutMode,'portrait','celestial library must keep portrait composition on desktop and rotated mobile');
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
assert.equal(ref.portrait?.boardPriority,'dominant');
assert.ok(theme.artwork.layouts.portrait.boxes.boardSafe[2]>=440,'portrait board must remain visually dominant');
assert.equal(theme.artwork.layouts.portrait.controls.band,42,'full artwork control zones require the approved 42-unit gutter');
assert.equal(theme.artwork.layouts.portrait.controls.cueInset,0,'zone artwork does not need an extra cue offset');

const css=fs.readFileSync('content/themes/celestial-library/artwork.css','utf8');
const renderer=fs.readFileSync('js/scene-renderer.js','utf8');
assert.ok(renderer.includes("(spec.target||spec.renderTarget)==='zone'"),'scene renderer must support full-zone control artwork');
assert.ok(!css.includes('.edge-control .emboss-arrow.sr-asset-visual'),'celestial controls must not fall back to floating arrow artwork');
assert.match(css,/\.scene-artwork \.edge-control\s*\{[^}]*z-index:10!important;/s,'artwork controls must render above board frame');
assert.match(css,/\.edge-control\.art-control-zone\s*\{[^}]*background-size:100% 100%!important;/s,'full artwork control zones must fill their hit geometry');
assert.match(css,/\.edge-control\.art-control-zone\.pressed,\s*\nbody\[data-theme="celestial-library"\] \.scene-artwork \.edge-control\.art-control-zone:active\s*\{[^}]*background-image:var\(--sr-asset-image\)!important;/s,'pressed state must preserve the zone artwork');
assert.match(css,/\.edge-control\.art-control-zone\.pressed \.emboss-arrow\.sr-asset-visual,/s,'pressed state must affect the arrow cue, not the whole zone');
assert.match(css,/-webkit-tap-highlight-color:transparent!important/,'mobile native tap highlight must be disabled on celestial controls');
assert.match(css,/-webkit-appearance:none/,'celestial controls must suppress native mobile button appearance');
assert.match(css,/\.scene-artwork \.exit\s*\{[^}]*z-index:2;/s,'exit portal must render behind moving pieces');
assert.match(css,/\.scene-artwork \.ball\s*\{z-index:9!important\}/s,'ball must remain above the exit portal');
assert.match(css,/\.exit-right,\s*\nbody\[data-theme="celestial-library"\] \.scene-artwork \.exit-left\{width:118%;height:76%\}/s,'horizontal exit portal must use compact boundary footprint');
assert.match(css,/\.exit-up,\s*\nbody\[data-theme="celestial-library"\] \.scene-artwork \.exit-down\{width:76%;height:118%\}/s,'vertical exit portal must use compact boundary footprint');

const directions=['up','right','down','left'];
for(const dir of directions){
 const spec=theme.artwork.controls[dir];
 assert.equal(spec?.target,'zone','control must render as full zone '+dir);
 assert.ok(spec?.asset?.includes('control-zone-'),'control must use zone artwork '+dir);
 assert.ok(spec?.cue?.asset?.includes(`control-${dir}.svg`),'control must use a separate pressed cue '+dir);
 const svg=fs.readFileSync('content/themes/celestial-library/'+spec.asset,'utf8');
 const cue=fs.readFileSync('content/themes/celestial-library/'+spec.cue.asset,'utf8');
 assert.ok(svg.includes(`data-direction="${dir}"`),'direction metadata mismatch for '+dir);
 assert.ok(svg.includes('data-role="control-zone"'),'missing control-zone role '+dir);
 assert.ok(cue.includes(`data-direction="${dir}"`),'cue direction metadata mismatch for '+dir);
 assert.ok(!svg.includes('fill="url(#gold2)"'),'zone artwork must not contain the pressed arrow glyph '+dir);
}
assert.ok(theme.artwork.layers?.environment?.portrait?.includes('scene-lighting.svg'),'missing cinematic lighting layer');
assert.equal(theme.artwork.pieces?.brickSingle?.variants?.length,3,'single-cell codices need three visual variants');
assert.ok(theme.artwork.ui?.header?.asset?.includes('header-frame.svg'),'missing celestial header artwork');
assert.ok(theme.artwork.ui?.hud?.asset?.includes('hud-frame.svg'),'missing celestial HUD artwork');
assert.ok(theme.artwork.board?.frame?.width?.[0]>=22,'ornate frame must keep substantial visual weight');
for(const id of shapes)assert.ok(theme.artwork.pieces.rigidShapes[id].asset.includes('codex-'),'rigid shapes must use refined codex artwork '+id);

const missingByShape={'L3-TL':'BR','L3-TR':'BL','L3-BL':'TR','L3-BR':'TL'};
for(const [shape,missing] of Object.entries(missingByShape)){
 const file=theme.artwork.pieces.rigidShapes[shape].asset;
 const svg=fs.readFileSync('content/themes/celestial-library/'+file,'utf8');
 assert.ok(svg.includes(`data-shape="${shape}"`),'L artwork shape metadata mismatch '+shape);
 assert.ok(svg.includes(`data-missing="${missing}"`),'L artwork missing-corner mismatch '+shape);
 assert.ok(!svg.includes('<mask'),'L artwork must use a real silhouette, not a rectangular mask '+shape);
 assert.ok(svg.includes('<clipPath'),'L artwork decorations must be clipped to the silhouette '+shape);
}

console.log('Celestial Library artwork contract passed.');
