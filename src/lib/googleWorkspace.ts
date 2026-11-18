import { exportSheetValues } from './googleSheetsExport';
import { workspaceTokenCache } from './workspaceSession';
import {
  signInWithPopup,
  initializeAuth,
  inMemoryPersistence,
  browserPopupRedirectResolver,
  signOut,
  type Auth,
  GoogleAuthProvider,
  User,
  onAuthStateChanged,
} from 'firebase/auth';
import { auth, app } from './firebase';
import { initializeApp, getApps } from 'firebase/app';
import { workspaceApi } from './workspaceApi';

export const WORKSPACE_SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/forms.body',
  'https://www.googleapis.com/auth/forms.responses.readonly',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.calendarlist.readonly',
];

const provider = new GoogleAuthProvider();
WORKSPACE_SCOPES.forEach((scope) => provider.addScope(scope));

const tokenCache = workspaceTokenCache();
export const setWorkspaceScope = (scope: string) => tokenCache.setScope(scope);
let isSigningIn = false;
let workspaceAuth: Auth | undefined;
export const getWorkspaceAccount = () =>
  tokenCache.account(auth.currentUser?.uid || null);
export function currentWorkspaceApi() {
  const token = getWorkspaceAccessToken();
  if (!token)
    throw Error('Vincule la cuenta de Google que utilizará para este espacio.');
  return workspaceApi(token, () => assertWorkspaceToken(token));
}

export const initGoogleWorkspaceAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void,
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      const cachedAccessToken = tokenCache.get(user.uid);
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        // Token might need user interaction or popup
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      tokenCache.clear();
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const signInWithGoogleWorkspace = async (): Promise<{
  user: User;
  accessToken: string;
} | null> => {
  try {
    isSigningIn = true;
    if (!auth.currentUser)
      throw new Error('Inicie sesión antes de conectar Google Workspace.');
    const owner = auth.currentUser.uid,
      scope = tokenCache.scope();
    // A separate, memory-only Auth instance permits selecting a Google account
    // without replacing the platform's authenticated user or permissions.
    if (!workspaceAuth) {
      const secondary =
        getApps().find((item) => item.name === 'astrea-workspace-oauth') ||
        initializeApp(app.options, 'astrea-workspace-oauth');
      workspaceAuth = initializeAuth(secondary, {
        persistence: inMemoryPersistence,
      });
    }
    provider.setCustomParameters({ prompt: 'select_account' });
    const result = await signInWithPopup(
      workspaceAuth,
      provider,
      browserPopupRedirectResolver,
    );
    if (auth.currentUser?.uid !== owner || tokenCache.scope() !== scope)
      throw new Error(
        'La cuenta u organización cambió durante la conexión de Google.',
      );
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error(
        'No se pudo obtener el token de acceso de Google Workspace.',
      );
    }

    tokenCache.save(credential.accessToken, owner, scope, {
      email: result.user.email || 'Cuenta de Google',
      googleUid: result.user.uid,
    });
    return { user: auth.currentUser, accessToken: credential.accessToken };
  } catch (error: any) {
    console.error('Conexión de Google no completada.');
    throw error;
  } finally {
    if (workspaceAuth) await signOut(workspaceAuth).catch(() => {});
    isSigningIn = false;
  }
};

export const getWorkspaceAccessToken = (): string | null => {
  return tokenCache.get(auth.currentUser?.uid || null);
};

export const logoutGoogleWorkspace = async () => {
  tokenCache.clear();
};

// ==========================================
// GOOGLE SHEETS API v4 INTEGRATION
// ==========================================
export interface SheetRowData {
  [key: string]: any;
}

function assertWorkspaceToken(token: string) {
  if (!token || token !== getWorkspaceAccessToken())
    throw new Error(
      'Vuelva a conectar Google Workspace con su cuenta y organización actuales.',
    );
}
export async function exportCampaignToGoogleSheets(
  title: string,
  headers: string[],
  rows: (string | number)[][],
  token: string,
) {
  assertWorkspaceToken(token);
  return exportSheetValues(title, headers, rows, token);
}

export async function readGoogleSheetValues(
  spreadsheetId: string,
  range: string,
  accessToken: string,
): Promise<any[][]> {
  assertWorkspaceToken(accessToken);
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  if (!res.ok) {
    const err = await res.json();
    throw new Error(
      `Error al leer Google Sheet: ${err?.error?.message || res.statusText}`,
    );
  }

  const data = await res.json();
  return data.values || [];
}
