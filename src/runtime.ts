import type {Clock} from './sim.js';
import {step,REFILL_TICKS,type State} from './sim.js';

/** Bounded per-frame work; caller yields to input/visibility/save between chunks. */
export class EventSkip {
  active=false; ticks=0; reason='';
  start(s:State){this.active=s.started&&s.outcome==='playing';this.ticks=0;this.reason='';}
  cancel(){this.active=false;}
  chunk(s:State,maxTicks=128):string {
    if(!this.active)return this.reason;
    const start=performance.now();
    for(let i=0;i<Math.min(128,maxTicks)&&performance.now()-start<5;i++){
      const ids=s.units.map(u=>u.id).join(','),charges=s.charges,growing=s.units.some(u=>u.age<117);
      step(s);this.ticks++;
      if(s.outcome!=='playing')this.reason='終局';
      else if(s.units.map(u=>u.id).join(',')!==ids)this.reason='撃破・植物の消滅';
      else if(s.charges>charges)this.reason='配置力回復';
      else if(growing&&!s.units.some(u=>u.age<117))this.reason='成長完了';
      else if(this.ticks>=36000)this.reason='1ゲーム時間の上限';
      else if(!growing&&s.charges>=5&&s.tick%REFILL_TICKS===0)this.reason='配置力満タン';
      if(this.reason){this.active=false;break;}
    }
    return this.reason;
  }
}

/** Hidden Pane dimensions must never resize a WebGL framebuffer to zero. */
export function canvasSize(width:number,height:number):{width:number;height:number}|null {
  if(!Number.isFinite(width)||!Number.isFinite(height)||width<1||height<1)return null;
  return {width:Math.floor(width),height:Math.floor(height)};
}

/** Only a short, single primary tap on the same viewport may commit an action. */
export class TapGesture {
  private active=new Set<number>();
  private candidate:{id:number;x:number;y:number;time:number;viewport:string}|null=null;
  tracking(id:number){return this.active.has(id);}
  down(id:number,x:number,y:number,time:number,viewport:string,primary=true,button=0) {
    const occupied=this.active.size>0;this.active.add(id);
    if(occupied||!primary||button!==0||![x,y,time].every(Number.isFinite)){this.candidate=null;return;}
    this.candidate={id,x,y,time,viewport};
  }
  move(id:number,x:number,y:number) {
    const c=this.candidate;
    if(c&&c.id===id&&(!Number.isFinite(x)||!Number.isFinite(y)||Math.hypot(x-c.x,y-c.y)>8))this.candidate=null;
  }
  up(id:number,x:number,y:number,time:number,viewport:string):boolean {
    const c=this.candidate;this.move(id,x,y);const valid=this.candidate===c&&c!==null&&c.id===id&&time>=c.time&&time-c.time<=500&&viewport===c.viewport;
    this.active.delete(id);this.candidate=null;
    return valid&&this.active.size===0;
  }
  cancel(){this.active.clear();this.candidate=null;}
}

/** Background time never becomes catch-up time; returning always needs explicit play. */
export class ForegroundGate {
  private discardNext=false;
  interrupt(clock:Clock){clock.suspend();this.discardNext=true;}
  frame(delta:number):number {
    if(!Number.isFinite(delta)||delta<0)return 0;
    if(this.discardNext){this.discardNext=false;return 0;}
    return Math.min(delta,250);
  }
}
