import * as THREE from 'three';
import {initial,step,clamp,RAD} from './flight.js';
import {demoUpdate} from './demo.js';
import {returnGuide,newReturnState} from './navigation.js';
import {missionInitial, missionStep, objective, gates, rangeBeacons, beaconHit, checkSkillCombos} from './mission.js';
import {MIDIController,encoders,faders} from './midi.js';
import './style.css';
import './afterburner.css';
import './v5.css';
import './v6.css';
import './v7.css';
import './v8.css';
import './v10.css';
import {Experiment, experimentInsight} from './experiment.js';

// V5 Flight Data Recorder: pure snapshot timeline, independent of the flight-model loop.
import { FlightRecorder, sampleTelemetry, computeDebrief } from './recorder.js';


const $ = q => document.querySelector(q);
const app = $('#app');
// Surface Three.js/rendering errors instead of showing an unexplained empty sky.
function showFlightError(error){
 const message=String(error?.message||error||'Unknown rendering error');
 console.error('[AERONAUT scene]',error); if(document.getElementById('sceneError'))return;
 let banner=document.getElementById('sceneError');
 if(!banner){banner=document.createElement('div');banner.id='sceneError';document.body.appendChild(banner);}
 banner.textContent='FLIGHT SCENE ERROR: '+message+' · '+String(error?.stack||'').split('\n').slice(1,3).join(' / ');
 banner.style.cssText='position:fixed;z-index:99999;left:12px;right:12px;top:90px;padding:16px 20px;background:#371824;color:#fff;font:600 13px/1.5 system-ui;border:2px solid #ff8790;border-radius:9px;';
}
window.addEventListener('error',ev=>showFlightError(ev.error||ev.message));
window.addEventListener('unhandledrejection',ev=>showFlightError(ev.reason));

app.innerHTML = `
<div id="intro" class="intro"><div class="intro-content"><p class="overline">AERONAUT / AFTERBURNER / 10</p><div class="hero-jet"><svg viewBox="0 0 560 180" role="img" aria-label="F-16 inspired fighter jet silhouette"><defs><linearGradient id="metal"><stop stop-color="#ceddde"/><stop offset="0.5" stop-color="#536e80"/><stop offset="1" stop-color="#d7e5e3"/></linearGradient></defs><path fill="url(#metal)" stroke="#d5efde" stroke-width="2" d="M280 6 L297 78 L370 96 L510 139 L510 152 L345 140 L306 148 L298 168 L262 168 L254 148 L215 140 L50 152 L50 139 L190 96 L263 78 Z"/><path fill="#162e3d" d="M271 65 Q280 43 289 65 L293 114 L267 114 Z"/><path fill="#324959" d="M260 145 L280 172 L300 145 Z"/></svg><span>F-16 FIGHTING FALCON · FLIGHT LAB</span></div><div class="large-mark">F<span>—</span>16</div><h1>THE SKY IS NOT THE LIMIT.<br><em>IT’S YOUR PLAYGROUND.</em></h1><p class="lead">Your music controller becomes an F-16-inspired flight deck. Start the engine. Break through the clouds. Master four sky gates. Complete a fictional target challenge. Then bring your aircraft home.</p><div class="intro-actions"><button id="enter" class="primary">LAUNCH OPERATION ICEFALL ↗</button><button id="connectIntro" class="secondary">CONNECT MINILAB 3</button></div><p class="disclaimer">F-16-inspired arcade simulator · simplified educational flight physics · fictional training targets</p></div></div>
<div class="sim hidden" id="sim"><canvas id="scene"></canvas><div class="grain"></div>
<header><div class="brand">AERONAUT <span>/ AFTERBURNER / FLIGHT GAME</span></div><div class="header-actions"><span id="midiStatus" class="connection">MIDI NOT CONNECTED</span><button id="connect">CONNECT MINILAB</button><button id="cockpitView" class="selected">COCKPIT</button><button id="chaseView">CHASE CAM</button><button id="cinematicToggle" title="Hide extra panels and fly with a clean HUD">◈ CINEMATIC</button><button id="fullscreenToggle" title="Toggle full screen">⛶ FULLSCREEN</button><button id="guideToggle">CONTROL DECK</button><button id="difficulty" class="difficulty-button">BEGINNER ✓</button><button id="autoDemo" class="demo-button">▶ AUTOPILOT</button><button id="highAltitude" title="Explore cloud layers at 8,500 meters in free flight">☁ HIGH ALTITUDE</button><button id="reset">RESTART</button></div></header>
<div class="side left"><div class="panel mission"><div class="eyebrow">FLIGHT TRAINING // MISSION 01</div><h2 id="missionTitle">Power up the aircraft</h2><p id="missionDesc">Switch on electrical power to begin. This simplified procedure is designed for learning, not real aircraft operation.</p><div class="progress"><span id="stageNum">01</span><div><small id="stageLabel">ELECTRICAL POWER</small><div class="bar"><i id="stageBar"></i></div></div></div><div id="lessonHelp" class="lesson-help"></div><div class="flight-sliders"><label>THROTTLE <input id="screenThrottle" type="range" min="0" max="100" value="0"></label><label>PITCH <input id="screenPitch" type="range" min="-100" max="100" value="0"></label><label>ROLL <input id="screenRoll" type="range" min="-100" max="100" value="0"></label></div><div class="lesson-actions"><button id="tryAction">TRY THIS ACTION</button><button id="nextHint">WHY DOES THIS MATTER?</button></div><p id="lessonScience" class="lesson-science expanded">Your lesson explanation will appear here.</p><div class="step-feedback" id="stepFeedback">Complete this action to continue. No timer.</div></div><div class="panel status"><div class="eyebrow">AIRCRAFT SYSTEMS</div><div id="systems"></div></div></div>
<div id="cockpitFrame" class="cockpit-frame"><div class="canopy-top"></div><div class="canopy-left"></div><div class="canopy-right"></div><div class="dashboard"><div class="dash-gauge"><small>IAS / m/s</small><b id="dashSpeed">000</b></div><div class="dash-gauge"><small>ALT / m</small><b id="dashAlt">0000</b></div><div class="dash-gauge"><small>ATTITUDE</small><div class="attitude-disc"><i id="dashHorizon"></i></div></div><div class="dash-gauge"><small>ENGINE</small><b id="dashEngine">OFF</b></div></div></div><div class="center-hud"><div class="hud-top" id="warning">F-16 / TRAINING MODE</div><div class="pitch-line" id="pitchIndicator"></div><div class="reticle"><span></span><span class="reticle-mid"></span><span></span></div><div class="hud-bottom"><div>ALT <b id="hudAlt">0000</b> <small>M</small></div><div>SPD <b id="hudSpeed">000</b> <small>M/S</small></div><div>HDG <b id="hudHeading">000</b> <small>°</small></div></div></div>
<div class="side right"><div class="panel instruments"><div class="eyebrow">LIVE FLIGHT DYNAMICS</div><div class="metric"><span>AIRSPEED</span><b id="speed">0 <small>m/s</small></b></div><div class="metric"><span>ALTITUDE</span><b id="alt">0 <small>m</small></b></div><div class="metric"><span>VERTICAL SPEED</span><b id="vs">0.0 <small>m/s</small></b></div><div class="metric"><span>PITCH / ROLL</span><b id="attitude">0° / 0°</b></div><div class="metric"><span>THROTTLE</span><b id="throttle">0%</b></div><div class="metric"><span>LOAD / G</span><b id="gforce">1.0 g</b></div><div class="metric"><span>ANGLE OF ATTACK</span><b id="aoa">0°</b></div><p id="physicsNote">Increase throttle to generate thrust. Airspeed changes how much lift the wings can produce.</p></div><div class="panel events"><div class="eyebrow">FLIGHT INSTRUCTOR</div><p id="instructor">Welcome aboard. Start with electrical power.</p></div></div>
<div class="bottom"><div class="keybar"><div class="mini"><b>F1</b> THRUST <span id="cThrottle">0%</span></div><div class="mini"><b>F2</b> BARREL ROLL <span id="cAir">0%</span></div><div class="mini"><b>F3</b> LOOP / AIM X <span id="cTrim">0</span></div><div class="mini"><b>F4</b> CORKSCREW / AIM Y <span id="cZoom">50%</span></div><div class="mini"><b>K1</b> PITCH <span id="cPitch">0</span></div><div class="mini"><b>K2</b> ROLL <span id="cRoll">0</span></div><div class="mini"><b>K3</b> YAW <span id="cYaw">0</span></div><div class="mini"><b>K4</b> ASSIST <span id="cAssist">55%</span></div></div><p class="bottom-caption">FADERS 2–4: LOWER BELOW 35%, THEN RAISE ABOVE 85% FOR STUNTS · AIRBRAKE: PAD A6 / KEY 7 · ALSO: K5 WIND · K6 SUN · K7 HUD · K8 SOUND · PITCH STRIP ROLL · MOD STRIP PITCH · ALL 25 KEYS / BOTH PAD BANKS</p></div>
<div id="controlPanel" class="control-panel hidden"><div class="control-heading"><h2>MINILAB 3 / CONTROL MAP</h2><button id="closeControls">✕</button></div><p>Choose your MiniLab 3 <strong>USER</strong> preset. Physical controls can be relearned by clicking LEARN and moving them. Defaults come from Arturia's MIDI chart.</p><div id="mapping"></div><div class="control-heading"><h3>RAW MIDI MONITOR</h3><button id="encoderMode">ENCODERS: ABSOLUTE</button><button id="factory">RESTORE DEFAULTS</button></div><pre id="raw">Move a MIDI control to inspect its messages.</pre><h3>25 KEY ACTIONS</h3><button id="calibrateKeys">CALIBRATE FIRST PIANO KEY</button><p class="fine" id="keyCalibration">Default starts at MIDI note 48. Press CALIBRATE, then press the leftmost piano key once.</p><div id="keyMap"></div><h3>PAD BANK A / B</h3><div id="padMap"></div><p class="fine">If a pad does not respond, press its LEARN button then press that physical pad. This supports NOTE or CC pads on different MIDI channels.</p><p class="fine">Bank switching is performed on the controller (Shift + Pad 2). The app detects each bank by the notes it receives. Shift, Hold and octave buttons generally control the device internally and cannot reliably be assigned independent browser actions; transpose changes note numbers.</p></div>
<div id="midiHelp" class="midi-help hidden"><div class="control-heading"><h2>CONNECT YOUR MINILAB 3</h2><button id="closeMidiHelp">✕</button></div><p id="midiHelpStatus">Checking your browser…</p><ol id="midiSteps"><li>Connect your MiniLab 3 using a USB data cable.</li><li>Open this site at <b>http://localhost:5173</b> using Chrome or Edge.</li><li>Click <b>CONNECT MINILAB</b> and allow MIDI device access.</li><li>Close other MIDI apps if the device cannot be found.</li></ol><button id="retryMidi">RETRY CONNECTION</button><button id="continueNoMidi">TRY WITHOUT MIDI</button><p class="fine">You can learn the entire lesson using the on-screen buttons while troubleshooting MIDI.</p></div><div id="toast"></div><div id="liveInput" aria-live="polite">MIDI INPUT: WAITING</div><div id="keyboardHelp">NO MIDI: 1 BATTERY · 2 FUEL · 3 ENGINE · SPACE BRAKES · G GEAR · W/S PITCH · A/D ROLL · ↑/↓ THROTTLE · L LOCK · F FIRE · C SCAN · R RESET</div>
</div>`;

// V6 flight laboratory: collect observable differences from YOUR flying.
const lab=document.createElement('section');lab.id='flightLab';lab.innerHTML=`
<div class="lab-head"><span>◈ FLIGHT LAB / LEARN BY FLYING</span><button id="labCollapse" aria-label="Collapse flight lab">−</button></div>
<div id="labContent"><p class="lab-question">How does your bank angle affect a turn?</p>
<p class="lab-copy">Fly level, then hold a gentle bank. Record a 12-second trial. Repeat with a steeper bank and compare your real simulator results.</p>
<div class="lab-readout"><span>LIVE BANK <b id="labBank">0°</b></span><span>TURN <b id="labTurn">0°</b></span><span>ALTITUDE <b id="labAltitude">0 m</b></span></div>
<div class="lab-buttons"><button id="labTrial">● START 12s TRIAL</button><button id="labClear">RESET RESULTS</button></div>
<div id="labTimer">Ready for a hands-on experiment.</div><div id="labResults">No trials yet.</div>
<p class="lab-note">Measurements are produced by AERONAUT's simplified flight model, not real F-16 performance data.</p></div>`;
$('#sim').append(lab);
const experiment=new Experiment();
$('#labTrial').onclick=()=>{if(replayMode){instructor('Exit flight replay to start a new experiment.');return;}if(!s.airborne){instructor('Take off first, then run the banking experiment in the air.');return;}experiment.start(s);$('#labTrial').textContent='● MEASURING';$('#labTrial').disabled=true;};
$('#labClear').onclick=()=>{experiment.reset();$('#labResults').textContent='No trials yet.';$('#labTimer').textContent='Ready for a hands-on experiment.';};
$('#labCollapse').onclick=()=>{$('#labContent').classList.toggle('hidden');$('#labCollapse').textContent=$('#labContent').classList.contains('hidden')?'+':'−';};
function updateFlightLab(dt){
 $('#labBank').textContent=Math.abs(s.roll).toFixed(0)+'°';$('#labAltitude').textContent=Math.round(s.alt)+' m';
 $('#labTurn').textContent=((s.heading%360+360)%360).toFixed(0)+'°';
 const result=experiment.update(s,dt);
 if(experiment.active)$('#labTimer').textContent=`RECORDING · ${Math.max(0,12-experiment.elapsed).toFixed(1)}s remaining · Keep flying!`;
 if(result){$('#labTrial').textContent='● START 12s TRIAL';$('#labTrial').disabled=false;$('#labTimer').textContent='Trial saved. Repeat with a different bank angle.';}
 if(result||experiment.active)$('#labResults').innerHTML=experiment.trials.map((t,i)=>`<div class="lab-result"><b>TRIAL ${i+1}</b><span>Bank ${t.avgBank.toFixed(0)}° · Turn ${t.headingChange.toFixed(1)}° · Δ Alt ${t.altitudeChange.toFixed(0)}m · Δ Speed ${t.speedChange.toFixed(1)}m/s</span></div>`).join('')+(experiment.trials.length>1?`<p class="lab-conclusion">${experimentInsight(experiment.trials)}</p>`:'');
}

// Fictional training missile game; all effects and target systems are arcade-only.
const snowHint=document.createElement('div');snowHint.id='snowHint';snowHint.textContent='ALPINE SIDE QUEST · FLY NEAR CRYSTAL STATIONS AND PRESS KEY 24 TO SCAN · 0/3';$('#sim').append(snowHint);
const missionHud=document.createElement('section');missionHud.id='rangeHUD';missionHud.innerHTML=`<div class='range-heading'>◈ FLIGHT RANGE / TRAINING</div><div id='rangeTarget'>TARGET 01 · READY</div><div id='rangeMetrics'>MISSILES 0 · GIANT TARGET 0/1 · SNOW SCANS 0/3</div><div class='range-help'>KEYS 1–8 fly · KEY 24 scans ice stations · FADERS 3+4 AIM after rings · PAD B5 / KEY 22 locks · PAD B6 / KEY 23 fires.</div><button id='rangeTour'>SEE 25-KEY CONTROL DECK</button>`;
$('#sim').append(missionHud);
$('#rangeTour').onclick=()=>{$('#controlPanel').classList.remove('hidden');$('#keyMap').scrollIntoView({block:'nearest'});};
const inputHUD=document.createElement('div');inputHUD.id='inputHUD';inputHUD.textContent='PLAY A PIANO KEY TO CONTROL FLIGHT';$('#sim').append(inputHUD);
const missionUI=document.createElement('section');missionUI.id='afterburnerMission';missionUI.innerHTML=`
<div class="mission-tag"><span class="live-dot"></span> CAMPAIGN / OPERATION SKYLINE <span class="mission-score" id="abScore">00000 PTS</span></div>
<div class="mission-name" id="abObjective">ENGINE START & TAKEOFF</div>
<div class="mission-action" id="abAction">Connect your MiniLab to begin</div>
<div class="mission-why" id="abWhy">Every action influences the aircraft.</div><div class="mastery" id="mastery">PIANO CONTROLS USED: 0 / 25 · PAD ACTIONS: 0 / 16</div>
<div class="mission-footer"><div id="abProgress"><i></i><i></i><i></i><i></i></div><button id="abDetails">FLIGHT SCHOOL ↓</button><button id="abControls">CONTROL DECK ↗</button></div>`;
$('#sim').append(missionUI);
const navUI=document.createElement('div');navUI.id='navigationUI';navUI.innerHTML=`<span id="navLabel">NO WAYPOINT</span><div id="navNeedle">◇</div><strong id="navDistance">—</strong><small>FOLLOW THE MARKER</small>`;$('#sim').append(navUI);
const aimHUD=document.createElement('div');aimHUD.id='aimHUD';aimHUD.className='hidden';aimHUD.innerHTML=`<div class="aim-heading">TRAINING RANGE · TARGETING</div><div class="aim-viewport" id="aimViewport"><div id="aimTarget" class="aim-target">◇ TARGET</div><div id="aimCursor" class="aim-cursor">✛</div></div><div id="aimStatus">COMPLETE FOUR RINGS TO UNLOCK</div><div class="aim-controls"><label>FADER 3 · LEFT / RIGHT<input id="aimX" type="range" min="0" max="100" value="50"></label><label>FADER 4 · UP / DOWN<input id="aimY" type="range" min="0" max="100" value="50"></label></div><div class="aim-buttons"><button id="aimAlign">◈ CENTER AIM</button><button id="aimLock">B5 · LOCK</button><button id="aimFire">B6 · FIRE</button></div><small>Faders take over aiming only in the fictional drone challenge. Use the MIDI controls or on-screen fallback.</small>`;$('#sim').append(aimHUD);
$('#aimAlign').onclick=()=>{if(mission.stage!==2){instructor('Finish the sky rings first.');return;}const t=targetScreenDirection();if(!t.inFront){instructor('Turn toward the target before centering aim.');return;}aimHorizontal=THREE.MathUtils.clamp(t.x,-1,1);aimVertical=THREE.MathUtils.clamp(t.y,-1,1);$('#aimX').value=Math.round((aimHorizontal+1)*50);$('#aimY').value=Math.round((aimVertical+1)*50);updateTargetAimHUD();instructor('AIM CENTERED · Press LOCK, then FIRE. Move Faders 3 and 4 for manual aiming.');};
$('#aimX').oninput=e=>handleControl('trim',Number(e.target.value)/100);$('#aimY').oninput=e=>handleControl('zoom',Number(e.target.value)/100);$('#aimLock').onclick=()=>action('Target lock');$('#aimFire').onclick=()=>action('Training missile');

// An optional science panel explains what the physics engine is calculating NOW.
const scienceUI=document.createElement('section'); scienceUI.id='scienceHUD';scienceUI.innerHTML=`
  <div class="science-heading"><span>◈ FLIGHT SCIENCE / LIVE</span><button id="toggleScience" title="Hide or show flight science">HIDE</button></div>
  <div class="science-body" id="scienceBody">
  <div class="science-bars">
    <div><span>THRUST</span><i><b id="barThrust"></b></i><strong id="valThrust">0</strong></div>
    <div><span>DRAG</span><i><b id="barDrag"></b></i><strong id="valDrag">0</strong></div>
    <div><span>LIFT INDEX</span><i><b id="barLift"></b></i><strong id="valLift">0</strong></div>
  </div>
  <div class="science-lesson"><b id="scienceHeadline">POWER BEFORE FLIGHT</b><p id="scienceExplain">Start the engine and move the throttle to see the thrust and drag meters change.</p></div>
  <div class="science-equation" id="scienceEquation">THRUST − DRAG → ACCELERATION</div>
  <small>Educational model, not calibrated F-16 aerodynamic data</small></div>`;
$('#sim').append(scienceUI);
$('#toggleScience').onclick=()=>{const body=$('#scienceBody');body.classList.toggle('hidden');$('#toggleScience').textContent=body.classList.contains('hidden')?'SHOW':'HIDE';};

// Flight recorder and playable debrief. Playback positions are recorded state, not synthetic autopilot.
const blackbox=document.createElement('section');blackbox.id='blackboxHUD';blackbox.innerHTML=`<div class="blackbox-title">◉ FLIGHT RECORDER <span id="recordState">STANDBY</span></div><div class="blackbox-actions"><button id="recordFlight">● RECORD</button><button id="replayFlight" disabled>▶ REPLAY</button><button id="exportFlight" disabled>↓ DATA</button></div><div id="recordStats">Record a manual flight, then replay it and export telemetry.</div><div id="replayRow" class="hidden"><input id="replaySeek" type="range" min="0" max="100" value="0"><button id="replayClose">EXIT</button></div>`;
$('#sim').append(blackbox);
const flightRecorder=new FlightRecorder();let recorderTick=0, replayTick=0,replayMode=false,replayPaused=false,replayTime=0,liveBeforeReplay=null;
const startRecording=()=>{if(replayMode)endReplay(); flightRecorder.start();recorderTick=0;$('#recordFlight').textContent='■ STOP';$('#recordState').textContent='RECORDING';$('#recordState').classList.add('active');};
const stopRecording=()=>{flightRecorder.stop();$('#recordFlight').textContent='● RECORD';$('#recordState').textContent='SAVED';$('#recordState').classList.remove('active');$('#replayFlight').disabled=flightRecorder.frames.length<2;$('#exportFlight').disabled=flightRecorder.frames.length<2;
 const d=computeDebrief(flightRecorder.frames);$('#recordStats').textContent=`${d.duration.toFixed(1)}s • ${d.maxAltitude.toFixed(0)} m max alt • ${d.maxSpeed.toFixed(0)} m/s max speed • ${d.distance.toFixed(0)} m flown`;};
const endReplay=()=>{if(liveBeforeReplay){Object.assign(s,liveBeforeReplay);liveBeforeReplay=null;}replayMode=false;replayPaused=false;$('#replayRow').classList.add('hidden');$('#replayFlight').textContent='▶ REPLAY';$('#recordState').textContent='SAVED';};
$('#recordFlight').onclick=()=>{if(flightRecorder.recording)stopRecording();else startRecording();};
$('#replayFlight').onclick=()=>{if(!flightRecorder.frames.length)return;if(!replayMode){if(flightRecorder.recording)stopRecording();liveBeforeReplay={...s};replayMode=true;replayTime=0;replayPaused=false;$('#replayRow').classList.remove('hidden');$('#replayFlight').textContent='Ⅱ PAUSE';$('#recordState').textContent='PLAYBACK';setView('chase');}
 else {replayPaused=!replayPaused;$('#replayFlight').textContent=replayPaused?'▶ RESUME':'Ⅱ PAUSE';}};
$('#replayClose').onclick=endReplay;
$('#replaySeek').oninput=e=>{replayTime=flightRecorder.duration()*Number(e.target.value)/100;if(replayMode)Object.assign(s,flightRecorder.at(replayTime));};
$('#exportFlight').onclick=()=>{const blob=new Blob([JSON.stringify({format:'aeronaut-telemetry-v1',description:'Synthetic educational flight, NOT actual F-16 data',frames:flightRecorder.frames},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='aeronaut-flight-telemetry.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),500);};
function refreshScience(){
 const p=n=>Math.max(0,Math.min(100,n));const bars=[['Thrust',s.engineThrust,40],['Drag',s.dragForce,45],['Lift',s.liftFactor,3.4]];
 for(const [name,v,max] of bars){$('#bar'+name).style.width=p(v/max*100)+'%';$('#val'+name).textContent=v.toFixed(1);}
 let h,e,eq;
 if(s.crashed){h='HARD TOUCHDOWN';e='A safe landing needs reduced vertical speed, shallow bank, and landing gear.';eq='VERTICAL SPEED + ATTITUDE → LANDING OUTCOME';}
 else if(s.stall){h='LIFT IS BREAKING DOWN';e='At low speed or excessive angle of attack, the wing cannot maintain enough lift. Reduce nose-up input and regain speed.';eq='LOW AIRSPEED → LOW LIFT';}
 else if(!s.engine){h='POWER BEFORE FLIGHT';e='Electrical power and fuel enable the simulated engine. Then throttle can produce thrust.';eq='POWER + FUEL + ENGINE → THRUST';}
 else if(!s.airborne){h='BUILD AIRSPEED';e=`The engine produces ${s.engineThrust.toFixed(1)} model thrust units, while drag opposes motion. Reach flying speed before gently lifting the nose.`;eq='NET FORWARD FORCE = THRUST − DRAG';}
 else if(Math.abs(s.roll)>12){h='WHY BANKING TURNS THE JET';e='The lift vector tilts as the aircraft banks. Part of that lift now acts sideways, curving the flight path. Strong banking also reduces vertical lift.';eq='BANK ANGLE → SIDEWAYS LIFT → TURN';}
 else if(s.airbrake>.25){h='DRAG TRADES SPEED FOR CONTROL';e='Extending airbrakes increases drag. This slows the jet without requiring the engine to shut down.';eq='MORE DRAG → LESS AIRSPEED';}
 else if(s.verticalSpeed>3){h='CLIMBING COSTS ENERGY';e='Pitch directs some speed upward. A climb trades forward kinetic energy and engine thrust for altitude.';eq='SPEED + THRUST → ALTITUDE';}
 else{h='LEVEL FLIGHT / ENERGY';e='Lift and weight approximately balance while thrust counters drag. Adjust one control and watch the bars respond.';eq='LIFT ↔ WEIGHT   •   THRUST ↔ DRAG';}
 $('#scienceHeadline').textContent=h;$('#scienceExplain').textContent=e;$('#scienceEquation').textContent=eq;
}

const infoUI=document.createElement('div');infoUI.id='cockpitInfo';infoUI.innerHTML=`<div>01 <span>MISSION</span><b id="abStatus">PREFLIGHT</b></div><div>02 <span>AIRCRAFT</span><b>F-16 / TRAINING</b></div><div>03 <span>FLIGHT MODE</span><b id="abFlightMode">MANUAL</b></div>`;$('#sim').append(infoUI);
const endUI=document.createElement('div');endUI.id='endMission';endUI.className='hidden';endUI.innerHTML=`<div class="end-tag">OPERATION SKYLINE / DEBRIEF</div><h2>MISSION <em>COMPLETE.</em></h2><p>You completed the runway launch, sky-gate navigation, training-beacon challenge, and return flight.</p><div class="end-stats"><div><span>FINAL SCORE</span><b id="endScore">0</b></div><div><span>CHECKPOINTS</span><b id="endGates">0/4</b></div><div><span>GIANT TARGET</span><b id="endHits">0/1</b></div></div><button id="endReplay">↺ FLY AGAIN</button><button id="endFree">CONTINUE FREE FLIGHT</button>`;$('#sim').append(endUI);
$('#endReplay').onclick=()=>{endUI.classList.add('hidden');reset();$('#launchCard').classList.remove('hidden');};
$('#endFree').onclick=()=>{endUI.classList.add('hidden');missionMode='free';};

const launchUI=document.createElement('div');launchUI.id='launchCard';launchUI.innerHTML=`<span class="launch-eyebrow">SIMULATOR ONLINE // MISSION 01</span><h2>OPERATION <em>ICEFALL</em></h2><p>Launch from a snowy airfield, fly four broad checkpoints through the alpine valley, scan three research stations, complete a fictional drone challenge, and return to base.</p><div class="launch-actions"><button id="launchPlay">BEGIN MISSION ↗</button><button id="launchDemo">WATCH AUTOPILOT DEMO</button></div><small>Educational arcade physics · not a real F-16 flight or weapon training system</small>`;$('#sim').append(launchUI);
// Always-visible quick controls and live mastery: action before visual decoration.
const pilotBar=document.createElement('section');pilotBar.id='pilotBar';
pilotBar.innerHTML=`<div class="pilot-head"><span>FLIGHT DIRECTOR <b id="ringBadge">RINGS 0/4</b></span><span id="landingBadge">GEAR DOWN</span></div><div class="pilot-controls"><button id="assistHome" title="Beginner return assist, available after the target challenge">⌖ RETURN ASSIST</button><button id="quickDeck">⌘ MINI­LAB MAP</button><button id="viewSwap">◉ CAMERA</button></div><div class="pilot-mastery"><span>CONTROL DISCOVERY <b id="skillCount">0 / 55</b></span><div><i id="skillFill"></i></div></div><small>COMBOS: Hold PITCH + BANK, BOOST + BANK, or AIRBRAKE + YAW to score. Full control map shows all 55 inputs.</small>`;
$('#sim').append(pilotBar);
const flash=document.createElement('div');flash.id='ringFlash';flash.innerHTML='<strong>CHECKPOINT CLEARED</strong><span>Good flying · keep your next ring centered</span>';$('#sim').append(flash);
$('#assistHome').onclick=()=>action('Runway location');
$('#quickDeck').onclick=()=>$('#controlPanel').classList.toggle('hidden');
$('#viewSwap').onclick=()=>setView(view==='chase'?'cockpit':'chase');
$('#abDetails').onclick=()=>{missionBriefOpen=!missionBriefOpen;document.querySelector('.training-dock').classList.toggle('show',missionBriefOpen);$('#abDetails').textContent=missionBriefOpen?'FLIGHT SCHOOL ↑':'FLIGHT SCHOOL ↓';};
$('#abControls').onclick=()=>$('#controlPanel').classList.toggle('hidden');
$('#launchPlay').onclick=()=>{enableEngineAudio();$('#launchCard').classList.add('hidden');setView('chase');instructor('Mission launched. Use Pad A1 for electrical power, then A2 fuel and A3 engine.');};
$('#launchDemo').onclick=()=>{$('#launchCard').classList.add('hidden');$('#autoDemo').click();};

let demoRunning=false,demoClock=0,demoMessage="";let returnAssist=false,returnState=newReturnState(),flightRingFlash=0,lastGatesPassed=0;
let mission=missionInitial();let lastMissionMessage='';let completionShown=false;let missionBriefOpen=false;let missionMode='mission';
let s=initial(), cameraDist=78, sun=0.7, hudVisibility=1, volume=0.4, elapsed=0, userStarted=false, hintIndex=0;
const stages=[
 ['ELECTRICAL POWER','Switch on electrical power. Power enables onboard instruments and displays.',()=>s.battery],
 ['FUEL SYSTEM','Enable fuel. An engine needs a supply of fuel before generating sustained thrust.',()=>s.fuel],
 ['ENGINE START','Start the engine (simplified). Observe that thrust is still low until you increase throttle.',()=>s.engine],
 ['RELEASE BRAKES','Release parking brakes. Brakes stop the wheels from rolling even when the engine produces thrust.',()=>!s.brakes],
 ['BUILD AIRSPEED','Push Fader 1 upward. Thrust accelerates the aircraft; airflow over the wings increases with speed.',()=>s.speed>68],
 ['ROTATE','Pull the nose upward using Knob 1 (above center), or the modulation strip. Use small corrections.',()=>s.airborne],
 ['CLIMB','Retract landing gear using Pad A5 or G, and climb above 120 m.',()=>s.alt>120&&!s.gear],
 ['FLY & EXPLORE','Bank to turn and observe speed, altitude and G-load. Prepare for a runway approach.',()=>s.distance>4500],
 ['LANDING','Practice touchdown: extend landing gear, slow down, and descend gently. The current physics test allows landing on level terrain; runway alignment is a future milestone.',()=>!s.airborne && s.distance>4500&&!s.crashed]
];
const lessonDetails=[
 ['PAD A1 · or click TRY THIS ACTION','Electricity powers instruments and control electronics. This lesson uses a simplified master switch, not the real F-16 startup checklist.','Battery'],
 ['PAD A2 · or click TRY THIS ACTION','The engine requires fuel. This simulated fuel switch is a learning abstraction.','Fuel'],
 ['PAD A3 · or click TRY THIS ACTION','An engine produces thrust by accelerating air rearward. Engine start and throttle position are separate concepts.','Engine'],
 ['PAD A4 · or click TRY THIS ACTION','Parking brakes prevent ground movement. Releasing them allows the aircraft to taxi.','Parking brake'],
 ['FADER 1 UP · or use the on-screen throttle','More thrust increases speed. Lift depends strongly on airspeed: the simplified model uses this relationship to teach takeoff.','throttle'],
 ['KNOB 1 NOSE UP · or use the pitch slider','Pitch is the nose attitude. A modest nose-up command at sufficient airspeed begins the takeoff rotation.','pitch'],
 ['PAD A5 · or click TRY THIS ACTION','Landing gear creates drag. Retracting it after positive climb helps maintain flight efficiency.','Landing gear'],
 ['KNOB 2 BANK · or use the roll slider','A bank tilts the lift vector; part of the lift then turns the aircraft. Watch heading, G-load and altitude.','roll'],
 ['COCKPIT → EXTERIOR · practice descent','Landings demand controlled airspeed, low descent rate and proper gear position. The model is intentionally simplified.','Landing gear']
];
const padA=['Battery','Fuel','Engine','Parking brake','Landing gear','Airbrake toggle','HUD mode','Instructor hint'];
const padB=['External camera','Cockpit camera','Clear controls','Flight assist','Target lock','Training missile','Runway location','Reset flight'];
const keyActions=['HOLD: Pitch up','HOLD: Pitch down','HOLD: Roll left','HOLD: Roll right','HOLD: Yaw left','HOLD: Yaw right','HOLD: Airbrake','HOLD: Afterburner','Landing gear','Parking brake','Electrical power','Fuel supply','Engine start/stop','Trim nose up','Trim nose down','Trim center','Pitch center','Roll center','Yaw center','Chase camera','Cockpit view','Select next target','Training pulse','Scan snow beacon','Emergency reset controls'];
const keyNames=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
let keyBase=Number(localStorage.getItem('aeronaut-key-base')||48);let waitingForKey=false;
const heldNotes=new Set();let targetIndex=0, pulsesFired=0, targetsScored=0, markersDropped=0, lastPulse=0;let targetLocked=false,missileFlight=null,explosionTime=0;let aimHorizontal=0,aimVertical=0,arcadeAimMode=false;const scannedBeacons=new Set();let scanCount=0;let keyRollActive=false,keyPitchActive=false;const usedKeys=new Set(),usedPads=new Set(),usedControls=new Set();
const rangeTargets=rangeBeacons;
const completedTargets=new Set();
const keyname=n=>keyNames[n%12]+(Math.floor(n/12)-1);
function instructor(msg){$('#instructor').textContent=msg;$('#toast').textContent=msg;$('#toast').classList.add('show');clearTimeout(window.toastTimer);window.toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),4000);}
function action(name){
 if(name==='Battery'||name==='Electrical power'){s.battery=!s.battery; if(!s.battery){s.engine=false;s.fuel=false;} instructor(s.battery?'Electrical power online: displays and electronic systems can operate.':'Electrical power offline.');}
 else if(name==='Fuel'||name==='Fuel supply'){if(!s.battery){instructor('Electrical power first.');return;}s.fuel=!s.fuel;if(!s.fuel)s.engine=false;instructor(s.fuel?'Fuel supply available.':'Fuel supply closed.');}
 else if(name==='Engine'||name==='Engine start/stop'){if(!s.battery||!s.fuel){instructor('Engine needs electrical power and fuel.');return;}s.engine=!s.engine;instructor(s.engine?'Engine running. Throttle controls simulated thrust.':'Engine stopped: aircraft will slow without thrust.');}
 else if(name==='Parking brake'){s.brakes=!s.brakes;instructor(s.brakes?'Parking brakes set.':'Parking brakes released.');}
 else if(name==='Landing gear'){s.gear=!s.gear;instructor(s.gear?'Landing gear extended. It increases drag.':'Landing gear retracted. Drag reduced.');}
 else if(name==='Airbrake'||name==='Airbrake toggle'){s.airbrake=s.airbrake>0.5?0:1;instructor('Airbrake '+(s.airbrake?'deployed. Increased drag slows the aircraft.':'retracted.'));}
 else if(name==='Instructor hint'){instructor(stages[getStage()][1]);}
 else if(name==='HUD mode'){hudVisibility=hudVisibility>0.4?0.2:1;}
 else if(name==='External camera'||name==='Chase camera')setView('chase');
 else if(name==='Cockpit camera'||name==='Cockpit view')setView('cockpit');
 else if(name==='Orbit camera')setView('side');
 else if(name==='Flight assist'||name==='Flight assist toggle'){s.assist=s.assist>0.5?0:0.7;instructor('Simplified flight stabilization '+(s.assist?'enabled.':'disabled.'));}
 else if(name==='Weather reset'){s.wind=0;instructor('Wind disturbance returned to zero.');}
 else if(name==='Day / dusk'||name==='Daylight'||name==='Dusk'){sun=name==='Daylight'?0.9:name==='Dusk'?0.13:sun>0.5?0.14:0.92;}
 else if(name==='Runway location'){returnAssist=!returnAssist;returnState=newReturnState();instructor(returnAssist?'RETURN ASSIST ENGAGED · Gentle steering toward the airfield. Control any axis to disengage.':'RETURN ASSIST DISENGAGED · Full manual flight.');$('#assistHome').classList.toggle('active',returnAssist);}
 else if(name==='Reset flight'||name==='Flight reset'){reset();}
 else if(name==='Clear controls'||name==='Emergency reset controls'){s.pitchInput=0;s.rollInput=0;s.yawInput=0;s.trim=0;instructor('Command inputs centered.');}
 else if(name==='Set full throttle')s.throttle=1;
 else if(name==='Throttle idle')s.throttle=0;
 else if(name==='Trim nose up')s.trim=clamp(s.trim+0.1,-1,1);
 else if(name==='Trim nose down')s.trim=clamp(s.trim-0.1,-1,1);
 else if(name==='Trim center')s.trim=0;
 else if(name==='Pitch center')s.pitchInput=0;
 else if(name==='Roll center')s.rollInput=0;
 else if(name==='Yaw center')s.yawInput=0;
 else if(name==='Select next target'||name==='Target lock'){lockTarget();}
 else if(name==='Training pulse'||name==='Training missile'){firePulse();}
 else if(name==='Scan snow beacon'){scanIceBeacon();}
 else if(name==='Show controls')$('#controlPanel').classList.toggle('hidden');
 else if(name==='Toggle systems')$('.status').classList.toggle('hidden');
}
function reset(){stunt=null;Object.keys(stuntArmed).forEach(k=>stuntArmed[k]=false);if(flightRecorder.recording)stopRecording();if(replayMode)endReplay();mission=missionInitial();lastMissionMessage='';completionShown=false;$('#endMission').classList.add('hidden');if(typeof markerMeshes!=='undefined'){for(const m of markerMeshes){scene.remove(m);m.geometry.dispose();m.material.dispose();}markerMeshes.length=0;}if(typeof pulseMeshes!=='undefined')for(const p of pulseMeshes){scene.remove(p.mesh);p.mesh.geometry.dispose();p.mesh.material.dispose();}if(typeof pulseMeshes!=='undefined')pulseMeshes.length=0;heldNotes.clear();completedTargets.clear();returnAssist=false;returnState=newReturnState();lastGatesPassed=0;flightRingFlash=0;$('#assistHome').classList.remove('active');usedControls.clear();pulsesFired=0;targetsScored=0;markersDropped=0;targetIndex=0;targetLocked=false;aimHorizontal=0;aimVertical=0;scannedBeacons.clear();scanCount=0;$('#aimX').value='50';$('#aimY').value='50';if(missileFlight){scene.remove(missileFlight.mesh);missileFlight.mesh.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material)o.material.dispose();});}missileFlight=null;explosionTime=0;hitEffects.forEach(f=>{scene.remove(f.group);f.group.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});});hitEffects.length=0;beaconMeshes.forEach(g=>{g.scale.setScalar(1);g.children[0].material.opacity=.9;});usedKeys.clear();usedPads.clear();demoRunning=false;demoClock=0;$('#autoDemo').textContent='▶ AUTOPILOT';s=initial();experiment.reset();$('#labTrial').disabled=false;$('#labTrial').textContent='● START 12s TRIAL';$('#labResults').textContent='No trials yet.';hintIndex=0;lastStage=-1;guidedStage=0;refreshTraining();instructor('Flight reset. Start with electrical power.');}
function getStage(){if(s.crashed) return 8; if(!s.battery)return 0;if(!s.fuel)return 1;if(!s.engine)return 2;if(s.brakes)return 3;if(!s.airborne && s.speed<=68 && s.distance<2000)return 4;if(!s.airborne && s.distance<2000)return 5;if(s.airborne && (s.alt<=120||s.gear))return 6;if(s.distance<=4500)return 7;return 8;}
let lastStage=-1;let lessonOverride=false;
let guidedStage=0, tourIndex=0, tourActive=false, tourSeen=new Set();
const controlTour=[...Array.from({length:8},(_,i)=>({name:`PAD A${i+1}`,key:`pad:A:${i}`,why:`Pad bank A action: ${padA[i]}`})),...Array.from({length:8},(_,i)=>({name:`PAD B${i+1}`,key:`pad:B:${i}`,why:`Pad bank B action: ${padB[i]}`})),...Array.from({length:25},(_,i)=>({name:`KEY ${i+1}`,key:`key:${i}`,why:`Piano key command: ${keyActions[i]}`})),...['pitch','roll','yaw','assist','wind','sun','hud','sound','throttle','airbrake','trim','zoom','bend','mod'].map(name=>({name:name.toUpperCase(),key:`control:${name}`,why:`Move this physical control to verify its input and its live response.`}))];
const lessonTargets=[
 'Press PAD A1. Target: ELECTRICAL = ON.',
 'Press PAD A2. Target: FUEL = ON.',
 'Press PAD A3. Target: ENGINE = ON.',
 'Press PAD A4. Target: PARKING BRAKES = OFF.',
 'Move FADER 1 to 95–100%. Keep KNOB 1 centered (50%). Wait for AIRSPEED to reach 76 m/s before rotating.',
 'At 76 m/s or faster, set KNOB 1 around 66–70% (or PITCH slider +35 to +40). Watch pitch reach 3° or more; the jet should lift off.',
 'Press PAD A5 to retract gear. Keep FADER 1 at 75–90%, KNOB 1 around 58–62%, KNOB 2 near center. Reach 120 m altitude.',
 'Try KNOB 2 at 55–60% for a gentle bank, then return it to 50%. Test other controls in CONTROL TOUR.',
 'Practice a controlled touchdown: extend gear, center roll, reduce thrust gently, and avoid a steep descent. A runway-aligned landing pattern comes later.'
];
const explainExtra=[
 'Electrical power brings the simulated displays and control systems online. It does not itself produce engine thrust.',
 'Fuel must be available for sustained engine operation. This is an educational abstraction of complex F-16 fuel systems.',
 'The engine and throttle are different: starting the engine makes thrust available, while throttle requests more of it.',
 'Brakes resist ground movement. A jet cannot gain takeoff speed while its parking brakes remain applied.',
 'Thrust increases speed; faster airflow enables the wing to make enough lift. Keep the nose level during the initial acceleration.',
 'Pitch is the angle of the nose. Once the aircraft is moving fast enough, a small nose-up pitch initiates rotation; more is not always better.',
 'Retracting the gear reduces drag after liftoff. Keeping speed up and banking gently helps avoid losing altitude.',
 'Aileron-driven roll banks the aircraft, turning the lift vector. The sideways component curves its flight path; too much bank reduces vertical lift.',
 'Landing combines speed, altitude, pitch, sink rate, and gear. The current landing detector tests touchdown safety but does not yet require runway alignment.'
];
const trainingEl=document.createElement('div');trainingEl.className='training-dock'; trainingEl.innerHTML=`<div class="training-top"><span id="trainingMode">GUIDED FLIGHT · 01/09</span><button id="demoLesson">▶ WATCH FULL FLIGHT</button><button id="tourToggle">CONTROL TOUR · ALL INPUTS</button></div><div class="training-title" id="trainingTitle">Electrical power</div><div class="training-target" id="trainingTarget"></div><div class="training-meter"><div id="trainingMeter"></div></div><div class="training-info" id="trainingWhy"></div><div class="training-bottom"><span id="trainingResult">Waiting for your action…</span><button id="trainingBack">BACK</button><button id="trainingNext">NEXT →</button></div>`;
$('#sim').append(trainingEl);
function refreshTraining(){
 const item=controlTour[tourIndex],st=guidedStage;
 $('#trainingMode').textContent=tourActive?`CONTROL TOUR · ${tourIndex+1}/${controlTour.length}`:`GUIDED FLIGHT · ${st+1}/09`;
 $('#trainingTitle').textContent=tourActive?item.name:stages[st][0];
 $('#trainingTarget').textContent=tourActive?`Operate ${item.name} on the MiniLab 3. A detected MIDI event marks this step complete.`:lessonTargets[st];
 $('#trainingWhy').textContent=tourActive?item.why:explainExtra[st];
 const done=tourActive?tourSeen.has(item.key):stages[st][2]();
 $('#trainingResult').textContent=done?'✓ Detected — continue when ready':(s.crashed?'Hard landing: press RESTART to retry':'Waiting for target…');
 $('#trainingResult').classList.toggle('pass',done);
 $('#trainingMeter').style.width=`${tourActive?((tourIndex+1)/controlTour.length*100):((st+1)/stages.length*100)}%`;
 $('#trainingNext').textContent=done?'NEXT →':'SKIP STEP →';
}
$('#demoLesson').onclick=()=>$('#autoDemo').click();
$('#tourToggle').onclick=()=>{tourActive=!tourActive;$('#tourToggle').textContent=tourActive?'RETURN TO FLIGHT':'CONTROL TOUR · ALL INPUTS'; refreshTraining();};
$('#trainingNext').onclick=()=>{if(tourActive){tourIndex=(tourIndex+1)%controlTour.length;}else{guidedStage=Math.min(8,guidedStage+1);}refreshTraining();};
$('#trainingBack').onclick=()=>{if(tourActive){tourIndex=Math.max(0,tourIndex-1);}else{guidedStage=Math.max(0,guidedStage-1);}refreshTraining();};
function markTour(key){tourSeen.add(key);if(tourActive && controlTour[tourIndex]?.key===key)refreshTraining();}
refreshTraining();

// F2/F3/F4 are performance gestures. Lower each fader below 35%, then push above 85%
// to trigger a stunt. During the target stage F3 and F4 retain their aim controls.
const stuntArmed={airbrake:false,trim:false,zoom:false};
let stunt=null;
const STUNTS={airbrake:['BARREL ROLL',2.3],trim:['LOOP',3.2],zoom:['CORKSCREW',3.0]};
function startStunt(kind){
 if(!s.airborne||s.crashed||s.speed<65){instructor('STUNT REQUIRES FLIGHT · Take off and reach 65 m/s.');return;}
 const [label,duration]=STUNTS[kind];stunt={kind,label,duration,remaining:duration};
 instructor(label+' · Cinematic stunt activated! Return fader below 35% to re-arm.');
}
function stuntFader(name,value){
 if(!(name in stuntArmed))return false;
 if(name!=='airbrake' && mission.stage===2)return false; // preserve targeting F3/F4
 if(value<.35)stuntArmed[name]=true;
 if(value>.85 && stuntArmed[name]){stuntArmed[name]=false;startStunt(name);}
 return true;
}
function handleControl(name,value){
  if(demoRunning){demoRunning=false;$('#autoDemo').textContent='▶ AUTOPILOT';instructor('You have manual control.');}
  markTour(`control:${name}`);usedControls.add(name);if(returnAssist&&['pitch','roll','yaw','bend','mod'].includes(name)){returnAssist=false;$('#assistHome').classList.remove('active');instructor('Manual steering resumed.');}
  if(name==='pitch'){keyPitchActive=false;$('#screenPitch').value=Math.round((value-.5)*200);s.pitchInput=(value-0.5)*2;$('#cPitch').textContent=Math.round(value*100)+'% → '+(s.pitchInput*16).toFixed(0)+'°';}
  else if(name==='roll'){keyRollActive=false;$('#screenRoll').value=Math.round((value-.5)*200);s.rollInput=(value-0.5)*2;$('#cRoll').textContent=Math.round(value*100)+'% → '+(s.rollInput*48).toFixed(0)+'°';}
  else if(name==='yaw'){s.yawInput=(value-0.5)*2;$('#cYaw').textContent=s.yawInput.toFixed(2);}
  else if(name==='assist'){s.assist=value;$('#cAssist').textContent=Math.round(value*100)+'%';}
  else if(name==='wind')s.wind=value;
  else if(name==='sun')sun=value;
  else if(name==='hud')hudVisibility=Math.max(.15,value);
  else if(name==='sound')volume=value;
  else if(name==='throttle'){$('#screenThrottle').value=Math.round(value*100);s.throttle=value;$('#cThrottle').textContent=Math.round(value*100)+'%';}
  else if(name==='airbrake'){stuntFader(name,value);$('#cAir').textContent='ROLL '+Math.round(value*100)+'%';}
  else if(name==='trim'){if(mission.stage!==2){stuntFader(name,value);$('#cTrim').textContent='LOOP '+Math.round(value*100)+'%';}else if(mission.stage===2){aimHorizontal=(value-.5)*1.15;$('#cTrim').textContent='AIM X '+Math.round(aimHorizontal*100)+'%';}else{s.trim=(value-.5)*2;$('#cTrim').textContent=s.trim.toFixed(2);}}
  else if(name==='zoom'){if(mission.stage!==2){stuntFader(name,value);$('#cZoom').textContent='SPIRAL '+Math.round(value*100)+'%';}else if(mission.stage===2){aimVertical=(.5-value)*1.15;$('#cZoom').textContent='AIM Y '+Math.round(aimVertical*100)+'%';}else{cameraDist=20+value*125;$('#cZoom').textContent=Math.round(value*100)+'%';}}
  else if(name==='bend'){s.rollInput=(value-.5)*2;$('#cRoll').textContent=Math.round(value*100)+'% → '+(s.rollInput*48).toFixed(0)+'°';}
  else if(name==='mod'){s.pitchInput=(value-.5)*2;$('#cPitch').textContent=Math.round(value*100)+'% → '+(s.pitchInput*16).toFixed(0)+'°';}
}
const midi=new MIDIController(handleControl,(i,b)=>{markTour(`pad:${b}:${i}`);usedPads.add(`${b}${i}`);instructor(`PAD ${b}${i+1} → ${(b==='A'?padA:padB)[i]}`);action((b==='A'?padA:padB)[i]);},(note,velocity,channel,isDown)=>{if(waitingForKey&&isDown){keyBase=note;localStorage.setItem('aeronaut-key-base',String(note));waitingForKey=false;$('#keyCalibration').textContent=`Leftmost key calibrated to MIDI note ${note}. All 25 notes now mapped from there.`;updateKeyLegend();return;}let idx=note-keyBase;if(idx<0||idx>24){if(isDown)instructor(`Note ${note} outside key range. Calibrate the leftmost piano key.`);return;}if(isDown){markTour(`key:${idx}`);usedKeys.add(idx);heldNotes.add(idx);if(idx>=8){action(keyActions[idx]);}else {$('#liveInput').textContent=`HELD KEY ${idx+1}: ${keyActions[idx]}`;}}else heldNotes.delete(idx);},raw=>{$('#liveInput').textContent=`INPUT: ${raw.type.toUpperCase()} ${raw.number} · CH ${raw.channel} · VALUE ${raw.value}`;$('#raw').textContent=`${new Date().toLocaleTimeString()}  ${raw.device}\nTYPE: ${raw.type.toUpperCase()}   CHANNEL: ${raw.channel}   DATA 1: ${raw.number}   DATA 2: ${raw.value}\nTip: move a knob or fader and confirm its CC number.`;},msg=>{$('#midiStatus').textContent=msg;$('#midiHelpStatus').textContent=msg;if(/failed|unavailable|No MIDI input|denied|permission/i.test(msg))$('#midiHelp').classList.remove('hidden');else if(/MIDI ready/i.test(msg))$('#midiHelp').classList.add('hidden');});
$('#screenThrottle').oninput=e=>handleControl('throttle',+e.target.value/100);$('#screenPitch').oninput=e=>handleControl('pitch',(+e.target.value/100+1)/2);$('#screenRoll').oninput=e=>handleControl('roll',(+e.target.value/100+1)/2);$('#connect').onclick=()=>midi.connect();$('#connectIntro').onclick=()=>midi.connect();$('#retryMidi').onclick=()=>midi.connect();$('#closeMidiHelp').onclick=()=>$('#midiHelp').classList.add('hidden');$('#continueNoMidi').onclick=()=>$('#midiHelp').classList.add('hidden');
$('#enter').onclick=()=>{$('#intro').classList.add('hidden');$('#sim').classList.remove('hidden');userStarted=true;enableEngineAudio();resize(); // Render the initial runway and aircraft before waiting for mission/controls.
 try{camera.position.set(s.x+48,s.alt+24,s.z+115);camera.lookAt(s.x,s.alt+3,s.z);renderScene();updateUI();}catch(err){showFlightError(err);}
};
$('#highAltitude').onclick=()=>{
 if(flightRecorder.recording)stopRecording();
 if(replayMode)endReplay();
 demoRunning=false;$('#autoDemo').textContent='▶ AUTOPILOT';
 s.battery=true;s.fuel=true;s.engine=true;s.brakes=false;s.gear=false;
 s.airborne=true;s.crashed=false;s.alt=12000;s.speed=Math.max(255,s.speed);
 s.throttle=.88;s.airbrake=0;s.roll=0;s.pitch=3;s.rollInput=0;s.pitchInput=.12;
 s.verticalSpeed=3;s.heading=0;s.x=0;s.z=-4600;
 setView('chase');
 instructor('HIGH ALTITUDE FREE FLIGHT · 12,000 m. Maintain throttle around 80–90%, use gentle bank and pitch inputs, and explore the upper cloud deck. Educational simplified physics; this is not an F-16 performance specification.');
};
$('#cockpitView').onclick=()=>setView('cockpit');$('#chaseView').onclick=()=>setView('chase');function setView(v){view=v;$('#cockpitFrame').classList.toggle('hidden',v!=='cockpit');$('#cockpitView').classList.toggle('selected',v==='cockpit');$('#chaseView').classList.toggle('selected',v==='chase');}$('#guideToggle').onclick=()=>$('#controlPanel').classList.toggle('hidden');$('#closeControls').onclick=()=>$('#controlPanel').classList.add('hidden');$('#reset').onclick=reset;$('#difficulty').onclick=()=>{s.beginner=!s.beginner;s.assist=s.beginner?.85:.55;$('#difficulty').textContent=s.beginner?'BEGINNER ✓':'ADVANCED';instructor(s.beginner?'Beginner: gentler banks, soft controls, easier stall behavior.':'Advanced: wider bank range and stronger control response.');};$('#autoDemo').onclick=()=>{if(demoRunning){demoRunning=false;$('#autoDemo').textContent='▶ AUTOPILOT';instructor('Demo stopped; manual control resumed.');return;}reset();demoRunning=true;demoClock=0;setView('chase');$('#autoDemo').textContent='■ STOP DEMO';instructor('Autopilot demonstration: watch real simulated acceleration and takeoff. Click STOP to take control.');};$('#nextHint').onclick=()=>{$('#lessonScience').classList.toggle('expanded');};$('#tryAction').onclick=()=>{const st=getStage(),cmd=lessonDetails[st][2];if(cmd==='throttle'){s.throttle=Math.max(s.throttle,.8);$('#screenThrottle').value=Math.round(s.throttle*100);instructor('Demo throttle set to 80%. Move Fader 1 to take control.');}else if(cmd==='pitch'){s.pitchInput=.45;$('#screenPitch').value='45';instructor('Pitch command set gently nose-up. Move Knob 1 to take control.');}else if(cmd==='roll'){s.rollInput=.35;$('#screenRoll').value='35';instructor('Bank command applied. Move Knob 2 to take control.');}else if(st===8){s.gear=true;instructor('Landing gear lowered. Approach and touchdown are controlled by flight physics.');}else action(cmd);};$('#factory').onclick=()=>midi.resetMappings();$('#encoderMode').onclick=()=>{const mode=midi.toggleEncoderMode();$('#encoderMode').textContent='ENCODERS: '+mode.toUpperCase();instructor(mode==='relative'?'Relative encoder mode: each small MIDI turn changes the command gradually.':'Absolute mode: MIDI value sets the command position.');};$('#encoderMode').textContent='ENCODERS: '+midi.encoderMode.toUpperCase();
let mapHtml='';[...['pitch','roll','yaw','assist','wind','sun','hud','sound','throttle','airbrake','trim','zoom','bend','mod']].forEach(name=>{mapHtml+=`<div class="map-row"><span>${name.toUpperCase()} <small>${name==='bend'?'pitch wheel':name==='mod'?'CC 1':'CC '+(encoders[['pitch','roll','yaw','assist','wind','sun','hud','sound'].indexOf(name)]??faders[['throttle','airbrake','trim','zoom'].indexOf(name)])}</small></span><button class="learn" data-name="${name}">LEARN</button></div>`;});$('#mapping').innerHTML=mapHtml;document.querySelectorAll('.learn').forEach(b=>b.onclick=()=>midi.learnControl(b.dataset.name));
function updateKeyLegend(){$('#keyMap').innerHTML=keyActions.map((a,i)=>`<span><b>${keyname(keyBase+i)}</b> ${a}</span>`).join('');}updateKeyLegend();$('#calibrateKeys').onclick=()=>{waitingForKey=true;$('#keyCalibration').textContent='Press the LEFTMOST piano key now. This captures its real MIDI note.';};
// Interactive MiniLab reference: a visual control surface and live test without hardware.
const deck=document.createElement('section');deck.id='physicalDeck';deck.innerHTML=`<div class="deck-eyebrow">ARTURIA MINILAB 3 · LIVE INPUT MAP</div><div class="deck-top" id="deckKnobs"></div><div class="deck-faders" id="deckFaders"></div><div class="deck-keys" id="deckKeys"></div><div class="deck-note">Tap keys here to test actions. Hold keys 1–8 for continuous flight control. Connect the real MiniLab to use physical input.</div>`;
$('#controlPanel').insertBefore(deck,$('#mapping'));
$('#deckKnobs').innerHTML=['PITCH','ROLL','YAW','ASSIST','CROSSWIND','LIGHT','HUD','ENGINE AUDIO'].map((a,i)=>`<div class="deck-knob"><i>◉</i><span>K${i+1} ${a}</span></div>`).join('');
$('#deckFaders').innerHTML=['THROTTLE','BARREL ROLL','LOOP / AIM X','CORKSCREW / AIM Y'].map((a,i)=>`<div class="deck-fader"><i></i><span>F${i+1} ${a}</span></div>`).join('');
$('#deckKeys').innerHTML=Array.from({length:25},(_,i)=>`<button class="deck-key ${[1,3,6,8,10].includes(i%12)?'black-key':''}" data-index="${i}" title="${keyActions[i]}"><b>${i+1}</b></button>`).join('');
$('#deckKeys').addEventListener('pointerdown',e=>{const k=e.target.closest('[data-index]');if(!k)return;const i=Number(k.dataset.index);k.classList.add('down');markTour(`key:${i}`);usedKeys.add(i);if(i<8)heldNotes.add(i);else action(keyActions[i]);});
const releaseDeck=()=>{document.querySelectorAll('#deckKeys .down').forEach(k=>{heldNotes.delete(Number(k.dataset.index));k.classList.remove('down');});};
$('#deckKeys').addEventListener('pointerup',releaseDeck);$('#deckKeys').addEventListener('pointercancel',releaseDeck);$('#deckKeys').addEventListener('pointerleave',releaseDeck);
$('#padMap').innerHTML=padA.map((a,i)=>`<span><b>A${i+1}</b> ${a} <button data-padbank="A" data-padindex="${i}">LEARN</button></span>`).join('')+padB.map((a,i)=>`<span><b>B${i+1}</b> ${a} <button data-padbank="B" data-padindex="${i}">LEARN</button></span>`).join('');document.querySelectorAll('[data-padbank]').forEach(el=>el.onclick=()=>midi.learnPad(el.dataset.padbank,Number(el.dataset.padindex))); 
let cinematic=false;
$('#cinematicToggle').onclick=()=>{cinematic=!cinematic;$('#sim').classList.toggle('cinematic-mode',cinematic);$('#cinematicToggle').textContent=cinematic?'◈ EXIT CINEMATIC':'◈ CINEMATIC';};
$('#fullscreenToggle').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await $('#sim').requestFullscreen();}catch(e){instructor('Fullscreen unavailable: '+e.message);}};
const pressed=new Set();window.addEventListener('keydown',e=>{if(e.repeat||e.target.tagName==='INPUT')return;pressed.add(e.key.toLowerCase());if([' ','arrowup','arrowdown'].includes(e.key.toLowerCase()))e.preventDefault();const k=e.key.toLowerCase(); if(k==='1')action('Battery');if(k==='2')action('Fuel');if(k==='3')action('Engine');if(k===' ')action('Parking brake');if(k==='g')action('Landing gear');if(k==='r')reset();if(k==='f')firePulse();if(k==='l')lockTarget();if(k==='c')scanIceBeacon();if(k==='t')action('Select next target');});window.addEventListener('keyup',e=>pressed.delete(e.key.toLowerCase()));
// Scene setup: original procedural aircraft model; no commercial 3D assets necessary.
// Lightweight synthesised engine audio: no audio files or external soundtrack.
let audioCtx=null,engineOsc=null,engineGain=null,engineFilter=null;
function enableEngineAudio(){try{if(!audioCtx){audioCtx=new (window.AudioContext||window.webkitAudioContext)();engineOsc=audioCtx.createOscillator();engineGain=audioCtx.createGain();engineFilter=audioCtx.createBiquadFilter();engineOsc.type='sawtooth';engineFilter.type='lowpass';engineGain.gain.value=0;engineOsc.connect(engineFilter);engineFilter.connect(engineGain);engineGain.connect(audioCtx.destination);engineOsc.start();}if(audioCtx.state==='suspended')audioCtx.resume();}catch{}}
function engineAudioUpdate(){if(!audioCtx||!engineOsc)return;const t=audioCtx.currentTime;engineOsc.frequency.setTargetAtTime(42+s.throttle*95,t,.08);engineFilter.frequency.setTargetAtTime(90+s.throttle*670,t,.10);engineGain.gain.setTargetAtTime(s.engine?Math.min(.085,volume*.18)*(.2+s.throttle*.8):0,t,.12);}
const canvas=$('#scene'),renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'default'});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.17;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
const scene=new THREE.Scene();scene.background=new THREE.Color('#83a9c3');scene.fog=new THREE.FogExp2('#b5c7d0',.000040);
const camera=new THREE.PerspectiveCamera(66,1,.1,90000);let view='chase';
const sunLight=new THREE.DirectionalLight('#fff4d9',2.25);sunLight.position.set(-1200,2400,-1200);sunLight.castShadow=true;sunLight.shadow.mapSize.set(2048,2048);sunLight.shadow.camera.near=100;sunLight.shadow.camera.far=9000;sunLight.shadow.camera.left=-2200;sunLight.shadow.camera.right=2200;sunLight.shadow.camera.top=2200;sunLight.shadow.camera.bottom=-2200;scene.add(sunLight);scene.add(new THREE.HemisphereLight('#cee6ee','#374b4d',1.75));
const ground=new THREE.Mesh(new THREE.PlaneGeometry(120000,120000),new THREE.MeshStandardMaterial({color:'#b7c7ce',roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.y=-1;scene.add(ground);
const runway=new THREE.Mesh(new THREE.PlaneGeometry(72,3200),new THREE.MeshStandardMaterial({color:'#273442',roughness:.93}));runway.rotation.x=-Math.PI/2;runway.position.set(0,.02,0);scene.add(runway);
const shoulder=new THREE.Mesh(new THREE.PlaneGeometry(92,3230),new THREE.MeshStandardMaterial({color:'#7c7769',roughness:1}));shoulder.rotation.x=-Math.PI/2;shoulder.position.y=-.01;scene.add(shoulder);
const paint=new THREE.MeshStandardMaterial({color:'#f0ede2',roughness:1});
function stripe(w,d,x,z){const m=new THREE.Mesh(new THREE.PlaneGeometry(w,d),paint);m.rotation.x=-Math.PI/2;m.position.set(x,.06,z);scene.add(m);}
for(let z=-1510;z<1520;z+=85){stripe(2,41,0,z);}for(const x of [-32,32])stripe(1.3,3180,x,0);
for(let z of [-1400,1400])for(let j=0;j<5;j++){stripe(3,39,-25+j*12,z);}
const lightMaterial=new THREE.MeshBasicMaterial({color:'#e9eec2'});for(let z=-1580;z<=1580;z+=90)for(let x of [-40,40]){const l=new THREE.Mesh(new THREE.SphereGeometry(2,6,6),lightMaterial);l.position.set(x,1.5,z);scene.add(l);}
// Terrain: broader, more natural ridges with a painted albedo texture for a less toy-like result.
function makeTerrainTexture(){
 const c=document.createElement('canvas');c.width=1024;c.height=1024;const g=c.getContext('2d');
 const grad=g.createLinearGradient(0,0,0,1024);grad.addColorStop(0,'#ffffff');grad.addColorStop(.38,'#e6edf2');grad.addColorStop(.62,'#f4f7fb');grad.addColorStop(1,'#cfdde7');g.fillStyle=grad;g.fillRect(0,0,1024,1024);
 for(let i=0;i<2600;i++){const x=Math.random()*1024,y=Math.random()*1024,s=4+Math.random()*18;g.fillStyle=`rgba(${110+Math.random()*55},${85+Math.random()*40},${60+Math.random()*30},${0.025+Math.random()*0.035})`;g.beginPath();g.arc(x,y,s,0,Math.PI*2);g.fill();}
 for(let i=0;i<540;i++){g.strokeStyle=`rgba(255,255,255,${0.012+Math.random()*0.018})`;g.lineWidth=.5+Math.random()*1.4;g.beginPath();let x=Math.random()*1024,y=Math.random()*1024;g.moveTo(x,y);for(let j=0;j<7;j++){x+=-55+Math.random()*110;y+=-18+Math.random()*36;g.lineTo(x,y);}g.stroke();}
 const tex=new THREE.CanvasTexture(c);tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.repeat.set(18,18);tex.colorSpace=THREE.SRGBColorSpace;return tex;
}
const terrainMat=new THREE.MeshStandardMaterial({map:makeTerrainTexture(),color:0xffffff,roughness:.94,metalness:.02,flatShading:false,vertexColors:true});
const terrainGeo=new THREE.PlaneGeometry(44000,44000,240,240);terrainGeo.rotateX(-Math.PI/2);
const pos=terrainGeo.attributes.position;const terrainColors=[];
const cSnow=new THREE.Color('#e8f0f5'),cIce=new THREE.Color('#c2d5e2'),cRock=new THREE.Color('#70777d'),cValley=new THREE.Color('#b6c4cb');
function smoothstep(a,b,x){const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);}
function ridge(x,z){
 const ax=Math.abs(x);
 // Wide takeoff area; then a snowy alpine valley with real mountains on each side.
 const outside=smoothstep(480,2400,ax);
 const postRunway=smoothstep(1800,3500,-z);
 const canyon=outside*(.9+.1*postRunway)+postRunway*.045;
 const longWave=Math.sin(x*.00043+z*.00031)*.36+Math.sin(z*.00068-x*.00027)*.26;
 const detail=Math.sin(x*.0019+z*.00135)*.18+Math.sin(z*.0032-x*.0021)*.09;
 const peaks=680+950*Math.pow(Math.abs(Math.sin(z*.00022+x*.00027)),2.8);
 const h=canyon*(peaks*(.78+longWave+detail)+110*Math.sin(x*.005+z*.004));
 return Math.max(-4,h)-4;
}
for(let i=0;i<pos.count;i++){
 const x=pos.getX(i),z=pos.getZ(i),h=ridge(x,z);pos.setY(i,h);
 const rock=smoothstep(280,850,h);const snow=smoothstep(620,1050,h);
 const c=cValley.clone().lerp(cRock,rock*.74).lerp(cIce,snow*.68).lerp(cSnow,snow*.64);
 const fleck=(Math.sin(x*.014+z*.023)*Math.sin(z*.018-x*.017))*.04;c.offsetHSL(0,0,fleck);
 terrainColors.push(c.r,c.g,c.b);
}
terrainGeo.setAttribute('color',new THREE.Float32BufferAttribute(terrainColors,3));terrainGeo.computeVertexNormals();
const terrain=new THREE.Mesh(terrainGeo,terrainMat);terrain.position.y=-2;terrain.receiveShadow=true;scene.add(terrain);
// Endless alpine terrain: one reusable mesh follows the aircraft. World-space heights
// are recomputed only when the plane moves ~6 km, not every animation frame.
// This avoids the visible 44 km boundary after the Icefall target and remains memory bounded.
let terrainCenterX=0,terrainCenterZ=0;
function followTerrain(){
 const nextX=Math.round(s.x/6000)*6000, nextZ=Math.round(s.z/6000)*6000;
 if(nextX===terrainCenterX&&nextZ===terrainCenterZ)return;
 terrainCenterX=nextX;terrainCenterZ=nextZ;
 terrain.position.set(nextX,-2,nextZ);
 ground.position.x=nextX;ground.position.z=nextZ;
 for(let i=0;i<pos.count;i++){
  const x=pos.getX(i)+nextX,z=pos.getZ(i)+nextZ,h=ridge(x,z);
  pos.setY(i,h);
  const rock=smoothstep(280,850,h),snow=smoothstep(620,1050,h);
  const c=cValley.clone().lerp(cRock,rock*.74).lerp(cIce,snow*.68).lerp(cSnow,snow*.64);
  c.offsetHSL(0,0,(Math.sin(x*.014+z*.023)*Math.sin(z*.018-x*.017))*.04);
  const j=i*3;terrainGeo.attributes.color.array[j]=c.r;terrainGeo.attributes.color.array[j+1]=c.g;terrainGeo.attributes.color.array[j+2]=c.b;
 }
 pos.needsUpdate=true;terrainGeo.attributes.color.needsUpdate=true;
 terrainGeo.computeVertexNormals();terrainGeo.computeBoundingSphere();
 // Keep texture sampling approximately anchored to the terrain world coordinates.
 terrainMat.map.offset.set(nextX/44000*18,-nextZ/44000*18);
}

// Airbase infrastructure - hangars, approach lighting, taxiway and control tower.
const hangarMat=new THREE.MeshStandardMaterial({color:0x5d6e76,metalness:.22,roughness:.86});
const roofMat=new THREE.MeshStandardMaterial({color:0x293b47,metalness:.35,roughness:.8});
function structure(x,z,w,d,h){const group=new THREE.Group();const body=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),hangarMat);body.position.y=h/2;group.add(body);const roof=new THREE.Mesh(new THREE.BoxGeometry(w+4,3,d+4),roofMat);roof.position.y=h+1.5;group.add(roof);group.position.set(x,0,z);scene.add(group);}
for(let i=0;i<6;i++)structure(120+i%2*82,1150-i*135,62,82,16+(i%3)*4);
structure(-155,1000,38,50,42);
const towerGroup=new THREE.Group();towerGroup.position.set(-178,0,1100);towerGroup.add(new THREE.Mesh(new THREE.CylinderGeometry(9,12,72,10),hangarMat));
const cab=new THREE.Mesh(new THREE.CylinderGeometry(20,17,14,10),new THREE.MeshStandardMaterial({color:0x244458,metalness:.56,roughness:.25}));cab.position.y=40;towerGroup.add(cab);scene.add(towerGroup);
const taxi=new THREE.Mesh(new THREE.PlaneGeometry(30,850),new THREE.MeshStandardMaterial({color:0x3b4b4e,roughness:1}));taxi.rotation.x=-Math.PI/2;taxi.position.set(77,.04,900);scene.add(taxi);
// V8: altitude-scale soft cloudscape. The former clouds were visibly faceted
// icosahedrons. Clouds here use generated alpha textures and billboarded layers,
// not spheres or game-block geometry. No external images or paid assets needed.
function makeCloudTexture(){
 const c=document.createElement('canvas');c.width=256;c.height=128;
 const g=c.getContext('2d');const blobs=[[-.28,.12,.36,.45],[-.1,-.12,.32,.55],[.17,-.02,.37,.58],[.36,.15,.30,.38],[0,.18,.46,.37]];
 for(const [x,y,sx,sy] of blobs){g.save();g.translate((x+.5)*256,(y+.5)*128);g.scale(sx*256,sy*128);const grad=g.createRadialGradient(0,0,.04,0,0,1);grad.addColorStop(0,'rgba(255,255,255,.68)');grad.addColorStop(.42,'rgba(255,255,255,.53)');grad.addColorStop(.75,'rgba(255,255,255,.17)');grad.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=grad;g.beginPath();g.arc(0,0,1,0,Math.PI*2);g.fill();g.restore();}
 const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;tex.minFilter=THREE.LinearFilter;return tex;
}
const cloudTexture=makeCloudTexture();const cloudMaterials=[
 new THREE.SpriteMaterial({map:cloudTexture,color:0xf8f8f4,transparent:true,opacity:.84,depthWrite:false,fog:true}),
 new THREE.SpriteMaterial({map:cloudTexture,color:0xe3edf4,transparent:true,opacity:.60,depthWrite:false,fog:true}),
 new THREE.SpriteMaterial({map:cloudTexture,color:0xffffff,transparent:true,opacity:.38,depthWrite:false,fog:true}),
];
const clouds=[];let cloudSeed=847234;function cloudRandom(){cloudSeed=(Math.imul(cloudSeed,1664525)+1013904223)>>>0;return cloudSeed/4294967296;}
for(let i=0;i<220;i++){
 const x=(cloudRandom()-.5)*42000,z=(cloudRandom()-.5)*42000;
 const nearDeck=i<150;
 const layer=nearDeck?1400+cloudRandom()*2200:7600+cloudRandom()*2200;
 const width=(nearDeck?700:1200)+cloudRandom()*(nearDeck?1800:2600);
 const sprite=new THREE.Sprite(cloudMaterials[i%3]);sprite.position.set(x,layer,z);sprite.scale.set(width,width*(nearDeck?.30:.12),1);sprite.material.rotation=(cloudRandom()-.5)*.22;scene.add(sprite);clouds.push(sprite);
}
for(let i=0;i<84;i++){
 const sprite=new THREE.Sprite(cloudMaterials[2]);const a=cloudRandom()*Math.PI*2,r=6000+cloudRandom()*22000;
 sprite.position.set(Math.cos(a)*r,5600+cloudRandom()*1500,Math.sin(a)*r);
 sprite.scale.set(2400+cloudRandom()*4200,280+cloudRandom()*380,1);scene.add(sprite);clouds.push(sprite);
}
const farSun=new THREE.Mesh(new THREE.SphereGeometry(260,40,28),new THREE.MeshBasicMaterial({color:0xffe6bb,transparent:true,opacity:.96,depthWrite:false}));farSun.position.set(-11500,4700,-18000);scene.add(farSun);
const jet=new THREE.Group();scene.add(jet);
const bodyMat=new THREE.MeshStandardMaterial({color:'#718799',metalness:.64,roughness:.34});const paleMat=new THREE.MeshStandardMaterial({color:'#a0aeb8',metalness:.55,roughness:.42});const darkMat=new THREE.MeshStandardMaterial({color:'#172838',metalness:.52,roughness:.2});
function box(w,h,d,x,y,z,mat=bodyMat){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);jet.add(m);return m;}
function cyl(r1,r2,h,x,y,z,mat=bodyMat){const m=new THREE.Mesh(new THREE.CylinderGeometry(r1,r2,h,16),mat);m.rotation.x=Math.PI/2;m.position.set(x,y,z);jet.add(m);return m;}
function wing(points,mat=bodyMat){const sh=new THREE.Shape();sh.moveTo(points[0][0],points[0][1]);for(let i=1;i<points.length;i++)sh.lineTo(points[i][0],points[i][1]);sh.closePath();const mesh=new THREE.Mesh(new THREE.ShapeGeometry(sh),new THREE.MeshStandardMaterial({color:mat===bodyMat?'#8497a8':'#9aabb7',metalness:.6,roughness:.42,side:THREE.DoubleSide}));mesh.rotation.x=-Math.PI/2;mesh.position.y=.25;jet.add(mesh);return mesh;}
const fuselage=cyl(2.1,2.5,25,0,2.2,0);const nose=new THREE.Mesh(new THREE.ConeGeometry(2.05,10,16),bodyMat);nose.rotation.x=-Math.PI/2;nose.position.set(0,2.2,-17);jet.add(nose);
const engine=cyl(1.65,1.7,4,0,1.8,14,darkMat);const intake=box(3.2,1.15,5.6,0,.35,-1.8,darkMat);const lowerBody=box(3.8,.65,14,0,1.05,2.5,bodyMat);
wing([[2,-7],[18,5],[18,8],[4,4],[2,6]],bodyMat);wing([[-2,-7],[-18,5],[-18,8],[-4,4],[-2,6]],bodyMat);
wing([[0,10],[7,17],[7,19],[0,16]],paleMat);wing([[0,10],[-7,17],[-7,19],[0,16]],paleMat);
const tail=new THREE.Mesh(new THREE.BufferGeometry(),bodyMat); const vertices=new Float32Array([-1,2,10,1,2,10,0,10,17,-1,2,10,0,10,17,0,2,19]);tail.geometry.setAttribute('position',new THREE.BufferAttribute(vertices,3));tail.geometry.computeVertexNormals();tail.material.side=THREE.DoubleSide;jet.add(tail);
const canopy=new THREE.Mesh(new THREE.SphereGeometry(2.25,16,12),new THREE.MeshStandardMaterial({color:'#19354e',metalness:.5,roughness:.15,transparent:true,opacity:.86}));canopy.scale.set(.86,.55,2.1);canopy.position.set(0,3.5,-5.3);jet.add(canopy);
// Recognizable single-engine, single-tail fighter silhouette: dorsal spine, stabilizers and wingtip rails.
const spine=box(1.1,.7,15,0,2.6,5,paleMat);spine.rotation.x=-.02;
for(const side of [-1,1]){
 const st=new THREE.Mesh(new THREE.BoxGeometry(5.8,.18,2.2),paleMat);st.position.set(side*5.2,2.3,15.3);st.rotation.y=side*.19;jet.add(st);
 const rail=new THREE.Mesh(new THREE.CylinderGeometry(.16,.16,6,10),darkMat);rail.rotation.x=Math.PI/2;rail.position.set(side*17.2,.5,6.2);jet.add(rail);
}
// Additional fighter-specific silhouette details and purposeful material variations.
const stripeMat=new THREE.MeshStandardMaterial({color:0x3b515f,metalness:.45,roughness:.43,side:THREE.DoubleSide});
const accentMat=new THREE.MeshStandardMaterial({color:0xc3ced1,metalness:.42,roughness:.42,side:THREE.DoubleSide});
function panel(x,y,z,w,h,d,material=accentMat){const v=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);v.position.set(x,y,z);jet.add(v);return v;}
for(const side of [-1,1]){
  panel(side*9.3,.34,4.8,8.2,.07,.65,stripeMat);
  panel(side*14.0,.34,7.5,2.2,.08,1.5,accentMat);
  // Air-to-air training rails are empty: no real weapon behavior is modeled.
  panel(side*2.1,1.9,13.9,2.4,.33,4.4,paleMat);
  const stab=panel(side*5,2.5,14.8,6,.12,3.3,accentMat);stab.rotation.y=side*.16;
}
// Engine nozzle petals and visible tailplane control surfaces.
const nozzleRing=new THREE.Mesh(new THREE.TorusGeometry(1.45,.22,12,28),new THREE.MeshStandardMaterial({color:0x272f34,metalness:.9,roughness:.28}));nozzleRing.position.set(0,1.8,17.5);jet.add(nozzleRing);
const wingtipLights=[];
for(const side of [-1,1]){const lamp=new THREE.Mesh(new THREE.SphereGeometry(.38,10,8),new THREE.MeshBasicMaterial({color:side<0?0xff4e50:0x56f4ae}));lamp.position.set(side*17.5,.46,6.8);jet.add(lamp);wingtipLights.push(lamp);}
const landingLights=new THREE.PointLight(0xfff2d2,0,120);landingLights.position.set(0,.8,-12);jet.add(landingLights);
const plumeMat=new THREE.MeshBasicMaterial({color:'#ffb158',transparent:true,opacity:.42,depthWrite:false,blending:THREE.AdditiveBlending});
const plume=new THREE.Mesh(new THREE.ConeGeometry(1.3,12,20),plumeMat);plume.rotation.x=Math.PI/2;plume.position.set(0,1.8,22);jet.add(plume);
const exhaust=new THREE.PointLight('#f5ad60',0,25);exhaust.position.set(0,1.8,17);jet.add(exhaust);
// Procedural animated aircraft surfaces; these follow actual flight-control commands.
const controlSurfaceMat=new THREE.MeshStandardMaterial({color:'#bec9d1',metalness:.7,roughness:.4,side:THREE.DoubleSide});
function controlSurface(x,z,w,d){const pivot=new THREE.Group();pivot.position.set(x,.34,z);const surface=new THREE.Mesh(new THREE.BoxGeometry(w,.12,d),controlSurfaceMat);surface.position.z=d*.42;pivot.add(surface);jet.add(pivot);return pivot;}
const leftAileron=controlSurface(-12,5.8,6,2.4),rightAileron=controlSurface(12,5.8,6,2.4);
const leftElevator=controlSurface(-5.4,16.8,4.4,2),rightElevator=controlSurface(5.4,16.8,4.4,2);
const rudderPivot=new THREE.Group();rudderPivot.position.set(0,5.8,16);const rudderSurface=new THREE.Mesh(new THREE.BoxGeometry(.18,4.1,1.4),controlSurfaceMat);rudderSurface.position.set(0,1.3,0);rudderPivot.add(rudderSurface);jet.add(rudderPivot);
const jetNavigationLights=[];
for(const [x,color] of [[-17.4,0xe3474c],[17.4,0x63ef85]]){const light=new THREE.Mesh(new THREE.SphereGeometry(.45,10,8),new THREE.MeshBasicMaterial({color}));light.position.set(x,.7,5.7);jet.add(light);jetNavigationLights.push(light);}
// This gear is a visible training representation, not a detailed replica of F-16 landing gear.
const gearVisual=new THREE.Group();jet.add(gearVisual);
const tireMat=new THREE.MeshStandardMaterial({color:0x151d25,roughness:.92});
for(const [x,z] of [[0,-7],[-2.2,6],[2.2,6]]){const strut=new THREE.Mesh(new THREE.CylinderGeometry(.13,.13,2,8),controlSurfaceMat);strut.position.set(x,.0,z);gearVisual.add(strut);const tire=new THREE.Mesh(new THREE.TorusGeometry(.58,.25,8,12),tireMat);tire.rotation.y=Math.PI/2;tire.position.set(x,-1,z);gearVisual.add(tire);}


// V7: entirely rebuilt aircraft skin, with sculpted longitudinal cross-sections.
// The old low-poly body is hidden; flight controls, animated gear, navigation lights,
// and engine effects continue to use the existing flight-state variables.
{
 const kept=new Set([leftAileron,rightAileron,leftElevator,rightElevator,rudderPivot,gearVisual,plume,exhaust,landingLights,...jetNavigationLights]);
 for(const child of [...jet.children]) if(!kept.has(child)) child.visible=false;
 const skin=new THREE.Group();jet.add(skin);
 const silver=new THREE.MeshStandardMaterial({color:0x8296a1,metalness:.72,roughness:.33});
 const armor=new THREE.MeshStandardMaterial({color:0x536977,metalness:.68,roughness:.41});
 const upper=new THREE.MeshStandardMaterial({color:0x99aab1,metalness:.6,roughness:.42});
 const pale=new THREE.MeshStandardMaterial({color:0xb3bdc1,metalness:.52,roughness:.49});
 const black=new THREE.MeshStandardMaterial({color:0x101a23,metalness:.62,roughness:.25});
 const glass=new THREE.MeshPhysicalMaterial({color:0x102a3b,metalness:.47,roughness:.12,transparent:true,opacity:.93,clearcoat:1,clearcoatRoughness:.08});
 const yellow=new THREE.MeshBasicMaterial({color:0xdfc886});
 function add(mesh,x=0,y=0,z=0){mesh.position.set(x,y,z);skin.add(mesh);return mesh;}
 function profile(name,rings,mat){
  const P=[],N=[],UV=[],idx=[],ns=24;
  for(let r=0;r<rings.length;r++){const [z,w,h,cy]=rings[r];for(let j=0;j<ns;j++){const a=j/ns*Math.PI*2;P.push(Math.cos(a)*w,cy+Math.sin(a)*h,z);UV.push(j/ns,r/(rings.length-1));}}
  for(let r=0;r<rings.length-1;r++)for(let j=0;j<ns;j++){const a=r*ns+j,b=r*ns+(j+1)%ns,c=(r+1)*ns+j,d=(r+1)*ns+(j+1)%ns;idx.push(a,b,c,b,d,c);}
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(P,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(UV,2));geo.setIndex(idx);geo.computeVertexNormals();const m=new THREE.Mesh(geo,mat);m.name=name;skin.add(m);return m;
 }
 // Forward axis is -Z, and all dimensions share existing camera/physics units.
 profile('F16 sculpted fuselage',[
  [-22.5,.05,.07,2.25],[-20.5,.52,.48,2.25],[-17.5,1.18,.8,2.26],[-13,1.9,1.05,2.22],
  [-9,2.2,1.2,2.15],[-5,2.38,1.36,2.07],[0,2.6,1.35,2.0],[5,2.62,1.36,1.92],
  [11,2.2,1.22,1.95],[15,1.95,1.12,1.98],[18.5,1.50,.84,1.88]
 ],silver);
 profile('radome',[
  [-23,.02,.03,2.27],[-22.4,.14,.15,2.27],[-21.5,.4,.39,2.28],[-20.4,.66,.57,2.28]
 ],armor);
 profile('dorsal spine',[[0,.75,.23,3.24],[4,1,.4,3.36],[9,.85,.53,3.40],[13,.22,.14,3.07]],upper);
 profile('underslung chin intake',[[ -8,.95,.5,.55],[-6,1.42,.66,.52],[-2,1.55,.69,.46],[1,1.32,.48,.51]],black);
 const intakeLip=new THREE.Mesh(new THREE.TorusGeometry(1.38,.16,12,32),pale);intakeLip.scale.set(1,.48,1);intakeLip.rotation.x=Math.PI/2;add(intakeLip,0,.55,-7.8);
 // Wing polygons extruded to thickness; deliberately swept for a recognizably F-16 outline.
 function planePoly(points,y,mat,thickness=.18){
  const sh=new THREE.Shape();sh.moveTo(points[0][0],-points[0][1]);for(let i=1;i<points.length;i++)sh.lineTo(points[i][0],-points[i][1]);sh.closePath();
  const g=new THREE.ExtrudeGeometry(sh,{depth:thickness,bevelEnabled:false,curveSegments:1});g.rotateX(-Math.PI/2);
  return add(new THREE.Mesh(g,mat),0,y,0);
 }
 for(const side of [-1,1]){
  const pol=p=>p.map(([x,z])=>[x*side,z]);
  planePoly(pol([[2,-7],[6,-4],[18,4.5],[18.3,7.1],[8.8,5.9],[3.4,8.6]]),2.05,upper,.34);
  planePoly(pol([[3,1],[7.3,3.4],[14.9,5.1],[15,5.55],[7,4.9]]),2.27,armor,.04);
  planePoly(pol([[2.2,11],[7.8,15.9],[8.2,17.6],[3.1,17.2],[1.8,15.7]]),2.16,pale,.23);
  // Wing root and small swept strakes.
  planePoly(pol([[2,-9],[4.1,-6.6],[6.8,-2.8],[3.1,-2.9]]),2.19,armor,.18);
  // External wingtip missile rails in a non-weaponized, visual-only configuration.
  const rail=new THREE.Mesh(new THREE.CylinderGeometry(.12,.16,5.3,12),pale);rail.rotation.x=Math.PI/2;add(rail,side*18.25,2.11,5.3);
  const tip=new THREE.Mesh(new THREE.ConeGeometry(.15,.7,10),upper);tip.rotation.x=-Math.PI/2;add(tip,side*18.25,2.11,2.3);
  // Thin navigation markings and upper-surface aircraft insignia.
  const stripe=new THREE.Mesh(new THREE.BoxGeometry(6.8,.025,.18),armor);stripe.rotation.y=-side*.27;add(stripe,side*11,2.55,4.3);
 }
 // Vertical tail: custom wedge with a genuine swept leading edge.
 function triangleFin(){const v=new Float32Array([-0.22,2.6,10.3,-.22,10.8,17.2,-.22,2.6,19.1,.22,2.6,10.3,.22,10.8,17.2,.22,2.6,19.1]);const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(v,3));g.setIndex([0,1,2,3,5,4,0,3,4,0,4,1,1,4,5,1,5,2]);g.computeVertexNormals();skin.add(new THREE.Mesh(g,upper));}triangleFin();
 const tailMark=new THREE.Mesh(new THREE.PlaneGeometry(2.1,1.2),armor);tailMark.rotation.y=Math.PI/2;add(tailMark,.26,6.1,15.9);
 // Cockpit bubble and recognizable canopy frames.
 const bubble=new THREE.Mesh(new THREE.SphereGeometry(1,32,16),glass);bubble.scale.set(1.65,.91,4.85);add(bubble,0,3.31,-7.8);
 const coaming=new THREE.Mesh(new THREE.BoxGeometry(3.1,.12,7.6),black);add(coaming,0,2.79,-7.5);
 const frameMat=new THREE.MeshStandardMaterial({color:0x3f5561,metalness:.82,roughness:.27});
 for(const z of [-11.5,-3.7]){const bar=new THREE.Mesh(new THREE.TorusGeometry(1.64,.08,7,32,Math.PI),frameMat);bar.rotation.x=Math.PI/2;bar.scale.set(1,.58,1);add(bar,0,3.31,z);}
 const pilotHead=new THREE.Mesh(new THREE.SphereGeometry(.45,12,10),black);add(pilotHead,0,3.4,-7.7);
 const helmet=new THREE.Mesh(new THREE.SphereGeometry(.48,16,12),pale);helmet.scale.set(1,.7,.92);add(helmet,0,3.68,-7.7);
 // Rear turbine with concentric petals and variable afterburner glow.
 const nozzle=new THREE.Mesh(new THREE.CylinderGeometry(1.39,1.52,3.3,32,1,true),black);nozzle.rotation.x=Math.PI/2;add(nozzle,0,1.89,18);
 for(let i=0;i<18;i++){const a=i*Math.PI*2/18;const petal=new THREE.Mesh(new THREE.BoxGeometry(.37,.13,2.5),armor);petal.position.set(Math.sin(a)*1.46,1.89+Math.cos(a)*1.46,18.1);petal.rotation.z=-a;skin.add(petal);}
 const ring=new THREE.Mesh(new THREE.TorusGeometry(1.34,.11,12,36),pale);add(ring,0,1.89,19.2);
 const numbers=new THREE.Mesh(new THREE.PlaneGeometry(2.2,.44),yellow);numbers.rotation.x=-Math.PI/2;numbers.position.set(0,3.36,6);numbers.visible=false;skin.add(numbers);
 skin.name='F-16-inspired premium procedural airframe';
}

// V7 atmosphere: sky shader follows camera, so the horizon has depth at every altitude.
const atmosphere=new THREE.Mesh(new THREE.SphereGeometry(20000,48,24),new THREE.ShaderMaterial({
  side:THREE.BackSide,depthWrite:false,uniforms:{uLight:{value:.9},uSun:{value:new THREE.Vector3(-.5,.18,-.85)}},
  vertexShader:`varying vec3 vRay;void main(){vRay=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader:`varying vec3 vRay;uniform float uLight;uniform vec3 uSun;void main(){vec3 ray=normalize(vRay);float elev=clamp(ray.y*.72+.34,0.,1.);vec3 zenith=mix(vec3(.014,.03,.08),vec3(.10,.24,.43),uLight);vec3 mid=mix(vec3(.19,.16,.18),vec3(.56,.69,.82),uLight);vec3 horizon=mix(vec3(.82,.63,.48),vec3(.88,.92,.98),uLight);vec3 col=mix(horizon,mid,smoothstep(.0,.22,elev));col=mix(col,zenith,smoothstep(.22,.95,elev));float sunAmt=max(0.,dot(ray,normalize(uSun)));float glow=pow(sunAmt,36.);float halo=pow(sunAmt,8.);col+=vec3(1.05,.68,.34)*glow*uLight;col+=vec3(.42,.23,.08)*halo*.25*uLight;float haze=pow(1.-max(0.,ray.y),3.);col=mix(col,vec3(.85,.84,.82),haze*.10*(1.-uLight*.2));gl_FragColor=vec4(col,1.);}`
}));atmosphere.renderOrder=-100;scene.add(atmosphere);
// V7 ground-scale cues: runway lights and tree canopy silhouettes are InstancedMesh, one draw call per species.
{
 const treeMat=new THREE.MeshStandardMaterial({color:0x2d4a42,roughness:1,flatShading:true});
 const trunks=new THREE.InstancedMesh(new THREE.CylinderGeometry(.8,1.3,8,5),new THREE.MeshStandardMaterial({color:0x453e38}),850);
 const canopy=new THREE.InstancedMesh(new THREE.ConeGeometry(8,24,6),treeMat,850);
 const dummy=new THREE.Object3D();let seed=948127;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
 for(let i=0;i<850;i++){const x=(random()-.5)*13000,z=(random()-.5)*18000;const ax=Math.abs(x);const y=ridge(x,z)-1;dummy.position.set(x,y+7,z);dummy.rotation.y=random()*6.28;const sc=.65+random()*1.5;dummy.scale.set(sc,sc,sc);dummy.updateMatrix();trunks.setMatrixAt(i,dummy.matrix);dummy.position.y=y+22*sc;dummy.scale.set(sc,sc,sc);dummy.updateMatrix();canopy.setMatrixAt(i,dummy.matrix);}
 trunks.instanceMatrix.needsUpdate=true;canopy.instanceMatrix.needsUpdate=true;scene.add(trunks,canopy);
}

// Wing vapor trails: procedural meshes following the moving aircraft.
const contrailHistory=[[],[]],contrailObjects=[];
for(let side=0;side<2;side++){
 const geo=new THREE.BufferGeometry();const buffer=new Float32Array(64*3);geo.setAttribute('position',new THREE.BufferAttribute(buffer,3));
 const mesh=new THREE.Line(geo,new THREE.LineBasicMaterial({color:0xf0f8ff,transparent:true,opacity:.43,depthWrite:false}));mesh.frustumCulled=false;scene.add(mesh);contrailObjects.push(mesh);
}
let contrailTick=0;
function updateContrails(){
 if(!s.airborne||s.speed<85){contrailHistory.forEach(a=>a.length=0);contrailObjects.forEach(o=>o.visible=false);return;}
 contrailTick++;
 if(contrailTick%2===0) for(let side=0;side<2;side++){
   const pt=new THREE.Vector3(side===0?-15:15,2,5).applyEuler(jet.rotation).add(jet.position);
   contrailHistory[side].unshift(pt);if(contrailHistory[side].length>64)contrailHistory[side].pop();
 }
 contrailObjects.forEach((o,i)=>{const pts=contrailHistory[i];o.visible=pts.length>1;o.geometry.setFromPoints(pts);});
}
// Coordinates must be initialized before creating station meshes.
const snowStations=[{x:920,z:-4900,alt:300},{x:-1100,z:-8400,alt:410},{x:1100,z:-12200,alt:340}];
// Three interactive icy research stations: exploration bonus, not weapons.
const snowStationMeshes=snowStations.map((p,i)=>{
 const group=new THREE.Group();const iceMat=new THREE.MeshPhysicalMaterial({color:0x9cecf2,emissive:0x0a647f,emissiveIntensity:.8,metalness:.2,roughness:.23,transparent:true,opacity:.84});
 const core=new THREE.Mesh(new THREE.OctahedronGeometry(54,0),iceMat);core.scale.set(.7,1.5,.7);group.add(core);
 const ring=new THREE.Mesh(new THREE.TorusGeometry(84,4,12,48),new THREE.MeshBasicMaterial({color:0x8adff7,transparent:true,opacity:.65}));ring.rotation.x=Math.PI/2;group.add(ring);
 const pole=new THREE.Mesh(new THREE.CylinderGeometry(2,2,155,8),new THREE.MeshBasicMaterial({color:0xc4f3ff,transparent:true,opacity:.34}));pole.position.y=-74;group.add(pole);
 group.position.set(p.x,p.alt,p.z);scene.add(group);return group;
});
// Huge fictional airborne drone target (no real-world equipment modeled).
const beaconMeshes=rangeTargets.map((target)=>{
 const g=new THREE.Group();
 const aura=new THREE.Mesh(new THREE.TorusGeometry(118,9,14,100),new THREE.MeshBasicMaterial({color:0xffbd58,transparent:true,opacity:.9,side:THREE.DoubleSide}));g.add(aura);
 const body=new THREE.Mesh(new THREE.IcosahedronGeometry(65,1),new THREE.MeshStandardMaterial({color:0x354c6a,metalness:.55,roughness:.3,emissive:0x3d2443,emissiveIntensity:.55}));g.add(body);
 for(let j=0;j<4;j++){const blade=new THREE.Mesh(new THREE.BoxGeometry(135,9,14),new THREE.MeshBasicMaterial({color:0xf7b35a}));blade.rotation.z=j*Math.PI/4;g.add(blade);}
 const beacon=new THREE.PointLight(0xffaf5f,4,600);g.add(beacon);
 g.position.set(target.x,target.alt,target.z);scene.add(g);return g;
});
const gateGroups=gates.map((gate,i)=>{
 const g=new THREE.Group();const outer=new THREE.Mesh(new THREE.TorusGeometry(gate.radius*.70,9,16,112),new THREE.MeshBasicMaterial({color:0x64f5ec,transparent:true,opacity:.84,side:THREE.DoubleSide}));
 g.add(outer);
 const inner=new THREE.Mesh(new THREE.TorusGeometry(gate.radius*.58,2.5,10,96),new THREE.MeshBasicMaterial({color:0xf4df9a,transparent:true,opacity:.65}));g.add(inner);
 for(let a=0;a<12;a++){const tick=new THREE.Mesh(new THREE.BoxGeometry(5,24,4),new THREE.MeshBasicMaterial({color:0xbfffee}));tick.position.set(Math.cos(a/12*Math.PI*2)*gate.radius*.71,Math.sin(a/12*Math.PI*2)*gate.radius*.71,0);tick.rotation.z=a/12*Math.PI*2;g.add(tick);}
 g.position.set(gate.x,gate.alt,gate.z);scene.add(g);return g;
});
const pulseMeshes=[];
const markerMeshes=[];
const hitEffects=[];
function spawnTrainingImpact(pos){
 const group=new THREE.Group();group.position.copy(pos);scene.add(group);
 const materials=[0xa6faff,0xfaa568,0xfdf7d8].map(c=>new THREE.MeshBasicMaterial({color:c,transparent:true,opacity:.88,depthWrite:false,side:THREE.DoubleSide}));
 const rings=materials.map((mat,i)=>{const mesh=new THREE.Mesh(new THREE.TorusGeometry(36+i*10,4.5,10,48),mat);mesh.rotation.x=Math.PI/2;group.add(mesh);return mesh;});
 const glow=new THREE.Mesh(new THREE.SphereGeometry(40,16,12),new THREE.MeshBasicMaterial({color:0xffe5b2,transparent:true,opacity:.68,depthWrite:false}));group.add(glow);
 hitEffects.push({group,rings,glow,ttl:2.1,max:2.1,materials});
}
function updateTrainingImpacts(dt){
 for(let i=hitEffects.length-1;i>=0;i--){const fx=hitEffects[i];fx.ttl-=dt;const t=1-fx.ttl/fx.max;
 fx.rings.forEach((o,j)=>{o.scale.setScalar(1+t*(8+j*2));o.material.opacity=Math.max(0,(1-t)*(j===0?.9:.65));});fx.glow.scale.setScalar(1+t*5);fx.glow.material.opacity=Math.max(0,.65*(1-t));
 if(fx.ttl<=0){scene.remove(fx.group);fx.group.traverse(o=>{o.geometry?.dispose();if(o.material)o.material.dispose();});hitEffects.splice(i,1);}
 }
}

function deployMarker(){if(!s.airborne)return;const mesh=new THREE.Mesh(new THREE.TorusGeometry(20,1.5,10,48),new THREE.MeshBasicMaterial({color:0xffe0a2,transparent:true,opacity:.8,side:THREE.DoubleSide}));mesh.position.set(s.x,s.alt,s.z);scene.add(mesh);markerMeshes.push(mesh);}

function lockTarget(){
 if(mission.stage!==2){instructor('Finish the four sky rings first. Target practice unlocks afterward.');return;}
 if(!s.airborne){instructor('Target practice needs an airborne aircraft.');return;}
 const p=rangeTargets[0];if(!p){instructor('Training target unavailable. Restart the mission.');return;}const distance=Math.hypot(s.x-p.x,s.alt-p.alt,s.z-p.z);
 if(distance>14000){instructor(`Target is ${Math.round(distance)} m away. Fly closer than 14,000 m.`);return;}
 const v=targetScreenDirection();
 if(!v.inFront){instructor('Turn the nose toward the purple drone. The HUD arrow can help.');return;}
 const err=Math.hypot(v.x-aimHorizontal,v.y-aimVertical);
 if(err>.48){instructor(`AIM FIRST · Move Faders 3 and 4 until ✛ overlaps ◇. Offset ${Math.round(err*100)}%.`);return;}
 targetLocked=true;instructor('TARGET LOCK CONFIRMED ✓ Press PAD B6 or KEY 23 to launch a fictional training missile.');
}
function targetScreenDirection(){
 const p=rangeTargets[0];if(!p)return {x:0,y:0,inFront:false};const world=new THREE.Vector3(p.x,p.alt,p.z);
 const projected=world.clone().project(camera);
 const forward=new THREE.Vector3();camera.getWorldDirection(forward);
 return {x:THREE.MathUtils.clamp(projected.x,-1.4,1.4),y:THREE.MathUtils.clamp(projected.y,-1.4,1.4),inFront:world.clone().sub(camera.position).dot(forward)>0};
}
function scanIceBeacon(){
 if(!s.airborne){instructor('Take off first. Ice station scanning is an aerial mission.');return;}
 const nearest=snowStations.map((p,i)=>({i,d:Math.hypot(s.x-p.x,s.alt-p.alt,s.z-p.z)})).filter(v=>!scannedBeacons.has(v.i)).sort((a,b)=>a.d-b.d)[0];
 if(!nearest){instructor('All 3 snow stations scanned! Exploration challenge complete.');return;}
 if(nearest.d>2200){instructor(`SNOW SCAN · Fly nearer station ${nearest.i+1} (${Math.round(nearest.d)} m). Key 24 or PAD A8 hint can help.`);return;}
 scannedBeacons.add(nearest.i);scanCount=scannedBeacons.size;markersDropped=scanCount;
 mission.score+=350;instructor(`SNOW STATION ${nearest.i+1}/3 SCANNED · +350 points! ${scanCount}/3 scans completed.`);
}
function updateTargetAimHUD(){
 const active=mission.stage===2&&!completedTargets.has(0);$('#aimHUD').classList.toggle('hidden',!active);
 if(!active)return;
 const objectiveTarget=rangeTargets[0];if(!objectiveTarget)return;const aim=targetScreenDirection(),distance=Math.round(Math.hypot(s.x-objectiveTarget.x,s.alt-objectiveTarget.alt,s.z-objectiveTarget.z));
 $('#aimCursor').style.left=`${Math.round((aimHorizontal+1)*50)}%`;$('#aimCursor').style.top=`${Math.round((1-aimVertical)*50)}%`;
 $('#aimTarget').style.left=`${Math.round((aim.x+1)*50)}%`;$('#aimTarget').style.top=`${Math.round((1-aim.y)*50)}%`;
 const err=Math.hypot(aim.x-aimHorizontal,aim.y-aimVertical);
 const ready=aim.inFront&&distance<=14000&&err<=.48;
 $('#aimHUD').classList.toggle('aligned',ready||targetLocked);$('#aimStatus').textContent=targetLocked?'LOCKED · PRESS PAD B6 TO FIRE':!aim.inFront?'TARGET BEHIND · TURN TOWARD IT':distance>14000?`APPROACH TARGET · ${distance} m / 14,000 m`:(ready?'ON TARGET · PAD B5 TO LOCK':'MOVE FADERS 3+4 · ALIGN ✛ WITH ◇');
}
function firePulse(){
 if(mission.stage!==2){instructor('Complete all four giant rings first to unlock the missile challenge.');return;}
 if(!s.airborne){instructor('Take off before launching the fictional game missile.');return;}
 if(!targetLocked){instructor('Press PIANO KEY 22 to lock the giant glowing target first.');return;}
 if(missileFlight||completedTargets.has(0)){instructor('The giant target is already engaged.');return;}
 const tgt=rangeTargets[0];if(!tgt){instructor('Training target unavailable. Restart the mission.');return;}const distance=Math.hypot(s.x-tgt.x,s.alt-tgt.alt,s.z-tgt.z);
 if(distance>14000){instructor(`Move closer to the target: ${Math.round(distance)} m away. Launch range for this arcade mission: 14000 m.`);return;}
 const geo=new THREE.CylinderGeometry(2.6,2.6,28,12);const mat=new THREE.MeshStandardMaterial({color:0xe4eaf3,metalness:.55,roughness:.25,emissive:0xf5b65b,emissiveIntensity:.22});
 const missile=new THREE.Group();const fuselage=new THREE.Mesh(geo,mat);missile.add(fuselage);
 const nose=new THREE.Mesh(new THREE.ConeGeometry(2.6,9,12),mat);nose.position.y=18.5;missile.add(nose);
 const finMat=new THREE.MeshStandardMaterial({color:0xcdd7de,metalness:.38,roughness:.5});
 for(const side of [-1,1]){const fin=new THREE.Mesh(new THREE.BoxGeometry(6,.5,2.2),finMat);fin.position.set(side*2.8,-3.2,0);missile.add(fin);}
 const flame=new THREE.Mesh(new THREE.ConeGeometry(3,18,12),new THREE.MeshBasicMaterial({color:0xffa548,transparent:true,opacity:.88}));flame.position.y=-22;flame.rotation.x=Math.PI;missile.add(flame);
 const trail=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3(0,-6,0)]),new THREE.LineBasicMaterial({color:0xf9efe2,transparent:true,opacity:.75}));trail.frustumCulled=false;missile.add(trail);
 missile.position.copy(jet.localToWorld(new THREE.Vector3(6.3,-1.1,5.5)));scene.add(missile);
 missileFlight={mesh:missile,start:missile.position.clone(),target:new THREE.Vector3(tgt.x,tgt.alt,tgt.z),progress:0,trail};
 mission.missileLaunched=true;mission.shots++;pulsesFired++;instructor('MISSILE AWAY! Cinematic arcade missile en route to the giant drone.');
}
function updateRange(dt){
 updateTrainingImpacts(dt);
 beaconMeshes.forEach((group,i)=>{group.visible=mission.stage===2&&!completedTargets.has(i);group.rotation.y+=dt*.24;group.children[0].rotation.z+=dt*.28;});
 if(missileFlight){
   const f=missileFlight;f.progress=Math.min(1,f.progress+dt/3.2);
   const curve=f.progress*f.progress*(3-2*f.progress);
   const arc=Math.sin(f.progress*Math.PI)*Math.max(90,Math.hypot(f.start.x-f.target.x,f.start.z-f.target.z)*.06);
   f.mesh.position.lerpVectors(f.start,f.target,curve);
   f.mesh.position.y+=arc;
   const toward=f.target.clone().sub(f.mesh.position).normalize();f.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),toward);
   if(f.trail){const p1=new THREE.Vector3(0,-6,0),p2=new THREE.Vector3(0,-22,0);f.trail.geometry.setFromPoints([p1,p2]);}
   if(f.progress>=1){scene.remove(f.mesh);f.mesh.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material)o.material.dispose();});missileFlight=null;spawnTrainingImpact(f.target);completedTargets.add(0);targetsScored=1;beaconHit(mission,0);explosionTime=2.8;instructor('DIRECT HIT! Giant fictional target cleared. Return to base for an optional landing bonus.');}
 }
 const target=beaconMeshes[0];if(explosionTime>0){explosionTime=Math.max(0,explosionTime-dt);target.visible=true;target.scale.setScalar(1+(2-explosionTime)*2.5);target.children[0].material.opacity=Math.max(.05,explosionTime*.45);if(explosionTime===0){target.visible=false;target.scale.setScalar(1);}}
 $('#rangeTarget').textContent=mission.stage===2?(targetLocked?'TARGET LOCKED · KEY 23 TO LAUNCH':'KEY 22 → LOCK GIANT DRONE'):'MISSILE MISSION · AFTER RINGS';
 $('#rangeMetrics').textContent=`ARCADE MISSILES ${pulsesFired} · GIANT TARGET ${targetsScored}/1 · SNOW SCANS ${scannedBeacons.size}/3`;
}
function updateReturnAssist(dt){
 if(mission.stage!==3||!s.airborne||s.crashed){returnAssist=false;$('#assistHome').classList.remove('active');return;}
 const guidance=returnGuide(s,returnState);
 if(guidance.phase==='final'&&Math.abs(s.x)>60&&Math.abs(s.z)<1300)instructorWarning('ALIGNING TO RUNWAY · Beginner assistance correcting cross-track error.');
}
let warningCooldown=0;
function instructorWarning(msg){if(performance.now()-warningCooldown>6500){warningCooldown=performance.now();$('#stepFeedback').textContent=msg;}}
function applyHeldKeys(dt){
 if(!heldNotes.size)return;
 const pressedNames=[];
 const move=(a,b,oldVal)=>heldNotes.has(a)&&!heldNotes.has(b)?1:heldNotes.has(b)&&!heldNotes.has(a)?-1:oldVal;
 const pitch=move(0,1,0),roll=move(3,2,0),yaw=move(5,4,0);
 if(returnAssist&&[0,1,2,3,4,5].some(i=>heldNotes.has(i))){returnAssist=false;$('#assistHome').classList.remove('active');instructor('Manual control resumed from piano keys.');}
 if(heldNotes.has(0)||heldNotes.has(1)){keyPitchActive=true;s.pitchInput=clamp(s.pitchInput+pitch*dt*(s.beginner?.62:1.7),-1,1);}else if(keyPitchActive&&s.beginner){s.pitchInput*=Math.exp(-dt*1.2);if(Math.abs(s.pitchInput)<.015){s.pitchInput=0;keyPitchActive=false;}}
 if(heldNotes.has(2)||heldNotes.has(3)){keyRollActive=true;s.rollInput=clamp(s.rollInput+roll*dt*(s.beginner?.55:1.9),-1,1);}else if(keyRollActive&&s.beginner){s.rollInput*=Math.exp(-dt*2.1);if(Math.abs(s.rollInput)<.015){s.rollInput=0;keyRollActive=false;}}
 if(heldNotes.has(4)||heldNotes.has(5))s.yawInput=clamp(s.yawInput+yaw*dt*(s.beginner?.65:1.8),-1,1);
 if(heldNotes.has(6))s.airbrake=clamp(s.airbrake+dt*2,0,1);
 if(heldNotes.has(7)&&s.engine)s.throttle=clamp(s.throttle+dt*.9,0,1);
 for(const idx of heldNotes)pressedNames.push(keyActions[idx]);
 $('#inputHUD').textContent='MIDI KEY HELD · '+pressedNames.join(' / ');
}
function updateMissionWorld(dt){
 snowStationMeshes.forEach((g,i)=>{g.visible=!scannedBeacons.has(i);g.rotation.y+=dt*.11;g.children[0].rotation.z+=dt*.07;});
 gateGroups.forEach((g,i)=>{g.visible=i>=mission.gatesPassed&&mission.stage===1;g.rotation.z+=dt*.10;if(i===mission.gatesPassed){const v=1+Math.sin(elapsed*2.5)*.045;g.scale.setScalar(v);}});
 beaconMeshes.forEach((g,i)=>{g.visible=(mission.stage===2&&!completedTargets.has(i))||explosionTime>0;});
 const obj=objective(mission,s);
 $('#abObjective').textContent=obj.title;
 $('#abAction').textContent=obj.action;
 $('#abWhy').textContent=obj.why;
 $('#abScore').textContent=mission.score.toLocaleString().padStart(5,'0')+' PTS';$('#mastery').textContent=`MINILAB LIVE · ${usedKeys.size}/25 KEYS · ${usedPads.size}/16 PAD ACTIONS · ${usedControls.size}/14 ANALOG INPUTS`;$('#skillCount').textContent=`${usedKeys.size+usedPads.size+usedControls.size} / 55`;$('#skillFill').style.width=`${Math.round((usedKeys.size+usedPads.size+usedControls.size)/55*100)}%`;$('#ringBadge').textContent=`RINGS ${mission.gatesPassed}/4 · SNOW SCANS ${scannedBeacons.size}/3 · COMBOS ${mission.skills.length}/3`;const nearStation=snowStations.map((p,i)=>({i,d:Math.hypot(s.x-p.x,s.alt-p.alt,s.z-p.z)})).filter(v=>!scannedBeacons.has(v.i)).sort((a,b)=>a.d-b.d)[0];$('#snowHint').textContent=nearStation?`ALPINE SCAN · STATION ${nearStation.i+1} ${Math.round(nearStation.d)} m · KEY 24 WITHIN 2,200 m · ${scannedBeacons.size}/3`:'ALPINE RESEARCH COMPLETE · ALL 3 ICE STATIONS SCANNED';$('#landingBadge').textContent=returnAssist?'RETURN ASSIST ON':s.gear?'GEAR DOWN':'GEAR UP';
 $('#abStatus').textContent=s.phase;
 $('#abFlightMode').textContent=demoRunning?'AUTOPILOT':s.beginner?'BEGINNER / MIDI':'ADVANCED / MIDI';
 const blocks=[...document.querySelectorAll('#abProgress i')];blocks.forEach((el,i)=>el.classList.toggle('active',mission.stage>i));
 if(mission.lastMessage!==lastMissionMessage){lastMissionMessage=mission.lastMessage;if(mission.stage>0&&mission.stage!==-1)instructor(mission.lastMessage);}
 if(mission.finished&&!completionShown){completionShown=true;$('#endScore').textContent=mission.score.toLocaleString();$('#endGates').textContent=`${mission.gatesPassed}/${gates.length}`;$('#endHits').textContent=`${mission.beaconsHit}/${rangeBeacons.length}`;$('#endMission').classList.remove('hidden');}
 if(obj.target){const dx=obj.target.x-s.x,dz=obj.target.z-s.z;const desired=(Math.atan2(dx,-dz)/RAD+360)%360;const current=(s.heading%360+360)%360;const bearing=((desired-current+540)%360)-180;const dist=Math.hypot(dx,dz,s.alt-obj.target.alt);$('#navLabel').textContent=mission.stage===1?'GIANT RING '+(mission.gatesPassed+1):mission.stage===2?'GIANT DRONE':'RETURN TO BASE';$('#navDistance').textContent=Math.round(dist)+' m';$('#navNeedle').style.transform=`rotate(${bearing}deg)`;$('#navigationUI').classList.remove('hidden');}
 else $('#navigationUI').classList.add('hidden');
}
function resize(){renderer.setSize(canvas.clientWidth,canvas.clientHeight,false);camera.aspect=canvas.clientWidth/Math.max(1,canvas.clientHeight);camera.updateProjectionMatrix();}window.addEventListener('resize',resize);
scene.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;if(o.material&&o.material.transparent)o.castShadow=false;}});
ground.receiveShadow=true;runway.receiveShadow=true;shoulder.receiveShadow=true;
const positionLerp=new THREE.Vector3(),lookAt=new THREE.Vector3();setView('chase');

// Recover from a malformed decorative mesh/material without losing the interactive
// flight scene. Try the original full scene first; fallback is used ONLY on error.
const optionalVisuals=[...clouds,...contrailObjects,atmosphere,...snowStationMeshes];
let isolatedVisuals=new Set();
function renderFlightWorld(){
 try{renderer.render(scene,camera);return;}
 catch(originalError){
  // Test optional scenery in progressively smaller sets. Keep this work to a
  // single recovery pass (not per-frame), and never hide the aircraft/runway.
  if(!renderFlightWorld.recovered){
   renderFlightWorld.recovered=true;
   const originallyVisible=optionalVisuals.map(o=>o.visible);
   optionalVisuals.forEach(o=>o.visible=false);
   try{
    renderer.render(scene,camera);
    // The core scene works: reintroduce scenery individually, isolating the offender.
    optionalVisuals.forEach((o,i)=>{
     o.visible=originallyVisible[i];
     if(!o.visible)return;
     try{renderer.render(scene,camera);}
     catch(e){o.visible=false;isolatedVisuals.add(o);console.warn('[AERONAUT] Disabled incompatible optional visual',o.name||o.type,e);}
    });
    if(isolatedVisuals.size)console.warn('[AERONAUT] Scene recovered by disabling',isolatedVisuals.size,'optional visual(s)');
    return;
   }catch(coreError){
    optionalVisuals.forEach((o,i)=>o.visible=originallyVisible[i]);
    console.error('[AERONAUT] Core scene also failed',coreError);
    throw originalError;
   }
  }
  throw originalError;
 }
}

let dtCamera=.016;function renderScene(){
 atmosphere.position.copy(camera.position);atmosphere.material.uniforms.uLight.value=sun;
 const daylight=.24+sun*.76;scene.background.setHSL(.57,.22,.44+daylight*.18);scene.fog.color.setHSL(.56,.14,.76+daylight*.08);scene.fog.density=s.alt>6000?0.000020:0.000038;sunLight.intensity=.95+sun*2.6;renderer.toneMappingExposure=1.02+sun*.26;
 followTerrain();const h=s.heading*RAD;jet.position.set(s.x,s.alt+2.5,s.z);jet.rotation.order='YXZ';jet.rotation.set(s.pitch*RAD,-h,-s.roll*RAD);
 if(stunt){const progress=1-stunt.remaining/stunt.duration;const angle=Math.PI*2*progress;const easing=.5-.5*Math.cos(Math.PI*2*progress);
   if(stunt.kind==='airbrake')jet.rotation.z-=angle;
   else if(stunt.kind==='trim')jet.rotation.x+=angle;
   else {jet.rotation.z-=angle*2;jet.rotation.x+=Math.sin(angle)*.16;jet.position.y+=Math.sin(Math.PI*progress)*22;}
 }

 exhaust.intensity=s.engine?(.4+s.throttle*4):0;landingLights.intensity=s.gear&&s.engine?1.2:0;plume.visible=s.engine&&s.throttle>.25;plume.scale.setScalar(.45+s.throttle*.9);plume.material.opacity=.15+s.throttle*.42;
 // Animate control surfaces by current flight model rather than arbitrary animation timers.
 leftAileron.rotation.x=THREE.MathUtils.lerp(leftAileron.rotation.x,-s.rollInput*.32,.12);
 rightAileron.rotation.x=THREE.MathUtils.lerp(rightAileron.rotation.x,s.rollInput*.32,.12);
 leftElevator.rotation.x=THREE.MathUtils.lerp(leftElevator.rotation.x,s.pitchInput*.28,.12);
 rightElevator.rotation.x=THREE.MathUtils.lerp(rightElevator.rotation.x,s.pitchInput*.28,.12);
 rudderPivot.rotation.y=THREE.MathUtils.lerp(rudderPivot.rotation.y,s.yawInput*.26,.12);
 gearVisual.visible=s.gear;
 jetNavigationLights.forEach((light,i)=>{light.visible=s.battery && Math.sin(elapsed*5+i*Math.PI)>.1;});
 const target=jet.position.clone();updateContrails();
 if(view==='cockpit'){const off=new THREE.Vector3(0,4.2,-9).applyEuler(jet.rotation);positionLerp.copy(target).add(off);lookAt.copy(positionLerp).add(new THREE.Vector3(-Math.sin(h)*300,s.pitch*2,-Math.cos(h)*300));}
 else if(view==='side'){positionLerp.copy(target).add(new THREE.Vector3(cameraDist,25,cameraDist));lookAt.copy(target);}
 else{const speedLift=Math.min(28,s.speed*.035);const behind=new THREE.Vector3(-Math.sin(h)*cameraDist,cameraDist*.20 + speedLift + Math.min(10,Math.abs(s.pitch)*.5),Math.cos(h)*cameraDist);positionLerp.copy(target).add(behind);lookAt.copy(target).add(new THREE.Vector3(-Math.sin(h)*(24+s.speed*.08),6+s.pitch*.25,-Math.cos(h)*(24+s.speed*.08)));}
 camera.position.lerp(positionLerp,1-Math.exp(-dtCamera*4.2));atmosphere.position.copy(camera.position);camera.position.y=Math.max(camera.position.y,4.8);camera.lookAt(lookAt);if(view==='chase'){camera.rotateZ(-s.roll*RAD*.045);}camera.fov+=( (view==='chase'?58+Math.min(16,s.speed/28):72)-camera.fov)*.06;camera.updateProjectionMatrix();camera.updateMatrixWorld();jet.visible=view!=='cockpit';updateTargetAimHUD();renderFlightWorld();
}
let last=performance.now(),uiTick=0;
function loop(now){requestAnimationFrame(loop);try{const dt=Math.min((now-last)/1000,.05);dtCamera=dt;last=now;if(!userStarted)return;
 if(replayMode){if(!replayPaused){replayTime+=dt;if(replayTime>=flightRecorder.duration()){replayTime=flightRecorder.duration();replayPaused=true;$('#replayFlight').textContent='▶ RESUME';}}
  Object.assign(s,flightRecorder.at(replayTime));$('#replaySeek').value=String(Math.round(100*replayTime/Math.max(.01,flightRecorder.duration())));
  renderScene();uiTick+=dt;if(uiTick>.12){updateUI();refreshScience();uiTick=0;}return;}
 if(demoRunning){demoClock+=dt;demoMessage=demoUpdate(s,demoClock);if(s.crashed||s.landings){demoRunning=false;$('#autoDemo').textContent='▶ REPLAY DEMO';instructor(s.landings?'Demo complete: successful touchdown.':'Demo ended: hard landing. Replay to practice.');}}
 if(!demoRunning&&pressed.has('w'))s.pitchInput=clamp(s.pitchInput+dt*.9,-1,1);if(!demoRunning&&pressed.has('s'))s.pitchInput=clamp(s.pitchInput-dt*.9,-1,1);if(!demoRunning&&pressed.has('a'))s.rollInput=clamp(s.rollInput-dt*.9,-1,1);if(!demoRunning&&pressed.has('d'))s.rollInput=clamp(s.rollInput+dt*.9,-1,1);if(!demoRunning&&pressed.has('arrowup'))s.throttle=clamp(s.throttle+dt*.45,0,1);if(!demoRunning&&pressed.has('arrowdown'))s.throttle=clamp(s.throttle-dt*.45,0,1);
 if(!demoRunning){applyHeldKeys(dt);if(returnAssist)updateReturnAssist(dt);checkSkillCombos(mission,s,heldNotes);}
 step(s,dt);if(stunt){stunt.remaining=Math.max(0,stunt.remaining-dt);if(stunt.remaining===0)stunt=null;}updateFlightLab(dt);if(flightRecorder.recording){recorderTick+=dt;if(recorderTick>=.05){flightRecorder.add(elapsed+dt,s);recorderTick=0;}}
 missionStep(mission,s,dt);if(mission.gatesPassed>lastGatesPassed){lastGatesPassed=mission.gatesPassed;flightRingFlash=1;$('#ringFlash').classList.add('show');}
 flightRingFlash=Math.max(0,flightRingFlash-dt);if(flightRingFlash===0)$('#ringFlash').classList.remove('show');updateRange(dt);engineAudioUpdate();elapsed+=dt;renderScene();uiTick+=dt;if(uiTick>.12){updateUI();refreshScience();updateMissionWorld(uiTick);uiTick=0;}
 }catch(err){showFlightError(err);}
}requestAnimationFrame(loop);
function updateUI(){
 const st=getStage();refreshTraining();if(st!==lastStage){lastStage=st;$('#lessonHelp').textContent=lessonDetails[st][0];$('#lessonScience').textContent=lessonDetails[st][1];$('#lessonScience').classList.add('expanded');$('#tryAction').textContent=(st===4?'SET 80% THROTTLE':st===5?'APPLY NOSE-UP PITCH':st===7?'APPLY GENTLE BANK':'TRY THIS ACTION');$('#missionTitle').textContent=stages[st][0];$('#missionDesc').textContent=stages[st][1];$('#stageNum').textContent=String(st+1).padStart(2,'0');$('#stageLabel').textContent=stages[st][0];$('#stageBar').style.width=((st+1)/stages.length*100)+'%';$('#stepFeedback').textContent=`STEP ${st+1}/${stages.length}: follow the highlighted action. The next step appears only when the aircraft detects the result.`;}
 $('#speed').innerHTML=s.speed.toFixed(1)+' <small>m/s</small>';$('#alt').innerHTML=s.alt.toFixed(0)+' <small>m</small>';$('#vs').innerHTML=s.verticalSpeed.toFixed(1)+' <small>m/s</small>';$('#attitude').textContent=s.pitch.toFixed(1)+'° / '+s.roll.toFixed(1)+'°';$('#throttle').textContent=Math.round(s.throttle*100)+'%';$('#gforce').textContent=s.g.toFixed(1)+' g';$('#aoa').textContent=s.aoa.toFixed(1)+'°';$('#hudAlt').textContent=String(Math.round(s.alt)).padStart(4,'0');$('#hudSpeed').textContent=String(Math.round(s.speed)).padStart(3,'0');$('#hudHeading').textContent=String(((s.heading%360)+360)%360|0).padStart(3,'0');$('.center-hud').style.opacity=hudVisibility;
 $('#pitchIndicator').style.transform=`translate(-50%,-50%) rotate(${-s.roll}deg) translateY(${s.pitch*4}px)`;
 $('#systems').innerHTML=[['ELECTRICAL',s.battery],['FUEL',s.fuel],['ENGINE',s.engine],['PARKING BRAKES',s.brakes],['LANDING GEAR',s.gear],['AIRBRAKE',s.airbrake>.5]].map(([k,v])=>`<div><span>${k}</span><b class="${v?'on':''}">${v?'ON':'OFF'}</b></div>`).join('');
 const note=s.landings&&!s.airborne?'CONTROLLED TOUCHDOWN. Click RESET or DEMO to fly again.':s.crashed?'HARD LANDING / FLIGHT ENDED — reset to try again.':s.stall?'STALL RISK: low airspeed or high angle of attack reduces usable lift.':s.airborne?'Banking changes lift direction and creates a turn. Pitch and throttle influence your climb and energy.':s.speed>60?'Airspeed is building. Apply a modest nose-up command to rotate.':'Thrust accelerates the aircraft. More speed generally provides more lift, but drag also increases.';
 $('#physicsNote').textContent=demoRunning?demoMessage+' — simulated flight physics, not a video.':note;$('#dashSpeed').textContent=String(Math.round(s.speed)).padStart(3,'0');$('#dashAlt').textContent=String(Math.round(s.alt)).padStart(4,'0');$('#dashEngine').textContent=s.engine?'RUN':'OFF';$('#dashHorizon').style.transform=`rotate(${-s.roll}deg) translateY(${s.pitch*.7}px)`;$('#warning').textContent=s.crashed?'HARD LANDING':s.stall?'STALL WARNING':s.airborne?'AIRBORNE / FLIGHT TRAINING':'F-16 / RUNWAY TRAINING';$('#warning').classList.toggle('alert',s.crashed||s.stall);
}
