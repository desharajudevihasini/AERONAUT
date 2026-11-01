// Fictional beginner return assistance. All movements pass through the flight engine.
// This is deliberately NOT an aircraft-specific autopilot or landing procedure.
import {clamp,RAD} from './flight.js';
export const newReturnState=()=>({phase:'intercept'});
export function returnGuide(s,state){
  const runwayDistance=Math.hypot(s.x,s.z);
  const staging={x:0,z:-2900};
  const bearing=Math.atan2(staging.x-s.x,-(staging.z-s.z))/RAD;
  const heading=((s.heading%360)+360)%360;
  const stagingError=((bearing-heading+540)%360)-180;
  if(state.phase==='intercept'&&runwayDistance<4700&&Math.abs(stagingError)<60&&heading>105&&heading<255)state.phase='final';
  const desiredHeading=state.phase==='final'?180+clamp(s.x/12,-20,20):bearing;
  const error=((desiredHeading-s.heading+540)%360)-180;
  const desiredAltitude=state.phase==='intercept'?320:Math.max(-12,Math.min(210,(-s.z-300)*.06));
  s.rollInput=clamp(error/27,-.95,.95);
  s.yawInput=clamp(error/25,-3,3);
  s.pitchInput=clamp((desiredAltitude-s.alt)/120,-.7,.65);
  s.throttle=state.phase==='intercept'?.28:runwayDistance>1000?.27:.17;
  s.airbrake=s.speed>100?.5:0;
  if(state.phase==='final')s.gear=true;
  return {phase:state.phase,desiredHeading,desiredAltitude,headingError:error,runwayDistance};
}
