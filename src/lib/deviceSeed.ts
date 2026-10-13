/**
 * Semilla de rastreo del dispositivo.
 *
 * Cada navegador donde se abre Astrea recibe un identificador estable y recuerda
 * la decisión sobre el GPS y el recorrido activo. Así el permiso se solicita una
 * sola vez por dispositivo y el seguimiento se reanuda solo al volver a abrir la
 * aplicación, sin volver a preguntar mientras el navegador conserve el permiso.
 *
 * La semilla se guarda en localStorage cuando el usuario aceptó conservar datos
 * en este dispositivo; si no, vive en sessionStorage hasta cerrar el navegador.
 */
import { appPlatform, isNativeApp, nativeLocationPermission, requestNotificationPermission, type NotificationPermissionApi } from './nativeTracking';
import type { MovementState } from './movementTracking';
import type { AssignedRoute } from './routeTracking';
import type { Fix } from './nativeTracking';

export const SEED_KEY = 'astrea-device-seed-v1';
export type GpsState = 'granted' | 'denied' | 'prompt' | 'unsupported' | 'unknown';
export interface DeviceSeed {
  deviceId: string; createdAt: string; gps: GpsState; gpsAskedAt?: string; gpsCheckedAt?: string;
  activeRouteId?: string; activeUserId?: string; activeTenantId?: string;
  automaticTracking?: boolean; automaticPaused?: boolean;
  notificationAskedAt?: string;
  trackingSetupCompleted?: boolean;
  automaticSession?: { userId: string; tenantId: string; movement: MovementState; route?: AssignedRoute; lastRoute?: AssignedRoute; lastPosition?: Fix };
}
type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
type PositionLike = { coords: { latitude: number; longitude: number; accuracy: number }; timestamp: number };
export interface SeedEnvironment {
  local?: StorageLike; session?: StorageLike; persist: () => boolean;
  permissions?: { query: (descriptor: { name: 'geolocation' }) => Promise<{ state: string }> };
  geolocation?: { getCurrentPosition: (ok: (position: PositionLike) => void, fail: (error: { code: number }) => void, options?: PositionOptions) => void };
  nativePermission?: { check: () => Promise<GpsState>; request: () => Promise<GpsState> };
  now: () => Date; uuid: () => string;
}
const GPS_STATES: GpsState[] = ['granted', 'denied', 'prompt', 'unsupported', 'unknown'];
const safe = <T>(read: () => T): T | undefined => { try { return read(); } catch { return undefined; } };

/** Entorno real del navegador. Se resuelve en cada llamada para respetar la elección de «Mi dispositivo». */
export function browserEnvironment(): SeedEnvironment {
  return {
    local: safe(() => globalThis.localStorage), session: safe(() => globalThis.sessionStorage),
    persist: () => safe(() => JSON.parse(globalThis.localStorage.getItem('astrea-device-storage-v1') || 'null')?.enabled === true) ?? false,
    permissions: safe(() => globalThis.navigator?.permissions) as SeedEnvironment['permissions'],
    geolocation: safe(() => globalThis.navigator?.geolocation) as SeedEnvironment['geolocation'],
    nativePermission: isNativeApp() && appPlatform() === 'android' ? { check: () => nativeLocationPermission(), request: () => nativeLocationPermission(true) } : undefined,
    now: () => new Date(), uuid: () => globalThis.crypto.randomUUID(),
  };
}
const store = (env: SeedEnvironment) => (env.persist() ? env.local : env.session);
function valid(value: unknown): value is DeviceSeed {
  const seed = value as DeviceSeed;
  return !!seed && typeof seed.deviceId === 'string' && /^[\w-]{1,64}$/.test(seed.deviceId) && GPS_STATES.includes(seed.gps);
}
export function readSeed(env: SeedEnvironment = browserEnvironment()): DeviceSeed | null {
  for (const storage of [store(env), env.persist() ? env.session : env.local]) {
    const value = safe(() => JSON.parse(storage?.getItem(SEED_KEY) || 'null'));
    if (valid(value)) return value;
  }
  return null;
}
function write(seed: DeviceSeed, env: SeedEnvironment): DeviceSeed {
  safe(() => store(env)?.setItem(SEED_KEY, JSON.stringify(seed)));
  return seed;
}
export function ensureSeed(env: SeedEnvironment = browserEnvironment()): DeviceSeed {
  return readSeed(env) || write({ deviceId: env.uuid(), createdAt: env.now().toISOString(), gps: 'unknown' }, env);
}
export function updateSeed(patch: Partial<DeviceSeed>, env: SeedEnvironment = browserEnvironment()): DeviceSeed {
  const next = { ...ensureSeed(env), ...patch } as DeviceSeed;
  for (const key of Object.keys(next) as (keyof DeviceSeed)[]) if (next[key] === undefined) delete next[key];
  return write(next, env);
}
export function clearActiveRoute(env: SeedEnvironment = browserEnvironment()): DeviceSeed {
  return updateSeed({ activeRouteId: undefined, activeUserId: undefined, activeTenantId: undefined }, env);
}

/** Estado actual del permiso sin mostrar ningún aviso al usuario. */
export async function gpsPermission(env: SeedEnvironment = browserEnvironment()): Promise<GpsState> {
  if (env.nativePermission) return env.nativePermission.check();
  if (!env.geolocation) return 'unsupported';
  const status = await env.permissions?.query({ name: 'geolocation' }).catch(() => undefined);
  if (status && GPS_STATES.includes(status.state as GpsState)) return status.state as GpsState;
  return readSeed(env)?.gps ?? 'unknown';
}

/**
 * Solicita el GPS (debe llamarse desde un toque del usuario). El navegador muestra
 * su aviso solo si aún no tiene una decisión para este sitio. Un tiempo de espera
 * agotado significa que el permiso existe pero todavía no hay señal.
 */
export function requestGps(env: SeedEnvironment = browserEnvironment()): Promise<{ state: GpsState; position?: PositionLike }> {
  const finish = (state: GpsState, position?: PositionLike) => { const at = env.now().toISOString(); updateSeed({ gps: state, gpsAskedAt: at, gpsCheckedAt: at }, env); return { state, position }; };
  if (env.nativePermission) {
    const initial = !readSeed(env)?.gpsAskedAt;
    updateSeed({gpsAskedAt: env.now().toISOString()}, env);
    return (initial ? env.nativePermission.request() : env.nativePermission.check()).then(state => finish(state));
  }
  if (!env.geolocation) return Promise.resolve(finish('unsupported'));
  return new Promise(resolve => env.geolocation!.getCurrentPosition(
    position => resolve(finish('granted', position)),
    error => resolve(finish(error.code === 1 ? 'denied' : 'granted')),
    { enableHighAccuracy: true, timeout: 20000, maximumAge: 60000 }));
}

/** Desde el asistente inicial o una activación explícita: cada permiso Android se pide una sola vez. */
export async function prepareNativeTracking(env: SeedEnvironment = browserEnvironment(), notifications?: NotificationPermissionApi) {
  const gps = await requestGps(env);
  const initial = !readSeed(env)?.notificationAskedAt;
  updateSeed({notificationAskedAt: readSeed(env)?.notificationAskedAt || env.now().toISOString()}, env);
  await requestNotificationPermission(initial, notifications);
  return gps;
}

/** Recupera una preparación interrumpida en 1.0.3 sin reabrir los permisos ya decididos. */
export function nativeTrackingOnboardingNeeded(seed: DeviceSeed | null): boolean {
  if (seed?.trackingSetupCompleted || seed?.automaticTracking === true || seed?.automaticPaused !== undefined) return false;
  return seed?.automaticTracking === undefined || !!(seed.gpsAskedAt && seed.notificationAskedAt && !seed.automaticSession);
}

/** El asistente de configuración pregunta por el GPS solo si el navegador aún no decidió y no se preguntó antes en este dispositivo. */
export function gpsOnboardingNeeded(seed: DeviceSeed | null, state: GpsState): boolean {
  return (state === 'prompt' || state === 'unknown') && !seed?.gpsAskedAt;
}

type RouteLike = { id: string; userId: string; tenantId: string; status: string };
export type ResumeDecision = 'resume' | 'ask' | 'denied' | 'clear' | 'wait' | 'none';
/** Decide qué hacer al abrir la app con un recorrido que quedó activo en este dispositivo. */
export function autoResumeDecision(seed: DeviceSeed | null, routes: RouteLike[], userId: string, tenantId: string, state: GpsState): ResumeDecision {
  if (!seed?.activeRouteId || seed.activeUserId !== userId || seed.activeTenantId !== tenantId) return 'none';
  if (!routes.length) return 'wait';
  const route = routes.find(item => item.id === seed.activeRouteId);
  if (!route || route.userId !== userId || route.status !== 'En curso') return 'clear';
  if (state === 'granted') return 'resume';
  if (state === 'denied' || state === 'unsupported') return 'denied';
  return 'ask';
}

export function deviceLabel(userAgent: string): string {
  const android = userAgent.match(/Android ([\d.]+);\s*([^;)]+)/);
  const ios = userAgent.match(/(iPhone|iPad)[^)]*OS (\d+)[_.](\d+)/);
  const browser = /EdgA?\//.test(userAgent) ? 'Edge' : /SamsungBrowser/.test(userAgent) ? 'Samsung Internet' : /Firefox|FxiOS/.test(userAgent) ? 'Firefox'
    : /CriOS|Chrome\//.test(userAgent) ? 'Chrome' : /Safari\//.test(userAgent) ? 'Safari' : '';
  const parts = android ? [`Android ${android[1]}`, android[2].replace(/\s*Build\/.*/, '').trim()] : ios ? [ios[1], `iOS ${ios[2]}.${ios[3]}`]
    : [/Windows/.test(userAgent) ? 'Windows' : /Mac OS X/.test(userAgent) ? 'macOS' : /Linux/.test(userAgent) ? 'Linux' : userAgent.slice(0, 60)];
  return [...parts, browser].filter(Boolean).join(' · ').slice(0, 120);
}
export function isInstalledApp(): boolean {
  return safe(() => globalThis.matchMedia?.('(display-mode: standalone)').matches || (globalThis.navigator as Navigator & { standalone?: boolean }).standalone === true) ?? false;
}
