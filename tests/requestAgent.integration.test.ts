import {requestReference} from '../src/lib/requestReference';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {initializeTestEnvironment,assertFails,assertSucceeds} from '@firebase/rules-unit-testing';
import {doc,setDoc,getDoc,updateDoc,collection,getDocs,query,where,onSnapshot} from 'firebase/firestore';
import {createAgentBackend} from '../src/server/requestAgent';
import type {AgentTurn} from '../src/lib/requestAgent';
import {pilotIntake,pilotLease,resolvePilotText} from '../src/server/whatsappPilotCore';
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
  await t.test('concurrent deliveries of the same message create one revision and one receipt',async()=>{
   const message={...input,conversationId:'concurrent-same-message'};
   const results=await Promise.all([backend().turn(message),backend().turn(message)]);
   assert.ok(results.some(r=>r.duplicate));assert.ok(results.every(r=>r.conversation.revision===1));
   const db=env.authenticatedContext(a.uid,{email:'agent@test.invalid'}).firestore();
   assert.equal((await getDocs(query(collection(db,'usuarios',a.uid,'agent_conversations',message.conversationId,'receipts'),where('tenantId','==',tenantId)))).size,1);
  });
  await t.test('concurrent different messages cannot overwrite the same draft revision',async()=>{
   const conversationId='concurrent-different-messages';
   const results=await Promise.allSettled([
    backend().turn({...input,conversationId,messageId:'concurrent-message-a'}),
    backend().turn({...input,conversationId,messageId:'concurrent-message-b',patch:{...draft,quantity:9}})
   ]);
   assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
   const rejected=results.find(r=>r.status==='rejected') as PromiseRejectedResult;assert.equal(rejected.reason.status,409);
   const reload=await backend().turn({...input,conversationId,action:'resume',patch:undefined});assert.equal(reload.conversation.revision,1);
  });
  await t.test('an event cancelled between its read and commit prevents all submission writes',async()=>{
   const conversationId='event-changed-during-commit';await backend().turn({...input,conversationId});
   let changed=false;
   const racing=createAgentBackend({projectId:'demo-astrea',databaseId:'(default)',token:a.token,uid:a.uid,tenantId,origin:'http://127.0.0.1:8088',fetcher:async(url,init)=>{
    if(String(url).endsWith(':commit')&&!changed){
     changed=true;
     await env.withSecurityRulesDisabled(async ctx=>updateDoc(doc(ctx.firestore(),'jornadas_operativas','agent-event'),{status:'Cancelado'}));
    }
    return fetch(url,init);
   }});
   await assert.rejects(racing.turn({...input,conversationId,messageId:'racing-confirmation',revision:1,action:'confirm',patch:undefined}),/jornada/);
   await env.withSecurityRulesDisabled(async ctx=>{
    const db=ctx.firestore();
    assert.equal((await getDoc(doc(db,'solicitudes_recursos',`agent-${a.uid}-${conversationId}`))).exists(),false);
    assert.equal((await getDoc(doc(db,'auditoria',`agent-${a.uid}-${conversationId}`))).exists(),false);
    assert.equal((await getDoc(doc(db,'usuarios',a.uid,'agent_conversations',conversationId,'receipts','racing-confirmation'))).exists(),false);
    assert.equal((await getDoc(doc(db,'usuarios',a.uid,'agent_conversations',conversationId))).data()!.revision,1);
    await updateDoc(doc(db,'jornadas_operativas','agent-event'),{status:'Planificado'});
   });
  });
  const confirmation:AgentTurn={...input,patch:undefined,messageId:'confirm-message',revision:1,action:'confirm'};
  await t.test('a separate Firestore listener receives the confirmed request without a page reload',async()=>{
   const draftInput:AgentTurn={...input,conversationId:'live-listener-check',patch:{resource:'Alimentación',quantity:2,unitCost:0,municipality:'Astrea',description:'Prueba técnica de formulario; no entregar recursos.',leaderId:'agent-leader'}};
   const prepared=await backend().turn(draftInput);
   const db=env.authenticatedContext(a.uid,{email:'agent@test.invalid'}).firestore();
   const requestId=`agent-${a.uid}-${draftInput.conversationId}`;
   let initialResolve!:()=>void;
   const initial=new Promise<void>(resolve=>{initialResolve=resolve;});
   let timer:ReturnType<typeof setTimeout>;
   let unsubscribe=()=>{};
   const changed=new Promise<Record<string,any>>((resolve,reject)=>{
    timer=setTimeout(()=>reject(new Error('No realtime server snapshot received')),15000);
    unsubscribe=onSnapshot(query(collection(db,'solicitudes_recursos'),where('tenantId','==',tenantId)),snapshot=>{
     if(snapshot.metadata.fromCache||snapshot.metadata.hasPendingWrites)return;
     const record=snapshot.docs.find(row=>row.id===requestId);
     if(!record){initialResolve();return;}
     resolve(record.data());
    },reject);
   });
   try{
    // Wait until the reader is subscribed, then write through the independent REST backend.
    await Promise.race([initial,changed]);
    const result=await backend().turn({...confirmation,conversationId:draftInput.conversationId,revision:prepared.conversation.revision});
    assert.equal(result.conversation.requestId,requestId);
    const received=await changed;
    assert.equal(received.quantity,2);assert.equal(received.status,'Pendiente');
    assert.match(result.reply,/guardada/i);
   }finally{clearTimeout(timer!);unsubscribe();}
  });
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
   const replay=await intake('573001234567','inbound-3','confirmar');assert.match(replay.reply,new RegExp(requestReference(confirmed.requestId)));
   const db=env.authenticatedContext(a.uid,{email:'agent@test.invalid'}).firestore();
   const record=(await getDoc(doc(db,'solicitudes_recursos',confirmed.requestId))).data()!;
   assert.equal(record.quantity,3);assert.equal(record.amount,0);assert.equal(record.status,'Pendiente');assert.equal(record.leaderId,'agent-leader');assert.match(record.notes,/573001234567/);assert.match(record.notes,/WHATSAPP/);assert.doesNotMatch(record.notes,/PRUEBA|no ejecutar como operación real/);
   active=false;await assert.rejects(intake('573009999999','inbound-4','Necesito 2 almuerzos'),/Disabled/);
  });
  await t.test('natural confirmation closes WhatsApp with one requisition; thanks, repeats and renewal do not reopen it',async()=>{
   const config={phone:'573000000000',tenantId,leaderId:'agent-leader',eventId:'agent-event',municipality:'Astrea'};
   const conversations:Record<string,string>={};
   const makeIntake=()=>pilotIntake({projectId:'demo-astrea',databaseId:'(default)',token:a.token,uid:a.uid,config,runId:'natural-confirmation',origin:'http://127.0.0.1:8088',conversations,checkActive:async()=>{}});
   const sender='573008880001',intake=makeIntake();
   await intake(sender,'natural-start','Necesito 3 almuerzos');
   await intake(sender,'natural-detail','Entrega en el salón del evento mañana a las 12.');
   const db=env.authenticatedContext(a.uid,{email:'agent@test.invalid'}).firestore();
   const before=(await getDocs(query(collection(db,'solicitudes_recursos'),where('tenantId','==',tenantId)))).size;
   const result=await intake(sender,'natural-confirm','Si confirmo la solicitud');
   assert.ok(result.requestId);const reference=requestReference(result.requestId);
   assert.match(reference,/^REQ-/);assert.ok(result.reply.includes(reference));
   assert.match(result.reply,/creada y guardada/);assert.match(result.reply,/según disponibilidad/);
   const draftRef=doc(db,'usuarios',a.uid,'agent_conversations',conversations[sender]);
   const closed=(await getDoc(draftRef)).data()!;assert.equal(closed.status,'submitted');
   for(const [i,text] of ['Si confirmo la solicitud','Gracias','Ok gracias','hola','estado','continuar'].entries()){
    const response=await makeIntake()(sender,i===0?'natural-confirm':'closing-'+i,text);
    assert.ok(response.reply.includes(reference));assert.equal(response.requestId,'');
    assert.doesNotMatch(response.reply,/Revise antes|¿Qué necesita|responde «sí, confirmo»/);
    assert.equal((await getDoc(draftRef)).data()!.revision,closed.revision);
   }
   assert.equal((await getDocs(query(collection(db,'solicitudes_recursos'),where('tenantId','==',tenantId)))).size,before+1);
   const record=(await getDoc(doc(db,'solicitudes_recursos',result.requestId))).data()!;
   assert.equal(record.status,'Pendiente');assert.equal(requestReference(record.id),reference);
   await makeIntake()(sender,'natural-new','nueva solicitud');
   assert.notEqual(conversations[sender],closed.id);
   assert.equal((await getDoc(doc(db,'usuarios',a.uid,'agent_conversations',conversations[sender]))).data()!.status,'draft');
  });
  await t.test('different WhatsApp senders complete independent resource forms and help does not consume answers',async()=>{
   const conversations:Record<string,string>={};
   const intake=pilotIntake({projectId:'demo-astrea',databaseId:'(default)',token:a.token,uid:a.uid,config:{phone:'573000000000',tenantId,leaderId:'agent-leader',eventId:'agent-event',municipality:'Astrea'},runId:'multi-sender-validation',origin:'http://127.0.0.1:8088',conversations,checkActive:async()=>{}});
   const senders=['573007770001','14155550123','lid:'+ '9'.repeat(64)];
   assert.match((await intake(senders[0],'welcome-01','Hola')).reply,/asistente/);
   assert.equal(Object.keys(conversations).length,0,'welcome must not create an empty request draft');
   const first=await intake(senders[0],'multi-food','Necesito 3 almuerzos');assert.match(first.reply,/entrega/);
   const second=await intake(senders[1],'multi-transport','Transporte para 2 personas');assert.match(second.reply,/origen, destino/);
   const third=await intake(senders[2],'multi-fuel','Necesito 5 galones de gasolina');assert.match(third.reply,/tipo de combustible/);
   assert.match((await intake(senders[0],'multi-help','ayuda')).reply,/confirmar/);
   assert.match((await intake(senders[0],'multi-survey','quiero llenar una encuesta')).reply,/todavía no están habilitadas/);
   await intake(senders[0],'multi-food-detail','Entrega en el salón comunal mañana a las 12:00.');
   await intake(senders[1],'multi-ride-detail','Origen terminal, destino salón comunal, mañana a las 08:00. Solo ida.');
   await intake(senders[2],'multi-fuel-detail','Gasolina para el vehículo del evento, mañana en la estación.');
   const saved=await Promise.all(senders.map((sender,i)=>intake(sender,'multi-confirm-'+i,'confirmar')));
   assert.equal(new Set(saved.map(row=>row.requestId)).size,3);
   const db=env.authenticatedContext(a.uid,{email:'agent@test.invalid'}).firestore();
   for(let i=0;i<saved.length;i++){
    const record=(await getDoc(doc(db,'solicitudes_recursos',saved[i].requestId))).data()!;
    assert.equal(record.quantity,[3,2,5][i]);assert.equal(record.resource,['Alimentación','Transporte de pasajeros','Combustible'][i]);assert.equal(record.status,'Pendiente');
    const replay=await intake(senders[i],'multi-confirm-'+i,'confirmar');assert.match(replay.reply,new RegExp(requestReference(saved[i].requestId)));
   }
   const paused='573007770099';
   await intake(paused,'pause-start','humano');
   assert.match((await intake(paused,'pause-message','Necesito 1 almuerzo')).reply,/pausada/);
   assert.match((await intake(paused,'pause-cancel','cancelar')).reply,/cancelado/);
   assert.match((await intake(senders[0],'multi-new','nueva solicitud')).reply,/Qué necesita/);
   assert.equal((await getDoc(doc(db,'usuarios',a.uid,'agent_conversations',conversations[senders[1]]))).data()!.status,'submitted');
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
   const duplicate=await intake()('573001111111','rotate-7','confirmar');assert.match(duplicate.reply,new RegExp(requestReference(second.requestId)));
   assert.deepEqual((await checkpoint.auth.keys.get('pre-key',['42']))['42'].private,Buffer.from('test-private-key'));
   const db=env.authenticatedContext(a.uid,{email:'agent@test.invalid'}).firestore();
   assert.equal((await getDoc(doc(db,'solicitudes_recursos',second.requestId))).data()!.quantity,4);
   await assertFails(getDoc(doc(db,'usuarios',a.uid,'whatsapp_sessions',session.id)));
   await env.withSecurityRulesDisabled(async ctx=>{
    const raw=(await getDoc(doc(ctx.firestore(),'usuarios',a.uid,'whatsapp_sessions',session.id))).data()!;
    assert.ok(raw.ciphertext);assert.ok(!JSON.stringify(raw).includes('test-private-key'));assert.ok(!JSON.stringify(raw).includes(session.key));
   });
  });
  await t.test('a private LID completes a questionnaire, publishes realtime and survives encrypted renewal without a phone number',async()=>{
   const config={phone:'573000000000',tenantId,leaderId:'agent-leader',eventId:'agent-event',municipality:'Astrea'};
   const session={id:'b'.repeat(32),key:'c'.repeat(64),resumeId:'d'.repeat(32)};
   const options={base:'http://127.0.0.1:8088/v1/projects/demo-astrea/databases/(default)/documents',token:'owner',uid:a.uid,config,session};
   let checkpoint=await loadWhatsappSession(options);
   const intake=()=>pilotIntake({projectId:'demo-astrea',databaseId:'(default)',token:a.token,uid:a.uid,config,runId:session.id,origin:'http://127.0.0.1:8088',conversations:checkpoint.state.conversations,saveCursor:checkpoint.save,checkActive:async()=>{}});
   const incoming=(await resolvePilotText({key:{id:'private-first',remoteJid:'123456789012345@lid'},messageTimestamp:Math.floor(Date.now()/1000),message:{conversation:'Necesito 3 almuerzos'}},Date.now()-3000)).incoming!;
   assert.equal(incoming.phone,'');assert.ok(incoming.senderKey);
   const first=await intake()(incoming.senderKey,incoming.messageId,incoming.text,incoming.phone);assert.ok(!first.requestId);
   checkpoint=await loadWhatsappSession(options);
   const conversationId=checkpoint.state.conversations[incoming.senderKey];assert.ok(conversationId);
   const review=await intake()(incoming.senderKey,'private-detail','Almuerzos para el evento de mañana.');assert.match(review.reply,/Revise antes/);
   const db=env.authenticatedContext(a.uid,{email:'agent@test.invalid'}).firestore();
   const draft=(await getDoc(doc(db,'usuarios',a.uid,'agent_conversations',conversationId))).data()!;
   assert.equal(draft.draft.quantity,3);assert.equal(draft.status,'review');
   const requestId=`agent-${a.uid}-${conversationId}`;
   let initialResolve!:()=>void,unsubscribe=()=>{},timer:ReturnType<typeof setTimeout>;
   const initial=new Promise<void>(resolve=>{initialResolve=resolve;});
   const changed=new Promise<Record<string,any>>((resolve,reject)=>{
    timer=setTimeout(()=>reject(Error('Private LID request did not reach realtime listener')),15000);
    unsubscribe=onSnapshot(query(collection(db,'solicitudes_recursos'),where('tenantId','==',tenantId)),snapshot=>{
     if(snapshot.metadata.fromCache||snapshot.metadata.hasPendingWrites)return;
     const record=snapshot.docs.find(row=>row.id===requestId);
     if(record)resolve(record.data());else initialResolve();
    },reject);
   });
   try{
    await Promise.race([initial,changed]);
    checkpoint=await loadWhatsappSession(options);
    const confirmed=await intake()(incoming.senderKey,'private-confirm','confirmar');
    assert.equal(confirmed.requestId,requestId);assert.match(confirmed.reply,/guardada/i);
    const record=await changed;assert.equal(record.quantity,3);assert.equal(record.amount,0);assert.equal(record.status,'Pendiente');assert.equal(record.tenantId,tenantId);
    assert.match(record.notes,/teléfono no compartido/);assert.doesNotMatch(record.notes,/123456789012345|Remitente \+/);
    checkpoint=await loadWhatsappSession(options);
    const replay=await intake()(incoming.senderKey,'private-confirm','confirmar');assert.match(replay.reply,new RegExp(requestReference(requestId)));
    // Authenticated mapping appearing later must not restart or merge another person's draft.
    const mapped=await intake()(incoming.senderKey,'private-mapped','hola','573008888888');assert.match(mapped.reply,new RegExp(requestReference(requestId)));
    assert.equal(checkpoint.state.conversations['573008888888'],conversationId);
    const another=(await resolvePilotText({key:{id:'other-private',remoteJid:'123456789012346@lid'},messageTimestamp:Math.floor(Date.now()/1000),message:{conversation:'Necesito 1 almuerzo'}},Date.now()-3000)).incoming!;
    await intake()(another.senderKey,another.messageId,another.text);
    assert.notEqual(checkpoint.state.conversations[another.senderKey],conversationId);
    await intake()(incoming.senderKey,'private-new','nueva solicitud','573008888888');
    assert.notEqual(checkpoint.state.conversations[incoming.senderKey],conversationId);
    assert.equal(checkpoint.state.conversations[incoming.senderKey],checkpoint.state.conversations['573008888888']);
   }finally{clearTimeout(timer!);unsubscribe();}
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

