/* ===== AUDIO MANAGER: synthesized, no external files ===== */
const AudioManager=(()=>{
 let ctx=null,muted=false;
 try{muted=localStorage.getItem('billenoSound')==='off'}catch(e){}
 function ensure(){if(!ctx){const AC=window.AudioContext||window.webkitAudioContext;if(AC)ctx=new AC()}if(ctx&&ctx.state==='suspended')ctx.resume();return ctx}
 function tone(freq,dur,type='sine',gain=.05,when=0,endFreq=null){if(muted)return;const c=ensure();if(!c)return;const t=c.currentTime+when,o=c.createOscillator(),g=c.createGain();o.type=type;o.frequency.setValueAtTime(freq,t);if(endFreq)o.frequency.exponentialRampToValueAtTime(Math.max(20,endFreq),t+dur);g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(gain,t+.012);g.gain.exponentialRampToValueAtTime(.0001,t+dur);o.connect(g).connect(c.destination);o.start(t);o.stop(t+dur+.02)}
 function noise(dur=.12,gain=.025,when=0){if(muted)return;const c=ensure();if(!c)return;const len=Math.ceil(c.sampleRate*dur),buf=c.createBuffer(1,len,c.sampleRate),d=buf.getChannelData(0);for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*(1-i/len);const s=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain();f.type='bandpass';f.frequency.value=650;f.Q.value=.7;g.gain.value=gain;s.buffer=buf;s.connect(f).connect(g).connect(c.destination);s.start(c.currentTime+when)}
 return{
  get muted(){return muted},toggle(){muted=!muted;try{localStorage.setItem('billenoSound',muted?'off':'on')}catch(e){}if(!muted)tone(620,.08,'sine',.035);return muted},
  move(count=1){noise(.14,Math.min(.018+.004*count,.035));tone(125,.11,'triangle',.022,0,92)},
  blocked(){tone(105,.07,'square',.045);tone(82,.08,'square',.032,.065)},
  freeze(){tone(920,.08,'sine',.028);tone(1320,.1,'sine',.022,.055)},
  exit(){tone(440,.11,'sine',.045);tone(660,.13,'sine',.04,.09);tone(990,.17,'sine',.035,.18)},
  win(){tone(523,.12,'triangle',.035,.16);tone(659,.12,'triangle',.035,.28);tone(784,.24,'triangle',.04,.40)}
 };
})();
