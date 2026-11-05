import React,{useState} from 'react';
import {WhatsappDiagnosticsPanel} from './WhatsappDiagnosticsPanel';
import {MessageCircle} from 'lucide-react';
import {useOperations} from './OperationsContext';
import {useWhatsappConnection} from './WhatsappConnectionContext';
import {button,input,secondary,Field} from './OperationsUI';

export function WhatsappPilotPanel({onSwitchAccount}:{onSwitchAccount?:()=>void}){
 const {user,readOnly,events,requests}=useOperations();
 const wa=useWhatsappConnection();const [open,setOpen]=useState(false);
 const {config,setConfig}=wa;
 const patch=(value:Partial<typeof config>)=>setConfig(previous=>({...previous,...value}));
 if(user?.role!=='AdminGlobal')return <section aria-label="Vincular WhatsApp" className="rounded-2xl border border-emerald-900/70 bg-slate-950/60 p-4">
  <h2 className="flex items-center gap-3 text-sm font-semibold text-slate-100"><MessageCircle size={22} className="text-emerald-300"/>WhatsApp · vincular número</h2>
  <p className="mt-3 text-sm text-slate-300">Sesión actual: <strong>{user?.displayName||'Sin sesión'}</strong> · {user?.role||'Sin rol'}.</p>
  <p className="mt-2 text-sm text-slate-300">La vinculación del número receptor está disponible para el administrador global de la plataforma. Un administrador de organización (AdminTenant) puede gestionar sus solicitudes, pero no vincular el receptor.</p>
  <p className="mt-2 text-xs text-slate-400">Inicia sesión con tu cuenta AdminGlobal. Después, vuelve a Solicitudes y jornadas y abre «Vincular WhatsApp».</p>
  {readOnly&&<p className="mt-2 text-xs text-amber-200">Estás viendo datos de demostración. La recepción requiere una sesión con datos reales.</p>}
  {onSwitchAccount&&<button type="button" className={secondary+' mt-3'} onClick={onSwitchAccount}>Cambiar a cuenta administradora</button>}
 </section>;
 return <section aria-label="Vincular WhatsApp" className="rounded-2xl border border-emerald-900/70 bg-slate-950/60">
  <button type="button" className="flex min-h-12 w-full items-center gap-3 p-4 text-left" aria-expanded={open} onClick={()=>setOpen(v=>!v)}><MessageCircle size={22} className="shrink-0 text-emerald-300"/><span className="flex-1"><strong className="text-sm">WhatsApp · vincular número y recibir mensajes</strong><span className="mt-1 block text-xs text-slate-400">Vinculación conservada · reconexión automática · solicitudes en Firestore</span></span><span className="text-xs text-emerald-300">{open?'Cerrar panel':'Vincular WhatsApp'}</span></button>
  {open&&<div className="space-y-4 border-t border-slate-800 p-4">
   <p className="text-sm text-slate-300">Inicie la recepción y vincule el número una vez. Puede cambiar de módulo dentro de Astrea: el servicio continúa mientras esta pestaña esté abierta y el navegador siga activo. Desde otro WhatsApp, envíe «Necesito 3 almuerzos» o «Transporte para 8 personas», complete la descripción y confirme.</p>
   <p className="text-xs text-slate-300">Las solicitudes confirmadas se guardan en Firestore y pasan a revisión de coordinación. El responsable, jornada y municipio se aplican a toda la sesión; costo inicial $0, por cotizar.</p>
   {readOnly?<p className="text-sm text-amber-200">Seleccione «Usar datos reales» para guardar en Firestore.</p>:<form className="grid gap-3 sm:grid-cols-2" onSubmit={e=>{e.preventDefault();const action=(e.nativeEvent as SubmitEvent).submitter?.getAttribute('value');void (action==='save'?wa.save(config):wa.start(config));}}>
    <Field label="WhatsApp receptor · con indicativo"><input className={input} type="tel" required maxLength={20} placeholder="57 + número de celular" value={config.phone} disabled={wa.running||wa.busy} onChange={e=>patch({phone:e.target.value})}/></Field>
    <Field label="Responsable de recepción"><input required minLength={3} maxLength={120} className={input} value={config.responsibleName} disabled={wa.running||wa.busy} onChange={e=>patch({responsibleName:e.target.value})}/></Field>
    <Field label="Jornada de recepción"><select className={input} value={config.eventId} disabled={wa.running||wa.busy} onChange={e=>patch({eventId:e.target.value,municipality:events.find(v=>v.id===e.target.value)?.municipality||config.municipality})}><option value="">Crear o usar jornada de recepción WhatsApp</option>{config.eventId&&!events.some(e=>e.id===config.eventId&&['Planificado','En curso'].includes(e.status))&&<option value={config.eventId}>Jornada guardada · se validará al iniciar</option>}{events.filter(e=>['Planificado','En curso'].includes(e.status)).map(e=><option key={e.id} value={e.id}>{e.name}</option>)}</select></Field>
    <Field label="Municipio"><input className={input} required maxLength={120} value={config.municipality} disabled={wa.running||wa.busy} onChange={e=>patch({municipality:e.target.value})}/></Field>
    <p className="text-xs text-slate-400 sm:col-span-2">Al guardar se conserva el número y se crea la ficha operativa del responsable. Si no selecciona una jornada existente, se crea una jornada de recepción. La configuración se recupera al volver a entrar.</p>
    <div className="flex flex-wrap items-center gap-3 sm:col-span-2"><button type="submit" value="save" className={secondary} disabled={wa.running||wa.busy}>{wa.busy?'Procesando…':'Guardar configuración'}</button><button type="submit" value="start" className={button} disabled={wa.running||wa.busy}>Iniciar / reanudar recepción</button>{wa.running?<button type="button" className={secondary} onClick={wa.stop}>Detener recepción</button>:<button type="button" className={secondary} disabled={wa.busy} onClick={()=>{wa.reset();void wa.start(config);}}>Nueva vinculación</button>}</div>
   </form>}
   <p role="status" className="text-sm text-slate-300">{wa.status}</p>
   <WhatsappDiagnosticsPanel/>
   {wa.code&&<div className="rounded-xl border border-emerald-700 bg-emerald-950/30 p-4"><p className="text-sm">En el teléfono receptor: WhatsApp → Dispositivos vinculados → Vincular un dispositivo → Vincular con número de teléfono.</p><p className="mt-3 select-all break-all font-mono text-3xl tracking-widest text-emerald-200">{wa.code}</p><p className="mt-2 text-xs text-slate-400">Ingrese este código ahora desde el teléfono receptor. Espere a ver «WhatsApp conectado · recepción activa» antes de enviar mensajes. Si vence, inicie de nuevo para obtener otro código. No lo comparta.</p></div>}
   {wa.error&&<p role="alert" className="rounded-lg bg-rose-950/40 p-3 text-sm text-rose-200">{wa.error}</p>}
   {wa.saved.length>0&&<div className="space-y-2 text-sm text-emerald-200"><p>{wa.saved.length} solicitudes confirmadas durante esta pestaña.</p>{wa.saved.map(id=><p key={id} className="break-all text-xs">{requests.some(r=>r.id===id)?'Visible en la plataforma':'Esperando actualización de la lista'} · {id}</p>)}</div>}
   <p className="text-xs text-slate-400">{wa.wake?'Pantalla activa solicitada al navegador. ':''}En celular, mantenga Astrea en primer plano para evitar que Android suspenda la recepción. Al cerrar o recargar la pestaña deberá iniciar una nueva vinculación; las solicitudes permanecen guardadas. Detener recepción conserva el vínculo para reanudar en esta pestaña. Para retirarlo por completo, use «Dispositivos vinculados» en WhatsApp.</p>
  </div>}
 </section>;
}

