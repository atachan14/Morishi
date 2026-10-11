import {growth,type State} from './sim.js';
import type {View} from './camera.js';

// Rendering-only signatures. Simulation and exact placement never use these.
export function presenceVisualKey(state:State){
 return JSON.stringify(state.units.filter(u=>u.team==='enemy'&&u.hp>0).map(u=>[u.id,u.x,u.y,u.stats.presence,growth(u)]));
}
export function boardVisualKey(state:State,view:View,width:number,height:number,selected:number|null,hovered:{x:number;y:number}|null,placement?:{seedId:number|null;armed:boolean}){
 return JSON.stringify([state.opening,placement,state.stage,view,width,height,selected,hovered,state.outcome,state.charges,state.cards[0],state.territory,state.units.map(u=>[u.id,u.team,u.x,u.y,u.hp,u.maxHp,Math.min(u.age,117),u.stats,u.lastShot&&state.tick-u.lastShot.tick<3?u.lastShot:null])]);
}
