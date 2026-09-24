import assert from 'node:assert/strict';
import fs from 'node:fs';
import RigidShapes from '../js/rigid-shapes.js';

const cases=[
 ['2H',[[0,0],[1,0]]],['2V',[[0,0],[0,1]]],
 ['3H',[[0,0],[1,0],[2,0]]],['3V',[[0,0],[0,1],[0,2]]],
 ['L3-TL',[[0,0],[1,0],[0,1]]],['L3-TR',[[0,0],[1,0],[1,1]]],
 ['L3-BL',[[0,0],[0,1],[1,1]]],['L3-BR',[[1,0],[0,1],[1,1]]]
];
for(const [id,pts] of cases){
 const cells=pts.map(([x,y])=>({x,y}));
 assert.equal(RigidShapes.identify(cells),id,id);
}
assert.equal(RigidShapes.identify([{x:0,y:0},{x:1,y:0},{x:2,y:0},{x:1,y:1}]),'P4-3x2-111010');
assert.equal(RigidShapes.isRectangular([{x:0,y:0},{x:1,y:0},{x:0,y:1},{x:1,y:1}]),true);
assert.equal(RigidShapes.isRectangular([{x:0,y:0},{x:1,y:0},{x:0,y:1}]),false);
for(const id of ['L3-TL','L3-TR','L3-BL','L3-BR']){
 const clip=RigidShapes.clipPath(id);
 assert.ok(clip.startsWith('polygon('),'missing clip path '+id);
}
assert.equal(RigidShapes.clipPath('2H'),'');

const catalog=JSON.parse(fs.readFileSync('content/shapes/rigid-shapes.json','utf8'));
for(const shape of catalog.shapes){
 assert.equal(RigidShapes.identify(shape.cells),shape.id,'catalog '+shape.id);
 assert.equal(RigidShapes.isRectangular(shape.cells),shape.rectangular,'rectangular '+shape.id);
}
console.log('Rigid shape tests passed:',catalog.shapes.map(s=>s.id).join(', '));
