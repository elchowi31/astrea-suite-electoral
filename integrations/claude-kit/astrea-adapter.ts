import {createHash,randomUUID} from 'node:crypto';

// Adapter for the user's 02-kit-agente-whatsapp, not a second WhatsApp client.
// The kit retains Baileys, QR, reconnect and its on/off controls. Astrea owns
// drafts, validation, idempotency and operational requests.
export type KitBinding={uid:string;tenantId:string;conversationId:string;getIdToken():Promise<string>;setConversationId(id:string):Promise<void>};
type Message={key:{id?:string|null;fromMe?:boolean|null;remoteJid?:string|null;senderPn?:string|null};message?:{conversation?:string|null;extendedTextMessage?:{text?:string|null}}};
export function canonicalSender(jid:string,senderPn?:string|null):string|null{
  // Unlike the original kit, never interpret an opaque LID as a phone number.
  const source=jid.endsWith('@s.whatsapp.net')?jid:jid.endsWith('@lid')&&senderPn?.endsWith('@s.whatsapp.net')?senderPn:null;
  const phone=source?.split('@')[0].split(':')[0];return phone&&/^\d{8,15}$/.test(phone)?phone:null;
}
export function createKitAstreaHandler(options:{
  baseUrl:string;
  // Resolve only administrator-approved sender/user bindings. Never infer an
  // Astrea identity from text, pushName or a shared administrator credential.
  resolveBinding(phone:string):Promise<KitBinding|null>;
  paused(phone:string):Promise<boolean>;
  fetcher?:typeof fetch;
}){
  const url=new URL(options.baseUrl);if(url.protocol!=='https:')throw new Error('Astrea requiere HTTPS.');
  const queues=new Map<string,Promise<unknown>>();
  async function process(sock:{sendMessage(jid:string,message:{text:string}):Promise<unknown>},msg:Message){
    const jid=msg.key.remoteJid||'';if(msg.key.fromMe||!msg.key.id)return 'ignored';
    const phone=canonicalSender(jid,msg.key.senderPn);if(!phone)return 'ignored';
    const text=msg.message?.conversation||msg.message?.extendedTextMessage?.text;
    if(!text?.trim())return 'ignored';
    const binding=await options.resolveBinding(phone);if(!binding)return 'unbound';
    if(await options.paused(phone))return 'paused';
    async function api(body:Record<string,unknown>){
      const response=await (options.fetcher||fetch)(new URL('/api/agent/turn',url),{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${await binding!.getIdToken()}`},body:JSON.stringify({...body,tenantId:binding!.tenantId}),signal:AbortSignal.timeout(30000)});
      const result=await response.json();if(!response.ok||!result.success)throw new Error(`Astrea rechazó la operación (${response.status}).`);return result;
    }
    const messageId=createHash('sha256').update(`${jid}:${msg.key.id}`).digest('hex');
    let conversationId=binding.conversationId;
    let current=await api({conversationId,messageId,revision:0,action:'resume'});
    if(current.conversation.status==='human')return 'paused';
    if(['submitted','cancelled'].includes(current.conversation.status)&&text.trim().toLowerCase()==='nueva solicitud'){
      conversationId=randomUUID();await binding.setConversationId(conversationId);
      current=await api({conversationId,messageId,revision:0,action:'resume'});
      if(!await options.paused(phone))await sock.sendMessage(jid,{text:current.reply});
      return 'processed';
    }
    const action=text.trim().toLowerCase()==='cancelar'?'cancel':'message';
    const result=await api({conversationId,messageId,revision:current.conversation.revision,action,text});
    // Check pause again after the network call, as the original kit does for
    // HUMAN mode. No automatic approvals, broadcasts or marketing messages.
    if(!await options.paused(phone))await sock.sendMessage(jid,{text:result.reply+(result.conversation.requestId?`\nRadicado: ${result.conversation.requestId}\nEscriba «nueva solicitud» para iniciar otra.`:'')});
    return 'processed';
  }
  return async function handleAstreaIncoming(sock:{sendMessage(jid:string,message:{text:string}):Promise<unknown>},event:{type:string;messages:Message[]}){
    if(event.type!=='notify')return;
    for(const msg of event.messages){
      const key=canonicalSender(msg.key.remoteJid||'',msg.key.senderPn);if(!key)continue;
      const previous=queues.get(key)||Promise.resolve();
      const work=previous.catch(()=>{}).then(()=>process(sock,msg));queues.set(key,work);
      try{await work;}finally{if(queues.get(key)===work)queues.delete(key);}
    }
  };
}
