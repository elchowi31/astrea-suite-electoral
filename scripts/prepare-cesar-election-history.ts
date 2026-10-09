import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { CESAR_MUNICIPALITIES } from '../src/data/geography';
import { historicalBaseline, historyKey, normalizeName, validateRows, type StatisticalRow } from '../src/lib/statisticalData';

const root = 'https://resultadosprec2023.registraduria.gov.co';
const cache = '.data-cache/election2023';
await mkdir(cache, { recursive: true });
async function download(path: string) {
  const file = `${cache}/${path.replaceAll('/', '_')}`;
  let raw = '';
  try { raw = await readFile(file, 'utf8'); } catch { /* Download below. */ }
  for (let attempt=0;attempt<4;attempt++) {
    if (!raw) {
      const response = await fetch(root+path+(attempt ? `?consulta=20261009-${attempt}` : ''),{headers:{'Accept-Encoding':'identity'},cache:'no-store'});
      if (!response.ok) throw new Error(`RNEC ${response.status}: ${path}`);
      raw = await response.text();
    }
    try {
      const data=JSON.parse(raw);
      await writeFile(file,raw);
      return {data,sha256:createHash('sha256').update(raw).digest('hex'),url:root+path};
    } catch { raw=''; }
  }
  throw new Error(`El servidor devolvió un boletín incompleto: ${path}`);
}
const { data: nomenclator } = await download('/json/nomenclator.json');
const municipalities = Object.values(nomenclator.ambitos['3']).filter((item: any) => item.l === 3 && item.p.includes(12)) as { c: string; n: string }[];
if (municipalities.length !== 25) throw new Error('No se encontraron los 25 municipios del Cesar.');
const requests = municipalities.flatMap(item => ['AL', 'CO'].map(kind => ({ kind, code: item.c, municipality: CESAR_MUNICIPALITIES.find(name => normalizeName(name) === normalizeName(item.n.replaceAll('_', ' ')) || (item.c==='12625' && name==='Manaure Balcón del Cesar')) })));
requests.push({ kind: 'GO', code: '12', municipality: 'Cesar' as any }, { kind: 'AS', code: '12', municipality: 'Cesar' as any });
const levels = { AL: 'Alcaldía', CO: 'Concejo Municipal', GO: 'Gobernación', AS: 'Asamblea / Diputación' } as const;
const rows: StatisticalRow[] = [];
const evidence: object[] = [];
for (const request of requests) {
  if (!request.municipality) throw new Error(`Municipio sin correspondencia: ${request.code}`);
  const { data, url, sha256 } = await download(`/json/ACT/${request.kind}/${request.code}.json`);
  if (data.amb !== request.code) throw new Error(`Boletín de otro territorio: ${request.code}`);
  const chamber = data.camaras.find((item: any) => item.cir === '1') || data.camaras[0];
  const totals = { ...data.totales.act, ...chamber.totales.act };
  const common = { municipality: request.municipality, year: 2023, group: '', level: levels[request.kind as keyof typeof levels], source: 'RNEC · Preconteo territorial 2023 (informativo; no escrutinio)', url, referenceDate: '2023-10-29', provenance: 'oficial' as const };
  const local: StatisticalRow[] = [];
  for (const [metric, field] of [['censo', 'centota'], ['sufragantes', 'votant'], ['blancos', 'votbla'], ['nulos', 'votnul'], ['no_marcados', 'votnma']] as const) {
    const value = Number(totals[field]);
    if (!Number.isSafeInteger(value) || value < 0) throw new Error(`Total inválido: ${request.code}/${field}`);
    local.push({ ...common, metric, value });
  }
  for (const entry of chamber.partotabla) {
    const party = entry.act;
    if (!party.codpar || Number(party.vot) === 0) continue;
    const partyName = nomenclator.partidos[party.codpar]?.nombre;
    if (!partyName) throw new Error(`Partido sin nombre: ${party.codpar}`);
    // Only public aggregate list votes are kept. Personal identity numbers are discarded.
    local.push({ ...common, metric: 'votos_partido', group: partyName.slice(0,200), value: Number(party.vot) });
  }
  validateRows(local);
  const baseline = historicalBaseline(local, common.municipality, common.level as any, historyKey(local[0]));
  rows.push(...local);
  evidence.push({ municipality:common.municipality, level:common.level, url, sha256, bulletin:data.numact, transmittedAt:data.mdhm, reportingStations:Number(totals.mesesc), totalStations:Number(totals.metota), turnout:baseline.turnout, rows:local.length });
}
await writeFile('src/data/cesarElectionHistory.json', JSON.stringify(rows, null, 2)+'\n');
await writeFile('docs/election-history-evidence.json', JSON.stringify({ kind:'preconteo_informativo', electionDate:'2023-10-29', consultedAt:new Date().toISOString().slice(0,10), documents:evidence }, null, 2)+'\n');
console.log(`Preparados ${rows.length} indicadores de 52 boletines de preconteo; totales y partidos conciliados.`);
