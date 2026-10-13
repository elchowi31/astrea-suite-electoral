import type { Fix } from './nativeTracking';
import type { AssignedRoute } from './routeTracking';
import { distanceBetween } from './geographicImport';

export const STOP_AFTER_MS = 5 * 60_000;
const MAX_ACCURACY = 35, MAX_SPEED = 60, SAMPLE_MS = 10_000, SIGNAL_GAP_MS = 120_000;
export interface MovementState {
  anchor?: Fix; candidate?: Fix; lastObserved?: Fix; lastRecorded?: Fix;
  moving: boolean; lastMovementAt: number;
}
export const emptyMovement = (): MovementState => ({ moving: false, lastMovementAt: 0 });
export interface MovementResult {
  state: MovementState; accepted: boolean; started?: Fix[]; sample?: Fix; stoppedAt?: number;
}
const threshold = (a: Fix, b: Fix, minimum: number) => Math.max(minimum, (a.accuracy + b.accuracy) * 0.8);
/** Dos desplazamientos coherentes confirman un traslado; la deriva GPS no llena el historial. */
export function observeMovement(previous: MovementState, fix: Fix, now = Date.now()): MovementResult {
  const rejected = { state: previous, accepted: false };
  if (![fix.latitude, fix.longitude, fix.accuracy, fix.timestamp].every(Number.isFinite)
    || Math.abs(fix.latitude) > 90 || Math.abs(fix.longitude) > 180 || fix.accuracy < 0 || fix.accuracy > MAX_ACCURACY
    || now - fix.timestamp > 30_000 || fix.timestamp > now + 30_000
    || (previous.lastObserved && fix.timestamp <= previous.lastObserved.timestamp)) return rejected;
  const last = previous.lastObserved;
  if (last && distanceBetween(last, fix) / ((fix.timestamp - last.timestamp) / 1000) > MAX_SPEED) return rejected;
  // Una pérdida de señal no se interpreta como movimiento ni se une con una línea inventada.
  if (!previous.anchor || (last && fix.timestamp - last.timestamp > SIGNAL_GAP_MS)) {
    return { accepted: true, state: { anchor: fix, lastObserved: fix, moving: false, lastMovementAt: 0 },
      ...(previous.moving ? { stoppedAt: previous.lastMovementAt } : {}) };
  }
  const state: MovementState = { ...previous, lastObserved: fix };
  // La deriva de coordenadas no es actividad física. Con el sensor quieto,
  // conservar la última posición real; una velocidad GPS sostenida permite
  // continuar un vehículo ya confirmado incluso en un tramo muy uniforme.
  const physical = fix.physicalMotion !== false || (state.moving && fix.speed !== null && fix.speed >= 2.5);
  if (!physical || (fix.physicalMotion === undefined && fix.speed !== null && fix.speed < 0.5)) {
    state.candidate=undefined;
    if(!state.moving)state.anchor=fix;
    if(state.moving && fix.timestamp-state.lastMovementAt>=STOP_AFTER_MS)return {accepted:true,stoppedAt:state.lastMovementAt,state:{anchor:fix,lastObserved:fix,moving:false,lastMovementAt:0}};
    return {state,accepted:true};
  }
  if (!state.moving) {
    const anchor = state.anchor!;
    const distance = distanceBetween(anchor, fix);
    if (distance < threshold(anchor, fix, 25)) {
      // Mantener una referencia estable, con la hora de la última lectura en reposo.
      state.anchor = { ...anchor, timestamp: fix.timestamp };
      state.candidate = undefined;
      return { state, accepted: true };
    }
    const candidate = state.candidate;
    if (candidate && fix.timestamp - candidate.timestamp >= 10_000
      && distanceBetween(candidate, fix) >= 6 && distance >= distanceBetween(anchor, candidate) + 3) {
      state.moving = true; state.lastRecorded = fix; state.lastMovementAt = fix.timestamp; state.candidate = undefined;
      return { state, accepted: true, started: [anchor, candidate, fix] };
    }
    if (!candidate || distance < distanceBetween(anchor, candidate) - 5) state.candidate = fix;
    return { state, accepted: true };
  }
  const recorded = state.lastRecorded!;
  if (fix.timestamp - recorded.timestamp >= SAMPLE_MS && distanceBetween(recorded, fix) >= threshold(recorded, fix, 12)) {
    state.lastRecorded = fix; state.lastMovementAt = fix.timestamp;
    return { state, accepted: true, sample: fix };
  }
  if (fix.timestamp - state.lastMovementAt >= STOP_AFTER_MS) {
    return { accepted: true, stoppedAt: state.lastMovementAt,
      state: { anchor: fix, lastObserved: fix, moving: false, lastMovementAt: 0 } };
  }
  return { state, accepted: true };
}
export function automaticRoute(tenantId: string, userId: string, employeeName: string, deviceId: string, id: string, start: Fix): AssignedRoute {
  const at = new Date(start.timestamp).toISOString();
  return { id, tenantId, userId, employeeName, deviceId, kind: 'automatic', vehicleId: '', vehiclePlate: '',
    name: `Traslado · ${new Date(start.timestamp).toLocaleString('es-CO')}`, instructions: 'Registrado automáticamente al detectar desplazamiento real.',
    scheduledDate: at.slice(0, 10), route: { name: 'Traslado real', geometry: [], stops: [], distanceMeters: 0, durationSeconds: 0, provider: 'Archivo', calculatedAt: at },
    status: 'En curso', createdBy: userId, createdAt: at, startedAt: at, startedAtMillis: Math.round(start.timestamp) };
}
