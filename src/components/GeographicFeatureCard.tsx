import React,{useMemo,useState} from 'react';
import {MapPin, X} from 'lucide-react';
import type {GeographicLayer,GeoFeature} from '../lib/geographicImport';
import {GeographicFeatureEditor} from './GeographicFeatureEditor';
export function GeographicFeatureCard({layer,feature,readOnly,onClose}:{key?:React.Key;layer:GeographicLayer;feature:GeoFeature;readOnly:boolean;onClose:()=>void}){
  const [editing,setEditing]=useState(false);
  const description=useMemo(()=>{
    // Inert text: imported HTML never becomes live page content.
    const parsed=new DOMParser().parseFromString(feature.description.replace(/<br\s*\/?\s*>|<\/tr>|<\/p>|<\/div>/gi,'\n').replace(/<\/t[dh]>/gi,': '),'text/html');
    parsed.querySelectorAll('script,style,iframe,object').forEach(node=>node.remove());
    return parsed.body.textContent?.trim()||'';
  },[feature.description]);
  return <article aria-label="Ficha del emprendimiento" className="flex max-h-full flex-col overflow-hidden rounded-2xl border border-slate-600 bg-slate-900 text-slate-200 shadow-2xl">
    <header className="flex items-start gap-3 border-b border-slate-700 p-4"><MapPin className="mt-1 shrink-0 text-amber-300" size={20}/><div className="min-w-0 flex-1"><p className="text-[10px] uppercase tracking-widest text-amber-300">Ficha del emprendimiento</p><h3 className="mt-1 break-words text-lg font-bold text-white">{feature.name}</h3><p className="mt-1 break-words text-xs text-slate-400">{layer.name}</p></div><button className="rounded-lg p-2 hover:bg-slate-700" aria-label="Cerrar ficha" onClick={()=>{if(!editing||window.confirm('¿Cerrar la ficha y descartar los cambios sin guardar?'))onClose();}}><X size={20}/></button></header>
    <div className="min-h-0 space-y-4 overflow-auto overscroll-contain p-4">
      <GeographicFeatureEditor inline layer={layer} feature={feature} readOnly={readOnly} onEditingChange={setEditing}/>
      {!editing&&<><dl className="divide-y divide-slate-800">{Object.entries(feature.properties).map(([key,value])=><div key={key} className="py-2.5"><dt className="break-words text-xs text-slate-400">{key}</dt><dd className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-100">{value||'Sin dato'}</dd></div>)}</dl>
        {description&&<details open={!Object.keys(feature.properties).length}><summary className="cursor-pointer text-sm text-cyan-300">Descripción del archivo</summary><p className="mt-2 whitespace-pre-wrap break-words text-sm">{description}</p></details>}
        <details><summary className="cursor-pointer text-xs text-slate-400">Geometría y coordenadas</summary>{feature.geometries.map((geometry,i)=><div key={i} className="mt-2 text-xs"><p>{geometry.type} · {geometry.coordinates.length} coordenadas</p><p className="mt-1 font-mono">{geometry.coordinates[0]?.latitude.toFixed(7)}, {geometry.coordinates[0]?.longitude.toFixed(7)}</p></div>)}</details>
        <p className="break-words text-[11px] text-slate-500">Fuente: {layer.filename}</p></>}
    </div>
  </article>;
}
