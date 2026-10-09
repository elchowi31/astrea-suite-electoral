import assert from 'node:assert/strict';
import { test } from 'node:test';
import { withAvailableModel } from '../src/lib/aiAvailability';

test('An overloaded primary model retries and an available alternate serves the response',async()=>{
  const calls:string[]=[];
  const result=await withAvailableModel(['primary','alternate'],async model=>{calls.push(model);if(model==='primary')throw {status:503};return 'provider response';},async()=>{});
  assert.equal(result,'provider response');assert.deepEqual(calls,['primary','primary','alternate']);
});
test('Invalid credentials fail immediately without more provider requests',async()=>{
  let calls=0;const failure={status:403};
  await assert.rejects(withAvailableModel(['primary','alternate'],async()=>{calls++;throw failure;},async()=>{}),error=>error===failure);
  assert.equal(calls,1);
});
test('Repeated temporary failures stop within a fixed limit and report unavailability',async()=>{
  let calls=0;
  await assert.rejects(withAvailableModel(['primary','primary','alternate'],async()=>{calls++;throw {status:503};},async()=>{}),/AI_SERVICE_UNAVAILABLE/);
  assert.equal(calls,4);
});
