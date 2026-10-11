import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ecoCapture,ecoReplay} from '../src/eco-save.js';
import {placementPreview} from '../src/eco-guidance.js';
import {createEco,currentStats,targetCandidates,targetFor,damageFor,stepEco,enemyPresence,validateEcoPlacement,placeEco,PRESENCE_STRENGTH,falloff,type Unit} from '../src/eco-sim.js';
function encounter(){const s=createEco(11,2,'quarter-v1'),enemy=s.units[0],front=s.units[24],rear=s.units[25];enemy.x=1000;enemy.y=1000;front.x=1060;front.y=1000;rear.x=1095;rear.y=1000;s.units=[enemy,front,rear];return {s,enemy,front,rear};}
test('target candidates are living opponents within attack support before presence is compared',()=>{
 const {enemy,front,rear}=encounter();const range=currentStats(enemy).range;front.x=enemy.x+range;rear.x=enemy.x+2*range+.01;rear.diameter=1000;rear.hp=currentStats(rear).maxHp;assert.equal(targetFor(enemy,[rear,enemy,front])?.id,front.id);assert.ok(damageFor(enemy,front)>0);front.hp=0;assert.equal(targetFor(enemy,[rear,front,enemy]),undefined);
});
test('legacy zero-presence and full-presence ties use ID, even when another opponent is closer',()=>{
 const {enemy,front,rear}=encounter();front.x=enemy.x+currentStats(enemy).range*1.5;rear.x=enemy.x+currentStats(enemy).range*1.1;assert.equal(falloff(front.x-enemy.x,currentStats(front).presence),0);assert.equal(falloff(rear.x-enemy.x,currentStats(rear).presence),0);assert.equal(targetFor(enemy,[rear,front])?.id,front.id);
 front.x=enemy.x+2;rear.x=enemy.x+1;assert.equal(targetFor(enemy,[rear,front])?.id,front.id);assert.equal(targetFor(enemy,[front,rear])?.id,front.id);
});
test('nonzero decayed presence beats a closer opponent outside its smaller halo',()=>{
 const {enemy,front,rear}=encounter();front.x=enemy.x+30;rear.x=enemy.x+35;rear.diameter=60;rear.hp=currentStats(rear).maxHp;assert.equal(targetFor(enemy,[front,rear])?.id,rear.id);assert.equal(PRESENCE_STRENGTH,2);
});
test('enemy placement sums presence from multiple enemies instead of target maximum',()=>{
 const s=createEco(11,2),a=s.units[0],b=s.units[1];a.x=1000;a.y=1000;b.x=1000;b.y=1001;b.seed=structuredClone(a.seed);a.diameter=b.diameter=16;const rr=currentStats(a).presence;const x=1000+rr*1.6,y=1000;const each=PRESENCE_STRENGTH*falloff(rr*1.6,rr);assert.ok(each<1.5);s.units=[a];assert.ok(validateEcoPlacement(s,x,y,0).ok);s.units.push(b);assert.ok(enemyPresence(s,x,y)>1.5);assert.equal(validateEcoPlacement(s,x,y,0).ok,false);
});
test('combat selects again each tick and cannot lock onto a stronger out-of-range body',()=>{
 const {s,enemy,front,rear}=encounter();const range=currentStats(enemy).range;front.x=enemy.x+range;rear.x=enemy.x+2*range+200;rear.diameter=200;rear.hp=currentStats(rear).maxHp;enemy.attackProgress=1;stepEco(s);assert.equal(enemy.lastShot?.target,front.id);assert.ok(enemy.lastShot!.damage>0);front.hp=0;rear.x=enemy.x+range;enemy.attackProgress=1;stepEco(s);assert.equal(enemy.lastShot?.target,rear.id);
});

test('nearest comparison changes only exact presence ties, with distance then ID and no out-of-range attraction',()=>{
 const {enemy,front,rear}=encounter();enemy.targetPolicy='presence-nearest-v1';const range=currentStats(enemy).range;front.x=enemy.x+range*1.5;rear.x=enemy.x+range*1.1;assert.equal(targetFor(enemy,[front,rear])?.id,rear.id);front.x=rear.x;assert.equal(targetFor(enemy,[rear,front])?.id,front.id);front.x=enemy.x+2;rear.x=enemy.x+1;assert.equal(targetFor(enemy,[front,rear])?.id,rear.id);front.x=enemy.x+30;rear.x=enemy.x+35;rear.diameter=60;assert.equal(targetFor(enemy,[front,rear])?.id,rear.id);rear.x=enemy.x+range*2+.01;assert.equal(targetFor(enemy,[front,rear])?.id,front.id);assert.ok(targetCandidates(enemy,[front,rear])[0].distance<range*2);
});
test('legacy ranking refactor matches the previous comparator on generated runs at multiple times',()=>{
 const previous=(u:Unit,units:Unit[])=>units.filter(v=>v.team!==u.team&&v.hp>0&&Math.hypot(u.x-v.x,u.y-v.y)<currentStats(u).range*2-1e-6).sort((a,b)=>{const score=(v:Unit)=>2*falloff(Math.hypot(u.x-v.x,u.y-v.y),currentStats(v).presence);return score(b)-score(a)||a.id-b.id;})[0];for(const seed of [11,77,20261011]){const s=createEco(seed,2,'quarter-v1');for(let tick=0;tick<=300;tick++){if([0,40,100,300].includes(tick))for(const u of s.units)assert.equal(targetFor(u,[...s.units].reverse())?.id,previous(u,s.units)?.id);if(tick<300)stepEco(s);}}
});
test('a generated front absorbs enemy attacks while an independent rear still attacks for a useful early window',()=>{
 const s=createEco(11,2,'quarter-v1','presence-nearest-v1'),enemy=s.units[0],initial=s.units[24];assert.ok(placeEco(s,enemy.x-60,enemy.y-45,1).ok);assert.ok(placeEco(s,enemy.x-120,enemy.y-45,2).ok);assert.ok(placeEco(s,enemy.x-120,enemy.y+45,0).ok);let frontDamage=0,rearShots=0,initialDamage=0;for(let i=0;i<100;i++){const units=[...s.units];stepEco(s);for(const u of units){if(u.lastShot?.tick!==s.tick)continue;if(u.team==='enemy'){if(u.lastShot.target===28)frontDamage+=u.lastShot.damage;if(u.lastShot.target===initial.id)initialDamage+=u.lastShot.damage;}else if(u.id===30&&u.lastShot.damage>0)rearShots++;}}assert.ok(frontDamage>100);assert.equal(initialDamage,0);assert.ok(rearShots>=5);assert.ok(s.units.find(u=>u.id===28)!.hp>90);assert.equal(s.units.find(u=>u.id===30)!.lineage.length,1);
});

test('target policy resumes deterministically after growth, absorption and later hand entry without migrating old runs',()=>{
 for(const seed of [11,77,20261011]){const s=createEco(seed,2,'quarter-v1','presence-nearest-v1'),a=s.units[24];assert.ok(placeEco(s,a.x-8.1,a.y,0).ok);for(let i=0;i<300;i++)stepEco(s);const saved=ecoCapture(s,{x:2048,y:1536,zoom:1}),copy=ecoReplay(saved).state;for(let i=0;i<100;i++){stepEco(s);stepEco(copy);}assert.deepEqual(copy,s);assert.ok(s.units.every(u=>u.targetPolicy==='presence-nearest-v1'));}
 for(const policy of [undefined,'quarter-v1','guard-v1'] as const){const s=createEco(11,2,policy),before=JSON.stringify(s);const loaded=ecoReplay(ecoCapture(s,{x:2048,y:1536,zoom:1}));assert.equal(loaded.state.targetPolicy,undefined);assert.equal(JSON.stringify(loaded.state),before);}
});
test('unknown and mixed target policies are rejected instead of changing a saved rule',()=>{
 assert.throws(()=>createEco(11,2,'quarter-v1','bad' as 'presence-nearest-v1'));const s=createEco(11,2,'quarter-v1','presence-nearest-v1');delete s.units[0].targetPolicy;assert.throws(()=>ecoReplay(ecoCapture(s,{x:2048,y:1536,zoom:1})));const old=createEco(11,2);old.units[0].targetPolicy='presence-nearest-v1';assert.throws(()=>ecoReplay(ecoCapture(old,{x:2048,y:1536,zoom:1})));
});
test('candidate preview uses the same nearest comparison rule as a real new plant',()=>{
 const s=createEco(11,2,'quarter-v1','presence-nearest-v1'),card=s.hand[0],e=s.units[0],x=e.x-60,y=e.y-45;const preview=placementPreview(s,x,y,card.seed);assert.ok(placeEco(s,x,y,card.id).ok);const placed=s.units.at(-1)!;assert.equal(preview.target,targetFor(placed,s.units)?.id??null);assert.deepEqual(preview.incoming,s.units.filter(u=>u.team==='enemy'&&targetFor(u,s.units)?.id===placed.id).map(u=>u.id));
});
