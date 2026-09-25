#!/usr/bin/env node
import assert from 'node:assert/strict';
import {fingerprintsFor,hamming64,createFingerprintIndex,classifyAgainstIndex} from './level-fingerprint-v1.mjs';

const base={width:5,height:5,exit:{dir:'right',x:4,y:2},objects:[
 {id:'b',type:'ball',x:0,y:2,cells:[{x:0,y:0}]},
 {id:'w',type:'wall',x:3,y:1,cells:[{x:0,y:0}]},
 {id:'r',type:'brick',x:1,y:1,cells:[{x:0,y:0},{x:0,y:1},{x:1,y:1}]},
 {id:'r2',type:'brick',x:2,y:4,cells:[{x:0,y:0},{x:1,y:0}]}
]};
const renamed=structuredClone(base);renamed.objects.reverse();renamed.objects.forEach((o,i)=>o.id='x'+i);
const mirror={width:5,height:5,exit:{dir:'left',x:0,y:2},objects:base.objects.map(o=>({id:o.id,type:o.type,x:4-o.x,y:o.y,cells:o.cells.map(c=>({x:-c.x,y:c.y}))}))};
for(const o of mirror.objects){const abs=o.cells.map(c=>({x:o.x+c.x,y:o.y+c.y}));const mx=Math.min(...abs.map(p=>p.x)),my=Math.min(...abs.map(p=>p.y));o.x=mx;o.y=my;o.cells=abs.map(p=>({x:p.x-mx,y:p.y-my}));}
const near=structuredClone(base);near.objects.find(o=>o.type==='wall').x=4;
const far={width:5,height:5,exit:{dir:'up',x:2,y:0},objects:[
 {type:'ball',x:4,y:4,cells:[{x:0,y:0}]},{type:'wall',x:0,y:0,cells:[{x:0,y:0}]},
 {type:'brick',x:0,y:3,cells:[{x:0,y:0},{x:1,y:0},{x:2,y:0},{x:3,y:0}]},
 {type:'brick',x:4,y:0,cells:[{x:0,y:0},{x:0,y:1},{x:0,y:2},{x:0,y:3}]}
]};
const a=fingerprintsFor(base),b=fingerprintsFor(renamed),m=fingerprintsFor(mirror),n=fingerprintsFor(near),f=fingerprintsFor(far);
assert.equal(a.canonicalHash,b.canonicalHash);
assert.equal(a.canonicalHash,m.canonicalHash);
assert.equal(a.simHash,m.simHash);
assert.notEqual(a.canonicalHash,n.canonicalHash);
assert(hamming64(a.simHash,n.simHash)<hamming64(a.simHash,f.simHash));
const asRecord=s=>({levelId:'BASE',board:{width:s.width,height:s.height,exit:{direction:s.exit.dir,x:s.exit.x,y:s.exit.y}},entities:s.objects.map(o=>({id:o.id,type:o.type==='brick'?'rigid-body':o.type,position:{x:o.x,y:o.y},properties:{cells:o.cells}}))});
const idx=createFingerprintIndex([asRecord(base)]);
assert.equal(classifyAgainstIndex(renamed,idx).classification,'DUPLICATE');
const nearCheck=classifyAgainstIndex(near,idx);
assert.equal(nearCheck.classification,'SIMILAR');
console.log(JSON.stringify({ok:true,canonical:a.canonicalHash,simHash:a.simHash,nearDistance:hamming64(a.simHash,n.simHash),farDistance:hamming64(a.simHash,f.simHash),nearClass:nearCheck.classification},null,2));
