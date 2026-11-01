import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validatePilotConfig,incomingPilotText,pilotLease} from '../src/server/whatsappPilotCore';
import {encodeFields,decodeFields} from '../src/server/requestAgent';

test('pilot requires explicit scope and international phone',()=>{
 const config={phone:'+57 300 123 4567',tenantId:'team-a',leaderId:'leader-a',eventId:'event-a',municipality:'Astrea'};
 assert.equal(validatePilotConfig(config).phone,'573001234567');
 for(const patch of [{phone:'abc'},{eventId:''},{leaderId:'../other'},{municipality:''}])assert.throws(()=>validatePilotConfig({...config,...patch}));
});
test('only new inbound private text with verified sender identity enters the pilot',()=>{
 const now=Date.now();const msg={key:{id:'msg',remoteJid:'573001234567@s.whatsapp.net'},messageTimestamp:Math.floor(now/1000),message:{conversation:'Necesito 8 almuerzos'}};
 assert.equal(incomingPilotText(msg,now)?.phone,'573001234567');
 for(const patch of [{key:{...msg.key,fromMe:true}},{key:{...msg.key,remoteJid:'abc@g.us'}},{key:{...msg.key,remoteJid:'opaque@lid'}},{messageTimestamp:0},{messageTimestamp:undefined},{message:{conversation:'x'.repeat(501)}}])assert.equal(incomingPilotText({...msg,...patch},now),null);
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
