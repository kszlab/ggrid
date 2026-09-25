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
const MAX_ARCHIVE=200*1024*1024;
const PROTECTED_UPLOADS=new Set(['project.json','approval.json','manifest.json','theme-kit.json']);

const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.ico':'image/x-icon'};
const safeId=s=>/^[a-z0-9][a-z0-9-]{1,40}$/.test(s||'');
const safeRel=s=>!!s&&!path.isAbsolute(s)&&!s.split(/[\\/]+/).includes('..')&&!/^[A-Za-z]:/.test(s)&&!String(s).startsWith('\\\\');
const inside=(base,target)=>{const b=path.resolve(base),t=path.resolve(target);return t===b||t.startsWith(b+path.sep)};
const json=(res,code,obj)=>{res.writeHead(code,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'});res.end(JSON.stringify(obj,null,2))};
const load=async p=>JSON.parse(await fsp.readFile(p,'utf8'));
const save=async(p,o)=>{await fsp.mkdir(path.dirname(p),{recursive:true});await fsp.writeFile(p,JSON.stringify(o,null,2)+'\n','utf8')};
const now=()=>new Date().toISOString();
const sha256=buf=>crypto.createHash('sha256').update(buf).digest('hex');
const projectDir=id=>path.join(DESIGN,id);
const projectPath=id=>path.join(projectDir(id),'project.json');

async function readBody(req,limit=MAX_UPLOAD){
 const a=[];let n=0;
 for await(const c of req){n+=c.length;if(n>limit)throw Object.assign(new Error('PAYLOAD_TOO_LARGE'),{status:413});a.push(c)}
 return Buffer.concat(a);
}
function run(cmd,args,cwd=ROOT){
 return new Promise((resolve,reject)=>{
  const p=spawn(cmd,args,{cwd,env:process.env});let out='',err='';
  p.stdout.on('data',d=>out+=d);p.stderr.on('data',d=>err+=d);
  p.on('error',e=>reject(Object.assign(new Error(cmd+': '+e.message),{code:'SPAWN_ERROR',out,err})));
  p.on('close',code=>code===0?resolve({code,out,err}):reject(Object.assign(new Error(err||out||cmd+' failed'),{code,out,err})));
 });
}
async function loadSlotSpec(){
 try{const s=await load(SLOT_SPEC);if(s?.formatVersion>=4&&s?.packs)return s}catch(e){if(e?.code!=='ENOENT')throw e}
 await run('python',['tools/theme-kit/make_slots.py']);return load(SLOT_SPEC);
}
function pngInfo(buf){
 if(buf.length<24||!buf.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return null;
 return{width:buf.readUInt32BE(16),height:buf.readUInt32BE(20)};
}
function validatePng(buf,w=null,h=null){
 const i=pngInfo(buf);if(!i)throw Object.assign(new Error('PNG_REQUIRED'),{status:400});
 if((w&&i.width!==w)||(h&&i.height!==h))throw Object.assign(new Error('INVALID_PNG_SIZE '+i.width+'x'+i.height+' expected '+w+'x'+h),{status:400});
 return i;
}
function allowedHost(h){return /^(127\.0\.0\.1|localhost)(:\d+)?$/i.test(String(h||''))}
function mutationAllowed(req){
 if(!allowedHost(req.headers.host))return false;
 const origin=String(req.headers.origin||'');
 if(origin&&!['http://127.0.0.1:'+PORT,'http://localhost:'+PORT].includes(origin))return false;
 return req.headers['x-theme-studio-token']===SESSION_TOKEN;
}
async function existingPath(base,candidates){
 for(const rel of candidates){const p=path.resolve(base,rel);if(!inside(base,p))continue;try{const st=await fsp.stat(p);if(st.isFile())return p}catch{}}
 return null;
}
async function copyFileWithDirs(src,dest){await fsp.mkdir(path.dirname(dest),{recursive:true});await fsp.copyFile(src,dest)}
async function walkFiles(dir,base=dir){
 const out=[];for(const e of await fsp.readdir(dir,{withFileTypes:true})){
  if(e.name==='exports')continue;const p=path.join(dir,e.name);
  if(e.isDirectory())out.push(...await walkFiles(p,base));else if(e.isFile())out.push({abs:p,rel:path.relative(base,p).replaceAll('\\','/')});
 }return out;
}
function computeStage(p){
 const s=p.stages||{};
 if(s.release?.status==='approved')return'RELEASED';
 if(s.mood?.status!=='approved')return'MOOD';
 if(s.target?.status!=='approved')return'TARGET';
 if(s.sheets?.status!=='approved'||!['asset-pack-v2','asset-pack-v3'].includes(s.sheets?.approvalMode))return'ASSETS';
 if(s.backgrounds?.status!=='approved')return'BACKGROUNDS';
 if(s.build?.status!=='success')return'BUILD';
 if(s.qa?.status!=='approved')return'QA';
 return'READY';
}
async function listProjects(){
 await fsp.mkdir(DESIGN,{recursive:true});const out=[];
 for(const e of await fsp.readdir(DESIGN,{withFileTypes:true})){
  if(!e.isDirectory()||!safeId(e.name))continue;
  try{const p=await load(projectPath(e.name));p.computedStage=computeStage(p);out.push(p)}catch{}
 }
 return out.sort((a,b)=>String(b.modifiedAt||'').localeCompare(String(a.modifiedAt||'')));
}
async function loadProject(id){
 if(!safeId(id))throw Object.assign(new Error('INVALID_ID'),{status:400});
 const dir=projectDir(id),p=await load(projectPath(id));p.stages=p.stages||{};p.stages.backgrounds=p.stages.backgrounds||{status:'locked',prompts:[]};p.assetOverrides=p.assetOverrides||{};
 const spec=await loadSlotSpec();p.packFiles={};p.assetFiles={};p.backgroundFiles={};
 for(const [pid,pk] of Object.entries(spec.packs||{})){
  const fp=await existingPath(dir,[path.join('source','packs',pk.file),pk.file]);
  if(fp){const data=await fsp.readFile(fp),st=await fsp.stat(fp);p.packFiles[pid]={exists:true,file:path.relative(dir,fp).replaceAll('\\','/'),size:st.size,sha256:sha256(data),title:pk.title,sizePx:pk.size}}
  else p.packFiles[pid]={exists:false,file:'source/packs/'+pk.file,title:pk.title,sizePx:pk.size};
 }
 for(const s of spec.slots||[]){
  const fp=await existingPath(dir,[path.join('overrides',s.id+'.png'),s.id+'.png',path.join('extracted',s.id+'.png')]);
  if(fp){const data=await fsp.readFile(fp),st=await fsp.stat(fp),rel=path.relative(dir,fp).replaceAll('\\','/');p.assetFiles[s.id]={exists:true,file:rel,source:rel.startsWith('overrides/')||rel===s.id+'.png'?'override':'pack',size:st.size,sha256:sha256(data),required:s.required!==false,role:s.role,output:s.output,pack:s.pack||null}}
  else p.assetFiles[s.id]={exists:false,required:s.required!==false,role:s.role,output:s.output,pack:s.pack||null};
 }
 for(const name of BACKGROUND_FILES){
  const fp=await existingPath(dir,[path.join('source','backgrounds',name),name]);
  if(fp){const data=await fsp.readFile(fp),st=await fsp.stat(fp);p.backgroundFiles[name]={exists:true,file:path.relative(dir,fp).replaceAll('\\','/'),size:st.size,sha256:sha256(data)}}
  else p.backgroundFiles[name]={exists:false,file:'source/backgrounds/'+name};
 }
 p.themeKitSpec={packs:spec.packs||{},slots:(spec.slots||[]).map(({id,role,required=true,output,pack,packBox})=>({id,role,required,output,pack,packBox}))};
 p.computedStage=computeStage(p);return p;
}
async function updateProject(id,fn){
 const p=await loadProject(id);delete p.computedStage;await fn(p);p.modifiedAt=now();p.projectVersion=(p.projectVersion||0)+1;await save(projectPath(id),p);return loadProject(id);
}
async function externalSources(p){
 const out=[];for(const s of p.externalSources||[]){const abs=path.resolve(ROOT,s.path);if(!inside(ROOT,abs))continue;try{const st=await fsp.stat(abs);if(st.isFile())out.push({path:s.path,size:st.size,kind:s.kind||'legacy'})}catch{}}
 return out;
}
async function zipDirectory(src,dest){
 await fsp.rm(dest,{force:true});
 if(process.platform==='win32'){const ps='Compress-Archive -Path '+JSON.stringify(path.join(src,'*'))+' -DestinationPath '+JSON.stringify(dest)+' -Force';await run('powershell.exe',['-NoProfile','-Command',ps])}
 else await run('zip',['-q','-r',dest,'.'],src);
}
async function makeArchive(id){
 const p=await loadProject(id),dir=projectDir(id),exports=path.join(dir,'exports');await fsp.mkdir(exports,{recursive:true});
 const name=`${id}-project-v${p.projectVersion||1}.ggrid-theme-project`,dest=path.join(exports,name),stage=path.join(ROOT,'.cache','theme-studio-export-'+id);
 await fsp.rm(stage,{recursive:true,force:true});await fsp.mkdir(stage,{recursive:true});const manifestFiles={};
 for(const file of await walkFiles(dir)){const data=await fsp.readFile(file.abs);manifestFiles[file.rel]=sha256(data);await copyFileWithDirs(file.abs,path.join(stage,...file.rel.split('/')))}
 for(const src of p.externalSources||[]){const abs=path.resolve(ROOT,src.path);if(!inside(ROOT,abs))continue;try{const st=await fsp.stat(abs);if(!st.isFile())continue;const rel='legacy-runtime/'+src.path.replaceAll('\\','/'),data=await fsp.readFile(abs);manifestFiles[rel]=sha256(data);await copyFileWithDirs(abs,path.join(stage,...rel.split('/')))}catch{}}
 await save(path.join(stage,'manifest.json'),{format:'ggrid-theme-project-archive',formatVersion:2,themeId:p.id,projectVersion:p.projectVersion||1,files:manifestFiles});
 await zipDirectory(stage,dest);await fsp.rm(stage,{recursive:true,force:true});return{name,path:dest,size:(await fsp.stat(dest)).size};
}
async function importArchive(tmp){
 const stage=path.join(ROOT,'.cache','theme-studio-import-'+crypto.randomBytes(6).toString('hex'));await fsp.mkdir(stage,{recursive:true});
 try{
  await run('python',['theme-studio/safe_import.py',tmp,stage]);
  const p=await load(path.join(stage,'project.json')),m=await load(path.join(stage,'manifest.json')),id=p.id;
  if(!safeId(id)||m.themeId!==id)throw new Error('INVALID_PROJECT_ARCHIVE');
  for(const [rel,hash] of Object.entries(m.files||{})){if(!safeRel(rel))throw new Error('INVALID_ARCHIVE_PATH');const data=await fsp.readFile(path.join(stage,...rel.split('/')));if(sha256(data)!==hash)throw new Error('HASH_MISMATCH: '+rel)}
  const out=projectDir(id);if(fs.existsSync(out))throw new Error('PROJECT_EXISTS');await fsp.mkdir(out,{recursive:true});
  for(const rel of Object.keys(m.files||{})){if(rel.startsWith('legacy-runtime/'))continue;await copyFileWithDirs(path.join(stage,...rel.split('/')),path.join(out,...rel.split('/')))}
  const imported=await load(projectPath(id));imported.importedAt=now();imported.importVerified=true;imported.modifiedAt=now();await save(projectPath(id),imported);return id;
 }finally{await fsp.rm(stage,{recursive:true,force:true})}
}
async function syncPipelineApproval(id,p,stage,file=null){
 const dir=projectDir(id),ap=path.join(dir,'approval.json');let a={format:'ggrid-theme-approval',formatVersion:1,themeId:id,stages:{}};
 try{a=await load(ap)}catch{}a.stages=a.stages||{};const actor=p.stages?.[stage]?.actor||'owner';
 if(stage==='mood'&&file){const src=path.join(dir,file),dest=path.join(dir,'mood.png');await copyFileWithDirs(src,dest);const data=await fsp.readFile(dest);a.stages.mood={status:'approved',actor,files:[{file:'mood.png',sha256:sha256(data)}]}}
 if(stage==='target'&&file){const src=path.join(dir,file),dest=path.join(dir,'target.png');await copyFileWithDirs(src,dest);const data=await fsp.readFile(dest);a.stages.target={status:'approved',actor,files:[{file:'target.png',sha256:sha256(data)}]}}
 if(stage==='sheets'){
  const spec=await loadSlotSpec(),files=[];
  for(const pk of Object.values(spec.packs||{})){const fp=await existingPath(dir,[path.join('source','packs',pk.file),pk.file]);if(!fp)throw new Error('Hiányzó Asset Pack: '+pk.file);const data=await fsp.readFile(fp);files.push({file:path.relative(dir,fp).replaceAll('\\','/'),sha256:sha256(data),kind:'pack'})}
  for(const s of spec.slots||[]){const fp=await existingPath(dir,[path.join('overrides',s.id+'.png'),s.id+'.png']);if(fp){const data=await fsp.readFile(fp);files.push({file:path.relative(dir,fp).replaceAll('\\','/'),sha256:sha256(data),kind:'override'})}}
  a.stages.sheets={status:'approved',actor,mode:'asset-pack-v3',files};
 }
 if(stage==='backgrounds'){
  const files=[];for(const name of BACKGROUND_FILES){const fp=await existingPath(dir,[path.join('source','backgrounds',name),name]);if(!fp)throw new Error('Hiányzó háttér: '+name);const data=await fsp.readFile(fp);files.push({file:path.relative(dir,fp).replaceAll('\\','/'),sha256:sha256(data)})}
  a.stages.backgrounds={status:'approved',actor,files};
 }
 await save(ap,a);return a;
}
async function buildTheme(id,{capture=true,quick=false}={}){
 const p=await loadProject(id);if(p.stages.sheets.status!=='approved')throw Object.assign(new Error('asset packs not approved'),{status:409});if(p.stages.backgrounds.status!=='approved')throw Object.assign(new Error('backgrounds not approved'),{status:409});
 const dir=projectDir(id),started=now(),r=await run('python',['tools/theme-kit/kit.py','build','--input',path.relative(ROOT,dir)]);let qadir=null,qa=null;
 if(capture){qadir=path.join(dir,'builds',`build-${Date.now()}`);await fsp.mkdir(qadir,{recursive:true});try{qa=await run('python',['tools/theme-kit/kit.py','capture','--theme',id,'--out',qadir,'--target',path.join(dir,'target.png')])}catch(e){qa={out:e.out||'',err:e.err||String(e)}}}
 const up=await updateProject(id,p=>{p.stages.build.status='success';p.stages.build.history=p.stages.build.history||[];p.stages.build.history.push({started,finishedAt:now(),status:'success',quick,log:r.out,...(qadir?{qaDir:path.relative(dir,qadir).replaceAll('\\','/')}:{})});p.stages.qa.status='review'});
 return{project:up,buildLog:r.out,qa};
}
async function serveStatic(req,res,url){
 if(url.pathname.startsWith('/game/')){
  const rel=url.pathname.slice(6)||'index.html',p=path.resolve(ROOT,rel);if(!inside(ROOT,p))return false;
  try{const st=await fsp.stat(p);if(!st.isFile())return false;res.writeHead(200,{'content-type':MIME[path.extname(p).toLowerCase()]||'application/octet-stream','cache-control':'no-store','x-content-type-options':'nosniff'});fs.createReadStream(p).pipe(res);return true}catch{return false}
 }
 let rel=url.pathname==='/'?'index.html':url.pathname.slice(1);if(rel.startsWith('api/'))return false;
 if(rel.startsWith('project-file/')){const [,id,...rest]=rel.split('/');if(!safeId(id))return false;const rp=rest.join('/');if(!safeRel(rp))return false;const p=path.resolve(projectDir(id),rp);if(!inside(projectDir(id),p))return false;try{const st=await fsp.stat(p);if(!st.isFile())return false;res.writeHead(200,{'content-type':MIME[path.extname(p).toLowerCase()]||'application/octet-stream','cache-control':'no-store','x-content-type-options':'nosniff'});fs.createReadStream(p).pipe(res);return true}catch{return false}}
 const p=path.resolve(PUBLIC,rel);if(!inside(PUBLIC,p))return false;try{const st=await fsp.stat(p);if(!st.isFile())return false;res.writeHead(200,{'content-type':MIME[path.extname(p).toLowerCase()]||'application/octet-stream','x-content-type-options':'nosniff'});fs.createReadStream(p).pipe(res);return true}catch{return false}
}

const server=http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost');if(!allowedHost(req.headers.host))return json(res,403,{error:'invalid host'});
  if(req.method==='GET'&&url.pathname==='/api/session')return json(res,200,{token:SESSION_TOKEN});
  if(!['GET','HEAD','OPTIONS'].includes(req.method)&&!mutationAllowed(req))return json(res,403,{error:'forbidden'});
  if(req.method==='GET'&&url.pathname==='/api/themes')return json(res,200,{themes:await listProjects()});
  if(req.method==='POST'&&url.pathname==='/api/themes'){
   const b=JSON.parse((await readBody(req,1024*1024)).toString()||'{}'),id=b.id;if(!safeId(id))return json(res,400,{error:'invalid theme id'});
   const dir=projectDir(id);if(fs.existsSync(dir))return json(res,409,{error:'theme exists'});await fsp.mkdir(dir,{recursive:true});
   const p={format:'ggrid-theme-project',formatVersion:4,id,name:String(b.name||id).slice(0,120),description:String(b.description||'').slice(0,2000),strict:b.strict!==false,projectVersion:1,createdAt:now(),modifiedAt:now(),renderer:{rigid:'material'},stages:{mood:{status:'draft',prompts:[]},target:{status:'locked',prompts:[]},sheets:{status:'locked',prompts:[],approvalMode:'asset-pack-v3'},backgrounds:{status:'locked',prompts:[]},build:{status:'none',history:[]},qa:{status:'locked'},release:{status:'none'}},artifacts:{},assetOverrides:{},externalSources:[]};
   await save(projectPath(id),p);await save(path.join(dir,'theme-kit.json'),{id,name:p.name,description:p.description,strict:p.strict,version:1,renderer:{rigid:'material'}});return json(res,201,await loadProject(id));
  }
  let m=url.pathname.match(/^\/api\/themes\/([a-z0-9-]+)$/);if(req.method==='GET'&&m)return json(res,200,await loadProject(m[1]));
  m=url.pathname.match(/^\/api\/themes\/([a-z0-9-]+)\/settings$/);
  if(req.method==='POST'&&m){
   const id=m[1],b=JSON.parse((await readBody(req,1024*1024)).toString()||'{}'),rigid=String(b.rigid||'');
   if(!['material','shape','tiles'].includes(rigid))return json(res,400,{error:'invalid rigid renderer'});
   const p=await updateProject(id,p=>{p.renderer=p.renderer||{};p.renderer.rigid=rigid;p.stages.build.status='ready';p.stages.qa.status='locked'});
   const kitPath=path.join(projectDir(id),'theme-kit.json'),kit=await load(kitPath);kit.renderer=kit.renderer||{};kit.renderer.rigid=rigid;await save(kitPath,kit);
   return json(res,200,p);
  }
  m=url.pathname.match(/^\/api\/themes\/([a-z0-9-]+)\/prompts$/);
  if(req.method==='POST'&&m){const b=JSON.parse((await readBody(req,1024*1024)).toString()||'{}'),stage=b.stage;if(!['mood','target','sheets','backgrounds'].includes(stage))return json(res,400,{error:'invalid stage'});const p=await updateProject(m[1],p=>{const a=p.stages[stage].prompts||(p.stages[stage].prompts=[]);a.push({id:`${stage}-${String(a.length+1).padStart(3,'0')}`,text:String(b.text||'').slice(0,20000),notes:String(b.notes||'').slice(0,4000),createdAt:now(),files:[]})});return json(res,201,p)}
  m=url.pathname.match(/^\/api\/themes\/([a-z0-9-]+)\/upload\/(.+)$/);
  if(req.method==='PUT'&&m){
   const id=m[1],rel=decodeURIComponent(m[2]),base=path.basename(rel).toLowerCase(),ext=path.extname(rel).toLowerCase();if(!safeRel(rel)||PROTECTED_UPLOADS.has(base)||!['.png','.jpg','.jpeg','.webp'].includes(ext))return json(res,400,{error:'invalid file'});
   const data=await readBody(req),spec=await loadSlotSpec(),pack=Object.values(spec.packs||{}).find(x=>x.file===base);if(pack)validatePng(data,pack.size[0],pack.size[1]);if(BACKGROUND_FILES.includes(base)){const wh=base==='bg-portrait.png'?[1080,1620]:[1620,1080];validatePng(data,...wh)}
   const dest=path.resolve(projectDir(id),rel);if(!inside(projectDir(id),dest))return json(res,400,{error:'invalid path'});await fsp.mkdir(path.dirname(dest),{recursive:true});await fsp.writeFile(dest,data);await updateProject(id,p=>{p.artifacts=p.artifacts||{};p.artifacts[rel]={sha256:sha256(data),size:data.length,uploadedAt:now()}});
   let extracted=null;if(pack){const r=await run('python',['tools/theme-kit/kit.py','extract-packs','--input',path.relative(ROOT,projectDir(id))]);try{extracted=JSON.parse(r.out.trim())}catch{extracted={log:r.out}}}return json(res,201,{file:rel,sha256:sha256(data),size:data.length,extracted});
  }
  m=url.pathname.match(/^\/api\/themes\/([a-z0-9-]+)\/assets\/([a-z0-9-]+)$/);
  if(req.method==='PUT'&&m){
   const id=m[1],slotId=m[2],spec=await loadSlotSpec(),slot=(spec.slots||[]).find(x=>x.id===slotId);if(!slot)return json(res,404,{error:'unknown asset'});const data=await readBody(req);validatePng(data);
   const dir=projectDir(id),dest=path.join(dir,'overrides',slotId+'.png'),hist=path.join(dir,'history',slotId);try{const old=await fsp.readFile(dest);await fsp.mkdir(hist,{recursive:true});await fsp.writeFile(path.join(hist,Date.now()+'.png'),old)}catch{}await fsp.mkdir(path.dirname(dest),{recursive:true});await fsp.writeFile(dest,data);
   const p=await updateProject(id,p=>{p.assetOverrides=p.assetOverrides||{};p.assetOverrides[slotId]={file:'overrides/'+slotId+'.png',status:'review',sha256:sha256(data),updatedAt:now()};p.stages.build.status='ready';p.stages.qa.status='locked'});return json(res,201,p);
  }
  if(req.method==='DELETE'&&m){const id=m[1],slotId=m[2],dir=projectDir(id),dest=path.join(dir,'overrides',slotId+'.png');try{const old=await fsp.readFile(dest),hist=path.join(dir,'history',slotId);await fsp.mkdir(hist,{recursive:true});await fsp.writeFile(path.join(hist,Date.now()+'.png'),old)}catch{}await fsp.rm(dest,{force:true});const p=await updateProject(id,p=>{delete p.assetOverrides?.[slotId];p.stages.build.status='ready';p.stages.qa.status='locked'});return json(res,200,p)}
  m=url.pathname.match(/^\/api\/themes\/([a-z0-9-]+)\/quick-build$/);
  if(req.method==='POST'&&m){const id=m[1],p1=await updateProject(id,p=>{for(const v of Object.values(p.assetOverrides||{})){v.status='approved';v.approvedAt=now()}p.stages.sheets.approvalMode='asset-pack-v3'});await syncPipelineApproval(id,p1,'sheets');return json(res,200,await buildTheme(id,{capture:false,quick:true}))}
  m=url.pathname.match(/^\/api\/themes\/([a-z0-9-]+)\/approve$/);
  if(req.method==='POST'&&m){
   const id=m[1],b=JSON.parse((await readBody(req,1024*1024)).toString()||'{}'),stage=b.stage,file=b.file;if(!['mood','target','sheets','backgrounds','qa'].includes(stage))return json(res,400,{error:'invalid stage'});if(!['sheets','backgrounds','qa'].includes(stage)&&!safeRel(file))return json(res,400,{error:'file required'});
   const p=await updateProject(id,async p=>{if(stage==='target'&&p.stages.mood.status!=='approved')throw new Error('mood not approved');if(stage==='sheets'&&p.stages.target.status!=='approved')throw new Error('target not approved');if(stage==='backgrounds'&&p.stages.sheets.status!=='approved')throw new Error('asset packs not approved');let info={status:'approved',approvedAt:now(),actor:b.actor||'owner',notes:String(b.notes||'').slice(0,4000)};
    if(stage==='sheets'){for(const v of Object.values(p.assetOverrides||{})){v.status='approved';v.approvedAt=now()}const spec=await loadSlotSpec(),approvedFiles={};for(const [pid,pk] of Object.entries(spec.packs||{})){const fp=await existingPath(projectDir(id),[path.join('source','packs',pk.file),pk.file]);if(!fp)throw new Error('Hiányzó Asset Pack: '+pk.file);const data=await fsp.readFile(fp);approvedFiles[path.relative(projectDir(id),fp).replaceAll('\\','/')]={sha256:sha256(data),size:data.length,kind:'pack',pid}}info.approvedFiles=approvedFiles;info.approvalMode='asset-pack-v3'}
    else if(stage==='backgrounds'){const approvedFiles={};for(const name of BACKGROUND_FILES){const fp=await existingPath(projectDir(id),[path.join('source','backgrounds',name),name]);if(!fp)throw new Error('Hiányzó háttér: '+name);const data=await fsp.readFile(fp);approvedFiles[path.relative(projectDir(id),fp).replaceAll('\\','/')]={sha256:sha256(data),size:data.length}}info.approvedFiles=approvedFiles}
    else if(file){const data=await fsp.readFile(path.join(projectDir(id),file));info={...info,file,sha256:sha256(data)}}
    p.stages[stage]={...p.stages[stage],...info};if(stage==='mood')p.stages.target.status='draft';if(stage==='target'){p.stages.sheets.status='draft';p.stages.sheets.approvalMode='asset-pack-v3';p.stages.backgrounds.status='locked'}if(stage==='sheets'){p.stages.backgrounds.status='draft';p.stages.build.status='none';p.stages.qa.status='locked'}if(stage==='backgrounds'){p.stages.build.status='ready';p.stages.qa.status='locked'}if(stage==='qa')p.stages.release.status='ready'});
   await syncPipelineApproval(id,p,stage,file||null);return json(res,200,await loadProject(id));
  }
  m=url.pathname.match(/^\/api\/themes\/([a-z0-9-]+)\/build$/);if(req.method==='POST'&&m)return json(res,200,await buildTheme(m[1],{capture:true,quick:false}));
  m=url.pathname.match(/^\/api\/themes\/([a-z0-9-]+)\/export$/);if(req.method==='POST'&&m){const a=await makeArchive(m[1]);res.writeHead(200,{'content-type':'application/octet-stream','content-disposition':`attachment; filename="${a.name}"`,'content-length':a.size});return fs.createReadStream(a.path).pipe(res)}
  if(req.method==='POST'&&url.pathname==='/api/import'){const data=await readBody(req,MAX_ARCHIVE),tmp=path.join(ROOT,'.cache','theme-studio-import-'+Date.now()+'.zip');await fsp.mkdir(path.dirname(tmp),{recursive:true});await fsp.writeFile(tmp,data);try{const id=await importArchive(tmp);return json(res,201,await loadProject(id))}finally{await fsp.rm(tmp,{force:true})}}
  m=url.pathname.match(/^\/api\/themes\/([a-z0-9-]+)\/external-sources$/);if(req.method==='GET'&&m){const p=await loadProject(m[1]);return json(res,200,{sources:await externalSources(p)})}
  if(await serveStatic(req,res,url))return;return json(res,404,{error:'not found'});
 }catch(e){console.error(e);return json(res,e.status||500,{error:e.message||String(e),log:e.err||e.out||undefined})}
});
server.listen(PORT,'127.0.0.1',()=>console.log(`Theme Studio: http://127.0.0.1:${PORT}`));
