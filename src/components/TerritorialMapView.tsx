import React, { useMemo, useState } from 'react';
import { APIProvider, AdvancedMarker, InfoWindow, Map, Pin } from '@vis.gl/react-google-maps';
import { Bus, Filter, MapPin, Navigation, Users } from 'lucide-react';
import { Leader, TransportVehicle } from '../types';

const API_KEY = (import.meta as any).env?.VITE_GOOGLE_MAPS_PLATFORM_KEY || '';
const MAP_ID = (import.meta as any).env?.VITE_GOOGLE_MAPS_MAP_ID || 'DEMO_MAP_ID';

type TerritoryPoint = {
  id: string;
  type: 'leader' | 'vehicle';
  name: string;
  subtitle: string;
  municipality: string;
  status: string;
  latitude: number;
  longitude: number;
};

interface TerritorialMapViewProps {
  leaders?: Leader[];
  vehicles?: TransportVehicle[];
  tenantName?: string;
}

const validCoordinate = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;

export const TerritorialMapView: React.FC<TerritorialMapViewProps> = ({ leaders = [], vehicles = [], tenantName = 'Organización' }) => {
  const [municipality, setMunicipality] = useState('todos');
  const [selectedPoint, setSelectedPoint] = useState<TerritoryPoint | null>(null);

  const points = useMemo<TerritoryPoint[]>(() => [
    ...leaders
      .filter((item) => validCoordinate(item.latitude, -90, 90) && validCoordinate(item.longitude, -180, 180))
      .map((item) => ({
        id: `leader-${item.id}`,
        type: 'leader' as const,
        name: item.fullName,
        subtitle: item.zoneOrDistrict || item.veredaOrBarrio || 'Zona sin detalle',
        municipality: item.municipality || 'Sin municipio',
        status: item.status,
        latitude: item.latitude!,
        longitude: item.longitude!,
      })),
    ...vehicles
      .filter((item) => validCoordinate(item.latitude, -90, 90) && validCoordinate(item.longitude, -180, 180))
      .map((item) => ({
        id: `vehicle-${item.id}`,
        type: 'vehicle' as const,
        name: `${item.vehicleType} · ${item.licensePlate}`,
        subtitle: item.assignedZone,
        municipality: item.municipality || 'Sin municipio',
        status: item.status,
        latitude: item.latitude!,
        longitude: item.longitude!,
      })),
  ], [leaders, vehicles]);

  const municipalities = useMemo(() => Array.from(new Set(points.map((item) => item.municipality))).sort(), [points]);
  const filtered = municipality === 'todos' ? points : points.filter((item) => item.municipality === municipality);
  const missingCoordinates = leaders.length + vehicles.length - points.length;
  const defaultCenter = filtered[0]
    ? { lat: filtered[0].latitude, lng: filtered[0].longitude }
    : { lat: 9.3373, lng: -73.6536 };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900 p-5 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 p-2.5 text-blue-300"><MapPin className="h-6 w-6" /></div>
          <div>
            <h2 className="text-xl font-bold text-white">Cobertura territorial</h2>
            <p className="text-xs text-slate-400">Ubicaciones registradas por {tenantName}; no se muestran puntos simulados.</p>
          </div>
        </div>
        <label className="flex items-center gap-2 text-xs text-slate-400">
          <Filter className="h-4 w-4" />
          <select value={municipality} onChange={(event) => setMunicipality(event.target.value)} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-200 outline-none focus:ring-2 focus:ring-blue-500">
            <option value="todos">Todos los municipios ({points.length})</option>
            {municipalities.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric icon={<MapPin className="h-4 w-4" />} label="Georreferenciados" value={points.length} tone="text-blue-300" />
        <Metric icon={<Users className="h-4 w-4" />} label="Líderes ubicados" value={points.filter((item) => item.type === 'leader').length} tone="text-emerald-300" />
        <Metric icon={<Bus className="h-4 w-4" />} label="Vehículos ubicados" value={points.filter((item) => item.type === 'vehicle').length} tone="text-amber-300" />
        <Metric icon={<Navigation className="h-4 w-4" />} label="Pendientes de ubicación" value={missingCoordinates} tone={missingCoordinates ? 'text-rose-300' : 'text-slate-300'} />
      </div>

      {!API_KEY ? (
        <EmptyState
          title="Google Maps aún no está configurado"
          description="Agregue VITE_GOOGLE_MAPS_PLATFORM_KEY en Vercel y restrinja la clave al dominio de producción. Los datos territoriales seguirán guardándose en Firestore."
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No hay ubicaciones para mostrar"
          description="Edite líderes o vehículos y registre latitud y longitud. El mapa solo usa coordenadas reales del tenant."
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl">
          <APIProvider apiKey={API_KEY} version="weekly">
            <div className="h-[520px] w-full">
              <Map defaultCenter={defaultCenter} defaultZoom={10} mapId={MAP_ID} style={{ width: '100%', height: '100%' }}>
                {filtered.map((point) => (
                  <AdvancedMarker key={point.id} position={{ lat: point.latitude, lng: point.longitude }} title={point.name} onClick={() => setSelectedPoint(point)}>
                    <Pin background={point.type === 'leader' ? '#059669' : '#2563EB'} glyphColor="#fff" borderColor="#0f172a" />
                  </AdvancedMarker>
                ))}
                {selectedPoint && (
                  <InfoWindow position={{ lat: selectedPoint.latitude, lng: selectedPoint.longitude }} onCloseClick={() => setSelectedPoint(null)}>
                    <div className="max-w-xs p-2 text-slate-900">
                      <p className="text-[10px] font-bold uppercase text-blue-700">{selectedPoint.type === 'leader' ? 'Líder territorial' : 'Vehículo'}</p>
                      <h3 className="text-sm font-bold">{selectedPoint.name}</h3>
                      <p className="mt-1 text-xs">{selectedPoint.municipality} · {selectedPoint.subtitle}</p>
                      <p className="mt-1 text-[11px] text-slate-600">Estado: {selectedPoint.status}</p>
                    </div>
                  </InfoWindow>
                )}
              </Map>
            </div>
          </APIProvider>
        </div>
      )}

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <h3 className="text-sm font-bold text-white">Registros territoriales</h3>
        <p className="mt-1 text-xs text-slate-400">{filtered.length} de {points.length} ubicaciones visibles</p>
        {filtered.length ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((point) => (
              <article key={point.id} className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                <div className="flex items-start gap-3">
                  <div className={`rounded-lg p-2 ${point.type === 'leader' ? 'bg-emerald-500/10 text-emerald-300' : 'bg-blue-500/10 text-blue-300'}`}>
                    {point.type === 'leader' ? <Users className="h-4 w-4" /> : <Bus className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-white">{point.name}</p>
                    <p className="mt-1 text-[11px] text-slate-400">{point.municipality} · {point.subtitle}</p>
                    <p className="mt-2 font-mono text-[10px] text-slate-500">{point.latitude.toFixed(5)}, {point.longitude.toFixed(5)}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : <p className="mt-4 rounded-xl border border-dashed border-slate-700 p-6 text-center text-xs text-slate-500">Sin registros georreferenciados.</p>}
      </section>
    </div>
  );
};

const Metric: React.FC<{ icon: React.ReactNode; label: string; value: number; tone: string }> = ({ icon, label, value, tone }) => (
  <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
    <div className={`flex items-center gap-2 text-xs ${tone}`}>{icon}<span className="text-slate-400">{label}</span></div>
    <p className={`mt-2 text-2xl font-bold ${tone}`}>{value}</p>
  </div>
);

const EmptyState: React.FC<{ title: string; description: string }> = ({ title, description }) => (
  <div className="flex min-h-[360px] items-center justify-center rounded-2xl border border-dashed border-slate-700 bg-slate-900/60 p-8 text-center">
    <div className="max-w-lg">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-blue-500/20 bg-blue-500/10 text-blue-300"><MapPin className="h-7 w-7" /></div>
      <h3 className="mt-4 text-lg font-bold text-white">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-slate-400">{description}</p>
    </div>
  </div>
);
