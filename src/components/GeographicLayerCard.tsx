import React, {useState} from 'react';
import {importedRoute, layerCoordinates, type GeographicLayer} from '../lib/geographicImport';
import type {TerritorialRoute} from '../lib/territorialMaps';

const button='min-h-12 rounded-lg border border-slate-600 bg-slate-800 px-3 py-3 text-sm text-white disabled:opacity-40';
interface Props {
  key?:React.Key; parts:GeographicLayer[]; visible:boolean; readOnly?:boolean; disabled?:boolean; children?:React.ReactNode;
  onToggle:()=>void; onView:()=>void; onRoute:(route:TerritorialRoute)=>void;
  onRename:(name:string)=>Promise<void>; onRemove:()=>Promise<void>;
}
export function GeographicLayerCard({parts,visible,readOnly=false,disabled=false,children,onToggle,onView,onRoute,onRename,onRemove}:Props){
  const first=parts[0], features=parts.flatMap(part=>part.features);
  const [action,setAction]=useState<'rename'|'remove'|null>(null);
  const [name,setName]=useState(first.name),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
  const perform=async(work:()=>Promise<void>,success:string)=>{setBusy(true);setError('');try{await work();setAction(null);setMessage(success);}catch(error){setError((error as Error).message);}finally{setBusy(false);}};
  return <article aria-label={`Capa ${first.filename}`} className="min-w-0 space-y-3 rounded-xl bg-slate-950 p-3 text-sm">
    <label className="flex min-h-12 items-center gap-2 break-words text-slate-200"><input type="checkbox" checked={visible} onChange={onToggle}/>{first.name} · {features.length} {features.length===1?'elemento':'elementos'}</label>
    <p className="break-words text-slate-400">{first.filename} · {new Date(first.importedAt).toLocaleString('es-CO')}</p>
    <div className="flex flex-wrap gap-2">
      <button type="button" className={button} disabled={!layerCoordinates(parts).length} onClick={onView}>Ver capa</button>
      <button type="button" className={button} disabled={disabled||busy||readOnly} onClick={()=>{setAction('rename');setName(first.name);setError('');setMessage('');}}>Editar nombre</button>
      <button type="button" className={button} disabled={disabled||busy||readOnly} onClick={()=>{setAction('remove');setError('');setMessage('');}}>Retirar capa</button>
    </div>
    {action==='rename'&&<form aria-label={`Editar nombre de ${first.filename}`} className="space-y-3 rounded-xl border border-cyan-700 p-3" onSubmit={event=>{event.preventDefault();if(name.trim())void perform(()=>onRename(name.trim()),'Nombre de la capa actualizado.');}}>
      <label className="block text-slate-200">Nuevo nombre<input autoFocus aria-label="Nuevo nombre de capa" required maxLength={160} value={name} onChange={event=>setName(event.target.value)} className="mt-2 min-h-12 w-full min-w-0 rounded-lg border border-slate-600 bg-slate-900 p-3 text-base text-white"/></label>
      <div className="flex flex-wrap gap-2"><button className={button} disabled={busy||!name.trim()}>{busy?'Guardando…':'Guardar nombre'}</button><button type="button" className={button} disabled={busy} onClick={()=>setAction(null)}>Cancelar</button></div>
    </form>}
    {action==='remove'&&<div role="group" aria-label={`Confirmar retiro de ${first.filename}`} className="space-y-3 rounded-xl border border-amber-700 p-3 text-slate-200">
      <p>¿Retirar «{first.name}» ({first.filename})? Se eliminarán sus {features.length} elementos para esta organización. Para recuperarlos deberá importar el archivo de nuevo.</p>
      <div className="flex flex-wrap gap-2"><button type="button" className={button} disabled={busy} onClick={()=>void perform(onRemove,'Capa retirada.')}>{busy?'Retirando…':'Confirmar retiro'}</button><button autoFocus type="button" className={button} disabled={busy} onClick={()=>setAction(null)}>Cancelar</button></div>
    </div>}
    {error&&<p role="alert" className="text-amber-200">{error}</p>}{message&&<p role="status" className="text-cyan-200">{message}</p>}
    {children}
    <div className="flex flex-wrap gap-2">{features.filter(feature=>feature.geometries.some(geometry=>geometry.type==='LineString'&&geometry.coordinates.length>=2)).map(feature=><button type="button" key={feature.id} className={button} onClick={()=>onRoute(importedRoute(feature))}>Usar ruta: {feature.name}</button>)}</div>
  </article>;
}
