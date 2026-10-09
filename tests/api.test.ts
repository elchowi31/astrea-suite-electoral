import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import { generateKeyPairSync, sign } from 'node:crypto';
import handler from '../api/index.ts';
import firebaseConfig from '../firebase-applet-config.json';

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const nativeFetch = globalThis.fetch;
let server: Server;
let base: string;
let active = true;
let role = 'AdminTenant';
let tenantActive = true;
let profileExists = true;
const geminiKey = process.env.GEMINI_API_KEY;

function token(extra: Record<string, unknown> = {}) {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'astrea-test-key' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    sub: 'authorized-user', aud: 'gen-lang-client-0498782352',
    iss: 'https://securetoken.google.com/gen-lang-client-0498782352',
    exp: now + 3600, iat: now, ...extra
  })).toString('base64url');
  const content = `${header}.${payload}`;
  return `${content}.${sign('RSA-SHA256', Buffer.from(content), privateKey).toString('base64url')}`;
}

before(async () => {
  delete process.env.GEMINI_API_KEY;
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.startsWith('https://www.googleapis.com/robot/')) {
      return new Response(JSON.stringify({ 'astrea-test-key': publicKey.export({ format: 'pem', type: 'spki' }) }), { headers: { 'cache-control': 'max-age=3600' } });
    }
    if (url.includes('firestore.googleapis.com')) {
      assert(url.includes(`/databases/${encodeURIComponent(firebaseConfig.firestoreDatabaseId)}/documents/`), 'API must use the same named Firestore database as the client');
      if (url.includes('/usuarios/')) {
        if (!profileExists) return new Response('{}', { status: 404 });
        return new Response(JSON.stringify({ fields: { tenantId: { stringValue: 'tenant-a' }, role: { stringValue: role }, active: { booleanValue: active }, accessVersion: { integerValue: '2' } } }));
      }
      if (url.endsWith('/organizaciones/tenant-a')) {
        return new Response(JSON.stringify({ fields: { name: { stringValue: 'Authorized organization' }, active: { booleanValue: tenantActive } } }));
      }
      return new Response('{}', { status: 403 });
    }
    return nativeFetch(input, init);
  };
  server = createServer((req, res) => { void handler(req, res); });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert(address && typeof address !== 'string');
  base = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  globalThis.fetch = nativeFetch;
  if (geminiKey === undefined) delete process.env.GEMINI_API_KEY;
  else process.env.GEMINI_API_KEY = geminiKey;
  server.closeAllConnections();
  await new Promise<void>(resolve => server.close(() => resolve()));
});

async function request(body: unknown = {}, authorization = token(), contentType = 'application/json') {
  return nativeFetch(`${base}/api/ai/analyze-document`, {
    method: 'POST', headers: { Authorization: `Bearer ${authorization}`, 'Content-Type': contentType },
    body: typeof body === 'string' ? body : JSON.stringify(body)
  });
}

test('health is public; unknown paths cannot masquerade as health or AI', async () => {
  assert.equal((await nativeFetch(`${base}/api/health`)).status, 200);
  assert.equal((await nativeFetch(`${base}/api/nested/health`)).status, 404);
  assert.equal((await nativeFetch(`${base}/api/nested/ai/analyze-document`)).status, 404);
});
test('AI rejects absent, forged, expired and incomplete Firebase tokens', async () => {
  assert.equal((await nativeFetch(`${base}/api/ai/analyze-document`, { method: 'POST' })).status, 401);
  assert.equal((await request({}, 'forged')).status, 401);
  assert.equal((await request({}, token({ exp: 0 }))).status, 401);
  assert.equal((await request({}, token({ exp: undefined }))).status, 401);
  assert.equal((await request({}, token({ iat: undefined }))).status, 401);
  assert.equal((await request({}, token({ aud: 'different-project' }))).status, 401);
  assert.equal((await request({}, token({ sub: 'x'.repeat(129) }))).status, 401);
});
test('inactive, unprovisioned and read-only accounts cannot spend AI quota', async () => {
  active = false; assert.equal((await request()).status, 403); active = true;
  profileExists = false; assert.equal((await request()).status, 403); profileExists = true;
  role = 'Consulta'; assert.equal((await request()).status, 403); role = 'AdminTenant';
});
test('tenant isolation and disabled organizations are enforced on the API', async () => {
  assert.equal((await request({ tenantId: 'tenant-b' })).status, 403);
  tenantActive = false; assert.equal((await request()).status, 403); tenantActive = true;
});
test('invalid JSON, arrays, null, oversized bodies and non-JSON input are rejected', async () => {
  assert.equal((await request('{')).status, 400);
  assert.equal((await request([])).status, 400);
  assert.equal((await request(null)).status, 400);
  assert.equal((await request({ promptText: 'a'.repeat(33000) })).status, 413);
  assert.equal((await request('{}', token(), 'text/plain')).status, 415);
});
test('authorized requests report missing AI configuration without exposing secrets', async () => {
  const response = await request({ tenantId: 'tenant-a' });
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert(!JSON.stringify(await response.json()).includes('GEMINI_API_KEY'));
});
test('rate limiting rejects excess requests from a single authenticated user', async () => {
  let status = 0;
  for (let i = 0; i < 42; i++) status = (await request({}, token({ sub: 'quota-test-user' }))).status;
  assert.equal(status, 429);
});
