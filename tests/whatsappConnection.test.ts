import {test} from 'node:test';
import assert from 'node:assert/strict';
import {runWhatsappTab} from '../src/lib/whatsappTabConnection.ts';

const stream=(events:unknown[])=>new Response(events.map(e=>JSON.stringify(e)+'\n').join(''),{headers:{'Content-Type':'application/x-ndjson'}});

test('repeated HTTP failures stop with the actual reason instead of an endless reconnect label',async()=>{
 const events:any[]=[],delays:number[]=[];let calls=0;
 await runWhatsappTab({body:{},signal:new AbortController().signal,maxFailures:3,
  request:async()=>{calls++;return new Response(JSON.stringify({error:'Firestore no confirmó el guardado.'}),{status:503});},
  onEvent:e=>events.push(e),wait:async ms=>{delays.push(ms);}});
 assert.equal(calls,3);assert.deepEqual(delays,[2000,4000]);
 assert.equal(events.at(-1).type,'fatal');assert.match(events.at(-1).message,/3 intentos/);
 assert.ok(events.every(e=>e.message.includes('Firestore no confirmó')));
});

test('an HTML fallback is not treated as a WhatsApp stream',async()=>{
 const events:any[]=[];let calls=0;
 await runWhatsappTab({body:{},signal:new AbortController().signal,request:async()=>{calls++;return new Response('<html>Astrea</html>',{headers:{'Content-Type':'text/html'}});},onEvent:e=>events.push(e)});
 assert.equal(calls,1);assert.equal(events[0].type,'fatal');assert.match(events[0].message,/ruta de la API/);
});

test('server disconnect reason remains visible while retrying',async()=>{
 const events:any[]=[];let calls=0;
 await runWhatsappTab({body:{},signal:new AbortController().signal,maxFailures:2,request:async()=>{calls++;return stream([{type:'retry',message:'WhatsApp interrumpió la conexión (código 428).'}]);},onEvent:e=>events.push(e),wait:async()=>{}});
 assert.equal(calls,2);assert.match(events.at(-1).message,/428/);
 assert.match(events.find(e=>e.message.includes('Reintento')).message,/428/);
});

test('successful connection resets failure count and normal renewal stays active',async()=>{
 const events:any[]=[];const stop=new AbortController();let calls=0;
 await runWhatsappTab({body:{},signal:stop.signal,maxFailures:2,request:async()=>{
  calls++;if(calls===1||calls===3)return new Response('{}',{status:503});
  return stream([{type:'connected'},{type:'renew'}]);
 },onEvent:e=>{events.push(e);if(calls===4&&e.type==='connected')stop.abort();},wait:async()=>{}});
 assert.equal(calls,4);assert.ok(!events.some(e=>e.type==='fatal'));
});
