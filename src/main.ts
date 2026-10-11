import Phaser from 'phaser';
import {createState,place,validatePlacement,step,Clock,WIDTH,HEIGHT,growth,effectiveRange,dominant,footprint,SEED_RADIUS,territoryCoverage,viewport,screenToWorld,clientToWorld,placementForecast,chooseTarget,insideTerritory,finishRun,runActivity,decisionHint,resultDiagnosis,enemyPresenceAt,PRESENCE_LIMIT,REFILL_TICKS,type Stats} from './sim';
import './style.css';
import {TapGesture,ForegroundGate,canvasSize,EventSkip} from './runtime';
import {RunStore,capture,type Action} from './session';
let state=createState(), clock=new Clock(), selected:number|null=null, hovered:{x:number;y:number}|null=null;
const taps=new TapGesture(),foreground=new ForegroundGate(),skip=new EventSkip();
const store=new RunStore({getItem:key=>window.localStorage.getItem(key),setItem:(key,value)=>window.localStorage.setItem(key,value)});
let actions:Action[]=[],savedTick=-1,lastAttemptTick=-1,saveFailed=false,saveNotice='端末に自動保存';
const loaded=store.read();
if(loaded.kind==='loaded'){state=loaded.state;actions=loaded.save.actions;clock.speed=loaded.save.speed;savedTick=state.tick;saveNotice='保存runを停止状態で復元';}
else if(loaded.kind==='invalid')saveNotice='旧ルールまたは不明な保存です。元データは保持しています。新seedまたは入力seedで始めると、元データを退避して保存を再開します。';
else if(loaded.kind==='unavailable')saveNotice='この環境では端末保存を利用できません。';
if(loaded.kind==='invalid'||loaded.kind==='unavailable')saveFailed=true;
function persist(replace=false,force=false){
  if(!replace&&!force&&lastAttemptTick===state.tick)return;
  const ok=store.write(capture(state,clock.speed,actions),replace);lastAttemptTick=state.tick;saveFailed=!ok;
  if(ok){savedTick=state.tick;saveNotice='● 保存済み · 再開は停止状態';}
  else {clock.suspend();taps.cancel();hovered=null;saveNotice=store.protectedSave?'保存を利用できないため停止しました。以前のデータは保持しています。新seed/入力seedで始めると退避して保存を試せます。':'保存に失敗したため停止しました。現在の盤面はこの画面に残っています。再読込すると最後の保存へ戻ります。時間を進めるボタンで保存を再試行します。';}
  const label=document.getElementById('save-status');if(label){label.textContent=saveNotice;label.classList.toggle('save-error',saveFailed);label.setAttribute('role',saveFailed?'alert':'status');}
}
const palette={power:0xec8a62,range:0x80c9e4,presence:0xc1a1eb,vitality:0x9ecf74};
const labels={power:'攻撃',range:'射程',presence:'存在感距離',vitality:'生命'};
document.querySelector('#app')!.innerHTML=`<header><div><small>配置と観察の小さな試作</small><h1>Morishi <span>芽を置いて、領域を広げる。</span></h1></div><button id="restart">新seedで始める</button></header><nav class="tabs"><button data-pane="left">配置・味方</button><button data-pane="board" class="active">盤面</button><button data-pane="right">敵・観察</button></nav><main data-pane="board"><aside id="left"><h2>次に植える植物</h2><div id="card"></div><details class="help"><summary>配置の見方</summary><p class="hint">敵存在感の合計が閾値以下の場所の自由な位置をタップで配置。敵の近くほど戦闘に届きやすく、存在感Areaと射程は別です。</p><p class="hint">進行24秒で配置力＋1（最大5）。敵攻略でも＋1。次の3体は公開されています。</p></details><h2>配置の準備</h2><div id="supply"></div><progress id="refill" max="240" value="0"></progress><p id="refill-info" class="hint"></p><div id="future"></div><h2>選んだ植物</h2><div id="selection">盤面の植物を選ぶと能力と射程を表示します。</div></aside><section id="center"><div class="board-header"><span id="status"></span><span id="coverage"></span></div><div id="activity" class="activity-hint"></div><div id="board"></div><div id="preview" class="preview-status">スナップなしの自由配置</div><div id="forecast" class="forecast-panel">カーソルを動かすと、攻撃の届き方と狙われ方を確認できます。</div><div id="run-result" class="run-result" hidden></div><div id="message" role="status" aria-live="polite"></div><div class="controls"><button id="play" class="primary">▶ 時間を進める</button><button id="tick">1 Tick</button><button id="skip">変化まで</button><button id="finish" class="quiet">今回を終える</button><label>速度 <select id="speed"><option value="1">1×</option><option value="2">2×</option><option value="4">4×</option></select></label></div><div class="legend"><span>● 攻撃</span><span>◆ 射程</span><span>✦ 存在感</span><span>■ 生命</span><span>赤い面＝存在感合計＞1.5</span><span>外周＝成長 · 棒の長さ＝耐久</span></div><p class="hint">敵は全て初期配置済み。実線円は等倍射程、破線円は減衰限界。赤い面は配置不可Area。遠い相手への攻撃は弱くなります。</p></section><aside id="right"><h2>盤面を読む</h2><div id="enemies"><p id="enemy-count"></p><div id="enemy-list"></div></div><h2>最近のできごと</h2><div id="events"></div><h2>この試作でできること</h2><p class="hint">配置 → 成長と戦闘を観察 → 停止して考える → 存在感の低い場所へ配置。</p><p class="hint">成長すると見た目と射程が広がります。色と形は能力の配分から決まり、種族の固定データはありません。</p><label class="seed-label">生成seed <input id="seed" value="20261011" inputmode="numeric"></label><button id="same">入力seedで始める</button><p class="hint">生成後に乱数は使用しません。合体・属性・デッキ育成はこの版では未実装です。</p></aside></main><footer>ローカル試作 · まずは浅く楽しめる配置と領域の変化を確かめる</footer>`;
const $=(id:string)=>document.getElementById(id)!;
$('activity').after(document.querySelector('.controls')!);
const selectedPanel=document.createElement('section');selectedPanel.id='selected-panel';selectedPanel.append($('selection').previousElementSibling!,$('selection'));$('left').prepend(selectedPanel);
const escape=(text='')=>text.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const enemyButtons=new Map<number,{button:HTMLButtonElement;name:HTMLSpanElement;hp:HTMLSpanElement}>();
function html(id:string,value:string){if($(id).innerHTML!==value)$(id).innerHTML=value;}
function refreshEnemyList(){
  const enemies=state.units.filter(u=>u.team==='enemy');
  $('enemy-count').textContent=`敵 ${enemies.length}体 / 味方 ${state.units.filter(u=>u.team==='ally').length}体`;
  const alive=new Set(enemies.map(u=>u.id));
  for(const [id,entry] of enemyButtons)if(!alive.has(id)){entry.button.remove();enemyButtons.delete(id);}
  for(const enemy of enemies){
    let entry=enemyButtons.get(enemy.id);
    if(!entry){const button=document.createElement('button'),name=document.createElement('span'),hp=document.createElement('span');button.className='enemy';name.className='enemy-name';button.append(name,hp);button.onclick=()=>{selected=enemy.id;$('left').scrollTop=0;refresh();};$('enemy-list').append(button);entry={button,name,hp};enemyButtons.set(enemy.id,entry);}
    entry.name.textContent=`#${enemy.id} ${labels[dominant(enemy.stats)]}型`;entry.hp.textContent=`HP ${Math.ceil(enemy.hp)}`;entry.button.setAttribute('aria-pressed',String(selected===enemy.id));
  }
}
function statsHtml(s:Stats){return `<div class="stats"><span>攻撃 <b>${s.power.toFixed(1)}</b></span><span>射程 <b>${s.range.toFixed(1)}</b></span><span>存在感距離 <b>${s.presence.toFixed(1)}</b></span><span>生命 <b>${s.vitality}</b></span></div>`;}
function refresh(){
  $('card').innerHTML=state.cards[0]?`<div class="plant-card"><strong>${labels[dominant(state.cards[0])]}が得意な芽</strong>${statsHtml(state.cards[0])}</div>`:'今回の植物はすべて配置しました。';
  $('supply').textContent=`配置力 ${state.charges} / 5 · 残りの芽 ${state.cards.length}`;
  ($('refill') as HTMLProgressElement).value=state.charges>=5?REFILL_TICKS:state.tick%REFILL_TICKS;
  $('refill-info').textContent=!state.cards.length?'残りの芽はありません。':state.charges>=5?'配置力は満タンです。次の芽を配置できます。':!state.started?'最初の配置後に補充が始まります。':`次の補充まで ${((REFILL_TICKS-state.tick%REFILL_TICKS)/10).toFixed(1)}ゲーム秒${clock.paused?'（停止中）':''}`;
  $('future').innerHTML=state.cards.slice(1,4).map((s,i)=>`<div class="preview">次${i+1} · ${labels[dominant(s)]}型 · 攻${s.power.toFixed(0)} / 射${s.range.toFixed(1)}</div>`).join('');
  $('status').textContent=state.outcome==='win'?'攻略完了':state.outcome==='loss'?'再挑戦できます':`${clock.paused?'停止中':'進行中'} · ${(state.tick/10).toFixed(1)}秒 · seed ${state.seed}`;
  $('coverage').textContent=`配置可能 約${Math.round(territoryCoverage(state)*100)}%`;
  const hints={ready:'存在感が低い場所に最初の芽を置く',growing:'成長中 · 射程が広がる',fighting:'交戦中 · 味方の射程を重ねる','weak-combat':'射程の端で交戦中 · 前へ配置 / 今回を終える','needs-placement':'次の芽で、広がった領域をつなぐ',ended:state.outcome==='win'?'攻略完了':'広げた領域を、次の配置の手がかりに'};
  const decision=decisionHint(state);
  $('activity').textContent=decision.kind!=='other'?`${clock.paused?'停止中 · ':''}${decision.text}`:clock.paused&&state.started&&state.outcome==='playing'?'停止中 · 位置を動かして射程と広がりを確認':hints[runActivity(state)];
  $('skip').textContent=skip.active?'送り停止':'変化まで';
  ($('skip') as HTMLButtonElement).disabled=!state.started||state.outcome!=='playing';
  $('play').textContent=skip.active?'送り停止':clock.paused?'▶ 時間を進める':'Ⅱ 停止して考える';
  ($('play') as HTMLButtonElement).disabled=state.outcome!=='playing';
  ($('tick') as HTMLButtonElement).disabled=state.outcome!=='playing'||!clock.paused||!state.started;
  ($('finish') as HTMLButtonElement).disabled=state.outcome!=='playing'||!state.started;
  const u=state.units.find(u=>u.id===selected);
  selectedPanel.hidden=!u;
  $('selection').innerHTML=u?`<strong>${u.team==='ally'?'味方':'敵'} #${u.id} · ${labels[dominant(u.stats)]}型</strong>${statsHtml(u.stats)}<p>HP ${u.hp.toFixed(0)} / ${u.maxHp} · 現在の射程 ${effectiveRange(u).toFixed(1)}<br>成長倍率 ${growth(u).toFixed(2)}×</p>`:'植物をタップすると能力と射程を表示します。';
  refreshEnemyList();
  $('events').innerHTML=state.events.map(e=>`<p class="event">${escape(e)}</p>`).join('');
  $('run-result').hidden=state.outcome==='playing';
  if(state.outcome!=='playing'){
    const diagnosis=resultDiagnosis(state);
    html('run-result',`<strong>${state.outcome==='win'?'攻略完了！':'今回はここまで。'}</strong><p>配置可能 約${Math.round(territoryCoverage(state)*100)}% · 敵攻略 ${7-state.units.filter(u=>u.team==='enemy').length}/7体 · ${(state.tick/10).toFixed(1)}秒</p><p>${escape(diagnosis?.message??state.events[0])}</p><p class="hint">${escape(diagnosis?.suggestion)}</p><div>${diagnosis?.enemyId?'<button id="inspect-gap">味方の射程で確認</button>':''}<button id="retry-run">同じseedで再挑戦</button><button id="next-run">新seedで始める</button></div>`);
    if(diagnosis?.enemyId)$('inspect-gap').onclick=()=>{selected=diagnosis.allyId!;message(`味方 #${diagnosis.allyId} の射程円と敵 #${diagnosis.enemyId} の位置を比較できます。`);refresh();};
    $('retry-run').onclick=()=>reset(state.seed);$('next-run').onclick=()=>reset((state.seed+1)>>>0);
  }
}
function message(text:string){$('message').textContent=text;}
function reset(seed:number){skip.cancel();if(!Number.isInteger(seed)||seed<0||seed>4294967295){message('seedは0〜4294967295の整数を指定してください。');return;}state=createState(seed);clock=new Clock();actions=[];savedTick=lastAttemptTick=-1;persist(true);taps.cancel();foreground.interrupt(clock);hovered=null;selected=null;($('speed') as HTMLSelectElement).value='1';($('seed') as HTMLInputElement).value=String(seed);message('存在感が低い場所の自由な位置に配置して、時間を進めましょう。');refresh();}
$('restart').onclick=()=>reset((state.seed+1)>>>0);
$('same').onclick=()=>reset(Number(($('seed') as HTMLInputElement).value));
$('play').onclick=()=>{if(skip.active){skip.cancel();clock.suspend();persist(false,true);refresh();return;}if(state.outcome!=='playing'||document.hidden)return;if(saveFailed){persist(false,true);if(saveFailed){refresh();return;}}if(!state.started){message('最初の植物を配置してから時間を進められます。');return;}clock.paused=!clock.paused;refresh();};
$('skip').onclick=()=>{if(skip.active){skip.cancel();persist(false,true);refresh();return;}if(document.hidden)return;if(saveFailed){persist(false,true);if(saveFailed)return;}clock.suspend();skip.start(state);refresh();};
$('tick').onclick=()=>{skip.cancel();if(saveFailed){persist(false,true);if(saveFailed){refresh();return;}}if(clock.paused)step(state);persist();refresh();};
$('finish').onclick=()=>{skip.cancel();if(finishRun(state)){actions.push({tick:state.tick,kind:'finish'});lastAttemptTick=-1;persist();clock.suspend();message('ここまで広げた領域を残して、このrunを終えました。');refresh();}};
$('speed').onchange=()=>{clock.speed=Number(($('speed') as HTMLSelectElement).value);lastAttemptTick=-1;persist();};
document.querySelectorAll<HTMLButtonElement>('[data-pane]').forEach(b=>b.onclick=()=>{taps.cancel();document.querySelector('main')!.setAttribute('data-pane',b.dataset.pane!);document.querySelectorAll('[data-pane].active').forEach(t=>t.classList.remove('active'));b.classList.add('active');hovered=null;});
function interrupt(){skip.cancel();foreground.interrupt(clock);persist(false,true);taps.cancel();hovered=null;if(state.started&&state.outcome==='playing')message('画面を離れたため停止しました。戻ったら時間を進めるボタンで再開できます。');refresh();}
document.addEventListener('visibilitychange',()=>{if(document.hidden)interrupt();});
window.addEventListener('blur',interrupt);
window.addEventListener('pagehide',interrupt);
class Board extends Phaser.Scene {
  graphics!:Phaser.GameObjects.Graphics; textById=new Map<number,Phaser.GameObjects.Text>(); cell=40;ox=0;oy=0;elapsed=0;fieldTick=-1;fieldState=state;fieldRects:{x:number;y:number;width:number}[]=[];
  knownTerritory=new Set<number>();pulseState=state;pulses:{x:number;y:number;radius:number;time:number;captured:boolean}[]=[];viewTime=0;
  create(){
    this.graphics=this.add.graphics();
    const canvas=this.game.canvas;
    const point=(e:PointerEvent)=>{const rect=canvas.getBoundingClientRect();if(rect.width<=0||rect.height<=0)return null;return {position:clientToWorld(e.clientX,e.clientY,rect),key:`${rect.left},${rect.top},${rect.width},${rect.height}`};};
    const down=(e:PointerEvent)=>{if(document.hidden)return;const p=point(e);if(!p)return;hovered=p.position;taps.down(e.pointerId,e.clientX,e.clientY,e.timeStamp,p.key,e.isPrimary,e.button);};
    const outsideDown=(e:PointerEvent)=>{if(e.target!==canvas)taps.cancel();};
    const move=(e:PointerEvent)=>{if(e.pointerType==='mouse'&&e.buttons!==0&&e.buttons!==1)taps.cancel();taps.move(e.pointerId,e.clientX,e.clientY);const pos=e.target===canvas?point(e)?.position??null:null;hovered=pos&&state.units.some(u=>Math.hypot(u.x-pos.x,u.y-pos.y)<=footprint(u))?null:pos;};
    const cancel=()=>{taps.cancel();hovered=null;};
    const up=(e:PointerEvent)=>{
      if(!taps.tracking(e.pointerId))return;
      const p=point(e);if(!p||document.hidden){cancel();return;}
      const accepted=taps.up(e.pointerId,e.clientX,e.clientY,e.timeStamp,p.key);
      if(!accepted||e.button!==0){message('ドラッグや長押しでは配置しません。短くタップして配置できます。');return;}
      const pos=p.position;hovered=pos;if(skip.active){skip.cancel();persist(false,true);}
      const u=state.units.filter(u=>Math.hypot(u.x-pos.x,u.y-pos.y)<=footprint(u)).sort((a,b)=>Math.hypot(a.x-pos.x,a.y-pos.y)-Math.hypot(b.x-pos.x,b.y-pos.y)||a.id-b.id)[0];
      if(u){selected=u.id;$('left').scrollTop=0;hovered=null;message('選んだ植物の円が現在の射程です。');}
      else if(state.outcome==='playing'){if(saveFailed){persist(false,true);if(saveFailed){refresh();return;}}const result=place(state,pos.x,pos.y);if(result.ok){actions.push({tick:state.tick,kind:'place',x:pos.x,y:pos.y});lastAttemptTick=-1;persist();hovered=null;}message(result.ok?'自由な位置に配置しました。時間を進めると植物が育ちます。':result.reason);}
      else message('このrunは終了しています。植物の情報は確認できます。');
      refresh();
    };
    const leave=()=>{hovered=null;};const context=(e:Event)=>e.preventDefault();
    canvas.addEventListener('pointerdown',down);canvas.addEventListener('pointerleave',leave);canvas.addEventListener('contextmenu',context);
    window.addEventListener('pointerdown',outsideDown);window.addEventListener('pointermove',move);window.addEventListener('pointerup',up);window.addEventListener('pointercancel',cancel);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN,()=>{cancel();canvas.removeEventListener('pointerdown',down);canvas.removeEventListener('pointerleave',leave);canvas.removeEventListener('contextmenu',context);window.removeEventListener('pointerdown',outsideDown);window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);window.removeEventListener('pointercancel',cancel);});
  }
  update(_time:number,delta:number){this.viewTime=_time;if(!document.hidden){if(skip.active){const stopped=skip.chunk(state);if(stopped){persist(false,true);message('時間送り停止 · '+stopped);refresh();}}else clock.advance(state,foreground.frame(delta));}if(state.tick-lastAttemptTick>=10||(state.outcome!=='playing'&&lastAttemptTick!==state.tick))persist();this.elapsed+=delta;if(this.elapsed>150){refresh();this.elapsed=0;}this.draw();}
  draw(){
    if(this.scale.width<=0||this.scale.height<=0)return;
    const g=this.graphics;g.clear();const layout=viewport(this.scale.width,this.scale.height);this.cell=layout.scale;this.ox=layout.ox;this.oy=layout.oy;
    g.fillStyle(0x182a2c);g.fillRect(this.ox,this.oy,WIDTH*this.cell,HEIGHT*this.cell);
    g.fillStyle(0x294e43);g.fillRect(this.ox,this.oy,WIDTH*this.cell,HEIGHT*this.cell);
    for(const t of state.territory)g.fillCircle(this.ox+t.x*this.cell,this.oy+t.y*this.cell,t.radius*this.cell);
    if(this.pulseState!==state){this.pulseState=state;this.knownTerritory.clear();this.pulses=[];}
    for(const t of state.territory)if(!this.knownTerritory.has(t.id)){this.knownTerritory.add(t.id);this.pulses.push({x:t.x,y:t.y,radius:t.radius,time:this.viewTime,captured:!state.units.some(u=>u.id===t.id)});}
    this.pulses=this.pulses.filter(p=>this.viewTime-p.time<1500);
    // Cached contour of the summed field; exact placement never uses these samples.
    if(this.fieldState!==state||this.fieldTick!==state.tick){
      this.fieldState=state;this.fieldTick=state.tick;this.fieldRects=[];
      for(let yi=0;yi<72;yi++){let left=-1;for(let xi=0;xi<=96;xi++){
        const blocked=xi<96&&enemyPresenceAt(state,(xi+.5)*WIDTH/96,(yi+.5)*HEIGHT/72)>PRESENCE_LIMIT;
        if(blocked&&left<0)left=xi;
        if(!blocked&&left>=0){this.fieldRects.push({x:left*WIDTH/96,y:yi*HEIGHT/72,width:(xi-left)*WIDTH/96});left=-1;}
      }}
    }
    g.fillStyle(0x703d40,.6);for(const r of this.fieldRects)g.fillRect(this.ox+r.x*this.cell,this.oy+r.y*this.cell,r.width*this.cell+.5,HEIGHT/72*this.cell+.5);    g.lineStyle(1,0x6c8579);g.strokeRect(this.ox,this.oy,WIDTH*this.cell,HEIGHT*this.cell);
    for(const pulse of this.pulses){const age=(this.viewTime-pulse.time)/1500;const radius=pulse.radius*Math.min(1,.2+age*2);g.lineStyle(pulse.captured?3:2,pulse.captured?0xe4e6a4:0xa3e3b3,(1-age)*.75);g.strokeCircle(this.ox+pulse.x*this.cell,this.oy+pulse.y*this.cell,radius*this.cell);}
    if(hovered){const result=validatePlacement(state,hovered.x,hovered.y);const color=result.ok?0xb9e795:0xf0a194;const hx=this.ox+hovered.x*this.cell,hy=this.oy+hovered.y*this.cell;g.fillStyle(color,.18);g.fillCircle(hx,hy,SEED_RADIUS*this.cell);g.lineStyle(2,color);g.strokeCircle(hx,hy,SEED_RADIUS*this.cell);g.lineStyle(1,color,.35);if(state.cards[0])g.strokeCircle(hx,hy,state.cards[0].range*.65*this.cell);$('preview').textContent=`存在感 ${enemyPresenceAt(state,hovered.x,hovered.y).toFixed(2)} / ${PRESENCE_LIMIT.toFixed(1)} · ${result.reason}`;$('preview').classList.toggle('invalid',!result.ok);}
    else { $('preview').textContent=state.units.some(u=>u.id===selected)?`選択中 #${selected} · 実線＝等倍 / 破線＝減衰限界`:'自由配置 · 緑の円＝可 / 赤＝不可'; $('preview').classList.remove('invalid'); }
    const forecast=hovered?placementForecast(state,hovered.x,hovered.y):undefined;
    $('forecast').hidden=!forecast;
    if(forecast&&hovered){
      const hx=this.ox+hovered.x*this.cell,hy=this.oy+hovered.y*this.cell;
      const target=state.units.find(u=>u.id===(forecast.targetId??forecast.grownTargetId));
      if(target){const tx=this.ox+target.x*this.cell,ty=this.oy+target.y*this.cell;g.lineStyle(2,forecast.targetId?0xd6ee9d:0x85b9aa,.9);if(forecast.targetId)g.lineBetween(hx,hy,tx,ty);else for(let i=0;i<12;i+=2)g.lineBetween(hx+(tx-hx)*i/12,hy+(ty-hy)*i/12,hx+(tx-hx)*(i+1)/12,hy+(ty-hy)*(i+1)/12);}
      for(const id of forecast.incomingIds){const enemy=state.units.find(u=>u.id===id)!;g.lineStyle(1.5,0xf29c88,.7);g.lineBetween(this.ox+enemy.x*this.cell,this.oy+enemy.y*this.cell,hx,hy);}
      html('forecast',`<strong>${forecast.note}</strong><div>${forecast.targetId?`今の1撃 約${forecast.damage.toFixed(1)} · `:''}${forecast.incomingIds.length?`敵${forecast.incomingIds.length}体の標的候補（1巡 約${forecast.incomingDamage.toFixed(1)}）`:'今は敵から狙われません。'}</div><small> 線は今の攻撃 / 成長後の攻撃を示します。敵の現位置での目安です。</small>`);
    }else $('forecast').textContent=state.outcome!=='playing'?'下のボタンで同じseedの配置を試し直せます。':hovered?'配置できない位置です。存在感が低い場所の別の位置を選んでみましょう。':'カーソルを動かすと、攻撃の届き方と狙われ方を確認できます。';
    const aliveIds=new Set(state.units.map(u=>u.id));for(const [id,text] of this.textById)if(!aliveIds.has(id)){text.destroy();this.textById.delete(id);}
    for(const u of state.units){const x=this.ox+u.x*this.cell,y=this.oy+u.y*this.cell;
      if(u.id===selected){
        const limit=effectiveRange(u)*2*this.cell;
        g.lineStyle(1,0xd8e3df,.55);for(let i=0;i<32;i++){const a=i*Math.PI/16;g.beginPath();g.arc(x,y,limit,a,a+Math.PI/32);g.strokePath();}        g.lineStyle(1.5,u.team==='ally'?0xb9e795:0xefaaa0,.8);g.strokeCircle(x,y,effectiveRange(u)*this.cell);
      }
      const t=chooseTarget(u,state.units);if(t){g.lineStyle(u.id===selected?2:1,u.team==='ally'?0xd1e998:0xf09a85,u.id===selected?.85:.23);g.lineBetween(x,y,this.ox+t.x*this.cell,this.oy+t.y*this.cell);}
      const shot=u.lastShot;if(shot&&state.tick-shot.tick<3){g.lineStyle(2.5,u.team==='ally'?0xd1e998:0xf09a85,.9);const tx=this.ox+shot.x*this.cell,ty=this.oy+shot.y*this.cell;g.lineBetween(x,y,tx,ty);g.lineStyle(1.5,u.team==='ally'?0xd1e998:0xf09a85,.7);g.strokeCircle(tx,ty,.4*this.cell);}
      const r=this.cell*footprint(u),kind=dominant(u.stats);g.fillStyle(palette[kind]);
      if(kind==='power')g.fillCircle(x,y,r);else if(kind==='range')g.fillTriangle(x,y-r,x+r,y,x,y+r).fillTriangle(x,y-r,x-r,y,x,y+r);else if(kind==='vitality')g.fillRoundedRect(x-r*.7,y-r*.7,r*1.4,r*1.4,4);else{g.fillCircle(x,y,r*.7);g.fillTriangle(x,y-r,x-r*.5,y,x+r*.5,y);g.fillTriangle(x,y+r,x-r*.5,y,x+r*.5,y);g.fillTriangle(x-r,y,x,y-r*.5,x,y+r*.5);g.fillTriangle(x+r,y,x,y-r*.5,x,y+r*.5);}
      g.lineStyle(u.id===selected?3:1.5,u.team==='enemy'?0xeb877b:0xd4ebc6);g.strokeCircle(x,y,r);
      // Outer arc shows maturation, independently of team colour or dominant shape.
      const maturity=Math.min(1,u.age/117),arcRadius=r+3;
      g.lineStyle(1,0x607773,.7);g.strokeCircle(x,y,arcRadius);
      if(maturity>0){g.lineStyle(2,0xf0ead3,.9);g.beginPath();g.arc(x,y,arcRadius,-Math.PI/2,-Math.PI/2+maturity*Math.PI*2);g.strokePath();}
      // Absolute capacity uses one shared scale; fill is remaining HP, never growth.
      const hpWidth=Math.max(8,this.cell*.8*u.maxHp/220),hpLeft=x-hpWidth/2,hpY=y+r+8;
      g.fillStyle(0x0a1819);g.fillRect(hpLeft,hpY,hpWidth,4);g.fillStyle(u.team==='enemy'?0xeb877b:0xb9e795);g.fillRect(hpLeft,hpY,hpWidth*Math.max(0,u.hp/u.maxHp),4);
      g.lineStyle(1,0xc2d5d0,.65);g.strokeRect(hpLeft,hpY,hpWidth,4);
      let text=this.textById.get(u.id);if(!text){text=this.add.text(x,y-r-12,String(u.id),{color:'#c2d5d0'}).setOrigin(.5);this.textById.set(u.id,text);}text.setPosition(x,y-r-12).setFontSize(Math.max(9,this.cell*.23));
    }
  }
}
const game=new Phaser.Game({type:Phaser.AUTO,parent:'board',backgroundColor:'#101f21',scene:Board,scale:{mode:Phaser.Scale.NONE,width:600,height:450},render:{antialias:true},banner:false});
new ResizeObserver(entries=>{taps.cancel();const size=canvasSize(entries[0].contentRect.width,entries[0].contentRect.height);if(size){game.scale.resize(size.width,size.height);hovered=null;}}).observe($('board'));
const saveStatus=document.createElement('p');saveStatus.id='save-status';saveStatus.className=saveFailed?'hint save-error':'hint';saveStatus.textContent=saveNotice;saveStatus.setAttribute('role',saveFailed?'alert':'status');document.querySelector('header')!.after(saveStatus);
($('speed') as HTMLSelectElement).value=String(clock.speed);($('seed') as HTMLInputElement).value=String(state.seed);
refresh();message(loaded.kind==='loaded'?'保存したrunを復元しました。時間を進めるボタンで再開できます。':'存在感が低い場所の自由な位置に配置して、時間を進めましょう。');
