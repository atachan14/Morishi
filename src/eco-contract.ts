// New comparison only. Legacy Morishi snapshots and formulas remain untouched.
export const ELEMENTS=['fire','ice','electric','dark'] as const;
export const ROLES=['attack','defense','speed','range'] as const;
export type Element=typeof ELEMENTS[number];
export type Role=typeof ROLES[number];
export type Elements=Record<Element,number>;
export type Bindings=Record<Element,Role>;
export type Basis={hp:number;hpReg:number;presenceHalo:number;elements:Elements};
export type Seed={generator:'eco-seed-1';runSeed:number;source:'enemy'|'initial'|'hand';index:number;initialDiameter:number;bindings:Bindings;raw:Basis;fixed:Basis;entry:{tick:number;boosts:Elements;rewardIds:number[]}};
// Skill-learning cards are a future extension; no skill cards are generated yet.
export type PlantCard={kind:'plant';id:number;seed:Seed};
export type HandCard=PlantCard;
export const ones=():Elements=>({fire:1,ice:1,electric:1,dark:1});
export const zeros=():Elements=>({fire:0,ice:0,electric:0,dark:0});
export const round=(n:number)=>+n.toFixed(6);
export function randomStream(seed:number){let x=seed>>>0;return ()=>{x+=0x6D2B79F5;let t=Math.imul(x^x>>>15,1|x);t^=t+Math.imul(t^t>>>7,61|t);return ((t^t>>>14)>>>0)/4294967296;};}
export function shuffleBindings(random:()=>number):Bindings{const roles:Role[]=[...ROLES];for(let i=3;i>0;i--){const r=random();if(!Number.isFinite(r)||r<0||r>=1)throw new Error('Invalid random input');const j=Math.floor(r*(i+1));[roles[i],roles[j]]=[roles[j],roles[i]];}return Object.fromEntries(ELEMENTS.map((e,i)=>[e,roles[i]])) as Bindings;}
export function validBindings(value:Bindings){return !!value&&Object.keys(value).length===4&&ELEMENTS.every(e=>ROLES.includes(value[e]))&&new Set(ELEMENTS.map(e=>value[e])).size===4;}
export function dominantElement(e:Elements):Element{return [...ELEMENTS].sort((a,b)=>e[b]-e[a])[0];}
export function bodyRadius(diameter:number){if(!Number.isFinite(diameter)||diameter<=0)throw new Error('Invalid diameter');return diameter/2;}
// Provisional interpretation of the user's typo: diameter 1 => 1, 100 => 1.99, 200 => 2.99.
export function elementScale(diameter:number){bodyRadius(diameter);return 1+(diameter-1)/100;}
export function healthScale(diameter:number){bodyRadius(diameter);return 1+(diameter-1)/80;}
export function generateSeed(runSeed:number,source:Seed['source'],index:number,entryTick=0,boosts=ones(),rewardIds:number[]=[]):Seed{
 if(!Number.isSafeInteger(runSeed)||runSeed<0||runSeed>4294967295||!Number.isSafeInteger(index)||index<0||index>1000000)throw new Error('Invalid seed identity');
 const salt={enemy:0x454E454D,initial:0x414C4C59,hand:0x48414E44}[source],r=randomStream((runSeed^salt^Math.imul(index+1,0x85EBCA6B))>>>0),weights=ELEMENTS.map(()=>.25+r()),sum=weights.reduce((a,b)=>a+b,0);
 const elements=Object.fromEntries(ELEMENTS.map((e,i)=>[e,round(8+weights[i]/sum*64)])) as Elements,bindings=shuffleBindings(r),raw:Basis={hp:round(95+r()*45),hpReg:round(.06+r()*.10),presenceHalo:round(2.5+r()*1.5),elements};
 const fixed:Basis={...raw,elements:Object.fromEntries(ELEMENTS.map(e=>[e,round(elements[e]*boosts[e])])) as Elements};
 return {generator:'eco-seed-1',runSeed,source,index,initialDiameter:source==='enemy'?12+Math.floor(r()*3)*4:8,bindings,raw,fixed,entry:{tick:entryTick,boosts:{...boosts},rewardIds:[...rewardIds]}};
}
export function rolesFrom(elements:Elements,bindings:Bindings):Record<Role,number>{if(!validBindings(bindings))throw new Error('Non-bijective bindings');return Object.fromEntries(ELEMENTS.map(e=>[bindings[e],elements[e]])) as Record<Role,number>;}
