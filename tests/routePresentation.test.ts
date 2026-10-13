import {test} from 'node:test';
import assert from 'node:assert/strict';
import {automaticRoute} from '../src/lib/movementTracking';
import {detailSamples, routeDay, routeDuration, routeTiming} from '../src/lib/routePresentation';
import type {RouteSample} from '../src/lib/routeTracking';

const start=Date.parse('2026-10-10T04:55:00Z');
const route=automaticRoute('team','person','Persona','phone','trip',{latitude:9.5,longitude:-74,accuracy:5,speed:null,heading:null,timestamp:start});
const sample=(minutes:number,patch:Partial<RouteSample>={}):RouteSample=>({id:`p-${minutes}`,tenantId:'team',userId:'person',routeId:'trip',latitude:9.5+minutes/1000,longitude:-74,accuracy:5,capturedAt:new Date(start+minutes*60_000).toISOString(),capturedAtMillis:start+minutes*60_000,...patch});

test('Route detail excludes another trip or team, invalid positions, and orders the remaining points chronologically',()=>{
  const points=detailSamples(route,[sample(2),sample(1,{routeId:'other'}),sample(1,{tenantId:'other'}),sample(1,{latitude:NaN}),sample(1,{accuracy:-1}),sample(0)]);
  assert.deepEqual(points.map(point=>point.id),['p-0','p-2']);
});

test('Route date filters use the day in Colombia, including trips around UTC midnight',()=>{
  assert.equal(routeDay(route),'2026-10-09');
  assert.equal(routeDay({...route,startedAt:undefined,startedAtMillis:undefined,scheduledDate:'2026-10-12'}),'2026-10-12');
});

test('An unfinished route duration ends at the last recorded point, not at the current time',()=>{
  const timing=routeTiming(route,[sample(3),sample(0)]);
  assert.equal(timing.elapsed,180_000);
  assert.equal(timing.finish,undefined);
  assert.equal(routeDuration(timing.elapsed),'3 min');
});

test('A completed route keeps its recorded finish time and does not invent a duration without points or timestamps',()=>{
  const timing=routeTiming({...route,finishedAtMillis:start+90_000},[sample(0),sample(1)]);
  assert.equal(timing.elapsed,90_000);
  assert.equal(routeTiming({...route,startedAt:undefined,startedAtMillis:undefined},[]).elapsed,undefined);
  assert.equal(routeDuration(undefined),'Sin registro');
  assert.equal(routeDuration(0),'0 s');
});
