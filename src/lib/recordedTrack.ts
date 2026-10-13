import type { AssignedRoute, RouteSample } from './routeTracking';
import type { GeographicLayer } from './geographicImport';

/** Dividir los vacíos de señal, para no dibujar desplazamientos que nunca se observaron. */
export function recordedTrackLayers(route: AssignedRoute | undefined, samples: RouteSample[]): GeographicLayer[] {
  if(!route)return [];
  const ordered=[...samples].filter(sample=>sample.accuracy<=100).sort((a,b)=>a.capturedAtMillis-b.capturedAtMillis);
  const segments:RouteSample[][]=[];
  for(const sample of ordered){const last=segments.at(-1);if(!last||sample.capturedAtMillis-last.at(-1)!.capturedAtMillis>120_000)segments.push([sample]);else last.push(sample);}
  const geometries=segments.filter(segment=>segment.length>=2).map(segment=>({type:'LineString' as const,coordinates:segment.map(({latitude,longitude})=>({latitude,longitude}))}));
  return geometries.length?[{id:`actual-${route.id}`,tenantId:route.tenantId,importId:'actual',name:'Recorrido registrado',filename:'GPS',createdBy:route.userId,importedAt:route.createdAt,
    features:[{id:'trace',name:'Desplazamientos registrados',description:'',properties:{},geometries}]}]:[];
}
