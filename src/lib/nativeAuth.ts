import { CapacitorHttp } from '@capacitor/core';

type NativeUser = { uid: string; refreshToken: string };
type Session = { source: string; renewal: string; token?: string; expiresAt: number; pending?: Promise<string> };

/** La renovación también usa HTTP nativo: el WebView puede quedar suspendido durante un recorrido. */
export function createNativeTokenProvider(transport: Pick<typeof CapacitorHttp, 'post'> = CapacitorHttp, now: () => number = Date.now) {
  const sessions = new WeakMap<NativeUser, Session>();
  return async (user: NativeUser, apiKey: string): Promise<string> => {
    if (!apiKey || !user.refreshToken) throw new Error('Inicie sesión de nuevo para sincronizar las posiciones.');
    let session = sessions.get(user);
    if (!session || session.source !== user.refreshToken) {
      session = { source: user.refreshToken, renewal: user.refreshToken, expiresAt: 0 };
      sessions.set(user, session);
    }
    if (session.token && session.expiresAt > now() + 60_000) return session.token;
    if (session.pending) return session.pending;
    const current = session;
    current.pending = (async () => {
      const response = await transport.post({
        url: `https://securetoken.googleapis.com/v1/token?key=${encodeURIComponent(apiKey)}`,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        data: `grant_type=refresh_token&refresh_token=${encodeURIComponent(current.renewal)}`,
        connectTimeout: 15000, readTimeout: 15000,
      });
      // Nunca incluir la respuesta en el error: contiene credenciales de sesión.
      if (response.status !== 200) throw new Error(`No se pudo renovar la sesión (HTTP ${response.status}). Las posiciones siguen pendientes; revise la conexión o inicie sesión de nuevo.`);
      let data: { id_token?: string; refresh_token?: string; user_id?: string; expires_in?: string };
      try { data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data; }
      catch { throw new Error('La renovación de sesión devolvió una respuesta inválida.'); }
      const seconds = Number(data?.expires_in);
      if (!data || data.user_id !== user.uid || typeof data.id_token !== 'string' || !data.id_token || !Number.isFinite(seconds) || seconds <= 60) {
        throw new Error('No se pudo validar la sesión para este integrante. Inicie sesión de nuevo.');
      }
      current.token = data.id_token;
      current.renewal = data.refresh_token || current.renewal;
      current.expiresAt = now() + seconds * 1000;
      return current.token;
    })();
    try { return await current.pending; } finally { current.pending = undefined; }
  };
}

export const nativeTrackingToken = createNativeTokenProvider();
