import {Buffer} from 'node:buffer';
import {createHash,createHmac,timingSafeEqual} from 'node:crypto';
import {AgentError} from '../lib/requestAgent.js';
import {googleFederatedFirestoreToken,readGoogleFederationEnvironment,type GoogleFederationEnvironment} from './googleFederation.js';
import {createWhatsappDiagnostics} from './whatsappDiagnostics.js';
import {pilotIntake,pilotLease,type PilotConfig} from './whatsappPilotCore.js';
import {decodeFields,encodeFields} from './requestAgent.js';
import {writeCheckpoint} from './firestoreCheckpoint.js';

type CloudEnvironment={
 enabled:boolean;verifyToken:string;appSecret:string;accessToken:string;phoneNumberId:string;
 graphVersion:string;conversationSecret:string;federation:GoogleFederationEnvironment;
};
export type CloudMessage={phoneNumberId:string;displayPhone:string;id:string;from:string;text:string|null};
type FirestoreValue={stringValue?:string;booleanValue?:boolean;integerValue?:string;doubleValue?:number;mapValue?:{fields:Record<string,FirestoreValue>};arrayValue?:{values?:FirestoreValue[]};nullValue?:null};
type FirestoreDocument={name:string;updateTime?:string;fields?:Record<string,FirestoreValue>};

export function readCloudEnvironment(env:Record<string,string|undefined>):CloudEnvironment{
 const required=['WHATSAPP_CLOUD_VERIFY_TOKEN','WHATSAPP_CLOUD_APP_SECRET','WHATSAPP_CLOUD_ACCESS_TOKEN','WHATSAPP_CLOUD_PHONE_NUMBER_ID','WHATSAPP_CLOUD_GRAPH_VERSION','WHATSAPP_CLOUD_CONVERSATION_SECRET'] as const;
 if(env.WHATSAPP_CLOUD_ENABLED!=='true')throw new AgentError('La conexión oficial de WhatsApp todavía no está activada.',503);
 if(required.some(name=>!env[name]?.trim()))throw new AgentError('Falta completar la configuración segura de WhatsApp oficial.',503);
 const value={verifyToken:env.WHATSAPP_CLOUD_VERIFY_TOKEN!.trim(),appSecret:env.WHATSAPP_CLOUD_APP_SECRET!.trim(),accessToken:env.WHATSAPP_CLOUD_ACCESS_TOKEN!.trim(),phoneNumberId:env.WHATSAPP_CLOUD_PHONE_NUMBER_ID!.trim(),graphVersion:env.WHATSAPP_CLOUD_GRAPH_VERSION!.trim(),conversationSecret:env.WHATSAPP_CLOUD_CONVERSATION_SECRET!.trim()};
 if(value.verifyToken.length<16||value.appSecret.length<16||value.accessToken.length<20||value.conversationSecret.length<32||!/^\d{8,40}$/.test(value.phoneNumberId)||!/^v\d+\.\d+$/.test(value.graphVersion))throw new AgentError('Revise los datos de activación de WhatsApp oficial.',503);
 return {enabled:true,...value,federation:readGoogleFederationEnvironment(env)};
}

export function validCloudSignature(rawBody:Uint8Array,signature:string|undefined,appSecret:string){
 if(!signature||!/^sha256=[a-f0-9]{64}$/i.test(signature))return false;
 const actual=createHmac('sha256',appSecret).update(rawBody).digest();
 const provided=Buffer.from(signature.slice(7),'hex');
 return provided.length===actual.length&&timingSafeEqual(actual,provided);
}

export function parseCloudMessages(value:unknown,phoneNumberId:string):CloudMessage[]{
 if(!value||typeof value!=='object'||Array.isArray(value))return [];
 const payload=value as {object?:unknown;entry?:unknown};
 if(payload.object!=='whatsapp_business_account'||!Array.isArray(payload.entry))return [];
 const messages:CloudMessage[]=[];
 for(const entry of payload.entry){
  if(!entry||typeof entry!=='object'||!Array.isArray((entry as any).changes))continue;
  for(const change of (entry as any).changes){
   const data=change?.value,metadata=data?.metadata,receiver=metadata?.phone_number_id;
   if(change?.field!=='messages'||receiver!==phoneNumberId||!Array.isArray(data?.messages))continue;
   const displayPhone=typeof metadata?.display_phone_number==='string'?metadata.display_phone_number.replace(/\D/g,''):'';
   if(!/^\d{8,15}$/.test(displayPhone))continue;
   for(const message of data.messages){
    const id=typeof message?.id==='string'?message.id:'',from=typeof message?.from==='string'?message.from:'';
    if(!id||!/^\d{8,15}$/.test(from))continue;
    const text=message?.type==='text'&&typeof message?.text?.body==='string'?message.text.body:'';
    messages.push({phoneNumberId,displayPhone,id,from,text:text||null});
   }
  }
 }
 return messages;
}

function privateConversationMap(source:Record<string,string>,secret:string){
 const values:Record<string,string>={...source};
 const keyFor=(phone:string)=>cloudConversationKey(phone,secret);
 for(const key of Object.keys(values))if(/^\d{8,15}$/.test(key)){values[keyFor(key)]=values[key];delete values[key];}
 return new Proxy(values,{
  get(target,key,receiver){return Reflect.get(target,typeof key==='string'&&/^\d{8,15}$/.test(key)?keyFor(key):key,receiver);},
  set(target,key,value,receiver){return Reflect.set(target,typeof key==='string'&&/^\d{8,15}$/.test(key)?keyFor(key):key,value,receiver);}
 });
}

const safeId=(value:string)=>/^[\w-]{1,120}$/.test(value);
export function cloudConversationKey(phone:string,secret:string){return createHmac('sha256',secret).update(phone).digest('hex');}
const documentPath=(response:FirestoreDocument|null)=>response?.name?.split('/documents/')[1]||'';
async function getDocument(base:string,path:string,headers:Record<string,string>,request:typeof fetch){
 const result=await request(base+'/'+path,{headers,signal:AbortSignal.timeout(12000)});
 if(result.status===404)return null;
 if(!result.ok)throw new AgentError('No se pudo comprobar la configuración de recepción en Firestore.',503);
 return await result.json() as FirestoreDocument;
}
async function queryWhatsappConfig(base:string,phone:string,headers:Record<string,string>,request:typeof fetch){
 const result=await request(base+':runQuery',{method:'POST',headers,body:JSON.stringify({structuredQuery:{from:[{collectionId:'whatsapp_config',allDescendants:true}],where:{fieldFilter:{field:{fieldPath:'phone'},op:'EQUAL',value:{stringValue:phone}}},limit:5}}),signal:AbortSignal.timeout(12000)});
 if(!result.ok)throw new AgentError('No se pudo localizar la configuración de recepción en Firestore.',503);
 const rows=await result.json() as Array<{document?:FirestoreDocument}>;
 const matches=(rows||[]).filter(row=>row.document).map(row=>({document:row.document!,path:documentPath(row.document!)})).filter(row=>row.path.startsWith('usuarios/')&&row.path.includes('/whatsapp_config/'));
 if(matches.length!==1)throw new AgentError(matches.length?'Hay más de una configuración para este número. Revise WhatsApp en Astrea.':'Guarde primero la configuración de WhatsApp en Astrea.',503);
 const match=matches[0],parts=match.path.split('/');
 if(parts.length!==4||parts[0]!=='usuarios'||parts[2]!=='whatsapp_config'||!safeId(parts[1])||!safeId(parts[3]))throw new AgentError('La configuración de recepción no es válida.',503);
 const config=decodeFields(match.document.fields||{}) as Record<string,any>,uid=parts[1],tenantId=parts[3];
 if(config.ownerUid!==uid||config.tenantId!==tenantId||config.phone!==phone||!safeId(String(config.leaderId||''))||!safeId(String(config.eventId||''))||typeof config.municipality!=='string'||!config.municipality.trim())throw new AgentError('La configuración de recepción no corresponde a este número.',403);
 return {uid,tenantId,config,configPath:match.path};
}
async function verifyScope(base:string,uid:string,tenantId:string,config:Record<string,any>,token:string,request:typeof fetch){
 const headers={Authorization:'Bearer '+token};
 const paths=['usuarios/'+uid,'organizaciones/'+tenantId,'lideres/'+config.leaderId,'jornadas_operativas/'+config.eventId];
 const docs=await Promise.all(paths.map(path=>getDocument(base,path,headers,request)));
 const [user,tenant,leader,event]=docs.map(doc=>doc?decodeFields(doc.fields||{}):null);
 if(user?.uid!==uid||user?.role!=='AdminGlobal'||user?.active===false||tenant?.tenantId!==tenantId||tenant.active!==true||leader?.tenantId!==tenantId||event?.tenantId!==tenantId||!['Planificado','En curso'].includes(String(event?.status)))throw new AgentError('La cuenta, organización, responsable o jornada de WhatsApp ya no está activa.',403);
}
async function sendCloudText(options:{config:CloudEnvironment;to:string;text:string;request:typeof fetch}){
 const response=await options.request('https://graph.facebook.com/'+options.config.graphVersion+'/'+options.config.phoneNumberId+'/messages',{method:'POST',headers:{Authorization:'Bearer '+options.config.accessToken,'Content-Type':'application/json'},body:JSON.stringify({messaging_product:'whatsapp',recipient_type:'individual',to:options.to,type:'text',text:{preview_url:false,body:options.text.slice(0,4096)}}),signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw new AgentError('Meta no confirmó la respuesta de WhatsApp. El mensaje se volverá a intentar.',503);
}

export async function processCloudMessages(options:{projectId:string;databaseId:string;cloud:CloudEnvironment;messages:CloudMessage[];fetcher?:typeof fetch;vercelOidcToken?:string;bearerToken?:string}){
 const request=options.fetcher||fetch,token=options.bearerToken||await googleFederatedFirestoreToken({environment:options.cloud.federation,projectId:options.projectId,vercelOidcToken:options.vercelOidcToken||''});
 const base='https://firestore.googleapis.com/v1/projects/'+options.projectId+'/databases/'+encodeURIComponent(options.databaseId)+'/documents';
 const headers={Authorization:'Bearer '+token,'Content-Type':'application/json'};
 const displayPhone=options.messages.find(message=>message.phoneNumberId===options.cloud.phoneNumberId)?.displayPhone||'';
 const located=await queryWhatsappConfig(base,displayPhone,headers,request),config:Record<string,any>=located.config;
 if(config.phone!==displayPhone)throw new AgentError('El número vinculado en Astrea no coincide con el receptor de Meta.',403);
 const pilotConfig:PilotConfig={phone:config.phone,tenantId:located.tenantId,leaderId:config.leaderId,eventId:config.eventId,municipality:config.municipality};
 const lease=pilotLease({base,token,phone:pilotConfig.phone,fetcher:request});await lease.acquire();
 const sessionPath='usuarios/'+located.uid+'/whatsapp_cloud_sessions/'+located.tenantId;
 const receiptPath=(messageIdHash:string)=>sessionPath+'/handled/'+messageIdHash;
 let sessionDocument=await getDocument(base,sessionPath,headers,request),revision=sessionDocument?.updateTime||'';
 let conversations:Record<string,string>={};
 if(sessionDocument){
  const saved=decodeFields(sessionDocument.fields||{}) as Record<string,any>;
  if(saved.ownerUid!==located.uid||saved.tenantId!==located.tenantId||saved.phoneNumberId!==options.cloud.phoneNumberId||!saved.conversations||typeof saved.conversations!=='object'||Array.isArray(saved.conversations))throw new AgentError('La sesión oficial de WhatsApp no corresponde a esta organización.',403);
  conversations=saved.conversations as Record<string,string>;
 }
 conversations=privateConversationMap(conversations,options.cloud.conversationSecret);
 const saveState=async()=>{
  const saved=await writeCheckpoint({base,path:sessionPath,headers,request,revision,fields:encodeFields({ownerUid:located.uid,tenantId:located.tenantId,phoneNumberId:options.cloud.phoneNumberId,conversations:{...conversations},updatedAt:new Date().toISOString()})});
  if(!saved.ok||!saved.updateTime)throw new AgentError('No se pudo guardar el estado de recepción en Firestore.',503);
  revision=saved.updateTime;
 };
 const checkActive=()=>verifyScope(base,located.uid,located.tenantId,config,token,request);
 const intake=pilotIntake({projectId:options.projectId,databaseId:options.databaseId,token,uid:located.uid,config:pilotConfig,runId:'cloud-'+options.cloud.phoneNumberId,checkActive,conversations,saveCursor:saveState});
 const diagnostics=createWhatsappDiagnostics({base,token,uid:located.uid,config:pilotConfig,session:{id:'cloud-'+options.cloud.phoneNumberId},fetcher:request});
 const wasSent=async(messageIdHash:string)=>{
  const receipt=await getDocument(base,receiptPath(messageIdHash),headers,request);
  return !!receipt&&decodeFields(receipt.fields||{}).status==='sent';
 };
 const markSent=async(messageIdHash:string)=>{
  const path=receiptPath(messageIdHash),existing=await getDocument(base,path,headers,request);
  const saved=await writeCheckpoint({base,path,headers,request,revision:existing?.updateTime||'',fields:encodeFields({ownerUid:located.uid,tenantId:located.tenantId,messageIdHash,status:'sent',sentAt:new Date().toISOString()})});
  if(!saved.ok||!saved.updateTime)throw new AgentError('No se pudo guardar el recibo del mensaje en Firestore.',503);
 };
 let processed=0;
 try{
  await checkActive();
  for(const message of options.messages){
   if(message.phoneNumberId!==options.cloud.phoneNumberId||message.displayPhone!==displayPhone)continue;
   const messageIdHash=createHash('sha256').update(message.id).digest('hex');
   if(await wasSent(messageIdHash))continue;
   let reply:string;
   if(!message.text)reply='Por ahora atiendo mensajes de texto. Envíe una frase, por ejemplo «Necesito 3 almuerzos» o «Transporte para 8 personas». No he registrado el archivo como una solicitud.';
   else if(message.text.length>1500)reply='El mensaje supera 1500 caracteres. Envíe una versión más corta o divídalo en mensajes.';
   else{
    const messageId=createHash('sha256').update(message.id).digest('hex');
    const result=await intake(message.from,messageId,message.text,message.from);
    reply=result.reply;
    if(result.requestId)await diagnostics.record('saved',{detail:'Solicitud confirmada y guardada en Firestore.',requestId:result.requestId}).catch(()=>{});
   }
   await sendCloudText({config:options.cloud,to:message.from,text:reply,request});
   await markSent(messageIdHash);
   await diagnostics.record('replied',{detail:'Respuesta enviada mediante WhatsApp Business Platform.',reply,senderHint:message.from.slice(-4)}).catch(()=>{});
   processed++;
  }
  await saveState();
  return {processed};
 }finally{
  await lease.release().catch(()=>{});
 }
}
