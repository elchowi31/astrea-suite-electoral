import 'fake-indexeddb/auto';
import {test} from 'node:test';import assert from 'node:assert/strict';
import {queueAutomaticRoute,queuedAutomaticRoutes,removeQueuedAutomaticRoute,queuedLocations} from '../src/lib/deviceStorage';
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
