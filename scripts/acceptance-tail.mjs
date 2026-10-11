import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createState,place,validatePlacement,step,chooseTarget,attackDamage} from '../.test-dist/src/sim.js';
import {capture,RunStore} from '../.test-dist/src/session.js';
const source=JSON.parse(await fs.readFile(process.argv[2],'utf8')),output=process.argv[3];
const rng=seed=>{let x=seed>>>0;return()=>{x=(Math.imul(x,1664525)+1013904223)>>>0;return x/4294967296;};};
const report={maxTicks:36000,runs:[],failures:[]};
for(const item of source.unfinished){
 let s=createState(item.seed);const random=rng(item.seed^0x53454544),actions=[];
 for(let n=0;n<2400;n++){
  if(n%40===0){const candidates=Array.from({length:48},()=>({x:.3+random()*11.4,y:.3+random()*8.4})).filter(p=>validatePlacement(s,p.x,p.y).ok);candidates.sort((a,b)=>item.policy==='forward'?b.x-a.x:item.policy==='rear'?a.x-b.x:0);if(candidates[0]){const p=candidates[0];place(s,p.x,p.y);actions.push({tick:s.tick,kind:'place',x:p.x,y:p.y});}}
  step(s);
 }
 assert.equal(s.tick,2400);assert.equal(s.cards.length,0);const initialHp=s.units.reduce((v,u)=>v+u.hp,0);let quiet=0,maxQuiet=0;
 while(s.tick<36000&&s.outcome==='playing'){
  const hp=s.units.reduce((v,u)=>v+u.hp,0);step(s);const next=s.units.reduce((v,u)=>v+u.hp,0);quiet=next===hp?quiet+1:0;maxQuiet=Math.max(maxQuiet,quiet);
  for(const u of s.units)assert.ok(u.hp>0&&u.hp<=u.maxHp);
 }
 const memory=new Map(),store=new RunStore({getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v)});assert.equal(store.write(capture(s,1,actions)),true);assert.deepEqual(store.read().state,s);
 const active=s.units.flatMap(u=>{const t=chooseTarget(u,s.units);return t?[{id:u.id,target:t.id,damage:attackDamage(u,t)}]:[];});
 const row={seed:item.seed,policy:item.policy,outcome:s.outcome,tick:s.tick,maxQuietTicks:maxQuiet,totalHpDecrease:initialHp-s.units.reduce((v,u)=>v+u.hp,0),active};report.runs.push(row);
 if(s.outcome==='playing'&&(maxQuiet>100||!active.length))report.failures.push(row);
}
await fs.writeFile(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({runs:report.runs.length,outcomes:report.runs.reduce((a,r)=>(a[r.outcome]=(a[r.outcome]??0)+1,a),{}),maxQuietTicks:Math.max(...report.runs.map(r=>r.maxQuietTicks)),failures:report.failures.length}));if(report.failures.length)process.exitCode=1;
