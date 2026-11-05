import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { verifyFirebaseToken } from '../src/server/firebaseToken.ts';

const project = 'demo-security-audit';
const keys = generateKeyPairSync('rsa', { modulusLength: 2048 });
const otherKeys = generateKeyPairSync('rsa', { modulusLength: 2048 });
const originalFetch = globalThis.fetch;
let certificateFetches = 0;
globalThis.fetch = async (input) => {
  assert.equal(String(input), 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com');
  certificateFetches++;
  return Response.json({ 'audit-key': keys.publicKey.export({ format: 'pem', type: 'spki' }) }, { headers: { 'cache-control': 'max-age=3600' } });
};
after(() => { globalThis.fetch = originalFetch; });

function token(claims: Record<string, unknown> = {}, header: Record<string, unknown> = {}, privateKey = keys.privateKey) {
  const now = Math.floor(Date.now() / 1000);
  const parts = [
    { alg: 'RS256', kid: 'audit-key', ...header },
    { sub: 'test-account', aud: project, iss: `https://securetoken.google.com/${project}`, exp: now + 3600, iat: now, auth_time: now - 60, ...claims }
  ].map(item => Buffer.from(JSON.stringify(item)).toString('base64url'));
  const data = parts.join('.');
  return `${data}.${sign('RSA-SHA256', Buffer.from(data), privateKey).toString('base64url')}`;
}

test('valid signed Firebase token retains its user identity and caches certificates', async () => {
  assert.equal((await verifyFirebaseToken(token(), project)).sub, 'test-account');
  await verifyFirebaseToken(token(), project);
  assert.equal(certificateFetches, 1);
});

test('rejects missing, future, negative and nonnumeric authentication times', async () => {
  for (const auth_time of [undefined, null, '1', -1, Math.floor(Date.now() / 1000) + 600]) {
    await assert.rejects(verifyFirebaseToken(token({ auth_time }), project));
  }
});

test('rejects expired, future-issued, wrong-project and invalid-subject tokens', async () => {
  for (const claims of [
    { exp: 0 }, { iat: Math.floor(Date.now() / 1000) + 600 }, { iat: -1 },
    { aud: 'other-project' }, { iss: 'https://attacker.invalid' }, { sub: '' }, { sub: 'x'.repeat(129) }
  ]) await assert.rejects(verifyFirebaseToken(token(claims), project));
});

test('rejects forged signatures, unsupported algorithms, unknown keys and malformed tokens', async () => {
  await assert.rejects(verifyFirebaseToken(token({}, {}, otherKeys.privateKey), project));
  await assert.rejects(verifyFirebaseToken(token({}, { alg: 'none' }), project));
  await assert.rejects(verifyFirebaseToken(token({}, { kid: 'unknown' }), project));
  for (const value of ['', 'a.b', 'a.b.c', 'x'.repeat(8193)]) await assert.rejects(verifyFirebaseToken(value, project));
});
