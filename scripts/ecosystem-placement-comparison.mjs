import {createEco,placeEco,stepEco,currentStats,validateEcoPlacement} from '../.test-dist/src/eco-sim.js';
import fs from 'node:fs';
const rows=[];
for(const seed of [11,77,20261011])for(const policy of ['tight','spread','distant']){
 const s=createEco(seed),allies=s.units.filter(u=>u.team==='ally'),enemy=s.units[0],points=policy==='tight'?[{x:enemy.x-70,y:enemy.y-38},{x:enemy.x-70,y:enemy.y+38},{x:enemy.x-150,y:enemy.y}]:policy==='spread'?allies.map(u=>({x:u.x-55,y:u.y})): [{x:2048,y:1536},{x:2100,y:1536},{x:2048,y:1588}],actions=[],checkpoints=[];
 for(let i=0;i<3;i++){const p=points[i];const cardId=i;const before=s.hand.find(c=>c.id===cardId);const r=placeEco(s,p.x,p.y,cardId);actions.push({tick:s.tick,cardId,x:p.x,y:p.y,accepted:r.ok,reason:r.reason,binding:before.seed.bindings});}
 for(let i=0;i<900;i++){stepEco(s);if([40,100,300,900].includes(s.tick))checkpoints.push({tick:s.tick,kills:s.player.rewards.length,allies:s.units.filter(u=>u.team==='ally').length,enemies:s.units.filter(u=>u.team==='enemy').length,merges:s.merges,hp:s.units.filter(u=>u.team==='ally').map(u=>({id:u.id,hp:+u.hp.toFixed(2),diameter:u.diameter,attack:currentStats(u).attack,range:currentStats(u).range,speed:currentStats(u).speed}))});}
 rows.push({seed,policy,actions,checkpoints,legalCorner:validateEcoPlacement(s,40,40,s.hand[0]?.id).ok,charges:s.charges,hand:s.hand.length});
}
fs.mkdirSync('evidence/ecosystem',{recursive:true});
fs.writeFileSync('evidence/ecosystem/placement-comparison.json',JSON.stringify(rows,null,2));
console.log(JSON.stringify(rows.map(r=>({seed:r.seed,policy:r.policy,accepted:r.actions.every(a=>a.accepted),snapshots:r.checkpoints.map(c=>({tick:c.tick,kills:c.kills,allies:c.allies,merges:c.merges}))})),null,2));
