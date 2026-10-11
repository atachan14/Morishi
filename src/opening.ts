import {PLAY_STAGE,type StageConfig} from './stage.js';
export type Opening='legacy'|'clustered-v1';
export const OPENING_MIN_DISTANCE=6.2;
const shapes=[
 [[-3,-3],[3.4,-2.8],[-2.8,3.5],[3.5,3.8]],
 [[-7,-3.5],[-.1,-3.5],[6.8,-3.5],[-3.5,2.8],[3.6,2.8],[-7,9.1],[-.1,9.1],[6.8,9.1]],
 [[-6,-3],[.6,-3],[7.2,-3],[-2.7,3.2],[3.9,3.2]],
 [[-6.6,-6.2],[0,-6.2],[6.6,-6.2],[-3.3,0],[3.3,0],[-6.6,6.2],[0,6.2]],
];
type Point={x:number;y:number};
export function generatedPoint(p:Point):Point{return {x:+p.x.toFixed(6),y:+p.y.toFixed(6)};}
export function clusteredPositions(stage:StageConfig,random:()=>number):Point[]{
 if(stage.width!==PLAY_STAGE.width||stage.height!==PLAY_STAGE.height||stage.enemyCount!==24)throw new Error('Experimental opening requires its comparison stage');
 const valid=(points:Point[])=>points.every((p,i)=>p.x>=1&&p.x<=stage.width-1&&p.y>=1&&p.y<=stage.height-1&&points.slice(i+1).every(q=>Math.hypot(p.x-q.x,p.y-q.y)>=OPENING_MIN_DISTANCE));
 const layouts=[[[14,11],[52,12],[17,40],[52,42]],[[12,12],[49,10],[20,41],[54,40]],[[14,10],[53,14],[12,41],[46,42]]];
 for(let attempt=0;attempt<16;attempt++){
  const anchors=layouts[Math.floor(random()*layouts.length)],order=[0,1,2,3];for(let i=3;i>0;i--){const j=Math.floor(random()*(i+1));[order[i],order[j]]=[order[j],order[i]];}
  const points=anchors.flatMap(([ax,ay],i)=>{const angle=(random()-.5)*.8,scale=1+random()*.12,x=ax+(random()-.5)*3,y=ay+(random()-.5)*3,c=Math.cos(angle),s=Math.sin(angle);return shapes[order[i]].map(([dx,dy])=>({x:x+(dx*c-dy*s)*scale,y:y+(dx*s+dy*c)*scale}));});
  const stable=points.map(generatedPoint);if(valid(stable))return stable;
 }
 const anchors=[[14,11],[52,11],[14,42],[52,42]],fallback=anchors.flatMap(([x,y],i)=>shapes[i].map(([dx,dy])=>({x:x+dx,y:y+dy})));if(!valid(fallback))throw new Error('Invalid opening fallback');return fallback.map(generatedPoint);
}
export function initialAllyCount(enemies:number){return Math.max(1,Math.round(enemies/9));}
