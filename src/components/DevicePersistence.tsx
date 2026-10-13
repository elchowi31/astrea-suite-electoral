import React, { useEffect, useState } from 'react';
import { browserLocalPersistence, browserSessionPersistence, indexedDBLocalPersistence, onAuthStateChanged, setPersistence, signOut } from 'firebase/auth';
import { clearIndexedDbPersistence, terminate } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { chooseDeviceStorage, clearDeviceData, deviceChoice, localDataEnabled, registerOfflineApp, queuedLocations, queuedAutomaticRoutes } from '../lib/deviceStorage';
import { ensureSeed, gpsOnboardingNeeded, nativeTrackingOnboardingNeeded, gpsPermission, readSeed, requestGps, prepareNativeTracking, updateSeed } from '../lib/deviceSeed';
import { isNativeApp, openAppSettings } from '../lib/nativeTracking';

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
  const [gpsStep,setGpsStep] = useState(false); const [reloadAfter,setReloadAfter] = useState(false); const [gpsNote,setGpsNote] = useState('');
  useEffect(() => { if (choice) void setPersistence(auth,choice.enabled ? savedSession : browserSessionPersistence).catch(() => {}); void registerOfflineApp().catch(() => {}); },[choice]);
  useEffect(() => { if (!deviceChoice()) return; ensureSeed(); void gpsPermission().then(state => {
    if (state !== 'unknown' && state !== 'prompt') updateSeed({ gps:state,gpsCheckedAt:new Date().toISOString() });
    if (gpsOnboardingNeeded(readSeed(),state) || (native && nativeTrackingOnboardingNeeded(readSeed()))) setGpsStep(true);
  }).catch(() => {}); },[]);
  useEffect(() => onAuthStateChanged(auth,user => {
    if (localDataEnabled() && user) localStorage.setItem('astrea-device-user',JSON.stringify({ uid:user.uid,email:user.email,displayName:user.displayName }));
    else localStorage.removeItem('astrea-device-user');
  }),[]);
  const finish = () => { setGpsStep(false); if (reloadAfter) window.location.reload(); };
  return <>{children}{!choice && <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/90 p-4" role="dialog" aria-modal="true" aria-labelledby="device-consent-title">
    <section className="w-full max-w-lg space-y-4 rounded-2xl border border-cyan-700 bg-slate-900 p-6 text-slate-200">
      <p className="text-xs font-semibold uppercase tracking-wider text-cyan-300">Configurar este dispositivo · paso 1 de 2</p>
      <h2 id="device-consent-title" className="text-xl font-bold text-white">Guardar Astrea en este dispositivo</h2>
      <p className="text-sm">Permita conservar su sesión, los datos consultados y las posiciones GPS pendientes para continuar después y sincronizar cuando vuelva la conexión. Elija esta opción en su propio celular.</p>
      <p className="text-xs text-slate-400">Esta configuración se hace una sola vez por dispositivo. Al guardar, Astrea recuerda sus permisos y no vuelve a preguntar. Puede retirar los datos desde «Mi dispositivo».</p>
      {error && <p role="alert" className="text-amber-300">{error}</p>}
      <div className="flex flex-wrap gap-2">{([[true,'Permitir y guardar'],[false,'Continuar sin guardar']] as const).map(([enabled,label]) => <button key={String(enabled)} className={enabled ? primary : button} disabled={busy} onClick={async () => {
        setBusy(true); setError(''); try {
          const next = await chooseDeviceStorage(enabled); await setPersistence(auth,next.enabled ? savedSession : browserSessionPersistence); ensureSeed();
          const state = await gpsPermission(); if (state !== 'unknown' && state !== 'prompt') updateSeed({ gps:state,gpsCheckedAt:new Date().toISOString() });
          if (gpsOnboardingNeeded(readSeed(),state) || (native && nativeTrackingOnboardingNeeded(readSeed()))) { setReloadAfter(true); setChoice(next); setGpsStep(true); setBusy(false); } else window.location.reload();
        } catch { setError('No se pudo guardar la elección. Revise si el navegador bloquea el almacenamiento.'); setBusy(false); }
      }}>{label}</button>)}</div>
    </section>
  </div>}{choice && gpsStep && <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/90 p-4" role="dialog" aria-modal="true" aria-labelledby="device-gps-title">
    <section className="w-full max-w-lg space-y-4 rounded-2xl border border-cyan-700 bg-slate-900 p-6 text-slate-200">
      <p className="text-xs font-semibold uppercase tracking-wider text-cyan-300">Configurar este dispositivo · paso 2 de 2</p>
      <h2 id="device-gps-title" className="text-xl font-bold text-white">{native?'Preparar seguimiento automático':'Activar la ubicación GPS'}</h2>
      <p className="text-sm">{native?'Al aceptar, autoriza a Astrea a detectar y registrar sus desplazamientos con GPS y el sensor de movimiento, también con la pantalla apagada y después de iniciar sesión. Solo se guarda el historial cuando hay traslado real. Únicamente los administradores autorizados pueden ver y gestionar el seguimiento.':'Astrea usa el GPS para registrar los recorridos que usted inicia y para ubicar líderes y vehículos. Solo captura posiciones mientras un recorrido está en curso.'}</p>
      <p className="text-xs text-slate-400">{native?'Los permisos se solicitan una sola vez. Autorice la ubicación precisa («Mientras se usa la app»); puede bloquear las notificaciones y continuar. Android conserva sus indicadores del servicio activo. El seguimiento no genera sonidos, vibraciones ni avisos emergentes. Mantenga activada la ubicación del teléfono y configure la batería de Astrea sin restricciones.':'El navegador solicitará el permiso de ubicación. Astrea recuerda su elección y puede reanudar los recorridos en curso al abrirse mientras conserve el permiso.'}</p>
      {gpsNote && <p role="status" className="text-sm text-amber-300">{gpsNote}</p>}
      <div className="flex flex-wrap gap-2">
        <button className={primary} disabled={busy} onClick={async () => { setBusy(true); setGpsNote(''); try { if(native&&!localDataEnabled())throw new Error('Primero active la conservación de datos en «Mi dispositivo».');const result = native?await prepareNativeTracking():await requestGps();
          if (result.state === 'granted') { if(native){updateSeed({automaticTracking:true,automaticPaused:false,trackingSetupCompleted:true});setReloadAfter(true);window.location.reload();}else finish(); } else setGpsNote(result.state === 'unsupported' ? 'Este dispositivo no ofrece GPS.' : deniedHelp); } catch (error) { setGpsNote((error as Error).message); } finally { setBusy(false); } }}>{busy ? 'Preparando…' : native?'Activar seguimiento automático':'Permitir ubicación'}</button>
        {native&&gpsNote&&<button className={button} onClick={()=>void openAppSettings().catch(error=>setGpsNote(error.message))}>Abrir permisos de Astrea</button>}
        {native&&!gpsNote&&<button className={button} onClick={()=>void openAppSettings().catch(error=>setGpsNote(error.message))}>Configurar batería sin restricciones</button>}
        <button className={button} disabled={busy} onClick={() => { updateSeed({ gpsAskedAt:new Date().toISOString(),...(native?{automaticTracking:false,trackingSetupCompleted:true}:{}) }); finish(); }}>Ahora no</button>
      </div>
    </section>
  </div>}</>;
}
export function DevicePersistencePanel() {
  const [choice,setChoice] = useState(deviceChoice); const [usage,setUsage] = useState<StorageEstimate>(); const [message,setMessage] = useState(''); const [busy,setBusy] = useState(false);
  const [seed,setSeed] = useState(ensureSeed); const [gps,setGps] = useState(seed.gps);
  useEffect(() => { void navigator.storage?.estimate?.().then(setUsage); const refresh=()=>void gpsPermission().then(state=>{setGps(state);setSeed(updateSeed({gps:state}));}).catch(error=>setMessage((error as Error).message));refresh();document.addEventListener('visibilitychange',refresh);return()=>document.removeEventListener('visibilitychange',refresh); },[]);
  const gpsText = { granted:'autorizado (no se volverá a preguntar)', denied:'bloqueado en el navegador', prompt:'pendiente de autorizar', unsupported:'no disponible en este navegador', unknown:'sin verificar' }[gps];
  return <section className="space-y-4 rounded-2xl border border-slate-700 bg-slate-900 p-6 text-slate-200"><h2 className="text-xl font-bold text-white">Mi dispositivo</h2>
    <p>Datos locales: {choice?.enabled ? 'activados' : 'desactivados'}. Sesión: {choice?.enabled ? 'conservada entre aperturas' : 'hasta cerrar esta sesión del navegador'}.</p>
    <p className="text-sm">Identificador del dispositivo: <code className="text-cyan-300">{seed.deviceId.slice(0,8)}</code> · registrado {new Date(seed.createdAt).toLocaleDateString('es-CO')} · GPS: <b>{gpsText}</b>{seed.activeRouteId ? ' · hay un recorrido activo en este dispositivo' : ''}.</p>
    {gps === 'denied' && <p className="text-sm text-amber-300">{deniedHelp}</p>}
    {native && <button className={button} onClick={()=>void openAppSettings().catch(error=>setMessage(error.message))}>Revisar permisos y batería</button>}
    {(gps === 'prompt' || gps === 'unknown') && <button className={primary} disabled={busy} onClick={async () => { setBusy(true); try { const result = await requestGps(); setGps(result.state); setSeed(ensureSeed()); } catch (error) { setMessage((error as Error).message); } finally { setBusy(false); } }}>Autorizar GPS en este dispositivo</button>}
    <p className="text-sm">Almacenamiento protegido por el navegador: {choice?.persistent ? 'concedido' : 'no concedido; los datos siguen guardados, pero el navegador puede eliminarlos para liberar espacio'}. {usage?.usage !== undefined && `Espacio usado por este sitio: ${(usage.usage/1048576).toFixed(1)} MB.`}</p>
    <p className="text-sm text-slate-400">Los datos sincronizados siguen en Firestore. {native?'Los datos pendientes se conservan en esta app. Desinstalarla o borrar sus datos elimina lo que aún no se haya sincronizado. Configure la batería de Astrea sin restricciones para continuar con la pantalla apagada. Puede mantener las notificaciones bloqueadas.':'Los datos locales se conservan en este navegador. Para registrar GPS mantenga Astrea abierta y el seguimiento iniciado; con el navegador cerrado o suspendido no se garantiza la captura.'}</p>
    <div className="flex flex-wrap gap-3"><button className={button} disabled={busy} onClick={async () => { setBusy(true); try { await chooseDeviceStorage(true); await setPersistence(auth,savedSession); window.location.reload(); } catch (error) { setMessage((error as Error).message); setBusy(false); } }}>Activar conservación de datos</button>
    <button className={button} disabled={busy} onClick={async () => { setBusy(true); setMessage(''); try {
      if ((await queuedLocations()).length || (await queuedAutomaticRoutes()).length) throw new Error('Hay recorridos o posiciones GPS pendientes. Sincronícelos desde la cuenta que los registró antes de retirar los datos.');
      await signOut(auth); await terminate(db); await clearIndexedDbPersistence(db); await clearDeviceData(); await chooseDeviceStorage(false); window.location.reload();
    } catch (error) { setMessage((error as Error).message); setBusy(false); } }}>Retirar datos locales y cerrar sesión</button></div>
    {message && <p role="status" className="text-amber-300">{message}</p>}
  </section>;
}
