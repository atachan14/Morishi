export type StageConfig={width:number;height:number;enemyCount:number};
export const DEFAULT_STAGE:Readonly<StageConfig>=Object.freeze({width:12,height:9,enemyCount:7});
// Reversible comparison preset; not a final size or difficulty.
export const COMPARISON_STAGE:Readonly<StageConfig>=Object.freeze({width:36,height:27,enemyCount:24});
// Technical generation limits, not a selected difficulty or finished stage size.
export const STAGE_LIMITS={minExtent:6,maxExtent:256,maxEnemies:256} as const;
export const INITIAL_CARDS=18;
export function stageConfig(value:StageConfig=DEFAULT_STAGE):StageConfig {
 if(!value||!Number.isFinite(value.width)||!Number.isFinite(value.height)||value.width<6||value.height<6||value.width>256||value.height>256||!Number.isSafeInteger(value.enemyCount)||value.enemyCount<1||value.enemyCount>256)throw new Error('Invalid stage configuration');
 const {width,height,enemyCount}=value,cols=Math.ceil(Math.sqrt(enemyCount*(width-2.4)/(height-2.4))),rows=Math.ceil(enemyCount/cols);
 if((width-2.4)/cols<1.2||(height-2.4)/rows<1.2)throw new Error('Stage configuration is too dense for bounded generation');
 return {width,height,enemyCount};
}
export function referenceStage(s:StageConfig){return s.width===12&&s.height===9&&s.enemyCount===7;}
