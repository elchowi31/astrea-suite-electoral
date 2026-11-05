import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validatePilotConfig,incomingPilotText,pilotLease,resolvePilotText,inspectPilotText} from '../src/server/whatsappPilotCore';
import {encodeFields,decodeFields,createAgentBackend} from '../src/server/requestAgent';

test('pilot requires explicit scope and international phone',()=>{
 const config={phone:'+57 300 123 4567',tenantId:'team-a',leaderId:'leader-a',eventId:'event-a',municipality:'Astrea'};
 assert.equal(validatePilotConfig(config).phone,'573001234567');
 for(const patch of [{phone:'abc'},{eventId:''},{leaderId:'../other'},{municipality:''}])assert.throws(()=>validatePilotConfig({...config,...patch}));
});
test('only new inbound private text with verified sender identity enters the pilot',()=>{
 const now=Date.now();const msg={key:{id:'msg',remoteJid:'573001234567@s.whatsapp.net'},messageTimestamp:Math.floor(now/1000),message:{conversation:'Necesito 8 almuerzos'}};
 assert.equal(incomingPilotText(msg,now)?.phone,'573001234567');
 assert.equal(incomingPilotText(msg,now+1000,true),null,'a message from the explicit stopped period must not enter on resume');
 assert.equal(incomingPilotText(msg,now-1000,true)?.phone,'573001234567','automatic renewal keeps the original cutoff');
 for(const patch of [{key:{...msg.key,fromMe:true}},{key:{...msg.key,remoteJid:'abc@g.us'}},{key:{...msg.key,remoteJid:'opaque@lid'}},{messageTimestamp:0},{messageTimestamp:undefined}])assert.equal(incomingPilotText({...msg,...patch},now),null);
 assert.equal(incomingPilotText({...msg,key:{...msg.key,remoteJid:'opaque@lid',remoteJidAlt:'573001234567@s.whatsapp.net'}},now)?.phone,'573001234567');
});
test('serverless lease allows one instance, rejects races and fences stale releases',async()=>{
 let record:any=null,rev=0,now=1000;
 const fetcher:typeof fetch=async(input,init)=>{
  if(init?.method!=='POST')return new Response(JSON.stringify(record||{}),{status:record?200:404});
  const write=JSON.parse(String(init.body)).writes[0],guard=write.currentDocument;
  if((guard.exists===false&&record)||(guard.updateTime&&guard.updateTime!==record?.updateTime))return new Response('{}',{status:409});
  record={fields:write.update.fields,updateTime:String(++rev)};return new Response(JSON.stringify({writeResults:[{updateTime:record.updateTime}]}));
 };
 const make=()=>pilotLease({base:'https://firestore.test/documents',token:'test-only',phone:'573001234567',fetcher,now:()=>now});
 const first=make(),second=make();await first.acquire();await assert.rejects(second.acquire(),/activa/);
 now=301001;await second.acquire();await first.release();assert.equal(decodeFields(record.fields).owner,second.owner);assert.ok(decodeFields(record.fields).expiresAt>now);
 await second.release();assert.equal(decodeFields(record.fields).expiresAt,0);
 record=null;
 const results=await Promise.allSettled([make().acquire(),make().acquire()]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
});
test('LID senders resolve through the authenticated mapping and ephemeral text is unwrapped',async()=>{
 const now=Date.now(),startedAt=now-3000;
 const msg={key:{id:'private-lid',remoteJid:'12345678901234@lid'},messageTimestamp:Math.floor(now/1000),message:{ephemeralMessage:{message:{extendedTextMessage:{text:'Necesito 3 almuerzos'}}}}};
 assert.equal(inspectPilotText(msg,startedAt,true).reason,'unresolved_sender');
 const resolved=await resolvePilotText(msg,startedAt,async jid=>{assert.equal(jid,'12345678901234@lid');return '573009999999@s.whatsapp.net';});
 assert.equal(resolved.incoming?.phone,'573009999999');assert.equal(resolved.incoming?.jid,msg.key.remoteJid);assert.equal(resolved.incoming?.text,'Necesito 3 almuerzos');
 assert.equal((await resolvePilotText(msg,startedAt,async()=>null)).incoming?.phone,'');
 assert.equal((await resolvePilotText(msg,startedAt,async()=>'12345678901234@lid')).incoming?.phone,'','opaque LIDs must never become phone numbers');
 assert.equal(incomingPilotText({...msg,key:{...msg.key,senderPn:'invalid',remoteJidAlt:'573009999999@s.whatsapp.net'}},startedAt,true)?.phone,'573009999999');
});
test('reception resolves exact scoped references without the 500-row catalog limit',async()=>{
 const fetcher:typeof fetch=async(input)=>{
  const path=String(input);assert.ok(!path.includes(':runQuery'),'a scoped session must not depend on catalog ordering');
  if(path.endsWith('/lideres/owner'))return new Response(JSON.stringify({fields:encodeFields({id:'owner',tenantId:'tenant',fullName:'Wilson José Arias'})}));
  if(path.endsWith('/jornadas_operativas/event'))return new Response(JSON.stringify({fields:encodeFields({id:'event',tenantId:'tenant',name:'Recepción WhatsApp',status:'Planificado'})}));
  if(path.endsWith('/lideres/foreign'))return new Response(JSON.stringify({fields:encodeFields({id:'foreign',tenantId:'another',fullName:'Otro'})}));
  return new Response('{}',{status:404});
 };
 const backend=createAgentBackend({projectId:'test',databaseId:'test',token:'test',uid:'admin',tenantId:'tenant',leaderIds:['owner','foreign'],eventIds:['event'],fetcher});
 const result=await backend.turn({conversationId:'scoped-conversation',messageId:'scoped-message',revision:0,action:'resume'});
 assert.deepEqual(result.context.leaders,[{id:'owner',name:'Wilson José Arias'}]);
 assert.deepEqual(result.context.events,[{id:'event',name:'Recepción WhatsApp'}]);
});


test('private LIDs work without phone lookup and keep their channel identity when a number becomes available',async()=>{
 const start=Date.now()-3000;
 const msg={key:{id:'lid-only',remoteJid:'123456789012345@lid'},messageTimestamp:Math.floor(Date.now()/1000),message:{conversation:'Necesito 3 almuerzos'}};
 const missing=await resolvePilotText(msg,start);
 assert.equal(missing.incoming?.phone,'');assert.equal(missing.incoming?.jid,msg.key.remoteJid);
 assert.match(missing.incoming!.senderKey,/^lid:[a-f0-9]{64}$/);
 const failed=await resolvePilotText(msg,start,async()=>{throw Error('mapping unavailable');});
 assert.deepEqual(failed,missing);
 const mapped=await resolvePilotText(msg,start,async()=> '573009999999@s.whatsapp.net');
 assert.equal(mapped.incoming?.phone,'573009999999');assert.equal(mapped.incoming?.senderKey,missing.incoming?.senderKey);
 const device=await resolvePilotText({...msg,key:{...msg.key,remoteJid:'123456789012345:3@lid'}},start);
 assert.equal(device.incoming?.senderKey,missing.incoming?.senderKey);
 const other=await resolvePilotText({...msg,key:{...msg.key,remoteJid:'123456789012346@lid'}},start);
 assert.notEqual(other.incoming?.senderKey,missing.incoming?.senderKey);
 for(const patch of [{key:{...msg.key,fromMe:true}},{key:{...msg.key,remoteJid:'123456789012345@g.us'}},{key:{...msg.key,remoteJid:'bad@lid'}},{messageTimestamp:0}]){
  assert.equal((await resolvePilotText({...msg,...patch},start)).incoming,null);
 }
});

test('supported private content receives useful guidance instead of being silently dropped',async()=>{
 const start=Date.now()-3000,msg={key:{id:'content-help',remoteJid:'573001234567@s.whatsapp.net'},messageTimestamp:Math.floor(Date.now()/1000)};
 for(const message of [{audioMessage:{}},{imageMessage:{}},{locationMessage:{}},{conversation:'x'.repeat(1501)}]){
  const result=await resolvePilotText({...msg,message},start);
  assert.ok(result.incoming);assert.match(result.incoming.unsupportedReply!,/texto|1500/);
 }
 assert.equal((await resolvePilotText({...msg,message:{conversation:'x'.repeat(1500)}},start)).incoming?.text.length,1500);
 assert.equal((await resolvePilotText({...msg,message:{}},start)).incoming,null,'system packets must not receive automatic replies');
});
