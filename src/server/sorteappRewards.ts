import {Buffer} from 'node:buffer';
import {createHash,createHmac,timingSafeEqual} from 'node:crypto';
import {AgentError} from '../lib/requestAgent.js';
import {googleFederatedFirestoreToken,readGoogleFederationEnvironment,type GoogleFederationEnvironment} from './googleFederation.js';
import {decodeFields,encodeFields} from './requestAgent.js';

type IntegrationEnvironment={enabled:true;secret:string;federation:GoogleFederationEnvironment;tenantIds:Set<string>};
type EntryCreatedEvent={schemaVersion:1;eventId:string;eventType:'draw.entry.created';occurredAt:string;draw:{id:string;tenantId:string;title:string;prize:string;kind:'employee_wellbeing_free';paid:false;entryPrice:0;currency:'COP';startsAt?:string;endsAt?:string};entry:{id:string;name:string;email?:string;phone?:string;registeredAt:string};consent:{accepted:true;purpose:'employee_reward_draw';policyVersion:string;acceptedAt:string}};
type EntryDeletedEvent={schemaVersion:1;eventId:string;eventType:'draw.entry.deleted';occurredAt:string;draw:{id:string;tenantId:string};entry:{id:string}};
export type SorteappRewardsEvent=EntryCreatedEvent|EntryDeletedEvent;
type FirestoreValue={stringValue?:string;booleanValue?:boolean;integerValue?:string;doubleValue?:number;mapValue?:{fields:Record<string,FirestoreValue>};arrayValue?:{values?:FirestoreValue[]};nullValue?:null};
type FirestoreDocument={name:string;updateTime?:string;fields?:Record<string,FirestoreValue>};
const idPattern=/^[A-Za-z0-9_-]{1,120}$/;
const emailPattern=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const allowedRoot=['schemaVersion','eventId','eventType','occurredAt','draw','entry','consent'];
export function readSorteappRewardsEnvironment(env:Record<string,string|undefined>):IntegrationEnvironment{
 if(env.SORTEAPP_REWARDS_ENABLED!=='true')throw new AgentError('La recepción de Sorteapp todavía no está activada.',503);
 const secret=env.SORTEAPP_WEBHOOK_SECRET?.trim()||'';
 const tenantIds=new Set((env.SORTEAPP_REWARDS_TENANT_IDS||'').split(',').map(value=>value.trim()).filter(Boolean));
 if(secret.length<32||!tenantIds.size||[...tenantIds].some(value=>!idPattern.test(value)))throw new AgentError('Falta completar la configuración segura de Sorteapp.',503);
 return {enabled:true,secret,federation:readGoogleFederationEnvironment(env),tenantIds};
}

export function validSorteappSignature(rawBody:Uint8Array,signature:string|undefined,secret:string){
 if(!signature||!/^sha256=[a-f0-9]{64}$/i.test(signature))return false;
 const expected=createHmac('sha256',secret).update(rawBody).digest(),provided=Buffer.from(signature.slice(7),'hex');
 return provided.length===expected.length&&timingSafeEqual(expected,provided);
}

function record(value:unknown):value is Record<string,unknown>{return !!value&&typeof value==='object'&&!Array.isArray(value);}
function exactKeys(value:Record<string,unknown>,allowed:string[]){return Object.keys(value).every(key=>allowed.includes(key));}
function text(value:unknown,label:string,max=180){
 if(typeof value!=='string')throw new AgentError(`El campo ${label} no es válido.`,422);
 const normalized=value.trim().replace(/[\u0000-\u001f\u007f]/g,' ');
 if(!normalized||normalized.length>max)throw new AgentError(`El campo ${label} no es válido.`,422);
 return normalized;
}
function iso(value:unknown,label:string){
 if(typeof value!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,9})?(?:Z|[+-]\d\d:\d\d)$/.test(value)||!Number.isFinite(Date.parse(value)))throw new AgentError(`La fecha ${label} no es válida.`,422);
 return new Date(value).toISOString();
}
function id(value:unknown,label:string){const result=text(value,label,120);if(!idPattern.test(result))throw new AgentError(`El identificador ${label} no es válido.`,422);return result;}
function plainObject(value:unknown,label:string):Record<string,unknown>{if(!record(value))throw new AgentError(`El bloque ${label} no es válido.`,422);return value;}

export function parseSorteappRewardsEvent(value:unknown):SorteappRewardsEvent{
 const root=plainObject(value,'principal');
 if(!exactKeys(root,allowedRoot)||root.schemaVersion!==1)throw new AgentError('La versión o los campos del aviso de Sorteapp no son compatibles.',422);
 const eventId=id(root.eventId,'eventId'),eventType=root.eventType,occurredAt=iso(root.occurredAt,'occurredAt');
 if(eventType!=='draw.entry.created'&&eventType!=='draw.entry.deleted')throw new AgentError('Sorteapp envió un tipo de evento no permitido.',422);
 const draw=plainObject(root.draw,'draw'),entry=plainObject(root.entry,'entry');
 if(eventType==='draw.entry.deleted'){
  if(root.consent!==undefined||!exactKeys(draw,['id','tenantId'])||!exactKeys(entry,['id']))throw new AgentError('El aviso de retiro contiene campos no permitidos.',422);
  return {schemaVersion:1,eventId,eventType,occurredAt,draw:{id:id(draw.id,'draw.id'),tenantId:id(draw.tenantId,'tenantId')},entry:{id:id(entry.id,'entry.id')}};
 }
 if(!exactKeys(draw,['id','tenantId','title','prize','kind','paid','entryPrice','currency','startsAt','endsAt'])||!exactKeys(entry,['id','name','email','phone','registeredAt']))throw new AgentError('El aviso de inscripción contiene campos no permitidos.',422);
 if(draw.kind!=='employee_wellbeing_free'||draw.paid!==false||draw.entryPrice!==0||draw.currency!=='COP')throw new AgentError('Solo se reciben sorteos internos gratuitos, sin pago ni compra de boletas.',422);
 const consent=plainObject(root.consent,'consent');
 if(!exactKeys(consent,['accepted','purpose','policyVersion','acceptedAt'])||consent.accepted!==true||consent.purpose!=='employee_reward_draw')throw new AgentError('La inscripción no acredita el consentimiento específico para el sorteo gratuito.',422);
 const registeredAt=iso(entry.registeredAt,'registeredAt'),acceptedAt=iso(consent.acceptedAt,'consent.acceptedAt');
 if(Date.parse(acceptedAt)>Date.parse(registeredAt)||Date.parse(registeredAt)>Date.now()+300000)throw new AgentError('El consentimiento debe haberse otorgado antes de la inscripción.',422);
 const result:EntryCreatedEvent={schemaVersion:1,eventId,eventType,occurredAt,draw:{id:id(draw.id,'draw.id'),tenantId:id(draw.tenantId,'tenantId'),title:text(draw.title,'draw.title'),prize:text(draw.prize,'draw.prize'),kind:'employee_wellbeing_free',paid:false,entryPrice:0,currency:'COP',...(draw.startsAt===undefined?{}:{startsAt:iso(draw.startsAt,'draw.startsAt')}),...(draw.endsAt===undefined?{}:{endsAt:iso(draw.endsAt,'draw.endsAt')})},entry:{id:id(entry.id,'entry.id'),name:text(entry.name,'entry.name',150),registeredAt},consent:{accepted:true,purpose:'employee_reward_draw',policyVersion:text(consent.policyVersion,'consent.policyVersion',80),acceptedAt}};
 if(result.draw.startsAt&&result.draw.endsAt&&Date.parse(result.draw.startsAt)>=Date.parse(result.draw.endsAt))throw new AgentError('El período del sorteo no es válido.',422);
 if(entry.email!==undefined){const email=text(entry.email,'entry.email',254).toLowerCase();if(!emailPattern.test(email))throw new AgentError('El correo de la inscripción no es válido.',422);result.entry.email=email;}
 if(entry.phone!==undefined){const phone=String(entry.phone).replace(/[^\d]/g,'');if(!/^\d{8,15}$/.test(phone))throw new AgentError('El teléfono de la inscripción no es válido.',422);result.entry.phone=phone;}
 if(!result.entry.email&&!result.entry.phone)throw new AgentError('La inscripción debe incluir un medio de contacto.',422);
 return result;
}

const hashId=(value:string)=>createHash('sha256').update(value).digest('hex');
const firestoreName=(base:string,path:string)=>`${new URL(base).pathname.replace(/^\/v1\//,'').replace(/^\//,'')}/${path}`;
async function getDocument(base:string,path:string,headers:Record<string,string>,request:typeof fetch){
 const response=await request(`${base}/${path}`,{headers,signal:AbortSignal.timeout(12000)});
 if(response.status===404)return null;if(!response.ok)throw new AgentError('Firestore no pudo comprobar el estado de la inscripción.',503);
 return await response.json() as FirestoreDocument;
}
async function commit(base:string,writes:unknown[],headers:Record<string,string>,request:typeof fetch){
 const response=await request(`${base}:commit`,{method:'POST',headers,body:JSON.stringify({writes}),signal:AbortSignal.timeout(12000)});
 if(response.ok)return true;
 const data=await response.json().catch(()=>null);
 if(response.status===409||response.status===412||data?.error?.status==='ABORTED'||data?.error?.status==='FAILED_PRECONDITION'||data?.error?.status==='ALREADY_EXISTS')return false;
 throw new AgentError('Firestore no confirmó el registro de Sorteapp. Se puede reintentar el mismo aviso.',503);
}
const mapDocument=(base:string,path:string,fields:Record<string,unknown>,revision?:string)=>({update:{name:firestoreName(base,path),fields:encodeFields(fields)},currentDocument:revision?{updateTime:revision}:{exists:false}});
function validateDrawScope(draw:Record<string,any>,tenantId:string,drawId:string){
 if(draw.id!==drawId||draw.sourceDrawHash!==drawId||draw.tenantId!==tenantId||draw.source!=='sorteapp'||draw.kind!=='employee_wellbeing_free'||draw.paid!==false||draw.entryPrice!==0)throw new AgentError('El sorteo existente no corresponde a un sorteo interno gratuito de esta organización.',409);
}
async function createReceipt(base:string,path:string,fields:Record<string,unknown>,headers:Record<string,string>,request:typeof fetch){
 const saved=await commit(base,[mapDocument(base,path,fields)],headers,request);
 if(!saved&&!await getDocument(base,path,headers,request))throw new AgentError('No se pudo conservar el recibo del aviso de Sorteapp.',503);
}

export async function processSorteappRewardsEvent(options:{projectId:string;databaseId:string;environment:IntegrationEnvironment;event:SorteappRewardsEvent;fetcher?:typeof fetch;bearerToken?:string;vercelOidcToken?:string}){
 if(!options.environment.tenantIds.has(options.event.draw.tenantId))throw new AgentError('La organización destino no está habilitada para Sorteapp.',403);
 const request=options.fetcher||fetch,token=options.bearerToken||await googleFederatedFirestoreToken({environment:options.environment.federation,projectId:options.projectId,vercelOidcToken:options.vercelOidcToken||''});
 const base=`https://firestore.googleapis.com/v1/projects/${options.projectId}/databases/${encodeURIComponent(options.databaseId)}/documents`,headers={Authorization:`Bearer ${token}`,'Content-Type':'application/json'};
 const event=options.event,eventKey=hashId(event.eventId),receiptPath=`integraciones_sorteapp_eventos/${eventKey}`;
 if(await getDocument(base,receiptPath,headers,request))return {accepted:true,duplicate:true};
 const organization=await getDocument(base,`organizaciones/${event.draw.tenantId}`,headers,request);
 const organizationData=organization?decodeFields(organization.fields||{}):null;
 if(organizationData?.tenantId!==event.draw.tenantId||(event.eventType==='draw.entry.created'&&organizationData.active!==true))throw new AgentError('La organización destino no está activa en Astrea.',403);
 const drawKey=hashId(event.draw.id),drawPath=`sorteos_bienestar/${drawKey}`,entryKey=hashId(event.draw.id+':'+event.entry.id),entryPath=`${drawPath}/participantes/${entryKey}`;
 const receiptFields=(outcome:'created'|'duplicate_entry'|'deleted'|'already_deleted')=>({id:eventKey,source:'sorteapp',eventType:event.eventType,tenantId:event.draw.tenantId,drawId:drawKey,entryKey,outcome,receivedAt:new Date().toISOString()});
 if(event.eventType==='draw.entry.deleted'){
  const drawDocument=await getDocument(base,drawPath,headers,request);
  if(!drawDocument)throw new AgentError('No se encontró el sorteo de bienestar que envió Sorteapp.',404);
  const drawData=decodeFields(drawDocument.fields||{});validateDrawScope(drawData,event.draw.tenantId,drawKey);
  for(let attempt=0;attempt<4;attempt++){
   if(await getDocument(base,receiptPath,headers,request))return {accepted:true,duplicate:true};
   const entryDocument=await getDocument(base,entryPath,headers,request);
   if(entryDocument){const existing=decodeFields(entryDocument.fields||{});if(existing.tenantId!==event.draw.tenantId||existing.source!=='sorteapp'||existing.drawId!==drawKey)throw new AgentError('La inscripción no pertenece a Sorteapp.',409);}
   const tombstone={id:entryKey,tenantId:event.draw.tenantId,drawId:drawKey,source:'sorteapp',kind:'employee_wellbeing_free',status:'withdrawn',withdrawnAt:event.occurredAt};
   const writes=[mapDocument(base,entryPath,tombstone,entryDocument?.updateTime),mapDocument(base,receiptPath,receiptFields(entryDocument?'deleted':'already_deleted'))];
   if(await commit(base,writes,headers,request))return {accepted:true,duplicate:false,deleted:true};
  }
  if(await getDocument(base,receiptPath,headers,request))return {accepted:true,duplicate:true};
  throw new AgentError('Sorteapp debe reintentar el retiro de esta inscripción.',503);
 }
 const drawEvent=event as EntryCreatedEvent;
 if(drawEvent.draw.startsAt&&Date.parse(drawEvent.entry.registeredAt)<Date.parse(drawEvent.draw.startsAt)||drawEvent.draw.endsAt&&Date.parse(drawEvent.entry.registeredAt)>Date.parse(drawEvent.draw.endsAt))throw new AgentError('La inscripción está fuera del período del sorteo.',422);
 const entryData={id:entryKey,tenantId:drawEvent.draw.tenantId,drawId:drawKey,source:'sorteapp',kind:'employee_wellbeing_free',paid:false,entryPrice:0,currency:'COP',participant:{name:drawEvent.entry.name,...(drawEvent.entry.email?{email:drawEvent.entry.email}:{}),...(drawEvent.entry.phone?{phone:drawEvent.entry.phone}:{})},consent:{accepted:true,purpose:drawEvent.consent.purpose,policyVersion:drawEvent.consent.policyVersion,acceptedAt:drawEvent.consent.acceptedAt},registeredAt:drawEvent.entry.registeredAt,receivedAt:new Date().toISOString()};
 const now=new Date().toISOString(),drawData={id:drawKey,tenantId:drawEvent.draw.tenantId,source:'sorteapp',sourceDrawHash:drawKey,name:drawEvent.draw.title,prize:drawEvent.draw.prize,kind:'employee_wellbeing_free',paid:false,entryPrice:0,currency:'COP',...(drawEvent.draw.startsAt?{startsAt:drawEvent.draw.startsAt}:{}),...(drawEvent.draw.endsAt?{endsAt:drawEvent.draw.endsAt}:{}),createdAt:now,updatedAt:now};
 for(let attempt=0;attempt<4;attempt++){
  const [existingDraw,existingEntry,existingReceipt]=await Promise.all([getDocument(base,drawPath,headers,request),getDocument(base,entryPath,headers,request),getDocument(base,receiptPath,headers,request)]);
  if(existingReceipt)return {accepted:true,duplicate:true};
  if(existingEntry){
   const savedEntry=decodeFields(existingEntry.fields||{});if(savedEntry.tenantId!==drawEvent.draw.tenantId||savedEntry.source!=='sorteapp'||savedEntry.drawId!==drawKey)throw new AgentError('El identificador de inscripción ya está asociado a otro registro.',409);
   await createReceipt(base,receiptPath,receiptFields('duplicate_entry'),headers,request);return {accepted:true,duplicate:true};
  }
  if(existingDraw)validateDrawScope(decodeFields(existingDraw.fields||{}),drawEvent.draw.tenantId,drawKey);
  const mergedDraw={...drawData,createdAt:existingDraw?decodeFields(existingDraw.fields||{}).createdAt||now:now,updatedAt:new Date().toISOString()};
  const writes=[mapDocument(base,drawPath,mergedDraw,existingDraw?.updateTime),mapDocument(base,entryPath,entryData),mapDocument(base,receiptPath,receiptFields('created'))];
  if(await commit(base,writes,headers,request))return {accepted:true,duplicate:false};
 }
 const receipt=await getDocument(base,receiptPath,headers,request);if(receipt)return {accepted:true,duplicate:true};
 const entry=await getDocument(base,entryPath,headers,request);if(entry){const saved=decodeFields(entry.fields||{});if(saved.tenantId===drawEvent.draw.tenantId&&saved.drawId===drawKey&&saved.source==='sorteapp'){await createReceipt(base,receiptPath,receiptFields('duplicate_entry'),headers,request);return {accepted:true,duplicate:true};}}
 throw new AgentError('No se pudo guardar la inscripción de forma segura. Sorteapp debe reintentar el mismo aviso.',503);
}
