import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {initializeTestEnvironment,assertFails} from '@firebase/rules-unit-testing';
import {doc,setDoc,getDoc,onSnapshot} from 'firebase/firestore';
import {createPassengerEvent,updatePassengerEvent,PASSENGER_EVENT_COLLECTION} from '../src/lib/passengerLogisticsStore';
import {applyAssignments,cancelTrip,proposeAssignments,type PassengerEvent} from '../src/lib/passengerLogistics';
import {at,makeEvent,makePassenger,makeTrip,returnTrip} from './passengerFixtures';
import type {UserProfile} from '../src/types';
test('event passenger persistence, realtime updates, concurrency, fleet calendars and tenant isolation',{skip:process.env.ASTREA_AGENT_EMULATOR!=='true',timeout:120000},async t=>{
 assert.equal(process.env.GCLOUD_PROJECT,'demo-astrea');
 const env=await initializeTestEnvironment({projectId:'demo-astrea',firestore:{host:'127.0.0.1',port:8088,rules:readFileSync('firestore.rules','utf8')}});
 const user:UserProfile={uid:'passenger-admin',email:'passenger@example.test',displayName:'Coordinación',tenantId:'passenger-tenant-A',role:'AdminTenant',active:true,accessVersion:2,createdAt:at(7)};
 const db=env.authenticatedContext(user.uid,{email:user.email,email_verified:true}).firestore() as any;
 const foreign=env.authenticatedContext('passenger-foreign',{email:'foreign@example.test'}).firestore() as any;
 const e=makeEvent(),ref=doc(db,PASSENGER_EVENT_COLLECTION,e.id);
 const read=async()=>(await getDoc(ref)).data() as PassengerEvent;
 try{
  await env.withSecurityRulesDisabled(async ctx=>{const d=ctx.firestore();await setDoc(doc(d,'organizaciones',user.tenantId),{active:true});await setDoc(doc(d,'usuarios',user.uid),user);await setDoc(doc(d,'organizaciones','passenger-tenant-B'),{active:true});await setDoc(doc(d,'usuarios','passenger-foreign'),{...user,uid:'passenger-foreign',tenantId:'passenger-tenant-B'});});
  await t.test('non-global tenant administrator creates event and receives a server-acknowledged realtime update',async()=>{
   await createPassengerEvent(db,user,e);
   let stop=()=>{};const seen=new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>{stop();reject(new Error('No realtime acknowledgement'));},15000);stop=onSnapshot(ref,{includeMetadataChanges:true},s=>{if(s.data()?.revision===2&&!s.metadata.hasPendingWrites&&!s.metadata.fromCache){clearTimeout(timer);resolve();}},reject);});
   await updatePassengerEvent(db,user,e.id,user.tenantId,1,'Reservas y trayectos',old=>({...old,passengers:[makePassenger()],trips:[makeTrip(),returnTrip()]}));await seen;stop();assert.equal((await read()).revision,2);
  });
  await t.test('assignments persist and stale writes cannot overwrite a newer revision',async()=>{
   const record=await read(),plan=proposeAssignments(record,Date.parse(at(7)));
   await updatePassengerEvent(db,user,e.id,user.tenantId,2,'Asignación',old=>applyAssignments(old,plan,Date.parse(at(7))));assert.equal((await read()).passengers[0].returnState,'assigned');
   await assert.rejects(updatePassengerEvent(db,user,e.id,user.tenantId,2,'Obsoleto',old=>old),/actualizó/);
  });
  await t.test('concurrent edits serialize and only one revision wins',async()=>{
   const results=await Promise.allSettled([updatePassengerEvent(db,user,e.id,user.tenantId,3,'A',old=>old),updatePassengerEvent(db,user,e.id,user.tenantId,3,'B',old=>old)]);
   assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal((await read()).revision,4);
  });
  await t.test('vehicle cannot be booked concurrently in another event; cancellation releases its slot',async()=>{
   const second=makeEvent({id:'passenger-tenant-A--second-event'});await createPassengerEvent(db,user,second);
   await assert.rejects(updatePassengerEvent(db,user,second.id,user.tenantId,1,'Conflicto',old=>({...old,trips:[makeTrip({id:'second-out'})]})),/otro evento/);
   assert.equal((await getDoc(doc(db,PASSENGER_EVENT_COLLECTION,second.id))).data()!.revision,1);
   await updatePassengerEvent(db,user,e.id,user.tenantId,4,'Retiro',old=>cancelTrip(old,'out1'));
   await updatePassengerEvent(db,user,second.id,user.tenantId,1,'Nuevo uso',old=>({...old,trips:[makeTrip({id:'second-out'})]}));assert.equal((await read()).passengers[0].outboundState,'waiting');
  });
  await t.test('foreign and anonymous clients cannot read or modify event data',async()=>{
   await assertFails(getDoc(doc(foreign,PASSENGER_EVENT_COLLECTION,e.id)));await assertFails(setDoc(doc(foreign,PASSENGER_EVENT_COLLECTION,e.id),{...(await read()),title:'Otra organización'}));await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(),PASSENGER_EVENT_COLLECTION,e.id)));
   await assert.rejects(updatePassengerEvent(db,{...user,role:'Consulta'},e.id,user.tenantId,5,'No autorizado',old=>old),/administrador/);
  });
 }finally{await env.cleanup();}
});
