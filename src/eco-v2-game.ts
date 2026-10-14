import {referenceWitnessCandidates} from './eco-v2-reference-witness.js';
import {SkillConfig} from './eco-v2-config.js';
import {referenceMaterial} from './eco-v2-reference.js';
import {skillWaterCost} from './eco-v2-zero-runtime.js';
import type {RootStepObserver} from './eco-root-trial.js';
import {advanceDirectRootGame,advanceRootGame,syncRootCombat,retireRootDeath,type RootGameRuntime} from './eco-v2-root.js';
import {ones,round,randomStream,type Element} from './eco-contract.js';
import {ECO_LIMITS,WORLD,TICK_SECONDS,DRAW_SECONDS,TURN_SECONDS} from './eco-sim.js';
import {ELEMENTS,V2_RULES,generateV2Seed,V2_DISK_LIMITS,v2EnemyCount,validV2Population,type SeedV2,type GenerationConfig} from './eco-v2-contract.js';
import {createV2Unit,currentV2Stats,v2PresenceAt,canPlaceV2,v2DistanceCoefficient,v2SurfaceDistance,advanceV2Growth,uniqueSkillsKeepingReceiverClock,type FoundationV2,type UnitV2} from './eco-v2-foundation.js';
export type SkillEffect={tick:number;kind:'attack'|'heal';element:Element;count:number;amount:number;from:{id:number;team:UnitV2['team'];x:number;y:number;diameter:number};to:{id:number;x:number;y:number;diameter:number}};
export type EffectObserver=(effect:SkillEffect)=>void;
export type ActivationPolicy='independent';
export type GameV2=FoundationV2&{rootGrowth?:RootGameRuntime;seed:number;config:GenerationConfig;diskRadius:number;layoutAttempt:number;activationPolicy:ActivationPolicy;hand:{id:number;seed:SeedV2}[];nextCard:number;charges:number;drawProgress:number;turnProgress:number;boosts:ReturnType<typeof ones>;rewards:{id:number;tick:number;element:Element;enemyOrigins:number[]}[];outcome:'playing'|'win'|'ended';events:string[];needsDecision:boolean;rotations:Record<number,Partial<Record<Element,string>>>};
const log=(s:GameV2,text:string)=>{s.events.unshift(`${(s.tick/10).toFixed(1)}秒 ${text}`);s.events=s.events.slice(0,8);};
export function createV2Game(seed:number,config:GenerationConfig,diskRadius=config.enemyCount===undefined?V2_DISK_LIMITS.legacyDefault:V2_DISK_LIMITS.currentDefault):GameV2{
 if(config.soilLayout!==undefined&&config.soilLayout!=='finite-scattered-2'||config.targetPolicy!==undefined&&config.targetPolicy!=='aura-any-distance-1'||!validV2Population(config)||!Number.isSafeInteger(seed)||seed<0||seed>4294967295||!Number.isFinite(config.healChance)||config.healChance<0||config.healChance>1||config.sizeModel!==undefined&&config.sizeModel!=='percent-1'||config.initialBalance!==undefined&&config.initialBalance!=='range-presence-2'||config.defenseAllocation!==undefined&&config.defenseAllocation!=='all-elements-1'||!Number.isFinite(diskRadius)||diskRadius<V2_DISK_LIMITS.min||diskRadius>V2_DISK_LIMITS.max)throw Error('設定値が不正です。敵生成円の半径は200〜100000、敵数は1〜100です。');
 const gap=config.initialGap??0,requiredArea=Array.from({length:v2EnemyCount(config)},(_,index)=>{const body=generateV2Seed(seed,'enemy',index,config).initialDiameter/2;return (body+gap/2)**2;}).reduce((a,b)=>a+b,0);if(requiredArea>(diskRadius+gap/2)**2)throw Error('敵の体と間隔を収める面積が不足しています。生成円の半径を広げてください。');
 for(let layoutAttempt=0;layoutAttempt<8;layoutAttempt++){try{return generateV2GameLayout(seed,config,diskRadius,layoutAttempt);}catch{}}
 throw Error("生成範囲が密すぎて配置できませんでした。円の半径を広げて再度生成してください。");
}
function generateV2GameLayout(seed:number,config:GenerationConfig,diskRadius:number,layoutAttempt:number):GameV2{
 if(!Number.isFinite(diskRadius)||diskRadius<V2_DISK_LIMITS.min||diskRadius>V2_DISK_LIMITS.max)throw Error('Enemy disk radius must be 200..100000');
 const r=randomStream(seed^0x4449534B^Math.imul(layoutAttempt+1,104729)),units:GameV2['units']=[];
 for(let index=0;index<v2EnemyCount(config);index++){const seedData=generateV2Seed(seed,'enemy',index,config),body=seedData.initialDiameter/2;let point:{x:number;y:number}|undefined;
  for(let attempt=0;attempt<(config.enemyCount===undefined?10000:1024);attempt++){const radius=(diskRadius-body)*Math.sqrt(r()),angle=2*Math.PI*r(),x=round(WORLD.width/2+radius*Math.cos(angle)),y=round(WORLD.height/2+radius*Math.sin(angle));if(units.every(u=>Math.hypot(u.x-x,u.y-y)>=u.diameter/2+body+(config.initialGap??0))){point={x,y};break;}}
  if(!point)throw Error('Non-overlapping disk generation exhausted its bounded budget; no enemies removed');units.push(createV2Unit(index+1,seedData,'enemy',point.x,point.y));
 }
 const hand=Array.from({length:4},(_,id)=>({id,seed:generateV2Seed(seed,'hand',id,config)}));
 const witness=[{x:40,y:40},{x:WORLD.width-40,y:40},{x:40,y:WORLD.height-40},{x:WORLD.width-40,y:WORLD.height-40},{x:WORLD.width/2,y:WORLD.height/2},...(config.statModel?referenceWitnessCandidates(units,diskRadius,hand[0].seed.initialDiameter):[])].find(p=>canPlaceV2(units,hand[0].seed.initialDiameter,p.x,p.y,3));
 if(!witness)throw Error('No starting placement witness found; no automatic reroll or weakening');
 return {...(config.sizeModel?{sizeModel:config.sizeModel}:{}),rules:V2_RULES,seed,config:{...config},diskRadius,layoutAttempt,activationPolicy:'independent',tick:0,nextId:v2EnemyCount(config)+1,merges:0,units,hand,nextCard:4,charges:3,drawProgress:0,turnProgress:0,boosts:ones(),rewards:[],outcome:'playing',events:['円盤内ランダム・味方0体開始。数値は仮設定。'],needsDecision:false,rotations:{}};
}
export function placeV2(s:GameV2,x:number,y:number,cardId:number){const card=s.hand.find(c=>c.id===cardId);if(!card||s.outcome!=='playing'||!canPlaceV2(s.units,card.seed.initialDiameter,x,y,s.charges))return false;const u=createV2Unit(s.nextId++,card.seed,'ally',x,y,s.tick,s.sizeModel);s.units.push(u);s.hand=s.hand.filter(c=>c.id!==cardId);s.charges--;log(s,`手札#${cardId+1}を配置`);return true;}
// Extreme values use a shadow transaction; this is not a game size ceiling.
export function stepV2(s:GameV2,onEffect?:EffectObserver,onRootStep?:RootStepObserver){const extreme=s.units.some(u=>{const stats=currentV2Stats(u);return (u.rootData?.stats[3]??0)>1e100||u.diameter>1e100||stats.maxHp>1e100||Object.values(stats.elements).some(e=>e.speed>Number.MAX_SAFE_INTEGER||Object.values(e).some(v=>v>1e100));});if(!extreme)return stepV2Core(s,onEffect,onRootStep);const shadow=structuredClone(s),effects:SkillEffect[]=[],rootSteps:Parameters<RootStepObserver>[0][]=[];const result=stepV2Core(shadow,onEffect?e=>effects.push(e):undefined,onRootStep?m=>rootSteps.push(m):undefined);Object.assign(s,shadow);if(onRootStep)for(const m of rootSteps)onRootStep(m);for(const e of effects)try{onEffect?.(e);}catch{}return result;}
function stepV2Core(s:GameV2,onEffect?:EffectObserver,onRootStep?:RootStepObserver){if(s.outcome!=='playing')return false;s.activationPolicy='independent';s.needsDecision=false;s.rotations={};
 if(s.rootGrowth?.direct)advanceDirectRootGame(s,()=>resolveV2Skills(s,onEffect),onRootStep);else{if(s.rootGrowth)advanceRootGame(s,onRootStep);else advanceV2Growth(s,uniqueSkillsKeepingReceiverClock);resolveV2Skills(s,onEffect);}
 if(!s.units.some(u=>u.team==='enemy')){s.outcome='win';return false;}
 advanceSupply(s);
 return true;
}
function resolveV2Skills(s:GameV2,onEffect?:EffectObserver){
 let visualBudget=128;const emit=(kind:SkillEffect['kind'],element:Element,from:UnitV2,to:UnitV2,amount:number,count:number)=>{if(!onEffect||visualBudget--<=0)return;try{onEffect({tick:s.tick,kind,element,count,amount,from:{id:from.id,team:from.team,x:from.x,y:from.y,diameter:from.diameter},to:{id:to.id,x:to.x,y:to.y,diameter:to.diameter}});}catch{/* Presentation cannot interrupt combat. */}};
 // Growth/merges are complete; material values stay fixed during simultaneous effect collection.
 const sheets=new Map(s.units.map(u=>[u.id,currentV2Stats(u)]));
 const damage=new Map<number,number>(),healing=new Map<number,number>();
 for(const u of [...s.units].sort((a,b)=>a.id-b.id)){const stats=sheets.get(u.id)!,due=new Map<string,{count:number;fraction:number}>();for(const clock of u.skills){const total=round(clock.progress+stats.elements[clock.skill.element].speed*TICK_SECONDS),count=s.rootGrowth?.direct&&clock.waterWaiting?1:Math.floor(total+1e-9);if(!Number.isSafeInteger(count))throw RangeError('数値表現限界: 発動回数を正確に表現できません');due.set(clock.skill.key,{count,fraction:clock.waterWaiting&&s.rootGrowth?.direct?0:round(total-count)});clock.progress=Math.min(1,total);}
  for(const element of ELEMENTS){const ready=u.skills.filter(c=>c.skill.element===element&&c.progress>=1&&s.units.some(v=>(c.skill.kind==='heal'?v.team===u.team&&v.hp<sheets.get(v.id)!.maxHp:v.team!==u.team)&&(c.skill.kind==='attack'&&s.config.targetPolicy==='aura-any-distance-1'||v2SurfaceDistance(u,v)<stats.elements[element].range))).sort((a,b)=>a.skill.key.localeCompare(b.skill.key));const candidates=ready;
   for(const c of candidates){const material=stats.elements[element];let count=due.get(c.skill.key)!.count;if(s.rootGrowth?.direct){const p=s.rootGrowth.plants.find(p=>p.id===u.id)!,cost=u.reference?SkillConfig[element].BaseWaterCost/referenceMaterial(u.reference,u.diameter).tech[ELEMENTS.indexOf(element)]:skillWaterCost(u.tech?.[element]??0),affordable=Math.floor(p.water/cost);count=Math.min(count,affordable);if(count<=0){c.progress=1;c.waterWaiting=true;continue;}const spent=count*cost;p.water=Math.max(0,p.water-spent);u.rootData!.water=p.water;s.rootGrowth.direct.skillWaterConsumed+=spent;if(count<due.get(c.skill.key)!.count){c.waterWaiting=true;}else delete c.waterWaiting;}if(c.skill.kind==='heal'){const targets=s.units.filter(v=>v.team===u.team&&v.hp<sheets.get(v.id)!.maxHp&&v2SurfaceDistance(u,v)<material.range);if(!targets.length)continue;for(const v of targets){const amount=round(material.attack*(u.reference?SkillConfig[element].healFactor:.5)*count*v2DistanceCoefficient(v2SurfaceDistance(u,v),material.range));if(!Number.isFinite(amount)||!Number.isFinite((healing.get(v.id)??0)+amount))throw RangeError('数値表現限界: 回復量が非有限になります');healing.set(v.id,(healing.get(v.id)??0)+amount);emit('heal',element,u,v,amount,count);}}
    else{const target=s.units.filter(v=>v.team!==u.team&&(s.config.targetPolicy==='aura-any-distance-1'||v2SurfaceDistance(u,v)<material.range)).sort((a,b)=>v2PresenceAt(b,u.x,u.y)-v2PresenceAt(a,u.x,u.y)||a.id-b.id)[0];if(!target)continue;const amount=round(material.attack*count/(target.reference?sheets.get(target.id)!.elements[element].defense:1+sheets.get(target.id)!.elements[element].defense/(s.rootGrowth?100:70))*v2DistanceCoefficient(v2SurfaceDistance(u,target),material.range));if(!Number.isFinite(amount)||!Number.isFinite((damage.get(target.id)??0)+amount))throw RangeError('数値表現限界: damageが非有限になります');damage.set(target.id,(damage.get(target.id)??0)+amount);emit('attack',element,u,target,amount,count);}
    c.progress=s.rootGrowth?.direct&&c.waterWaiting?1:due.get(c.skill.key)!.fraction;
   }
  }
 }
 // Same-tick effects collected from the living pre-damage board; heal before damage, no revival.
 for(const u of s.units)u.hp=Math.min(sheets.get(u.id)!.maxHp,round(Math.max(0,Math.min(sheets.get(u.id)!.maxHp,u.hp+(healing.get(u.id)??0))-(damage.get(u.id)??0))));
 for(const u of s.units.filter(u=>u.hp<=0).sort((a,b)=>a.id-b.id)){if(s.rootGrowth)retireRootDeath(s,u);if(u.team==='enemy'){const element=u.seed.skills[0].element;s.rewards.push({id:u.id,tick:s.tick,element,enemyOrigins:[...u.enemyOrigins]});s.boosts[element]=round(s.boosts[element]+.01);s.charges=Math.min(ECO_LIMITS.charges,s.charges+1);}delete s.rotations[u.id];log(s,`${u.team==='enemy'?'敵':'味方'}#${u.id}消滅`);}s.units=s.units.filter(u=>u.hp>0);if(s.rootGrowth)syncRootCombat(s);
}
function advanceSupply(s:GameV2){
 if(s.hand.length<ECO_LIMITS.hand&&s.nextCard<ECO_LIMITS.generations){s.drawProgress=round(s.drawProgress+TICK_SECONDS/DRAW_SECONDS);if(s.drawProgress>=1){s.drawProgress=round(s.drawProgress-1);const id=s.nextCard++;s.hand.push({id,seed:generateV2Seed(s.seed,'hand',id,s.config,s.tick,s.boosts,s.rewards.map(r=>r.id))});}}
 if(s.charges<ECO_LIMITS.charges){s.turnProgress=round(s.turnProgress+TICK_SECONDS/TURN_SECONDS);if(s.turnProgress>=1){s.turnProgress=round(s.turnProgress-1);s.charges++;}}
}
export {WORLD};export const PRESENCE_LIMIT=0;
