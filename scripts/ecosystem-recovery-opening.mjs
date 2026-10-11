import fs from 'node:fs';import {pathToFileURL} from 'node:url';import * as base from '../.test-dist/src/eco-sim.js';import {findPlantSpace} from '../.test-dist/src/eco-guidance.js';
const seed=Number(process.argv[2]??77),source=fs.readFileSync('.test-dist/src/eco-sim.js','utf8').replace("'./eco-contract.js'",JSON.stringify(pathToFileURL(process.cwd()+'/.test-dist/src/eco-contract.js').href)),rows=[];
for(const [name,code] of [['baseline',source],['growth6',source.replace('GROWTH_PER_SECOND = 3','GROWTH_PER_SECOND = 6')],['density1.1',source.replace('ax + dx +','ax + dx * 1.1 +').replace('ay + dy +','ay + dy * 1.1 +')],['density1.25',source.replace('ax + dx +','ax + dx * 1.25 +').replace('ay + dy +','ay + dy * 1.25 +')]]){
 const api=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64')),s=api.createEco(seed,2,'quarter-v1','presence-nearest-v1'),a=s.units.find(u=>u.team==='ally');let shots=0,last=0,maxGap=0,placements=0,dead=0,expansionId,expansionEnemy;
 for(const [id,x,y] of [[0,a.x-8.1,a.y],[1,a.x-4.05,a.y-7.014806],[2,a.x-4.05,a.y+7.014806]])if(api.placeEco(s,x,y,id).ok)placements++;
 while(s.tick<6000&&s.outcome==='playing'){
 if(s.hand.length&&s.charges){if(s.tick>=2400&&expansionEnemy!==undefined&&!s.units.some(u=>u.team==='enemy'&&u.enemyOrigins.includes(expansionEnemy))){expansionId=undefined;expansionEnemy=undefined;}const expand=s.tick>=2400&&(s.tick<3600||placements%3!==0)&&(s.tick-last>100||expansionId!==undefined),allies=s.units.filter(u=>u.team==='ally').sort((a,b)=>b.diameter-a.diameter||a.id-b.id),card=s.hand[0];let point;
 if(expand&&(!expansionId||!allies.some(u=>u.lineage.includes(expansionId)))){const enemy=s.units.filter(u=>u.team==='enemy').sort((a,b)=>a.id-b.id)[0],space=findPlantSpace(s,8,{preferred:enemy});if(space.kind==='found'){point=space.point;expansionEnemy=enemy.id;}}
 else if(allies.length){const boss=expand?allies.find(u=>u.lineage.includes(expansionId)):allies[0],radius=boss.diameter/2+4.1;for(let angle=0;angle<16;angle++){const a=Math.PI+angle*Math.PI/8,p={x:boss.x+Math.cos(a)*radius,y:boss.y+Math.sin(a)*radius};if(api.validateEcoPlacement(s,p.x,p.y,card.id).ok){point=p;break;}}}
 else{const space=findPlantSpace(s,8,{preferred:s.units.find(u=>u.team==='enemy')});if(space.kind==='found')point=space.point;}
 if(point&&api.placeEco(s,point.x,point.y,card.id).ok){if(expand&&(!expansionId||!allies.some(u=>u.lineage.includes(expansionId))))expansionId=s.units.at(-1).id;placements++;}}
 const prior=[...s.units];api.stepEco(s);if(prior.some(u=>u.lastShot?.tick===s.tick)){shots+=prior.filter(u=>u.lastShot?.tick===s.tick).length;maxGap=Math.max(maxGap,s.tick-last);last=s.tick;}dead+=prior.filter(u=>u.team==='ally'&&u.hp<=0).length;
 }
 const row={seed,name,tick:s.tick,shots,placements,dead,merges:s.merges,kills:s.player.rewards.length,origins:s.player.rewards.flatMap(r=>r.enemyOrigins).length,maxGapSeconds:Math.max(maxGap,s.tick-last)/10,outcome:s.outcome,boosts:s.player.boosts};rows.push(row);console.log(JSON.stringify(row));
}
fs.writeFileSync(`evidence/ecosystem-recovery/${seed}-opening.json`,JSON.stringify({syntheticParameters:true,gameSeconds:600,rows},null,2));
