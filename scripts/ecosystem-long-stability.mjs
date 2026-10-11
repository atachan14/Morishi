// Accelerated game time, not a real-hour browser soak. CPU budget is bounded.
import assert from 'node:assert/strict';import fs from 'node:fs';
import {createEco,stepEco,currentStats,ECO_LIMITS} from '../.test-dist/src/eco-sim.js';
import {ecoCapture,ecoReplay,EcoStore} from '../.test-dist/src/eco-save.js';
import {giantFixture,denseFixture,pendingMergeFixture} from './ecosystem-stress-fixtures.mjs';
const report={accelerated:true,realTimeSoak:false,normalRuns:[],synthetic:[]},view={x:2048,y:1536,zoom:1};const start=performance.now();
for(const [merge,target,ticks] of [[undefined,undefined,6000],['quarter-v1',undefined,6000],['quarter-v1','presence-nearest-v1',36000]]){
 const s=createEco(11,2,merge,target),t0=performance.now();let restores=0,maxBytes=0,maxSaveMs=0;
 for(let i=0;i<ticks;i++){stepEco(s);if(i%1000===999){const t=performance.now(),save=ecoCapture(s,view),copy=ecoReplay(save);maxSaveMs=Math.max(maxSaveMs,performance.now()-t);assert.deepEqual(copy.state,s);maxBytes=Math.max(maxBytes,Buffer.byteLength(JSON.stringify(save)));restores++;}}
 for(const u of s.units){assert.ok(Number.isFinite(u.hp));assert.ok(u.hp<=currentStats(u).maxHp);assert.ok(u.diameter<=ECO_LIMITS.diameter);assert.equal(u.age,s.tick-u.born);}assert.ok(s.events.length<=8);assert.ok(s.hand.length<=6&&s.charges<=5);assert.ok(s.drawProgress>=0&&s.drawProgress<=1&&s.turnProgress>=0&&s.turnProgress<=1);
 report.normalRuns.push({merge:merge??'legacy',target:target??'legacy',actualSteppedTicks:s.tick,gameSeconds:s.tick/10,cpuMs:Math.round(performance.now()-t0),restores,maxBytes,maxSaveMs,units:s.units.length,events:s.events.length,hand:s.hand.length,charges:s.charges,drawProgress:s.drawProgress,turnProgress:s.turnProgress,maxDiameter:Math.max(...s.units.map(u=>u.diameter))});
 if(performance.now()-start>15000)throw Error('Short CPU budget exceeded; do not start a longer job');
}
for(const f of [giantFixture,denseFixture,pendingMergeFixture]){const s=f(),data=new Map(),store=new EcoStore({getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)});const write=[],read=[],steps=[];for(let i=0;i<12;i++){let t=performance.now();assert.ok(store.write(ecoCapture(s,view)));write.push(performance.now()-t);t=performance.now();const loaded=store.read();read.push(performance.now()-t);assert.equal(loaded.kind,'loaded');assert.deepEqual(loaded.save.state,s);t=performance.now();stepEco(s);steps.push(performance.now()-t);}report.synthetic.push({name:f.name,label:'synthetic boundary fixture; not natural-play evidence',saveWriteMs:write,readMs:read,stepMs:steps,units:s.units.length,events:s.events.length,maxDiameter:Math.max(...s.units.map(u=>u.diameter))});}
report.totalCpuMs=Math.round(performance.now()-start);fs.mkdirSync('evidence/ecosystem-long',{recursive:true});fs.writeFileSync('evidence/ecosystem-long/core.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
