import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {ecoReplay,ecoCapture} from '../src/eco-save.js';import {placeEco,stepEco,validateEcoPlacement,currentStats} from '../src/eco-sim.js';import {findNurtureSpace,placementPreview} from '../src/eco-guidance.js';
const rows=JSON.parse(fs.readFileSync('evidence/ecosystem-recovery/nurture.json','utf8')).rows;
import {createEco} from '../src/eco-sim.js';
test('unsettled enemy merging makes nurture predictions uncertain without consuming or changing the opening',()=>{
 const s=createEco(11,2,'quarter-v1','presence-nearest-v1'),before=structuredClone(s),r=findNurtureSpace(s,s.hand[0].seed,s.units[0]);assert.deepEqual(r,{kind:'unknown',checked:0});assert.deepEqual(s,before);assert.ok(validateEcoPlacement(s,4,4,s.hand[0].id).ok);
});
test('organic mature checkpoints offer same-card nurture points that survive and shoot with exact save replay',()=>{
 for(const row of rows){const s=ecoReplay(row.checkpoint).state,before=structuredClone(s),card=s.hand[0],preferred=s.units.find(u=>u.team==='enemy')!,result=findNurtureSpace(s,card.seed,preferred);assert.equal(result.kind,'found');assert.deepEqual(s,before);if(result.kind!=='found')throw Error('Missing candidate');assert.ok(result.checked<=256);assert.ok(validateEcoPlacement(s,result.point.x,result.point.y,card.id).ok);assert.equal(placementPreview(s,result.point.x,result.point.y,card.seed).incomingDetails.length,0);const id=s.nextId;assert.ok(placeEco(s,result.point.x,result.point.y,card.id).ok);let shot=false;for(let n=0;n<700;n++){const u=s.units.find(u=>u.lineage.includes(id));stepEco(s);shot ||= u?.lastShot?.tick===s.tick;}assert.ok(s.units.some(u=>u.lineage.includes(id)));assert.ok(shot);assert.deepEqual(ecoReplay(ecoCapture(s,{x:2048,y:1536,zoom:1})).state,s);}
});
test('short-range nurture search reports uncertainty rather than claiming that no legal or useful space exists',()=>{
 const s=ecoReplay(rows.find((r:any)=>r.seed===20261011).checkpoint).state,card=s.hand[1],before=structuredClone(s),result=findNurtureSpace(s,card.seed,s.units.find(u=>u.team==='enemy')!);assert.equal(result.kind,'unknown');assert.ok(result.checked<=256);assert.deepEqual(s,before);assert.equal(validateEcoPlacement(s,4,4,card.id).ok,true);
});
test('dangerous mature legal placements expose damaging incoming rates far beyond initial HP without altering boosts',()=>{
 for(const row of rows){const s=ecoReplay(row.checkpoint).state,before=structuredClone(s),card=s.hand[0],point=row.oldLegal.point;assert.ok(validateEcoPlacement(s,point.x,point.y,card.id).ok);const p=placementPreview(s,point.x,point.y,card.seed),rate=p.incomingDetails.reduce((sum,e)=>sum+e.damage*e.speed,0);assert.ok(rate>p.current.maxHp);assert.deepEqual(s,before);assert.ok(Object.values(currentStats(s.units[0])).every(Number.isFinite));}
});
