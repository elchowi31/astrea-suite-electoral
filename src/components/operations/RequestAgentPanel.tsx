import React,{useEffect,useRef,useState} from 'react';
import {Bot,Send} from 'lucide-react';
import {authenticatedFetch} from '../../lib/firebase';
import {RESOURCE_CATALOG} from '../../lib/operations';
import type {AgentAction,AgentContext,AgentConversation,AgentDraft,AgentTurn} from '../../lib/requestAgent';
import {useOperations} from './OperationsContext';
import {button,input,secondary,Field,money} from './OperationsUI';

export function RequestAgentPanel(){
  const {user,tenant,readOnly}=useOperations();const [open,setOpen]=useState(false);
  return <section className="rounded-2xl border border-cyan-900/70 bg-slate-950/60">
    <button type="button" className="flex w-full items-center gap-3 p-4 text-left" onClick={()=>setOpen(!open)} aria-expanded={open}>
      <Bot className="shrink-0 text-cyan-300" size={22}/><span className="flex-1"><strong className="text-sm">Asistente de solicitudes</strong><span className="mt-1 block text-xs text-slate-400">Describa la necesidad, revise la ficha y confirme el guardado.</span></span><span className="text-xs text-cyan-300">{open?'Cerrar':'Abrir'}</span>
    </button>
    {open&&(readOnly?<p className="px-4 pb-4 text-sm text-amber-200">Seleccione «Usar datos reales» para utilizar el asistente. Los formularios de demostración siguen disponibles en este módulo.</p>:user&&<AgentSession key={`${tenant.tenantId}-${user.uid}`} tenantId={tenant.tenantId} uid={user.uid}/>)}
  </section>;
}
function AgentSession({tenantId,uid}:{tenantId:string;uid:string;key?:React.Key}){
  const storageKey=`astrea-agent:${uid}:${tenantId}`;
  const [id,setId]=useState(()=>{try{return localStorage.getItem(storageKey)||crypto.randomUUID();}catch{return crypto.randomUUID();}});
  const [conversation,setConversation]=useState<AgentConversation>();const [context,setContext]=useState<AgentContext>();
  const [draft,setDraft]=useState<AgentDraft>({}),[reply,setReply]=useState(''),[text,setText]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[retry,setRetry]=useState(false);
  const pending=useRef<AgentTurn|null>(null),mounted=useRef(true),locked=useRef(false);
  useEffect(()=>()=>{mounted.current=false;},[]);
  async function send(action:AgentAction,patch?:AgentDraft,retryTurn=false){
    if(locked.current)return;locked.current=true;setBusy(true);setError('');
    const turn=retryTurn&&pending.current?pending.current:{conversationId:id,messageId:crypto.randomUUID(),revision:conversation?.revision||0,action,...(action==='message'?{text}:{}),...(patch?{patch}:{})};
    pending.current=turn;
    try{
      const res=await authenticatedFetch('/api/agent/turn',{method:'POST',body:JSON.stringify({...turn,tenantId})});
      const result=await res.json();if(!res.ok||!result.success){setRetry(res.status>=500);throw new Error(result.error||'No se pudo guardar.');}
      if(!mounted.current)return;
      setConversation(result.conversation);setDraft(result.conversation.draft);setContext(result.context);setReply(result.reply);setText('');setRetry(false);pending.current=null;
      try{localStorage.setItem(storageKey,id);}catch{}
    }catch(e){if(mounted.current){setError((e as Error).message);if(e instanceof TypeError)setRetry(true);}}
    finally{locked.current=false;if(mounted.current)setBusy(false);}
  }
  useEffect(()=>{mounted.current=true;void send('resume');},[id]);
  const ended=conversation&&['submitted','cancelled','human'].includes(conversation.status);
  const dirty=JSON.stringify(draft)!==JSON.stringify(conversation?.draft||{});
  const patch=(data:AgentDraft)=>setDraft(d=>({...d,...data}));
  function newConversation(){try{localStorage.removeItem(storageKey);}catch{}setConversation(undefined);setContext(undefined);setDraft({});setReply('');setText('');setRetry(false);pending.current=null;setId(crypto.randomUUID());}
  const disabled=busy||!!ended||retry;
  return <div className="border-t border-slate-800 p-4">
    <div className="mb-4 flex flex-wrap justify-between gap-2 text-xs text-slate-400"><span>Asistente guiado · borrador privado</span><span>WhatsApp pendiente de vinculación</span></div>
    {error&&<div role="alert" className="mb-3 rounded-lg bg-rose-950/40 p-3 text-sm text-rose-200">{error}<div className="mt-2 flex flex-wrap gap-2">{retry&&<button disabled={busy} className={secondary} onClick={()=>void send('message',undefined,true)}>Reintentar mismo mensaje</button>}<button disabled={busy} className={secondary} onClick={()=>void send('resume')}>Recargar conversación</button></div></div>}
    <div className="grid min-w-0 gap-5 xl:grid-cols-2"><div className="min-w-0">
      <div aria-live="polite" className="max-h-72 space-y-3 overflow-y-auto rounded-xl bg-slate-900/60 p-3">{conversation?.messages.map((m,i)=><p key={i} className={`whitespace-pre-wrap break-words rounded-lg p-3 text-sm ${m.role==='user'?'ml-6 bg-blue-600/15 text-blue-100':'mr-6 bg-slate-800 text-slate-200'}`}><span className="mb-1 block text-[10px] font-bold uppercase text-slate-400">{m.role==='user'?'Usted':'Asistente'}</span>{m.text}</p>)}{!conversation?.messages.length&&<p className="text-sm text-slate-300">{reply||'Cargando conversación…'}</p>}</div>
      {!ended&&<form className="mt-3 flex gap-2" onSubmit={e=>{e.preventDefault();void send('message');}}><input aria-label="Mensaje al asistente" className={`${input} min-w-0 flex-1`} value={text} maxLength={1500} disabled={busy||!context||retry} placeholder="Ej.: necesito 20 almuerzos" onChange={e=>setText(e.target.value)}/><button aria-label="Enviar mensaje" className={button} disabled={busy||!context||!text.trim()||retry}><Send size={18}/></button></form>}
      <div className="mt-3 flex flex-wrap gap-2">{!ended&&<><button className={secondary} disabled={busy||!context||retry} onClick={()=>void send('handoff')}>Continuar manualmente</button><button className={secondary} disabled={busy||!context||retry} onClick={()=>void send('cancel')}>Cancelar borrador</button></>}{ended&&<button className={button} disabled={busy} onClick={newConversation}>Otra solicitud</button>}</div>
    </div><form className="min-w-0 space-y-3" onSubmit={e=>{e.preventDefault();void send('edit',draft);}}>
      <div className="grid min-w-0 gap-3 sm:grid-cols-2">
        <Field label="Recurso"><select className={input} disabled={disabled} value={draft.resource||''} onChange={e=>patch({resource:e.target.value})}><option value="">Seleccione</option>{RESOURCE_CATALOG.map(r=><option key={r.name}>{r.name}</option>)}</select></Field>
        <Field label="Cantidad"><input className={input} type="number" min="0.01" step="any" max="1000000" value={draft.quantity??''} disabled={disabled} onChange={e=>patch({quantity:e.target.value===''?undefined:Number(e.target.value)})}/></Field>
        <Field label="Municipio"><input className={input} maxLength={200} value={draft.municipality||''} disabled={disabled} onChange={e=>patch({municipality:e.target.value})}/></Field>
        <Field label="Responsable"><select className={input} disabled={disabled} value={draft.leaderId||''} onChange={e=>patch({leaderId:e.target.value})}><option value="">Seleccione</option>{context?.leaders.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></Field>
        <Field label="Jornada"><select className={input} disabled={disabled} value={draft.eventId||''} onChange={e=>patch({eventId:e.target.value})}><option value="">Operación general</option>{context?.events.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></Field>
        <Field label="Costo unitario estimado (COP)"><input className={input} type="number" min="0" step="any" max="100000000000" value={draft.unitCost??''} disabled={disabled} onChange={e=>patch({unitCost:e.target.value===''?undefined:Number(e.target.value)})}/></Field>
        {draft.resource==='Transporte de pasajeros'&&<Field label="Sentido"><select className={input} disabled={disabled} value={draft.direction||'Ida'} onChange={e=>patch({direction:e.target.value as 'Ida'|'Regreso'})}><option>Ida</option><option>Regreso</option></select></Field>}
      </div><Field label="Descripción · origen, destino y hora si es transporte"><textarea className={`${input} min-h-20`} maxLength={500} value={draft.description||''} disabled={disabled} onChange={e=>patch({description:e.target.value})}/></Field>
      <p className="text-sm text-slate-300">Total estimado: <strong>{draft.quantity!==undefined&&draft.unitCost!==undefined?money(Math.round(draft.quantity*draft.unitCost)):'Por definir'}</strong></p>
      {!ended&&<div className="flex flex-wrap gap-2"><button type="submit" className={secondary} disabled={busy||!context||retry}>Guardar ficha y revisar</button><button type="button" className={button} disabled={busy||dirty||retry||conversation?.status!=='review'} onClick={()=>void send('confirm')}>Confirmar y guardar</button></div>}
      {conversation?.requestId&&<p role="status" className="break-all rounded-lg bg-emerald-950/50 p-3 text-sm text-emerald-200">Guardado verificado · pendiente de aprobación.<br/>Radicado: {conversation.requestId}</p>}
      {conversation&&conversation.revision>0&&<p className="text-xs text-slate-500">Último guardado: {new Date(conversation.updatedAt).toLocaleString('es-CO')}</p>}
    </form></div>
  </div>;
}
