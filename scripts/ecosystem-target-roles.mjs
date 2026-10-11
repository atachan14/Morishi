import {createEco,placeEco,stepEco,currentStats} from '../.test-dist/src/eco-sim.js';
import fs from 'node:fs';
const out=[];fs.mkdirSync('evidence/ecosystem-targets',{recursive:true});
const policy='quarter-v1';
for(const targetPolicy of [undefined,'presence-nearest-v1'])for(const seed of [11,77,20261011])for(const mode of ['front-back','role-front','role-reversed']){
 const s=createEco(seed,2,policy,targetPolicy),a=s.units.filter(u=>u.team==='ally'),e=s.units[0],actions=[];
 const points=mode==='concentrated'?[[a[0].x-8.1,a[0].y],[a[0].x-4.05,a[0].y-7.014806],[a[0].x-4.05,a[0].y+7.014806]]:mode==='spread'?a.map(u=>[u.x-8.1,u.y]):['front-back','role-front','role-reversed'].includes(mode)?[[e.x-60,e.y-45],[e.x-120,e.y-45],[e.x-120,e.y+45]]:[[e.x-60,e.y-80],[e.x-60,e.y+80],[e.x-130,e.y+80]];
 // Same three cards. Record their generated role mappings; no edited attributes.
 const cards=s.hand.slice(0,3).map(c=>({id:c.id,bindings:c.seed.bindings,fixed:c.seed.fixed}));
 const order=cards.map(c=>{const v=s.hand.find(h=>h.id===c.id).seed,els=v.fixed.elements,role=name=>els[Object.keys(v.bindings).find(e=>v.bindings[e]===name)];return {id:c.id,durability:v.fixed.hp*(1+role('defense')/70),range:role('range')};}).sort((a,b)=>b.durability-a.durability||a.id-b.id).map(c=>c.id);if(mode==='role-reversed')[order[0],order[1]]=[order[1],order[0]];for(let i=0;i<3;i++){const card=mode==='front-back'?i:order[i];const [x,y]=points[i],r=placeEco(s,x,y,card);if(!r.ok)throw Error(`${seed}/${mode}: ${r.reason}`);actions.push({card,x,y});}
 let shots=0,damage=0,incoming=0;const targets=new Set(),incomingById={},outgoingById={};const marks=[];
 for(let i=0;i<600;i++){const frameUnits=[...s.units];stepEco(s);for(const u of frameUnits){if(u.lastShot?.tick!==s.tick)continue;if(u.team==='ally'){shots++;damage+=u.lastShot.damage;targets.add(u.lastShot.target);const o=outgoingById[u.id]??{shots:0,damage:0};o.shots++;o.damage+=u.lastShot.damage;outgoingById[u.id]=o;}else{incoming+=u.lastShot.damage;incomingById[u.lastShot.target]=(incomingById[u.lastShot.target]??0)+u.lastShot.damage;}}
  if([40,100,300,600].includes(s.tick))marks.push({tick:s.tick,kills:s.player.rewards.length,allies:s.units.filter(u=>u.team==='ally').length,shots,damage:Math.round(damage),incoming:Math.round(incoming),targets:[...targets],incomingById:{...incomingById},outgoingById:structuredClone(outgoingById),allyStats:s.units.filter(u=>u.team==='ally').map(u=>({id:u.id,x:u.x,y:u.y,hp:u.hp,diameter:u.diameter,...currentStats(u)}))});
 }
 out.push({targetPolicy:targetPolicy??'legacy',policy,seed,mode,cards,actions,marks});console.log(JSON.stringify({targetPolicy:targetPolicy??'legacy',policy,seed,mode,at30:{...marks[2],allyStats:undefined,incomingById:undefined,targets:marks[2].targets.length}}));
}
fs.writeFileSync('evidence/ecosystem-targets/role-front.json',JSON.stringify(out,null,2));
