import {DEFAULT_STAGE,COMPARISON_STAGE,PLAY_STAGE,type StageConfig} from './stage';
import type {Opening} from './opening';
import Phaser from 'phaser';
import {createState,place,validatePlacement,step,Clock,growth,effectiveRange,dominant,footprint,SEED_RADIUS,territoryCoverage,viewport,placementForecast,chooseTarget,insideTerritory,finishRun,runActivity,decisionHint,resultDiagnosis,stageProgress,enemyPresenceAt,PRESENCE_LIMIT,REFILL_TICKS,seedStats,type Stats,type Unit} from './sim';
import './style.css';
import {TapGesture,ForegroundGate,canvasSize,EventSkip} from './runtime';
import {RunStore,capture,type Action} from './session';
import {BoardCamera,introView,type View} from './camera';
import {presenceVisualKey,boardVisualKey} from './render-cache';
let camera=new BoardCamera(),introActive=false,introElapsed=0,introTarget:View={x:6,y:4.5,zoom:1};
let state=createState(20261011,undefined,'endless'), clock=new Clock(), selected:number|null=null, hovered:{x:number;y:number}|null=null;
const taps=new TapGesture(),foreground=new ForegroundGate(),skip=new EventSkip();
let selectedAlly:number|null=null,selectedEnemy:number|null=null,selectedSeed:number|null=null,armedSeed:number|null=null,lastCardPointer='';
const store=new RunStore({getItem:key=>window.localStorage.getItem(key),setItem:(key,value)=>window.localStorage.setItem(key,value)});
let actions:Action[]=[],savedTick=-1,lastAttemptTick=-1,saveFailed=false,saveNotice='端末に自動保存';
const loaded=store.read();
if(loaded.kind==='loaded'){state=loaded.state;actions=loaded.save.actions;clock.speed=loaded.save.speed;camera=new BoardCamera(loaded.save.view,state.stage);savedTick=state.tick;saveNotice='保存runを停止状態で復元';}
else if(loaded.kind==='invalid')saveNotice='旧ルールまたは不明な保存です。元データは保持しています。新seedまたは入力seedで始めると、元データを退避して保存を再開します。';
else if(loaded.kind==='unavailable')saveNotice='この環境では端末保存を利用できません。';
if(loaded.kind==='invalid'||loaded.kind==='unavailable')saveFailed=true;
introActive=loaded.kind==='empty';introTarget=introView(state);
selectedAlly=state.units.find(u=>u.initial)?.id??null;
function persist(replace=false,force=false){
  if(!replace&&!force&&lastAttemptTick===state.tick)return;
  const ok=store.write(capture(state,clock.speed,actions,camera.view),replace);lastAttemptTick=state.tick;saveFailed=!ok;
  if(ok){savedTick=state.tick;saveNotice='● 保存済み · 再開は停止状態';}
  else {clock.suspend();taps.cancel();hovered=null;saveNotice=store.protectedSave?'保存を利用できないため停止しました。以前のデータは保持しています。新seed/入力seedで始めると退避して保存を試せます。':'保存に失敗したため停止しました。現在の盤面はこの画面に残っています。再読込すると最後の保存へ戻ります。時間を進めるボタンで保存を再試行します。';}
  const label=document.getElementById('save-status');if(label){label.textContent=saveNotice;label.classList.toggle('save-error',saveFailed);label.setAttribute('role',saveFailed?'alert':'status');}
}
const palette={power:0xec8a62,range:0x80c9e4,presence:0xc1a1eb,vitality:0x9ecf74};
const labels={power:'攻撃',range:'射程',presence:'存在感距離',vitality:'生命'};
document.querySelector('#app')!.innerHTML=`<header><div><small>配置と観察の小さな試作</small><h1>Morishi <span>芽を置いて、領域を広げる。</span></h1></div><button id="restart">新seedで始める</button></header><nav class="tabs"><button data-pane="left">配置・味方</button><button data-pane="board" class="active">盤面</button><button data-pane="right">敵・観察</button></nav><main data-pane="board"><aside id="left"><h2>次に植える植物</h2><div id="card"></div><details class="help"><summary>配置の見方</summary><p class="hint">敵存在感の合計が閾値以下の場所の自由な位置をタップで配置。敵の近くほど戦闘に届きやすく、存在感Areaと射程は別です。</p><p class="hint">進行24秒で配置力＋1（最大5）。敵攻略でも＋1。次の3体は公開されています。</p></details><h2>配置の準備</h2><div id="supply"></div><progress id="refill" max="240" value="0"></progress><p id="refill-info" class="hint"></p><div id="future"></div><h2>選んだ植物</h2><div id="selection">盤面の植物を選ぶと能力と射程を表示します。</div></aside><section id="center"><div class="board-header"><span id="status"></span><span id="coverage"></span></div><div id="activity" class="activity-hint"></div><div id="board"></div><div id="preview" class="preview-status">スナップなしの自由配置</div><div id="forecast" class="forecast-panel">カーソルを動かすと、攻撃の届き方と狙われ方を確認できます。</div><div id="run-result" class="run-result" hidden></div><div id="message" role="status" aria-live="polite"></div><div class="controls"><button id="play" class="primary">▶ 時間を進める</button><button id="tick">1 Tick</button><button id="skip">変化まで</button><button id="finish" class="quiet">今回を終える</button><label>速度 <select id="speed"><option value="1">1×</option><option value="2">2×</option><option value="4">4×</option></select></label></div><div class="legend"><span>● 攻撃</span><span>◆ 射程</span><span>✦ 存在感</span><span>■ 生命</span><span>赤い面＝存在感合計＞1.5</span><span>外周＝成長 · 棒の長さ＝耐久</span></div><p class="hint">敵は全て初期配置済み。実線円は等倍射程、破線円は減衰限界。赤い面は配置不可Area。遠い相手への攻撃は弱くなります。</p></section><aside id="right"><h2>盤面を読む</h2><div id="enemies"><p id="enemy-count"></p><div id="enemy-list"></div></div><h2>最近のできごと</h2><div id="events"></div><h2>この試作でできること</h2><p class="hint">配置 → 成長と戦闘を観察 → 停止して考える → 存在感の低い場所へ配置。</p><p class="hint">成長すると見た目と射程が広がります。色と形は能力の配分から決まり、種族の固定データはありません。</p><label class="stage-label">検証用盤面<select id="stage"><option value="reference">基準 12×9・敵7体</option><option value="comparison">比較 36×27・敵24体</option></select></label><label class="seed-label">生成seed <input id="seed" value="20261011" inputmode="numeric"></label><button id="same">選択した盤面で始める</button><p class="hint">同じseedで供給順序も再現します。合体・属性・デッキ育成はこの版では未実装です。</p></aside></main><footer>ローカル試作 · まずは浅く楽しめる配置と領域の変化を確かめる</footer>`;
const $=(id:string)=>document.getElementById(id)!;
const playOption=document.createElement('option');playOption.value='play';playOption.textContent='遊び比較 72×54・疎密/初期味方3';$('stage').append(playOption);
function syncStageChoice(){const select=$('stage') as HTMLSelectElement;const matches=(s:StageConfig)=>s.width===state.stage.width&&s.height===state.stage.height&&s.enemyCount===state.stage.enemyCount;select.querySelector('option[value="current"]')?.remove();if(state.opening)select.value='play';else if(matches(DEFAULT_STAGE))select.value='reference';else if(matches(COMPARISON_STAGE))select.value='comparison';else{const option=document.createElement('option');option.value='current';option.textContent=`保存盤面 ${state.stage.width}×${state.stage.height}・敵${state.stage.enemyCount}体`;select.append(option);select.value='current';}}
function chosenStage(){const value=($('stage') as HTMLSelectElement).value;return value==='play'?PLAY_STAGE:value==='comparison'?COMPARISON_STAGE:value==='reference'?DEFAULT_STAGE:state.stage;}
function chosenOpening():Opening{return ($('stage') as HTMLSelectElement).value==='play'?'clustered-v1':'legacy';}
syncStageChoice();
const stageControls=document.createElement('section');stageControls.id='stage-controls';stageControls.append(document.querySelector('.stage-label')!,document.querySelector('.seed-label')!,$('same'));$('right').prepend(stageControls);
$('activity').after(document.querySelector('.controls')!);
const selectedPanel=document.createElement('section');selectedPanel.id='selected-panel';selectedPanel.append($('selection').previousElementSibling!,$('selection'));$('left').prepend(selectedPanel);
selectedPanel.className='pane-detail';
for(const id of ['left','right']){const rest=document.createElement('section');rest.className='pane-content';for(const child of Array.from($(id).childNodes))if(child!==selectedPanel)rest.append(child);$(id).append(rest);}
const enemyDetail=document.createElement('section');enemyDetail.id='enemy-detail';enemyDetail.className='pane-detail';enemyDetail.hidden=true;enemyDetail.innerHTML='<h2>敵の個体ステータス</h2><div id="enemy-selection">敵を選ぶと、能力と成長状態を確認できます。</div>';$('right').prepend(enemyDetail);
const handDock=document.createElement('section');handDock.id='hand-dock';handDock.hidden=true;handDock.innerHTML='<h2>手札</h2><div id="hand-list" class="hand-grid"></div><div class="placement-mode"><span id="placement-state" role="status"></span><button id="cancel-placement" hidden>配置を取り消す</button></div>';$('preview').after(handDock);
const escape=(text='')=>text.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const enemyButtons=new Map<number,{button:HTMLButtonElement;name:HTMLSpanElement;hp:HTMLSpanElement}>();
function html(id:string,value:string){if($(id).innerHTML!==value)$(id).innerHTML=value;}
function switchPane(pane:string){document.querySelector('main')!.setAttribute('data-pane',pane);document.querySelectorAll<HTMLButtonElement>('.tabs button[data-pane]').forEach(b=>b.classList.toggle('active',b.dataset.pane===pane));}
function cancelPlacement(notice=true){armedSeed=null;hovered=null;taps.cancel();if(notice)message('配置を取り消しました。手札は消費していません。');refresh();}
function armPlacement(){if(selectedSeed===null||!state.hand?.some(c=>c.id===selectedSeed)||state.outcome!=='playing')return;armedSeed=selectedSeed;hovered=null;taps.cancel();if(window.innerWidth<=760){switchPane('board');window.scrollTo(0,0);}message(`芽 #${selectedSeed+1} を配置します。位置を選ぶか、取り消せます。`);refresh();}
function selectSeed(id:number,event:MouseEvent){selectedSeed=id;armedSeed=null;selected=null;hovered=null;taps.cancel();const kind=(event as PointerEvent).pointerType||lastCardPointer,fast=window.matchMedia('(min-width:761px) and (hover:hover) and (pointer:fine)').matches&&kind!=='touch'&&kind!=='pen';if(fast)armPlacement();else {if(window.innerWidth<=760){switchPane('left');window.scrollTo(0,0);}$('left').scrollTop=0;message('芽の能力を確認し、末尾の「配置」で位置選択へ進めます。');refresh();}}
function selectUnit(id:number,reveal=false){const unit=state.units.find(u=>u.id===id);if(!unit)return;if(state.opening){armedSeed=null;if(unit.team==='ally'){selectedAlly=id;selectedSeed=null;}else selectedEnemy=id;}selected=id;$('left').scrollTop=0;if(reveal&&camera.focusIfOutside(unit,game.scale.width,game.scale.height,footprint(unit))){taps.cancel();hovered=null;persist(false,true);}refresh();}
$('cancel-placement').onclick=()=>cancelPlacement();
window.addEventListener('resize',()=>{if(state.opening&&armedSeed!==null)cancelPlacement();});
function refreshEnemyList(){
  const enemies=state.units.filter(u=>u.team==='enemy');
  $('enemy-count').textContent=`敵 ${enemies.length}体 / 味方 ${state.units.filter(u=>u.team==='ally').length}体`;
  const alive=new Set(enemies.map(u=>u.id));
  for(const [id,entry] of enemyButtons)if(!alive.has(id)){entry.button.remove();enemyButtons.delete(id);}
  for(const enemy of enemies){
    let entry=enemyButtons.get(enemy.id);
    if(!entry){const button=document.createElement('button'),name=document.createElement('span'),hp=document.createElement('span');button.className='enemy';name.className='enemy-name';button.append(name,hp);button.onclick=()=>selectUnit(enemy.id,true);$('enemy-list').append(button);entry={button,name,hp};enemyButtons.set(enemy.id,entry);}
    entry.name.textContent=`#${enemy.id} ${labels[dominant(enemy.stats)]}型`;entry.hp.textContent=`HP ${Math.ceil(enemy.hp)}`;entry.button.setAttribute('aria-pressed',String(selected===enemy.id));
  }
}
function statsHtml(s:Stats){return `<div class="stats"><span>攻撃 <b>${s.power.toFixed(1)}</b></span><span>射程 <b>${s.range.toFixed(1)}</b></span><span>存在感距離 <b>${s.presence.toFixed(1)}</b></span><span>生命 <b>${s.vitality}</b></span></div>`;}
function unitHtml(u:Unit){return `<strong>${u.team==='ally'?'味方':'敵'} #${u.id} · ${labels[dominant(u.stats)]}型</strong>${statsHtml(u.stats)}<p>HP ${u.hp.toFixed(0)} / ${u.maxHp} · 現在の射程 ${effectiveRange(u).toFixed(1)}<br>成長倍率 ${growth(u).toFixed(2)}× · ${(u.age/10).toFixed(1)}秒${u.initial?' · 初期個体':''}</p>`;}
function refreshHand(){
 handDock.hidden=!state.hand;if(!state.hand)return;
 html('hand-list',state.hand.map(c=>`<button class="seed-card" data-seed="${c.id}" aria-pressed="${selectedSeed===c.id}"><strong>芽 #${c.id+1} · ${labels[dominant(c.baseStats)]}</strong><span>攻 ${c.baseStats.power.toFixed(1)} / 射 ${c.baseStats.range.toFixed(1)}</span><small>存在 ${c.baseStats.presence.toFixed(1)} / HP ${c.baseStats.vitality}</small></button>`).join(''));
 document.querySelectorAll<HTMLButtonElement>('.seed-card').forEach(b=>{b.disabled=state.outcome!=='playing';b.onpointerdown=e=>{lastCardPointer=e.pointerType;};b.onclick=e=>selectSeed(Number(b.dataset.seed),e);});
 $('placement-state').textContent=armedSeed!==null?`芽 #${armedSeed+1} の位置を選択`:selectedSeed!==null?'選択中 · 詳細の「配置」から位置選択へ':'手札を選んで、能力と置く位置を考える';$('cancel-placement').hidden=armedSeed===null;
}
function refresh(){
  document.querySelector('main')!.setAttribute('data-opening',state.opening??'legacy');
  document.querySelector<HTMLElement>('#app')!.dataset.ready=String(!introActive);
  ($('speed') as HTMLSelectElement).disabled=introActive;
  document.querySelectorAll<HTMLButtonElement>('.camera-controls button').forEach(b=>b.disabled=introActive);
  $('card').hidden=!!state.hand;$('card').previousElementSibling!.textContent=state.hand?'中央下の手札から選択':'次に植える植物';
  if(!state.hand)$('card').innerHTML=state.cards[0]?`<div class="plant-card"><strong>${labels[dominant(state.cards[0])]}が得意な芽</strong>${statsHtml(state.cards[0])}</div>`:'今回の植物はすべて配置しました。';
  $('supply').textContent=`配置力 ${state.charges} / 5 · ${state.supplyMode==='endless'?'芽の供給 継続':`残りの芽 ${state.cards.length}`}`;
  ($('refill') as HTMLProgressElement).value=state.charges>=5?REFILL_TICKS:state.tick%REFILL_TICKS;
  $('refill-info').textContent=!state.cards.length?'残りの芽はありません。':state.charges>=5?'配置力は満タンです。次の芽を配置できます。':!state.started?'最初の配置後に補充が始まります。':`次の補充まで ${((REFILL_TICKS-state.tick%REFILL_TICKS)/10).toFixed(1)}ゲーム秒${clock.paused?'（停止中）':''}`;
  $('future').innerHTML=state.hand?'':state.cards.slice(1,4).map((s,i)=>`<div class="preview">次${i+1} · ${labels[dominant(s)]}型 · 攻${s.power.toFixed(0)} / 射${s.range.toFixed(1)}</div>`).join('');
  refreshHand();
  $('status').textContent=state.outcome==='win'?'攻略完了':state.outcome==='loss'?'再挑戦できます':`${clock.paused?'停止中':'進行中'} · ${(state.tick/10).toFixed(1)}秒 · seed ${state.seed}`;
  $('coverage').textContent=`配置可能 約${Math.round(territoryCoverage(state)*100)}%`;
  const hints={ready:'存在感が低い場所に最初の芽を置く',growing:'成長中 · 射程が広がる',fighting:'交戦中 · 味方の射程を重ねる','weak-combat':'射程の端で交戦中 · 前へ配置 / 今回を終える','needs-placement':'存在感の低い場所へ次の芽を置く',ended:state.outcome==='win'?'攻略完了':'残った敵と射程を、次の配置の手がかりに'};
  const decision=decisionHint(state);
  $('activity').textContent=decision.kind!=='other'?`${clock.paused?'停止中 · ':''}${decision.text}`:clock.paused&&state.started&&state.outcome==='playing'?'停止中 · 芽を選び、射程と狙われ方を確認':hints[runActivity(state)];
  $('skip').textContent=skip.active?'送り停止':'変化まで';
  ($('skip') as HTMLButtonElement).disabled=introActive||!state.started||state.outcome!=='playing';
  $('play').textContent=skip.active?'送り停止':clock.paused?'▶ 時間を進める':'Ⅱ 停止して考える';
  ($('play') as HTMLButtonElement).disabled=introActive||state.outcome!=='playing';
  ($('tick') as HTMLButtonElement).disabled=introActive||state.outcome!=='playing'||!clock.paused||!state.started;
  ($('finish') as HTMLButtonElement).disabled=state.outcome!=='playing'||!state.started;
  const u=state.units.find(u=>u.id===selected);
  selectedPanel.hidden=!state.opening&&!u;enemyDetail.hidden=!state.opening;
  if(state.opening){const card=state.hand?.find(c=>c.id===selectedSeed),ally=state.units.find(v=>v.id===selectedAlly&&v.team==='ally'),enemy=state.units.find(v=>v.id===selectedEnemy&&v.team==='enemy');selectedPanel.querySelector('h2')!.textContent='味方・芽の個体ステータス';html('selection',card?`<strong>芽 #${card.id+1} · ${labels[dominant(card.baseStats)]}型</strong>${statsHtml(card.baseStats)}<p>選択だけでは消費しません。</p><button id="confirm-seed">配置</button>`:ally?unitHtml(ally):'味方や中央下の手札を選ぶと、単体の能力を確認できます。');html('enemy-selection',enemy?unitHtml(enemy):'敵を選ぶと、単体の能力と成長状態を確認できます。');if(card)$('confirm-seed').onclick=()=>armPlacement();}
  else {selectedPanel.querySelector('h2')!.textContent='選んだ植物';$('selection').innerHTML=u?unitHtml(u):'植物をタップすると能力と射程を表示します。';}
  refreshEnemyList();
  $('events').innerHTML=state.events.map(e=>`<p class="event">${escape(e)}</p>`).join('');
  $('run-result').hidden=state.outcome==='playing';
  if(state.outcome!=='playing'){
    const diagnosis=resultDiagnosis(state);
    html('run-result',`<strong>${state.outcome==='win'?'攻略完了！':'今回はここまで。'}</strong><p>配置可能 約${Math.round(territoryCoverage(state)*100)}% · 敵攻略 ${stageProgress(state).defeated}/${state.stage.enemyCount}体 · ${(state.tick/10).toFixed(1)}秒</p><p>${escape(diagnosis?.message??state.events[0])}</p><p class="hint">${escape(diagnosis?.suggestion)}</p><div>${diagnosis?.enemyId?'<button id="inspect-gap">味方の射程で確認</button>':''}<button id="retry-run">同じseedで再挑戦</button><button id="next-run">新seedで始める</button></div>`);
    if(diagnosis?.enemyId)$('inspect-gap').onclick=()=>{selectUnit(diagnosis.allyId!,true);message(`味方 #${diagnosis.allyId} の射程円と敵 #${diagnosis.enemyId} の位置を比較できます。`);refresh();};
    $('retry-run').onclick=()=>reset(state.seed);$('next-run').onclick=()=>reset((state.seed+1)>>>0);
  }
}
function message(text:string){$('message').textContent=text;}
function reset(seed:number,configuration:StageConfig=state.stage,opening:Opening=state.opening??'legacy'){skip.cancel();if(!Number.isInteger(seed)||seed<0||seed>4294967295){message('seedは0〜4294967295の整数を指定してください。');return;}if(store.protectedSave&&loaded.kind==='invalid'&&!window.confirm('旧保存を退避して、新しいルールのrunを始めますか？'))return;state=createState(seed,configuration,'endless',opening);syncStageChoice();camera=new BoardCamera(undefined,state.stage);introActive=true;introElapsed=0;introTarget=introView(state);clock=new Clock();actions=[];savedTick=lastAttemptTick=-1;persist(true);taps.cancel();foreground.interrupt(clock);hovered=null;selected=null;selectedAlly=state.units.find(u=>u.initial)?.id??null;selectedEnemy=selectedSeed=armedSeed=null;($('speed') as HTMLSelectElement).value='1';($('seed') as HTMLInputElement).value=String(seed);message('存在感が低い場所の自由な位置に配置して、時間を進めましょう。');refresh();}
$('restart').onclick=()=>reset((state.seed+1)>>>0);
$('same').onclick=()=>reset(Number(($('seed') as HTMLInputElement).value),chosenStage(),chosenOpening());
$('play').onclick=()=>{if(skip.active){skip.cancel();clock.suspend();persist(false,true);refresh();return;}if(introActive||state.outcome!=='playing'||document.hidden)return;if(saveFailed){persist(false,true);if(saveFailed){refresh();return;}}if(!state.started){message('最初の植物を配置してから時間を進められます。');return;}clock.paused=!clock.paused;refresh();};
$('skip').onclick=()=>{if(skip.active){skip.cancel();persist(false,true);refresh();return;}if(introActive||document.hidden)return;if(saveFailed){persist(false,true);if(saveFailed)return;}clock.suspend();skip.start(state);refresh();};
$('tick').onclick=()=>{skip.cancel();if(saveFailed){persist(false,true);if(saveFailed){refresh();return;}}if(clock.paused)step(state);persist();refresh();};
$('finish').onclick=()=>{skip.cancel();if(finishRun(state)){actions.push({tick:state.tick,kind:'finish'});lastAttemptTick=-1;persist();clock.suspend();message('盤面を残して、このrunを終えました。');refresh();}};
$('speed').onchange=()=>{clock.speed=Number(($('speed') as HTMLSelectElement).value);lastAttemptTick=-1;persist();};
document.querySelectorAll<HTMLButtonElement>('.tabs button[data-pane]').forEach(b=>b.onclick=()=>{if(!introActive)persist(false,true);taps.cancel();document.querySelector('main')!.setAttribute('data-pane',b.dataset.pane!);document.querySelectorAll('.tabs button[data-pane].active').forEach(t=>t.classList.remove('active'));b.classList.add('active');hovered=null;});
function interrupt(){skip.cancel();foreground.interrupt(clock);persist(false,true);taps.cancel();hovered=null;if(state.started&&state.outcome==='playing')message('画面を離れたため停止しました。戻ったら時間を進めるボタンで再開できます。');refresh();}
document.addEventListener('visibilitychange',()=>{if(document.hidden)interrupt();});
window.addEventListener('blur',interrupt);
window.addEventListener('pagehide',interrupt);
class Board extends Phaser.Scene {
  graphics!:Phaser.GameObjects.Graphics; shotGraphics!:Phaser.GameObjects.Graphics; shotState=state; seenShots=new Map<number,number>(); previousUnits=new Map<number,Unit>(); missiles:{x:number;y:number;tx:number;ty:number;time:number;color:number}[]=[]; boardImage!:Phaser.GameObjects.RenderTexture; visualKey='';textById=new Map<number,Phaser.GameObjects.Text>(); cell=40;ox=0;oy=0;elapsed=0;fieldKey='';fieldState=state;fieldView='';fieldHeight=0;fieldRects:{x:number;y:number;width:number}[]=[];
  knownTerritory=new Set<number>();pulseState=state;pulses:{x:number;y:number;radius:number;time:number;captured:boolean}[]=[];viewTime=0;
  create(){
    this.graphics=this.add.graphics().setVisible(false);
    // Cache graphics at 2x resolution; ID text remains native and sharp at every zoom.
    this.boardImage=this.add.renderTexture(0,0,this.scale.width*2,this.scale.height*2).setOrigin(0).setDisplaySize(this.scale.width,this.scale.height);
    this.shotGraphics=this.add.graphics();
    const restored=()=>{this.visualKey='';};
    this.game.renderer.on(Phaser.Renderer.Events.RESTORE_WEBGL,restored);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN,()=>this.game.renderer.off(Phaser.Renderer.Events.RESTORE_WEBGL,restored));
    const canvas=this.game.canvas;
    let drag:{id:number;startX:number;startY:number;lastX:number;lastY:number;panning:boolean}|null=null;
    const point=(e:PointerEvent)=>{const rect=canvas.getBoundingClientRect();if(rect.width<=0||rect.height<=0)return null;return {position:camera.point(e.clientX,e.clientY,rect),key:`${rect.left},${rect.top},${rect.width},${rect.height},${camera.view.x},${camera.view.y},${camera.view.zoom}`};};
    const down=(e:PointerEvent)=>{if(introActive||document.hidden)return;if(drag?.panning)persist(false,true);const p=point(e);if(!p)return;hovered=state.opening&&armedSeed===null?null:p.position;taps.down(e.pointerId,e.clientX,e.clientY,e.timeStamp,p.key,e.isPrimary,e.button);drag=e.isPrimary&&e.button===0?{id:e.pointerId,startX:e.clientX,startY:e.clientY,lastX:e.clientX,lastY:e.clientY,panning:false}:null;};
    const outsideDown=(e:PointerEvent)=>{if(e.target!==canvas){if(drag?.panning)persist(false,true);drag=null;taps.cancel();}};
    const move=(e:PointerEvent)=>{if(e.pointerType==='mouse'&&e.buttons!==0&&e.buttons!==1)taps.cancel();taps.move(e.pointerId,e.clientX,e.clientY);
      if(drag&&!taps.tracking(drag.id)){if(drag.panning)persist(false,true);drag=null;}
      if(drag?.id===e.pointerId&&(drag.panning||Math.hypot(e.clientX-drag.startX,e.clientY-drag.startY)>8)){
        drag.panning=true;const rect=canvas.getBoundingClientRect();camera.pan(e.clientX-drag.lastX,e.clientY-drag.lastY,viewport(rect.width,rect.height,state.stage).scale);drag.lastX=e.clientX;drag.lastY=e.clientY;hovered=null;return;
      }
      const pos=e.target===canvas?point(e)?.position??null:null;hovered=state.opening&&armedSeed===null?null:pos&&state.units.some(u=>Math.hypot(u.x-pos.x,u.y-pos.y)<=footprint(u))?null:pos;};
    const cancel=()=>{if(drag?.panning)persist(false,true);drag=null;taps.cancel();hovered=null;};
    const up=(e:PointerEvent)=>{
      if(drag?.id===e.pointerId&&drag.panning){cancel();message('盤面を移動しました。');return;}drag=null;
      if(!taps.tracking(e.pointerId))return;
      const p=point(e);if(!p||document.hidden){cancel();return;}
      const accepted=taps.up(e.pointerId,e.clientX,e.clientY,e.timeStamp,p.key);
      if(!accepted||e.button!==0){message('ドラッグや長押しでは配置しません。短くタップして配置できます。');return;}
      const pos=p.position;hovered=pos;if(skip.active){skip.cancel();persist(false,true);}
      const u=state.units.filter(u=>Math.hypot(u.x-pos.x,u.y-pos.y)<=footprint(u)).sort((a,b)=>Math.hypot(a.x-pos.x,a.y-pos.y)-Math.hypot(b.x-pos.x,b.y-pos.y)||a.id-b.id)[0];
      if(u){selectUnit(u.id);hovered=null;message('選んだ植物の円が現在の射程です。');}
      else if(state.opening&&armedSeed===null){hovered=null;message('中央下の手札を選んでから位置を決めます。');}
      else if(state.outcome==='playing'){if(saveFailed){persist(false,true);if(saveFailed){refresh();return;}}const result=place(state,pos.x,pos.y,armedSeed??undefined);if(result.ok){actions.push({tick:state.tick,kind:'place',x:pos.x,y:pos.y,...(state.opening?{seedIndex:armedSeed!}:{})});if(state.supplyMode==='endless')actions=actions.slice(-64);lastAttemptTick=-1;persist();hovered=null;if(state.opening){selectedAlly=selected=state.units.at(-1)!.id;selectedSeed=armedSeed=null;}}message(result.ok?'自由な位置に配置しました。時間を進めると植物が育ちます。':result.reason);}
      else message('このrunは終了しています。植物の情報は確認できます。');
      refresh();
    };
    const leave=()=>{hovered=null;};const context=(e:Event)=>e.preventDefault();
    const wheel=(e:WheelEvent)=>{e.preventDefault();if(introActive||document.hidden)return;cancel();const rect=canvas.getBoundingClientRect();camera.zoomAt(Math.exp(-Math.max(-500,Math.min(500,e.deltaY))*.002),camera.point(e.clientX,e.clientY,rect));persist(false,true);};
    canvas.addEventListener('wheel',wheel,{passive:false});
    canvas.addEventListener('pointerdown',down);canvas.addEventListener('pointerleave',leave);canvas.addEventListener('contextmenu',context);
    window.addEventListener('pointerdown',outsideDown);window.addEventListener('pointermove',move);window.addEventListener('pointerup',up);window.addEventListener('pointercancel',cancel);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN,()=>{cancel();canvas.removeEventListener('wheel',wheel);canvas.removeEventListener('pointerdown',down);canvas.removeEventListener('pointerleave',leave);canvas.removeEventListener('contextmenu',context);window.removeEventListener('pointerdown',outsideDown);window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);window.removeEventListener('pointercancel',cancel);});
  }
  update(_time:number,delta:number){
    this.viewTime=_time;const safeDelta=document.hidden?0:foreground.frame(delta);
    if(!document.hidden){
      if(introActive){introElapsed+=safeDelta;const t=Math.max(0,Math.min(1,(introElapsed-200)/500)),a=t*t*(3-2*t);camera.set({zoom:1+(introTarget.zoom-1)*a,x:state.stage.width/2+(introTarget.x-state.stage.width/2)*a,y:state.stage.height/2+(introTarget.y-state.stage.height/2)*a});if(t===1){introActive=false;persist(false,true);refresh();}}
      else if(skip.active){const stopped=skip.chunk(state);if(stopped){persist(false,true);message('時間送り停止 · '+stopped);refresh();}}
      else clock.advance(state,safeDelta);
    }
    if(!introActive&&(state.tick-lastAttemptTick>=10||(state.outcome!=='playing'&&lastAttemptTick!==state.tick)))persist();this.elapsed+=delta;if(this.elapsed>150){refresh();this.elapsed=0;}this.draw();this.drawShots();
  }
  drawShots(){
    const g=this.shotGraphics;g.clear();if(this.shotState!==state){this.shotState=state;this.seenShots.clear();this.previousUnits.clear();this.missiles=[];}
    if(!state.opening)return;
    const all=new Map(this.previousUnits);for(const u of state.units)all.set(u.id,u);
    for(const u of all.values()){const shot=u.lastShot;if(shot&&state.tick-shot.tick<3&&this.seenShots.get(u.id)!==shot.tick){this.seenShots.set(u.id,shot.tick);this.missiles.push({x:u.x,y:u.y,tx:shot.x,ty:shot.y,time:this.viewTime,color:u.team==='ally'?0xd1e998:0xf09a85});}}
    this.previousUnits=new Map(state.units.map(u=>[u.id,u]));this.missiles=this.missiles.filter(m=>this.viewTime-m.time<360);
    const l=camera.layout(this.scale.width,this.scale.height);for(const m of this.missiles){const t=(this.viewTime-m.time)/360,x=l.ox+(m.x+(m.tx-m.x)*t)*l.scale,y=l.oy+(m.y+(m.ty-m.y)*t)*l.scale;g.lineStyle(2,m.color,.5);g.lineBetween(l.ox+(m.x+(m.tx-m.x)*Math.max(0,t-.18))*l.scale,l.oy+(m.y+(m.ty-m.y)*Math.max(0,t-.18))*l.scale,x,y);g.fillStyle(m.color);g.fillCircle(x,y,Math.max(3,l.scale*.09));g.fillStyle(0xfff9dc);g.fillCircle(x-1,y-1,1.5);}
  }
  draw(){
    if(this.scale.width<=0||this.scale.height<=0)return;
    if(this.pulseState!==state){this.pulseState=state;this.knownTerritory.clear();this.pulses=[];}
    for(const t of state.territory)if(!this.knownTerritory.has(t.id)){this.knownTerritory.add(t.id);if(!state.units.some(u=>u.id===t.id))this.pulses.push({x:t.x,y:t.y,radius:t.radius,time:this.viewTime,captured:true});}
    this.pulses=this.pulses.filter(p=>this.viewTime-p.time<1500);
    const key=boardVisualKey(state,camera.view,this.scale.width,this.scale.height,selected,hovered,{seedId:selectedSeed,armed:armedSeed!==null});
    if(!this.pulses.length&&this.visualKey===key)return;
    this.visualKey=this.pulses.length?'':key;
    const g=this.graphics;g.clear().scaleCanvas(2,2);const layout=camera.layout(this.scale.width,this.scale.height);this.cell=layout.scale;this.ox=layout.ox;this.oy=layout.oy;
    g.fillStyle(0x182a2c);g.fillRect(this.ox,this.oy,state.stage.width*this.cell,state.stage.height*this.cell);
    g.fillStyle(0x294e43);g.fillRect(this.ox,this.oy,state.stage.width*this.cell,state.stage.height*this.cell);
    // Cached contour of the summed field; exact placement never uses these samples.
    const bounds=camera.bounds(this.scale.width,this.scale.height),viewKey=JSON.stringify(bounds);
    const fieldKey=presenceVisualKey(state);
    if(this.fieldState!==state||this.fieldKey!==fieldKey||this.fieldView!==viewKey){
      this.fieldState=state;this.fieldKey=fieldKey;this.fieldView=viewKey;this.fieldHeight=bounds.height/72;this.fieldRects=[];
      for(let yi=0;yi<72;yi++){let left=-1;for(let xi=0;xi<=96;xi++){
        const blocked=xi<96&&enemyPresenceAt(state,bounds.x+(xi+.5)*bounds.width/96,bounds.y+(yi+.5)*bounds.height/72)>PRESENCE_LIMIT;
        if(blocked&&left<0)left=xi;
        if(!blocked&&left>=0){this.fieldRects.push({x:bounds.x+left*bounds.width/96,y:bounds.y+yi*bounds.height/72,width:(xi-left)*bounds.width/96});left=-1;}
      }}
    }
    g.fillStyle(0x703d40,.6);for(const r of this.fieldRects)g.fillRect(this.ox+r.x*this.cell,this.oy+r.y*this.cell,r.width*this.cell+.5,this.fieldHeight*this.cell+.5);    g.lineStyle(1,0x6c8579);g.strokeRect(this.ox,this.oy,state.stage.width*this.cell,state.stage.height*this.cell);
    for(const pulse of this.pulses){const age=(this.viewTime-pulse.time)/1500;const radius=pulse.radius*Math.min(1,.2+age*2);g.lineStyle(pulse.captured?3:2,pulse.captured?0xe4e6a4:0xa3e3b3,(1-age)*.75);g.strokeCircle(this.ox+pulse.x*this.cell,this.oy+pulse.y*this.cell,radius*this.cell);}
    const activeSeed=armedSeed??undefined,canPreview=!state.opening||armedSeed!==null;
    if(hovered&&canPreview){const result=validatePlacement(state,hovered.x,hovered.y,activeSeed);const color=result.ok?0xb9e795:0xf0a194;const hx=this.ox+hovered.x*this.cell,hy=this.oy+hovered.y*this.cell;g.fillStyle(color,.18);g.fillCircle(hx,hy,SEED_RADIUS*this.cell);g.lineStyle(2,color);g.strokeCircle(hx,hy,SEED_RADIUS*this.cell);g.lineStyle(1,color,.35);const previewStats=seedStats(state,activeSeed);if(previewStats)g.strokeCircle(hx,hy,previewStats.range*.65*this.cell);$('preview').textContent=`存在感 ${enemyPresenceAt(state,hovered.x,hovered.y).toFixed(2)} / ${PRESENCE_LIMIT.toFixed(1)} · ${result.reason}`;$('preview').classList.toggle('invalid',!result.ok);}
    else { $('preview').textContent=state.units.some(u=>u.id===selected)?`選択中 #${selected} · 実線＝等倍 / 破線＝減衰限界`:'自由配置 · 緑の円＝可 / 赤＝不可'; $('preview').classList.remove('invalid'); }
    const forecast=hovered&&canPreview?placementForecast(state,hovered.x,hovered.y,activeSeed):undefined;
    $('forecast').hidden=!forecast;
    if(forecast&&hovered){
      const hx=this.ox+hovered.x*this.cell,hy=this.oy+hovered.y*this.cell;
      const target=state.units.find(u=>u.id===(forecast.targetId??forecast.grownTargetId));
      if(target){const tx=this.ox+target.x*this.cell,ty=this.oy+target.y*this.cell;g.lineStyle(2,forecast.targetId?0xd6ee9d:0x85b9aa,.9);if(forecast.targetId)g.lineBetween(hx,hy,tx,ty);else for(let i=0;i<12;i+=2)g.lineBetween(hx+(tx-hx)*i/12,hy+(ty-hy)*i/12,hx+(tx-hx)*(i+1)/12,hy+(ty-hy)*(i+1)/12);}
      for(const id of forecast.incomingIds){const enemy=state.units.find(u=>u.id===id)!;g.lineStyle(1.5,0xf29c88,.7);g.lineBetween(this.ox+enemy.x*this.cell,this.oy+enemy.y*this.cell,hx,hy);}
      html('forecast',`<strong>${forecast.note}</strong><div>${forecast.targetId?`今の1撃 約${forecast.damage.toFixed(1)} · `:''}${forecast.incomingIds.length?`敵${forecast.incomingIds.length}体の標的候補（1巡 約${forecast.incomingDamage.toFixed(1)}）`:'今は敵から狙われません。'}</div><small> 線は今の攻撃 / 成長後の攻撃を示します。敵の現位置での目安です。</small>`);
    }else $('forecast').textContent=state.outcome!=='playing'?'下のボタンで同じseedの配置を試し直せます。':hovered?'配置できない位置です。存在感が低い場所の別の位置を選んでみましょう。':'カーソルを動かすと、攻撃の届き方と狙われ方を確認できます。';
    const aliveIds=new Set(state.units.map(u=>u.id));for(const [id,text] of this.textById)if(!aliveIds.has(id)){text.destroy();this.textById.delete(id);}
    for(const u of state.units){const x=this.ox+u.x*this.cell,y=this.oy+u.y*this.cell;const visible=x>=-50&&x<=this.scale.width+50&&y>=-50&&y<=this.scale.height+50;this.textById.get(u.id)?.setVisible(visible);if(!visible&&u.id!==selected)continue;
      if(u.id===selected){
        const limit=effectiveRange(u)*2*this.cell;
        g.lineStyle(1,0xd8e3df,.55);for(let i=0;i<32;i++){const a=i*Math.PI/16;g.beginPath();g.arc(x,y,limit,a,a+Math.PI/32);g.strokePath();}        g.lineStyle(1.5,u.team==='ally'?0xb9e795:0xefaaa0,.8);g.strokeCircle(x,y,effectiveRange(u)*this.cell);
      }
      const t=chooseTarget(u,state.units);if(t){g.lineStyle(u.id===selected?2:1,u.team==='ally'?0xd1e998:0xf09a85,u.id===selected?.85:.23);g.lineBetween(x,y,this.ox+t.x*this.cell,this.oy+t.y*this.cell);}
      const shot=u.lastShot;if(!state.opening&&shot&&state.tick-shot.tick<3){g.lineStyle(2.5,u.team==='ally'?0xd1e998:0xf09a85,.9);const tx=this.ox+shot.x*this.cell,ty=this.oy+shot.y*this.cell;g.lineBetween(x,y,tx,ty);g.lineStyle(1.5,u.team==='ally'?0xd1e998:0xf09a85,.7);g.strokeCircle(tx,ty,.4*this.cell);}
      const r=this.cell*footprint(u),kind=dominant(u.stats);g.fillStyle(palette[kind]);
      if(kind==='power')g.fillCircle(x,y,r);else if(kind==='range')g.fillTriangle(x,y-r,x+r,y,x,y+r).fillTriangle(x,y-r,x-r,y,x,y+r);else if(kind==='vitality')g.fillRoundedRect(x-r*.7,y-r*.7,r*1.4,r*1.4,4);else{g.fillCircle(x,y,r*.7);g.fillTriangle(x,y-r,x-r*.5,y,x+r*.5,y);g.fillTriangle(x,y+r,x-r*.5,y,x+r*.5,y);g.fillTriangle(x-r,y,x,y-r*.5,x,y+r*.5);g.fillTriangle(x+r,y,x,y-r*.5,x,y+r*.5);}
      if(state.opening){
        // Procedural plant faces; ability-derived body and colour remain readable.
        if(u.team==='ally'){g.fillStyle(0x78ab68);g.fillEllipse(x-r*.75,y-r*.55,r*.9,r*.35);g.fillEllipse(x+r*.75,y-r*.55,r*.9,r*.35);g.fillStyle(0x142b25);g.fillCircle(x-r*.28,y-r*.12,Math.max(1,r*.12));g.fillCircle(x+r*.28,y-r*.12,Math.max(1,r*.12));g.lineStyle(1.4,0x142b25);g.beginPath();g.arc(x,y+r*.12,r*.23,0,Math.PI);g.strokePath();}
        else{g.fillStyle(0x873d48);for(let i=0;i<5;i++){const a=i*Math.PI*2/5;g.fillTriangle(x+Math.cos(a)*r*1.18,y+Math.sin(a)*r*1.18,x+Math.cos(a-.22)*r*.8,y+Math.sin(a-.22)*r*.8,x+Math.cos(a+.22)*r*.8,y+Math.sin(a+.22)*r*.8);}g.fillStyle(0xf0eac8);g.fillCircle(x-r*.24,y-r*.15,r*.23);g.fillCircle(x+r*.3,y-r*.05,r*.17);g.fillStyle(0x342033);g.fillCircle(x-r*.2,y-r*.15,r*.1);g.fillCircle(x+r*.34,y-r*.05,r*.08);g.fillEllipse(x,y+r*.35,r*.65,r*.25);g.fillStyle(0xffeed1);g.fillTriangle(x-r*.15,y+r*.25,x,y+r*.47,x+r*.1,y+r*.25);}
      }
      g.lineStyle(u.id===selected?3:1.5,u.team==='enemy'?0xeb877b:0xd4ebc6);g.strokeCircle(x,y,r);
      // Outer arc shows maturation, independently of team colour or dominant shape.
      const maturity=Math.min(1,u.age/117),arcRadius=r+3;
      g.lineStyle(1,0x607773,.7);g.strokeCircle(x,y,arcRadius);
      if(maturity>0){g.lineStyle(2,0xf0ead3,.9);g.beginPath();g.arc(x,y,arcRadius,-Math.PI/2,-Math.PI/2+maturity*Math.PI*2);g.strokePath();}
      // Absolute capacity uses one shared scale; fill is remaining HP, never growth.
      const hpWidth=Math.max(8,this.cell*.8*u.maxHp/220),hpLeft=x-hpWidth/2,hpY=y+r+8;
      g.fillStyle(0x0a1819);g.fillRect(hpLeft,hpY,hpWidth,4);g.fillStyle(u.team==='enemy'?0xeb877b:0xb9e795);g.fillRect(hpLeft,hpY,hpWidth*Math.max(0,u.hp/u.maxHp),4);
      g.lineStyle(1,0xc2d5d0,.65);g.strokeRect(hpLeft,hpY,hpWidth,4);
      let text=this.textById.get(u.id);if(!text){text=this.add.text(x,y-r-12,String(u.id),{color:'#c2d5d0'}).setOrigin(.5);this.textById.set(u.id,text);}text.setVisible(visible);text.setPosition(x,y-r-12).setFontSize(Math.max(9,this.cell*.23));
    }
    const width=this.scale.width,height=this.scale.height;
    if(this.boardImage.width!==width*2||this.boardImage.height!==height*2){this.boardImage.destroy();this.boardImage=this.add.renderTexture(0,0,width*2,height*2).setOrigin(0).setDisplaySize(width,height).setDepth(-1);}
    this.boardImage.clear().draw(g);
  }
}
const game=new Phaser.Game({type:Phaser.AUTO,parent:'board',backgroundColor:'#101f21',scene:Board,scale:{mode:Phaser.Scale.NONE,width:600,height:450},render:{antialias:true},banner:false});
const cameraControls=document.createElement('div');cameraControls.className='camera-controls';
for(const [label,action] of [['−',()=>camera.zoomAt(.8,camera.view)],['＋',()=>camera.zoomAt(1.25,camera.view)],['全体',()=>camera.set({x:state.stage.width/2,y:state.stage.height/2,zoom:1})]] as const){const button=document.createElement('button');button.textContent=label;button.setAttribute('aria-label',label==='全体'?'盤面全体を表示':label==='＋'?'拡大':'縮小');button.onclick=()=>{if(introActive)return;taps.cancel();hovered=null;action();persist(false,true);};cameraControls.append(button);}
$('board').append(cameraControls);
new ResizeObserver(entries=>{if(!introActive)persist(false,true);taps.cancel();const size=canvasSize(entries[0].contentRect.width,entries[0].contentRect.height);if(size){game.scale.resize(size.width,size.height);hovered=null;}}).observe($('board'));
const saveStatus=document.createElement('p');saveStatus.id='save-status';saveStatus.className=saveFailed?'hint save-error':'hint';saveStatus.textContent=saveNotice;saveStatus.setAttribute('role',saveFailed?'alert':'status');document.querySelector('header')!.after(saveStatus);
($('speed') as HTMLSelectElement).value=String(clock.speed);($('seed') as HTMLInputElement).value=String(state.seed);
refresh();message(loaded.kind==='loaded'?'保存したrunを復元しました。時間を進めるボタンで再開できます。':'存在感が低い場所の自由な位置に配置して、時間を進めましょう。');
