import type {AssignedRoute} from './routeTracking';

/** Cambiar el equipo que se consulta nunca mezcla su historial con el GPS de este celular. */
export function monitorRoutes(routes: AssignedRoute[], automatic: AssignedRoute | null | undefined, tenantId: string): AssignedRoute[] {
  const scoped = routes.filter(route=>route.tenantId===tenantId);
  return automatic?.tenantId===tenantId ? [automatic,...scoped.filter(route=>route.id!==automatic.id)] : scoped;
}
