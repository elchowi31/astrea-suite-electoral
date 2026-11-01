import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {initializeTestEnvironment,assertFails,assertSucceeds} from '@firebase/rules-unit-testing';
import {doc,setDoc,getDoc,updateDoc,collection,getDocs,query,where} from 'firebase/firestore';
import {createAgentBackend} from '../src/server/requestAgent';
import type {AgentTurn} from '../src/lib/requestAgent';
import {pilotIntake,pilotLease} from '../src/server/whatsappPilotCore';
import {loadWhatsappSession} from '../src/server/whatsappSessionStore';
const enabled=process.env.ASTREA_AGENT_EMULATOR==='true';
test('Agent REST API: Firestore transactions, rules, reload, deduplication and tenant isolation',{skip:!enabled,timeout:120000},async t=>{
 assert.equal(process.env.GCLOUD_PROJECT,'demo-astrea');
 const env=await initializeTestEnvironment({projectId:'demo-astrea',firestore:{host:'127.0.0.1',port:8088,rules:readFileSync('firestore.rules','utf8')}});
 async function identity(name:string){
  const r=await fetch('http://127.0.0.1:9098/identitytoolkit.googleapis.com/v1/accounts:signUp?key=emulator-only',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:`${name}-${Date.now()}@test.invalid`,password:'Emulator-only-73927!',returnSecureToken:true})});
  const data=await r.json();assert.equal(r.status,200);return {uid:data.localId,token:data.idToken};
 }
 const a=await identity('agent-a'),b=await identity('agent-b');
 const tenantId='agent-test-team',foreign='agent-other-team';
 await env.withSecurityRulesDisabled(async ctx=>{
  for(const [person,tenant] of [[a,tenantId],[b,foreign]] as const){
   await setDoc(doc(ctx.firestore(),'usuarios',person.uid),{uid:person.uid,email:'agent@test.invalid',tenantId:tenant,active:true,accessVersion:2,role:'Operador'});
   await setDoc(doc(ctx.firestore(),'organizaciones',tenant),{tenantId:tenant,active:true,name:'Prueba agente'});
  }
  await setDoc(doc(ctx.firestore(),'lideres','agent-leader'),{id:'agent-leader',tenantId,fullName:'Responsable de prueba'});
  await setDoc(doc(ctx.firestore(),'lideres','foreign-leader'),{id:'foreign-leader',tenantId:foreign,fullName:'Otro responsable'});
  await setDoc(doc(ctx.firestore(),'jornadas_operativas','agent-event'),{id:'agent-event',tenantId,name:'Jornada de prueba',status:'Planificado'});
 });
 const backend=(person=a,tenant=tenantId)=>createAgentBackend({projectId:'demo-astrea',databaseId:'(default)',token:person.token,uid:person.uid,tenantId:tenant,origin:'http://127.0.0.1:8088'});
 const draft={resource:'Transporte de pasajeros',quantity:8,unitCost:10000,municipality:'Astrea',description:'Origen La Ye, destino Astrea, salida 8:00 a. m.',leaderId:'agent-leader',eventId:'agent-event',direction:'Ida' as const};
 const input:AgentTurn={conversationId:'integration-conversation',messageId:'integration-message',revision:0,action:'edit',patch:draft};
 try{
  let saved=await backend().turn(input);assert.equal(saved.conversation.status,'review');assert.equal(saved.conversation.revision,1);
  await t.test('fresh backend reloads persisted fields',async()=>{
   const reload=await backend().turn({...input,action:'resume',patch:undefined});assert.deepEqual(reload.conversation.draft,draft);
  });
  await t.test('same event replays without another revision',async()=>{
   const duplicate=await backend().turn(input);assert.equal(duplicate.conversation.revision,1);assert.equal(duplicate.duplicate,true);
  });
  await t.test('lost response after commit retries the same message without duplicate writes',async()=>{
   let committed=false,lost=false;
   const unreliable=createAgentBackend({projectId:'demo-astrea',databaseId:'(default)',token:a.token,uid:a.uid,tenantId,origin:'http://127.0.0.1:8088',fetcher:async(url,init)=>{
    if(committed&&!lost&&init?.method==='GET'){lost=true;throw new TypeError('Simulated response loss');}
    const response=await fetch(url,init);if(String(url).endsWith(':commit')&&response.ok)committed=true;return response;
   }});
   const message={...input,conversationId:'lost-response-conversation'};
   await assert.rejects(unreliable.turn(message),/Simulated/);
   const replay=await backend().turn(message);assert.equal(replay.duplicate,true);assert.equal(replay.conversation.revision,1);
  });
  await t.test('stale and foreign inputs fail without changes',async()=>{
   await assert.rejects(backend().turn({...input,messageId:'another-message'}),/cambió/);
   await assert.rejects(backend().turn({...input,messageId:'foreign-reference',revision:1,patch:{...draft,leaderId:'foreign-leader'}}),/responsable/);
   await assert.rejects(backend(b,tenantId).turn({...input,action:'resume',patch:undefined}),/permiso/);
   const other=env.authenticatedContext(b.uid,{email:'other@test.invalid'}).firestore();
   await assertFails(getDoc(doc(other,'usuarios',a.uid,'agent_conversations',input.conversationId)));
  });
  const confirmation:AgentTurn={...input,patch:undefined,messageId:'confirm-message',revision:1,action:'confirm'};
  await t.test('confirmation atomically creates one pending request and audit',async()=>{
   saved=await backend().turn(confirmation);assert.equal(saved.conversation.status,'submitted');
   const replay=await backend().turn(confirmation);assert.equal(replay.conversation.requestId,saved.conversation.requestId);
   const db=env.authenticatedContext(a.uid,{email:'agent@test.invalid'}).firestore();
   const stored=(await getDoc(doc(db,'solicitudes_recursos',saved.conversation.requestId))).data()!;
   assert.equal(stored.amount,80000);assert.equal(stored.status,'Pendiente');assert.equal(stored.reservedPassengers,0);assert.equal(stored.createdBy,a.uid);
   await env.withSecurityRulesDisabled(async ctx=>assert.ok((await getDoc(doc(ctx.firestore(),'auditoria',stored.id))).exists()));
  });
  await t.test('cancelled event prevents confirmation and leaves draft intact',async()=>{
   const another={...input,conversationId:'cancelled-event-draft'};await backend().turn(another);
   await env.withSecurityRulesDisabled(async ctx=>setDoc(doc(ctx.firestore(),'jornadas_operativas','agent-event'),{id:'agent-event',tenantId,name:'Jornada de prueba',status:'Cancelado'}));
   await assert.rejects(backend().turn({...confirmation,conversationId:another.conversationId}),/jornada/);
   const reload=await backend().turn({...another,action:'resume',patch:undefined});assert.equal(reload.conversation.status,'review');assert.equal(reload.conversation.requestId,'');
  });
  await t.test('WhatsApp intake persists a confirmed request and notes without duplicating a retried confirmation',async()=>{
   await env.withSecurityRulesDisabled(async ctx=>updateDoc(doc(ctx.firestore(),'jornadas_operativas','agent-event'),{status:'Planificado'}));
   let active=true;
   const intake=pilotIntake({projectId:'demo-astrea',databaseId:'(default)',token:a.token,uid:a.uid,config:{phone:'573000000000',tenantId,leaderId:'agent-leader',eventId:'agent-event',municipality:'Astrea'},runId:'test-run',origin:'http://127.0.0.1:8088',checkActive:async()=>{if(!active)throw new Error('Disabled');}});
   await intake('573001234567','inbound-1','Necesito 3 almuerzos');
   const review=await intake('573001234567','inbound-2','PRUEBA logística, no entregar');assert.match(review.reply,/Revise antes/);
   const confirmed=await intake('573001234567','inbound-3','confirmar');assert.ok(confirmed.requestId);
   const replay=await intake('573001234567','inbound-3','confirmar');assert.match(replay.reply,new RegExp(confirmed.requestId));
   const db=env.authenticatedContext(a.uid,{email:'agent@test.invalid'}).firestore();
   const record=(await getDoc(doc(db,'solicitudes_recursos',confirmed.requestId))).data()!;
   assert.equal(record.quantity,3);assert.equal(record.amount,0);assert.equal(record.status,'Pendiente');assert.equal(record.leaderId,'agent-leader');assert.match(record.notes,/573001234567/);assert.match(record.notes,/WHATSAPP/);assert.doesNotMatch(record.notes,/PRUEBA|no ejecutar como operación real/);
   active=false;await assert.rejects(intake('573009999999','inbound-4','Necesito 2 almuerzos'),/Disabled/);
  });
  await t.test('WhatsApp rotation restores encrypted authentication and a second conversation from actual emulator documents',async()=>{
   const config={phone:'573000000000',tenantId,leaderId:'agent-leader',eventId:'agent-event',municipality:'Astrea'};
   const session={id:'e'.repeat(32),key:'f'.repeat(64),resumeId:'a'.repeat(32)};
   const options={base:'http://127.0.0.1:8088/v1/projects/demo-astrea/databases/(default)/documents',token:'owner',uid:a.uid,config,session};
   const lock1=pilotLease({...options,phone:config.phone}),lock2=pilotLease({...options,phone:config.phone});
   await lock1.acquire();await assert.rejects(lock2.acquire(),/activa/);await lock1.release();await lock2.acquire();await lock2.release();
   let checkpoint=await loadWhatsappSession(options);
   await checkpoint.auth.keys.set({'pre-key':{'42':{private:Buffer.from('test-private-key'),public:Buffer.from('test-public-key')}}});
   const intake=()=>pilotIntake({projectId:'demo-astrea',databaseId:'(default)',token:a.token,uid:a.uid,config,runId:session.id,origin:'http://127.0.0.1:8088',conversations:checkpoint.state.conversations,saveCursor:checkpoint.save,checkActive:async()=>{}});
   await intake()('573001111111','rotate-1','Necesito 2 almuerzos');
   checkpoint=await loadWhatsappSession(options);
   await intake()('573001111111','rotate-2','Prueba de alimentación');
   checkpoint=await loadWhatsappSession(options);
   const first=await intake()('573001111111','rotate-3','confirmar');assert.ok(first.requestId);
   await intake()('573001111111','rotate-4','nueva solicitud');
   checkpoint=await loadWhatsappSession(options);
   await intake()('573001111111','rotate-5','Necesito 4 almuerzos');
   checkpoint=await loadWhatsappSession(options);
   await intake()('573001111111','rotate-6','Segunda prueba de alimentación');
   const second=await intake()('573001111111','rotate-7','confirmar');assert.ok(second.requestId);assert.notEqual(first.requestId,second.requestId);
   checkpoint=await loadWhatsappSession(options);
   const duplicate=await intake()('573001111111','rotate-7','confirmar');assert.match(duplicate.reply,new RegExp(second.requestId));
   assert.deepEqual((await checkpoint.auth.keys.get('pre-key',['42']))['42'].private,Buffer.from('test-private-key'));
   const db=env.authenticatedContext(a.uid,{email:'agent@test.invalid'}).firestore();
   assert.equal((await getDoc(doc(db,'solicitudes_recursos',second.requestId))).data()!.quantity,4);
   await assertFails(getDoc(doc(db,'usuarios',a.uid,'whatsapp_sessions',session.id)));
   await env.withSecurityRulesDisabled(async ctx=>{
    const raw=(await getDoc(doc(ctx.firestore(),'usuarios',a.uid,'whatsapp_sessions',session.id))).data()!;
    assert.ok(raw.ciphertext);assert.ok(!JSON.stringify(raw).includes('test-private-key'));assert.ok(!JSON.stringify(raw).includes(session.key));
   });
  });
  await t.test('draft and receipt reads respect profile revocation, tenant changes and admin claims',async()=>{
   const db=env.authenticatedContext(a.uid,{email:'agent@test.invalid'}).firestore();
   const conversation=doc(db,'usuarios',a.uid,'agent_conversations',input.conversationId);
   const receipt=doc(conversation,'receipts',input.messageId);
   const drafts=query(collection(db,'usuarios',a.uid,'agent_conversations'),where('tenantId','==',tenantId));
   const change=async(patch:Record<string,unknown>)=>env.withSecurityRulesDisabled(async ctx=>updateDoc(doc(ctx.firestore(),'usuarios',a.uid),patch));
   await assertSucceeds(getDoc(conversation));await assertSucceeds(getDoc(receipt));await assertSucceeds(getDocs(drafts));
   for(const patch of [{active:false},{active:true,accessVersion:1},{accessVersion:2,tenantId:foreign}]){
    await change(patch);await assertFails(getDoc(conversation));await assertFails(getDoc(receipt));await assertFails(getDocs(drafts));
   }
   await change({active:false,tenantId,accessVersion:1});
   const admin=env.authenticatedContext(a.uid,{email:'admin@test.invalid',admin:true}).firestore();
   await assertSucceeds(getDoc(doc(admin,'usuarios',a.uid,'agent_conversations',input.conversationId)));
   const otherAdmin=env.authenticatedContext('another-admin',{email:'admin@test.invalid',admin:true}).firestore();
   // The existing global-admin migration rule retains access to all documents.
   await assertSucceeds(getDoc(doc(otherAdmin,'usuarios',a.uid,'agent_conversations',input.conversationId)));
   await change({active:true,accessVersion:2});
   await assertSucceeds(getDoc(doc(db,'usuarios',a.uid,'agent_conversations','new-draft')));
  });
 }finally{await env.cleanup();}
});
