// AERONAUT flight engine. Educational point-mass model, NOT an F-16 flight manual
// or an engineering-grade simulation of flight performance.
// All positions are meters, time seconds, speed m/s, angles degrees.
export const RAD=Math.PI/180;
export const clamp=(n,lo,hi)=>Math.max(lo,Math.min(hi,n));
const approach=(current,target,response,dt)=>current+(target-current)*(1-Math.exp(-response*dt));
export const initial=()=>({
 x:0,z:1250,alt:0,speed:0,heading:0,pitch:0,roll:0,verticalSpeed:0,
 engine:false,battery:false,fuel:false,gear:true,brakes:true,
 throttle:0,airbrake:0,trim:0,pitchInput:0,rollInput:0,yawInput:0,
 beginner:true,assist:.85,wind:0,g:1,aoa:0,stall:false,crashed:false,airborne:false,
 distance:0,flightSeconds:0,landings:0,touchdownVSpeed:0,
 phase:'PARKED', liftFactor:0,engineThrust:0,dragForce:0,
 maxAltitude:0,maxAirspeed:0,overrun:false
});
export function step(s,elapsed){
 if(s.crashed)return s;
 // Clamp unstable elapsed frames rather than allowing a huge positional leap.
 let remaining=clamp(elapsed,0,.1);
 while(remaining>1e-8){const dt=Math.min(.016,remaining);advance(s,dt);remaining-=dt;}
 return s;
}
function advance(s,dt){
 const movingControls=clamp(s.speed/65,.22,1);
 const controlDamping=1-clamp(s.assist,0,1)*.13;
 const pitchTarget=clamp(s.pitchInput*(s.beginner?10:13)*controlDamping+s.trim*3,s.beginner?-8:-11,s.beginner?13:16);
 const rollLimit=s.beginner?32:55;
 const rollTarget=clamp(s.rollInput*rollLimit*controlDamping,-rollLimit,rollLimit);
 // Rotation is only possible once sufficient airspeed is available.
 const rotationAllowed=s.speed>=69&&!s.brakes;
 const targetPitch=s.airborne?pitchTarget:rotationAllowed?clamp(pitchTarget,0,12):0;
 s.pitch=approach(s.pitch,targetPitch,s.airborne?2.3:3.4,dt);
 s.roll=approach(s.roll,s.airborne?rollTarget:0,(s.beginner?1.45:2.4)*movingControls,dt);
 s.pitch=clamp(s.pitch,s.beginner?-8:-11,s.beginner?13:16);s.roll=clamp(s.roll,-rollLimit,rollLimit);

 // Engine acceleration falls somewhat with airspeed; gear, airbrake, and bank cost energy.
 const engineOn=s.engine&&s.fuel&&s.battery;
 const engineResponse=s.throttle>.9?1.10:1;
 const thrust=engineOn?36*s.throttle*engineResponse*(1-.12*s.speed/340):0;
 const drag=.00080*s.speed*s.speed*(1+clamp(s.airbrake,0,1)*3.3+(s.gear?.35:0)+(s.airborne?Math.abs(s.roll)/300:0));
 s.engineThrust=thrust;s.dragForce=drag;
 const wheelBrake=(!s.airborne&&s.brakes)?42:(!s.airborne?2:0);
 const climbCost=s.airborne?9.81*Math.sin(s.pitch*RAD):0;
 s.speed=clamp(s.speed+(thrust-drag-wheelBrake-climbCost)*dt,0,340);
 s.maxAirspeed=Math.max(s.maxAirspeed,s.speed);

 // Responsive (but deliberately simplified) vertical flight model.
 const bankLift=Math.max(.45,Math.cos(s.roll*RAD));
 const desiredVz=s.speed*Math.sin(s.pitch*RAD)*bankLift;
 const observedFlightAngle=Math.atan2(s.verticalSpeed,Math.max(s.speed,1))/RAD;
 s.aoa=clamp(s.pitch-observedFlightAngle,-20,35);
 s.stall=s.airborne&&(s.speed<(s.beginner?44:56)||s.aoa>(s.beginner?28:23));
 s.liftFactor=clamp(Math.pow(s.speed/76,2)*bankLift,0,3.4);
 if(s.airborne){
   const slowPenalty=Math.max(0,(72-s.speed)*.18);
   const stallPenalty=s.stall?Math.max(9,18+(60-s.speed)*.35):0;
   s.verticalSpeed=approach(s.verticalSpeed,desiredVz-slowPenalty-stallPenalty,1.45,dt);
   s.verticalSpeed=clamp(s.verticalSpeed,-95,90);
   s.alt+=s.verticalSpeed*dt;
   // Coordinated bank creates yaw/turn. Rudder introduces a small additional yaw rate.
   const coordinatedTurn=(9.81*Math.tan(s.roll*RAD)/Math.max(s.speed,34))/RAD;
   s.heading+=(clamp(coordinatedTurn,-22,22)+s.yawInput*(s.beginner?1.3:2.5) + (s.wind||0)*.35)*dt;
   s.flightSeconds+=dt;
   if(s.alt<=0){
     const safeTouchdown=s.gear&&Math.abs(s.roll)<13&&Math.abs(s.pitch)<11&&s.verticalSpeed>=-8&&s.speed<106;
     s.touchdownVSpeed=s.verticalSpeed;s.alt=0;s.verticalSpeed=0;s.airborne=false;
     if(safeTouchdown){s.landings++;s.brakes=false;}else{s.crashed=true;s.speed=0;}
   }
 }else{
   s.alt=0;s.verticalSpeed=0;
   // Rudder steers on the runway; no stationary turning.
   s.heading+=s.yawInput*clamp(s.speed/28,0,1)*7*dt;
   if(rotationAllowed&&s.speed>=75&&s.pitch>=3){
     s.airborne=true;s.alt=1.2;
     s.verticalSpeed=Math.max(2,s.speed*Math.sin(s.pitch*RAD)*.60);
   }
 }
 const course=s.heading*RAD;const forward=s.speed*dt;
 s.x+=Math.sin(course)*forward+(s.airborne?(s.wind||0)*3.5*dt:0);
 s.z-=Math.cos(course)*forward;
 s.distance+=forward;
 s.maxAltitude=Math.max(s.maxAltitude,s.alt);
 s.g=clamp(1+Math.abs(s.roll)/70+Math.max(0,s.pitchInput)*s.speed/290,.5,5.5);
 s.phase=s.crashed?'CRASHED':s.airborne?(s.stall?'STALL':s.verticalSpeed>2?'CLIMB':s.verticalSpeed< -2?'DESCENT':'CRUISE'):(s.landings?'LANDED':s.speed>3?'TAKEOFF ROLL':engineOn?'READY':'PARKED');
 // Leaving the runway centerline at speed is displayed as a caution but does not
 // magically stop the flight. No invisible terrain collisions during airborne mode.
 s.overrun=!s.airborne&&Math.abs(s.x)>36&&s.speed>12;
}
