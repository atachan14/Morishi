import {ELEMENTS,ones,randomStream,round,type Element,type Elements} from './eco-contract.js';
export {ELEMENTS};
export const V2_RULES='element-skills-foundation-v1' as const;
export const V2_FIELDS=['attack','range','speed','defense'] as const;
export type ElementStats=Record<typeof V2_FIELDS[number],number>;
export type ElementTable=Record<Element,ElementStats>;
export type SkillKind='attack'|'heal';
export type Skill={key:string;kind:SkillKind;element:Element};
export type SkillClock={skill:Skill;progress:number};
export type GenerationConfig={healChance:number};
// Proposal only: callers pass config explicitly; changing it affects new seeds alone.
export const SUGGESTED_V2_GENERATION:GenerationConfig={healChance:.1};
export type BasisV2={maxHp:number;hpReg:number;presenceHalo:number;elements:ElementTable};
export type SeedV2={generator:'element-seed-1';runSeed:number;source:'enemy'|'initial'|'hand';index:number;initialDiameter:number;config:GenerationConfig;raw:BasisV2;fixed:BasisV2;skills:Skill[];entry:{tick:number;boosts:Elements;rewardIds:number[]}};
export const emptyElementTable=():ElementTable=>Object.fromEntries(ELEMENTS.map(e=>[e,{attack:0,range:0,speed:0,defense:0}])) as ElementTable;
export const skillKey=(kind:SkillKind,element:Element)=>`${kind}:${element}`;
export function generateV2Seed(runSeed:number,source:SeedV2['source'],index:number,config:GenerationConfig,entryTick=0,boosts=ones(),rewardIds:number[]=[]):SeedV2{
 if(!Number.isSafeInteger(runSeed)||runSeed<0||runSeed>4294967295||!['enemy','initial','hand'].includes(source)||!Number.isSafeInteger(index)||index<0||index>1000000||!Number.isSafeInteger(entryTick)||entryTick<0||!Number.isFinite(config.healChance)||config.healChance<0||config.healChance>1||!ELEMENTS.every(e=>Number.isFinite(boosts[e])&&boosts[e]>=1)||new Set(rewardIds).size!==rewardIds.length||rewardIds.some(id=>!Number.isSafeInteger(id)||id<1)||rewardIds.length>24)throw Error('Invalid v2 generation input');
 const salt={enemy:0x454E454D,initial:0x414C4C59,hand:0x48414E44}[source],r=randomStream((runSeed^salt^Math.imul(index+1,0x27D4EB2D))>>>0);
 const element=ELEMENTS[Math.floor(r()*4)],kind:SkillKind=r()<config.healChance?'heal':'attack',elements=emptyElementTable();
 // Provisional numeric budget, separate from legacy generation. No inactive offense grows.
 elements[element]={attack:round(32+r()*24),range:round(120+r()*80),speed:round(.8+r()*.6),defense:round(20+r()*20)};
 const raw:BasisV2={maxHp:round(95+r()*45),hpReg:round(.06+r()*.10),presenceHalo:round(2.5+r()*1.5),elements};
 const fixed=structuredClone(raw);for(const e of ELEMENTS)for(const field of V2_FIELDS)fixed.elements[e][field]=round(raw.elements[e][field]*boosts[e]);
 return {generator:'element-seed-1',runSeed,source,index,initialDiameter:source==='enemy'?12+Math.floor(r()*3)*4:8,config:{...config},raw,fixed,skills:[{key:skillKey(kind,element),kind,element}],entry:{tick:entryTick,boosts:{...boosts},rewardIds:[...rewardIds]}};
}
export type {Element} from './eco-contract.js';
