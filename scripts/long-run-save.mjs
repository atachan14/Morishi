// Run after npm test. This is accelerated simulation, not a 24-hour browser soak.
import assert from 'node:assert/strict';
import {createState,place,Clock} from '../.test-dist/src/sim.js';
import {ForegroundGate} from '../.test-dist/src/runtime.js';
import {capture,RunStore} from '../.test-dist/src/session.js';
const s=createState(11),actions=[{tick:0,kind:'place',x:1,y:2}];place(s,1,2);
const data=new Map(),store=new RunStore({getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)});
const clock=new Clock(),gate=new ForegroundGate();clock.speed=4;clock.paused=false;
let restores=0,largestBytes=0,maxRestoreMs=0;
for(let i=0;i<86400;i++){
  clock.advance(s,250);
  if(i%1000===0){
    const save=capture(s,clock.speed,actions);largestBytes=Math.max(largestBytes,Buffer.byteLength(JSON.stringify(save),'utf8'));assert.equal(store.write(save),true);
    const start=performance.now(),loaded=store.read();maxRestoreMs=Math.max(maxRestoreMs,performance.now()-start);assert.equal(loaded.kind,'loaded');assert.deepEqual(loaded.state,s);restores++;
    gate.interrupt(clock);const before=structuredClone(s);clock.advance(s,gate.frame(600000));assert.deepEqual(s,before);clock.paused=false;
  }
}
assert.equal(s.tick,864000);assert.equal(store.write(capture(s,4,actions)),true);const loaded=store.read();assert.equal(loaded.kind,'loaded');assert.deepEqual(loaded.state,s);
console.log(JSON.stringify({seed:s.seed,gameHours:s.tick/36000,tick:s.tick,outcome:s.outcome,restores:restores+1,largestBytes,maxRestoreMs:+maxRestoreMs.toFixed(3),exact:true,backgroundCatchup:false,browserSoak:false},null,2));
