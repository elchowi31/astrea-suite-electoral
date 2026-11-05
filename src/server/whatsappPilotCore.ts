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
 for(const k of ['tenantId','leaderId','eventId'] as const)if(!/^[\w-]{1,120}$/.test(result[k]))throw new AgentError('Seleccione organización, responsable y jornada de recepción.');
 if(!result.municipality||result.municipality.length>120)throw new AgentError('Revise el municipio de recepción.');
 return result;
}
export type PilotContent={conversation?:string|null;extendedTextMessage?:{text?:string|null}|null;ephemeralMessage?:{message?:PilotContent|null}|null};
export type PilotMessage={key:{id?:string|null;fromMe?:boolean|null;remoteJid?:string|null;remoteJidAlt?:string|null;senderPn?:string|null};messageTimestamp?:unknown;message?:PilotContent|null};
export type IncomingReason='own_or_missing_id'|'not_private'|'before_session'|'invalid_timestamp'|'unsupported_content'|'unresolved_sender';
export function inspectPilotText(message:PilotMessage,startedAt:number,strictCutoff=false,allowPrivateId=false){
 if(message.key.fromMe||!message.key.id)return {incoming:null,reason:'own_or_missing_id' as IncomingReason};
 const jid=message.key.remoteJid||'';
 if(!jid.endsWith('@s.whatsapp.net')&&!jid.endsWith('@lid'))return {incoming:null,reason:'not_private' as IncomingReason};
 const timestamp=Number(message.messageTimestamp),cutoff=strictCutoff?Math.ceil(startedAt/1000)*1000:startedAt-2000;
 if(!Number.isFinite(timestamp)||timestamp*1000>Date.now()+60000)return {incoming:null,reason:'invalid_timestamp' as IncomingReason};
 if(timestamp*1000<cutoff)return {incoming:null,reason:'before_session' as IncomingReason};
 let content=message.message;for(let i=0;i<5&&content?.ephemeralMessage;i++)content=content.ephemeralMessage.message;
 const text=(content?.conversation||content?.extendedTextMessage?.text||'').trim();
 if(!text||text.length>500)return {incoming:null,reason:'unsupported_content' as IncomingReason};
 const phone=canonicalSender(jid,message.key.senderPn)||canonicalSender(jid,message.key.remoteJidAlt)||'';
 const lid=/^(\d{1,30})(?::\d{1,5})?@lid$/.exec(jid);
 if(!phone&&(!allowPrivateId||!lid))return {incoming:null,reason:'unresolved_sender' as IncomingReason};
 // The channel identity is not a phone number and never grants an Astrea role.
 const senderKey=lid?`lid:${createHash('sha256').update(`${lid[1]}@lid`).digest('hex')}`:phone;
 return {incoming:{phone,senderKey,jid,text,messageId:createHash('sha256').update(`${jid}:${message.key.id}`).digest('hex')},reason:null};
}
export function incomingPilotText(message:PilotMessage,startedAt:number,strictCutoff=false){
 return inspectPilotText(message,startedAt,strictCutoff).incoming;
}
/** A private authenticated LID is sufficient to reply to its conversation.
 * The optional mapping enriches the sender, but must never block reception or
 * reinterpret LID digits, display names or text as a verified phone number. */
export async function resolvePilotText(message:PilotMessage,startedAt:number,lookup?:(jid:string)=>Promise<string|null|undefined>){
 const inspected=inspectPilotText(message,startedAt,true,true);
 if(!inspected.incoming||inspected.incoming.phone||!lookup)return inspected;
 try{
  const pn=await lookup(message.key.remoteJid!);
  if(pn&&canonicalSender(message.key.remoteJid!,pn))return inspectPilotText({...message,key:{...message.key,remoteJidAlt:pn}},startedAt,true,true);
 }catch{/* The authenticated chat remains replyable without a phone mapping. */}
 return inspected;
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
   if(previous&&Number(decodeFields(previous.fields).expiresAt)>now())throw new AgentError('Ya hay una recepción activa con este número. Deténgala o espere cinco minutos.',409);
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
 const {config}=options;const conversations=options.conversations||{};
 return async(senderKey:string,messageId:string,text:string,verifiedPhone?:string)=>{
  await options.checkActive();
  if(!/^\d{8,15}$/.test(senderKey)&&!/^lid:[a-f0-9]{64}$/.test(senderKey))throw new AgentError('Identificador de conversación no válido.');
  const phone=/^\d{8,15}$/.test(verifiedPhone||'')?verifiedPhone!:/^\d{8,15}$/.test(senderKey)?senderKey:'';
  const initial=createHash('sha256').update(`${options.runId}:${senderKey}`).digest('hex');
  // Keep an existing LID draft when the mapping arrives, and recover legacy
  // phone-keyed drafts when first seeing an authenticated LID/PN association.
  let conversationId=conversations[senderKey]||(phone?conversations[phone]:'')||createHash('sha256').update(`${options.runId}:${phone||senderKey}`).digest('hex');
  const saveConversation=async()=>{conversations[senderKey]=conversationId;if(phone)conversations[phone]=conversationId;await options.saveCursor?.();};
  if(conversations[senderKey]!==conversationId||(phone&&conversations[phone]!==conversationId))await saveConversation();
  const senderNote=phone?`Remitente +${phone}`:`Remitente con identificador privado de WhatsApp; teléfono no compartido. Referencia ${senderKey.slice(-12)}`;
  const backend=createAgentBackend({...options,tenantId:config.tenantId,leaderIds:[config.leaderId],eventIds:[config.eventId],requestNotes:`WHATSAPP · ${senderNote}. Registro recibido durante una sesión autorizada por ${options.uid}. Pendiente de revisión por coordinación.`});
  const turn={conversationId,messageId,revision:0,action:'resume' as const};
  let current=await backend.turn(turn);
  if(['submitted','cancelled'].includes(current.conversation.status)){
   if(text.trim().toLowerCase()!=='nueva solicitud')return {reply:current.conversation.requestId?`Solicitud ya guardada. Radicado: ${current.conversation.requestId}. Escriba «nueva solicitud» para registrar otra.`:'Borrador cancelado. Escriba «nueva solicitud».',requestId:''};
   conversationId=createHash('sha256').update(`${initial}:${messageId}`).digest('hex');
   await saveConversation();
   current=await backend.turn({...turn,conversationId});
   text='hola';
  }
  if(!current.conversation.revision){
   const patch:AgentDraft={leaderId:config.leaderId,eventId:config.eventId,municipality:config.municipality,unitCost:0,direction:'Ida'};
   current=await backend.turn({...turn,conversationId,messageId:`init-${messageId}`,action:'edit',patch});
  }
  const result=await backend.turn({...turn,conversationId,revision:current.conversation.revision,action:text.toLowerCase()==='cancelar'?'cancel':'message',text});
  return {reply:result.reply+(result.conversation.requestId?`\nRadicado: ${result.conversation.requestId}\nEscriba «nueva solicitud» para iniciar otra.`:'\nAstrea · Las entregas y asignaciones requieren aprobación de coordinación.'),requestId:result.conversation.requestId};
 };
}

