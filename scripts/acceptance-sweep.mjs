// Reproducible, dependency-free exploration of valid generated runs; no UI or save migration.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createState,place,validatePlacement,step,Clock,footprint,finishRun} from '../.test-dist/src/sim.js';
import {capture,RunStore} from '../.test-dist/src/session.js';
import {ForegroundGate} from '../.test-dist/src/runtime.js';
const output=process.argv[2]??'acceptance-sweep.json';
const report={version:1,seeds:128,policies:['forward','rear','mixed'],maxTicks:2400,runs:0,checkpoints:0,accepted:0,rejected:0,outcomes:{win:0,loss:0,playing:0},failures:[],unfinished:[]};
const rng=seed=>{let x=seed>>>0;return()=>{x=(Math.imul(x,1664525)+1013904223)>>>0;return x/4294967296;};};
for(let index=0;index<128;index++)for(const policy of report.policies){
 const seed=index===0?20261011:index===1?0:index===2?4294967295:(Math.imul(index,2654435761)>>>0),random=rng(seed^0x53454544);
 let s=createState(seed),reference=structuredClone(s),clock=new Clock();clock.speed=[1,2,4][index%3];clock.paused=false;const gate=new ForegroundGate(),actions=[];
 const invariant=()=>{assert.ok(s.charges>=0&&s.charges<=5);assert.ok(s.cards.length>=0&&s.cards.length<=18);assert.equal(new Set(s.units.map(u=>u.id)).size,s.units.length);for(const u of s.units){assert.ok(Number.isFinite(u.hp)&&u.hp>0&&u.hp<=u.maxHp);assert.ok(u.x>=.3&&u.x<=11.7&&u.y>=.3&&u.y<=8.7);assert.ok(u.cooldown>=0);if(u.lastShot)assert.ok(u.lastShot.tick<=s.tick&&u.lastShot.damage>=0);}for(const t of s.territory)assert.ok(Number.isFinite(t.radius)&&t.radius>0);};
 try{
  for(let n=0;n<2400&&s.outcome==='playing';n++){
   if(n%40===0){
    // Include exact boundaries, outside points, nonfinite values and occupied centres.
    const probes=[[-1,4],[12.1,4],[1,NaN],[Infinity,2],[.299,4],...s.units.slice(0,2).map(u=>[u.x,u.y])];
    for(const [x,y] of probes){const before=JSON.stringify(s);assert.equal(place(s,x,y).ok,false);assert.equal(JSON.stringify(s),before);report.rejected++;}
    const candidates=Array.from({length:48},()=>({x:.3+random()*11.4,y:.3+random()*8.4})).filter(p=>validatePlacement(s,p.x,p.y).ok);
    candidates.sort((a,b)=>policy==='forward'?b.x-a.x:policy==='rear'?a.x-b.x:0);
    const p=candidates[0];if(p){for(const u of s.units)assert.ok(Math.hypot(p.x-u.x,p.y-u.y)>=footprint(u)+.3-1e-9);assert.equal(place(s,p.x,p.y).ok,true);assert.equal(place(reference,p.x,p.y).ok,true);actions.push({tick:s.tick,kind:'place',x:p.x,y:p.y});report.accepted++;}
   }
   const alive=new Set(s.units.map(u=>u.id));step(reference);
   for(const ms of [17,13,70])clock.advance(s,ms/clock.speed);
   invariant();for(const u of s.units)if(u.lastShot?.tick===s.tick)assert.ok(alive.has(u.id)&&alive.has(u.lastShot.targetId));
   if(n%80===79||s.outcome!=='playing'){
    assert.deepEqual(s,reference);const memory=new Map(),store=new RunStore({getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v)});assert.equal(store.write(capture(s,clock.speed,actions)),true);const loaded=store.read();assert.equal(loaded.kind,'loaded');assert.deepEqual(loaded.state,s);s=loaded.state;
    // A discarded partial frame plus foreground recovery must neither tick nor catch up.
    const before=structuredClone(s);clock.advance(s,10/clock.speed);gate.interrupt(clock);assert.equal(gate.frame(5000),0);clock.paused=false;clock.advance(s,0);assert.deepEqual(s,before);report.checkpoints++;
   }
  }
  if(s.outcome==='playing'){report.unfinished.push({seed,policy,tick:s.tick,cards:s.cards.length,enemies:s.units.filter(u=>u.team==='enemy').length});assert.equal(finishRun(s),true);}
  else {const frozen=structuredClone(s);for(let i=0;i<10;i++)step(s);clock.advance(s,10000);assert.deepEqual(s,frozen);}
  report.outcomes[reference.outcome]++;report.runs++;
 }catch(error){report.failures.push({seed,policy,tick:s.tick,actions,error:String(error),stack:error.stack});break;}
}
await fs.writeFile(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({...report,unfinished:report.unfinished.length},null,2));if(report.failures.length)process.exitCode=1;
