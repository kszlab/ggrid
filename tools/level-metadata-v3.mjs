// Unified GGrid Level Metadata Schema v3 helpers.
import {createHash} from 'node:crypto';
import {stateFromRecord} from './level-generator-v2/engine.mjs';
import {familyFingerprint,qualityScore} from './level-generator-v2/layout.mjs';

export const LEVEL_METADATA_VERSION=3;
export const NOVELTY_METHOD='family-frequency-v1';
export const QUALITY_METHOD='solver-metrics-v1';

const round3=n=>+Number(n||0).toFixed(3);
const cellsOf=e=>Array.isArray(e?.properties?.cells)&&e.properties.cells.length?e.properties.cells:[{x:0,y:0}];

export function familyIdFor(level){
 const fp=familyFingerprint(stateFromRecord(level));
 return 'fam-'+createHash('sha256').update(fp).digest('hex').slice(0,16);
}

export function structureMetadata(level){
 const entities=level.entities||[];
 const balls=entities.filter(e=>e.type==='ball');
 const walls=entities.filter(e=>e.type==='wall');
 const rigid=entities.filter(e=>e.type==='rigid-body');
 const sizes=rigid.map(e=>cellsOf(e).length);
 const histogram={};
 for(const n of sizes)histogram[n]=1+(histogram[n]||0);
 return {
  ballCount:balls.length,
  wallCount:walls.length,
  rigidBodyCount:rigid.length,
  rigidCellCount:sizes.reduce((a,b)=>a+b,0),
  multiCellRigidCount:sizes.filter(n=>n>1).length,
  largeRigidCount:sizes.filter(n=>n>=4).length,
  maxRigidCells:sizes.length?Math.max(...sizes):0,
  rigidSizeHistogram:histogram
 };
}

export function qualityFor(level){
 if(Number.isFinite(level.analysis?.qualityScore))return round3(level.analysis.qualityScore);
 if(!level.analysis?.metrics)return null;
 return qualityScore({metrics:level.analysis.metrics});
}

export function packMetadata(packId,library,levelCount){
 return {
  metadataVersion:LEVEL_METADATA_VERSION,
  packId,
  library,
  levelCount,
  contentType:'level-pack',
  status:'active',
  access:{entitlement:null,visibility:'public'}
 };
}

export function enrichLevel(level,{packId,library,familyCount=1}){
 const structure=structureMetadata(level);
 const familyId=familyIdFor(level);
 const generated=!!level.generator||Number(level.content?.generatorVersion)>=2;
 const provenance={
  origin:generated?'generated':'legacy-library',
  metadataMigratedBy:'level-metadata-v3'
 };
 if(level.generator?.tool)provenance.generatorTool=level.generator.tool;
 const quality=qualityFor(level);
 const novelty=round3(1/Math.max(1,familyCount));
 return {
  ...level,
  content:{
   ...(level.content||{}),
   metadataVersion:LEVEL_METADATA_VERSION,
   packId,
   library,
   familyId,
   ballCount:structure.ballCount,
   generatorVersion:level.content?.generatorVersion??level.generator?.version??null,
   structure,
   provenance
  },
  analysis:{
   ...(level.analysis||{}),
   ...(quality===null?{}:{qualityScore:quality}),
   noveltyScore:novelty,
   qualityMethod:QUALITY_METHOD,
   noveltyMethod:NOVELTY_METHOD
  }
 };
}

export function validateMetadataV3(level,{packId=null}={}){
 const errors=[],c=level.content,a=level.analysis;
 if(typeof level.levelId!=='string'||!level.levelId.trim())errors.push('levelId');
 if(c?.metadataVersion!==3)errors.push('content.metadataVersion');
 if(!c?.packId)errors.push('content.packId');
 if(packId&&c?.packId!==packId)errors.push('content.packId mismatch');
 if(!c?.library)errors.push('content.library');
 if(!c?.familyId?.startsWith('fam-'))errors.push('content.familyId');
 if(!Number.isInteger(c?.ballCount)||c.ballCount<1)errors.push('content.ballCount');
 if(!c?.structure)errors.push('content.structure');
 if(!Number.isFinite(a?.noveltyScore)||a.noveltyScore<=0||a.noveltyScore>1)errors.push('analysis.noveltyScore');
 if(a?.qualityScore!==undefined&&(!Number.isFinite(a.qualityScore)||a.qualityScore<0||a.qualityScore>1))errors.push('analysis.qualityScore');
 return errors;
}
