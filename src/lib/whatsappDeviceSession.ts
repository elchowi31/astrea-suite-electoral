import {localDataEnabled} from './deviceStorage';

export type WhatsappIdentity={id:string;key:string;scope:string;paired:boolean};
export type RememberedWhatsapp={identity:WhatsappIdentity;autoResume:boolean;expiresAt:number};
type VaultRecord={id:string;key:CryptoKey;iv:Uint8Array;ciphertext:ArrayBuffer};
export const WHATSAPP_DEVICE_DATABASE='astrea-whatsapp-device';
const MAX_AGE=6*86400000;
let writes:Promise<unknown>=Promise.resolve(),epoch=0,clearing=false;
function serialize<T>(action:()=>Promise<T>):Promise<T>{const next=writes.then(action,action);writes=next.catch(()=>{});return next;}
type Environment={database:IDBFactory;crypto:Crypto;enabled:()=>boolean;now:()=>number};
const browser=():Environment=>({database:indexedDB,crypto:globalThis.crypto,enabled:localDataEnabled,now:Date.now});
function open(env:Environment):Promise<IDBDatabase>{return new Promise((resolve,reject)=>{const request=env.database.open(WHATSAPP_DEVICE_DATABASE,1);request.onupgradeneeded=()=>request.result.createObjectStore('connections',{keyPath:'id'});request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}
async function operation<T>(env:Environment,mode:IDBTransactionMode,act:(store:IDBObjectStore)=>IDBRequest<T>):Promise<T>{
 const db=await open(env);return new Promise((resolve,reject)=>{const tx=db.transaction('connections',mode),request=act(tx.objectStore('connections'));let value:T;request.onsuccess=()=>{value=request.result;};tx.oncomplete=()=>{db.close();resolve(value);};tx.onerror=tx.onabort=()=>{db.close();reject(tx.error||request.error);};});
}
const recordId=(uid:string,tenantId:string)=>JSON.stringify([uid,tenantId]);
export async function forgetWhatsappIdentity(uid:string,tenantId:string,env=browser()){
 await serialize(()=>operation(env,'readwrite',store=>store.delete(recordId(uid,tenantId))));
}
/** The only browser copy is encrypted with a non-exportable device key, scoped to its account. */
export async function rememberWhatsappIdentity(uid:string,tenantId:string,identity:WhatsappIdentity,autoResume:boolean,env=browser()){
 if(!env.enabled()||!identity.paired||clearing)return false;
 const acceptedEpoch=epoch;
 return serialize(async()=>{
 const id=recordId(uid,tenantId),key=await env.crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']);
 const iv=env.crypto.getRandomValues(new Uint8Array(12)),plain=new TextEncoder().encode(JSON.stringify({identity,autoResume,expiresAt:env.now()+MAX_AGE} satisfies RememberedWhatsapp));
 const ciphertext=await env.crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:new TextEncoder().encode(id)},key,plain);
 if(clearing||epoch!==acceptedEpoch||!env.enabled())return false;
 await operation(env,'readwrite',store=>store.put({id,key,iv,ciphertext} satisfies VaultRecord));return true;
 });
}
export async function recalledWhatsappIdentity(uid:string,tenantId:string,env=browser()):Promise<RememberedWhatsapp|null>{
 if(!env.enabled()||clearing)return null;
 await writes;
 const id=recordId(uid,tenantId),record=await operation(env,'readonly',store=>store.get(id)) as VaultRecord|undefined;if(!record)return null;
 try{
  const plain=await env.crypto.subtle.decrypt({name:'AES-GCM',iv:record.iv as Uint8Array<ArrayBuffer>,additionalData:new TextEncoder().encode(id)},record.key,record.ciphertext);
  const value=JSON.parse(new TextDecoder().decode(plain)) as RememberedWhatsapp;
  if(!value.identity?.paired||!/^\w{32}$/.test(value.identity.id)||! /^[a-f0-9]{64}$/.test(value.identity.key)||typeof value.identity.scope!=='string'||!Number.isFinite(value.expiresAt)||value.expiresAt<=env.now())throw Error('Expired');
  return value;
 }catch{await forgetWhatsappIdentity(uid,tenantId,env);return null;}
}

export async function clearWhatsappDeviceSessions(factory:IDBFactory=indexedDB){
 clearing=true;epoch++;
 try{await writes;await new Promise<void>((resolve,reject)=>{const request=factory.deleteDatabase(WHATSAPP_DEVICE_DATABASE);request.onsuccess=()=>resolve();request.onerror=()=>reject(request.error);request.onblocked=()=>reject(new Error('Cierre las otras pestañas antes de retirar la vinculación de WhatsApp.'));});}
 finally{clearing=false;}
}
