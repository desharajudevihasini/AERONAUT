// Fictional, forgiving arcade campaign. No real weapons or aircraft procedures.
// Coordinates are synthetic metres; beginner gates are intentionally far apart.
export const gates = [
  {x:0,z:-3400,alt:200,radius:315},
  {x:120,z:-6800,alt:255,radius:350},
  {x:-120,z:-10200,alt:240,radius:390},
  {x:0,z:-13600,alt:300,radius:430}
];
export const rangeBeacons=[{x:0,z:-16000,alt:310,radius:155}];
export const missionInitial=()=>({stage:0,gatesPassed:0,beaconsHit:0,shots:0,score:0,finished:false,events:[],maxBank:0,inputs:new Set(),missileLaunched:false,lastPosition:null,precisionBonus:0,skills:[],lastMessage:'Power up your jet. Beginner mode is enabled.'});
export const distance3=(s,p)=>Math.hypot(s.x-p.x,s.alt-p.alt,s.z-p.z);
// Swept sphere collision stops high-speed frames from skipping a checkpoint.
export function crossedGate(previous,current,gate){
  const vx=current.x-previous.x,vy=current.alt-previous.alt,vz=current.z-previous.z;
  const len2=vx*vx+vy*vy+vz*vz;
  const t=len2>1e-9?Math.max(0,Math.min(1,((gate.x-previous.x)*vx+(gate.alt-previous.alt)*vy+(gate.z-previous.z)*vz)/len2)):0;
  return Math.hypot(previous.x+vx*t-gate.x,previous.alt+vy*t-gate.alt,previous.z+vz*t-gate.z)<gate.radius;
}

export function missionStep(m,s,dt){
 m.maxBank=Math.max(m.maxBank,Math.abs(s.roll));
 const push=(msg,points=0)=>{m.events.unshift(msg);m.events=m.events.slice(0,8);m.lastMessage=msg;m.score+=points;};
 if(s.crashed){if(m.stage!==-1){m.stage=-1;push('FLIGHT ENDED · Restart and try again.');}return;}
 if(m.stage===0&&s.engine&&s.airborne&&s.alt>45){m.stage=1;push('AIRBORNE · First easy sky ring is straight ahead!',500);}
 if(m.stage===1&&m.gatesPassed<gates.length&&(distance3(s,gates[m.gatesPassed])<gates[m.gatesPassed].radius||(m.lastPosition&&crossedGate(m.lastPosition,s,gates[m.gatesPassed])))){
 const offset=distance3(s,gates[m.gatesPassed]);const bonus=Math.max(0,Math.round(100*(1-offset/gates[m.gatesPassed].radius)));m.precisionBonus+=bonus;m.gatesPassed++;push(`SKY RING ${m.gatesPassed}/${gates.length} · +${250+bonus}`,250+bonus);if(m.gatesPassed===gates.length){m.stage=2;push('RINGS COMPLETE · Giant drone target ahead! Key 22 to lock; key 23 to launch.',500);}}
 if(m.stage===2&&m.beaconsHit>=1){m.stage=3;push('MISSILE CHALLENGE COMPLETE · Return to base for landing bonus.',1000);}
 m.lastPosition={x:s.x,alt:s.alt,z:s.z};
 if(m.stage===3&&s.landings>0&&!s.airborne&&Math.abs(s.x)<75&&Math.abs(s.z)<1800){m.stage=4;m.finished=true;push('CAMPAIGN COMPLETE · Safe landing!',1400);}
}
export function beaconHit(m,index){if(m.stage!==2||index!==0||m.beaconsHit)return false;m.beaconsHit=1;m.score+=1000;m.lastMessage='HUGE TARGET CLEARED · +1000';m.events.unshift(m.lastMessage);return true;}
export function objective(m,s){
 if(m.stage===-1)return {title:'RESTART YOUR FLIGHT',action:'Press RESTART to try again.',why:'Beginner mode softens controls, but a steep ground impact still ends the flight.',target:null};
 if(m.stage===0)return {title:'01 · POWER UP AND TAKE OFF',action:!s.battery?'PAD A1 → electrical ON':!s.fuel?'PAD A2 → fuel ON':!s.engine?'PAD A3 → engine ON':s.brakes?'PAD A4 → brakes OFF':s.speed<76?'FADER 1 → 95–100%. Build 76 m/s.':'KNOB 1 → 65–70% to raise your nose.',why:'Increasing thrust gives the wing airflow. At sufficient speed a gentle nose-up command creates climb.',target:null};
 if(m.stage===1){const p=gates[m.gatesPassed];return {title:`02 · EASY SKY RINGS ${m.gatesPassed+1}/4`,action:`Huge ring ${m.gatesPassed+1} is ${Math.round(distance3(s,p))} m away. Use small bank corrections; keep nose near level.`,why:'The rings are spaced 3.4 km apart. Use KEY 3 / KEY 4 for gentle left/right banking; center the roll with KEY 18.',target:p};}
 if(m.stage===2)return {title:'03 · GIANT MISSILE CHALLENGE',action:m.missileLaunched?'Missile in flight — watch the target.':'Fly toward the glowing target, press KEY 22 to LOCK, then KEY 23 to LAUNCH a fictional arcade missile.',why:'Your keyboard controls target selection and launch; the visible missile is a fictional game mechanic, not a real weapons model.',target:rangeBeacons[0]};
 if(m.stage===3)return {title:'04 · RETURN TO BASE',action:'Press RETURN ASSIST (PAD B7 or the HUD button) to line up with the airfield, then land gently. You can turn assist off anytime.',why:'Landing requires alignment, a stable approach, appropriate speed, landing gear, and a low descent rate. The assist is fictional beginner training support.',target:{x:0,z:0,alt:90}};
 return {title:'MISSION COMPLETE',action:`Score ${m.score.toLocaleString()} · Replay or continue flying.`,why:'You flew the aircraft, navigated rings, used a fictional weapon mechanic, and landed.',target:null};
}

// Simple measurable MiniLab combinations make simultaneous piano-key play worthwhile.
// The flight controls themselves remain analog and run through flight.js.
export function checkSkillCombos(m,s,held){
 if(!s.airborne||m.stage<1||m.stage>3)return [];
 const earned=[];
 const award=(id,label)=>{if(m.skills.includes(id))return;m.skills.push(id);m.score+=180;m.lastMessage=`KEYBOARD SKILL · ${label} +180`;m.events.unshift(m.lastMessage);earned.push(label);};
 if((held.has(0)||held.has(1))&&(held.has(2)||held.has(3))&&s.speed>65)award('pitch-bank','PITCH + BANK');
 if(held.has(7)&&(held.has(2)||held.has(3))&&s.engine)award('boost-bank','AFTERBURNER + BANK');
 if(held.has(6)&&(held.has(4)||held.has(5))&&s.speed>65)award('brake-yaw','AIRBRAKE + YAW');
 return earned;
}
