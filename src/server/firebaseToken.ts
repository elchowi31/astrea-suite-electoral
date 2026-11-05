import { Buffer } from 'node:buffer';
import { createVerify } from 'node:crypto';

export type TokenPayload = {
  aud: string;
  iss: string;
  exp: number;
  iat: number;
  auth_time: number;
  sub: string;
  admin?: boolean;
  email?: string;
  email_verified?: boolean;
};

let certCache: { expiresAt: number; certificates: Record<string, string> } = { expiresAt: 0, certificates: {} };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function decodeBase64Url(value: string) {
  return Buffer.from(value.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

async function firebaseCertificates(): Promise<Record<string, string>> {
  if (certCache.expiresAt > Date.now()) return certCache.certificates;
  const response = await fetch('https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com', { signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error('No fue posible validar la identidad.');
  const certificates = await response.json() as Record<string, string>;
  const maxAge = Number((response.headers.get('cache-control') || '').match(/max-age=(\d+)/)?.[1] || 1800);
  certCache = { certificates, expiresAt: Date.now() + maxAge * 1000 };
  return certificates;
}

export async function verifyFirebaseToken(token: string, projectId: string): Promise<TokenPayload> {
  const parts = token.split('.');
  if (parts.length !== 3 || token.length > 8192) throw new Error('Token inválido.');
  const header: unknown = JSON.parse(decodeBase64Url(parts[0]).toString('utf8'));
  const payload: unknown = JSON.parse(decodeBase64Url(parts[1]).toString('utf8'));
  if (!isRecord(header) || !isRecord(payload)) throw new Error('Token inválido.');
  if (header.alg !== 'RS256' || typeof header.kid !== 'string' || !header.kid) throw new Error('Token no admitido.');
  const certificate = (await firebaseCertificates())[header.kid];
  if (!certificate) throw new Error('Firma desconocida.');
  const verifier = createVerify('RSA-SHA256');
  verifier.update(`${parts[0]}.${parts[1]}`);
  verifier.end();
  if (!verifier.verify(certificate, decodeBase64Url(parts[2]))) throw new Error('Firma inválida.');
  const now = Math.floor(Date.now() / 1000);
  if (
    payload.aud !== projectId
    || payload.iss !== `https://securetoken.google.com/${projectId}`
    || typeof payload.exp !== 'number'
    || typeof payload.iat !== 'number'
    || typeof payload.auth_time !== 'number'
    || !Number.isFinite(payload.auth_time)
    || payload.auth_time < 0
    || payload.auth_time > now
    || typeof payload.sub !== 'string'
    || !Number.isFinite(payload.exp)
    || !Number.isFinite(payload.iat)
    || payload.exp <= now
    || payload.iat < 0
    || payload.iat > now
    || !payload.sub
    || payload.sub.length > 128
  ) {
    throw new Error('Token vencido o emitido para otro proyecto.');
  }
  return payload as TokenPayload;
}

