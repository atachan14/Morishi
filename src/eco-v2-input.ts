export type Point={x:number;y:number};
export type GestureChange={kind:'pan';dx:number;dy:number}|{kind:'pinch';ratio:number;before:Point;after:Point}|null;
export class BoardGesture{
 private points=new Map<number,Point>();private start:Point|null=null;private moved=false;private multi=false;
 down(id:number,p:Point){if(!this.points.size){this.start={...p};this.moved=false;this.multi=false;}this.points.set(id,{...p});if(this.points.size>1){this.multi=true;this.moved=true;}}
 move(id:number,p:Point):GestureChange{const previous=this.points.get(id);if(!previous)return null;const before=[...this.points.values()].slice(0,2);this.points.set(id,{...p});if(this.points.size>=2){this.multi=true;this.moved=true;const after=[...this.points.values()].slice(0,2),distance=Math.hypot(before[0].x-before[1].x,before[0].y-before[1].y),next=Math.hypot(after[0].x-after[1].x,after[0].y-after[1].y);return {kind:'pinch',ratio:distance>1e-6&&next>1e-6?next/distance:1,before:{x:(before[0].x+before[1].x)/2,y:(before[0].y+before[1].y)/2},after:{x:(after[0].x+after[1].x)/2,y:(after[0].y+after[1].y)/2}};}
 if(this.start&&Math.hypot(p.x-this.start.x,p.y-this.start.y)>6)this.moved=true;return this.moved?{kind:'pan',dx:p.x-previous.x,dy:p.y-previous.y}:null;}
 up(id:number,p:Point){if(!this.points.has(id))return false;const tap=this.points.size===1&&!this.multi&&!this.moved&&!!this.start&&Math.hypot(p.x-this.start.x,p.y-this.start.y)<=6;this.points.delete(id);if(!this.points.size){this.start=null;this.moved=false;this.multi=false;}return tap;}
 cancel(id:number){if(!this.points.has(id))return;this.points.delete(id);this.multi=true;this.moved=true;if(!this.points.size)this.start=null;}
 cancelAll(){this.points.clear();this.start=null;this.moved=false;this.multi=false;}
}
