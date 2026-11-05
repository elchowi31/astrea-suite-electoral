import type {ServerResponse} from 'node:http';
import makeWASocket,{DisconnectReason,type WASocket} from '@whiskeysockets/baileys';
import pino from 'pino';
import {createWhatsappDiagnostics,type DiagnosticStage,type DiagnosticDetails} from './whatsappDiagnostics.js';
import {PILOT_SECONDS,resolvePilotText,pilotIntake,pilotLease,type PilotConfig} from './whatsappPilotCore.js';
import {loadWhatsappSession,type TabSession} from './whatsappSessionStore.js';
import {hasPairedWhatsappIdentity} from './whatsappPairing.js';
import {AgentError} from '../lib/requestAgent.js';

// Each invocation is bounded; only the user's open tab can renew it.
export async function runWhatsappPilot(options:{projectId:string;databaseId:string;token:string;uid:string;config:PilotConfig;session:TabSession;res:ServerResponse;checkActive:()=>Promise<void>},dependencies:{makeSocket?:typeof makeWASocket;loadSession?:typeof loadWhatsappSession;lease?:typeof pilotLease;segmentMs?:number;createDiagnostics?:typeof createWhatsappDiagnostics;intake?:ReturnType<typeof pilotIntake>}={}){
 const {res,config}=options;
 const base=`https://firestore.googleapis.com/v1/projects/${options.projectId}/databases/${encodeURIComponent(options.databaseId)}/documents`;
 const lease=(dependencies.lease||pilotLease)({base,token:options.token,phone:config.phone});await lease.acquire();
 let store:Awaited<ReturnType<typeof loadWhatsappSession>>;
 try{store=await (dependencies.loadSession||loadWhatsappSession)({...options,base});}catch(e){await lease.release();throw e;}
 let stopped=false,connected=false,socket:WASocket|undefined,pairRequested=false,restarts=0;
 let work=Promise.resolve(),finish!:()=>void,accepted=0,processing=false;
 let outcome:{type:string;message:string;resetSession?:boolean}={type:'renew',message:'Renovando la conexión…'};
 const ended=new Promise<void>(resolve=>{finish=resolve});
 const emit=(event:Record<string,unknown>)=>{if(!res.destroyed&&!res.writableEnded)res.write(JSON.stringify(event)+'\n');};
 const stop=(type:string,message:string,resetSession=false)=>{if(stopped)return;stopped=true;connected=false;outcome={type,message,...(resetSession?{resetSession:true}:{})};finish();};
 const incomplete=(message:string)=>stop('fatal',message+' Pulse «Iniciar / reanudar recepción» para obtener un código nuevo.',true);
 const failed=(error:unknown)=>stop('fatal',error instanceof AgentError?error.message:'Se detuvo la recepción. Revise la conexión antes de continuar.');
 const intake=dependencies.intake||pilotIntake({...options,runId:options.session.id,conversations:store.state.conversations,saveCursor:store.save});
 const queue=(task:()=>Promise<void>)=>{work=work.then(task).catch(failed);};
 const diagnostics=(dependencies.createDiagnostics||createWhatsappDiagnostics)({...options,base});
 let diagnosticWarning=false,beats=0;
 const trace=(stage:DiagnosticStage,details:DiagnosticDetails={})=>{void diagnostics.record(stage,details).catch(()=>{if(!diagnosticWarning){diagnosticWarning=true;emit({type:'notice',message:'No se pudo actualizar el diagnóstico de recepción. El receptor continúa activo.'});}});};
 trace('starting',{detail:'Receptor iniciado; esperando mensajes de texto privados.',queued:store.state.inbox.length,recoveredHandled:store.state.handled.length});
 res.statusCode=200;res.setHeader('Content-Type','application/x-ndjson; charset=utf-8');res.setHeader('Cache-Control','no-store, no-transform');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Accel-Buffering','no');res.flushHeaders();
 emit({type:'starting',message:hasPairedWhatsappIdentity(store.auth.creds)?'Recuperando la vinculación…':'Preparando la vinculación…'});
 const onClose=()=>{if(hasPairedWhatsappIdentity(store.auth.creds))stop('renew','La pestaña perdió la conexión.');else incomplete('La conexión se interrumpió antes de completar la vinculación.');};res.on('close',onClose);
 const deadline=setTimeout(()=>{if(hasPairedWhatsappIdentity(store.auth.creds))stop('renew','Renovando la conexión sin desvincular WhatsApp…');else incomplete('Terminó el tiempo de este intento sin completar la vinculación.');},dependencies.segmentMs||PILOT_SECONDS*1000);
 const heartbeat=setInterval(()=>{emit({type:'heartbeat',connected});if(connected&&!stopped){if(++beats%3===0)trace('heartbeat');queue(drain);}},10000);
 async function drain(){
  if(processing||stopped||!connected||!socket)return;processing=true;
  try{
   while(store.state.inbox.length&&!stopped&&connected){
    const item=store.state.inbox[0];await options.checkActive();
    if(await store.wasHandled(item.messageId)){store.state.inbox.shift();await store.save();continue;}
    if(!item.result){
     try{item.result=await intake(item.phone,item.messageId,item.text);}
     catch(e){if(e instanceof AgentError&&e.status===400)item.result={reply:e.message};else throw e;}
     await store.save();
     trace('prepared',{detail:'Respuesta preparada; pendiente de envío.',reply:item.result.reply,queued:store.state.inbox.length});
    }
    if(item.result.requestId){emit({type:'saved',requestId:item.result.requestId});trace('saved',{detail:'Solicitud confirmada y guardada en Firestore.',requestId:item.result.requestId});}
    if(stopped||!connected)break;
    try{await socket.sendMessage(item.jid,{text:item.result.reply});}
    catch{trace('pending_reply',{detail:'WhatsApp no confirmó el envío; se reintentará.',queued:store.state.inbox.length});emit({type:'notice',message:'Una respuesta sigue pendiente de entrega. Se reintentará al recuperar la conexión.'});break;}
    await store.markHandled(item.messageId);
    store.state.inbox.shift();await store.save();
    trace('replied',{detail:'Respuesta enviada a WhatsApp. La lectura en el teléfono aún no está confirmada.',reply:item.result.reply,senderHint:item.phone.slice(-4),queued:store.state.inbox.length});
    emit({type:'activity',message:'Mensaje recibido y respuesta enviada. Complete el cuestionario y escriba «confirmar» para guardar la solicitud.'});
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
   // requestPairingCode mutates creds.me before sending. Calling it on the
   // early 'connecting' event can race the registration handshake and make
   // Baileys attempt a login with an identity that is not paired yet.
   if(update.qr&&!hasPairedWhatsappIdentity(store.auth.creds)&&!pairRequested){
    pairRequested=true;
    void current.requestPairingCode(config.phone).then(code=>{if(!stopped&&current===socket){trace('pairing',{detail:'Código generado; esperando confirmación desde el teléfono receptor.'});emit({type:'pairing',code,message:'Esperando confirmación en el teléfono receptor. Todavía no hay recepción activa.'});}}).catch(()=>incomplete('No se pudo generar el código de WhatsApp.'));
   }
   if(update.isNewLogin&&hasPairedWhatsappIdentity(store.auth.creds)){
    trace('paired',{detail:'WhatsApp confirmó la vinculación; iniciando la recepción.'});emit({type:'paired',message:'Vinculación confirmada por WhatsApp. Iniciando la recepción…'});
   }
   if(update.connection==='open'){
    const phone=current.user?.id?.split('@')[0].split(':')[0];
    if(phone!==config.phone){stop('fatal','La cuenta vinculada no coincide con el número indicado.',true);return;}
    connected=true;trace('connected',{detail:'Vinculación activa; esperando mensajes privados nuevos.'});emit({type:'connected',message:'WhatsApp conectado · recepción activa'});queue(drain);
   }
   if(update.connection==='close'){
    connected=false;const code=(update.lastDisconnect?.error as any)?.output?.statusCode;
    if(!hasPairedWhatsappIdentity(store.auth.creds)){
     incomplete(code===DisconnectReason.timedOut?'Venció el intento de vinculación (408) sin confirmación del teléfono.':`WhatsApp no completó la vinculación${Number.isInteger(code)?` (código ${code})`:''}.`);
    }else if(code===DisconnectReason.restartRequired&&restarts++===0){
     // The signed pairing credentials must be durable before opening a login socket.
     queue(async()=>{await store.flush();if(!stopped&&current===socket){socket=undefined;current.end(undefined);connect();}});
    }else if([DisconnectReason.loggedOut,DisconnectReason.badSession,DisconnectReason.connectionReplaced].includes(code))stop('fatal',`WhatsApp cerró o reemplazó la sesión (código ${code}). Pulse «Iniciar / reanudar recepción» para vincular de nuevo.`,true);
    else stop('retry',`WhatsApp interrumpió la conexión${Number.isInteger(code)?` (código ${code})`:''}. Se reintentará automáticamente.`);
   }
  });
  current.ev.on('messages.upsert',event=>{
   // Append includes offline messages from the renewal gap. Only this tab's time range is accepted.
   if(!['notify','append'].includes(event.type)||stopped)return;
   for(const message of event.messages){
    if(message.key.fromMe||!message.key.id)continue;
    const jid=message.key.remoteJid||'';
    if(!jid.endsWith('@s.whatsapp.net')&&!jid.endsWith('@lid'))continue;
    queue(async()=>{
     const result=await resolvePilotText(message,store.state.startedAt,current.signalRepository?.lidMapping?.getPNForLID?.bind(current.signalRepository.lidMapping));
     const incoming=result.incoming;
     if(!incoming){
      const reasons={before_session:'El mensaje es anterior al inicio de esta recepción. Envíe uno nuevo.',invalid_timestamp:'La fecha del mensaje no es válida.',unsupported_content:'No se recibió texto compatible (máximo 500 caracteres). Envíe una frase de texto.',unresolved_sender:'WhatsApp envió un identificador privado sin equivalencia de número disponible.',own_or_missing_id:'Mensaje propio o sin identificador.',not_private:'Solo se atienden conversaciones privadas.'};
      // System and history packets are not messages from the user; do not flood the trace.
      if(result.reason==='unresolved_sender'||(result.reason==='unsupported_content'&&message.message)||result.reason==='invalid_timestamp'||result.reason==='before_session')trace('ignored',{detail:reasons[result.reason]});
      return;
     }
     if(++accepted>150){stop('renew','Renovando la conexión para continuar procesando mensajes.');return;}
     if(store.state.inbox.some(i=>i.messageId===incoming.messageId)||await store.wasHandled(incoming.messageId)){trace('duplicate',{detail:'Mensaje ya recibido; no se vuelve a registrar.'});return;}
     if(store.state.inbox.length>=100)throw new AgentError('Hay demasiados mensajes pendientes. Revise las solicitudes antes de reanudar.',429);
     store.state.inbox.push(incoming);await store.save();
     trace('received',{detail:'Mensaje privado recibido y conservado para procesar.',text:incoming.text,senderHint:incoming.phone.slice(-4),queued:store.state.inbox.length});
     emit({type:'activity',message:'Mensaje de WhatsApp recibido. Preparando respuesta.'});await drain();
    });
   }
  });
 }
 try{
  // requestPairingCode sets creds.me before pair-success. Never restore that
  // partial identity as a login after a broken stream, timeout or manual resume.
  if(store.auth.creds.me&&!hasPairedWhatsappIdentity(store.auth.creds))incomplete('El intento anterior quedó incompleto y su código ya no se puede reanudar.');
  else connect();
  await ended;
 }
 finally{
  stopped=true;connected=false;clearTimeout(deadline);clearInterval(heartbeat);res.off('close',onClose);
  // Close the transport without logout; the tab's next invocation restores authentication.
  socket?.end(undefined);
  try{
   await Promise.race([work.then(()=>store.flush()),new Promise<never>((_,reject)=>{const timer=setTimeout(()=>reject(new Error('Drain timeout')),25000);timer.unref();})]);
  }catch{outcome={type:'fatal',message:'No se pudo finalizar el guardado de la sesión. Revise los registros antes de reanudar.'};}
  trace('stopped',{detail:outcome.message,queued:store.state.inbox.length});await diagnostics.flush();
  await lease.release().catch(()=>{});
  // Rotate only after writes and lease release complete.
  emit(outcome);if(!res.writableEnded&&!res.destroyed)res.end();
 }
}


