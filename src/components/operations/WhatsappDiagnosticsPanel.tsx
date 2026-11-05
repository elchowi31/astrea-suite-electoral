import React,{useEffect,useState} from 'react';
import {doc,onSnapshot} from 'firebase/firestore';
import {db} from '../../lib/firebase';
import {useOperations} from './OperationsContext';
type Entry={at:string;stage:string;detail:string;senderHint?:string;text?:string;reply?:string};
type Diagnostic={receiverHint:string;stage:string;detail:string;updatedAt:string;lastHeartbeatAt?:string;received:number;replied:number;saved:number;ignored:number;queued?:number;recoveredHandled?:number;lastText?:string;lastReply?:string;lastRequestId?:string;history:Entry[]};
const time=(s:string)=>new Date(s).toLocaleTimeString('es-CO',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
const labels:Record<string,string>={starting:'Iniciando',connected:'Conectado',received:'Recibido',ignored:'No procesado',prepared:'Respuesta preparada',replied:'Respuesta enviada',saved:'Solicitud guardada',duplicate:'Duplicado evitado',pending_reply:'Envío pendiente',stopped:'Conexión en transición'};
export function WhatsappDiagnosticsPanel(){
 const {user,tenant,readOnly}=useOperations();const [data,setData]=useState<Diagnostic|null>(null),[error,setError]=useState(''),[cached,setCached]=useState(true),[now,setNow]=useState(Date.now());
 useEffect(()=>{setData(null);setError('');if(!user||user.role!=='AdminGlobal'||readOnly)return;return onSnapshot(doc(db,'usuarios',user.uid,'whatsapp_activity',tenant.tenantId),{includeMetadataChanges:true},s=>{setData(s.exists()?s.data() as Diagnostic:null);setCached(s.metadata.fromCache);},()=>setError('No se pudo consultar el diagnóstico. Revise la conexión y la cuenta administradora.'));},[user?.uid,user?.role,tenant.tenantId,readOnly]);
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),10000);return()=>clearInterval(timer);},[]);
 if(readOnly||user?.role!=='AdminGlobal')return null;
 const stale=data&&now-Date.parse(data.lastHeartbeatAt||data.updatedAt)>90000;
 return <section aria-label="Diagnóstico de WhatsApp" className="space-y-3 rounded-xl border border-slate-700 bg-slate-950/60 p-4">
  <h3 className="text-sm font-semibold text-slate-100">Actividad de WhatsApp</h3>
  <p className="text-xs text-slate-400">Un mensaje inicia un borrador. La solicitud aparece en el listado cuando se completan los datos y se responde «confirmar».</p>
  {error&&<p role="alert" className="text-sm text-rose-200">{error}</p>}
  {!data?<p className="text-sm text-slate-300">Aún no hay diagnóstico disponible. Si el receptor está activo en otra pestaña, manténgala abierta: aparecerá al renovarse la conexión.</p>:<>
   <p className="text-xs text-slate-300">Receptor terminado en {data.receiverHint} · {cached?'Lectura local':stale?'Sin señal reciente: revise la pestaña receptora':'Diagnóstico sincronizado'} · actualizado {time(data.updatedAt)}</p>
   <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">{[['Recibidos',data.received],['Respuestas enviadas',data.replied],['Solicitudes guardadas',data.saved],['Pendientes',data.queued||0]].map(([label,value])=><div key={label} className="rounded-lg bg-slate-900 p-3"><p className="text-xl font-semibold text-emerald-200">{value}</p><p className="mt-1 text-xs text-slate-400">{label}</p></div>)}</div>
   <p className="text-sm text-slate-200">{labels[data.stage]||data.stage}: {data.detail}</p>
   {!!data.recoveredHandled&&<p className="text-xs text-slate-400">La sesión recuperó {data.recoveredHandled} recibos de mensajes ya atendidos antes de esta actualización.</p>}
   {data.lastText&&<p className="rounded-lg bg-slate-900 p-3 text-sm text-slate-200"><strong>Último mensaje: </strong>{data.lastText}</p>}
   {data.lastReply&&<p className="whitespace-pre-wrap rounded-lg bg-emerald-950/20 p-3 text-sm text-emerald-100"><strong>Última respuesta enviada: </strong>{data.lastReply}</p>}
   {data.lastRequestId&&<p className="break-all text-xs text-emerald-200">Último radicado: {data.lastRequestId}</p>}
   <details><summary className="cursor-pointer text-xs text-slate-300">Ver actividad reciente · {data.ignored||0} mensajes no procesados</summary><ol className="mt-3 max-h-64 space-y-2 overflow-y-auto">{(data.history||[]).slice().reverse().map((entry,i)=><li key={i} className="border-t border-slate-800 pt-2 text-xs text-slate-400"><strong className="text-slate-200">{time(entry.at)} · {labels[entry.stage]||entry.stage}</strong>{entry.senderHint&&` · remitente terminado en ${entry.senderHint}`}<p>{entry.detail}</p></li>)}</ol></details>
  </>}
 </section>;
}
