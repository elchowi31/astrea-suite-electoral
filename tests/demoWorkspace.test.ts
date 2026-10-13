import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildDemoBundle} from '../src/data/demoSeed';
import {patchDemoBundle,realRecordFromDemo,demoRows} from '../src/lib/demoWorkspace';
import {chartCoverage,CHART_INVENTORY} from '../src/data/chartInventory';
import {categoryColors,CHART_COLORS} from '../src/lib/chartPalette';
import {prepareDemoPresentation} from '../src/data/demoPresentation';
import type {UserProfile} from '../src/types';
const profile:UserProfile={uid:'user',tenantId:'team',role:'AdminTenant',email:'test@example.invalid',displayName:'Prueba',active:true,createdAt:'2026-10-13',department:'Cesar',municipality:'Astrea'};
const bundle=()=>buildDemoBundle('team',profile);

test('Every chart has a populated generated source, including small territorial profiles',()=>{
  for(const role of ['AdminTenant','Alcalde','LiderVeredal'] as const){
    const data=buildDemoBundle('team',{...profile,role});const missing=chartCoverage(data).filter(row=>row.records===0);
    assert.deepEqual(missing,[]);assert.ok(Buffer.byteLength(JSON.stringify(data))<900000);
    const names=[...data.leaders,...data.candidates,...data.voters].map(row=>row.fullName);
    assert.ok(names.every(name=>name.split(' ').length>=3&&!/demo|fictici|simulaci/i.test(name)));
    assert.equal(new Set(data.voters.map(row=>row.fullName)).size,data.voters.length);
    assert.equal(new Set(data.contributions.map(row=>row.contributionType)).size,7);
  }
  assert.equal(new Set(CHART_INVENTORY.map(row=>row[0])).size,CHART_INVENTORY.length);
  assert.equal(new Set(CHART_INVENTORY.map(row=>row[2])).size,CHART_INVENTORY.length);
  assert.equal(new Set(CHART_COLORS).size,CHART_COLORS.length);
  assert.deepEqual(categoryColors(['uno','dos','tres']),categoryColors(['tres','dos','uno']));
});
test('A change keeps other edits, updates name references, and detects conflicting writes',()=>{
  const original=bundle(),leader=original.leaders[0];
  const named=patchDemoBundle(original,'lideres',leader.id,{fullName:'María Elena Prieto'},leader);
  const changed=patchDemoBundle(named,'lideres',leader.id,{voteTarget:777},leader);
  assert.equal(changed.leaders[0].fullName,'María Elena Prieto');assert.equal(changed.leaders[0].voteTarget,777);
  assert.ok(changed.voters.filter(row=>row.leaderId===leader.id).every(row=>row.leaderName==='María Elena Prieto'));
  assert.equal(original.leaders[0].voteTarget,leader.voteTarget);
  assert.throws(()=>patchDemoBundle(changed,'lideres',leader.id,{voteTarget:888},leader),/otra ventana/);
  assert.throws(()=>patchDemoBundle(original,'lideres',leader.id,{tenantId:'other'},leader),/protegido/);
  assert.throws(()=>patchDemoBundle(original,'lideres',leader.id,{budgetAllocated:-1},leader),/Revise/);
  assert.equal(prepareDemoPresentation(changed).leaders[0].fullName,'María Elena Prieto');
});
test('Editing resource costs, dates and tasks keeps the derived values consistent',()=>{
  const original=bundle(),request=original.operations!.requests[0],task=demoRows(original,'tareas')[0];
  const changed=patchDemoBundle(original,'solicitudes_recursos',request.id,{unitCost:18000},request);
  assert.equal(changed.operations!.requests[0].amount,request.quantity*18000);
  const tasks=patchDemoBundle(changed,'tareas',task.id,{completed:!task.completed},task);
  const committee=tasks.coordinations[0].committees[0];assert.equal(committee.completedTasksCount,committee.tasks!.filter(row=>row.completed).length);
  const event=original.operations!.events[0];assert.throws(()=>patchDemoBundle(original,'jornadas_operativas',event.id,{endAt:event.startAt},event),/posterior/);
  const allocation=demoRows(original,'pasajeros_viaje')[0];assert.throws(()=>patchDemoBundle(original,'pasajeros_viaje',allocation.id,{arrived:allocation.passengers+1},allocation),/no superar/);
});
test('Real records require review, real references and actual contact/document values',()=>{
  const data=bundle(),leader=data.leaders[0],now=new Date().toISOString();
  assert.throws(()=>realRecordFromDemo('lideres',leader,{},'real','user',false,now),/Reemplace/);
  assert.throws(()=>realRecordFromDemo('lideres',leader,{voteTarget:500},'real','user',false,now),/nombre real/);
  assert.throws(()=>realRecordFromDemo('lideres',leader,{fullName:'Registro corregido'},'real','user',false,now),/Seleccione un registro real/);
  const record=realRecordFromDemo('lideres',leader,{fullName:'Registro corregido',assignedCandidateId:null,email:null,phone:null},'real','user',false,now);
  assert.equal(record.id,'real');assert.equal(record.createdBy,'user');assert.equal(record.tenantId,'team');assert.equal(record.assignedCandidateId,undefined);
  const voter=data.voters[0],patch={fullName:'Registro autorizado',documentNumber:'987654321',phone:null,leaderId:'real-leader',candidateId:'real-candidate'};
  assert.throws(()=>realRecordFromDemo('votantes_rasos',voter,patch,'real','user',false,now),/autorización/);
  const real=realRecordFromDemo('votantes_rasos',voter,patch,'real','user',true,now);assert.equal(real.verified,false);assert.equal(real.consentGiven,true);assert.equal(real.consentAt,now);
  const expense=realRecordFromDemo('gastos',data.expenses[0],{description:'Factura revisada',responsibleLeaderId:null,candidateId:null,eventId:null},'expense','user',false,now);assert.equal(expense.status,'Pendiente');
});
