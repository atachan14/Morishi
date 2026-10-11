import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createState,place,step,finishRun,Clock,validatePlacement,WIDTH,HEIGHT} from '../src/sim.js';
import {capture,replay,RunStore,SAVE_KEY,BACKUP_KEY,type Action} from '../src/session.js';
class Memory {data=new Map<string,string>();getItem(k:string){return this.data.get(k)??null;}setItem(k:string,v:string){this.data.set(k,v);}}
test('saved action timeline reproduces all HP, territory, cards, targets and events',()=>{
  const s=createState(20261011),actions:Action[]=[];
  for(const [tick,x,y] of [[0,.4,1],[20,.4,4],[80,.4,7]]){while(s.tick<tick)step(s);assert.equal(place(s,x,y).ok,true);actions.push({tick,kind:'place',x,y});}
  for(let i=0;i<500;i++)step(s);
  const restored=replay(JSON.parse(JSON.stringify(capture(s,4,actions))));assert.deepEqual(restored.state,s);assert.equal(restored.save.speed,4);
  finishRun(s);actions.push({tick:s.tick,kind:'finish'});assert.deepEqual(replay(capture(s,2,actions)).state,s);
});
test('frame partitions and speeds produce the same saved timeline',()=>{
  const a=createState(3),b=createState(3);place(a,1.234,2.345);place(b,1.234,2.345);
  const ca=new Clock(),cb=new Clock();ca.paused=cb.paused=false;ca.speed=4;
  ca.advance(a,1000);for(let i=0;i<80;i++)cb.advance(b,50);
  const actions:Action[]=[{tick:0,kind:'place',x:1.234,y:2.345}];assert.deepEqual(a,b);assert.deepEqual(replay(capture(a,4,actions)).state,b);
});
test('reload restores a run without offline time or a running clock',()=>{
  const mem=new Memory(),store=new RunStore(mem),s=createState(7);place(s,1,2);step(s);store.write(capture(s,2,[{tick:0,kind:'place',x:1,y:2}]));
  const loaded=store.read();assert.equal(loaded.kind,'loaded');if(loaded.kind==='loaded'){const clock=new Clock();clock.speed=loaded.save.speed;clock.advance(loaded.state,600000);assert.deepEqual(loaded.state,s);assert.equal(clock.paused,true);}
});
test('corrupt and incompatible saves remain untouched until explicit replacement with backup',()=>{
  for(const raw of ['{bad',JSON.stringify({version:'future'}),'x'.repeat(64001)]){
    const mem=new Memory();mem.data.set(SAVE_KEY,raw);const store=new RunStore(mem);assert.equal(store.read().kind,'invalid');
    const save=capture(createState(),1,[]);assert.equal(store.write(save),false);assert.equal(mem.getItem(SAVE_KEY),raw);
    assert.equal(store.write(save,true),true);assert.equal(mem.getItem(BACKUP_KEY),raw);assert.equal(store.read().kind,'loaded');
  }
});
test('storage denial or quota failure cannot erase the previous run',()=>{
  const denied=new RunStore({getItem(){throw new Error('Denied');},setItem(){throw new Error('Denied');}});assert.equal(denied.read().kind,'unavailable');assert.equal(denied.write(capture(createState(),1,[]),true),false);
  const mem=new Memory();mem.data.set(SAVE_KEY,'old');mem.setItem=()=>{throw new Error('Quota');};const store=new RunStore(mem);assert.equal(store.write(capture(createState(),1,[]),true),false);assert.equal(mem.getItem(SAVE_KEY),'old');
});
test('malformed, impossible, nonfinite, out-of-order and excessive timelines are rejected',()=>{
  const base=capture(createState(),1,[]);
  for(const bad of [{...base,tick:1},{...base,tick:36001},{...base,speed:3},{...base,seed:-1},{...base,actions:Array(20).fill({tick:0,kind:'finish'})},{...base,actions:[{tick:0,kind:'place',x:NaN,y:2}]},{...base,actions:[{tick:0,kind:'finish'}]},{...base,tick:20,actions:[{tick:0,kind:'place',x:1,y:2},{tick:10,kind:'place',x:1,y:6},{tick:5,kind:'place',x:1,y:4}]}])assert.throws(()=>replay(bad));
});
test('completed legal run restores exact result and rejects a changed tick',()=>{
  const s=createState(),actions:Action[]=[];
  for(let i=0;i<5000&&s.outcome==='playing';i++){
    const candidates:{x:number;y:number;distance:number}[]=[];
    if(s.charges>0&&s.cards.length)for(let yi=0;yi<16;yi++)for(let xi=0;xi<22;xi++){
      const x=.35+xi*.52,y=.35+yi*.52;if(x>WIDTH-.3||y>HEIGHT-.3||!validatePlacement(s,x,y).ok)continue;
      candidates.push({x,y,distance:Math.min(...s.units.filter(u=>u.team==='enemy').map(u=>Math.hypot(x-u.x,y-u.y)))});
    }
    candidates.sort((a,b)=>a.distance-b.distance||b.x-a.x||a.y-b.y);
    if(candidates.length){const p=candidates[0];actions.push({tick:s.tick,kind:'place',x:p.x,y:p.y});place(s,p.x,p.y);}
    step(s);
  }
  assert.notEqual(s.outcome,'playing');const save=capture(s,4,actions);assert.deepEqual(replay(save).state,s);assert.throws(()=>replay({...save,tick:s.tick+1}));
});
test('bounded 60-game-minute log restores the exact long-running state',()=>{
  const s=createState(11);place(s,1,2);for(let i=0;i<36000;i++)step(s);
  assert.equal(s.tick,36000);assert.deepEqual(replay(capture(s,1,[{tick:0,kind:'place',x:1,y:2}])).state,s);
});
test('saving beyond the old boundary restores the latest state, then resumes exactly at 4x',()=>{
  const mem=new Memory(),store=new RunStore(mem),s=createState(11),a:Action[]=[{tick:0,kind:'place',x:1,y:2}];place(s,1,2);
  for(let i=0;i<36000;i++)step(s);assert.equal(store.write(capture(s,4,a)),true);
  for(let i=0;i<100;i++)step(s);assert.equal(store.write(capture(s,4,a)),true);
  const loaded=store.read();assert.equal(loaded.kind,'loaded');if(loaded.kind==='loaded'){
    assert.deepEqual(loaded.state,s);const clock=new Clock();clock.speed=4;clock.advance(loaded.state,600000);assert.deepEqual(loaded.state,s);
    clock.paused=false;clock.advance(loaded.state,250);for(let i=0;i<10;i++)step(s);assert.deepEqual(loaded.state,s);
  }
});
test('very late tick snapshots have bounded size and do not replay elapsed history',()=>{
  const s=createState(11),a:Action[]=[{tick:0,kind:'place',x:1,y:2}];place(s,1,2);s.tick=1000000000;for(const u of s.units)u.age=s.tick;
  const save=capture(s,2,a);assert.ok(JSON.stringify(save).length<10000);assert.deepEqual(replay(save).state,s);
});
test('both old rules versions are protected rather than silently reinterpreted',()=>{
  for(const version of ['2026-10-11-runtime-1','2026-10-11-snapshot-2']){
    const mem=new Memory(),raw=JSON.stringify({version,seed:11,tick:100,speed:4,actions:[]});mem.data.set(SAVE_KEY,raw);const store=new RunStore(mem);assert.equal(store.read().kind,'invalid');const fresh=capture(createState(11),1,[]);assert.equal(store.write(fresh),false);assert.equal(mem.getItem(SAVE_KEY),raw);assert.equal(store.write(fresh,true),true);assert.equal(mem.getItem(BACKUP_KEY),raw);
  }
});
test('snapshot checksum corruption and inconsistent signed fields are rejected without mutation',()=>{
  const s=createState(11),a:Action[]=[{tick:0,kind:'place',x:1,y:2}];place(s,1,2);step(s);
  const save=capture(s,1,a);save.snapshot.units[0].hp-=1;assert.throws(()=>replay(save));
  for(const mutate of [(v:typeof s)=>v.units[0].hp=-1,(v:typeof s)=>v.units[0].age=-1,(v:typeof s)=>v.units.push({...v.units[0]}),(v:typeof s)=>v.nextId=25,(v:typeof s)=>v.territory[0].radius=Infinity,(v:typeof s)=>v.units[0].stats.range=500,(v:typeof s)=>v.outcome='win']){
    const bad=structuredClone(s);mutate(bad);assert.throws(()=>replay(capture(bad,1,a)));
  }
});
test('failed explicit old rules backup preserves original and can retry safely',()=>{
  const mem=new Memory(),raw=JSON.stringify({version:'2026-10-11-runtime-1',seed:11,tick:0,speed:1,actions:[]});mem.data.set(SAVE_KEY,raw);
  const store=new RunStore(mem),loaded=store.read();assert.equal(loaded.kind,'invalid');const fresh=capture(createState(11),1,[]);
  const put=mem.setItem.bind(mem);mem.setItem=(key,value)=>{if(key===BACKUP_KEY)throw new Error('Quota');put(key,value);};
  assert.equal(store.write(fresh,true),false);assert.equal(mem.getItem(SAVE_KEY),raw);
  mem.setItem=put;assert.equal(store.write(fresh,true),true);assert.equal(mem.getItem(BACKUP_KEY),raw);
});
test('failed late snapshot write preserves the last exact save and succeeds after retry',()=>{
  const s=createState(11),a:Action[]=[{tick:0,kind:'place',x:1,y:2}];place(s,1,2);s.tick=40000;for(const u of s.units)u.age=s.tick;
  const mem=new Memory(),store=new RunStore(mem);assert.equal(store.write(capture(s,2,a)),true);const previous=mem.getItem(SAVE_KEY);
  step(s);const put=mem.setItem.bind(mem);mem.setItem=()=>{throw new Error('Quota');};assert.equal(store.write(capture(s,2,a)),false);assert.equal(mem.getItem(SAVE_KEY),previous);
  mem.setItem=put;assert.equal(store.write(capture(s,2,a)),true);const loaded=store.read();assert.equal(loaded.kind,'loaded');if(loaded.kind==='loaded')assert.deepEqual(loaded.state,s);
});
