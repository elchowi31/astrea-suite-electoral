import React,{lazy,Suspense,useEffect,useMemo,useState} from 'react';
import {deliveryAddress,deliveryMapsUrl,type RewardDelivery} from '../lib/rewardDelivery';
import {validLocation,type TerritoryPoint} from '../lib/territorialMaps';
const DeliveryMap=lazy(()=>import('./SatelliteRadarCanvas').then(module=>({default:module.SatelliteRadarCanvas})));
export type RewardDeliveryEntry={id:string;participant?:{name:string;email?:string;phone?:string};delivery?:RewardDelivery};
export function DeliveryDetails({delivery}:{delivery?:RewardDelivery}){
 if(!delivery||delivery.consent?.accepted!==true||delivery.consent.purpose!=='reward_delivery')return <span className="text-slate-500">Sin dirección de entrega autorizada</span>;
 return <div className="space-y-2 text-xs text-slate-300"><p>{deliveryAddress(delivery)}</p>{delivery.address.instructions&&<p>{delivery.address.instructions}</p>}{delivery.location&&<p className="text-amber-200">Precisión aproximada: {Math.round(delivery.location.accuracyMeters)} m{delivery.location.accuracyMeters>100?' · Confirme las indicaciones antes de viajar.':''}</p>}<a className="inline-flex min-h-11 items-center rounded-lg border border-cyan-800 px-3 text-cyan-200" href={deliveryMapsUrl(delivery)} target="_blank" rel="noopener noreferrer">Cómo llegar · Google Maps</a></div>;
}
export function RewardDeliveryPanel({entries}:{key?:React.Key;entries:RewardDeliveryEntry[]}){
 const [showMap,setShowMap]=useState(false),[selectedId,setSelectedId]=useState('');
 const points=useMemo(()=>entries.flatMap(entry=>{
  const delivery=entry.delivery,location=delivery?.location;
  if(!delivery||delivery.consent?.accepted!==true||delivery.consent.purpose!=='reward_delivery'||!delivery.consent.scopes?.includes('location')||!location||location.confirmedForDelivery!==true||!validLocation(location))return [];
  return [{id:entry.id,recordId:entry.id,type:'import',name:entry.participant?.name||'Participante',subtitle:deliveryAddress(delivery),municipality:delivery.address.municipality,status:'Entrega',latitude:location.latitude,longitude:location.longitude,capturedAt:location.capturedAt} satisfies TerritoryPoint];
 }),[entries]);
 useEffect(()=>{setSelectedId(current=>points.some(point=>point.id===current)?current:points[0]?.id||'');},[points]);
 const selected=entries.find(entry=>entry.id===selectedId),point=points.find(item=>item.id===selectedId);
 return <section aria-label="Ubicaciones de entrega" className="mb-5 space-y-3 rounded-xl border border-slate-700 p-3">
  <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-semibold">Ubicaciones de entrega</h3><p className="text-xs text-slate-400">{points.length} ubicaciones autorizadas en esta vista. Registros exclusivos de bienestar.</p></div><button type="button" aria-expanded={showMap} onClick={()=>setShowMap(value=>!value)} className="min-h-11 rounded-lg border border-cyan-700 px-3 text-sm text-cyan-200">{showMap?'Ocultar mapa de entregas':'Ver mapa de entregas'}</button></div>
  {showMap&&(points.length?<><p className="text-xs text-slate-400">Seleccione un marcador o una persona para consultar la dirección. El mapa requiere conexión para cargar sus imágenes.</p><label className="block text-xs text-slate-300">Ubicación de participante<select aria-label="Ubicación de participante" value={selectedId} onChange={event=>setSelectedId(event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 text-sm">{points.map(item=><option key={item.id} value={item.id}>{item.name} · {item.municipality}</option>)}</select></label><Suspense fallback={<p role="status">Cargando mapa de entregas…</p>}><DeliveryMap points={points} center={point||points[0]} selectedId={selectedId} onSelectPoint={item=>setSelectedId(item.id)} fitCoordinates={points} fitLabel="Ver todas las entregas" layer="streets" compact/></Suspense>{selected&&<div className="rounded-lg bg-slate-950 p-3"><h4 className="mb-2 font-semibold">{selected.participant?.name}</h4><DeliveryDetails delivery={selected.delivery}/></div>}</>:<p className="text-sm text-slate-400">Aún no hay ubicaciones autorizadas. Las direcciones escritas se pueden consultar en cada inscripción.</p>)}
 </section>;
}
