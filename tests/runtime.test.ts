import {test} from 'node:test';
import assert from 'node:assert/strict';
import {TapGesture,ForegroundGate,canvasSize} from '../src/runtime.js';
import {createState,place,Clock} from '../src/sim.js';

test('hidden or tiny Pane sizes are ignored, and positive framebuffer sizes are whole pixels',()=>{
  for(const [w,h] of [[0,0],[300,0],[0,200],[-1,200],[.5,200],[300,NaN],[Infinity,200]])assert.equal(canvasSize(w,h),null);
  assert.deepEqual(canvasSize(364.7,273.5),{width:364,height:273});
});
test('short primary tap commits only on release and only once',()=>{
  const tap=new TapGesture();tap.down(1,10.125,20.375,100,'view');assert.equal(tap.up(1,11,21,200,'view'),true);assert.equal(tap.up(1,11,21,201,'view'),false);
});
test('dragging out and back never becomes a tap',()=>{
  const tap=new TapGesture();tap.down(1,10,20,100,'view');tap.move(1,30,20);tap.move(1,10,20);assert.equal(tap.up(1,10,20,200,'view'),false);
});
test('right click, long press, and cancelled pointer never commit',()=>{
  const tap=new TapGesture();tap.down(1,10,20,100,'view',true,2);assert.equal(tap.up(1,10,20,150,'view'),false);
  tap.down(1,10,20,100,'view');assert.equal(tap.up(1,10,20,601,'view'),false);
  tap.down(1,10,20,100,'view');tap.cancel();assert.equal(tap.up(1,10,20,150,'view'),false);
});
test('multitouch cancels both fingers, then a fresh tap still works',()=>{
  const tap=new TapGesture();tap.down(1,10,20,100,'view');tap.down(2,20,20,105,'view',false);assert.equal(tap.up(2,20,20,130,'view'),false);assert.equal(tap.up(1,10,20,150,'view'),false);
  tap.down(3,10,20,200,'view');assert.equal(tap.up(3,10,20,250,'view'),true);
});
test('resize, scroll viewport changes, and Pane switches cancel a pending tap',()=>{
  const tap=new TapGesture();tap.down(1,10,20,100,'rect-a');assert.equal(tap.up(1,10,20,150,'rect-b'),false);
  tap.down(1,10,20,100,'rect-a');tap.cancel();assert.equal(tap.up(1,10,20,150,'rect-a'),false);
});
test('non-finite pointer data cannot create a valid tap',()=>{
  const tap=new TapGesture();tap.down(1,NaN,20,100,'view');assert.equal(tap.up(1,10,20,150,'view'),false);
  tap.down(1,10,20,100,'view');assert.equal(tap.up(1,Infinity,20,150,'view'),false);
});
test('background interruption pauses, drops partial tick and never catches up on return',()=>{
  const s=createState(),clock=new Clock(),gate=new ForegroundGate();place(s,1,2);clock.paused=false;clock.advance(s,50);gate.interrupt(clock);const before=structuredClone(s);
  clock.advance(s,gate.frame(600000));assert.deepEqual(s,before);assert.equal(clock.paused,true);
  clock.paused=false;clock.advance(s,gate.frame(50));assert.equal(s.tick,0);clock.advance(s,gate.frame(50));assert.equal(s.tick,1);
});
test('first returning frame is suppressed even if play is clicked before that frame',()=>{
  const s=createState(),clock=new Clock(),gate=new ForegroundGate();place(s,1,2);clock.speed=4;gate.interrupt(clock);clock.paused=false;clock.advance(s,gate.frame(600000));assert.equal(s.tick,0);clock.advance(s,gate.frame(100));assert.equal(s.tick,4);
});
