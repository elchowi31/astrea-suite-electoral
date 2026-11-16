import {test} from 'node:test';import assert from 'node:assert/strict';import {webcrypto} from 'node:crypto';import {IDBFactory} from 'fake-indexeddb';
import {rememberWhatsappIdentity,recalledWhatsappIdentity,forgetWhatsappIdentity,clearWhatsappDeviceSessions,WHATSAPP_DEVICE_DATABASE} from '../src/lib/whatsappDeviceSession';
const identity={id:'a'.repeat(32),key:'b'.repeat(64),scope:'scoped-config',paired:true};
function environment(){let time=1000,enabled=true;return {database:new IDBFactory(),crypto:webcrypto as unknown as Crypto,enabled:()=>enabled,now:()=>time,advance:()=>{time+=7*86400000;},disable:()=>{enabled=false;}};}
test('a fresh read recovers paired identity by account and tenant; storage holds no clear session key',async()=>{
 const env=environment();await rememberWhatsappIdentity('u','t',identity,true,env);assert.deepEqual((await recalledWhatsappIdentity('u','t',env))?.identity,identity);assert.equal(await recalledWhatsappIdentity('other','t',env),null);assert.equal(await recalledWhatsappIdentity('u','other',env),null);
 const db=await new Promise<IDBDatabase>(resolve=>{const r=env.database.open(WHATSAPP_DEVICE_DATABASE);r.onsuccess=()=>resolve(r.result);});const record:any=await new Promise(resolve=>{const r=db.transaction('connections').objectStore('connections').get(JSON.stringify(['u','t']));r.onsuccess=()=>resolve(r.result);});db.close();assert.equal(record.key.extractable,false);assert.ok(!JSON.stringify(record).includes(identity.key));await assert.rejects(()=>env.crypto.subtle.exportKey('raw',record.key));
 await forgetWhatsappIdentity('u','t',env);assert.equal(await recalledWhatsappIdentity('u','t',env),null);
});
test('pause wins concurrent writes; unpaired, opted out and expired links never auto reconnect',async()=>{
 const env=environment();await Promise.all([rememberWhatsappIdentity('u','t',identity,true,env),rememberWhatsappIdentity('u','t',identity,false,env)]);assert.equal((await recalledWhatsappIdentity('u','t',env))?.autoResume,false);env.advance();assert.equal(await recalledWhatsappIdentity('u','t',env),null);
 assert.equal(await rememberWhatsappIdentity('u','t',{...identity,paired:false},true,env),false);env.disable();assert.equal(await rememberWhatsappIdentity('u','t',identity,true,env),false);
});
test('device withdrawal fences pending writes and removes the vault',async()=>{
 const env=environment();const pending=rememberWhatsappIdentity('u','t',identity,true,env);await clearWhatsappDeviceSessions(env.database);await pending;assert.equal(await recalledWhatsappIdentity('u','t',env),null);
});
