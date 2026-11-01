import { AgentError, advanceAgent, agentRequest, validateAgentTurn, question, type AgentContext, type AgentConversation, type AgentTurn } from '../lib/requestAgent.js';

type Value = {stringValue?:string;booleanValue?:boolean;integerValue?:string;doubleValue?:number;nullValue?:null;mapValue?:{fields:Record<string,Value>};arrayValue?:{values?:Value[]}};
export function encodeFields(data:Record<string,any>):Record<string,Value>{return Object.fromEntries(Object.entries(data).map(([k,v])=>[k,encode(v)]));}
function encode(v:any):Value{
  if(v===null)return {nullValue:null};
  if(typeof v==='string')return {stringValue:v};
  if(typeof v==='boolean')return {booleanValue:v};
  if(typeof v==='number'&&Number.isFinite(v))return Number.isInteger(v)?{integerValue:String(v)}:{doubleValue:v};
  if(Array.isArray(v))return {arrayValue:{values:v.map(encode)}};
  if(v&&typeof v==='object')return {mapValue:{fields:encodeFields(v)}};
  throw new AgentError('Dato no serializable.');
}
export function decodeFields(fields:Record<string,Value>={}):Record<string,any>{return Object.fromEntries(Object.entries(fields).map(([k,v])=>[k,decode(v)]));}
function decode(v:Value):any{
  if('stringValue'in v)return v.stringValue;if('booleanValue'in v)return v.booleanValue;
  if('integerValue'in v)return Number(v.integerValue);if('doubleValue'in v)return v.doubleValue;
  if(v.mapValue)return decodeFields(v.mapValue.fields);if(v.arrayValue)return (v.arrayValue.values||[]).map(decode);return null;
}
export function createAgentBackend(options:{projectId:string;databaseId:string;token:string;uid:string;tenantId:string;origin?:string;fetcher?:typeof fetch}){
  const {uid,tenantId,token}=options;const request=options.fetcher||fetch;
  const root=`projects/${options.projectId}/databases/${options.databaseId}/documents`;
  const base=`${options.origin||'https://firestore.googleapis.com'}/v1/${root}`;
  async function call(path:string,body?:unknown,method=body===undefined?'GET':'POST'){
    const res=await request(`${base}${path}`,{method,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(15000)});
    if(res.status===404)return null;
    if(!res.ok){if(res.status===409)throw new AgentError('La conversación cambió. Recargue y vuelva a intentar.',409);if(res.status===403)throw new AgentError('Sin permiso para guardar en Firestore. Revise el perfil y las reglas publicadas.',403);throw new AgentError('Firestore no confirmó la operación. Reintente el mismo mensaje.',503);}
    return res.json();
  }
  async function read(path:string,transaction?:string){
    // batchGet carries transaction bytes in JSON (also supported by the emulator).
    const d=transaction?(await call(':batchGet',{documents:[`${root}/${path}`],transaction}))?.find((row:any)=>row.found)?.found:await call(`/${path}`);
    return d?decodeFields(d.fields):undefined;
  }
  async function catalog(collectionId:string,label:string){
    const rows=await call(':runQuery',{structuredQuery:{from:[{collectionId}],where:{fieldFilter:{field:{fieldPath:'tenantId'},op:'EQUAL',value:{stringValue:tenantId}}},select:{fields:['id',label,'status','tenantId'].map(fieldPath=>({fieldPath}))},limit:500}});
    return (rows||[]).filter((r:any)=>r.document).map((r:any)=>decodeFields(r.document.fields)).filter((r:any)=>r.tenantId===tenantId&&r.id&&r[label]&&!['Cancelado','Finalizado'].includes(r.status)).map((r:any)=>({id:r.id,name:r[label]}));
  }
  async function turn(input:AgentTurn){
    validateAgentTurn(input);
    const [leaders,events]=await Promise.all([catalog('lideres','fullName'),catalog('jornadas_operativas','name')]);
    const context:AgentContext={uid,tenantId,leaders,events};
    const path=`usuarios/${uid}/agent_conversations/${input.conversationId}`;
    async function verifySubmitted(conversation:AgentConversation){
      if(conversation.status!=='submitted')return;
      if(conversation.requestId!==`agent-${uid}-${conversation.id}`)throw new AgentError('El radicado no corresponde a la conversación.',409);
      const record=await read(`solicitudes_recursos/${conversation.requestId}`);
      if(!record||record.tenantId!==tenantId||record.createdBy!==uid)throw new AgentError('No se encontró la solicitud guardada. Se requiere revisión.',409);
    }
    if(input.action==='resume'){
      const conversation=advanceAgent(await read(path) as AgentConversation|undefined,input,context);
      await verifySubmitted(conversation);
      return {conversation,context,reply:conversation.messages.at(-1)?.text||question(conversation.draft,context),verified:true};
    }
    const receiptPath=`${path}/receipts/${input.messageId}`;
    const begun=await call(':beginTransaction',{options:{readWrite:{}}});const transaction=begun.transaction;
    try{
      const previous=await read(path,transaction) as AgentConversation|undefined;
      if(previous&&(previous.ownerUid!==uid||previous.tenantId!==tenantId))throw new AgentError('Conversación de otro ámbito.',403);
      if(await read(receiptPath,transaction)){
        await call(':rollback',{transaction});
        if(!previous)throw new AgentError('Conversación no disponible.',409);
        await verifySubmitted(previous);
        return {conversation:previous,context,reply:previous.messages.at(-1)?.text||'',verified:true,duplicate:true};
      }
      const conversation=advanceAgent(previous,input,context);
      const writes:any[]=[];
      const write=(p:string,data:Record<string,any>)=>writes.push({update:{name:`${root}/${p}`,fields:encodeFields(data)}});
      if(conversation.status==='submitted'){
        const record=agentRequest(conversation);
        const leader=await read(`lideres/${record.leaderId}`,transaction);
        if(leader?.tenantId!==tenantId)throw new AgentError('El responsable ya no está disponible.');
        if(record.eventId){const event=await read(`jornadas_operativas/${record.eventId}`,transaction);if(event?.tenantId!==tenantId||['Cancelado','Finalizado'].includes(event.status))throw new AgentError('La jornada ya no está activa.');}
        write(`solicitudes_recursos/${record.id}`,record);
        writes[writes.length-1].currentDocument={exists:false};
        write(`auditoria/${record.id}`,{id:record.id,tenantId,actorId:uid,entity:'solicitudes_recursos',entityId:record.id,action:'create',metadata:{source:'request-agent',conversationId:conversation.id},createdAt:record.createdAt});
      }
      write(path,conversation);write(receiptPath,{messageId:input.messageId,revision:conversation.revision,createdAt:conversation.updatedAt,tenantId,ownerUid:uid});
      await call(':commit',{transaction,writes});
      const saved=await read(path) as AgentConversation|undefined;
      if(!saved||saved.revision<conversation.revision)throw new AgentError('No se pudo verificar el guardado. Reintente el mismo mensaje.',503);
      if(conversation.status==='submitted'){
        const savedRequest=await read(`solicitudes_recursos/${conversation.requestId}`),expected=agentRequest(conversation);
        if(!savedRequest||Object.entries(expected).some(([k,v])=>JSON.stringify(savedRequest[k])!==JSON.stringify(v)))throw new AgentError('El guardado requiere revisión. No se confirma la solicitud.',503);
      }
      return {conversation:saved,context,reply:saved.messages.at(-1)?.text||'',verified:true};
    }catch(e){try{await call(':rollback',{transaction});}catch{}throw e;}
  }
  return {turn};
}
