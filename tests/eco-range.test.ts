import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createEco,stepEco,placeEco,currentStats,type State} from '../src/eco-sim.js';
import {placementPreview} from '../src/eco-guidance.js';
import {ecoCapture,ecoReplay,EcoStore,ECO_SAVE_KEY,ECO_BACKUP_KEY} from '../src/eco-save.js';
const view={x:2048,y:1536,zoom:1};
test('local range keeps identical raw/frozen seeds and bodies, changing only the per-run range conversion',()=>{
 const old=createEco(11),local=createEco(11,2);assert.equal(old.rangeFactor,undefined);assert.equal(local.rangeFactor,2);assert.deepEqual(local.hand,old.hand);for(let i=0;i<old.units.length;i++){assert.deepEqual(local.units[i].seed,old.units[i].seed);assert.equal(local.units[i].diameter,old.units[i].diameter);const a=currentStats(old.units[i]),b=currentStats(local.units[i]);assert.ok(Math.abs(a.range*2-b.range*5)<.00001);assert.deepEqual({...a,range:0},{...b,range:0});}
});
test('old comparison saves remain the old exact simulation when local-range runs become available',()=>{
 const s=createEco(20261011);placeEco(s,730,650,2);for(let i=0;i<420;i++)stepEco(s);const old=ecoCapture(s,view),restored=ecoReplay(old).state;assert.equal(restored.rangeFactor,undefined);assert.deepEqual(restored,s);for(let i=0;i<120;i++){stepEco(s);stepEco(restored);}assert.deepEqual(restored,s);assert.deepEqual(ecoReplay(ecoCapture(s,view)).state,s);
});
test('local-range placements, previews and contact merges share the saved range profile and restore deterministically',()=>{
 const s=createEco(77,2),seed=s.hand[0].seed,p={x:s.units[24].x-8.1,y:s.units[24].y},f=placementPreview(s,p.x,p.y,seed);assert.ok(placeEco(s,p.x,p.y,0).ok);assert.equal(s.units.at(-1)!.rangeFactor,2);assert.equal(f.futureRange,currentStats({...s.units.at(-1)!,diameter:200}).range);for(let i=0;i<300;i++)stepEco(s);const loaded=ecoReplay(ecoCapture(s,view)).state;for(let i=0;i<120;i++){stepEco(s);stepEco(loaded);}assert.deepEqual(loaded,s);assert.ok(s.units.every(u=>u.rangeFactor===2));
});
test('range profile changes are explicit new runs with old raw backup, and inconsistent profiles reject',()=>{
 const old=createEco(11),raw=JSON.stringify(ecoCapture(old,view)),memory=new Map([[ECO_SAVE_KEY,raw],['morishi.run.v1','legacy untouched']]),store=new EcoStore({getItem:k=>memory.get(k)??null,setItem:(k,v)=>{memory.set(k,v);}});assert.equal(store.read().kind,'loaded');assert.equal(memory.get(ECO_SAVE_KEY),raw);assert.ok(store.write(ecoCapture(createEco(11,2),view),true));assert.equal(memory.get(ECO_BACKUP_KEY),raw);assert.equal(memory.get('morishi.run.v1'),'legacy untouched');
 for(const mutation of [(s:State)=>{s.units[0].rangeFactor=2;},(s:State)=>{s.rangeFactor=3 as 2;}]){const bad=structuredClone(old);mutation(bad);assert.throws(()=>ecoReplay(ecoCapture(bad,view)));}const missing=createEco(11,2);delete missing.units[0].rangeFactor;assert.throws(()=>ecoReplay(ecoCapture(missing,view)));assert.throws(()=>createEco(11,3 as 2));
});

test('a failed explicit backup cannot be bypassed by an ordinary retry',()=>{
 const oldRaw=JSON.stringify(ecoCapture(createEco(11),view)),memory=new Map([[ECO_SAVE_KEY,oldRaw]]);let backupFails=true;const store=new EcoStore({getItem:k=>memory.get(k)??null,setItem:(k,v)=>{if(k===ECO_BACKUP_KEY&&backupFails)throw Error('backup storage full');memory.set(k,v);}}),next=ecoCapture(createEco(11,2),view);assert.equal(store.read().kind,'loaded');assert.equal(store.write(next,true),false);assert.equal(memory.get(ECO_SAVE_KEY),oldRaw);assert.equal(store.write(next),false);assert.equal(memory.get(ECO_SAVE_KEY),oldRaw);backupFails=false;assert.equal(store.write(next),true);assert.equal(memory.get(ECO_BACKUP_KEY),oldRaw);assert.equal(ecoReplay(JSON.parse(memory.get(ECO_SAVE_KEY)!)).state.rangeFactor,2);
});
