import React from 'react';
import type {TeamLocation} from '../lib/teamLocations';
import {routeDateTime} from '../lib/routePresentation';
export function TeamLocationList({rows,kind,onLocate,onHistory}:{rows:TeamLocation[];kind:'leaders'|'vehicles';onLocate:(row:TeamLocation)=>void;onHistory?:(row:TeamLocation)=>void}){
  return <div className="grid gap-3 lg:grid-cols-2">{rows.map(row=><article key={row.id} className="min-w-0 space-y-3 rounded-xl border border-slate-700 bg-slate-950 p-4 text-sm text-slate-300">
    <h4 className="break-words font-bold text-white">{row.name}</h4><p>{row.description}{kind==='leaders'?` · ${row.members} integrantes vinculados`:''}</p>
    <p className={row.source==='gps'?'text-cyan-200':'text-slate-400'}>{row.status}{row.point?.capturedAt?` · ${routeDateTime(Date.parse(row.point.capturedAt),true)}`:''}</p>
    {row.source==='gps'&&<p className="text-xs text-slate-400">Última posición recibida · precisión {Math.round(row.accuracy||0)} m</p>}
    {row.source!=='gps'&&<p className="text-xs text-slate-400">{row.userId?'El celular aún no ha enviado una ubicación.':kind==='leaders'?'El correo del líder debe corresponder a una cuenta activa de esta organización.':'Vincule el teléfono del conductor a su cuenta de usuario, o asígnele un recorrido con este vehículo.'}{row.source==='registered'?' El mapa muestra la ubicación guardada en su ficha.':''}</p>}
    <div className="flex flex-wrap gap-2"><button type="button" disabled={!row.point} onClick={()=>onLocate(row)} className="min-h-12 rounded-lg border border-slate-600 px-4 py-3 text-white disabled:opacity-40">Ver ubicación</button>{onHistory&&(kind==='vehicles'||row.routeId)&&<button type="button" onClick={()=>onHistory(row)} className="min-h-12 rounded-lg bg-cyan-600 px-4 py-3 font-semibold text-white">{kind==='vehicles'?'Ver recorridos del conductor':'Ver recorrido'}</button>}</div>
  </article>)}</div>;
}
