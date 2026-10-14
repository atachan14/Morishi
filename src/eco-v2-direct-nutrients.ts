import {ROOT_KEYS,rootZero,type RootSoil,type RootVector} from './eco-root-trial.js';
export const DIRECT_NUTRIENT_MODEL='direct-finite-1' as const;
export const DIRECT_DEFAULTS=Object.freeze({initialPerKind:1000,referenceRadius:100,soilPerSecond:2,corpsePerSecond:2,waterPerNutrient:1});
export type DirectSource={id:string;kind:'soil'|'corpse';area:number;stock:RootVector};
export type DirectOverlap={source:string;unit:number;area:number;share:number;weight?:RootVector};
export type DirectUnit={id:number;rootArea:number;water:number;growthWaterLimit:number;sunlight:number};
export type DirectRules={referenceRadius:number;soilPerSecond:number;corpsePerSecond:number;waterPerNutrient:number};
export type DirectReceipt={id:number;nutrients:RootVector;soil:RootVector;corpse:RootVector;waterConsumed:number};
const sum=(v:readonly number[])=>v.reduce((n,x)=>n+x,0);
const nonnegative=(n:number)=>Number.isFinite(n)&&n>=0;
function compareWeights(a:RootVector|undefined,b:RootVector|undefined){for(let k=0;k<ROOT_KEYS.length;k++){const difference=(a?.[k]??0)-(b?.[k]??0);if(difference)return difference;}return 0;}
// All demands come from one snapshot. Local share is 1 / eligible roots at that sample.
// Source shortage is scaled once per nutrient, then committed together. No sequential stealing or reallocation.
export function planDirectNutrients(units:readonly DirectUnit[],sources:readonly DirectSource[],overlaps:readonly DirectOverlap[],rules:DirectRules=DIRECT_DEFAULTS,dt=.1){
 if(!Number.isFinite(dt)||dt<=0||dt>1||!Object.values(rules).every(nonnegative)||rules.referenceRadius<=0||rules.waterPerNutrient<=0)throw Error('Invalid direct rules');
 const us=[...units].sort((a,b)=>a.id-b.id),ss=[...sources].sort((a,b)=>a.id.localeCompare(b.id));
 if(new Set(us.map(u=>u.id)).size!==us.length||new Set(ss.map(s=>s.id)).size!==ss.length||us.some(u=>!Number.isSafeInteger(u.id)||u.id<1||![u.rootArea,u.water,u.growthWaterLimit,u.sunlight].every(nonnegative)||u.sunlight>1)||ss.some(s=>!['soil','corpse'].includes(s.kind)||!Number.isFinite(s.area)||s.area<=0||s.stock.length!==ROOT_KEYS.length||!s.stock.every(nonnegative)||!Number.isFinite(sum(s.stock))))throw Error('Invalid direct snapshot');
 const bySource=new Map(ss.map(s=>[s.id,s])),byUnit=new Map(us.map(u=>[u.id,u]));
 const rows=[...overlaps].sort((a,b)=>a.unit-b.unit||a.source.localeCompare(b.source)||a.area-b.area||a.share-b.share||compareWeights(a.weight,b.weight));
 if(rows.some(o=>!bySource.has(o.source)||!byUnit.has(o.unit)||!nonnegative(o.area)||o.area>bySource.get(o.source)!.area+1e-8||!Number.isFinite(o.share)||o.share<=0||o.share>1||o.weight!==undefined&&(o.weight.length!==ROOT_KEYS.length||!o.weight.every(nonnegative)||!Number.isFinite(sum(o.weight)))))throw Error('Invalid direct overlaps');
 const requests=new Map<number,Map<string,RootVector>>(),referenceArea=Math.PI*rules.referenceRadius**2;
 for(const u of us){const request=new Map<string,RootVector>();requests.set(u.id,request);if(u.sunlight===0||u.water===0||u.growthWaterLimit===0)continue;
  for(const kind of ['soil','corpse'] as const){const eligible=rows.filter(o=>o.unit===u.id&&bySource.get(o.source)!.kind===kind&&sum(bySource.get(o.source)!.stock)>0),weights=eligible.map(o=>o.weight?sum(o.weight):sum(bySource.get(o.source)!.stock)*o.area/bySource.get(o.source)!.area),total=sum(weights);if(total===0)continue;
   const area=kind==='soil'?u.rootArea:eligible.reduce((n,o)=>n+o.area,0),budget=(kind==='soil'?rules.soilPerSecond:rules.corpsePerSecond)*area/referenceArea*u.sunlight*dt;
   eligible.forEach((o,i)=>{if(weights[i]===0)return;const source=bySource.get(o.source)!,stockTotal=sum(source.stock),row=request.get(source.id)??rootZero();for(let k=0;k<row.length;k++)row[k]+=budget*weights[i]/total*o.share*(o.weight?o.weight[k]/weights[i]:source.stock[k]/stockTotal);request.set(source.id,row);});
  }
  const wanted=[...request.values()].reduce((n,v)=>n+sum(v),0)*rules.waterPerNutrient;if(!Number.isFinite(wanted))throw Error('Nonfinite direct demand');const scale=wanted===0?0:Math.min(1,u.water/wanted,u.growthWaterLimit/wanted);for(const [id,v]of request)request.set(id,v.map(x=>x*scale));
 }
 const available=new Map(ss.map(source=>[source.id,rootZero()]));for(const row of rows){const u=byUnit.get(row.unit)!;if(u.water===0||u.sunlight===0||u.growthWaterLimit===0)continue;const source=bySource.get(row.source)!;for(let k=0;k<ROOT_KEYS.length;k++)available.get(row.source)![k]=Math.min(source.stock[k],available.get(row.source)![k]+(row.weight?.[k]??source.stock[k]*row.area/source.area)*row.share);}
 const factors=new Map<string,RootVector>();for(const source of ss){const demand=rootZero();for(const u of us){const row=requests.get(u.id)!.get(source.id);if(row)for(let k=0;k<row.length;k++)demand[k]+=row[k];}factors.set(source.id,demand.map((v,k)=>v===0?0:Math.min(1,Math.min(source.stock[k],available.get(source.id)![k])/v)));}
 const remaining=new Map(ss.map(s=>[s.id,[...s.stock]])),receipts:DirectReceipt[]=us.map(u=>({id:u.id,nutrients:rootZero(),soil:rootZero(),corpse:rootZero(),waterConsumed:0}));
 for(const receipt of receipts)for(const source of ss){const request=requests.get(receipt.id)!.get(source.id);if(!request)continue;for(let k=0;k<request.length;k++){const amount=request[k]*factors.get(source.id)![k];receipt.nutrients[k]+=amount;receipt[source.kind][k]+=amount;remaining.get(source.id)![k]-=amount;}}
 for(const stock of remaining.values())for(let k=0;k<stock.length;k++){if(stock[k]<-1e-8)throw Error('Direct inventory overdraft');stock[k]=Math.max(0,stock[k]);}
 for(const r of receipts)r.waterConsumed=sum(r.nutrients)*rules.waterPerNutrient;
 return {receipts,sources:ss.map(s=>({...s,stock:remaining.get(s.id)!}))};
}
let stockCacheKey='',stockCache:RootVector[]|undefined,sampleCache=new Map<number,RootVector[]>();
// Each kind is a total mass over the sampled world, never 1000 per patch/cell.
// No background. Per-sample footprints stay separate so a root cannot take a different part of its cell.
export function initialDirectStocks(soil:RootSoil,totalPerKind:number=DIRECT_DEFAULTS.initialPerKind){if(!nonnegative(totalPerKind)||!soil.recipe)throw Error('Missing direct stock recipe');const key=JSON.stringify([soil.x,soil.y,soil.columns,soil.rows,soil.cellSize,soil.samples,soil.recipe,totalPerKind]);if(key===stockCacheKey&&stockCache)return stockCache;const stocks=soil.cells.map(()=>rootZero()),shapes=new Map<number,RootVector[]>(),area=(soil.cellSize/soil.samples)**2,patches=soil.recipe.patches.map(p=>({...p,k:ROOT_KEYS.indexOf(p.key)}));if(patches.some(p=>p.k<0))throw Error('Unknown stock key');
 for(const cell of soil.cells)for(let i=0;i<soil.samples**2;i++){const x=soil.x+(cell.id%soil.columns+(i%soil.samples+.5)/soil.samples)*soil.cellSize,y=soil.y+(Math.floor(cell.id/soil.columns)+(Math.floor(i/soil.samples)+.5)/soil.samples)*soil.cellSize,support=cell.support?.[i]??1,values=rootZero();for(const p of patches)values[p.k]+=Math.max(0,1-Math.hypot(x-p.x,y-p.y)/p.radius)*p.strength*area*support;if(values.some(v=>v>0)){const samples=shapes.get(cell.id)??[];samples[i]=values;shapes.set(cell.id,samples);for(let k=0;k<values.length;k++)stocks[cell.id][k]+=values[k];}}
 for(let k=0;k<ROOT_KEYS.length;k++){const total=stocks.reduce((n,v)=>n+v[k],0);if(total===0){if(totalPerKind>0)throw Error('Nutrient patch has no sampled area: '+ROOT_KEYS[k]);continue;}let assigned=0;const active=stocks.map((v,id)=>v[k]>0?id:-1).filter(id=>id>=0);for(let j=0;j<active.length;j++){const id=active[j],value=j===active.length-1?Math.max(0,totalPerKind-assigned):stocks[id][k]/total*totalPerKind,samples=shapes.get(id)!;stocks[id][k]=value;assigned+=value;for(const v of samples)if(v)v[k]*=totalPerKind/total;const present=samples.filter(v=>v&&v[k]>0);if(present.length){const observed=present.reduce((n,v)=>n+v[k],0),largest=present.reduce((a,b)=>a[k]>=b[k]?a:b);largest[k]+=value-observed;}}}
 stocks.forEach(v=>Object.freeze(v));Object.freeze(stocks);for(const samples of shapes.values()){samples.forEach(v=>Object.freeze(v));Object.freeze(samples);}stockCacheKey=key;stockCache=stocks;sampleCache=shapes;return stocks;
}
export function initialDirectSampleStocks(soil:RootSoil,totalPerKind:number=DIRECT_DEFAULTS.initialPerKind){initialDirectStocks(soil,totalPerKind);return sampleCache;}
