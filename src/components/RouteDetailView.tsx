import React, {useMemo, useRef, useState} from 'react';
import {ArrowLeft, MapPin} from 'lucide-react';
import type {AssignedRoute, RouteSample} from '../lib/routeTracking';
import {routeProgress} from '../lib/routeTracking';
import {detailSamples, routeClock, routeDateTime, routeDuration, routeTiming} from '../lib/routePresentation';
import {recordedTrackLayers} from '../lib/recordedTrack';
import {googleDirectionsUrl, type TerritoryPoint} from '../lib/territorialMaps';
import {SatelliteRadarCanvas, type BaseLayer} from './SatelliteRadarCanvas';

export function RouteDetailView({route, samples, loading, error, onRetry, onBack}: {
  key?: string; route: AssignedRoute; samples: RouteSample[]; loading: boolean; error: string; onRetry: () => void; onBack: () => void;
}) {
  const [layer, setLayer] = useState<BaseLayer>('streets');
  const [focusedId, setFocusedId] = useState('');
  const [limit, setLimit] = useState(20);
  const mapPanel = useRef<HTMLElement>(null);
  const ordered = useMemo(() => detailSamples(route, samples), [route, samples]);
  const good = useMemo(() => ordered.filter(sample => sample.accuracy <= 100), [ordered]);
  const progress = useMemo(() => routeProgress(route.route, ordered), [route.route, ordered]);
  const timing = useMemo(() => routeTiming(route, ordered), [route, ordered]);
  const trace = useMemo(() => recordedTrackLayers(route, ordered), [route, ordered]);
  const first = good[0], last = good.at(-1);
  const focused = good.find(sample => sample.id === focusedId);
  const points = useMemo((): TerritoryPoint[] => {
    const rows = [first, last, focused].filter((sample): sample is RouteSample => !!sample);
    return [...new Map(rows.map(sample => [sample.id, sample])).values()].map(sample => ({...sample, recordId: route.id, type: sample.id === first?.id ? 'leader' : 'vehicle', name: `${sample.id === first?.id ? 'Inicio' : sample.id === last?.id ? 'Última posición' : 'Punto seleccionado'} · ${routeClock(sample.capturedAtMillis)}`, subtitle: route.employeeName, municipality: '', status: route.status}));
  }, [first, last, focused, route.id, route.employeeName, route.status]);
  const labels = useMemo(() => Object.fromEntries(points.map(point => [point.id, point.id === first?.id ? 'A' : point.id === last?.id ? 'B' : '•'])), [points, first?.id, last?.id]);
  const fitCoordinates = useMemo(() => [...good, ...route.route.geometry], [good, route.route.geometry]);
  const button = 'min-h-12 rounded-xl border border-slate-600 bg-slate-800 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-700';
  const selectSample = (sample: RouteSample) => {setFocusedId(sample.id); mapPanel.current?.scrollIntoView({block:'start', behavior:'smooth'}); mapPanel.current?.focus({preventScroll:true});};
  return <div className="min-w-0 space-y-5" data-testid="route-detail">
    <button type="button" onClick={onBack} className={`${button} inline-flex items-center gap-2`}><ArrowLeft size={18} />Volver a recorridos</button>
    <header className="space-y-2"><p className="text-sm font-semibold text-cyan-300">Detalle del recorrido</p><h2 className="break-words text-2xl font-bold text-white">{route.employeeName}</h2><p className="break-words text-slate-300">{route.kind === 'automatic' ? 'Traslado automático' : route.name} · {route.status}</p><p className="text-sm text-slate-400">{route.vehiclePlate ? `Vehículo: ${route.vehiclePlate}` : 'Sin vehículo asociado'}</p></header>
    {loading && <p role="status" className="rounded-xl bg-slate-900 p-4">Cargando puntos del recorrido…</p>}
    {error && <div role="alert" className="rounded-xl border border-rose-800 bg-rose-950/30 p-4"><p>{error}</p><button type="button" className={`${button} mt-3`} onClick={onRetry}>Volver a cargar el recorrido</button></div>}
    <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[
      ['Inicio', routeDateTime(timing.start, true)],
      [timing.finish !== undefined ? 'Finalización' : 'Último registro', routeDateTime(timing.finish ?? timing.last, true)],
      ['Tiempo registrado', loading || error ? '—' : routeDuration(timing.elapsed)],
      ['Distancia registrada', loading || error || good.length < 2 ? '—' : `${(progress.distance / 1000).toLocaleString('es-CO', {maximumFractionDigits:2})} km`]
    ].map(([label, value]) => <div key={label} className="min-w-0 rounded-xl border border-slate-800 bg-slate-900 p-3"><dt className="text-sm text-slate-400">{label}</dt><dd className="mt-2 break-words text-base font-bold text-white">{value}</dd></div>)}</dl>
    {!loading && !error && <>
      {!good.length && <div role="status" className="rounded-xl border border-slate-700 bg-slate-900 p-4"><h3 className="font-bold">{ordered.length ? 'Las posiciones disponibles tienen poca precisión' : 'Este recorrido todavía no tiene puntos GPS registrados'}</h3><p className="mt-2 text-sm text-slate-400">{ordered.length ? 'Puede consultar sus horas y precisión en el historial. El trazado aparecerá cuando existan posiciones con precisión suficiente.' : route.status === 'Asignado' ? 'La ruta está asignada. El trayecto real aparecerá cuando el celular empiece a enviar posiciones.' : 'La ficha del recorrido existe, pero no hay posiciones disponibles para dibujar su trayecto.'}</p></div>}
      {good.length === 1 && <p role="status" className="rounded-xl border border-amber-800 bg-amber-950/20 p-4 text-sm text-amber-100">Solo hay un punto GPS registrado. Se muestra su ubicación; hacen falta más posiciones para dibujar un trayecto.</p>}
      {(good.length > 0 || route.route.geometry.length > 0) && <section ref={mapPanel} tabIndex={-1} aria-label="Mapa del recorrido" className="scroll-mt-20 space-y-3 focus:outline-none">
        <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-lg font-bold text-white">Mapa del recorrido</h3><div className="flex gap-2">{(['streets', 'satellite'] as const).map(value => <button type="button" key={value} aria-pressed={layer === value} className={`${button} ${layer === value ? '!border-cyan-400 !text-cyan-200' : ''}`} onClick={() => setLayer(value)}>{value === 'streets' ? 'Calles' : 'Satelital'}</button>)}</div></div>
        <SatelliteRadarCanvas center={focused || first || route.route.geometry[0]} points={points} selectedId={focusedId} markerLabels={labels} layer={layer} route={route.route.geometry} geographicLayers={trace} fitCoordinates={fitCoordinates} onSelectPoint={point => setFocusedId(point.id)} />
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm"><span className="text-emerald-300">A · Inicio registrado</span>{good.length > 1 && <span className="text-blue-300">B · Última posición</span>}{trace.length > 0 && <span className="text-amber-300">Línea ámbar · Trayecto registrado</span>}{route.route.geometry.length > 1 && <span className="text-cyan-300">Línea cian · Ruta planificada</span>}</div>
        {focused && <p role="status" className="text-sm text-cyan-200">Punto seleccionado: {routeDateTime(focused.capturedAtMillis, true)} · precisión de {Math.round(focused.accuracy)} m</p>}
        {progress.gaps > 0 && <p className="text-sm text-amber-200">Hay {progress.gaps} {progress.gaps === 1 ? 'interrupción' : 'interrupciones'} de más de 2 minutos. Los tramos sin señal no se unen ni se incluyen en la distancia.</p>}
      </section>}
      <section aria-label="Puntos del recorrido" className="space-y-3 rounded-2xl border border-slate-700 bg-slate-900 p-4 sm:p-5"><h3 className="text-lg font-bold text-white">Puntos registrados ({ordered.length})</h3><p className="text-sm text-slate-400">En orden de recorrido. Pulse un punto para localizarlo en el mapa. Horas de Colombia.</p>
        <ol className="space-y-2">{ordered.slice(0, limit).map((sample, index) => <li key={sample.id}><button type="button" aria-label={`Ver punto ${index + 1} en el mapa`} disabled={sample.accuracy > 100} onClick={() => selectSample(sample)} className={`flex min-h-14 w-full items-center justify-between gap-3 rounded-xl border p-3 text-left disabled:opacity-60 ${focusedId === sample.id ? 'border-cyan-500 bg-cyan-950/30' : 'border-slate-700 bg-slate-950 hover:border-cyan-700'}`}><span className="min-w-0"><span className="block font-semibold text-white">{index + 1}. {routeClock(sample.capturedAtMillis)}</span><span className="mt-1 block text-sm text-slate-400">{sample.accuracy > 100 ? 'Precisión insuficiente' : `Precisión: ${Math.round(sample.accuracy)} m`}</span></span><MapPin size={20} className="shrink-0 text-cyan-300" /></button></li>)}</ol>
        {!ordered.length && <p className="text-sm text-slate-400">Aún no hay puntos para consultar.</p>}
        {ordered.length > limit && <button type="button" className={`${button} w-full`} onClick={() => setLimit(value => value + 20)}>Ver más puntos ({ordered.length - limit} pendientes)</button>}
      </section>
    </>}
    {route.instructions && <section className="rounded-xl bg-slate-900 p-4"><h3 className="font-bold">Instrucciones</h3><p className="mt-2 whitespace-pre-wrap text-sm text-slate-300">{route.instructions}</p></section>}
    {route.kind !== 'automatic' && progress.total > 0 && <p className="text-sm text-slate-400">Controles visitados: {progress.visited} de {progress.total}.</p>}
    {route.route.stops.length >= 2 && <a className={`${button} inline-flex items-center`} href={googleDirectionsUrl(route.route.stops)} target="_blank" rel="noreferrer">Abrir ruta planificada en Google Maps ↗</a>}
  </div>;
}
