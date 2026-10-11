import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ELEMENTS,elementScale,round} from '../src/eco-contract.js';
import {createEco,stepEco,placeEco,mergeContacts,currentStats,currentElements,type State} from '../src/eco-sim.js';
import {ecoCapture,ecoReplay} from '../src/eco-save.js';
const view={x:2048,y:1536,zoom:1};
test('guard absorption pools HP and attack/defense, retaining receiver timing, range and frozen binding',()=>{
 const s=createEco(11,2,'guard-v1'),a=s.units[24],b=s.units[25];b.x=a.x+8;b.y=a.y;a.diameter=b.diameter=8;a.hp=currentStats(a).maxHp;b.hp=currentStats(b).maxHp;const raw=structuredClone(a.seed),transfer=currentElements(b),hp=currentStats(b).maxHp;s.units=[a,b];assert.equal(mergeContacts(s),1);assert.deepEqual(a.seed,raw);assert.equal(a.bonus.hp,hp);for(const e of ELEMENTS){const role=a.seed.bindings[e];assert.equal(a.bonus.elements[e],role==='speed'||role==='range'?0:transfer[e]);if(role==='speed'||role==='range')assert.ok(Math.abs(currentElements(a)[e]-a.seed.fixed.elements[e]*elementScale(a.diameter))<.00001);}assert.equal(a.lineage.length,2);
});
test('pooled, guard and quarter runs keep the same frozen seeds, physical growth and initial enemies',()=>{
 const a=createEco(77,2),b=createEco(77,2,'guard-v1'),c=createEco(77,2,'quarter-v1');assert.deepEqual(a.hand,b.hand);assert.deepEqual(a.hand,c.hand);for(let i=0;i<a.units.length;i++){assert.deepEqual(a.units[i].seed,b.units[i].seed);assert.equal(a.units[i].diameter,b.units[i].diameter);assert.deepEqual(currentStats(a.units[i]),currentStats(b.units[i]));}for(let i=0;i<4;i++){stepEco(a);stepEco(b);stepEco(c);}assert.deepEqual(a.units.map(u=>u.diameter),b.units.map(u=>u.diameter));
});
test('guard natural contact and save/resume keep policy on new actors without changing old runs',()=>{
 for(const seed of [11,77]){const s=createEco(seed,2,'guard-v1'),u=s.units[24];assert.ok(placeEco(s,u.x-8.1,u.y,0).ok);for(let i=0;i<240;i++)stepEco(s);assert.ok(s.merges);const copy=ecoReplay(ecoCapture(s,view)).state;for(let i=0;i<180;i++){stepEco(s);stepEco(copy);}assert.deepEqual(copy,s);assert.ok(s.units.every(u=>u.mergePolicy==='guard-v1'));}
 const old=createEco(11,2);for(let i=0;i<100;i++)stepEco(old);const loaded=ecoReplay(ecoCapture(old,view)).state;assert.equal(loaded.mergePolicy,undefined);assert.deepEqual(loaded,old);
});
test('inconsistent or unknown inheritance policy does not load as a changed existing run',()=>{
 const old=createEco(11,2);old.units[0].mergePolicy='guard-v1';assert.throws(()=>ecoReplay(ecoCapture(old,view)));const guard=createEco(11,2,'guard-v1');delete guard.units[0].mergePolicy;assert.throws(()=>ecoReplay(ecoCapture(guard,view)));assert.throws(()=>createEco(11,2,'unknown' as 'guard-v1'));
});

test('quarter inheritance transfers exactly a quarter of elements but all health and physical area',()=>{
 const s=createEco(20261011,2,'quarter-v1'),a=s.units[24],b=s.units[25];b.x=a.x+8;b.y=a.y;a.diameter=b.diameter=8;a.hp=currentStats(a).maxHp;b.hp=currentStats(b).maxHp;const transfer=currentElements(b),hp=currentStats(b).maxHp,regen=currentStats(b).regen;s.units=[a,b];mergeContacts(s);for(const e of ELEMENTS)assert.equal(a.bonus.elements[e],round(transfer[e]*.25));assert.equal(a.bonus.hp,hp);assert.equal(a.bonus.regen,regen);assert.equal(a.diameter,round(Math.sqrt(128)));
});
test('quarter contact, later cards and resumed combat are deterministic across three seeds',()=>{
 for(const seed of [11,77,20261011]){const s=createEco(seed,2,'quarter-v1'),a=s.units[24];assert.ok(placeEco(s,a.x-8.1,a.y,0).ok);for(let i=0;i<300;i++)stepEco(s);const loaded=ecoReplay(ecoCapture(s,view)).state;for(let i=0;i<100;i++){stepEco(s);stepEco(loaded);}assert.deepEqual(loaded,s);assert.ok(s.hand.some(c=>c.id>=4));assert.ok(s.units.every(u=>u.mergePolicy==='quarter-v1'));}
});
