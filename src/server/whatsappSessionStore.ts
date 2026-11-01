import {createCipheriv,createDecipheriv,createHash,randomBytes} from 'node:crypto';
import {BufferJSON,initAuthCreds,proto,type AuthenticationState} from '@whiskeysockets/baileys';
import {AgentError} from '../lib/requestAgent.js';
import {decodeFields,encodeFields} from './requestAgent.js';
import type {PilotConfig} from './whatsappPilotCore.js';
import {writeCheckpoint} from './firestoreCheckpoint.js';

export type TabSession={id:string;key:string};
export type InboxItem={phone:string;jid:string;text:string;messageId:string;result?:{reply:string;requestId?:string}};
export type SessionState={version:1;startedAt:number;creds:AuthenticationState['creds'];keys:Record<string,unknown>;conversations:Record<string,string>;inbox:InboxItem[];handled:string[]};
export function validateTabSession(value:unknown):TabSession{
 const v=value as TabSession;
 if(!v||!/^\w{32}$/.test(v.id)||! /^[a-f0-9]{64}$/.test(v.key))throw new AgentError('Actualice la plataforma para iniciar la conexión de WhatsApp.');
 return {id:v.id,key:v.key};
}
export function sealSession(state:SessionState,key:string,aad:string){
 const plain=Buffer.from(JSON.stringify(state,BufferJSON.replacer));
 if(plain.length>650000)throw new AgentError('La sesión alcanzó su capacidad. Detenga la recepción e inicie una nueva vinculación.',422);
 const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',Buffer.from(key,'hex'),iv);
 cipher.setAAD(Buffer.from(aad));
 return Buffer.concat([iv,cipher.update(plain),cipher.final(),cipher.getAuthTag()]).toString('base64');
}
export function openSession(ciphertext:string,key:string,aad:string):SessionState{
 try{
  const data=Buffer.from(ciphertext,'base64');
  const decipher=createDecipheriv('aes-256-gcm',Buffer.from(key,'hex'),data.subarray(0,12));
  decipher.setAAD(Buffer.from(aad));decipher.setAuthTag(data.subarray(-16));
  const state=JSON.parse(Buffer.concat([decipher.update(data.subarray(12,-16)),decipher.final()]).toString(),BufferJSON.reviver);
  if(state.version!==1||!state.creds||!state.keys||!state.conversations||!Array.isArray(state.inbox)||!Array.isArray(state.handled)||!Number.isFinite(state.startedAt))throw Error('Invalid state');
  return state;
 }catch{throw new AgentError('No se pudo recuperar esta vinculación. Inicie una nueva desde el panel.',422);}
}

// The random encryption key stays in the open tab's memory, never in Firestore,
// URLs, browser storage or logs. The AAD binds ciphertext to its operator + scope.
export async function loadWhatsappSession(options:{base:string;token:string;uid:string;config:PilotConfig;session:TabSession;fetcher?:typeof fetch}){
 const request=options.fetcher||fetch;
 const binding=createHash('sha256').update(JSON.stringify([options.uid,options.session.id,options.config])).digest('hex');
 const path=`usuarios/${options.uid}/whatsapp_sessions/${options.session.id}`;
 const url=`${options.base}/${path}`;
 const headers={Authorization:`Bearer ${options.token}`,'Content-Type':'application/json'};
 const got=await request(url,{headers,signal:AbortSignal.timeout(12000)});
 if(!got.ok&&got.status!==404)throw new AgentError('No se pudo recuperar la sesión de Firestore.',503);
 const record=got.ok?await got.json():null;
 const fields=record?decodeFields(record.fields):null;
 if(fields&&fields.binding!==binding)throw new AgentError('Esta vinculación pertenece a otro ámbito.',403);
 const state:SessionState=fields?openSession(fields.ciphertext,options.session.key,binding):{version:1,startedAt:Date.now(),creds:initAuthCreds(),keys:{},conversations:{},inbox:[],handled:[]};
 let revision=record?.updateTime||'';
 let writes=Promise.resolve();
 const save=()=>{
  writes=writes.then(async()=>{
   const ciphertext=sealSession(state,options.session.key,binding);
   const saved=await writeCheckpoint({base:options.base,path,headers,request,revision,fields:encodeFields({binding,ciphertext,updatedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+86400000).toISOString()})});
   if(!saved.ok||!saved.updateTime)throw new AgentError('No se pudo conservar la vinculación. La recepción se detuvo para proteger los mensajes.',503);
   revision=saved.updateTime;
  });return writes;
 };
 const auth:AuthenticationState={creds:state.creds,keys:{
  get:async(type,ids)=>Object.fromEntries(ids.map(id=>{
   let value=state.keys[`${type}:${id}`];
   if(type==='app-state-sync-key'&&value)value=proto.Message.AppStateSyncKeyData.fromObject(value as any);
   return [id,value];
  })) as any,
  set:async(data)=>{for(const [type,values] of Object.entries(data))for(const [id,value] of Object.entries(values||{})){if(value==null)delete state.keys[`${type}:${id}`];else state.keys[`${type}:${id}`]=value;}await save();}
 }};
 if(!record)await save();
 return {state,auth,save,flush:()=>writes};
}
