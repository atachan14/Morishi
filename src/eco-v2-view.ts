import {currentV2Stats,type UnitV2} from './eco-v2-foundation.js';
import {ELEMENTS,type Element} from './eco-v2-contract.js';
import {WORLD} from './eco-sim.js';
export const V2_COORD_LIMIT=1e12;
export const FIELD_COLORS:Record<Element,string>={fire:'#e2534a',ice:'#65c5e9',electric:'#efcf47',dark:'#9b6fd0'};
export type FieldFact={id:number;team:UnitV2['team'];x:number;y:number;radius:number;presence:number;ranges:{element:Element;radius:number}[]};
export type LayerOptions={area:boolean;ranges:boolean;presence:boolean;allies:boolean;enemies:boolean};
export const DEFAULT_LAYERS:LayerOptions={area:false,ranges:false,presence:false,allies:true,enemies:true};
export function v2FieldFacts(units:UnitV2[]):FieldFact[]{return units.map(u=>{const s=currentV2Stats(u);return {id:u.id,team:u.team,x:u.x,y:u.y,radius:u.diameter/2,presence:s.presence,ranges:ELEMENTS.filter(e=>s.elements[e].range>0&&u.skills.some(c=>c.skill.element===e)).map(element=>({element,radius:s.elements[element].range}))};});}
export function v2MinimumZoom(units:UnitV2[],width:number,height:number){if(!units.length)return 1;const magnitude=Math.max(1,...units.flatMap(u=>[Math.abs(u.x),Math.abs(u.y),u.diameter/2])),xs=units.flatMap(u=>[(u.x-u.diameter/2)/magnitude,(u.x+u.diameter/2)/magnitude]),ys=units.flatMap(u=>[(u.y-u.diameter/2)/magnitude,(u.y+u.diameter/2)/magnitude]),spanX=Math.max(...xs)-Math.min(...xs),spanY=Math.max(...ys)-Math.min(...ys),pad=Math.max(120/magnitude,Math.max(spanX,spanY)*.08),base=Math.min(Math.max(1,width)/WORLD.width,Math.max(1,height)/WORLD.height);return Math.max(Number.MIN_VALUE,Math.min(1,Math.min(Math.max(1,width)/(spanX+pad*2)/magnitude,Math.max(1,height)/(spanY+pad*2)/magnitude)/base));}
// Conservative whole-cell certificate: every point in a tinted cell is legal geometrically.
export function v2CellPlaceable(facts:FieldFact[],x:number,y:number,halfDiagonal:number,diameter:number){if(Math.abs(x)+halfDiagonal>V2_COORD_LIMIT||Math.abs(y)+halfDiagonal>V2_COORD_LIMIT)return false;let sum=0;for(const u of facts){const distance=Math.hypot(u.x-x,u.y-y),near=Math.max(0,distance-halfDiagonal);if(near<u.radius+diameter/2-1e-6)return false;if(u.team==='enemy'){sum+=2/(1+near/u.presence);if(sum>1.5+1e-9)return false;}}return true;}
export function v2VisibleRanges(facts:FieldFact[],options:LayerOptions){return facts.filter(u=>u.team==='ally'?options.allies:options.enemies).flatMap(u=>u.ranges.map(r=>({unit:u,...r,color:FIELD_COLORS[r.element]})));}
