export const WIDTH = 12, HEIGHT = 9, TICK_MS = 100;
export const EPSILON = 1e-9, SEED_RADIUS = 0.3;
export type Territory = { id: number; x: number; y: number; radius: number };
export type Stats = { power: number; range: number; presence: number; vitality: number };
export type Unit = { id: number; team: 'ally' | 'enemy'; x: number; y: number; hp: number; maxHp: number; age: number; cooldown: number; stats: Stats; target: number | null };
export type State = { seed: number; tick: number; nextId: number; units: Unit[]; cards: Stats[]; territory: Territory[]; charges: number; outcome: 'playing' | 'win' | 'loss'; started: boolean; events: string[] };
export type Placement = { ok: boolean; reason: string };
function rng(seed: number) { let s = seed >>> 0; return () => { s += 0x6D2B79F5; let t = Math.imul(s ^ s >>> 15, 1 | s); t ^= t + Math.imul(t ^ t >>> 7, 61 | t); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export function makeStats(random: () => number): Stats {
  const weights = Array.from({length: 4}, () => 0.35 + random());
  const sum = weights.reduce((a,b) => a+b,0);
  const v = weights.map(w => w/sum);
  return { power: +(10 + v[0]*35).toFixed(2), range: +(2.1 + v[1]*4).toFixed(2), presence: +(0.5 + v[2]*3).toFixed(2), vitality: Math.round(70 + v[3]*150) };
}
export function dominant(stats: Stats): keyof Stats {
  const scores: [keyof Stats,number][] = [['power',(stats.power-10)/35],['range',(stats.range-2.1)/4],['presence',(stats.presence-0.5)/3],['vitality',(stats.vitality-70)/150]];
  return scores.sort((a,b) => b[1]-a[1])[0][0];
}
function unit(state: State, team: Unit['team'], x: number, y: number, stats: Stats): Unit {
  return {id:state.nextId++,team,x,y,hp:stats.vitality,maxHp:stats.vitality,age:0,cooldown:0,stats:{...stats},target:null};
}
export function createState(seed = 20261011): State {
  if (!Number.isFinite(seed)) throw new Error('Seed must be finite');
  const random = rng(seed);
  const state: State = {seed:seed>>>0,tick:0,nextId:1,units:[],cards:[],territory:[],charges:3,outcome:'playing',started:false,events:['左端の明るい領域に、自由な位置で最初の植物を配置しましょう。']};
  const spots = [[4,2],[4,6],[6,4],[8,1],[8,7],[10,3],[10,6]];
  for (const [x,y] of spots) state.units.push(unit(state,'enemy',x,y,makeStats(random)));
  for(let i=0;i<18;i++) state.cards.push(makeStats(random));
  return state;
}
export function footprint(u: Unit) { return SEED_RADIUS + Math.min(u.age / 180, 0.65) * 0.12; }
export function insideTerritory(state: State, x: number, y: number): boolean {
  if(!Number.isFinite(x)||!Number.isFinite(y)||x<0||x>WIDTH||y<0||y>HEIGHT)return false;
  const claimed=x<=2+EPSILON || state.territory.some(t=>Math.hypot(x-t.x,y-t.y)<=t.radius+EPSILON);
  return claimed && !state.units.some(u=>u.team==='enemy'&&Math.hypot(x-u.x,y-u.y)<1.15-EPSILON);
}
// Sampling is only for the percentage label; placement uses the analytic circle union.
export function territoryCoverage(state: State): number {
  let claimed=0;const nx=60,ny=45;
  for(let y=0;y<ny;y++)for(let x=0;x<nx;x++)if(insideTerritory(state,(x+.5)*WIDTH/nx,(y+.5)*HEIGHT/ny))claimed++;
  return claimed/(nx*ny);
}
export function viewport(width:number,height:number) {
  if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)throw new Error('Invalid viewport');
  const scale=Math.min(width/WIDTH,height/HEIGHT);
  return {scale,ox:(width-WIDTH*scale)/2,oy:(height-HEIGHT*scale)/2};
}
export function screenToWorld(px:number,py:number,width:number,height:number) {
  const {scale,ox,oy}=viewport(width,height);
  return {x:(px-ox)/scale,y:(py-oy)/scale};
}
export function clientToWorld(clientX:number,clientY:number,rect:{left:number;top:number;width:number;height:number}) {
  return screenToWorld(clientX-rect.left,clientY-rect.top,rect.width,rect.height);
}
export function validatePlacement(state: State, x: number, y: number): Placement {
  if(state.outcome!=='playing') return {ok:false,reason:'このステージは終了しました。新しい盤面を始められます。'};
  if(!Number.isFinite(x)||!Number.isFinite(y))return {ok:false,reason:'有効な位置を選んでください。'};
  if(x<SEED_RADIUS-EPSILON||x>WIDTH-SEED_RADIUS+EPSILON||y<SEED_RADIUS-EPSILON||y>HEIGHT-SEED_RADIUS+EPSILON) return {ok:false,reason:'植物の円全体が盤面内に入る位置を選んでください。'};
  if(state.charges<1||state.cards.length===0) return {ok:false,reason:'配置力が足りません。時間を進めると補充されます。'};
  if(state.units.some(u=>Math.hypot(u.x-x,u.y-y)<footprint(u)+SEED_RADIUS-EPSILON)) return {ok:false,reason:'植物の円が重なっています。少し離して配置してください。'};
  if(!insideTerritory(state,x,y)) return {ok:false,reason:'明るい自分の領域に配置できます。赤い敵領域には置けません。'};
  return {ok:true,reason:'配置できます。'};
}
export function place(state: State,x:number,y:number): Placement {
  const result=validatePlacement(state,x,y); if(!result.ok)return result;
  const stats=state.cards.shift()!; state.units.push(unit(state,'ally',x,y,stats)); state.charges--; state.started=true;
  event(state,`植物を配置 (${x.toFixed(2)}, ${y.toFixed(2)})。射程円を見ながら進めてみましょう。`);
  expand(state); return result;
}
export function growth(u: Unit) { return 0.65 + Math.min(u.age/180,0.65); }
export function effectiveRange(u: Unit) { return u.stats.range * growth(u); }
export function chooseTarget(u: Unit, units: Unit[]): Unit | undefined {
  return units.filter(v=>v.team!==u.team&&v.hp>0&&Math.hypot(v.x-u.x,v.y-u.y)<effectiveRange(u)-EPSILON).sort((a,b)=>{
    const score=(v:Unit)=>v.stats.presence*growth(v)/(1+Math.hypot(v.x-u.x,v.y-u.y));
    return score(b)-score(a)||a.id-b.id;
  })[0];
}
function event(s:State,message:string) { s.events.unshift(message);s.events=s.events.slice(0,5); }
function expand(s:State) {
  for(const u of s.units.filter(u=>u.team==='ally'&&u.hp>0)) {
    const radius=1.6+Math.min(u.age/160,1.4);
    const existing=s.territory.find(t=>t.id===u.id);
    if(existing)existing.radius=Math.max(existing.radius,radius);
    else s.territory.push({id:u.id,x:u.x,y:u.y,radius});
  }
}
export function step(s:State) {
  if(s.outcome!=='playing'||!s.started)return;
  s.tick++;
  if(s.tick%80===0&&s.cards.length>0) s.charges=Math.min(5,s.charges+1);
  for(const u of s.units) {u.age++;u.cooldown=Math.max(0,u.cooldown-1);}
  const damage=new Map<number,number>();
  for(const u of [...s.units].sort((a,b)=>a.id-b.id)) {
    const target=chooseTarget(u,s.units);u.target=target?.id??null;
    if(!target||u.cooldown>0)continue;
    const falloff=1-Math.hypot(u.x-target.x,u.y-target.y)/effectiveRange(u);
    const amount=u.stats.power*growth(u)*Math.max(0,falloff);
    damage.set(target.id,(damage.get(target.id)??0)+amount);u.cooldown=10;
  }
  for(const u of s.units)u.hp=Math.max(0,u.hp-(damage.get(u.id)??0));
  for(const dead of s.units.filter(u=>u.hp===0)) {
    event(s,dead.team==='enemy'?'敵を攻略！周辺を新しい領域に。':'味方の植物が倒れました。残った領域に再配置できます。');
    if(dead.team==='enemy') {s.charges=Math.min(5,s.charges+1);s.territory.push({id:dead.id,x:dead.x,y:dead.y,radius:1.8});}
  }
  s.units=s.units.filter(u=>u.hp>0);expand(s);
  if(!s.units.some(u=>u.team==='enemy')){s.outcome='win';event(s,'攻略完了！植物が広げた領域を眺めてみましょう。');}
  else if(!s.units.some(u=>u.team==='ally')&&s.cards.length===0){s.outcome='loss';event(s,'配置する植物を使い切りました。新しい盤面で再挑戦できます。');}
}
export class Clock {
  paused=true; speed=1; private accumulated=0;
  advance(s:State,elapsedMs:number) {
    if(!Number.isFinite(elapsedMs)||elapsedMs<0)throw new Error('Invalid elapsed time');
    if(this.paused||s.outcome!=='playing')return;
    if(![1,2,4].includes(this.speed))throw new Error('Invalid speed');
    this.accumulated+=elapsedMs*this.speed;
    while(this.accumulated+1e-8>=TICK_MS){this.accumulated-=TICK_MS;step(s);}
  }
}
