// Deterministic educational telemetry recorder; no live recording inputs are stored outside the browser.
const KEYS=['x','z','alt','speed','heading','pitch','roll','verticalSpeed','throttle','airbrake','g','aoa','engineThrust','dragForce','liftFactor','gear','airborne','stall','crashed','engine','brakes'];
export const sampleTelemetry=(t,s)=>Object.fromEntries([['t',t],...KEYS.map(k=>[k,s[k]])]);
export class FlightRecorder{
 constructor(maxFrames=36000){this.maxFrames=maxFrames;this.frames=[];this.recording=false;this.origin=null;}
 start(){this.frames=[];this.origin=null;this.recording=true;}
 add(t,s){if(!this.recording||this.frames.length>=this.maxFrames)return false; if(this.origin===null)this.origin=t;this.frames.push(sampleTelemetry(t-this.origin,s));return true;}
 stop(){this.recording=false;this.origin=null;}
 duration(){return this.frames.at(-1)?.t??0;}
 at(t){const f=this.frames;if(!f.length)return {};if(t<=0)return {...f[0]};if(t>=this.duration())return {...f.at(-1)};let lo=0,hi=f.length-1;while(lo+1<hi){const mid=(lo+hi)>>1;if(f[mid].t<=t)lo=mid;else hi=mid;}const a=f[lo],b=f[hi],r=(t-a.t)/(b.t-a.t);const out={...a};for(const k of ['x','z','alt','speed','heading','pitch','roll','verticalSpeed','throttle','airbrake','g','aoa','engineThrust','dragForce','liftFactor'])out[k]=a[k]+(b[k]-a[k])*r;return out;}
}
export function computeDebrief(frames){if(!frames.length)return {duration:0,maxAltitude:0,maxSpeed:0,distance:0};let distance=0;for(let i=1;i<frames.length;i++)distance+=Math.hypot(frames[i].x-frames[i-1].x,frames[i].z-frames[i-1].z);return {duration:frames.at(-1).t,maxAltitude:Math.max(...frames.map(f=>f.alt)),maxSpeed:Math.max(...frames.map(f=>f.speed)),distance};}
