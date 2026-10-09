import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Bus, MapPin, Navigation, Radio, Route, Users } from 'lucide-react';
import type { Leader, TransportVehicle, UserProfile, UserRole } from '../types';
import { filterLeadersByScope, filterVehiclesByScope } from '../lib/permissions';
import { ASTREA_CENTER, calculateRoadRoute, currentDeviceLocation, googleDirectionsUrl, googleLocationUrl,
  territoryPoints, type Coordinate, type RouteStop, type TerritorialRoute, type TerritoryPoint } from '../lib/territorialMaps';
import { saveTerritorialLocation, saveVehicleRoute } from '../lib/mapPersistence';
import { SatelliteRadarCanvas } from './SatelliteRadarCanvas';
import { GoogleTerritorialMap } from './GoogleTerritorialMap';

interface Props {
  leaders?: Leader[]; vehicles?: TransportVehicle[]; tenantName?: string;
  tenantId: string; currentUser: UserProfile; userRole: UserRole; readOnly?: boolean;
}
const input = 'w-full min-w-0 rounded-lg border border-slate-700 bg-slate-950 p-2.5 text-xs text-slate-200';
const button = 'rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 disabled:opacity-40';
const section = 'rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:p-5';
const EMPTY_GEOMETRY: Coordinate[] = [];
export const TerritorialMapView: React.FC<Props> = ({ leaders = [], vehicles = [], tenantName = 'Organización', tenantId, currentUser, userRole, readOnly = false }) => {
  const scopedLeaders = useMemo(() => filterLeadersByScope(leaders, currentUser, userRole, tenantId), [leaders, currentUser, userRole, tenantId]);
  const scopedVehicles = useMemo(() => filterVehiclesByScope(vehicles, currentUser, userRole, tenantId), [vehicles, currentUser, userRole, tenantId]);
  const points = useMemo(() => territoryPoints(scopedLeaders, scopedVehicles), [scopedLeaders, scopedVehicles]);
  const [municipality, setMunicipality] = useState('todos'); const [zone, setZone] = useState('todos');
  const [type, setType] = useState('all'); const [search, setSearch] = useState('');
  const [view, setView] = useState<'satellite' | 'streets' | 'google'>('satellite');
  const [selectedId, setSelectedId] = useState(''); const [picked, setPicked] = useState<Coordinate | null>(null);
  const [pickedSource, setPickedSource] = useState<'GPS' | 'Mapa'>('Mapa');
  const [focus, setFocus] = useState<Coordinate | null>(null); const [recordId, setRecordId] = useState('');
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState(''); const [tracking, setTracking] = useState(false);
  const watch = useRef<number | null>(null); const mounted = useRef(true); const gpsBusy = useRef(false);
  const [stops, setStops] = useState<RouteStop[]>([]); const [stopChoice, setStopChoice] = useState('');
  const [route, setRoute] = useState<TerritorialRoute | null>(null); const [routeName, setRouteName] = useState('');
  const [routeVehicleId, setRouteVehicleId] = useState(''); const [routing, setRouting] = useState(false);
  const routeRequest = useRef<AbortController | null>(null);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; if (watch.current !== null) navigator.geolocation.clearWatch(watch.current); routeRequest.current?.abort(); }; }, []);
  useEffect(() => { if (watch.current !== null) navigator.geolocation.clearWatch(watch.current); watch.current = null; setTracking(false); }, [tenantId]);
  const filtered = useMemo(() => points.filter(point => (municipality === 'todos' || point.municipality === municipality)
    && (zone === 'todos' || point.subtitle === zone) && (type === 'all' || point.type === type)
    && `${point.name} ${point.subtitle} ${point.municipality}`.toLocaleLowerCase('es').includes(search.toLocaleLowerCase('es').trim())), [points, municipality, zone, type, search]);
  const municipalities = [...new Set([...scopedLeaders, ...scopedVehicles].map(item => item.municipality || 'Sin municipio'))].sort();
  const zones = [...new Set(points.filter(point => municipality === 'todos' || point.municipality === municipality).map(point => point.subtitle).filter(Boolean))].sort();
  const selected = points.find(point => point.id === selectedId);
  const center = useMemo(() => focus || filtered[0] || ASTREA_CENTER, [focus, filtered]);
  const location = picked || selected || null;
  const records = [...scopedLeaders.map(item => ({ key: `leader-${item.id}`, id: item.id, type: 'leader' as const, name: item.fullName })),
    ...scopedVehicles.map(item => ({ key: `vehicle-${item.id}`, id: item.id, type: 'vehicle' as const, name: `${item.licensePlate} · ${item.driverName}` }))];
  const selectedRecord = records.find(item => item.key === recordId);
  const selectPoint = (point: TerritoryPoint) => { setSelectedId(point.id); setPicked(null); setFocus(point); setRecordId(point.id); };
  const pickLocation = (point: Coordinate) => { setPicked(point); setPickedSource('Mapa'); setSelectedId(''); };
  const changeStops = (next: RouteStop[]) => { routeRequest.current?.abort(); setStops(next); setRoute(null); setRouting(false); };
  const addStop = (point: Coordinate, name: string) => {
    if (stops.length >= 5) return setMessage('La ruta admite hasta cinco paradas.');
    changeStops([...stops, { latitude: point.latitude, longitude: point.longitude, name }]);
  };
  const stopTracking = () => { if (watch.current !== null) navigator.geolocation.clearWatch(watch.current); watch.current = null; setTracking(false); };
  const useGPS = async () => {
    setBusy(true); setMessage('');
    try { const point = await currentDeviceLocation(); if (mounted.current) { setPicked(point); setPickedSource('GPS'); setFocus(point); setSelectedId(''); setMessage(`GPS obtenido; precisión aproximada de ${Math.round(point.accuracy)} m. Seleccione un registro para guardar la ubicación.`); } }
    catch (error) { if (mounted.current) setMessage((error as Error).message); } finally { if (mounted.current) setBusy(false); }
  };
  const startTracking = () => {
    if (!selectedRecord || readOnly) return setMessage('Seleccione el vehículo o líder que lleva este dispositivo.');
    if (!navigator.geolocation) return setMessage('El navegador no permite compartir GPS.');
    const target = selectedRecord; let lastSaved = 0; setMessage('Solicitando GPS…'); setTracking(true);
    watch.current = navigator.geolocation.watchPosition(async position => {
      if (gpsBusy.current || Date.now() - lastSaved < 10000) return;
      gpsBusy.current = true;
      const point = { latitude: position.coords.latitude, longitude: position.coords.longitude };
      try { await saveTerritorialLocation(target.type, target.id, tenantId, point, 'GPS'); lastSaved = Date.now();
        if (mounted.current) { setFocus(point); setMessage(`Compartiendo GPS de ${target.name}. Última actualización: ${new Date().toLocaleTimeString('es-CO')}.`); } }
      catch (error) { stopTracking(); if (mounted.current) setMessage((error as Error).message); }
      finally { gpsBusy.current = false; }
    }, error => { stopTracking(); if (mounted.current) setMessage(error.code === 1 ? 'Permita el acceso al GPS en su navegador.' : 'El GPS no está disponible. Vuelva a iniciar cuando tenga señal.'); },
    { enableHighAccuracy: true, timeout: 20000, maximumAge: 5000 });
  };
  const calculate = async () => {
    routeRequest.current?.abort(); const controller = new AbortController(); routeRequest.current = controller;
    setRouting(true); setMessage('');
    try { const result = await calculateRoadRoute(stops, controller.signal); if (!controller.signal.aborted && mounted.current) { setRoute(result); if (!routeName.trim()) setRouteName(result.name); } }
    catch (error) { if (!controller.signal.aborted && mounted.current) setMessage((error as Error).message || 'No se pudo calcular. Abra la ruta en Google Maps.'); }
    finally { if (mounted.current && routeRequest.current === controller) setRouting(false); }
  };
  return <div className="space-y-5">
    <header className={section}>
      <div className="flex items-center gap-3"><MapPin className="text-cyan-300" /><div><h2 className="text-xl font-bold text-white">Cobertura territorial</h2><p className="mt-1 text-xs text-slate-400">Mapa satelital, ubicaciones y rutas de {tenantName}</p></div></div>
      <div className="mt-4 flex flex-wrap gap-2" aria-label="Visor del mapa">
        {([['satellite', 'Satelital HD'], ['streets', 'Calles'], ['google', 'Google Maps']] as const).map(([value, label]) => <button key={value} type="button" aria-pressed={view === value} className={`${button} ${view === value ? '!border-cyan-500 !bg-cyan-600 !text-white' : ''}`} onClick={() => setView(value)}>{label}</button>)}
        <button type="button" disabled={busy} onClick={() => void useGPS()} className={button}><Navigation className="mr-1 inline h-4 w-4" />Mi ubicación GPS</button>
        <a href={googleLocationUrl(center)} target="_blank" rel="noreferrer" className={button}>Abrir Google Maps ↗</a>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <label className="text-xs text-slate-400">Municipio<select aria-label="Municipio del mapa" className={`mt-1 ${input}`} value={municipality} onChange={event => { setMunicipality(event.target.value); setZone('todos'); setFocus(null); setSelectedId(''); setPicked(null); }}><option value="todos">Todos los municipios</option>{municipalities.map(item => <option key={item}>{item}</option>)}</select></label>
        <label className="text-xs text-slate-400">Zona, barrio o vereda<select aria-label="Zona del mapa" className={`mt-1 ${input}`} value={zone} onChange={event => { setZone(event.target.value); setFocus(null); setSelectedId(''); setPicked(null); }}><option value="todos">Todas las zonas</option>{zones.map(item => <option key={item}>{item}</option>)}</select></label>
        <label className="text-xs text-slate-400">Recursos<select aria-label="Recursos del mapa" className={`mt-1 ${input}`} value={type} onChange={event => { setType(event.target.value); setSelectedId(''); setPicked(null); }}><option value="all">Líderes y vehículos</option><option value="leader">Líderes</option><option value="vehicle">Vehículos</option></select></label>
        <label className="text-xs text-slate-400">Buscar<input aria-label="Buscar ubicación" className={`mt-1 ${input}`} value={search} onChange={event => { setSearch(event.target.value); setSelectedId(''); setPicked(null); }} placeholder="Nombre, placa, municipio o vereda" /></label>
      </div>
    </header>
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {[[MapPin, 'Ubicaciones', points.length], [Users, 'Líderes ubicados', points.filter(point => point.type === 'leader').length], [Bus, 'Vehículos ubicados', points.filter(point => point.type === 'vehicle').length], [Navigation, 'Por ubicar', records.length - points.length]].map(([Icon, label, count]) => { const Component = Icon as typeof MapPin; return <div key={String(label)} className={section}><p className="text-xs text-slate-400"><Component className="mr-2 inline h-4 w-4 text-cyan-300" />{String(label)}</p><p className="mt-2 text-2xl font-bold text-white">{Number(count)}</p></div>; })}
    </div>
    <div className="space-y-2">
      {view === 'google' ? <GoogleTerritorialMap center={center} points={filtered} route={route?.geometry || EMPTY_GEOMETRY} pickedLocation={picked} onSelectPoint={selectPoint} onPickLocation={pickLocation} />
        : <SatelliteRadarCanvas center={center} points={filtered} selectedId={selectedId} layer={view} route={route?.geometry || EMPTY_GEOMETRY} pickedLocation={picked} onSelectPoint={selectPoint} onPickLocation={pickLocation} />}
      <p className="text-xs text-slate-400">{filtered.length} ubicaciones visibles. Toque un punto para ver sus datos, o un lugar del mapa para registrar una ubicación. Las imágenes satelitales corresponden a la cobertura del proveedor.</p>
    </div>
    {message && <p role="status" className="rounded-xl border border-cyan-800 bg-cyan-950/40 p-3 text-sm text-cyan-100">{message}</p>}
    <div className="grid items-start gap-4 xl:grid-cols-2">
      <section className={section}>
        <h3 className="flex items-center gap-2 text-sm font-bold text-white"><MapPin size={18} />Ubicación seleccionada</h3>
        <p className="mt-2 text-xs text-slate-400">{selected ? `${selected.name} · ${selected.municipality} · ${selected.subtitle}` : picked ? 'Punto elegido en el mapa o por GPS' : 'Seleccione un punto en el mapa o use su GPS.'}</p>
        {location && <><p className="mt-2 font-mono text-xs text-amber-300">{location.latitude.toFixed(7)}, {location.longitude.toFixed(7)}</p>
          {selected?.capturedAt && <p className="mt-1 text-xs text-slate-400">Registrada: {new Date(selected.capturedAt).toLocaleString('es-CO')}</p>}
          <div className="mt-3 flex flex-wrap gap-2"><button type="button" className={button} onClick={() => addStop(location, selected?.name || `Punto ${stops.length + 1}`)}>Añadir a ruta</button><a className={button} href={googleLocationUrl(location)} target="_blank" rel="noreferrer">Ver en Google Maps ↗</a></div></>}
        <label className="mt-4 block text-xs text-slate-400">Guardar ubicación de<select aria-label="Registro a ubicar" disabled={tracking || readOnly} className={`mt-1 ${input}`} value={recordId} onChange={event => setRecordId(event.target.value)}><option value="">Seleccione líder o vehículo</option>{records.map(item => <option key={item.key} value={item.key}>{item.type === 'leader' ? 'Líder' : 'Vehículo'}: {item.name}</option>)}</select></label>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" disabled={!location || !selectedRecord || busy || tracking || readOnly} className={button} onClick={async () => { if (!location || !selectedRecord) return; setBusy(true); try { await saveTerritorialLocation(selectedRecord.type, selectedRecord.id, tenantId, location, picked ? pickedSource : 'Mapa'); setMessage('Ubicación guardada en Firestore.'); } catch (error) { setMessage((error as Error).message); } finally { setBusy(false); } }}>Guardar ubicación</button>
          <button type="button" className={button} disabled={readOnly || (!tracking && (!selectedRecord || busy))} onClick={() => { if (tracking) { stopTracking(); setMessage('GPS compartido detenido. La última ubicación guardada permanece disponible.'); } else startTracking(); }}><Radio className="mr-1 inline h-4 w-4" />{tracking ? 'Detener GPS compartido' : 'Compartir GPS de este registro'}</button>
        </div><p className="mt-2 text-[11px] text-slate-500">El GPS compartido actualiza la posición mientras esta vista y el navegador permanecen abiertos. Puede detenerlo en cualquier momento.</p>
      </section>
      <section className={section}>
        <h3 className="flex items-center gap-2 text-sm font-bold text-white"><Route size={18} />Planificar ruta por carretera</h3>
        <p className="mt-2 text-xs text-slate-400">El orden de las paradas define el recorrido. Distancia y tiempo son estimaciones, sin tráfico en vivo.</p>
        <div className="mt-3 flex gap-2"><select aria-label="Parada para la ruta" className={input} value={stopChoice} onChange={event => setStopChoice(event.target.value)}><option value="">Seleccione una ubicación registrada</option>{points.map(point => <option key={point.id} value={point.id}>{point.name} · {point.municipality}</option>)}</select><button type="button" className={button} disabled={!stopChoice || stops.length >= 5 || routing} onClick={() => { const point = points.find(item => item.id === stopChoice); if (point) addStop(point, point.name); }}>Añadir parada</button></div>
        <ol className="mt-3 space-y-2">{stops.map((stop, index) => <li key={index} className="flex items-center gap-2 rounded-lg bg-slate-950 p-2 text-xs text-slate-300"><span className="min-w-0 flex-1 break-words">{index + 1}. {stop.name} {index === 0 ? '(origen)' : index === stops.length - 1 ? '(destino)' : ''}</span><button type="button" className={button} aria-label={`Subir parada ${index + 1}`} disabled={index === 0 || routing} onClick={() => { const next = [...stops]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; changeStops(next); }}>↑</button><button type="button" className={button} aria-label={`Quitar parada ${index + 1}`} disabled={routing} onClick={() => changeStops(stops.filter((_, i) => i !== index))}>×</button></li>)}</ol>
        <div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={stops.length < 2 || routing} className={button} onClick={() => void calculate()}>{routing ? 'Calculando carretera…' : 'Calcular ruta'}</button>{stops.length >= 2 && <a className={button} href={googleDirectionsUrl(stops)} target="_blank" rel="noreferrer">Navegar en Google Maps ↗</a>}<button type="button" className={button} disabled={!stops.length || routing} onClick={() => { changeStops([]); setRouteName(''); }}>Limpiar ruta</button></div>
        {route && <div className="mt-4 space-y-3 rounded-xl border border-cyan-800 bg-cyan-950/30 p-3"><p className="text-sm font-semibold text-cyan-200">{(route.distanceMeters / 1000).toLocaleString('es-CO', { maximumFractionDigits: 1 })} km · {Math.max(1, Math.round(route.durationSeconds / 60))} min aproximados</p>
          <label className="block text-xs text-slate-300">Nombre de ruta<input aria-label="Nombre de ruta" maxLength={160} className={`mt-1 ${input}`} value={routeName} onChange={event => setRouteName(event.target.value)} /></label>
          <label className="block text-xs text-slate-300">Asignar a vehículo<select aria-label="Vehículo para la ruta" className={`mt-1 ${input}`} value={routeVehicleId} onChange={event => setRouteVehicleId(event.target.value)}><option value="">Seleccione vehículo</option>{scopedVehicles.map(vehicle => <option key={vehicle.id} value={vehicle.id}>{vehicle.licensePlate} · {vehicle.driverName}</option>)}</select></label>
          <button type="button" className={button} disabled={!routeVehicleId || !routeName.trim() || busy || readOnly} onClick={async () => { setBusy(true); try { await saveVehicleRoute(routeVehicleId, tenantId, { ...route, name: routeName.trim() }); setMessage('Ruta asignada al vehículo y guardada en Firestore.'); } catch (error) { setMessage((error as Error).message); } finally { setBusy(false); } }}>Guardar ruta del vehículo</button>
        </div>}
        <div className="mt-4 space-y-2">{scopedVehicles.filter(vehicle => vehicle.plannedRoute).map(vehicle => <div key={vehicle.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-950 p-3 text-xs"><span className="text-slate-300">{vehicle.licensePlate} · {vehicle.plannedRoute!.name}</span><button type="button" disabled={routing} className={button} onClick={() => { const saved = vehicle.plannedRoute!; routeRequest.current?.abort(); setStops(saved.stops); setRoute(saved); setRouteName(saved.name); setRouteVehicleId(vehicle.id); }}>Cargar ruta guardada</button></div>)}</div>
      </section>
    </div>
    <section className={section}><h3 className="text-sm font-bold text-white">Registros territoriales</h3>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{filtered.map(point => <button type="button" key={point.id} onClick={() => selectPoint(point)} className="min-w-0 rounded-xl border border-slate-700 bg-slate-950 p-3 text-left hover:border-cyan-500"><p className="break-words text-xs font-bold text-white">{point.name}</p><p className="mt-1 text-xs text-slate-400">{point.municipality} · {point.subtitle}</p><p className="mt-1 font-mono text-[10px] text-slate-500">{point.latitude.toFixed(5)}, {point.longitude.toFixed(5)}</p></button>)}</div>
      {!filtered.length && <p className="mt-3 text-xs text-slate-400">Aún no hay registros con coordenadas para este filtro. El mapa permanece disponible para ubicar los registros.</p>}
    </section>
  </div>;
};
