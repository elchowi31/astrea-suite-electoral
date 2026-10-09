export const PLATFORM_OWNER_EMAIL = 'expcal@expcal.net';
/** Only claims from a signature-verified Firebase ID token may be passed here. */
export function isPlatformAdminClaims(claims: Record<string, unknown>): boolean {
  return claims.admin === true || (claims.email === PLATFORM_OWNER_EMAIL && claims.email_verified === true);
}
