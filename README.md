# AERONAUT — Operation Icefall

An interactive, F-16-inspired **arcade flight simulator** driven by an Arturia MiniLab 3. A MIDI keyboard becomes a flight deck: keys, pads, knobs, faders, and touch strips handle different parts of the aircraft. Built with Three.js, Web MIDI, and a simplified flight model.

It is a game and an interactive flight-science experiment—not a realistic aircraft certification or military training simulator.

## Run locally

Requires Node.js 20+, Chrome or Edge, and (optionally) the Arturia MiniLab 3.

```bash
npm install
npm run dev
```

Open the local URL printed by Vite (normally `http://localhost:5173`). Click **Launch Operation Icefall**. You can fly with the on-screen controls and keyboard if the MiniLab isn't connected. Click **Connect MiniLab** and allow MIDI access to use the controller. The Control Deck can learn your individual pad/knob assignments when the controller's preset differs from the defaults.

## The flight

1. Start aircraft electrical power, fuel, and engine with pads A1–A3 (or computer keys `1`, `2`, `3`). Release parking brakes with pad A4 (or `Space`).
2. Set fader 1/throttle to maximum, then pitch up gently when the airspeed is high enough to take off.
3. Pass four generous sky gates through the alpine valley. Scan up to three optional research stations using MiniLab key 24 (or computer key `C`) when nearby.
4. At the fictional drone challenge, use faders 3 and 4 to align the aiming reticle and press pad B5 / piano key 22 to lock, then pad B6 / key 23 to launch the fictional missile. If using a computer keyboard, press `L` to lock and `F` to fire. The **Center Aim** button offers a mouse-friendly fallback after the target is in front of the camera.
5. Return to base and land using the optional return assist, or keep flying freely.

### Computer keyboard fallback

`1` electrical · `2` fuel · `3` engine · `Space` brakes · `G` landing gear · `W/S` pitch · `A/D` roll · `↑/↓` throttle · `L` lock · `F` launch · `C` scan · `R` restart.

The MiniLab control deck includes all 25 piano-key functions, eight knobs, four faders, 16 pad-bank actions, and two touch-strip inputs. The exact MIDI mapping depends on your controller preset. Some controller buttons work only internally and do not send independent MIDI messages.

## Extra features

- Chase and cockpit cameras, animated aircraft geometry, alpine environment
- A flight lab for comparing turns and bank angles
- Flight telemetry recording, replay, and JSON export
- Guided flight instructions and autopilot demonstration
- Beginner and advanced handling modes

## Validation

```bash
npm run check
npm test
npm run build
```

The JavaScript syntax and pure-logic tests can pass without verifying WebGL visuals, performance, the browser's MIDI permission flow, or a real MiniLab 3. Test those on the target laptop before recording a demo.

## Technical scope

The jet, scenery, physics, stations, and cinematic effects are generated in code. No copyrighted aircraft imagery or commercial flight simulator assets are bundled. The target challenge is fictional and designed for arcade play. This project is not a photorealistic flight simulator.


## Endless Mountains + MiniLab Stunts (this version)

- **Fader 1:** throttle.
- **Fader 2:** cinematic barrel roll.
- **Fader 3:** cinematic loop, except during target stage when it remains **Aim X**.
- **Fader 4:** cinematic corkscrew, except during target stage when it remains **Aim Y**.
- **Trigger method:** pull the chosen fader below 35%, then raise it above 85%; you must be airborne above 65 m/s. Re-arm by pulling down again.
- **Airbrake** remains available via Pad A6 and held piano Key 7.
- **Keyboard:** press `1`, `2`, or `3` while airborne to preview barrel roll / loop / corkscrew respectively (these conflict with startup shortcuts only while airborne).
- **Terrain:** procedural snow/mountain mesh follows aircraft beyond the mission target; no terminal terrain edge in normal flight. The airfield remains in the original world position.
- Stunts are intentionally cinematic/arcade visual animations; not full aerobatic force/attitude simulation.
