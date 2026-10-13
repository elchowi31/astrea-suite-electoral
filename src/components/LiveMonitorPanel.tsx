import React,{useEffect,useMemo,useState} from 'react';
import {subscribeToCollection} from '../lib/firebase';
import type {UserProfile} from '../types';
import type {AssignedRoute,RouteSample} from '../lib/routeTracking';
import {recordedTrackLayers} from '../lib/recordedTrack';
import {liveStatus,staleAlerts,type LivePosition,type LiveStatus} from '../lib/livePosition';
import type {TerritoryPoint} from '../lib/territorialMaps';
import {SatelliteRadarCanvas} from './SatelliteRadarCanvas';

const tone:Record<LiveStatus,string>={'en-vivo':'text-emerald-300','en-reposo':'text-sky-300','demorado':'text-amber-300','sin-senal':'text-rose-300'};
const label:Record<LiveStatus,string>={'en-vivo':'En movimiento','en-reposo':'En reposo','demorado':'Demorado','sin-senal':'Sin señal'};
const ago=(ms:number)=>ms<60000?`hace ${Math.max(0,Math.round(ms/1000))} s`:ms<3600000?`hace ${Math.round(ms/60000)} min`:`hace ${Math.round(ms/3600000)} h`;

/** Centro de monitoreo: posición actual de cada integrante en recorrido, actualizada en tiempo real por Firestore. */
export function LiveMonitorPanel({tenantId,routes,members,onOpenRoute}:{tenantId:string;routes:AssignedRoute[];members:UserProfile[];onOpenRoute?:(id:string)=>void}){
  const [positions,setPositions]=useState<LivePosition[]>([]);const [now,setNow]=useState(Date.now());const [focus,setFocus]=useState('');
  useEffect(()=>subscribeToCollection<LivePosition>('posiciones_actuales',setPositions,[],tenantId),[tenantId]);
  useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),5000);return()=>clearInterval(timer);},[]);
  const routeOf=(id:string)=>routes.find(route=>route.id===id);
  // Se muestran los integrantes con recorrido en curso y cualquier posición de las últimas 12 horas.
  const visible=useMemo(()=>positions.filter(item=>routeOf(item.routeId)?.status==='En curso'||now-item.capturedAtMillis<12*3600000).sort((a,b)=>b.capturedAtMillis-a.capturedAtMillis),[positions,routes,now]);
  const alerts=useMemo(()=>staleAlerts(routes,positions,now),[routes,positions,now]);
  const name=(uid:string)=>members.find(member=>member.uid===uid)?.displayName||uid.slice(0,8);
  const points:TerritoryPoint[]=visible.map(item=>({id:`live-${item.id}`,recordId:item.routeId,type:'vehicle',name:name(item.userId),subtitle:`${label[liveStatus(item,now)]} · ${ago(now-item.capturedAtMillis)}${item.battery!==null?` · batería ${item.battery}%`:''}`,municipality:'',status:routeOf(item.routeId)?.name||'',latitude:item.latitude,longitude:item.longitude,capturedAt:item.capturedAt}));
  const focused=visible.find(item=>item.id===focus)||visible[0];
  const [samples,setSamples]=useState<RouteSample[]>([]);
  useEffect(()=>{setSamples([]);if(!focused?.routeId)return;return subscribeToCollection<RouteSample>('puntos_recorrido',setSamples,[],tenantId,{field:'routeId',value:focused.routeId});},[tenantId,focused?.routeId]);
  const trace=useMemo(()=>recordedTrackLayers(focused?routeOf(focused.routeId):undefined,samples),[focused?.routeId,routes,samples]);
  const counts=visible.reduce((sum,item)=>{sum[liveStatus(item,now)]++;return sum;},{'en-vivo':0,'en-reposo':0,'demorado':0,'sin-senal':0} as Record<LiveStatus,number>);
  return <section aria-label="Monitoreo en vivo" className="space-y-3 rounded-2xl border border-cyan-800 bg-slate-900 p-4">
    <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-bold text-white">Monitoreo en vivo</h3>
      <p className="text-xs text-slate-400"><span className="text-emerald-300">{counts['en-vivo']} en movimiento</span> · {counts['en-reposo']} en reposo · <span className="text-amber-300">{counts.demorado} demorados</span> · <span className="text-rose-300">{counts['sin-senal']} sin señal</span> · se actualiza solo</p></div>
    {alerts.length>0&&<div role="alert" className="rounded-xl border border-rose-700 bg-rose-950/40 p-3 text-xs text-rose-100"><p className="font-semibold">Recorridos en curso sin reporte reciente</p><ul className="mt-1 list-disc pl-5">{alerts.map(alert=><li key={alert.routeId}>{alert.employee} · {alert.route} · {alert.reason==='sin-datos'?'el celular aún no ha enviado posiciones':`última posición ${ago(now-Date.parse(alert.lastAt!))}`}</li>)}</ul><p className="mt-1 text-rose-200/80">Causas habituales: app cerrada, celular sin batería o sin datos, o ahorro de batería que detuvo Astrea. Llame al integrante.</p></div>}
    {visible.length?<>
      <SatelliteRadarCanvas center={focused} points={points} selectedId={focused?`live-${focused.id}`:undefined} onSelectPoint={point=>setFocus(point.id.replace(/^live-/,''))} route={focused?routeOf(focused.routeId)?.route.geometry||[]:[]} geographicLayers={trace}/>
      <p className="text-xs text-amber-200">Ámbar: trazado del traslado registrado. En reposo no se agregan puntos al historial.</p>
      <div className="grid gap-3 lg:grid-cols-2">{visible.map(item=>{const status=liveStatus(item,now),assigned=routeOf(item.routeId);return <article key={item.id} className={`min-w-0 space-y-3 rounded-xl border p-4 ${focused?.id===item.id?'border-cyan-600 bg-cyan-950/30':'border-slate-700 bg-slate-950'}`}>
        <div className="flex flex-wrap justify-between gap-2"><h4 className="break-words font-bold text-white">{name(item.userId)}</h4><span className={`text-sm ${tone[status]}`}>{label[status]}</span></div>
        <p className="text-sm text-slate-300">Última posición: {ago(now-item.capturedAtMillis)} · precisión {Math.round(item.accuracy)} m</p>
        <p className="text-sm text-slate-400">{item.speed!==null?`${Math.round(item.speed*3.6)} km/h`:'Velocidad sin reporte'}{item.battery!==null?` · batería ${item.battery}%`:''}</p>
        <div className="flex flex-wrap gap-2"><button type="button" onClick={()=>setFocus(item.id)} className="min-h-12 rounded-xl border border-slate-600 px-4 py-3 text-sm text-white">Centrar persona</button>{assigned&&onOpenRoute&&<button type="button" onClick={()=>onOpenRoute(assigned.id)} className="min-h-12 rounded-xl bg-cyan-500 px-4 py-3 text-sm font-bold text-slate-950">Ver detalle del recorrido</button>}</div>
      </article>;})}</div>
      <p className="text-xs text-slate-500">En movimiento o en reposo: reporte de menos de 90 s. Demorado: hasta 5 min. Sin señal: más de 5 min. El reporte de estado no agrega puntos estacionarios al recorrido. Con la app instalada el seguimiento continúa con la pantalla apagada.</p>
    </>:<p className="text-sm text-slate-400">Las posiciones aparecerán al detectar el primer desplazamiento real de un integrante con Astrea configurada.</p>}
  </section>;
}
