// Arturia factory/User mapping documented at support.arturia.com (CCs). Note numbers
// can be customized in MIDI Control Center. Learn mode resolves preset differences.
export const encoders = [74,71,76,77,93,18,19,16];
export const faders = [82,83,85,17];
export const padNotesA = [36,37,38,39,40,41,42,43];
export const padNotesB = [44,45,46,47,48,49,50,51];
export const mappings = {
  pitch: {type:'cc',number:74}, roll:{type:'cc',number:71}, yaw:{type:'cc',number:76}, assist:{type:'cc',number:77},
  wind:{type:'cc',number:93}, sun:{type:'cc',number:18}, hud:{type:'cc',number:19}, sound:{type:'cc',number:16},
  throttle:{type:'cc',number:82}, airbrake:{type:'cc',number:83}, trim:{type:'cc',number:85}, zoom:{type:'cc',number:17},
  bend:{type:'pitch'}, mod:{type:'cc',number:1},
};
export class MIDIController {
  constructor(onControl,onPad,onKey,onRaw,onStatus){ Object.assign(this,{onControl,onPad,onKey,onRaw,onStatus}); this.learn=null; this.padLearn=null; this.banks='A'; this.learned=JSON.parse(localStorage.getItem('aeronaut-mapping')||'{}'); this.padLearned=JSON.parse(localStorage.getItem('aeronaut-pad-mapping')||'{}'); this.lastPad=new Map();this.encoderMode=localStorage.getItem('aeronaut-encoder-mode')||'absolute';this.encoderValues={}; }
  async connect(){
    if(!navigator.requestMIDIAccess) { this.onStatus('Web MIDI unavailable. Use Chrome or Edge on localhost.'); return; }
    try {this.access=await navigator.requestMIDIAccess({sysex:false}); this.access.onstatechange=()=>this.attach(); this.attach();}
    catch(e){this.onStatus('MIDI permission failed: '+e.message);}
  }
  attach(){
    const inputs=[...this.access.inputs.values()];
    inputs.forEach(i=>i.onmidimessage=e=>this.message(e.data,i.name));
    this.onStatus(inputs.length ? `MIDI ready: ${inputs.map(i=>i.name).join(', ')}`:'No MIDI input detected. Plug in MiniLab 3 and click Connect again.');
  }
  toggleEncoderMode(){this.encoderMode=this.encoderMode==='absolute'?'relative':'absolute';localStorage.setItem('aeronaut-encoder-mode',this.encoderMode);this.encoderValues={};return this.encoderMode;}
  learnControl(name){ this.learn=name; this.onStatus('Move the physical control for '+name.toUpperCase()+' now…'); }
  resetMappings(){this.learned={};this.padLearned={};localStorage.removeItem('aeronaut-mapping');localStorage.removeItem('aeronaut-pad-mapping');this.onStatus('Factory mappings restored.');}
  learnPad(bank,index){this.padLearn={bank,index};this.onStatus(`Press PAD ${bank}${index+1} on your MiniLab 3 to teach its MIDI message…`);}
  message(data,device){
    const [status,d1,d2=0]=data; const kind=status&0xf0, channel=(status&0x0f)+1;
    if(kind<0x80 || kind>0xe0) return;
    const type=kind===0xb0?'cc':kind===0xe0?'pitch':kind===0x90&&d2>0?'note':kind===0x80||kind===0x90?'off':'other';
    const raw={type,channel,number:d1,value:d2,device}; this.onRaw(raw);
    const press=type==='note'||(type==='cc'&&d2>0);
    if(this.padLearn && press){ const key=`${this.padLearn.bank}${this.padLearn.index}`;this.padLearned[key]={type,channel,number:d1};localStorage.setItem('aeronaut-pad-mapping',JSON.stringify(this.padLearned));this.onStatus(`PAD ${this.padLearn.bank}${this.padLearn.index+1} linked to ${type.toUpperCase()} ${d1} / channel ${channel}`);this.onPad(this.padLearn.index,this.padLearn.bank,d2/127);this.padLearn=null;return;}
    if(press){for(const [key,m] of Object.entries(this.padLearned)){if(m.type===type&&m.channel===channel&&m.number===d1){if(!this.lastPad.has(key)||performance.now()-this.lastPad.get(key)>160){this.lastPad.set(key,performance.now());this.onPad(Number(key.slice(1)),key[0],d2/127);}return;}}}
    if(this.learn && (type==='cc'||type==='pitch')){this.learned[this.learn]={type,number:d1,channel};localStorage.setItem('aeronaut-mapping',JSON.stringify(this.learned));this.onStatus(`${this.learn.toUpperCase()} learned: ${type} ${d1} ch ${channel}`);this.learn=null;return;}
    if(type==='cc'||type==='pitch'){
      for(const [name,defaultMap] of Object.entries(mappings)){
        const m=this.learned[name]||defaultMap;
        if(m.type===type && (type==='pitch'||m.number===d1) && (!m.channel||m.channel===channel)) {
          const v=type==='pitch'? ((d2<<7)|d1)/16383:d2/127;
          if(this.encoderMode==='relative'&&type==='cc'&&['pitch','roll','yaw','assist','wind','sun','hud','sound'].includes(name)){const delta=d2===64?0:d2>=65?-(128-d2):d2;this.encoderValues[name]=Math.max(0,Math.min(1,(this.encoderValues[name]??.5)+delta/128));this.onControl(name,this.encoderValues[name],raw);}else{this.encoderValues[name]=v;this.onControl(name,v,raw);}
        }
      }
    }
    if(type==='note'||type==='off'){
      // Arturia's factory pads are on MIDI channel 10. Keys usually on ch 1.
      if(type==='note' && channel!==1 && d1>=36 && d1<=51){ const bank=d1<44?'A':'B'; this.banks=bank;this.onPad(d1<44?d1-36:d1-44,bank,d2/127); }
      else this.onKey(d1,type==='note'?d2/127:0,channel,type==='note');
    }
  }
}
