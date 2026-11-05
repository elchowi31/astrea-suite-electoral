// Treat imported/user-entered strings as data; never execute them as formulas.
export async function exportSheetValues(
  title: string,
  headers: string[],
  rows: (string | number)[][],
  accessToken: string,
  request: typeof fetch = fetch
): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> {
  // 1. Create new spreadsheet
  const createRes = await request('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: {
        title: title,
      },
      sheets: [
        {
          properties: {
            title: 'Reporte Oficial Campaña',
            gridProperties: {
              frozenRowCount: 1,
            },
          },
        },
      ],
    }),
  });

  if (!createRes.ok) {
    const err = await createRes.json();
    throw new Error(`Error al crear Google Sheet: ${err?.error?.message || createRes.statusText}`);
  }

  const sheetData = await createRes.json();
  const spreadsheetId = sheetData.spreadsheetId;
  const spreadsheetUrl = sheetData.spreadsheetUrl;

  // 2. Append headers and rows
  const allValues = [headers, ...rows];
  const appendRes = await request(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/A1:append?valueInputOption=RAW`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: allValues,
      }),
    }
  );

  if (!appendRes.ok) {
    const err = await appendRes.json();
    throw new Error(`Error al insertar datos en Google Sheet: ${err?.error?.message || appendRes.statusText}`);
  }

  return { spreadsheetId, spreadsheetUrl };
}


