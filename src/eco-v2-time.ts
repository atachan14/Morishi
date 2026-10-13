import {stepV2,type GameV2,type EffectObserver} from './eco-v2-game.js';
export function formatV2Time(tick:number){const cents=tick*10,h=Math.floor(cents/360000),m=Math.floor(cents/6000)%60,sec=Math.floor(cents/100)%60;return [h,m,sec].map(n=>String(n).padStart(2,'0')).join(':')+'.'+String(cents%100).padStart(2,'0');}
export function advanceV2Session(state:GameV2,ticks:number,observer?:EffectObserver){if(!Number.isInteger(ticks)||ticks<0||ticks>800)throw Error('Invalid session tick budget');let advanced=0;for(let i=0;i<ticks;i++){const hadAllies=state.units.some(u=>u.team==='ally'),before=state.tick,alive=stepV2(state,observer);advanced+=state.tick-before;if(!alive)return {advanced,stop:'outcome' as const};if(hadAllies&&!state.units.some(u=>u.team==='ally'))return {advanced,stop:'no-allies' as const};}return {advanced,stop:null};}

export type V2AdvanceChunkOptions={cancelled?:()=>boolean;yieldControl?:()=>Promise<void>;now?:()=>number;budgetMs?:number;maxTicks?:number;progress?:(advanced:number)=>void};
// Every yield occurs after a complete model tick; cancellation never leaves a half-step.
export async function advanceV2SessionChunked(state:GameV2,ticks:number,options:V2AdvanceChunkOptions={},observer?:EffectObserver){
 if(!Number.isInteger(ticks)||ticks<0||ticks>800)throw Error('Invalid session tick budget');
 const budget=options.budgetMs??12,maximum=options.maxTicks??8,now=options.now??(()=>performance.now()),yieldControl=options.yieldControl??(()=>new Promise<void>(resolve=>setTimeout(resolve,0)));
 if(!Number.isFinite(budget)||budget<=0||budget>50||!Number.isInteger(maximum)||maximum<1||maximum>16)throw Error('Invalid chunk budget');
 let advanced=0;
 while(advanced<ticks){if(options.cancelled?.())return {advanced,stop:'cancelled' as const};const start=now();let count=0;
  do{if(options.cancelled?.())return {advanced,stop:'cancelled' as const};const result=advanceV2Session(state,1,observer);advanced+=result.advanced;count++;if(result.stop){options.progress?.(advanced);return {advanced,stop:result.stop};}}
  while(advanced<ticks&&count<maximum&&now()-start<budget);
  options.progress?.(advanced);if(advanced<ticks)await yieldControl();
 }
 return {advanced,stop:null};
}