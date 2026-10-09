import type { IncomingMessage, ServerResponse } from 'node:http';
import { Buffer } from 'node:buffer';
import { createVerify } from 'node:crypto';
import firebaseConfig from '../firebase-applet-config.json' with { type: 'json' };

type ApiRequest = IncomingMessage & { body?: Record<string, unknown> };
type TokenPayload = {
  aud: string;
  iss: string;
  exp: number;
  iat: number;
  sub: string;
  admin?: boolean;
};

const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || firebaseConfig.projectId;
const FIRESTORE_DATABASE_ID = process.env.FIRESTORE_DATABASE_ID || firebaseConfig.firestoreDatabaseId || '(default)';
const MAX_BODY_BYTES = 32 * 1024;
let certCache: { expiresAt: number; certificates: Record<string, string> } = { expiresAt: 0, certificates: {} };
const requestBuckets = new Map<string, { count: number; resetAt: number }>();

function json(res: ServerResponse, status: number, payload: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.end(JSON.stringify(payload));
}

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

async function verifyFirebaseToken(token: string): Promise<TokenPayload> {
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
    payload.aud !== FIREBASE_PROJECT_ID
    || payload.iss !== `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`
    || typeof payload.exp !== 'number'
    || typeof payload.iat !== 'number'
    || typeof payload.sub !== 'string'
    || !Number.isFinite(payload.exp)
    || !Number.isFinite(payload.iat)
    || payload.exp <= now
    || payload.iat > now + 60
    || !payload.sub
    || payload.sub.length > 128
  ) {
    throw new Error('Token vencido o emitido para otro proyecto.');
  }
  return payload as TokenPayload;
}

async function parseBody(req: ApiRequest): Promise<Record<string, unknown>> {
  if (req.body !== undefined) {
    if (!isRecord(req.body)) throw new Error('INVALID_JSON');
    if (Buffer.byteLength(JSON.stringify(req.body)) > MAX_BODY_BYTES) throw new Error('PAYLOAD_TOO_LARGE');
    return req.body;
  }
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const data = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += data.length;
    if (total > MAX_BODY_BYTES) throw new Error('PAYLOAD_TOO_LARGE');
    chunks.push(data);
  }
  if (!chunks.length) return {};
  try {
    const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!isRecord(parsed)) throw new Error('INVALID_JSON');
    return parsed;
  } catch {
    throw new Error('INVALID_JSON');
  }
}

function cleanText(value: unknown, fallback: string, maxLength = 500): string {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim().replace(/[\u0000-\u001f\u007f]/g, ' ');
  return normalized ? normalized.slice(0, maxLength) : fallback;
}

async function generate(prompt: string) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('AI_SERVICE_UNAVAILABLE');
  const { GoogleGenAI } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey, httpOptions: { timeout: 30_000 } });
  const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
  if (!response.text?.trim()) throw new Error('EMPTY_AI_RESPONSE');
  return response.text;
}

// Firestore evaluates the same tenant rules as the browser, using the caller's
// Firebase ID token. This works without a shared privileged server credential.
async function readAuthorizedDocument(path: string, token: string): Promise<Record<string, unknown> | null> {
  const response = await fetch(`https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/${encodeURIComponent(FIRESTORE_DATABASE_ID)}/documents/${path}`, {
    headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10_000)
  });
  if (response.status === 403 || response.status === 404) return null;
  if (!response.ok) throw new Error('IDENTITY_SERVICE_UNAVAILABLE');
  const document = await response.json() as { fields?: Record<string, { stringValue?: string; booleanValue?: boolean }> };
  return Object.fromEntries(Object.entries(document.fields || {}).map(([key, value]) => [key, value.stringValue ?? value.booleanValue]));
}

async function authorizeOrganization(user: TokenPayload, token: string, body: Record<string, unknown>) {
  const profile = await readAuthorizedDocument(`usuarios/${encodeURIComponent(user.sub)}`, token);
  if (!profile || profile.active === false || typeof profile.tenantId !== 'string') return null;
  const permittedRoles = ['AdminTenant', 'Gobernador', 'Diputado', 'Alcalde', 'JefePolitico'];
  if (!user.admin && !permittedRoles.includes(String(profile.role))) return null;
  const tenantId = typeof body.tenantId === 'string' ? body.tenantId : profile.tenantId;
  if (!tenantId || (!user.admin && tenantId !== profile.tenantId)) return null;
  const tenant = await readAuthorizedDocument(`organizaciones/${encodeURIComponent(tenantId)}`, token);
  return tenant?.active === true && typeof tenant.name === 'string' ? tenant : null;
}

function enforceRateLimit(subject: string): boolean {
  const now = Date.now();
  if (requestBuckets.size > 1_000) {
    for (const [key, bucket] of requestBuckets) {
      if (bucket.resetAt <= now) requestBuckets.delete(key);
    }
  }
  const existing = requestBuckets.get(subject);
  const bucket = !existing || existing.resetAt <= now ? { count: 0, resetAt: now + 60_000 } : existing;
  bucket.count += 1;
  requestBuckets.set(subject, bucket);
  return bucket.count <= 40;
}

async function authorize(req: ApiRequest, res: ServerResponse) {
  const authorization = req.headers.authorization || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!token) {
    json(res, 401, { success: false, error: 'Autenticación requerida.' });
    return null;
  }
  try {
    const user = await verifyFirebaseToken(token);
    const key = String(user.sub);
    if (!enforceRateLimit(key)) {
      json(res, 429, { success: false, error: 'Límite temporal de solicitudes alcanzado.' });
      return null;
    }
    return user;
  } catch {
    json(res, 401, { success: false, error: 'La sesión no es válida o expiró.' });
    return null;
  }
}

export default async function handler(req: ApiRequest, res: ServerResponse) {
  const pathname = new URL(req.url || '/', 'https://astrea.local').pathname;

  if (req.method === 'GET' && pathname === '/api/health') {
    return json(res, 200, { status: 'ok', service: 'Astrea Suite Electoral API', timestamp: new Date().toISOString() });
  }
  if (!pathname.startsWith('/api/')) return json(res, 404, { success: false, error: 'Ruta no encontrada.' });
  const routes = ['/api/ai/analyze-document', '/api/ai/generate-speech', '/api/ai/electoral-strategy'];
  if (!routes.includes(pathname)) return json(res, 404, { success: false, error: 'Ruta no encontrada.' });
  const user = await authorize(req, res);
  if (!user) return;

  if (req.method === 'GET' && pathname.endsWith('/drive/scan')) {
    return json(res, 501, { success: false, error: 'Conecte Google Workspace desde el módulo Integraciones para acceder al Drive de esta organización.' });
  }
  if (req.method !== 'POST') return json(res, 405, { success: false, error: 'Método no permitido.' });
  if (!String(req.headers['content-type'] || '').toLowerCase().startsWith('application/json')) {
    return json(res, 415, { success: false, error: 'Se requiere contenido JSON.' });
  }

  try {
    const body = await parseBody(req);
    const token = req.headers.authorization!.slice(7);
    const tenant = await authorizeOrganization(user, token, body);
    if (!tenant) return json(res, 403, { success: false, error: 'Su perfil no tiene autorización para esta organización o el servicio de IA.' });
    const tenantName = cleanText(tenant.name, 'la organización');

    if (pathname.endsWith('/ai/analyze-document')) {
      const fileName = cleanText(body.fileName, 'Documentación general');
      const category = cleanText(body.category, 'Estrategia', 120);
      const promptText = cleanText(body.promptText, 'Proporciona un análisis ejecutivo basado únicamente en la información suministrada.', 3000);
      const analysis = await generate(`Eres un analista estratégico para ${tenantName}. Analiza: ${fileName}. Categoría: ${category}. Consulta: ${promptText}. No inventes cifras, fuentes ni hechos. Distingue datos observados, supuestos y recomendaciones. Entrega: resumen ejecutivo, puntos clave, oportunidades y riesgos, y acciones sugeridas.`);
      return json(res, 200, { success: true, analysis });
    }
    if (pathname.endsWith('/ai/generate-speech')) {
      const candidateName = cleanText(body.candidateName, 'la candidatura');
      const district = cleanText(body.district, 'el territorio', 160);
      const chamber = cleanText(body.chamber, 'cargo electoral', 120);
      const topic = cleanText(body.topic, 'prioridades ciudadanas', 800);
      const tone = cleanText(body.tone, 'claro, responsable y cercano', 160);
      const speech = await generate(`Redacta para ${tenantName} un discurso de ${candidateName}, aspirante a ${chamber} por ${district}, sobre ${topic}, con tono ${tone}. No inventes logros, cifras ni compromisos. Evita ataques y afirmaciones engañosas. Incluye apertura, diagnóstico, propuestas y llamado a la acción.`);
      return json(res, 200, { success: true, speech });
    }
    if (pathname.endsWith('/ai/electoral-strategy')) {
      const districtName = cleanText(body.districtName, 'el territorio', 160);
      const competitorStrength = cleanText(body.competitorStrength, 'sin datos suficientes', 160);
      const issues = Array.isArray(body.keyIssues)
        ? body.keyIssues.slice(0, 12).map(item => cleanText(item, '', 120)).filter(Boolean)
        : [cleanText(body.keyIssues, 'Sin prioridades registradas', 500)];
      const strategy = await generate(`Diseña para ${tenantName} un plan para ${districtName}. Prioridades registradas: ${issues.join(', ')}. Competencia: ${competitorStrength}. Fundamenta cada recomendación en estos datos y marca la evidencia faltante. Entrega posicionamiento, despliegue territorial, estrategia digital y KPI medibles.`);
      return json(res, 200, { success: true, strategy });
    }
    return json(res, 404, { success: false, error: 'Ruta no encontrada.' });
  } catch (error) {
    if (error instanceof Error && error.message === 'PAYLOAD_TOO_LARGE') return json(res, 413, { success: false, error: 'Solicitud demasiado grande.' });
    if (error instanceof Error && error.message === 'INVALID_JSON') return json(res, 400, { success: false, error: 'JSON inválido.' });
    if (error instanceof Error && error.message === 'IDENTITY_SERVICE_UNAVAILABLE') return json(res, 503, { success: false, error: 'No fue posible verificar los permisos. Intente más tarde.' });
    console.error('Astrea API error:', error);
    if (error instanceof Error && error.message === 'AI_SERVICE_UNAVAILABLE') {
      return json(res, 503, { success: false, error: 'El servicio de IA no está disponible. Intente más tarde.' });
    }
    return json(res, 502, { success: false, error: 'No fue posible completar la solicitud de IA. Intente más tarde.' });
  }
}
