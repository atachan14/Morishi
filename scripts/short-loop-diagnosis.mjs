import fs from 'node:fs/promises';
import {createState,validatePlacement,place,step,placementForecast,chooseTarget,attackDamage,insideTerritory,enemyPresenceAt} from '../.test-dist/src/sim.js';
const points=[];for(let yi=0;yi<21;yi++)for(let xi=0;xi<29;xi++)points.push({x:.35+xi*.4,y:.35+yi*.4});
const report={maxTicks:600,seeds:[20261011,1,11],runs:[]};
for(const seed of report.seeds)for(const policy of ['focus-left','nearest']){
 const s=createState(seed),legal=points.filter(p=>validatePlacement(s,p.x,p.y).ok),row={seed,policy,initial:{legal:legal.length,total:points.length,outsideOldStrip:legal.filter(p=>p.x>2).length,enemyGap:legal.filter(p=>p.x>2&&s.units.filter(u=>Math.hypot(p.x-u.x,p.y-u.y)<3).length>=2).length,referenceGap:{x:4,y:4,legal:validatePlacement(s,4,4).ok,presence:enemyPresenceAt(s,4,4)}},placements:[],events:[],released:[]};report.runs.push(row);
 const pick=()=>{
  const target=s.units.filter(u=>u.team==='enemy').sort((a,b)=>a.x-b.x||a.id-b.id)[0];if(!target)return;
  const options=points.filter(p=>validatePlacement(s,p.x,p.y).ok).map(p=>{const f=placementForecast(s,p.x,p.y);const nearest=Math.min(...s.units.filter(u=>u.team==='enemy').map(u=>Math.hypot(p.x-u.x,p.y-u.y)));const score=policy==='nearest'?-nearest:-Math.hypot(p.x-target.x,p.y-target.y)+.5*(f.targetId===target.id?f.damage:0)-.25*f.incomingDamage;return {...p,score,forecast:f};});return options.sort((a,b)=>b.score-a.score||a.y-b.y||a.x-b.x)[0];
 };
 for(let n=0;n<600&&s.outcome==='playing';n++){
  while(s.charges>0&&s.cards.length){const p=pick();if(!p)break;row.placements.push({tick:s.tick,x:p.x,y:p.y,target:p.forecast.targetId,incoming:p.forecast.incomingIds});place(s,p.x,p.y);}
  const ids=new Set(s.units.map(u=>u.id)),enemies=s.units.filter(u=>u.team==='enemy'),charges=s.charges,blocked=points.filter(p=>!insideTerritory(s,p.x,p.y));step(s);
  const dead=enemies.filter(u=>!s.units.some(v=>v.id===u.id)),lost=[...ids].filter(id=>!s.units.some(u=>u.id===id));
  if(dead.length){const released=blocked.filter(p=>insideTerritory(s,p.x,p.y));row.released.push({tick:s.tick,enemies:dead.map(u=>u.id),areaSamples:released.length,legalNow:released.filter(p=>validatePlacement(s,p.x,p.y).ok).length,example:released.find(p=>validatePlacement(s,p.x,p.y).ok)});}
  if(lost.length||s.charges>charges||s.outcome!=='playing')row.events.push({tick:s.tick,lost,charges:s.charges,outcome:s.outcome});
 }
 row.result={tick:s.tick,outcome:s.outcome,enemies:s.units.filter(u=>u.team==='enemy').length,allies:s.units.filter(u=>u.team==='ally').length,cards:s.cards.length,charges:s.charges,placeableNow:points.filter(p=>validatePlacement(s,p.x,p.y).ok).length,fieldOpenNow:points.filter(p=>insideTerritory(s,p.x,p.y)).length,damageNow:s.units.reduce((sum,u)=>{const t=chooseTarget(u,s.units);return sum+(t?attackDamage(u,t):0);},0)};
}
await fs.writeFile(process.argv[2],JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report.runs.map(r=>({seed:r.seed,policy:r.policy,initial:r.initial,result:r.result,placements:r.placements.length,releases:r.released.length})),null,2));
