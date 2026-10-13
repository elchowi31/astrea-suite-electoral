import {test} from 'node:test';
import assert from 'node:assert/strict';
import {teamLocations} from '../src/lib/teamLocations';
import {layerCoordinates,type GeographicLayer} from '../src/lib/geographicImport';
import type {Leader,TransportVehicle,UserProfile} from '../src/types';
import type {LivePosition} from '../src/lib/livePosition';
import type {AssignedRoute} from '../src/lib/routeTracking';
const now=10000000;
const admin={uid:'admin',role:'AdminGlobal',tenantId:'own'} as UserProfile;
const member={uid:'person',tenantId:'team',email:'lider@example.test',phone:'+57 3001234567',active:true,accessVersion:2} as UserProfile;
const leader={id:'leader',tenantId:'team',fullName:'Líder',email:' LIDER@example.test ',zoneOrDistrict:'Zona'} as Leader;
const vehicle={id:'vehicle',tenantId:'team',licensePlate:'TEST',driverName:'Conductor',driverPhone:'3001234567',assignedZone:'Zona'} as TransportVehicle;
const position={id:'position',tenantId:'team',userId:'person',routeId:'route',latitude:9.5,longitude:-73.9,accuracy:5,capturedAtMillis:now-1000,capturedAt:new Date(now-1000).toISOString()} as LivePosition;
const route={id:'route',tenantId:'team',userId:'person',vehicleId:'vehicle',status:'En curso'} as AssignedRoute;
const input={viewer:admin,tenantId:'team',leaders:[leader],vehicles:[vehicle],members:[member],positions:[position],routes:[route],now};
test('Only verified administrators can obtain personal tracking, scoped to the organization',()=>{
  for(const viewer of [null,{...member,role:'Alcalde'},{...member,role:'LiderVeredal'},{...member,role:'AdminTenant',tenantId:'foreign'},{...member,role:'AdminTenant',active:false}] as (UserProfile|null)[])assert.deepEqual(teamLocations({...input,viewer}),{leaders:[],vehicles:[]});
  assert.equal(teamLocations({...input,viewer:{...member,role:'AdminTenant'}}).leaders[0].source,'gps');
  const result=teamLocations({...input,positions:[{...position,tenantId:'foreign'}],members:[member,{...member,uid:'other',tenantId:'foreign'}]});assert.equal(result.leaders[0].source,'missing');
});
test('Leaders use a unique active account email; teams count linked members without borrowing their position',()=>{
  const rows=teamLocations({...input,members:[member,{...member,uid:'worker',email:'worker@example.test',assignedLeaderId:'leader'}]}).leaders;
  assert.equal(rows[0].point?.latitude,9.5);assert.equal(rows[0].members,2);assert.equal(rows[0].routeId,'route');
  assert.equal(teamLocations({...input,members:[member,{...member,uid:'duplicate'}]}).leaders[0].source,'missing');
  assert.equal(teamLocations({...input,members:[{...member,email:'different@example.test',displayName:'Líder',assignedLeaderId:'leader'}]}).leaders[0].source,'missing');
});
test('Vehicles link by the active vehicle assignment or a unique normalized driver phone',()=>{
  assert.equal(teamLocations({...input,vehicles:[{...vehicle,driverPhone:''}]}).vehicles[0].userId,'person');
  assert.equal(teamLocations({...input,routes:[]}).vehicles[0].userId,'person');
  assert.equal(teamLocations({...input,routes:[],members:[member,{...member,uid:'duplicate'}]}).vehicles[0].source,'missing');
  assert.equal(teamLocations({...input,routes:[{...route,status:'Finalizado'}],vehicles:[{...vehicle,driverPhone:''}]}).vehicles[0].source,'missing');
});
test('Missing, old, invalid and future GPS are distinguished from registered coordinates',()=>{
  const registered={...leader,latitude:8,longitude:-74};
  assert.equal(teamLocations({...input,leaders:[registered],positions:[]}).leaders[0].source,'registered');
  assert.equal(teamLocations({...input,positions:[{...position,capturedAtMillis:now-400000}]}).leaders[0].status,'Sin señal reciente');
  for(const bad of [{...position,latitude:999},{...position,capturedAtMillis:now+120000},{...position,capturedAtMillis:NaN}])assert.equal(teamLocations({...input,positions:[bad]}).leaders[0].source,'missing');
});
test('Layer fitting covers multiple parts, geometries and polygon holes and ignores invalid coordinates',()=>{
  const p=(latitude:number)=>({latitude,longitude:-73});
  const layers=[{features:[{geometries:[{type:'Point',coordinates:[p(9)]},{type:'Polygon',coordinates:[p(10),p(11)],holes:[{coordinates:[p(12)]}]}]}]},{features:[{geometries:[{type:'LineString',coordinates:[p(13),p(14),p(999)]}]}]}] as GeographicLayer[];
  assert.deepEqual(layerCoordinates(layers).map(point=>point.latitude),[9,10,11,12,13,14]);assert.deepEqual(layerCoordinates([]),[]);
});
