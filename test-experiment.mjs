import assert from 'node:assert/strict';
import {Experiment,angleDifference,experimentInsight} from './src/experiment.js';
assert.equal(angleDifference(359,2),3);assert.equal(angleDifference(2,359),-3);
let e=new Experiment();const s={heading:359,alt:200,speed:90,roll:20,airborne:true,crashed:false};
e.start(s);assert.equal(e.update(s,6),null);s.heading=2;s.alt=215;s.speed=88;const r=e.update(s,6);assert.equal(r.headingChange,3);assert.equal(r.altitudeChange,15);assert.equal(r.speedChange,-2);assert.equal(r.avgBank,20);assert.equal(e.trials.length,1);assert.equal(e.active,false);
e.start(s);s.roll=5;s.heading=5;e.update(s,12);assert.equal(e.trials.length,2);assert.match(experimentInsight(e.trials),/bank|turn|trial/i);
e.reset();assert.equal(e.trials.length,0);e.start(s);s.airborne=false;e.update(s,.2);assert.equal(e.active,false);assert.equal(e.trials.length,0);
console.log('Experiment tests passed');
