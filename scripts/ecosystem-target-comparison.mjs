import {createEco,placeEco,stepEco,currentStats} from '../.test-dist/src/eco-sim.js';
import fs from 'node:fs';
const out=[];fs.mkdirSync('evidence/ecosystem-targets',{recursive:true});
const policy='quarter-v1';
for(const targetPolicy of [undefined,'presence-nearest-v1'])for(const seed of [11,77,20261011])for(const mode of ['concentrated','spread','front-back','two-flanks']){
 const s=createEco(seed,2,policy,targetPolicy),a=s.units.filter(u=>u.team==='ally'),e=s.units[0],actions=[];
 const points=mode==='concentrated'?[[a[0].x-8.1,a[0].y],[a[0].x-4.05,a[0].y-7.014806],[a[0].x-4.05,a[0].y+7.014806]]:mode==='spread'?a.map(u=>[u.x-8.1,u.y]):mode==='front-back'?[[e.x-60,e.y-45],[e.x-120,e.y-45],[e.x-120,e.y+45]]:[[e.x-60,e.y-80],[e.x-60,e.y+80],[e.x-130,e.y+80]];
 // Same three cards. Record their generated role mappings; no edited attributes.
 const cards=s.hand.slice(0,3).map(c=>({id:c.id,bindings:c.seed.bindings,fixed:c.seed.fixed}));
 for(let i=0;i<3;i++){const [x,y]=points[i],r=placeEco(s,x,y,i);if(!r.ok)throw Error(`${seed}/${mode}: ${r.reason}`);actions.push({card:i,x,y});}
 let shots=0,damage=0,incoming=0;const targets=new Set(),incomingById={};const marks=[];
 for(let i=0;i<600;i++){const frameUnits=[...s.units];stepEco(s);for(const u of frameUnits){if(u.lastShot?.tick!==s.tick)continue;if(u.team==='ally'){shots++;damage+=u.lastShot.damage;targets.add(u.lastShot.target);}else{incoming+=u.lastShot.damage;incomingById[u.lastShot.target]=(incomingById[u.lastShot.target]??0)+u.lastShot.damage;}}
  if([40,100,300,600].includes(s.tick))marks.push({tick:s.tick,kills:s.player.rewards.length,allies:s.units.filter(u=>u.team==='ally').length,shots,damage:Math.round(damage),incoming:Math.round(incoming),targets:[...targets],incomingById:{...incomingById},allyStats:s.units.filter(u=>u.team==='ally').map(u=>({id:u.id,x:u.x,y:u.y,hp:u.hp,diameter:u.diameter,...currentStats(u)}))});
 }
 out.push({targetPolicy:targetPolicy??'legacy',policy,seed,mode,cards,actions,marks});console.log(JSON.stringify({targetPolicy:targetPolicy??'legacy',policy,seed,mode,at30:{...marks[2],allyStats:undefined,incomingById:undefined,targets:marks[2].targets.length}}));
}
fs.writeFileSync('evidence/ecosystem-targets/formations.json',JSON.stringify(out,null,2));
