import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import { UserProfile } from '../types';

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

    const isAlcalde = cleanEmail.includes('alcalde');
    const isGobernador = cleanEmail.includes('gobernador');
    const isConcejal = cleanEmail.includes('concejal');
    const isTestigo = cleanEmail.includes('testigo');

    let defaultRole: any = 'Consulta';
    if (isAlcalde) defaultRole = 'Alcalde';
    else if (isGobernador) defaultRole = 'Gobernador';
    else if (isConcejal) defaultRole = 'Concejal';
    else if (isTestigo) defaultRole = 'Testigo';

    const emailAlias = cleanEmail.split('@')[0].toLowerCase();
    const derivedName = emailAlias === 'expcal'
      ? 'Wilson José Arias'
      : emailAlias
        .replace(/(alcalde|gobernador|concejal|diputado|astrea|cesar)/g, ' ')
        .replace(/[._-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/\b\w/g, l => l.toUpperCase()) || 'Perfil por completar';

    let profile: UserProfile = {
      uid: fbUser.uid,
      email: cleanEmail,
      displayName: fbUser.displayName || derivedName || 'Usuario Astrea Suite',
      prefix: 'Dr.',
      role: defaultRole,
      electoralLevel: defaultRole === 'Gobernador' ? 'Gobernación' : defaultRole === 'Concejal' ? 'Concejo Municipal' : 'Alcaldía',
      tenantId: 'tenant-astrea-2026',
      municipality: 'Astrea',
      department: 'Cesar',
      party: 'Coalición 2026',
      active: true,
      createdAt: new Date().toISOString()
    };

    try {
      const docSnap = await getDoc(doc(db, 'usuarios', fbUser.uid));
      if (docSnap.exists()) {
        profile = { uid: fbUser.uid, ...docSnap.data() } as UserProfile;
      } else {
        await setDoc(doc(db, 'usuarios', fbUser.uid), profile, { merge: true });
      }
    } catch (fsErr) {
      console.warn('Advertencia al consultar/escribir perfil en Firestore:', fsErr);
      // Even if Firestore read/write throws permission-denied due to propagation delay or rules,
      // the Firebase Auth user is authentic and we provide full session profile to prevent blocking the user
    }

    if (profile.active === false) {
      await signOut(auth);
      throw new Error('Este acceso se encuentra inactivo. Contacte al administrador de su organización.');
    }

    // Record session and write user to Firestore non-blockingly
    try {
      await logSessionToFirestore(profile, 'correo_password');
    } catch (e) {
      console.warn('No se pudo registrar la sesión en auditoría:', e);
    }

    return {
      success: true,
      user: profile,
      firebaseUser: fbUser
    };
  } catch (error: any) {
    console.error('Error in loginWithEmailPassword:', error);
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
    const cleanEmail = profileData.email.trim().toLowerCase();
    if (!password || password.length < 8) throw new Error('Use una contraseña de al menos 8 caracteres.');
    if (!profileData.tenantId) throw new Error('No se identificó la organización. Solicite un enlace de invitación válido.');
    const cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
    const fbUser = cred.user;

    const newUser: UserProfile = {
      ...profileData,
      fullName: profileData.fullName || profileData.displayName,
      uid: fbUser.uid,
      email: cleanEmail,
      requestedRole: profileData.role,
      role: 'Consulta',
      active: true,
      createdAt: new Date().toISOString()
    };

    // Create the minimum-privilege profile before recording the session.
    await setDoc(doc(db, 'usuarios', fbUser.uid), newUser);
    await logSessionToFirestore(newUser, 'registro_plataforma');

    return {
      success: true,
      user: newUser,
      firebaseUser: fbUser
    };
  } catch (error: any) {
    console.error('Error in registerWithEmailPassword:', error);
    if (error?.code === 'auth/email-already-in-use') {
      return {
        success: false,
        error: 'Este correo ya tiene una cuenta en Firebase. Inicie sesión o use la opción de recuperación de contraseña.'
      };
    }
    return {
      success: false,
      error: error?.message || 'Error al registrar usuario en Firebase'
    };
  }
}

/**
 * Sign in with Google Auth Popup
 */
export async function loginWithGoogle(currentTenantId: string = 'tenant-astrea-2026'): Promise<AuthResult> {
  try {
    const cred = await signInWithPopup(auth, googleProvider);
    const fbUser = cred.user;

    const email = fbUser.email || '';
    const displayName = fbUser.displayName || 'Usuario Google';
    const photoUrl = fbUser.photoURL || undefined;

    // Check if user exists in Firestore
    const userRef = doc(db, 'usuarios', fbUser.uid);
    const snap = await getDoc(userRef);

    let profile: UserProfile;
    if (snap.exists()) {
      profile = snap.data() as UserProfile;
    } else {
      profile = {
        uid: fbUser.uid,
        email,
        displayName,
        prefix: 'Dr.',
        role: 'Consulta',
        tenantId: currentTenantId,
        municipality: 'Astrea',
        department: 'Cesar',
        party: 'Movimiento Departamental 2026',
        avatarUrl: photoUrl,
        createdAt: new Date().toISOString()
      };
    }

    if (!snap.exists()) {
      await setDoc(userRef, profile);
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
  return onAuthStateChanged(auth, async (firebaseUser) => {
    if (!firebaseUser) {
      callback(null);
      return;
    }
    try {
      const snapshot = await getDoc(doc(db, 'usuarios', firebaseUser.uid));
      if (!snapshot.exists()) {
        callback(null);
        return;
      }
      const profile = { uid: firebaseUser.uid, ...snapshot.data() } as UserProfile;
      callback(profile.active === false ? null : profile);
    } catch {
      callback(null);
    }
  });
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
