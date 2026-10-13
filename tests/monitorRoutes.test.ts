import {test} from 'node:test';
import assert from 'node:assert/strict';
import {monitorRoutes} from '../src/lib/monitorRoutes';
import {automaticRoute} from '../src/lib/movementTracking';
const route=(tenantId:string,id:string)=>automaticRoute(tenantId,'person','Persona','phone',id,{latitude:9.5,longitude:-74,accuracy:5,speed:null,heading:null,timestamp:1_000_000});

test('Monitoring a different team does not display the automatic trip of the administrator phone',()=>{
  const own=route('own','local'),member=route('team','member');
  assert.deepEqual(monitorRoutes([member],own,'team'),[member]);
});

test('The selected team excludes stale results from a previous subscription',()=>{
  const previous=route('previous','old'),member=route('team','member');
  assert.deepEqual(monitorRoutes([previous,member],null,'team'),[member]);
  assert.deepEqual(monitorRoutes([previous],null,'team'),[]);
});

test('Returning to the own team preserves the current local trip and avoids its server duplicate',()=>{
  const local=route('own','same'),server={...local,status:'Pausado' as const},other=route('own','other');
  assert.deepEqual(monitorRoutes([server,other],local,'own'),[local,other]);
});
