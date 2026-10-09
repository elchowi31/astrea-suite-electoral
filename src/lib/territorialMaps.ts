import type { Leader, TransportVehicle } from '../types';

export type Coordinate = { latitude: number; longitude: number };
export type TerritoryPoint = Coordinate & {
  id: string; recordId: string; type: 'leader' | 'vehicle'; name: string;
  subtitle: string; municipality: string; status: string; capturedAt?: string;
};
export type RouteStop = Coordinate & { name: string };
export type TerritorialRoute = {
  name: string; stops: RouteStop[]; geometry: Coordinate[];
  distanceMeters: number; durationSeconds: number; provider: 'OSRM'; calculatedAt: string;
};
export const ASTREA_CENTER: Coordinate = { latitude: 9.4981, longitude: -73.9785 };

export function validLocation(value: Partial<Coordinate>): value is Coordinate {
  return typeof value.latitude === 'number' && Number.isFinite(value.latitude) && Math.abs(value.latitude) <= 90
    && typeof value.longitude === 'number' && Number.isFinite(value.longitude) && Math.abs(value.longitude) <= 180;
}
export function parseLocation(latitude: string, longitude: string): Coordinate | undefined {
  if (!latitude.trim() && !longitude.trim()) return undefined;
  const point = { latitude: latitude.trim() ? Number(latitude) : NaN, longitude: longitude.trim() ? Number(longitude) : NaN };
  if (!validLocation(point)) throw new Error('Complete una latitud entre −90 y 90 y una longitud entre −180 y 180.');
  return point;
}
export function territoryPoints(leaders: Leader[], vehicles: TransportVehicle[]): TerritoryPoint[] {
  return [
    ...leaders.filter(validLocation).map(item => ({ id: `leader-${item.id}`, recordId: item.id, type: 'leader' as const,
      name: item.fullName, subtitle: item.veredaOrBarrio || item.zoneOrDistrict, municipality: item.municipality || 'Sin municipio',
      status: item.status, latitude: item.latitude!, longitude: item.longitude!, capturedAt: item.locationCapturedAt })),
    ...vehicles.filter(validLocation).map(item => ({ id: `vehicle-${item.id}`, recordId: item.id, type: 'vehicle' as const,
      name: `${item.licensePlate} · ${item.driverName}`, subtitle: item.assignedZone, municipality: item.municipality || 'Sin municipio',
      status: item.status, latitude: item.latitude!, longitude: item.longitude!, capturedAt: item.locationCapturedAt })),
  ];
}
const coordinateText = (point: Coordinate) => `${point.latitude},${point.longitude}`;
export function googleLocationUrl(point: Coordinate): string {
  const url = new URL('https://www.google.com/maps/search/');
  url.searchParams.set('api', '1'); url.searchParams.set('query', coordinateText(point));
  return url.toString();
}
export function googleDirectionsUrl(stops: Coordinate[]): string {
  if (stops.length < 2 || stops.length > 5 || !stops.every(validLocation)) throw new Error('Seleccione entre dos y cinco paradas válidas.');
  const url = new URL('https://www.google.com/maps/dir/');
  url.searchParams.set('api', '1'); url.searchParams.set('origin', coordinateText(stops[0]));
  url.searchParams.set('destination', coordinateText(stops.at(-1)!)); url.searchParams.set('travelmode', 'driving');
  if (stops.length > 2) url.searchParams.set('waypoints', stops.slice(1, -1).map(coordinateText).join('|'));
  return url.toString();
}
export async function calculateRoadRoute(stops: RouteStop[], signal?: AbortSignal): Promise<TerritorialRoute> {
  googleDirectionsUrl(stops); // Validate both the count and all coordinates before contacting a provider.
  const base = import.meta.env?.VITE_ROUTING_SERVICE_URL || 'https://router.project-osrm.org';
  const coordinates = stops.map(point => `${point.longitude},${point.latitude}`).join(';');
  const response = await fetch(`${base.replace(/\/$/, '')}/route/v1/driving/${coordinates}?overview=full&geometries=geojson&steps=false`,
    { signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(20000)]) : AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error('El servicio de rutas no respondió. Puede abrir el recorrido en Google Maps.');
  const data = await response.json(); const route = data.routes?.[0];
  if (data.code !== 'Ok' || !route || !Number.isFinite(route.distance) || !Number.isFinite(route.duration))
    throw new Error('No se encontró un recorrido por carretera entre las paradas. Revise las ubicaciones o abra Google Maps.');
  const geometry: Coordinate[] = (route.geometry?.coordinates || []).map(([longitude, latitude]: number[]) => ({ latitude, longitude }));
  if (geometry.length < 2 || geometry.length > 15000 || !geometry.every(validLocation))
    throw new Error('La geometría recibida no es válida para guardar. Abra el recorrido en Google Maps.');
  return { name: `${stops[0].name} → ${stops.at(-1)!.name}`, stops, geometry, distanceMeters: route.distance,
    durationSeconds: route.duration, provider: 'OSRM', calculatedAt: new Date().toISOString() };
}
export function currentDeviceLocation(): Promise<Coordinate & { accuracy: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Este navegador no permite obtener la ubicación. Selecciónela en el mapa.'));
    navigator.geolocation.getCurrentPosition(position => resolve({ latitude: position.coords.latitude,
      longitude: position.coords.longitude, accuracy: position.coords.accuracy }),
    error => reject(new Error(error.code === 1 ? 'Permita el acceso a la ubicación en su navegador para usar el GPS.' : 'No se pudo obtener el GPS. Seleccione la ubicación en el mapa.')),
    { enableHighAccuracy: true, timeout: 20000, maximumAge: 10000 });
  });
}
