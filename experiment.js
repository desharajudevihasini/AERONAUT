// Deterministic, engine-independent observable experiment; NEVER hardcoded results.
export function angleDifference(a,b){return ((b-a+540)%360)-180;}
export class Experiment {
 constructor(){this.reset();}
 reset(){this.active=false;this.elapsed=0;this.trials=[];this.origin=null;this.bankAccum=0;this.samples=0;}
 start(s){this.active=true;this.elapsed=0;this.origin={heading:s.heading,alt:s.alt,speed:s.speed};this.bankAccum=0;this.samples=0;}
 update(s,dt){if(!this.active)return null;if(!s.airborne||s.crashed){this.active=false;return null;}
  const tick=Math.max(0,Math.min(dt,12-this.elapsed));this.elapsed+=tick;this.bankAccum+=Math.abs(s.roll)*tick;this.samples+=tick;
  if(this.elapsed<12-1e-7)return null;
  const t={avgBank:this.samples?this.bankAccum/this.samples:0,headingChange:angleDifference(this.origin.heading,s.heading),altitudeChange:s.alt-this.origin.alt,speedChange:s.speed-this.origin.speed,duration:this.elapsed};
  this.trials.push(t);this.active=false;return t;
 }
}
export function experimentInsight(trials){if(trials.length<2)return 'Complete two trials to compare.';
 const a=trials[trials.length-2],b=trials[trials.length-1];const high=Math.abs(a.avgBank)>Math.abs(b.avgBank)?a:b;const low=high===a?b:a;
 if(Math.abs(a.avgBank-b.avgBank)<3)return 'Your bank angles were similar. Try one gentle turn and one steeper turn to compare.';
 const stronger=Math.abs(high.headingChange)>Math.abs(low.headingChange);
 return stronger?'The steeper bank produced more heading change in these trials. Watch whether it also cost altitude or airspeed.':'This run did not turn more with a steeper bank. Compare speed, corrections, and whether you held the angle steadily.';
}
