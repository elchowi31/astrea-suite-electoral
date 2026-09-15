import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bus, ChevronDown, LocateFixed, MapPin, Minus, Phone, Plus, Radio, Route, ShieldCheck, Users, X } from 'lucide-react';
import { TerritoryPoint } from './TerritorialMapView';
import { LiveTelemetryBeacon, Tenant, UserProfile, UserRole } from '../types';
import { RuralTerritoryItem } from '../data/colombiaElectoralData';
import { DriverBeaconModal } from './DriverBeaconModal';
import { getSimulatedAstreaBeacons, subscribeToActiveBeacons } from '../lib/telemetryService';

type FilterType = 'all' | 'leader' | 'vehicle' | 'prospect';

export interface SatelliteRadarCanvasProps {
  center: { lat: number; lng: number };
  points: TerritoryPoint[];
  corregimientos: RuralTerritoryItem[];
  veredas: RuralTerritoryItem[];
  municipality: string;
  selectedPoint: TerritoryPoint | null;
  onSelectPoint: (point: TerritoryPoint | null) => void;
  filterType: FilterType;
  onFilterTypeChange: (type: FilterType) => void;
  tenant?: Tenant;
  currentUser?: UserProfile | null;
  userRole?: UserRole;
}

type TrackableUnit = {
  id: string;
  name: string;
  kind: 'vehicle' | 'leader' | 'supervisor';
  status: string;
  subtitle: string;
  lat: number;
  lng: number;
  phone?: string;
  speed?: number;
  battery?: number;
  color: string;
  trail?: Array<{ lat: number; lng: number; time: number }>;
  sourcePoint?: TerritoryPoint;
  sourceBeacon?: LiveTelemetryBeacon;
};

const TILE_SIZE = 256;
const MAX_TRACKED = 10;

const lonToWorldX = (lon: number, zoom: number) => ((lon + 180) / 360) * TILE_SIZE * 2 ** zoom;
const latToWorldY = (lat: number, zoom: number) => {
  const sin = Math.sin((lat * Math.PI) / 180);
  return (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * TILE_SIZE * 2 ** zoom;
};
const worldXToLon = (x: number, zoom: number) => (x / (TILE_SIZE * 2 ** zoom)) * 360 - 180;
const worldYToLat = (y: number, zoom: number) => {
  const n = Math.PI - (2 * Math.PI * y) / (TILE_SIZE * 2 ** zoom);
  return (180 / Math.PI) * Math.atan(Math.sinh(n));
};

const typeLabel = (kind: TrackableUnit['kind']) => kind === 'vehicle' ? 'Vehículo' : kind === 'supervisor' ? 'Supervisor' : 'Líder';

export const SatelliteRadarCanvas: React.FC<SatelliteRadarCanvasProps> = ({ center, points, municipality, selectedPoint, onSelectPoint, filterType, onFilterTypeChange, tenant, currentUser }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 900, height: 560 });
  const [mapCenter, setMapCenter] = useState(center);
  const [zoom, setZoom] = useState(12);
  const [drag, setDrag] = useState<{ x: number; y: number; worldX: number; worldY: number } | null>(null);
  const [beacons, setBeacons] = useState<LiveTelemetryBeacon[]>([]);
  const [trackingOpen, setTrackingOpen] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState<TrackableUnit | null>(null);
  const [driverOpen, setDriverOpen] = useState(false);
  const tenantId = tenant?.tenantId || currentUser?.tenantId || 'tenant-astrea-2026';
  const trackingStorageKey = `astrea_tracked_units_${tenantId}`;
  const [trackedIds, setTrackedIds] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(trackingStorageKey) || '[]').slice(0, MAX_TRACKED); } catch { return []; }
  });

  useEffect(() => {
    const node = mapRef.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => setSize({ width: entry.contentRect.width, height: entry.contentRect.height }));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const fallback = getSimulatedAstreaBeacons(tenantId);
    return subscribeToActiveBeacons(tenantId, (rows) => setBeacons(rows.length ? rows : fallback));
  }, [tenantId]);

  useEffect(() => {
    localStorage.setItem(trackingStorageKey, JSON.stringify(trackedIds));
  }, [trackedIds, trackingStorageKey]);

  const units = useMemo<TrackableUnit[]>(() => {
    const live = beacons.map((row) => ({
      id: `beacon-${row.id}`,
      name: row.driverName,
      kind: row.role === 'Supervisor Electoral' || row.role === 'Coordinador Día D' ? 'supervisor' as const : row.role === 'Líder Territorial' ? 'leader' as const : 'vehicle' as const,
      status: row.status,
      subtitle: row.assignedRoute || row.vehiclePlate || 'En ruta',
      lat: row.latitude,
      lng: row.longitude,
      phone: row.phone,
      speed: row.speed,
      battery: row.batteryLevel,
      color: row.sosAlert ? '#f43f5e' : row.role === 'Supervisor Electoral' ? '#f59e0b' : '#22d3ee',
      trail: row.historyTrail,
      sourceBeacon: row,
    }));
    const registered = points.filter((row) => row.type === 'leader' || row.type === 'vehicle').map((row) => ({
      id: `point-${row.id}`,
      name: row.name,
      kind: row.type === 'leader' ? 'leader' as const : 'vehicle' as const,
      status: row.status,
      subtitle: row.subtitle,
      lat: row.latitude,
      lng: row.longitude,
      phone: row.phone,
      color: row.type === 'leader' ? '#10b981' : '#3b82f6',
      sourcePoint: row,
    }));
    const liveNames = new Set(live.map((row) => row.name.toLocaleLowerCase('es-CO')));
    return [...live, ...registered.filter((row) => !liveNames.has(row.name.toLocaleLowerCase('es-CO')))];
  }, [beacons, points]);

  const project = useCallback((lat: number, lng: number) => {
    const centerX = lonToWorldX(mapCenter.lng, zoom);
    const centerY = latToWorldY(mapCenter.lat, zoom);
    return { x: lonToWorldX(lng, zoom) - centerX + size.width / 2, y: latToWorldY(lat, zoom) - centerY + size.height / 2 };
  }, [mapCenter, size, zoom]);

  const tiles = useMemo(() => {
    const worldX = lonToWorldX(mapCenter.lng, zoom);
    const worldY = latToWorldY(mapCenter.lat, zoom);
    const firstX = Math.floor((worldX - size.width / 2) / TILE_SIZE) - 1;
    const firstY = Math.floor((worldY - size.height / 2) / TILE_SIZE) - 1;
    const countX = Math.ceil(size.width / TILE_SIZE) + 3;
    const countY = Math.ceil(size.height / TILE_SIZE) + 3;
    const maxTile = 2 ** zoom;
    const rows: Array<{ key: string; x: number; y: number; urlX: number; urlY: number }> = [];
    for (let x = firstX; x < firstX + countX; x += 1) for (let y = firstY; y < firstY + countY; y += 1) {
      if (y < 0 || y >= maxTile) continue;
      const urlX = ((x % maxTile) + maxTile) % maxTile;
      rows.push({ key: `${zoom}-${x}-${y}`, x: x * TILE_SIZE - worldX + size.width / 2, y: y * TILE_SIZE - worldY + size.height / 2, urlX, urlY: y });
    }
    return rows;
  }, [mapCenter, size, zoom]);

  const trackedUnits = useMemo(() => units.filter((row) => trackedIds.includes(row.id)), [trackedIds, units]);
  const pointUnits = useMemo(() => points.filter((row) => (filterType === 'all' || row.type === filterType) && !trackedIds.includes(`point-${row.id}`)), [filterType, points, trackedIds]);

  useEffect(() => {
    if (!selectedUnit) return;
    const refreshed = units.find((row) => row.id === selectedUnit.id);
    if (!refreshed) return;
    setSelectedUnit(refreshed);
    if (trackedIds.includes(refreshed.id)) setMapCenter({ lat: refreshed.lat, lng: refreshed.lng });
  }, [units]);

  const toggleTracked = (id: string) => setTrackedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : current.length < MAX_TRACKED ? [...current, id] : current);
  const focusUnit = (unit: TrackableUnit) => { setSelectedUnit(unit); setMapCenter({ lat: unit.lat, lng: unit.lng }); setZoom((value) => Math.max(value, 15)); };

  const moveMap = (clientX: number, clientY: number) => {
    if (!drag) return;
    const worldX = drag.worldX - (clientX - drag.x);
    const worldY = drag.worldY - (clientY - drag.y);
    setMapCenter({ lat: worldYToLat(worldY, zoom), lng: worldXToLon(worldX, zoom) });
  };

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-950 shadow-2xl">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-slate-900/95 p-3">
        <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-cyan-400" /><div><h3 className="text-sm font-black text-white">Mapa operativo · {municipality}</h3><p className="text-[11px] text-slate-500">{pointUnits.length} puntos · {beacons.length} unidades en vivo</p></div></div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-xl border border-slate-700 bg-slate-950 p-1 text-[11px]">
            {([['all', 'Todos'], ['leader', 'Líderes'], ['vehicle', 'Vehículos']] as const).map(([value, label]) => <button key={value} type="button" onClick={() => onFilterTypeChange(value)} className={`rounded-lg px-2.5 py-1 font-bold ${filterType === value ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-white'}`}>{label}</button>)}
          </div>
          <div className="relative">
            <button type="button" onClick={() => setTrackingOpen((value) => !value)} className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-black ${trackingOpen || trackedIds.length ? 'border-cyan-400/60 bg-cyan-500/15 text-cyan-200' : 'border-slate-700 bg-slate-800 text-slate-200'}`}><Route className="h-4 w-4" />Seguimientos <span className="rounded-full bg-slate-950/70 px-1.5 py-0.5 text-[10px]">{trackedIds.length}/{MAX_TRACKED}</span><ChevronDown className={`h-3.5 w-3.5 transition ${trackingOpen ? 'rotate-180' : ''}`} /></button>
            {trackingOpen && <div className="absolute right-0 top-12 z-50 w-[min(23rem,calc(100vw-2rem))] rounded-2xl border border-slate-700 bg-slate-950/98 p-3 shadow-2xl backdrop-blur-xl">
              <div className="mb-2 flex items-center justify-between"><span className="text-xs font-black text-white">Seleccione hasta 10 unidades</span><button type="button" onClick={() => setTrackedIds([])} className="text-[11px] font-bold text-slate-400 hover:text-white">Limpiar</button></div>
              <div className="max-h-72 space-y-1 overflow-y-auto pr-1">{units.map((unit) => { const checked = trackedIds.includes(unit.id); const blocked = !checked && trackedIds.length >= MAX_TRACKED; return <label key={unit.id} className={`flex cursor-pointer items-center gap-2 rounded-xl border p-2 ${checked ? 'border-cyan-500/40 bg-cyan-500/10' : 'border-slate-800 bg-slate-900/70'} ${blocked ? 'cursor-not-allowed opacity-45' : ''}`}><input type="checkbox" checked={checked} disabled={blocked} onChange={() => toggleTracked(unit.id)} className="accent-cyan-400" /><span className="h-2.5 w-2.5 rounded-full" style={{ background: unit.color }} /><span className="min-w-0 flex-1"><span className="block truncate text-xs font-bold text-white">{unit.name}</span><span className="block truncate text-[10px] text-slate-500">{typeLabel(unit.kind)} · {unit.subtitle}</span></span></label>; })}</div>
            </div>}
          </div>
          <button type="button" onClick={() => setDriverOpen(true)} className="flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs font-black text-emerald-300"><Radio className="h-4 w-4" />Compartir ubicación</button>
        </div>
      </div>

      <div ref={mapRef} className="relative h-[560px] cursor-grab select-none overflow-hidden bg-[#dbe2e5] active:cursor-grabbing" onMouseDown={(event) => setDrag({ x: event.clientX, y: event.clientY, worldX: lonToWorldX(mapCenter.lng, zoom), worldY: latToWorldY(mapCenter.lat, zoom) })} onMouseMove={(event) => moveMap(event.clientX, event.clientY)} onMouseUp={() => setDrag(null)} onMouseLeave={() => setDrag(null)} onWheel={(event) => { event.preventDefault(); setZoom((value) => Math.max(9, Math.min(18, value + (event.deltaY < 0 ? 1 : -1)))); }}>
        {tiles.map((tile) => <img key={tile.key} src={`https://tile.openstreetmap.org/${zoom}/${tile.urlX}/${tile.urlY}.png`} alt="" draggable={false} className="pointer-events-none absolute h-64 w-64" style={{ left: tile.x, top: tile.y }} />)}
        <div className="pointer-events-none absolute inset-0 bg-slate-950/5" />

        <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
          {trackedUnits.map((unit) => unit.trail && unit.trail.length > 1 ? <polyline key={`trail-${unit.id}`} points={unit.trail.map((point) => { const pos = project(point.lat, point.lng); return `${pos.x},${pos.y}`; }).join(' ')} fill="none" stroke={unit.color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" opacity="0.85" /> : null)}
        </svg>

        {pointUnits.map((point) => {
          const pos = project(point.latitude, point.longitude);
          const active = selectedPoint?.id === point.id;
          return <button key={point.id} type="button" onClick={(event) => { event.stopPropagation(); onSelectPoint(point); setSelectedUnit(null); }} className="group absolute z-10 -translate-x-1/2 -translate-y-1/2" style={{ left: pos.x, top: pos.y }} aria-label={`Ver ${point.name}`}><span className={`block rounded-full border-2 border-white shadow-lg transition group-hover:scale-125 ${active ? 'h-5 w-5 ring-4 ring-cyan-400/45' : 'h-3.5 w-3.5'}`} style={{ background: point.type === 'leader' ? '#10b981' : point.type === 'vehicle' ? '#3b82f6' : '#f59e0b' }} /><span className={`absolute left-1/2 top-5 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-950/85 px-1.5 py-0.5 text-[10px] font-bold text-white shadow ${active ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>{point.name}</span></button>;
        })}

        {units.filter((unit) => !trackedIds.includes(unit.id) && unit.sourceBeacon).map((unit) => { const pos = project(unit.lat, unit.lng); return <button key={`live-${unit.id}`} type="button" onClick={(event) => { event.stopPropagation(); focusUnit(unit); }} className="group absolute z-10 -translate-x-1/2 -translate-y-1/2" style={{ left: pos.x, top: pos.y }} aria-label={`Ver ${unit.name}`}><span className="block h-3.5 w-3.5 rounded-full border-2 border-white shadow-lg transition group-hover:scale-125" style={{ background: unit.color }} /><span className="absolute left-1/2 top-5 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-950/85 px-1.5 py-0.5 text-[10px] font-bold text-white opacity-0 shadow group-hover:opacity-100">{unit.name}</span></button>; })}

        {trackedUnits.map((unit) => { const pos = project(unit.lat, unit.lng); const active = selectedUnit?.id === unit.id; return <button key={unit.id} type="button" onClick={(event) => { event.stopPropagation(); focusUnit(unit); }} className="absolute z-20 -translate-x-1/2 -translate-y-1/2" style={{ left: pos.x, top: pos.y }}><span className={`grid h-8 w-8 place-items-center rounded-full border-2 border-white text-white shadow-xl ${active ? 'ring-4 ring-cyan-400/50' : ''}`} style={{ background: unit.color }}>{unit.kind === 'vehicle' ? <Bus className="h-4 w-4" /> : unit.kind === 'supervisor' ? <ShieldCheck className="h-4 w-4" /> : <Users className="h-4 w-4" />}</span><span className="absolute left-1/2 top-9 -translate-x-1/2 whitespace-nowrap rounded-lg bg-slate-950/90 px-2 py-1 text-[10px] font-bold text-white shadow-xl">{unit.name}</span></button>; })}

        <div className="absolute bottom-4 left-4 z-30 flex overflow-hidden rounded-xl border border-slate-700 bg-slate-950/90 shadow-xl"><button type="button" onClick={() => setZoom((value) => Math.min(18, value + 1))} className="p-2 text-white hover:bg-slate-800" aria-label="Acercar"><Plus className="h-4 w-4" /></button><button type="button" onClick={() => setZoom((value) => Math.max(9, value - 1))} className="border-l border-slate-700 p-2 text-white hover:bg-slate-800" aria-label="Alejar"><Minus className="h-4 w-4" /></button><button type="button" onClick={() => { setMapCenter(center); setZoom(12); }} className="border-l border-slate-700 p-2 text-cyan-300 hover:bg-slate-800" aria-label="Centrar mapa"><LocateFixed className="h-4 w-4" /></button></div>
        <div className="absolute bottom-1 right-2 z-20 rounded bg-white/80 px-1 text-[9px] text-slate-700">© OpenStreetMap</div>

        {(selectedUnit || selectedPoint) && <div className="absolute right-3 top-3 z-40 w-[min(21rem,calc(100%-1.5rem))] rounded-2xl border border-slate-700 bg-slate-950/95 p-4 text-white shadow-2xl backdrop-blur-xl">
          <div className="flex items-start justify-between gap-3"><div><span className="text-[10px] font-black uppercase tracking-wider text-cyan-300">{selectedUnit ? typeLabel(selectedUnit.kind) : selectedPoint?.type === 'leader' ? 'Líder' : selectedPoint?.type === 'vehicle' ? 'Vehículo' : 'Punto territorial'}</span><h4 className="mt-1 text-base font-black">{selectedUnit?.name || selectedPoint?.name}</h4></div><button type="button" onClick={() => { setSelectedUnit(null); onSelectPoint(null); }} className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"><X className="h-4 w-4" /></button></div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs"><InfoCell label="Estado" value={selectedUnit?.status || selectedPoint?.status || 'Activo'} /><InfoCell label="Ubicación" value={selectedUnit?.subtitle || selectedPoint?.subtitle || municipality} />{selectedUnit?.speed !== undefined && <InfoCell label="Velocidad" value={`${selectedUnit.speed} km/h`} />}{selectedUnit?.battery !== undefined && <InfoCell label="Batería" value={`${selectedUnit.battery}%`} />}</div>
          {(selectedUnit?.phone || selectedPoint?.phone) && <a href={`tel:${selectedUnit?.phone || selectedPoint?.phone}`} className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-black text-white"><Phone className="h-4 w-4" />Llamar</a>}
        </div>}
      </div>

      <DriverBeaconModal isOpen={driverOpen} onClose={() => setDriverOpen(false)} tenant={tenant || { tenantId, name: `Campaña ${municipality}`, primaryColor: '#06b6d4', secondaryColor: '#2563eb', createdAt: new Date().toISOString(), active: true }} currentUser={currentUser} onBeaconActive={(beacon) => { if (beacon) { setMapCenter({ lat: beacon.latitude, lng: beacon.longitude }); setZoom(16); } }} />
    </div>
  );
};

const InfoCell: React.FC<{ label: string; value: string }> = ({ label, value }) => <div className="min-w-0 rounded-xl border border-slate-800 bg-slate-900/80 p-2"><span className="block text-[10px] uppercase text-slate-500">{label}</span><strong className="mt-0.5 block truncate text-xs text-slate-200">{value}</strong></div>;
