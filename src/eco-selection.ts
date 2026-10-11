import type {State,Unit} from './eco-sim.js';

// Keep a selected absorbed identity attached to its living receiver; death clears it.
export function resolveUnitSelection(state:State,id:number|null,team:Unit['team']):number|null{
 if(id===null)return null;
 return state.units.find(u=>u.team===team&&u.id===id)?.id
  ??state.units.find(u=>u.team===team&&u.lineage.includes(id))?.id??null;
}
