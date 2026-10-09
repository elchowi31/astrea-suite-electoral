import { test } from 'node:test';
import assert from 'node:assert/strict';
import { omitUndefined } from '../src/lib/serialization.ts';
import { generarIdDocumentoLegible } from '../src/lib/slugify.ts';

test('optional fields cannot break Firestore writes and zero/false remain intact', () => {
  const input = { notes: undefined, amount: 0, consent: false, nested: { missing: undefined, name: 'a' }, rows: [undefined, { missing: undefined, valid: true }] };
  assert.deepEqual(omitUndefined(input), { amount: 0, consent: false, nested: { name: 'a' }, rows: [null, { valid: true }] });
  assert('notes' in input);
});
test('repeated Spanish names produce readable, collision-resistant identifiers', () => {
  const ids = new Set(Array.from({ length: 1000 }, () => generarIdDocumentoLegible('lider', 'María José', 'Astrea')));
  assert.equal(ids.size, 1000);
  for (const id of ids) assert.match(id, /^lider-maria-jose-astrea-[0-9a-f-]+$/);
});
