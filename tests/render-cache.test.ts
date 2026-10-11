import test from 'node:test';
import assert from 'node:assert/strict';
import {createState} from '../src/sim.js';
import {presenceVisualKey,boardVisualKey} from '../src/render-cache.js';

test('presence cache follows growth and enemy removal, retaining mature fields across harmless ticks',()=>{
 const s=createState(11,{width:36,height:27,enemyCount:24},'endless'),original=structuredClone(s),initial=presenceVisualKey(s);s.units[0].age=1;assert.notEqual(presenceVisualKey(s),initial);for(const u of s.units)u.age=117;const mature=presenceVisualKey(s);for(const u of s.units)u.age+=500;assert.equal(presenceVisualKey(s),mature);s.units[0].hp--;assert.equal(presenceVisualKey(s),mature);s.units[0].hp=0;assert.notEqual(presenceVisualKey(s),mature);s.units[0].hp=original.units[0].hp;s.units[0].x+=.1;assert.notEqual(presenceVisualKey(s),mature);
});
test('board cache keeps every visual input and expires shots while ignoring only invisible mature age changes',()=>{
 const s=createState(11,undefined,'endless'),view={x:6,y:4.5,zoom:1},key=()=>boardVisualKey(s,view,600,450,null,null);for(const u of s.units)u.age=117;const frozen=structuredClone(s),base=key();s.tick++;for(const u of s.units)u.age++;assert.equal(key(),base);s.units[0].hp--;assert.notEqual(key(),base);s.units[0].hp++;view.zoom=2;assert.notEqual(key(),base);view.zoom=1;assert.notEqual(boardVisualKey(s,view,601,450,null,null),base);assert.notEqual(boardVisualKey(s,view,600,450,1,null),base);assert.notEqual(boardVisualKey(s,view,600,450,null,{x:1,y:1}),base);s.units[0].lastShot={tick:s.tick,targetId:2,x:2,y:2,damage:10};const shot=key();s.tick+=3;assert.notEqual(key(),shot);assert.equal(key(),base);assert.equal(frozen.units[0].hp,s.units[0].hp);
});
