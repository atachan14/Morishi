// Existing Edge only; isolated temporary profile, loopback target, no user browser access.
import {spawn} from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {validatePlacement,placementForecast,insideTerritory} from '../.test-dist/src/sim.js';
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
  const point=async(x,y)=>{await evaluate('document.querySelector("canvas").scrollIntoView({block:"center"})');return evaluate(`(()=>{const r=document.querySelector('canvas').getBoundingClientRect(),s=Math.min(r.width/12,r.height/9),v=JSON.parse(localStorage.getItem("morishi.run.v1")).view;return {x:r.x+(r.width-12*s)/2+(6+(${x}-v.x)*v.zoom)*s,y:r.y+(r.height-9*s)/2+(4.5+(${y}-v.y)*v.zoom)*s};})()`);};
  const tap=async(x,y)=>{const p=await point(x,y);if(mobile){await cmd('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:p.x,y:p.y,id:1}]});await cmd('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await delay(70);}else await mouse(p.x,p.y);};
  const screenshot=async name=>{await evaluate('window.scrollTo(0,0)');await delay(70);const image=await cmd('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await fs.writeFile(path.join(output,`${width}x${height}-${name}.png`),Buffer.from(image.data,'base64'));};
  try{
   await cmd('Runtime.enable');await cmd('Page.enable');await cmd('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile});await cmd('Emulation.setTouchEmulationEnabled',{enabled:mobile,maxTouchPoints:5});await cmd('Page.navigate',{url:'http://127.0.0.1:8781'});await wait('document.querySelector("#app")?.dataset.ready==="true"&&document.querySelector("canvas")?.width>0');
   row.seeds=[];
   await click('button[aria-label="盤面全体を表示"]');await tap(4,4);assert.equal((await run()).actions.length,1);row.checks.push('initial insertion between enemies at world 4,4 works outside old strip');await screenshot('gap');
   for(const seed of [20261011,1,11]){
    if(mobile)await click('[data-pane="right"]');await evaluate('document.querySelector("#seed").value='+seed);await click('#same');await wait('document.querySelector("#app").dataset.ready==="true"');assert.equal((await run()).seed,seed);assert.equal((await run()).tick,0);if(mobile)await click('[data-pane="board"]');await click('button[aria-label="盤面全体を表示"]');
    const trial={seed,placements:0,eventStops:[],releaseSamples:0};row.seeds.push(trial);
    for(let event=0;event<24;event++){
     let saved=await run();if(saved.snapshot.outcome!=='playing')break;
     while(saved.snapshot.charges>0&&saved.snapshot.cards.length){const selected=pick(saved.snapshot);if(!selected)break;const count=saved.actions.length;await tap(selected.x,selected.y);saved=await run();assert.equal(saved.actions.length,count+1);trial.placements++;}
     const before=saved.snapshot,blocked=candidates.filter(p=>!insideTerritory(before,p.x,p.y));await click('#skip');await wait('document.querySelector("#skip").textContent==="変化まで"');saved=await run();assert.ok(saved.tick>before.tick);const dead=before.units.filter(u=>u.team==='enemy'&&!saved.snapshot.units.some(v=>v.id===u.id));
     const released=blocked.filter(p=>insideTerritory(saved.snapshot,p.x,p.y));trial.releaseSamples+=released.length;trial.eventStops.push({tick:saved.tick,reason:await evaluate('document.querySelector("#message").textContent'),dead:dead.map(u=>u.id),released:released.length,charges:saved.snapshot.charges});
     if(dead.length&&trial.eventStops.filter(e=>e.dead.length).length===1){assert.ok(released.length>0);await screenshot('release-'+seed);}
    }
    const result=await run();trial.result={tick:result.tick,outcome:result.snapshot.outcome,enemies:result.snapshot.units.filter(u=>u.team==='enemy').length,allies:result.snapshot.units.filter(u=>u.team==='ally').length,cards:result.snapshot.cards.length};assert.equal(trial.result.outcome,'win');await screenshot('win-'+seed);
   }
   row.checks.push('three short seeds: focused legal placements, resource from kills, event pauses, actual field release and conquest');
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
