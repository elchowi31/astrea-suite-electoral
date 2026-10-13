import React,{useEffect,useState} from 'react';
import {collection,deleteDoc,doc,onSnapshot,query,setDoc,where} from 'firebase/firestore';
import {auth,db} from '../lib/firebase';
import {isTrackingAdministrator} from '../lib/trackingPermissions';
import {electionTransportRoute,type ElectionTransportRoute} from '../lib/electionTransport';
import {googleDirectionsUrl} from '../lib/territorialMaps';
import type {Tenant,TransportVehicle,UserProfile} from '../types';
import {SatelliteRadarCanvas} from './SatelliteRadarCanvas';
const button='rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white disabled:opacity-50';
const input='mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 p-2.5 text-sm text-white';

export function ElectionTransportRoutes({tenant,user,vehicles}:{tenant:Tenant;user:UserProfile|null;vehicles:TransportVehicle[]}) {
  const admin=isTrackingAdministrator(user);const [routes,setRoutes]=useState<ElectionTransportRoute[]>([]);
  const [selected,setSelected]=useState('');const [date,setDate]=useState(tenant.campaignDate||'');const [time,setTime]=useState('');const [notes,setNotes]=useState('');
  const [filter,setFilter]=useState('');const [error,setError]=useState('');const [busy,setBusy]=useState(false);
  useEffect(()=>{setRoutes([]);setFilter('');setSelected('');setDate(tenant.campaignDate||'');setTime('');setNotes('');setError('');return onSnapshot(query(collection(db,'rutas_transporte_electoral'),where('tenantId','==',tenant.tenantId)),snapshot=>setRoutes(snapshot.docs.map(row=>row.data() as ElectionTransportRoute)),error=>setError(`No se pudieron cargar las rutas de transporte: ${error.message}`));},[tenant.tenantId]);
  const available=vehicles.filter(vehicle=>vehicle.tenantId===tenant.tenantId&&vehicle.plannedRoute);
  const days=[...new Set(routes.map(route=>route.electionDate))].sort();
  const visible=routes.filter(route=>!filter||route.electionDate===filter).sort((a,b)=>a.electionDate.localeCompare(b.electionDate)||a.departureTime.localeCompare(b.departureTime));
  const perform=async(action:()=>Promise<void>)=>{setBusy(true);setError('');try{await action();}catch(error){setError((error as Error).message);}finally{setBusy(false);}};
  return <section className="space-y-4 rounded-2xl border border-cyan-700 bg-slate-900 p-4 text-slate-200" aria-label="Transporte del día de las elecciones">
    <h2 className="text-xl font-bold text-white">Recorridos de transporte · día de las elecciones</h2>
    <p className="text-sm text-slate-400">Horarios y rutas publicados para todos los usuarios de {tenant.name}.</p>
    {admin&&<details className="rounded-xl border border-slate-700 p-3"><summary className="cursor-pointer font-semibold text-cyan-300">Publicar recorrido electoral</summary>
      <form className="mt-3 space-y-3" onSubmit={event=>{event.preventDefault();void perform(async()=>{
        const vehicle=available.find(item=>item.id===selected);if(!vehicle||!user||auth.currentUser?.uid!==user.uid)throw new Error('Seleccione un vehículo con ruta y mantenga su sesión activa.');
        const record=electionTransportRoute(vehicle,user,`${tenant.tenantId}--election-${crypto.randomUUID()}`,date,time,notes);
        await setDoc(doc(db,'rutas_transporte_electoral',record.id),record);setSelected('');setTime('');setNotes('');
      });}}><div className="grid gap-3 sm:grid-cols-3"><label className="text-xs">Vehículo y ruta<select required className={input} value={selected} onChange={event=>setSelected(event.target.value)}><option value="">Seleccione una ruta guardada</option>{available.map(vehicle=><option key={vehicle.id} value={vehicle.id}>{vehicle.licensePlate} · {vehicle.plannedRoute!.name}</option>)}</select></label>
        <label className="text-xs">Fecha de elecciones<input required type="date" className={input} value={date} onChange={event=>setDate(event.target.value)}/></label><label className="text-xs">Hora de salida<input required type="time" className={input} value={time} onChange={event=>setTime(event.target.value)}/></label></div>
        <label className="block text-xs">Indicaciones para los pasajeros<textarea maxLength={1000} className={input} value={notes} onChange={event=>setNotes(event.target.value)}/></label>
        <button className={button} disabled={busy||!available.length}>{busy?'Publicando…':'Publicar para todos'}</button>{!available.length&&<p className="text-xs text-amber-200">Guarde primero una ruta planificada en un vehículo de Transporte.</p>}
      </form></details>}
    {days.length>1&&<label className="block max-w-xs text-xs">Día electoral<select className={input} value={filter} onChange={event=>setFilter(event.target.value)}><option value="">Todas las fechas publicadas</option>{days.map(day=><option key={day} value={day}>{day}</option>)}</select></label>}
    {error&&<p role="status" className="text-sm text-amber-200">{error}</p>}
    {!visible.length&&<p className="text-sm text-slate-400">El administrador todavía no ha publicado recorridos para esta fecha.</p>}
    <div className="grid gap-3 lg:grid-cols-2">{visible.map(item=><article key={item.id} className="space-y-2 rounded-xl border border-slate-700 bg-slate-950 p-4"><h3 className="font-bold text-white">{item.route.name}</h3>
      <p className="text-sm text-cyan-200">{item.electionDate} · salida {item.departureTime} · vehículo {item.vehiclePlate}</p>
      <ol className="list-decimal space-y-1 pl-5 text-sm">{item.route.stops.map((stop,index)=><li key={index}>{stop.name}</li>)}</ol>{item.notes&&<p className="whitespace-pre-wrap text-sm">{item.notes}</p>}
      <details><summary className="cursor-pointer text-sm text-cyan-300">Ver trazado y paradas</summary><div className="mt-3"><SatelliteRadarCanvas center={item.route.geometry[0]} route={item.route.geometry} points={item.route.stops.map((stop,index)=>({...stop,id:`${item.id}-${index}`,recordId:item.id,type:'import',subtitle:`Parada ${index+1}`,municipality:'',status:'Transporte electoral'}))}/></div></details>
      {item.route.stops.length<=5&&<a className="inline-block py-2 text-sm text-cyan-300 underline" href={googleDirectionsUrl(item.route.stops)} target="_blank" rel="noreferrer">Abrir ruta en Google Maps ↗</a>}
      {admin&&<button className={`${button} block`} disabled={busy} onClick={()=>void perform(()=>deleteDoc(doc(db,'rutas_transporte_electoral',item.id)))}>Retirar publicación</button>}
    </article>)}</div>
  </section>;
}
