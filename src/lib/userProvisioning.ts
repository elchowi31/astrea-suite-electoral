import { deleteApp, initializeApp } from 'firebase/app';
import { connectAuthEmulator, createUserWithEmailAndPassword, deleteUser, getAuth, signOut } from 'firebase/auth';
import { doc, writeBatch } from 'firebase/firestore';
import { app, auth, db } from './firebase';
import { omitUndefined } from './serialization';
import { getRoleHierarchyLevel } from './permissions';
import type { Tenant, UserProfile, UserRole } from '../types';

export const TEAM_ROLES: UserRole[] = ['AdminTenant', 'Gobernador', 'Diputado', 'Alcalde', 'Concejal', 'JefePolitico', 'Supervisor', 'Operador', 'LiderVeredal', 'Consulta', 'Invitado'];
export function canManageUsers(user: UserProfile | null | undefined): boolean {
  return !!user && ['AdminGlobal', 'AdminTenant', 'Gobernador', 'Diputado', 'Alcalde', 'Concejal', 'JefePolitico'].includes(user.role);
}
export function assignableRoles(user: UserProfile): UserRole[] {
  return TEAM_ROLES.filter(role => getRoleHierarchyLevel(role) <= getRoleHierarchyLevel(user.role));
}
export function accountError(error: unknown): string {
  const code = (error as { code?: string })?.code;
  const messages: Record<string, string> = {
    'auth/email-already-in-use': 'Ese correo ya tiene una cuenta. Ingrese o recupere la contraseña.',
    'auth/invalid-email': 'Revise el correo electrónico.',
    'auth/weak-password': 'Use una contraseña de al menos 8 caracteres.',
    'auth/operation-not-allowed': 'Active el acceso por correo y contraseña en Firebase Authentication.',
    'auth/network-request-failed': 'No hay conexión. Conserve el formulario e intente nuevamente.',
    'permission-denied': 'Firestore no permitió guardar. Revise los permisos de la cuenta y publique las reglas de la base configurada.',
  };
  return (code && messages[code]) || (error instanceof Error ? error.message : 'No fue posible guardar la cuenta.');
}
type ProfileInput = Omit<UserProfile, 'uid' | 'createdAt'>;
function checkInput(input: ProfileInput, password: string) {
  if (!input.displayName.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim()) || password.length < 8) throw new Error('Ingrese nombre, correo y contraseña de al menos 8 caracteres.');
}

/** Creates only a new space owned by this authenticated UID, in one atomic commit. */
export async function createPersonalOrganization(input: ProfileInput, password: string): Promise<UserProfile> {
  checkInput(input, password);
  if (auth.currentUser) throw new Error('Para agregar personas a su organización, abra Usuarios y accesos.');
  const { user } = await createUserWithEmailAndPassword(auth, input.email.trim().toLowerCase(), password);
  const now = new Date().toISOString();
  const tenantId = `org-${user.uid}`;
  const profile: UserProfile = { ...input, uid: user.uid, email: user.email!, tenantId, createdAt: now, role: 'AdminTenant', requestedRole: input.role, active: true, accessVersion: 2 };
  const tenant: Tenant & { ownerUid: string } = { tenantId, ownerUid: user.uid, name: (input.party?.trim() || `Equipo de ${input.displayName.trim()}`).slice(0,200), primaryColor: '#0f172a', secondaryColor: '#1e293b', createdAt: now, active: true, plan: 'Gratuito' };
  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'organizaciones', tenantId), tenant);
    batch.set(doc(db, 'usuarios', user.uid), omitUndefined(profile));
    await batch.commit();
    return profile;
  } catch (error) {
    // Avoid accounts which authenticate successfully but have no usable profile.
    try { await deleteUser(user); } catch { await signOut(auth); }
    throw new Error(accountError(error));
  }
}

/** A secondary Auth instance preserves the administrator's verified session. */
export async function createTeamUser(input: ProfileInput, password: string, actor: UserProfile): Promise<UserProfile> {
  checkInput(input, password);
  if (auth.currentUser?.uid !== actor.uid || !canManageUsers(actor) || !assignableRoles(actor).includes(input.role) || (actor.role !== 'AdminGlobal' && actor.tenantId !== input.tenantId)) throw new Error('No tiene permiso para crear ese acceso.');
  const secondary = initializeApp(app.options, `provision-${crypto.randomUUID()}`);
  const secondaryAuth = getAuth(secondary);
  if (import.meta.env?.VITE_FIREBASE_EMULATORS === 'true') connectAuthEmulator(secondaryAuth, 'http://127.0.0.1:9098', { disableWarnings: true });
  let createdUser;
  try {
    createdUser = (await createUserWithEmailAndPassword(secondaryAuth, input.email.trim().toLowerCase(), password)).user;
    const now = new Date().toISOString();
    const profile: UserProfile = { ...input, uid: createdUser.uid, email: createdUser.email!, createdAt: now, active: true, accessVersion: 2 };
    const batch = writeBatch(db);
    batch.set(doc(db, 'usuarios', profile.uid), { ...omitUndefined(profile), updatedAt: now, updatedBy: actor.uid });
    const auditId = crypto.randomUUID();
    batch.set(doc(db, 'auditoria', auditId), { id: auditId, tenantId: profile.tenantId, actorId: actor.uid, entity: 'usuarios', entityId: profile.uid, action: 'create', createdAt: now });
    await batch.commit();
    return profile;
  } catch (error) {
    if (createdUser) {
      try { await deleteUser(createdUser); } catch { throw new Error(`${accountError(error)} La cuenta de acceso quedó creada sin perfil; el administrador debe completar o retirar ese acceso en Firebase Authentication.`); }
    }
    throw new Error(accountError(error));
  } finally {
    await signOut(secondaryAuth);
    await deleteApp(secondary);
  }
}
