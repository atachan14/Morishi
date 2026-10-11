import {test} from 'node:test';import assert from 'node:assert/strict';
import {createEco,enemyPresence,validateEcoPlacement,currentStats} from '../src/eco-sim.js';
import {placementReport} from '../src/eco-guidance.js';
test('placement failure reports the actual body and required center separation without mutating the run',()=>{
 const s=createEco(11,2,'quarter-v1','presence-nearest-v1'),u=s.units[24],before=structuredClone(s),report=placementReport(s,u.x,u.y,0);assert.equal(report.validation.ok,false);assert.ok(report.bodies.some(v=>v.id===u.id&&v.distance===0&&v.required===8));assert.equal(report.enemyTotal,enemyPresence(s,u.x,u.y));assert.deepEqual(s,before);
});
test('enemy contributors explain summed presence independently of physical collision and target rules',()=>{
 const s=createEco(11,2),a=s.units[0],b=s.units[1];b.seed=structuredClone(a.seed);b.x=a.x;b.y=a.y;b.diameter=a.diameter;s.units=[a,b];const x=a.x+currentStats(a).presence*1.6,y=a.y,r=placementReport(s,x,y,0);assert.equal(r.bodies.length,0);assert.equal(r.enemies.length,2);assert.ok(r.enemies.every(e=>e.presence<1.5));assert.ok(r.enemyTotal>1.5);assert.deepEqual(r.validation,validateEcoPlacement(s,x,y,0));
});
test('valid points and missing-card errors use the same validator without consuming a card',()=>{
 const s=createEco(77,2),before=structuredClone(s),r=placementReport(s,2048,1536,0);assert.equal(r.validation.ok,true);assert.equal(r.bodies.length,0);assert.equal(r.enemyTotal,0);assert.equal(placementReport(s,2048,1536,999).validation.ok,false);assert.deepEqual(s,before);
});
