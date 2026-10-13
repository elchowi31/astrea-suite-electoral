import {test} from 'node:test';import assert from 'node:assert/strict';
import {flushTrackingQueue,type TrackingQueueIO} from '../src/lib/trackingQueue';
import {automaticRoute} from '../src/lib/movementTracking';
import type {QueuedRoute,QueuedLocation} from '../src/lib/deviceStorage';
const at=Date.now();const route=automaticRoute('t1','u1','Ana','phone','r1',{latitude:9.5,longitude:-74,accuracy:5,speed:null,heading:null,timestamp:at});
const row:QueuedRoute={id:'r1',route,finishedAtMillis:at+10000};
const sample:QueuedLocation={id:'p1',tenantId:'t1',userId:'u1',routeId:'r1',latitude:9.5,longitude:-74,accuracy:5,capturedAt:new Date(at).toISOString(),capturedAtMillis:at};
function io(events:string[]):TrackingQueueIO{return {routes:async()=>[row],samples:async()=>[sample],createRoute:async()=>{events.push('create');},writeSample:async()=>{events.push('sample');},removeSample:async()=>{events.push('ack-sample');},finishRoute:async()=>{events.push('finish');},removeRoute:async(_id,finishedAt)=>{assert.equal(finishedAt,row.finishedAtMillis);events.push('ack-route');}};}
test('Offline journey synchronizes its header, samples and closure in order',async()=>{const events:string[]=[];assert.equal(await flushTrackingQueue(io(events)),1);assert.deepEqual(events,['create','sample','ack-sample','finish','ack-route']);});
test('A rejected header keeps samples and closure queued',async()=>{const events:string[]=[];const queue=io(events);queue.createRoute=async()=>{throw new Error('denied');};await assert.rejects(flushTrackingQueue(queue),/denied/);assert.deepEqual(events,[]);});
test('A rejected sample is not removed, and the trip closure is kept for retry',async()=>{const events:string[]=[];const queue=io(events);queue.writeSample=async()=>{throw new Error('offline');};await assert.rejects(flushTrackingQueue(queue),/offline/);assert.deepEqual(events,['create']);});
