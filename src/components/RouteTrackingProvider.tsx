import React,{createContext,useContext,useEffect,useRef,useState} from 'react';
import {collection,doc,getDoc,onSnapshot,query,setDoc,serverTimestamp,updateDoc,where} from 'firebase/firestore';
import {app,auth,db,firestoreTarget} from '../lib/firebase';
import type {UserProfile} from '../types';
import {isTrackingAdministrator} from '../lib/trackingPermissions';
import {queueLocation,queuedLocations,removeQueuedLocation,queuedAutomaticRoutes,removeQueuedAutomaticRoute,type QueuedLocation,localDataEnabled} from '../lib/deviceStorage';
import type {AssignedRoute} from '../lib/routeTracking';
import {autoResumeDecision,clearActiveRoute,deviceLabel,ensureSeed,gpsPermission,isInstalledApp,readSeed,requestGps,updateSeed,type GpsState} from '../lib/deviceSeed';
import {appPlatform,batteryLevel,fromPosition,isNativeApp,nativeCommit,requestNotificationPermission,watchFixes,type Fix,type FixWatcher} from '../lib/nativeTracking';
import {livePositionId,type LivePosition} from '../lib/livePosition';
import {nativeTrackingToken} from '../lib/nativeAuth';
import {flushTrackingQueue} from '../lib/trackingQueue';
import {useAutomaticTracking} from './useAutomaticTracking';
import {monitorRoutes} from '../lib/monitorRoutes';
import {emptyMovement,observeMovement} from '../lib/movementTracking';
interface TrackingContext {administrator:boolean;routes:AssignedRoute[];routesLoading:boolean;routesError:string;retryRoutes:()=>void;activeId:string;message:string;pending:number;gps:GpsState;deviceId:string;lastFixAt:string;native:boolean;automatic:boolean;automaticReady:boolean;moving:boolean;pauseAutomatic:()=>Promise<void>;enableAutomatic:()=>Promise<void>;start:(route:AssignedRoute)=>Promise<void>;stop:(finish?:boolean)=>Promise<void>;flush:()=>Promise<void>;authorizeGps:()=>Promise<GpsState>}
const Context=createContext<TrackingContext|null>(null);
export function useRouteTracking(){const context=useContext(Context);if(!context)throw new Error('Seguimiento no inicializado.');return context;}
/** Intervalo mínimo entre posiciones guardadas, latido con el teléfono quieto (web) y refresco del registro del dispositivo y la batería. */
const CAPTURE_MS=10000,HEARTBEAT_MS=60000,REGISTRY_MS=300000;
const SAMPLE_DOUBLES=['latitude','longitude','accuracy'],LIVE_DOUBLES=['latitude','longitude','accuracy','speed','heading'];
export function RouteTrackingProvider({user,tenantId,monitorTenantId=tenantId,children}:{user:UserProfile;tenantId:string;monitorTenantId?:string;children:React.ReactNode}){
  const native=isNativeApp();
  const [routes,setRoutes]=useState<AssignedRoute[]>([]);const [activeId,setActiveId]=useState('');const [message,setMessage]=useState('');const [pending,setPending]=useState(0);
  const [monitorStatus,setMonitorStatus]=useState({tenantId:'',loading:true,error:''});const [monitorAttempt,setMonitorAttempt]=useState(0);
  const [gps,setGps]=useState<GpsState>(()=>readSeed()?.gps??'unknown');const [lastFixAt,setLastFixAt]=useState('');const [deviceId]=useState(()=>ensureSeed().deviceId);
  const watcher=useRef<FixWatcher|null>(null);const heartbeat=useRef<ReturnType<typeof setInterval>|null>(null);const active=useRef<AssignedRoute|null>(null);const flushing=useRef(false);const lastCapture=useRef(0);const wake=useRef<WakeLockSentinel|null>(null);const alive=useRef(true);const lockRelease=useRef<(()=>void)|null>(null);
  const resumeChecked=useRef(false);const lastRegistry=useRef(0);const gpsRef=useRef(gps);const battery=useRef<number|null>(null);
  const trailing=useRef<ReturnType<typeof setTimeout>|null>(null);const latest=useRef<{route:AssignedRoute;fix:Fix}|null>(null);
  const manualMovement=useRef(emptyMovement());
  const remember=(state:GpsState)=>{if(gpsRef.current===state)return;gpsRef.current=state;updateSeed({gps:state,gpsCheckedAt:new Date().toISOString()});if(alive.current)setGps(state);};
  const register=(extra:{gps?:GpsState;activeRouteId?:string}={})=>{
    // Registro del dispositivo para supervisión. Es de mejor esfuerzo: un fallo nunca detiene el GPS.
    if(!localDataEnabled()||auth.currentUser?.uid!==user.uid)return;lastRegistry.current=Date.now();void batteryLevel().then(level=>{battery.current=level;});const seed=ensureSeed();const id=`${tenantId}--${user.uid}--${seed.deviceId}`;
    void setDoc(doc(db,'dispositivos',id),{id,tenantId,userId:user.uid,deviceId:seed.deviceId,label:deviceLabel(navigator.userAgent),gps:extra.gps??gpsRef.current,installed:native||isInstalledApp(),activeRouteId:extra.activeRouteId??(active.current?.id||''),firstSeenAt:seed.createdAt,lastSeenAt:new Date().toISOString()},{merge:true}).catch(()=>{});
  };
  const detach=()=>{watcher.current?.stop();watcher.current=null;if(heartbeat.current)clearInterval(heartbeat.current);heartbeat.current=null;if(trailing.current)clearTimeout(trailing.current);trailing.current=null;latest.current=null;active.current=null;setActiveId('');void wake.current?.release().catch(()=>{});wake.current=null;lockRelease.current?.();lockRelease.current=null;};
  /** En la app nativa se escribe por HTTP nativo (no lo frena Android en segundo plano); en la web, con el SDK. */
  const writeSample=async(sample:QueuedLocation)=>{
    if(native){const token=await nativeTrackingToken(auth.currentUser!,app.options.apiKey!);await nativeCommit(firestoreTarget,token,'create','puntos_recorrido',sample.id,{...sample},'receivedAt',SAMPLE_DOUBLES);return;}
    const reference=doc(db,'puntos_recorrido',sample.id);
    try{await setDoc(reference,{...sample,receivedAt:serverTimestamp()});}catch(error){const existing=await getDoc(reference).catch(()=>null);if(!existing?.exists()||Object.entries(sample).some(([key,value])=>JSON.stringify(existing.data()[key])!==JSON.stringify(value)))throw error;}
  };
  const writeLive=(route:AssignedRoute,fix:Fix,sample:QueuedLocation,motion?:'moving'|'stationary',observedAt?:number)=>{
    // Posición en vivo para el panel de monitoreo. Si falla (sin conexión), el historial queda en la cola y se sincroniza después.
    if(!navigator.onLine||auth.currentUser?.uid!==user.uid)return;const id=livePositionId(tenantId,user.uid);
    const live:Omit<LivePosition,'id'>&{id:string}={id,tenantId,userId:user.uid,routeId:route.id,deviceId,latitude:fix.latitude,longitude:fix.longitude,accuracy:fix.accuracy,speed:motion==='stationary'?0:Number.isFinite(fix.speed)?fix.speed:null,heading:Number.isFinite(fix.heading)?fix.heading:null,battery:battery.current,source:appPlatform(),capturedAt:sample.capturedAt,capturedAtMillis:sample.capturedAtMillis,...(motion?{motion,observedAtMillis:Math.round(observedAt!)}:{})};
    const write=native?nativeTrackingToken(auth.currentUser!,app.options.apiKey!).then(token=>nativeCommit(firestoreTarget,token,'upsert','posiciones_actuales',id,{...live},'updatedAt',LIVE_DOUBLES)):setDoc(doc(db,'posiciones_actuales',id),{...live,updatedAt:serverTimestamp()});
    void write.catch(()=>{});
  };
  const flush=async()=>{
    if(flushing.current || auth.currentUser?.uid!==user.uid)return;flushing.current=true;
    try{const queue=await queuedLocations(user.uid,tenantId);if(alive.current)setPending(queue.length);
      if(!navigator.onLine)return;
      const commit=async(mode:'create'|'update',id:string,data:Record<string,unknown>)=>{if(auth.currentUser?.uid!==user.uid)throw new Error('La sesión cambió; la cola se conserva para su cuenta.');const token=await nativeTrackingToken(auth.currentUser!,app.options.apiKey!);await nativeCommit(firestoreTarget,token,mode,'recorridos',id,data,undefined,[]);};
      await flushTrackingQueue({routes:()=>native&&localDataEnabled()?queuedAutomaticRoutes(user.uid,tenantId):Promise.resolve([]),samples:()=>queuedLocations(user.uid,tenantId),
        createRoute:row=>commit('create',row.id,{...row.route}),finishRoute:row=>commit('update',row.id,{status:'Finalizado',finishedAtMillis:row.finishedAtMillis,finishedAt:new Date(row.finishedAtMillis!).toISOString(),updatedAt:new Date().toISOString()}),
        writeSample:async sample=>{if(auth.currentUser?.uid!==user.uid)throw new Error('La sesión cambió; la cola se conserva para su cuenta.');await writeSample(sample);},removeSample:async id=>{await removeQueuedLocation(id);if(alive.current)setPending(count=>Math.max(0,count-1));},removeRoute:removeQueuedAutomaticRoute});
      if(alive.current)setMessage(value=>value.startsWith('Posiciones pendientes')?'':value);
    }catch(error){if(alive.current)setMessage(`Posiciones pendientes de sincronizar: ${(error as Error).message}`);}finally{flushing.current=false;}
  };
  const automatic=useAutomaticTracking({user,tenantId,deviceId,native,manualActive:!!activeId,flush,live:writeLive,register});
  const capture=(route:AssignedRoute,fix:Fix)=>{
    if(active.current?.id!==route.id)return;
    if(native){const result=observeMovement(manualMovement.current,fix);if(!result.accepted)return;manualMovement.current=result.state;if(!result.started&&!result.sample)return;}
    // Una posición que llega antes de 10 s no se descarta: se guarda la más reciente y se registra al cumplirse el intervalo.
    const wait=native?0:CAPTURE_MS-(Date.now()-lastCapture.current);
    if(wait>0){latest.current={route,fix};if(!trailing.current)trailing.current=setTimeout(()=>{trailing.current=null;const next=latest.current;latest.current=null;if(next)capture(next.route,next.fix);},wait);return;}
    latest.current=null;lastCapture.current=Date.now();remember('granted');
    const sample:QueuedLocation={id:`${tenantId}--gps-${crypto.randomUUID()}`,tenantId,userId:user.uid,routeId:route.id,latitude:fix.latitude,longitude:fix.longitude,accuracy:fix.accuracy,capturedAt:new Date(fix.timestamp).toISOString(),capturedAtMillis:Math.round(fix.timestamp)};
    writeLive(route,fix,sample);
    void queueLocation(sample).then(()=>{if(alive.current){setPending(count=>count+1);setLastFixAt(sample.capturedAt);setMessage(`GPS activo${native?' (también en segundo plano)':''} · precisión ${Math.round(sample.accuracy)} m · ${new Date(sample.capturedAt).toLocaleTimeString('es-CO')}`);}if(Date.now()-lastRegistry.current>REGISTRY_MS)register();void flush();}).catch(error=>{detach();if(alive.current)setMessage(`No se pudo conservar la posición. GPS detenido: ${error.message}`);});
  };
  const currentPermission=():Promise<GpsState>=>gpsPermission();
  useEffect(()=>{
    setRoutes([]);setMonitorStatus({tenantId:monitorTenantId,loading:isTrackingAdministrator(user),error:''});
    if(!isTrackingAdministrator(user))return;
    return onSnapshot(query(collection(db,'recorridos'),where('tenantId','==',monitorTenantId)),snapshot=>{
      setRoutes(snapshot.docs.map(item=>({...item.data(),id:item.id} as AssignedRoute)));
      setMonitorStatus({tenantId:monitorTenantId,loading:false,error:''});
    },error=>setMonitorStatus({tenantId:monitorTenantId,loading:false,error:error.code==='permission-denied'?'Su cuenta no tiene acceso a los recorridos de este equipo.':'No se pudieron cargar los recorridos. Revise su conexión y vuelva a intentar.'}));
  },[monitorTenantId,user.uid,user.role,user.active,user.accessVersion,monitorAttempt]);
  useEffect(()=>{alive.current=true;const online=()=>void flush();void batteryLevel().then(level=>{battery.current=level;});
    const visible=()=>{if(document.visibilityState!=='visible')return;void currentPermission().then(state=>{remember(state);register({gps:state});if(native&&state==='denied'&&active.current)void stop().then(()=>setMessage('El permiso de ubicación fue retirado. Actívelo en los ajustes del teléfono y reanude el recorrido.')).catch(error=>setMessage(error.message));}).catch(()=>{});if(!active.current)return;void flush();if(native)return;if(navigator.wakeLock)void navigator.wakeLock.request('screen').then(lock=>{wake.current=lock;}).catch(()=>{});const route=active.current;if(Date.now()-lastCapture.current>CAPTURE_MS)navigator.geolocation.getCurrentPosition(position=>capture(route,fromPosition(position)),()=>{},{enableHighAccuracy:true,maximumAge:15000,timeout:30000});};
    window.addEventListener('online',online);document.addEventListener('visibilitychange',visible);const timer=setInterval(()=>void flush(),15000);void flush();
    // El permiso se consulta sin mostrar avisos. Si el usuario lo cambia en los ajustes del navegador, la semilla se actualiza.
    let status:PermissionStatus|undefined;void currentPermission().then(state=>{remember(state);register({gps:state});}).catch(()=>{});
    if(!native)void navigator.permissions?.query({name:'geolocation'}).then(result=>{status=result;result.onchange=()=>{const state=result.state as GpsState;remember(state);register({gps:state});if(state==='denied'&&active.current){const notice='El permiso de ubicación fue retirado en el navegador. Actívelo en los ajustes del sitio para continuar.';void stop().then(()=>setMessage(notice),()=>setMessage(notice));}};}).catch(()=>{});
    return()=>{alive.current=false;resumeChecked.current=false;if(status)status.onchange=null;detach();clearInterval(timer);window.removeEventListener('online',online);document.removeEventListener('visibilitychange',visible);};
  },[user.uid,tenantId]);
  useEffect(()=>{const route=routes.find(item=>item.id===activeId);if(activeId&&route&&route.status!=='En curso'){detach();clearActiveRoute();register({activeRouteId:''});setMessage('La asignación cambió; la captura GPS se detuvo.');}},[routes,activeId]);
  const stop=async(finish=false)=>{const route=active.current;detach();clearActiveRoute();if(!route)return;register({activeRouteId:''});const now=Date.now();await updateDoc(doc(db,'recorridos',route.id),{status:finish?'Finalizado':'Pausado',updatedAt:new Date(now).toISOString(),...(finish?{finishedAt:new Date(now).toISOString(),finishedAtMillis:now}:{})});setMessage(finish?'Recorrido finalizado. Revise los puntos de control y las posiciones pendientes.':'GPS detenido; puede continuar este recorrido después.');void flush();};
  const start=async(route:AssignedRoute,resumed=false)=>{
    if(!isTrackingAdministrator(user))throw new Error('El panel de seguimiento es exclusivo de administradores.');
    if(route.userId!==user.uid)throw new Error('Cada empleado inicia su propio GPS desde su cuenta.');if(active.current)throw new Error('Detenga el recorrido actual antes de iniciar otro.');
    if(!native&&!navigator.geolocation)throw new Error('El navegador no permite GPS.');if(['Finalizado','Cancelado'].includes(route.status))throw new Error('Este recorrido está cerrado.');
    if(!navigator.onLine&&!localDataEnabled())throw new Error('Active la conservación de datos antes de iniciar sin conexión.');
    if(native){const result=await requestGps();remember(result.state);if(result.state!=='granted')throw new Error('Permita la ubicación precisa de Astrea en Ajustes › Apps › Astrea Suite › Permisos › Ubicación antes de iniciar el recorrido.');if(appPlatform()==='android')await requestNotificationPermission();}
    if(navigator.locks){await new Promise<void>((resolve,reject)=>{void navigator.locks.request(`astrea-gps-${user.uid}`,{ifAvailable:true},async lock=>{if(!lock){reject(new Error('Ya hay GPS activo en otra pestaña. Deténgalo allí primero.'));return;}await new Promise<void>(release=>{lockRelease.current=release;resolve();});}).catch(reject);});}
    let stateSaved=false;
    try{const now=Date.now();const save=updateDoc(doc(db,'recorridos',route.id),{status:'En curso',updatedAt:new Date(now).toISOString(),...(!route.startedAt?{startedAt:new Date(now).toISOString(),startedAtMillis:now}:{})});if(navigator.onLine){await save;stateSaved=true;}else{if(!localDataEnabled())throw new Error('Active la conservación de datos antes de iniciar sin conexión.');void save.then(()=>{stateSaved=true;}).catch(error=>{detach();setMessage(`La asignación no pudo sincronizarse: ${error.message}`);});}
      const state=await currentPermission();
      active.current=route;lastCapture.current=0;manualMovement.current=emptyMovement();setActiveId(route.id);updateSeed({activeRouteId:route.id,activeUserId:user.uid,activeTenantId:tenantId});register({activeRouteId:route.id});
      setMessage(resumed?'Seguimiento reanudado automáticamente en este dispositivo.':native?'Rastreo activo, también con la pantalla apagada. Verá una notificación de Astrea mientras el recorrido esté en curso.':state==='granted'?'Iniciando GPS…':'Autorice la ubicación cuando el navegador lo pida. Solo se solicita la primera vez en este dispositivo.');
      if(localDataEnabled())localStorage.setItem('astrea-tracking-tenant',tenantId);
      if(!native&&navigator.wakeLock)void navigator.wakeLock.request('screen').then(lock=>{if(active.current)wake.current=lock;else void lock.release();}).catch(()=>{});
      const handle=await watchFixes(fix=>capture(route,fix),error=>{
        // Solo una denegación detiene el recorrido. Sin señal o con tiempo agotado, el GPS sigue intentando.
        if(error.kind==='denied'){remember('denied');const notice=native?'Permita la ubicación de Astrea en los ajustes del teléfono para iniciar el seguimiento.':'Permita el GPS del celular para iniciar el seguimiento.';void stop().then(()=>setMessage(notice),()=>setMessage(notice));return;}
        if(alive.current)setMessage('Buscando señal GPS… el seguimiento continúa y registrará la posición en cuanto haya cobertura.');
      },{title:`Astrea · ${route.name}`.slice(0,60),message:'Registrando su recorrido. Ábrala para pausar o finalizar.'});
      if(active.current?.id!==route.id){handle.stop();return;}watcher.current=handle;
      // Latido (solo web): con el teléfono quieto algunos navegadores no emiten posiciones; se pide una por minuto para no dejar vacíos falsos.
      if(!native)heartbeat.current=setInterval(()=>{const current=active.current;if(!current||Date.now()-lastCapture.current<HEARTBEAT_MS-5000)return;navigator.geolocation.getCurrentPosition(position=>capture(current,fromPosition(position)),()=>{},{enableHighAccuracy:true,maximumAge:30000,timeout:30000});},HEARTBEAT_MS);
    }catch(error){detach();clearActiveRoute();register({activeRouteId:''});if(stateSaved&&auth.currentUser?.uid===user.uid){try{await updateDoc(doc(db,'recorridos',route.id),{status:'Pausado',updatedAt:new Date().toISOString()});}catch(syncError){setMessage(`No se pudo pausar la asignación: ${(syncError as Error).message}`);}}throw error;}
  };
  // Al volver a abrir Astrea: si este dispositivo tenía un recorrido en curso y el GPS ya está autorizado, continúa sin preguntar.
  useEffect(()=>{if(monitorTenantId!==tenantId||resumeChecked.current||active.current||!routes.length)return;
    if(native&&automatic.enabled){const seed=readSeed();const legacy=routes.find(item=>item.id===seed?.activeRouteId&&item.userId===user.uid&&item.status==='En curso'&&item.kind!=='automatic');if(legacy)void updateDoc(doc(db,'recorridos',legacy.id),{status:'Pausado',updatedAt:new Date().toISOString()}).then(()=>clearActiveRoute()).catch(error=>setMessage(error.message));resumeChecked.current=true;return;}
    void currentPermission().then(state=>{if(resumeChecked.current||active.current)return;const seed=readSeed();const decision=autoResumeDecision(seed,routes,user.uid,tenantId,state);
      if(decision==='wait')return;resumeChecked.current=true;const route=routes.find(item=>item.id===seed?.activeRouteId);
      if(decision==='clear')clearActiveRoute();
      else if(decision==='denied')setMessage('Este dispositivo tenía un recorrido en curso, pero el GPS está bloqueado. Actívelo en los ajustes y pulse «Reanudar GPS».');
      else if(decision==='ask'&&route)setMessage(`El recorrido «${route.name}» sigue en curso. Pulse «Reanudar GPS» para continuar.`);
      else if(decision==='resume'&&route)void start(route,true).catch(error=>setMessage(`No se pudo reanudar el seguimiento: ${(error as Error).message}`));
    }).catch(()=>{});
  },[routes,user.uid,tenantId,monitorTenantId,automatic.enabled]);
  const authorizeGps=async()=>{const result=await requestGps();gpsRef.current=result.state;setGps(result.state);register({gps:result.state});return result.state;};
  const combinedRoutes=monitorRoutes(routes,automatic.route,monitorTenantId);
  return <Context.Provider value={{administrator:isTrackingAdministrator(user),routes:combinedRoutes,routesLoading:monitorStatus.tenantId!==monitorTenantId||monitorStatus.loading,routesError:monitorStatus.tenantId===monitorTenantId?monitorStatus.error:'',retryRoutes:()=>setMonitorAttempt(value=>value+1),activeId:activeId||(automatic.route?.status==='En curso'?automatic.route.id:''),message:message.startsWith('Posiciones pendientes')?message:automatic.enabled?automatic.message:message,pending,gps,deviceId,lastFixAt:automatic.lastFixAt||lastFixAt,native,automatic:automatic.enabled,automaticReady:automatic.ready,moving:automatic.moving,pauseAutomatic:automatic.pause,enableAutomatic:automatic.enable,start:route=>start(route),stop:finish=>active.current?stop(finish):automatic.pause(),flush,authorizeGps}}>{children}</Context.Provider>;
}
export function TrackingStatusBanner(){const tracking=useRouteTracking();const [error,setError]=useState('');if(!tracking.administrator||(!tracking.automatic&&!tracking.activeId&&!tracking.pending))return null;return <div role="status" className="sticky top-16 z-30 flex flex-wrap items-center justify-between gap-2 border-y border-cyan-700 bg-cyan-950 p-3 text-xs text-cyan-100"><span>{tracking.automatic?(tracking.automaticReady?(tracking.moving?'En movimiento · registrando traslado':'Preparado · esperando movimiento'):tracking.message||'Preparando seguimiento automático'):tracking.activeId?'Recorrido GPS activo':'GPS detenido'} · {tracking.pending} posiciones pendientes{tracking.lastFixAt&&` · último desplazamiento ${new Date(tracking.lastFixAt).toLocaleTimeString('es-CO')}`}{error&&` · ${error}`}</span>{(tracking.automatic||tracking.activeId)&&<button className="rounded-lg bg-slate-800 px-3 py-2" onClick={()=>void tracking.stop().catch(error=>setError(error.message))}>Pausar seguimiento</button>}<button className="rounded-lg bg-slate-800 px-3 py-2" onClick={()=>void tracking.flush()}>Sincronizar posiciones</button></div>;}
