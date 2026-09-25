#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {fingerprintsFor,createFingerprintIndex,classifyAgainstIndex,DEFAULT_THRESHOLDS} from './level-fingerprint-v1.mjs';

const args=process.argv.slice(2);
const cmd=args.shift();
const read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const levelsFrom=x=>Array.isArray(x)?x:(Array.isArray(x?.levels)?x.levels:[x]);
const out=(x,file)=>file?fs.writeFileSync(file,JSON.stringify(x,null,2)+'\n'):console.log(JSON.stringify(x,null,2));
const option=(name,def=null)=>{const i=args.indexOf(name);if(i<0)return def;const v=args[i+1];args.splice(i,2);return v};

if(!cmd||cmd==='--help'||cmd==='-h'){
 console.log(`GGrid level novelty tool v1

Commands:
  fingerprint LEVEL.json
  build-index LEVEL_OR_PACK.json [MORE.json ...] --out fingerprint-index.json
  check LEVEL.json --index fingerprint-index.json [--reject-distance 4] [--review-distance 10]

Classification:
  DUPLICATE      canonical hash already exists
  NEAR_DUPLICATE candidate found within reject Hamming distance
  SIMILAR        candidate found within review distance
  UNIQUE         no sufficiently close indexed candidate
`);process.exit(0);
}
if(cmd==='fingerprint'){
 const file=args[0];if(!file)throw Error('LEVEL.json required');
 const x=read(file),level=levelsFrom(x)[0];out(fingerprintsFor(level,{analysis:level.analysis}));
}else if(cmd==='build-index'){
 const dest=option('--out');if(!dest)throw Error('--out FILE required');
 if(!args.length)throw Error('At least one level or pack JSON is required');
 const levels=args.flatMap(f=>levelsFrom(read(f)));
 const index=createFingerprintIndex(levels);index.sourceFiles=args.map(f=>path.normalize(f));index.levelCount=levels.length;
 out(index,dest);console.log(JSON.stringify({output:dest,levels:levels.length,buckets:Object.keys(index.buckets).length},null,2));
}else if(cmd==='check'){
 const indexFile=option('--index');if(!indexFile)throw Error('--index FILE required');
 const rejectDistance=Number(option('--reject-distance',DEFAULT_THRESHOLDS.rejectDistance));
 const reviewDistance=Number(option('--review-distance',DEFAULT_THRESHOLDS.reviewDistance));
 const file=args[0];if(!file)throw Error('LEVEL.json required');
 const x=read(file),level=levelsFrom(x)[0],index=read(indexFile);
 out(classifyAgainstIndex(level,index,{analysis:level.analysis,thresholds:{...DEFAULT_THRESHOLDS,rejectDistance,reviewDistance}}));
}else throw Error('Unknown command: '+cmd);
