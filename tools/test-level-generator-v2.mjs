import assert from 'node:assert/strict';
import {randomLayout,rng,fingerprint,familyFingerprint,SHAPES,qualityScore} from './level-generator-v2/layout.mjs';
import {explore} from './level-generator-v2/statespace.mjs';
import {compile} from './level-generator-v2/engine.mjs';

function findLayout(w,h,balls,largeShapes,seed){const rand=rng(seed);for(let i=0;i<300;i++){const s=randomLayout(w,h,rand,{balls,largeShapes});if(s)return s}return null}
const large=findLayout(5,8,2,'on',1234);
assert.ok(large,'5x8 layout after retries');
assert.equal(large.objects.filter(o=>o.type==='ball').length,2);
assert.ok(large.objects.some(o=>o.type==='brick'&&o.cells.length>=4),'large board must contain a 4-6 cell rigid body');

const small=findLayout(3,3,2,'off',77);
assert.ok(small,'3x3 two-ball layout after retries');
assert.equal(small.objects.filter(o=>o.type==='ball').length,2);
assert.ok(compile(small),'compact engine accepts two single-cell balls');
const space=explore(small,50000);
assert.ok(space&&space.states.length>0,'two-ball state space explored');

const base={width:4,height:4,exit:{x:0,y:1,dir:'left'},moves:0,won:false,objects:[
 {id:'b',type:'ball',x:1,y:1,cells:[{x:0,y:0}]},
 {id:'k',type:'brick',x:2,y:1,cells:[{x:0,y:0}]}
]};
const swapped=structuredClone(base);swapped.objects[0].type='brick';swapped.objects[1].type='ball';
assert.notEqual(fingerprint(base),fingerprint(swapped),'ball and brick must never collide in fingerprint');

const moved=structuredClone(base);moved.objects[0].x=3;moved.objects[1].x=1;
assert.equal(familyFingerprint(base),familyFingerprint(moved),'family id ignores movable starting positions');
assert.ok(SHAPES.some(s=>s.cells.length>=5),'large shape catalog available');
assert.ok(qualityScore({metrics:{directionChanges:4,detourMoves:3,setupMoves:2,averageAlternatives:.5,challengeSignal:.6}})>0);

console.log(JSON.stringify({fastGeneratorV2:'passed',twoBallStates:space.states.length,largeShapes:SHAPES.filter(s=>s.cells.length>=4).length}));
