import type {UnitV2} from './eco-v2-foundation.js';
export function resolveV2Selection(units:UnitV2[],id:number|null,team:UnitV2['team']){if(id===null)return null;return units.find(u=>u.team===team&&u.hp>0&&u.id===id)?.id??units.find(u=>u.team===team&&u.hp>0&&u.lineage.includes(id))?.id??null;}
