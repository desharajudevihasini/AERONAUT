import assert from 'node:assert/strict';
import {initial,step} from './src/flight.js';
import {demoUpdate} from './src/demo.js';
const run=(s,seconds,update=()=>{})=>{for(let i=0;i<Math.round(seconds/.02);i++){update(s,i*.02);step(s,.02);}return s;};
const powered=()=>Object.assign(initial(),{battery:true,fuel:true,engine:true,brakes:false});
// Flight needs engine power, brakes released, and a real nose-up rotation.
const parked=run(initial(),12,s=>{s.throttle=1;s.pitchInput=.5});assert.equal(parked.speed,0);assert.equal(parked.airborne,false);
const held=run(Object.assign(powered(),{brakes:true,throttle:1,pitchInput:.6}),12);assert.equal(held.airborne,false);assert.equal(held.speed,0);
const noRotation=run(Object.assign(powered(),{throttle:1,pitchInput:0}),12);assert.equal(noRotation.airborne,false);assert(noRotation.speed>75);
const takeoff=run(Object.assign(powered(),{throttle:1,pitchInput:.5}),15);assert(takeoff.airborne&&takeoff.alt>70,`manual takeoff ${takeoff.alt}`);
const bank=run(Object.assign({...takeoff},{rollInput:.65}),9);assert(Math.abs(bank.roll)>10 && Math.abs(bank.roll)<30,`beginner bank: ${bank.roll}`);assert(Math.abs(bank.heading)>1.5);assert(bank.alt>=0);
const advanced=run(Object.assign({...takeoff},{beginner:false,rollInput:.65}),9);assert(Math.abs(advanced.roll)>20,'advanced mode must preserve stronger turns');
const yaw=run(Object.assign({...takeoff},{yawInput:.8}),8);assert(yaw.heading>1);
const idle=run(Object.assign({...takeoff},{throttle:0,airbrake:1,pitchInput:0}),10);assert(idle.speed<takeoff.speed,'drag & braking must slow aircraft');
const glide=run(Object.assign({...takeoff},{throttle:0,pitchInput:-.4}),6);assert(glide.alt<takeoff.alt,'nose down decreases altitude');
const stalling=run(Object.assign({...takeoff},{speed:42,pitchInput:1,throttle:0}),2);assert(stalling.stall,'low speed creates a stall warning');assert(stalling.verticalSpeed<0,'stall must generate sink');
const ground=run(Object.assign(powered(),{yawInput:1,throttle:.3}),5);assert(ground.alt===0&&ground.heading!==0);
const collide=run(Object.assign({...takeoff},{alt:.1,verticalSpeed:-20,gear:false,pitchInput:-1,speed:90}),1);assert(collide.crashed&&collide.alt===0,'unsafe landing becomes a ground collision');
let demo=initial();let maxAltitude=0;let bankSeen=false;
for(let i=0;i<11500;i++){demoUpdate(demo,i*.02);step(demo,.02);maxAltitude=Math.max(maxAltitude,demo.alt);if(Math.abs(demo.roll)>6)bankSeen=true;if(demo.crashed||demo.landings)break;}
assert(demo.landings>0&&!demo.crashed,'full automatic demo must land');assert(maxAltitude>120&&bankSeen,'demo must take off, climb, bank, and land');
console.log('PASS: engine interlock, brake interlock, rotation interlock, manual takeoff, banked turn, rudder, drag/airbrake, descent, stall, taxi steering, impact, complete demo landing');
