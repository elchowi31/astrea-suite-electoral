import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { initializeTestEnvironment, assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, query, setDoc, updateDoc, where, writeBatch, serverTimestamp, deleteDoc } from 'firebase/firestore';
import {automaticRoute} from '../src/lib/movementTracking';
import {buildDemoBundle} from '../src/data/demoSeed';
import type {UserProfile,UserRole} from '../src/types';

const enabled = !!process.env.FIRESTORE_EMULATOR_HOST;
let env: RulesTestEnvironment;
before(async()=>{
  if (!enabled) return;
  const [host, port] = process.env.FIRESTORE_EMULATOR_HOST!.split(':');
  env=await initializeTestEnvironment({projectId:'demo-astrea',firestore:{host,port:Number(port),rules:readFileSync('firestore.rules','utf8')}});
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async ctx=>{
    const db=ctx.firestore();
    for (const tenantId of ['team-a','team-b']) await setDoc(doc(db,'organizaciones',tenantId),{tenantId,active:true});
    for (const [uid,role,tenantId,active,accessVersion] of [['admin','AdminTenant','team-a',true,2],['operator','Operador','team-a',true,2],['reader','Consulta','team-a',true,2],['other','AdminTenant','team-b',true,2],['inactive','Operador','team-a',false,2],['legacy','AdminTenant','team-a',true,1],['mayor','Alcalde','team-a',true,2]] as const)
      await setDoc(doc(db,'usuarios',uid),{uid,email:`${uid}@test.invalid`,displayName:uid,role,tenantId,active,accessVersion});
  });
});
after(async()=>{if (env) await env.cleanup();});
const check=(name:string,fn:()=>Promise<void>)=>test(name,{skip:!enabled},fn);
const dbFor=(uid:string)=>env.authenticatedContext(uid,{email:`${uid}@test.invalid`}).firestore();

check('Resource requests save for members; approval, reservations and cumulative reports respect authority and tenant',async()=>{
  const operatorDb=dbFor('operator');const adminDb=dbFor('admin');
  const eventId='team-a--event-ops';const requestId='team-a--request-ops';const vehicleId='team-a--vehicle-ops';
  await env.withSecurityRulesDisabled(async ctx=>{
    await setDoc(doc(ctx.firestore(),'lideres','ops-leader'),{tenantId:'team-a',fullName:'Leader'});
    await setDoc(doc(ctx.firestore(),'candidatos','ops-candidate'),{tenantId:'team-a',fullName:'Candidate'});
    await setDoc(doc(ctx.firestore(),'vehiculos',vehicleId),{tenantId:'team-a',capacity:5});
    await setDoc(doc(ctx.firestore(),'lideres','foreign-leader'),{tenantId:'team-b'});
  });
  const event={id:eventId,tenantId:'team-a',createdBy:'operator',name:'Event',startAt:'2026-10-12T10:00:00Z',endAt:'2026-10-12T12:00:00Z'};
  await assertSucceeds(getDoc(doc(operatorDb,'jornadas_operativas',eventId)));
  await assertSucceeds(setDoc(doc(operatorDb,'jornadas_operativas',eventId),event));
  const request={id:requestId,tenantId:'team-a',eventId,leaderId:'ops-leader',candidateId:'ops-candidate',municipality:'Astrea',resource:'Transporte de pasajeros',description:'Five seats',quantity:5,unitCost:10000,amount:50000,status:'Pendiente',notes:'',createdBy:'operator',createdAt:'2026-10-12',reservedPassengers:0,arrivedPassengers:0,expenseId:''};
  await assertSucceeds(getDoc(doc(operatorDb,'solicitudes_recursos',requestId)));
  await assertSucceeds(setDoc(doc(operatorDb,'solicitudes_recursos',requestId),request));
  await assertFails(updateDoc(doc(operatorDb,'solicitudes_recursos',requestId),{status:'Aprobada'}));
  await assertFails(updateDoc(doc(operatorDb,'solicitudes_recursos',requestId),{leaderId:'foreign-leader'}));
  await assertFails(updateDoc(doc(operatorDb,'solicitudes_recursos',requestId),{amount:-1}));
  await assertSucceeds(updateDoc(doc(adminDb,'solicitudes_recursos',requestId),{status:'Aprobada'}));
  await assertFails(updateDoc(doc(operatorDb,'solicitudes_recursos',requestId),{quantity:6,amount:60000}));
  await assertFails(updateDoc(doc(operatorDb,'solicitudes_recursos',requestId),{waitingPassengers:2,queueUpdatedAt:new Date().toISOString()}));
  await env.withSecurityRulesDisabled(async ctx=>await updateDoc(doc(ctx.firestore(),'usuarios','operator'),{assignedLeaderId:'ops-leader'}));
  await assertSucceeds(updateDoc(doc(operatorDb,'solicitudes_recursos',requestId),{waitingPassengers:2,queueUpdatedAt:new Date().toISOString()}));
  await assertFails(updateDoc(doc(operatorDb,'solicitudes_recursos',requestId),{waitingPassengers:-1}));
  await assertFails(updateDoc(doc(operatorDb,'solicitudes_recursos',requestId),{transferredIn:3}));
  await env.withSecurityRulesDisabled(async ctx=>await updateDoc(doc(ctx.firestore(),'usuarios','operator'),{assignedLeaderId:''}));
  const tripId='team-a--trip-ops';const trip={id:tripId,tenantId:'team-a',eventId,vehicleId,startAt:event.startAt,endAt:event.endAt,status:'Programado',allocations:[{requestId,passengers:5,arrived:0}]};
  await assertSucceeds(getDoc(doc(adminDb,'viajes_operativos',tripId)));
  await assertFails(setDoc(doc(operatorDb,'viajes_operativos',tripId),trip));
  await assertSucceeds(setDoc(doc(adminDb,'viajes_operativos',tripId),trip));
  const bookId=`team-a--${vehicleId}--2026-10-12`;
  await assertSucceeds(getDoc(doc(adminDb,'agenda_vehiculos',bookId)));
  await assertSucceeds(setDoc(doc(adminDb,'agenda_vehiculos',bookId),{tenantId:'team-a',vehicleId,day:'2026-10-12',slots:[{tripId,startAt:event.startAt,endAt:event.endAt}]}));
  const reportId=`team-a--${eventId}--ops-leader`;const report={id:reportId,tenantId:'team-a',eventId,leaderId:'ops-leader',reportedVoters:3,notes:'',revision:1,createdBy:'admin'};
  await assertSucceeds(getDoc(doc(adminDb,'reportes_jornada',reportId)));
  await assertSucceeds(setDoc(doc(adminDb,'reportes_jornada',reportId),report));
  await assertFails(updateDoc(doc(adminDb,'reportes_jornada',reportId),{reportedVoters:4}));
  await assertSucceeds(updateDoc(doc(adminDb,'reportes_jornada',reportId),{reportedVoters:4,revision:2}));
  await assertFails(updateDoc(doc(operatorDb,'reportes_jornada',reportId),{reportedVoters:6,revision:3}));
  for(const name of ['jornadas_operativas','solicitudes_recursos','viajes_operativos','reportes_jornada']){
    await assertSucceeds(getDocs(query(collection(operatorDb,name),where('tenantId','==','team-a'))));
    await assertFails(getDocs(query(collection(dbFor('other'),name),where('tenantId','==','team-a'))));
  }
});

check('All active roles create, regenerate and delete only their personal demo for their stored role and territory',async()=>{
  const roles:UserRole[]=['AdminTenant','Gobernador','Diputado','Alcalde','Concejal','JefePolitico','Supervisor','LiderVeredal','Operador','Consulta','Invitado'];
  for(const role of roles){
    const uid=`demo-${role}`;const profile:UserProfile={uid,role,tenantId:'team-a',email:`${uid}@test.invalid`,displayName:uid,active:true,accessVersion:2,department:'Cesar',municipality:'Astrea',createdAt:'2026-10-10'};
    await env.withSecurityRulesDisabled(async ctx=>setDoc(doc(ctx.firestore(),'usuarios',uid),profile));
    const db=dbFor(uid);const bundle=buildDemoBundle('team-a',profile);const ref=doc(db,'demo',bundle.id);
    await assertSucceeds(getDoc(ref));await assertSucceeds(setDoc(ref,bundle));await assertSucceeds(getDoc(ref));
    await assertSucceeds(setDoc(ref,{...bundle,createdAt:new Date().toISOString()}));
    await assertFails(getDoc(doc(dbFor('reader'),'demo',bundle.id)));
    await assertFails(setDoc(ref,{...bundle,ownerUid:'reader'}));
    await assertFails(setDoc(ref,{...bundle,context:{...bundle.context,role:role==='AdminTenant'?'Gobernador':'AdminTenant'}}));
    await assertFails(setDoc(ref,{...bundle,context:{...bundle.context,department:'Antioquia'}}));
    await assertFails(setDoc(ref,{...bundle,context:{...bundle.context,municipality:'Valledupar'}}));
    await assertFails(setDoc(ref,{...bundle,posiciones_actuales:[{latitude:9,longitude:-74}]}));
    await assertFails(setDoc(doc(db,'demo','team-a--demo--reader'),{...bundle,id:'team-a--demo--reader',ownerUid:'reader'}));
    await assertFails(deleteDoc(doc(dbFor('reader'),'demo',bundle.id)));await assertSucceeds(deleteDoc(ref));
    await assertFails(setDoc(doc(db,'demo',`team-b--demo--${uid}`),{...bundle,id:`team-b--demo--${uid}`,tenantId:'team-b'}));
  }
  for(const uid of ['inactive','legacy']){
    const bundle=buildDemoBundle('team-a',{uid,role:'Operador',tenantId:'team-a',email:`${uid}@test.invalid`,displayName:uid,department:'Cesar',municipality:'Astrea',createdAt:'2026-10-10'});
    await assertFails(setDoc(doc(dbFor(uid),'demo',bundle.id),bundle));
  }
});

check('Registration atomically creates an owned organization and usable administrator',async()=>{
  const db=dbFor('new');const batch=writeBatch(db);
  batch.set(doc(db,'organizaciones','org-new'),{tenantId:'org-new',ownerUid:'new',active:true,plan:'Gratuito'});
  batch.set(doc(db,'usuarios','new'),{uid:'new',email:'new@test.invalid',displayName:'New',tenantId:'org-new',role:'AdminTenant',active:true,accessVersion:2});
  await assertSucceeds(batch.commit());
  await assertSucceeds(getDocs(query(collection(db,'organizaciones'),where('tenantId','==','org-new'))));
  await assertSucceeds(setDoc(doc(db,'lideres','new-leader'),{tenantId:'org-new',fullName:'Leader'}));
});
check('Registration cannot join another tenant or grant global authority',async()=>{
  await assertFails(setDoc(doc(dbFor('intruder'),'usuarios','intruder'),{uid:'intruder',email:'intruder@test.invalid',displayName:'Intruder',tenantId:'team-a',role:'AdminTenant',active:true,accessVersion:2}));
  const db=dbFor('global-forgery');const batch=writeBatch(db);
  batch.set(doc(db,'organizaciones','org-global-forgery'),{tenantId:'org-global-forgery',ownerUid:'global-forgery',active:true,plan:'Gratuito'});
  batch.set(doc(db,'usuarios','global-forgery'),{uid:'global-forgery',email:'global-forgery@test.invalid',displayName:'Forgery',tenantId:'org-global-forgery',role:'AdminGlobal',active:true,accessVersion:2});
  await assertFails(batch.commit());
});
check('Tenant administrators create team profiles; members cannot escalate',async()=>{
  await assertSucceeds(setDoc(doc(dbFor('admin'),'usuarios','member'),{uid:'member',email:'member@test.invalid',displayName:'Member',tenantId:'team-a',role:'Operador',active:true,accessVersion:2}));
  await assertFails(updateDoc(doc(dbFor('operator'),'usuarios','operator'),{role:'AdminTenant'}));
  await assertFails(setDoc(doc(dbFor('mayor'),'usuarios','higher'),{uid:'higher',email:'higher@test.invalid',displayName:'Higher',tenantId:'team-a',role:'Gobernador',active:true,accessVersion:2}));
  await assertFails(setDoc(doc(dbFor('admin'),'usuarios','cross-tenant'),{uid:'cross-tenant',email:'cross@test.invalid',displayName:'Cross',tenantId:'team-b',role:'Operador',active:true,accessVersion:2}));
});
check('An operator saves every operational form together with its audit record',async()=>{
  const db=dbFor('operator');
  for (const name of ['candidatos','lideres','vehiculos','propuestas','gastos','aportes','archivos_drive','comites_coordinaciones','simulaciones','fuentes_estadisticas','equipo_campana']) {
    const batch=writeBatch(db);
    batch.set(doc(db,name,'operator-form'),{tenantId:'team-a',updatedBy:'operator'});
    batch.set(doc(db,'auditoria',`operator-${name}`),{tenantId:'team-a',actorId:'operator'});
    await assertSucceeds(batch.commit());
    await assertSucceeds(getDoc(doc(db,name,'operator-form')));
  }
  await assertSucceeds(setDoc(doc(dbFor('reader'),'propuestas','reader-form'),{tenantId:'team-a'}));
});
check('Territorial submissions require consent and remain retrievable by their creator',async()=>{
  const db=dbFor('operator');const ref=doc(db,'votantes_rasos','own-voter');
  await assertFails(setDoc(ref,{tenantId:'team-a',documentNumber:'123',consentGiven:false,createdBy:'operator'}));
  await assertSucceeds(setDoc(ref,{tenantId:'team-a',documentNumber:'123',consentGiven:true,createdBy:'operator'}));
  await assertSucceeds(getDocs(query(collection(db,'votantes_rasos'),where('tenantId','==','team-a'),where('createdBy','==','operator'))));
  await assertFails(getDoc(doc(dbFor('other'),'votantes_rasos','own-voter')));
});
check('Anonymous, inactive and legacy profiles cannot write, and tenant identity is immutable',async()=>{
  for (const db of [env.unauthenticatedContext().firestore(),dbFor('inactive'),dbFor('legacy')]) await assertFails(setDoc(doc(db,'lideres','forbidden'),{tenantId:'team-a'}));
  await assertFails(updateDoc(doc(dbFor('operator'),'lideres','operator-form'),{tenantId:'team-b'}));
  await assertFails(getDocs(collection(dbFor('operator'),'lideres')));
});
check('Verified owner retains access; a matching unverified email grants none',async()=>{
  const verified=env.authenticatedContext('owner',{email:'expcal@expcal.net',email_verified:true}).firestore();
  const unverified=env.authenticatedContext('fake-owner',{email:'expcal@expcal.net',email_verified:false}).firestore();
  await assertSucceeds(getDocs(collection(verified,'organizaciones')));
  await assertFails(getDocs(collection(unverified,'organizaciones')));
});
check('Geographic layers are shared within the tenant and cannot migrate to another organization',async()=>{
  const ref=doc(dbFor('operator'),'capas_geograficas','layer');await assertSucceeds(setDoc(ref,{id:'layer',tenantId:'team-a',name:'Mapa',createdBy:'operator',importId:'import',filename:'map.kml',features:[]}));await assertSucceeds(getDoc(doc(dbFor('admin'),'capas_geograficas','layer')));await assertFails(getDoc(doc(dbFor('other'),'capas_geograficas','layer')));await assertFails(updateDoc(ref,{tenantId:'team-b'}));await assertSucceeds(updateDoc(ref,{name:'Mapa actualizado'}));
});
check('Assigned routes restrict changes to managers and prevent employees changing route or recipient',async()=>{
  const route={geometry:[{latitude:9.5,longitude:-74},{latitude:9.6,longitude:-74}],stops:[{name:'Inicio',latitude:9.5,longitude:-74},{name:'Fin',latitude:9.6,longitude:-74}]};const assignment={id:'route',tenantId:'team-a',userId:'operator',name:'Recorrido',createdBy:'admin',status:'Asignado',route};
  await assertSucceeds(setDoc(doc(dbFor('admin'),'recorridos','route'),assignment));await assertFails(setDoc(doc(dbFor('operator'),'recorridos','forged'),{...assignment,id:'forged',createdBy:'operator'}));
  await assertFails(getDocs(query(collection(dbFor('operator'),'recorridos'),where('tenantId','==','team-a'),where('userId','==','operator'))));await assertFails(getDocs(query(collection(dbFor('reader'),'recorridos'),where('tenantId','==','team-a'))));
  await assertFails(updateDoc(doc(dbFor('operator'),'recorridos','route'),{userId:'reader'}));await assertFails(updateDoc(doc(dbFor('operator'),'recorridos','route'),{route:{...route,geometry:route.geometry.slice(0,1)}}));
  const now=Date.now();await assertSucceeds(updateDoc(doc(dbFor('operator'),'recorridos','route'),{status:'En curso',startedAt:new Date(now).toISOString(),startedAtMillis:now}));await assertFails(updateDoc(doc(dbFor('admin'),'recorridos','route'),{name:'Changed while active'}));
});
check('GPS samples have server receipt time, own employee identity, valid coordinates and immutable history',async()=>{
  const capturedAtMillis=Date.now();const data={id:'sample',tenantId:'team-a',routeId:'route',userId:'operator',latitude:9.5,longitude:-74,accuracy:5,capturedAt:new Date(capturedAtMillis).toISOString(),capturedAtMillis,receivedAt:serverTimestamp()};const ref=doc(dbFor('operator'),'puntos_recorrido','sample');
  await assertSucceeds(setDoc(ref,data));await assertSucceeds(getDoc(doc(dbFor('admin'),'puntos_recorrido','sample')));await assertFails(getDoc(doc(dbFor('reader'),'puntos_recorrido','sample')));await assertFails(getDoc(doc(dbFor('other'),'puntos_recorrido','sample')));await assertFails(updateDoc(ref,{latitude:9.6}));await assertFails(deleteDoc(ref));
  await assertFails(setDoc(doc(dbFor('reader'),'puntos_recorrido','fake'),{...data,id:'fake',userId:'reader'}));await assertFails(setDoc(doc(dbFor('operator'),'puntos_recorrido','invalid'),{...data,id:'invalid',latitude:999}));await assertFails(setDoc(doc(dbFor('operator'),'puntos_recorrido','no-receipt'),{...data,id:'no-receipt',receivedAt:'2026-01-01'}));
  await assertSucceeds(updateDoc(doc(dbFor('operator'),'recorridos','route'),{status:'Finalizado',finishedAt:new Date(capturedAtMillis+1000).toISOString(),finishedAtMillis:capturedAtMillis+1000}));await assertFails(updateDoc(doc(dbFor('operator'),'recorridos','route'),{status:'En curso'}));
});
check('Each member registers only their own device seed; managers and the owner can read it',async()=>{
  const seed={id:'team-a--operator--phone-1',tenantId:'team-a',userId:'operator',deviceId:'phone-1',label:'Android 14 · Chrome',gps:'granted',installed:true,activeRouteId:'',firstSeenAt:'2026-10-10T12:00:00.000Z',lastSeenAt:'2026-10-10T12:00:00.000Z'};
  const own=doc(dbFor('operator'),'dispositivos',seed.id);
  await assertSucceeds(setDoc(own,seed));await assertSucceeds(setDoc(own,{gps:'denied',lastSeenAt:'2026-10-10T12:05:00.000Z'},{merge:true}));
  await assertFails(getDoc(own));await assertSucceeds(getDoc(doc(dbFor('admin'),'dispositivos',seed.id)));await assertFails(getDoc(doc(dbFor('reader'),'dispositivos',seed.id)));await assertFails(getDoc(doc(dbFor('other'),'dispositivos',seed.id)));
  await assertFails(setDoc(doc(dbFor('reader'),'dispositivos','team-a--operator--phone-2'),{...seed,id:'team-a--operator--phone-2',deviceId:'phone-2'}));
  await assertFails(setDoc(doc(dbFor('operator'),'dispositivos','team-a--operator--phone-3'),{...seed,id:'team-a--operator--phone-3',deviceId:'phone-1'}));
  await assertFails(setDoc(doc(dbFor('operator'),'dispositivos','team-a--operator--phone-4'),{...seed,id:'team-a--operator--phone-4',deviceId:'phone-4',gps:'hacked'}));
  await assertFails(setDoc(doc(dbFor('operator'),'dispositivos','team-a--operator--phone-5'),{...seed,id:'team-a--operator--phone-5',deviceId:'phone-5',extra:true}));
  await assertFails(setDoc(own,{tenantId:'team-b'},{merge:true}));await assertFails(setDoc(own,{userId:'reader'},{merge:true}));
  await assertSucceeds(deleteDoc(doc(dbFor('admin'),'dispositivos',seed.id)));
});
check('Live position: only the member writes it, on their own route, and the team leaders read it in real time',async()=>{
  const id='team-a--operator';const live={id,tenantId:'team-a',userId:'operator',routeId:'route',deviceId:'phone-1',latitude:9.5,longitude:-74,accuracy:6,speed:1.2,heading:null,battery:77,source:'android',capturedAt:new Date().toISOString(),capturedAtMillis:Date.now(),updatedAt:serverTimestamp()};
  await env.withSecurityRulesDisabled(async ctx=>{await setDoc(doc(ctx.firestore(),'recorridos','route'),{id:'route',tenantId:'team-a',userId:'operator',status:'En curso'},{merge:true});await setDoc(doc(ctx.firestore(),'recorridos','route-reader'),{id:'route-reader',tenantId:'team-a',userId:'reader',status:'En curso'});});
  const own=doc(dbFor('operator'),'posiciones_actuales',id);
  await assertSucceeds(setDoc(own,live));await assertSucceeds(setDoc(own,{...live,latitude:9.51,capturedAtMillis:Date.now()}));
  await assertSucceeds(getDoc(doc(dbFor('admin'),'posiciones_actuales',id)));await assertFails(getDoc(own));
  await assertFails(getDoc(doc(dbFor('reader'),'posiciones_actuales',id)));await assertFails(getDoc(doc(dbFor('other'),'posiciones_actuales',id)));
  await assertFails(setDoc(doc(dbFor('reader'),'posiciones_actuales',id),{...live,userId:'reader'}));
  await assertFails(setDoc(doc(dbFor('operator'),'posiciones_actuales','team-a--reader'),{...live,id:'team-a--reader'}));
  await assertFails(setDoc(own,{...live,routeId:'route-reader'}));
  await assertFails(setDoc(own,{...live,battery:140}));await assertFails(setDoc(own,{...live,source:'spoofed'}));await assertFails(setDoc(own,{...live,updatedAt:'2026-01-01'}));await assertFails(setDoc(own,{...live,secret:true}));
});
check('Automatic movement trips can only be created for the current active member, with no forged plan or privileges',async()=>{
  const at=Date.now();const route=automaticRoute('team-a','operator','operator','phone','auto-own',{latitude:9.5,longitude:-74,accuracy:5,speed:null,heading:null,timestamp:at});
  const db=dbFor('operator');await assertSucceeds(setDoc(doc(db,'recorridos',route.id),route));
  for(const [id,patch] of [['auto-other',{userId:'reader'}],['auto-tenant',{tenantId:'team-b'}],['auto-manager',{createdBy:'admin'}],['auto-name',{employeeName:'admin'}],['auto-plan',{route:{...route.route,geometry:[{latitude:9.5,longitude:-74}]}}],['auto-extra',{secret:true}],['auto-finished',{status:'Finalizado'}]] as const)
    await assertFails(setDoc(doc(db,'recorridos',id),{...route,id,...patch}));
  for(const uid of ['inactive','legacy'])await assertFails(setDoc(doc(dbFor(uid),'recorridos',`auto-${uid}`),{...route,id:`auto-${uid}`,userId:uid,createdBy:uid,employeeName:uid}));
  const patch={status:'Finalizado',finishedAtMillis:at+1000,finishedAt:new Date(at+1000).toISOString(),updatedAt:new Date().toISOString()};
  await assertSucceeds(updateDoc(doc(db,'recorridos',route.id),patch));
  await assertSucceeds(updateDoc(doc(db,'recorridos',route.id),{...patch,updatedAt:new Date(at+2000).toISOString()}));
  await assertFails(updateDoc(doc(db,'recorridos',route.id),{status:'En curso'}));
  await assertFails(updateDoc(doc(db,'recorridos',route.id),{finishedAtMillis:at+5000}));
});
check('Stationary live heartbeat remains owned and time bounded without creating history points',async()=>{
  const at=Date.now();const id='team-a--operator';const live={id,tenantId:'team-a',userId:'operator',routeId:'route',deviceId:'phone',latitude:9.5,longitude:-74,accuracy:5,speed:0,heading:null,battery:80,source:'android',capturedAt:new Date(at-600000).toISOString(),capturedAtMillis:at-600000,observedAtMillis:at,motion:'stationary',updatedAt:serverTimestamp()};
  const ref=doc(dbFor('operator'),'posiciones_actuales',id);await assertSucceeds(setDoc(ref,live));
  await assertFails(setDoc(ref,{...live,motion:'fake'}));await assertFails(setDoc(ref,{...live,observedAtMillis:at+600000}));await assertFails(setDoc(ref,{...live,observedAtMillis:at-700000}));
});

check('Tracking reads and administration are exclusive to admins; even the recorded member cannot read history',async()=>{
  const roles=['Gobernador','Diputado','Alcalde','Concejal','JefePolitico','Supervisor','Operador','LiderVeredal','Consulta','Invitado'];
  await env.withSecurityRulesDisabled(async ctx=>{for(const role of roles)await setDoc(doc(ctx.firestore(),'usuarios',`tracking-${role}`),{uid:`tracking-${role}`,displayName:role,email:`tracking-${role}@test.invalid`,tenantId:'team-a',role,active:true,accessVersion:2});});
  for(const role of roles){const uid=`tracking-${role}`;const db=dbFor(uid);
    for(const name of ['recorridos','puntos_recorrido','posiciones_actuales','dispositivos'])await assertFails(getDocs(query(collection(db,name),where('tenantId','==','team-a'),where('userId','==',uid))));
    await assertFails(updateDoc(doc(db,'recorridos','route'),{status:'Cancelado'}));
    await assertFails(setDoc(doc(db,'recorridos',`assignment-${role}`),{id:`assignment-${role}`,tenantId:'team-a',userId:uid,createdBy:uid,status:'Asignado',name:'Forbidden',route:{geometry:[{},{}],stops:[{},{}]}}));
  }
  for(const name of ['recorridos','puntos_recorrido','posiciones_actuales','dispositivos']){
    await assertSucceeds(getDocs(query(collection(dbFor('admin'),name),where('tenantId','==','team-a'))));
    await assertFails(getDocs(query(collection(dbFor('other'),name),where('tenantId','==','team-a'))));
  }
  const forgedGlobal=env.authenticatedContext('forged-global',{email:'forged@test.invalid'}).firestore();
  await env.withSecurityRulesDisabled(async ctx=>await setDoc(doc(ctx.firestore(),'usuarios','forged-global'),{uid:'forged-global',tenantId:'team-a',role:'AdminGlobal',active:true,accessVersion:2}));
  await assertFails(getDocs(collection(forgedGlobal,'recorridos')));
  const verified=env.authenticatedContext('owner',{email:'expcal@expcal.net',email_verified:true}).firestore();
  await assertSucceeds(getDocs(collection(verified,'recorridos')));
});

check('Election transport is readable by every active member, writable only by admins, and cannot include private GPS fields',async()=>{
  const route={name:'Ruta electoral',geometry:[{latitude:9.5,longitude:-74},{latitude:9.6,longitude:-74}],stops:[{name:'Inicio',latitude:9.5,longitude:-74},{name:'Fin',latitude:9.6,longitude:-74}],distanceMeters:1000,durationSeconds:300,provider:'Archivo',calculatedAt:'2026-10-10'};
  await env.withSecurityRulesDisabled(async ctx=>await setDoc(doc(ctx.firestore(),'vehiculos','public-bus'),{id:'public-bus',tenantId:'team-a',licensePlate:'ABC123',plannedRoute:route}));
  const data={id:'election-route',tenantId:'team-a',vehicleId:'public-bus',vehiclePlate:'ABC123',electionDate:'2027-10-31',departureTime:'06:30',route,notes:'Parada en la plaza',createdBy:'admin',createdAt:new Date().toISOString()};
  await assertSucceeds(setDoc(doc(dbFor('admin'),'rutas_transporte_electoral',data.id),data));
  for(const role of ['Gobernador','Diputado','Alcalde','Concejal','JefePolitico','Supervisor','Operador','LiderVeredal','Consulta','Invitado']){
    const db=dbFor(`tracking-${role}`);await assertSucceeds(getDoc(doc(db,'rutas_transporte_electoral',data.id)));
    await assertFails(setDoc(doc(db,'rutas_transporte_electoral',`election-${role}`),{...data,id:`election-${role}`,createdBy:`tracking-${role}`}));
    await assertFails(deleteDoc(doc(db,'rutas_transporte_electoral',data.id)));
  }
  for(const uid of ['other','inactive','legacy'])await assertFails(getDoc(doc(dbFor(uid),'rutas_transporte_electoral',data.id)));
  await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(),'rutas_transporte_electoral',data.id)));
  await assertFails(setDoc(doc(dbFor('admin'),'rutas_transporte_electoral','private-leak'),{...data,id:'private-leak',deviceId:'private-phone',userId:'operator'}));
  await assertFails(setDoc(doc(dbFor('admin'),'rutas_transporte_electoral','wrong-route'),{...data,id:'wrong-route',route:{...route,name:'Other route'}}));
  await assertFails(setDoc(doc(dbFor('admin'),'rutas_transporte_electoral','wrong-tenant'),{...data,id:'wrong-tenant',tenantId:'team-b'}));
  await assertSucceeds(deleteDoc(doc(dbFor('admin'),'rutas_transporte_electoral',data.id)));
});
