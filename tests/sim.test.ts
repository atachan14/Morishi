import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createState,place,step,Clock,chooseTarget,effectiveRange,validatePlacement,WIDTH,HEIGHT,SEED_RADIUS,EPSILON,footprint,insideTerritory,territoryCoverage,clientToWorld,viewport,placementForecast,attackDamage,stalled,enemyPositions,finishRun,runActivity,type Unit} from '../src/sim.js';
test('same seed and actions reproduce the entire state',()=>{
  function run(){const s=createState(77);place(s,1.23456789,2.3456789);place(s,1.34567,6.76543);for(let i=0;i<250;i++){step(s);if(i===100)place(s,2.1345,4.4321);}return s;}
  assert.deepEqual(run(),run());assert.notDeepEqual(createState(77).cards,createState(78).cards);
});
test('invalid placements do not mutate state or consume resources',()=>{
  const s=createState();const before=structuredClone(s);
  for(const [x,y] of [[-1,0],[12,0],[0,9],[0.1,0],[NaN,0],[5,5]])assert.equal(place(s,x,y).ok,false);
  assert.deepEqual(s,before);assert.equal(place(s,1,2).ok,true);const placed=structuredClone(s);assert.equal(place(s,1,2).ok,false);assert.deepEqual(s,placed);
});
test('paused time is discarded, speed preserves fixed-tick results across frame partitions',()=>{
  const a=createState(9),b=createState(9);place(a,1,2);place(b,1,2);const ca=new Clock(),cb=new Clock();
  ca.advance(a,10000);assert.equal(a.tick,0);ca.paused=false;ca.advance(a,50);ca.paused=true;ca.advance(a,9999);ca.paused=false;ca.advance(a,50);assert.equal(a.tick,1);
  cb.paused=false;cb.advance(b,100);assert.deepEqual(a,b);
  ca.speed=4;ca.advance(a,2500);cb.speed=2;for(let i=0;i<50;i++)cb.advance(b,100);assert.deepEqual(a,b);
});
test('resources and HP stay bounded during long progression',()=>{
  const s=createState(3);place(s,1,2);place(s,1,4);place(s,1,6);
  for(let i=0;i<3000;i++){step(s);assert.ok(s.charges>=0&&s.charges<=5);for(const u of s.units){assert.ok(Number.isFinite(u.hp)&&u.hp>0&&u.hp<=u.maxHp);assert.ok(u.cooldown>=0);}}
});
test('supply cannot be spent below zero; unstarted state does not advance',()=>{
  const s=createState();step(s);assert.equal(s.tick,0);place(s,.65,1);place(s,.65,3);place(s,.65,5);assert.equal(s.charges,0);const before=structuredClone(s);assert.equal(place(s,.65,7).ok,false);assert.deepEqual(s,before);for(let i=0;i<80;i++)step(s);assert.ok(s.charges>=1);
});
test('presence and distance determine stable targeting; outside range excluded',()=>{
  const s=createState();place(s,1,2);const a=s.units.at(-1)!;a.stats.range=10;a.age=180;
  const enemy=(id:number,x:number,presence:number):Unit=>({...a,id,team:'enemy',x,y:2,stats:{...a.stats,presence}});
  const near=enemy(30,2,1),distant=enemy(20,4,10);assert.equal(chooseTarget(a,[near,distant])!.id,20);
  const tie=enemy(10,2,1);assert.equal(chooseTarget(a,[near,tie])!.id,10);
  a.stats.range=1;assert.equal(chooseTarget(a,[enemy(9,1+effectiveRange(a),5)]),undefined);
});
test('victory and defeat freeze progression and reject placement',()=>{
  for(const mode of ['win','loss'] as const){const s=createState();place(s,1,2);if(mode==='win')s.units=s.units.filter(u=>u.team==='ally');else{s.units=s.units.filter(u=>u.team==='enemy');s.cards=[];s.charges=0;}step(s);assert.equal(s.outcome,mode);const before=structuredClone(s);step(s);assert.equal(place(s,0,0).ok,false);assert.deepEqual(s,before);}
});
test('invalid clock input rejected',()=>{const s=createState(),c=new Clock();assert.throws(()=>c.advance(s,-1));assert.throws(()=>c.advance(s,NaN));c.paused=false;c.speed=-1;assert.throws(()=>c.advance(s,100));});
test('default board can be conquered through legal placements and territory expansion',()=>{
  const s=createState();const initial=territoryCoverage(s);let placements=0;
  for(let i=0;i<5000&&s.outcome==='playing';i++){
    if(s.charges>0&&s.cards.length){
      const candidates:{x:number;y:number;distance:number}[]=[];
      for(let yi=0;yi<16;yi++)for(let xi=0;xi<22;xi++){const x=.35+xi*.52,y=.35+yi*.52;if(x>WIDTH-.3||y>HEIGHT-.3)continue;if(validatePlacement(s,x,y).ok)candidates.push({x,y,distance:Math.min(...s.units.filter(u=>u.team==='enemy').map(u=>Math.hypot(x-u.x,y-u.y)))});}
      candidates.sort((a,b)=>a.distance-b.distance||b.x-a.x||a.y-b.y);
      if(candidates.length){const p=candidates[0];assert.equal(place(s,p.x,p.y).ok,true);placements++;}
    }
    step(s);
  }
  assert.equal(s.outcome,'win');assert.equal(s.units.filter(u=>u.team==='enemy').length,0);assert.ok(placements>3);assert.ok(territoryCoverage(s)>initial);
});
test('arbitrary fractional coordinates are preserved without snapping',()=>{
  const s=createState();const x=1.1234567890123,y=3.9876543210987;assert.equal(place(s,x,y).ok,true);const u=s.units.at(-1)!;assert.equal(u.x,x);assert.equal(u.y,y);
});
test('finite world bounds include tangent footprint and reject out-of-bounds without mutation',()=>{
  for(const [x,y] of [[SEED_RADIUS,SEED_RADIUS],[1,HEIGHT-SEED_RADIUS]])assert.equal(validatePlacement(createState(),x,y).ok,true);
  const s=createState(),before=structuredClone(s);
  for(const [x,y] of [[SEED_RADIUS-1e-6,1],[1,SEED_RADIUS-1e-6],[WIDTH-SEED_RADIUS+1e-6,1],[1,HEIGHT-SEED_RADIUS+1e-6],[Infinity,1],[1,-Infinity],[NaN,1]])assert.equal(place(s,x,y).ok,false);
  assert.deepEqual(s,before);
});
test('circle overlap handles tangent, tiny errors, and grown footprints',()=>{
  const s=createState();place(s,1,3);const u=s.units.at(-1)!;const tangent=1+footprint(u)+SEED_RADIUS;
  assert.equal(validatePlacement(s,tangent,3).ok,true);
  assert.equal(validatePlacement(s,tangent-EPSILON/2,3).ok,true);
  assert.equal(validatePlacement(s,tangent-1e-6,3).ok,false);
  u.age=180;assert.equal(validatePlacement(s,tangent,3).ok,false);
  assert.equal(validatePlacement(s,1+footprint(u)+SEED_RADIUS,3).ok,true);
});
test('territory is analytic in world coordinates, independently of coverage samples',()=>{
  const s=createState();s.units.forEach((u,i)=>{u.x=8;u.y=i+.6;});s.units[0].x=4;s.units[0].y=2;s.territory.push({id:99,x:3.3333,y:4.0001,radius:.7777});
  assert.equal(insideTerritory(s,3.3333,4.0001+.7777),true);
  assert.equal(insideTerritory(s,3.3333,4.0001+.7777+1e-6),false);
  assert.equal(insideTerritory(s,2+1e-6,8.7),false);
  assert.equal(insideTerritory(s,4,2),false);
  assert.equal(validatePlacement(s,3.3333,4.0001).ok,true);
});
test('mouse/touch client coordinates map to the same world point after resize, offsets, and Pane re-show',()=>{
  const s=createState(),before=structuredClone(s),point={x:1.23456789,y:3.45678912};
  for(const rect of [{left:260,top:150,width:600,height:450},{left:12,top:174,width:351,height:263.25},{left:12,top:225,width:680,height:300},{left:28,top:80,width:900,height:900}]){
    const v=viewport(rect.width,rect.height);const mapped=clientToWorld(rect.left+v.ox+point.x*v.scale,rect.top+v.oy+point.y*v.scale,rect);
    assert.ok(Math.abs(mapped.x-point.x)<1e-12);assert.ok(Math.abs(mapped.y-point.y)<1e-12);assert.equal(validatePlacement(s,mapped.x,mapped.y).ok,true);
  }
  assert.deepEqual(s,before);assert.throws(()=>clientToWorld(1,2,{left:0,top:0,width:0,height:0}));
});
test('forecast is non-mutating and exactly agrees with immediate target and incoming damage',()=>{
  const s=createState(1);const before=structuredClone(s);const forecast=placementForecast(s,2,2)!;assert.ok(forecast);assert.deepEqual(s,before);
  place(s,2,2);const u=s.units.at(-1)!;const target=chooseTarget(u,s.units);assert.equal(forecast.targetId,target?.id??null);assert.equal(forecast.damage,target?attackDamage(u,target):0);
  const incoming=s.units.filter(v=>v.team==='enemy'&&chooseTarget(v,s.units)?.id===u.id);
  assert.deepEqual(forecast.incomingIds,incoming.map(v=>v.id));assert.equal(forecast.incomingDamage,incoming.reduce((sum,v)=>sum+attackDamage(v,u),0));
  assert.equal(placementForecast(createState(),-1,2),undefined);
});
test('forecast distinguishes immediate attack, future growth, and pure expansion',()=>{
  const s=createState(1);s.units.forEach((u,i)=>{u.x=8;u.y=i+.6;});s.units[0].x=4;s.units[0].y=2;s.cards[0].range=3;
  const future=placementForecast(s,2,2)!;assert.equal(future.targetId,null);assert.equal(future.grownTargetId,1);
  const rear=placementForecast(s,.35,4.5)!;assert.equal(rear.targetId,null);assert.equal(rear.grownTargetId,null);
  s.cards[0].range=4;assert.equal(placementForecast(s,2,2)!.targetId,1);
  assert.ok(rear.newArea>=0&&rear.newArea<=1);
});
test('seed generates continuous, nonoverlapping, visible enemy positions inside the world',()=>{
  assert.deepEqual(enemyPositions(17),enemyPositions(17));assert.notDeepEqual(enemyPositions(17),enemyPositions(18));
  for(let seed=0;seed<100;seed++){
    const s=createState(seed);assert.equal(s.units.length,7);
    for(const u of s.units){assert.ok(Number.isFinite(u.x)&&Number.isFinite(u.y));assert.ok(u.x>=.378&&u.x<=WIDTH-.378&&u.y>=.378&&u.y<=HEIGHT-.378);assert.ok(u.x-1.15>2);for(const v of s.units)if(u.id!==v.id)assert.ok(Math.hypot(u.x-v.x,u.y-v.y)>=.756);}
  }
});
test('distance falloff affects real damage and respects exact range boundary',()=>{
  const s=createState();place(s,1,2);const u=s.units.at(-1)!;u.stats.range=4;const foe=s.units[0];foe.y=2;
  foe.x=2;assert.ok(attackDamage(u,foe)>0);const near=attackDamage(u,foe);foe.x=3;assert.ok(attackDamage(u,foe)<near);foe.x=1+effectiveRange(u);assert.equal(attackDamage(u,foe),0);
});
test('exhausted mature unreachable board ends; future growth or remaining cards prevent premature loss',()=>{
  const s=createState();place(s,.35,4.5);for(const u of s.units){u.age=224;u.stats.range=.5;}s.cards=[];assert.equal(stalled(s),true);step(s);assert.equal(s.outcome,'loss');
  const growing=createState();place(growing,.35,4.5);growing.cards=[];assert.equal(stalled(growing),false);step(growing);assert.equal(growing.outcome,'playing');
  const supplied=createState();place(supplied,.35,4.5);for(const u of supplied.units)u.age=224;assert.equal(stalled(supplied),false);step(supplied);assert.equal(supplied.outcome,'playing');
});
test('kills do not produce unlimited charges or extra plants',()=>{
  const s=createState();place(s,2,2);for(const u of s.units.filter(u=>u.team==='enemy'))u.hp=0;const cards=s.cards.length;step(s);assert.equal(s.charges,5);assert.equal(s.cards.length,cards);assert.equal(s.outcome,'win');
});
test('attack feedback records the actual target and position, never the next chosen target',()=>{
  const s=createState();place(s,2,2);const ally=s.units.at(-1)!;ally.stats.range=10;ally.stats.power=1000;const target=chooseTarget(ally,s.units)!;const id=target.id,x=target.x,y=target.y;step(s);
  assert.equal(ally.lastShot!.targetId,id);assert.equal(ally.lastShot!.x,x);assert.equal(ally.lastShot!.y,y);assert.equal(ally.lastShot!.tick,s.tick);assert.ok(ally.lastShot!.damage>0);assert.ok(!s.units.some(u=>u.id===id));
  const next=chooseTarget(ally,s.units);assert.notEqual(next?.id,id);assert.equal(ally.lastShot!.targetId,id);
});
test('voluntary run finish preserves progress and freezes all gameplay',()=>{
  const s=createState(19),initial=structuredClone(s);assert.equal(finishRun(s),false);assert.deepEqual(s,initial);
  place(s,1.25,3.78);for(let i=0;i<50;i++)step(s);const tick=s.tick,territory=structuredClone(s.territory);assert.equal(finishRun(s),true);assert.equal(s.tick,tick);assert.deepEqual(s.territory,territory);assert.equal(s.outcome,'loss');const ended=structuredClone(s);assert.equal(finishRun(s),false);step(s);assert.deepEqual(s,ended);
});
test('run guidance distinguishes future growth from waiting without a useful next change',()=>{
  const s=createState();assert.equal(runActivity(s),'ready');place(s,1,4.5);for(const u of s.units)u.stats.range=.5;
  assert.equal(runActivity(s),'growing');s.units.at(-1)!.age=224;assert.equal(runActivity(s),'needs-placement');const before=structuredClone(s);runActivity(s);assert.deepEqual(s,before);
  finishRun(s);assert.equal(runActivity(s),'ended');
});
test('weak-combat guidance does not end a slow but real attack',()=>{
  const s=createState();place(s,1,2);const ally=s.units.at(-1)!,enemy=s.units[0];s.units=[ally,enemy];ally.age=224;enemy.age=224;enemy.stats.range=.5;enemy.y=2;enemy.x=1+effectiveRange(ally)-1e-6;
  assert.equal(runActivity(s),'weak-combat');const hp=enemy.hp;step(s);assert.ok(enemy.hp<hp);assert.equal(s.outcome,'playing');
  enemy.x=2;assert.equal(runActivity(s),'fighting');
});
