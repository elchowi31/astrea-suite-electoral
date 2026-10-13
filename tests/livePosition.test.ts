import {test} from 'node:test';import assert from 'node:assert/strict';
import {liveStatus,livePositionId,normalizeColombianPhone,whatsappInviteUrl,smsInviteUrl,routeInviteText,staleAlerts,type LivePosition} from '../src/lib/livePosition';

const at=Date.parse('2026-10-10T12:00:00Z');
const position=(secondsAgo:number,extra:Partial<LivePosition>={}):LivePosition=>({id:'t1--u1',tenantId:'t1',userId:'u1',routeId:'r1',deviceId:'d1',latitude:9.5,longitude:-74,accuracy:8,speed:null,heading:null,battery:80,source:'android',capturedAt:new Date(at-secondsAgo*1000).toISOString(),capturedAtMillis:at-secondsAgo*1000,...extra});

test('Live status separates live, delayed and lost signal by the age of the last fix',()=>{
  assert.equal(liveStatus(position(20),at),'en-vivo');assert.equal(liveStatus(position(90),at),'en-vivo');
  assert.equal(liveStatus(position(91),at),'demorado');assert.equal(liveStatus(position(300),at),'demorado');
  assert.equal(liveStatus(position(301),at),'sin-senal');
});
test('One live document per member and organization',()=>{assert.equal(livePositionId('t1','u1'),'t1--u1');});
test('A stationary heartbeat is fresh without inventing a new movement timestamp',()=>{
  const resting=position(600,{motion:'stationary',observedAtMillis:at-10000});assert.equal(liveStatus(resting,at),'en-reposo');assert.equal(resting.capturedAtMillis,at-600000);
  assert.equal(liveStatus({...resting,observedAtMillis:at-310000},at),'sin-senal');
});
test('Colombian mobile numbers are normalized for WhatsApp and SMS',()=>{
  assert.equal(normalizeColombianPhone('300 123 4567'),'573001234567');assert.equal(normalizeColombianPhone('+57 (300) 123-4567'),'573001234567');
  assert.equal(normalizeColombianPhone('573001234567'),'573001234567');assert.equal(normalizeColombianPhone('123'),'');assert.equal(normalizeColombianPhone(undefined),'');
  const url=whatsappInviteUrl('3001234567','Hola Ana');assert.equal(url,'https://wa.me/573001234567?text=Hola%20Ana');
  assert.equal(smsInviteUrl('3001234567','Hola'),'sms:+573001234567?body=Hola');assert.equal(whatsappInviteUrl('x','y'),'');
});
test('The invitation explains consent and how to start, without hidden tracking',()=>{
  const text=routeInviteText({employee:'Ana',route:'Ruta Arjona',date:'2026-10-12',appUrl:'https://astrea.example'});
  for(const fragment of ['Ana','Ruta Arjona','https://astrea.example','primera apertura','autorización de seguimiento','ubicación precisa','una sola vez','Solo los administradores'])assert.ok(text.includes(fragment),fragment);
  assert.equal(text.includes('Iniciar recorrido GPS'),false);
});
test('Alerts list only routes in progress whose phone stopped reporting',()=>{
  const routes=[{id:'r1',status:'En curso',name:'A',employeeName:'Ana',userId:'u1'},{id:'r2',status:'En curso',name:'B',employeeName:'Luis',userId:'u2'},{id:'r3',status:'Pausado',name:'C',employeeName:'Eva',userId:'u3'},{id:'r4',status:'En curso',name:'D',employeeName:'Sol',userId:'u4'}];
  const positions=[position(400,{routeId:'r1'}),position(10,{routeId:'r2',userId:'u2',id:'t1--u2'}),position(900,{routeId:'r3',userId:'u3',id:'t1--u3'})];
  assert.deepEqual(staleAlerts(routes,positions,at).map(alert=>[alert.routeId,alert.reason]),[['r1','sin-senal'],['r4','sin-datos']]);
});
