import type {ServerResponse} from 'node:http';
import makeWASocket,{initAuthCreds,DisconnectReason,type AuthenticationState,type WASocket} from '@whiskeysockets/baileys';
import pino from 'pino';
import {PILOT_SECONDS,incomingPilotText,pilotIntake,pilotLease,type PilotConfig} from './whatsappPilotCore.js';
import {AgentError} from '../lib/requestAgent.js';

// Credentials and Signal keys exist only for this bounded test invocation.
// No WhatsApp credentials, QR payloads or Firebase tokens are logged or persisted.
export async function runWhatsappPilot(options:{projectId:string;databaseId:string;token:string;uid:string;config:PilotConfig;res:ServerResponse;checkActive:()=>Promise<void>}){
 const {res,config}=options;
 const base=`https://firestore.googleapis.com/v1/projects/${options.projectId}/databases/${encodeURIComponent(options.databaseId)}/documents`;
 const lease=pilotLease({base,token:options.token,phone:config.phone});await lease.acquire();
 const startedAt=Date.now(),expiresAt=startedAt+PILOT_SECONDS*1000;
 let stopped=false,connected=false,pairRequested=false,socket:WASocket|undefined,restarts=0;
 let pending=Promise.resolve();let finish!:()=>void;let accepted=0;
 const ended=new Promise<void>(resolve=>{finish=resolve});
 const keys=new Map<string,unknown>();
 const auth:AuthenticationState={creds:initAuthCreds(),keys:{
  get:async(type,ids)=>Object.fromEntries(ids.filter(id=>keys.has(`${type}:${id}`)).map(id=>[id,keys.get(`${type}:${id}`)])) as any,
  set:async(data)=>{for(const [type,values] of Object.entries(data))for(const [id,value] of Object.entries(values||{})){if(value==null)keys.delete(`${type}:${id}`);else keys.set(`${type}:${id}`,value);}}
 }};
 const emit=(event:Record<string,unknown>)=>{if(!res.destroyed&&!res.writableEnded)res.write(JSON.stringify(event)+'\n');};
 const stop=(reason:string)=>{if(stopped)return;stopped=true;connected=false;emit({type:'stopped',message:reason});finish();};
 const intake=pilotIntake({...options,runId:lease.owner});
 res.statusCode=200;res.setHeader('Content-Type','application/x-ndjson; charset=utf-8');res.setHeader('Cache-Control','no-store, no-transform');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Accel-Buffering','no');res.flushHeaders();
 emit({type:'starting',expiresAt,message:'Iniciando prueba temporal. Mantenga este panel abierto.'});
 const onClose=()=>stop('Prueba detenida al cerrar el panel.');res.on('close',onClose);
 const deadline=setTimeout(()=>stop('Terminó la ventana de cuatro minutos. Los datos guardados permanecen en Firestore.'),PILOT_SECONDS*1000);
 const heartbeat=setInterval(()=>emit({type:'heartbeat',expiresAt}),10000);
 function connect(){
  if(stopped)return;
  connected=false;
  socket=makeWASocket({auth,logger:pino({level:'silent'}) as any,markOnlineOnConnect:false,syncFullHistory:false,shouldSyncHistoryMessage:()=>false,connectTimeoutMs:25000,defaultQueryTimeoutMs:15000});
  const current=socket;
  current.ev.on('creds.update',update=>Object.assign(auth.creds,update));
  current.ev.on('connection.update',update=>{
   if(stopped||current!==socket)return;
   if((update.connection==='connecting'||update.qr)&&!auth.creds.registered&&!pairRequested){
    pairRequested=true;
    void current.requestPairingCode(config.phone).then(code=>{if(!stopped)emit({type:'pairing',code,message:'En WhatsApp: Dispositivos vinculados → Vincular un dispositivo → Vincular con número de teléfono.'});}).catch(()=>stop('WhatsApp no generó el código de vinculación. La prueba se detuvo.'));
   }
   if(update.connection==='open'){
    const phone=current.user?.id?.split('@')[0].split(':')[0];
    if(phone!==config.phone){stop('La cuenta vinculada no coincide con el número indicado.');return;}
    connected=true;emit({type:'connected',expiresAt,message:'Conectado. Puede recibir solicitudes de prueba desde otros números de WhatsApp.'});
   }
   if(update.connection==='close'){
    connected=false;
    const code=(update.lastDisconnect?.error as any)?.output?.statusCode;
    // WhatsApp requests one socket restart after pairing. Other failures stop
    // visibly; no retry loop, self-invocation or hidden background worker.
    if(code===DisconnectReason.restartRequired&&restarts++===0){current.end(undefined);connect();}
    else stop('WhatsApp cerró la conexión. Los registros confirmados se conservan. Inicie otra prueba para reconectar.');
   }
  });
  current.ev.on('messages.upsert',event=>{
   if(event.type!=='notify'||!connected||stopped)return;
   for(const message of event.messages){
    const incoming=incomingPilotText(message,startedAt);if(!incoming||accepted>=100)continue;accepted++;
    pending=pending.then(async()=>{
     if(stopped||!connected||current!==socket||Date.now()>expiresAt-15000)return;
     try{
      const result=await intake(incoming.phone,incoming.messageId,incoming.text);
      if(result.requestId)emit({type:'saved',requestId:result.requestId,message:'Solicitud guardada y verificada en Firestore.'});
      if(!stopped&&connected)await current.sendMessage(incoming.jid,{text:result.reply});
     }catch(error){
      emit({type:'notice',message:'No se confirmó una operación. Revise la solicitud antes de reintentar.'});
      if(!stopped&&connected)await current.sendMessage(incoming.jid,{text:error instanceof AgentError&&error.status===400?error.message:'No pude confirmar esta operación. Revise los datos o contacte al operador de la prueba; no asuma que quedó aprobada.'}).catch(()=>{});
     }
    }).catch(()=>stop('La prueba encontró un error y se detuvo. Revise los registros guardados.'));
   }
  });
 }
 try{connect();await ended;}
 finally{
  stopped=true;clearTimeout(deadline);clearInterval(heartbeat);res.off('close',onClose);
  // Complete in-flight writes before freeing the exclusive lease.
  await Promise.race([pending,new Promise<void>(resolve=>{const t=setTimeout(resolve,20000);t.unref();})]);
  try{if(auth.creds.registered&&socket)await Promise.race([socket.logout(),new Promise<void>(resolve=>{const t=setTimeout(resolve,5000);t.unref();})]);}catch{}
  socket?.end(undefined);keys.clear();
  await lease.release().catch(()=>{});
  if(!res.writableEnded&&!res.destroyed)res.end();
 }
}
