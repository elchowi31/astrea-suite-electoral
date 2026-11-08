import { localDataEnabled } from './deviceStorage';
import { canonicalStoredValue } from './serialization';

export type MutationScope = { userId: string; tenantId: string };
export type OfflineMutation = {
  sequence?: number; id: string; kind: string; scope: MutationScope; payload: unknown;
  createdAt: string; status: 'pending' | 'failed'; attempts: number; error?: string; errorCode?: string;
};
export type MutationContext = { id: string; scope: MutationScope };
type Handler = (payload: any, context: MutationContext) => Promise<void>;
const handlers = new Map<string, Handler>();
let activeScope: MutationScope | null = null;
let lastSaveQueued = false;
const drains = new Map<string, Promise<void>>();
const databaseName = 'astrea-offline-mutations';
const sameScope = (a: MutationScope | null, b: MutationScope) => !!a && a.userId === b.userId && a.tenantId === b.tenantId;
export const isLastSaveQueued = () => lastSaveQueued;
export const mutationNetworkAvailable = () => typeof navigator === 'undefined' || navigator.onLine !== false;
function changed() { if (typeof window !== 'undefined') window.dispatchEvent(new Event('astrea:mutations-changed')); }
export function setOfflineMutationScope(scope: MutationScope | null) { activeScope = scope; changed(); }
export function isOfflineMutationScopeActive(scope: MutationScope) { return sameScope(activeScope, scope) || (typeof window === 'undefined' && !localDataEnabled()); }
export function registerOfflineMutation(kind: string, handler: Handler) { handlers.set(kind, handler); }
export function requireOnlineMutation(message = 'Esta operación necesita conexión para comprobar disponibilidad y cambios de otras personas. Sus datos del formulario se conservan.') {
  if (!mutationNetworkAvailable()) throw new Error(message);
}
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => {
      const store = request.result.createObjectStore('mutations', { keyPath: 'sequence', autoIncrement: true });
      store.createIndex('id', 'id', { unique: true });
    };
    request.onsuccess = () => { request.result.onversionchange = () => request.result.close(); resolve(request.result); };
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Otra pestaña impide abrir el almacenamiento. Cierre las otras pestañas y vuelva a intentar.'));
  });
}
async function storage<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction('mutations', mode);
    const request = action(transaction.objectStore('mutations'));
    let result: T;
    request.onsuccess = () => { result = request.result; };
    transaction.oncomplete = () => { database.close(); resolve(result); };
    transaction.onabort = transaction.onerror = () => { database.close(); reject(transaction.error || request.error || new Error('No se pudo conservar el registro en el dispositivo.')); };
  });
}
export async function queuedOfflineMutations(scope?: MutationScope): Promise<OfflineMutation[]> {
  const rows = await storage<OfflineMutation[]>('readonly', store => store.getAll());
  return rows.filter(row => !scope || sameScope(row.scope, scope)).sort((a, b) => a.sequence! - b.sequence!);
}
function errorDetails(error: unknown) {
  return { error: error instanceof Error ? error.message : String(error), errorCode: String((error as { code?: string })?.code || '') };
}
function transient(error: unknown) {
  return ['unavailable', 'deadline-exceeded', 'cancelled', 'resource-exhausted', 'auth/network-request-failed'].includes(String((error as { code?: string })?.code || ''));
}
/** One ordered queue per account and organization; Web Locks also serialize other tabs. */
export async function syncOfflineMutations(scope: MutationScope = activeScope!): Promise<void> {
  if (!scope || !sameScope(activeScope, scope) || !mutationNetworkAvailable() || !localDataEnabled()) return;
  const key = `${scope.userId}:${scope.tenantId}`;
  if (drains.has(key)) return drains.get(key);
  const drain = async () => {
    for (const row of await queuedOfflineMutations(scope)) {
      if (!sameScope(activeScope, scope) || !mutationNetworkAvailable()) break;
      const handler = handlers.get(row.kind);
      if (row.status === 'failed') break;
      if (!handler) {
        await storage('readwrite', store => store.put({ ...row, status: 'failed', error: 'No se pudo cargar el módulo que guardó este cambio. Recargue la aplicación y reintente la sincronización.', errorCode: 'handler-missing' }));
        changed();
        break;
      }
      try {
        await handler(row.payload, { id: row.id, scope: row.scope });
        await storage('readwrite', store => store.delete(row.sequence!));
        changed();
      } catch (error) {
        await storage('readwrite', store => store.put({ ...row, status: transient(error) ? 'pending' : 'failed', attempts: row.attempts + 1, ...errorDetails(error) }));
        changed();
        break;
      }
    }
  };
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
  const promise = (locks ? locks.request(`astrea-sync:${key}`, drain) : drain()).finally(() => { drains.delete(key); changed(); });
  drains.set(key, promise);
  return promise;
}
export async function retryOfflineMutations(scope: MutationScope) {
  for (const row of await queuedOfflineMutations(scope)) if (row.status === 'failed') await storage('readwrite', store => store.put({ ...row, status: 'pending', error: undefined, errorCode: undefined }));
  changed();
  await syncOfflineMutations(scope);
}
export async function discardFailedOfflineMutation(scope: MutationScope, id: string) {
  const row = (await queuedOfflineMutations(scope)).find(item => item.id === id);
  if (!row || row.status !== 'failed' || !sameScope(activeScope, scope)) throw new Error('Solo puede retirar un cambio con error de su cuenta y organización actual.');
  await storage('readwrite', store => store.delete(row.sequence!));
  changed();
}
/** Never claims server success before acknowledgment. An offline success means an IDB commit only. */
export async function durableMutation(kind: string, scope: MutationScope, payload: unknown): Promise<void> {
  lastSaveQueued = false;
  if (!scope.userId || !scope.tenantId) throw new Error('El registro necesita una cuenta y organización válidas.');
  if (activeScope && !sameScope(activeScope, scope)) throw new Error('La organización o cuenta cambió. Revise el formulario antes de guardar.');
  const handler = handlers.get(kind);
  if (!handler) throw new Error('No se encontró el controlador de este formulario. Recargue la aplicación.');
  if (!localDataEnabled()) {
    requireOnlineMutation('Active «Conservación de datos» en Mi dispositivo para poder guardar sin internet. El formulario se conserva.');
    await handler(payload, { id: crypto.randomUUID(), scope });
    return;
  }
  // IndexedDB must acknowledge before a form is allowed to clear its fields.
  const existing = (await queuedOfflineMutations(scope)).find(row => row.kind === kind && canonicalStoredValue(row.payload) === canonicalStoredValue(payload));
  const id = existing?.id || crypto.randomUUID();
  if (!existing) await storage('readwrite', store => store.add({ id, kind, scope, payload, createdAt: new Date().toISOString(), status: 'pending', attempts: 0 } satisfies OfflineMutation));
  changed();
  if (mutationNetworkAvailable() && sameScope(activeScope, scope)) {
    const work = syncOfflineMutations(scope);
    let timer: ReturnType<typeof setTimeout>;
    await Promise.race([work, new Promise<void>(resolve => { timer = setTimeout(resolve, 4000); })]);
    clearTimeout(timer!);
    const row = (await queuedOfflineMutations(scope)).find(row => row.id === id);
    if (!row) return;
    if (row.status === 'failed') { const error = new Error(row.error); Object.assign(error, { code: row.errorCode }); throw error; }
  }
  lastSaveQueued = true;
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('astrea:mutation-queued', { detail: { id, scope } }));
}
