import { ASI_CLOSED_EXAMPLE, listMembers } from '../lib/closedLists';
import { SimulatorListMembers } from './SimulatorListMembers';
import { ElectionProcessPanel } from './ElectionProcessPanel';
import React, { useEffect, useMemo, useState } from 'react';
import { Cell, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Candidate, ElectoralLevel, Tenant } from '../types';
import { CESAR_MUNICIPALITIES } from '../data/geography';
import bundledStatistics from '../data/cesarStatistics.json';
import electionHistory from '../data/cesarElectionHistory.json';
import referenceSeats from '../data/cesarSeats.json';
import astreaCouncil2023Mmv from '../data/astreaCouncil2023Mmv.json';
import { StatisticalDataPanel, sourceIdentity } from './StatisticalDataPanel';
import { AuthorHeader } from './common/AuthorHeader';
import { distributeVotes, getVoteBudget, simulateElection, type ElectionParameters } from '../lib/electoralSimulation';
import { downloadText, historicalBaseline, historyKey, referenceRow, scopeForLevel, validateRows, type StatisticalRow } from '../lib/statisticalData';
import { auth } from '../lib/firebase';
import { appendSharedRows, deleteSharedScenario, loadSharedScenario, removeSharedSource, saveSharedScenario, subscribeSharedSimulation } from '../lib/sharedSimulation';
import { isLastSaveQueued } from '../lib/offlineMutations';
import { accountError } from '../lib/userProvisioning';
import { buildScenario, validateSnapshot, type SavedScenario, type SimulatorSnapshot } from '../lib/simulationScenarios';
import {CHART_COLORS} from '../lib/chartPalette';

const OFFICIAL_ROWS = [...bundledStatistics, ...electionHistory, ...referenceSeats] as StatisticalRow[];
const COLORS = CHART_COLORS;
const LEVELS: ElectoralLevel[] = ['Concejo Municipal', 'Alcaldía', 'Gobernación', 'Asamblea / Diputación', 'Cámara de Representantes'];
const balance = (input: ElectionParameters): ElectionParameters => ({ ...input, parties: distributeVotes(input.parties, getVoteBudget(input.census, input.turnout, input.nullPct, input.unmarkedPct, input.blankPct)) });
function initialParameters(tenant: Tenant, municipality='Astrea', level:ElectoralLevel='Concejo Municipal', rows=OFFICIAL_ROWS): ElectionParameters {
  const scope=scopeForLevel(municipality,level);
  const source=rows.find(row=>row.municipality===scope && row.level===level && row.metric==='sufragantes');
  const history=source ? historicalBaseline(rows,scope,level,historyKey(source)) : undefined;
  const seats=referenceRow(rows.filter(row=>row.level===level),scope,'curules')?.value;
  return balance({census:referenceRow(rows,scope,'censo')?.value ?? 0,level,seats:['Alcaldía','Gobernación'].includes(level)?1:seats ?? (level==='Cámara de Representantes'?4:11),
    turnout:history?.turnout ?? 58.5,nullPct:history?.nullPct ?? 2.8,unmarkedPct:history?.unmarkedPct ?? 1.4,blankPct:history?.blankPct ?? 2.2,
    parties:history ? history.parties.map((row,index)=>({id:`hist-${index}`,name:row.group,votes:row.value,color:COLORS[index%COLORS.length],isUserParty:false})) : [{id:'lista-manual',name:`${tenant.name} · escenario manual`,votes:1,color:COLORS[0],isUserParty:false}]
  });
}
function initialHistoryOrigin(municipality='Astrea',level:ElectoralLevel='Concejo Municipal') {
  return OFFICIAL_ROWS.some(row=>row.municipality===scopeForLevel(municipality,level)&&row.level===level&&row.metric==='sufragantes')
    ? 'RNEC · Preconteo territorial 2023 (informativo, no escrutinio). Tasas y proporciones aplicadas al censo de referencia.' : 'Supuestos manuales; sin histórico electoral incorporado para este cargo.';
}
const number = (value: number) => value.toLocaleString('es-CO', { maximumFractionDigits: 2 });
const rowKey = (row: StatisticalRow) => [row.municipality, row.year, row.metric, row.group, row.level, sourceIdentity(row)].join('|');
const inputClass = 'w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100';
const buttonClass = 'rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-100 hover:bg-slate-700 disabled:opacity-40';

interface Props { currentTenant: Tenant; candidates?: Candidate[]; onNavigateTab?: (tab: any) => void }
export function ElectoralSimulatorView({ currentTenant, candidates = [], onNavigateTab }: Props) {
  const shared = !!auth.currentUser;
  const [busy, setBusy] = useState(false);
  const storageKey = `astrea:simulaciones:v1:${currentTenant.tenantId}`;
  const dataKey = `astrea:estadisticas:v1:${currentTenant.tenantId}`;
  const [municipality, setMunicipality] = useState('Astrea');
  const [referenceYear, setReferenceYear] = useState(2026);
  const [parameters, setParameters] = useState(() => initialParameters(currentTenant));
  const [base, setBase] = useState(() => initialParameters(currentTenant));
  const [censusOrigin, setCensusOrigin] = useState('RNEC · Divipole Congreso 2026 · elección 2026-03-08');
  const [historicalOrigin, setHistoricalOrigin] = useState(initialHistoryOrigin());
  const [message, setMessage] = useState('');
  const [scenarioName, setScenarioName] = useState('');
  const [savedChoice, setSavedChoice] = useState('');
  const [saved, setSaved] = useState<SavedScenario[]>(() => {
    try { const raw = JSON.parse(localStorage.getItem(storageKey) || '[]'); if (!Array.isArray(raw) || raw.length > 30) return []; return raw.filter(item => { try { validateSnapshot(item.snapshot, currentTenant.tenantId); return typeof item.id === 'string' && typeof item.name === 'string'; } catch { return false; } }); } catch { return []; }
  });
  const [imported, setImported] = useState<StatisticalRow[]>(() => { try { return validateRows(JSON.parse(localStorage.getItem(dataKey) || '[]')); } catch { return []; } });
  useEffect(() => {
    if (!shared) return;
    return subscribeSharedSimulation(currentTenant.tenantId, setSaved, setImported, error => setMessage(accountError(error)));
  }, [currentTenant.tenantId, shared]);
  const rows = useMemo(() => [...OFFICIAL_ROWS, ...imported], [imported]);
  const scope = scopeForLevel(municipality, parameters.level);
  const { result, issues } = useMemo(() => simulateElection(parameters), [parameters]);
  const budget = getVoteBudget(parameters.census, parameters.turnout, parameters.nullPct, parameters.unmarkedPct, parameters.blankPct);
  const listTotal = parameters.parties.reduce((sum, party) => sum + party.votes, 0);
  const censusReference = referenceRow(rows.filter(row => row.year <= referenceYear), scope, 'censo');
  const isSingleLevel = parameters.level === 'Alcaldía' || parameters.level === 'Gobernación';
  const isSingle = isSingleLevel || parameters.seats === 1;
  const hasClosedLists = parameters.parties.some(party => party.listKind === 'closed');
  const comparisons = (['conservador', 'base', 'optimista'] as const).map(mode => { const input = balance(buildScenario(base, mode)); return { mode, input, ...simulateElection(input) }; });

  async function persistImported(next: StatisticalRow[]) {

    setImported(next);
    try { localStorage.setItem(dataKey, JSON.stringify(next)); } catch { /* The committed cloud copy remains available. */ }
  }
  function changeTerritory(nextMunicipality: string, level: ElectoralLevel) {
    const census = referenceRow(rows.filter(row => row.year <= referenceYear), scopeForLevel(nextMunicipality, level), 'censo');
    const next = balance({ ...initialParameters(currentTenant,nextMunicipality,level,rows), census: census?.value ?? 0, level });
    setMunicipality(nextMunicipality); setParameters(next); setBase(next);
    setCensusOrigin(census ? `${census.source} · ${census.referenceDate}` : 'Sin censo de referencia. Ingrese una base manual.');
    setHistoricalOrigin(initialHistoryOrigin(nextMunicipality,level)); setMessage('Territorio y cargo cambiados. Revise las curules para esta elección.');
  }
  function snapshot(): SimulatorSnapshot { return { version: 1, tenantId: currentTenant.tenantId, municipality, referenceYear, parameters, base, censusOrigin, historicalOrigin, imported }; }
  async function restore(raw: unknown) {
    const item = validateSnapshot(raw, currentTenant.tenantId);
    setImported(item.imported);
    setMunicipality(item.municipality); setReferenceYear(item.referenceYear); setParameters(item.parameters); setBase(item.base); setCensusOrigin(item.censusOrigin); setHistoricalOrigin(item.historicalOrigin); setMessage('Escenario restaurado con parámetros, base y fuentes importadas.');
  }
  function saveScenarios(next: SavedScenario[]) {
    try { localStorage.setItem(storageKey, JSON.stringify(next)); setSaved(next); return true; } catch { setMessage('No se pudo guardar. Exporte un JSON o elimine escenarios anteriores.'); return false; }
  }
  async function importScenario(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
    try { if (file.size > 5 * 1024 * 1024) throw new Error('El archivo supera 5 MB.'); await restore(JSON.parse(await file.text())); } catch (error) { setMessage((error as Error).message); }
  }
  function loadAstreaMmv() {
    const source = astreaCouncil2023Mmv;
    const voters = source.voters;
    const next: ElectionParameters = {
      census: source.census,
      turnout: voters / source.census * 100,
      nullPct: source.nullVotes / voters * 100,
      unmarkedPct: source.unmarkedVotes / voters * 100,
      blankPct: source.blankVotes / voters * 100,
      seats: source.seats,
      level: 'Concejo Municipal',
      parties: source.parties.map((party, index) => ({
        id: 'mmv-astrea-' + party.code,
        name: party.name,
        votes: party.votes,
        color: COLORS[index % COLORS.length],
        isUserParty: party.code === '00006',
        listKind: 'open',
        candidatesCount: party.candidatesCount,
        candidateVotes: party.candidates.map((candidate) => ({
          id: 'mmv-' + party.code + '-' + candidate.code,
          name: candidate.name,
          position: Number(candidate.code),
          votes: candidate.votes,
        })),
      })),
    };
    setMunicipality(source.municipality);
    setReferenceYear(source.year);
    setParameters(next);
    setBase(next);
    setCensusOrigin('RNEC · MMV 2023 · 16.558 electores · ' + source.tables + ' mesas');
    setHistoricalOrigin('RNEC · MMV 2023 · resultados mesa a mesa · ' + source.tables + ' mesas · votos de cada lista y candidato; los votos solo por la lista quedan separados. Revise el E-26 para la declaratoria oficial.');
    setMessage('Base histórica de Astrea cargada. Cambiar votos o tipo de lista produce un escenario de simulación.');
  }

  function exportResults() {
    const entries: (string | number)[][] = [
      ['SIMULACIÓN ELECTORAL · RESULTADOS CONDICIONADOS A LOS SUPUESTOS'],
      ['Ámbito', scope], ['Cargo', parameters.level], ['Censo de escenario', parameters.census],
      ['Origen del censo', censusOrigin], ['Base de comportamiento', historicalOrigin],
      ['Participación (%)', parameters.turnout], ['Sufragantes', result.totalVoters],
      ['Votos válidos (incluye blancos)', result.totalValidVotes], ['Votos en blanco', result.blankVotes],
      ['Nulos', result.nullVotes], ['No marcados', result.unmarkedVotes],
      ['Cociente electoral', isSingle ? 'No aplica' : result.quotient], ['Mínimo de habilitación', isSingle ? 'No aplica' : result.thresholdVotes],
      ['Cifra repartidora', isSingle || parameters.seats === 2 ? 'No aplica' : result.cifraRepartidora],
      ['Método', isSingle ? 'Mayoría relativa' : parameters.seats === 2 ? 'Cociente y residuos' : 'D’Hondt'],
      ['Residuo', parameters.seats === 2 ? 'Votos − (cocientes completos × cociente electoral)' : 'Votos de lista − (curules × cifra repartidora)'],
      [], ['RESULTADO POR PARTIDO'],
      ['Lista / partido', 'Votos de lista', 'Votos preferentes', 'Votos solo por lista', '% válidos', 'Umbral', 'Curules', 'Residuo / saldo'],
      ...result.allocationsByParty.map((party) => {
        const input = parameters.parties.find((row) => row.id === party.partyId);
        const candidateVotes = input?.candidateVotes?.reduce((sum, row) => sum + row.votes, 0) || 0;
        const remainder = parameters.seats === 2 && result.quotient > 0 ? party.totalVotes % result.quotient : party.surplusVotes;
        const qualified = result.thresholdException ? party.totalVotes > 0 : party.passedThreshold;
        return [party.partyName, party.totalVotes, candidateVotes, Math.max(0, party.totalVotes - candidateVotes), party.votePercentage, qualified ? 'Habilitado' : 'No alcanza', party.seatsWon, remainder];
      }),
      [], ['DETALLE POR CANDIDATO'], ['Partido', 'Tipo de lista', 'Orden', 'Candidato', 'Votos preferentes', 'Curul simulada'],
      ...parameters.parties.flatMap((party) => {
        const allocation = result.allocationsByParty.find((row) => row.partyId === party.id);
        const assigned = listMembers(party, allocation?.seatsWon || 0);
        const elected = new Set(assigned.members.map((member) => member.id));
        return (party.candidateVotes || []).map((member) => [party.name, party.listKind === 'closed' ? 'Cerrada' : 'Abierta', member.position, member.name, member.votes, assigned.pendingTie ? 'Empate pendiente' : elected.has(member.id) ? 'Curul asignada' : '—']);
      }),
      [], ['MATRIZ D’HONDT'], ['Partido', 'Votos de lista', 'Divisor', 'Cociente', 'Curul asignada'],
      ...result.dhondtMatrix.map((step) => [step.partyName, parameters.parties.find((party) => party.id === step.partyId)?.votes || 0, step.divisor, step.quotient, step.seatWonNumber || '—']),
    ];
    downloadText('simulacion-' + scope.replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '.csv', '\uFEFF' + entries.map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\r\n'));
  }
  return <div className="space-y-6 pb-12">
    <AuthorHeader title="Simulación electoral y estadísticas territoriales" subtitle="Astrea y los 25 municipios del Cesar · Fuentes, supuestos y escenarios guardados" badgeText="Datos y escenarios" />
    <section className="rounded-2xl border border-slate-700 bg-slate-900 p-5 text-slate-100">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-lg font-bold">Parámetros del escenario</h2><p className="mt-1 text-xs text-slate-400">El censo de referencia no reemplaza el corte de la próxima elección.</p></div>
        <button type="button" className={buttonClass + ' border-cyan-700 text-cyan-200'} onClick={loadAstreaMmv}>Cargar resultados de Astrea 2023 · MMV</button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-xs text-slate-300">Municipio<select aria-label="Municipio de simulación" className={`mt-1 ${inputClass}`} value={municipality} onChange={event => changeTerritory(event.target.value, parameters.level)}>{CESAR_MUNICIPALITIES.map(name => <option key={name}>{name}</option>)}</select></label>
        <label className="text-xs text-slate-300">Cargo<select aria-label="Cargo de simulación" className={`mt-1 ${inputClass}`} value={parameters.level} onChange={event => changeTerritory(municipality, event.target.value as ElectoralLevel)}>{LEVELS.map(level => <option key={level}>{level}</option>)}</select></label>
        <label className="text-xs text-slate-300">Censo del escenario<input aria-label="Censo del escenario" type="number" min="0" step="1" className={`mt-1 ${inputClass}`} value={parameters.census} onChange={event => { setParameters({ ...parameters, census: Math.max(0, Math.trunc(Number(event.target.value))) }); setCensusOrigin('Valor manual del escenario; pendiente de contrastar con una fuente.'); }} /></label>
        <label className="text-xs text-slate-300">Curules o cargos<input aria-label="Curules o cargos" type="number" min="1" max="100" disabled={isSingleLevel} className={`mt-1 ${inputClass}`} value={parameters.seats} onChange={event => setParameters({ ...parameters, seats: Math.max(1, Math.min(100, Math.trunc(Number(event.target.value)))) })} /></label>
      </div><p className="mt-3 text-xs text-slate-400">Ámbito: <strong className="text-cyan-200">{scope}</strong> · Censo usado: {censusOrigin}. Las curules iniciales son una referencia; confirme las de la corporación y el año.</p>
      {historicalOrigin.includes('MMV 2023') && <p className="mt-2 text-xs text-slate-400">Fuente: <a className="text-cyan-300 underline" href={astreaCouncil2023Mmv.sourceUrl} target="_blank" rel="noreferrer">visor histórico MMV de la Registraduría</a> · <a className="text-cyan-300 underline" href={astreaCouncil2023Mmv.downloadUrl} target="_blank" rel="noreferrer">archivo MMV descargable</a> · <a className="text-cyan-300 underline" href={astreaCouncil2023Mmv.seatsSource} target="_blank" rel="noreferrer">curules de 2023</a>. Revise el E-26 para la declaratoria.</p>}
    </section>
    <StatisticalDataPanel scope={scope} year={referenceYear} level={parameters.level} rows={rows} imported={imported} onYearChange={setReferenceYear}
      onImport={async incoming => { const merged = new Map<string, StatisticalRow>(imported.map(row => [rowKey(row), row])); incoming.forEach(row => merged.set(rowKey(row), row)); const next=validateRows([...merged.values()]); if (shared) await appendSharedRows(currentTenant.tenantId,incoming); else await persistImported(next); }}
      onRemoveSource={async key => { if (shared) await removeSharedSource(currentTenant.tenantId,key); else await persistImported(imported.filter(row => sourceIdentity(row) !== key)); setMessage('Fuente retirada. Los parámetros ya aplicados permanecen en el escenario; elija una nueva base para recalcularlos.'); }}
      onApplyCensus={row => { const next = balance({ ...parameters, census: row.value }); setParameters(next); setBase(next); setCensusOrigin(`${row.source} · ${row.referenceDate} · ${row.provenance}`); setMessage('Censo aplicado y listas ajustadas conservando sus proporciones.'); }}
      onApplyHistory={history => {
        const parties = history.parties.map((row, index) => ({ id: `historico-${index}`, name: row.group, votes: row.value, color: COLORS[index % COLORS.length], isUserParty: false }));
        const next = balance({ ...parameters, census: censusReference?.value ?? history.census, turnout: history.turnout, nullPct: history.nullPct, blankPct: history.blankPct, unmarkedPct: history.unmarkedPct, parties });
        setParameters(next); setBase(next); setCensusOrigin(censusReference ? `${censusReference.source} · ${censusReference.referenceDate}` : `${history.source.source} · censo histórico ${history.source.year}`); setHistoricalOrigin(`${history.source.year} · ${history.source.source} · ${history.source.referenceDate}. Tasas y proporciones proyectadas sobre el censo del escenario.`);
      }} />
    <section className="space-y-4 rounded-2xl border border-slate-700 bg-slate-900 p-5 text-slate-100">
      <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-bold">Comportamiento electoral y distribución de votos</h3><button className={buttonClass} onClick={()=>{const example=structuredClone(ASI_CLOSED_EXAMPLE);setMunicipality('Astrea');setParameters(example);setBase(example);setCensusOrigin('Supuesto didáctico: 10.000 votos válidos y 11 curules; no corresponde a un resultado oficial.');setHistoricalOrigin('Ejemplo ASI: lista cerrada hipotética con 1.400 votos. Las otras listas también son supuestos.');}}>Simular lista cerrada · ejemplo ASI</button></div><p className="text-xs text-slate-400">Base: {historicalOrigin}</p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{([['turnout', 'Participación'], ['nullPct', 'Votos nulos'], ['unmarkedPct', 'No marcados'], ['blankPct', 'Votos en blanco']] as const).map(([field, label]) => <label key={field} className="text-xs text-slate-300">{label} (%)<input aria-label={label} type="number" min="0" max="100" step="0.1" className={`mt-1 ${inputClass}`} value={Number(parameters[field].toFixed(3))} onChange={event => { setParameters({ ...parameters, [field]: Math.max(0, Math.min(100, Number(event.target.value))) }); setHistoricalOrigin('Supuestos editados manualmente; revise las tasas frente al histórico.'); }} /></label>)}</div>
      <p className="text-xs text-slate-400">Nulos, no marcados y blancos se calculan sobre sufragantes. Disponibles para listas: <strong className="text-cyan-200">{number(budget)}</strong> · Asignados: <strong>{number(listTotal)}</strong>.</p>
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-xs text-slate-400"><tr><th className="p-2">Lista o candidatura</th><th>Votos de lista</th><th>Tipo de lista</th><th>Nuestra lista</th><th>Acción</th></tr></thead><tbody>{parameters.parties.map(party => <tr key={party.id} className="border-t border-slate-800">
        <td className="min-w-44 p-2"><input aria-label={`Nombre ${party.name}`} className={inputClass} value={party.name} onChange={event => setParameters({ ...parameters, parties: parameters.parties.map(row => row.id === party.id ? { ...row, name: event.target.value.slice(0, 200) } : row) })} /></td>
        <td className="w-40 p-2"><input aria-label={`Votos ${party.name}`} type="number" min="0" step="1" className={inputClass} value={party.votes} onChange={event => setParameters({ ...parameters, parties: parameters.parties.map(row => row.id === party.id ? { ...row, votes: Math.max(0, Math.trunc(Number(event.target.value))) } : row) })} /></td>
        <td className="p-2"><select aria-label={`Tipo de lista ${party.name}`} disabled={isSingleLevel} className={inputClass} value={party.listKind||'open'} onChange={event=>setParameters({...parameters,parties:parameters.parties.map(row=>row.id===party.id?{...row,listKind:event.target.value as 'open'|'closed'}:row)})}><option value="open">Abierta</option><option value="closed">Cerrada</option></select></td><td className="p-2"><input aria-label={`Marcar nuestra lista: ${party.name}`} type="radio" name="user-party" checked={!!party.isUserParty} onChange={() => setParameters({ ...parameters, parties: parameters.parties.map(row => ({ ...row, isUserParty: row.id === party.id })) })} /></td>
        <td className="p-2"><button aria-label={`Eliminar ${party.name}`} disabled={parameters.parties.length <= 2} onClick={() => setParameters({ ...parameters, parties: parameters.parties.filter(row => row.id !== party.id) })} className="text-rose-300 disabled:opacity-30">Eliminar</button></td>
      </tr>)}</tbody></table></div>
      <div className="flex flex-wrap gap-2"><button className={buttonClass} onClick={() => setParameters(balance(parameters))}>Ajustar al total</button><button disabled={parameters.parties.length >= 100} className={buttonClass} onClick={() => setParameters({ ...parameters, parties: [...parameters.parties, { id: crypto.randomUUID(), name: `Nueva lista ${parameters.parties.length + 1}`, votes: 0, color: COLORS[parameters.parties.length % COLORS.length] }] })}>Añadir lista</button><button className={buttonClass} onClick={() => { const next = balance(parameters); setParameters(next); setBase(next); setMessage('Parámetros actuales fijados como base de los tres escenarios.'); }}>Fijar como escenario base</button></div>
    </section>
    <section className="space-y-4 rounded-2xl border border-slate-700 bg-slate-900 p-5 text-slate-100">
      <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-bold">Resultado · {isSingle ? 'Mayoría relativa' : parameters.seats === 2 ? 'Cociente y residuos' : 'Cifra repartidora D’Hondt'}</h3><button className={buttonClass} disabled={issues.length > 0} onClick={exportResults}>Exportar resultado CSV</button></div>
      {issues.length > 0 ? <div role="alert" className="rounded-xl border border-amber-600/40 bg-amber-500/10 p-4 text-sm text-amber-200"><p className="mb-2 font-bold">Corrija los datos para calcular la asignación:</p><ul className="list-disc space-y-1 pl-5">{issues.map(issue => <li key={issue}>{issue}</li>)}</ul></div> : <>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[['Sufragantes estimados', result.totalVoters], ['Votos válidos (incluye blancos)', result.totalValidVotes], [isSingle ? 'Umbral: no aplica' : 'Mínimo de habilitación', result.thresholdVotes], [isSingle ? 'Cargos asignados' : parameters.seats === 2 ? 'Cociente electoral' : 'Cifra repartidora', isSingle ? 1 : parameters.seats === 2 ? result.quotient : result.cifraRepartidora]].map(([label, value]) => <div key={String(label)} className="rounded-xl bg-slate-950 p-3"><p className="text-xs text-slate-400">{label}</p><p className="mt-1 text-xl font-bold text-cyan-200">{number(Number(value))}</p></div>)}</div>
        {result.thresholdException&&<p className="text-sm text-amber-200">Ninguna lista supera el umbral: se aplica el reparto entre las listas participantes, conforme al artículo 263.</p>}
        <div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead className="text-xs text-slate-400"><tr><th className="p-2">Partido / lista</th><th className="p-2 text-right">Votos</th><th className="p-2 text-right">Votos candidatos{hasClosedLists ? " · ref." : ""}</th><th className="p-2 text-right">Solo lista{hasClosedLists ? " · ref." : ""}</th><th className="p-2 text-right">% válidos</th><th className="p-2 text-right">Curules</th><th className="p-2">Umbral</th></tr></thead><tbody>{result.allocationsByParty.map(party => { const input=parameters.parties.find(row=>row.id===party.partyId); const candidateVotes=input?.candidateVotes?.reduce((sum,row)=>sum+row.votes,0)||0; const qualified=result.thresholdException?party.totalVotes>0:party.passedThreshold; return <tr key={party.partyId} className="border-t border-slate-800"><td className="p-2">{party.partyName}</td><td className="p-2 text-right tabular-nums">{number(party.totalVotes)}</td><td className="p-2 text-right tabular-nums">{input?.candidateVotes?number(candidateVotes):'—'}</td><td className="p-2 text-right tabular-nums">{input?.candidateVotes?number(Math.max(0,party.totalVotes-candidateVotes)):'—'}</td><td className="p-2 text-right tabular-nums">{number(party.votePercentage)}%</td><td className="p-2 text-right font-bold text-cyan-200">{party.seatsWon}</td><td className="p-2">{isSingle?'No aplica':qualified?'Habilitado':'Excluido'}</td></tr>})}</tbody></table></div>
        {hasClosedLists && <p className="text-xs text-amber-200">Los votos preferentes de referencia no cambian el orden de una lista cerrada; las curules internas siguen la posición registrada.</p>}
        <div className="h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={result.allocationsByParty}><CartesianGrid stroke="#334155" vertical={false} /><XAxis dataKey="partyName" stroke="#94a3b8" fontSize={10} /><YAxis stroke="#94a3b8" /><Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #475569', color: '#e2e8f0' }} /><Bar dataKey="totalVotes" name="Votos de lista">{result.allocationsByParty.map((row,index)=><Cell key={row.partyId} fill={parameters.parties.find(p=>p.id===row.partyId)?.color||COLORS[index%COLORS.length]}/>)}</Bar></BarChart></ResponsiveContainer></div>
        <ElectionProcessPanel parameters={parameters} result={result} singleSeat={isSingle} />
      </>}
      <p className="text-xs text-slate-400">Asignación condicionada a todas las listas y votos. Los empates en el corte requieren el procedimiento oficial. <a href="https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=4125" target="_blank" rel="noreferrer" className="text-cyan-300 underline">Constitución, artículo 263.</a></p>
    </section>
    {!isSingleLevel&&<section className="space-y-3 rounded-2xl border border-slate-700 bg-slate-900 p-5"><h3 className="font-bold">Aspirantes y orden de adjudicación</h3><p className="text-xs text-slate-400">Abiertas y cerradas comparten el reparto entre listas. En cerradas cambia el orden interno: las curules corresponden a los primeros aspirantes inscritos.</p>{parameters.parties.map(party=><SimulatorListMembers key={party.id+'-'+(party.listKind||'open')} party={party} seats={result.allocationsByParty.find(row=>row.partyId===party.id)?.seatsWon||0} onChange={next=>setParameters({...parameters,parties:parameters.parties.map(row=>row.id===next.id?next:row)})}/>)}</section>}
    <section className="space-y-4 rounded-2xl border border-slate-700 bg-slate-900 p-5 text-slate-100">
      <h3 className="font-bold">Comparar escenarios sobre la misma base</h3><p className="text-xs text-slate-400">Supuestos: participación ±5 puntos; peso relativo de nuestra lista ×0,85 o ×1,25. Se redistribuye el total disponible. No son intervalos de confianza ni probabilidades de victoria.</p>
      <div className="grid gap-3 sm:grid-cols-3">{comparisons.map(({ mode, input, result: calculation, issues: errors }) => <article key={mode} className="space-y-2 rounded-xl border border-slate-700 bg-slate-950 p-4"><h4 className="font-bold capitalize">{mode}</h4><p className="text-xs text-slate-400">Participación: {number(input.turnout)}% · Sufragantes: {number(calculation.totalVoters)}</p><p className="text-sm text-cyan-200">{errors.length ? 'Requiere revisar la base' : `Nuestra lista: ${calculation.userPartySeats} ${isSingle ? 'cargo' : 'curules'}`}</p><button className={buttonClass} onClick={() => { setParameters(input); setMessage(`Escenario ${mode} aplicado desde la base guardada.`); }}>Aplicar {mode}</button></article>)}</div>
    </section>
    <section className="space-y-4 rounded-2xl border border-slate-700 bg-slate-900 p-5 text-slate-100">
      <h3 className="font-bold">Guardar y recuperar escenarios</h3><p className="text-xs text-slate-400">{shared ? 'Escenarios y fuentes compartidos en Firestore con los usuarios de su organización. El JSON permite conservar una copia completa.' : 'La presentación conserva escenarios en este navegador. Ingrese para compartirlos con su equipo.'}</p>
      <div className="flex flex-wrap gap-2"><input aria-label="Nombre del escenario" placeholder="Nombre del escenario" maxLength={100} value={scenarioName} onChange={event => setScenarioName(event.target.value)} className={`${inputClass} sm:max-w-xs`} /><button className={buttonClass} disabled={busy || !scenarioName.trim()} onClick={async () => {
        if (busy) return;
        if (saved.length >= 30) { setMessage('Límite de 30 escenarios; elimine uno antes de guardar.'); return; }
        setBusy(true); const id = shared ? `${currentTenant.tenantId}--${crypto.randomUUID()}` : crypto.randomUUID();
        try { const scenario = { id, name: scenarioName.trim(), savedAt: new Date().toISOString(), snapshot: snapshot() };
          if (shared) await saveSharedScenario(currentTenant.tenantId, scenario); else if (!saveScenarios([...saved, scenario])) return;
          setSavedChoice(id); setMessage(shared ? (isLastSaveQueued() ? 'Escenario conservado en este dispositivo. Pendiente de sincronización.' : 'Escenario guardado y compartido en Firestore.') : 'Escenario guardado en este navegador.');
        } catch(error) { setMessage(accountError(error)); } finally { setBusy(false); }
      }}>Guardar escenario</button><button className={buttonClass} onClick={() => downloadText(`escenario-${municipality}.json`, JSON.stringify(snapshot(), null, 2), 'application/json')}>Exportar JSON</button><label className={`${buttonClass} cursor-pointer`}>Importar escenario JSON<input aria-label="Importar escenario JSON" type="file" accept=".json,application/json" className="sr-only" onChange={importScenario} /></label></div>
      {saved.length > 0 && <div className="flex flex-wrap gap-2"><select aria-label="Escenarios guardados" className={`${inputClass} sm:max-w-sm`} value={savedChoice} onChange={event => setSavedChoice(event.target.value)}><option value="">Seleccione un escenario</option>{saved.map(item => <option key={item.id} value={item.id}>{item.name} · {item.snapshot.municipality}</option>)}</select><button className={buttonClass} disabled={busy || !savedChoice} onClick={async () => { if (busy) return; setBusy(true); try { const item = saved.find(row => row.id === savedChoice); if (item) await restore((shared ? await loadSharedScenario(currentTenant.tenantId,item) : item).snapshot); } catch (error) { setMessage(accountError(error)); } finally { setBusy(false); } }}>Recuperar</button><button className={buttonClass} disabled={busy || !savedChoice} onClick={async () => { if (busy) return; setBusy(true); try { if (shared) await deleteSharedScenario(currentTenant.tenantId,savedChoice); else saveScenarios(saved.filter(item => item.id !== savedChoice)); setSavedChoice(''); } catch(error) { setMessage(accountError(error)); } finally { setBusy(false); } }}>Eliminar escenario</button></div>}
      {candidates.length > 0 && onNavigateTab && <button className="text-xs text-cyan-300 underline" onClick={() => onNavigateTab('candidates')}>Ver {candidates.length} candidaturas registradas</button>}
      {message && <p role="status" className="text-sm text-amber-200">{message}</p>}
    </section>
  </div>;
}

