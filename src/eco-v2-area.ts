import {v2PlacementDisks,V2_COORD_LIMIT,type FieldFact} from './eco-v2-view.js';
import type {View} from './eco-save.js';
// Every subpath has the same winding, so nonzero fill removes the union, including overlaps.
function clippedLargeCircle(c:CanvasRenderingContext2D,x:number,y:number,r:number,width:number,height:number){
 const start=Math.max(0,y-r),end=Math.min(height,y+r),left:{x:number;y:number}[]=[],right:{x:number;y:number}[]=[];
 // A quarter screen pixel bounds the vertical contour error even near a tangent.
 for(let i=0;i<=Math.ceil((end-start)*4);i++){const row=Math.min(end,start+i/4),dy=Math.abs(row-y);if(dy>r)continue;const half=Math.sqrt(Math.max(0,(r-dy)*(r+dy))),a=Math.max(0,x-half),b=Math.min(width,x+half);if(a>=b)continue;left.push({x:a,y:row});right.push({x:b,y:row});}
 if(!left.length)return;c.moveTo(left[0].x,left[0].y);for(const p of right)c.lineTo(p.x,p.y);for(let i=left.length-1;i>=0;i--)c.lineTo(left[i].x,left[i].y);c.closePath();
}
export function paintV2PlacementArea(c:CanvasRenderingContext2D,facts:FieldFact[],diameter:number,view:View,scale:number){
 const width=c.canvas.width,height=c.canvas.height;if(!Number.isFinite(scale)||scale<=0)return;
 const left=Math.max(0,width/2+(-V2_COORD_LIMIT-view.x)*scale),right=Math.min(width,width/2+(V2_COORD_LIMIT-view.x)*scale),top=Math.max(0,height/2+(-V2_COORD_LIMIT-view.y)*scale),bottom=Math.min(height,height/2+(V2_COORD_LIMIT-view.y)*scale);if(left>=right||top>=bottom)return;
 c.save();c.fillStyle='#54b37b35';c.fillRect(left,top,right-left,bottom-top);c.globalCompositeOperation='destination-out';c.fillStyle='#000';c.beginPath();let covered=false;
 covered=appendCircleUnion(c,v2PlacementDisks(facts,diameter),view,scale);if(covered)c.clearRect(0,0,width,height);
 if(!covered)c.fill('nonzero');c.restore();
}
function appendCircleUnion(c:CanvasRenderingContext2D,disks:{x:number;y:number;radius:number}[],view:View,scale:number){const width=c.canvas.width,height=c.canvas.height;
 for(const disk of disks){const x=width/2+(disk.x-view.x)*scale,y=height/2+(disk.y-view.y)*scale,r=disk.radius*scale;if(r>=Math.max(Math.hypot(x,y),Math.hypot(x-width,y),Math.hypot(x,y-height),Math.hypot(x-width,y-height))){return true;}if(r<=0||x+r<0||y+r<0||x-r>width||y-r>height)continue;
  // Keep native Canvas arcs in its accurate local coordinate range. Giant partial arcs use a clipped contour.
  if(Math.max(Math.abs(x),Math.abs(y),r)<=1e6){c.moveTo(x+r,y);c.arc(x,y,r,0,Math.PI*2);}else clippedLargeCircle(c,x,y,r,width,height);
 }
 return false;}
export function clipV2CircleUnion(c:CanvasRenderingContext2D,disks:{x:number;y:number;radius:number}[],view:View,scale:number){c.beginPath();if(appendCircleUnion(c,disks,view,scale)){c.beginPath();c.rect(0,0,c.canvas.width,c.canvas.height);}c.clip('nonzero');}
