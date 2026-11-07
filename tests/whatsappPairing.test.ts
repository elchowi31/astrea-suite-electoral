import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {initAuthCreds,DisconnectReason} from '@whiskeysockets/baileys';
import {hasPairedWhatsappIdentity} from '../src/server/whatsappPairing';
import {runWhatsappPilot} from '../src/server/whatsappPilot';
import {runWhatsappTab} from '../src/lib/whatsappTabConnection';

const config={phone:'573001234567',tenantId:'tenant',leaderId:'leader',eventId:'event',municipality:'Astrea'};
const session={id:'a'.repeat(32),key:'b'.repeat(64),resumeId:'c'.repeat(32)};
function signed(creds:ReturnType<typeof initAuthCreds>){
 creds.me={id:config.phone+':1@s.whatsapp.net'};
 creds.account={accountSignature:Buffer.from('account-signature'),deviceSignature:Buffer.from('device-signature')};
 return creds;
}
async function exercise(options:{creds?:ReturnType<typeof initAuthCreds>;setup?:(socket:any,index:number)=>void;segmentMs?:number;flush?:()=>Promise<void>}={}){
 const creds=options.creds||initAuthCreds(),events:any[]=[],stages:string[]=[],order:string[]=[];
 let sockets=0,pairingRequests=0;
 const state={version:1,startedAt:Date.now(),creds,keys:{},conversations:{},inbox:[],handled:[]};
 const res=Object.assign(new EventEmitter(),{destroyed:false,writableEnded:false,statusCode:0,setHeader(){},flushHeaders(){},write(line:string){events.push(JSON.parse(line));},end(){this.writableEnded=true;}});
 await runWhatsappPilot({projectId:'test',databaseId:'test',token:'test',uid:'admin',config,session,res:res as any,checkActive:async()=>{}},{
  segmentMs:options.segmentMs||250,
  makeSocket:(()=>{
   const index=++sockets;order.push('socket-'+index);
   const socket={ev:new EventEmitter(),user:{id:config.phone+':1@s.whatsapp.net'},end(){order.push('end-'+index);},requestPairingCode:async()=>{
    pairingRequests++;creds.me={id:config.phone+'@s.whatsapp.net',name:'~'};
    socket.ev.emit('creds.update',creds);return 'TEST1234';
   }};
   queueMicrotask(()=>options.setup?.(socket,index));return socket;
  }) as any,
  loadSession:(async()=>({state,auth:{creds,keys:{}},save:async()=>{order.push('save');},flush:async()=>{await options.flush?.();order.push('flush');}})) as any,
  lease:(()=>({acquire:async()=>{},release:async()=>{order.push('release');}})) as any,
  createDiagnostics:(()=>({record:async(stage:string)=>{stages.push(stage);},flush:async()=>{}})) as any
 });
 return {events,stages,order,sockets,pairingRequests};
}
test('web pair-success is resumable without registered; a pairing-code identity alone is not',()=>{
 const creds=initAuthCreds();creds.me={id:config.phone+'@s.whatsapp.net',name:'~'};
 assert.equal(hasPairedWhatsappIdentity(creds),false);
 creds.registered=true;assert.equal(hasPairedWhatsappIdentity(creds),false,'the flag alone is not proof of signed web pairing');
 creds.registered=false;signed(creds);assert.equal(hasPairedWhatsappIdentity(creds),true);
});
test('a 408 during pairing terminates once and instructs the tab to discard the incomplete identity',async()=>{
 const result=await exercise({setup(socket){
  socket.ev.emit('connection.update',{qr:'challenge'});
  setImmediate(()=>socket.ev.emit('connection.update',{connection:'close',lastDisconnect:{error:{output:{statusCode:DisconnectReason.timedOut}}}}));
 }});
 assert.equal(result.pairingRequests,1);assert.equal(result.sockets,1);
 assert.equal(result.events.at(-1).type,'fatal');assert.equal(result.events.at(-1).resetSession,true);
 assert.match(result.events.at(-1).message,/408/);assert.ok(!result.events.some(e=>e.type==='retry'||e.type==='renew'));
 assert.ok(result.stages.includes('pairing'));
});
test('a restored partial pairing cannot open a login socket or create a second 401',async()=>{
 const creds=initAuthCreds();creds.me={id:config.phone+'@s.whatsapp.net',name:'~'};
 const result=await exercise({creds});
 assert.equal(result.sockets,0);assert.equal(result.events.at(-1).resetSession,true);
 assert.match(result.events.at(-1).message,/incompleto/);
});
test('segment expiration before phone confirmation requires a new identity, never automatic renewal',async()=>{
 const result=await exercise({segmentMs:30,setup(socket){socket.ev.emit('connection.update',{qr:'challenge'});}});
 assert.equal(result.events.at(-1).type,'fatal');assert.equal(result.events.at(-1).resetSession,true);
 assert.match(result.events.at(-1).message,/tiempo/);
});
test('successful web pairing persists signed credentials before the required restart and renews normally',async()=>{
 let flushed=false;
 const result=await exercise({flush:async()=>{await new Promise(resolve=>setImmediate(resolve));flushed=true;},setup(socket,index){
  if(index===1){
   socket.ev.emit('connection.update',{qr:'challenge'});
   setImmediate(()=>{
    const update=signed(initAuthCreds());socket.ev.emit('creds.update',{account:update.account,me:update.me});
    socket.ev.emit('connection.update',{isNewLogin:true});
    socket.ev.emit('connection.update',{connection:'close',lastDisconnect:{error:{output:{statusCode:DisconnectReason.restartRequired}}}});
   });
  }else{assert.equal(flushed,true);socket.ev.emit('connection.update',{connection:'open'});}
 }});
 assert.equal(result.sockets,2);assert.equal(result.pairingRequests,1);
 assert.ok(result.events.some(e=>e.type==='paired'));assert.ok(result.events.some(e=>e.type==='connected'));
 assert.equal(result.events.at(-1).type,'renew');assert.ok(result.order.indexOf('flush')<result.order.indexOf('socket-2'));
 assert.ok(result.order.lastIndexOf('release')>result.order.lastIndexOf('flush'));
});
test('an already paired web session survives segment renewal with registered still false',async()=>{
 const creds=signed(initAuthCreds());assert.equal(creds.registered,false);
 const result=await exercise({creds,setup(socket){socket.ev.emit('connection.update',{connection:'open'});}});
 assert.equal(result.pairingRequests,0);assert.match(result.events[0].message,/Recuperando/);
 assert.equal(result.events.at(-1).type,'renew');
});
test('a revoked signed session requests a fresh identity instead of reusing rejected credentials',async()=>{
 const result=await exercise({creds:signed(initAuthCreds()),setup(socket){
  socket.ev.emit('connection.update',{connection:'close',lastDisconnect:{error:{output:{statusCode:DisconnectReason.loggedOut}}}});
 }});
 assert.equal(result.events.at(-1).type,'fatal');assert.equal(result.events.at(-1).resetSession,true);
 assert.match(result.events.at(-1).message,/401/);
});
test('browser propagates resetSession and does not retry a terminal incomplete pairing',async()=>{
 let requests=0;const events:any[]=[];
 await runWhatsappTab({body:{},signal:new AbortController().signal,onEvent:e=>events.push(e),request:async()=>{
  requests++;return new Response(JSON.stringify({type:'fatal',resetSession:true,message:'El intento quedó incompleto.'})+'\n',{headers:{'Content-Type':'application/x-ndjson'}});
 },wait:async()=>assert.fail('A rejected pairing must not retry')});
 assert.equal(requests,1);assert.equal(events.at(-1).resetSession,true);
});
