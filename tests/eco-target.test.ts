import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createEco,currentStats,targetFor,damageFor,stepEco,enemyPresence,validateEcoPlacement,PRESENCE_STRENGTH,falloff,type Unit} from '../src/eco-sim.js';
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
