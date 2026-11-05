export type WhatsappEvent={type:string;message?:string;code?:string;requestId?:string;connected?:boolean};
export function waitForRenewal(ms:number,signal:AbortSignal){
 return new Promise<void>(resolve=>{
  if(signal.aborted){resolve();return;}
  const done=()=>{clearTimeout(timer);signal.removeEventListener('abort',done);resolve();};
  const timer=setTimeout(done,ms);signal.addEventListener('abort',done,{once:true});
 });
}
// Request is invoked again for every segment, obtaining a fresh Firebase ID token.
export async function runWhatsappTab(options:{body:unknown;signal:AbortSignal;request:(init:RequestInit)=>Promise<Response>;onEvent:(event:WhatsappEvent)=>void;wait?:typeof waitForRenewal;idleMs?:number;maxFailures?:number}){
 const {signal,onEvent}=options;let failures=0;
 const maxFailures=options.maxFailures??6;
 while(!signal.aborted){
  const attempt=new AbortController();const abort=()=>attempt.abort();signal.addEventListener('abort',abort,{once:true});
  let watchdog:ReturnType<typeof setTimeout>|undefined;
  const touch=()=>{clearTimeout(watchdog);watchdog=setTimeout(()=>attempt.abort(),options.idleMs||45000);};
  let renew=false,fatal=false,lastReason='El servidor cerró la conexión sin confirmar su estado.';
  try{
   touch();
   const response=await options.request({method:'POST',signal:attempt.signal,body:JSON.stringify(options.body)});
   if(!response.ok){
    const data=await response.json().catch(()=>({}));
    if(![409,408,429,500,502,503,504].includes(response.status)){onEvent({type:'fatal',message:data.error||'No se autorizó la conexión de WhatsApp.'});return;}
    throw new Error(data.error||`El servidor respondió HTTP ${response.status}.`);
   }
   if(!response.headers.get('Content-Type')?.toLowerCase().startsWith('application/x-ndjson')){
    onEvent({type:'fatal',message:'El servidor no entregó el canal de WhatsApp esperado. Revise la ruta de la API y el despliegue.'});return;
   }
   if(!response.body)throw new Error('El navegador no recibió la conexión.');
   const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='';
   try{
    while(!signal.aborted){
     const part=await reader.read();if(part.done)break;touch();buffer+=decoder.decode(part.value,{stream:true});
     if(buffer.length>65536)throw new Error('Respuesta de conexión inválida.');
     let newline:number;
     while((newline=buffer.indexOf('\n'))>=0){
      const line=buffer.slice(0,newline);buffer=buffer.slice(newline+1);if(!line.trim())continue;
      const event=JSON.parse(line) as WhatsappEvent;
      if(signal.aborted)break;
      onEvent(event);
      if(event.type==='connected')failures=0;
      if(event.type==='renew')renew=true;
      if(event.type==='fatal')fatal=true;
      if(event.type==='retry'&&event.message)lastReason=event.message;
     }
    }
   }finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
  }catch(e){lastReason=attempt.signal.aborted?'Se perdió la señal del servidor.':(e instanceof Error?e.message:'Falló la conexión.');}
  finally{clearTimeout(watchdog);signal.removeEventListener('abort',abort);attempt.abort();}
  if(signal.aborted||fatal)return;
  if(!renew&&++failures>=maxFailures){onEvent({type:'fatal',message:`Recepción detenida después de ${failures} intentos fallidos. ${lastReason} Puede volver a iniciarla desde el panel.`});return;}
  onEvent({type:'retry',message:renew?'Renovando la conexión automáticamente…':`${lastReason} Reintento ${failures}/${maxFailures}. Los registros guardados se conservan.`});
  const delay=renew?300:Math.min(30000,2000*2**Math.min(failures-1,4));
  await (options.wait||waitForRenewal)(delay,signal);
 }
}

