import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const F=require('../js/theme-frame.js');

assert.deepEqual(F.quad(5),{top:5,right:5,bottom:5,left:5});
assert.deepEqual(F.quad([2,4]),{top:2,right:4,bottom:2,left:4});
assert.deepEqual(F.quad([1,2,3,4]),{top:1,right:2,bottom:3,left:4});

const b=F.frameBox({x:100,y:80,width:300,height:400},[10,20,30,40]);
assert.deepEqual(b,{x:60,y:70,width:360,height:440});

console.log('Artwork Theme Frame tests passed.');
