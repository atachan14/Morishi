import type {Clock} from './sim.js';

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
