import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {initializeTestEnvironment} from '@firebase/rules-unit-testing';
import {initializeApp,deleteApp} from 'firebase/app';
import {createUserWithEmailAndPassword,signInWithEmailAndPassword,getAuth,connectAuthEmulator,signOut} from 'firebase/auth';
import {doc,getDocFromServer,setDoc,getFirestore,connectFirestoreEmulator,terminate} from 'firebase/firestore';
import {app,auth,db,createDemoCollection,persistEntity,saveCommitteeTask} from '../src/lib/firebase';
import {DEMO_COLLECTIONS,demoRows,updateDemoRecord,saveDemoEntity,saveDemoRegistration,saveDemoTask,promoteDemoRecord} from '../src/lib/demoWorkspace';
import {demoOperationsStore} from '../src/lib/demoOperationsStore';
import * as realOperations from '../src/lib/operationsStore';
import {updateOperationalRecord,updateCommitteeRecord,validateEditablePatch} from '../src/lib/recordEditing';
import {assertStoredFields} from '../src/lib/saveVerification';
import {personalDemoId} from '../src/data/contextualDemo';
import type {DemoBundle} from '../src/data/demoSeed';
import type {UserProfile} from '../src/types';
const enabled=process.env.ASTREA_FIREBASE_TEST_EMULATORS==='true';

test('Server verification rejects missing, changed and undeleted fields',()=>{
 assert.throws(()=>validateEditablePatch('lideres',{voteTarget:'8'}));
 assert.throws(()=>validateEditablePatch('votantes_rasos',{verified:'true'}));
 assert.throws(()=>validateEditablePatch('tareas',{dueDate:'invalid'}));
 assert.throws(()=>validateEditablePatch('lideres',{tenantId:'other'}));
 assert.throws(()=>assertStoredFields(undefined,{amount:8}));
 assert.throws(()=>assertStoredFields({amount:7},{amount:8}));
 assert.throws(()=>assertStoredFields({notes:'old'},{},['notes']));
 assert.doesNotThrow(()=>assertStoredFields({amount:8,unrelated:true},{amount:8},['notes']));
});

test('Firestore persistence: all demo collections, operations, real edits and independent reload',{skip:!enabled,timeout:360000},async t=>{
  assert.equal(app.options.projectId,'demo-astrea');
  assert.ok(process.env.FIRESTORE_EMULATOR_HOST,'Never run this test against production');
  const env=await initializeTestEnvironment({projectId:'demo-astrea',firestore:{host:'127.0.0.1',port:8088,rules:readFileSync('firestore.rules','utf8')}});
  const email=`persistence-${Date.now()}@test.invalid`,password='Emulator-only-password-481!';
  const {user}=await createUserWithEmailAndPassword(auth,email,password);
  const profile:UserProfile={uid:user.uid,tenantId:'persistence-team',role:'AdminTenant',email,displayName:'Prueba de persistencia',active:true,accessVersion:2,createdAt:new Date().toISOString(),department:'Cesar',municipality:'Astrea'};
  await env.withSecurityRulesDisabled(async ctx=>{
    await setDoc(doc(ctx.firestore(),'organizaciones',profile.tenantId),{tenantId:profile.tenantId,active:true});
    await setDoc(doc(ctx.firestore(),'usuarios',user.uid),profile);
  });
  const ref=doc(db,'demo',personalDemoId(profile.tenantId,user.uid));
  const read=async()=>(await getDocFromServer(ref)).data() as DemoBundle;
  try{
    await createDemoCollection(profile.tenantId,profile);
    const fields:Record<string,string>={candidatos:'fullName',lideres:'fullName',votantes_rasos:'phone',vehiculos:'driverName',gastos:'description',aportes:'donorName',distritos:'name',propuestas:'title',archivos_drive:'name',comites_coordinaciones:'title',jornadas_operativas:'name',solicitudes_recursos:'description',viajes_operativos:'origin',reportes_jornada:'notes',comites:'name',tareas:'title',pasajeros_viaje:'arrived'};
    for(const collection of Object.keys(DEMO_COLLECTIONS))await t.test(`Edit and server-read ${collection}`,async()=>{
      const before=await read(),rows=demoRows(before,collection);
      const row=collection==='pasajeros_viaje'?rows.find(r=>r.arrived>0):rows[0];assert.ok(row,collection);
      const field=fields[collection],value=field==='arrived'?row.arrived-1:collection==='votantes_rasos'?'3000000123':`Dato revisado ${collection}`;
      await updateDemoRecord(profile.tenantId,collection,row.id,{[field]:value},row);
      const saved=await read();assert.equal(demoRows(saved,collection).find(r=>r.id===row.id)[field],value);
      assert.equal(saved.isSynthetic,true);
    });
    await t.test('Validation and stale edits do not overwrite saved data',async()=>{
      const row=(await read()).leaders[0];
      await assert.rejects(updateDemoRecord(profile.tenantId,'lideres',row.id,{voteTarget:-1},{...row}));
      await assert.rejects(updateDemoRecord(profile.tenantId,'lideres',row.id,{fullName:'Cambio obsoleto'},{...row,fullName:'Valor anterior'}));
      await assert.rejects(updateDemoRecord(profile.tenantId,'votantes_rasos',(await read()).voters[0].id,{leaderId:'other-tenant-leader'}));
      assert.equal((await read()).leaders[0].fullName,row.fullName);
    });
    await t.test('New forms and planilla corrections persist',async()=>{
      const b=await read(),leader={...b.leaders[0],id:'persistence-team--new-leader',fullName:'Nombre agregado'};
      await saveDemoEntity(profile.tenantId,'lideres',leader);
      assert.equal((await read()).leaders.find(r=>r.id===leader.id)?.fullName,leader.fullName);
      const event=b.operations!.events[0],voter=b.voters[0];
      await saveDemoRegistration(profile.tenantId,event.id,voter.id,'command',true,'Registro comprobado');
      assert.ok((await read()).operations!.registrations?.some(r=>r.eventId===event.id&&r.voterId===voter.id&&r.command));
      const coordination=b.coordinations[0],committee=coordination.committees[0],task=committee.tasks![0];
      await saveDemoTask(profile.tenantId,coordination.id,committee.id,{...task,completed:!task.completed});
      assert.equal((await read()).coordinations[0].committees[0].tasks![0].completed,!task.completed);
    });
    await t.test('Jornada, approval, expense, trip capacity, cancellation and transfer idempotency',async()=>{
      const actions=demoOperationsStore(profile.tenantId),b=await read();
      const event={...b.operations!.events[0],id:'persistence-team--new-event',status:'Planificado' as const,startAt:'2026-12-01T08:00:00Z',endAt:'2026-12-01T12:00:00Z'};
      await actions.saveEvent(event,profile);
      const request={...b.operations!.requests[0],id:'persistence-team--new-request',eventId:event.id,resource:'Transporte de pasajeros',quantity:2,unitCost:100,amount:200,status:'Pendiente' as const,reservedPassengers:0,arrivedPassengers:0,expenseId:'',createdBy:user.uid};
      await actions.saveRequest(request,profile);
      await actions.changeRequest(request,'Aprobada',profile);
      const approved=(await read()).operations!.requests.find(r=>r.id===request.id)!;
      await actions.requestToExpense(approved,profile);await actions.requestToExpense(approved,profile);
      assert.equal((await read()).expenses.filter(r=>r.id===`${request.id}--gasto`).length,1);
      const vehicle=b.vehicles.find(v=>v.capacity>=2&&v.status!=='En Mantenimiento')!;
      const trip={...b.operations!.trips[0],id:'persistence-team--new-trip',eventId:event.id,vehicleId:vehicle.id,startAt:event.startAt,endAt:event.endAt,status:'Programado' as const,allocations:[{requestId:request.id,passengers:2,arrived:0}]};
      await actions.saveTrip(trip,profile);
      assert.equal((await read()).operations!.requests.find(r=>r.id===request.id)!.reservedPassengers,2);
      await assert.rejects(actions.saveTrip({...trip,id:'persistence-team--overlap'},profile));
      await actions.saveTrip({...trip,status:'Cancelado'},profile);
      assert.equal((await read()).operations!.requests.find(r=>r.id===request.id)!.reservedPassengers,0);
      const a={...request,id:'persistence-team--food-a',resource:'Alimentación',quantity:10,amount:1000};
      const c={...a,id:'persistence-team--food-b',leaderId:b.leaders[1].id};
      for(const r of [a,c]){await actions.saveRequest(r,profile);await actions.changeRequest(r,'Aprobada',profile);}
      await actions.changeRequest({...a,status:'Aprobada'},'Entregada',profile);
      await actions.confirmResourceCount(a,{consumedQuantity:2,confirmedSurplus:4},profile);
      await actions.transferResource(a,c,3,'Cesión comprobada',profile,'persistence-team--transfer-one');
      await actions.transferResource(a,c,3,'Cesión comprobada',profile,'persistence-team--transfer-one');
      assert.equal((await read()).operations!.requests.find(r=>r.id===c.id)!.transferredIn,3);
      assert.equal((await getDocFromServer(doc(db,'jornadas_operativas',event.id))).exists(),false);
    });
    await t.test('Real forms, nested committees and generic edits server-verify',async()=>{
      const b=await read(),leader={...b.leaders[0],id:'persistence-team--real-leader'};
      await persistEntity('lideres',leader.id,leader);
      await updateOperationalRecord('lideres',leader.id,profile.tenantId,{fullName:'Nombre corregido'},leader);
      assert.equal((await getDocFromServer(doc(db,'lideres',leader.id))).data()!.fullName,'Nombre corregido');
      await assert.rejects(updateOperationalRecord('lideres',leader.id,profile.tenantId,{assignedCandidateId:'missing-foreign-record'}));
      const event={...b.operations!.events[0],id:'persistence-team--real-event',status:'Planificado' as const};
      await realOperations.saveEvent(event,profile);
      const request={...b.operations!.requests[0],id:'persistence-team--real-request',eventId:event.id,leaderId:leader.id,candidateId:'',resource:'Alimentación',quantity:2,unitCost:100,amount:200,status:'Pendiente' as const,reservedPassengers:0,arrivedPassengers:0,expenseId:''};
      await realOperations.saveRequest(request,profile);
      await realOperations.changeRequest(request,'Aprobada',profile);
      await realOperations.requestToExpense({...request,status:'Aprobada'},profile);
      assert.equal((await getDocFromServer(doc(db,'gastos',`${request.id}--gasto`))).data()!.amount,200);
      const proposal=b.proposals[0];
      const promotedId=await promoteDemoRecord(profile.tenantId,'propuestas',proposal.id,{title:'Propuesta revisada para registro real'},{...proposal},false);
      assert.equal((await getDocFromServer(doc(db,'propuestas',promotedId))).data()!.title,'Propuesta revisada para registro real');
      assert.equal((await read()).proposals.find(r=>r.id===proposal.id)!['_realRecordId'],promotedId);
      const coordination={...b.coordinations[0],id:'persistence-team--real-coordination'};delete (coordination as any)._operationAudit;
      await persistEntity('comites_coordinaciones',coordination.id,coordination);
      const committee=coordination.committees[0],task=committee.tasks![0];
      await saveCommitteeTask(profile.tenantId,coordination.id,committee.id,{...task,completed:!task.completed});
      await updateCommitteeRecord(profile.tenantId,coordination.id,committee.id,undefined,{name:'Comité corregido'},committee as any);
      assert.equal((await getDocFromServer(doc(db,'comites_coordinaciones',coordination.id))).data()!.committees[0].name,'Comité corregido');
    });
    await t.test('A separate client without cache sees the exact stored bundle',async()=>{
      const expected=await read(),second=initializeApp(app.options,`independent-${Date.now()}`),secondAuth=getAuth(second),secondDb=getFirestore(second);
      connectAuthEmulator(secondAuth,'http://127.0.0.1:9098',{disableWarnings:true});connectFirestoreEmulator(secondDb,'127.0.0.1',8088);
      try{await signInWithEmailAndPassword(secondAuth,email,password);const actual=(await getDocFromServer(doc(secondDb,ref.path))).data();assert.deepEqual(actual,expected);}
      finally{await signOut(secondAuth);await terminate(secondDb);await deleteApp(second);}
    });
  }finally{await signOut(auth);await terminate(db);await env.cleanup();}
});
