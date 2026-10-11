// Existing Edge only; isolated temporary profile, loopback target, no user browser access.
import {spawn} from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {createState,validatePlacement,placementForecast,insideTerritory,supplyStats} from '../.test-dist/src/sim.js';
import {capture,replay} from '../.test-dist/src/session.js';
import {BoardCamera,introView} from '../.test-dist/src/camera.js';
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
  const point=async(x,y)=>{await evaluate('document.querySelector("canvas").scrollIntoView({block:"center"})');await delay(100);return evaluate(`(()=>{const r=document.querySelector('canvas').getBoundingClientRect(),saved=JSON.parse(localStorage.getItem("morishi.run.v1")),stage=saved.snapshot.stage,s=Math.min(r.width/stage.width,r.height/stage.height),v=saved.view;return {x:r.x+(r.width-stage.width*s)/2+(stage.width/2+(${x}-v.x)*v.zoom)*s,y:r.y+(r.height-stage.height*s)/2+(stage.height/2+(${y}-v.y)*v.zoom)*s};})()`);};
  const tap=async(x,y)=>{const p=await point(x,y);if(mobile){await cmd('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:p.x,y:p.y,id:1}]});await cmd('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await delay(70);}else await mouse(p.x,p.y);};
  const screenshot=async name=>{await evaluate('window.scrollTo(0,0)');await delay(70);const image=await cmd('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await fs.writeFile(path.join(output,`${width}x${height}-${name}.png`),Buffer.from(image.data,'base64'));};
  try{
   await cmd('Runtime.enable');await cmd('Page.enable');await cmd('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile});await cmd('Emulation.setTouchEmulationEnabled',{enabled:mobile,maxTouchPoints:5});await cmd('Page.navigate',{url:'http://127.0.0.1:8781'});await wait('document.querySelector("#app")?.dataset.ready==="true"&&document.querySelector("canvas")?.width>0');

   const load=async(save)=>{replay(save);const marker=String(Date.now())+Math.random();const {identifier}=await cmd('Page.addScriptToEvaluateOnNewDocument',{source:'localStorage.setItem("morishi.run.v1",'+JSON.stringify(JSON.stringify(save))+');window.__qaLoad='+JSON.stringify(marker)+';'});await cmd('Page.reload');await wait('window.__qaLoad==='+JSON.stringify(marker)+'&&document.querySelector("#app")?.dataset.ready==="true"');await cmd('Page.removeScriptToEvaluateOnNewDocument',{identifier});await delay(150);};
   assert.equal((await run()).snapshot.supplyMode,'endless');assert.equal((await run()).snapshot.cards.length,4);row.checks.push('new default run uses endless indexed supply');
   // Real legacy shape: no stage/supply fields, original finite cards retained.
   const old=capture(createState(11),1,[]);old.version='2026-10-11-snapshot-4';delete old.snapshot.stage;delete old.snapshot.supplyMode;delete old.snapshot.supplyIndex;delete old.checksum;let hash=2166136261;for(const c of JSON.stringify(old))hash=Math.imul(hash^c.charCodeAt(0),16777619);old.checksum=(hash>>>0).toString(16);await load(old);assert.equal((await run()).snapshot.supplyMode,'finite');assert.equal((await run()).snapshot.cards.length,18);assert.ok((await evaluate('document.querySelector("#supply").textContent')).includes('残りの芽 18'));row.checks.push('legacy finite run restored without conversion to endless');
   row.seeds=[];
   for(const seed of [20261011,1,11]){
    const stage={width:36,height:27,enemyCount:24},state=createState(seed,stage,'endless');await load(capture(state,1,[],introView(state)));const saved=await run();assert.deepEqual(saved.snapshot,state);assert.ok(saved.view.zoom>3);
    const rect=await evaluate('document.querySelector("canvas").getBoundingClientRect().toJSON()'),cam=new BoardCamera(saved.view,stage),bounds=cam.bounds(rect.width,rect.height),points=[];
    for(let y=bounds.y+.8;y<bounds.y+bounds.height-.8;y+=.4)for(let x=bounds.x+.8;x<bounds.x+bounds.width-.8;x+=.4)if(validatePlacement(state,x,y).ok)points.push({x,y});points.sort((a,b)=>Math.hypot(a.x-cam.view.x,a.y-cam.view.y)-Math.hypot(b.x-cam.view.x,b.y-cam.view.y));assert.ok(points.length);const p=points[0];await tap(p.x,p.y);let current=await run();assert.equal(current.actions.length,1);assert.equal(current.snapshot.supplyIndex,1);assert.equal(current.snapshot.cards.length,4);assert.deepEqual(current.snapshot.cards[0],supplyStats(seed,stage,1));
    const at=await point(p.x,p.y);await cmd('Input.dispatchMouseEvent',{type:'mouseWheel',x:at.x,y:at.y,deltaY:-100,deltaX:0});await delay(100);const beforePan=await run();
    const start=await point(cam.view.x,cam.view.y),end={x:start.x+25,y:start.y+20};if(mobile){await cmd('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:start.x,y:start.y,id:1}]});await cmd('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:end.x,y:end.y,id:1}]});await cmd('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}else{await cmd('Input.dispatchMouseEvent',{type:'mousePressed',x:start.x,y:start.y,button:'left',clickCount:1});await cmd('Input.dispatchMouseEvent',{type:'mouseMoved',x:end.x,y:end.y,button:'left',buttons:1});await cmd('Input.dispatchMouseEvent',{type:'mouseReleased',x:end.x,y:end.y,button:'left',clickCount:1});}await delay(100);current=await run();assert.equal(current.actions.length,1);assert.notDeepEqual(current.view,beforePan.view);
    const beforeReload=current;await cmd('Page.reload');await delay(300);await wait('document.querySelector("#app")?.dataset.ready==="true"');await delay(100);current=await run();assert.deepEqual(current.snapshot,beforeReload.snapshot);assert.deepEqual(current.view,beforeReload.view);assert.deepEqual(current.snapshot.cards,beforeReload.snapshot.cards);
    await click('#tick');current=await run();assert.equal(current.tick,1);assert.equal(current.snapshot.stage.enemyCount,24);await screenshot('large-'+seed);
    await click('#finish');assert.ok((await evaluate('document.querySelector("#run-result").textContent')).includes('/24体'));assert.equal((await run()).snapshot.supplyMode,'endless');row.seeds.push({seed,stage,placement:p,supplyIndex:current.snapshot.supplyIndex,queue:current.snapshot.cards.length,view:current.view,tick:current.tick,units:current.snapshot.units.length});
   }
   await click('#restart');await wait('document.querySelector("#app")?.dataset.ready==="true"');let resetSave=await run();assert.deepEqual(resetSave.snapshot.stage,{width:36,height:27,enemyCount:24});assert.equal(resetSave.snapshot.supplyIndex,0);assert.equal(resetSave.snapshot.supplyMode,'endless');
   const late=createState(11,{width:36,height:27,enemyCount:24},'endless');late.supplyIndex=19;late.nextId=44;late.started=true;late.tick=100;for(const u of late.units)u.age=100;late.cards=Array.from({length:4},(_,i)=>supplyStats(11,late.stage,19+i));await load(capture(late,1,[],introView(late)));
   const lp={x:.4,y:.4};await load(capture(late,1,[],new BoardCamera({x:.4,y:.4,zoom:5.4},late.stage).view));await tap(lp.x,lp.y);const afterLate=await run();assert.equal(afterLate.snapshot.supplyIndex,20);assert.equal(afterLate.snapshot.cards.length,4);assert.deepEqual(afterLate.snapshot.cards[0],supplyStats(11,late.stage,20));replay(afterLate);if(mobile)await click('[data-pane="left"]');assert.ok((await evaluate('document.querySelector("#supply").textContent')).includes('芽の供給 継続'));if(mobile)await click('[data-pane="board"]');row.checks.push('indexed supply past 18 works through native placement and seed reset preserves stage');
   row.checks.push('three larger seeded fixtures: native fractional placement, zoom/pan, exact snapshot+view+queue reload, one-tick resume, variable-count result');
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
