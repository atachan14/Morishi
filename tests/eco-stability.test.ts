import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateSeed} from '../src/eco-contract.js';
import {finishEco,createEco,placeEco,stepEco,mergeContacts,currentStats,validateEcoPlacement,ECO_LIMITS,type State} from '../src/eco-sim.js';
import {findPlantSpace,gardenGuidance,placementPreview} from '../src/eco-guidance.js';
import {ecoCapture,ecoReplay} from '../src/eco-save.js';
const view={x:2048,y:1536,zoom:1};
const normalized=(s:State)=>({...s,units:[...s.units].sort((a,b)=>a.id-b.id)});

test('all allies can fall without ending a run: recover, plant, save and resume',()=>{
 const s=createEco(20261011);for(let i=0;i<400&&s.units.some(u=>u.team==='ally');i++)stepEco(s);assert.equal(s.units.filter(u=>u.team==='ally').length,0);assert.equal(s.outcome,'playing');const g=gardenGuidance(s);assert.equal(g.kind,'recover');assert.equal(g.space?.kind,'found');if(g.space?.kind!=='found')return;const card=s.hand[0],fixed=structuredClone(card.seed);assert.ok(validateEcoPlacement(s,g.space.point.x,g.space.point.y,card.id).ok);assert.ok(placeEco(s,g.space.point.x,g.space.point.y,card.id).ok);assert.deepEqual(s.units.at(-1)!.seed,fixed);assert.equal(s.units.at(-1)!.team,'ally');const restored=ecoReplay(ecoCapture(s,view)).state;for(let i=0;i<150;i++){stepEco(s);stepEco(restored);}assert.deepEqual(restored,s);
});
test('resource waits state when both resources become available, without calling it defeat',()=>{
 const s=createEco(11);s.units=s.units.filter(u=>u.team==='enemy');s.hand=[];s.charges=0;s.drawProgress=.5;s.turnProgress=.75;let g=gardenGuidance(s);assert.equal(g.kind,'supply');assert.equal(g.waitSeconds,2);assert.equal(g.canAdvance,true);for(let i=0;i<20;i++)stepEco(s);g=gardenGuidance(s);assert.equal(g.kind,'recover');assert.ok(s.hand.length&&s.charges);assert.equal(s.outcome,'playing');
});
test('unknown search budget is never reported as proven placement failure',()=>{
 const s=createEco(11);assert.equal(findPlantSpace(s,8,{maxNodes:0}).kind,'unknown');assert.equal(findPlantSpace(s).kind,'found');const space=findPlantSpace(s,8,{preferred:s.units[0]});assert.equal(space.kind,'found');if(space.kind==='found')assert.ok(validateEcoPlacement(s,space.point.x,space.point.y,0).ok);
});
test('full-area presence and physical bodies are proved blocked without an infinite search or waiting',()=>{
 // Artificial stress fixtures, not a generated/saved game: normal enemy area does not cover this world.
 const s=createEco(11);s.units=[s.units[0]];const enemy=s.units[0];enemy.x=2048;enemy.y=1536;enemy.diameter=200;enemy.seed.fixed.presenceHalo=4000;enemy.hp=currentStats(enemy).maxHp;s.charges=5;while(s.hand.length<6){const id=s.nextCard++;s.hand.push({kind:'plant',id,seed:generateSeed(s.seed,'hand',id)});}const space=findPlantSpace(s);assert.equal(space.kind,'blocked');if(space.kind==='blocked')assert.equal(space.cause,'presence');assert.equal(gardenGuidance(s).canAdvance,false);
 const t=createEco(11);t.units=[t.units[24]];t.units[0].x=2048;t.units[0].y=1536;t.units[0].diameter=6000;const body=findPlantSpace(t);assert.equal(body.kind,'blocked');if(body.kind==='blocked')assert.equal(body.cause,'body');assert.ok(body.checked<20);
});
test('full unit capacity with capped touching plants cannot promise that waiting frees a slot',()=>{
 const s=createEco(11),source=s.units[24];s.units=Array.from({length:ECO_LIMITS.units},(_,i)=>({...structuredClone(source),id:i+1,x:2048,y:1536,diameter:ECO_LIMITS.diameter,lineage:[i+1]}));s.hand=s.hand.slice(0,1);s.charges=5;assert.equal(mergeContacts(s),0);assert.equal(gardenGuidance(s).kind,'blocked');assert.equal(gardenGuidance(s).canAdvance,false);
});
test('mature unreachable armies with full supplies stop waiting, while growing armies remain observable',()=>{
 const s=createEco(11);s.units=s.units.filter(u=>u.team==='enemy');for(const u of s.units){u.diameter=200;u.x=600+(u.id%6)*600;u.y=500+Math.floor((u.id-1)/6)*600;u.hp=currentStats(u).maxHp;}s.units.push({...structuredClone(createEco(11).units[24]),id:25,x:2048,y:1536,diameter:200});s.units=s.units.filter(u=>u.team==='ally'||Math.hypot(u.x-2048,u.y-1536)>1200);s.charges=5;while(s.hand.length<6){const id=s.nextCard++;s.hand.push({kind:'plant',id,seed:generateSeed(s.seed,'hand',id)});}const g=gardenGuidance(s);assert.equal(g.kind,'idle');assert.equal(g.canAdvance,false);assert.equal(g.space?.kind,'found');s.units.find(u=>u.team==='ally')!.diameter=20;assert.equal(gardenGuidance(s).canAdvance,true);
});
test('contact-chain ordering is invariant to array permutations and remains bounded at a merge cap',()=>{
 const base=createEco(77);base.units=base.units.slice(0,5);base.units.forEach((u,i)=>{u.x=1000+i*4;u.y=1000;u.diameter=20+i*2;u.hp=currentStats(u).maxHp;});const a=structuredClone(base),b=structuredClone(base);b.units.reverse();assert.equal(mergeContacts(a),4);assert.equal(mergeContacts(b),4);assert.deepEqual(normalized(a),normalized(b));assert.equal(mergeContacts(a),0);assert.equal(a.units[0].lineage.length,5);
});
test('natural chain merges survive snapshots, preserve area and frozen mappings without a reward replay',()=>{
 for(const seed of [11,77,20261011]){const a=createEco(seed);const target=a.units[0];assert.ok(placeEco(a,target.x-70,target.y-38,0).ok);assert.ok(placeEco(a,target.x-70,target.y+38,1).ok);for(let i=0;i<420;i++)stepEco(a);const restored=ecoReplay(ecoCapture(a,view)).state;for(let i=0;i<380;i++){stepEco(a);stepEco(restored);}assert.ok(a.merges>0);assert.deepEqual(restored,a);const fresh=createEco(seed);assert.ok(placeEco(fresh,target.x-70,target.y-38,0).ok);assert.ok(placeEco(fresh,target.x-70,target.y+38,1).ok);for(let i=0;i<800;i++)stepEco(fresh);assert.deepEqual(a,fresh);assert.deepEqual(ecoReplay(ecoCapture(a,view)).state,a);const all=a.units.flatMap(u=>u.enemyOrigins).concat(a.player.rewards.flatMap(r=>r.enemyOrigins));assert.equal(all.length,24);assert.equal(new Set(all).size,24);}
});
test('short multi-seed placement witnesses agree with exact input rules after giant natural merges',()=>{
 for(const seed of [0,1,11,77,20261011,4294967295]){const s=createEco(seed);for(let i=0;i<700;i++)stepEco(s);const space=findPlantSpace(s);assert.equal(space.kind,'found');if(space.kind==='found')assert.ok(validateEcoPlacement(s,space.point.x,space.point.y,s.hand[0].id).ok);assert.equal(s.outcome,'playing');}
});
test('placement preview is read-only and uses the card binding, actual targeting and range growth',()=>{
 const s=createEco(11),before=structuredClone(s),card=s.hand[2],p={x:s.units[0].x-70,y:s.units[0].y-38},preview=placementPreview(s,p.x,p.y,card.seed);assert.deepEqual(s,before);assert.ok(placeEco(s,p.x,p.y,card.id).ok);const u=s.units.at(-1)!;assert.equal(preview.futureRange,currentStats({...u,diameter:200}).range);assert.ok(preview.target);assert.ok(preview.damage>0);
});

test('voluntary finish keeps the board and resource fractions, rejects further actions, and restores exactly',()=>{
 const s=createEco(77);for(let i=0;i<22;i++)stepEco(s);const before=structuredClone(s);assert.equal(finishEco(s),true);assert.equal(s.outcome,'ended');assert.equal(s.tick,before.tick);assert.deepEqual(s.units,before.units);assert.deepEqual(s.hand,before.hand);assert.equal(s.drawProgress,before.drawProgress);const ended=structuredClone(s);assert.equal(finishEco(s),false);for(let i=0;i<100;i++)stepEco(s);assert.deepEqual(s,ended);assert.equal(placeEco(s,2048,1536,s.hand[0].id).ok,false);assert.deepEqual(ecoReplay(ecoCapture(s,view)).state,s);
});
