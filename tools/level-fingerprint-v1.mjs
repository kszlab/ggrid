import {createHash} from 'node:crypto';

export const FINGERPRINT_VERSION=1;
export const SIMHASH_BITS=64;
export const LSH_BANDS=8;
export const LSH_BITS_PER_BAND=8;
export const DEFAULT_THRESHOLDS={duplicateDistance:0,rejectDistance:4,reviewDistance:10};

const sha256=s=>createHash('sha256').update(String(s)).digest('hex');
const normCells=cells=>{
  const c=(Array.isArray(cells)&&cells.length?cells:[{x:0,y:0}]).map(p=>({x:+p.x,y:+p.y}));
  const minX=Math.min(...c.map(p=>p.x)),minY=Math.min(...c.map(p=>p.y));
  return c.map(p=>({x:p.x-minX,y:p.y-minY})).sort((a,b)=>a.y-b.y||a.x-b.x);
};
const dirVec={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]};
const vecDir=new Map(Object.entries(dirVec).map(([k,v])=>[v.join(','),k]));
const typeCode=t=>t==='ball'?'B':(t==='wall'?'W':'R');

export function stateLike(input){
  if(input?.width&&input?.height&&input?.exit&&Array.isArray(input?.objects))return input;
  if(input?.board&&Array.isArray(input?.entities)){
    const exit=input.board.exit||input.exit;
    return {width:+input.board.width,height:+input.board.height,
      exit:{dir:exit.direction||exit.dir,x:+exit.x,y:+exit.y},moves:0,won:false,
      objects:input.entities.map((e,i)=>({id:e.id||('e'+i),type:e.type==='rigid-body'?'brick':e.type,
        x:+e.position.x,y:+e.position.y,exited:false,cells:normCells(e.properties?.cells)}))};
  }
  if(input?.board&&input?.exit&&Array.isArray(input?.objects)){
    return {width:+input.board.width,height:+input.board.height,
      exit:{dir:input.exit.direction||input.exit.dir,x:+input.exit.x,y:+input.exit.y},moves:0,won:false,
      objects:input.objects.map((e,i)=>({id:e.id||('e'+i),type:e.type==='rigid-body'?'brick':e.type,
        x:+e.x,y:+e.y,exited:false,cells:normCells(e.cells)}))};
  }
  throw Error('Unsupported GGrid level/state format');
}

function transformDefs(w,h){
  const defs=[
    {id:'I',outW:w,outH:h,pt:(x,y)=>[x,y]},
    {id:'MX',outW:w,outH:h,pt:(x,y)=>[w-1-x,y]},
    {id:'MY',outW:w,outH:h,pt:(x,y)=>[x,h-1-y]},
    {id:'R180',outW:w,outH:h,pt:(x,y)=>[w-1-x,h-1-y]},
  ];
  if(w===h){
    defs.push(
      {id:'R90',outW:w,outH:h,pt:(x,y)=>[h-1-y,x]},
      {id:'R270',outW:w,outH:h,pt:(x,y)=>[y,w-1-x]},
      {id:'D',outW:w,outH:h,pt:(x,y)=>[y,x]},
      {id:'AD',outW:w,outH:h,pt:(x,y)=>[w-1-y,h-1-x]},
    );
  }
  return defs;
}
function transformedDir(def,dir){
  const [vx,vy]=dirVec[dir];
  const [ox,oy]=def.pt(0,0),[px,py]=def.pt(vx,vy);
  const dx=Math.sign(px-ox),dy=Math.sign(py-oy);
  return vecDir.get(dx+','+dy);
}
function transformState(s,def){
  const objs=s.objects.map(o=>{
    const abs=o.cells.map(c=>def.pt(o.x+c.x,o.y+c.y));
    return {type:o.type,cells:abs};
  });
  const [ex,ey]=def.pt(s.exit.x,s.exit.y);
  return {width:def.outW,height:def.outH,exit:{x:ex,y:ey,dir:transformedDir(def,s.exit.dir)},objects:objs};
}
function canonicalStringForTransformed(t){
  const pieces=t.objects.map(o=>typeCode(o.type)+':'+o.cells.map(([x,y])=>x+','+y).sort().join(';')).sort();
  return `${t.width}x${t.height}|E:${t.exit.x},${t.exit.y},${t.exit.dir}|${pieces.join('|')}`;
}
export function canonicalRepresentation(input){
  const s=stateLike(input);let best=null,bestId=null,bestT=null;
  for(const def of transformDefs(s.width,s.height)){
    const t=transformState(s,def),rep=canonicalStringForTransformed(t);
    if(best===null||rep<best){best=rep;bestId=def.id;bestT=t;}
  }
  return {representation:best,transform:bestId,state:bestT};
}

function q(v,max,bins=4){
  if(max<=1)return 0;
  return Math.max(0,Math.min(bins-1,Math.floor((v/(max-1))*bins)));
}
function shapeSigAbs(cells){
  const pts=cells.map(([x,y])=>({x,y}));const minX=Math.min(...pts.map(p=>p.x)),minY=Math.min(...pts.map(p=>p.y));
  return pts.map(p=>(p.x-minX)+','+(p.y-minY)).sort().join(';');
}
function similarityFeaturesFromTransformed(t,analysis=null){
  const fs=[]; const add=(x,w=1)=>{for(let i=0;i<w;i++)fs.push(x+'#'+i)};
  const byType={B:0,W:0,R:0};
  for(const o of t.objects)byType[typeCode(o.type)]++;
  add(`SZ:${t.width}x${t.height}`,4); add(`BC:${byType.B}`,4); add(`WC:${byType.W}`,2); add(`RC:${byType.R}`,2);
  add(`E:${t.exit.dir}:${q(t.exit.x,t.width,4)}:${q(t.exit.y,t.height,4)}`,4);
  const objects=t.objects.map(o=>{
    const tc=typeCode(o.type);const xs=o.cells.map(p=>p[0]),ys=o.cells.map(p=>p[1]);
    const cx=xs.reduce((a,b)=>a+b,0)/xs.length,cy=ys.reduce((a,b)=>a+b,0)/ys.length;
    const sh=shapeSigAbs(o.cells);
    add(`SH:${tc}:${sh}`,3);
    add(`POS:${tc}:${q(cx,t.width,4)}:${q(cy,t.height,4)}`,2);
    for(const [x,y] of o.cells)add(`OCC:${tc}:${q(x,t.width,4)}:${q(y,t.height,4)}`,1);
    return {tc,cx,cy,n:o.cells.length,sh};
  });
  const hist={};for(const o of objects.filter(o=>o.tc==='R'))hist[o.n]=(hist[o.n]||0)+1;
  for(const [n,c] of Object.entries(hist))add(`RH:${n}:${c}`,2);
  for(let i=0;i<objects.length;i++)for(let j=i+1;j<objects.length;j++){
    const a=objects[i],b=objects[j],d=Math.abs(a.cx-b.cx)+Math.abs(a.cy-b.cy);
    const pair=[a.tc,b.tc].sort().join('');add(`PD:${pair}:${Math.min(7,Math.floor(d))}`,1);
  }
  const m=analysis?.metrics;
  if(m){
    if(Number.isFinite(m.optimalMoves))add(`SM:${Math.min(15,Math.floor(m.optimalMoves/2))}`,2);
    if(Number.isFinite(m.directionChanges))add(`SD:${Math.min(10,m.directionChanges)}`,1);
    if(Number.isFinite(m.detourMoves))add(`ST:${Math.min(10,m.detourMoves)}`,1);
  }
  return fs;
}
function hash64(token){return BigInt('0x'+sha256(token).slice(0,16));}
export function simHash64(features){
  const acc=new Int32Array(64);
  for(const f of features){const h=hash64(f);for(let i=0n;i<64n;i++)acc[Number(i)]+=((h>>i)&1n)?1:-1;}
  let out=0n;for(let i=0n;i<64n;i++)if(acc[Number(i)]>=0)out|=1n<<i;
  return out.toString(16).padStart(16,'0');
}
export function hamming64(a,b){let x=BigInt('0x'+a)^BigInt('0x'+b),n=0;while(x){x&=x-1n;n++;}return n;}
export function lshBuckets(simHash,{bands=LSH_BANDS,bitsPerBand=LSH_BITS_PER_BAND,prefix=''}={}){
  if(bands*bitsPerBand!==64)throw Error('LSH bands * bitsPerBand must equal 64');
  const x=BigInt('0x'+simHash),mask=(1n<<BigInt(bitsPerBand))-1n,out=[];
  for(let i=0;i<bands;i++){const v=(x>>BigInt(i*bitsPerBand))&mask;out.push(`${prefix}b${i}:${v.toString(16).padStart(Math.ceil(bitsPerBand/4),'0')}`);}
  return out;
}
export function fingerprintsFor(input,{analysis=null}={}){
  const s=stateLike(input);const can=canonicalRepresentation(s);
  const canonicalHash=sha256(can.representation);
  let bestSim=null;
  for(const def of transformDefs(s.width,s.height)){
    const t=transformState(s,def),sim=simHash64(similarityFeaturesFromTransformed(t,analysis));
    if(bestSim===null||sim<bestSim)bestSim=sim;
  }
  const balls=s.objects.filter(o=>o.type==='ball').length;
  const prefix=`${s.width}x${s.height}:B${balls}:`;
  return {version:FINGERPRINT_VERSION,method:'ggrid-level-fingerprint-v1',canonicalHash,simHash:bestSim,
    buckets:lshBuckets(bestSim,{prefix}),canonicalTransform:can.transform};
}

export function createFingerprintIndex(levels){
  const exact={},buckets={},items={};
  for(const level of levels){
    const fp=level?.content?.fingerprints?.version===FINGERPRINT_VERSION?level.content.fingerprints:fingerprintsFor(level,{analysis:level.analysis});
    const id=level.levelId||level.id||sha256(JSON.stringify(level)).slice(0,12);
    items[id]={canonicalHash:fp.canonicalHash,simHash:fp.simHash,buckets:fp.buckets};
    (exact[fp.canonicalHash]??=[]).push(id);
    for(const b of fp.buckets)(buckets[b]??=[]).push(id);
  }
  return {format:'ggrid-fingerprint-index',version:FINGERPRINT_VERSION,items,exact,buckets};
}
export function classifyAgainstIndex(input,index,{analysis=null,thresholds=DEFAULT_THRESHOLDS}={}){
  const fp=fingerprintsFor(input,{analysis});
  const exact=index.exact?.[fp.canonicalHash]||[];
  if(exact.length)return {classification:'DUPLICATE',accepted:false,distance:0,matches:exact,fingerprints:fp};
  const ids=new Set();for(const b of fp.buckets)for(const id of index.buckets?.[b]||[])ids.add(id);
  let nearest=null,distance=Infinity;
  for(const id of ids){const item=index.items?.[id];if(!item)continue;const d=hamming64(fp.simHash,item.simHash);if(d<distance){distance=d;nearest=id;}}
  if(nearest===null)return {classification:'UNIQUE',accepted:true,distance:null,nearest:null,candidates:0,fingerprints:fp};
  const classification=distance<=thresholds.rejectDistance?'NEAR_DUPLICATE':distance<=thresholds.reviewDistance?'SIMILAR':'UNIQUE';
  return {classification,accepted:classification==='UNIQUE',distance,nearest,candidates:ids.size,fingerprints:fp};
}
