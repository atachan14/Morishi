// Reuse naturally generated checkpoints; no repeated policy sweep.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {step} from '../.test-dist/src/sim.js';
import {capture,replay,RunStore} from '../.test-dist/src/session.js';
const input=process.argv[2],rows=[];
const summary=a=>{a.sort((x,y)=>x-y);return {p50:a[Math.floor(a.length*.5)],p95:a[Math.floor(a.length*.95)],max:a.at(-1)};};
for(const seed of [20261011,11]){
 const saved=JSON.parse(await fs.readFile(path.join(input,`${seed}-safe-retention-peak.json`),'utf8')),s=replay(saved).state,data=new Map(),store=new RunStore({getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)}),write=[],read=[],ticks=[];
 for(let i=0;i<20;i++){let t=performance.now();const snapshot=capture(s,4,saved.actions,saved.view);assert.ok(store.write(snapshot));write.push(performance.now()-t);t=performance.now();const loaded=store.read();read.push(performance.now()-t);assert.equal(loaded.kind,'loaded');assert.deepEqual(loaded.state,s);t=performance.now();step(s);ticks.push(performance.now()-t);}
 rows.push({seed,units:s.units.length,allies:s.units.filter(u=>u.team==='ally').length,bytes:Buffer.byteLength(JSON.stringify(capture(s,4,saved.actions,saved.view))),repetitions:20,captureAndWriteMs:summary(write),readAndValidateMs:summary(read),lateStepMs:summary(ticks)});
}
await fs.writeFile(path.join(input,'late-state-cost.json'),JSON.stringify(rows,null,2));console.log(JSON.stringify(rows,null,2));
