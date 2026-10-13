import type {UserProfile} from '../types';

/** AdminGlobal proviene exclusivamente de las credenciales verificadas en firebaseAuth. */
export function isTrackingAdministrator(user: UserProfile | null | undefined): boolean {
  return !!user && (user.role === 'AdminGlobal' || (user.role === 'AdminTenant' && user.active === true && user.accessVersion === 2));
}
