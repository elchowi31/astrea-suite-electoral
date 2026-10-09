import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CSV_HEADER, exportStatisticalCsv, historicalBaseline, historyKey, parseStatisticalCsv, referenceRow, scopeForLevel, validateRows } from '../src/lib/statisticalData';

const official = validateRows(JSON.parse(readFileSync(new URL('../src/data/cesarStatistics.json', import.meta.url), 'utf8')), 'oficial');
test('official snapshot covers 25 municipalities and reconciles census and population', () => {
  const census = official.filter(row => row.metric === 'censo' && row.municipality !== 'Cesar');
  assert.equal(census.length, 25);
  assert.equal(census.reduce((sum, row) => sum + row.value, 0), referenceRow(official, 'Cesar', 'censo')?.value);
  assert.equal(referenceRow(official, 'Astrea', 'censo')?.value, 17189);
  for (const row of census) {
    assert.equal(referenceRow(official, row.municipality, 'electoras')!.value + referenceRow(official, row.municipality, 'electores')!.value, row.value);
    for (const year of [2023, 2026, 2027]) assert.equal(referenceRow(official, row.municipality, 'poblacion_urbana', year)!.value + referenceRow(official, row.municipality, 'poblacion_rural', year)!.value, referenceRow(official, row.municipality, 'poblacion', year)!.value);
  }
  assert.equal(scopeForLevel('Astrea', 'Gobernación'), 'Cesar');
  assert.equal(scopeForLevel('Astrea', 'Concejo Municipal'), 'Astrea');
});
test('CSV handles quoted commas, accents, semicolons, decimal percentages and missing values', () => {
  const rows = official.filter(row => row.municipality === 'Astrea');
  assert.equal(parseStatisticalCsv(exportStatisticalCsv(rows)).length, rows.length);
  const csv = CSV_HEADER.join(';') + '\nAstrea;2026;pobreza_pct;;"23,4";;"Fuente, prueba";https://example.com;2026-03-08';
  const parsed = parseStatisticalCsv(csv);
  assert.equal(parsed[0].value, 23.4);
  assert.equal(parsed[0].provenance, 'aportada');
  assert.throws(() => parseStatisticalCsv(csv.replace('"23,4"', '')), /valor inválido/);
  assert.throws(() => parseStatisticalCsv(csv.replace('https://example.com', 'javascript:alert(1)')), /HTTPS/);
  assert.throws(() => validateRows([rows[0], rows[0]]), /duplicado/);
});
test('historical baseline requires the same contest and complete reconciled totals', () => {
  const prototype = { ...official[0], municipality: 'Astrea', year: 2023, level: 'Alcaldía', source: 'Escrutinio de prueba', referenceDate: '2023-10-29', group: '' };
  const rows = validateRows([['censo', 1000], ['sufragantes', 600], ['blancos', 20], ['nulos', 10], ['no_marcados', 5], ['votos_partido', 565]].map(([metric, value]) => ({ ...prototype, metric, value, group: metric === 'votos_partido' ? 'Lista A' : '' })));
  const key = historyKey(rows[0]);
  assert.equal(historicalBaseline(rows, 'Astrea', 'Alcaldía', key).turnout, 60);
  assert.throws(() => historicalBaseline(rows.slice(1), 'Astrea', 'Alcaldía', key), /necesita/);
  assert.throws(() => historicalBaseline(rows, 'Astrea', 'Concejo Municipal', key), /necesita/);
  assert.throws(() => historicalBaseline(rows.map(row => row.metric === 'sufragantes' ? { ...row, value: 601 } : row), 'Astrea', 'Alcaldía', key), /no concilia/);
});
