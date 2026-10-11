import { createState,place,step,validatePlacement,WIDTH,HEIGHT,territoryCoverage } from '../.test-dist/src/sim.js';
export function trial(seed,policy='front',reference=false) {
  const s=createState(seed);let placements=0;let initialKill=null;let noAttackTicks=0;
  if(reference){const anchors=[[4,2],[4,6],[6,4],[8,1],[8,7],[10,3],[10,6]];s.units.forEach((u,i)=>{u.x=anchors[i][0];u.y=anchors[i][1];});}
  if(policy==='wait'){place(s,.4,4.5);placements++;}
  for(let i=0;i<2400&&s.outcome==='playing';i++){
    if(s.charges>0&&s.cards.length&&(policy!=='wait'||i>=400)){
      const options=[];
      for(let yi=0;yi<16;yi++)for(let xi=0;xi<22;xi++){
        const x=.35+xi*.52,y=.35+yi*.52;if(x>WIDTH-.3||y>HEIGHT-.3||!validatePlacement(s,x,y).ok)continue;
        const distance=Math.min(...s.units.filter(u=>u.team==='enemy').map(u=>Math.hypot(x-u.x,y-u.y)));
        options.push({x,y,distance});
      }
      options.sort((a,b)=>policy==='rear'?b.distance-a.distance||a.x-b.x||a.y-b.y:a.distance-b.distance||b.x-a.x||a.y-b.y);
      if(options.length){place(s,options[0].x,options[0].y);placements++;}
    }
    step(s);
    if(initialKill===null&&s.units.filter(u=>u.team==='enemy').length<7)initialKill=s.tick;
    if(s.units.every(u=>u.target===null))noAttackTicks++;
  }
  return {seed,policy,outcome:s.outcome,tick:s.tick,placements,enemies:s.units.filter(u=>u.team==='enemy').length,coverage:+territoryCoverage(s).toFixed(3),firstKill:initialKill,idleTicks:noAttackTicks};
}
const seeds=[1,2,3,4,5,6,7,8,9,10,11,12,20261011];
const reference=process.argv.includes('--reference');
const trials=['front','wait','rear'].flatMap(policy=>seeds.map(seed=>trial(seed,policy,reference)));
const summary=['front','wait','rear'].map(policy=>{const runs=trials.filter(t=>t.policy===policy);return {policy,wins:runs.filter(t=>t.outcome==='win').length,losses:runs.filter(t=>t.outcome==='loss').length,unfinished:runs.filter(t=>t.outcome==='playing').length,meanTicks:Math.round(runs.reduce((a,b)=>a+b.tick,0)/runs.length),meanPlacements:+(runs.reduce((a,b)=>a+b.placements,0)/runs.length).toFixed(1),meanEnemies:+(runs.reduce((a,b)=>a+b.enemies,0)/runs.length).toFixed(1)};});
console.log(JSON.stringify({map:reference?'reference-fixed':'seed-generated',summary,trials},null,2));
