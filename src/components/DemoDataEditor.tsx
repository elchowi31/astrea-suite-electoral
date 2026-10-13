import React,{useState} from 'react';
import type {DemoBundle} from '../data/demoSeed';
import {DEMO_COLLECTIONS,demoRows,type DemoCollection} from '../lib/demoWorkspace';
import {EditRecordButton} from './common/EditRecordButton';
import {ChartInventory} from './ChartInventory';

export function DemoDataEditor({bundle}:{bundle:DemoBundle}) {
  const [collection,setCollection]=useState<DemoCollection>('lideres'),[search,setSearch]=useState(''),[page,setPage]=useState(0);
  const label=(row:any)=>row.fullName||row.name||row.title||row.donorName||row.licensePlate||row.description||row.origin||bundle.leaders.find(l=>l.id===row.leaderId)?.fullName||'Registro';
  const rows=demoRows(bundle,collection).filter(row=>label(row).toLocaleLowerCase('es').includes(search.toLocaleLowerCase('es')));
  return <><details className="mt-4 rounded-xl border border-slate-700 bg-slate-900 p-3" aria-label="Editor de datos de prueba">
    <summary className="cursor-pointer font-semibold text-cyan-300">Editar datos de prueba · todos los módulos</summary>
    <p className="my-3 text-xs text-slate-400">Los cambios reemplazan la ficha guardada y actualizan los gráficos. Para registrar información real, abra «Editar» y seleccione la opción correspondiente. Las jornadas, solicitudes, viajes y reportes reales siguen sus formularios operativos.</p>
    <div className="grid gap-3 sm:grid-cols-2"><label className="text-xs text-slate-300">Tipo de registro<select aria-label="Tipo de registro de prueba" className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 p-2" value={collection} onChange={e=>{setCollection(e.target.value as DemoCollection);setPage(0);}}>{Object.entries(DEMO_COLLECTIONS).map(([key,[,name]])=><option key={key} value={key}>{name} ({demoRows(bundle,key).length})</option>)}</select></label><label className="text-xs text-slate-300">Buscar registro<input className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 p-2" value={search} onChange={e=>{setSearch(e.target.value);setPage(0);}}/></label></div>
    <div className="mt-3 max-h-80 overflow-auto"><table className="w-full text-left text-sm"><thead className="text-xs text-slate-400"><tr><th className="p-2">Registro</th><th className="p-2">Ubicación / estado</th><th className="p-2">Edición</th></tr></thead><tbody>{rows.slice(page*15,page*15+15).map(row=><tr key={row.id} className="border-t border-slate-800"><td className="p-2 text-slate-200">{label(row)}{row._realRecordId&&<p className="text-xs text-emerald-300">Registrado en datos reales</p>}</td><td className="p-2 text-xs text-slate-400">{row.municipality||row.status||''}</td><td className="p-2"><EditRecordButton collection={collection} record={row}/></td></tr>)}</tbody></table></div>
    <div className="mt-3 flex items-center justify-between gap-2 text-xs text-slate-300"><span>{rows.length} registros</span><div className="flex gap-3"><button type="button" disabled={page===0} onClick={()=>setPage(page-1)} className="disabled:opacity-30">Anterior</button><button type="button" disabled={(page+1)*15>=rows.length} onClick={()=>setPage(page+1)} className="disabled:opacity-30">Siguiente</button></div></div>
  </details><ChartInventory bundle={bundle}/></>;
}
