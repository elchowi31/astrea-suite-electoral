import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createWhatsappDiagnostics} from '../src/server/whatsappDiagnostics';
import {decodeFields} from '../src/server/requestAgent';
test('diagnostics persist ordered stages, retain bounded previews and do not store tokens or full phone numbers',async()=>{
 let record:any=null,revision=0;const fetcher:typeof fetch=async(_input,init)=>{
  if(init?.method!=='POST')return new Response(JSON.stringify(record||{}),{status:record?200:404});
  const write=JSON.parse(String(init.body)).writes[0];assert.match(write.update.name,/usuarios\/owner\/whatsapp_activity\/tenant$/);
  record={fields:write.update.fields,updateTime:String(++revision)};return new Response(JSON.stringify({writeResults:[{updateTime:record.updateTime}]}));
 };
 const options={base:'https://firestore.test/v1/projects/test/databases/test/documents',token:'private-token',uid:'owner',config:{tenantId:'tenant',eventId:'event',phone:'573009999999'},session:{id:'session'},fetcher};
 const d=createWhatsappDiagnostics(options);
 await d.record('starting',{queued:0,recoveredHandled:2});
 await Promise.all([d.record('received',{senderHint:'5678',conversationHint:'abc123456789',text:'Necesito 3 almuerzos'}),d.record('prepared',{reply:'Complete la descripción'}),d.record('replied',{reply:'Complete la descripción',queued:0,responseMs:8200,processingMs:1400})]);
 await d.record('saved',{requestId:'request-1'});await d.record('saved',{requestId:'request-1'});
 for(let i=0;i<35;i++)await d.record('ignored',{detail:'Formato no compatible'});await d.record('heartbeat');await d.flush();
 let stored=decodeFields(record.fields);assert.equal(stored.received,1);assert.equal(stored.lastResponseMs,8200);assert.equal(stored.lastProcessingMs,1400);assert.equal(stored.lastConversationHint,'abc123456789');assert.equal(stored.replied,1);assert.equal(stored.saved,1);assert.equal(stored.history.length,30);assert.equal(stored.lastText,'Necesito 3 almuerzos');assert.equal(stored.lastReply,'Complete la descripción');assert.equal(stored.receiverHint,'9999');assert.ok(stored.lastHeartbeatAt);
 const json=JSON.stringify(record);assert.ok(!json.includes(options.token));assert.ok(!json.includes(options.config.phone));
 const resumed=createWhatsappDiagnostics(options);await resumed.record('connected');stored=decodeFields(record.fields);assert.equal(stored.received,1,'renewal retains counters');
});
