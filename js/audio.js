/* ===== AUDIO MANAGER: synthesized, no external files ===== */
const AudioManager=(()=>{
 let ctx=null,muted=false,themeAudio=null,ambientTimer=null;
 try{muted=localStorage.getItem('billenoSound')==='off'}catch(e){}
 function ensure(){if(!ctx){const AC=window.AudioContext||window.webkitAudioContext;if(AC)ctx=new AC()}if(ctx&&ctx.state==='suspended')ctx.resume();return ctx}
 function tone(freq,dur,type='sine',gain=.05,when=0,endFreq=null){if(muted)return;const c=ensure();if(!c)return;const t=c.currentTime+when,o=c.createOscillator(),g=c.createGain();o.type=type;o.frequency.setValueAtTime(freq,t);if(endFreq)o.frequency.exponentialRampToValueAtTime(Math.max(20,endFreq),t+dur);g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(gain,t+.012);g.gain.exponentialRampToValueAtTime(.0001,t+dur);o.connect(g).connect(c.destination);o.start(t);o.stop(t+dur+.02)}
 function stopAmbient(){if(ambientTimer){clearInterval(ambientTimer);ambientTimer=null}}
 function startAmbient(){stopAmbient();if(muted||!themeAudio?.ambient?.enabled)return;const p=themeAudio.profile,vol=Math.min(.04,themeAudio.ambient.volume||.02);const pulse=()=>{if(muted)return;const map={haunted:[110,165],city:[55,82],orbital:[48,96],abyss:[42,63],clockwork:[46,92],neon:[40,80]},q=map[p]||[70,105];tone(q[0],2.8,'sine',vol);tone(q[1],2.2,'sine',vol*.45,.35)};pulse();ambientTimer=setInterval(pulse,4200)}
 function themed(kind,fallback){if(!themeAudio)return fallback();const p=themeAudio.profile;const m={haunted:{move:[150,.13,'triangle'],blocked:[82,.16,'square'],freeze:[880,.32,'sine'],exit:[330,.5,'sine'],win:[660,.7,'sine']},city:{move:[105,.12,'sawtooth'],blocked:[240,.16,'square'],freeze:[520,.15,'square'],exit:[740,.3,'sine'],win:[880,.45,'triangle']},orbital:{move:[180,.1,'square'],blocked:[70,.2,'sawtooth'],freeze:[1200,.3,'sine'],exit:[540,.45,'sine'],win:[1080,.55,'sine']},abyss:{move:[75,.2,'sine'],blocked:[52,.28,'sine'],freeze:[760,.4,'sine'],exit:[310,.5,'sine'],win:[620,.7,'sine']},clockwork:{move:[165,.11,'triangle'],blocked:[92,.18,'square'],freeze:[1040,.45,'sine'],exit:[370,.6,'sine'],win:[1110,.85,'sine']},neon:{move:[125,.1,'sawtooth'],blocked:[62,.2,'square'],freeze:[820,.32,'square'],exit:[520,.55,'sine'],win:[880,.7,'triangle']}}[p]?.[kind];if(!m)return fallback();tone(m[0],m[1],m[2],.04,0,m[0]*.72)}
 function noise(dur=.12,gain=.025,when=0){if(muted)return;const c=ensure();if(!c)return;const len=Math.ceil(c.sampleRate*dur),buf=c.createBuffer(1,len,c.sampleRate),d=buf.getChannelData(0);for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*(1-i/len);const s=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain();f.type='bandpass';f.frequency.value=650;f.Q.value=.7;g.gain.value=gain;s.buffer=buf;s.connect(f).connect(g).connect(c.destination);s.start(c.currentTime+when)}
 return{
  get muted(){return muted},toggle(){muted=!muted;try{localStorage.setItem('billenoSound',muted?'off':'on')}catch(e){}if(!muted){tone(620,.08,'sine',.035);startAmbient()}else stopAmbient();return muted},
  setThemeAudio(a){themeAudio=a||null;startAmbient()},stopAmbient,
  move(count=1){themed('move',()=>{noise(.14,Math.min(.018+.004*count,.035));tone(125,.11,'triangle',.022,0,92)})},
  blocked(){themed('blocked',()=>{tone(105,.07,'square',.045);tone(82,.08,'square',.032,.065)})},
  freeze(){themed('freeze',()=>{tone(920,.08,'sine',.028);tone(1320,.1,'sine',.022,.055)})},
  exit(){themed('exit',()=>{tone(440,.11,'sine',.045);tone(660,.13,'sine',.04,.09);tone(990,.17,'sine',.035,.18)})},
  win(){themed('win',()=>{tone(523,.12,'triangle',.035,.16);tone(659,.12,'triangle',.035,.28);tone(784,.24,'triangle',.04,.40)})}
 };
})();
