import {WIDTH,HEIGHT,viewport,clientToWorld,validatePlacement,type State} from './sim.js';
export type View={x:number;y:number;zoom:number};
export const MAX_ZOOM=3;
export class BoardCamera {
  view:View={x:WIDTH/2,y:HEIGHT/2,zoom:1};
  constructor(view?:View){if(view)this.set(view);}
  set(v:View){const zoom=Math.max(1,Math.min(MAX_ZOOM,Number.isFinite(v.zoom)?v.zoom:1)),hx=WIDTH/(2*zoom),hy=HEIGHT/(2*zoom);this.view={zoom,x:Math.max(hx,Math.min(WIDTH-hx,Number.isFinite(v.x)?v.x:WIDTH/2)),y:Math.max(hy,Math.min(HEIGHT-hy,Number.isFinite(v.y)?v.y:HEIGHT/2))};}
  layout(width:number,height:number){const base=viewport(width,height),scale=base.scale*this.view.zoom;return {scale,ox:base.ox+WIDTH*base.scale/2-this.view.x*scale,oy:base.oy+HEIGHT*base.scale/2-this.view.y*scale};}
  point(clientX:number,clientY:number,rect:{left:number;top:number;width:number;height:number}){const base=clientToWorld(clientX,clientY,rect);return {x:this.view.x+(base.x-WIDTH/2)/this.view.zoom,y:this.view.y+(base.y-HEIGHT/2)/this.view.zoom};}
  pan(dx:number,dy:number,baseScale:number){this.set({...this.view,x:this.view.x-dx/(baseScale*this.view.zoom),y:this.view.y-dy/(baseScale*this.view.zoom)});}
  zoomAt(factor:number,anchor:{x:number;y:number}){const old=this.view,zoom=Math.max(1,Math.min(MAX_ZOOM,old.zoom*factor));this.set({zoom,x:anchor.x-(anchor.x-old.x)*old.zoom/zoom,y:anchor.y-(anchor.y-old.y)*old.zoom/zoom});}
}
export function introView(s:State):View {
  const candidates:{x:number;y:number}[]=[];
  for(let y=.6;y<HEIGHT;y+=.8)for(let x=.6;x<WIDTH;x+=.8)if(validatePlacement(s,x,y).ok)candidates.push({x,y});
  // Presentation-only derived hash; consumes no gameplay RNG and changes no state.
  const index=(Math.imul(s.seed^0x56494557,1664525)>>>0)%Math.max(1,candidates.length),p=candidates[index]??{x:.3,y:.3};
  const camera=new BoardCamera({x:p.x,y:p.y,zoom:1.8});return camera.view;
}
