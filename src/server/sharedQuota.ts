import {AgentError} from '../lib/requestAgent.js';
/** Firestore preconditions serialize consumption across serverless instances using the caller's token. */
export async function consumeSharedQuota(options:{projectId:string;databaseId:string;uid:string;tenantId:string;token:string;now?:number;maximum?:number;request?:typeof fetch}){
 const now=options.now??Date.now(),minute=Math.floor(now/60000),id=`${options.uid}--${minute}`,maximum=options.maximum??40;
 const base=`https://firestore.googleapis.com/v1/projects/${options.projectId}/databases/${encodeURIComponent(options.databaseId)}/documents`;
 const path=`${base}/cuotas_api/${encodeURIComponent(id)}`,request=options.request||fetch,headers={Authorization:`Bearer ${options.token}`,'Content-Type':'application/json'};
 for(let attempt=0;attempt<5;attempt++){
  const response=await request(path,{headers,signal:AbortSignal.timeout(10000)});
  if(response.status!==404&&!response.ok)throw new AgentError('No se pudo comprobar el límite compartido de uso.',503);
  const current=response.status===404?null:await response.json(),count=current?Number(current.fields?.count?.integerValue):0;
  if(!Number.isInteger(count)||count<0)throw new AgentError('El contador de uso requiere revisión.',503);
  if(count>=maximum)throw new AgentError('Límite compartido de solicitudes alcanzado. Espere al siguiente minuto.',429);
  const result=await request(`${base}:commit`,{method:'POST',headers,signal:AbortSignal.timeout(10000),body:JSON.stringify({writes:[{update:{name:`projects/${options.projectId}/databases/${options.databaseId}/documents/cuotas_api/${id}`,fields:{userId:{stringValue:options.uid},tenantId:{stringValue:options.tenantId},minute:{integerValue:String(minute)},count:{integerValue:String(count+1)},expiresAt:{timestampValue:new Date((minute+2)*60000).toISOString()}}},currentDocument:current?{updateTime:current.updateTime}:{exists:false}}]})});
  if(result.ok)return {count:count+1,minute,scope:'shared-user'};
  const failure=await result.json().catch(()=>null);
  if(result.status===403){const latest=await request(path,{headers,signal:AbortSignal.timeout(10000)});if(latest.ok&&(await latest.json()).updateTime!==current?.updateTime)continue;}
   if(![409,412].includes(result.status)&&!['FAILED_PRECONDITION','ALREADY_EXISTS','ABORTED'].includes(failure?.error?.status))throw new AgentError('No se pudo registrar el consumo de la solicitud.',503);
 }
 throw new AgentError('Hay solicitudes concurrentes. Vuelva a intentar en unos segundos.',429);
}
