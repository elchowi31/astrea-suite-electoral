import type {UserProfile} from '../types';

export type ViewerScope = Pick<UserProfile, 'uid' | 'role' | 'tenantId'>;

/** Un refresco de la misma identidad global no cambia el equipo que está consultando. */
export function keepViewedTenant(previous: ViewerScope | null, next: ViewerScope | null): boolean {
  return !!previous && !!next && previous.role === 'AdminGlobal' && next.role === 'AdminGlobal'
    && previous.uid === next.uid && previous.tenantId === next.tenantId;
}
