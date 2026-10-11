import {viewport,clientToWorld,validatePlacement,type State} from './sim.js';
import {DEFAULT_STAGE,stageConfig,referenceStage,type StageConfig} from './stage.js';
export type View={x:number;y:number;zoom:number};
export const MAX_ZOOM=3;
export class BoardCamera {
 view:View;readonly stage:StageConfig;readonly maxZoom:number;
 constructor(view?:View,configuration:StageConfig=DEFAULT_STAGE){this.stage=stageConfig(configuration);this.maxZoom=MAX_ZOOM*Math.max(1,this.stage.width/12,this.stage.height/9);this.view={x:this.stage.width/2,y:this.stage.height/2,zoom:1};if(view)this.set(view);}
 set(v:View){const {width,height}=this.stage,zoom=Math.max(1,Math.min(this.maxZoom,Number.isFinite(v.zoom)?v.zoom:1)),hx=width/(2*zoom),hy=height/(2*zoom);this.view={zoom,x:Math.max(hx,Math.min(width-hx,Number.isFinite(v.x)?v.x:width/2)),y:Math.max(hy,Math.min(height-hy,Number.isFinite(v.y)?v.y:height/2))};}
 layout(width:number,height:number){const base=viewport(width,height,this.stage),scale=base.scale*this.view.zoom;return {scale,ox:base.ox+this.stage.width*base.scale/2-this.view.x*scale,oy:base.oy+this.stage.height*base.scale/2-this.view.y*scale};}
 point(clientX:number,clientY:number,rect:{left:number;top:number;width:number;height:number}){const base=clientToWorld(clientX,clientY,rect,this.stage);return {x:this.view.x+(base.x-this.stage.width/2)/this.view.zoom,y:this.view.y+(base.y-this.stage.height/2)/this.view.zoom};}
 focusIfOutside(p:{x:number;y:number},width:number,height:number,radius=0){
  if(!Number.isFinite(p.x)||!Number.isFinite(p.y)||p.x<0||p.x>this.stage.width||p.y<0||p.y>this.stage.height)return false;
  const b=this.bounds(width,height);if(p.x-radius>=b.x&&p.x+radius<=b.x+b.width&&p.y-radius>=b.y&&p.y+radius<=b.y+b.height)return false;
  const before={...this.view};this.set({...this.view,x:p.x,y:p.y});return this.view.x!==before.x||this.view.y!==before.y;
 }
 pan(dx:number,dy:number,baseScale:number){this.set({...this.view,x:this.view.x-dx/(baseScale*this.view.zoom),y:this.view.y-dy/(baseScale*this.view.zoom)});}
 zoomAt(factor:number,anchor:{x:number;y:number}){const old=this.view,zoom=Math.max(1,Math.min(this.maxZoom,old.zoom*factor));this.set({zoom,x:anchor.x-(anchor.x-old.x)*old.zoom/zoom,y:anchor.y-(anchor.y-old.y)*old.zoom/zoom});}
 bounds(width:number,height:number){const l=this.layout(width,height),x=Math.max(0,-l.ox/l.scale),y=Math.max(0,-l.oy/l.scale),right=Math.min(this.stage.width,(width-l.ox)/l.scale),bottom=Math.min(this.stage.height,(height-l.oy)/l.scale);return {x,y,width:right-x,height:bottom-y};}
}
export function introView(s:State):View {
 const candidates:{x:number;y:number}[]=[],{width,height}=s.stage,nx=referenceStage(s.stage)?Math.ceil((width-.6)/.8):32,ny=referenceStage(s.stage)?Math.ceil((height-.6)/.8):24;
 for(let yi=0;yi<ny;yi++)for(let xi=0;xi<nx;xi++){const x=referenceStage(s.stage)?.6+xi*.8:(xi+.5)*width/nx,y=referenceStage(s.stage)?.6+yi*.8:(yi+.5)*height/ny;if(validatePlacement(s,x,y).ok)candidates.push({x,y});}
 const index=(Math.imul(s.seed^0x56494557,1664525)>>>0)%Math.max(1,candidates.length),p=candidates[index]??{x:.3,y:.3};
 return new BoardCamera({x:p.x,y:p.y,zoom:1.8*Math.max(1,width/12,height/9)},s.stage).view;
}
