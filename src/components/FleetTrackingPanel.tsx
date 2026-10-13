import React,{useEffect,useMemo,useRef,useState} from 'react';
import {collection,onSnapshot,query,where} from 'firebase/firestore';
import {db} from '../lib/firebase';
import type {TransportVehicle,UserProfile} from '../types';
import {teamLocations} from '../lib/teamLocations';
import {isTrackingAdministrator} from '../lib/trackingPermissions';
import type {Coordinate} from '../lib/territorialMaps';
import type {RouteSample} from '../lib/routeTracking';
import {useTeamPositions} from './useTeamPositions';
import {useRouteTracking} from './RouteTrackingProvider';
import {TeamLocationList} from './TeamLocationList';
import {SatelliteRadarCanvas} from './SatelliteRadarCanvas';
import {RouteHistoryList} from './RouteHistoryList';
import {RouteDetailView} from './RouteDetailView';
const button='min-h-12 rounded-lg border border-slate-600 bg-slate-800 px-4 py-3 text-sm text-white disabled:opacity-40';
const EMPTY:Coordinate[]=[];
export function FleetTrackingPanel({tenantId,user,members,vehicles,readOnly=false}:{key?:React.Key;tenantId:string;user:UserProfile;members:UserProfile[];vehicles:TransportVehicle[];readOnly?:boolean}){
  const tracking=useRouteTracking(),live=useTeamPositions(user,tenantId,!readOnly);
  const permitted=isTrackingAdministrator(user)&&!readOnly;
  const rows=useMemo(()=>teamLocations({viewer:permitted?user:null,tenantId,leaders:[],vehicles,members,positions:live.positions,routes:tracking.routes,now:live.now}).vehicles,[permitted,user,tenantId,vehicles,members,live.positions,tracking.routes,live.now]);
  const points=useMemo(()=>rows.flatMap(row=>row.point?[row.point]:[]),[rows]);
  const [selected,setSelected]=useState(''),[historyId,setHistoryId]=useState(''),[detailId,setDetailId]=useState('');
  const [fit,setFit]=useState<Coordinate[]|undefined>(),[planned,setPlanned]=useState(false);
  const mapPanel=useRef<HTMLDivElement>(null),historyPanel=useRef<HTMLDivElement>(null);
  const current=rows.find(row=>row.id===selected),vehicle=vehicles.find(row=>row.id===selected);
  const historyRow=rows.find(row=>row.id===historyId);
  const routes=tracking.routes.filter(route=>route.tenantId===tenantId&&(route.vehicleId===historyId||!!historyRow?.userId&&route.userId===historyRow.userId));
  const route=routes.find(row=>row.id===detailId);
  const [samples,setSamples]=useState<RouteSample[]>([]),[loading,setLoading]=useState(false),[error,setError]=useState(''),[attempt,setAttempt]=useState(0);
  useEffect(()=>{setSamples([]);setError('');setLoading(!!route&&permitted);if(!route||!permitted)return;
    return onSnapshot(query(collection(db,'puntos_recorrido'),where('tenantId','==',tenantId),where('routeId','==',route.id)),snapshot=>{setSamples(snapshot.docs.map(row=>({...row.data(),id:row.id} as RouteSample)));setLoading(false);},()=>{setLoading(false);setError('No se pudieron cargar los puntos del recorrido. Vuelva a intentar.');});
  },[tenantId,route?.id,permitted,attempt]);
  useEffect(()=>{if(historyId)historyPanel.current?.scrollIntoView({block:'start',behavior:'instant'});},[historyId,detailId]);
  if(!permitted)return null;
  return <section aria-label="Ubicación de conductores y recorridos" className="space-y-4 rounded-2xl border border-cyan-800 bg-slate-900 p-4 text-slate-200">
    <h2 className="text-xl font-bold text-white">Conductores y recorridos</h2><p className="text-sm text-slate-400">Seleccione un conductor para ubicarlo, consultar sus desplazamientos o ver la ruta planificada de su vehículo.</p>
    {live.loading&&<p role="status">Cargando posiciones…</p>}{live.error&&<p role="alert" className="text-amber-200">{live.error} <button className={button} onClick={live.retry}>Reintentar</button></p>}
    <div ref={mapPanel} className="scroll-mt-20 space-y-3">
      <label className="block text-sm">Conductor y vehículo<select aria-label="Conductor y vehículo" value={selected} onChange={event=>{const row=rows.find(item=>item.id===event.target.value);setSelected(event.target.value);setPlanned(false);setFit(row?.point?[row.point]:undefined);}} className="mt-2 min-h-12 w-full rounded-lg border border-slate-600 bg-slate-950 p-3 text-base"><option value="">Todos los conductores</option>{rows.map(row=><option key={row.id} value={row.id}>{row.name} · {row.status}</option>)}</select></label>
      {points.length>0||planned&&vehicle?.plannedRoute?<SatelliteRadarCanvas layer="streets" points={points} center={current?.point} selectedId={current?.point?.id} fitCoordinates={fit||points} fitLabel="Ajustar mapa de transporte" route={planned?vehicle?.plannedRoute?.geometry||EMPTY:EMPTY} onSelectPoint={point=>{setSelected(point.recordId);setFit([{latitude:point.latitude,longitude:point.longitude}]);setPlanned(false);}}/>:<p className="rounded-xl bg-slate-950 p-4 text-sm text-slate-400">Todavía no hay posiciones registradas de conductores en esta organización.</p>}
      {current&&<p className="text-sm text-cyan-200">{current.name} · {current.status}</p>}
      {vehicle?.plannedRoute&&<button className={button} onClick={()=>{setPlanned(value=>!value);setFit(planned?(current?.point?[current.point]:undefined):[...vehicle.plannedRoute!.geometry,...(current?.point?[current.point]:[])]);}}>{planned?'Ocultar ruta planificada':'Ver ruta planificada'}</button>}
      {planned&&vehicle?.plannedRoute&&<p className="text-sm text-cyan-200">Ruta planificada: {vehicle.plannedRoute.name}. El historial del conductor se consulta en «Ver recorridos del conductor».</p>}
    </div>
    <TeamLocationList rows={rows} kind="vehicles" onLocate={row=>{setSelected(row.id);setPlanned(false);setFit(row.point?[row.point]:undefined);mapPanel.current?.scrollIntoView({block:'start',behavior:'instant'});}} onHistory={row=>{setHistoryId(row.id);setDetailId('');requestAnimationFrame(()=>historyPanel.current?.scrollIntoView({block:'start',behavior:'instant'}));}}/>
    {historyId&&<div ref={historyPanel} className="scroll-mt-20 space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-bold">Recorridos: {historyRow?.name}</h3><button className={button} onClick={()=>{setHistoryId('');setDetailId('');}}>Cerrar recorridos</button></div>
      {route?<RouteDetailView key={route.id} route={route} samples={samples} loading={loading} error={error} onRetry={()=>setAttempt(value=>value+1)} onBack={()=>setDetailId('')}/>:<RouteHistoryList routes={routes} loading={tracking.routesLoading} error={tracking.routesError} onRetry={tracking.retryRoutes} onOpen={setDetailId}/>}
    </div>}
  </section>;
}
