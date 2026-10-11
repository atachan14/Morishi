import {createState,place,step,validatePlacement,WIDTH,HEIGHT,chooseTarget,attackDamage,territoryCoverage} from '../.test-dist/src/sim.js';
import * as sim from '../.test-dist/src/sim.js';
import {createHash} from 'node:crypto';
const seeds=[1,2,3,4,5,6,7,8,9,10,11,12,20261011],policies=['forward','cluster','range','rear'];
const enhanced=!process.argv.includes('--baseline');
function options(s){const result=[];for(let yi=0;yi<16;yi++)for(let xi=0;xi<22;xi++){const x=.35+xi*.52,y=.35+yi*.52;if(x<=WIDTH-.3&&y<=HEIGHT-.3&&validatePlacement(s,x,y).ok)result.push({x,y});}return result;}
function preview(s,p,age=0){return {id:s.nextId,team:'ally',...p,hp:s.cards[0].vitality,maxHp:s.cards[0].vitality,age,cooldown:0,stats:s.cards[0],target:null};}
function pick(s,policy){
  const enemies=s.units.filter(u=>u.team==='enemy'),target=[...enemies].sort((a,b)=>a.x-b.x||a.id-b.id)[0],anchor=s.units.find(u=>u.team==='ally')??{x:1,y:target.y};
  const list=options(s).map(p=>{
    const nearest=Math.min(...enemies.map(e=>Math.hypot(p.x-e.x,p.y-e.y)));
    let score=policy==='rear'?nearest:policy==='forward'?p.x-.7*Math.abs(p.y-target.y):-Math.hypot(p.x-target.x,p.y-target.y)-.35*Math.hypot(p.x-anchor.x,p.y-anchor.y);
    if(policy==='range'){const u=preview(s,p),grown=preview(s,p,224),t=chooseTarget(u,s.units),gt=chooseTarget(grown,s.units);const incoming=enemies.reduce((sum,e)=>sum+(chooseTarget(e,[...s.units,u])?.id===u.id?attackDamage(e,u):0),0);score=(t?attackDamage(u,t):0)+.4*(gt?attackDamage(grown,gt):0)-.55*incoming+.35*p.x;}
    return {...p,score};
  });list.sort((a,b)=>b.score-a.score||b.x-a.x||a.y-b.y);return list[0];
}
function initialChoices(s){const roles=new Set();for(const p of options(s)){const u=preview(s,p);roles.add(chooseTarget(u,s.units)?'attack':chooseTarget({...u,age:224},s.units)?'grow-attack':'bridge');}return [...roles].sort();}
export function trial(seed,policy){
  const s=createState(seed),roles=initialChoices(s);const kills=[],deaths=[];let placed=0,blocked=0,quietBlocked=0,longestBlocked=0,streak=0,firstCombat=null,thirdKill=null,latePlacements=0,earlyDealt=0,earlyTaken=0,lateDealt=0,lateTaken=0,guidanceMiss=0,nextChoice=null,lastCardWarningTicks=0;
  const doPlace=()=>{const p=pick(s,policy);if(!p)return false;place(s,p.x,p.y);placed++;if(thirdKill!==null)latePlacements++;return true;};
  while(s.charges>0&&doPlace()){}
  for(let i=0;i<2400&&s.outcome==='playing';i++){
    const shots=s.units.some(u=>chooseTarget(u,s.units));
    const hint=enhanced?sim.decisionHint?.(s):undefined;
    if(s.cards.length&&s.charges===0){blocked++;streak++;longestBlocked=Math.max(longestBlocked,streak);if(!shots)quietBlocked++;if(hint?.kind!=='supply')guidanceMiss++;}else streak=0;
    if(hint?.kind==='last-cards')lastCardWarningTicks++;
    if(nextChoice===null&&s.charges>0&&s.cards.length&&initialChoices(s).length>1)nextChoice=s.tick;
    if(s.tick%20===0&&s.charges>0&&s.cards.length)doPlace();
    const before=s.units.map(u=>({...u}));step(s);
    const after=new Map(s.units.map(u=>[u.id,u]));
    for(const u of before){const damage=u.hp-(after.get(u.id)?.hp??0);if(damage>0&&firstCombat===null)firstCombat=s.tick;
      if(u.team==='enemy'){if(thirdKill===null)earlyDealt+=damage;else lateDealt+=damage;}else {if(thirdKill===null)earlyTaken+=damage;else lateTaken+=damage;}
      if(!after.has(u.id)){if(u.team==='enemy')kills.push(s.tick);else deaths.push(s.tick);}
    }
    if(thirdKill===null&&kills.length>=3)thirdKill=s.tick;
  }
  const phaseEarly=thirdKill===null?null:thirdKill/3,phaseLate=s.outcome!=='win'||thirdKill===null?null:(s.tick-thirdKill)/4;
  const diagnosis=enhanced?sim.resultDiagnosis?.(s):undefined;
  return {seed,policy,outcome:s.outcome,seconds:s.tick/10,placed,enemies:7-kills.length,coverage:+territoryCoverage(s).toFixed(3),initialChoiceRoles:roles,firstMeaningfulChoiceSeconds:roles.length>1?0:null,nextMeaningfulChoiceSeconds:nextChoice===null?null:nextChoice/10,firstCombatSeconds:firstCombat===null?null:firstCombat/10,firstKillSeconds:kills[0]===undefined?null:kills[0]/10,blockedSeconds:blocked/10,quietBlockedSeconds:quietBlocked/10,longestBlockedSeconds:longestBlocked/10,boardSupplyGuidanceMissingSeconds:guidanceMiss/10,lastCardWarningSeconds:lastCardWarningTicks/10,kills,deaths,latePlacements,earlySecondsPerKill:phaseEarly===null?null:+(phaseEarly/10).toFixed(2),lateSecondsPerKill:phaseLate===null?null:+(phaseLate/10).toFixed(2),earlyDealt:+earlyDealt.toFixed(1),earlyTaken:+earlyTaken.toFixed(1),lateDealt:+lateDealt.toFixed(1),lateTaken:+lateTaken.toFixed(1),lossMessage:s.outcome==='loss'?s.events[0]:null,lossDetail:diagnosis??null,stateHash:createHash('sha256').update(JSON.stringify(s)).digest('hex')};
}
const trials=policies.flatMap(policy=>seeds.map(seed=>trial(seed,policy)));
const mean=(rows,key)=>{const vals=rows.map(r=>r[key]).filter(x=>x!==null);return vals.length?+(vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(2):null;};
const summary=policies.map(policy=>{const rows=trials.filter(t=>t.policy===policy),wins=rows.filter(t=>t.outcome==='win');return {policy,wins:wins.length,losses:rows.filter(t=>t.outcome==='loss').length,unfinished:rows.filter(t=>t.outcome==='playing').length,meanSeconds:mean(rows,'seconds'),nextMeaningfulChoiceSeconds:mean(rows,'nextMeaningfulChoiceSeconds'),firstCombatSeconds:mean(rows,'firstCombatSeconds'),firstKillSeconds:mean(rows,'firstKillSeconds'),blockedSeconds:mean(rows,'blockedSeconds'),quietBlockedSeconds:mean(rows,'quietBlockedSeconds'),longestBlockedSeconds:mean(rows,'longestBlockedSeconds'),boardSupplyGuidanceMissingSeconds:mean(rows,'boardSupplyGuidanceMissingSeconds'),lastCardWarningSeconds:mean(rows,'lastCardWarningSeconds'),earlySecondsPerKill:mean(wins,'earlySecondsPerKill'),lateSecondsPerKill:mean(wins,'lateSecondsPerKill'),latePlacements:mean(rows,'latePlacements'),concreteLossDetails:rows.filter(r=>r.lossDetail?.kind==='unreachable').length,lossMessages:[...new Set(rows.map(r=>r.lossMessage).filter(Boolean))]};});
console.log(JSON.stringify({guidance:enhanced?'current':'baseline',seeds,placementCadenceTicks:20,tickLimit:2400,initialBurst:3,summary,trials},null,2));
