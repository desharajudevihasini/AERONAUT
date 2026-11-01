import assert from 'node:assert/strict';
import {initial,step} from './src/flight.js';
import {demoUpdate} from './src/demo.js';
let s=initial(),t=0,peak=0,takeoff=null;
for(let i=0;i<9000;i++){
 const dt=.025;t+=dt;demoUpdate(s,t);step(s,dt);peak=Math.max(peak,s.alt);
 if(s.airborne&&takeoff===null)takeoff={t,speed:s.speed,alt:s.alt};
 if(s.crashed||s.landings)break;
}
console.log({takeoff,peakAltitude:peak,finalAlt:s.alt,finalSpeed:s.speed,flightSeconds:s.flightSeconds,landings:s.landings,crashed:s.crashed,position:s.z});
assert(takeoff,'Autopilot must become airborne');
assert(peak>120,'Autopilot must climb above 120 meters');
assert(s.alt>=0,'Aircraft must never move below terrain');
let manual=initial();Object.assign(manual,{battery:true,fuel:true,engine:true,brakes:false,throttle:1,pitchInput:.5});let mPeak=0;
for(let i=0;i<5000;i++){step(manual,.025);mPeak=Math.max(mPeak,manual.alt);if(manual.alt>120)break;}
assert(manual.airborne&&manual.alt>120,'Manual control sequence must fly and climb');
console.log('PASS: Demo and manual takeoff climb; ground collision floor.');
