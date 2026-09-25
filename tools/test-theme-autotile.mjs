import assert from 'node:assert/strict';
import fs from 'node:fs';
const src=fs.readFileSync(new URL('../js/theme-autotile.js',import.meta.url),'utf8');
const api=new Function('module','globalThis',src+';return module.exports')({exports:{}},{});
const norm=a=>Object.fromEntries(Object.entries(a).sort());
const shapes={
 L:[{x:0,y:0},{x:0,y:1},{x:1,y:1}],
 T:[{x:0,y:0},{x:1,y:0},{x:2,y:0},{x:1,y:1}],
 U:[{x:0,y:0},{x:2,y:0},{x:0,y:1},{x:1,y:1},{x:2,y:1}],
 box:[{x:0,y:0},{x:1,y:0},{x:0,y:1},{x:1,y:1}],
 six:[{x:0,y:0},{x:1,y:0},{x:2,y:0},{x:3,y:0},{x:0,y:1},{x:1,y:1}]
};
for(const [name,cells] of Object.entries(shapes)){
 for(let i=0;i<cells.length;i++){
  const q=api.quarterTypes(cells,i);assert.deepEqual(Object.keys(q).sort(),['bl','br','tl','tr'],name);
  for(const [quarter,type] of Object.entries(q)){
   assert.ok(['outer','edgeH','edgeV','inner','fill'].includes(type));
   const s=api.quarterSource(type,quarter);assert.ok(['ring','block'].includes(s.image));assert.ok(s.qx>=0&&s.qx<=5&&s.qy>=0&&s.qy<=5);
  }
 }
}
assert.equal(api.quarterTypes(shapes.box,0).br,'fill');
assert.equal(api.quarterTypes(shapes.L,0).tr,'outer');
console.log(JSON.stringify({themeAutotile:'passed',shapes:Object.keys(shapes),cells:Object.values(shapes).reduce((n,a)=>n+a.length,0)}));
