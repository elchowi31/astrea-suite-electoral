import React, {useMemo, useState} from 'react';
import {ArrowRight, Route} from 'lucide-react';
import type {AssignedRoute} from '../lib/routeTracking';
import {routeDateTime, routeDay, routeTime} from '../lib/routePresentation';

export function RouteHistoryList({routes, loading, error, onRetry, onOpen}: {
  routes: AssignedRoute[]; loading: boolean; error: string; onRetry: () => void; onOpen: (id: string) => void;
}) {
  const [person, setPerson] = useState('');
  const [day, setDay] = useState('');
  const members = useMemo(() => [...new Map(routes.map(route => [route.userId, route.employeeName])).entries()], [routes]);
  const filtered = useMemo(() => routes.filter(route => (!person || route.userId === person) && (!day || routeDay(route) === day))
    .sort((a, b) => routeTime(b) - routeTime(a)), [routes, person, day]);
  const input = 'mt-1 min-h-12 w-full min-w-0 rounded-xl border border-slate-700 bg-slate-950 p-3 text-base text-white';
  return <section aria-label="Lista de recorridos" className="space-y-4">
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="min-w-0 text-sm text-slate-300">Persona<select aria-label="Filtrar recorridos por persona" className={input} value={person} onChange={event => setPerson(event.target.value)}><option value="">Todas las personas</option>{members.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
      <label className="min-w-0 text-sm text-slate-300">Fecha<input aria-label="Filtrar recorridos por fecha" type="date" className={input} value={day} onInput={event => setDay(event.currentTarget.value)} onChange={event => setDay(event.target.value)} /></label>
    </div>
    {(person || day) && <button type="button" className="min-h-12 rounded-xl border border-slate-700 px-4 text-sm text-cyan-200" onClick={() => {setPerson(''); setDay('');}}>Mostrar todos los recorridos</button>}
    {loading && <p role="status" className="py-4 text-slate-300">Cargando recorridos…</p>}
    {error && <div role="alert" className="rounded-xl border border-rose-800 bg-rose-950/30 p-4"><p>{error}</p><button type="button" onClick={onRetry} className="mt-3 min-h-12 rounded-lg border border-slate-500 px-4">Volver a intentar</button></div>}
    {!loading && !error && <p className="text-sm text-slate-400">{filtered.length} {filtered.length === 1 ? 'recorrido' : 'recorridos'} · del más reciente al más antiguo</p>}
    <div className="grid gap-4 lg:grid-cols-2">{filtered.map(route => <article key={route.id} className="flex min-w-0 flex-col gap-3 rounded-2xl border border-slate-700 bg-slate-900 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2"><h3 className="min-w-0 break-words text-lg font-bold text-white">{route.employeeName}</h3><span className={`rounded-full px-3 py-1 text-sm ${route.status === 'En curso' ? 'bg-emerald-950 text-emerald-200' : 'bg-slate-800 text-slate-200'}`}>{route.status}</span></div>
      <p className="break-words text-slate-300">{route.kind === 'automatic' ? 'Traslado automático' : route.name}</p>
      <p className="text-sm text-slate-400">{route.startedAt || route.startedAtMillis !== undefined ? 'Inicio' : 'Creado'}: {routeDateTime(routeTime(route))}</p>
      {route.scheduledDate && route.kind !== 'automatic' && <p className="text-sm text-slate-400">Fecha prevista: {route.scheduledDate}</p>}
      <p className="text-sm text-slate-400">{route.vehiclePlate ? `Vehículo: ${route.vehiclePlate}` : 'Sin vehículo asociado'}</p>
      <button type="button" aria-label={`Ver detalle del recorrido de ${route.employeeName}, ${routeDateTime(routeTime(route))}`} onClick={() => onOpen(route.id)} className="mt-auto flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-cyan-500 px-4 py-3 text-base font-bold text-slate-950 hover:bg-cyan-400">Ver detalle <ArrowRight size={18} /></button>
    </article>)}</div>
    {!loading && !error && !filtered.length && <div className="rounded-2xl border border-slate-700 bg-slate-900 p-6 text-center"><Route className="mx-auto mb-3 text-cyan-300" size={28} /><h3 className="font-bold text-white">{routes.length ? 'No hay recorridos con estos filtros' : 'Este equipo aún no tiene recorridos registrados'}</h3><p className="mt-2 text-sm text-slate-400">{routes.length ? 'Cambie la persona o la fecha para consultar otros trayectos.' : 'Los traslados aparecerán cuando un celular configurado registre movimiento. Compruebe también el equipo seleccionado arriba.'}</p></div>}
  </section>;
}
