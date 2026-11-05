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
export function createAgentBackend(options:{projectId:string;databaseId:string;token:string;uid:string;tenantId:string;origin?:string;fetcher?:typeof fetch;requestNotes?:string;leaderIds?:string[];eventIds?:string[]}){
  const {uid,tenantId,token}=options;const request=options.fetcher||fetch;
  const root=`projects/${options.projectId}/databases/${options.databaseId}/documents`;
  const base=`${options.origin||'https://firestore.googleapis.com'}/v1/${root}`;
  async function call(path:string,body?:unknown,method=body===undefined?'GET':'POST'){
    const res=await request(`${base}${path}`,{method,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(15000)});
    if(res.status===404&&method==='GET')return null;
    if(!res.ok){
      const error=await res.json().catch(()=>null);
      if(res.status===409||res.status===412||(res.status===400&&['FAILED_PRECONDITION','ABORTED','ALREADY_EXISTS'].includes(error?.error?.status)))throw new AgentError('La conversación cambió. Recargue y vuelva a intentar.',409);
      if(res.status===403){
        const stage=path===':commit'?'guardado atómico':path.includes('/receipts/')?'lectura de recibo':path.includes('/agent_conversations/')?'lectura de borrador':'lectura de catálogo';
        throw new AgentError(`Sin permiso en Firestore (${stage}). Revise el perfil y las reglas publicadas.`,403);
      }
      throw new AgentError('Firestore no confirmó la operación. Reintente el mismo mensaje.',503);
    }
    return res.json();
  }
  async function snapshot(path:string){
    const document=await call(`/${path}`);
    if(document&&!document.updateTime)throw new AgentError('Firestore no devolvió la versión del documento. Reintente el mismo mensaje.',503);
    return {data:document?decodeFields(document.fields):undefined,precondition:document?{updateTime:document.updateTime}:{exists:false}};
  }
  async function read(path:string){const document=await call(`/${path}`);return document?decodeFields(document.fields):undefined;}
  async function catalog(collectionId:string,label:string,ids?:string[]){
    if(ids)return (await Promise.all([...new Set(ids)].map(async id=>{
      if(!/^[\w-]{1,120}$/.test(id))return undefined;
      const record=await read(`${collectionId}/${id}`);
      return record?.id===id&&record.tenantId===tenantId&&record[label]&&!['Cancelado','Finalizado'].includes(record.status)?{id,name:record[label]}:undefined;
    }))).filter(Boolean);
    const rows=await call(':runQuery',{structuredQuery:{from:[{collectionId}],where:{fieldFilter:{field:{fieldPath:'tenantId'},op:'EQUAL',value:{stringValue:tenantId}}},select:{fields:['id',label,'status','tenantId'].map(fieldPath=>({fieldPath}))},limit:500}});
    return (rows||[]).filter((r:any)=>r.document).map((r:any)=>decodeFields(r.document.fields)).filter((r:any)=>r.tenantId===tenantId&&r.id&&r[label]&&!['Cancelado','Finalizado'].includes(r.status)).map((r:any)=>({id:r.id,name:r[label]}));
  }
  async function turn(input:AgentTurn){
    validateAgentTurn(input);
    const [leaders,events]=await Promise.all([catalog('lideres','fullName',options.leaderIds),catalog('jornadas_operativas','name',options.eventIds)]);
    const context:AgentContext={uid,tenantId,leaders:options.leaderIds?leaders.filter(l=>options.leaderIds!.includes(l.id)):leaders,events:options.eventIds?events.filter(e=>options.eventIds!.includes(e.id)):events};
    const makeRequest=(c:AgentConversation)=>({...agentRequest(c),...(options.requestNotes?{notes:options.requestNotes}:{})});
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
    // Firebase user tokens use optimistic transactions, as the web SDK does.
    // Read versions and verify every dependency in one atomic commit; do not
    // call the server-only beginTransaction/rollback RPCs with a user's token.
    for(let attempt=0;attempt<3;attempt++){
      const current=await snapshot(path);
      const previous=current.data as AgentConversation|undefined;
      if(previous&&(previous.ownerUid!==uid||previous.tenantId!==tenantId))throw new AgentError('Conversación de otro ámbito.',403);
      if(await read(receiptPath)){
        // A concurrent commit can create the receipt after our first read.
        const saved=await read(path) as AgentConversation|undefined;
        if(!saved||saved.ownerUid!==uid||saved.tenantId!==tenantId)throw new AgentError('Conversación no disponible.',409);
        await verifySubmitted(saved);
        return {conversation:saved,context,reply:saved.messages.at(-1)?.text||'',verified:true,duplicate:true};
      }
      const conversation=advanceAgent(previous,input,context);
      const writes:any[]=[];
      const write=(p:string,data:Record<string,any>,currentDocument:Record<string,unknown>)=>writes.push({update:{name:`${root}/${p}`,fields:encodeFields(data)},currentDocument});
      if(conversation.status==='submitted'){
        const record=makeRequest(conversation);
        const leaderPath=`lideres/${record.leaderId}`,leader=await snapshot(leaderPath);
        if(leader.data?.tenantId!==tenantId)throw new AgentError('El responsable ya no está disponible.');
        writes.push({verify:`${root}/${leaderPath}`,currentDocument:leader.precondition});
        if(record.eventId){
          const eventPath=`jornadas_operativas/${record.eventId}`,event=await snapshot(eventPath);
          if(event.data?.tenantId!==tenantId||['Cancelado','Finalizado'].includes(event.data.status))throw new AgentError('La jornada ya no está activa.');
          writes.push({verify:`${root}/${eventPath}`,currentDocument:event.precondition});
        }
        write(`solicitudes_recursos/${record.id}`,record,{exists:false});
        write(`auditoria/${record.id}`,{id:record.id,tenantId,actorId:uid,entity:'solicitudes_recursos',entityId:record.id,action:'create',metadata:{source:'request-agent',conversationId:conversation.id},createdAt:record.createdAt},{exists:false});
      }
      write(path,conversation,current.precondition);
      write(receiptPath,{messageId:input.messageId,revision:conversation.revision,createdAt:conversation.updatedAt,tenantId,ownerUid:uid},{exists:false});
      try{await call(':commit',{writes});}
      catch(error){
        // Re-read after contention; receipts make a repeated delivery idempotent.
        // A different message keeps its revision check and cannot overwrite edits.
        if(error instanceof AgentError&&error.status===409&&attempt<2)continue;
        throw error;
      }
      const saved=await read(path) as AgentConversation|undefined;
      if(!saved||saved.revision<conversation.revision)throw new AgentError('No se pudo verificar el guardado. Reintente el mismo mensaje.',503);
      if(conversation.status==='submitted'){
        const savedRequest=await read(`solicitudes_recursos/${conversation.requestId}`),expected=makeRequest(conversation);
        if(!savedRequest||Object.entries(expected).some(([k,v])=>JSON.stringify(savedRequest[k])!==JSON.stringify(v)))throw new AgentError('El guardado requiere revisión. No se confirma la solicitud.',503);
      }
      return {conversation:saved,context,reply:saved.messages.at(-1)?.text||'',verified:true};
    }
    throw new AgentError('La conversación cambió. Reintente el mismo mensaje.',409);
  }
  return {turn};
}
