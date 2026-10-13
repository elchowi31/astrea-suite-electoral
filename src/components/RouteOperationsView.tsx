import React,{useEffect,useMemo,useRef,useState} from 'react';
import {collection,onSnapshot,query,where} from 'firebase/firestore';
import type {Tenant,TransportVehicle,UserProfile} from '../types';
import {auth,db,persistEntity,subscribeToCollection} from '../lib/firebase';
import {isTrackingAdministrator} from '../lib/trackingPermissions';
import {importedRoute,type GeographicLayer} from '../lib/geographicImport';
import {type AssignedRoute,type RouteSample} from '../lib/routeTracking';
import {updateOperationalRecord} from '../lib/recordEditing';
import {localDataEnabled} from '../lib/deviceStorage';
import {useRouteTracking} from './RouteTrackingProvider';
import {LiveMonitorPanel} from './LiveMonitorPanel';
import {RouteHistoryList} from './RouteHistoryList';
import {RouteDetailView} from './RouteDetailView';
import {routeInviteText,smsInviteUrl,whatsappInviteUrl} from '../lib/livePosition';
interface RegisteredDevice {id:string;tenantId:string;userId:string;deviceId:string;label:string;gps:string;installed:boolean;activeRouteId:string;firstSeenAt:string;lastSeenAt:string}
/** Enlace que reciben los integrantes. En la app instalada se usa la dirección pública de la web. */
const APP_URL=typeof window!=='undefined'&&/^https?:\/\/(?!localhost)/.test(window.location.origin)?window.location.origin:'https://astrea-suite-electoral.vercel.app';
const input='mt-1 min-h-12 w-full min-w-0 rounded-lg border border-slate-600 bg-slate-950 p-3 text-base text-white';
const button='min-h-12 rounded-lg border border-slate-600 bg-slate-800 px-4 py-3 text-sm text-white disabled:opacity-40';
export function RouteOperationsView({user,tenantId,users,vehicles,tenants=[],onSelectTenant,initialRouteId=''}:{user:UserProfile;tenantId:string;users:UserProfile[];vehicles:TransportVehicle[];tenants?:Tenant[];onSelectTenant?:(tenant:Tenant)=>void;initialRouteId?:string}){
  const tracking=useRouteTracking();const manager=isTrackingAdministrator(user);const [layers,setLayers]=useState<GeographicLayer[]>([]);const [selected,setSelected]=useState('');const [samples,setSamples]=useState<RouteSample[]>([]);const [error,setError]=useState('');const [busy,setBusy]=useState(false);
  const [view,setView]=useState<'history'|'live'|'manage'>('history');
  useEffect(()=>{if(initialRouteId)setSelected(initialRouteId);},[initialRouteId]);
  const [samplesLoading,setSamplesLoading]=useState(false);const [samplesError,setSamplesError]=useState('');const [sampleAttempt,setSampleAttempt]=useState(0);
  const modulePanel=useRef<HTMLDivElement>(null);
  const [name,setName]=useState('');const [employee,setEmployee]=useState('');const [source,setSource]=useState('');const [vehicle,setVehicle]=useState('');const [instructions,setInstructions]=useState('');const [date,setDate]=useState('');const [editing,setEditing]=useState<AssignedRoute|null>(null);
  useEffect(()=>manager?subscribeToCollection<GeographicLayer>('capas_geograficas',setLayers,[],tenantId):undefined,[tenantId,manager]);
  const [devices,setDevices]=useState<RegisteredDevice[]>([]);
  useEffect(()=>manager?subscribeToCollection<RegisteredDevice>('dispositivos',setDevices,[],tenantId):undefined,[tenantId,manager]);
  const sources=useMemo(()=>[...vehicles.filter(item=>item.plannedRoute).map(item=>({id:`vehicle-${item.id}`,name:`${item.licensePlate} · ${item.plannedRoute!.name}`,route:item.plannedRoute!})),...layers.flatMap(layer=>layer.features.filter(feature=>feature.geometries.some(geometry=>geometry.type==='LineString')).map(feature=>({id:`${layer.id}-${feature.id}`,name:`${layer.name} · ${feature.name}`,route:importedRoute(feature)})))],[vehicles,layers]);
  const route=tracking.routes.find(item=>item.id===selected);
  const openDetail=(id:string)=>{setSelected(id);setView('history');};
  useEffect(()=>{modulePanel.current?.scrollIntoView({block:'start',behavior:'instant'});modulePanel.current?.focus({preventScroll:true});},[selected,view]);
  useEffect(()=>{
    setSamples([]);setSamplesError('');setSamplesLoading(!!route&&manager);if(!route||!manager)return;
    return onSnapshot(query(collection(db,'puntos_recorrido'),where('tenantId','==',tenantId),where('routeId','==',route.id)),snapshot=>{
      setSamples(snapshot.docs.map(item=>({...item.data(),id:item.id} as RouteSample)));setSamplesLoading(false);
    },error=>{setSamplesLoading(false);setSamplesError(error.code==='permission-denied'?'Su cuenta no tiene acceso a los puntos de este recorrido.':'No se pudieron cargar los puntos. Revise su conexión y vuelva a intentar.');});
  },[route?.id,tenantId,manager,sampleAttempt]);
  const availableUsers=[...new Map([user,...users].filter(item=>item.tenantId===tenantId&&item.active!==false&&item.accessVersion===2).map(item=>[item.uid,item])).values()];
  const reset=()=>{setEditing(null);setName('');setEmployee('');setSource('');setVehicle('');setInstructions('');setDate('');};
  const perform=async(action:()=>Promise<void>)=>{setBusy(true);setError('');try{await action();}catch(error){setError((error as Error).message);}finally{setBusy(false);}};
  if(!manager)return null;
  return <div ref={modulePanel} tabIndex={-1} className="min-w-0 scroll-mt-20 space-y-5 pb-12 text-slate-200 focus:outline-none">
    {route?<RouteDetailView key={route.id} route={route} samples={samples} loading={samplesLoading} error={samplesError} onRetry={()=>setSampleAttempt(value=>value+1)} onBack={()=>{setSelected('');setView('history');}}/>:<>
    <header><h2 className="text-2xl font-bold text-white">Recorridos y seguimiento</h2><p className="mt-2 text-base text-slate-400">Elija una persona y abra un recorrido para consultar su trayecto y sus horarios.</p></header>
    {user.role==='AdminGlobal'&&onSelectTenant&&<label className="block rounded-xl border border-slate-700 bg-slate-900 p-3 text-sm font-semibold">Equipo a supervisar<select aria-label="Equipo a supervisar" className={input} value={tenantId} onChange={event=>{const tenant=tenants.find(item=>item.tenantId===event.target.value);if(tenant)onSelectTenant(tenant);}}>{tenants.map(tenant=><option key={tenant.tenantId} value={tenant.tenantId}>{tenant.name}</option>)}</select></label>}
    <nav aria-label="Vistas de seguimiento" className="grid grid-cols-3 gap-2">{([['history','Recorridos'],['live','En vivo'],['manage','Administrar']] as const).map(([value,label])=><button key={value} type="button" aria-pressed={view===value} onClick={()=>setView(value)} className={`min-h-12 min-w-0 rounded-xl border px-2 py-3 text-sm font-semibold ${view===value?'border-cyan-400 bg-cyan-500 text-slate-950':'border-slate-700 bg-slate-900 text-slate-300'}`}>{label}</button>)}</nav>
    {view==='history'&&<RouteHistoryList routes={tracking.routes} loading={tracking.routesLoading} error={tracking.routesError} onRetry={tracking.retryRoutes} onOpen={openDetail}/>}
    {view==='live'&&<LiveMonitorPanel tenantId={tenantId} routes={tracking.routes} members={[user,...users]} onOpenRoute={openDetail}/>}
    {view==='manage'&&<>
    {manager&&devices.length>0&&<details className="rounded-xl border border-slate-700 bg-slate-900 p-3 text-xs"><summary className="cursor-pointer font-semibold text-cyan-300">Dispositivos registrados del equipo ({devices.length})</summary><div className="mt-2 max-h-64 overflow-auto"><table className="w-full text-left"><thead><tr className="text-slate-400"><th className="p-1">Integrante</th><th>Dispositivo</th><th>GPS</th><th>Recorrido activo</th><th>Última conexión</th></tr></thead><tbody>{[...devices].sort((a,b)=>b.lastSeenAt.localeCompare(a.lastSeenAt)).map(device=><tr key={device.id} className="border-t border-slate-800"><td className="p-1">{[user,...users].find(item=>item.uid===device.userId)?.displayName||device.userId.slice(0,8)}</td><td>{device.label}{device.installed?' · instalada':''}</td><td className={device.gps==='granted'?'text-emerald-300':device.gps==='denied'?'text-amber-300':''}>{({granted:'Autorizado',denied:'Bloqueado',prompt:'Pendiente',unsupported:'No disponible',unknown:'Sin verificar'} as Record<string,string>)[device.gps]||device.gps}</td><td>{tracking.routes.find(item=>item.id===device.activeRouteId)?.name||'—'}</td><td>{new Date(device.lastSeenAt).toLocaleString('es-CO')}</td></tr>)}</tbody></table></div></details>}
    <details className="rounded-xl border border-slate-800 p-3 text-xs text-slate-400"><summary className="cursor-pointer">Ayuda con el seguimiento</summary><p className="mt-2">{localDataEnabled()?'Los datos y posiciones pendientes se conservan en este dispositivo.':'Active «Mi dispositivo» para conservar datos y posiciones pendientes al cerrar Astrea.'} {tracking.native?'Detecta movimiento y cierra el traslado después de cinco minutos detenido. Mantenga la ubicación activa y la batería de Astrea sin restricciones.':'En el navegador mantenga Astrea abierta durante el recorrido. Para continuar con la pantalla apagada use la app instalada.'}</p></details>
    {tracking.native&&tenantId===user.tenantId&&<section className="rounded-xl border border-cyan-700 bg-cyan-950/30 p-4"><h3 className="font-bold">Seguimiento automático</h3><p className="my-2 text-sm">{tracking.automatic?tracking.message:'El seguimiento automático está pausado.'}</p><button className={button} disabled={busy} onClick={()=>void perform(tracking.automatic?tracking.pauseAutomatic:tracking.enableAutomatic)}>{tracking.automatic?'Pausar seguimiento automático':'Activar seguimiento automático'}</button>{tracking.automatic&&!tracking.automaticReady&&<button className={`${button} ml-2`} disabled={busy} onClick={()=>void perform(tracking.enableAutomatic)}>Reintentar preparación</button>}</section>}
    {manager&&<form className="space-y-3 rounded-2xl border border-slate-700 bg-slate-900 p-4" onSubmit={event=>{event.preventDefault();void perform(async()=>{
      const chosen=sources.find(item=>item.id===source)?.route || editing?.route;const member=availableUsers.find(item=>item.uid===employee);const selectedVehicle=vehicles.find(item=>item.id===vehicle);
      if(!chosen||!member||!name.trim())throw new Error('Complete nombre, empleado y ruta.');
      if(editing){await updateOperationalRecord('recorridos',editing.id,tenantId,{name:name.trim(),userId:member.uid,employeeName:member.displayName,vehicleId:vehicle,vehiclePlate:selectedVehicle?.licensePlate||'',instructions:instructions.trim(),scheduledDate:date,route:chosen},editing as unknown as Record<string,unknown>);}
      else {const id=`${tenantId}--route-${crypto.randomUUID()}`;await persistEntity('recorridos',id,{id,tenantId,userId:member.uid,employeeName:member.displayName,vehicleId:vehicle,vehiclePlate:selectedVehicle?.licensePlate||'',name:name.trim(),instructions:instructions.trim(),scheduledDate:date,route:chosen,status:'Asignado',createdBy:auth.currentUser!.uid,createdAt:new Date().toISOString()} satisfies AssignedRoute);setSelected(id);}
      reset();
    });}}><h3 className="font-bold">{editing?'Editar asignación':'Asignar recorrido a empleado'}</h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><label className="text-xs">Nombre del recorrido<input aria-label="Nombre del recorrido asignado" required maxLength={160} className={input} value={name} onChange={event=>setName(event.target.value)}/></label>
        <label className="text-xs">Empleado<select aria-label="Empleado del recorrido" required className={input} value={employee} onChange={event=>setEmployee(event.target.value)}><option value="">Seleccione integrante activo</option>{availableUsers.map(item=><option key={item.uid} value={item.uid}>{item.displayName} · {item.email}</option>)}</select></label>
        <label className="text-xs">Ruta establecida<select aria-label="Ruta establecida" required={!editing} className={input} value={source} onChange={event=>setSource(event.target.value)}><option value="">{editing?'Conservar el trazado actual':'Seleccione ruta guardada o importada'}</option>{sources.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label className="text-xs">Vehículo<select aria-label="Vehículo del recorrido" className={input} value={vehicle} onChange={event=>setVehicle(event.target.value)}><option value="">Sin vehículo</option>{vehicles.map(item=><option key={item.id} value={item.id}>{item.licensePlate} · {item.driverName}</option>)}</select></label>
        <label className="text-xs">Fecha prevista<input aria-label="Fecha prevista del recorrido" type="date" className={input} value={date} onChange={event=>setDate(event.target.value)}/></label><label className="text-xs">Instrucciones<textarea aria-label="Instrucciones del recorrido" maxLength={3000} className={input} value={instructions} onChange={event=>setInstructions(event.target.value)}/></label>
      </div><button className={button} disabled={busy}>{busy?'Guardando…':editing?'Guardar asignación':'Asignar recorrido'}</button>{editing&&<button type="button" className={`${button} ml-2`} onClick={reset}>Cancelar edición</button>}
      {!sources.length&&<p className="text-xs text-amber-300">Importe una ruta desde «Mapa territorial» o guarde una ruta planificada en un vehículo.</p>}
    </form>}
    <div className="grid gap-3 sm:grid-cols-2">{tracking.routes.map(item=><article key={item.id} className="space-y-2 rounded-xl border border-slate-700 bg-slate-900 p-4"><h3 className="font-bold text-white">{item.name}</h3><p className="text-sm text-slate-400">{item.employeeName} · {item.vehiclePlate||'Sin vehículo'} · {item.scheduledDate||'Sin fecha'} · {item.status}</p><div className="flex flex-wrap gap-2"><button type="button" className={button} onClick={()=>openDetail(item.id)}>Ver detalle</button>
      {item.kind!=='automatic'&&!tracking.automatic&&item.userId===user.uid&&!['Finalizado','Cancelado'].includes(item.status)&&<button className={button} disabled={busy||!!tracking.activeId} onClick={()=>void perform(()=>tracking.start(item))}>{item.startedAt?'Reanudar GPS':'Iniciar recorrido GPS'}</button>}
      {tracking.activeId===item.id&&<><button className={button} onClick={()=>void perform(()=>tracking.stop())}>Pausar GPS</button><button className={button} onClick={()=>void perform(()=>tracking.stop(true))}>Finalizar recorrido</button></>}
      {item.userId===user.uid&&item.status==='Pausado'&&!tracking.activeId&&<button className={button} onClick={()=>void perform(async()=>{const now=Date.now();await updateOperationalRecord('recorridos',item.id,tenantId,{status:'Finalizado',finishedAt:new Date(now).toISOString(),finishedAtMillis:now});})}>Finalizar recorrido pausado</button>}
      {manager&&!['Finalizado','Cancelado'].includes(item.status)&&(()=>{const member=[user,...users].find(entry=>entry.uid===item.userId);const text=routeInviteText({employee:item.employeeName,route:item.name,date:item.scheduledDate,appUrl:APP_URL});const wa=whatsappInviteUrl(member?.phone,text);const sms=smsInviteUrl(member?.phone,text);
        return wa?<><a className={button} href={wa} target="_blank" rel="noreferrer">Enviar por WhatsApp</a><a className={button} href={sms}>Enviar por SMS</a></>:<span className="self-center text-[11px] text-slate-500">Registre el celular del integrante en su perfil para enviarle la invitación.</span>;})()}
      {manager&&item.status==='Asignado'&&<button className={button} onClick={()=>{setEditing(item);setName(item.name);setEmployee(item.userId);setVehicle(item.vehicleId);setSource('');setDate(item.scheduledDate);setInstructions(item.instructions);}}>Editar asignación</button>}
      {manager&&item.kind!=='automatic'&&!['Finalizado','Cancelado'].includes(item.status)&&<button className={button} onClick={()=>void perform(async()=>{const now=Date.now();await updateOperationalRecord('recorridos',item.id,tenantId,{status:'Cancelado',finishedAt:new Date(now).toISOString(),finishedAtMillis:now});})}>Cancelar recorrido</button>}
    </div></article>)}</div>
    {!tracking.routes.length&&<p className="text-sm text-slate-400">{manager?'No hay recorridos asignados.':'Su responsable todavía no le ha asignado un recorrido.'}</p>}
    {(error||(tenantId===user.tenantId&&tracking.message))&&<p role="status" className="rounded-xl border border-cyan-800 bg-cyan-950/30 p-3 text-sm">{error||tracking.message}</p>}
    </>}
    </>}
  </div>;
}
