import type {ServerResponse} from 'node:http';
import makeWASocket,{DisconnectReason,type WASocket} from '@whiskeysockets/baileys';
import pino from 'pino';
import {PILOT_SECONDS,incomingPilotText,pilotIntake,pilotLease,type PilotConfig} from './whatsappPilotCore.js';
import {loadWhatsappSession,type TabSession} from './whatsappSessionStore.js';
import {AgentError} from '../lib/requestAgent.js';

// Each invocation is bounded; only the user's open tab can renew it.
export async function runWhatsappPilot(options:{projectId:string;databaseId:string;token:string;uid:string;config:PilotConfig;session:TabSession;res:ServerResponse;checkActive:()=>Promise<void>},dependencies:{makeSocket?:typeof makeWASocket;loadSession?:typeof loadWhatsappSession;lease?:typeof pilotLease;segmentMs?:number}={}){
 const {res,config}=options;
 const base=`https://firestore.googleapis.com/v1/projects/${options.projectId}/databases/${encodeURIComponent(options.databaseId)}/documents`;
 const lease=(dependencies.lease||pilotLease)({base,token:options.token,phone:config.phone});await lease.acquire();
 let store:Awaited<ReturnType<typeof loadWhatsappSession>>;
 try{store=await (dependencies.loadSession||loadWhatsappSession)({...options,base});}catch(e){await lease.release();throw e;}
 let stopped=false,connected=false,socket:WASocket|undefined,pairRequested=false,restarts=0;
 let work=Promise.resolve(),finish!:()=>void,accepted=0,processing=false;
 let outcome:{type:string;message:string}={type:'renew',message:'Renovando la conexión…'};
 const ended=new Promise<void>(resolve=>{finish=resolve});
 const emit=(event:Record<string,unknown>)=>{if(!res.destroyed&&!res.writableEnded)res.write(JSON.stringify(event)+'\n');};
 const stop=(type:string,message:string)=>{if(stopped)return;stopped=true;connected=false;outcome={type,message};finish();};
 const failed=(error:unknown)=>stop('fatal',error instanceof AgentError?error.message:'Se detuvo la recepción. Revise la conexión antes de continuar.');
 const intake=pilotIntake({...options,runId:options.session.id,conversations:store.state.conversations,saveCursor:store.save});
 const queue=(task:()=>Promise<void>)=>{work=work.then(task).catch(failed);};
 res.statusCode=200;res.setHeader('Content-Type','application/x-ndjson; charset=utf-8');res.setHeader('Cache-Control','no-store, no-transform');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Accel-Buffering','no');res.flushHeaders();
 emit({type:'starting',message:store.auth.creds.registered?'Recuperando la vinculación…':'Preparando la vinculación…'});
 const onClose=()=>stop('renew','La pestaña perdió la conexión.');res.on('close',onClose);
 const deadline=setTimeout(()=>stop('renew','Renovando la conexión sin desvincular WhatsApp…'),dependencies.segmentMs||PILOT_SECONDS*1000);
 const heartbeat=setInterval(()=>{emit({type:'heartbeat',connected});if(connected&&!stopped)queue(drain);},10000);
 async function drain(){
  if(processing||stopped||!connected||!socket)return;processing=true;
  try{
   while(store.state.inbox.length&&!stopped&&connected){
    const item=store.state.inbox[0];await options.checkActive();
    if(!item.result){
     try{item.result=await intake(item.phone,item.messageId,item.text);}
     catch(e){if(e instanceof AgentError&&e.status===400)item.result={reply:e.message};else throw e;}
     await store.save();
    }
    if(item.result.requestId)emit({type:'saved',requestId:item.result.requestId});
    if(stopped||!connected)break;
    try{await socket.sendMessage(item.jid,{text:item.result.reply});}
    catch{emit({type:'notice',message:'Una respuesta sigue pendiente de entrega. Se reintentará al recuperar la conexión.'});break;}
    store.state.handled.push(item.messageId);
    store.state.inbox.shift();await store.save();
    if(store.state.handled.length>=1000){stop('fatal','Se completaron 1000 mensajes en esta vinculación. Inicie una nueva para continuar.');break;}
   }
  }finally{processing=false;}
 }
 function connect(){
  if(stopped)return;connected=false;
  socket=(dependencies.makeSocket||makeWASocket)({auth:store.auth,logger:pino({level:'silent'}) as any,markOnlineOnConnect:false,syncFullHistory:false,shouldSyncHistoryMessage:()=>false,connectTimeoutMs:25000,defaultQueryTimeoutMs:15000});
  const current=socket;
  current.ev.on('creds.update',update=>{Object.assign(store.auth.creds,update);void store.save().catch(failed);});
  current.ev.on('connection.update',update=>{
   if(stopped||current!==socket)return;
   if((update.connection==='connecting'||update.qr)&&!store.auth.creds.registered&&!pairRequested){
    pairRequested=true;
    void current.requestPairingCode(config.phone).then(code=>{if(!stopped)emit({type:'pairing',code,message:'Vincule WhatsApp con este código. La vinculación se conserva durante esta pestaña.'});}).catch(()=>stop('retry','WhatsApp no generó el código. Reintentando conexión…'));
   }
   if(update.connection==='open'){
    const phone=current.user?.id?.split('@')[0].split(':')[0];
    if(phone!==config.phone){stop('fatal','La cuenta vinculada no coincide con el número indicado.');return;}
    connected=true;emit({type:'connected',message:'WhatsApp conectado · recepción activa'});queue(drain);
   }
   if(update.connection==='close'){
    connected=false;const code=(update.lastDisconnect?.error as any)?.output?.statusCode;
    if(code===DisconnectReason.restartRequired&&restarts++===0){current.end(undefined);connect();}
    else if([DisconnectReason.loggedOut,DisconnectReason.badSession,DisconnectReason.connectionReplaced].includes(code))stop('fatal','WhatsApp revocó o reemplazó esta sesión. Cree una nueva vinculación desde el panel.');
    else stop('retry','Recuperando la conexión con WhatsApp…');
   }
  });
  current.ev.on('messages.upsert',event=>{
   // Append includes offline messages from the renewal gap. Only this tab's time range is accepted.
   if(!['notify','append'].includes(event.type)||stopped)return;
   for(const message of event.messages){
    const incoming=incomingPilotText(message,store.state.startedAt);if(!incoming)continue;
    if(++accepted>150){stop('fatal','Se alcanzó el límite de mensajes de este intervalo. Detenga el envío y reanude la recepción.');break;}
    queue(async()=>{
     if(store.state.handled.includes(incoming.messageId)||store.state.inbox.some(i=>i.messageId===incoming.messageId))return;
     if(store.state.inbox.length>=100)throw new AgentError('Hay demasiados mensajes pendientes. Revise las solicitudes antes de reanudar.',429);
     store.state.inbox.push(incoming);await store.save();await drain();
    });
   }
  });
 }
 try{connect();await ended;}
 finally{
  stopped=true;connected=false;clearTimeout(deadline);clearInterval(heartbeat);res.off('close',onClose);
  // Close the transport without logout; the tab's next invocation restores authentication.
  socket?.end(undefined);
  try{
   await Promise.race([work.then(()=>store.flush()),new Promise<never>((_,reject)=>{const timer=setTimeout(()=>reject(new Error('Drain timeout')),25000);timer.unref();})]);
  }catch{outcome={type:'fatal',message:'No se pudo finalizar el guardado de la sesión. Revise los registros antes de reanudar.'};}
  await lease.release().catch(()=>{});
  // Rotate only after writes and lease release complete.
  emit(outcome);if(!res.writableEnded&&!res.destroyed)res.end();
 }
}
