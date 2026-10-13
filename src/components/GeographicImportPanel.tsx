import React, { useState } from 'react';
import { collection, doc, writeBatch } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { importGeographicFile, layerChunks, type GeographicLayer, type ImportResult } from '../lib/geographicImport';
import type { TerritorialRoute } from '../lib/territorialMaps';
import {GeographicFeatureEditor} from './GeographicFeatureEditor';
import {GeographicLayerCard} from './GeographicLayerCard';

const input = 'w-full rounded-lg border border-slate-600 bg-slate-950 p-2 text-sm text-white';
const button = 'min-h-12 rounded-lg border border-slate-600 bg-slate-800 px-3 py-3 text-sm text-white disabled:opacity-40';
export function GeographicImportPanel({ tenantId,layers,hidden,onToggle,onViewLayer,onRoute,readOnly=false }: { tenantId:string; layers:GeographicLayer[]; hidden:Set<string>; onToggle:(id:string)=>void; onViewLayer:(parts:GeographicLayer[])=>void; onRoute:(route:TerritorialRoute)=>void; readOnly?:boolean }) {
  const [preview,setPreview] = useState<ImportResult|null>(null); const [name,setName] = useState(''); const [message,setMessage] = useState(''); const [busy,setBusy] = useState(false);
  const groups = [...new Set(layers.map(layer=>layer.importId))].map(id => layers.filter(layer=>layer.importId === id));
  const mutate = async (parts:GeographicLayer[], action:'rename'|'delete', nextName='') => {
    setBusy(true); setMessage(''); try {
      if(readOnly||!auth.currentUser)throw new Error('Inicie sesión con permiso de edición.');
      if(!parts.length||parts.some(part=>part.tenantId!==tenantId))throw new Error('La capa no pertenece a esta organización.');
      const batch = writeBatch(db);
      for (const part of parts) action==='delete' ? batch.delete(doc(db,'capas_geograficas',part.id)) : batch.update(doc(db,'capas_geograficas',part.id),{ name:nextName.trim().slice(0,160),updatedBy:auth.currentUser.uid,updatedAt:new Date().toISOString() });
      const audit = doc(collection(db,'auditoria')); batch.set(audit,{ id:audit.id,tenantId,actorId:auth.currentUser?.uid,entity:'capas_geograficas',entityId:parts[0].importId,action,createdAt:new Date().toISOString() });
      await batch.commit(); if(action==='delete')setMessage(`Capa «${parts[0].name}» retirada.`);
    } finally { setBusy(false); }
  };
  return <section className="space-y-3 rounded-2xl border border-slate-700 bg-slate-900 p-4 sm:p-5">
    <h3 className="font-bold text-white">Cargar mapas, rutas y ubicaciones</h3>
    <p className="text-xs text-slate-400">KML, KMZ, CSV, XLSX y XLS · hasta 25 MB. Coordenadas WGS84. En Excel se leen todas las hojas con datos.</p>
    <label className="block text-xs text-slate-300">Archivo geográfico<input aria-label="Archivo geográfico" type="file" accept=".kml,.kmz,.csv,.xlsx,.xls,application/vnd.google-earth.kml+xml,application/vnd.google-earth.kmz,application/zip,text/csv,text/plain,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/octet-stream"disabled={busy || readOnly} className={`mt-1 ${input}`} onChange={async event=> {
      const file=event.target.files?.[0]; event.target.value=''; if(!file)return; setBusy(true); setMessage(''); setPreview(null);
      try { const result=await importGeographicFile(file); setPreview(result); setName(file.name.replace(/\.[^.]+$/,'')); } catch(error) { setMessage((error as Error).message); } finally { setBusy(false); }
    }} /></label>
    <details className="text-xs text-slate-400"><summary className="cursor-pointer text-cyan-300">Formato de CSV y Excel / descargar ejemplo</summary><p className="mt-2">Columnas: nombre, latitud, longitud. Para recorridos añada tipo=ruta, ruta=nombre del recorrido y orden=1,2,3…; para áreas use tipo=poligono. Para ubicaciones use tipo=punto. Use grados decimales, por ejemplo 9.4981 y -73.9785.</p><a className="mt-2 inline-block text-cyan-300 underline" href="/ejemplo-ubicaciones.csv" download>Descargar CSV de ejemplo</a></details>
    {busy && <p role="status" className="text-xs text-cyan-200">Procesando archivo o guardando cambios…</p>}
    {preview && <div className="space-y-3 rounded-xl border border-cyan-800 p-3"><p className="text-sm text-cyan-200">Vista previa: {preview.filename} · {preview.features.length} elementos</p>
      {preview.warnings.map(warning=><p key={warning} className="text-xs text-amber-300">{warning}</p>)}
      <ul className="max-h-40 overflow-auto text-xs text-slate-300">{preview.features.slice(0,30).map(feature=><li key={feature.id}>{feature.name} · {feature.geometries.map(geometry=>geometry.type==='Point'?'punto':geometry.type==='Polygon'?'polígono':'ruta').join(', ')}</li>)}</ul>
      <label className="block text-xs text-slate-300">Nombre de capa<input aria-label="Nombre de capa" value={name} maxLength={160} className={`mt-1 ${input}`} onChange={event=>setName(event.target.value)} /></label>
      <div className="flex gap-2"><button className={button} disabled={busy || !name.trim() || readOnly} onClick={async()=> {
        setBusy(true); setMessage(''); try { if(!auth.currentUser)throw new Error('Inicie sesión antes de importar.'); const chunks=layerChunks(preview,tenantId,name,auth.currentUser.uid); const batch=writeBatch(db);
          chunks.forEach(chunk=>batch.set(doc(db,'capas_geograficas',chunk.id),chunk)); const audit=doc(collection(db,'auditoria')); batch.set(audit,{id:audit.id,tenantId,actorId:auth.currentUser.uid,entity:'capas_geograficas',entityId:chunks[0].importId,action:'import',createdAt:new Date().toISOString()});
          await batch.commit(); setPreview(null); onViewLayer(chunks); setMessage('Capa importada y guardada.');
        } catch(error) { setMessage((error as Error).message); } finally { setBusy(false); }
      }}>Importar y guardar</button><button className={button} disabled={busy} onClick={()=>setPreview(null)}>Cancelar importación</button></div>
    </div>}
    <div className="space-y-3">{groups.map(parts=><GeographicLayerCard key={parts[0].importId} parts={parts} visible={!hidden.has(parts[0].importId)} readOnly={readOnly} disabled={busy} onToggle={()=>onToggle(parts[0].importId)} onView={()=>onViewLayer(parts)} onRoute={onRoute} onRename={next=>mutate(parts,'rename',next)} onRemove={()=>mutate(parts,'delete')}>
      <details><summary className="cursor-pointer text-cyan-300">Editar ubicaciones, rutas y polígonos</summary><div className="mt-2 flex max-h-48 flex-wrap gap-2 overflow-auto">{parts.flatMap(part=>part.features.map(feature=><GeographicFeatureEditor key={`${part.id}-${feature.id}`} layer={part} feature={feature} readOnly={readOnly}/>))}</div></details>
    </GeographicLayerCard>)}</div>
    {message && <p role="status" className="text-sm text-cyan-200">{message}</p>}
  </section>;
}
