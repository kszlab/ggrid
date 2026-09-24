import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const V=require('../js/theme-visuals.js');

assert.equal(V.hash('abc'),V.hash('abc'),'hash must be stable');
assert.notEqual(V.hash('abc'),V.hash('abd'),'different keys should normally differ');

const list=['a','b','c'];
assert.equal(V.choose(list,'same-key'),V.choose(list,'same-key'),'variant selection must be deterministic');
assert.ok(list.includes(V.choose(list,'same-key')),'chosen variant must come from source list');

const base={className:'base shared',markup:'BASE',variants:[
 {className:'red shared'},
 {className:'blue'}
]};
const resolved=V.resolveSpec(base,'object-42');
assert.ok(resolved.className.includes('base'),'base class must survive');
assert.ok(resolved.className.includes('shared'),'shared class must survive');
assert.ok(!('variants' in resolved),'resolved spec must not expose variants');
assert.equal(resolved.markup,'BASE','base markup must survive when variant has no markup');

const markupOverride=V.resolveSpec({className:'a',markup:'A',variants:[{className:'b',markup:'B'}]},'only');
assert.equal(markupOverride.markup,'B');
assert.match(markupOverride.className,/\ba\b/);
assert.match(markupOverride.className,/\bb\b/);

assert.equal(V.pieceInset({}),1.8);
assert.equal(V.pieceInset({render:{pieceInsetPx:0}}),0);
assert.equal(V.pieceInset({render:{pieceInsetPx:-4}}),0);
assert.equal(V.rigidInset({render:{pieceInsetPx:0.7}}),0.7);
assert.equal(V.rigidInset({render:{pieceInsetPx:0.7,rigidInsetPx:0.2}}),0.2);
assert.equal(V.moveMs({}),190);
assert.equal(V.moveMs({render:{moveMs:240}}),240);

const theme={id:'demo',board:{cellVariants:[{className:'plain'},{className:'moon'},{className:'star'}]}};
for(let y=0;y<5;y++)for(let x=0;x<5;x++){
 const a=V.cellVariant(theme,x,y,5,5),b=V.cellVariant(theme,x,y,5,5);
 assert.deepEqual(a,b,'cell variants must be deterministic');
 assert.ok(theme.board.cellVariants.includes(a));
}

const distribution=new Set(Array.from({length:40},(_,i)=>V.variantIndex([{},{},{}],'obj-'+i)));
assert.ok(distribution.size>1,'object ids should distribute across visual variants');

console.log('Theme Visuals V3 tests passed.');
