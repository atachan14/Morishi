// Existing Edge only; isolated temporary profile, loopback target, no user browser access.
import {spawn} from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {createState,place,step,validatePlacement,placementForecast,insideTerritory,enemyPresenceAt,footprint} from '../.test-dist/src/sim.js';
import {capture,replay} from '../.test-dist/src/session.js';
const candidates=[];for(let yi=0;yi<21;yi++)for(let xi=0;xi<29;xi++)candidates.push({x:.35+xi*.4,y:.35+yi*.4});
function pick(snapshot){const target=snapshot.units.filter(u=>u.team==='enemy').sort((a,b)=>a.x-b.x||a.id-b.id)[0];if(!target)return;return candidates.filter(p=>validatePlacement(snapshot,p.x,p.y).ok).map(p=>{const f=placementForecast(snapshot,p.x,p.y);return {...p,score:-Math.hypot(p.x-target.x,p.y-target.y)+.5*(f.targetId===target.id?f.damage:0)-.25*f.incomingDamage};}).sort((a,b)=>b.score-a.score||a.y-b.y||a.x-b.x)[0];}

const output=process.argv[2]??path.join(os.tmpdir(),'morishi-browser-check');await fs.mkdir(output,{recursive:true});
const profile=await fs.mkdtemp(path.join(os.tmpdir(),'morishi-headless-'));
const edge=spawn('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',['--headless=new','--remote-debugging-port=0','--remote-debugging-address=127.0.0.1',`--user-data-dir=${profile}`,'--no-first-run','--no-default-browser-check','--disable-background-networking','--window-size=1366,768','about:blank'],{windowsHide:true,stdio:['ignore','pipe','pipe']});
let stderr='';edge.stderr.on('data',b=>stderr=(stderr+b.toString()).slice(-5000));edge.on('error',e=>stderr+=String(e));
const delay=ms=>new Promise(r=>setTimeout(r,ms));let ws;
const report={browser:null,isolated:true,userBrowserTouched:false,viewports:[],runtimeErrors:[]};
try{
 let port;for(let i=0;i<100;i++){try{port=+(await fs.readFile(path.join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0];break;}catch{}await delay(100);}
 if(!port)throw new Error(`Headless launch failed: ${stderr}`);
 const version=await(await fetch(`http://127.0.0.1:${port}/json/version`)).json();report.browser=version.Browser;ws=new WebSocket(version.webSocketDebuggerUrl);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});
 let seq=0;const pending=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);if(p){clearTimeout(p.timer);m.error?p.reject(new Error(JSON.stringify(m.error))):p.resolve(m.result);}}else if(m.method==='Runtime.exceptionThrown'||(m.method==='Runtime.consoleAPICalled'&&m.params.type==='error'))report.runtimeErrors.push({sessionId:m.sessionId,method:m.method,details:m.params});};
 const call=(method,params={},sessionId)=>new Promise((resolve,reject)=>{const id=++seq,timer=setTimeout(()=>{pending.delete(id);reject(new Error(`CDP timeout: ${method}`));},15000);pending.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));});
 for(const [width,height,mobile] of [[1366,768,false],[390,844,true]].filter(v=>!process.argv.includes('--mobile-only')||v[2])){
  const row={width,height,mobile,checks:[],failures:[]};report.viewports.push(row);
  const {browserContextId}=await call('Target.createBrowserContext');const {targetId}=await call('Target.createTarget',{url:'about:blank',browserContextId});const {sessionId}=await call('Target.attachToTarget',{targetId,flatten:true});
  const cmd=(method,params={})=>call(method,params,sessionId);
  const evaluate=async expression=>{const r=await cmd('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
  const wait=async expression=>{for(let i=0;i<100;i++){if(await evaluate(expression))return;await delay(50);}throw new Error(`Wait failed: ${expression}`);};
  const run=()=>evaluate('JSON.parse(localStorage.getItem("morishi.run.v1"))');
  const mouse=async(x,y,button='left')=>{await cmd('Input.dispatchMouseEvent',{type:'mouseMoved',x,y});await cmd('Input.dispatchMouseEvent',{type:'mousePressed',x,y,button,clickCount:1});await cmd('Input.dispatchMouseEvent',{type:'mouseReleased',x,y,button,clickCount:1});await delay(70);};
  const click=async selector=>{await evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'center'})`);const p=await evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);await mouse(p.x,p.y);};
  const point=async(x,y)=>{await evaluate('document.querySelector("canvas").scrollIntoView({block:"center"})');await delay(100);return evaluate(`(()=>{const r=document.querySelector('canvas').getBoundingClientRect(),s=Math.min(r.width/12,r.height/9),v=JSON.parse(localStorage.getItem("morishi.run.v1")).view;return {x:r.x+(r.width-12*s)/2+(6+(${x}-v.x)*v.zoom)*s,y:r.y+(r.height-9*s)/2+(4.5+(${y}-v.y)*v.zoom)*s};})()`);};
  const tap=async(x,y)=>{const p=await point(x,y);if(mobile){await cmd('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:p.x,y:p.y,id:1}]});await cmd('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await delay(70);}else await mouse(p.x,p.y);};
  const screenshot=async name=>{await evaluate('window.scrollTo(0,0)');await delay(70);const image=await cmd('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await fs.writeFile(path.join(output,`${width}x${height}-${name}.png`),Buffer.from(image.data,'base64'));};
  try{
   await cmd('Runtime.enable');await cmd('Page.enable');await cmd('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile});await cmd('Emulation.setTouchEmulationEnabled',{enabled:mobile,maxTouchPoints:5});await cmd('Page.navigate',{url:'http://127.0.0.1:8781'});await wait('document.querySelector("#app")?.dataset.ready==="true"&&document.querySelector("canvas")?.width>0');

   const load=async(state,actions=[])=>{const save=capture(state,1,actions);replay(save);const {identifier}=await cmd('Page.addScriptToEvaluateOnNewDocument',{source:'localStorage.setItem("morishi.run.v1",'+JSON.stringify(JSON.stringify(save))+');'});await cmd('Page.reload');await delay(300);await wait('document.querySelector("#app")?.dataset.ready==="true"');await cmd('Page.removeScriptToEvaluateOnNewDocument',{identifier});assert.equal((await run()).tick,state.tick);await delay(250);};
   const advanceTick=async()=>{await evaluate('document.querySelector("#tick").focus({preventScroll:true})');await cmd('Input.dispatchKeyEvent',{type:'keyDown',text:'\r',unmodifiedText:'\r',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});await cmd('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});};const preview=()=>evaluate('({text:document.querySelector("#preview").textContent,invalid:document.querySelector("#preview").classList.contains("invalid"),forecastHidden:document.querySelector("#forecast").hidden})');
   const hover=async(p)=>{const at=await point(p.x,p.y);if(mobile)await cmd('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:at.x,y:at.y,id:1}]});else await cmd('Input.dispatchMouseEvent',{type:'mouseMoved',x:at.x,y:at.y});await delay(70);return at;};
   const cancelHover=async()=>{if(mobile)await cmd('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});};
   const check=async(s,p,label,commit=false)=>{const expected=validatePlacement(s,p.x,p.y),at=await hover(p),shown=await preview();assert.equal(shown.invalid,!expected.ok,label);assert.ok(shown.text.endsWith(expected.reason),label+': '+shown.text);assert.equal(shown.forecastHidden,!expected.ok,label+' forecast');row.checks.push({label,expected,shown});if(commit){const before=(await run()).actions.length;if(mobile)await cmd('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});else{await cmd('Input.dispatchMouseEvent',{type:'mousePressed',x:at.x,y:at.y,button:'left',clickCount:1});await cmd('Input.dispatchMouseEvent',{type:'mouseReleased',x:at.x,y:at.y,button:'left',clickCount:1});}await delay(70);assert.equal((await run()).actions.length,before+(expected.ok?1:0),label+' actual placement');if(!expected.ok)assert.equal(await evaluate('document.querySelector("#message").textContent'),expected.reason);}else await cancelHover();};
   let state=createState(20261011);await load(state);
   const blocked=candidates.find(p=>!insideTerritory(state,p.x,p.y)&&!state.units.some(u=>Math.hypot(u.x-p.x,u.y-p.y)<footprint(u)+.3));assert.ok(blocked);
   await check(state,blocked,'summed presence blocks',true);
   await check(state,{x:4.45,y:2},'overlap outside selectable body',true);
   await check(state,{x:.1,y:4},'seed circle crosses board',true);
   await check(state,{x:4,y:4},'legal between enemies');
   await click('button[aria-label="拡大"]');await check(state,{x:4,y:4},'zoomed world point');
   const a=await point(5,4),b={x:a.x+30,y:a.y+20};await cmd('Input.dispatchMouseEvent',{type:'mousePressed',x:a.x,y:a.y,button:'left',clickCount:1});await cmd('Input.dispatchMouseEvent',{type:'mouseMoved',x:b.x,y:b.y,button:'left',buttons:1});await cmd('Input.dispatchMouseEvent',{type:'mouseReleased',x:b.x,y:b.y,button:'left',clickCount:1});await delay(70);assert.ok(!(await preview()).invalid);assert.ok(!(await preview()).text.startsWith('存在感 '));await check(state,{x:4,y:4},'panned world point',true);
   // Valid bounded snapshot fixtures isolate a single recovery and an enemy death.
   state=createState(20261011);place(state,.35,.35);const actions=[{tick:0,kind:'place',x:.35,y:.35}];for(let i=0;i<239;i++)step(state);state.charges=0;await load(state,actions);
   const safe=candidates.filter(p=>validatePlacement({...state,charges:1},p.x,p.y).ok).sort((a,b)=>Math.hypot(a.x-6,a.y-4)-Math.hypot(b.x-6,b.y-4))[0];assert.ok(safe);await check(state,safe,'no placement charge',true);await hover(safe);row.preRecovery=await preview();await advanceTick();step(state);await delay(70);assert.equal((await run()).tick,240);const recovered=await preview();row.recovered={safe,shown:recovered,charges:(await run()).snapshot.charges};assert.ok(!recovered.invalid);assert.ok(recovered.text.endsWith('配置できます。'));await cancelHover();await check(state,safe,'recovery refreshes stationary preview',true);
   state=createState(20261011);place(state,2.35,1.55);state.units.find(u=>u.id===1).hp=1;const killActions=[{tick:0,kind:'place',x:2.35,y:1.55}];await load(state,killActions);const after=structuredClone(state);step(after);assert.ok(!after.units.some(u=>u.id===1));const freed=candidates.find(p=>!validatePlacement(state,p.x,p.y).ok&&validatePlacement(after,p.x,p.y).ok);assert.ok(freed);await check(state,freed,'pre-kill field blocks');await hover(freed);await advanceTick();await delay(70);const released=await preview();row.released= released;assert.ok(!released.invalid);assert.ok(released.text.endsWith('配置できます。'));await cancelHover();await check(after,freed,'death refreshes stationary preview',true);await screenshot('release-preview');
   assert.equal(await evaluate('document.querySelector("main").onclick===null'),true);if(mobile){await click('[data-pane="left"]');assert.equal(await evaluate('document.querySelector("main").dataset.pane'),'left');await click('[data-pane="board"]');assert.equal(await evaluate('document.querySelector("main").dataset.pane'),'board');}row.checks.push('native rejected placements never changed action count; legal placements added exactly one');
  }catch(e){row.failures.push(String(e));try{row.failureContext=await evaluate('({down:window.__lastDown,up:window.__lastPointer,message:document.querySelector("#message").textContent,scrollY,clientWidth:document.documentElement.clientWidth,innerWidth,canvas:document.querySelector("canvas").getBoundingClientRect().toJSON()})');await screenshot('failure');}catch{}}
  finally{await call('Target.disposeBrowserContext',{browserContextId});}
 }
 await fs.writeFile(path.join(output,'browser-check.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({browser:report.browser,viewports:report.viewports.map(r=>({width:r.width,height:r.height,checks:r.checks,failures:r.failures,backgroundVisibility:r.backgroundVisibility})),runtimeErrors:report.runtimeErrors.length},null,2));
 await call('Browser.close');
 if(report.viewports.some(r=>r.failures.length)||report.runtimeErrors.length)process.exitCode=1;
}catch(e){console.error(e);process.exitCode=1;await fs.writeFile(path.join(output,'browser-check.json'),JSON.stringify({...report,fatal:String(e),stderr},null,2)+'\n');}
finally{
 if(ws?.readyState===1)ws.close();if(edge.exitCode===null)edge.kill();await delay(200);
 // Only the exact temporary profile created by this process may be removed.
 const resolved=path.resolve(profile),tempRoot=path.resolve(os.tmpdir());
 if(path.dirname(resolved)===tempRoot&&path.basename(resolved).startsWith('morishi-headless-'))try{await fs.rm(resolved,{recursive:true,force:true,maxRetries:3,retryDelay:100});}catch(e){console.error(`Temporary profile cleanup failed: ${e}`);}
}
