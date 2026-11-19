import React,{useEffect,useRef,useState} from 'react';
import {MessageCircle} from 'lucide-react';
import {WhatsappDiagnosticsPanel} from './WhatsappDiagnosticsPanel';
import {useOperations} from './OperationsContext';
import {useWhatsappConnection} from './WhatsappConnectionContext';
import {localDataEnabled} from '../../lib/deviceStorage';
import {button,input,secondary,Field} from './OperationsUI';
function WhatsappQr({value}:{value:string}){
 const [image,setImage]=useState(''),[error,setError]=useState('');
 useEffect(()=>{let active=true;setImage('');setError('');void import('qrcode').then(module=>module.toDataURL(value,{width:280,margin:4,errorCorrectionLevel:'M',color:{dark:'#000000',light:'#ffffff'}})).then(url=>{if(active)setImage(url);}).catch(()=>{if(active)setError('No se pudo dibujar el QR. Puede solicitar un código numérico.');});return()=>{active=false;};},[value]);
 return image?<img src={image} width={280} height={280} alt="QR para vincular el receptor de WhatsApp" className="whatsapp-qr"/>:<p role={error?'alert':'status'}>{error||'Preparando la imagen del QR…'}</p>;
}
export function WhatsappPilotPanel({onSwitchAccount,onUseRealData}:{onSwitchAccount?:()=>void;onUseRealData?:()=>void}){
 const {user,readOnly,events,requests}=useOperations(),wa=useWhatsappConnection();const [open,setOpen]=useState(true),[actionError,setActionError]=useState('');const codePanel=useRef<HTMLDivElement|null>(null);
 const hasPairing=!!(wa.code||wa.qr);
 useEffect(()=>{if(wa.code||wa.qr)setOpen(true);},[wa.code,wa.qr]);
 useEffect(()=>{if(!open||!hasPairing)return;const frame=requestAnimationFrame(()=>{codePanel.current?.scrollIntoView({block:'nearest',behavior:'instant'});});return()=>cancelAnimationFrame(frame);},[open,hasPairing]);
 const patch=(value:Partial<typeof wa.config>)=>wa.setConfig(previous=>({...previous,...value}));
 if(user?.role!=='AdminGlobal')return <details className="compact-disclosure" aria-label="Vincular WhatsApp"><summary>WhatsApp · acceso al receptor</summary><p className="my-2 text-sm">La vinculación del receptor requiere una cuenta administradora global. Su cuenta puede gestionar las solicitudes según sus permisos.</p>{onSwitchAccount&&<button type="button" className={secondary} onClick={onSwitchAccount}>Cambiar cuenta</button>}</details>;
 const reset=async()=>{setActionError('');try{await wa.reset();}catch{setActionError('No se pudo retirar el vínculo de este dispositivo. Puede revisar el almacenamiento en Mi dispositivo.');}};
 return <section aria-label="Vincular WhatsApp" className="whatsapp-panel">
  <button type="button" className="whatsapp-panel-toggle" aria-expanded={open} onClick={()=>setOpen(value=>!value)}><MessageCircle size={20}/><span>WhatsApp · {wa.connected?'conectado':wa.running?'conectando':'vincular receptor'}</span><span>{open?'Cerrar':'Abrir'}</span></button>
  {!open&&wa.error&&<p role="alert" className="compact-alert">{wa.error}</p>}
  {open&&<div className="whatsapp-panel-body">
   {readOnly?<div><p className="text-sm">La vinculación usa los datos reales de la organización.</p>{onUseRealData&&<button className={button} onClick={onUseRealData}>Usar datos reales y vincular</button>}</div>:<form className="compact-form-grid" onSubmit={event=>{event.preventDefault();const action=(event.nativeEvent as SubmitEvent).submitter?.getAttribute('value');setActionError('');void (action==='save'?wa.save(wa.config):wa.start(wa.config,action==='code'?'code':'qr'));}}>
    <Field label="Número receptor · con indicativo"><input required type="tel" maxLength={20} className={input} placeholder="57 + número de celular" value={wa.config.phone} disabled={wa.running||wa.busy} onChange={event=>patch({phone:event.target.value})}/></Field>
    <Field label="Responsable"><input required minLength={3} maxLength={120} className={input} value={wa.config.responsibleName} disabled={wa.running||wa.busy} onChange={event=>patch({responsibleName:event.target.value})}/></Field>
    <Field label="Jornada de recepción"><select className={input} value={wa.config.eventId} disabled={wa.running||wa.busy} onChange={event=>patch({eventId:event.target.value,municipality:events.find(item=>item.id===event.target.value)?.municipality||wa.config.municipality})}><option value="">Crear o usar jornada de recepción</option>{wa.config.eventId&&!events.some(item=>item.id===wa.config.eventId&&['Planificado','En curso'].includes(item.status))&&<option value={wa.config.eventId}>Jornada guardada · se verificará al iniciar</option>}{events.filter(item=>['Planificado','En curso'].includes(item.status)).map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
    <Field label="Municipio"><input required maxLength={120} className={input} value={wa.config.municipality} disabled={wa.running||wa.busy} onChange={event=>patch({municipality:event.target.value})}/></Field>
    <label className="whatsapp-remember"><input type="checkbox" checked={wa.remember} disabled={!localDataEnabled()} onChange={event=>wa.setRemember(event.target.checked)}/>Recordar el vínculo y reconectar al abrir Astrea en este dispositivo</label>
    {!localDataEnabled()&&<p className="text-xs text-slate-400">Para recordar el vínculo, active la conservación de datos en Mi dispositivo.</p>}
    <div className="whatsapp-link-actions"><button type="submit" value="qr" className={button} disabled={wa.running||wa.busy}>{wa.remembered?'Reanudar vínculo':'Generar QR'}</button><button type="submit" value="code" className={secondary} disabled={wa.running||wa.busy}>Generar código</button><button type="submit" value="save" className={secondary} disabled={wa.running||wa.busy}>Guardar datos</button>{wa.running&&<button type="button" className={secondary} onClick={wa.stop}>Pausar recepción</button>}<button type="button" className={secondary} disabled={wa.busy} onClick={()=>void reset()}>Nuevo vínculo</button></div>
   </form>}
   <p role="status" className="text-sm">{wa.status}{wa.remembered?' · vínculo conservado en este dispositivo':''}</p>
   {(wa.code||wa.qr)&&<div ref={codePanel} tabIndex={-1} role="region" aria-label="Vinculación de WhatsApp" className="whatsapp-pairing">
    <h3>{wa.qr?'Escanee el QR':'Ingrese este código'}</h3>{wa.qr?<WhatsappQr value={wa.qr}/>:<p className="whatsapp-code">{wa.code}</p>}
    <p>En el teléfono receptor: WhatsApp → Dispositivos vinculados → Vincular un dispositivo{wa.code?' → Vincular con número de teléfono.':'.'}</p><p className="text-xs">Espere a ver «WhatsApp conectado · recepción activa». Si vence, pulse Nuevo vínculo y genere otro QR o código. No comparta estos datos.</p>
   </div>}
   {(wa.error||actionError)&&<p role="alert" className="compact-alert">{actionError||wa.error}</p>}
   <details className="compact-disclosure"><summary>Recepción, reconexión y ayuda</summary><p>La recepción continúa al cambiar de módulo y reintenta los cortes de conexión. Si recuerda el vínculo, Astrea puede recuperarlo al volver a abrir con esta cuenta y organización, mientras siga vigente. Pausar detiene la recepción y su arranque automático; Reanudar conserva el mismo vínculo.</p><p className="mt-2">Mantenga Astrea abierta y activa. Al cerrar la aplicación no hay recepción permanente. Los mensajes del intervalo cerrado o pausado no se incorporan automáticamente; los trabajos ya aceptados permanecen guardados.</p><p className="mt-2">Las solicitudes confirmadas se guardan para revisión. Para desvincular también el teléfono, retire Astrea desde Dispositivos vinculados de WhatsApp. Puede retirar la copia de este equipo desde Mi dispositivo.</p><WhatsappDiagnosticsPanel/></details>
   {wa.saved.length>0&&<p className="text-xs text-emerald-300">{wa.saved.length} solicitudes guardadas en esta recepción · {wa.saved.filter(id=>requests.some(item=>item.id===id)).length} visibles en el listado</p>}
  </div>}
 </section>;
}
