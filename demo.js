// Demo state machine uses the SAME flight physics as manual flight.
// It never teleports the aircraft or simply animates a prerecorded flight.
export function demoUpdate(s,t){
 s.battery=true;s.fuel=true;s.engine=true;s.brakes=false;
 if(t<3){s.throttle=.86;s.pitchInput=0;s.rollInput=0;s.airbrake=0;return 'Power on • fuel on • engine running • brakes released';}
 if(!s.airborne&&s.flightSeconds===0){s.throttle=1;s.pitchInput=s.speed>76?.48:0;s.rollInput=0;s.airbrake=0;return `Accelerating down runway • airspeed ${Math.round(s.speed)} / 76 m/s` ;}
 if(s.alt<180&&s.flightSeconds<55){s.throttle=.88;s.pitchInput=.5;s.rollInput=0;s.gear=s.alt<14;return `Airborne • climbing to 180 m • altitude ${Math.round(s.alt)} m` ;}
 if(s.flightSeconds<65){s.gear=false;s.throttle=.76;s.pitchInput=.12;s.rollInput=.32;return 'Bank demonstration • roll changes the direction of lift';}
 if(s.flightSeconds<75){s.throttle=.76;s.pitchInput=.07;s.rollInput=0;return 'Leveling wings • watching altitude and airspeed';}
 s.gear=true;s.rollInput=0;s.airbrake=.38;s.throttle=.26;s.pitchInput=s.alt>65?-.25:-.1;
 return 'Descent demonstration • gear extended • reduced throttle';
}
