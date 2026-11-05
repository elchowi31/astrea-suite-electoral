import {decodeFields,encodeFields} from './requestAgent.js';
import {writeCheckpoint} from './firestoreCheckpoint.js';

export type DiagnosticStage='starting'|'connected'|'heartbeat'|'received'|'ignored'|'prepared'|'replied'|'saved'|'duplicate'|'pending_reply'|'stopped';
export type DiagnosticDetails={detail?:string;senderHint?:string;text?:string;reply?:string;requestId?:string;queued?:number;recoveredHandled?:number};
/** An operator-visible trace, scoped to the authenticated owner and organization.
 * It never stores credentials, encryption keys, full phone numbers or history sync. */
export function createWhatsappDiagnostics(options:{base:string;token:string;uid:string;config:{tenantId:string;eventId:string;phone:string};session:{id:string};fetcher?:typeof fetch}){
 const request=options.fetcher||fetch,path=`usuarios/${options.uid}/whatsapp_activity/${options.config.tenantId}`;
 const headers={Authorization:`Bearer ${options.token}`,'Content-Type':'application/json'};
 let revision='',record:Record<string,any>|undefined,work=Promise.resolve();
 const clean=(s:string|undefined,max:number)=>(s||'').replace(/[\u0000-\u001f]/g,' ').slice(0,max);
 async function save(stage:DiagnosticStage,details:DiagnosticDetails={}){
  if(!record){
   const got=await request(`${options.base}/${path}`,{headers,signal:AbortSignal.timeout(10000)});
   if(!got.ok&&got.status!==404)throw Error('Diagnostic read failed');
   const doc=got.ok?await got.json():null;revision=doc?.updateTime||'';
   const previous=doc?decodeFields(doc.fields):undefined;
   record=previous?.sessionId===options.session.id?previous:{tenantId:options.config.tenantId,eventId:options.config.eventId,sessionId:options.session.id,receiverHint:options.config.phone.slice(-4),received:0,replied:0,saved:0,ignored:0,history:[],createdAt:new Date().toISOString()};
  }
  const at=new Date().toISOString();
  if(stage==='heartbeat'){record.lastHeartbeatAt=at;}else{
   record.stage=stage;record.detail=clean(details.detail,300);
   if(['received','replied','saved','ignored'].includes(stage)&&(stage!=='saved'||details.requestId!==record.lastRequestId))record[stage]=(Number(record[stage])||0)+1;
   if(stage==='connected')record.lastHeartbeatAt=at;
   if(stage==='received'){record.lastReceivedAt=at;record.lastText=clean(details.text,180);record.lastSenderHint=clean(details.senderHint,20);}
   if(stage==='replied'){record.lastRepliedAt=at;record.lastReply=clean(details.reply,500);}
   if(stage==='saved')record.lastRequestId=clean(details.requestId,160);
   if(details.queued!==undefined)record.queued=details.queued;
   if(details.recoveredHandled!==undefined)record.recoveredHandled=details.recoveredHandled;
   record.history=[...(record.history||[]),{at,stage,detail:clean(details.detail,300),senderHint:clean(details.senderHint,20),...(details.text?{text:clean(details.text,180)}:{}),...(details.reply?{reply:clean(details.reply,500)}:{})}].slice(-30);
  }
  record.updatedAt=at;
  const saved=await writeCheckpoint({base:options.base,path,headers,request,revision,fields:encodeFields(record),timeout:10000});
  if(!saved.ok||!saved.updateTime){record=undefined;throw Error('Diagnostic write failed');}
  revision=saved.updateTime;
 }
 return {
  record(stage:DiagnosticStage,details:DiagnosticDetails={}){const pending=work.then(()=>save(stage,details));work=pending.catch(()=>{});return pending;},
  flush:()=>work,
 };
}
