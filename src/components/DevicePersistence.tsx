import React, { useEffect, useState } from 'react';
import { browserLocalPersistence, browserSessionPersistence, indexedDBLocalPersistence, onAuthStateChanged, setPersistence, signOut } from 'firebase/auth';
import { clearIndexedDbPersistence, terminate, waitForPendingWrites } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { chooseDeviceStorage, clearDeviceData, deviceChoice, localDataEnabled, registerOfflineApp, offlineAppReadiness, queuedLocations, queuedAutomaticRoutes } from '../lib/deviceStorage';
import { ensureSeed, trackingConsentNeeded, gpsOnboardingNeeded, nativeTrackingOnboardingNeeded, gpsPermission, readSeed, requestGps, prepareNativeTracking, updateSeed } from '../lib/deviceSeed';
import { isNativeApp, openAppSettings } from '../lib/nativeTracking';
import { discardFailedOfflineMutation, queuedOfflineMutations, retryOfflineMutations, setOfflineMutationScope, syncOfflineMutations, type MutationScope, type OfflineMutation } from '../lib/offlineMutations';

const button = 'rounded-xl border border-slate-600 bg-slate-800 px-4 py-3 text-sm text-white disabled:opacity-50';
const primary = 'rounded-xl border border-cyan-500 bg-cyan-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50';
const native = isNativeApp();
const savedSession = native ? indexedDBLocalPersistence : browserLocalPersistence;
const deniedHelp = native ? 'Permita la ubicación precisa en Ajustes › Apps › Astrea Suite › Permisos › Ubicación › Mientras se usa la app. Active también la ubicación del teléfono.' : 'El navegador tiene bloqueada la ubicación para Astrea. Para activarla: toque el candado junto a la dirección › Permisos › Ubicación › Permitir. En iPhone: Ajustes › Safari › Ubicación › Permitir (o Ajustes › Privacidad › Localización).';
/**
 * Configuración de primera apertura: se muestra una sola vez por dispositivo.
 * Paso 1: conservar sesión y datos. Paso 2: autorizar el GPS. Después Astrea no vuelve a preguntar;
 * solo consulta el estado del permiso en silencio y lo anota en la semilla del dispositivo.
 */
export function DevicePersistenceBoundary({ children }: { children: React.ReactNode }) {
  const [choice,setChoice] = useState(deviceChoice); const [busy,setBusy] = useState(false); const [error,setError] = useState('');
  const [gpsStep,setGpsStep] = useState(()=>!!deviceChoice()&&trackingConsentNeeded(readSeed())); const [reloadAfter,setReloadAfter] = useState(false); const [gpsNote,setGpsNote] = useState('');
  useEffect(() => { if (choice) void setPersistence(auth,choice.enabled ? savedSession : browserSessionPersistence).catch(() => {}); void registerOfflineApp().catch(() => {}); },[choice]);
  useEffect(() => { if (!deviceChoice()) return; ensureSeed(); void gpsPermission().then(state => {
    if (state !== 'unknown' && state !== 'prompt') updateSeed({ gps:state,gpsCheckedAt:new Date().toISOString() });
    if (trackingConsentNeeded(readSeed()) || gpsOnboardingNeeded(readSeed(),state) || (native && nativeTrackingOnboardingNeeded(readSeed()))) setGpsStep(true);
  }).catch(() => {}); },[]);
  useEffect(() => onAuthStateChanged(auth,user => {
    if (localDataEnabled() && user) localStorage.setItem('astrea-device-user',JSON.stringify({ uid:user.uid,email:user.email,displayName:user.displayName }));
    else localStorage.removeItem('astrea-device-user');
  }),[]);
  const finish = () => { setGpsStep(false); if (reloadAfter) window.location.reload(); };
  return <>{choice&&!gpsStep&&children}{!choice && <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/90 p-4" role="dialog" aria-modal="true" aria-labelledby="device-consent-title">
    <section className="w-full max-w-lg space-y-4 rounded-2xl border border-cyan-700 bg-slate-900 p-6 text-slate-200">
      <p className="text-xs font-semibold uppercase tracking-wider text-cyan-300">Configurar este dispositivo · paso 1 de 2</p>
      <h2 id="device-consent-title" className="text-xl font-bold text-white">Guardar Astrea en este dispositivo</h2>
      <p className="text-sm">Permita conservar su sesión, los datos consultados y las posiciones GPS pendientes para continuar después y sincronizar cuando vuelva la conexión. Elija esta opción en su propio celular.</p>
      <p className="text-xs text-slate-400">Esta configuración se hace una sola vez por dispositivo. Al guardar, Astrea recuerda sus permisos y no vuelve a preguntar. Puede retirar la autorización y borrar los datos desde los ajustes del dispositivo.</p>
      {error && <p role="alert" className="text-amber-300">{error}</p>}
      <div className="flex flex-wrap gap-2">{([[true,'Permitir y guardar'],[false,'Continuar sin guardar']] as const).map(([enabled,label]) => <button key={String(enabled)} className={enabled ? primary : button} disabled={busy} onClick={async () => {
        setBusy(true); setError(''); try {
          const next = await chooseDeviceStorage(enabled); await setPersistence(auth,next.enabled ? savedSession : browserSessionPersistence); ensureSeed();
          const state = await gpsPermission(); if (state !== 'unknown' && state !== 'prompt') updateSeed({ gps:state,gpsCheckedAt:new Date().toISOString() });
          if (trackingConsentNeeded(readSeed()) || gpsOnboardingNeeded(readSeed(),state) || (native && nativeTrackingOnboardingNeeded(readSeed()))) { setReloadAfter(true); setChoice(next); setGpsStep(true); setBusy(false); } else window.location.reload();
        } catch { setError('No se pudo guardar la elección. Revise si el navegador bloquea el almacenamiento.'); setBusy(false); }
      }}>{label}</button>)}</div>
    </section>
  </div>}{choice && gpsStep && <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/90 p-4" role="dialog" aria-modal="true" aria-labelledby="device-gps-title">
    <section className="w-full max-w-lg space-y-4 rounded-2xl border border-cyan-700 bg-slate-900 p-6 text-slate-200">
      <p className="text-xs font-semibold uppercase tracking-wider text-cyan-300">Configurar este dispositivo · paso 2 de 2</p>
      <h2 id="device-gps-title" className="text-xl font-bold text-white">{native?'Preparar seguimiento automático':'Activar la ubicación GPS'}</h2>
      <p className="text-sm">{native?'Al aceptar, autoriza a Astrea a detectar y registrar sus desplazamientos con GPS y el sensor de movimiento, también con la pantalla apagada y después de iniciar sesión. Solo se guarda el historial cuando hay traslado real. Únicamente los administradores autorizados pueden ver y gestionar el seguimiento.':'Al aceptar, autoriza a Astrea a compartir su ubicación y registrar sus desplazamientos mientras esta aplicación esté abierta, para coordinar el trabajo y los vehículos. Solo los administradores autorizados pueden consultar y gestionar el seguimiento.'}</p>
      <p className="text-xs text-slate-400">{native?'Los permisos se solicitan una sola vez. Autorice la ubicación precisa («Mientras se usa la app»); puede bloquear las notificaciones y continuar. Android conserva sus indicadores del servicio activo. Mantenga activada la ubicación del teléfono y configure la batería de Astrea sin restricciones.':'El navegador solicitará ubicación. El seguimiento comienza después de iniciar sesión y necesita mantener Astrea abierta. Puede pausarlo o retirar el permiso.'} El seguimiento es opcional: puede usar los formularios y guardar datos sin autorizar la ubicación.</p>
      {gpsNote && <p role="status" className="text-sm text-amber-300">{gpsNote}</p>}
      <div className="flex flex-wrap gap-2">
        <button className={primary} disabled={busy} onClick={async () => { setBusy(true); setGpsNote(''); try { if(!localDataEnabled()){await chooseDeviceStorage(true);await setPersistence(auth,savedSession);}const result = native?await prepareNativeTracking():await requestGps();
          if (result.state === 'granted') { updateSeed({automaticTracking:true,automaticPaused:false,trackingSetupCompleted:true,trackingConsentVersion:1,trackingConsentAt:new Date().toISOString()});window.location.reload(); } else setGpsNote(result.state === 'unsupported' ? 'Este dispositivo no ofrece GPS.' : deniedHelp); } catch (error) { setGpsNote((error as Error).message); } finally { setBusy(false); } }}>{busy ? 'Preparando…' : 'Acepto y autorizo el seguimiento'}</button>
        {native&&gpsNote&&<button className={button} onClick={()=>void openAppSettings().catch(error=>setGpsNote(error.message))}>Abrir permisos de Astrea</button>}
        {native&&!gpsNote&&<button className={button} onClick={()=>void openAppSettings().catch(error=>setGpsNote(error.message))}>Configurar batería sin restricciones</button>}
        <button className={button} disabled={busy} onClick={()=>{updateSeed({automaticTracking:false,automaticPaused:true,trackingSetupCompleted:true,trackingConsentAt:undefined,trackingConsentVersion:undefined});finish();}}>Continuar sin seguimiento</button>
      </div>
    </section>
  </div>}</>;
}
export function DevicePersistencePanel() {
  const [choice,setChoice] = useState(deviceChoice); const [usage,setUsage] = useState<StorageEstimate>(); const [message,setMessage] = useState(''); const [busy,setBusy] = useState(false);
  const [seed,setSeed] = useState(ensureSeed); const [gps,setGps] = useState(seed.gps);
  const [offlineReady,setOfflineReady]=useState('Comprobando preparación sin internet…');
  useEffect(()=>{let active=true;void offlineAppReadiness().then(value=>{if(active)setOfflineReady(value);}).catch(()=>{if(active)setOfflineReady('No se pudo confirmar la preparación sin internet. Vuelva a comprobar con conexión.');});return()=>{active=false;};},[]);
  useEffect(() => { void navigator.storage?.estimate?.().then(setUsage); const refresh=()=>void gpsPermission().then(state=>{setGps(state);setSeed(updateSeed({gps:state}));}).catch(error=>setMessage((error as Error).message));refresh();document.addEventListener('visibilitychange',refresh);return()=>document.removeEventListener('visibilitychange',refresh); },[]);
  const gpsText = { granted:'autorizado (no se volverá a preguntar)', denied:'bloqueado en el navegador', prompt:'pendiente de autorizar', unsupported:'no disponible en este navegador', unknown:'sin verificar' }[gps];
  return <section className="space-y-4 rounded-2xl border border-slate-700 bg-slate-900 p-6 text-slate-200"><h2 className="text-xl font-bold text-white">Mi dispositivo</h2>
    <p>Datos locales: {choice?.enabled ? 'activados' : 'desactivados'}. Sesión: {choice?.enabled ? 'conservada entre aperturas' : 'hasta cerrar esta sesión del navegador'}.</p>
    <div className="rounded-xl border border-slate-700 p-3"><p role="status" className="text-sm">{offlineReady}</p><p className="mt-2 text-xs text-slate-400">Antes de salir sin señal, inicie sesión, abra las listas que necesite y espere a que carguen. Las aprobaciones, reservas de cupos, servicios de Google e IA necesitan conexión.</p><button className={`${button} mt-2`} onClick={()=>void offlineAppReadiness().then(setOfflineReady).catch(()=>setOfflineReady('No se pudo comprobar. Revise la conexión.'))}>Comprobar preparación sin internet</button></div>
    <p className="text-sm">Identificador del dispositivo: <code className="text-cyan-300">{seed.deviceId.slice(0,8)}</code> · registrado {new Date(seed.createdAt).toLocaleDateString('es-CO')} · GPS: <b>{gpsText}</b>{seed.activeRouteId ? ' · hay un recorrido activo en este dispositivo' : ''}.</p>
    {gps === 'denied' && <p className="text-sm text-amber-300">{deniedHelp}</p>}
    {native && <button className={button} onClick={()=>void openAppSettings().catch(error=>setMessage(error.message))}>Revisar permisos y batería</button>}
    {!seed.automaticTracking && <button className={button} onClick={()=>{updateSeed({automaticTracking:undefined,automaticPaused:undefined,trackingSetupCompleted:false,trackingConsentAt:undefined,trackingConsentVersion:undefined});window.location.reload();}}>Activar seguimiento voluntario</button>}
    {(gps === 'prompt' || gps === 'unknown') && <button className={primary} disabled={busy} onClick={async () => { setBusy(true); try { const result = await requestGps(); setGps(result.state); setSeed(ensureSeed()); } catch (error) { setMessage((error as Error).message); } finally { setBusy(false); } }}>Autorizar GPS en este dispositivo</button>}
    <p className="text-sm">Almacenamiento protegido por el navegador: {choice?.persistent ? 'concedido' : 'no concedido; los datos siguen guardados, pero el navegador puede eliminarlos para liberar espacio'}. {usage?.usage !== undefined && `Espacio usado por este sitio: ${(usage.usage/1048576).toFixed(1)} MB.`}</p>
    <p className="text-sm text-slate-400">Los datos sincronizados siguen en Firestore. {native?'Los datos pendientes se conservan en esta app. Desinstalarla o borrar sus datos elimina lo que aún no se haya sincronizado. Configure la batería de Astrea sin restricciones para continuar con la pantalla apagada. Puede mantener las notificaciones bloqueadas.':'Los datos locales se conservan en este navegador. Para registrar GPS mantenga Astrea abierta y el seguimiento iniciado; con el navegador cerrado o suspendido no se garantiza la captura.'}</p>
    <div className="flex flex-wrap gap-3"><button className={button} disabled={busy} onClick={async () => { setBusy(true); try { await chooseDeviceStorage(true); await setPersistence(auth,savedSession); window.location.reload(); } catch (error) { setMessage((error as Error).message); setBusy(false); } }}>Activar conservación de datos</button>
    <button className={button} disabled={busy} onClick={async () => { setBusy(true); setMessage(''); try {
      if ((await queuedLocations()).length || (await queuedAutomaticRoutes()).length) throw new Error('Hay recorridos o posiciones GPS pendientes. Sincronícelos desde la cuenta que los registró antes de retirar los datos.');
      if ((await queuedOfflineMutations()).length) throw new Error('Hay formularios pendientes en este dispositivo. Sincronícelos o respáldelos y resuelva sus errores antes de retirar los datos.');
      let timer: ReturnType<typeof setTimeout>;
      const synchronized = await Promise.race([waitForPendingWrites(db).then(()=>true),new Promise<boolean>(resolve=>{timer=setTimeout(()=>resolve(false),4000);})]);clearTimeout(timer!);
      if(!synchronized)throw new Error('Firestore todavía tiene escrituras pendientes. Conéctese a internet y espere a que termine la sincronización antes de retirar los datos.');
      await signOut(auth); await terminate(db); await clearIndexedDbPersistence(db); await clearDeviceData(); await chooseDeviceStorage(false); window.location.reload();
    } catch (error) { setMessage((error as Error).message); setBusy(false); } }}>Retirar datos locales y cerrar sesión</button></div>
    {message && <p role="status" className="text-amber-300">{message}</p>}
  </section>;
}

/** Visible receipts for local captures; a pending capture never claims server confirmation. */
export function OfflineSyncStatus({userId,tenantId}:{userId:string;tenantId:string}) {
  const [rows,setRows]=useState<OfflineMutation[]>([]);const [online,setOnline]=useState(()=>navigator.onLine);const [error,setError]=useState('');const [working,setWorking]=useState(false);
  const scope:MutationScope={userId,tenantId};
  useEffect(()=>{
    if(!userId||!tenantId)return;
    let disposed=false;const current={userId,tenantId};setRows([]);setError('');setOfflineMutationScope(current);
    const refresh=()=>{setOnline(navigator.onLine);if(localDataEnabled())void queuedOfflineMutations(current).then(value=>{if(!disposed)setRows(value);}).catch(()=>{if(!disposed)setError('No se pudo consultar el almacenamiento local. Mantenga esta ventana abierta y respalde sus datos.');});};
    const synchronize=()=>{refresh();void syncOfflineMutations(current).catch(()=>{if(!disposed)setError('No se pudo sincronizar. Los datos siguen guardados en este dispositivo.');});};
    synchronize();const interval=setInterval(synchronize,15000);window.addEventListener('online',synchronize);window.addEventListener('offline',refresh);window.addEventListener('focus',synchronize);window.addEventListener('astrea:mutations-changed',refresh);
    return()=>{disposed=true;clearInterval(interval);window.removeEventListener('online',synchronize);window.removeEventListener('offline',refresh);window.removeEventListener('focus',synchronize);window.removeEventListener('astrea:mutations-changed',refresh);setOfflineMutationScope(null);};
  },[userId,tenantId]);
  if(online&&!rows.length&&!error)return null;
  const failed=rows.filter(row=>row.status==='failed');
  const backup=()=>{const blob=new Blob([JSON.stringify({exportedAt:new Date().toISOString(),scope,mutations:rows},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=`astrea-pendientes-${new Date().toISOString().slice(0,10)}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  return <aside aria-label="Estado de sincronización" className="fixed bottom-4 right-4 z-[80] max-h-[60vh] w-[calc(100%-2rem)] max-w-md overflow-auto rounded-xl border border-amber-500/50 bg-slate-950 p-4 text-sm text-slate-100 shadow-xl">
    <p role="status" className="font-semibold">{online?'Sincronización de formularios':'Sin conexión · modo sin internet'}</p>
    <p className="mt-1 text-xs text-slate-300">{rows.length?`${rows.length} cambio(s) conservado(s) en este dispositivo. ${failed.length?`${failed.length} requieren revisión.`:'Se enviarán al recuperar la conexión con esta cuenta y organización.'}`:'Puede consultar los datos ya cargados. Para conservar nuevas capturas, active los datos locales en Mi dispositivo.'}</p>
    {error&&<p role="alert" className="mt-2 text-rose-200">{error}</p>}
    {!!rows.length&&<details className="mt-2"><summary className="cursor-pointer text-cyan-300">Ver pendientes y respaldo</summary><p className="mt-2 text-xs text-slate-400">El respaldo contiene datos personales. Guárdelo en un lugar privado. Si un registro cambió en el servidor, revise ese registro antes de volver a capturarlo.</p><button className={`${button} mt-2`} onClick={backup}>Descargar respaldo de pendientes</button>
      <ul className="mt-3 space-y-1 text-xs text-slate-300">{rows.map(row=><li key={row.id}>{row.kind==='firestore-batch-v1'?(row.payload as {writes?:{collection:string}[]}).writes?.filter(item=>item.collection!=='auditoria').map(item=>item.collection).join(', '):({'record-edit':'Edición de ficha','committee-task':'Tarea de comité','committee-edit':'Edición de comité','operations-command':'Jornada, solicitud o reporte','attendance-registration':'Registro de planilla','map-fields':'Ubicación o trazado'}[row.kind]||'Formulario')} · {new Date(row.createdAt).toLocaleString('es-CO')} · {row.status==='failed'?'Requiere revisión':'Pendiente de envío'}</li>)}</ul>
      {failed.map(row=><section key={row.id} className="mt-2 rounded-lg border border-rose-500/40 p-2"><p role="alert" className="text-xs text-rose-200">{row.errorCode&&`${row.errorCode}: `}{row.error}</p><button className="mt-2 text-xs text-rose-300 underline" onClick={()=>{if(window.confirm('¿Retirar este cambio local con error? Descargue el respaldo primero. Esta acción no cambia los registros del servidor.'))void discardFailedOfflineMutation(scope,row.id).catch(error=>setError(error.message));}}>Retirar este cambio después de respaldarlo</button></section>)}
    </details>}
    {!!rows.length&&online&&<button className={`${button} mt-2`} disabled={working} onClick={async()=>{setWorking(true);setError('');try{await retryOfflineMutations(scope);}catch(error){setError((error as Error).message);}finally{setWorking(false);}}}>{working?'Sincronizando…':'Reintentar sincronización'}</button>}
  </aside>;
}
