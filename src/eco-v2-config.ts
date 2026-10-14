// New reference model only. Historical generators and save coefficients stay unchanged.
export const REFERENCE_MODEL='reference-stats-1' as const;
export const StatConfig=Object.freeze({bodyRadius:100,auraReach:200,rootReach:200,maxHp:100,hpReg:.1,waterCapacity:100,resist:1});
const commonSkill=Object.freeze({BaseDamage:100,BaseRange:400,BaseSpeed:1,BaseWaterCost:10,healFactor:.5});
export const SkillConfig=Object.freeze({fire:commonSkill,ice:commonSkill,electric:commonSkill,dark:commonSkill});
// Provisional spawn limits: correction values except MaxHP, which is an absolute HP amount.
export const PlantSpawnConfig=Object.freeze({player:Object.freeze({CreateSize:100,MaxHP:200,Reg:200,Aura:200,Root:200,Resist:200,Power:200,Tech:200,Range:200,Speed:200}),enemy:Object.freeze({statMean:100,maxHpMean:100,sizeBudgetPerEnemy:10})});
const rootGains=Object.freeze([1,.001,.05,2.5,...Array.from({length:4},()=>[.2,.1,.002,.001]).flat()]);
export const GameConfig=Object.freeze({model:REFERENCE_MODEL,distanceUnit:'u',timeUnit:'sec',StatConfig,SkillConfig,PlantSpawnConfig,tickSeconds:.1,sizeDiameterPerGrowthWater:.25,rootGains,defaultDiskRadius:2400,maxDiskRadius:8000,Generation:Object.freeze({statModel:REFERENCE_MODEL,healChance:.1,enemyCount:100,initialGap:40,sizeModel:'percent-1',initialBalance:'range-presence-2',defenseAllocation:'all-elements-1',targetPolicy:'aura-any-distance-1',soilLayout:'finite-scattered-2'} as const),RootConfig:Object.freeze({capacity:StatConfig.waterCapacity,radiusPerPoint:1,referenceRadius:100,referenceUptake:4,areaExponent:.65,soilFluxPerArea:4/(Math.PI*100**2),soilCapacityPerArea:.04,consumePerSecond:2,sizePerWater:.25,corpsePerWater:.25,gains:rootGains})});
