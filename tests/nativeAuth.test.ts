import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNativeTokenProvider } from '../src/lib/nativeAuth';

test('Long background routes renew over native HTTP, share concurrent requests and use rotated refresh tokens', async () => {
  let time = 0, calls = 0;
  const bodies: string[] = [];
  const user = { uid: 'u1', refreshToken: 'first+credential' };
  const token = createNativeTokenProvider({ post: async options => {
    calls++; bodies.push(options.data);
    assert.equal(options.url, 'https://securetoken.googleapis.com/v1/token?key=test-key');
    assert.equal(options.headers?.['Content-Type'], 'application/x-www-form-urlencoded');
    await Promise.resolve();
    return { status: 200, headers: {}, url: options.url, data: { user_id: 'u1', id_token: `token-${calls}`, refresh_token: 'rotated/credential', expires_in: '3600' } };
  } }, () => time);
  assert.deepEqual(await Promise.all([token(user, 'test-key'), token(user, 'test-key')]), ['token-1', 'token-1']);
  assert.equal(calls, 1);assert.ok(bodies[0].endsWith('first%2Bcredential'));
  time = 30 * 60_000;assert.equal(await token(user, 'test-key'), 'token-1');assert.equal(calls, 1);
  time = 60 * 60_000;assert.equal(await token(user, 'test-key'), 'token-2');assert.equal(calls, 2);
  assert.ok(bodies[1].endsWith('rotated%2Fcredential'));
  user.refreshToken = 'new-login';await token(user, 'test-key');assert.equal(calls, 3);assert.ok(bodies[2].endsWith('new-login'));
});

test('A rejected or mismatched renewal never exposes credentials or acknowledges a sample', async () => {
  let calls = 0;
  const token = createNativeTokenProvider({ post: async options => {
    calls++;
    return { status: calls < 3 ? 400 : 200, headers: {}, url: options.url, data: { id_token: 'private-token', user_id: 'another-user', refresh_token: 'private-refresh', expires_in: '3600' } };
  } });
  const user = { uid: 'u1', refreshToken: 'private-refresh' };
  for (let attempt = 0; attempt < 2; attempt++) await assert.rejects(token(user, 'test-key'), error => {
    assert.match((error as Error).message, /HTTP 400/);assert.doesNotMatch((error as Error).message, /private/);return true;
  });
  await assert.rejects(token(user, 'test-key'), /validar la sesión/);
  assert.equal(calls, 3, 'failed renewals can be retried');
});
