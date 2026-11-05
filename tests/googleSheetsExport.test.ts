import { test } from 'node:test';
import assert from 'node:assert/strict';
import { exportSheetValues } from '../src/lib/googleSheetsExport.ts';

test('Sheets exports untrusted formulas and identifiers as literal data and preserves numeric amounts', async () => {
  const calls: { url: URL; body: any }[] = [];
  const request: typeof fetch = async (input, init) => {
    calls.push({ url: new URL(String(input)), body: JSON.parse(String(init?.body)) });
    return Response.json(calls.length === 1
      ? { spreadsheetId: 'sheet-test', spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/sheet-test' }
      : { updates: { updatedRows: 3 } });
  };
  const headers = ['Referencia', 'Importe'];
  const rows: (string | number)[][] = [['=1+2', 0], ['001234', 125000.5]];
  const result = await exportSheetValues('Control administrativo', headers, rows, 'fake-token', request);
  assert.equal(calls.length, 2);
  assert.equal(calls[1].url.searchParams.get('valueInputOption'), 'RAW');
  assert.deepEqual(calls[1].body.values, [headers, ...rows]);
  assert.equal(typeof calls[1].body.values[2][1], 'number');
  assert.equal(result.spreadsheetId, 'sheet-test');
});

test('Sheets reports creation failure without attempting to append data', async () => {
  let calls = 0;
  const request: typeof fetch = async () => {
    calls++;
    return Response.json({ error: { message: 'Permiso denegado' } }, { status: 403 });
  };
  await assert.rejects(exportSheetValues('Informe', ['Dato'], [], 'fake-token', request), /Permiso denegado/);
  assert.equal(calls, 1);
});

test('Sheets does not claim success if the document exists but its data failed to save', async () => {
  let calls = 0;
  const request: typeof fetch = async () => ++calls === 1
    ? Response.json({ spreadsheetId: 'sheet-test', spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/sheet-test' })
    : Response.json({ error: { message: 'Cuota agotada' } }, { status: 429 });
  await assert.rejects(exportSheetValues('Informe', ['Dato'], [[1]], 'fake-token', request), /Cuota agotada/);
});
