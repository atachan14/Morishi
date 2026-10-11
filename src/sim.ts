import {DEFAULT_STAGE,INITIAL_CARDS,stageConfig,referenceStage,type StageConfig} from './stage.js';
import {clusteredPositions,initialAllyCount,generatedPoint,type Opening} from './opening.js';
export const WIDTH = 12, HEIGHT = 9, TICK_MS = 100;
export const EPSILON = 1e-9, SEED_RADIUS = 0.3;
export const RULES='plateau-distance-1', REFILL_TICKS=240;
export const PRESENCE_LIMIT=1.5;
export const PRESENCE_STRENGTH=2;
/** Shared plateau falloff: full strength through R, linearly zero at 2R. */
export function distanceFalloff(distance:number,baseDistance:number):number {
  if(!Number.isFinite(distance)||distance<0||!Number.isFinite(baseDistance)||baseDistance<=0)return 0;
  return distance<=baseDistance?1:Math.max(0,2-distance/baseDistance);
}
/** Presence stat is distance; strength is shared. Growth widens its base distance. */
export function presenceAt(u:Unit,x:number,y:number):number {
  return PRESENCE_STRENGTH*distanceFalloff(Math.hypot(u.x-x,u.y-y),u.stats.presence*growth(u));
}
export function enemyPresenceAt(s:State,x:number,y:number):number {
  return s.units.filter(u=>u.team==='enemy'&&u.hp>0).reduce((sum,u)=>sum+presenceAt(u,x,y),0);
}export type Territory = { id: number; x: number; y: number; radius: number };
export type Stats = { power: number; range: number; presence: number; vitality: number };
export type StatMultipliers=Record<keyof Stats,number>;
export type FrozenSeed={generator:'composition-v1';rawStats:Stats;appliedMultipliers:StatMultipliers;rewardEnemyIds:number[];enteredAtTick:number};
export type PlayerProgress={policy:'hand-entry-v1';multipliers:StatMultipliers;rewards:{enemyId:number;tick:number}[]};
export type SeedCard={id:number;baseStats:Stats;snapshot?:FrozenSeed};
// Provisional comparison tuning: +1 percentage point to the matching multiplier.
export const KILL_BOOST=.01;
export function baseMultipliers():StatMultipliers{return {power:1,range:1,presence:1,vitality:1};}
export function applyMultipliers(raw:Stats,m:StatMultipliers):Stats{return {power:+(raw.power*m.power).toFixed(2),range:+(raw.range*m.range).toFixed(2),presence:+(raw.presence*m.presence).toFixed(2),vitality:Math.round(raw.vitality*m.vitality)};}
export function multipliersFor(enemies:Unit[],ids:number[]):StatMultipliers{const m=baseMultipliers();for(const id of ids){const enemy=enemies.find(u=>u.id===id&&u.team==='enemy');if(!enemy)throw new Error('Invalid reward enemy');const key=dominant(enemy.stats);m[key]=+(m[key]+KILL_BOOST).toFixed(2);}return m;}
export function freezeSeed(s:State,id:number,raw=supplyStats(s.seed,s.stage,id)):SeedCard{if(!s.player)return {id,baseStats:{...raw}};const snapshot:FrozenSeed={generator:'composition-v1',rawStats:{...raw},appliedMultipliers:{...s.player.multipliers},rewardEnemyIds:s.player.rewards.map(r=>r.enemyId),enteredAtTick:s.tick};return {id,baseStats:applyMultipliers(raw,snapshot.appliedMultipliers),snapshot};}
export type Unit = { id: number; team: 'ally' | 'enemy'; x: number; y: number; hp: number; maxHp: number; age: number; cooldown: number; stats: Stats; target: number | null; born?:number;supplyIndex?:number;seedIndex?:number;initial?:true;seedSnapshot?:FrozenSeed;lastShot?:{tick:number;targetId:number;x:number;y:number;damage:number} };
export type State = { stage:StageConfig; supplyMode:'finite'|'endless';supplyIndex:number; seed: number; tick: number; nextId: number; units: Unit[]; cards: Stats[]; territory: Territory[]; charges: number; outcome: 'playing' | 'win' | 'loss'; started: boolean; events: string[];opening?:'clustered-v1';hand?:SeedCard[];nextSeedIndex?:number;player?:PlayerProgress };
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
export function enemyPositions(seed:number,configuration:StageConfig=DEFAULT_STAGE):{x:number;y:number}[] {
  const stage=stageConfig(configuration);
  if(!referenceStage(stage)){
    const random=rng((seed>>>0)^0x9E3779B9),cols=Math.ceil(Math.sqrt(stage.enemyCount*(stage.width-2.4)/(stage.height-2.4))),rows=Math.ceil(stage.enemyCount/cols),cw=(stage.width-2.4)/cols,ch=(stage.height-2.4)/rows;
    return Array.from({length:stage.enemyCount},(_,i)=>({x:1.2+(i%cols+.5)*cw+(random()-.5)*Math.min(.7,cw*.2),y:1.2+(Math.floor(i/cols)+.5)*ch+(random()-.5)*Math.min(1.4,ch*.2)}));
  }
  // Keep the user-tested entry board as a reference; new seeds vary the route.
  if((seed>>>0)===20261011)return [[4,2],[4,6],[6,4],[8,1],[8,7],[10,3],[10,6]].map(([x,y])=>({x,y}));
  const random=rng((seed>>>0)^0x9E3779B9);
  const anchors=[[3.9,2],[3.9,6],[6,4],[8,1],[8,7],[10,3],[10,6]];
  const mirrored=random()>.5;
  return anchors.map(([x,y])=>({x:x+(random()-.5)*.7,y:Math.max(.6,Math.min(HEIGHT-.6,(mirrored?HEIGHT-y:y)+(random()-.5)*1.4))}));
}
export function createState(seed = 20261011,configuration:StageConfig=DEFAULT_STAGE,supplyMode:'finite'|'endless'='finite',opening:Opening='legacy',reinforcement=true): State {
  if (!Number.isFinite(seed)) throw new Error('Seed must be finite');
  const stage=stageConfig(configuration),random = rng(seed);
  const state: State = {stage,supplyMode,supplyIndex:0,seed:seed>>>0,tick:0,nextId:1,units:[],cards:[],territory:[],charges:3,outcome:'playing',started:false,events:['敵の存在感Areaの外なら、どこでも最初の植物を配置できます。']};
  if(!['legacy','clustered-v1'].includes(opening)||opening==='clustered-v1'&&supplyMode!=='endless')throw new Error('Invalid opening');
  const positions=opening==='clustered-v1'?clusteredPositions(stage,rng((seed>>>0)^0x434C5553)):enemyPositions(seed,stage);
  for (const {x,y} of positions) state.units.push(unit(state,'enemy',x,y,makeStats(random)));
  // Preserve a legal refuge even at full maturation, without random retry loops.
  const corners=[[.3,.3],[stage.width-.3,.3],[.3,stage.height-.3],[stage.width-.3,stage.height-.3]];
  const matureMin=()=>Math.min(...corners.map(([x,y])=>state.units.reduce((sum,u)=>sum+PRESENCE_STRENGTH*distanceFalloff(Math.hypot(x-u.x,y-u.y),u.stats.presence*1.3),0)));
  for(let i=0;i<8&&matureMin()>PRESENCE_LIMIT;i++)for(const u of state.units)u.stats.presence=Math.max(.5,+(u.stats.presence*.9).toFixed(2));
  if(matureMin()>PRESENCE_LIMIT)throw new Error('Presence field has no refuge');
  if(!['finite','endless'].includes(supplyMode))throw new Error('Invalid supply mode');
  for(let i=0;i<(supplyMode==='finite'?INITIAL_CARDS:4);i++) state.cards.push(makeStats(random));
  if(opening==='clustered-v1'){
    state.opening=opening;if(reinforcement)state.player={policy:'hand-entry-v1',multipliers:baseMultipliers(),rewards:[]};state.hand=state.cards.map((baseStats,id)=>freezeSeed(state,id,baseStats));state.nextSeedIndex=4;
    const allyRandom=rng((seed>>>0)^0x414C4C59),enemies=[...state.units],mature=enemies.map(u=>({...u,age:117}));
    for(let i=0;i<initialAllyCount(stage.enemyCount);i++){
      const target=enemies[i],near=[...enemies].sort((a,b)=>Math.hypot(a.x-target.x,a.y-target.y)-Math.hypot(b.x-target.x,b.y-target.y)).slice(0,4),cx=near.reduce((n,u)=>n+u.x,0)/near.length,cy=near.reduce((n,u)=>n+u.y,0)/near.length,angle=Math.atan2(target.y-cy,target.x-cx),candidates=[] as {x:number;y:number}[];
      for(const distance of [5.8,6.6,7.4,8.2])for(let j=0;j<24;j++){const a=angle+j*Math.PI/12;candidates.push(generatedPoint({x:target.x+Math.cos(a)*distance,y:target.y+Math.sin(a)*distance}));}
      const legal=candidates.find(p=>validatePlacement(state,p.x,p.y).ok&&mature.reduce((sum,u)=>sum+presenceAt(u,p.x,p.y),0)<=PRESENCE_LIMIT&&state.units.every(u=>Math.hypot(u.x-p.x,u.y-p.y)>=.756));
      if(!legal)throw new Error('No experimental ally opening');const ally=unit(state,'ally',legal.x,legal.y,makeStats(allyRandom));ally.born=0;ally.initial=true;state.units.push(ally);
    }
    state.started=true;state.events=['初期味方から戦線を読み、中央下の手札を選んで配置できます。'];
  }
  return state;
}
export function seedStats(state:State,seedId?:number){return state.hand?(seedId===undefined?state.hand[0]:state.hand.find(c=>c.id===seedId))?.baseStats:state.cards[0];}
export function footprint(u: Unit) { return SEED_RADIUS + Math.min(u.age / 180, 0.65) * 0.12; }
export function insideTerritory(state: State, x: number, y: number): boolean {
  if(!Number.isFinite(x)||!Number.isFinite(y)||x<0||x>state.stage.width||y<0||y>state.stage.height)return false;
  return enemyPresenceAt(state,x,y)<=PRESENCE_LIMIT+EPSILON;
}
// Sampling is only for the percentage label; placement uses the analytic circle union.
export function territoryCoverage(state: State): number {
  let claimed=0;const nx=60,ny=45;
  for(let y=0;y<ny;y++)for(let x=0;x<nx;x++)if(insideTerritory(state,(x+.5)*state.stage.width/nx,(y+.5)*state.stage.height/ny))claimed++;
  return claimed/(nx*ny);
}
export function viewport(width:number,height:number,stage:StageConfig=DEFAULT_STAGE) {
  if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)throw new Error('Invalid viewport');
  const scale=Math.min(width/stage.width,height/stage.height);
  return {scale,ox:(width-stage.width*scale)/2,oy:(height-stage.height*scale)/2};
}
export function screenToWorld(px:number,py:number,width:number,height:number,stage:StageConfig=DEFAULT_STAGE) {
  const {scale,ox,oy}=viewport(width,height,stage);
  return {x:(px-ox)/scale,y:(py-oy)/scale};
}
export function clientToWorld(clientX:number,clientY:number,rect:{left:number;top:number;width:number;height:number},stage:StageConfig=DEFAULT_STAGE) {
  return screenToWorld(clientX-rect.left,clientY-rect.top,rect.width,rect.height,stage);
}
export function validatePlacement(state: State, x: number, y: number,seedId?:number): Placement {
  if(state.outcome!=='playing') return {ok:false,reason:'このステージは終了しました。新しい盤面を始められます。'};
  if(!Number.isFinite(x)||!Number.isFinite(y))return {ok:false,reason:'有効な位置を選んでください。'};
  if(x<SEED_RADIUS-EPSILON||x>state.stage.width-SEED_RADIUS+EPSILON||y<SEED_RADIUS-EPSILON||y>state.stage.height-SEED_RADIUS+EPSILON) return {ok:false,reason:'植物の円全体が盤面内に入る位置を選んでください。'};
  if(state.cards.length===0) return {ok:false,reason:'今回の芽は使い切りました。残った植物を観察するか、同じseedで再挑戦できます。'};
  if(state.hand&&!seedStats(state,seedId))return {ok:false,reason:'この芽は手札にありません。選び直してください。'};
  if(state.charges<1) return {ok:false,reason:'配置力が足りません。時間を進めると補充されます。'};
  if(state.units.some(u=>Math.hypot(u.x-x,u.y-y)<footprint(u)+SEED_RADIUS-EPSILON)) return {ok:false,reason:'植物の円が重なっています。少し離して配置してください。'};
  if(!insideTerritory(state,x,y)) return {ok:false,reason:'敵の存在感合計が閾値を超えています。'};
  return {ok:true,reason:'配置できます。'};
}
export function place(state: State,x:number,y:number,seedId?:number): Placement {
  const result=validatePlacement(state,x,y,seedId); if(!result.ok)return result;
  let stats:Stats,chosen:number|undefined,frozen:FrozenSeed|undefined;if(state.hand){const i=seedId===undefined?0:state.hand.findIndex(c=>c.id===seedId),card=state.hand.splice(i,1)[0];stats=card.baseStats;chosen=card.id;frozen=card.snapshot;const id=state.nextSeedIndex!;state.nextSeedIndex=id+1;state.hand.push(freezeSeed(state,id));state.cards=state.hand.map(c=>({...c.baseStats}));}else stats=state.cards.shift()!;
  const index=state.supplyIndex++;const ally=unit(state,'ally',x,y,stats);if(state.supplyMode==='endless'){ally.born=state.tick;ally.supplyIndex=index;if(state.hand){ally.seedIndex=chosen;if(frozen)ally.seedSnapshot=structuredClone(frozen);}else state.cards.push(supplyStats(state.seed,state.stage,state.supplyIndex+3));}state.units.push(ally); state.charges--; state.started=true;
  event(state,`植物を配置 (${x.toFixed(2)}, ${y.toFixed(2)})。射程円を見ながら進めてみましょう。`);
  expand(state); return result;
}
export function growth(u: Unit) { return 0.65 + Math.min(u.age/180,0.65); }
export function effectiveRange(u: Unit) { return u.stats.range * growth(u); }
export function attackDamage(u:Unit,target:Unit):number {
  const distance=Math.hypot(u.x-target.x,u.y-target.y),range=effectiveRange(u);
  return u.stats.power*growth(u)*distanceFalloff(distance,range);
}
export function chooseTarget(u: Unit, units: Unit[]): Unit | undefined {
  return units.filter(v=>v.team!==u.team&&v.hp>0&&Math.hypot(v.x-u.x,v.y-u.y)<effectiveRange(u)*2-EPSILON).sort((a,b)=>{
    const score=(v:Unit)=>presenceAt(v,u.x,u.y);
    return score(b)-score(a)||a.id-b.id;
  })[0];
}
export function placementForecast(s:State,x:number,y:number,seedId?:number):PlacementForecast|undefined {
  if(!validatePlacement(s,x,y,seedId).ok)return undefined;
  const stats=seedStats(s,seedId)!,seed:Unit={id:s.nextId,team:'ally',x,y,hp:stats.vitality,maxHp:stats.vitality,age:0,cooldown:0,stats,target:null};
  const others=[...s.units,seed];const target=chooseTarget(seed,others);
  const grown={...seed,age:224};const grownTarget=chooseTarget(grown,others);
  const incoming=s.units.filter(u=>u.team==='enemy'&&chooseTarget(u,others)?.id===seed.id);
  // Retired friendly-claim forecast: placement no longer creates legal territory.
  const note=target?`今、敵 #${target.id} に攻撃が届きます。`:grownTarget?`育つと敵 #${grownTarget.id} に届く位置です。`:'今の位置では育っても敵に届きません。別の位置を試せます。';
  return {targetId:target?.id??null,damage:target?attackDamage(seed,target):0,grownTargetId:grownTarget?.id??null,incomingIds:incoming.map(u=>u.id),incomingDamage:incoming.reduce((sum,u)=>sum+attackDamage(u,seed),0),newArea:0,note};
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
    const readyInTicks=REFILL_TICKS-s.tick%REFILL_TICKS;
    return {kind:'supply',readyInTicks,text:`配置力0 · 定期補充まで${(readyInTicks/10).toFixed(1)}ゲーム秒 · 敵攻略でも＋1`};
  }
  if(s.outcome==='playing'&&s.started&&s.cards.length>0&&s.cards.length<=3)return {kind:'last-cards',readyInTicks:0,text:`残り${s.cards.length}芽 · 育った射程（破線）が残敵へ届く位置を確認`};
  return {kind:'other',text:'',readyInTicks:0};
}
export type ResultDiagnosis={kind:'unreachable'|'defeated'|'manual'|'win';message:string;suggestion:string;enemyId?:number;allyId?:number;distance?:number;range?:number;gap?:number};
export function resultDiagnosis(s:State):ResultDiagnosis|undefined {
  if(s.outcome==='playing')return undefined;
  if(s.outcome==='win')return {kind:'win',message:'全ての敵を攻略しました。',suggestion:'同じseedで別の広げ方や、新しいseedを試せます。'};
  const enemies=s.units.filter(u=>u.team==='enemy'),allies=s.units.filter(u=>u.team==='ally');
  const remainingText=s.supplyMode==='endless'?`敵${enemies.length}体が残っています。`:`敵${enemies.length}体、未配置の芽${s.cards.length}体が残っています。`;
  if(s.events[0]?.startsWith('今回はここまで。'))return {kind:'manual',message:`自分でrunを区切りました。${remainingText}`,suggestion:'ここまでの広げ方を手がかりに、同じseedで再挑戦できます。'};
  if(allies.length===0&&s.cards.length===0)return {kind:'defeated',message:'芽を使い切り、味方の植物が残っていません。',suggestion:'次は配置前の赤い線で狙われ方を見て、味方同士の射程が重なる位置も試せます。'};
  if(stalled(s)&&allies.length&&enemies.length){
    const pairs=enemies.flatMap(e=>allies.map(a=>{const distance=Math.hypot(e.x-a.x,e.y-a.y),range=effectiveRange(a)*2;return {enemyId:e.id,allyId:a.id,distance,range,gap:Math.max(0,distance-range)};}));
    pairs.sort((a,b)=>a.gap-b.gap||a.enemyId-b.enemyId||a.allyId-b.allyId);const pair=pairs[0];
    return {kind:'unreachable',...pair,message:`芽を使い切り、残った敵${enemies.length}体に味方の攻撃が届いていません。敵 #${pair.enemyId} と味方 #${pair.allyId} の距離は${pair.distance.toFixed(2)}、味方の射程は${pair.range.toFixed(2)}です。`,suggestion:'次はこの敵への中継に最後の芽を残し、育った射程の破線が届く位置を確認してみましょう。'};
  }
  return {kind:'manual',message:remainingText,suggestion:'結果の盤面から、次に狙う敵や広げる方向を選べます。'};
}
function event(s:State,message:string) { s.events.unshift(message);s.events=s.events.slice(0,5); }
export function finishRun(s:State):boolean {
  if(s.outcome!=='playing'||!s.started)return false;
  s.outcome='loss';event(s,'今回はここまで。広げた領域を眺めて、同じseedで別の広げ方も試せます。');return true;
}
function expand(s:State) {
  if(s.supplyMode==='endless')return;
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
  if(s.tick%REFILL_TICKS===0&&s.cards.length>0) s.charges=Math.min(5,s.charges+1);
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
    if(dead.team==='enemy') {if(s.player&&!s.player.rewards.some(r=>r.enemyId===dead.id)){s.player.rewards.push({enemyId:dead.id,tick:s.tick});s.player.rewards.sort((a,b)=>a.tick-b.tick||a.enemyId-b.enemyId);const key=dominant(dead.stats);s.player.multipliers[key]=+(s.player.multipliers[key]+KILL_BOOST).toFixed(2);const name={power:'攻撃',range:'射程',presence:'存在感距離',vitality:'生命'}[key];event(s,`${name}型を攻略 · 次に手札へ入る芽の${name}倍率 ×${s.player.multipliers[key].toFixed(2)}（仮）`);}s.charges=Math.min(5,s.charges+1);s.territory.push({id:dead.id,x:dead.x,y:dead.y,radius:1.8});}
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

export function stageProgress(s:State){const remaining=s.units.filter(u=>u.team==='enemy').length;return {total:s.stage.enemyCount,remaining,defeated:s.stage.enemyCount-remaining};}

/** Indexed supply has bounded work even very late in a run. First 18 match legacy generation. */
export function supplyStats(seed:number,stage:StageConfig,index:number):Stats {
 if(!Number.isSafeInteger(index)||index<0)throw new Error('Invalid supply index');
 if(index<INITIAL_CARDS){const random=rng(seed);for(let i=0;i<stage.enemyCount+index;i++)makeStats(random);return makeStats(random);}
 const low=index>>>0,high=Math.floor(index/4294967296)>>>0,hash=(seed^Math.imul(stage.enemyCount,0x9e3779b9)^Math.imul(low,0x85ebca6b)^Math.imul(high,0xc2b2ae35))>>>0;
 return makeStats(rng(hash));
}
