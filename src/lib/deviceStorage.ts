import type { AssignedRoute } from './routeTracking';
export const DEVICE_KEY = 'astrea-device-storage-v1';
export interface DeviceChoice { enabled: boolean; decidedAt: string; persistent: boolean }
export function deviceChoice(): DeviceChoice | null {
  try { const value = JSON.parse(localStorage.getItem(DEVICE_KEY) || 'null'); return value && typeof value.enabled === 'boolean' ? value : null; } catch { return null; }
}
export function localDataEnabled(): boolean { return deviceChoice()?.enabled === true; }
export async function chooseDeviceStorage(enabled: boolean): Promise<DeviceChoice> {
  const persistent = enabled && !!(await navigator.storage?.persist?.().catch(() => false));
  const value = { enabled, persistent, decidedAt: new Date().toISOString() };
  localStorage.setItem(DEVICE_KEY, JSON.stringify(value));
  if(enabled)for(const sample of memoryQueue.values()){await queueOperation('readwrite',store=>store.put(sample));memoryQueue.delete(sample.id);}
  return value;
}
export async function registerOfflineApp(): Promise<void> {
  // La app nativa ya trae sus archivos instalados; el service worker solo aplica a la web.
  const native = (globalThis as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.() === true;
  if (!native && localDataEnabled() && 'serviceWorker' in navigator && !import.meta.env.DEV) await navigator.serviceWorker.register('/service-worker.js');
}
export interface QueuedLocation { id: string; tenantId: string; userId: string; routeId: string; latitude: number; longitude: number; accuracy: number; capturedAt: string; capturedAtMillis:number }
const memoryQueue = new Map<string, QueuedLocation>();
export interface QueuedRoute { id: string; route: AssignedRoute; finishedAtMillis?: number }
function openQueue(): Promise<IDBDatabase> {
  return new Promise((resolve,reject) => { const request = indexedDB.open('astrea-route-queue',2); request.onupgradeneeded = () => { for (const name of ['samples','routes']) if (!request.result.objectStoreNames.contains(name)) request.result.createObjectStore(name,{ keyPath: 'id' }); }; request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
}
async function queueOperation<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>, name = 'samples'): Promise<T> {
  const database = await openQueue();
  return new Promise((resolve,reject) => { const transaction = database.transaction(name,mode); const request = action(transaction.objectStore(name)); let result: T;
    const success=request.onsuccess;request.onsuccess = event => { result = request.result; success?.call(request,event); }; transaction.oncomplete = () => { database.close(); resolve(result); }; transaction.onerror = transaction.onabort = () => { database.close(); reject(transaction.error || request.error); }; });
}
export async function queueLocation(sample: QueuedLocation): Promise<void> {
  if (localDataEnabled()) await queueOperation('readwrite',store => store.put(sample)); else memoryQueue.set(sample.id,sample);
}
export async function queuedLocations(userId?: string, tenantId?: string): Promise<QueuedLocation[]> {
  const rows: QueuedLocation[] = localDataEnabled() ? await queueOperation('readonly',store => store.getAll()) : [...memoryQueue.values()];
  return rows.filter(row => (!userId||row.userId === userId) && (!tenantId||row.tenantId === tenantId)).sort((a,b) => a.capturedAt.localeCompare(b.capturedAt));
}
export async function removeQueuedLocation(id: string): Promise<void> {
  if (localDataEnabled()) await queueOperation('readwrite',store => store.delete(id)); else memoryQueue.delete(id);
}
export async function queueAutomaticRoute(route: AssignedRoute, finishedAtMillis?: number): Promise<void> {
  if (!localDataEnabled()) throw new Error('Active la conservación de datos para el seguimiento automático.');
  await queueOperation('readwrite',store => store.put({id:route.id,route,...(finishedAtMillis ? {finishedAtMillis} : {})} satisfies QueuedRoute),'routes');
}
export async function queuedAutomaticRoutes(userId?: string, tenantId?: string): Promise<QueuedRoute[]> {
  const rows: QueuedRoute[] = await queueOperation('readonly',store => store.getAll(),'routes');
  return rows.filter(row => (!userId || row.route.userId === userId) && (!tenantId || row.route.tenantId === tenantId));
}
export async function removeQueuedAutomaticRoute(id: string, expectedFinishedAt?: number): Promise<void> {
  // No borrar un cierre añadido mientras la sincronización del encabezado estaba en curso.
  await queueOperation('readwrite',store => {
    const request=store.get(id);
    request.onsuccess=()=>{const row=request.result as QueuedRoute|undefined;if(row && row.finishedAtMillis===expectedFinishedAt)store.delete(id);};
    return request;
  },'routes');
}
export async function clearDeviceData(): Promise<void> {
  if ('serviceWorker' in navigator) for (const registration of await navigator.serviceWorker.getRegistrations()) if (registration.active?.scriptURL.endsWith('/service-worker.js')) await registration.unregister();
  if ('caches' in window) for (const key of await caches.keys()) if (key.startsWith('astrea-app-')) await caches.delete(key);
  await new Promise<void>((resolve,reject) => { const request = indexedDB.deleteDatabase('astrea-route-queue'); request.onsuccess = () => resolve(); request.onerror = () => reject(request.error); request.onblocked = () => reject(new Error('Cierre las otras pestañas antes de retirar los datos.')); });
  localStorage.removeItem('astrea-device-user');
  localStorage.removeItem('astrea-device-seed-v1');
  sessionStorage.removeItem('astrea-device-seed-v1');
  memoryQueue.clear();
}
