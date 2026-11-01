import assert from 'node:assert/strict';
import {initial,step} from './src/flight.js';
import {newReturnState,returnGuide} from './src/navigation.js';
import {crossedGate,gates,checkSkillCombos,missionInitial} from './src/mission.js';
// Segment can intersect a ring even if both endpoints are outside the capture radius.
const target=gates[0];
assert(crossedGate({x:0,alt:target.alt,z:target.z-900},{x:0,alt:target.alt,z:target.z+900},target));
assert(!crossedGate({x:9999,alt:target.alt,z:target.z-900},{x:9999,alt:target.alt,z:target.z+900},target));
// Return from the fictional target area using the same 3D flight physics as manual mode.
let s=initial();Object.assign(s,{battery:true,fuel:true,engine:true,brakes:false,throttle:.6,gear:false,airborne:true,x:0,z:-16500,alt:300,speed:160,heading:0,verticalSpeed:0});
const nav=newReturnState();let steps=0;
for(;steps<24000;steps++){
  returnGuide(s,nav);step(s,.025);
  if(s.crashed||s.landings)break;
}
assert.equal(s.crashed,false,'Beginner runway return should not crash');
assert.equal(s.landings,1,'Beginner return should complete a touchdown');
assert(Math.abs(s.x)<75&&Math.abs(s.z)<1800,'Return assist must land inside training-airfield finish region');
assert.equal(nav.phase,'final');
console.log(`PASS: swept checkpoint collision + aided return; touchdown (${Math.round(s.x)}, ${Math.round(s.z)}) at ${Math.round(s.speed)} m/s in ${(steps*.025).toFixed(1)} s`);

const skillMission=missionInitial();skillMission.stage=1;
const skillPlane={airborne:true,speed:100,engine:true};
assert.equal(checkSkillCombos(skillMission,skillPlane,new Set([0,3,7])).length,2);
assert.equal(checkSkillCombos(skillMission,skillPlane,new Set([0,3,7])).length,0,'Combo rewards once only');
assert.equal(checkSkillCombos(skillMission,skillPlane,new Set([6,4])).length,1);
assert.equal(skillMission.skills.length,3);
console.log('PASS: all three rewarded keyboard flight chords; no duplicate points');
