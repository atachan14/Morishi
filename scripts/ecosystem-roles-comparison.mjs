import {createEco,placeEco,stepEco,currentStats,validateEcoPlacement} from '../.test-dist/src/eco-sim.js';
import {findPlantSpace} from '../.test-dist/src/eco-guidance.js';
import fs from 'node:fs';
const output=[];
for(const policy of [undefined,'guard-v1','quarter-v1'])for(const seed of [11,77,20261011])for(const mode of ['one-boss','three-fronts']){
 const s=createEco(seed,2,policy),initial=s.units.filter(u=>u.team==='ally'),actions=[],milestones=[];let rotate=0,shots=0,damage=0;const targets=new Set();
 const points=mode==='one-boss'?[[initial[0].x-8.1,initial[0].y],[initial[0].x-4.05,initial[0].y-7.014806],[initial[0].x-4.05,initial[0].y+7.014806]]:initial.map(u=>[u.x-8.1,u.y]);
 for(let i=0;i<3;i++){const [x,y]=points[i];if(!placeEco(s,x,y,i).ok)throw Error('opening');actions.push({tick:0,card:i,x,y});}
 for(let i=0;i<1200&&s.outcome==='playing';i++){
  if(s.tick>0&&s.hand.length&&s.charges){const allies=s.units.filter(u=>u.team==='ally').sort((a,b)=>b.diameter-a.diameter||a.id-b.id),card=s.hand[0];let point;
   if(allies.length){const boss=allies[mode==='three-fronts'?rotate++%allies.length:0],r=boss.diameter/2+card.seed.initialDiameter/2+.1;for(let angle=0;angle<16;angle++){const a=Math.PI+angle*Math.PI/8,p={x:boss.x+Math.cos(a)*r,y:boss.y+Math.sin(a)*r};if(validateEcoPlacement(s,p.x,p.y,card.id).ok){point=p;break;}}}else{const space=findPlantSpace(s);if(space.kind==='found')point=space.point;}
   if(point&&placeEco(s,point.x,point.y,card.id).ok)actions.push({tick:s.tick,card:card.id,...point});
  }
  const frameUnits=[...s.units];stepEco(s);for(const u of frameUnits.filter(u=>u.team==='ally'&&u.lastShot?.tick===s.tick)){shots++;damage+=u.lastShot.damage;targets.add(u.lastShot.target);}
  if([40,100,300,600,1200].includes(s.tick)||s.outcome==='win')milestones.push({tick:s.tick,kills:s.player.rewards.length,origins:s.player.rewards.flatMap(r=>r.enemyOrigins).length,allies:s.units.filter(u=>u.team==='ally').length,enemies:s.units.filter(u=>u.team==='enemy').length,merges:s.merges,shots,damage:Math.round(damage),distinctTargets:targets.size,outcome:s.outcome,allyStats:s.units.filter(u=>u.team==='ally').map(u=>({id:u.id,diameter:u.diameter,hp:u.hp,...currentStats(u)}))});
 }
 const row={policy:policy??'legacy',seed,mode,actions,milestones};output.push(row);console.log(JSON.stringify({policy:row.policy,seed,mode,placed:actions.length,last:{...milestones.at(-1),allyStats:undefined}}));
}
fs.mkdirSync('evidence/ecosystem-roles',{recursive:true});fs.writeFileSync('evidence/ecosystem-roles/feeding.json',JSON.stringify(output,null,2));
