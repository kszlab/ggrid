import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const L=require('../js/theme-layout.js');

const theme={artwork:{landscapeMinAspect:1.1,layouts:{
 portrait:{designSize:[400,800],boxes:{board:[40,120,320,520],hud:[40,670,320,80]}},
 landscape:{designSize:[1000,600],boxes:{board:[230,70,540,460]}}
}}};

assert.equal(L.modeFor(theme,400,800),'portrait');
assert.equal(L.modeFor(theme,1200,700),'landscape');
const p=L.resolve(theme,400,800);
assert.deepEqual(p.design,{width:400,height:800});
assert.deepEqual(p.boxes.board,{x:40,y:120,width:320,height:520});
assert.deepEqual(L.pctBox(p.boxes.board,p.design),{x:10,y:15,width:80,height:65});
const l=L.resolve(theme,1200,700);
assert.equal(l.mode,'landscape');
assert.equal(l.boxes.board.width,540);

const portraitOnly={artwork:{layouts:{portrait:{designSize:{width:300,height:500},board:{x:10,y:20,w:280,h:420}}}}};
assert.equal(L.modeFor(portraitOnly,1000,500),'portrait');
assert.equal(L.resolve(portraitOnly,1000,500).boxes.board.height,420);

console.log('Artwork Theme Layout tests passed.');
