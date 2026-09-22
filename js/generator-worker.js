/* GGrid v0.9 – background level generator */
importScripts('game-core.js','solver.js','generator.js');
self.onmessage=e=>{
 const m=e.data||{};
 if(m.type!=='generate')return;
 try{
  const g=generateLevel(m.n,m.difficulty,m.seed||seedText(),m.prefix||'W');
  self.postMessage({type:'level',requestId:m.requestId,g});
 }catch(err){
  self.postMessage({type:'error',requestId:m.requestId,message:err?.message||String(err)});
 }
};
