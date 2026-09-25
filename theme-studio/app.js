const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
let token='',themes=[],current=null,tab='overview',previewState={size:'5x8',difficulty:'5'};

async function api(url,opt={}){
 const headers=new Headers(opt.headers||{});
 if(opt.method&&!['GET','HEAD'].includes(opt.method.toUpperCase()))headers.set('x-theme-studio-token',token);
 const r=await fetch(url,{...opt,headers});
 if(!r.ok){let e={};try{e=await r.json()}catch{};throw new Error(e.error||r.statusText)}
 return r.headers.get('content-type')?.includes('json')?r.json():r;
}
async function boot(){token=(await fetch('/api/session',{cache:'no-store'}).then(r=>r.json())).token;await refresh()}
async function refresh(){
 themes=(await api('/api/themes')).themes;renderCatalog();
 if(current){current=await api('/api/themes/'+current.id);renderProject()}
}
function renderCatalog(){
 const c=$('#catalog');c.innerHTML='';
 for(const t of themes){
  const d=document.createElement('button');d.type='button';d.className='theme-card'+(current?.id===t.id?' active':'');
  const b=document.createElement('b');b.textContent=t.name;const code=document.createElement('code');code.textContent=t.id;const small=document.createElement('small');small.textContent=t.computedStage;
  d.append(b,code,small);d.onclick=async()=>{current=await api('/api/themes/'+t.id);tab='overview';renderCatalog();renderProject()};c.append(d);
 }
}
const stages=['MOOD','TARGET','ASSETS','BACKGROUNDS','BUILD','QA','RELEASE'];
function stagebar(){
 const cur=current.computedStage;let passed=true;
 return stages.map(s=>{let cl='stage ';if(s===cur){cl+='current';passed=false}else if(passed)cl+='done';else cl+='locked';return `<span class="${cl}">${s}</span>`}).join('');
}
function renderProject(){
 const w=$('#workspace');w.innerHTML='';const f=$('#projectTemplate').content.cloneNode(true);
 $('[data-k=name]',f).textContent=current.name;$('[data-k=id]',f).textContent=current.id;$('[data-k=stagebar]',f).innerHTML=stagebar();
 $('[data-act=export]',f).onclick=exportProject;
 $$('[data-tab]',f).forEach(b=>{b.onclick=()=>{tab=b.dataset.tab;renderProject()};if(b.dataset.tab===tab)b.classList.add('active')});
 w.append(f);renderPanel();
}
function panel(html){$('[data-k=panel]').innerHTML=html}
function promptCard(stage){
 const p=current.stages[stage]||{prompts:[]},prompts=p.prompts||[];
 return `<div class="card"><h3>Prompt változatok</h3><div class="prompt-list">${prompts.map(x=>`<div class="prompt"><b>${esc(x.id)}</b> · ${esc(x.createdAt)}<br>${esc(x.text)}</div>`).join('')||'<span class="warn">Még nincs prompt.</span>'}</div><p><textarea id="promptText" placeholder="Új prompt..."></textarea></p><button id="addPrompt">Prompt mentése</button></div>`;
}
function renderPanel(){
 if(tab==='overview')return overview();
 if(tab==='mood')return stageImage('mood','Hangulatterv','mood');
 if(tab==='target')return stageImage('target','Render célkép','target');
 if(tab==='assets')return assets();
 if(tab==='backgrounds')return backgrounds();
 if(tab==='playground')return playground();
 if(tab==='build')return build();
}
function overview(){
 const ov=Object.values(current.assetOverrides||{}),review=ov.filter(x=>x.status==='review').length;
 panel(`<div class="card"><h3>Asset-first Theme Designer</h3><dl class="meta"><dt>Állapot</dt><dd>${esc(current.computedStage)}</dd><dt>Projektverzió</dt><dd>${current.projectVersion}</dd><dt>Rigid renderer</dt><dd><b>${esc(current.renderer?.rigid||'material')}</b></dd><dt>Egyedi override</dt><dd>${ov.length} db${review?' · <span class="warn">'+review+' ellenőrzésre vár</span>':''}</dd><dt>Leírás</dt><dd>${esc(current.description||'')}</dd></dl></div>
 <div class="card"><h3>Normál munkafolyamat</h3><p>Nem kell sok kis képet feltölteni. A kiindulás <b>5 Asset Pack + 2 háttér</b>. A Studio automatikusan kis assetekre bontja őket. Csak azt az egy kis PNG-t kell külön lecserélni, amelyik nem tetszik.</p><p>Forrás-prioritás: <b>egyedi override → packból kivágott asset → legacy fallback</b>.</p></div>
 <div class="card"><h3>Gyors iteráció</h3><p>Példa: ha a <code>wall</code> nem egyezik a látványtervvel, az Asset Packok fülön csak a wall PNG-t cseréld. Ezután a <b>Jóváhagyás + gyors build</b> újraépíti a runtime témát, a Próbajáték pedig egy kattintással újratölthető.</p></div>`);
}
async function addPrompt(stage){const text=$('#promptText')?.value.trim();if(!text)return;await api('/api/themes/'+current.id+'/prompts',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({stage,text})});await refresh()}
function stageImage(stage,title,folder){
 const s=current.stages[stage]||{},accepted=s.file;
 panel(promptCard(stage)+`<div class="card"><h3>${title}</h3>${accepted?`<img class="large-preview" src="/project-file/${current.id}/${encodeURIComponent(accepted)}?v=${current.projectVersion}"><p class="ok">✓ ${esc(accepted)}</p>`:''}<input type="file" id="fileUp" accept=".png,.jpg,.jpeg,.webp"><button id="uploadFile">Feltöltés</button><span id="uploadStatus"></span></div><div class="card"><h3>Jóváhagyás</h3><p>Státusz: <b>${esc(s.status)}</b></p><button id="approveStage">Aktuális feltöltés elfogadása</button></div>`);
 $('#addPrompt').onclick=()=>addPrompt(stage);
 $('#uploadFile').onclick=async()=>{const f=$('#fileUp').files[0];if(!f)return;const ext=f.name.match(/\.[^.]+$/)?.[0]||'.png',rel=`${folder}/${Date.now()}${ext}`;await api('/api/themes/'+current.id+'/upload/'+encodeURIComponent(rel),{method:'PUT',body:f});current._lastUpload={stage,file:rel};$('#uploadStatus').textContent=' Feltöltve: '+rel};
 $('#approveStage').onclick=async()=>{const file=current._lastUpload?.stage===stage?current._lastUpload.file:accepted;if(!file)return alert('Előbb tölts fel egy képet.');await api('/api/themes/'+current.id+'/approve',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({stage,file,actor:'owner'})});await refresh()};
}
function assetLabel(s){return ({cell:'Mező',wall:'Fix akadály',ball:'Golyó',brick:'Egycellás mozgó elem',exit:'Kijárat',cue:'Irányjel',freeze:'Freeze jel',rigid:'Festett rigid shape',tileset:'Rigid anyagminta',frame:'Pályakeret',zone:'Vezérlősáv',chrome:'Chrome/UI',control:'UI primitív'})[s.role]||s.role}
function assets(){
 const packs=current.packFiles||{},defs=current.themeKitSpec?.packs||{},slots=current.themeKitSpec?.slots||[],files=current.assetFiles||{},overrides=current.assetOverrides||{};
 const missingPacks=Object.keys(defs).filter(id=>!packs[id]?.exists);
 const cards=Object.entries(defs).map(([pid,pk])=>{const f=packs[pid]||{};return `<div class="drop pack-card"><b>${esc(pk.title||pid)}</b><small><code>${esc(pk.file)}</code> · ${pk.size?.join('×')||''}</small>${f.exists?`<img src="/project-file/${current.id}/${esc(f.file)}?v=${esc(f.sha256)}">`:''}<span class="${f.exists?'ok':'bad'}">● ${f.exists?'FELTÖLTVE':'HIÁNYZIK'}</span><input type="file" data-pack="${pid}" accept=".png"><button data-upload-pack="${pid}">${f.exists?'Pack cseréje':'Pack feltöltése'}</button></div>`}).join('');
 const assetCard=s=>{const f=files[s.id]||{},ov=overrides[s.id],src=f.source==='override'?'EGYEDI OVERRIDE':f.source==='pack'?'PACKBÓL':'HIÁNYZIK',cl=f.exists?(f.source==='override'?'ok':'warn'):'bad';return `<div class="asset-preview ${s.role==='control'?'ui-asset':''}"><div class="asset-title"><b>${esc(s.id)}</b><small>${esc(assetLabel(s))} · ${s.output?.join('×')||''}</small></div>${f.exists?`<div class="asset-image-wrap"><img src="/project-file/${current.id}/${esc(f.file)}?v=${esc(f.sha256)}">${s.role==='control'?'<span class="sample-icon">'+({'button-square':'💡','button-round':'❄','button-menu':'☰','button-wide':'Következő','score-box':'164'})[s.id]+'</span>':''}</div>`:''}<span class="${cl}">● ${src}${ov?.status==='review'?' · ellenőrzésre vár':''}</span><div class="override-row"><input type="file" data-asset="${s.id}" accept=".png"><button data-upload-asset="${s.id}">Csere PNG</button></div>${f.source==='override'?'<button class="danger-lite" data-delete-asset="'+s.id+'">Override törlése</button>':''}</div>`};
 panel(promptCard('sheets')+`<div class="card"><h3>5 forrás Asset Pack</h3><p>Ez a normál belépési pont. Feltöltés után a Studio automatikusan feldarabolja a packot.</p><div class="pack-grid">${cards}</div></div>
 <div class="card"><h3>Kis assetek · gyors javítás</h3><p>Csak azt a konkrét elemet cseréld, amelyik nem tetszik. Az eredeti pack megmarad, az override később egy gombbal törölhető.</p><div class="asset-grid">${slots.filter(x=>x.required!==false).map(assetCard).join('')}</div></div>
 <details class="card"><summary>Opcionális festett rigid shape-ek</summary><div class="asset-grid">${slots.filter(x=>x.required===false).map(assetCard).join('')}</div></details>
 <div class="card quick-build"><h3>Iteráció</h3>${missingPacks.length?'<p class="bad">Hiányzó pack: '+missingPacks.map(x=>esc(defs[x].file)).join(', ')+'</p>':'<p class="ok">✓ Minden pack megvan.</p>'}<button id="approveAssets" ${missingPacks.length?'disabled':''}>Asset Packok jóváhagyása</button> <button id="quickBuild" ${current.stages.backgrounds?.status!=='approved'?'disabled':''}>⚡ Jóváhagyás + gyors build</button><span id="quickStatus"></span></div>`);
 $('#addPrompt').onclick=()=>addPrompt('sheets');
 $$('[data-upload-pack]').forEach(b=>b.onclick=async()=>{const pid=b.dataset.uploadPack,pk=defs[pid],f=$('input[data-pack="'+pid+'"]').files[0];if(!f)return;try{b.disabled=true;b.textContent='Feltöltés és kivágás…';await api('/api/themes/'+current.id+'/upload/'+encodeURIComponent('source/packs/'+pk.file),{method:'PUT',body:f});await refresh()}catch(e){alert(e.message);b.disabled=false}});
 $$('[data-upload-asset]').forEach(b=>b.onclick=async()=>{const id=b.dataset.uploadAsset,f=$('input[data-asset="'+id+'"]').files[0];if(!f)return;try{await api('/api/themes/'+current.id+'/assets/'+id,{method:'PUT',body:f});await refresh()}catch(e){alert(e.message)}});
 $$('[data-delete-asset]').forEach(b=>b.onclick=async()=>{if(!confirm('Visszaálljon a packból kivágott '+b.dataset.deleteAsset+'?'))return;await api('/api/themes/'+current.id+'/assets/'+b.dataset.deleteAsset,{method:'DELETE'});await refresh()});
 $('#approveAssets').onclick=async()=>{try{await api('/api/themes/'+current.id+'/approve',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({stage:'sheets',actor:'owner'})});await refresh()}catch(e){alert(e.message)}};
 $('#quickBuild').onclick=async()=>{const el=$('#quickStatus');try{el.textContent=' Építés…';await api('/api/themes/'+current.id+'/quick-build',{method:'POST'});el.textContent=' Kész.';await refresh()}catch(e){el.textContent=' Hiba: '+e.message}};
}
function backgrounds(){
 const s=current.stages.backgrounds||{},files=current.backgroundFiles||{},defs=[['bg-portrait.png','Álló háttér','1080×1620'],['bg-landscape.png','Fekvő háttér','1620×1080']];
 const cards=defs.map(([n,label,size])=>{const f=files[n]||{};return `<div class="drop background-card"><b>${label}</b><small>${n} · ${size}</small>${f.exists?`<img src="/project-file/${current.id}/${esc(f.file)}?v=${esc(f.sha256)}">`:''}<span class="${f.exists?'ok':'bad'}">● ${f.exists?'FELTÖLTVE':'HIÁNYZIK'}</span><input type="file" data-bg="${n}" accept=".png"><button data-upload-bg="${n}">${f.exists?'Csere':'Feltöltés'}</button></div>`}).join('');
 const missing=defs.filter(([n])=>!files[n]?.exists);
 panel(promptCard('backgrounds')+`<div class="card"><h3>Külön hátterek</h3><div class="background-grid">${cards}</div><button id="approveBackgrounds" ${missing.length?'disabled':''}>Hátterek jóváhagyása</button></div>`);
 $('#addPrompt').onclick=()=>addPrompt('backgrounds');
 $$('[data-upload-bg]').forEach(b=>b.onclick=async()=>{const n=b.dataset.uploadBg,f=$('input[data-bg="'+n+'"]').files[0];if(!f)return;try{await api('/api/themes/'+current.id+'/upload/'+encodeURIComponent('source/backgrounds/'+n),{method:'PUT',body:f});await refresh()}catch(e){alert(e.message)}});
 $('#approveBackgrounds').onclick=async()=>{await api('/api/themes/'+current.id+'/approve',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({stage:'backgrounds',actor:'owner'})});await refresh()};
}
function previewUrl(){return `/game/index.html?themeStudio=${encodeURIComponent(current.id)}&themeStudioSize=${encodeURIComponent(previewState.size)}&themeStudioD=${encodeURIComponent(previewState.difficulty)}&_=${Date.now()}`}
function playground(){
 const ready=current.stages.build?.status==='success';
 panel(`<div class="card playground-tools"><h3>Valódi játékmotoros Próbajáték</h3><div class="row"><label>Méret <select id="pgSize"><option>5x6</option><option>5x7</option><option selected>5x8</option><option>4x8</option><option>5</option></select></label><label>Nehézség <select id="pgD">${Array.from({length:10},(_,i)=>'<option value="'+(i+1)+'">D'+(i+1)+'</option>').join('')}</select></label><button id="reloadGame" ${ready?'':'disabled'}>↻ Próbajáték újratöltése</button><button id="quickBuildPg" ${current.stages.backgrounds?.status==='approved'?'':'disabled'}>⚡ Gyors build + újratöltés</button></div><p>${ready?'<span class="ok">✓ Runtime téma elkészült.</span>':'<span class="warn">Előbb buildeld a témát.</span>'} A keretben ugyanaz a GGrid motor fut, mint a játékban.</p></div><div class="playground-frame-wrap">${ready?`<iframe id="gamePreview" title="GGrid Theme Preview" src="${previewUrl()}"></iframe>`:'<div class="empty-preview">Nincs build.</div>'}</div>`);
 $('#pgSize').value=previewState.size;$('#pgD').value=previewState.difficulty;
 $('#pgSize').onchange=e=>previewState.size=e.target.value;$('#pgD').onchange=e=>previewState.difficulty=e.target.value;
 $('#reloadGame').onclick=()=>{$('#gamePreview').src=previewUrl()};
 $('#quickBuildPg').onclick=async()=>{try{const b=$('#quickBuildPg');b.disabled=true;b.textContent='Építés…';await api('/api/themes/'+current.id+'/quick-build',{method:'POST'});current=await api('/api/themes/'+current.id);renderProject()}catch(e){alert(e.message)}};
}
function build(){
 const b=current.stages.build||{},q=current.stages.qa||{},h=b.history?.at(-1);
 panel(`<div class="card"><h3>Teljes Build + QA</h3><button id="buildBtn">▶ TÉMA ÉPÍTÉSE + SCREENSHOT QA</button><p>Build státusz: <b>${esc(b.status)}</b></p><div class="log">${esc(h?.log||'Még nincs build.')}</div></div><div class="card"><h3>QA</h3><p>Státusz: <b>${esc(q.status)}</b></p>${h?.qaDir?`<p><code>${esc(h.qaDir)}</code></p><div class="qa-preview"><img src="/project-file/${current.id}/${esc(h.qaDir)}/compare.png?v=${current.projectVersion}" onerror="this.style.display='none'"></div>`:''}<button id="qaApprove" ${q.status!=='review'?'disabled':''}>✓ TÉMA ELFOGADÁSA</button></div>`);
 $('#buildBtn').onclick=async()=>{try{await api('/api/themes/'+current.id+'/build',{method:'POST'});await refresh()}catch(e){alert(e.message);await refresh()}};
 $('#qaApprove').onclick=async()=>{await api('/api/themes/'+current.id+'/approve',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({stage:'qa',actor:'owner'})});await refresh()};
}
async function exportProject(){
 const r=await api('/api/themes/'+current.id+'/export',{method:'POST'}),blob=await r.blob(),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=r.headers.get('content-disposition')?.match(/filename="([^"]+)/)?.[1]||current.id+'.ggrid-theme-project';a.click();URL.revokeObjectURL(a.href);
}
async function newProject(){
 const name=prompt('Téma neve:');if(!name)return;const id=prompt('Theme ID:');if(!id)return;
 current=await api('/api/themes',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name,id,strict:true})});tab='overview';await refresh();
}
async function importProject(file){if(!file)return;current=await api('/api/import',{method:'POST',body:file});tab='overview';await refresh()}
$('#newBtn').onclick=newProject;$('#importBtn').onclick=()=>$('#importFile').click();$('#importFile').onchange=async()=>{try{await importProject($('#importFile').files[0])}catch(e){alert('Import hiba: '+e.message)}};
boot().catch(e=>{$('#workspace').textContent='Theme Studio indítási hiba: '+e.message;console.error(e)});
