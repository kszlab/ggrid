import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const A=require('../js/theme-assets.js');

assert.equal(A.renderMode({}), 'legacy');
assert.equal(A.renderMode({artwork:{}}), 'artwork');
assert.equal(A.renderMode({renderMode:'artwork'}), 'artwork');

assert.equal(A.source('a.webp'),'a.webp');
assert.equal(A.source({src:'a.webp'}),'a.webp');
assert.equal(A.source({portrait:'p.webp',landscape:'l.webp'},{layout:'portrait'}),'p.webp');
assert.equal(A.source({directions:{up:'u.webp',down:'d.webp'}},{direction:'down'}),'d.webp');
assert.equal(A.source({up:{portrait:'up-p.webp',landscape:'up-l.webp'}},{direction:'up',layout:'landscape'}),'up-l.webp');

const theme={
 assets:{preload:['legacy.svg']},
 artwork:{
  layers:{background:{portrait:'bg-p.webp',landscape:'bg-l.webp'}},
  pieces:{ball:{file:'ball.png'},exit:{directions:{left:'left.webp',right:'right.webp'}}},
  textPolicy:{functionalText:'localized'}
 }
};
const refs=A.collect(theme);
for(const expected of ['legacy.svg','bg-p.webp','bg-l.webp','ball.png','left.webp','right.webp'])assert.ok(refs.includes(expected),expected+' must be discovered');
assert.ok(!refs.includes('localized'),'non-asset strings must not be treated as files');

console.log('Artwork Theme Assets tests passed.');
