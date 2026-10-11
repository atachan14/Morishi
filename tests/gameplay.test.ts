import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createState,place,step,validatePlacement,placementForecast,enemyPresenceAt,seedStats,dominant,PRESENCE_LIMIT} from '../src/sim.js';
import {PLAY_STAGE,COMPARISON_STAGE} from '../src/stage.js';
import {OPENING_MIN_DISTANCE} from '../src/opening.js';
import {capture,replay,RunStore,SAVE_KEY,BACKUP_KEY,type Action} from '../src/session.js';
import {introView,BoardCamera} from '../src/camera.js';

test('sparse opening has real groups, voids and three resource-free mature-safe allies',()=>{
 for(const seed of [20261011,11,1]){
  const s=createState(seed,PLAY_STAGE,'endless','clustered-v1');assert.deepEqual(s,createState(seed,PLAY_STAGE,'endless','clustered-v1'));
  const enemies=s.units.filter(u=>u.team==='enemy'),allies=s.units.filter(u=>u.team==='ally');assert.equal(enemies.length,24);assert.equal(allies.length,3);assert.equal(s.charges,3);assert.equal(s.supplyIndex,0);assert.equal(s.nextSeedIndex,4);
  for(let i=0;i<24;i++)for(let j=i+1;j<24;j++)assert.ok(Math.hypot(enemies[i].x-enemies[j].x,enemies[i].y-enemies[j].y)>=OPENING_MIN_DISTANCE);
  const nearest=enemies.map(u=>Math.min(...enemies.filter(v=>v!==u).map(v=>Math.hypot(u.x-v.x,u.y-v.y))));assert.ok(Math.max(...nearest)-Math.min(...nearest)>.2);
  assert.ok(Math.min(...enemies.map(u=>Math.hypot(u.x-36,u.y-27)))>8,'central void exceeds local neighbour distance');
  const mature={...s,units:enemies.map(u=>({...u,age:117}))};for(const u of allies){assert.equal(u.initial,true);assert.equal(u.seedIndex,undefined);assert.ok(enemyPresenceAt(mature,u.x,u.y)<=PRESENCE_LIMIT);}
  const legacy=createState(seed,COMPARISON_STAGE,'endless');assert.ok(OPENING_MIN_DISTANCE>Math.min(...legacy.units.flatMap((u,i)=>legacy.units.slice(i+1).map(v=>Math.hypot(u.x-v.x,u.y-v.y)))));
  const before=structuredClone(s);introView(s);assert.deepEqual(s,before);
 }
});

test('chosen hand identity consumes that card only and arbitrary order restores exactly',()=>{
 const s=createState(20261011,PLAY_STAGE,'endless','clustered-v1'),actions:Action[]=[];
 for(const [seedIndex,x,y] of [[2,36,27],[0,39,27],[4,42,27]]){
  const before=structuredClone(s),stats=structuredClone(seedStats(s,seedIndex));assert.ok(stats);assert.deepEqual(seedStats(s,seedIndex),stats);assert.deepEqual(s,before);
  assert.ok(place(s,x,y,seedIndex).ok);actions.push({tick:s.tick,kind:'place',x,y,seedIndex});const u=s.units.at(-1)!;assert.deepEqual(u.stats,stats);assert.equal(u.seedIndex,seedIndex);
  assert.equal(place(s,x+1,y,seedIndex).ok,false);assert.ok(s.hand!.some(c=>c.id===1));assert.ok(s.hand!.some(c=>c.id===3));
 }
 for(let i=0;i<200;i++)step(s);
 const save=capture(s,4,actions,new BoardCamera(introView(s),s.stage).view);assert.equal(save.version,'2026-10-11-snapshot-8');assert.deepEqual(replay(save).state,s);
 assert.equal(capture(createState(11,COMPARISON_STAGE,'endless'),1,[]).version,'2026-10-11-snapshot-6');
});

test('new hand rejects duplicate identities and consumed cards while preserving raw backup',()=>{
 const s=createState(11,PLAY_STAGE,'endless','clustered-v1');assert.ok(place(s,36,27,3).ok);
 const bad=structuredClone(s);bad.hand![1].id=bad.hand![0].id;assert.throws(()=>replay(capture(bad,1,[])));
 const raw=JSON.stringify(capture(bad,1,[])),data=new Map([[SAVE_KEY,raw]]),store=new RunStore({getItem:k=>data.get(k)??null,setItem:(k,v)=>{data.set(k,v);}});
 assert.equal(store.read().kind,'invalid');assert.equal(store.write(capture(s,1,[])),false);assert.equal(data.get(SAVE_KEY),raw);assert.equal(store.write(capture(s,1,[]),true),true);assert.equal(data.get(BACKUP_KEY),raw);assert.equal(store.read().kind,'loaded');
});

test('same hand offers different immediate attacks, mature attacks and exposure by placement',()=>{
 const s=createState(20261011,PLAY_STAGE,'endless','clustered-v1'),enemy=s.units[0],outcomes=[];
 for(let y=enemy.y-8;y<=enemy.y+8;y+=.5)for(let x=enemy.x-8;x<=enemy.x+8;x+=.5){if(validatePlacement(s,x,y,1).ok){const f=placementForecast(s,x,y,1)!;outcomes.push(f);}}
 assert.ok(outcomes.some(f=>f.targetId!==null));assert.ok(outcomes.some(f=>f.targetId===null&&f.grownTargetId!==null));assert.ok(outcomes.some(f=>f.grownTargetId===null));assert.ok(new Set(outcomes.map(f=>f.incomingIds.join(','))).size>1);
 const empty=s.units.filter(u=>u.team==='enemy');for(let i=0;i<1200&&s.outcome==='playing';i++)step(s);assert.notEqual(s.outcome,'win');assert.ok(s.units.some(u=>u.team==='enemy'));assert.equal(empty.length,24);
 const stats={power:10,range:6.1,presence:.5,vitality:70};assert.equal(dominant(stats),'range');
});
