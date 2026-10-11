import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createState,place,step,validatePlacement,placementForecast,dominant,growth,effectiveRange,supplyStats,applyMultipliers,baseMultipliers,type State} from '../src/sim.js';
import {PLAY_STAGE,COMPARISON_STAGE} from '../src/stage.js';
import {capture,replay,RunStore,SAVE_KEY,BACKUP_KEY,type Action} from '../src/session.js';

function firstPlacement(s:State){
 const enemy=s.units[0],points=[] as {x:number;y:number;score:number}[];
 for(let y=enemy.y-6;y<=enemy.y+6;y+=.4)for(let x=enemy.x-6;x<=enemy.x+6;x+=.4)if(validatePlacement(s,x,y,2).ok){const f=placementForecast(s,x,y,2)!;points.push({x,y,score:f.damage-f.incomingDamage*.3});}
 points.sort((a,b)=>b.score-a.score);assert.ok(points.length);return points[0];
}
function rewardRun(seed:number){
 const s=createState(seed,PLAY_STAGE,'endless','clustered-v1'),p=firstPlacement(s),actions:Action[]=[{tick:0,kind:'place',x:p.x,y:p.y,seedIndex:2}];assert.ok(place(s,p.x,p.y,2).ok);
 const hand=structuredClone(s.hand),stats=new Map(s.units.filter(u=>u.team==='ally').map(u=>[u.id,structuredClone(u.stats)]));
 for(let i=0;i<600&&!s.player!.rewards.length;i++)step(s);assert.ok(s.player!.rewards.length,'natural combat earns a reward');
 return {s,actions,hand,stats};
}

test('natural classified kill freezes existing hand and allies, while next entries alone get current multipliers',()=>{
 for(const seed of [20261011,11]){
  const {s,actions,hand,stats}=rewardRun(seed),initial=createState(seed,PLAY_STAGE,'endless','clustered-v1');
  assert.deepEqual(s.hand,hand);for(const u of s.units.filter(u=>u.team==='ally'))assert.deepEqual(u.stats,stats.get(u.id));
  const reward=s.player!.rewards[0],kind=dominant(initial.units.find(u=>u.id===reward.enemyId)!.stats);assert.equal(s.player!.multipliers[kind],1.01);
  const oldCard=structuredClone(s.hand!.find(c=>c.id===0)!);assert.ok(place(s,36,27,0).ok);actions.push({tick:s.tick,kind:'place',x:36,y:27,seedIndex:0});assert.deepEqual(s.units.at(-1)!.stats,oldCard.baseStats);assert.deepEqual(s.units.at(-1)!.seedSnapshot,oldCard.snapshot);
  const next=s.hand!.find(c=>c.id===5)!;assert.equal(next.snapshot!.appliedMultipliers[kind],1.01);assert.deepEqual(next.snapshot!.rawStats,supplyStats(seed,s.stage,5));assert.deepEqual(next.baseStats,applyMultipliers(next.snapshot!.rawStats,next.snapshot!.appliedMultipliers));assert.notDeepEqual(next.baseStats,next.snapshot!.rawStats);
  assert.notStrictEqual(next.snapshot!.appliedMultipliers,s.player!.multipliers);assert.ok(place(s,39,27,5).ok);actions.push({tick:s.tick,kind:'place',x:39,y:27,seedIndex:5});assert.deepEqual(s.units.at(-1)!.stats,next.baseStats);assert.deepEqual(s.units.at(-1)!.seedSnapshot,next.snapshot);
  assert.deepEqual(replay(capture(s,4,actions)).state,s);
 }
});

test('growth continues independently of frozen abilities and snapshot survives continued deterministic play',()=>{
 const {s,actions}=rewardRun(20261011),u=s.units.find(u=>u.id===28)!;assert.ok(growth(u)>.65);const base=structuredClone(u.stats),frozen=structuredClone(u.seedSnapshot),beforeRange=effectiveRange(u);
 const restored=replay(capture(s,2,actions)).state;
 for(let i=0;i<36;i++){step(s);step(restored);}assert.deepEqual(restored,s);
 const grown=s.units.find(v=>v.id===28)!;assert.ok(grown);assert.deepEqual(grown.stats,base);assert.deepEqual(grown.seedSnapshot,frozen);assert.ok(effectiveRange(grown)>beforeRange);assert.equal(growth(grown),1.3);
 const again=rewardRun(20261011);for(let i=0;i<36;i++)step(again.s);assert.deepEqual(again.s,s);
});

test('same-tick deaths reward each derived classification exactly once, without retroactive changes',()=>{
 const s=createState(11,PLAY_STAGE,'endless','clustered-v1'),hand=structuredClone(s.hand),expected=baseMultipliers(),dead=s.units.filter(u=>u.team==='enemy').slice(0,3);
 for(const u of dead){const k=dominant(u.stats);expected[k]=+(expected[k]+.01).toFixed(2);u.hp=0;}
 step(s);assert.equal(s.player!.rewards.length,3);assert.deepEqual(s.player!.multipliers,expected);assert.deepEqual(s.hand,hand);assert.ok(s.player!.rewards.every(r=>r.tick===1));step(s);assert.equal(s.player!.rewards.length,3);
 assert.deepEqual(replay(capture(s,1,[])).state,s);
});

test('signed inconsistent fixed ability, generation, entry reward and player histories are rejected without overwrite',()=>{
 const {s,actions}=rewardRun(20261011);place(s,36,27,0);actions.push({tick:s.tick,kind:'place',x:36,y:27,seedIndex:0});
 const mutations=[(v:State)=>{v.hand!.at(-1)!.snapshot!.appliedMultipliers.range+=.01;},(v:State)=>{v.hand!.at(-1)!.baseStats.range+=.1;},(v:State)=>{v.hand!.at(-1)!.snapshot!.rawStats.power+=.01;},(v:State)=>{v.hand!.at(-1)!.snapshot!.rewardEnemyIds=[];},(v:State)=>{v.hand!.at(-1)!.snapshot!.enteredAtTick=0;},(v:State)=>{v.player!.multipliers.range+=.01;},(v:State)=>{v.player!.rewards.push({...v.player!.rewards[0]});},(v:State)=>{v.units.find(u=>u.id===28)!.seedSnapshot!.appliedMultipliers.range=1.01;}];
 const good=JSON.stringify(capture(s,1,actions)),mem=new Map([[SAVE_KEY,good]]),store=new RunStore({getItem:k=>mem.get(k)??null,setItem:(k,v)=>{mem.set(k,v);}});
 for(const mutate of mutations){const bad=structuredClone(s);mutate(bad);const signed=capture(bad,1,actions);assert.throws(()=>replay(signed));mem.set(SAVE_KEY,JSON.stringify(signed));assert.equal(store.read().kind,'invalid');assert.equal(store.write(capture(s,1,actions)),false);assert.equal(mem.get(SAVE_KEY),JSON.stringify(signed));}
});

test('real snapshot-7 remains exact and unboosted; explicit new run backs it up before snapshot-8',()=>{
 const raw=readFileSync('tests/fixtures/snapshot-7.json','utf8'),old=JSON.parse(raw),mem=new Map([[SAVE_KEY,raw]]),store=new RunStore({getItem:k=>mem.get(k)??null,setItem:(k,v)=>{mem.set(k,v);}});
 const loaded=store.read();assert.equal(loaded.kind,'loaded');assert.equal(mem.get(SAVE_KEY),raw);if(loaded.kind!=='loaded')return;
 assert.deepEqual(loaded.state,old.snapshot);assert.equal(loaded.state.player,undefined);assert.equal(loaded.save.version,'2026-10-11-snapshot-7');assert.deepEqual(replay(loaded.save).state,old.snapshot);
 const fresh=createState(old.seed,PLAY_STAGE,'endless','clustered-v1');assert.equal(capture(fresh,1,[]).version,'2026-10-11-snapshot-8');assert.ok(store.write(capture(fresh,1,[]),true));assert.equal(mem.get(BACKUP_KEY),raw);assert.equal(store.read().kind,'loaded');
 const legacy=createState(11,COMPARISON_STAGE,'endless');assert.equal(legacy.player,undefined);assert.equal(capture(legacy,1,[]).version,'2026-10-11-snapshot-6');
});
