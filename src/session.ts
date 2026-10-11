import {createState,place,step,finishRun,type State} from './sim.js';

export const SAVE_KEY='morishi.run.v1', BACKUP_KEY='morishi.run.previous.v1';
const VERSION='2026-10-11-runtime-1', MAX_TICK=36000;
export type Action={tick:number;kind:'place';x:number;y:number}|{tick:number;kind:'finish'};
export type RunSave={version:typeof VERSION;seed:number;tick:number;speed:number;actions:Action[]};
export interface StorageLike {getItem(key:string):string|null;setItem(key:string,value:string):void;}
export function capture(state:State,speed:number,actions:Action[]):RunSave {
  return {version:VERSION,seed:state.seed,tick:state.tick,speed,actions:structuredClone(actions)};
}
export function replay(input:unknown):{state:State;save:RunSave} {
  const v=input as RunSave;
  if(!v||v.version!==VERSION||!Number.isInteger(v.seed)||v.seed<0||v.seed>4294967295||!Number.isInteger(v.tick)||v.tick<0||v.tick>MAX_TICK||![1,2,4].includes(v.speed)||!Array.isArray(v.actions)||v.actions.length>19)throw new Error('Unsupported or invalid save');
  const s=createState(v.seed);let previous=0;
  const advance=(tick:number)=>{while(s.tick<tick){const before=s.tick;step(s);if(s.tick===before)throw new Error('Impossible timeline');}};
  const actions:Action[]=[];
  for(const a of v.actions){
    if(!a||!Number.isInteger(a.tick)||a.tick<previous||a.tick>v.tick)throw new Error('Invalid action time');
    advance(a.tick);previous=a.tick;
    if(a.kind==='place'){
      if(!Number.isFinite(a.x)||!Number.isFinite(a.y)||!place(s,a.x,a.y).ok)throw new Error('Invalid placement');
      actions.push({tick:a.tick,kind:'place',x:a.x,y:a.y});
    }else if(a.kind==='finish'&&finishRun(s))actions.push({tick:a.tick,kind:'finish'});
    else throw new Error('Invalid action');
  }
  advance(v.tick);
  return {state:s,save:{version:VERSION,seed:v.seed,tick:v.tick,speed:v.speed,actions}};
}
export type LoadResult={kind:'empty'}|{kind:'loaded';state:State;save:RunSave}|{kind:'unavailable'}|{kind:'invalid'};
export class RunStore {
  protectedSave=false;
  constructor(private storage:StorageLike){}
  read():LoadResult {
    let raw:string|null;
    try{raw=this.storage.getItem(SAVE_KEY);}catch{this.protectedSave=true;return {kind:'unavailable'};}
    if(raw===null)return {kind:'empty'};
    try{if(raw.length>16000)throw new Error('Oversized save');const result=replay(JSON.parse(raw));return {kind:'loaded',...result};}
    catch{this.protectedSave=true;return {kind:'invalid'};}
  }
  write(save:RunSave,replace=false):boolean {
    if(this.protectedSave&&!replace)return false;
    if(save.tick>MAX_TICK)return false;
    try{
      if(replace){const previous=this.storage.getItem(SAVE_KEY);if(previous!==null)this.storage.setItem(BACKUP_KEY,previous);}
      this.storage.setItem(SAVE_KEY,JSON.stringify(save));this.protectedSave=false;return true;
    }catch{return false;}
  }
}
