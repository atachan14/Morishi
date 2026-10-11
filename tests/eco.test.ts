import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ELEMENTS,ROLES,generateSeed,validBindings,rolesFrom,ones,bodyRadius,elementScale} from '../src/eco-contract.js';
import {createEco,stepEco,placeEco,mergeContacts,currentElements,currentStats,validateEcoPlacement,ECO_LIMITS} from '../src/eco-sim.js';
import {ecoCapture,ecoReplay,EcoStore,ECO_SAVE_KEY,ECO_BACKUP_KEY} from '../src/eco-save.js';

test('individual mappings are reproducible bijections and size is an actual diameter',()=>{
 const maps=new Set<string>();for(let i=0;i<96;i++){const seed=generateSeed(11,'hand',i);assert.ok(validBindings(seed.bindings));assert.deepEqual(seed,generateSeed(11,'hand',i));maps.add(JSON.stringify(seed.bindings));const roles=rolesFrom(seed.fixed.elements,seed.bindings);assert.deepEqual(Object.values(roles).sort(),Object.values(seed.fixed.elements).sort());assert.deepEqual(Object.values(seed.bindings).sort(),[...ROLES].sort());}
 assert.ok(maps.size>12);assert.equal(bodyRadius(200),100);assert.equal(elementScale(1),1);assert.equal(elementScale(100),1.99);assert.equal(elementScale(200),2.99);
 assert.throws(()=>rolesFrom(ones(),{fire:'attack',ice:'attack',electric:'speed',dark:'range'}));
});
test('growth changes current abilities without changing hand-entry bases',()=>{
 const s=createEco(11),u=s.units[0],seed=structuredClone(u.seed),hand=structuredClone(s.hand),before=currentElements(u);for(let i=0;i<10;i++)stepEco(s);
 assert.deepEqual(u.seed,seed);assert.deepEqual(s.hand,hand);assert.ok(u.diameter>seed.initialDiameter);for(const e of ELEMENTS)assert.ok(currentElements(u)[e]>before[e]);assert.ok(currentStats(u).speed<=4);
});
test('contact absorption conserves body area, keeps absorber mapping, and transfers current abilities once',()=>{
 const s=createEco(11),a=s.units[0],b=s.units[1];a.diameter=40;b.diameter=30;b.x=a.x+34;b.y=a.y;s.units=[a,b];const before=currentElements(b),mapping=structuredClone(a.seed.bindings),expected=Math.sqrt(40**2+30**2);a.hp=currentStats(a).maxHp;b.hp=currentStats(b).maxHp;
 assert.equal(mergeContacts(s),1);assert.equal(s.units.length,1);assert.equal(a.diameter,expected);assert.deepEqual(a.seed.bindings,mapping);assert.deepEqual(a.bonus.elements,before);assert.deepEqual(a.enemyOrigins,[1,2]);assert.equal(mergeContacts(s),0);assert.equal(s.merges,1);const bonus=structuredClone(a.bonus);a.diameter=100;assert.deepEqual(a.bonus,bonus);
});
test('merge ordering is stable, opposing teams never merge, and caps reject without shrinking',()=>{
 const s=createEco(11);s.units=s.units.slice(0,12);s.units.forEach(u=>{u.x=1000;u.y=1000;u.diameter=20;});assert.equal(mergeContacts(s),11);assert.equal(s.units[0].id,1);assert.equal(s.units[0].lineage.length,12);assert.equal(mergeContacts(s),0);
 const t=createEco(11),a=t.units[0],b=t.units[24];t.units=[a,b];a.x=b.x=1000;a.y=b.y=1000;assert.equal(mergeContacts(t),0);b.team='enemy';a.diameter=b.diameter=ECO_LIMITS.diameter;assert.equal(mergeContacts(t),0);assert.equal(a.diameter,ECO_LIMITS.diameter);
});
test('independent draw and placement clocks pause only their full resource and retain fractions',()=>{
 const s=createEco(11);s.units=s.units.filter(u=>u.team==='enemy');s.charges=5;s.turnProgress=.4;s.drawProgress=.3;s.player.drowHeist=2;s.player.turnHeist=.5;for(let i=0;i<14;i++)stepEco(s);assert.equal(s.hand.length,5);assert.equal(s.turnProgress,.4);assert.equal(s.charges,5);s.hand.push({kind:'plant',id:s.nextCard,seed:generateSeed(s.seed,'hand',s.nextCard++,s.tick,s.player.boosts,s.player.rewards.map(r=>r.id))});const fraction=s.drawProgress,index=s.nextCard;s.charges=0;for(let i=0;i<100;i++)stepEco(s);assert.equal(s.drawProgress,fraction);assert.equal(s.nextCard,index);assert.equal(s.charges,1);assert.ok(placeEco(s,2048,1536,s.hand[0].id).ok);stepEco(s);assert.ok(s.drawProgress>fraction);const old=structuredClone(s);s.outcome='ended';stepEco(s);assert.equal(s.tick,old.tick);
});
test('normal combat rewards are unique, new hand entry alone uses boosts, and exact saves resume deterministically',()=>{
 const s=createEco(20261011),frozen=structuredClone(s.hand),bases=s.units.filter(u=>u.team==='ally').map(u=>[u.id,structuredClone(u.seed)]);assert.ok(placeEco(s,730,650,2).ok);
 for(let i=0;i<600&&!s.player.rewards.length;i++)stepEco(s);assert.ok(s.player.rewards.length,'opening combat produces a classified defeat');for(const c of s.hand.filter(c=>c.id<4))assert.deepEqual(c,frozen.find(f=>f.id===c.id));for(const [id,seed] of bases){const u=s.units.find(u=>u.id===id);if(u)assert.deepEqual(u.seed,seed);}
 assert.ok(placeEco(s,2048,1536,s.hand[0].id).ok);const wanted=s.nextCard;for(let i=0;i<50&&s.nextCard===wanted;i++)stepEco(s);const card=s.hand.find(c=>c.id===wanted)!;assert.ok(card);assert.deepEqual(card.seed.entry.boosts,s.player.boosts);assert.ok(card.seed.entry.rewardIds.length);assert.deepEqual(card.seed.raw,generateSeed(s.seed,'hand',card.id).raw);
 const view={x:2048,y:1536,zoom:1},restored=ecoReplay(ecoCapture(s,view)).state;for(let i=0;i<120;i++){stepEco(s);stepEco(restored);}assert.deepEqual(restored,s);assert.equal(new Set(s.player.rewards.flatMap(r=>r.enemyOrigins)).size,s.player.rewards.flatMap(r=>r.enemyOrigins).length);assert.deepEqual(ecoReplay(ecoCapture(s,view)).state,s);
});
test('signed inconsistent seeds, multiplier history and duplicate provenance reject while original keys survive',()=>{
 const s=createEco(11),view={x:2048,y:1536,zoom:1};for(const mutate of [(v:typeof s)=>{v.hand[0].seed.fixed.elements.fire++;},(v:typeof s)=>{v.units[1].lineage=[1,2];},(v:typeof s)=>{v.player.boosts.fire=2;},(v:typeof s)=>{v.units[0].enemyOrigins=[1,2];}]){const bad=structuredClone(s);mutate(bad);assert.throws(()=>ecoReplay(ecoCapture(bad,view)));}
 const memory=new Map([['morishi.run.v1','old snapshot preserved'],[ECO_SAVE_KEY,'corrupt']]),store=new EcoStore({getItem:k=>memory.get(k)??null,setItem:(k,v)=>{memory.set(k,v);}});assert.equal(store.read().kind,'invalid');assert.equal(store.write(ecoCapture(s,view)),false);assert.equal(memory.get(ECO_SAVE_KEY),'corrupt');assert.ok(store.write(ecoCapture(s,view),true));assert.equal(memory.get(ECO_BACKUP_KEY),'corrupt');assert.equal(memory.get('morishi.run.v1'),'old snapshot preserved');
});
test('bounded natural runs keep speed finite, preserve enemy provenance and retain legal empty corners',()=>{
 for(const seed of [11,20261011]){const s=createEco(seed);for(let i=0;i<900;i++)stepEco(s);assert.ok(s.units.length<=ECO_LIMITS.units);assert.ok(s.units.every(u=>currentStats(u).speed<=4&&Number.isFinite(u.hp)&&u.diameter<=ECO_LIMITS.diameter));assert.ok(validateEcoPlacement(s,40,40,s.hand[0].id).ok);assert.deepEqual(ecoReplay(ecoCapture(s,{x:2048,y:1536,zoom:1})).state,s);}
});
