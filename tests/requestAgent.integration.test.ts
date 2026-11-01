import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {initializeTestEnvironment,assertFails} from '@firebase/rules-unit-testing';
import {doc,setDoc,getDoc} from 'firebase/firestore';
import {createAgentBackend} from '../src/server/requestAgent';
import type {AgentTurn} from '../src/lib/requestAgent';
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
 }finally{await env.cleanup();}
});
