import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import crypto from 'node:crypto';

const HERE=path.dirname(fileURLToPath(import.meta.url));
const ROOT=path.resolve(HERE,'..');
const DESIGN=path.join(ROOT,'design','themes');
const PUBLIC=HERE;
const PORT=Number(process.env.THEME_STUDIO_PORT||4177);
const SLOT_SPEC=path.join(ROOT,'tools','theme-kit','slots.json');
const BACKGROUND_FILES=['bg-portrait.png','bg-landscape.png'];
const SESSION_TOKEN=crypto.randomBytes(24).toString('hex');
const MAX_UPLOAD=50*1024*1024;
const PROTECTED_UPLOADS=new Set(['project.json','approval.json','manifest.json','theme-kit.json']);
const allowedHost=h=>/^(127\.0\.0\.1|localhost)(:\d+)?$/i.test(String(h||''));
const inside=(base,target)=>{const b=path.resolve(base),t=path.resolve(target);return t===b||t.startsWith(b+path.sep)};
function mutationAllowed(req){
 if(!allowedHost(req.headers.host))return false;
 const origin=String(req.headers.origin||'');
 if(origin&&!['http://127.0.0.1:'+PORT,'http://localhost:'+PORT].includes(origin))return false;
 return req.headers['x-theme-studio-token']===SESSION_TOKEN;
}
function pngInfo(buf){
 if(buf.length<24||!buf.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return null;
 return{width:buf.readUInt32BE(16),height:buf.readUInt32BE(20)};
}
function validatePng(buf,w=null,h=null){
 const i=pngInfo(buf);if(!i)throw new Error('PNG_REQUIRED');
 if(w&&i.width!==w||h&&i.height!==h)throw new Error('INVALID_PNG_SIZE '+i.width+'x'+i.height+' expected '+w+'x'+h);
 return i;
}

const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml'};
const safeId=s=>/^[a-z0-9][a-z0-9-]{1,40}$/.test(s||'');
const safeRel=s=>!!s&&!path.isAbsolute(s)&&!s.split(/[\\/]+/).includes('..');
const json=(res,code,obj)=>{res.writeHead(code,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(obj,null,2))};
const readBody=async req=>{const a=[];for await(const c of req)a.push(c);return Buffer.concat(a)};
const load=async p=>JSON.parse(await fsp.readFile(p,'utf8'));
async function loadSlotSpec(){
 try{
  const s=await load(SLOT_SPEC);
  if(s?.formatVersion>=3&&s?.packs)return s;
 }catch(e){if(e?.code!=='ENOENT')throw e}
 await run('python',['tools/theme-kit/make_slots.py']);
 return load(SLOT_SPEC);
}
const save=async(p,o)=>{await fsp.mkdir(path.dirname(p),{recursive:true});await fsp.writeFile(p,JSON.stringify(o,null,2)+'\n')};
const projectPath=id=>path.join(DESIGN,id,'project.json');
const projectDir=id=>path.join(DESIGN,id);
const now=()=>new Date().toISOString();
const sha256=buf=>crypto.createHash('sha256').update(buf).digest('hex');

function computeStage(p){
 const s=p.stages||{};
 if(s.release?.status==='approved')return'RELEASED';
 if(s.mood?.status!=='approved')return'MOOD';
 if(s.target?.status!=='approved')return'TARGET';
 if(s.sheets?.status!=='approved'||s.sheets?.!['asset-pack-v2','asset-pack-v3'].includes(p.stages.sheets.approvalMode))return'ASSETS';
 if(s.backgrounds?.status!=='approved')return'BACKGROUNDS';
 if(s.build?.status!=='success')return'BUILD';
 if(s.qa?.status!=='approved')return'QA';
 return'READY';
}
async function listProjects(){
 await fsp.mkdir(DESIGN,{recursive:true});
 const out=[];
 for(const e of await fsp.readdir(DESIGN,{withFileTypes:true})){
  if(!e.isDirectory()||!safeId(e.name))continue;
  try{const p=await load(projectPath(e.name));p.computedStage=computeStage(p);out.push(p)}catch{}
 }
 return out.sort((a,b)=>String(b.modifiedAt||'').localeCompare(String(a.modifiedAt||'')));
}
async function loadProject(id){
 if(!safeId(id))throw new Error('INVALID_ID');
 const p=await load(projectPath(id));
 p.stages=p.stages||{};
 p.stages.backgrounds=p.stages.backgrounds||{status:'locked',prompts:[]};
 const spec=await loadSlotSpec();
 const sheetNames=['sheet-board.png','sheet-rigid.png','sheet-chrome.png','sheet-tiles.png'];
 p.sheetFiles={};p.packFiles={};p.assetFiles={};p.backgroundFiles={};
 for(const name of sheetNames){
  const fp=path.join(projectDir(id),name);
  try{const data=await fsp.readFile(fp),st=await fsp.stat(fp);p.sheetFiles[name]={exists:true,size:st.size,sha256:sha256(data),uploadedAt:p.artifacts?.[name]?.uploadedAt||null}}
  catch{p.sheetFiles[name]={exists:false}}
 }
 for(const [pid,pk] of Object.entries(spec.packs||{})){
  const name=pk.file,candidates=[path.join(projectDir(id),'source','packs',name),path.join(projectDir(id),name)];let fp=null;
  for(const q of candidates){try{await fsp.access(q);fp=q;break}catch{}}
  if(fp){const data=await fsp.readFile(fp),st=await fsp.stat(fp),rel=path.relative(projectDir(id),fp).replaceAll('\\','/');p.packFiles[pid]={exists:true,file:rel,size:st.size,sha256:sha256(data),title:pk.title,sizePx:pk.size}}
  else p.packFiles[pid]={exists:false,file:'source/packs/'+name,title:pk.title,sizePx:pk.size}
 }
 for(const slot of spec.slots||[]){
  const overrides=[path.join(projectDir(id),'overrides',slot.id+'.png'),path.join(projectDir(id),slot.id+'.png')],derived=path.join(projectDir(id),'extracted',slot.id+'.png');
  let fp=null,source=null;
  for(const override of overrides){try{await fsp.access(override);fp=override;source='override';break}catch{}}
  if(!fp){try{await fsp.access(derived);fp=derived;source='pack'}catch{}}
  if(fp){
   const data=await fsp.readFile(fp),st=await fsp.stat(fp),rel=path.relative(projectDir(id),fp).replaceAll('\\','/');
   p.assetFiles[slot.id]={exists:true,file:rel,source,size:st.size,sha256:sha256(data),required:slot.required!==false,role:slot.role,output:slot.output,pack:slot.pack||null};
  }else p.assetFiles[slot.id]={exists:false,required:slot.required!==false,role:slot.role,output:slot.output,pack:slot.pack||null};
 }
 for(const name of BACKGROUND_FILES){
  const candidates=[path.join(projectDir(id),'source','backgrounds',name),path.join(projectDir(id),name)];let fp=null;
  for(const q of candidates){try{await fsp.access(q);fp=q;break}catch{}}
  if(fp){const data=await fsp.readFile(fp),st=await fsp.stat(fp);p.backgroundFiles[name]={exists:true,file:path.relative(projectDir(id),fp).replaceAll('\\','/'),size:st.size,sha256:sha256(data)}}
  else p.backgroundFiles[name]={exists:false,file:'source/backgrounds/'+name}
 }
 p.assetOverrides=p.assetOverrides||{};
 p.themeKitSpec={packs:spec.packs||{},slots:(spec.slots||[]).map(({id,role,required=true,output,pack,packBox})=>({id,role,required,output,pack,packBox}))};
 p.computedStage=computeStage(p);return p;
}
async function updateProject(id,fn){
 const p=await loadProject(id);delete p.computedStage;await fn(p);p.modifiedAt=now();p.projectVersion=(p.projectVersion||0)+1;await save(projectPath(id),p);return loadProject(id);
}
function run(cmd,args,cwd=ROOT){
 return new Promise((resolve,reject)=>{
  const p=spawn(cmd,args,{cwd,env:process.env});let out='',err='';
  p.stdout.on('data',d=>out+=d);p.stderr.on('data',d=>err+=d);
  p.on('error',e=>reject(Object.assign(new Error(cmd+': '+e.message),{code:'SPAWN_ERROR',out,err})));
  p.on('close',code=>code===0?resolve({code,out,err}):reject(Object.assign(new Error(err||out||cmd+' failed'),{code,out,err})));
 });
}
async function externalSources(id,p){
 const out=[];for(const s of p.externalSources||[]){
  const abs=path.resolve(ROOT,s.path);if(!abs.startsWith(ROOT+path.sep))continue;
  try{const st=await fsp.stat(abs);if(st.isFile())out.push({path:s.path,size:st.size,kind:s.kind||'legacy'})}catch{}
 }return out;
}
async function walkFiles(dir,base=dir){
 const out=[];
 for(const e of await fsp.readdir(dir,{withFileTypes:true})){
  if(e.name==='exports')continue;
  const p=path.join(dir,e.name);
  if(e.isDirectory())out.push(...await walkFiles(p,base));
  else if(e.isFile())out.push({abs:p,rel:path.relative(base,p).replaceAll('\\','/')});
 }
 return out;
}
async function copyFileWithDirs(src,dest){
 await fsp.mkdir(path.dirname(dest),{recursive:true});await fsp.copyFile(src,dest);
}
async function zipDirectory(src,dest){
 await fsp.rm(dest,{force:true});
 if(process.platform==='win32'){
  const ps='Compress-Archive -Path '+JSON.stringify(path.join(src,'*'))+' -DestinationPath '+JSON.stringify(dest)+' -Force';
  await run('powershell.exe',['-NoProfile','-Command',ps]);
 }else{
  await run('zip',['-q','-r',dest,'.'],src);
 }
}
async function unzipArchive(src,dest){
 await fsp.rm(dest,{recursive:true,force:true});await fsp.mkdir(dest,{recursive:true});
 await run('python',['theme-studio/safe_import.py',src,dest]);
}
async function makeArchive(id){
 const p=await loadProject(id),dir=projectDir(id),exports=path.join(dir,'exports');await fsp.mkdir(exports,{recursive:true});
 const name=`${id}-project-v${p.projectVersion||1}.ggrid-theme-project`,dest=path.join(exports,name);
 const stage=path.join(ROOT,'.cache','theme-studio-export-'+id);await fsp.rm(stage,{recursive:true,force:true});await fsp.mkdir(stage,{recursive:true});
 const manifestFiles={};
 for(const file of await walkFiles(dir)){
  const data=await fsp.readFile(file.abs);manifestFiles[file.rel]=sha256(data);await copyFileWithDirs(file.abs,path.join(stage,file.rel));
 }
 for(const src of p.externalSources||[]){
  const abs=path.resolve(ROOT,src.path);if(!abs.startsWith(ROOT+path.sep))continue;
  try{
   const st=await fsp.stat(abs);if(!st.isFile())continue;
   const rel='legacy-runtime/'+src.path.replaceAll('\\','/'),data=await fsp.readFile(abs);
   manifestFiles[rel]=sha256(data);await copyFileWithDirs(abs,path.join(stage,...rel.split('/')));
  }catch{}
 }
 await save(path.join(stage,'manifest.json'),{format:'ggrid-theme-project-archive',formatVersion:1,themeId:p.id,projectVersion:p.projectVersion||1,files:manifestFiles});
 await zipDirectory(stage,dest);await fsp.rm(stage,{recursive:true,force:true});
 return{name,path:dest,size:(await fsp.stat(dest)).size};
}
async function importArchive(tmp){
 const stage=path.join(ROOT,'.cache','theme-studio-import-unpacked');await unzipArchive(tmp,stage);
 const pp=path.join(stage,'project.json'),mp=path.join(stage,'manifest.json');
 const p=await load(pp),m=await load(mp),id=p.id;
 if(!safeId(id)||m.themeId!==id)throw new Error('INVALID_PROJECT_ARCHIVE');
 for(const [rel,hash] of Object.entries(m.files||{})){
  if(!safeRel(rel))throw new Error('INVALID_ARCHIVE_PATH');
  const fp=path.join(stage,...rel.split('/'));const data=await fsp.readFile(fp);
  if(sha256(data)!==hash)throw new Error('HASH_MISMATCH: '+rel);
 }
 const out=projectDir(id);if(fs.existsSync(out))throw new Error('PROJECT_EXISTS');
 await fsp.mkdir(out,{recursive:true});
 for(const file of await walkFiles(stage)){
  if(file.rel==='manifest.json'||file.rel.startsWith('legacy-runtime/'))continue;
  await copyFileWithDirs(file.abs,path.join(out,...file.rel.split('/')));
 }
 await fsp.rm(stage,{recursive:true,force:true});return id;
}
async function syncPipelineApproval(id,p,stage,file=null){
 const dir=projectDir(id),ap=path.join(dir,'approval.json');
 let a={format:'ggrid-theme-approval',formatVersion:1,themeId:id,stages:{}};
 try{a=await load(ap)}catch{}
 a.format='ggrid-theme-approval';a.formatVersion=1;a.themeId=id;a.stages=a.stages||{};
 const actor=p.stages?.[stage]?.actor||'owner';
 if(stage==='mood'&&file){
  const src=path.join(dir,file),dest=path.join(dir,'mood.png');await copyFileWithDirs(src,dest);
  const data=await fsp.readFile(dest);a.stages.mood={status:'approved',actor,files:[{file:'mood.png',sha256:sha256(data)}]};
 }
 if(stage==='target'&&file){
  const src=path.join(dir,file),dest=path.join(dir,'target.png');await copyFileWithDirs(src,dest);
  const data=await fsp.readFile(dest);a.stages.target={status:'approved',actor,files:[{file:'target.png',sha256:sha256(data)}]};
 }
 if(stage==='sheets'){
  const spec=await loadSlotSpec(),files=[];
  for(const pk of Object.values(spec.packs||{})){
   const candidates=[path.join(dir,'source','packs',pk.file),path.join(dir,pk.file)];let fp=null;
   for(const q of candidates){try{await fsp.access(q);fp=q;break}catch{}}
   if(!fp)throw new Error('Hiányzó Asset Pack: '+pk.file);
   const data=await fsp.readFile(fp);files.push({file:path.relative(dir,fp).replaceAll('\\','/'),sha256:sha256(data),kind:'pack'});
  }
  for(const slot of spec.slots||[]){
   const candidates=[path.join(dir,'overrides',slot.id+'.png'),path.join(dir,slot.id+'.png')];let fp=null;
   for(const q of candidates){try{await fsp.access(q);fp=q;break}catch{}}
   if(fp){const data=await fsp.readFile(fp);files.push({file:path.relative(dir,fp).replaceAll('\\','/'),sha256:sha256(data),kind:'override'})}
  }
  a.stages.sheets={status:'approved',actor,mode:'asset-pack-v3',files};
 }
 if(stage==='backgrounds'){
  const files=[];
  for(const name of BACKGROUND_FILES){
   const candidates=[path.join(dir,'source','backgrounds',name),path.join(dir,name)];let fp=null;
   for(const q of candidates){try{await fsp.access(q);fp=q;break}catch{}}
   if(!fp)throw new Error('Hiányzó háttér: '+name);
   const data=await fsp.readFile(fp);files.push({file:path.relative(dir,fp).replaceAll('\\','/'),sha256:sha256(data)});
  }
  a.stages.backgrounds={status:'approved',actor,files};
 }
 await save(ap,a);
 return a;
}
async function serveStatic(req,res,url){
 if(url.pathname.startsWith('/game/')){
  const rel=url.pathname.slice('/game/'.length)||'index.html',p=path.resolve(ROOT,rel);
  if(!inside(ROOT,p))return false;
  try{const st=await fsp.stat(p);if(!st.isFile())return false;res.writeHead(200,{'content-type':MIME[path.extname(p).toLowerCase()]||'application/octet-stream','cache-control':'no-store','x-content-type-options':'nosniff'});fs.createReadStream(p).pipe(res);return true}catch{return false}
 }
 let rel=url.pathname==='/'?'index.html':url.pathname.slice(1);
 if(rel.startsWith('api/'))return false;
 if(rel.startsWith('project-file/')){
  const [,id,...rest]=rel.split('/');if(!safeId(id))return false;const rp=rest.join('/');if(!safeRel(rp))return false;
  const p=path.resolve(projectDir(id),rp);if(!p.startsWith(projectDir(id)+path.sep))return false;
  try{const st=await fsp.stat(p);if(!st.isFile())return false;res.writeHead(200,{'content-type':MIME[path.extname(p).toLowerCase()]||'application/octet-stream','cache-control':'no-store'});fs.createReadStream(p).pipe(res);return true}catch{return false}
 }
 const p=path.resolve(PUBLIC,rel);if(!p.startsWith(PUBLIC+path.sep)&&p!==PUBLIC)return false;
 try{const st=await fsp.stat(p);if(!st.isFile())return false;res.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'});fs.createReadStream(p).pipe(res);return true}catch{return false}
}

const server=http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost');
  if(!allowedHost(req.headers.host))return json(res,403,{error:'invalid host'});
  if(req.method==='GET'&&url.pathname==='/api/session')return json(res,200,{token:SESSION_TOKEN});
  if(!['GET','HEAD','OPTIONS'].includes(req.method)&&!mutationAllowed(req))return json(res,403,{error:'forbidden'});
  if(req.method==='GET'&&url.pathname==='/api/themes')return json(res,200,{themes:await listProjects()});
  if(req.method==='POST'&&url.pathname==='/api/themes'){
   const b=JSON.parse((await readBody(req)).toString()||'{}'),id=b.id;
   if(!safeId(id))return json(res,400,{error:'invalid theme id'});
   const dir=projectDir(id);if(fs.existsSync(dir))return json(res,409,{error:'theme exists'});
   const p={format:'ggrid-theme-project',formatVersion:4,id,name:b.name||id,description:b.description||'',strict:b.strict!==false,projectVersion:1,createdAt:now(),modifiedAt:now(),stages:{mood:{status:'draft',prompts:[]},target:{status:'locked',prompts:[]},sheets:{status:'locked',prompts:[],approvalMode:'asset-pack-v3'},backgrounds:{status:'locked',prompts:[]},build:{status:'none',history:[]},qa:{status:'locked'},release:{status:'none'}},artifacts:{},assetOverrides:{},renderer:{rigid:'material'},externalSources:[]};
   await save(projectPath(id),p);
   await save(path.join(dir,'theme-kit.json'),{id,name:p.name,description:p.description,strict:p.strict,version:1,renderer:{rigid:'material'}});
   return json(res,201,await loadProject(id));
  }
  let m=url.pathname.match(/^\/api\/themes\/([a-z0-9-]+)$/);
  if(req.method==='GET'&&m)return json(res,200,await loadProject(m[1]));
  m=url.pathname.match(/^\/api\/themes\/([a-z0-9-]+)\/prompts$/);
  if(req.method==='POST'&&m){
   const b=JSON.parse((await readBody(req)).toString()||'{}'),stage=b.stage;if(!['mood','target','sheets','backgrounds'].includes(stage))return json(res,400,{error:'invalid stage'});
   const p=await updateProject(m[1],p=>{const a=p.stages[stage].prompts||(p.stages[stage].prompts=[]);a.push({id:`${stage}-${String(a.length+1).padStart(3,'0')}`,text:b.text||'',notes:b.notes||'',createdAt:now(),files:[]})});return json(res,201,p);
  }
  m=url.pathname.match(/^\/api\/themes\/([a-z0-9-]+)\/upload\/(.+)$/);
  if(req.method==='PUT'&&m){
   const id=m[1],rel=decodeURIComponent(m[2]),base=path.basename(rel).toLowerCase();
   if(!safeRel(rel)||PROTECTED_UPLOADS.has(base)||!['.png','.jpg','.jpeg','.webp'].includes(path.extname(rel).toLowerCase()))return json(res,400,{error:'invalid file'});
   const data=await readBody(req);if(data.length>MAX_UPLOAD)return json(res,413,{error:'file too large'});
   const spec=await loadSlotSpec(),pack=Object.values(spec.packs||{}).find(x=>x.file===base);
   if(pack)validatePng(data,pack.size[0],pack.size[1]);
   if(BACKGROUND_FILES.includes(base)){const wh=base==='bg-portrait.png'?[1080,1620]:[1620,1080];validatePng(data,wh[0],wh[1])}
   const dest=path.resolve(projectDir(id),rel);if(!inside(projectDir(id),dest))return json(res,400,{error:'invalid path'});await fsp.mkdir(path.dirname(dest),{recursive:true});await fsp.writeFile(dest,data);
   await updateProject(id,p=>{p.artifacts=p.artifacts||{};p.artifacts[rel]={sha256:sha256(data),size:data.length,uploadedAt:now()}});
   const packNames=new Set(Object.values(spec.packs||{}).map(x=>x.file));
   let extracted=null;
   if(packNames.has(path.basename(rel))){
    const r=await run('python',['tools/theme-kit/kit.py','extract-packs','--input',path.relative(ROOT,projectDir(id))]);
    try{extracted=JSON.parse(r.out.trim())}catch{extracted={log:r.out}}
   }
   return json(res,201,{file:rel,sha256:sha256(data),size:data.length,extracted});
  }
  m=url.pathname.match(/^\/api\/themes\/([a-z0-9-]+)\/assets\/([a-z0-9-]+)$/);
  if(req.method==='PUT'&&m){
   const id=m[1],slotId=m[2],spec=await loadSlotSpec(),slot=(spec.slots||[]).find(x=>x.id===slotId);
   if(!slot)return json(res,404,{error:'unknown asset'});
   const data=await readBody(req);if(data.length>MAX_UPLOAD)return json(res,413,{error:'file too large'});validatePng(data);
   const dir=projectDir(id),dest=path.join(dir,'overrides',slotId+'.png'),hist=path.join(dir,'history',slotId);
   try{const old=await fsp.readFile(dest);await fsp.mkdir(hist,{recursive:true});await fsp.writeFile(path.join(hist,Date.now()+'.png'),old)}catch{}
   await fsp.mkdir(path.dirname(dest),{recursive:true});await fsp.writeFile(dest,data);
   const p=await updateProject(id,p=>{p.assetOverrides=p.assetOverrides||{};p.assetOverrides[slotId]={file:'overrides/'+slotId+'.png',status:'review',sha256:sha256(data),updatedAt:now()};p.stages.build.status='ready';p.stages.qa.status='locked'});
   return json(res,201,p);
  }
  if(req.method==='DELETE'&&m){
   const id=m[1],slotId=m[2],dir=projectDir(id),dest=path.join(dir,'overrides',slotId+'.png');
   try{const old=await fsp.readFile(dest),hist=path.join(dir,'history',slotId);await fsp.mkdir(hist,{recursive:true});await fsp.writeFile(path.join(hist,Date.now()+'.png'),old)}catch{}
   await fsp.rm(dest,{force:true});
   const p=await updateProject(id,p=>{if(p.assetOverrides)delete p.assetOverrides[slotId];p.stages.build.status='ready';p.stages.qa.status='locked'});return json(res,200,p);
  }
  m=url.pathname.match(/^\/api\/themes\/([a-z0-9-]+)\/quick-build$/);
  if(req.method==='POST'&&m){
   const id=m[1],p0=await loadProject(id);
   if(p0.stages.sheets.status!=='approved')return json(res,409,{error:'asset packs not approved'});
   if(p0.stages.backgrounds.status!=='approved')return json(res,409,{error:'backgrounds not approved'});
   const p1=await updateProject(id,p=>{for(const v of Object.values(p.assetOverrides||{})){v.status='approved';v.approvedAt=now()}p.stages.sheets.approvalMode='asset-pack-v3'});
   await syncPipelineApproval(id,p1,'sheets');
   const dir=projectDir(id),started=now();
   try{
    const r=await run('python',['tools/theme-kit/kit.py','build','--input',path.relative(ROOT,dir)]);
    const up=await updateProject(id,p=>{p.stages.build.status='success';p.stages.build.history=p.stages.build.history||[];p.stages.build.history.push({started,finishedAt:now(),status:'success',quick:true,log:r.out});p.stages.qa.status='review'});
    return json(res,200,{project:up,buildLog:r.out});
   }catch(e){await updateProject(id,p=>{p.stages.build.status='failed'});return json(res,500,{error:e.message||String(e),log:e.err||e.out||''})}
  }
  m=url.pathname.match(/^\/api\/themes\/([a-z0-9-]+)\/approve$/);
  if(req.method==='POST'&&m){
   const id=m[1],b=JSON.parse((await readBody(req)).toString()||'{}'),stage=b.stage,file=b.file;
   if(!['mood','target','sheets','backgrounds','qa'].includes(stage))return json(res,400,{error:'invalid stage'});
   if(stage!=='sheets'&&stage!=='backgrounds'&&stage!=='qa'&&!safeRel(file))return json(res,400,{error:'file required'});
   const p=await updateProject(id,async p=>{
    if(stage==='target'&&p.stages.mood.status!=='approved')throw new Error('mood not approved');
    if(stage==='sheets'&&p.stages.target.status!=='approved')throw new Error('target not approved');
    if(stage==='backgrounds'&&(p.stages.sheets.status!=='approved'||!['asset-pack-v2','asset-pack-v3'].includes(p.stages.sheets.approvalMode)))throw new Error('asset packs not approved');
    let info={status:'approved',approvedAt:now(),actor:b.actor||'owner',notes:b.notes||''};
    if(stage==='sheets'){
     const spec=await loadSlotSpec(),approvedFiles={};
     for(const pk of Object.values(spec.packs||{})){
      const name=pk.file;let data;
      try{data=await fsp.readFile(path.join(projectDir(id),name))}catch{throw new Error('Hiányzó kötelező Asset Pack: '+name)}
      approvedFiles[name]={sha256:sha256(data),size:data.length,kind:'pack'};
     }
     for(const slot of spec.slots||[]){
      const name=slot.id+'.png';
      try{const data=await fsp.readFile(path.join(projectDir(id),name));approvedFiles[name]={sha256:sha256(data),size:data.length,kind:'override'}}catch{}
     }
     const requiredMissing=(spec.slots||[]).filter(x=>x.required!==false&&!p.assetFiles?.[x.id]?.exists);
     if(requiredMissing.length)throw new Error('A pack kivágás után hiányzó kötelező elemek: '+requiredMissing.map(x=>x.id).join(', '));
     info.approvedFiles=approvedFiles;info.approvalMode='asset-pack-v3';
    }else if(stage==='backgrounds'){
     const approvedFiles={};
     for(const name of BACKGROUND_FILES){
      let data;try{data=await fsp.readFile(path.join(projectDir(id),name))}catch{throw new Error('Hiányzó kötelező háttér: '+name)}
      approvedFiles[name]={sha256:sha256(data),size:data.length};
     }
     info.approvedFiles=approvedFiles;
    }else if(file){
     const data=await fsp.readFile(path.join(projectDir(id),file));info={...info,file,sha256:sha256(data)}
    }
    p.stages[stage]={...p.stages[stage],...info};
    if(stage==='mood')p.stages.target.status='draft';
    if(stage==='target'){p.stages.sheets.status='draft';p.stages.sheets.approvalMode='asset-pack-v3';p.stages.backgrounds.status='locked'}
    if(stage==='sheets'){p.stages.backgrounds.status='draft';p.stages.build.status='none';p.stages.qa.status='locked'}
    if(stage==='backgrounds'){p.stages.build.status='ready';p.stages.qa.status='locked'}
    if(stage==='qa')p.stages.release.status='ready';
   });
   await syncPipelineApproval(id,p,stage,file||null);
   return json(res,200,await loadProject(id));
  }
  m=url.pathname.match(/^\/api\/themes\/([a-z0-9-]+)\/build$/);
  if(req.method==='POST'&&m){
   const id=m[1],p=await loadProject(id);if(p.stages.sheets.status!=='approved'||!['asset-pack-v2','asset-pack-v3'].includes(p.stages.sheets.approvalMode))return json(res,409,{error:'asset packs not approved'});if(p.stages.backgrounds.status!=='approved')return json(res,409,{error:'backgrounds not approved'});
   const dir=projectDir(id);const started=now();
   try{
    const r=await run('python',['tools/theme-kit/kit.py','build','--input',path.relative(ROOT,dir)]);
    const qadir=path.join(dir,'builds',`build-${Date.now()}`);await fsp.mkdir(qadir,{recursive:true});
    let qa=null;try{qa=await run('python',['tools/theme-kit/kit.py','capture','--theme',id,'--out',qadir,'--target',path.join(dir,'target.png')])}catch(e){qa={out:e.out||'',err:e.err||String(e)}}
    const up=await updateProject(id,p=>{p.stages.build.status='success';p.stages.build.history=p.stages.build.history||[];p.stages.build.history.push({started,finishedAt:now(),status:'success',log:r.out,qaDir:path.relative(dir,qadir).replaceAll('\\','/')});p.stages.qa.status='review'});
    return json(res,200,{project:up,buildLog:r.out,qa});
   }catch(e){await updateProject(id,p=>{p.stages.build.status='failed';p.stages.build.history=p.stages.build.history||[];p.stages.build.history.push({started,finishedAt:now(),status:'failed',log:e.err||e.out||String(e)})});return json(res,500,{error:String(e),log:e.err||e.out})}
  }
  m=url.pathname.match(/^\/api\/themes\/([a-z0-9-]+)\/export$/);
  if(req.method==='POST'&&m){const a=await makeArchive(m[1]);res.writeHead(200,{'content-type':'application/octet-stream','content-disposition':`attachment; filename="${a.name}"`,'content-length':a.size});return fs.createReadStream(a.path).pipe(res)}
  if(req.method==='POST'&&url.pathname==='/api/import'){
   const data=await readBody(req);if(data.length>200*1024*1024)return json(res,413,{error:'archive too large'});const tmp=path.join(ROOT,'.cache','theme-studio-import.zip');await fsp.mkdir(path.dirname(tmp),{recursive:true});await fsp.writeFile(tmp,data);
   try{const id=await importArchive(tmp);return json(res,201,await loadProject(id))}finally{fsp.rm(tmp,{force:true}).catch(()=>{})}
  }
  m=url.pathname.match(/^\/api\/themes\/([a-z0-9-]+)\/external-sources$/);
  if(req.method==='GET'&&m){const p=await loadProject(m[1]);return json(res,200,{sources:await externalSources(m[1],p)})}
  if(await serveStatic(req,res,url))return;
  json(res,404,{error:'not found'});
 }catch(e){console.error(e);json(res,500,{error:e.message||String(e)})}
});
server.listen(PORT,'127.0.0.1',()=>console.log(`Theme Studio: http://127.0.0.1:${PORT}`));
