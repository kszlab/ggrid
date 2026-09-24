#!/usr/bin/env node
/* node tools/replay-motion-gesture.js /path/to/calibration-files/*.json */
const fs=require('fs');
require('../js/motion-model.js');
const {MotionGestureRecognizer,DEFAULT_PROFILE}=require('../js/motion-gesture.js');
const files=process.argv.slice(2);
if(!files.length){console.error('Add calibration JSON paths.');process.exitCode=2}else{
 const counts={total:0,tilts:0,tiltsCorrect:0,negatives:0,falseArrows:0,slideCount:0,slideFalseArrows:0};
 for(const file of files){
  const data=JSON.parse(fs.readFileSync(file,'utf8'));
  for(const [index,segment] of data.segments.entries()){
   const output=[];
   const recognizer=new MotionGestureRecognizer(DEFAULT_PROFILE,direction=>output.push(direction));
   for(const sample of data.samples.slice(segment.baselineStartSample,segment.endSample)){
    if(sample.source==='orientation')recognizer.orientation(sample,sample.t,sample.screenAngle);
    else if(sample.source==='motion')recognizer.motion({ax:sample.ax,ay:sample.ay,az:sample.az,alpha:sample.rrAlpha,beta:sample.rrBeta,gamma:sample.rrGamma},sample.t,sample.screenAngle);
   }
   counts.total++;
   if(segment.expectedDirection){counts.tilts++;if(output.length===1&&output[0]===segment.expectedDirection)counts.tiltsCorrect++}
   else{counts.negatives++;if(output.length)counts.falseArrows++;if(segment.to.startsWith('slide')){counts.slideCount++;if(output.length)counts.slideFalseArrows++}}
   if(output.length!==(segment.expectedDirection?1:0)||segment.expectedDirection&&output[0]!==segment.expectedDirection)console.log(file,index,segment.to,'→',output.join(',')||'ignored');
  }
 }
 console.log(counts);
}
