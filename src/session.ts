import {createState,WIDTH,HEIGHT,RULES,type State,type Stats} from './sim.js';
export const SAVE_KEY='morishi.run.v1', BACKUP_KEY='morishi.run.previous.v1';
const VERSION='2026-10-11-snapshot-3';
const withinLimit=(raw:string)=>raw.length<=64000&&new TextEncoder().encode(raw).length<=64000;
export type Action={tick:number;kind:'place';x:number;y:number}|{tick:number;kind:'finish'};
export type RunSave={version:typeof VERSION;rules:typeof RULES;seed:number;tick:number;speed:number;actions:Action[];snapshot:State;checksum:string};
export interface StorageLike {getItem(key:string):string|null;setItem(key:string,value:string):void;}
// Corruption detection is paired with structural validation, not used as authentication.
function checksum(value:unknown){const raw=JSON.stringify(value);let hash=2166136261;for(let i=0;i<raw.length;i++)hash=Math.imul(hash^raw.charCodeAt(i),16777619);return (hash>>>0).toString(16);}
export function capture(state:State,speed:number,actions:Action[]):RunSave {
  const payload:Omit<RunSave,'checksum'>={version:VERSION,rules:RULES,seed:state.seed,tick:state.tick,speed,actions:structuredClone(actions),snapshot:structuredClone(state)};
  return {...payload,checksum:checksum(payload)};
}
const integer=(v:unknown,min:number,max=Number.MAX_SAFE_INTEGER):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=min&&v<=max;
const finite=(v:unknown,min:number,max:number):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
function stats(v:Stats){return v&&finite(v.power,10,45)&&finite(v.range,2.1,6.1)&&finite(v.presence,.5,3.5)&&integer(v.vitality,70,220);}
function actionsValid(v:Action[],tick:number){
  if(!Array.isArray(v)||v.length>19)return false;let previous=0,ended=false,count=0;
  for(const a of v){
    if(!a||!integer(a.tick,previous,tick)||ended)return false;previous=a.tick;
    if(a.kind==='place'){if(++count>18||!finite(a.x,.3-1e-9,WIDTH-.3+1e-9)||!finite(a.y,.3-1e-9,HEIGHT-.3+1e-9))return false;}
    else if(a.kind==='finish'&&count>0)ended=true;else return false;
  }
  return true;
}
function validatedSnapshot(s:State,seed:number,tick:number,actions:Action[]):State {
  if(!s||s.seed!==seed||s.tick!==tick||!integer(s.nextId,8,26)||!integer(s.charges,0,5)||!['playing','win','loss'].includes(s.outcome)||typeof s.started!=='boolean'||!Array.isArray(s.units)||s.units.length>25||!Array.isArray(s.cards)||s.cards.length>18||!Array.isArray(s.territory)||s.territory.length>25||!Array.isArray(s.events)||s.events.length>5||s.events.some(e=>typeof e!=='string'||e.length>300))throw new Error('Invalid snapshot');
  const initial=createState(seed),placements=actions.filter((a):a is Extract<Action,{kind:'place'}>=>a.kind==='place');
  if(s.nextId!==8+placements.length||s.cards.length!==18-placements.length||s.started!==(placements.length>0)||(!s.started&&tick!==0)||JSON.stringify(s.cards)!==JSON.stringify(initial.cards.slice(placements.length)))throw new Error('Invalid inventory');
  const origin=new Map(initial.units.map(u=>[u.id,{x:u.x,y:u.y,stats:u.stats,born:0,team:u.team}]));
  placements.forEach((a,i)=>origin.set(8+i,{x:a.x,y:a.y,stats:initial.cards[i],born:a.tick,team:'ally'}));
  const ids=new Set<number>();
  for(const u of s.units){
    const source=origin.get(u.id);
    if(!source||ids.has(u.id)||u.team!==source.team||u.x!==source.x||u.y!==source.y||!stats(u.stats)||JSON.stringify(u.stats)!==JSON.stringify(source.stats)||u.maxHp!==u.stats.vitality||!finite(u.hp,Number.MIN_VALUE,u.maxHp)||!integer(u.age,0,tick)||u.age!==tick-source.born||!integer(u.cooldown,0,10)||(u.target!==null&&!integer(u.target,1,s.nextId-1)))throw new Error('Invalid unit');
    ids.add(u.id);const shot=u.lastShot;
    if(shot&&(!integer(shot.tick,source.born,tick)||!integer(shot.targetId,1,s.nextId-1)||!finite(shot.x,0,WIDTH)||!finite(shot.y,0,HEIGHT)||!finite(shot.damage,0,60)))throw new Error('Invalid shot');
  }
  const territoryIds=new Set<number>();
  for(const t of s.territory){const source=origin.get(t.id);if(!source||territoryIds.has(t.id)||t.x!==source.x||t.y!==source.y||!finite(t.radius,1.6,3))throw new Error('Invalid territory');territoryIds.add(t.id);}
  const enemies=s.units.filter(u=>u.team==='enemy').length;
  if((s.outcome==='win'&&enemies!==0)||(s.outcome==='playing'&&enemies===0)||(actions.at(-1)?.kind==='finish'&&s.outcome!=='loss'))throw new Error('Invalid outcome');
  return {seed,tick,nextId:s.nextId,charges:s.charges,outcome:s.outcome,started:s.started,cards:s.cards.map(v=>({...v})),events:[...s.events],territory:s.territory.map(t=>({id:t.id,x:t.x,y:t.y,radius:t.radius})),units:s.units.map(u=>({id:u.id,team:u.team,x:u.x,y:u.y,hp:u.hp,maxHp:u.maxHp,age:u.age,cooldown:u.cooldown,stats:{...u.stats},target:u.target,...(u.lastShot?{lastShot:{...u.lastShot}}:{})}))};
}
export function replay(input:unknown):{state:State;save:RunSave} {
  const v=input as RunSave;
  if(!v||!integer(v.seed,0,4294967295)||!integer(v.tick,0)||![1,2,4].includes(v.speed)||!actionsValid(v.actions,v.tick))throw new Error('Invalid save');
  if(v.version!==VERSION||v.rules!==RULES)throw new Error('Unsupported save');
  const payload={version:v.version,rules:v.rules,seed:v.seed,tick:v.tick,speed:v.speed,actions:v.actions,snapshot:v.snapshot};
  if(v.checksum!==checksum(payload))throw new Error('Corrupt save');
  const state=validatedSnapshot(v.snapshot,v.seed,v.tick,v.actions);
  return {state,save:capture(state,v.speed,v.actions)};
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
      const raw=JSON.stringify(save);if(!withinLimit(raw)||!integer(save.tick,0))return false;
      const previous=replace?this.storage.getItem(SAVE_KEY):null;
      if(previous!==null)this.storage.setItem(BACKUP_KEY,previous);
      this.storage.setItem(SAVE_KEY,raw);this.protectedSave=false;return true;
    }catch{return false;}
  }
}
