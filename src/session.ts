import {DEFAULT_STAGE,INITIAL_CARDS,stageConfig,referenceStage,type StageConfig} from './stage.js';
import {createState,supplyStats,applyMultipliers,multipliersFor,RULES,type State,type Stats,type FrozenSeed} from './sim.js';
import {BoardCamera,type View} from './camera.js';
export const SAVE_KEY='morishi.run.v1', BACKUP_KEY='morishi.run.previous.v1';
const VERSION='2026-10-11-snapshot-8',HAND='2026-10-11-snapshot-7',INDEXED='2026-10-11-snapshot-6',STAGED='2026-10-11-snapshot-5',PREVIOUS='2026-10-11-snapshot-4',CAMERALESS='2026-10-11-snapshot-3';
// Decoder safety budgets are separate from finite or indexed game supply.
export const SAVE_LIMITS={maxBytes:2000000,maxUnits:2048,maxActions:1024} as const;
const withinLimit=(raw:string)=>raw.length<=SAVE_LIMITS.maxBytes&&new TextEncoder().encode(raw).length<=SAVE_LIMITS.maxBytes;
export type Action={tick:number;kind:'place';x:number;y:number;seedIndex?:number}|{tick:number;kind:'finish'};
export type RunSave={version:typeof VERSION|typeof HAND|typeof INDEXED;rules:typeof RULES;seed:number;tick:number;speed:number;actions:Action[];snapshot:State;view:View;checksum:string};
export interface StorageLike {getItem(key:string):string|null;setItem(key:string,value:string):void;}
// Corruption detection is paired with structural validation, not used as authentication.
function checksum(value:unknown){const raw=JSON.stringify(value);let hash=2166136261;for(let i=0;i<raw.length;i++)hash=Math.imul(hash^raw.charCodeAt(i),16777619);return (hash>>>0).toString(16);}
export function capture(state:State,speed:number,actions:Action[],view:View={x:state.stage.width/2,y:state.stage.height/2,zoom:1}):RunSave {
  const payload:Omit<RunSave,'checksum'>={version:state.player?VERSION:state.opening?HAND:INDEXED,rules:RULES,seed:state.seed,tick:state.tick,speed,actions:structuredClone(state.supplyMode==='endless'?actions.slice(-64):actions),snapshot:structuredClone(state),view:{...view}};
  return {...payload,checksum:checksum(payload)};
}
const integer=(v:unknown,min:number,max=Number.MAX_SAFE_INTEGER):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=min&&v<=max;
const finite=(v:unknown,min:number,max:number):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
function stats(v:Stats,boosted=false){const max=boosted?1.24:1;return v&&finite(v.power,10,45*max)&&finite(v.range,2.1,6.1*max)&&finite(v.presence,.5,3.5*max)&&integer(v.vitality,70,Math.round(220*max));}
function actionsValid(v:Action[],tick:number,stage:StageConfig,mode:State['supplyMode']){
  if(!Array.isArray(v)||v.length>SAVE_LIMITS.maxActions)return false;let previous=0,ended=false,count=0;
  for(const a of v){
    if(!a||!integer(a.tick,previous,tick)||ended)return false;previous=a.tick;
    if(a.kind==='place'){if(++count>(mode==='finite'?INITIAL_CARDS:SAVE_LIMITS.maxActions)||!finite(a.x,.3-1e-9,stage.width-.3+1e-9)||!finite(a.y,.3-1e-9,stage.height-.3+1e-9)||(a.seedIndex!==undefined&&!integer(a.seedIndex,0)))return false;}
    else if(a.kind==='finish'&&(count>0||mode==='endless'))ended=true;else return false;
  }
  return true;
}
function validatedSnapshot(s:State,seed:number,tick:number,actions:Action[],stage:StageConfig,mode:State['supplyMode']):State {
  if(!s||s.seed!==seed||s.tick!==tick||!integer(s.nextId,stage.enemyCount+1,mode==='finite'?stage.enemyCount+1+INITIAL_CARDS:Number.MAX_SAFE_INTEGER)||!integer(s.charges,0,5)||!['playing','win','loss'].includes(s.outcome)||typeof s.started!=='boolean'||!Array.isArray(s.units)||s.units.length>SAVE_LIMITS.maxUnits||!Array.isArray(s.cards)||s.cards.length>INITIAL_CARDS||!Array.isArray(s.territory)||s.territory.length>SAVE_LIMITS.maxUnits||!Array.isArray(s.events)||s.events.length>5||s.events.some(e=>typeof e!=='string'||e.length>300))throw new Error('Invalid snapshot');
  if(s.opening!==undefined&&s.opening!=='clustered-v1'||!s.opening&&(s.hand!==undefined||s.nextSeedIndex!==undefined))throw new Error('Invalid opening');
  const experimental=s.opening==='clustered-v1',initial=createState(seed,stage,mode,experimental?'clustered-v1':'legacy',!!s.player),placements=actions.filter((a):a is Extract<Action,{kind:'place'}>=>a.kind==='place');
  const supplyIndex=s.nextId-initial.nextId,handIds=new Set<number>();
  if(s.player){
    if(!experimental||s.player.policy!=='hand-entry-v1'||!Array.isArray(s.player.rewards)||s.player.rewards.length>stage.enemyCount)throw new Error('Invalid player progress');
    const seen=new Set<number>();let priorTick=0,priorId=0;
    for(const r of s.player.rewards){if(!r||!integer(r.enemyId,1,stage.enemyCount)||seen.has(r.enemyId)||!integer(r.tick,1,tick)||r.tick<priorTick||r.tick===priorTick&&r.enemyId<=priorId||s.units.some(u=>u.id===r.enemyId))throw new Error('Invalid defeat history');seen.add(r.enemyId);priorTick=r.tick;priorId=r.enemyId;}
    if(initial.units.filter(u=>u.team==='enemy'&&!s.units.some(v=>v.id===u.id)).some(u=>!seen.has(u.id))||JSON.stringify(s.player.multipliers)!==JSON.stringify(multipliersFor(initial.units,s.player.rewards.map(r=>r.enemyId))))throw new Error('Invalid earned multipliers');
  }
  const frozenStats=(id:number,base:Stats,f:FrozenSeed|undefined,maxEntry=tick)=>{
    const raw=supplyStats(seed,stage,id);
    if(!s.player){if(f!==undefined||JSON.stringify(base)!==JSON.stringify(raw))throw new Error('Invalid legacy seed');return raw;}
    if(!f||f.generator!=='composition-v1'||JSON.stringify(f.rawStats)!==JSON.stringify(raw)||!integer(f.enteredAtTick,0,maxEntry)||!Array.isArray(f.rewardEnemyIds)||new Set(f.rewardEnemyIds).size!==f.rewardEnemyIds.length)throw new Error('Invalid frozen seed');
    const eligible=s.player.rewards.filter(r=>r.tick<=f.enteredAtTick).map(r=>r.enemyId);
    if(JSON.stringify(f.rewardEnemyIds)!==JSON.stringify(eligible)||(id<4&&(f.enteredAtTick!==0||f.rewardEnemyIds.length!==0)))throw new Error('Invalid entry rewards');
    const boost=multipliersFor(initial.units,f.rewardEnemyIds),fixed=applyMultipliers(raw,boost);
    if(JSON.stringify(f.appliedMultipliers)!==JSON.stringify(boost)||JSON.stringify(base)!==JSON.stringify(fixed))throw new Error('Invalid fixed seed stats');return fixed;
  };

  if(mode==='finite'){
    if(s.supplyIndex!==undefined&&s.supplyIndex!==supplyIndex)throw new Error('Invalid finite supply cursor');
    if(s.nextId!==stage.enemyCount+1+placements.length||s.cards.length!==INITIAL_CARDS-placements.length||s.started!==(placements.length>0)||(!s.started&&tick!==0)||JSON.stringify(s.cards)!==JSON.stringify(initial.cards.slice(placements.length)))throw new Error('Invalid inventory');
  }else if(!integer(s.supplyIndex,0)||s.supplyIndex!==supplyIndex||s.cards.length!==4||s.started!==(supplyIndex>0||initial.started)||(!s.started&&tick!==0)||(!experimental&&JSON.stringify(s.cards)!==JSON.stringify(Array.from({length:4},(_,i)=>supplyStats(seed,stage,supplyIndex+i)))))throw new Error('Invalid indexed inventory');
  if(experimental){
    if(!integer(s.nextSeedIndex,4)||s.nextSeedIndex!==supplyIndex+4||!Array.isArray(s.hand)||s.hand.length!==4)throw new Error('Invalid hand');
    for(const card of s.hand){if(!integer(card.id,0,s.nextSeedIndex-1)||handIds.has(card.id)||!stats(card.baseStats,!!s.player))throw new Error('Invalid seed identity');frozenStats(card.id,card.baseStats,card.snapshot);handIds.add(card.id);}
    if(JSON.stringify(s.cards)!==JSON.stringify(s.hand.map(c=>c.baseStats)))throw new Error('Invalid hand stats');
  }
  const origin=new Map(initial.units.map(u=>[u.id,{x:u.x,y:u.y,stats:u.stats,born:0,team:u.team,initial:u.initial===true}]));
  const usedSeeds=new Set<number>();
  if(mode==='finite')placements.forEach((a,i)=>origin.set(stage.enemyCount+1+i,{x:a.x,y:a.y,stats:initial.cards[i],born:a.tick,team:'ally',initial:false}));
  else for(const u of s.units.filter(u=>u.team==='ally')){
    if(experimental&&u.initial===true){if(!origin.get(u.id)?.initial||u.born!==0||u.supplyIndex!==undefined||u.seedIndex!==undefined||u.seedSnapshot!==undefined)throw new Error('Invalid initial ally');continue;}
    if(u.initial!==undefined||!integer(u.supplyIndex,0,supplyIndex-1)||u.id!==initial.nextId+u.supplyIndex||!integer(u.born,0,tick)||!finite(u.x,.3-1e-9,stage.width-.3+1e-9)||!finite(u.y,.3-1e-9,stage.height-.3+1e-9))throw new Error('Invalid indexed origin');
    const sourceIndex=experimental?u.seedIndex:u.supplyIndex;
    if(!integer(sourceIndex,0)||(experimental&&(!integer(sourceIndex,0,s.nextSeedIndex!-1)||handIds.has(sourceIndex)||usedSeeds.has(sourceIndex))))throw new Error('Invalid used seed');usedSeeds.add(sourceIndex);
    origin.set(u.id,{x:u.x,y:u.y,stats:experimental?frozenStats(sourceIndex,u.stats,u.seedSnapshot,u.born):supplyStats(seed,stage,sourceIndex),born:u.born,team:'ally',initial:false});
  }
  const ids=new Set<number>();
  for(const u of s.units){
    const source=origin.get(u.id);
    if(u.seedSnapshot!==undefined&&(!s.player||u.team!=='ally'||u.initial))throw new Error('Invalid seed snapshot owner');
    if(!source||ids.has(u.id)||(u.initial===true)!==source.initial||u.team!==source.team||u.x!==source.x||u.y!==source.y||!stats(u.stats,!!s.player&&u.team==='ally'&&!u.initial)||JSON.stringify(u.stats)!==JSON.stringify(source.stats)||u.maxHp!==u.stats.vitality||!finite(u.hp,Number.MIN_VALUE,u.maxHp)||!integer(u.age,0,tick)||u.age!==tick-source.born||!integer(u.cooldown,0,10)||(u.target!==null&&!integer(u.target,1,s.nextId-1)))throw new Error('Invalid unit');
    ids.add(u.id);const shot=u.lastShot;
    if(shot&&(!integer(shot.tick,source.born,tick)||!integer(shot.targetId,1,s.nextId-1)||!finite(shot.x,0,stage.width)||!finite(shot.y,0,stage.height)||!finite(shot.damage,0,s.player?80:60)))throw new Error('Invalid shot');
  }
  const territoryIds=new Set<number>();
  for(const t of s.territory){const source=origin.get(t.id);if(!source||territoryIds.has(t.id)||t.x!==source.x||t.y!==source.y||!finite(t.radius,1.6,3))throw new Error('Invalid territory');territoryIds.add(t.id);}
  const enemies=s.units.filter(u=>u.team==='enemy').length;
  if((s.outcome==='win'&&enemies!==0)||(s.outcome==='playing'&&enemies===0)||(actions.at(-1)?.kind==='finish'&&s.outcome!=='loss'))throw new Error('Invalid outcome');
  return {stage:{...stage},supplyMode:mode,supplyIndex,seed,tick,nextId:s.nextId,charges:s.charges,outcome:s.outcome,started:s.started,cards:s.cards.map(v=>({...v})),events:[...s.events],territory:s.territory.map(t=>({id:t.id,x:t.x,y:t.y,radius:t.radius})),units:s.units.map(u=>({id:u.id,team:u.team,x:u.x,y:u.y,hp:u.hp,maxHp:u.maxHp,age:u.age,cooldown:u.cooldown,stats:{...u.stats},target:u.target,...(mode==='endless'&&u.team==='ally'?(u.initial?{born:0,initial:true as const}:{born:u.born,supplyIndex:u.supplyIndex,...(experimental?{seedIndex:u.seedIndex,...(u.seedSnapshot?{seedSnapshot:structuredClone(u.seedSnapshot)}:{})}:{})}):{}),...(u.lastShot?{lastShot:{...u.lastShot}}:{})})),...(experimental?{opening:'clustered-v1' as const,hand:s.hand!.map(c=>({id:c.id,baseStats:{...c.baseStats},...(c.snapshot?{snapshot:structuredClone(c.snapshot)}:{})})),nextSeedIndex:s.nextSeedIndex,...(s.player?{player:structuredClone(s.player)}:{})}:{})};
}
export function replay(input:unknown):{state:State;save:RunSave} {
 const v=input as Omit<RunSave,'version'>&{version:string};
 if(!v||!integer(v.seed,0,4294967295)||!integer(v.tick,0)||![1,2,4].includes(v.speed))throw new Error('Invalid save');
 if(![VERSION,HAND,INDEXED,STAGED,PREVIOUS,CAMERALESS].includes(v.version)||v.rules!==RULES)throw new Error('Unsupported save');
 const payload={version:v.version,rules:v.rules,seed:v.seed,tick:v.tick,speed:v.speed,actions:v.actions,snapshot:v.snapshot,...(v.version!==CAMERALESS?{view:v.view}:{})};
 if(v.checksum!==checksum(payload))throw new Error('Corrupt save');
 const stage=stageConfig([VERSION,HAND,INDEXED,STAGED].includes(v.version)?v.snapshot?.stage:DEFAULT_STAGE);
 if([VERSION,HAND,INDEXED,STAGED].includes(v.version)&&!v.snapshot?.stage)throw new Error('Missing stage');
 if(![VERSION,HAND,INDEXED,STAGED].includes(v.version)&&v.snapshot?.stage&&!referenceStage(stageConfig(v.snapshot.stage)))throw new Error('Invalid legacy stage');
 if(![VERSION,HAND].includes(v.version)&&(v.snapshot?.opening!==undefined||v.snapshot?.hand!==undefined||v.snapshot?.nextSeedIndex!==undefined))throw new Error('Invalid legacy opening');
 if(v.version===VERSION&&!v.snapshot?.player||v.version!==VERSION&&(v.snapshot?.player!==undefined||v.snapshot?.hand?.some(c=>c.snapshot!==undefined)||v.snapshot?.units?.some(u=>u.seedSnapshot!==undefined)))throw new Error('Invalid reward version');
 const indexed=[VERSION,HAND,INDEXED].includes(v.version),mode=indexed?v.snapshot?.supplyMode:'finite';
 if(!['finite','endless'].includes(mode))throw new Error('Invalid supply mode');
 if(indexed&&!integer(v.snapshot.supplyIndex,0))throw new Error('Missing supply cursor');
 if(!indexed&&v.snapshot?.supplyMode==='endless')throw new Error('Invalid legacy supply');
 if(!actionsValid(v.actions,v.tick,stage,mode))throw new Error('Invalid actions');
 const state=validatedSnapshot(v.snapshot,v.seed,v.tick,v.actions,stage,mode),view=v.version!==CAMERALESS?v.view:{x:6,y:4.5,zoom:1};
 const camera=new BoardCamera(undefined,stage);
 if(!view||!finite(view.x,0,stage.width)||!finite(view.y,0,stage.height)||!finite(view.zoom,1,camera.maxZoom))throw new Error('Invalid view');
 camera.set(view);if(Math.abs(camera.view.x-view.x)>1e-9||Math.abs(camera.view.y-view.y)>1e-9)throw new Error('Out of bounds view');
 return {state,save:capture(state,v.speed,v.actions,view)};
}
export type LoadResult={kind:'empty'}|{kind:'loaded';state:State;save:RunSave}|{kind:'unavailable'}|{kind:'invalid'};
export class RunStore {
  protectedSave=false;
  constructor(private storage:StorageLike){}
  read():LoadResult {
    let raw:string|null;try{raw=this.storage.getItem(SAVE_KEY);}catch{this.protectedSave=true;return {kind:'unavailable'};}
    if(raw===null)return {kind:'empty'};
    try{if(!withinLimit(raw))throw new Error('Oversized save');const data=JSON.parse(raw),result=replay(data);return {kind:'loaded',...result};}
    catch{this.protectedSave=true;return {kind:'invalid'};}
  }
  write(save:RunSave,replace=false):boolean {
    if(this.protectedSave&&!replace)return false;
    try{
      if(save.snapshot.units.length>SAVE_LIMITS.maxUnits||save.snapshot.territory.length>SAVE_LIMITS.maxUnits||save.actions.length>SAVE_LIMITS.maxActions)return false;
      const raw=JSON.stringify(save);if(!withinLimit(raw)||!integer(save.tick,0))return false;
      const previous=replace?this.storage.getItem(SAVE_KEY):null;
      if(previous!==null)this.storage.setItem(BACKUP_KEY,previous);
      this.storage.setItem(SAVE_KEY,raw);this.protectedSave=false;return true;
    }catch{return false;}
  }
}
