const fs = require('fs');
const TPB = 480;
function vlq(n){const out=[n&0x7F]; n>>=7; while(n){out.unshift(0x80|(n&0x7F)); n>>=7;} return out;}
function addMeta(trk, dt, meta){trk.push(...vlq(dt), ...meta);}
let trk=[];
addMeta(trk,0,[0xFF,0x51,0x03,0x0B,0x71,0xB0]);
addMeta(trk,0,[0xFF,0x58,0x04,0x04,0x02,0x18,0x08]);
trk.push(...vlq(0),0xC0,33);
trk.push(...vlq(0),0xC1,25);
trk.push(...vlq(0),0xC2,73);
let events=[];
function addRepeating(note, vel, start, dur, every, count, ch){let t=Math.round((start-1)*TPB); for(let i=0;i<count;i++){events.push([t,0x90|ch,note,vel]); events.push([t+Math.round(dur*TPB),0x80|ch,note,0]); t+=Math.round(every*TPB);} }
addRepeating(42,72,1,0.35,0.5,192,9);
addRepeating(38,94,2,0.35,4,48,9);
addRepeating(38,94,4,0.35,4,48,9);
addRepeating(36,110,1,0.35,4,48,9);
addRepeating(36,102,1.75,0.35,4,48,9);
addRepeating(36,108,3,0.35,4,48,9);
addRepeating(36,104,3.5,0.35,4,48,9);
addRepeating(36,106,4.5,0.35,4,48,9);
for (const root of [1,5,9,13]){
  addRepeating(36,96,root,0.9,16,24,0);
  addRepeating(39,94,root+4,0.9,16,24,0);
  addRepeating(46,92,root+8,0.9,16,24,0);
  addRepeating(43,96,root+12,0.9,16,24,0);
}
addRepeating(48,88,9,0.5,4,96,0);
for(let bar=0; bar<24; bar++){
  const beat = bar*4+1;
  const chords = [[48,60,63,67],[44,56,60,63],[46,58,62,65],[43,55,58,62]];
  const chord = chords[bar%4];
  for(const n of chord){events.push([Math.round((beat-1)*TPB),0x91,n,82]); events.push([Math.round((beat-1+0.6)*TPB),0x81,n,0]);}
  for(const n of chord){events.push([Math.round((beat+1)*TPB),0x91,n,78]); events.push([Math.round((beat+1+0.6)*TPB),0x81,n,0]);}
}
const motifs=[17,49,81];
for(const mb of motifs){
  const pats=[[0,72,0.8,90],[1,75,0.8,92],[2,79,0.8,94],[2.5,77,0.6,92],[3,74,1.0,90]];
  for(const [ofs,n,d,v] of pats){
    const start=Math.round((mb+ofs-1)*TPB);
    events.push([start,0x92,n,v]);
    events.push([start+Math.round(d*TPB),0x82,n,0]);
  }
}
events.sort((a,b)=>a[0]-b[0] || a[1]-b[1]);
let last=0;
for(const [t,st,n,v] of events){const dt=t-last; trk.push(...vlq(dt), st, n, v); last=t;}
trk.push(...vlq(TPB),0xFF,0x2F,0x00);
const trackBytes = Buffer.from(trk);
const header = Buffer.from([0x4D,0x54,0x68,0x64,0,0,0,6, 0,0, 0,1, 0x01,0xE0]);
const len = trackBytes.length;
const trackHeader = Buffer.from([0x4D,0x54,0x72,0x6B,(len>>>24)&255,(len>>>16)&255,(len>>>8)&255,len&255]);
const midi = Buffer.concat([header, trackHeader, trackBytes]);
fs.writeFileSync('midi.b64', midi.toString('base64'));
console.log('len', midi.length);
console.log(midi.toString('base64'));
