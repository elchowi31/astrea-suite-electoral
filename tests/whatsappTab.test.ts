import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {initAuthCreds} from '@whiskeysockets/baileys';
import {sealSession,openSession,loadWhatsappSession,validateTabSession,type SessionState} from '../src/server/whatsappSessionStore';
import {runWhatsappTab} from '../src/lib/whatsappTabConnection';
import {runWhatsappPilot} from '../src/server/whatsappPilot';

const config={phone:'573001234567',tenantId:'tenant',leaderId:'leader',eventId:'event',municipality:'Astrea'};
const session={id:'a'.repeat(32),key:'b'.repeat(64),resumeId:'c'.repeat(32)};
function state():SessionState{return {version:1,startedAt:Date.now(),creds:initAuthCreds(),keys:{test:Buffer.from('private-key')},conversations:{phone:'conversation-2'},inbox:[],handled:[]};}
test('encrypted session restores binary keys and rejects tampering, wrong owner and wrong key',()=>{
 const initial=state();const sealed=sealSession(initial,session.key,'operator:scope');
 assert.ok(!sealed.includes('private-key'));assert.ok(!sealed.includes('conversation-2'));
 const restored=openSession(sealed,session.key,'operator:scope');assert.deepEqual(restored.keys.test,initial.keys.test);assert.deepEqual(restored.creds.noiseKey,initial.creds.noiseKey);
 assert.notEqual(sealed,sealSession(initial,session.key,'operator:scope'));
 assert.throws(()=>openSession(sealed,'c'.repeat(64),'operator:scope'));
 assert.throws(()=>openSession(sealed,session.key,'another:scope'));
 const changed=Buffer.from(sealed,'base64');changed[20]^=1;assert.throws(()=>openSession(changed.toString('base64'),session.key,'operator:scope'));
 assert.throws(()=>validateTabSession({id:'../other',key:session.key}));
});
test('Firestore checkpoint survives a new invocation, serializes writes and refuses stale overwrites',async()=>{
 let doc:any=null,revision=0,fail=false;const writes:string[]=[];
 const fetcher:typeof fetch=async(url,init)=>{
  if(init?.method!=='POST')return new Response(JSON.stringify(doc||{}),{status:doc?200:404});
  const write=JSON.parse(String(init.body)).writes[0],guard=write.currentDocument;
  if(fail)return new Response('{}',{status:503});
  if((guard.exists===false&&doc)||(guard.updateTime&&guard.updateTime!==doc?.updateTime))return new Response('{}',{status:409});
  writes.push(String(init.body));doc={fields:write.update.fields,updateTime:String(++revision)};return new Response(JSON.stringify({writeResults:[{updateTime:doc.updateTime}]}));
 };
 const options={base:'https://firestore.test/documents',uid:'admin',token:'test',config,session,fetcher};
 const first=await loadWhatsappSession(options);
 await first.auth.keys.set({'pre-key':{'1':{private:Buffer.from('secret'),public:Buffer.from('pub')}}});
 first.state.conversations.contact='new-draft';first.state.inbox.push({phone:'573009999999',jid:'573009999999@s.whatsapp.net',messageId:'in-1',text:'confirmar'});await first.save();
 first.state.startedAt=1000;await first.save();
 const second=await loadWhatsappSession(options);assert.equal(second.state.inbox[0].messageId,'in-1');assert.equal(second.state.conversations.contact,'new-draft');assert.deepEqual((await second.auth.keys.get('pre-key',['1']))['1'].private,Buffer.from('secret'));
 assert.equal(second.state.startedAt,1000,'automatic renewals retain the admitted time range');
 assert.ok(writes.every(w=>!w.includes('secret')&&!w.includes('new-draft')&&!w.includes(session.key)));
 await second.auth.keys.set({'pre-key':{'1':null}});assert.equal((await second.auth.keys.get('pre-key',['1']))['1'],undefined);
 await assert.rejects(first.save(),/conservar/);
 await assert.rejects(loadWhatsappSession({...options,config:{...config,tenantId:'other'}}),/ámbito/);
 const resumed=await loadWhatsappSession({...options,session:{...session,resumeId:'d'.repeat(32)}});
 assert.ok(resumed.state.startedAt>1000,'explicit resume excludes messages from the paused interval');
 assert.equal(resumed.state.inbox[0].messageId,'in-1','already accepted work remains pending');
 fail=true;await assert.rejects(resumed.save(),/conservar/);
});
test('durable receipts prevent replay beyond 1000 messages without growing the session cache',async()=>{
 const records=new Map<string,any>();let revision=0;
 const root='projects/test/databases/test/documents';
 const fetcher:typeof fetch=async(url,init)=>{
  if(init?.method!=='POST'){
   const path=new URL(String(url)).pathname.replace('/v1/','');const value=records.get(path);
   return new Response(JSON.stringify(value||{}),{status:value?200:404});
  }
  const write=JSON.parse(String(init.body)).writes[0],previous=records.get(write.update.name),guard=write.currentDocument;
  if((guard.exists===false&&previous)||(guard.updateTime&&guard.updateTime!==previous?.updateTime))return new Response('{}',{status:409});
  const record={fields:write.update.fields,updateTime:String(++revision)};records.set(write.update.name,record);
  return new Response(JSON.stringify({writeResults:[{updateTime:record.updateTime}]}));
 };
 const options={base:`https://firestore.test/v1/${root}`,uid:'admin',token:'test',config,session,fetcher};
 const first=await loadWhatsappSession(options);
 for(let i=0;i<1002;i++)await first.markHandled(`message-${i}`);
 assert.equal(first.state.handled.length,500);assert.ok(!first.state.handled.includes('message-0'));
 await first.save();const second=await loadWhatsappSession(options);
 assert.equal(await second.wasHandled('message-0'),true);assert.equal(await second.wasHandled('message-1001'),true);
 assert.equal(await second.wasHandled('not-received'),false);
 await second.markHandled('message-0');await second.save();
 assert.equal(records.size,1003,'one session and one durable receipt per message');
});
const response=(events:unknown[])=>new Response(events.map(e=>JSON.stringify(e)+'\n').join(''),{headers:{'Content-Type':'application/x-ndjson'}});
test('tab renews with fresh authorized requests and unchanged session; stop prevents another request',async()=>{
 const abort=new AbortController();const bodies:unknown[]=[];const events:string[]=[];let calls=0;
 await runWhatsappTab({body:{config,session},signal:abort.signal,request:async init=>{calls++;bodies.push(JSON.parse(String(init.body)));return response([{type:'connected'},{type:'renew'}]);},onEvent:e=>{events.push(e.type);if(calls===3&&e.type==='connected')abort.abort();},wait:async()=>{}});
 assert.equal(calls,3);assert.deepEqual(bodies[0],bodies[2]);assert.equal(events.filter(e=>e==='connected').length,3);
});
test('tab backs off for exclusive lease, retries broken streams and stops on permission revocation',async()=>{
 const delays:number[]=[];const events:string[]=[];let calls=0;
 await runWhatsappTab({body:{},signal:new AbortController().signal,request:async()=>{calls++;if(calls===1)return new Response('{}',{status:409});if(calls===2)throw Error('connection lost');return new Response(JSON.stringify({error:'Acceso revocado'}),{status:403});},onEvent:e=>events.push(e.type),wait:async ms=>{delays.push(ms);}});
 assert.deepEqual(delays,[2000,4000]);assert.equal(calls,3);assert.equal(events.at(-1),'fatal');
});
test('rotation closes socket without logout and signals renewal only after checkpoint and exclusive lease release',async()=>{
 const order:string[]=[];const events:any[]=[];const res=Object.assign(new EventEmitter(),{destroyed:false,writableEnded:false,statusCode:0,setHeader(){},flushHeaders(){},write(line:string){const event=JSON.parse(line);events.push(event);order.push(event.type);},end(){this.writableEnded=true;}});
 const persisted=state();persisted.creds.registered=true;persisted.inbox=[{phone:'573009999999',jid:'573009999999@s.whatsapp.net',messageId:'pending',text:'confirmar',result:{reply:'Guardado',requestId:'request-1'}}];
 let logouts=0,sends=0;const ev=new EventEmitter();
 const socket={ev,user:{id:config.phone+'@s.whatsapp.net'},end(){order.push('socket-end');},logout:async()=>{logouts++;},sendMessage:async()=>{sends++;}};
 await runWhatsappPilot({projectId:'test',databaseId:'test',token:'test',uid:'admin',config,session,res:res as any,checkActive:async()=>{}},{segmentMs:25,makeSocket:(()=>{queueMicrotask(()=>ev.emit('connection.update',{connection:'open'}));return socket;}) as any,loadSession:(async()=>({state:persisted,auth:{creds:persisted.creds,keys:{}},save:async()=>{order.push('save');},markHandled:async(id:string)=>{persisted.handled.push(id);},wasHandled:async(id:string)=>persisted.handled.includes(id),flush:async()=>{order.push('flush');}})) as any,lease:(()=>({owner:'lease',acquire:async()=>{},release:async()=>{order.push('release');}})) as any});
 assert.equal(logouts,0);assert.equal(sends,1);assert.equal(persisted.inbox.length,0);assert.ok(persisted.handled.includes('pending'));assert.ok(order.indexOf('renew')>order.indexOf('flush'));assert.ok(order.indexOf('renew')>order.indexOf('release'));assert.equal(events.at(-1).type,'renew');
});
