import {requestReference} from '../src/lib/requestReference';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {advanceAgent,agentRequest,validateAgentTurn,question,type AgentConversation,type AgentContext,type AgentTurn} from '../src/lib/requestAgent';
import {canonicalSender,createKitAstreaHandler} from '../integrations/claude-kit/astrea-adapter';
import {encodeFields,decodeFields} from '../src/server/requestAgent';
const context:AgentContext={uid:'user-a',tenantId:'team-a',leaders:[{id:'leader-a',name:'Responsable de prueba'}],events:[{id:'event-a',name:'Jornada de prueba'}]};
const base:AgentTurn={conversationId:'conversation-a',messageId:'message-a',revision:0,action:'message',text:'Necesito 20 almuerzos'};
const complete={resource:'Alimentación',quantity:20,unitCost:15000,municipality:'Astrea',description:'Almuerzo equipo logístico',leaderId:'leader-a'};
test('guided conversation collects data, reviews and confirms pending request',()=>{
 let c=advanceAgent(undefined,base,context);assert.equal(c.draft.quantity,20);assert.equal(c.status,'draft');
 for(const text of ['Astrea','Almuerzo equipo logístico','Responsable de prueba','15000'])c=advanceAgent(c,{...base,text,revision:c.revision},context);
 assert.equal(c.status,'review');assert.match(c.messages.at(-1)!.text,/300000 COP/);
 c=advanceAgent(c,{...base,revision:c.revision,text:'confirmar'},context);
 assert.equal(agentRequest(c).status,'Pendiente');assert.equal(agentRequest(c).amount,300000);
 assert.throws(()=>advanceAgent(c,{...base,revision:c.revision},context),/terminó/);
});
test('confirm, identity, stale revision and arbitrary fields are rejected',()=>{
 const c=advanceAgent(undefined,base,context);
 assert.throws(()=>advanceAgent(c,{...base,revision:1,action:'confirm'},context),/Complete/);
 assert.throws(()=>advanceAgent(c,{...base},context),/cambió/);
 assert.throws(()=>advanceAgent(c,{...base,revision:1},{...context,tenantId:'other'}),/ámbito/);
 assert.throws(()=>validateAgentTurn({...base,action:'edit',patch:{tenantId:'other'}}),/Campos/);
 assert.throws(()=>validateAgentTurn({...base,conversationId:'../../other'}),/inválido/);
});
test('invalid numeric data and foreign references never reach requests',()=>{
 for(const patch of [{...complete,quantity:-1},{...complete,quantity:NaN},{...complete,unitCost:Infinity},{...complete,leaderId:'foreign'},{...complete,resource:'Transporte de pasajeros',quantity:1.5,eventId:'event-a'}]){
  assert.throws(()=>advanceAgent(undefined,{...base,action:'edit',patch},context));
 }
 const c=advanceAgent(undefined,{...base,action:'edit',patch:{...complete,resource:'Transporte de pasajeros'}},context);assert.equal(c.status,'draft');
});
test('manual handoff pauses without creating a request; cancelled drafts stay closed',()=>{
 const c=advanceAgent(undefined,{...base,action:'handoff'},context);assert.equal(c.status,'human');assert.equal(c.requestId,'');
 assert.throws(()=>advanceAgent(c,{...base,revision:1},context),/manual/);
 const cancelled=advanceAgent(c,{...base,action:'cancel',revision:1},context);assert.equal(cancelled.status,'cancelled');
});
test('Firestore codec preserves decimals, booleans, nested draft and history',()=>{
 const value={...advanceAgent(undefined,base,context),nested:{yes:true,no:null,decimal:1.5}};
 assert.deepEqual(decodeFields(encodeFields(value)),value);
});
test('kit identity refuses opaque LIDs, groups and supplied text identity',()=>{
 assert.equal(canonicalSender('opaque@lid'),null);assert.equal(canonicalSender('573001234567@g.us'),null);
 assert.equal(canonicalSender('opaque@lid','573001234567@s.whatsapp.net'),'573001234567');
});
test('kit ignores history, self messages, unknown senders and pause; uses sender-bound token',async()=>{
 const calls:any[]=[],sent:any[]=[];let paused=false;
 const handler=createKitAstreaHandler({baseUrl:'https://astrea.example',resolveBinding:async phone=>phone==='573001234567'?{uid:'user-a',tenantId:'team-a',conversationId:'conversation-a',getIdToken:async()=>'scoped-test-token',setConversationId:async()=>{}}:null,paused:async()=>paused,fetcher:async(input,init)=>{
   const body=JSON.parse(init!.body as string);calls.push({body,headers:init!.headers});return new Response(JSON.stringify({success:true,conversation:{revision:body.action==='resume'?1:2,status:'draft',requestId:''},reply:'Indique municipio.'}));
 }});
 const sock={sendMessage:async(jid:string,m:any)=>{sent.push({jid,m});}};
 const msg={key:{id:'wa-message',remoteJid:'573001234567@s.whatsapp.net'},message:{conversation:'Necesito 20 almuerzos'}};
 await handler(sock,{type:'append',messages:[msg]});await handler(sock,{type:'notify',messages:[{...msg,key:{...msg.key,fromMe:true}}]});
 paused=true;await handler(sock,{type:'notify',messages:[msg]});assert.equal(calls.length,0);
 paused=false;await handler(sock,{type:'notify',messages:[msg]});assert.equal(calls.length,2);assert.equal(sent.length,1);
 assert.equal(calls[1].body.tenantId,'team-a');assert.equal(calls[1].headers.Authorization,'Bearer scoped-test-token');assert.equal(calls[1].body.messageId.length,64);
});

test('the next question matches the requested resource',()=>{
 const draft={quantity:3,municipality:'Astrea',leaderId:'leader-a',eventId:'event-a',unitCost:0};
 for(const [resource,expected] of [['Transporte de pasajeros',/origen, destino, fecha y hora/],['Alimentación',/entrega/],['Refrigerios e hidratación',/entrega/],['Combustible',/tipo de combustible/]] as const){
  assert.match(question({...draft,resource},context),expected);
 }
 for(const [text,resource] of [['Necesito 2 desayunos','Alimentación'],['Necesito 5 meriendas','Refrigerios e hidratación'],['Necesito 4 galones de ACPM','Combustible'],['Necesito 20 sillas','Sede y mobiliario']] as const){
  assert.equal(advanceAgent(undefined,{...base,text},context).draft.resource,resource);
 }
});

test('natural affirmations submit a reviewed request once and close with its reference',()=>{
 const review=advanceAgent(undefined,{...base,action:'edit',patch:complete},context);
 for(const text of ['Si confirmo la solicitud','¡Sí, confirmo la solicitud!','sí','confirmo','confirmar.','sí, por favor','de acuerdo','OK, gracias','confirmar y guardar']){
  const closed=advanceAgent(review,{...base,revision:review.revision,text},context);
  assert.equal(closed.status,'submitted',text);
  assert.match(closed.messages.at(-1)!.text,/Número de requisición:/);
  assert.ok(closed.messages.at(-1)!.text.includes(requestReference(closed.requestId)));
  assert.match(closed.messages.at(-1)!.text,/no necesitas enviar más datos/);
  assert.equal(agentRequest(closed).status,'Pendiente');
  assert.throws(()=>advanceAgent(closed,{...base,revision:closed.revision,text:'gracias'},context),/terminó/);
 }
});
test('negations, corrections and missing fields never submit or repeat the review summary',()=>{
 const review=advanceAgent(undefined,{...base,action:'edit',patch:complete},context);
 for(const text of ['no confirmo','sí, pero cambia la cantidad a 4','confirmo pero falta el regreso','¿qué día?','gracias','necesito corregir','no está bien']){
  const next=advanceAgent(review,{...base,revision:review.revision,text},context);
  assert.equal(next.status,'review',text);assert.equal(next.requestId,'');
  assert.deepEqual(next.draft,review.draft);
  assert.match(next.messages.at(-1)!.text,/Aún no se ha creado una requisición/);
  assert.doesNotMatch(next.messages.at(-1)!.text,/Revise antes/);
 }
 const incomplete=advanceAgent(undefined,base,context);
 assert.throws(()=>advanceAgent(incomplete,{...base,revision:incomplete.revision,text:'Sí confirmo la solicitud'},context),/Complete/);
});
test('display references are stable while legacy ids retain their canonical reference',()=>{
 const id='agent-user-a-'+'0123456789abcdef'.repeat(4);
 assert.equal(requestReference(id),'REQ-01234-56789-ABCDE-F0123');
 assert.equal(requestReference('agent-user-a-legacy-conversation'),'agent-user-a-legacy-conversation');
 assert.notEqual(requestReference(id),requestReference('agent-user-a-'+'abcdef0123456789'.repeat(4)));
});
