import {bodyRadius,zeros,type Seed} from './eco-contract.js';
import {WORLD,ECO_LIMITS,TICK_SECONDS,DRAW_SECONDS,TURN_SECONDS,GROWTH_PER_SECOND,PRESENCE_STRENGTH,PRESENCE_LIMIT,falloff,currentStats,targetFor,damageFor,type State,type Unit} from './eco-sim.js';

export type Point={x:number;y:number};
export type Space={kind:'found';point:Point;checked:number}|{kind:'blocked';cause:'body'|'presence'|'mixed'|'bounds';checked:number}|{kind:'unknown';checked:number};
type Circle=Point&{radius:number;enemy:boolean;presence:number};
export function findPlantSpace(state:State,diameter=8,options:{preferred?:Point;maxNodes?:number}={}):Space{
 const margin=bodyRadius(diameter),xmin=margin,xmax=WORLD.width-margin,ymin=margin,ymax=WORLD.height-margin;
 if(xmin>xmax||ymin>ymax)return {kind:'blocked',cause:'bounds',checked:0};
 const circles:Circle[]=state.units.map(u=>({x:u.x,y:u.y,radius:bodyRadius(u.diameter)+margin,enemy:u.team==='enemy',presence:u.team==='enemy'?currentStats(u).presence:0}));let checked=0;
 const legal=(p:Point)=>{checked++;return p.x>=xmin&&p.x<=xmax&&p.y>=ymin&&p.y<=ymax&&!circles.some(c=>Math.hypot(c.x-p.x,c.y-p.y)<c.radius-1e-6)&&circles.filter(c=>c.enemy).reduce((n,c)=>n+PRESENCE_STRENGTH*falloff(Math.hypot(c.x-p.x,c.y-p.y),c.presence),0)<=PRESENCE_LIMIT+1e-9;};
 if(options.preferred){const focus=options.preferred;if(legal(focus))return {kind:'found',point:{...focus},checked};const nearest=[...circles].filter(c=>c.enemy).sort((a,b)=>Math.hypot(a.x-focus.x,a.y-focus.y)-Math.hypot(b.x-focus.x,b.y-focus.y))[0];if(nearest){for(const factor of [1.3,1.6,2.1])for(let i=0;i<16;i++){const a=Math.PI+i*Math.PI/8,r=Math.max(nearest.radius,nearest.presence*factor),point={x:nearest.x+Math.cos(a)*r,y:nearest.y+Math.sin(a)*r};if(legal(point))return {kind:'found',point,checked};}}}
 type Box={x0:number;x1:number;y0:number;y1:number;depth:number};const pending:Box[]=[{x0:xmin,x1:xmax,y0:ymin,y1:ymax,depth:0}],budget=Math.max(0,Math.min(4096,Math.floor(options.maxNodes??4096)));let nodes=0,unresolved=false,bodyBlocked=false,presenceBlocked=false;
 while(pending.length&&nodes++<budget){const b=pending.pop()!,farthest=(c:Circle)=>Math.hypot(Math.max(Math.abs(c.x-b.x0),Math.abs(c.x-b.x1)),Math.max(Math.abs(c.y-b.y0),Math.abs(c.y-b.y1)));
  if(circles.some(c=>farthest(c)<c.radius-1e-6)){bodyBlocked=true;continue;}
  const lower=circles.filter(c=>c.enemy).reduce((n,c)=>n+PRESENCE_STRENGTH*falloff(farthest(c),c.presence),0);if(lower>PRESENCE_LIMIT+1e-9){presenceBlocked=true;continue;}
  const cx=(b.x0+b.x1)/2,cy=(b.y0+b.y1)/2;for(const point of [{x:cx,y:cy},{x:b.x0,y:b.y0},{x:b.x0,y:b.y1},{x:b.x1,y:b.y0},{x:b.x1,y:b.y1}])if(legal(point))return {kind:'found',point,checked};
  if(b.depth>=24||Math.max(b.x1-b.x0,b.y1-b.y0)<.25){unresolved=true;continue;}if(b.x1-b.x0>=b.y1-b.y0){pending.push({...b,x0:cx,depth:b.depth+1},{...b,x1:cx,depth:b.depth+1});}else pending.push({...b,y0:cy,depth:b.depth+1},{...b,y1:cy,depth:b.depth+1});
 }
 if(pending.length||unresolved)return {kind:'unknown',checked};return {kind:'blocked',cause:bodyBlocked&&presenceBlocked?'mixed':bodyBlocked?'body':'presence',checked};
}
export function futureMergePossible(s:State){for(let i=0;i<s.units.length;i++)for(let j=i+1;j<s.units.length;j++){const a=s.units[i],b=s.units[j],ad=Math.max(a.diameter,ECO_LIMITS.naturalDiameter),bd=Math.max(b.diameter,ECO_LIMITS.naturalDiameter);if(a.team===b.team&&a.lineage.length+b.lineage.length<=ECO_LIMITS.lineage&&Math.sqrt(a.diameter**2+b.diameter**2)<=ECO_LIMITS.diameter&&Math.hypot(a.x-b.x,a.y-b.y)<=bodyRadius(ad)+bodyRadius(bd)+1e-6)return true;}return false;}
export function canGrow(s:State){return s.units.some(u=>{if(u.diameter>=ECO_LIMITS.naturalDiameter)return false;return !s.units.some(v=>v.team!==u.team&&Math.hypot(u.x-v.x,u.y-v.y)<=bodyRadius(u.diameter)+bodyRadius(v.diameter)+1e-6);});}
function battleActivity(s:State){const attacks=s.units.map(u=>({u,target:targetFor(u,s.units)})).filter(a=>a.target&&damageFor(a.u,a.target)>0),burst=new Map<number,number>();for(const a of attacks)burst.set(a.target!.id,(burst.get(a.target!.id)??0)+damageFor(a.u,a.target!));const canChange=attacks.some(a=>{const target=a.target!,damage=burst.get(target.id)!;return target.hp<=damage||currentStats(target).regen*TICK_SECONDS<damage-1e-6;});return {attacks:attacks.length,canChange};}
export type Guidance={kind:'terminal'|'recover'|'supply'|'ready'|'blocked'|'unknown'|'idle';text:string;canAdvance:boolean;space?:Space;waitSeconds?:number;combat:boolean;growing:boolean};
export function gardenGuidance(s:State):Guidance{
 const combat=battleActivity(s),growing=canGrow(s),merge=futureMergePossible(s),resourceFuture=(s.hand.length<ECO_LIMITS.hand&&s.nextCard<ECO_LIMITS.generations)||s.charges<ECO_LIMITS.charges;
 const base={combat:combat.attacks>0,growing},canAdvance=growing||merge||combat.canChange||resourceFuture;
 if(s.outcome!=='playing')return {...base,kind:'terminal',text:s.outcome==='win'?'この庭の敵を攻略しました。':'この庭の観察を終了しました。',canAdvance:false};
 const space=findPlantSpace(s,s.hand[0]?.seed.initialDiameter??8);
 if(s.units.length>=ECO_LIMITS.units||space.kind==='blocked'){const release=combat.canChange||merge;return {...base,kind:'blocked',space,canAdvance:release,text:release?'いまは置ける場所がありません。戦闘や合体で空きができるか観察できます。':'この盤面では今の植物を置けません。待つだけでは空きが増えないため停止します。庭を見直すか、今回の観察を終了できます。'};}
 if(space.kind==='unknown')return {...base,kind:'unknown',space,canAdvance,text:'置ける場所をまだ特定できません。細い隙間を手動で探せます。配置不能とは判定していません。'};
 const missingHand=s.hand.length===0,missingCharge=s.charges===0;
 if(missingHand||missingCharge){const drawWait=missingHand&&s.nextCard<ECO_LIMITS.generations?(1-s.drawProgress)*DRAW_SECONDS/s.player.drowHeist:missingHand?Infinity:0,turnWait=missingCharge?(1-s.turnProgress)*TURN_SECONDS/s.player.turnHeist:0,seconds=Math.max(drawWait,turnWait);return {...base,kind:'supply',space,waitSeconds:seconds,canAdvance:Number.isFinite(seconds)||growing||combat.canChange||merge,text:Number.isFinite(seconds)?`置ける場所は残っています。手札・配置力がそろうまで約${seconds.toFixed(1)}ゲーム秒。`:'この試作の手札生成上限です。現在の植物を観察するか、この庭を終了できます。'};}
 if(!s.units.some(u=>u.team==='ally'))return {...base,kind:'recover',space,canAdvance,text:'味方はいなくなりましたが、手札と置ける場所が残っています。再配置で続けられます。'};
 if(!canAdvance)return {...base,kind:'idle',space,canAdvance:false,text:combat.attacks?'現在の攻撃は回復を越えられず、待つだけでは進みません。配置を変えて戦力を足せます。':'成長と供給が止まっています。待つだけでは変化しません。手札から次の配置を考えましょう。'};
 return {...base,kind:'ready',space,canAdvance,text:combat.attacks?'戦闘が進んでいます。別の方向から支援するか、合体まで育てるか考えられます。':'手札を置けます。植物が育つと身体と射程が広がります。'};
}
export function placementPreview(s:State,x:number,y:number,seed:Seed){const probe:Unit={id:s.nextId,team:'ally',x,y,seed,born:s.tick,age:0,diameter:seed.initialDiameter,hp:1,attackProgress:0,bonus:{elements:zeros(),hp:0,regen:0},lineage:[s.nextId],enemyOrigins:[]};probe.hp=currentStats(probe).maxHp;const target=targetFor(probe,s.units),combined=[...s.units,probe],incoming=s.units.filter(u=>u.team==='enemy'&&targetFor(u,combined)?.id===probe.id);return {target:target?.id??null,damage:target?damageFor(probe,target):0,incoming:incoming.map(u=>u.id),futureRange:currentStats({...probe,diameter:ECO_LIMITS.naturalDiameter}).range};}
