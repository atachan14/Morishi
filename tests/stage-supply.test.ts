import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_STAGE,stageConfig,INITIAL_CARDS} from '../src/stage.js';
import {createState,enemyPositions,place,step,footprint,validatePlacement,supplyStats,stageProgress,Clock} from '../src/sim.js';
import {BoardCamera,introView} from '../src/camera.js';
import {capture,replay,RunStore,SAVE_KEY,SAVE_LIMITS,type Action} from '../src/session.js';
const large={width:36,height:27,enemyCount:24};
function signed(value:Record<string,unknown>){delete value.checksum;let hash=2166136261;for(const c of JSON.stringify(value))hash=Math.imul(hash^c.charCodeAt(0),16777619);return {...value,checksum:(hash>>>0).toString(16)};}

test('reference settings preserve all seven original positions and finite supply',()=>{
 const s=createState();assert.deepEqual(s.stage,DEFAULT_STAGE);assert.deepEqual(s.units.map(u=>[u.x,u.y]),[[4,2],[4,6],[6,4],[8,1],[8,7],[10,3],[10,6]]);assert.equal(s.cards.length,INITIAL_CARDS);assert.deepEqual(createState(11),createState(11,{...DEFAULT_STAGE}));
});
test('three variable configurations and three seeds generate bounded mature nonoverlap with a legal refuge',()=>{
 for(const config of [large,{width:60,height:18,enemyCount:40},{width:18,height:45,enemyCount:32}])for(const seed of [20261011,1,11]){
  const s=createState(seed,config);assert.deepEqual(createState(seed,config),s);assert.equal(s.units.length,config.enemyCount);assert.equal(s.cards.length,18);for(const u of s.units)u.age=117;
  for(const [i,u]of s.units.entries()){assert.ok(u.x>=footprint(u)&&u.x<=config.width-footprint(u)&&u.y>=footprint(u)&&u.y<=config.height-footprint(u));for(const v of s.units.slice(i+1))assert.ok(Math.hypot(u.x-v.x,u.y-v.y)>=footprint(u)+footprint(v));}
  assert.ok([[.3,.3],[config.width-.3,.3],[.3,config.height-.3],[config.width-.3,config.height-.3]].some(([x,y])=>validatePlacement(s,x,y).ok));
 }
});
test('invalid, excessive or unrepresentably dense stage settings are rejected before generation',()=>{
 for(const stage of [{...large,width:Infinity},{...large,height:2},{...large,enemyCount:0},{...large,enemyCount:257},{width:6,height:6,enemyCount:100}])assert.throws(()=>createState(1,stage));assert.throws(()=>stageConfig(null as never));
});
test('far-side fractional placement, scale-aware camera and run progress survive interruption',()=>{
 const s=createState(11,large),x=35.6123,y=26.4567;assert.equal(place(s,x,y).ok,true);const actions:Action[]=[{tick:0,kind:'place',x,y}];for(let i=0;i<10;i++)step(s);
 const c=new BoardCamera({x:30,y:22,zoom:5},large);assert.ok(c.maxZoom>3);
 for(const r of [{left:12,top:220,width:364,height:272},{left:250,top:70,width:600,height:450}]){const l=c.layout(r.width,r.height),actual=c.point(r.left+l.ox+x*l.scale,r.top+l.oy+y*l.scale,r);assert.ok(Math.abs(actual.x-x)<1e-11&&Math.abs(actual.y-y)<1e-11);const b=c.bounds(r.width,r.height);assert.ok(b.x>=0&&b.y>=0&&b.x+b.width<=large.width+1e-10&&b.y+b.height<=large.height+1e-10);}
 const saved=capture(s,4,actions,c.view),restored=replay(JSON.parse(JSON.stringify(saved)));assert.deepEqual(restored.state,s);assert.deepEqual(restored.save.view,c.view);const clock=new Clock();clock.advance(restored.state,999999);assert.deepEqual(restored.state,s);clock.paused=false;clock.speed=4;clock.advance(restored.state,250);for(let i=0;i<10;i++)step(s);assert.deepEqual(restored.state,s);assert.deepEqual(stageProgress(s),{total:24,remaining:24,defeated:0});s.units.shift();assert.equal(stageProgress(s).defeated,1);
});
test('large intro uses bounded candidates and never changes generation or state',()=>{const s=createState(1,large),before=structuredClone(s),v=introView(s);assert.ok(v.zoom>3);assert.deepEqual(new BoardCamera(v,large).view,v);assert.deepEqual(introView(s),v);assert.deepEqual(s,before);});
test('real camera and cameraless legacy shapes restore finite inventory without changing the raw input',()=>{
 for(const version of ['2026-10-11-snapshot-4','2026-10-11-snapshot-3']){const s=createState(11);place(s,.4,1);step(s);const save=structuredClone(capture(s,2,[{tick:0,kind:'place',x:.4,y:1}]));const legacy=save as unknown as Record<string,unknown>;legacy.version=version;const snapshot=legacy.snapshot as Record<string,unknown>;delete snapshot.stage;delete snapshot.supplyMode;delete snapshot.supplyIndex;if(version.endsWith('-3'))delete legacy.view;const old=signed(legacy),raw=JSON.stringify(old);const restored=replay(old);assert.deepEqual(restored.state,s);assert.equal(restored.state.supplyMode,'finite');assert.equal(JSON.stringify(old),raw);}
});
test('new endless queue matches the old first 18 plants and continues deterministically past them',()=>{
 const finite=createState(11),s=createState(11,DEFAULT_STAGE,'endless');assert.deepEqual(s.cards,finite.cards.slice(0,4));for(let i=0;i<18;i++)assert.deepEqual(supplyStats(11,DEFAULT_STAGE,i),finite.cards[i]);assert.deepEqual(supplyStats(11,large,1000000000),supplyStats(11,large,1000000000));assert.notDeepEqual(supplyStats(11,large,1000000000),supplyStats(11,large,1000000001));
});
test('more than 18 placements preserve four-item supply and bounded history with exact live-unit origins',()=>{
 const stage={width:96,height:72,enemyCount:8},s=createState(1,stage,'endless'),actions:Action[]=[];
 for(let i=0;i<70;i++){s.charges=1;const p=Array.from({length:140},(_,j)=>({x:.4+(j%20)*.8,y:.4+Math.floor(j/20)*.8})).find(p=>validatePlacement(s,p.x,p.y).ok)!;assert.ok(p);const expected=supplyStats(1,stage,i);assert.equal(place(s,p.x,p.y).ok,true);actions.push({tick:s.tick,kind:'place',...p});assert.deepEqual(s.units.at(-1)!.stats,expected);assert.equal(s.cards.length,4);assert.equal(s.territory.length,0);}
 const saved=capture(s,1,actions),restored=replay(saved);assert.equal(saved.actions.length,64);assert.equal(saved.snapshot.supplyIndex,70);assert.deepEqual(restored.state,s);assert.deepEqual(restored.state.cards[0],supplyStats(1,stage,70));assert.ok(JSON.stringify(saved).length<SAVE_LIMITS.maxBytes);
 const p={x:20.1234,y:.4};s.charges=restored.state.charges=1;assert.equal(place(s,p.x,p.y).ok,true);assert.equal(place(restored.state,p.x,p.y).ok,true);assert.deepEqual(restored.state,s);assert.deepEqual(s.units.at(-1)!.stats,supplyStats(1,stage,70));for(let i=0;i<5;i++){step(s);step(restored.state);}assert.deepEqual(restored.state,s);assert.equal(s.supplyIndex,71);assert.deepEqual(s.cards[0],supplyStats(1,stage,71));
});
test('late indexed snapshots do not replay supply history and no living allies is not an endless loss',()=>{
 const s=createState(11,large,'endless');s.supplyIndex=1000000000;s.nextId=large.enemyCount+1+s.supplyIndex;s.started=true;s.tick=1000000000;for(const u of s.units)u.age=s.tick;s.cards=Array.from({length:4},(_,i)=>supplyStats(s.seed,s.stage,s.supplyIndex+i));const saved=capture(s,4,[]);assert.deepEqual(replay(saved).state,s);const before=s.tick;step(s);assert.equal(s.tick,before+1);assert.equal(s.outcome,'playing');assert.equal(s.cards.length,4);s.charges=0;s.tick=239;for(const u of s.units)u.age=239;step(s);assert.equal(s.charges,1);
});
test('forged stage, queue, indexed origins and oversized live arrays are rejected without erasing storage',()=>{
 const s=createState(1,large,'endless');place(s,.4,.4);
 for(const mutate of [(v:typeof s)=>v.stage.enemyCount++,(v:typeof s)=>v.supplyIndex++,(v:typeof s)=>v.cards[0].power++,(v:typeof s)=>v.units.at(-1)!.supplyIndex=40,(v:typeof s)=>v.units.at(-1)!.born=4,(v:typeof s)=>v.units.push(...Array.from({length:2048},()=>({...v.units[0]})))]){const bad=structuredClone(s);mutate(bad);const raw=JSON.stringify(capture(bad,1,[]));let value=raw;const store=new RunStore({getItem:()=>value,setItem:(_k,v)=>{value=v;}});assert.equal(store.read().kind,'invalid');assert.equal(store.write(capture(s,1,[])),false);assert.equal(value,raw);}
});

test('save safety budgets reject a too-large live snapshot before overwriting its last good save',()=>{
 const good=createState(1,large,'endless');let raw=JSON.stringify(capture(good,1,[]));const original=raw,store=new RunStore({getItem:()=>raw,setItem:(_k,v)=>{raw=v;}});const excessive=structuredClone(good);excessive.units.push(...Array.from({length:SAVE_LIMITS.maxUnits},()=>({...good.units[0]})));assert.equal(store.write(capture(excessive,1,[])),false);assert.equal(raw,original);assert.equal(store.read().kind,'loaded');
});

test('camera culling never affects offscreen combat or the supply clock',()=>{
 const stage={width:96,height:72,enemyCount:40},s=createState(11,stage,'endless'),target=s.units.at(-1)!,points=[] as {x:number;y:number}[];
 for(let dy=-3;dy<=3;dy+=.4)for(let dx=-3;dx<=3;dx+=.4){const p={x:target.x+dx,y:target.y+dy};if(validatePlacement(s,p.x,p.y).ok)points.push(p);}
 points.sort((a,b)=>Math.hypot(a.x-target.x,a.y-target.y)-Math.hypot(b.x-target.x,b.y-target.y));assert.ok(points.length);const p=points[0];place(s,p.x,p.y);const expected=structuredClone(s),c=new BoardCamera({x:0,y:0,zoom:12},stage),bounds=c.bounds(600,450);assert.ok(target.x>bounds.x+bounds.width||target.y>bounds.y+bounds.height);const originalHP=target.hp;const clock=new Clock();clock.paused=false;
 for(let i=0;i<10;i++){c.pan(1,-1,10);clock.advance(s,100);step(expected);}assert.deepEqual(s,expected);assert.ok(!s.units.find(u=>u.id===target.id)||s.units.find(u=>u.id===target.id)!.hp<originalHP);assert.equal(s.tick,10);
});
