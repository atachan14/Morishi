export const WIDTH = 12, HEIGHT = 9, TICK_MS = 100;
export const EPSILON = 1e-9, SEED_RADIUS = 0.3;
export type Territory = { id: number; x: number; y: number; radius: number };
export type Stats = { power: number; range: number; presence: number; vitality: number };
export type Unit = { id: number; team: 'ally' | 'enemy'; x: number; y: number; hp: number; maxHp: number; age: number; cooldown: number; stats: Stats; target: number | null; lastShot?:{tick:number;targetId:number;x:number;y:number;damage:number} };
export type State = { seed: number; tick: number; nextId: number; units: Unit[]; cards: Stats[]; territory: Territory[]; charges: number; outcome: 'playing' | 'win' | 'loss'; started: boolean; events: string[] };
export type Placement = { ok: boolean; reason: string };
export type PlacementForecast = { targetId:number|null; damage:number; grownTargetId:number|null; incomingIds:number[]; incomingDamage:number; newArea:number; note:string };
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
export function enemyPositions(seed:number):{x:number;y:number}[] {
  // Keep the user-tested entry board as a reference; new seeds vary the route.
  if((seed>>>0)===20261011)return [[4,2],[4,6],[6,4],[8,1],[8,7],[10,3],[10,6]].map(([x,y])=>({x,y}));
  const random=rng((seed>>>0)^0x9E3779B9);
  const anchors=[[3.9,2],[3.9,6],[6,4],[8,1],[8,7],[10,3],[10,6]];
  const mirrored=random()>.5;
  return anchors.map(([x,y])=>({x:x+(random()-.5)*.7,y:Math.max(.6,Math.min(HEIGHT-.6,(mirrored?HEIGHT-y:y)+(random()-.5)*1.4))}));
}
export function createState(seed = 20261011): State {
  if (!Number.isFinite(seed)) throw new Error('Seed must be finite');
  const random = rng(seed);
  const state: State = {seed:seed>>>0,tick:0,nextId:1,units:[],cards:[],territory:[],charges:3,outcome:'playing',started:false,events:['左端の明るい領域に、自由な位置で最初の植物を配置しましょう。']};
  for (const {x,y} of enemyPositions(seed)) state.units.push(unit(state,'enemy',x,y,makeStats(random)));
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
  if(state.cards.length===0) return {ok:false,reason:'今回の芽は使い切りました。残った植物を観察するか、同じseedで再挑戦できます。'};
  if(state.charges<1) return {ok:false,reason:'配置力が足りません。時間を進めると補充されます。'};
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
export function attackDamage(u:Unit,target:Unit):number {
  const distance=Math.hypot(u.x-target.x,u.y-target.y),range=effectiveRange(u);
  if(distance>=range-EPSILON)return 0;
  return u.stats.power*growth(u)*Math.max(0,1-distance/range);
}
export function chooseTarget(u: Unit, units: Unit[]): Unit | undefined {
  return units.filter(v=>v.team!==u.team&&v.hp>0&&Math.hypot(v.x-u.x,v.y-u.y)<effectiveRange(u)-EPSILON).sort((a,b)=>{
    const score=(v:Unit)=>v.stats.presence*growth(v)/(1+Math.hypot(v.x-u.x,v.y-u.y));
    return score(b)-score(a)||a.id-b.id;
  })[0];
}
export function placementForecast(s:State,x:number,y:number):PlacementForecast|undefined {
  if(!validatePlacement(s,x,y).ok)return undefined;
  const stats=s.cards[0],seed:Unit={id:s.nextId,team:'ally',x,y,hp:stats.vitality,maxHp:stats.vitality,age:0,cooldown:0,stats,target:null};
  const others=[...s.units,seed];const target=chooseTarget(seed,others);
  const grown={...seed,age:224};const grownTarget=chooseTarget(grown,others);
  const incoming=s.units.filter(u=>u.team==='enemy'&&chooseTarget(u,others)?.id===seed.id);
  let total=0,fresh=0;
  // Small deterministic local area estimate for UI only; no effect on placement/territory.
  for(let yi=0;yi<12;yi++)for(let xi=0;xi<12;xi++){
    const px=x-1.6+(xi+.5)*3.2/12,py=y-1.6+(yi+.5)*3.2/12;
    if(Math.hypot(px-x,py-y)>1.6||px<0||px>WIDTH||py<0||py>HEIGHT)continue;
    total++;if(!insideTerritory(s,px,py)&&!s.units.some(u=>u.team==='enemy'&&Math.hypot(px-u.x,py-u.y)<1.15-EPSILON))fresh++;
  }
  const note=target?`今、敵 #${target.id} に攻撃が届きます。`:grownTarget?`育つと敵 #${grownTarget.id} に届く位置です。`:'今の位置では育っても敵に届きません。領域を広げる中継向きです。';
  return {targetId:target?.id??null,damage:target?attackDamage(seed,target):0,grownTargetId:grownTarget?.id??null,incomingIds:incoming.map(u=>u.id),incomingDamage:incoming.reduce((sum,u)=>sum+attackDamage(u,seed),0),newArea:total?fresh/total:0,note};
}
export function stalled(s:State):boolean {
  return s.cards.length===0&&s.units.length>0&&s.units.every(u=>u.age>=224)&&s.units.every(u=>!chooseTarget(u,s.units));
}
export function runActivity(s:State):'ready'|'growing'|'fighting'|'weak-combat'|'needs-placement'|'ended' {
  if(s.outcome!=='playing')return 'ended';
  if(!s.started)return 'ready';
  const attacks=s.units.map(u=>{const target=chooseTarget(u,s.units);return target?attackDamage(u,target):0;});
  const damage=attacks.reduce((sum,value)=>sum+value,0);
  if(damage>0)return damage<1?'weak-combat':'fighting';
  return s.units.some(u=>u.team==='ally'&&u.age<224)?'growing':'needs-placement';
}
export function decisionHint(s:State):{kind:'supply'|'last-cards'|'other';text:string;readyInTicks:number} {
  if(s.outcome==='playing'&&s.started&&s.cards.length>0&&s.charges===0){
    const readyInTicks=80-s.tick%80;
    return {kind:'supply',readyInTicks,text:`配置力は補充待ち。定期補充まで${(readyInTicks/10).toFixed(1)}ゲーム秒（敵攻略でも補充）。時間を進めて観察するか、2×/4×で待てます。`};
  }
  if(s.outcome==='playing'&&s.started&&s.cards.length>0&&s.cards.length<=3)return {kind:'last-cards',readyInTicks:0,text:`残りの芽は${s.cards.length}体。残った敵へ育つと届く位置か、配置前の破線と敵の射程を確認して使いましょう。`};
  return {kind:'other',text:'',readyInTicks:0};
}
export type ResultDiagnosis={kind:'unreachable'|'defeated'|'manual'|'win';message:string;suggestion:string;enemyId?:number;allyId?:number;distance?:number;range?:number;gap?:number};
export function resultDiagnosis(s:State):ResultDiagnosis|undefined {
  if(s.outcome==='playing')return undefined;
  if(s.outcome==='win')return {kind:'win',message:'全ての敵を攻略しました。',suggestion:'同じseedで別の広げ方や、新しいseedを試せます。'};
  const enemies=s.units.filter(u=>u.team==='enemy'),allies=s.units.filter(u=>u.team==='ally');
  if(s.events[0]?.startsWith('今回はここまで。'))return {kind:'manual',message:`自分でrunを区切りました。敵${enemies.length}体、未配置の芽${s.cards.length}体が残っています。`,suggestion:'ここまでの広げ方を手がかりに、同じseedで再挑戦できます。'};
  if(allies.length===0&&s.cards.length===0)return {kind:'defeated',message:'芽を使い切り、味方の植物が残っていません。',suggestion:'次は配置前の赤い線で狙われ方を見て、味方同士の射程が重なる位置も試せます。'};
  if(stalled(s)&&allies.length&&enemies.length){
    const pairs=enemies.flatMap(e=>allies.map(a=>{const distance=Math.hypot(e.x-a.x,e.y-a.y),range=effectiveRange(a);return {enemyId:e.id,allyId:a.id,distance,range,gap:Math.max(0,distance-range)};}));
    pairs.sort((a,b)=>a.gap-b.gap||a.enemyId-b.enemyId||a.allyId-b.allyId);const pair=pairs[0];
    return {kind:'unreachable',...pair,message:`芽を使い切り、残った敵${enemies.length}体に味方の攻撃が届いていません。敵 #${pair.enemyId} と味方 #${pair.allyId} の距離は${pair.distance.toFixed(2)}、味方の射程は${pair.range.toFixed(2)}です。`,suggestion:'次はこの敵への中継に最後の芽を残し、育った射程の破線が届く位置を確認してみましょう。'};
  }
  return {kind:'manual',message:`敵${enemies.length}体、未配置の芽${s.cards.length}体が残っています。`,suggestion:'結果の盤面から、次に狙う敵や広げる方向を選べます。'};
}
function event(s:State,message:string) { s.events.unshift(message);s.events=s.events.slice(0,5); }
export function finishRun(s:State):boolean {
  if(s.outcome!=='playing'||!s.started)return false;
  s.outcome='loss';event(s,'今回はここまで。広げた領域を眺めて、同じseedで別の広げ方も試せます。');return true;
}
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
    const amount=attackDamage(u,target);
    u.lastShot={tick:s.tick,targetId:target.id,x:target.x,y:target.y,damage:amount};
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
  else if(stalled(s)){s.outcome='loss';event(s,'芽を使い切り、成長しても攻撃が届かない盤面になりました。同じseedで前線への配置を試せます。');}
}
export class Clock {
  paused=true; speed=1; private accumulated=0;
  suspend(){this.paused=true;this.accumulated=0;}
  advance(s:State,elapsedMs:number) {
    if(!Number.isFinite(elapsedMs)||elapsedMs<0)throw new Error('Invalid elapsed time');
    if(this.paused||s.outcome!=='playing')return;
    if(![1,2,4].includes(this.speed))throw new Error('Invalid speed');
    this.accumulated+=elapsedMs*this.speed;
    while(this.accumulated+1e-8>=TICK_MS){this.accumulated-=TICK_MS;step(s);}
  }
}
