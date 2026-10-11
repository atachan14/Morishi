// Bounded accelerated ordinary place/step paths; not a real-time browser soak.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createState,place,step,validatePlacement,placementForecast,decisionHint,Clock} from '../.test-dist/src/sim.js';
import {capture,replay,RunStore} from '../.test-dist/src/session.js';
import {ForegroundGate} from '../.test-dist/src/runtime.js';
const output=process.argv[2];await fs.mkdir(output,{recursive:true});
const stage={width:36,height:27,enemyCount:24},report={method:'ordinary place/step, accelerated; no artificial units or charges',perRunWallBudgetMs:12000,tickLimit:43200,rows:[]};
for(const seed of [20261011,11])for(const policy of ['attack','safe-retention']){
 const s=createState(seed,stage,'endless'),actions=[],times=[],start=performance.now();let peak=0,peakSave,zeroAllyTicks=0,waitingTicks=0,blocked=0;
 const grid=[];for(let y=.5;y<27;y+=1)for(let x=.5;x<36;x+=1)grid.push({x,y});
 function pick(){const enemies=s.units.filter(u=>u.team==='enemy'),allies=s.units.filter(u=>u.team==='ally'),points=[];
  if(policy==='safe-retention'&&enemies.length<=8){for(const p of grid){if(enemies.some(e=>Math.hypot(e.x-p.x,e.y-p.y)<7)||allies.some(a=>Math.hypot(a.x-p.x,a.y-p.y)<.85))continue;if(validatePlacement(s,p.x,p.y).ok)return p;}return;}
  for(const e of enemies)for(let dy=-3;dy<=3;dy+=.75)for(let dx=-3;dx<=3;dx+=.75){const p={x:e.x+dx,y:e.y+dy};if(!validatePlacement(s,p.x,p.y).ok)continue;const f=placementForecast(s,p.x,p.y);points.push({...p,score:(f.damage??0)+.4*(f.grownTargetId?1:0)-.6*f.incomingDamage-.05*Math.hypot(dx,dy)});}
  points.sort((a,b)=>b.score-a.score);return points[0];
 }
 while(s.tick<report.tickLimit&&s.outcome==='playing'&&performance.now()-start<report.perRunWallBudgetMs){
  if(s.charges>0&&(s.tick%240===0||!s.started)){let attempts=s.charges;while(attempts--&&s.charges){const p=pick();if(!p){blocked++;break;}assert.ok(place(s,p.x,p.y).ok);actions.push({tick:s.tick,kind:'place',x:p.x,y:p.y});}}
  if(!s.started)break;const before=s.tick,t=performance.now();step(s);times.push(performance.now()-t);assert.equal(s.tick,before+1);
  const allies=s.units.filter(u=>u.team==='ally').length;if(!allies){zeroAllyTicks++;if(zeroAllyTicks===1)await fs.writeFile(path.join(output,`${seed}-${policy}-zero.json`),JSON.stringify(capture(s,4,actions)));}if(!s.charges){waitingTicks++;assert.equal(decisionHint(s).kind,'supply');if(waitingTicks===1)await fs.writeFile(path.join(output,`${seed}-${policy}-waiting.json`),JSON.stringify(capture(s,4,actions)));}
  if(allies>peak){peak=allies;peakSave=capture(s,4,actions);}
 }
 const map=new Map(),store=new RunStore({getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)}),save=capture(s,4,actions),t=performance.now();assert.ok(store.write(save));const writeMs=performance.now()-t,r=performance.now(),loaded=store.read(),readMs=performance.now()-r;assert.equal(loaded.kind,'loaded');assert.deepEqual(loaded.state,s);assert.deepEqual(replay(save).state,s);
 const clock=new Clock(),gate=new ForegroundGate();clock.paused=false;clock.speed=4;gate.interrupt(clock);const frozen=structuredClone(s);clock.advance(s,gate.frame(600000));assert.deepEqual(s,frozen);clock.paused=false;const resumed=structuredClone(s);clock.advance(resumed,25);const expected=structuredClone(s);step(expected);assert.deepEqual(resumed,expected);
 times.sort((a,b)=>a-b);const row={seed,policy,wallMs:performance.now()-start,tick:s.tick,gameSeconds:s.tick/10,outcome:s.outcome,placements:s.supplyIndex,allies:s.units.filter(u=>u.team==='ally').length,enemies:s.units.filter(u=>u.team==='enemy').length,peakAllies:peak,zeroAllyTicks,waitingTicks,blocked,bytes:Buffer.byteLength(JSON.stringify(save)),actions:save.actions.length,writeMs,readMs,tickP95Ms:times[Math.floor(times.length*.95)],tickMaxMs:times.at(-1),pauseRestoreExact:true};report.rows.push(row);await fs.writeFile(path.join(output,`${seed}-${policy}.json`),JSON.stringify(save));if(peakSave)await fs.writeFile(path.join(output,`${seed}-${policy}-peak.json`),JSON.stringify(peakSave));await fs.writeFile(path.join(output,'simulation-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(row));
}
