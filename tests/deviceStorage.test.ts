import 'fake-indexeddb/auto';
import {test} from 'node:test';import assert from 'node:assert/strict';
import {queueAutomaticRoute,queuedAutomaticRoutes,removeQueuedAutomaticRoute,queuedLocations,clearAstreaBrowserStorage} from '../src/lib/deviceStorage';
import {automaticRoute} from '../src/lib/movementTracking';
Object.defineProperty(globalThis,'localStorage',{value:{getItem:()=>JSON.stringify({enabled:true})},configurable:true});
test('Queue upgrade preserves earlier GPS samples, and acknowledgment cannot erase a concurrently queued closure',async()=>{
  const legacy={id:'old',tenantId:'t1',userId:'u1',routeId:'old-route',latitude:9.5,longitude:-74,accuracy:5,capturedAt:'2026-10-10T12:00:00Z',capturedAtMillis:1};
  await new Promise<void>((resolve,reject)=>{const open=indexedDB.open('astrea-route-queue',1);open.onupgradeneeded=()=>open.result.createObjectStore('samples',{keyPath:'id'});open.onerror=()=>reject(open.error);open.onsuccess=()=>{const db=open.result;const transaction=db.transaction('samples','readwrite');transaction.objectStore('samples').put(legacy);transaction.oncomplete=()=>{db.close();resolve();};};});
  const route=automaticRoute('t1','u1','Ana','phone','r1',{latitude:9.5,longitude:-74,accuracy:5,speed:null,heading:null,timestamp:Date.now()});
  await queueAutomaticRoute(route);assert.deepEqual(await queuedLocations('u1','t1'),[legacy]);
  assert.equal((await queuedAutomaticRoutes('u1','t1')).length,1);assert.equal((await queuedAutomaticRoutes('u2','t1')).length,0);
  await queueAutomaticRoute(route,2000);await removeQueuedAutomaticRoute('r1');
  assert.equal((await queuedAutomaticRoutes('u1','t1'))[0].finishedAtMillis,2000);
  await removeQueuedAutomaticRoute('r1',2000);assert.deepEqual(await queuedAutomaticRoutes('u1','t1'),[]);
  assert.deepEqual(await queuedLocations('u1','t1'),[legacy]);
});

test('device withdrawal removes scoped scenarios, drafts and preferences from both stores',()=>{
 function storage(){const values=new Map([['astrea:simulaciones:v1:org','private'],['astrea-agent:user:org','draft-id'],['astrea-device-user','identity'],['unrelated-app','preserve']]);return {get length(){return values.size;},key:(index:number)=>[...values.keys()][index]??null,removeItem:(key:string)=>{values.delete(key);},values};}
 const local=storage(),session=storage();clearAstreaBrowserStorage([local,session]);for(const item of [local,session])assert.deepEqual([...item.values.keys()],['unrelated-app']);
});
