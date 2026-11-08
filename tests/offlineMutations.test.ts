import {test} from 'node:test';
import assert from 'node:assert/strict';
import {indexedDB} from 'fake-indexeddb';
import {DEVICE_KEY} from '../src/lib/deviceStorage';
import {durableMutation,queuedOfflineMutations,registerOfflineMutation,setOfflineMutationScope,syncOfflineMutations,retryOfflineMutations,discardFailedOfflineMutation} from '../src/lib/offlineMutations';

test('Durable offline capture, ordered replay, account isolation and recoverable errors',async t=>{
  const originals=new Map(['localStorage','indexedDB','navigator'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  const values=new Map([[DEVICE_KEY,JSON.stringify({enabled:true})]]);
  const network={onLine:false};
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(key:string)=>values.get(key)||null}});
  Object.defineProperty(globalThis,'indexedDB',{configurable:true,value:indexedDB});
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:network});
  const scope={userId:'offline-user',tenantId:'offline-team'};
  const applied:number[]=[];
  registerOfflineMutation('test-ordered',async payload=>{applied.push(payload.value);});
  setOfflineMutationScope(scope);
  try{
    await t.test('IDB acknowledges before capture resolves; duplicates reuse the same intent',async()=>{
      await durableMutation('test-ordered',scope,{value:1});
      await durableMutation('test-ordered',scope,{value:1});
      await durableMutation('test-ordered',scope,{value:2});
      assert.equal((await queuedOfflineMutations(scope)).length,2);
      assert.deepEqual(applied,[]);
    });
    await t.test('another account or tenant cannot replay or capture these changes',async()=>{
      network.onLine=true;
      const other={userId:'other',tenantId:scope.tenantId};
      setOfflineMutationScope(other);await syncOfflineMutations(scope);
      assert.deepEqual(applied,[]);
      await assert.rejects(durableMutation('test-ordered',scope,{value:3}),/cambió/);
      setOfflineMutationScope({...scope,tenantId:'another-team'});await syncOfflineMutations(scope);
      assert.deepEqual(applied,[]);
    });
    await t.test('reconnect with original scope replays once in capture order',async()=>{
      setOfflineMutationScope(scope);
      await Promise.all([syncOfflineMutations(scope),syncOfflineMutations(scope)]);
      assert.deepEqual(applied,[1,2]);
      assert.equal((await queuedOfflineMutations(scope)).length,0);
    });
    await t.test('permission rejection remains durable and blocks dependent changes until reviewed',async()=>{
      let allow=false;
      registerOfflineMutation('test-permission',async()=>{if(!allow)throw Object.assign(new Error('Permiso retirado'),{code:'permission-denied'});});
      network.onLine=false;
      await durableMutation('test-permission',scope,{});await durableMutation('test-ordered',scope,{value:3});
      network.onLine=true;await syncOfflineMutations(scope);
      const pending=await queuedOfflineMutations(scope);
      assert.equal(pending[0].status,'failed');assert.equal(pending[0].errorCode,'permission-denied');
      assert.equal(pending.length,2);assert.deepEqual(applied,[1,2]);
      allow=true;await retryOfflineMutations(scope);
      assert.equal((await queuedOfflineMutations(scope)).length,0);assert.deepEqual(applied,[1,2,3]);
    });
    await t.test('transient failure stays pending and retries on a later reconnect',async()=>{
      let calls=0;
      registerOfflineMutation('test-network',async()=>{if(++calls===1)throw Object.assign(new Error('Network lost'),{code:'unavailable'});});
      network.onLine=false;await durableMutation('test-network',scope,{});network.onLine=true;
      await syncOfflineMutations(scope);assert.equal((await queuedOfflineMutations(scope))[0].status,'pending');
      await syncOfflineMutations(scope);assert.equal((await queuedOfflineMutations(scope)).length,0);
    });
    await t.test('clearing a failed local change requires its original account scope',async()=>{
      registerOfflineMutation('test-error',async()=>{throw new Error('Conflicto');});
      await assert.rejects(durableMutation('test-error',scope,{}),/Conflicto/);
      const row=(await queuedOfflineMutations(scope))[0];
      setOfflineMutationScope(null);await assert.rejects(discardFailedOfflineMutation(scope,row.id));
      setOfflineMutationScope(scope);await discardFailedOfflineMutation(scope,row.id);
      assert.equal((await queuedOfflineMutations(scope)).length,0);
    });
    await t.test('without local storage consent offline capture rejects without claiming saved data',async()=>{
      values.set(DEVICE_KEY,JSON.stringify({enabled:false}));network.onLine=false;
      await assert.rejects(durableMutation('test-ordered',scope,{value:4}),/Conservación/);
      assert.equal((await queuedOfflineMutations(scope)).length,0);
    });
  }finally{
    setOfflineMutationScope(null);
    for(const [key,descriptor]of originals)if(descriptor)Object.defineProperty(globalThis,key,descriptor);else Reflect.deleteProperty(globalThis,key);
  }
});
