// Existing Edge, isolated temporary profile, local loopback only.
import {spawn} from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {createV2Game,stepV2,placeV2} from '../.test-dist/src/eco-v2-game.js';
import {canPlaceV2,currentV2Stats} from '../.test-dist/src/eco-v2-foundation.js';
import {captureV2,replayV2 as ecoReplay} from '../.test-dist/src/eco-v2-save.js';
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
 for(const [width,height,mobile] of [[1366,900,false],[390,844,true],[844,390,true]]){
  const row={width,height,mobile,checks:[],failures:[]};report.viewports.push(row);
  const {browserContextId}=await call('Target.createBrowserContext');const {targetId}=await call('Target.createTarget',{url:'about:blank',browserContextId});const {sessionId}=await call('Target.attachToTarget',{targetId,flatten:true});
  const cmd=(method,params={})=>call(method,params,sessionId);
  const evaluate=async expression=>{const r=await cmd('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
  const wait=async expression=>{for(let i=0;i<100;i++){if(await evaluate(expression))return;await delay(50);}throw new Error(`Wait failed: ${expression}`);};
  const run=()=>evaluate('JSON.parse(localStorage.getItem("morishi.element-skills.v1"))');
  const mouse=async(x,y)=>{await cmd('Input.dispatchMouseEvent',{type:'mouseMoved',x,y});await cmd('Input.dispatchMouseEvent',{type:'mousePressed',x,y,button:'left',clickCount:1});await cmd('Input.dispatchMouseEvent',{type:'mouseReleased',x,y,button:'left',clickCount:1});await delay(80);};
  const native=async(x,y,touch=mobile)=>{if(touch){await cmd('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});await cmd('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await delay(80);}else await mouse(x,y);};
  const click=async selector=>{await evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'center'})`);await delay(100);const p=await evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);await native(p.x,p.y);};
  const point=async(x,y)=>{await evaluate('document.querySelector("canvas").scrollIntoView({block:"center"})');await delay(100);return evaluate(`(()=>{const r=document.querySelector('canvas').getBoundingClientRect(),v=JSON.parse(localStorage.getItem("morishi.element-skills.v1")).view,s=Math.min(r.width/4096,r.height/3072)*v.zoom;return {x:r.x+r.width/2+(${x}-v.x)*s,y:r.y+r.height/2+(${y}-v.y)*s};})()`);};
  const screenshot=async name=>{await evaluate('window.scrollTo(0,0)');await delay(100);const image=await cmd('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await fs.writeFile(path.join(output,`${width}x${height}-${name}.png`),Buffer.from(image.data,'base64'));};
  const reload=async()=>{await evaluate('window.__beforeReload=true');await cmd('Page.reload');await wait('window.__beforeReload===undefined&&document.querySelector("#app")?.dataset.ready==="true"');};
  try{
   await cmd('Runtime.enable');await cmd('Page.enable');await cmd('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile});await cmd('Emulation.setTouchEmulationEnabled',{enabled:mobile,maxTouchPoints:5});
   const legacyScript=await cmd('Page.addScriptToEvaluateOnNewDocument',{source:'localStorage.setItem("morishi.ecosystem.v1","legacy ecosystem sentinel");localStorage.setItem("morishi.run.v1","legacy run sentinel")'});await cmd('Page.navigate',{url:'http://127.0.0.1:8781/ecosystem-v2.html'});await wait('document.querySelector("#app")?.dataset.ready==="true"');await cmd('Page.removeScriptToEvaluateOnNewDocument',{identifier:legacyScript.identifier});
   const initial=await run();ecoReplay(initial);assert.equal(initial.state.units.length,24);assert.ok(initial.state.units.every(u=>u.team==='enemy'));assert.equal(initial.state.hand.length,4);await screenshot('opening');
   await click('[data-card="0"]');if(mobile){assert.equal(await evaluate('document.querySelector("main").dataset.pane'),'detail');await click('#confirm');}assert.equal(await evaluate('document.querySelector("#cancel").hidden'),false);
   const p=await point(40,40);await native(p.x,p.y);const placed=await run();assert.equal(placed.state.units.length,25);assert.equal(placed.state.charges,2);assert.equal(placed.state.hand.length,3);assert.deepEqual(placed.state.units.at(-1).seed,initial.state.hand[0].seed);ecoReplay(placed);await screenshot('placed');
   if(mobile)await click('[data-pane="detail"]');for(const element of ['fire','ice','electric','dark']){await click(`[data-element="${element}"]`);assert.equal(await evaluate(`document.querySelector('[data-element="${element}"]').getAttribute('aria-pressed')`),'true');}await click('#skill-detail summary');assert.equal(await evaluate('document.querySelector("#skill-detail details").open'),true);await screenshot('element-skill-detail');
   if(mobile)await click('[data-pane="board"]');await reload();assert.deepEqual((await run()).state,placed.state);assert.equal(await evaluate('document.querySelector("#play").textContent'),'時間を進める');
   await click('[data-card="1"]');if(mobile)await click('#confirm');await click('#sp-mode');assert.equal(await evaluate('document.querySelector("#cancel").hidden'),true);const geometry=await evaluate(`(()=>{const m=document.querySelector('main'),panels=['detail','board','right'].map(id=>{const r=document.getElementById(id).getBoundingClientRect();return {width:r.width,height:r.height,x:r.x};});return {mode:m.classList.contains('sp-preview'),panels,scroll:m.scrollWidth,client:m.clientWidth,hand:document.getElementById('hand').getBoundingClientRect().height};})()`);assert.ok(geometry.mode);assert.ok(geometry.panels.every(p=>Math.abs(p.width-p.height*9/16)<1));assert.ok(geometry.panels.every(p=>Math.abs(p.width-geometry.panels[0].width)<1));assert.ok(geometry.panels[1].x>geometry.panels[0].x&&geometry.panels[2].x>geometry.panels[1].x);row.spGeometry=geometry;await screenshot('sp-preview');
   const cards=await evaluate('Array.from(document.querySelectorAll("#hand button")).map(b=>({top:b.getBoundingClientRect().top,left:b.getBoundingClientRect().left}))');assert.ok(cards.every((c,i)=>i===0||c.top>cards[i-1].top));assert.ok(cards.every(c=>Math.abs(c.left-cards[0].left)<1));
   await reload();assert.equal(await evaluate('document.querySelector("main").classList.contains("sp-preview")'),true);assert.deepEqual((await run()).state,placed.state);await click('#normal-mode');
   // Resizing cancels a pending placement without changing inventory or the board.
   await click('[data-card="1"]');if(mobile)await click('#confirm');await cmd('Emulation.setDeviceMetricsOverride',{width:width-10,height:height-10,deviceScaleFactor:1,mobile});await delay(250);assert.equal(await evaluate('document.querySelector("#cancel").hidden'),true);assert.deepEqual((await run()).state,placed.state);await cmd('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile});await delay(150);
   if(mobile)await click('[data-pane="board"]');const beforeZoom=(await run()).state;await click('#plus');assert.deepEqual((await run()).state,beforeZoom);await click('#play');await delay(1300);await click('#play');const active=await run();assert.ok(active.state.tick>placed.state.tick);ecoReplay(active);await reload();assert.deepEqual((await run()).state,active.state);
   // Six-row hand scroll and Pane scroll must not zoom or consume resources.
   const filled=createV2Game(294882,{healChance:.1});filled.activationPolicy='independent';for(let i=0;i<100;i++)stepV2(filled);assert.equal(filled.hand.length,6);const savedFilled=captureV2(filled,{x:2048,y:1536,zoom:1});ecoReplay(savedFilled);const inject=await cmd('Page.addScriptToEvaluateOnNewDocument',{source:'localStorage.setItem("morishi.element-skills.v1",'+JSON.stringify(JSON.stringify(savedFilled))+');'});await reload();await cmd('Page.removeScriptToEvaluateOnNewDocument',{identifier:inject.identifier});await click('#sp-mode');const rawBeforeScroll=await evaluate('localStorage.getItem("morishi.element-skills.v1")');await evaluate('document.getElementById("hand").scrollTop=100;document.getElementById("right").scrollTop=100');await delay(200);assert.equal(await evaluate('localStorage.getItem("morishi.element-skills.v1")'),rawBeforeScroll);assert.ok(await evaluate('document.getElementById("hand").scrollTop>0'));
   await evaluate('document.getElementById("hand").scrollTop=0;document.getElementById("hand").scrollIntoView({block:"center",inline:"center"})');await delay(150);const handRect=await evaluate('(()=>{const r=document.getElementById("hand").getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()');await cmd('Input.dispatchMouseEvent',{type:'mouseWheel',x:handRect.x,y:handRect.y,deltaX:0,deltaY:120});await delay(250);assert.ok(await evaluate('document.getElementById("hand").scrollTop>0'));assert.equal(await evaluate('localStorage.getItem("morishi.element-skills.v1")'),rawBeforeScroll);await screenshot('sp-scrolled');
   assert.equal(await evaluate('localStorage.getItem("morishi.ecosystem.v1")'),'legacy ecosystem sentinel');assert.equal(await evaluate('localStorage.getItem("morishi.run.v1")'),'legacy run sentinel');await click('#normal-mode');assert.equal(await evaluate('document.documentElement.scrollWidth>innerWidth'),false);
   row.checks.push('zero-ally disk opening; native placement; elemental tabs and skill accordion; exact stopped reload; SP equal-width panes and persisted mode; vertical six-row hand scroll independent of zoom; resize/mode cancels placement; old save keys untouched');
  }catch(e){row.failures.push(String(e));try{row.failedSave=await run();await screenshot('failure');}catch{}}
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
