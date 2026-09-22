/* GGrid v0.12.24 – rectangular background generator + Freeze Analyzer */
importScripts('game-core.js','solver.js','generator.js');
self.onmessage=e=>{
 const m=e.data||{};
 try{
  if(m.type==='generate'){
   const g=generateLevel(m.w||m.n,m.difficulty,m.seed||seedText(),m.prefix||'W',m.h||m.n||m.w);
   self.postMessage({type:'level',requestId:m.requestId,g});
  }else if(m.type==='analyzeFreeze'){
   const analysis=analyzeOneFreeze(m.state,m.maxDepth||30);
   self.postMessage({type:'freezeAnalysis',requestId:m.requestId,stateKey:m.stateKey,analysis});
  }else return;
 }catch(err){
  self.postMessage({type:'error',requestId:m.requestId,message:err?.message||String(err)});
 }
};
