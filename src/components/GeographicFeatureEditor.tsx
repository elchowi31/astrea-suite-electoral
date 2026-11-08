import React,{useState} from 'react';
import {createPortal} from 'react-dom';
import {saveGeographicFeature} from '../lib/mapPersistence';
import {canonicalStoredValue} from '../lib/serialization';
import {validateGeographicFeatures,type GeographicLayer,type GeoFeature} from '../lib/geographicImport';
const input='min-h-11 w-full min-w-0 rounded-lg border border-slate-600 bg-slate-950 p-2.5 text-sm text-white';
const button='min-h-11 rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white disabled:opacity-40';
export function GeographicFeatureEditor({layer,feature,readOnly=false,inline=false,onEditingChange}:{key?:React.Key;layer:GeographicLayer;feature:GeoFeature;readOnly?:boolean;inline?:boolean;onEditingChange?:(editing:boolean)=>void}){
  const [draft,setDraft]=useState<GeoFeature|null>(null),[original,setOriginal]=useState(''),[part,setPart]=useState(0),[ring,setRing]=useState(0),[page,setPage]=useState(0),[error,setError]=useState(''),[busy,setBusy]=useState(false),[saved,setSaved]=useState(false);
  const geometry=draft?.geometries[part],coordinates=ring===0?geometry?.coordinates:geometry?.holes?.[ring-1]?.coordinates;
  const close=()=>{setDraft(null);onEditingChange?.(false);};
  const updateCoordinate=(index:number,key:'latitude'|'longitude',value:number)=>{
    if(!draft||!geometry||!coordinates)return;
    const next=structuredClone(draft),points=ring===0?next.geometries[part].coordinates:next.geometries[part].holes![ring-1].coordinates;
    points[index][key]=value;
    if(geometry.type==='Polygon'){if(index===0)points[points.length-1]={...points[0]};if(index===points.length-1)points[0]={...points.at(-1)!};}setDraft(next);
  };
  const form=draft&&<form role={inline?undefined:'dialog'} aria-modal={inline?undefined:true} aria-label="Editar elemento geográfico" className={inline?'space-y-4 text-slate-200':'max-h-[90vh] w-full max-w-2xl space-y-4 overflow-auto rounded-2xl border border-slate-600 bg-slate-900 p-5 text-slate-200'} onSubmit={async event=>{
    event.preventDefault();setBusy(true);setError('');
    try{
      if(!draft.name.trim())throw new Error('Complete el nombre.');
      validateGeographicFeatures([draft]);await saveGeographicFeature(layer,draft,original);close();setSaved(true);
    }catch(error){setError((error as Error).message);}finally{setBusy(false);}
  }}>
    <h3 className="font-bold text-white">Editar ficha</h3><fieldset disabled={busy} className="min-w-0 space-y-4">
      <label className="block text-xs">Nombre<input aria-label="Nombre del elemento" required maxLength={160} className={`mt-1 ${input}`} value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})}/></label>
      {Object.entries(draft.properties).map(([key,value])=><label key={key} className="block text-xs">{key}<textarea aria-label={`Dato ${key}`} rows={String(value).length>120?3:1} className={`mt-1 ${input}`} value={value} onChange={e=>setDraft({...draft,properties:{...draft.properties,[key]:e.target.value}})}/></label>)}
      <label className="block text-xs">Descripción<textarea aria-label="Descripción del elemento" rows={3} className={`mt-1 ${input}`} value={draft.description} onChange={e=>setDraft({...draft,description:e.target.value})}/></label>
      <details><summary className="cursor-pointer text-sm text-cyan-300">Editar coordenadas</summary>
        <div className="mt-3 grid gap-2 sm:grid-cols-2"><label className="text-xs">Geometría<select aria-label="Geometría a editar" className={`mt-1 ${input}`} value={part} onChange={e=>{setPart(Number(e.target.value));setRing(0);setPage(0);}}>{draft.geometries.map((item,i)=><option key={i} value={i}>{i+1}. {item.type==='Point'?'Punto':item.type==='Polygon'?'Polígono':'Ruta'}</option>)}</select></label>{geometry?.type==='Polygon'&&<label className="text-xs">Borde<select aria-label="Borde del polígono" className={`mt-1 ${input}`} value={ring} onChange={e=>{setRing(Number(e.target.value));setPage(0);}}><option value={0}>Exterior</option>{geometry.holes?.map((_,i)=><option key={i} value={i+1}>Interior {i+1}</option>)}</select></label>}</div>
        <p className="my-2 text-xs text-slate-400">Grados decimales. El primer y último punto de cada polígono permanecen unidos.</p>
        <div className="space-y-2">{coordinates?.slice(page*25,page*25+25).map((point,i)=>{const index=page*25+i;return <div key={index} className="grid grid-cols-[1.5rem_1fr_1fr] items-center gap-2"><span className="text-xs">{index+1}</span><input aria-label={`Latitud ${index+1}`} className={input} type="number" step="any" min={-90} max={90} required value={Number.isFinite(point.latitude)?point.latitude:''} onChange={e=>updateCoordinate(index,'latitude',e.target.value===''?NaN:Number(e.target.value))}/><input aria-label={`Longitud ${index+1}`} className={input} type="number" step="any" min={-180} max={180} required value={Number.isFinite(point.longitude)?point.longitude:''} onChange={e=>updateCoordinate(index,'longitude',e.target.value===''?NaN:Number(e.target.value))}/></div>;})}</div>
        {(coordinates?.length||0)>25&&<div className="mt-2 flex items-center gap-2"><button type="button" className={button} disabled={page===0} onClick={()=>setPage(page-1)}>Anterior</button><span className="text-xs">Página {page+1} de {Math.ceil(coordinates!.length/25)}</span><button type="button" className={button} disabled={(page+1)*25>=coordinates!.length} onClick={()=>setPage(page+1)}>Siguiente</button></div>}
      </details>
    </fieldset>
    {error&&<p role="alert" className="text-amber-300">{error}</p>}<div className="sticky bottom-0 flex gap-2 bg-slate-900 py-2"><button className={button} disabled={busy}>{busy?'Guardando…':'Guardar cambios'}</button><button className={button} type="button" disabled={busy} onClick={close}>Cancelar</button></div>
  </form>;
  return <>{!draft&&<button className={button} disabled={readOnly} onClick={()=>{setDraft(structuredClone(feature));setOriginal(canonicalStoredValue(feature));setPart(0);setRing(0);setPage(0);setError('');setSaved(false);onEditingChange?.(true);}}>{inline?'Editar datos':`Editar: ${feature.name}`}</button>}{saved&&<p role="status" className="mt-2 text-sm text-emerald-300">Cambios recibidos. Consulte el estado de sincronización.</p>}{draft&&(inline?form:createPortal(<div className="fixed inset-0 z-[5000] flex items-center justify-center bg-slate-950/90 p-3">{form}</div>,document.body))}</>;
}
