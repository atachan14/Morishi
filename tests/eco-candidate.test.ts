import {test} from 'node:test';import assert from 'node:assert/strict';
import {createEco,placeEco,currentStats,targetFor,damageFor} from '../src/eco-sim.js';import {placementPreview} from '../src/eco-guidance.js';
test('candidate incoming hit and rate details match enemies actually targeting the new plant',()=>{
 const s=createEco(11,2,'quarter-v1','presence-nearest-v1'),e=s.units[0],card=s.hand[0],x=e.x-60,y=e.y-45,before=structuredClone(s),p=placementPreview(s,x,y,card.seed);assert.deepEqual(s,before);assert.ok(p.incomingDetails.length>0);assert.ok(placeEco(s,x,y,card.id).ok);const u=s.units.at(-1)!;assert.deepEqual(p.current,currentStats(u));const actual=s.units.filter(v=>v.team==='enemy'&&targetFor(v,s.units)?.id===u.id).map(v=>({id:v.id,damage:damageFor(v,u),speed:currentStats(v).speed})).sort((a,b)=>b.damage-a.damage||a.id-b.id);assert.deepEqual(p.incomingDetails,actual);assert.equal(p.futureRange,currentStats({...u,diameter:200}).range);
});
test('distant candidates describe no incoming attackers without changing frozen hand data',()=>{
 const s=createEco(77,2,'quarter-v1','presence-nearest-v1'),before=structuredClone(s),p=placementPreview(s,2048,1536,s.hand[0].seed);assert.deepEqual(p.incomingDetails,[]);assert.equal(p.target,null);assert.ok(p.futureRange>p.current.range);assert.deepEqual(s,before);
});
