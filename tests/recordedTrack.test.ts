import {test} from 'node:test';import assert from 'node:assert/strict';
import {recordedTrackLayers} from '../src/lib/recordedTrack';import {automaticRoute} from '../src/lib/movementTracking';
import type {QueuedLocation} from '../src/lib/deviceStorage';
test('The live trail preserves recorded movement and splits signal gaps instead of drawing an invented connection',()=>{
  const at=Date.now();const route=automaticRoute('t1','u1','Ana','phone','r1',{latitude:9.5,longitude:-74,accuracy:5,speed:null,heading:null,timestamp:at});
  const row=(second:number,accuracy=5):QueuedLocation=>({id:String(second),tenantId:'t1',userId:'u1',routeId:'r1',latitude:9.5+second/10000,longitude:-74,accuracy,capturedAt:new Date(at+second*1000).toISOString(),capturedAtMillis:at+second*1000});
  assert.deepEqual(recordedTrackLayers(route,[row(0)]),[]);
  const layers=recordedTrackLayers(route,[row(0),row(10),row(11,500),row(500),row(510)]);
  assert.equal(layers[0].features[0].geometries.length,2);assert.equal(layers[0].features[0].geometries[0].coordinates.length,2);
});
