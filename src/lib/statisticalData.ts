import { CESAR_MUNICIPALITIES } from '../data/geography';
import type { ElectoralLevel } from '../types';

export const METRICS = {
  censo: 'Censo electoral', poblacion: 'Población proyectada', poblacion_urbana: 'Población en cabecera', poblacion_rural: 'Población rural y centros poblados',
  electoras: 'Mujeres en el censo electoral', electores: 'Hombres en el censo electoral', mesas: 'Mesas de votación',
  curules: 'Curules de referencia',
  sufragantes: 'Sufragantes históricos', blancos: 'Votos en blanco', nulos: 'Votos nulos', no_marcados: 'Votos no marcados', votos_partido: 'Votos por lista o candidatura',
  poblacion_edad: 'Población por grupo de edad', pobreza_pct: 'Pobreza (%)', desempleo_pct: 'Desempleo (%)',
} as const;
export type Metric = keyof typeof METRICS;
export interface StatisticalRow {
  municipality: string;
  year: number;
  metric: Metric;
  group: string;
  value: number;
  level: string;
  source: string;
  url: string;
  referenceDate: string;
  provenance: 'oficial' | 'aportada';
}
export const CSV_HEADER = ['municipio', 'anio', 'indicador', 'grupo', 'valor', 'cargo', 'fuente', 'url', 'fecha_corte'];
export const normalizeName = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
export function safeSourceUrl(value: string) {
  try { const url = new URL(value); return url.protocol === 'https:' ? url.href : undefined; } catch { return undefined; }
}

function readCsv(text: string): string[][] {
  const separator = text.slice(0, text.indexOf('\n') < 0 ? text.length : text.indexOf('\n')).includes(';') ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [], cell = '', quoted = false;
  const input = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (char === '"') {
      if (quoted && input[i + 1] === '"') { cell += '"'; i++; } else quoted = !quoted;
    } else if (!quoted && (char === separator || char === '\n')) {
      row.push(cell); cell = '';
      if (char === '\n') { if (row.some(value => value.trim())) rows.push(row); row = []; }
    } else cell += char;
  }
  if (quoted) throw new Error('El CSV contiene comillas sin cerrar.');
  row.push(cell);
  if (row.some(value => value.trim())) rows.push(row);
  return rows;
}

export function validateRows(input: unknown, provenance: StatisticalRow['provenance'] = 'aportada'): StatisticalRow[] {
  if (!Array.isArray(input) || input.length > 20000) throw new Error('Se admiten hasta 20.000 filas agregadas por archivo.');
  const names = [...CESAR_MUNICIPALITIES, 'Cesar'];
  const levels = ['', 'Concejo Municipal', 'Alcaldía', 'Gobernación', 'Asamblea / Diputación', 'Cámara de Representantes', 'Senado de la República'];
  const seen = new Set<string>();
  return input.map((raw, index) => {
    const r = raw as StatisticalRow;
    const fail = (message: string): never => { throw new Error(`Fila ${index + 2}: ${message}`); };
    if (!r || typeof r !== 'object') fail('registro inválido.');
    const municipality = names.find(name => typeof r.municipality === 'string' && normalizeName(name) === normalizeName(r.municipality));
    if (!municipality) fail('municipio fuera del Cesar.');
    if (!Number.isInteger(r.year) || r.year < 2000 || r.year > 2042) fail('año inválido (2000–2042).');
    if (typeof r.metric !== 'string' || !Object.hasOwn(METRICS, r.metric)) fail('indicador desconocido.');
    if (!Number.isFinite(r.value) || r.value < 0 || (r.metric.endsWith('_pct') ? r.value > 100 : !Number.isSafeInteger(r.value))) fail('valor inválido; use enteros sin separadores de miles o porcentajes de 0 a 100.');
    if (typeof r.source !== 'string' || !r.source.trim() || r.source.length > 200 || !safeSourceUrl(r.url)) fail('indique una fuente y su enlace HTTPS.');
    if (typeof r.referenceDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(r.referenceDate) || new Date(`${r.referenceDate}T12:00:00Z`).toISOString().slice(0, 10) !== r.referenceDate) fail('fecha de referencia inválida (AAAA-MM-DD).');
    if (typeof r.group !== 'string' || r.group.length > 160 || !levels.includes(r.level)) fail('grupo o cargo inválido.');
    if (!['votos_partido', 'poblacion_edad'].includes(r.metric) && r.group.trim()) fail('este indicador requiere un total, sin grupo.');
    const history = ['sufragantes', 'blancos', 'nulos', 'no_marcados', 'votos_partido'].includes(r.metric);
    if (history && !r.level) fail('los resultados históricos necesitan cargo.');
    if (r.metric === 'votos_partido' && !r.group.trim()) fail('indique el partido o candidatura en grupo.');
    const key = [municipality, r.year, r.metric, r.group.trim(), r.level, r.source.trim(), safeSourceUrl(r.url), r.referenceDate].join('|');
    if (seen.has(key)) fail('registro duplicado.');
    seen.add(key);
    return { municipality, year: r.year, metric: r.metric, group: r.group.trim(), value: r.value, level: r.level, source: r.source.trim(), url: safeSourceUrl(r.url)!, referenceDate: r.referenceDate, provenance };
  });
}

export function parseStatisticalCsv(text: string): StatisticalRow[] {
  if (text.length > 5 * 1024 * 1024) throw new Error('El archivo supera 5 MB.');
  const [header, ...lines] = readCsv(text);
  if (!header || header.map(cell => cell.trim().toLowerCase()).join(',') !== CSV_HEADER.join(',')) throw new Error(`Use estas columnas, en orden: ${CSV_HEADER.join(',')}`);
  return validateRows(lines.map((line, index) => {
    if (line.length !== CSV_HEADER.length) throw new Error(`Fila ${index + 2}: faltan o sobran columnas.`);
    const [municipality, year, metric, group, value, level, source, url, referenceDate] = line.map(cell => cell.trim());
    return { municipality, year: Number(year), metric, group, value: value ? Number(value.replace(',', '.')) : NaN, level, source, url, referenceDate };
  }));
}

export function exportStatisticalCsv(rows: StatisticalRow[]) {
  const escape = (value: unknown) => `"${String(typeof value === 'string' && /^[=+@-]/.test(value) ? `'${value}` : value).replace(/"/g, '""')}"`;
  return '\uFEFF' + [CSV_HEADER, ...rows.map(row => [row.municipality, row.year, row.metric, row.group, row.value, row.level, row.source, row.url, row.referenceDate])].map(row => row.map(escape).join(',')).join('\r\n');
}

export function referenceRow(rows: StatisticalRow[], municipality: string, metric: Metric, year?: number) {
  return rows.filter(row => row.municipality === municipality && row.metric === metric && (!row.level || metric === 'curules') && (year === undefined || row.year === year))
    .sort((a, b) => b.year - a.year || b.referenceDate.localeCompare(a.referenceDate) || Number(b.provenance === 'aportada') - Number(a.provenance === 'aportada'))[0];
}

export function scopeForLevel(municipality: string, level: ElectoralLevel): string {
  return level === 'Senado de la República' ? 'Colombia' : ['Gobernación', 'Asamblea / Diputación', 'Cámara de Representantes'].includes(level) ? 'Cesar' : municipality;
}

export function historicalBaseline(rows: StatisticalRow[], municipality: string, level: ElectoralLevel, sourceKey: string) {
  const selected = rows.filter(row => row.municipality === municipality && row.level === level && historyKey(row) === sourceKey);
  const value = (metric: Metric) => selected.find(row => row.metric === metric)?.value;
  const census = value('censo'), voters = value('sufragantes'), blank = value('blancos'), nulls = value('nulos'), unmarked = value('no_marcados');
  const parties = selected.filter(row => row.metric === 'votos_partido');
  if ([census, voters, blank, nulls, unmarked].some(item => item === undefined) || !census || !voters || !parties.length) throw new Error('El histórico necesita censo, sufragantes, blancos, nulos, no_marcados y votos_partido del mismo año, cargo y fuente.');
  if (voters > census || parties.reduce((sum, row) => sum + row.value, 0) + blank! + nulls! + unmarked! !== voters) throw new Error('El histórico no concilia: listas + blancos + nulos + no marcados deben sumar sufragantes, sin exceder el censo.');
  return { census, turnout: voters / census * 100, blankPct: blank! / voters * 100, nullPct: nulls! / voters * 100, unmarkedPct: unmarked! / voters * 100, parties, source: selected[0] };
}
export const historyKey = (row: StatisticalRow) => [row.year, row.source, row.url, row.referenceDate].join('|');

export function downloadText(name: string, contents: string, type = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const link = document.createElement('a'); link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
