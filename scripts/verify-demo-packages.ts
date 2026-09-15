import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { applyDemoPackages, buildDemoPackages, CESAR_MUNICIPALITIES, DEMO_GROUPS, readDemoPackage } from '../src/data/demoPackages';

const packages = buildDemoPackages();
packages.forEach(p => readDemoPackage(JSON.parse(JSON.stringify(p))));
assert.equal(CESAR_MUNICIPALITIES.length, 25);
const full = applyDemoPackages(packages, 'test-cesar', 'Cesar');
assert.equal(full.districts.length, 25);
for (const municipality of CESAR_MUNICIPALITIES) {
  const bundle = applyDemoPackages(packages, 'test-tenant', municipality);
  assert.equal(bundle.districts.length, 1);
  assert.equal(bundle.districts[0].name, municipality);
  for (const key of DEMO_GROUPS) for (const row of bundle[key]) {
    assert.equal(row.tenantId, 'test-tenant');
    if ('municipality' in row) assert.equal(row.municipality, municipality);
    assert.ok(!('latitude' in row) && !('longitude' in row));
  }
  const confirmed = bundle.voters.filter(v => v.verified && v.supportLevel >= 4).length;
  assert.equal(bundle.leaders.reduce((sum, l) => sum + l.votesCommitted, 0), confirmed);
  assert.equal(bundle.candidates.reduce((sum, c) => sum + c.votesCommitted, 0), confirmed);
  for (const expense of bundle.expenses) assert.equal(expense.amount, expense.quantity! * expense.unitCost!);
  assert.ok(bundle.expenses.some(e => e.phase === 'Precampaña'));
  assert.ok(bundle.expenses.some(e => e.phase === 'Campaña Oficial'));
  assert.deepEqual(applyDemoPackages(packages, 'test-tenant', municipality, bundle), bundle);
}
const costs = applyDemoPackages([packages[0]], 'test', 'Astrea');
assert.equal(costs.voters.length, 0);
const both = applyDemoPackages([packages[1]], 'test', 'Astrea', costs);
assert.equal(both.expenses.length, 12);
assert.equal(both.voters.length, 64);
assert.throws(() => readDemoPackage({ format: 'ordinary-data' }));
const invalid = structuredClone(packages[0]);
invalid.records.expenses![0].amount++;
assert.throws(() => readDemoPackage(invalid));
const duplicates = structuredClone(packages[1]);
duplicates.records.voters!.push(duplicates.records.voters![0]);
assert.throws(() => readDemoPackage(duplicates));
const orphan = structuredClone(packages[1]);
orphan.records.voters![0].leaderId = 'missing';
assert.throws(() => applyDemoPackages([orphan], 'test', 'Cesar'));
assert.throws(() => applyDemoPackages(packages, 'test', 'Unknown'));

if (process.argv[2]) {
  mkdirSync(process.argv[2], { recursive: true });
  for (const p of packages) writeFileSync(join(process.argv[2], `astrea-demo-${p.packageId}.json`), JSON.stringify(p, null, 2));
}
console.log(JSON.stringify({ checks: 'PASS', municipalities: CESAR_MUNICIPALITIES.length, counts: Object.fromEntries(DEMO_GROUPS.map(key => [key, full[key].length])), documentBytes: Buffer.byteLength(JSON.stringify(full)) }));
