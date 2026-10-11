import {test} from 'node:test';
import assert from 'node:assert/strict';
import {setTimeout as pause} from 'node:timers/promises';
import {validBindings,type Seed} from '../src/eco-contract.js';
import {createEco,stepEco,placeEco,validateEcoPlacement,currentStats,targetFor,ECO_LIMITS,type State} from '../src/eco-sim.js';
import {ecoCapture,ecoReplay,EcoStore,ECO_SAVE_KEY,ECO_BACKUP_KEY,ECO_CHECKPOINT_KEY,type Storage} from '../src/eco-save.js';
import {resolveUnitSelection} from '../src/eco-selection.js';

const view={x:2048,y:1536,zoom:1};
// Fixed holdouts spread over uint32, independent of the tuning/opening seed lists.
const seeds=Array.from({length:64},(_,i)=>(0xA341316C+Math.imul(i+1,0x9E3779B9))>>>0);
const profiles=[undefined,'quarter-v1','nearest'] as const;
const opening=(seed:number,profile:typeof profiles[number])=>createEco(seed,2,profile? 'quarter-v1':undefined,profile==='nearest'?'presence-nearest-v1':undefined,'spaced-pockets-v1');
function finiteTree(value:unknown){
 if(typeof value==='number')assert.ok(Number.isFinite(value));
 else if(Array.isArray(value))value.forEach(finiteTree);
 else if(value&&typeof value==='object')Object.values(value).forEach(finiteTree);
}
function invariant(s:State){
 finiteTree(s);assert.ok(s.units.length<=ECO_LIMITS.units);assert.ok(s.hand.length<=ECO_LIMITS.hand);
 assert.ok(Number.isInteger(s.charges)&&s.charges>=0&&s.charges<=ECO_LIMITS.charges);
 assert.ok(s.events.length<=8);assert.equal(new Set(s.units.map(u=>u.id)).size,s.units.length);
 const origins=s.units.flatMap(u=>u.enemyOrigins).concat(s.player.rewards.flatMap(r=>r.enemyOrigins));
 assert.deepEqual([...origins].sort((a,b)=>a-b),Array.from({length:24},(_,i)=>i+1));
 const lineage=s.units.flatMap(u=>u.lineage);assert.equal(new Set(lineage).size,lineage.length);
 for(const u of s.units){assert.ok(validBindings(u.seed.bindings));finiteTree(currentStats(u));
  assert.ok(u.hp>0&&u.hp<=currentStats(u).maxHp);assert.equal(u.age,s.tick-u.born);
  const target=targetFor(u,s.units);if(target){assert.ok(s.units.includes(target));assert.notEqual(target.team,u.team);}
  if(u.lastShot){assert.ok(u.lastShot.target>0&&u.lastShot.target<s.nextId);assert.ok(u.lastShot.tick<=s.tick);}
 }
 for(const c of s.hand)assert.ok(validBindings(c.seed.bindings));
 assert.deepEqual(ecoReplay(ecoCapture(s,view)).state,s);
}

test('64 dispersed holdout seeds across three morning profiles have legal opening witnesses and immutable rejected actions',async t=>{
 assert.equal(new Set(seeds).size,64);assert.ok(!seeds.some(s=>[0,1,11,77,103,811,20261011,4294967295].includes(s)));
 for(const seed of seeds){for(const profile of profiles){const s=opening(seed,profile);invariant(s);
  // An explicit witness is stronger than interpreting a bounded search failure.
  const p=[{x:40,y:40},{x:4056,y:3032},{x:2048,y:1536}].find(p=>validateEcoPlacement(s,p.x,p.y,s.hand[0].id).ok);
  assert.ok(p,`seed ${seed}, profile ${profile}: no legal opening witness`);
  const before=structuredClone(s),card=structuredClone(s.hand[0]),id=s.nextId;
  for(const [x,y,cardId] of [[NaN,40,card.id],[Infinity,40,card.id],[-1,40,card.id],[40,40,-1],[s.units[0].x,s.units[0].y,card.id]]){
   assert.equal(placeEco(s,x,y,cardId).ok,false);assert.deepEqual(s,before);
  }
  assert.ok(placeEco(s,p.x,p.y,card.id).ok);assert.equal(s.charges,before.charges-1);assert.equal(s.hand.length,before.hand.length-1);
  assert.equal(s.nextId,id+1);assert.equal(s.nextCard,before.nextCard);assert.deepEqual(s.units.find(u=>u.id===id)!.seed,card.seed);
  assert.equal(s.hand.some(c=>c.id===card.id),false);invariant(s);
 }await pause(5);}
 t.diagnostic('192 generated openings; explicit legal witnesses; no seed or balance tuning');
});

test('bounded natural holdout trajectories preserve frozen cards, resources, provenance and selection through growth merges and deaths',async t=>{
 let mergeChanges=0,deaths=0,growth=0,missingHistoricalShots=0;
 for(const seed of seeds.slice(0,8)){for(const profile of profiles){const s=opening(seed,profile),frozen=new Map<number,Seed>(s.hand.map(c=>[c.id,structuredClone(c.seed)]));
  for(let tick=0;tick<600;tick++){
   const before=s.units.map(u=>({id:u.id,team:u.team,diameter:u.diameter})),oldMerges=s.merges;
   stepEco(s);mergeChanges+=s.merges-oldMerges;
   for(const old of before){const next=resolveUnitSelection(s,old.id,old.team);
    if(next!==null){const receiver=s.units.find(u=>u.id===next)!;assert.equal(receiver.team,old.team);assert.ok(receiver.lineage.includes(old.id));if(receiver.diameter>old.diameter)growth++;}
    else{assert.ok(!s.units.some(u=>u.lineage.includes(old.id)));deaths++;}
    assert.equal(resolveUnitSelection(s,old.id,old.team==='ally'?'enemy':'ally'),null);
   }
   assert.equal(resolveUnitSelection(s,null,'ally'),null);assert.equal(resolveUnitSelection(s,s.nextId+100,'enemy'),null);
   for(const c of s.hand){if(frozen.has(c.id))assert.deepEqual(c.seed,frozen.get(c.id));else frozen.set(c.id,structuredClone(c.seed));}
   if(tick%40===0||tick===599){invariant(s);for(const u of s.units)if(u.lastShot&&!s.units.some(v=>v.id===u.lastShot!.target))missingHistoricalShots++;}
  }
  const restored=ecoReplay(ecoCapture(s,view)).state;for(let n=0;n<5;n++){stepEco(s);stepEco(restored);}assert.deepEqual(restored,s);
 }await pause(10);}
 assert.ok(growth>0);assert.ok(mergeChanges>0);assert.ok(deaths>0);
 t.diagnostic(JSON.stringify({trajectories:24,ticksPerTrajectory:605,mergeChanges,deaths,growth,missingHistoricalShots}));
});

test('consuming all placement charges rejects another valid-point action without consuming a frozen card',()=>{
 for(const seed of seeds.slice(0,8)){const s=opening(seed,'quarter-v1');for(const [x,y] of [[40,40],[400,40],[800,40]])assert.ok(placeEco(s,x,y,s.hand[0].id).ok);
  assert.equal(s.charges,0);const before=structuredClone(s);assert.equal(placeEco(s,1200,40,s.hand[0].id).ok,false);assert.deepEqual(s,before);invariant(s);
 }
});

function isolated(raw:string){const data=new Map([[ECO_SAVE_KEY,raw],[ECO_BACKUP_KEY,'prior backup'],[ECO_CHECKPOINT_KEY,'retained point'],['morishi.run.v1','legacy retained']]);
 const storage:Storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>{data.set(k,v);}};return {data,storage};}
const fresh=()=>ecoCapture(opening(seeds[0],undefined),view);

test('malformed truncated old and signed-invalid saves remain byte-for-byte protected until an explicit backed-up replacement',()=>{
 const valid=JSON.stringify(fresh());
 const badState=fresh().state;badState.hand[0].seed.bindings.ice=badState.hand[0].seed.bindings.fire;
 const badStates=[JSON.stringify(ecoCapture(badState,view))];
 for(const mutate of [(s:State)=>{s.charges=-1;},(s:State)=>{s.units[1].id=s.units[0].id;},(s:State)=>{s.units[0].lastShot={tick:0,target:s.nextId,x:1,y:1,damage:1};},(s:State)=>{s.hand[0].seed.fixed.elements.fire++;}]){
  const s=fresh().state;mutate(s);badStates.push(JSON.stringify(ecoCapture(s,view)));
 }
 const raws=['','null','[]','{}','{"version":"snapshot-3"}','{"version":"eco-old"}',valid.slice(0,1),valid.slice(0,Math.floor(valid.length/2)),valid.slice(0,-1),...badStates];
 for(const raw of raws){const {data,storage}=isolated(raw),store=new EcoStore(storage),before=new Map(data);
  assert.equal(store.read().kind,'invalid');assert.equal(store.write(fresh()),false);assert.deepEqual(data,before);
  const restart=new EcoStore(storage);assert.equal(restart.read().kind,'invalid');assert.equal(restart.write(fresh()),false);assert.deepEqual(data,before);
  assert.ok(restart.write(fresh(),true));assert.equal(data.get(ECO_BACKUP_KEY),raw);assert.equal(restart.read().kind,'loaded');
  assert.equal(data.get(ECO_CHECKPOINT_KEY),'retained point');assert.equal(data.get('morishi.run.v1'),'legacy retained');
 }
});

test('interrupted replacement at each atomic storage boundary preserves the primary and permits explicit recovery after restart',()=>{
 // localStorage.setItem is atomic per key. Fail before a write; do not invent torn per-key writes.
 for(const raw of [JSON.stringify(ecoCapture(createEco(seeds[1]),view)),'truncated original'])for(const fault of [ECO_BACKUP_KEY,ECO_SAVE_KEY]){
  const {data,storage}=isolated(raw);let fail=true;const writes:string[]=[];
  const faulty:Storage={getItem:storage.getItem,setItem:(k,v)=>{writes.push(k);if(fail&&k===fault)throw Error('interrupted atomic write');storage.setItem(k,v);}};
  const store=new EcoStore(faulty);store.read();assert.equal(store.write(fresh(),true),false);assert.equal(data.get(ECO_SAVE_KEY),raw);
  assert.equal(data.get(ECO_BACKUP_KEY),fault===ECO_BACKUP_KEY?'prior backup':raw);
  assert.equal(data.get(ECO_CHECKPOINT_KEY),'retained point');assert.equal(data.get('morishi.run.v1'),'legacy retained');
  fail=false;const restart=new EcoStore(faulty);restart.read();assert.ok(restart.write(fresh(),true));assert.equal(data.get(ECO_BACKUP_KEY),raw);
  assert.equal(restart.read().kind,'loaded');assert.deepEqual(writes.slice(-2),[ECO_BACKUP_KEY,ECO_SAVE_KEY]);
 }
});

test('valid metadata-omitted legacy comparison saves and failed normal/checkpoint writes preserve exact prior data',()=>{
 const legacy=ecoCapture(createEco(seeds[2]),view);const raw=JSON.stringify(legacy),{data,storage}=isolated(raw);
 assert.deepEqual(ecoReplay(JSON.parse(raw)),legacy);assert.equal(legacy.state.enemyLayout,undefined);
 let fault=ECO_SAVE_KEY;const store=new EcoStore({getItem:storage.getItem,setItem:(k,v)=>{if(k===fault)throw Error('quota');storage.setItem(k,v);}});
 assert.equal(store.read().kind,'loaded');const before=new Map(data);assert.equal(store.write(fresh()),false);assert.deepEqual(data,before);
 fault=ECO_CHECKPOINT_KEY;assert.equal(store.writeCheckpoint(fresh()),false);assert.deepEqual(data,before);
 fault='';assert.ok(store.write(fresh()));assert.equal(data.get(ECO_BACKUP_KEY),'prior backup');assert.equal(data.get(ECO_CHECKPOINT_KEY),'retained point');
 const unavailable=new EcoStore({getItem:()=>{throw Error('unavailable');},setItem:()=>{throw Error('unavailable');}});
 assert.equal(unavailable.read().kind,'invalid');assert.equal(unavailable.write(fresh(),true),false);
 assert.equal(unavailable.readCheckpoint().kind,'invalid');assert.equal(unavailable.writeCheckpoint(fresh()),false);
});
