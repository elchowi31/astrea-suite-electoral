import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Bus, MapPin, Navigation, Route, Users, X, ArrowLeft, SlidersHorizontal, Layers } from 'lucide-react';
import {createPortal} from 'react-dom';
import {GeographicFeatureCard} from './GeographicFeatureCard';
import {mapTeams,matchesMapTeam} from '../lib/mapTeams';
import { isTrackingAdministrator } from '../lib/trackingPermissions';
import type { Candidate, Leader, TransportVehicle, UserProfile, UserRole } from '../types';
import { filterLeadersByScope, filterVehiclesByScope } from '../lib/permissions';
import { ASTREA_CENTER, calculateRoadRoute, currentDeviceLocation, googleDirectionsUrl, googleLocationUrl,
  territoryPoints, type Coordinate, type RouteStop, type TerritorialRoute, type TerritoryPoint } from '../lib/territorialMaps';
import { saveTerritorialLocation, saveVehicleRoute } from '../lib/mapPersistence';
import { SatelliteRadarCanvas } from './SatelliteRadarCanvas';
import { GoogleTerritorialMap } from './GoogleTerritorialMap';
import { GeographicImportPanel } from './GeographicImportPanel';
import { subscribeToCollection } from '../lib/firebase';
import { importedPoints, layerCoordinates, geographicFeatureMatches, geographicProperty, type GeographicLayer } from '../lib/geographicImport';
import {useTeamPositions} from './useTeamPositions';
import {useRouteTracking} from './RouteTrackingProvider';
import {teamLocations} from '../lib/teamLocations';
import {TeamLocationList} from './TeamLocationList';

interface Props {
  candidates?:Candidate[]; onExit?:()=>void;
  leaders?: Leader[]; vehicles?: TransportVehicle[]; tenantName?: string;
  tenantId: string; currentUser: UserProfile; userRole: UserRole; members?:UserProfile[]; readOnly?: boolean; onOpenTracking?: (routeId?:string) => void;
}
const input = 'w-full min-w-0 rounded-lg border border-slate-700 bg-slate-950 p-2.5 text-xs text-slate-200';
const button = 'rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 disabled:opacity-40';
const section = 'rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:p-5';
const EMPTY_GEOMETRY: Coordinate[] = [];
export const TerritorialMapView: React.FC<Props> = ({ candidates=[],onExit,leaders = [], vehicles = [], members=[], tenantName = 'Organización', tenantId, currentUser, userRole, readOnly = false, onOpenTracking }) => {
  const scopedLeaders = useMemo(() => filterLeadersByScope(leaders, currentUser, userRole, tenantId), [leaders, currentUser, userRole, tenantId]);
  const scopedVehicles = useMemo(() => filterVehiclesByScope(vehicles, currentUser, userRole, tenantId), [vehicles, currentUser, userRole, tenantId]);
  const [geographicLayers,setGeographicLayers]=useState<GeographicLayer[]>([]);const [hiddenLayers,setHiddenLayers]=useState<Set<string>>(new Set());
  useEffect(()=>readOnly?undefined:subscribeToCollection<GeographicLayer>('capas_geograficas',setGeographicLayers,[],tenantId),[tenantId,readOnly]);
  const shownLayers=useMemo(()=>geographicLayers.filter(layer=>!hiddenLayers.has(layer.importId)),[geographicLayers,hiddenLayers]);
  const tracking=useRouteTracking(), live=useTeamPositions(currentUser,tenantId,!readOnly);
  const administrator=isTrackingAdministrator(currentUser)&&!readOnly;
  const teams=useMemo(()=>teamLocations({viewer:administrator?currentUser:null,tenantId,leaders:scopedLeaders,vehicles:scopedVehicles,members,positions:live.positions,routes:tracking.routes,now:live.now}),[administrator,currentUser,tenantId,scopedLeaders,scopedVehicles,members,live.positions,tracking.routes,live.now]);
  const teamRows=useMemo(()=>mapTeams({viewer:currentUser,tenantId,leaders:scopedLeaders,members,positions:live.positions,teams,now:live.now}),[currentUser,tenantId,scopedLeaders,members,live.positions,teams,live.now]);
  const points = useMemo(() => [...(administrator?teamRows.flatMap(row=>row.point?[row.point]:[]):territoryPoints(scopedLeaders, scopedVehicles)),...importedPoints(shownLayers)], [administrator,teamRows,scopedLeaders, scopedVehicles,shownLayers]);
  const [drawer,setDrawer]=useState<'filters'|'layers'|'teams'|'tools'|null>(null);
  const [candidate,setCandidate]=useState('all'),[leader,setLeader]=useState('all'),[source,setSource]=useState('all');
  const [featureRef,setFeatureRef]=useState<{layerId:string;featureId:string}|null>(null),[placing,setPlacing]=useState(false);
  const [municipality, setMunicipality] = useState('todos'); const [zone, setZone] = useState('todos');
  const [type, setType] = useState('all'); const [search, setSearch] = useState('');
  const [view, setView] = useState<'satellite' | 'streets' | 'google'>('satellite');
  const [selectedId, setSelectedId] = useState(''); const [picked, setPicked] = useState<Coordinate | null>(null);
  const [pickedSource, setPickedSource] = useState<'GPS' | 'Mapa'>('Mapa');
  const [focus, setFocus] = useState<Coordinate | null>(null); const [recordId, setRecordId] = useState('');
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState('');
  const mounted = useRef(true);
  const mapPanel = useRef<HTMLDivElement>(null);
  const layersPanel=useRef<HTMLDivElement>(null),plannerPanel=useRef<HTMLElement>(null);
  const [mapSelection,setMapSelection]=useState<{label:string;coordinates:Coordinate[];kind:'layer'|'route'|'team'}|null>(null);
  const revealMap=()=>requestAnimationFrame(()=>{mapPanel.current?.scrollIntoView({block:'start',behavior:'instant'});mapPanel.current?.focus({preventScroll:true});});
  const clearFilters=()=>{setMunicipality('todos');setZone('todos');setType('all');setSearch('');setCandidate('all');setLeader('all');setSource('all');};
  const viewLayer=(parts:GeographicLayer[])=>{const coordinates=layerCoordinates(parts);if(!coordinates.length)return;setHiddenLayers(previous=>{const next=new Set(previous);next.delete(parts[0].importId);return next;});clearFilters();setFocus({...coordinates[0]});setMapSelection({label:`Capa: ${parts[0].name} · ${parts[0].filename}`,coordinates,kind:'layer'});revealMap();};
  const viewRoute=(saved:TerritorialRoute)=>{changeStops(saved.stops);setRoute(saved);setRouteName(saved.name);setFocus({...saved.geometry[0]});setMapSelection({label:`Ruta: ${saved.name}`,coordinates:[...saved.geometry],kind:'route'});revealMap();};
  const [stops, setStops] = useState<RouteStop[]>([]); const [stopChoice, setStopChoice] = useState('');
  const [route, setRoute] = useState<TerritorialRoute | null>(null); const [routeName, setRouteName] = useState('');
  const [routeVehicleId, setRouteVehicleId] = useState(''); const [routing, setRouting] = useState(false);
  const routeRequest = useRef<AbortController | null>(null);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; routeRequest.current?.abort(); }; }, []);
  const filteredTeams=useMemo(()=>teamRows.filter(row=>matchesMapTeam(row,candidate,leader,source)
    &&(type==='all'||type==='team'||row.kind===type)&&(municipality==='todos'||row.point?.municipality===municipality)
    &&(zone==='todos'||row.point?.subtitle===zone)&&`${row.name} ${row.description} ${row.point?.municipality||''}`.toLocaleLowerCase('es').includes(search.toLocaleLowerCase('es').trim())),[teamRows,candidate,leader,source,type,municipality,zone,search]);
  const allowedTeamPoints=new Set(filteredTeams.flatMap(row=>row.point?[row.point.id]:[]));
  const displayLayers=useMemo(()=>type!=='all'&&type!=='import'?[]:shownLayers.map(layer=>({...layer,features:layer.features.filter(feature=>geographicFeatureMatches(feature,search)
    &&(municipality==='todos'||geographicProperty(feature,['municipio','municipality'])===municipality)
    &&(zone==='todos'||(geographicProperty(feature,['veredaobarrio','barrio','vereda','zona'])||layer.name)===zone))})).filter(layer=>layer.features.length),[shownLayers,search,municipality,zone,type]);
  const importedVisible=new Set(importedPoints(displayLayers).map(point=>point.id));
  const filtered=points.filter(point=>point.type==='import'?importedVisible.has(point.id):administrator?allowedTeamPoints.has(point.id):
    (type==='all'||type==='team'||point.type===type)&&(municipality==='todos'||point.municipality===municipality)&&(zone==='todos'||point.subtitle===zone)&&`${point.name} ${point.subtitle}`.toLocaleLowerCase('es').includes(search.toLocaleLowerCase('es').trim()));
  const municipalities = [...new Set(points.map(item => item.municipality).filter(Boolean))].sort();
  const zones = [...new Set(points.filter(point => municipality === 'todos' || point.municipality === municipality).map(point => point.subtitle).filter(Boolean))].sort();
  const selected = filtered.find(point => point.id === selectedId);
  const selectedLayer=displayLayers.find(layer=>layer.id===featureRef?.layerId),selectedFeature=selectedLayer?.features.find(feature=>feature.id===featureRef?.featureId);
  const center = useMemo(() => focus || ASTREA_CENTER, [focus]);
  const firstFit=useRef(false);
  useEffect(()=>{if(!firstFit.current&&points.length){firstFit.current=true;setMapSelection({label:'Ubicaciones',coordinates:[...points],kind:'layer'});}},[points]);
  useEffect(()=>{const previous=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{document.body.style.overflow=previous;};},[]);
  const selectFeature=(layerId:string,featureId:string)=>{setFeatureRef({layerId,featureId});setSelectedId('');setPicked(null);setDrawer(null);};
  const location = picked || selected || null;
  const records = [...scopedLeaders.map(item => ({ key: `leader-${item.id}`, id: item.id, type: 'leader' as const, name: item.fullName })),
    ...scopedVehicles.map(item => ({ key: `vehicle-${item.id}`, id: item.id, type: 'vehicle' as const, name: `${item.licensePlate} · ${item.driverName}` }))];
  const selectedRecord = records.find(item => item.key === recordId);
  const selectPoint = (point: TerritoryPoint) => { setSelectedId(point.id);setFeatureRef(point.layerId&&point.featureId?{layerId:point.layerId,featureId:point.featureId}:null);setDrawer(null);setPicked(null);setFocus({...point});setRecordId(records.some(record=>record.key===point.id)?point.id:''); };
  const selectRecord = (key: string) => {
    setRecordId(key); setMessage('');
    // Conserve el punto nuevo que se está asignando; consultar otro registro nunca lo sustituye.
    if (picked) { setSelectedId(''); return; }
    const point = points.find(item=>item.id===key);
    setSelectedId(point?.id || ''); setFocus(point || null);
    if (point) {
      setMunicipality('todos'); setZone('todos'); setType('all'); setSearch('');
      requestAnimationFrame(()=>mapPanel.current?.scrollIntoView({block:'start',behavior:'smooth'}));
    }
  };
  const pickLocation = (point: Coordinate) => { if(!placing)return;setFeatureRef(null);setDrawer('tools');setPicked(point); setPickedSource('Mapa'); setSelectedId(''); };
  const changeStops = (next: RouteStop[]) => { routeRequest.current?.abort(); setStops(next); setRoute(null); setRouting(false); };
  const addStop = (point: Coordinate, name: string) => {
    if (stops.length >= 5) return setMessage('La ruta admite hasta cinco paradas.');
    changeStops([...stops, { latitude: point.latitude, longitude: point.longitude, name }]);
  };
  const useGPS = async () => {
    setBusy(true); setMessage('');
    try { const point = await currentDeviceLocation(); if (mounted.current) { setPicked(point); setPickedSource('GPS'); setFocus(point); setSelectedId(''); setMessage(`GPS obtenido; precisión aproximada de ${Math.round(point.accuracy)} m. Seleccione un registro para guardar la ubicación.`); } }
    catch (error) { if (mounted.current) setMessage((error as Error).message); } finally { if (mounted.current) setBusy(false); }
  };
  const calculate = async () => {
    routeRequest.current?.abort(); const controller = new AbortController(); routeRequest.current = controller;
    setRouting(true); setMessage('');
    try { const result = await calculateRoadRoute(stops, controller.signal); if (!controller.signal.aborted && mounted.current) { setRoute(result); if (!routeName.trim()) setRouteName(result.name); } }
    catch (error) { if (!controller.signal.aborted && mounted.current) setMessage((error as Error).message || 'No se pudo calcular. Abra la ruta en Google Maps.'); }
    finally { if (mounted.current && routeRequest.current === controller) setRouting(false); }
  };

  return createPortal(<div className="fixed inset-0 z-[1600] flex h-[100dvh] min-h-0 flex-col bg-slate-950 text-slate-200" aria-label="Espacio de ubicaciones">
    <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-slate-700 bg-slate-950 px-3 py-2">
      <button className={button} onClick={onExit} aria-label="Volver a la plataforma"><ArrowLeft size={18}/></button>
      <div className="mr-auto"><h2 className="text-base font-bold text-white">Ubicaciones</h2><p className="text-[10px] text-slate-400">{tenantName}</p></div>
      <select aria-label="Mapa base" className="rounded-lg border border-slate-700 bg-slate-900 p-2 text-xs" value={view} onChange={e=>setView(e.target.value as typeof view)}><option value="satellite">Satelital HD</option><option value="streets">Calles</option><option value="google">Google Maps</option></select>
      <button aria-expanded={drawer==='filters'} className={button} onClick={()=>setDrawer(drawer==='filters'?null:'filters')}><SlidersHorizontal size={15} className="mr-1 inline"/>Filtros</button>
      <button aria-expanded={drawer==='layers'} className={button} onClick={()=>setDrawer(drawer==='layers'?null:'layers')}><Layers size={15} className="mr-1 inline"/>Capas</button>
      {administrator&&<button aria-expanded={drawer==='teams'} className={button} onClick={()=>setDrawer(drawer==='teams'?null:'teams')}><Users size={15} className="mr-1 inline"/>Equipos</button>}
      <button aria-expanded={drawer==='tools'} className={button} onClick={()=>setDrawer(drawer==='tools'?null:'tools')}><Route size={15} className="mr-1 inline"/>Rutas</button>
    </header>
    <main className="relative min-h-0 flex-1">
      <div ref={mapPanel} tabIndex={-1} aria-label="Mapa territorial" className="h-full focus:outline-none">
        {view==='google'?<GoogleTerritorialMap fill center={center} points={filtered} route={route?.geometry||EMPTY_GEOMETRY} geographicLayers={displayLayers} fitCoordinates={mapSelection?.coordinates} pickedLocation={picked} onSelectPoint={selectPoint} onPickLocation={pickLocation} onSelectFeature={selectFeature}/>
          :<SatelliteRadarCanvas fill center={center} points={filtered} selectedId={selectedId} layer={view} route={route?.geometry||EMPTY_GEOMETRY} geographicLayers={displayLayers} fitCoordinates={mapSelection?.coordinates} pickedLocation={picked} onSelectPoint={selectPoint} onPickLocation={pickLocation} onSelectFeature={selectFeature}/>}
      </div>
      {drawer&&<aside aria-label="Opciones del mapa" className="absolute bottom-3 left-3 top-3 z-[1100] flex w-[min(400px,calc(100%-24px))] flex-col overflow-hidden rounded-2xl border border-slate-600 bg-slate-950/95 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-700 p-3"><h3 className="font-bold">{({filters:'Qué mostrar',layers:'Capas y archivos',teams:'Equipos por aspirante',tools:'Rutas y ubicaciones'})[drawer]}</h3><button aria-label="Cerrar opciones" className="rounded-lg p-2 hover:bg-slate-800" onClick={()=>setDrawer(null)}><X size={18}/></button></div>
        <div className="min-h-0 space-y-4 overflow-auto overscroll-contain p-3">
          {(drawer==='filters'||drawer==='teams')&&<>
            <label className="block text-xs">Buscar<input aria-label="Buscar ubicación" className={'mt-1 '+input} value={search} onChange={e=>setSearch(e.target.value)} placeholder="Nombre, dato de la ficha, placa…"/></label>
            <label className="block text-xs">Mostrar<select aria-label="Recursos del mapa" className={'mt-1 '+input} value={type} onChange={e=>setType(e.target.value)}><option value="all">Emprendimientos y equipos</option><option value="import">Solo emprendimientos / importaciones</option><option value="team">Todos los equipos</option><option value="leader">Solo líderes</option><option value="member">Solo integrantes</option><option value="vehicle">Solo vehículos</option></select></label>
            {administrator&&<div className="space-y-3 rounded-xl border border-slate-700 bg-slate-900 p-3">
              <label className="block text-xs">Aspirante<select aria-label="Aspirante del equipo" className={'mt-1 '+input} value={candidate} onChange={e=>{setCandidate(e.target.value);setLeader('all');}}><option value="all">Todos los aspirantes</option><option value="unassigned">Sin aspirante asignado</option>{candidates.filter(row=>row.tenantId===tenantId).map(row=><option key={row.id} value={row.id}>{row.fullName} · {row.chamber}</option>)}</select></label>
              <label className="block text-xs">Equipo / líder<select aria-label="Equipo del mapa" className={'mt-1 '+input} value={leader} onChange={e=>setLeader(e.target.value)}><option value="all">Todos los equipos</option>{scopedLeaders.filter(row=>candidate==='all'||(candidate==='unassigned'?!row.assignedCandidateId:row.assignedCandidateId===candidate)).map(row=><option key={row.id} value={row.id}>{row.fullName}</option>)}</select></label>
              <label className="block text-xs">Ubicación del equipo<select aria-label="Origen de ubicación" className={'mt-1 '+input} value={source} onChange={e=>setSource(e.target.value)}><option value="all">GPS y ubicaciones registradas</option><option value="gps">Reportes GPS</option><option value="registered">Ubicaciones registradas</option><option value="missing">Sin ubicación (ver lista)</option></select></label>
              <p className="text-[11px] text-slate-400">Estos filtros se aplican a equipos. Los emprendimientos se controlan con «Mostrar» y «Capas».</p>
            </div>}
            <div className="grid grid-cols-2 gap-2"><label className="text-xs">Municipio<select aria-label="Municipio del mapa" className={'mt-1 '+input} value={municipality} onChange={e=>{setMunicipality(e.target.value);setZone('todos');}}><option value="todos">Todos</option>{municipalities.map(item=><option key={item}>{item}</option>)}</select></label><label className="text-xs">Zona / vereda<select aria-label="Zona del mapa" className={'mt-1 '+input} value={zone} onChange={e=>setZone(e.target.value)}><option value="todos">Todas</option>{zones.map(item=><option key={item}>{item}</option>)}</select></label></div>
            <div className="flex gap-2"><button className={button} onClick={clearFilters}>Limpiar filtros</button><button className={button} onClick={()=>{setMapSelection({label:'Resultados del filtro',coordinates:[...filtered,...layerCoordinates(displayLayers)],kind:'layer'});setDrawer(null);}}>Encuadrar resultados</button></div>
            {administrator&&<p className="text-xs text-slate-400">{filteredTeams.filter(row=>row.point).length} recursos ubicados · {filteredTeams.filter(row=>!row.point).length} sin ubicación</p>}
          </>}
          {drawer==='filters'&&<div className="space-y-2"><p className="text-xs text-slate-400">{filtered.length} ubicaciones · {displayLayers.reduce((s,l)=>s+l.features.length,0)} fichas importadas</p>{filtered.slice(0,80).map(point=><button key={point.id} className="block w-full rounded-lg bg-slate-900 p-3 text-left text-xs hover:bg-slate-800" onClick={()=>selectPoint(point)}><strong className="block">{point.name}</strong><span className="text-slate-400">{point.subtitle}</span></button>)}{filtered.length>80&&<p className="text-xs text-slate-400">Primeros 80 resultados en esta lista. Use la búsqueda para localizar una ficha; todos los puntos coincidentes están en el mapa.</p>}</div>}
          {drawer==='teams'&&administrator&&<>
            {live.loading&&<p role="status" className="text-xs">Cargando reportes GPS…</p>}{live.error&&<p role="alert" className="text-xs text-amber-300">{live.error}<button className={button} onClick={live.retry}>Reintentar</button></p>}
            <p className="text-xs text-slate-400">Cada persona conserva su propia ubicación. Una ubicación registrada o un reporte antiguo no indica presencia actual.</p>
            {filteredTeams.map(row=><div key={row.kind+'-'+row.id} className="rounded-xl border border-slate-700 bg-slate-900 p-3"><p className="text-sm font-semibold">{row.name}</p><p className="mt-1 text-xs text-slate-400">{row.kind==='leader'?'Líder':row.kind==='vehicle'?'Vehículo':'Integrante'} · {candidates.find(c=>c.id===row.candidateId)?.fullName||'Sin aspirante asignado'}</p><p className="mt-2 text-xs text-cyan-200">{row.status}</p>{row.point?.capturedAt&&<p className="mt-1 text-[11px] text-slate-400">Último reporte: {new Date(row.point.capturedAt).toLocaleString('es-CO')}</p>}<button disabled={!row.point} className={button+' mt-2'} onClick={()=>{if(row.point){selectPoint(row.point);setMapSelection({label:row.name,coordinates:[row.point],kind:'team'});}}}>{row.point?'Ver en mapa':'Sin coordenadas'}</button></div>)}
            {!filteredTeams.length&&<p className="text-sm text-slate-400">No hay equipos que coincidan con los filtros.</p>}
          </>}
          <div hidden={drawer!=='layers'}><GeographicImportPanel tenantId={tenantId} layers={geographicLayers} hidden={hiddenLayers} onToggle={id=>setHiddenLayers(previous=>{const next=new Set(previous);next.has(id)?next.delete(id):next.add(id);return next;})} onViewLayer={parts=>{viewLayer(parts);setDrawer(null);}} onRoute={saved=>{viewRoute(saved);setDrawer(null);}} readOnly={readOnly}/></div>
          {drawer==='tools'&&<><div className="flex flex-wrap gap-2"><button className={button} aria-pressed={placing} onClick={()=>{setPlacing(!placing);setDrawer(null);}}>Elegir ubicación en mapa</button>{administrator&&<button className={button} onClick={()=>void useGPS()}>Mi ubicación GPS</button>}{administrator&&onOpenTracking&&<button className={button} onClick={()=>onOpenTracking()}>Recorridos y seguimiento</button>}</div>
                <section className={section}>
        <h3 className="flex items-center gap-2 text-sm font-bold text-white"><MapPin size={18} />Ubicación seleccionada</h3>
        <p className="mt-2 text-xs text-slate-400" role="status">{selectedRecord ? `${selectedRecord.name} · ${picked ? 'Punto elegido para guardar' : selected ? 'Ubicación registrada' : 'Pendiente de ubicar'}` : selected ? `${selected.name} · ${selected.municipality} · ${selected.subtitle}` : picked ? 'Punto elegido en el mapa o por GPS' : 'Seleccione un líder, un vehículo o un punto del mapa.'}</p>
        {selectedRecord && !location && <p className="mt-2 text-xs text-slate-400">{readOnly ? 'Este registro de prueba no tiene coordenadas. Puede consultar sus datos; para guardar una ubicación, elija datos reales.' : 'Este registro todavía no tiene coordenadas. Toque su ubicación en el mapa y pulse Guardar ubicación.'}</p>}
        {location && <><p className="mt-2 font-mono text-xs text-amber-300">{location.latitude.toFixed(7)}, {location.longitude.toFixed(7)}</p>
          {selected?.capturedAt && <p className="mt-1 text-xs text-slate-400">Registrada: {new Date(selected.capturedAt).toLocaleString('es-CO')}</p>}
          <div className="mt-3 flex flex-wrap gap-2"><button type="button" className={button} onClick={() => addStop(location, selected?.name || `Punto ${stops.length + 1}`)}>Añadir a ruta</button><a className={button} href={googleLocationUrl(location)} target="_blank" rel="noreferrer">Ver en Google Maps ↗</a></div></>}
        <label className="mt-4 block text-xs text-slate-400">Seleccionar líder o vehículo<select aria-label="Registro a ubicar" className={`mt-1 ${input}`} value={recordId} onChange={event => selectRecord(event.target.value)}><option value="">Seleccione líder o vehículo</option>{records.map(item => <option key={item.key} value={item.key}>{item.type === 'leader' ? 'Líder' : 'Vehículo'}: {item.name}</option>)}</select></label>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" disabled={!location || !selectedRecord || busy || readOnly} className={button} onClick={async () => { if (!location || !selectedRecord) return; setBusy(true); try { await saveTerritorialLocation(selectedRecord.type, selectedRecord.id, tenantId, location, picked ? pickedSource : 'Mapa'); setMessage('Ubicación guardada en Firestore.'); } catch (error) { setMessage((error as Error).message); } finally { setBusy(false); } }}>Guardar ubicación</button>
        </div>
      </section>
      <section ref={plannerPanel} className={`${section} scroll-mt-20`}>
        <h3 className="flex items-center gap-2 text-sm font-bold text-white"><Route size={18} />Planificar ruta por carretera</h3>
        <p className="mt-2 text-xs text-slate-400">El orden de las paradas define el recorrido. Distancia y tiempo son estimaciones, sin tráfico en vivo.</p>
        <div className="mt-3 flex gap-2"><select aria-label="Parada para la ruta" className={input} value={stopChoice} onChange={event => setStopChoice(event.target.value)}><option value="">Seleccione una ubicación registrada</option>{points.map(point => <option key={point.id} value={point.id}>{point.name} · {point.municipality}</option>)}</select><button type="button" className={button} disabled={!stopChoice || stops.length >= 5 || routing} onClick={() => { const point = points.find(item => item.id === stopChoice); if (point) addStop(point, point.name); }}>Añadir parada</button></div>
        <ol className="mt-3 space-y-2">{stops.map((stop, index) => <li key={index} className="flex items-center gap-2 rounded-lg bg-slate-950 p-2 text-xs text-slate-300"><span className="min-w-0 flex-1 break-words">{index + 1}. {stop.name} {index === 0 ? '(origen)' : index === stops.length - 1 ? '(destino)' : ''}</span><button type="button" className={button} aria-label={`Subir parada ${index + 1}`} disabled={index === 0 || routing} onClick={() => { const next = [...stops]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; changeStops(next); }}>↑</button><button type="button" className={button} aria-label={`Quitar parada ${index + 1}`} disabled={routing} onClick={() => changeStops(stops.filter((_, i) => i !== index))}>×</button></li>)}</ol>
        <div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={stops.length < 2 || routing} className={button} onClick={() => void calculate()}>{routing ? 'Calculando carretera…' : 'Calcular ruta'}</button>{stops.length >= 2 && <a className={button} href={googleDirectionsUrl(stops)} target="_blank" rel="noreferrer">Navegar en Google Maps ↗</a>}<button type="button" className={button} disabled={!stops.length || routing} onClick={() => { changeStops([]); setRouteName(''); }}>Limpiar ruta</button></div>
        {route && <div className="mt-4 space-y-3 rounded-xl border border-cyan-800 bg-cyan-950/30 p-3"><p className="text-sm font-semibold text-cyan-200">{(route.distanceMeters / 1000).toLocaleString('es-CO', { maximumFractionDigits: 1 })} km · {route.provider==='Archivo'?'Trazado importado, sin estimación de tiempo':`${Math.max(1, Math.round(route.durationSeconds / 60))} min aproximados`}</p>
          <label className="block text-xs text-slate-300">Nombre de ruta<input aria-label="Nombre de ruta" maxLength={160} className={`mt-1 ${input}`} value={routeName} onChange={event => setRouteName(event.target.value)} /></label>
          <label className="block text-xs text-slate-300">Asignar a vehículo<select aria-label="Vehículo para la ruta" className={`mt-1 ${input}`} value={routeVehicleId} onChange={event => setRouteVehicleId(event.target.value)}><option value="">Seleccione vehículo</option>{scopedVehicles.map(vehicle => <option key={vehicle.id} value={vehicle.id}>{vehicle.licensePlate} · {vehicle.driverName}</option>)}</select></label>
          <button type="button" className={button} disabled={!routeVehicleId || !routeName.trim() || busy || readOnly} onClick={async () => { setBusy(true); try { await saveVehicleRoute(routeVehicleId, tenantId, { ...route, name: routeName.trim() }); setMessage('Ruta asignada al vehículo y guardada en Firestore.'); } catch (error) { setMessage((error as Error).message); } finally { setBusy(false); } }}>Guardar ruta del vehículo</button>
        </div>}
        <div className="mt-4 space-y-2">{scopedVehicles.filter(vehicle => vehicle.plannedRoute).map(vehicle => <div key={vehicle.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-950 p-3 text-xs"><span className="text-slate-300">{vehicle.licensePlate} · {vehicle.plannedRoute!.name}</span><button type="button" disabled={routing} className={button} onClick={() => { const saved = vehicle.plannedRoute!; routeRequest.current?.abort(); setStops(saved.stops); setRoute(saved); setRouteName(saved.name); setRouteVehicleId(vehicle.id); }}>Cargar ruta guardada</button></div>)}</div>
      </section>
          </>}
        </div>
      </aside>}
      {selectedFeature&&selectedLayer&&<div className="absolute bottom-3 right-3 top-20 z-[1200] w-[min(420px,calc(100%-24px))]"><GeographicFeatureCard key={selectedLayer.id+'-'+selectedFeature.id} layer={selectedLayer} feature={selectedFeature} readOnly={readOnly} onClose={()=>{setFeatureRef(null);setSelectedId('');}}/></div>}
      {selected&&selected.type!=='import'&&!drawer&&<article aria-label="Ficha del equipo" className="absolute bottom-12 right-3 z-[1100] w-[min(360px,calc(100%-24px))] rounded-xl border border-slate-600 bg-slate-900 p-4 shadow-2xl"><button aria-label="Cerrar ficha de equipo" className="float-right p-1" onClick={()=>setSelectedId('')}><X size={18}/></button><h3 className="pr-6 font-bold">{selected.name}</h3><p className="mt-1 text-xs text-slate-400">{selected.subtitle} · {selected.municipality}</p><p className="mt-2 text-sm text-cyan-200">{selected.status}</p>{selected.capturedAt&&<p className="mt-1 text-xs">Última actualización: {new Date(selected.capturedAt).toLocaleString('es-CO')}</p>}<div className="mt-3 flex gap-2"><button className={button} onClick={()=>{addStop(selected,selected.name);setDrawer('tools');}}>Añadir a ruta</button><a className={button} href={googleLocationUrl(selected)} target="_blank" rel="noreferrer">Google Maps</a></div></article>}
      {placing&&<div className="absolute left-1/2 top-3 z-[1050] flex max-w-[70%] -translate-x-1/2 items-center gap-2 rounded-xl bg-amber-950 p-3 text-xs text-amber-100">Toque el mapa para elegir una ubicación.<button className="underline" onClick={()=>setPlacing(false)}>Terminar</button></div>}
      {message&&<div role="status" className="absolute bottom-12 left-3 z-[1300] flex max-w-[calc(100%-24px)] items-center gap-3 rounded-xl border border-cyan-700 bg-slate-950 p-3 text-xs text-cyan-100">{message}<button aria-label="Cerrar mensaje" onClick={()=>setMessage('')}><X size={16}/></button></div>}
      <div className="pointer-events-none absolute bottom-5 left-3 z-[1000] rounded-lg bg-slate-950/90 px-3 py-2 text-[11px] text-slate-300">{filtered.length} ubicaciones · <span className="text-amber-300">● Emprendimientos</span> · <span className="text-emerald-300">● Líderes</span> · <span className="text-purple-300">● Integrantes</span> · <span className="text-blue-300">● Vehículos</span></div>
    </main>
  </div>,document.body);
};
