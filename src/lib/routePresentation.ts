import type { AssignedRoute, RouteSample } from './routeTracking';

const zone = 'America/Bogota';
const validTime = (value?: number) => Number.isFinite(value) ? value : undefined;
const parsedTime = (value?: string) => value ? validTime(Date.parse(value)) : undefined;

export function routeTime(route: AssignedRoute): number {
  return validTime(route.startedAtMillis) ?? parsedTime(route.startedAt) ?? parsedTime(route.createdAt) ?? 0;
}

export function routeDay(route: AssignedRoute): string {
  if (!route.startedAt && route.startedAtMillis === undefined && /^\d{4}-\d{2}-\d{2}$/.test(route.scheduledDate)) return route.scheduledDate;
  return new Intl.DateTimeFormat('en-CA', {timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit'}).format(routeTime(route));
}

export function routeDateTime(time?: number, withSeconds = false): string {
  return time === undefined ? 'Sin registro' : new Intl.DateTimeFormat('es-CO', {timeZone: zone, dateStyle: 'medium', timeStyle: withSeconds ? 'medium' : 'short'}).format(time);
}

export function routeClock(time: number): string {
  return new Intl.DateTimeFormat('es-CO', {timeZone: zone, hour: '2-digit', minute: '2-digit', second: '2-digit'}).format(time);
}

export function routeDuration(milliseconds?: number): string {
  if (milliseconds === undefined) return 'Sin registro';
  const seconds = Math.max(0, Math.round(milliseconds / 1000));
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

/** El detalle solo utiliza posiciones de este recorrido y esta organización. */
export function detailSamples(route: AssignedRoute, samples: RouteSample[]): RouteSample[] {
  return samples.filter(sample => sample.tenantId === route.tenantId && sample.routeId === route.id
    && Number.isFinite(sample.latitude) && Math.abs(sample.latitude) <= 90
    && Number.isFinite(sample.longitude) && Math.abs(sample.longitude) <= 180
    && Number.isFinite(sample.accuracy) && sample.accuracy >= 0 && Number.isFinite(sample.capturedAtMillis))
    .sort((a, b) => a.capturedAtMillis - b.capturedAtMillis);
}

export function routeTiming(route: AssignedRoute, samples: RouteSample[]) {
  const ordered = detailSamples(route, samples);
  const start = validTime(route.startedAtMillis) ?? parsedTime(route.startedAt) ?? ordered[0]?.capturedAtMillis;
  const finish = validTime(route.finishedAtMillis) ?? parsedTime(route.finishedAt);
  const last = ordered.at(-1)?.capturedAtMillis;
  const end = finish ?? last;
  return {start, finish, last, elapsed: start !== undefined && end !== undefined && end >= start ? end - start : undefined};
}
