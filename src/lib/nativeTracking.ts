/**
 * Capa de rastreo común para la web y la app nativa (Capacitor).
 *
 * - Navegador: `navigator.geolocation.watchPosition` (solo con la app abierta y visible).
 * - Android/iOS: plugin de geolocalización en segundo plano con una notificación permanente
 *   y silenciosa («Astrea · seguimiento automático»). Sigue registrando con la pantalla
 *   apagada o la app minimizada, mientras el integrante no pause el recorrido.
 *
 * En la app nativa las posiciones se envían por HTTP nativo a la API REST de Firestore,
 * con el token del usuario, para que Android no las retrase cuando la app está en segundo plano.
 * Las reglas de seguridad son las mismas que en la web.
 */
import { Capacitor, CapacitorHttp, registerPlugin } from '@capacitor/core';
import type { BackgroundGeolocationPlugin } from '@capacitor-community/background-geolocation';

export interface Fix { latitude: number; longitude: number; accuracy: number; speed: number | null; heading: number | null; timestamp: number; physicalMotion?: boolean }
export type FixError = { kind: 'denied' | 'unavailable'; message: string };
export const isNativeApp = (): boolean => { try { return Capacitor.isNativePlatform(); } catch { return false; } };
export const appPlatform = (): 'web' | 'android' | 'ios' => { try { return Capacitor.getPlatform() as 'web' | 'android' | 'ios'; } catch { return 'web'; } };
export type NativePermissionState = 'granted' | 'denied' | 'prompt' | 'prompt-with-rationale';
// Capacitor Android expone estos métodos heredados de Plugin; no crean un watcher ni un servicio.
export interface LocationPermissionApi {
  checkPermissions(): Promise<{ location: NativePermissionState }>;
  requestPermissions(): Promise<{ location: NativePermissionState }>;
}
const BackgroundGeolocation = registerPlugin<BackgroundGeolocationPlugin & LocationPermissionApi>('BackgroundGeolocation');
const AstreaMotion = registerPlugin<{start():Promise<{available:boolean}>;getState():Promise<{available:boolean;moving:boolean}>;stop():Promise<void>}>('AstreaMotion');
export async function nativeLocationPermission(request = false, api: LocationPermissionApi = BackgroundGeolocation): Promise<'granted' | 'denied' | 'prompt'> {
  let result = await api.checkPermissions();
  if (request && result.location !== 'granted') result = await api.requestPermissions();
  return result.location === 'prompt-with-rationale' ? 'prompt' : result.location;
}

export interface FixWatcher { stop: () => void }
export async function watchFixes(onFix: (fix: Fix) => void, onError: (error: FixError) => void, notice: { title: string; message: string }): Promise<FixWatcher> {
  if (isNativeApp()) {
    const android=appPlatform()==='android';let stopped=false;
    if(android)await AstreaMotion.start();
    let id:string;
    try { id = await BackgroundGeolocation.addWatcher({ backgroundTitle: notice.title, backgroundMessage: notice.message, requestPermissions: false, stale: false, distanceFilter: 0 }, (location, error) => {
      if (error) { onError({ kind: error.code === 'NOT_AUTHORIZED' && !/services disabled/i.test(error.message) ? 'denied' : 'unavailable', message: error.message }); return; }
      if (location) {const fix:Fix={ latitude: location.latitude, longitude: location.longitude, accuracy: location.accuracy, speed: location.speed, heading: location.bearing, timestamp: location.time ?? Date.now() };
        if(android)void AstreaMotion.getState().then(state=>{if(!stopped)onFix({...fix,physicalMotion:state.available?state.moving:fix.speed!==null&&fix.speed>=0.8});}).catch(()=>onError({kind:'unavailable',message:'No se pudo comprobar el sensor de movimiento.'}));
        else if(!stopped)onFix(fix);
      }
    }); }catch(error){if(android)await AstreaMotion.stop();throw error;}
    return { stop: () => {if(stopped)return;stopped=true;void BackgroundGeolocation.removeWatcher({ id }).finally(()=>{if(android)void AstreaMotion.stop();}).catch(() => {}); } };
  }
  const id = navigator.geolocation.watchPosition(position => onFix(fromPosition(position)),
    error => onError({ kind: error.code === 1 ? 'denied' : 'unavailable', message: error.message }),
    { enableHighAccuracy: true, maximumAge: 0, timeout: 30000 });
  return { stop: () => navigator.geolocation.clearWatch(id) };
}
export function fromPosition(position: GeolocationPosition): Fix {
  return { latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy, speed: position.coords.speed ?? null, heading: position.coords.heading ?? null, timestamp: position.timestamp || Date.now() };
}
export interface NotificationPermissionApi {
  checkPermissions(): Promise<{display: string}>;
  requestPermissions(): Promise<{display: string}>;
}
/** Solo la preparación inicial solicita el permiso. Denegarlo no bloquea el servicio de ubicación. */
export async function requestNotificationPermission(request = false, api?: NotificationPermissionApi): Promise<boolean> {
  const notifications = api ?? (await import('@capacitor/local-notifications')).LocalNotifications;
  let status = await notifications.checkPermissions();
  if (request && status.display !== 'granted') status = await notifications.requestPermissions();
  return status.display === 'granted';
}
export async function openAppSettings(): Promise<void> { if (isNativeApp()) await BackgroundGeolocation.openSettings(); }

/** Nivel de batería 0–100, o null si el dispositivo no lo informa. */
export async function batteryLevel(): Promise<number | null> {
  try {
    if (isNativeApp()) { const { Device } = await import('@capacitor/device'); const info = await Device.getBatteryInfo(); return typeof info.batteryLevel === 'number' ? Math.round(info.batteryLevel * 100) : null; }
    const battery = await (navigator as Navigator & { getBattery?: () => Promise<{ level: number }> }).getBattery?.();
    return battery ? Math.round(battery.level * 100) : null;
  } catch { return null; }
}

// ---- Firestore REST (solo app nativa) ----
type Value = { stringValue: string } | { integerValue: string } | { doubleValue: number } | { booleanValue: boolean } | { nullValue: null } | {mapValue:{fields:Record<string,Value>}} | {arrayValue:{values:Value[]}};
function firestoreValue(value: unknown, double = false): Value {
  if (value === null) return {nullValue:null};
  if (typeof value === 'boolean') return {booleanValue:value};
  if (typeof value === 'number' && Number.isFinite(value)) return Number.isInteger(value) && !double ? {integerValue:String(value)} : {doubleValue:value};
  if (typeof value === 'string') return {stringValue:value};
  if (Array.isArray(value)) return {arrayValue:{values:value.map(item=>firestoreValue(item))}};
  if (typeof value === 'object' && value) return {mapValue:{fields:toFirestoreFields(value as Record<string,unknown>,[])}};
  throw new Error('Valor no válido para guardar el seguimiento.');
}
export function toFirestoreFields(data: Record<string, unknown>, doubles: string[] = []): Record<string, Value> {
  const fields: Record<string, Value> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue;
    fields[key] = firestoreValue(value,doubles.includes(key));
  }
  return fields;
}
export const firestoreDocumentsUrl = (projectId: string, databaseId: string) => `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents`;
const documentsPath = (url: string) => url.replace('https://firestore.googleapis.com/v1/', '');
export function createCommitBody(root: string, collection: string, id: string, data: Record<string, unknown>, serverTimeField: string | undefined, doubles: string[]) {
  return { writes: [{ update: { name: `${root}/${collection}/${id}`, fields: toFirestoreFields(data, doubles) }, currentDocument: { exists: false }, updateTransforms: serverTimeField ? [{ fieldPath: serverTimeField, setToServerValue: 'REQUEST_TIME' }] : [] }] };
}
export function upsertCommitBody(root: string, collection: string, id: string, data: Record<string, unknown>, serverTimeField: string | undefined, doubles: string[]) {
  return { writes: [{ update: { name: `${root}/${collection}/${id}`, fields: toFirestoreFields(data, doubles) }, currentDocument: undefined, updateTransforms: serverTimeField ? [{ fieldPath: serverTimeField, setToServerValue: 'REQUEST_TIME' }] : [] }] };
}
export function patchCommitBody(root: string, collection: string, id: string, data: Record<string,unknown>, serverTimeField: string | undefined, doubles: string[]) {
  const body=upsertCommitBody(root,collection,id,data,serverTimeField,doubles);
  return {writes:[{...body.writes[0],currentDocument:{exists:true},updateMask:{fieldPaths:Object.keys(data)}}]};
}
/**
 * Escribe con HTTP nativo. `mode: 'create'` no sobrescribe un documento existente: si ya existe
 * (un reintento de la misma posición) se considera guardado.
 */
export async function nativeCommit(config: { projectId: string; databaseId: string }, token: string, mode: 'create' | 'upsert' | 'update', collection: string, id: string, data: Record<string, unknown>, serverTimeField: string | undefined, doubles: string[], transport: Pick<typeof CapacitorHttp, 'post'> = CapacitorHttp): Promise<void> {
  const url = firestoreDocumentsUrl(config.projectId, config.databaseId);
  const body = (mode === 'create' ? createCommitBody : mode === 'update' ? patchCommitBody : upsertCommitBody)(documentsPath(url), collection, id, data, serverTimeField, doubles);
  const response = await transport.post({ url: `${url}:commit`, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, data: JSON.parse(JSON.stringify(body)), connectTimeout: 15000, readTimeout: 15000 });
  if (response.status >= 200 && response.status < 300) return;
  const text = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
  let errorStatus: string | undefined;
  try { errorStatus = (typeof response.data === 'string' ? JSON.parse(response.data) : response.data)?.error?.status; } catch { /* respuesta sin JSON: se conserva el error y la posición pendiente */ }
  if (mode === 'create' && response.status === 409 && errorStatus === 'ALREADY_EXISTS') return;
  throw new Error(`Firestore ${response.status}: ${text.slice(0, 200)}`);
}
