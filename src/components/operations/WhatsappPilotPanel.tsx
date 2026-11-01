import React,{useState} from 'react';
import {MessageCircle} from 'lucide-react';
import {useOperations} from './OperationsContext';
import {useWhatsappConnection} from './WhatsappConnectionContext';
import {button,input,secondary,Field} from './OperationsUI';

export function WhatsappPilotPanel(){
 const {user,readOnly,leaders,events,requests}=useOperations();
 const wa=useWhatsappConnection();const [open,setOpen]=useState(false);
 const {config,setConfig}=wa;
 const patch=(value:Partial<typeof config>)=>setConfig(previous=>({...previous,...value}));
 if(user?.role!=='AdminGlobal')return null;
 return <section className="rounded-2xl border border-emerald-900/70 bg-slate-950/60">
  <button type="button" className="flex min-h-12 w-full items-center gap-3 p-4 text-left" aria-expanded={open} onClick={()=>setOpen(v=>!v)}><MessageCircle size={22} className="shrink-0 text-emerald-300"/><span className="flex-1"><strong className="text-sm">WhatsApp · recepción desde esta pestaña</strong><span className="mt-1 block text-xs text-slate-400">Vinculación conservada · reconexión automática · solicitudes en Firestore</span></span><span className="text-xs text-emerald-300">{open?'Cerrar panel':'Abrir'}</span></button>
  {open&&<div className="space-y-4 border-t border-slate-800 p-4">
   <p className="text-sm text-slate-300">Inicie la recepción y vincule el número una vez. Puede cambiar de módulo dentro de Astrea: el servicio continúa mientras esta pestaña esté abierta y el navegador siga activo. Desde otro WhatsApp, envíe «Necesito 3 almuerzos» o «Transporte para 8 personas», complete la descripción y confirme.</p>
   <p className="text-xs text-amber-200">Las solicitudes de prueba se guardan realmente, quedan pendientes de revisión y no autorizan entregas. El responsable, jornada y municipio se aplican a toda la sesión; costo inicial $0, por cotizar.</p>
   {readOnly?<p className="text-sm text-amber-200">Seleccione «Usar datos reales» para guardar en Firestore.</p>:<form className="grid gap-3 sm:grid-cols-2" onSubmit={e=>{e.preventDefault();void wa.start(config);}}>
    <Field label="WhatsApp receptor · con indicativo"><input className={input} type="tel" required maxLength={20} placeholder="57 + número de celular" value={config.phone} disabled={wa.running} onChange={e=>patch({phone:e.target.value})}/></Field>
    <Field label="Responsable de las pruebas"><select required className={input} value={config.leaderId} disabled={wa.running} onChange={e=>patch({leaderId:e.target.value})}><option value="">Seleccione</option>{leaders.map(l=><option key={l.id} value={l.id}>{l.fullName}</option>)}</select></Field>
    <Field label="Jornada de prueba"><select required className={input} value={config.eventId} disabled={wa.running} onChange={e=>patch({eventId:e.target.value,municipality:events.find(v=>v.id===e.target.value)?.municipality||''})}><option value="">Seleccione</option>{events.filter(e=>['Planificado','En curso'].includes(e.status)).map(e=><option key={e.id} value={e.id}>{e.name}</option>)}</select></Field>
    <Field label="Municipio"><input className={input} required maxLength={120} value={config.municipality} disabled={wa.running} onChange={e=>patch({municipality:e.target.value})}/></Field>
    <div className="flex flex-wrap items-center gap-3 sm:col-span-2"><button className={button} disabled={wa.running}>Iniciar / reanudar recepción</button>{wa.running?<button type="button" className={secondary} onClick={wa.stop}>Detener recepción</button>:<button type="button" className={secondary} onClick={wa.reset}>Nueva vinculación</button>}</div>
   </form>}
   <p role="status" className="text-sm text-slate-300">{wa.status}</p>
   {wa.code&&<div className="rounded-xl border border-emerald-700 bg-emerald-950/30 p-4"><p className="text-sm">En el teléfono receptor: WhatsApp → Dispositivos vinculados → Vincular un dispositivo → Vincular con número de teléfono.</p><p className="mt-3 select-all break-all font-mono text-3xl tracking-widest text-emerald-200">{wa.code}</p><p className="mt-2 text-xs text-slate-400">No comparta este código. Las renovaciones automáticas conservan la misma vinculación.</p></div>}
   {wa.error&&<p role="alert" className="rounded-lg bg-rose-950/40 p-3 text-sm text-rose-200">{wa.error}</p>}
   {wa.saved.length>0&&<div className="space-y-2 text-sm text-emerald-200"><p>{wa.saved.length} solicitudes confirmadas durante esta pestaña.</p>{wa.saved.map(id=><p key={id} className="break-all text-xs">{requests.some(r=>r.id===id)?'Visible en la plataforma':'Esperando actualización de la lista'} · {id}</p>)}</div>}
   <p className="text-xs text-slate-400">{wa.wake?'Pantalla activa solicitada al navegador. ':''}En celular, mantenga Astrea en primer plano para evitar que Android suspenda la recepción. Al cerrar o recargar la pestaña deberá iniciar una nueva vinculación; las solicitudes permanecen guardadas. Detener recepción conserva el vínculo para reanudar en esta pestaña. Para retirarlo por completo, use «Dispositivos vinculados» en WhatsApp.</p>
  </div>}
 </section>;
}
