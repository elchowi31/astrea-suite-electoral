export class AuthDeadlineError extends Error {
  readonly code = 'astrea/auth-timeout';
  constructor() { super('La conexión está tardando demasiado. Revise internet y vuelva a intentar el ingreso.'); }
}

/** Limita la espera de red; no interpreta un tiempo agotado como contraseña incorrecta. */
export async function authWithDeadline<T>(operation: Promise<T>, milliseconds = 25000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([operation,new Promise<never>((_,reject)=>{
      timer = setTimeout(()=>reject(new AuthDeadlineError()),milliseconds);
    })]);
  } finally { clearTimeout(timer); }
}

export function authErrorMessage(error: unknown): string {
  const code=(error as {code?:string})?.code;
  if (['auth/invalid-credential','auth/invalid-login-credentials','auth/wrong-password','auth/user-not-found'].includes(code || ''))
    return 'El correo o la contraseña son incorrectos. Revise lo digitado; puede usar «Mostrar» para comprobar la contraseña.';
  if (code==='auth/invalid-email') return 'Revise el formato del correo electrónico.';
  if (code==='auth/too-many-requests') return 'Hubo demasiados intentos de ingreso. Espere unos minutos antes de intentar nuevamente.';
  if (code==='auth/network-request-failed') return 'No se pudo conectar para iniciar sesión. Revise internet y vuelva a intentarlo.';
  if (code==='auth/popup-closed-by-user' || code==='auth/cancelled-popup-request') return 'El acceso con Google no se completó. Puede intentarlo nuevamente o ingresar con correo y contraseña.';
  if (code==='auth/popup-blocked') return 'El navegador bloqueó la ventana de Google. Permita la ventana de acceso o use correo y contraseña.';
  return error instanceof Error ? error.message : 'No se pudo iniciar sesión. Vuelva a intentarlo.';
}
