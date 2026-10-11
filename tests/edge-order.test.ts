import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createState,place,step} from '../src/sim.js';
import {EventSkip} from '../src/runtime.js';
import {capture,replay,type Action} from '../src/session.js';
function coincident(lastEnemy:boolean){const s=createState();assert.equal(place(s,2,2).ok,true);s.tick=239;for(const u of s.units)u.age=239;s.units[0].hp=.01;s.charges=0;if(lastEnemy)s.units=s.units.filter(u=>u.id===1||u.team==='ally');return s;}
test('same-tick recovery and destruction stop after the complete atomic step, before save',()=>{
 const s=coincident(false),reference=structuredClone(s),skip=new EventSkip();skip.start(s);skip.chunk(s,1);step(reference);
 assert.equal(s.tick,240);assert.equal(s.charges,2);assert.equal(skip.reason,'撃破・植物の消滅');assert.deepEqual(s,reference);
 const actions:Action[]=[{tick:0,kind:'place',x:2,y:2}];assert.deepEqual(replay(capture(s,4,actions)).state,s);const frozen=structuredClone(s);skip.cancel();skip.chunk(s);assert.deepEqual(s,frozen);
});
test('terminal takes priority over recovery/destruction on the same tick, with no extra tick',()=>{
 const s=coincident(true),skip=new EventSkip();skip.start(s);skip.chunk(s);assert.equal(s.outcome,'win');assert.equal(s.tick,240);assert.equal(s.charges,2);assert.equal(skip.reason,'終局');const frozen=structuredClone(s);skip.chunk(s);step(s);assert.deepEqual(s,frozen);
});

test('a cancelled in-progress skip snapshots exactly, then resumes without replaying a lost tick',()=>{
 const s=createState();place(s,.4,1);const actions:Action[]=[{tick:0,kind:'place',x:.4,y:1}],skip=new EventSkip();skip.start(s);skip.chunk(s,1);assert.equal(s.tick,1);assert.equal(skip.active,true);skip.cancel();const restored=replay(capture(s,2,actions,{x:4,y:3,zoom:2}));assert.deepEqual(restored.state,s);
 const reference=structuredClone(s),resumed=new EventSkip();resumed.start(restored.state);for(let i=0;i<10;i++){step(reference);resumed.chunk(restored.state,1);}assert.deepEqual(restored.state,reference);assert.deepEqual(restored.save.view,{x:4,y:3,zoom:2});
});