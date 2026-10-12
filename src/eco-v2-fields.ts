import {clipV2CircleUnion,paintV2PlacementArea} from './eco-v2-area.js';
import {v2PresenceOwner,v2FieldFacts,v2VisibleRanges,type LayerOptions,type FieldFact} from './eco-v2-view.js';
import type {GameV2} from './eco-v2-game.js';import type {View} from './eco-save.js';
export class V2FieldRenderer{
 private canvas=document.createElement('canvas');private context=this.canvas.getContext('2d')!;private key='';private lastBuild=-Infinity;private hatch:CanvasPattern;
 constructor(){const tile=document.createElement('canvas');tile.width=tile.height=8;const c=tile.getContext('2d')!;c.strokeStyle='#ffffff';c.lineWidth=1;c.beginPath();c.moveTo(-2,8);c.lineTo(8,-2);c.moveTo(6,10);c.lineTo(10,6);c.stroke();this.hatch=this.context.createPattern(tile,'repeat')!;}
 paint(target:CanvasRenderingContext2D,s:GameV2,view:View,options:LayerOptions,diameter:number|null){if(!options.area&&!options.allyRanges&&!options.enemyRanges&&!options.allyPresence&&!options.enemyPresence)return;const width=target.canvas.width,height=target.canvas.height,scale=Math.min(width/4096,height/3072)*view.zoom,facts=v2FieldFacts(s.units),key=JSON.stringify([width,height,view,options,facts,diameter,s.charges>0,s.units.length<128,s.outcome==='playing']);
  if(key!==this.key&&performance.now()-this.lastBuild>=80){this.lastBuild=performance.now();this.canvas.width=width;this.canvas.height=height;const c=this.context;
   if(options.area&&diameter!==null&&s.charges>0&&s.units.length<128&&s.outcome==='playing'){paintV2PlacementArea(c,facts,diameter,view,scale);}
   const point=(u:FieldFact)=>({x:width/2+(u.x-view.x)*scale,y:height/2+(u.y-view.y)*scale});
   const rgba=(hex:string,a:number)=>`rgba(${parseInt(hex.slice(1,3),16)},${parseInt(hex.slice(3,5),16)},${parseInt(hex.slice(5,7),16)},${a})`;
   const hatch=(p:{x:number;y:number},radii:number[],opacity:(distance:number)=>number)=>{for(let i=1;i<radii.length;i++){const inner=radii[i-1],outer=radii[i],a=opacity((inner+outer)/2);if(a<.006)continue;c.save();c.beginPath();c.arc(p.x,p.y,outer,0,Math.PI*2);if(inner>0)c.arc(p.x,p.y,inner,0,Math.PI*2,true);c.clip('evenodd');c.globalAlpha=a;c.fillStyle=this.hatch;c.fillRect(Math.max(0,p.x-outer),Math.max(0,p.y-outer),Math.min(width,p.x+outer)-Math.max(0,p.x-outer),Math.min(height,p.y+outer)-Math.max(0,p.y-outer));c.restore();}};
   if(options.allyRanges||options.enemyRanges)for(const field of v2VisibleRanges(facts,options)){const p=point(field.unit),r=field.radius*scale;if(r<.1||p.x+r<0||p.y+r<0||p.x-r>width||p.y-r>height)continue;const alpha=Math.min(.32,.12+field.radius/1500),g=c.createRadialGradient(p.x,p.y,0,p.x,p.y,r);g.addColorStop(0,rgba(field.color,alpha));g.addColorStop(1,rgba(field.color,0));c.fillStyle=g;c.beginPath();c.arc(p.x,p.y,r,0,Math.PI*2);c.fill();if(field.unit.team==='ally')hatch(p,[0,r/3,r*2/3,r],d=>alpha*.7*Math.max(0,1-d/r));}
   if(options.allyPresence||options.enemyPresence){const visibleFacts=facts.filter(u=>u.team==='ally'?options.allyPresence:options.enemyPresence);c.save();clipV2CircleUnion(c,visibleFacts.map(u=>({x:u.x,y:u.y,radius:u.presence+(u.surfacePresence?u.radius:0)})),view,scale);const cell=Math.max(4,Math.sqrt(width*height/16000));for(let y=0;y<height;y+=cell)for(let x=0;x<width;x+=cell){const hit=v2PresenceOwner(visibleFacts,view.x+(x+cell/2-width/2)/scale,view.y+(y+cell/2-height/2)/scale,true);if(!hit.owner||hit.score < -cell/(Math.SQRT2*scale))continue;c.fillStyle=hit.tie?'#fff8c980':`hsla(${hit.owner.id*137.508%360},55%,48%,.23)`;c.fillRect(x,y,cell,cell);}c.restore();}
   this.key=key;
  }
  // Never show a cached mask in a different world transform or with changed unit facts.
  if(key===this.key)target.drawImage(this.canvas,0,0);
 }
}
