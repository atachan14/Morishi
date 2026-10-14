import {referenceMaterial} from './eco-v2-reference.js';
import {correctionFromEffective,correctionMultiplier} from './eco-v2-correction.js';
import {currentV2Stats,type UnitV2} from './eco-v2-foundation.js';
export type ZeroScalar={state:'zero'}|{state:'scaled';correction:number};
export function zeroScalar(effective:number,base:number):ZeroScalar{if(!Number.isFinite(effective)||effective<0||!Number.isFinite(base)||base<=0)throw Error('Invalid zero scalar');return effective===0?{state:'zero'}:{state:'scaled',correction:correctionFromEffective(effective,base)};}
export function zeroScalarEffective(value:ZeroScalar,base:number){if(!Number.isFinite(base)||base<=0)throw Error('Invalid scalar base');if(value.state==='zero')return 0;if(value.state!=='scaled'||!Number.isFinite(value.correction))throw Error('Invalid scalar state');const effective=base*correctionMultiplier(value.correction);if(!Number.isFinite(effective)||effective<=0)throw Error('Unrepresentable scalar');return effective;}
export function zeroLabel(value:ZeroScalar,digits=1){return value.state==='zero'?'実効0':value.correction.toFixed(digits);}
// Absolute simulation values are authoritative. This projection never mutates seed, geometry, or clocks.
export function zeroUnitGeometry(u:UnitV2,rootScale=1){const radius=u.diameter/2,rootRadius=u.reference?referenceMaterial(u.reference,u.diameter).stats[3]:u.rootData?u.rootData.stats[3]*rootScale:undefined,stats=currentV2Stats(u);return {size:zeroScalar(radius,100),aura:u.sizeModel==='percent-1'?{model:'surface' as const,value:zeroScalar(stats.presence,200)}:{model:'legacy-centre' as const,effective:stats.presence},root:rootRadius===undefined?null:rootRadius<radius?{model:'legacy-centre' as const,effective:rootRadius}:{model:'surface' as const,value:zeroScalar(rootRadius-radius,200)}};}
export const SKILL_BASE_COST=1;
export function skillWaterCost(tech=0){const cost=SKILL_BASE_COST/correctionMultiplier(tech);if(!Number.isFinite(cost)||cost<=0)throw Error('Unrepresentable skill cost');return cost;}
