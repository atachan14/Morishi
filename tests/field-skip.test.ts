import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createState,place,step,insideTerritory,enemyPresenceAt,presenceAt,PRESENCE_LIMIT,REFILL_TICKS,distanceFalloff,PRESENCE_STRENGTH} from '../src/sim.js';
import {EventSkip} from '../src/runtime.js';

test('summed decaying presence blocks a gap even when each enemy is below threshold; death releases it',()=>{
  const s=createState(),a=s.units[0],b=s.units[1];s.units=[a,b];a.x=2;b.x=10;a.y=b.y=4;a.age=b.age=117;a.stats.presence=b.stats.presence=2;
  assert.ok(presenceAt(a,6,4)<PRESENCE_LIMIT);assert.ok(presenceAt(b,6,4)<PRESENCE_LIMIT);assert.ok(enemyPresenceAt(s,6,4)>PRESENCE_LIMIT);assert.equal(insideTerritory(s,6,4),false);
  b.hp=0;assert.equal(insideTerritory(s,6,4),true);const field=enemyPresenceAt(s,6,4);a.stats.range=100;assert.equal(enemyPresenceAt(s,6,4),field);
});
test('analytic threshold boundary accepts equality and rejects just inside, independently of display samples',()=>{
  const s=createState(),u=s.units[0];s.units=[u];u.x=5;u.y=4;u.age=117;u.stats.presence=2;const distance=2*1.3*(2-PRESENCE_LIMIT/2);
  assert.equal(insideTerritory(s,5+distance,4),true);assert.equal(insideTerritory(s,5+distance-1e-5,4),false);assert.equal(insideTerritory(s,5+distance+1e-5,4),true);
});
test('1024 generated seeds retain a nonoverlapping legal refuge even with fully mature enemies',()=>{
  for(let seed=0;seed<1024;seed++){
    const s=createState(seed);for(const u of s.units)u.age=117;
    assert.ok([[.3,.3],[11.7,.3],[.3,8.7],[11.7,8.7]].some(([x,y])=>place(structuredClone(s),x,y).ok),String(seed));
  }
});
test('event skip stops exactly on slower resource recovery, and cancel/restart preserves progress',()=>{
  const s=createState();place(s,.4,1);place(s,.4,4);place(s,.4,7);for(const u of s.units){u.age=117;u.stats.range=.1;}const skip=new EventSkip();skip.start(s);
  skip.chunk(s,1);assert.equal(s.tick,1);skip.cancel();const before=structuredClone(s);skip.chunk(s);assert.deepEqual(s,before);skip.start(s);
  while(skip.active)skip.chunk(s,1);assert.equal(skip.reason,'配置力回復');assert.equal(s.tick,REFILL_TICKS);assert.equal(s.charges,1);
});
test('skip stops at destruction and maturity, and cannot perform an unbounded synchronous batch',()=>{
  const s=createState();place(s,.4,1);for(const u of s.units)u.stats.range=.1;const skip=new EventSkip();skip.start(s);skip.chunk(s,999999);assert.ok(s.tick<=128);while(skip.active)skip.chunk(s);assert.equal(skip.reason,'成長完了');assert.equal(s.tick,117);
  const battle=createState();place(battle,2,2);const ally=battle.units.at(-1)!;ally.stats.power=10000;ally.stats.range=100;skip.start(battle);skip.chunk(battle,1);assert.equal(skip.reason,'撃破・植物の消滅');assert.equal(skip.active,false);const frozen=structuredClone(battle);skip.chunk(battle);assert.deepEqual(battle,frozen);
});

test('shared falloff is flat through R, half at 1.5R and zero at 2R',()=>{
  assert.equal(distanceFalloff(0,100),1);assert.equal(distanceFalloff(100,100),1);assert.equal(distanceFalloff(150,100),.5);assert.equal(distanceFalloff(200,100),0);assert.equal(distanceFalloff(201,100),0);
});
test('presence strength is shared while individual presence stat controls distance',()=>{
  const s=createState(),a=s.units[0],b=s.units[1];a.x=b.x=6;a.y=b.y=4;a.age=b.age=117;a.stats.presence=1;b.stats.presence=2;
  assert.equal(presenceAt(a,6,4),PRESENCE_STRENGTH);assert.equal(presenceAt(b,6,4),PRESENCE_STRENGTH);assert.ok(presenceAt(b,8,4)>presenceAt(a,8,4));
});