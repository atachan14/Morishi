import {ELEMENTS,ones,randomStream,round,type Element,type Elements} from './eco-contract.js';
export {ELEMENTS};
export const V2_RULES='element-skills-foundation-v1' as const;
export const V2_FIELDS=['attack','range','speed','defense'] as const;
export type ElementStats=Record<typeof V2_FIELDS[number],number>;
export type ElementTable=Record<Element,ElementStats>;
export type SkillKind='attack'|'heal';
export type Skill={key:string;kind:SkillKind;element:Element};
export type SkillClock={skill:Skill;progress:number;waterWaiting?:boolean};
export type GenerationConfig={soilLayout?:'finite-scattered-2';targetPolicy?:'aura-any-distance-1';healChance:number;enemyCount?:number;initialGap?:number;sizeModel?:'percent-1';initialBalance?:'range-presence-2';defenseAllocation?:'all-elements-1'};
// Proposal only: callers pass config explicitly; changing it affects new seeds alone.
export const SUGGESTED_V2_GENERATION:GenerationConfig={healChance:.1,initialBalance:'range-presence-2',defenseAllocation:'all-elements-1'};
export const CURRENT_V2_GENERATION:GenerationConfig={...SUGGESTED_V2_GENERATION,sizeModel:'percent-1',enemyCount:100,initialGap:40};
export const V2_DISK_LIMITS={min:200,max:100000,currentDefault:2400,legacyDefault:1100};
export const v2EnemyCount=(config:GenerationConfig)=>config.enemyCount??24;
export function validV2Population(config:GenerationConfig){return (config.enemyCount===undefined||Number.isSafeInteger(config.enemyCount)&&config.enemyCount>=1&&config.enemyCount<=100)&&(config.initialGap===undefined||Number.isFinite(config.initialGap)&&config.initialGap>=0&&config.initialGap<=500);}
export type BasisV2={maxHp:number;hpReg:number;presenceHalo:number;elements:ElementTable};
export type SeedV2={generator:'element-seed-1';runSeed:number;source:'enemy'|'initial'|'hand';index:number;initialDiameter:number;config:GenerationConfig;raw:BasisV2;fixed:BasisV2;skills:Skill[];entry:{tick:number;boosts:Elements;rewardIds:number[]}};
export const emptyElementTable=():ElementTable=>Object.fromEntries(ELEMENTS.map(e=>[e,{attack:0,range:0,speed:0,defense:0}])) as ElementTable;
export const skillKey=(kind:SkillKind,element:Element)=>`${kind}:${element}`;
export function generateV2Seed(runSeed:number,source:SeedV2['source'],index:number,config:GenerationConfig,entryTick=0,boosts=ones(),rewardIds:number[]=[]):SeedV2{
 if(config.soilLayout!==undefined&&config.soilLayout!=='finite-scattered-2'||config.targetPolicy!==undefined&&config.targetPolicy!=='aura-any-distance-1'||!validV2Population(config)||!Number.isSafeInteger(runSeed)||runSeed<0||runSeed>4294967295||!['enemy','initial','hand'].includes(source)||!Number.isSafeInteger(index)||index<0||index>1000000||!Number.isSafeInteger(entryTick)||entryTick<0||!Number.isFinite(config.healChance)||config.healChance<0||config.healChance>1||config.sizeModel!==undefined&&config.sizeModel!=='percent-1'||config.initialBalance!==undefined&&config.initialBalance!=='range-presence-2'||config.defenseAllocation!==undefined&&config.defenseAllocation!=='all-elements-1'||!ELEMENTS.every(e=>Number.isFinite(boosts[e])&&boosts[e]>=1)||new Set(rewardIds).size!==rewardIds.length||rewardIds.some(id=>!Number.isSafeInteger(id)||id<1||id>v2EnemyCount(config))||rewardIds.length>v2EnemyCount(config))throw Error('Invalid v2 generation input');
 const salt={enemy:0x454E454D,initial:0x414C4C59,hand:0x48414E44}[source],r=randomStream((runSeed^salt^Math.imul(index+1,0x27D4EB2D))>>>0);
 const element=ELEMENTS[Math.floor(r()*4)],kind:SkillKind=r()<config.healChance?'heal':'attack',elements=emptyElementTable();
 // Provisional numeric budget, separate from legacy generation. No inactive offense grows.
 elements[element]={attack:round(32+r()*24),range:round(config.initialBalance==='range-presence-2'?(source==='enemy'?14+r()*8:9+r()*7):120+r()*80),speed:round(.8+r()*.6),defense:round(20+r()*20)};
 // Keep the original total budget and RNG order for every other stat. Defense gets an independent stream.
 if(config.defenseAllocation==='all-elements-1'){const budget=elements[element].defense,defenseRandom=randomStream((runSeed^salt^Math.imul(index+1,0x27D4EB2D)^0xD3F3A113)>>>0),weights=ELEMENTS.map(()=>.01+defenseRandom()),total=weights.reduce((a,b)=>a+b,0);let assigned=0;for(let i=0;i<ELEMENTS.length;i++){const value=i===ELEMENTS.length-1?round(budget-assigned):round(budget*weights[i]/total);elements[ELEMENTS[i]].defense=value;assigned=round(assigned+value);}}
 const raw:BasisV2={maxHp:round(95+r()*45),hpReg:round(.06+r()*.10),presenceHalo:round(2.5+r()*1.5),elements};
 if(config.sizeModel==='percent-1')raw.presenceHalo=round(raw.presenceHalo*3);
 const fixed=structuredClone(raw);for(const e of ELEMENTS)for(const field of V2_FIELDS)fixed.elements[e][field]=round(raw.elements[e][field]*boosts[e]);
 return {generator:'element-seed-1',runSeed,source,index,initialDiameter:source==='enemy'?(config.sizeModel==='percent-1'?100+Math.floor(r()*3)*20:12+Math.floor(r()*3)*4):(config.sizeModel==='percent-1'?100:8),config:{...config},raw,fixed,skills:[{key:skillKey(kind,element),kind,element}],entry:{tick:entryTick,boosts:{...boosts},rewardIds:[...rewardIds]}};
}
export type {Element} from './eco-contract.js';
