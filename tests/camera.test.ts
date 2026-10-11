import {test} from 'node:test';
import assert from 'node:assert/strict';
import {BoardCamera,introView} from '../src/camera.js';
import {createState} from '../src/sim.js';
import {capture,replay} from '../src/session.js';
test('camera clamps zoom and pan while full view remains exactly centred',()=>{
 const c=new BoardCamera({x:-100,y:100,zoom:100});assert.deepEqual(c.view,{x:2,y:7.5,zoom:3});c.pan(100000,-100000,30);assert.deepEqual(c.view,{x:2,y:7.5,zoom:3});c.set({x:0,y:0,zoom:0});assert.deepEqual(c.view,{x:6,y:4.5,zoom:1});
});
test('zoom anchor and fractional world points survive pan, offsets and resize',()=>{
 const c=new BoardCamera({x:6,y:4.5,zoom:1.8}),p={x:5.4321,y:3.4567};c.zoomAt(1.2,p);c.pan(-20,10,40);
 for(const r of [{left:12,top:250,width:364,height:272},{left:270,top:150,width:800,height:600}]){const l=c.layout(r.width,r.height),actual=c.point(r.left+l.ox+p.x*l.scale,r.top+l.oy+p.y*l.scale,r);assert.ok(Math.abs(actual.x-p.x)<1e-12);assert.ok(Math.abs(actual.y-p.y)<1e-12);}
});
test('intro is deterministic, consumes no state or gameplay randomness, and stays bounded',()=>{
 for(let seed=0;seed<64;seed++){const s=createState(seed),before=structuredClone(s),v=introView(s);assert.deepEqual(introView(s),v);assert.deepEqual(s,before);assert.deepEqual(new BoardCamera(v).view,v);assert.equal(v.zoom,1.8);}
});
test('camera snapshot restores exactly and rejects forged out-of-bounds views',()=>{
 const s=createState(),v={x:4,y:3,zoom:2};assert.deepEqual(replay(capture(s,1,[],v)).save.view,v);assert.throws(()=>replay(capture(s,1,[],{x:0,y:0,zoom:2})));assert.throws(()=>replay(capture(s,1,[],{x:6,y:4.5,zoom:Infinity})));
});
test('same-rules snapshot-3 restores game state with a default full camera',()=>{
 const s=createState(),v=capture(s,2,[]),old:Record<string,unknown>={...v,version:'2026-10-11-snapshot-3'};delete old.view;delete old.checksum;
 let hash=2166136261;for(const c of JSON.stringify(old))hash=Math.imul(hash^c.charCodeAt(0),16777619);old.checksum=(hash>>>0).toString(16);
 const result=replay(old);assert.deepEqual(result.state,s);assert.deepEqual(result.save.view,{x:6,y:4.5,zoom:1});
});

test('remote selection reveals its point without changing zoom; visible and invalid points leave the view intact',()=>{
 const stage={width:36,height:27,enemyCount:24},s=createState(11,stage),before=structuredClone(s),c=new BoardCamera({x:0,y:0,zoom:9},stage),p={x:32.1234,y:24.4567};assert.equal(c.focusIfOutside(p,600,450,.378),true);assert.equal(c.view.zoom,9);const b=c.bounds(600,450);assert.ok(p.x>=b.x&&p.x<=b.x+b.width&&p.y>=b.y&&p.y<=b.y+b.height);const view={...c.view};assert.equal(c.focusIfOutside(p,600,450,.378),false);assert.deepEqual(c.view,view);assert.equal(c.focusIfOutside({x:NaN,y:4},600,450),false);assert.deepEqual(c.view,view);assert.deepEqual(s,before);
});
