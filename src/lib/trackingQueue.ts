import type { QueuedLocation, QueuedRoute } from './deviceStorage';

export interface TrackingQueueIO {
  routes(): Promise<QueuedRoute[]>; samples(): Promise<QueuedLocation[]>;
  createRoute(row: QueuedRoute): Promise<void>; finishRoute(row: QueuedRoute): Promise<void>;
  writeSample(sample: QueuedLocation): Promise<void>;
  removeSample(id: string): Promise<void>; removeRoute(id: string, finishedAt?: number): Promise<void>;
}
/** Encabezado antes que posiciones, cierre después. Un error conserva todo lo que falta. */
export async function flushTrackingQueue(io: TrackingQueueIO): Promise<number> {
  const routes=await io.routes();
  for (const row of routes) await io.createRoute(row);
  const samples=await io.samples();
  for (const sample of samples) { await io.writeSample(sample); await io.removeSample(sample.id); }
  for (const row of routes) {
    if (row.finishedAtMillis) await io.finishRoute(row);
    await io.removeRoute(row.id,row.finishedAtMillis);
  }
  return samples.length;
}
