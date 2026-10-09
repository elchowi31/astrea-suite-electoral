import {
  signInWithEmailAndPassword,
  signInWithPopup,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';
import { doc, setDoc, getDoc, onSnapshot } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import { UserProfile } from '../types';
import { accountError, createPersonalOrganization } from './userProvisioning';
import { isPlatformAdminClaims } from './accessPolicy';

// Real Firebase Auth Provider
const googleProvider = new GoogleAuthProvider();

/**
 * Return the current verified Firebase session. Anonymous access is intentionally
 * disabled because the platform contains restricted political and financial data.
 */
export async function ensureFirebaseAuthSession(): Promise<FirebaseUser | null> {
  try {
    return auth.currentUser;
  } catch (error: any) {
    console.warn('No fue posible validar la sesión de Firebase:', error?.message);
    return null;
  }
}

export interface AuthResult {
  success: boolean;
  user?: UserProfile;
  firebaseUser?: FirebaseUser;
  error?: string;
}

export const sendPasswordReset = async (email: string): Promise<void> => {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) {
    throw new Error('Ingrese su correo para recuperar la contraseña.');
  }
  await sendPasswordResetEmail(auth, normalizedEmail);
};

/**
 * Record a formal login session event in Firestore
 */
export async function logSessionToFirestore(user: UserProfile, method: string = 'email_password'): Promise<void> {
  try {
    const timestamp = new Date().toISOString();

    // 1. Update user document in Firestore /usuarios/{uid}
    const userRef = doc(db, 'usuarios', user.uid);
    await setDoc(userRef, { lastLoginAt: timestamp }, { merge: true });

    // 2. Also register in the audit sessions log /sesiones_usuarios
    const sessionId = `sesion-${user.uid}-${Date.now()}`;
    const sessionLogRef = doc(db, 'sesiones_usuarios', sessionId);
    await setDoc(sessionLogRef, {
      id: sessionId,
      userId: user.uid,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      electoralLevel: user.electoralLevel || 'Alcaldía',
      municipality: user.municipality || 'Astrea',
      department: user.department || 'Cesar',
      tenantId: user.tenantId,
      timestamp,
      metodo: method,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 240) : 'Web Browser'
    }, { merge: true });

  } catch (error) {
    // Audit telemetry must never turn a valid Firebase login into a failed
    // login. The error is retained in the console for administrators.
    handleFirestoreError(error, OperationType.WRITE, `usuarios/${user.uid}/sesion`);
  }
}

/**
 * Authenticate with real Firebase Email & Password
 */
export async function loginWithEmailPassword(
  email: string,
  pinOrPassword: string,
  _existingUserProfile?: UserProfile
): Promise<AuthResult> {
  try {
    const cleanEmail = email.trim().toLowerCase();
    if (!pinOrPassword || pinOrPassword.length < 6) throw new Error('La contraseña debe tener al menos 6 caracteres.');
    const cred = await signInWithEmailAndPassword(auth, cleanEmail, pinOrPassword);
    const fbUser = cred.user;
    const docSnap = await getDoc(doc(db, 'usuarios', fbUser.uid));
    if (!docSnap.exists()) {
      await signOut(auth);
      throw new Error('La cuenta existe, pero todavía no tiene un perfil autorizado para esta plataforma.');
    }
    const claims = await fbUser.getIdTokenResult();
    const profile = { ...docSnap.data(), uid: fbUser.uid } as UserProfile;
    profile.role = isPlatformAdminClaims(claims.claims) ? 'AdminGlobal' : profile.role === 'AdminGlobal' ? 'Consulta' : profile.role;
    if (!isPlatformAdminClaims(claims.claims) && (profile.active !== true || profile.accessVersion !== 2)) {
      await signOut(auth);
      throw new Error('Este acceso se encuentra inactivo. Contacte al administrador de su organización.');
    }

    // Record session and write user to Firestore
    await logSessionToFirestore(profile, 'correo_password');

    return {
      success: true,
      user: profile,
      firebaseUser: fbUser
    };
  } catch (error: any) {
    console.error('Error in loginWithEmailPassword:', error);
    if (error?.code === 'permission-denied') {
      return {
        success: false,
        error: 'Firebase aceptó las credenciales, pero no permitió leer el perfil de la plataforma. Revise la base de datos configurada y los permisos del perfil; no necesita cambiar la contraseña.'
      };
    }
    return {
      success: false,
      error: error?.message || 'Error al iniciar sesión en Firebase'
    };
  }
}

/**
 * Register a new user in Firebase Auth and Firestore with strict role & hierarchy
 */
export async function registerWithEmailPassword(
  profileData: Omit<UserProfile, 'uid' | 'createdAt'> & { createdAt?: string },
  password?: string
): Promise<AuthResult> {
  try {
    const user = await createPersonalOrganization(profileData, password || '');
    await logSessionToFirestore(user, 'registro_correo');
    return { success: true, user, firebaseUser: auth.currentUser! };
  } catch (error) { return { success: false, error: accountError(error) }; }
}

/**
 * Sign in with Google Auth Popup
 */
export async function loginWithGoogle(_currentTenantId: string = 'tenant-astrea-2026'): Promise<AuthResult> {
  try {
    const cred = await signInWithPopup(auth, googleProvider);
    const fbUser = cred.user;

    // Check if user exists in Firestore
    const userRef = doc(db, 'usuarios', fbUser.uid);
    const snap = await getDoc(userRef);

    if (!snap.exists()) {
      await signOut(auth);
      return {
        success: false,
        error: 'La cuenta de Google no tiene un perfil autorizado. Solicite una invitación a su administrador.'
      };
    }

    const claims = await fbUser.getIdTokenResult();
    const profile = { ...snap.data(), uid: fbUser.uid } as UserProfile;
    profile.role = isPlatformAdminClaims(claims.claims) ? 'AdminGlobal' : profile.role === 'AdminGlobal' ? 'Consulta' : profile.role;
    if (!isPlatformAdminClaims(claims.claims) && (profile.active !== true || profile.accessVersion !== 2)) {
      await signOut(auth);
      return { success: false, error: 'Este acceso se encuentra inactivo. Contacte al administrador de su organización.' };
    }
    await logSessionToFirestore(profile, 'google_oauth');

    return {
      success: true,
      user: profile,
      firebaseUser: fbUser
    };
  } catch (error: any) {
    console.error('Google Sign In Error:', error);
    return {
      success: false,
      error: error?.message || 'Error al autenticar con Google'
    };
  }
}

export function observeAuthenticatedProfile(callback: (profile: UserProfile | null) => void): () => void {
  let version = 0;
  let unsubscribeProfile: (() => void) | undefined;
  const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
    const observedVersion = ++version;
    unsubscribeProfile?.();
    unsubscribeProfile = undefined;
    if (!firebaseUser) {
      callback(null);
      return;
    }
    try {
      const token = await firebaseUser.getIdTokenResult();
      if (version !== observedVersion) return;
      unsubscribeProfile = onSnapshot(doc(db, 'usuarios', firebaseUser.uid), { includeMetadataChanges: true }, snapshot => {
        if (version !== observedVersion) return;
        if (snapshot.metadata.hasPendingWrites) return;
        if (!snapshot.exists()) { callback(null); return; }
        const profile = { ...snapshot.data(), uid: firebaseUser.uid } as UserProfile;
        profile.role = isPlatformAdminClaims(token.claims) ? 'AdminGlobal' : profile.role === 'AdminGlobal' ? 'Consulta' : profile.role;
        callback(isPlatformAdminClaims(token.claims) || (profile.active === true && profile.accessVersion === 2) ? profile : null);
      }, () => { if (version === observedVersion) callback(null); });
    } catch {
      if (version === observedVersion) callback(null);
    }
  });
  return () => { ++version; unsubscribeProfile?.(); unsubscribeAuth(); };
}

/**
 * Sign out from Firebase Auth
 */
export async function logoutFirebaseAuth(): Promise<void> {
  try {
    await signOut(auth);
  } catch (e) {
    console.error('Sign out error:', e);
  }
}
