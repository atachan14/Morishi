import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createState,place,step,finishRun,decisionHint,resultDiagnosis,effectiveRange,type State} from '../src/sim.js';
test('board guidance explains exact periodic supply time, without claiming kills cannot refill early',()=>{
  const s=createState();place(s,1,2);place(s,1,4);place(s,1,6);s.tick=239;
  const before=structuredClone(s),hint=decisionHint(s);assert.equal(hint.kind,'supply');assert.equal(hint.readyInTicks,1);assert.match(hint.text,/0.1ゲーム秒/);assert.match(hint.text,/敵攻略でも/);assert.deepEqual(s,before);
  step(s);assert.equal(s.charges,1);assert.equal(decisionHint(s).kind,'other');
});
test('last-card warning only appears for a started, live run with remaining cards',()=>{
  const s=createState();assert.equal(decisionHint(s).kind,'other');place(s,1,2);s.cards=s.cards.slice(0,3);
  assert.equal(decisionHint(s).kind,'last-cards');s.charges=0;assert.equal(decisionHint(s).kind,'supply');s.cards=[];assert.equal(decisionHint(s).kind,'other');s.outcome='loss';assert.equal(decisionHint(s).kind,'other');
});
function unreachable():State {
  const s=createState();place(s,1,1);s.cards=[];s.units=s.units.filter(u=>u.id===1||u.team==='ally');
  s.units[0].x=10;s.units[0].y=8;for(const u of s.units)u.age=224;s.outcome='loss';s.events=['芽を使い切り、成長しても攻撃が届かない盤面になりました。'];return s;
}
test('unreachable diagnosis identifies a real remaining enemy and exact mature range gap without mutation',()=>{
  const s=unreachable(),before=structuredClone(s),d=resultDiagnosis(s)!;
  assert.equal(d.kind,'unreachable');assert.equal(d.enemyId,1);const ally=s.units.find(u=>u.id===d.allyId)!;assert.equal(d.range,effectiveRange(ally)*2);assert.equal(d.distance,Math.hypot(ally.x-10,ally.y-8));assert.equal(d.gap,d.distance!-d.range!);assert.match(d.message,/敵 #1/);assert.deepEqual(s,before);
});
test('voluntary finish is distinguished from an unreachable loss and normal victory',()=>{
  const s=unreachable();s.outcome='playing';assert.equal(finishRun(s),true);assert.equal(resultDiagnosis(s)?.kind,'manual');s.outcome='win';assert.equal(resultDiagnosis(s)?.kind,'win');s.outcome='playing';assert.equal(resultDiagnosis(s),undefined);
});
test('spent and defeated diagnosis does not claim a range gap or point to nonexistent allies',()=>{
  const s=createState();s.started=true;s.cards=[];s.outcome='loss';const d=resultDiagnosis(s)!;assert.equal(d.kind,'defeated');assert.equal(d.allyId,undefined);assert.match(d.message,/味方の植物が残っていません/);
});
