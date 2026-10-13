/**
 * Posición en vivo: un documento por integrante (`posiciones_actuales/{organización--usuario}`)
 * que se sobrescribe con cada posición. Solo los administradores lo consultan;
 * el historial completo sigue en `puntos_recorrido`.
 */
export interface LivePosition {
  id: string; tenantId: string; userId: string; routeId: string; deviceId: string;
  latitude: number; longitude: number; accuracy: number; speed: number | null; heading: number | null;
  battery: number | null; source: 'web' | 'android' | 'ios'; capturedAt: string; capturedAtMillis: number;
  motion?: 'moving' | 'stationary'; observedAtMillis?: number;
}
export type LiveStatus = 'en-vivo' | 'en-reposo' | 'demorado' | 'sin-senal';
/** En vivo hasta 90 s (posiciones cada 10 s y latido de 60 s); demorado hasta 5 min; después, sin señal. */
export const LIVE_LIMIT_MS = 90_000, DELAYED_LIMIT_MS = 300_000;
export function liveStatus(position: Pick<LivePosition, 'capturedAtMillis'|'observedAtMillis'|'motion'>, now = Date.now()): LiveStatus {
  const age = now - (position.observedAtMillis ?? position.capturedAtMillis);
  return age <= LIVE_LIMIT_MS ? position.motion==='stationary'?'en-reposo':'en-vivo' : age <= DELAYED_LIMIT_MS ? 'demorado' : 'sin-senal';
}
export const livePositionId = (tenantId: string, userId: string) => `${tenantId}--${userId}`;

/** Celulares colombianos: 10 dígitos que empiezan por 3, con o sin indicativo 57. Devuelve '' si no es válido. */
export function normalizeColombianPhone(phone: string | undefined | null): string {
  const digits = String(phone ?? '').replace(/\D/g, '');
  if (/^3\d{9}$/.test(digits)) return `57${digits}`;
  if (/^573\d{9}$/.test(digits)) return digits;
  return '';
}
export function whatsappInviteUrl(phone: string | undefined, text: string): string {
  const number = normalizeColombianPhone(phone); return number ? `https://wa.me/${number}?text=${encodeURIComponent(text)}` : '';
}
export function smsInviteUrl(phone: string | undefined, text: string): string {
  const number = normalizeColombianPhone(phone); return number ? `sms:+${number}?body=${encodeURIComponent(text)}` : '';
}
export function routeInviteText({ employee, route, date, appUrl }: { employee: string; route: string; date?: string; appUrl: string }): string {
  return `Hola ${employee}, tiene asignado el recorrido «${route}»${date ? ` para el ${date}` : ''} en Astrea.\n`
    + `1. Abra ${appUrl} en su celular (o la app Astrea) e inicie sesión.\n`
    + `2. En la primera apertura acepte la autorización de seguimiento, ubicación precisa y notificaciones.\n`
    + `3. Mantenga la ubicación activa y la batería de Astrea sin restricciones. La app registrará automáticamente los desplazamientos reales.\n`
    + `Los permisos se solicitan una sola vez. El indicador de Android es silencioso. Solo los administradores pueden consultar los recorridos.`;
}

type RouteLike = { id: string; status: string; name: string; employeeName: string; userId: string };
export interface StaleAlert { routeId: string; route: string; employee: string; reason: 'sin-senal' | 'sin-datos'; lastAt?: string }
/** Recorridos en curso cuyo celular dejó de reportar (más de 5 min) o nunca reportó. */
export function staleAlerts(routes: RouteLike[], positions: LivePosition[], now = Date.now()): StaleAlert[] {
  return routes.filter(route => route.status === 'En curso').flatMap((route): StaleAlert[] => {
    const latest = positions.filter(item => item.routeId === route.id).sort((a, b) => b.capturedAtMillis - a.capturedAtMillis)[0];
    if (!latest) return [{ routeId: route.id, route: route.name, employee: route.employeeName, reason: 'sin-datos' as const }];
    return liveStatus(latest, now) === 'sin-senal' ? [{ routeId: route.id, route: route.name, employee: route.employeeName, reason: 'sin-senal' as const, lastAt: latest.capturedAt }] : [];
  });
}
