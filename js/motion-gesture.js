/* One short phone tilt produces at most one direction. No external model or
   calibration service is required; a future on-device calibration supplies a
   validated profile in the schema documented below. */
(function(root){
 'use strict';
 const DIRECTIONS=['right','left','down','up'];
 const DEFAULT_PROFILE=Object.freeze({
  version:1,coordinateSystem:'screen',sensorMode:'gyro',
  // Fixed screen axes: +x right, +y down. Calibration cannot reverse them.
  gyroAxes:{x:{alpha:0,beta:1,gamma:0},y:{alpha:1,beta:0,gamma:0}},
  orientationAxes:{x:{beta:0,gamma:1},y:{beta:1,gamma:0}},
  minimumRate:100,minimumExcursion:11,dominance:1.45,
  triggerAcceleration:2.2,triggerRate:60,quietAcceleration:.85,quietRate:23,
  quietMs:170,maxGestureMs:1700,minSamples:5,
  // Require an orientation excursion as independent evidence of a tilt.
  orientationRequired:true
 });
 function finite(v){return typeof v==='number'&&Number.isFinite(v)}
 function rotate(x,y,angle){const a=((angle%360)+360)%360;
  if(a===90)return{x:y,y:-x};if(a===180)return{x:-x,y:-y};if(a===270)return{x:-y,y:x};return{x,y}}
 function delta(a){return ((a+540)%360)-180}
 function vector(raw,axes){return{x:Object.entries(axes.x).reduce((v,[k,w])=>v+(raw[k]||0)*w,0),y:Object.entries(axes.y).reduce((v,[k,w])=>v+(raw[k]||0)*w,0)}}
 function validateProfile(p,forStorage=true){
  if(!p||p.version!==1||p.coordinateSystem!=='screen'||p.sensorMode!=='gyro')return false;
  for(const name of ['gyroAxes','orientationAxes'])for(const axis of ['x','y']){
   if(!p[name]?.[axis])return false;
   for(const k of (name==='gyroAxes'?['alpha','beta','gamma']:['beta','gamma']))if(p[name][axis][k]!==DEFAULT_PROFILE[name][axis][k])return false;
  }
  for(const [k,lo,hi] of [['minimumRate',forStorage?70:35,forStorage?140:260],['minimumExcursion',forStorage?7:3,forStorage?18:35],['dominance',1.2,1.8],['triggerAcceleration',1.5,3.2],['triggerRate',45,85],['quietAcceleration',.5,1.3],['quietRate',15,33],['quietMs',130,230],['maxGestureMs',1300,2100],['minSamples',4,9]])if(!finite(p[k])||p[k]<lo||p[k]>hi)return false;
  return p.orientationRequired===true;
 }
 class MotionGestureRecognizer{
  constructor(profile=DEFAULT_PROFILE,onDirection=()=>{}){
   if(!validateProfile(profile,false))throw Error('Érvénytelen mozgásprofil');
   this.profile=profile;this.onDirection=onDirection;this.reset();
  }
  reset(){this.history=[];this.gesture=null;this.lastOrientation=null;this.lastMotion=null;this.suppressUntil=0}
  orientation(raw,t,angle=0){
   if(!finite(raw.beta)||!finite(raw.gamma)||!finite(t))return;
   const o={beta:raw.beta,gamma:raw.gamma,t,angle};this.lastOrientation=o;
   this.history.push(o);while(this.history.length&&this.history[0].t<t-650)this.history.shift();
   const g=this.gesture;if(!g||g.angle!==angle)return;
   // The baseline precedes the acceleration trigger. Never subtract the final
   // pose: players instinctively return to their original holding position.
   if(!g.baseline)return;
   const change=vector({beta:delta(o.beta-g.baseline.beta),gamma:delta(o.gamma-g.baseline.gamma)},this.profile.orientationAxes);
   const v=rotate(change.x,change.y,angle);
   if(t-g.start<=650){g.exc.right=Math.max(g.exc.right,v.x);g.exc.left=Math.max(g.exc.left,-v.x);g.exc.down=Math.max(g.exc.down,v.y);g.exc.up=Math.max(g.exc.up,-v.y)}
  }
  motion(raw,t,angle=0){
   if(!finite(t)||![raw.ax,raw.ay,raw.az,raw.alpha,raw.beta,raw.gamma].every(finite))return;
   if(this.lastMotion!==null&&(t<=this.lastMotion||t-this.lastMotion>450))this.gesture=null;
   const dt=this.lastMotion===null?0:Math.max(0,Math.min(60,t-this.lastMotion));this.lastMotion=t;
   const accel=Math.hypot(raw.ax,raw.ay,raw.az),v0=vector(raw,this.profile.gyroAxes),v=rotate(v0.x,v0.y,angle),rate=Math.hypot(v.x,v.y);
   const p=this.profile;let g=this.gesture;
   if(!g){
    if(t<this.suppressUntil)return;
    if(accel<p.triggerAcceleration&&rate<p.triggerRate)return;
    const eligible=this.history.filter(o=>o.angle===angle&&o.t<=t-45&&o.t>=t-500);
    const baseline=eligible.length?eligible[Math.floor(eligible.length/2)]:null;
    g=this.gesture={start:t,angle,baseline,exc:{right:0,left:0,up:0,down:0},peaks:{right:0,left:0,up:0,down:0},impulse:{right:0,left:0,up:0,down:0},first:{right:0,left:0,up:0,down:0,az:0},firstCount:0,azPeak:0,xyPeak:0,count:0,quietAt:null};
   }
   if(g.angle!==angle){this.gesture=null;return}
   g.count++;
   g.azPeak=Math.max(g.azPeak,Math.abs(raw.az));g.xyPeak=Math.max(g.xyPeak,Math.hypot(raw.ax,raw.ay));
   if(t-g.start<160){g.firstCount++;g.first.right+=v.x;g.first.left-=v.x;g.first.down+=v.y;g.first.up-=v.y;g.first.az+=raw.az}
   // The outward pulse is generally in the first 450 ms. Keeping signed
   // maxima means the return movement cannot cancel its direction.
   if(t-g.start<=450){for(const [name,value] of [['right',v.x],['left',-v.x],['down',v.y],['up',-v.y]]){
    g.peaks[name]=Math.max(g.peaks[name],value);
    if(value>0)g.impulse[name]+=value*dt/1000;
   }}
   const quiet=accel<p.quietAcceleration&&rate<p.quietRate;
   if(!quiet)g.quietAt=null;else if(g.quietAt===null)g.quietAt=t;
   if(t-g.start>=p.maxGestureMs||g.quietAt!==null&&t-g.quietAt>=p.quietMs&&t-g.start>=180){
    this.gesture=null;this.suppressUntil=t+260;const direction=this.classify(g);
    if(direction)this.onDirection(direction);
   }
  }
  classify(g){
   const p=this.profile;if(g.count<p.minSamples||!g.baseline)return null;
   const qualified=DIRECTIONS.map(dir=>{
    const other=dir==='right'||dir==='left'?'y':'x';const otherPeak=other==='x'?Math.max(g.peaks.right,g.peaks.left):Math.max(g.peaks.up,g.peaks.down);
    return{dir,rate:g.peaks[dir],exc:g.exc[dir],impulse:g.impulse[dir],otherPeak};
   }).filter(c=>c.rate>=p.minimumRate&&c.exc>=p.minimumExcursion&&c.rate>=p.dominance*c.otherPeak);
   if(!qualified.length)return null;
   const n=Math.max(1,g.firstCount),keys=['right','left','up','down'];
   const values=[...keys.map(k=>g.peaks[k]),...keys.map(k=>g.exc[k]),g.first.right/n,g.first.up/n,g.first.az/n,g.azPeak,g.xyPeak,g.count,g.firstCount];
   const predicted=root.MotionGestureModel?.classify(values);
   return qualified.some(c=>c.dir===predicted)?predicted:null;
  }
 }
 root.MotionGestureRecognizer=MotionGestureRecognizer;
 root.MotionGestureDefaultProfile=DEFAULT_PROFILE;
 root.isMotionGestureProfile=validateProfile;
 if(typeof module!=='undefined'&&module.exports)module.exports={MotionGestureRecognizer,DEFAULT_PROFILE,validateProfile};
})(typeof window!=='undefined'?window:globalThis);
