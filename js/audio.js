/* ===== AUDIO MANAGER v0.12.31: reliable user-gesture Web Audio ===== */
const AudioManager=(()=>{
 let ctx=null,muted=false,themeAudio=null,ambientTimer=null,unlocked=false,unlockPromise=null,themeBus=null;
 try{muted=localStorage.getItem('billenoSound')==='off'}catch(e){}
 function context(){if(!ctx){const AC=window.AudioContext||window.webkitAudioContext;if(AC)ctx=new AC()}return ctx}
 async function unlock(force=false){
  if(muted&&!force)return false;
  const c=context();if(!c)return false;
  try{if(c.state!=='running')await c.resume()}catch(_){}
  unlocked=c.state==='running';return unlocked;
 }
 function tone(freq,dur,type='sine',gain=.05,when=0,endFreq=null){
  if(muted)return;const c=context();if(!c||c.state!=='running')return;
  const t=c.currentTime+when,o=c.createOscillator(),g=c.createGain();o.type=type;o.frequency.setValueAtTime(freq,t);if(endFreq)o.frequency.exponentialRampToValueAtTime(Math.max(20,endFreq),t+dur);
  g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(Math.max(.0002,gain),t+.012);g.gain.exponentialRampToValueAtTime(.0001,t+dur);o.connect(g).connect(themeBus||c.destination);o.start(t);o.stop(t+dur+.02)
 }
 function stopAmbient(){if(ambientTimer){clearInterval(ambientTimer);ambientTimer=null}if(themeBus&&ctx){themeBus.gain.setTargetAtTime(0,ctx.currentTime,.08);themeBus=null}}
 function note(spec,offset=0){
  const f=Number(spec?.freq),dur=Number(spec?.dur)||.22,vol=Math.min(.07,Math.max(.001,Number(spec?.gain)||.018));
  if(!Number.isFinite(f)||f<30||f>3000)return;
  const when=Math.max(0,Number(spec.at)||0)+offset;
  if(spec.instrument==='harp'){
   tone(f,dur,'triangle',vol,when,f*.998);
   tone(f*2,Math.min(dur*.42,.5),'sine',vol*.24,when);
  }else if(spec.instrument==='bell'){
   tone(f,dur,'sine',vol,when);tone(f*2.01,dur*.6,'sine',vol*.2,when);
  }else tone(f,dur,['sine','triangle','square','sawtooth'].includes(spec.wave)?spec.wave:'sine',vol,when,spec.endFreq||null);
 }
 function ambientPulse(){
  if(muted||!unlocked||!themeAudio?.ambient?.enabled)return;
  if(Array.isArray(themeAudio.music?.notes)){
   themeAudio.music.notes.slice(0,32).forEach(n=>note(n));return;
  }
  const p=themeAudio.profile,vol=Math.min(.12,Math.max(.025,themeAudio.ambient.volume||.055));
  const map={haunted:[110,165],city:[55,82],orbital:[48,96],abyss:[42,63],clockwork:[92,138],neon:[80,120],zen:[98,147]},q=map[p]||[110,165];
  if(p==='microchip'){const notes=[262,330,392,494,392,330,294,370];notes.forEach((n,i)=>tone(n,.18,'square',vol*.82,i*.19));tone(65,1.8,'sine',vol*.55);return}
  if(p==='zen'){tone(98,3.5,'sine',vol*.9);tone(147,2.8,'sine',vol*.48,.5);tone(294,.7,'sine',vol*.18,1.35);return}
  if(p==='neon'){[160,190,240,190].forEach((n,i)=>tone(n,.22,'sawtooth',vol*.34,i*.36));tone(q[0],3.2,'sine',vol*.8);return}
  if(p==='clockwork'){[184,220,277,330].forEach((n,i)=>tone(n,.16,'triangle',vol*.42,i*.31));tone(q[0],3,'sine',vol*.72);return}
  tone(q[0],3.2,'sine',vol*.82);tone(q[1],2.5,'sine',vol*.48,.35)
 }
 function startAmbient(){
  if(ambientTimer){clearInterval(ambientTimer);ambientTimer=null}
  if(muted||!themeAudio?.ambient?.enabled||!unlocked||document.body.dataset.uiContext!=='game')return;
  if(!themeBus&&ctx){themeBus=ctx.createGain();themeBus.gain.value=1;themeBus.connect(ctx.destination)}
  ambientPulse();ambientTimer=setInterval(ambientPulse,themeAudio.music?.loopSeconds?Math.max(4,Math.min(30,themeAudio.music.loopSeconds))*1000:3600)
 }
 async function userGesture(){
  const ok=await unlock(false);if(ok&&themeAudio?.ambient?.enabled&&!ambientTimer)startAmbient();return ok
 }
 function themed(kind,fallback){if(!themeAudio)return fallback();
  const voices=themeAudio.synthesis?.events?.[kind];
  if(Array.isArray(voices)&&voices.length){voices.slice(0,6).forEach(n=>note(n));return}
  const p=themeAudio.profile;const m={haunted:{move:[150,.13,'triangle'],blocked:[82,.16,'square'],freeze:[880,.32,'sine'],exit:[330,.5,'sine'],win:[660,.7,'sine']},city:{move:[105,.12,'sawtooth'],blocked:[240,.16,'square'],freeze:[520,.15,'square'],exit:[740,.3,'sine'],win:[880,.45,'triangle']},orbital:{move:[180,.1,'square'],blocked:[70,.2,'sawtooth'],freeze:[1200,.3,'sine'],exit:[540,.45,'sine'],win:[1080,.55,'sine']},abyss:{move:[75,.2,'sine'],blocked:[52,.28,'sine'],freeze:[760,.4,'sine'],exit:[310,.5,'sine'],win:[620,.7,'sine']},clockwork:{move:[165,.11,'triangle'],blocked:[92,.18,'square'],freeze:[1040,.45,'sine'],exit:[370,.6,'sine'],win:[1110,.85,'sine']},microchip:{move:[330,.08,'square'],blocked:[110,.12,'square'],freeze:[740,.35,'triangle'],exit:[660,.42,'square'],win:[988,.65,'triangle']},zen:{move:[220,.13,'sine'],blocked:[130,.2,'sine'],freeze:[880,.6,'sine'],exit:[440,.7,'sine'],win:[660,.9,'sine']},neon:{move:[125,.1,'sawtooth'],blocked:[62,.2,'square'],freeze:[820,.32,'square'],exit:[520,.55,'sine'],win:[880,.7,'triangle']}}[p]?.[kind];if(!m)return fallback();tone(m[0],m[1],m[2],.045,0,m[0]*.72)}
 function noise(dur=.12,gain=.025,when=0){if(muted)return;const c=context();if(!c||c.state!=='running')return;const len=Math.ceil(c.sampleRate*dur),buf=c.createBuffer(1,len,c.sampleRate),d=buf.getChannelData(0);for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*(1-i/len);const s=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain();f.type='bandpass';f.frequency.value=650;f.Q.value=.7;g.gain.value=gain;s.buffer=buf;s.connect(f).connect(g).connect(c.destination);s.start(c.currentTime+when)}
 return{
  get muted(){return muted},get unlocked(){return unlocked},get state(){return ctx?.state||'not-created'},
  userGesture,
  async toggle(){
   if(muted){
    muted=false;try{localStorage.setItem('billenoSound','on')}catch(e){}
    const ok=await unlock(true);if(ok){tone(620,.16,'sine',.08);startAmbient()}return muted;
   }
   muted=true;try{localStorage.setItem('billenoSound','off')}catch(e){}stopAmbient();return muted;
  },
  setThemeAudio(a){stopAmbient();themeAudio=a||null;if(ctx&&unlocked&&!muted){themeBus=ctx.createGain();themeBus.gain.value=1;themeBus.connect(ctx.destination)}if(unlocked)startAmbient()},stopAmbient,
  move(count=1){themed('move',()=>{noise(.14,Math.min(.018+.004*count,.035));tone(125,.11,'triangle',.022,0,92)})},
  blocked(){themed('blocked',()=>{tone(105,.07,'square',.045);tone(82,.08,'square',.032,.065)})},
  freeze(){themed('freeze',()=>{tone(920,.08,'sine',.028);tone(1320,.1,'sine',.022,.055)})},
  exit(){themed('exit',()=>{tone(440,.11,'sine',.045);tone(660,.13,'sine',.04,.09);tone(990,.17,'sine',.035,.18)})},
  win(){themed('win',()=>{tone(523,.12,'triangle',.035,.16);tone(659,.12,'triangle',.035,.28);tone(784,.24,'triangle',.04,.40)})}
 };
})();
