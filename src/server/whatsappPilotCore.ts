import {createHash,randomUUID} from 'node:crypto';
import {AgentError,type AgentDraft} from '../lib/requestAgent.js';
import {canonicalSender} from '../../integrations/claude-kit/astrea-adapter.js';
import {createAgentBackend,decodeFields,encodeFields} from './requestAgent.js';
import {writeCheckpoint} from './firestoreCheckpoint.js';

export const PILOT_SECONDS=240;
export type PilotConfig={phone:string;tenantId:string;leaderId:string;eventId:string;municipality:string};
export function validatePilotConfig(body:Record<string,unknown>):PilotConfig{
 const phone=String(body.phone||'').replace(/[+\s()-]/g,'');
 if(!/^\d{8,15}$/.test(phone))throw new AgentError('Incluya el indicativo del país y el número de WhatsApp.');
 const result={phone,tenantId:String(body.tenantId||''),leaderId:String(body.leaderId||''),eventId:String(body.eventId||''),municipality:String(body.municipality||'').trim()};
 for(const k of ['tenantId','leaderId','eventId'] as const)if(!/^[\w-]{1,120}$/.test(result[k]))throw new AgentError('Seleccione organización, responsable y jornada de prueba.');
 if(!result.municipality||result.municipality.length>120)throw new AgentError('Revise el municipio de prueba.');
 return result;
}
export type PilotMessage={key:{id?:string|null;fromMe?:boolean|null;remoteJid?:string|null;remoteJidAlt?:string|null;senderPn?:string|null};messageTimestamp?:unknown;message?:{conversation?:string|null;extendedTextMessage?:{text?:string|null}|null}|null};
export function incomingPilotText(message:PilotMessage,startedAt:number){
 if(message.key.fromMe||!message.key.id)return null;
 const jid=message.key.remoteJid||'';
 const phone=canonicalSender(jid,message.key.senderPn||message.key.remoteJidAlt);
 const timestamp=Number(message.messageTimestamp);
 if(!phone||!Number.isFinite(timestamp)||timestamp*1000<startedAt-2000||timestamp*1000>Date.now()+60000)return null;
 const text=(message.message?.conversation||message.message?.extendedTextMessage?.text||'').trim();
 if(!text||text.length>500)return null;
 return {phone,jid,text,messageId:createHash('sha256').update(`${jid}:${message.key.id}`).digest('hex')};
}
// A compare-and-set lease prevents two serverless instances pairing the same number.
// This collection is accessible only through the existing platform-admin rule.
export function pilotLease(options:{base:string;token:string;phone:string;fetcher?:typeof fetch;now?:()=>number}){
 const request=options.fetcher||fetch,now=options.now||Date.now;
 const documentPath=`whatsapp_pilot_locks/${createHash('sha256').update(options.phone).digest('hex')}`;
 const path=`${options.base}/${documentPath}`;
 let updateTime='';const owner=randomUUID();
 const headers={Authorization:`Bearer ${options.token}`,'Content-Type':'application/json'};
 return {
  owner,
  async acquire(){
   const got=await request(path,{headers,signal:AbortSignal.timeout(15000)});
   if(!got.ok&&got.status!==404)throw new AgentError('No se pudo comprobar la sesión en Firestore.',503);
   const previous=got.ok?await got.json():null;
   if(previous&&Number(decodeFields(previous.fields).expiresAt)>now())throw new AgentError('Ya hay una prueba activa con este número. Deténgala o espere cinco minutos.',409);
   const saved=await writeCheckpoint({base:options.base,path:documentPath,headers,request,revision:previous?.updateTime||'',fields:encodeFields({owner,expiresAt:now()+300000})});
   if(!saved.ok||!saved.updateTime)throw new AgentError('Otra sesión inició primero o Firestore rechazó el bloqueo. No se abrió WhatsApp.',409);
   updateTime=saved.updateTime;
  },
  async release(){
   if(!updateTime)return;
   // A stale invocation cannot release a newer owner's lease.
   await writeCheckpoint({base:options.base,path:documentPath,headers,request,revision:updateTime,fields:encodeFields({owner,expiresAt:0}),timeout:5000});
  }
 };
}
export function pilotIntake(options:{projectId:string;databaseId:string;token:string;uid:string;config:PilotConfig;runId:string;origin?:string;fetcher?:typeof fetch;checkActive:()=>Promise<void>;conversations?:Record<string,string>;saveCursor?:()=>Promise<void>}){
 const {config}=options;const conversations=options.conversations||{},counts=new Map<string,number>();let total=0;
 return async(phone:string,messageId:string,text:string)=>{
  if((counts.get(phone)||0)>=30||total>=100)throw new AgentError('Se alcanzó el límite de mensajes de esta prueba.');
  counts.set(phone,(counts.get(phone)||0)+1);total++;
  await options.checkActive();
  const initial=createHash('sha256').update(`${options.runId}:${phone}`).digest('hex');
  let conversationId=conversations[phone]||initial;
  const backend=createAgentBackend({...options,tenantId:config.tenantId,leaderIds:[config.leaderId],eventIds:[config.eventId],requestNotes:`PRUEBA WHATSAPP · Remitente +${phone}. Registro recibido durante una sesión autorizada por ${options.uid}. Pendiente de revisión; no ejecutar como operación real.`});
  const turn={conversationId,messageId,revision:0,action:'resume' as const};
  let current=await backend.turn(turn);
  if(['submitted','cancelled'].includes(current.conversation.status)){
   if(text.trim().toLowerCase()!=='nueva solicitud')return {reply:current.conversation.requestId?`Solicitud ya guardada. Radicado: ${current.conversation.requestId}. Escriba «nueva solicitud» para registrar otra.`:'Borrador cancelado. Escriba «nueva solicitud».',requestId:''};
   conversationId=createHash('sha256').update(`${initial}:${messageId}`).digest('hex');conversations[phone]=conversationId;
   await options.saveCursor?.();
   current=await backend.turn({...turn,conversationId});
   text='hola';
  }
  if(!current.conversation.revision){
   const patch:AgentDraft={leaderId:config.leaderId,eventId:config.eventId,municipality:config.municipality,unitCost:0,direction:'Ida'};
   current=await backend.turn({...turn,conversationId,messageId:`init-${messageId}`,action:'edit',patch});
  }
  const result=await backend.turn({...turn,conversationId,revision:current.conversation.revision,action:text.toLowerCase()==='cancelar'?'cancel':'message',text});
  return {reply:result.reply+(result.conversation.requestId?`\nRadicado: ${result.conversation.requestId}\nEscriba «nueva solicitud» para iniciar otra.`:'\nPrueba de Astrea: sin asignación ni entrega automática.'),requestId:result.conversation.requestId};
 };
}
