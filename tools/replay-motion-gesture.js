#!/usr/bin/env node
/* node tools/replay-motion-gesture.js [--slides] [--sensitivity 5] [--settle 5] /path/*.json */
const fs=require('fs');
require('../js/motion-model.js');
const {MotionGestureRecognizer,DEFAULT_PROFILE}=require('../js/motion-gesture.js');
const args=process.argv.slice(2),slides=args.includes('--slides');
function numberOption(name,fallback){const i=args.indexOf(name);if(i<0)return fallback;const n=Number(args[i+1]);if(!Number.isInteger(n)||n<1||n>10)throw Error(name+' must be an integer from 1 to 10');args.splice(i,2);return n}
const sensitivity=numberOption('--sensitivity',5),settle=numberOption('--settle',5);
if(slides)args.splice(args.indexOf('--slides'),1);
if(!args.length){console.error('Add calibration JSON paths.');process.exitCode=2}else{
 const factor=.85-(sensitivity-1)*.05;
 const triggerFactor=Math.max(.6,factor);
 const profile={...DEFAULT_PROFILE,minimumRate:DEFAULT_PROFILE.minimumRate*factor,minimumExcursion:DEFAULT_PROFILE.minimumExcursion*factor,slideAcceleration:DEFAULT_PROFILE.slideAcceleration*factor,triggerRate:DEFAULT_PROFILE.triggerRate*triggerFactor,triggerAcceleration:DEFAULT_PROFILE.triggerAcceleration*triggerFactor,quietMs:40+settle*20};
 const counts={tilts:0,tiltsCorrect:0,tiltsIgnored:0,tiltsWrong:0,slides:0,slidesCorrect:0,slidesIgnored:0,slidesWrong:0,lifts:0,liftsWrong:0,extraSteps:0};
 for(const file of args){
  const data=JSON.parse(fs.readFileSync(file,'utf8'));
  for(const [index,segment] of data.segments.entries()){
   const output=[];
   const recognizer=new MotionGestureRecognizer(profile,(direction,kind)=>output.push({direction,kind}),{allowSlides:slides});
   for(const sample of data.samples.slice(segment.baselineStartSample,segment.endSample)){
    if(sample.source==='orientation')recognizer.orientation(sample,sample.t,sample.screenAngle);
    else if(sample.source==='motion')recognizer.motion({ax:sample.ax,ay:sample.ay,az:sample.az,alpha:sample.rrAlpha,beta:sample.rrBeta,gamma:sample.rrGamma},sample.t,sample.screenAngle);
   }
   if(output.length>1)counts.extraSteps++;
   if(segment.to.startsWith('slide')){
    counts.slides++;
    const direction=segment.to.slice(5).toLowerCase();
    if(output.length===1&&output[0].direction===direction&&output[0].kind==='slide')counts.slidesCorrect++;
    else if(output.length)counts.slidesWrong++;
    else counts.slidesIgnored++;
   }else if(segment.expectedDirection){counts.tilts++;if(output.length===1&&output[0].direction===segment.expectedDirection&&output[0].kind==='tilt')counts.tiltsCorrect++;else if(output.length)counts.tiltsWrong++;else counts.tiltsIgnored++}
   else{counts.lifts++;if(output.length)counts.liftsWrong++}
   if(output.length&&segment.expectedDirection===null&&!segment.to.startsWith('slide')||segment.to.startsWith('slide')&&output.length&&output[0].direction!==segment.to.slice(5).toLowerCase())console.log(file,index,segment.to,'→',output);
  }
 }
 console.log({slidesEnabled:slides,sensitivity,settle,...counts});
}
