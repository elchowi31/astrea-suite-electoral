import React,{useEffect,useRef,useState} from 'react';
import {MessageCircle} from 'lucide-react';
import {authenticatedFetch} from '../../lib/firebase';
import {useOperations} from './OperationsContext';
import {button,input,secondary,Field} from './OperationsUI';

export function WhatsappPilotPanel(){
 const {user,tenant,readOnly,leaders,events,requests}=useOperations();
 const [open,setOpen]=useState(false),[phone,setPhone]=useState(''),[leaderId,setLeaderId]=useState(''),[eventId,setEventId]=useState(''),[municipality,setMunicipality]=useState('');
 const [running,setRunning]=useState(false),[status,setStatus]=useState('Sin conexión'),[code,setCode]=useState(''),[expiresAt,setExpiresAt]=useState(0),[now,setNow]=useState(Date.now()),[error,setError]=useState(''),[saved,setSaved]=useState<string[]>([]);
 const controller=useRef<AbortController|null>(null),mounted=useRef(true);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;controller.current?.abort();};},[]);
 useEffect(()=>{controller.current?.abort();setRunning(false);setCode('');setSaved([]);setStatus('Sin conexión');},[tenant.tenantId,readOnly,user?.uid]);
 useEffect(()=>{if(!running)return;const id=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(id);},[running]);
 if(user?.role!=='AdminGlobal')return null;
 async function start(){
  if(controller.current)return;
  const session=new AbortController();controller.current=session;setRunning(true);setError('');setCode('');setSaved([]);setStatus('Solicitando conexión…');
  let receivedStop=false;
  try{
   const response=await authenticatedFetch('/api/whatsapp/pilot',{method:'POST',signal:session.signal,body:JSON.stringify({phone,tenantId:tenant.tenantId,leaderId,eventId,municipality})});
   if(!response.ok){const r=await response.json();throw new Error(r.error||'No se pudo iniciar la prueba.');}
   if(!response.body)throw new Error('Este navegador no recibió la conexión de prueba.');
   const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='';
   while(true){const chunk=await reader.read();if(chunk.done)break;buffer+=decoder.decode(chunk.value,{stream:true});let end:number;
    while((end=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,end);buffer=buffer.slice(end+1);if(!line.trim())continue;const event=JSON.parse(line);
     if(!mounted.current||session.signal.aborted)continue;
     if(event.expiresAt)setExpiresAt(event.expiresAt);
     if(event.type==='pairing'){setCode(event.code);setStatus(event.message);}
     if(event.type==='connected'){setCode('');setStatus(event.message);}
     if(event.type==='notice')setError(event.message);
     if(event.type==='stopped'){receivedStop=true;setCode('');setStatus(event.message);}
     if(event.type==='saved')setSaved(ids=>[...new Set([...ids,event.requestId])] as string[]);
    }
   }
  }catch(e){if(mounted.current&&!session.signal.aborted)setError((e as Error).message);}
  finally{if(controller.current===session)controller.current=null;if(mounted.current){setRunning(false);setCode('');setExpiresAt(0);if(!receivedStop)setStatus('Prueba detenida. Los registros confirmados permanecen en Firestore.');}}
 }
 const left=Math.max(0,Math.ceil((expiresAt-now)/1000));
 return <section className="rounded-2xl border border-emerald-900/70 bg-slate-950/60">
  <button type="button" className="flex w-full items-center gap-3 p-4 text-left" aria-expanded={open} onClick={()=>setOpen(v=>!v)}><MessageCircle size={22} className="shrink-0 text-emerald-300"/><span className="flex-1"><strong className="text-sm">WhatsApp · prueba en Vercel</strong><span className="mt-1 block text-xs text-slate-400">Ventana de cuatro minutos · solicitudes reales marcadas como prueba</span></span><span className="text-xs text-emerald-300">{open?'Cerrar':'Abrir'}</span></button>
  {open&&<div className="space-y-4 border-t border-slate-800 p-4">
   <p className="text-sm text-slate-300">Abra la prueba, vincule el número y mantenga esta página abierta. Desde otro WhatsApp, escriba «Necesito 20 almuerzos» o «Transporte para 8 personas», describa la necesidad y confirme. Los contactos solo pueden registrar sus solicitudes; no pueden consultar ni editar otros registros.</p>
   <p className="text-xs text-amber-200">El responsable, la jornada y el municipio siguientes se aplican a toda la prueba. El costo inicial es $0, por cotizar. Los registros quedan pendientes y atribuidos al operador que abrió esta sesión, con el teléfono de origen en las notas. No se reservan cupos ni se aprueban gastos.</p>
   {readOnly?<p className="text-sm text-amber-200">Seleccione «Usar datos reales» para conectar WhatsApp y guardar en Firestore.</p>:<form className="grid gap-3 sm:grid-cols-2" onSubmit={e=>{e.preventDefault();void start();}}>
    <Field label="WhatsApp receptor · con indicativo"><input className={input} type="tel" required maxLength={20} placeholder="57 + número de celular" value={phone} disabled={running} onChange={e=>setPhone(e.target.value)}/></Field>
    <Field label="Responsable de las pruebas"><select required className={input} value={leaderId} disabled={running} onChange={e=>setLeaderId(e.target.value)}><option value="">Seleccione</option>{leaders.map(l=><option key={l.id} value={l.id}>{l.fullName}</option>)}</select></Field>
    <Field label="Jornada de prueba"><select required className={input} value={eventId} disabled={running} onChange={e=>{setEventId(e.target.value);setMunicipality(events.find(v=>v.id===e.target.value)?.municipality||'');}}><option value="">Seleccione</option>{events.filter(e=>['Planificado','En curso'].includes(e.status)).map(e=><option key={e.id} value={e.id}>{e.name}</option>)}</select></Field>
    <Field label="Municipio"><input className={input} required maxLength={120} value={municipality} disabled={running} onChange={e=>setMunicipality(e.target.value)}/></Field>
    <div className="flex flex-wrap items-center gap-3 sm:col-span-2"><button className={button} disabled={running}>Iniciar prueba de 4 minutos</button>{running&&<button type="button" className={secondary} onClick={()=>controller.current?.abort()}>Detener y desconectar</button>}{running&&expiresAt>0&&<span className="text-sm text-emerald-300">{Math.floor(left/60)}:{String(left%60).padStart(2,'0')} restantes</span>}</div>
   </form>}
   <p role="status" className="text-sm text-slate-300">{status}</p>
   {code&&<div className="rounded-xl border border-emerald-700 bg-emerald-950/30 p-4"><p className="text-sm">Introduzca este código en WhatsApp → Dispositivos vinculados → Vincular un dispositivo → Vincular con número de teléfono.</p><p className="mt-3 select-all break-all font-mono text-3xl tracking-widest text-emerald-200">{code}</p><p className="mt-2 text-xs text-slate-400">No comparta el código. Al terminar la prueba se cierra la conexión; la siguiente prueba requiere vincular de nuevo.</p></div>}
   {error&&<p role="alert" className="rounded-lg bg-rose-950/40 p-3 text-sm text-rose-200">{error}</p>}
   {saved.length>0&&<div className="space-y-2 text-sm text-emerald-200"><p>{saved.length} solicitudes guardadas y verificadas en el servidor.</p>{saved.map(id=><p key={id} className="break-all text-xs">{requests.some(r=>r.id===id)?'Visible en la plataforma':'Esperando actualización de la lista'} · {id}</p>)}</div>}
  </div>}
 </section>;
}
