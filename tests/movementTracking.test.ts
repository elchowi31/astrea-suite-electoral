import {test} from 'node:test';
import assert from 'node:assert/strict';
import {observeMovement,emptyMovement,automaticRoute,STOP_AFTER_MS} from '../src/lib/movementTracking';
import type {Fix} from '../src/lib/nativeTracking';
const at=Date.parse('2026-10-10T18:00:00Z');
const fix=(meters:number,seconds:number,accuracy=5):Fix=>({latitude:9.5+meters/111195,longitude:-74,accuracy,speed:null,heading:null,timestamp:at+seconds*1000});
const step=(state:ReturnType<typeof emptyMovement>,position:Fix)=>observeMovement(state,position,position.timestamp);

test('A table-still phone cannot start or extend a trip even when GPS drifts coherently by tens of metres',()=>{
  let state=emptyMovement();
  for(let second=0;second<900;second+=5){const result=step(state,{...fix(second/2,second),physicalMotion:false});state=result.state;assert.equal(result.started,undefined);assert.equal(result.sample,undefined);}
  state=step(emptyMovement(),{...fix(0,0),physicalMotion:true}).state;
  state=step(state,{...fix(28,20),physicalMotion:true}).state;
  state=step(state,{...fix(38,30),physicalMotion:true}).state;
  assert.equal(state.moving,true);
  let closed=false;
  for(let second=40;second<=330;second+=10){const result=step(state,{...fix(38+(second-30)/2,second),physicalMotion:false,speed:0});state=result.state;assert.equal(result.sample,undefined);closed ||= !!result.stoppedAt;}
  assert.equal(closed,true);assert.equal(state.moving,false);
});
test('Stationary phone and GPS drift create neither trips nor history',()=>{
  let state=emptyMovement();
  for(let second=0;second<900;second+=5){const result=step(state,fix(Math.sin(second)*4,second));state=result.state;assert.equal(result.started,undefined);assert.equal(result.sample,undefined);}
  assert.equal(state.moving,false);
});
test('A sustained walking displacement starts a trip; samples require further real movement',()=>{
  let state=step(emptyMovement(),fix(0,0)).state;
  let result=step(state,fix(28,20));state=result.state;assert.equal(result.started,undefined);
  result=step(state,fix(38,30));state=result.state;assert.equal(result.started?.length,3);assert.equal(state.moving,true);
  result=step(state,fix(40,40));state=result.state;assert.equal(result.sample,undefined);
  result=step(state,fix(52,45));assert.equal(result.sample?.latitude,fix(52,45).latitude);
  const route=automaticRoute('t1','u1','Ana','phone','t1--auto-test',result.state.anchor!);
  assert.equal(route.kind,'automatic');assert.equal(route.userId,route.createdBy);assert.deepEqual(route.route.geometry,[]);
});
test('A single location shift followed by rest does not fake a journey',()=>{
  let state=step(emptyMovement(),fix(0,0)).state;
  for(let second=20;second<300;second+=5){const result=step(state,fix(26+Math.sin(second)*2,second));state=result.state;assert.equal(result.started,undefined);}
});
test('Poor accuracy, impossible speed, stale fixes and out-of-order fixes are discarded',()=>{
  const state=step(emptyMovement(),fix(0,0)).state;
  for(const position of [fix(400,1),fix(30,10,80),fix(4,-1),{...fix(20,1),latitude:NaN}])assert.equal(step(state,position).accepted,false);
  assert.equal(observeMovement(state,fix(30,10),at+100_000).accepted,false);
});
test('Five minutes without displacement closes the trip at the last movement, and remains ready',()=>{
  let state=step(emptyMovement(),fix(0,0)).state;state=step(state,fix(28,20)).state;state=step(state,fix(38,30)).state;
  let stopped:number|undefined;
  for(let second=40;second<=330;second+=10){const result=step(state,fix(38+Math.sin(second),second));state=result.state;if(result.stoppedAt)stopped=result.stoppedAt;assert.equal(result.sample,undefined);}
  assert.equal(stopped,at+30_000);assert.equal(STOP_AFTER_MS,300_000);assert.equal(state.moving,false);
  state=step(state,fix(66,350)).state;assert.ok(step(state,fix(75,360)).started);
});
test('A signal gap closes the observed segment and requires movement confirmation again',()=>{
  let state=step(emptyMovement(),fix(0,0)).state;state=step(state,fix(28,20)).state;state=step(state,fix(38,30)).state;
  const result=step(state,fix(3000,600));assert.equal(result.stoppedAt,at+30_000);assert.equal(result.started,undefined);assert.equal(result.state.moving,false);
});

