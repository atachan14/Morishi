import Phaser from 'phaser';
import {createState,place,validatePlacement,step,Clock,WIDTH,HEIGHT,growth,effectiveRange,dominant,footprint,SEED_RADIUS,territoryCoverage,viewport,screenToWorld,clientToWorld,type Stats} from './sim';
import './style.css';
let state=createState(), clock=new Clock(), selected:number|null=null, hovered:{x:number;y:number}|null=null;
const palette={power:0xec8a62,range:0x80c9e4,presence:0xc1a1eb,vitality:0x9ecf74};
const labels={power:'攻撃',range:'射程',presence:'存在感',vitality:'生命'};
document.querySelector('#app')!.innerHTML=`<header><div><small>配置と観察の小さな試作</small><h1>Morishi <span>芽を置いて、領域を広げる。</span></h1></div><button id="restart">新しい盤面</button></header><nav class="tabs"><button data-pane="left">配置・味方</button><button data-pane="board" class="active">盤面</button><button data-pane="right">敵・観察</button></nav><main data-pane="board"><aside id="left"><h2>次に植える植物</h2><div id="card"></div><p class="hint">明るい領域の自由な位置をタップで配置。敵の近くほど戦闘に届きやすく、味方を少し離して置くと領域が広がります。</p><h2>配置の準備</h2><div id="supply"></div><p class="hint">進行8秒で配置力＋1（最大5）。敵攻略でも＋1。次の3体は公開されています。</p><div id="future"></div><h2>選んだ植物</h2><div id="selection">盤面の植物を選ぶと能力と射程を表示します。</div></aside><section id="center"><div class="board-header"><span id="status"></span><span id="coverage"></span></div><div id="board"></div><div id="preview" class="preview-status">スナップなしの自由配置</div><div id="message" role="status" aria-live="polite"></div><div class="controls"><button id="play" class="primary">▶ 時間を進める</button><button id="tick">1 Tick</button><label>速度 <select id="speed"><option value="1">1×</option><option value="2">2×</option><option value="4">4×</option></select></label></div><div class="legend"><span>● 攻撃</span><span>◆ 射程</span><span>✦ 存在感</span><span>■ 生命</span><span>赤い輪＝敵</span></div><p class="hint">敵は全て初期配置済み。円は射程、線は狙っている相手。遠い相手への攻撃は弱くなります。</p></section><aside id="right"><h2>盤面を読む</h2><div id="enemies"></div><h2>最近のできごと</h2><div id="events"></div><h2>この試作でできること</h2><p class="hint">配置 → 成長と戦闘を観察 → 停止して考える → 新しい領域へ配置。</p><p class="hint">成長すると見た目と射程が広がります。色と形は能力の配分から決まり、種族の固定データはありません。</p><label class="seed-label">生成seed <input id="seed" value="20261011" inputmode="numeric"></label><button id="same">このseedでやり直す</button><p class="hint">生成後に乱数は使用しません。合体・属性・デッキ育成はこの版では未実装です。</p></aside></main><footer>ローカル試作 · まずは浅く楽しめる配置と領域の変化を確かめる</footer>`;
const $=(id:string)=>document.getElementById(id)!;
function statsHtml(s:Stats){return `<div class="stats"><span>攻撃 <b>${s.power.toFixed(1)}</b></span><span>射程 <b>${s.range.toFixed(1)}</b></span><span>存在感 <b>${s.presence.toFixed(1)}</b></span><span>生命 <b>${s.vitality}</b></span></div>`;}
function refresh(){
  $('card').innerHTML=state.cards[0]?`<div class="plant-card"><strong>${labels[dominant(state.cards[0])]}が得意な芽</strong>${statsHtml(state.cards[0])}</div>`:'今回の植物はすべて配置しました。';
  $('supply').textContent=`配置力 ${state.charges} / 5 · 残りの芽 ${state.cards.length}`;
  $('future').innerHTML=state.cards.slice(1,4).map((s,i)=>`<div class="preview">次${i+1} · ${labels[dominant(s)]}型 · 攻${s.power.toFixed(0)} / 射${s.range.toFixed(1)}</div>`).join('');
  $('status').textContent=state.outcome==='win'?'攻略完了':state.outcome==='loss'?'再挑戦できます':`${clock.paused?'停止中':'進行中'} · ${(state.tick/10).toFixed(1)}秒`;
  $('coverage').textContent=`領域 約${Math.round(territoryCoverage(state)*100)}%`;
  $('play').textContent=clock.paused?'▶ 時間を進める':'Ⅱ 停止して考える';
  ($('play') as HTMLButtonElement).disabled=state.outcome!=='playing';
  ($('tick') as HTMLButtonElement).disabled=state.outcome!=='playing'||!clock.paused||!state.started;
  const u=state.units.find(u=>u.id===selected);
  $('selection').innerHTML=u?`<strong>${u.team==='ally'?'味方':'敵'} #${u.id} · ${labels[dominant(u.stats)]}型</strong>${statsHtml(u.stats)}<p>HP ${u.hp.toFixed(0)} / ${u.maxHp} · 現在の射程 ${effectiveRange(u).toFixed(1)}<br>成長倍率 ${growth(u).toFixed(2)}×</p>`:'植物をタップすると能力と射程を表示します。';
  $('enemies').innerHTML=`<p>敵 ${state.units.filter(u=>u.team==='enemy').length}体 / 味方 ${state.units.filter(u=>u.team==='ally').length}体</p>`+state.units.filter(u=>u.team==='enemy').map(u=>`<button class="enemy" data-unit="${u.id}">#${u.id} ${labels[dominant(u.stats)]}型 <span>HP ${Math.ceil(u.hp)}</span></button>`).join('');
  $('events').innerHTML=state.events.map(e=>`<p class="event">${e}</p>`).join('');
  document.querySelectorAll<HTMLButtonElement>('[data-unit]').forEach(b=>b.onclick=()=>{selected=Number(b.dataset.unit);refresh();});
}
function message(text:string){$('message').textContent=text;}
function reset(seed:number){if(!Number.isInteger(seed)||seed<0||seed>4294967295){message('seedは0〜4294967295の整数を指定してください。');return;}state=createState(seed);clock=new Clock();selected=null;($('speed') as HTMLSelectElement).value='1';($('seed') as HTMLInputElement).value=String(seed);message('明るい左端に植物を配置して、時間を進めましょう。');refresh();}
$('restart').onclick=()=>reset((state.seed+1)>>>0);
$('same').onclick=()=>reset(Number(($('seed') as HTMLInputElement).value));
$('play').onclick=()=>{if(!state.started){message('最初の植物を配置してから時間を進められます。');return;}clock.paused=!clock.paused;refresh();};
$('tick').onclick=()=>{if(clock.paused)step(state);refresh();};
$('speed').onchange=()=>{clock.speed=Number(($('speed') as HTMLSelectElement).value);};
document.querySelectorAll<HTMLButtonElement>('[data-pane]').forEach(b=>b.onclick=()=>{document.querySelector('main')!.setAttribute('data-pane',b.dataset.pane!);document.querySelectorAll('[data-pane].active').forEach(t=>t.classList.remove('active'));b.classList.add('active');hovered=null;});
class Board extends Phaser.Scene {
  graphics!:Phaser.GameObjects.Graphics; textById=new Map<number,Phaser.GameObjects.Text>(); cell=40;ox=0;oy=0;elapsed=0;
  create(){
    this.graphics=this.add.graphics();
    this.input.on('pointermove',(p:Phaser.Input.Pointer)=>{hovered=this.coord(p);});
    this.input.on('pointerout',()=>{hovered=null;});
    this.input.on('pointerdown',(p:Phaser.Input.Pointer)=>{
      const pos=this.coord(p);if(!pos)return;hovered=pos;
      const u=state.units.filter(u=>Math.hypot(u.x-pos.x,u.y-pos.y)<=footprint(u)).sort((a,b)=>Math.hypot(a.x-pos.x,a.y-pos.y)-Math.hypot(b.x-pos.x,b.y-pos.y)||a.id-b.id)[0];
      if(u){selected=u.id;message('選んだ植物の円が現在の射程です。');}
      else{const result=place(state,pos.x,pos.y);message(result.ok?'自由な位置に配置しました。時間を進めると植物が育ちます。':result.reason);}
      refresh();
    });
  }
  coord(p:Phaser.Input.Pointer){
    const rect=this.game.canvas.getBoundingClientRect();if(rect.width<=0||rect.height<=0)return null;
    const ev=p.event;const touch='changedTouches' in ev?ev.changedTouches[0]:null;
    if(touch)return clientToWorld(touch.clientX,touch.clientY,rect);
    if('clientX' in ev)return clientToWorld(ev.clientX,ev.clientY,rect);
    return screenToWorld(p.x,p.y,this.scale.width,this.scale.height);
  }
  update(_time:number,delta:number){clock.advance(state,Math.min(delta,250));this.elapsed+=delta;if(this.elapsed>150){refresh();this.elapsed=0;}this.draw();}
  draw(){
    if(this.scale.width<=0||this.scale.height<=0)return;
    const g=this.graphics;g.clear();const layout=viewport(this.scale.width,this.scale.height);this.cell=layout.scale;this.ox=layout.ox;this.oy=layout.oy;
    g.fillStyle(0x182a2c);g.fillRect(this.ox,this.oy,WIDTH*this.cell,HEIGHT*this.cell);
    g.fillStyle(0x294e43);g.fillRect(this.ox,this.oy,2*this.cell,HEIGHT*this.cell);
    for(const t of state.territory)g.fillCircle(this.ox+t.x*this.cell,this.oy+t.y*this.cell,t.radius*this.cell);
    for(const u of state.units.filter(u=>u.team==='enemy')){g.fillStyle(0x382c2d);g.fillCircle(this.ox+u.x*this.cell,this.oy+u.y*this.cell,1.15*this.cell);g.lineStyle(1,0x81544d,.45);g.strokeCircle(this.ox+u.x*this.cell,this.oy+u.y*this.cell,1.15*this.cell);}
    g.lineStyle(1,0x6c8579);g.strokeRect(this.ox,this.oy,WIDTH*this.cell,HEIGHT*this.cell);
    if(hovered){const result=validatePlacement(state,hovered.x,hovered.y);const color=result.ok?0xb9e795:0xf0a194;const hx=this.ox+hovered.x*this.cell,hy=this.oy+hovered.y*this.cell;g.fillStyle(color,.18);g.fillCircle(hx,hy,SEED_RADIUS*this.cell);g.lineStyle(2,color);g.strokeCircle(hx,hy,SEED_RADIUS*this.cell);g.lineStyle(1,color,.35);if(state.cards[0])g.strokeCircle(hx,hy,state.cards[0].range*.65*this.cell);$('preview').textContent=`${hovered.x.toFixed(2)}, ${hovered.y.toFixed(2)} · ${result.reason}`;$('preview').classList.toggle('invalid',!result.ok);}
    else $('preview').textContent='スナップなしの自由配置 · 緑の円＝配置可 / 赤＝配置不可';
    const aliveIds=new Set(state.units.map(u=>u.id));for(const [id,text] of this.textById)if(!aliveIds.has(id)){text.destroy();this.textById.delete(id);}
    for(const u of state.units){const x=this.ox+u.x*this.cell,y=this.oy+u.y*this.cell;
      if(u.id===selected){g.lineStyle(1,u.team==='ally'?0xb9e795:0xefaaa0,.6);g.strokeCircle(x,y,effectiveRange(u)*this.cell);}
      const t=state.units.find(t=>t.id===u.target);if(t){g.lineStyle(u.id===selected?2:1,u.team==='ally'?0xaad794:0xd9897d,u.id===selected?.85:.23);g.lineBetween(x,y,this.ox+t.x*this.cell,this.oy+t.y*this.cell);}
      const r=this.cell*footprint(u),kind=dominant(u.stats);g.fillStyle(palette[kind]);
      if(kind==='power')g.fillCircle(x,y,r);else if(kind==='range')g.fillTriangle(x,y-r,x+r,y,x,y+r).fillTriangle(x,y-r,x-r,y,x,y+r);else if(kind==='vitality')g.fillRoundedRect(x-r*.7,y-r*.7,r*1.4,r*1.4,4);else{g.fillCircle(x,y,r*.7);g.fillTriangle(x,y-r,x-r*.5,y,x+r*.5,y);g.fillTriangle(x,y+r,x-r*.5,y,x+r*.5,y);g.fillTriangle(x-r,y,x,y-r*.5,x,y+r*.5);g.fillTriangle(x+r,y,x,y-r*.5,x,y+r*.5);}
      g.lineStyle(u.id===selected?3:1.5,u.team==='enemy'?0xeb877b:0xd4ebc6);g.strokeCircle(x,y,r);g.fillStyle(0x0a1819);g.fillRect(x-r,y+r+7,r*2,3);g.fillStyle(u.team==='enemy'?0xeb877b:0xb9e795);g.fillRect(x-r,y+r+7,r*2*u.hp/u.maxHp,3);
      let text=this.textById.get(u.id);if(!text){text=this.add.text(x,y-r-12,String(u.id),{color:'#c2d5d0'}).setOrigin(.5);this.textById.set(u.id,text);}text.setPosition(x,y-r-12).setFontSize(Math.max(9,this.cell*.23));
    }
  }
}
const game=new Phaser.Game({type:Phaser.AUTO,parent:'board',backgroundColor:'#101f21',scene:Board,scale:{mode:Phaser.Scale.RESIZE,width:600,height:450},render:{antialias:true},banner:false});
new ResizeObserver(entries=>{const {width,height}=entries[0].contentRect;if(width>0&&height>0){game.scale.resize(width,height);game.scale.refresh();hovered=null;}}).observe($('board'));
refresh();message('明るい左端に植物を配置して、時間を進めましょう。');
