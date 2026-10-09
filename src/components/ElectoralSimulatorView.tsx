import React, { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Candidate, ElectoralLevel, Tenant } from '../types';
import { CESAR_MUNICIPALITIES } from '../data/geography';
import bundledStatistics from '../data/cesarStatistics.json';
import { StatisticalDataPanel, sourceIdentity } from './StatisticalDataPanel';
import { AuthorHeader } from './common/AuthorHeader';
import { distributeVotes, getVoteBudget, simulateElection, type ElectionParameters } from '../lib/electoralSimulation';
import { downloadText, referenceRow, scopeForLevel, validateRows, type StatisticalRow } from '../lib/statisticalData';
import { buildScenario, validateSnapshot, type SavedScenario, type SimulatorSnapshot } from '../lib/simulationScenarios';

const OFFICIAL_ROWS = bundledStatistics as StatisticalRow[];
const COLORS = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#a855f7', '#06b6d4'];
const LEVELS: ElectoralLevel[] = ['Concejo Municipal', 'Alcaldía', 'Gobernación', 'Asamblea / Diputación', 'Cámara de Representantes'];
const balance = (input: ElectionParameters): ElectionParameters => ({ ...input, parties: distributeVotes(input.parties, getVoteBudget(input.census, input.turnout, input.nullPct, input.unmarkedPct, input.blankPct)) });
const initialParameters = (tenant: Tenant): ElectionParameters => balance({ census: referenceRow(OFFICIAL_ROWS, 'Astrea', 'censo')?.value ?? 0, turnout: 58.5, nullPct: 2.8, unmarkedPct: 1.4, blankPct: 2.2, seats: 13, level: 'Concejo Municipal', parties: [
  { id: 'lista-1', name: `${tenant.name} (lista de escenario)`, votes: 36, isUserParty: true, color: COLORS[0] },
  ...[31, 22, 14, 7].map((votes, index) => ({ id: `lista-${index + 2}`, name: `Lista de ejemplo ${index + 2}`, votes, color: COLORS[index + 1] })),
] });
const number = (value: number) => value.toLocaleString('es-CO', { maximumFractionDigits: 2 });
const rowKey = (row: StatisticalRow) => [row.municipality, row.year, row.metric, row.group, row.level, sourceIdentity(row)].join('|');
const inputClass = 'w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100';
const buttonClass = 'rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-100 hover:bg-slate-700 disabled:opacity-40';

interface Props { currentTenant: Tenant; candidates?: Candidate[]; onNavigateTab?: (tab: any) => void }
export function ElectoralSimulatorView({ currentTenant, candidates = [], onNavigateTab }: Props) {
  const storageKey = `astrea:simulaciones:v1:${currentTenant.tenantId}`;
  const dataKey = `astrea:estadisticas:v1:${currentTenant.tenantId}`;
  const [municipality, setMunicipality] = useState('Astrea');
  const [referenceYear, setReferenceYear] = useState(2026);
  const [parameters, setParameters] = useState(() => initialParameters(currentTenant));
  const [base, setBase] = useState(() => initialParameters(currentTenant));
  const [censusOrigin, setCensusOrigin] = useState('RNEC · Divipole Congreso 2026 · elección 2026-03-08');
  const [historicalOrigin, setHistoricalOrigin] = useState('Supuestos de ejemplo; sin histórico electoral incorporado.');
  const [message, setMessage] = useState('');
  const [scenarioName, setScenarioName] = useState('');
  const [savedChoice, setSavedChoice] = useState('');
  const [saved, setSaved] = useState<SavedScenario[]>(() => {
    try { const raw = JSON.parse(localStorage.getItem(storageKey) || '[]'); if (!Array.isArray(raw) || raw.length > 30) return []; return raw.filter(item => { try { validateSnapshot(item.snapshot, currentTenant.tenantId); return typeof item.id === 'string' && typeof item.name === 'string'; } catch { return false; } }); } catch { return []; }
  });
  const [imported, setImported] = useState<StatisticalRow[]>(() => { try { return validateRows(JSON.parse(localStorage.getItem(dataKey) || '[]')); } catch { return []; } });
  const rows = useMemo(() => [...OFFICIAL_ROWS, ...imported], [imported]);
  const scope = scopeForLevel(municipality, parameters.level);
  const { result, issues } = useMemo(() => simulateElection(parameters), [parameters]);
  const budget = getVoteBudget(parameters.census, parameters.turnout, parameters.nullPct, parameters.unmarkedPct, parameters.blankPct);
  const listTotal = parameters.parties.reduce((sum, party) => sum + party.votes, 0);
  const censusReference = referenceRow(rows.filter(row => row.year <= referenceYear), scope, 'censo');
  const isSingle = parameters.level === 'Alcaldía' || parameters.level === 'Gobernación';
  const comparisons = (['conservador', 'base', 'optimista'] as const).map(mode => { const input = balance(buildScenario(base, mode)); return { mode, input, ...simulateElection(input) }; });

  function persistImported(next: StatisticalRow[]) {
    setImported(next);
    try { localStorage.setItem(dataKey, JSON.stringify(next)); } catch { setMessage('Los datos están cargados, pero el navegador no pudo guardarlos. Exporte el escenario.'); }
  }
  function changeTerritory(nextMunicipality: string, level: ElectoralLevel) {
    const census = referenceRow(rows.filter(row => row.year <= referenceYear), scopeForLevel(nextMunicipality, level), 'censo');
    const seats = ['Alcaldía', 'Gobernación'].includes(level) ? 1 : level === 'Asamblea / Diputación' ? 11 : level === 'Cámara de Representantes' ? 4 : 13;
    const next = balance({ ...initialParameters(currentTenant), census: census?.value ?? 0, level, seats });
    setMunicipality(nextMunicipality); setParameters(next); setBase(next);
    setCensusOrigin(census ? `${census.source} · ${census.referenceDate}` : 'Sin censo de referencia. Ingrese una base manual.');
    setHistoricalOrigin('Supuestos de ejemplo; sin histórico electoral incorporado.'); setMessage('Territorio y cargo cambiados. Revise las curules para esta elección.');
  }
  function snapshot(): SimulatorSnapshot { return { version: 1, tenantId: currentTenant.tenantId, municipality, referenceYear, parameters, base, censusOrigin, historicalOrigin, imported }; }
  function restore(raw: unknown) {
    const item = validateSnapshot(raw, currentTenant.tenantId);
    setMunicipality(item.municipality); setReferenceYear(item.referenceYear); setParameters(item.parameters); setBase(item.base); setCensusOrigin(item.censusOrigin); setHistoricalOrigin(item.historicalOrigin); persistImported(item.imported); setMessage('Escenario restaurado con parámetros, base y fuentes importadas.');
  }
  function saveScenarios(next: SavedScenario[]) {
    try { localStorage.setItem(storageKey, JSON.stringify(next)); setSaved(next); return true; } catch { setMessage('No se pudo guardar. Exporte un JSON o elimine escenarios anteriores.'); return false; }
  }
  async function importScenario(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
    try { if (file.size > 5 * 1024 * 1024) throw new Error('El archivo supera 5 MB.'); restore(JSON.parse(await file.text())); } catch (error) { setMessage((error as Error).message); }
  }
  function exportResults() {
    const entries = [['SIMULACIÓN ELECTORAL · RESULTADOS CONDICIONADOS A LOS SUPUESTOS'], ['Ámbito', scope], ['Cargo', parameters.level], ['Censo de escenario', parameters.census], ['Origen del censo', censusOrigin], ['Base de comportamiento', historicalOrigin], ['Participación (%)', parameters.turnout], ['Votos válidos (incluye blancos)', result.totalValidVotes], ['Votos en blanco', result.blankVotes], ['Mínimo para superar umbral', result.thresholdVotes], ['Método', isSingle ? 'Mayoría relativa' : parameters.seats === 2 ? 'Cociente y residuos' : 'D’Hondt'], [], ['Lista / candidatura', 'Votos', 'Porcentaje de válidos', 'Curules'], ...result.allocationsByParty.map(party => [party.partyName, party.totalVotes, party.votePercentage, party.seatsWon])];
    downloadText(`simulacion-${scope}.csv`, '\uFEFF' + entries.map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\r\n'));
  }
  return <div className="space-y-6 pb-12">
    <AuthorHeader title="Simulación electoral y estadísticas territoriales" subtitle="Astrea y los 25 municipios del Cesar · Fuentes, supuestos y escenarios guardados" badgeText="Datos y escenarios" />
    <section className="rounded-2xl border border-slate-700 bg-slate-900 p-5 text-slate-100">
      <h2 className="text-lg font-bold">Parámetros del escenario</h2><p className="mb-4 text-xs text-slate-400">El censo del Congreso 2026 sirve como referencia; una elección futura requiere su propio corte.</p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-xs text-slate-300">Municipio<select aria-label="Municipio de simulación" className={`mt-1 ${inputClass}`} value={municipality} onChange={event => changeTerritory(event.target.value, parameters.level)}>{CESAR_MUNICIPALITIES.map(name => <option key={name}>{name}</option>)}</select></label>
        <label className="text-xs text-slate-300">Cargo<select aria-label="Cargo de simulación" className={`mt-1 ${inputClass}`} value={parameters.level} onChange={event => changeTerritory(municipality, event.target.value as ElectoralLevel)}>{LEVELS.map(level => <option key={level}>{level}</option>)}</select></label>
        <label className="text-xs text-slate-300">Censo del escenario<input aria-label="Censo del escenario" type="number" min="0" step="1" className={`mt-1 ${inputClass}`} value={parameters.census} onChange={event => { setParameters({ ...parameters, census: Math.max(0, Math.trunc(Number(event.target.value))) }); setCensusOrigin('Valor manual del escenario; pendiente de contrastar con una fuente.'); }} /></label>
        <label className="text-xs text-slate-300">Curules o cargos<input aria-label="Curules o cargos" type="number" min="1" max="100" disabled={isSingle} className={`mt-1 ${inputClass}`} value={parameters.seats} onChange={event => setParameters({ ...parameters, seats: Math.max(1, Math.min(100, Math.trunc(Number(event.target.value)))) })} /></label>
      </div><p className="mt-3 text-xs text-slate-400">Ámbito: <strong className="text-cyan-200">{scope}</strong> · Censo usado: {censusOrigin}. Las curules iniciales son una referencia; confirme las de la corporación y el año.</p>
    </section>
    <StatisticalDataPanel scope={scope} year={referenceYear} level={parameters.level} rows={rows} imported={imported} onYearChange={setReferenceYear}
      onImport={incoming => { const merged = new Map<string, StatisticalRow>(imported.map(row => [rowKey(row), row])); incoming.forEach(row => merged.set(rowKey(row), row)); try { persistImported(validateRows([...merged.values()])); } catch (error) { setMessage((error as Error).message); } }}
      onRemoveSource={key => { persistImported(imported.filter(row => sourceIdentity(row) !== key)); setMessage('Fuente retirada. Los parámetros ya aplicados permanecen en el escenario; elija una nueva base para recalcularlos.'); }}
      onApplyCensus={row => { const next = balance({ ...parameters, census: row.value }); setParameters(next); setBase(next); setCensusOrigin(`${row.source} · ${row.referenceDate} · ${row.provenance}`); setMessage('Censo aplicado y listas ajustadas conservando sus proporciones.'); }}
      onApplyHistory={history => {
        const parties = history.parties.map((row, index) => ({ id: `historico-${index}`, name: row.group, votes: row.value, color: COLORS[index % COLORS.length], isUserParty: false }));
        const next = balance({ ...parameters, census: censusReference?.value ?? history.census, turnout: history.turnout, nullPct: history.nullPct, blankPct: history.blankPct, unmarkedPct: history.unmarkedPct, parties });
        setParameters(next); setBase(next); setCensusOrigin(censusReference ? `${censusReference.source} · ${censusReference.referenceDate}` : `${history.source.source} · censo histórico ${history.source.year}`); setHistoricalOrigin(`${history.source.year} · ${history.source.source} · ${history.source.referenceDate}. Tasas y proporciones proyectadas sobre el censo del escenario.`);
      }} />
    <section className="space-y-4 rounded-2xl border border-slate-700 bg-slate-900 p-5 text-slate-100">
      <h3 className="font-bold">Comportamiento electoral y distribución de votos</h3><p className="text-xs text-slate-400">Base: {historicalOrigin}</p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{([['turnout', 'Participación'], ['nullPct', 'Votos nulos'], ['unmarkedPct', 'No marcados'], ['blankPct', 'Votos en blanco']] as const).map(([field, label]) => <label key={field} className="text-xs text-slate-300">{label} (%)<input aria-label={label} type="number" min="0" max="100" step="0.1" className={`mt-1 ${inputClass}`} value={Number(parameters[field].toFixed(3))} onChange={event => { setParameters({ ...parameters, [field]: Math.max(0, Math.min(100, Number(event.target.value))) }); setHistoricalOrigin('Supuestos editados manualmente; revise las tasas frente al histórico.'); }} /></label>)}</div>
      <p className="text-xs text-slate-400">Nulos, no marcados y blancos se calculan sobre sufragantes. Disponibles para listas: <strong className="text-cyan-200">{number(budget)}</strong> · Asignados: <strong>{number(listTotal)}</strong>.</p>
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-xs text-slate-400"><tr><th className="p-2">Lista o candidatura</th><th>Votos estimados</th><th>Nuestra lista</th><th>Acción</th></tr></thead><tbody>{parameters.parties.map(party => <tr key={party.id} className="border-t border-slate-800">
        <td className="min-w-44 p-2"><input aria-label={`Nombre ${party.name}`} className={inputClass} value={party.name} onChange={event => setParameters({ ...parameters, parties: parameters.parties.map(row => row.id === party.id ? { ...row, name: event.target.value.slice(0, 200) } : row) })} /></td>
        <td className="w-40 p-2"><input aria-label={`Votos ${party.name}`} type="number" min="0" step="1" className={inputClass} value={party.votes} onChange={event => setParameters({ ...parameters, parties: parameters.parties.map(row => row.id === party.id ? { ...row, votes: Math.max(0, Math.trunc(Number(event.target.value))) } : row) })} /></td>
        <td className="p-2"><input aria-label={`Marcar nuestra lista: ${party.name}`} type="radio" name="user-party" checked={!!party.isUserParty} onChange={() => setParameters({ ...parameters, parties: parameters.parties.map(row => ({ ...row, isUserParty: row.id === party.id })) })} /></td>
        <td className="p-2"><button aria-label={`Eliminar ${party.name}`} disabled={parameters.parties.length <= 2} onClick={() => setParameters({ ...parameters, parties: parameters.parties.filter(row => row.id !== party.id) })} className="text-rose-300 disabled:opacity-30">Eliminar</button></td>
      </tr>)}</tbody></table></div>
      <div className="flex flex-wrap gap-2"><button className={buttonClass} onClick={() => setParameters(balance(parameters))}>Ajustar al total</button><button disabled={parameters.parties.length >= 100} className={buttonClass} onClick={() => setParameters({ ...parameters, parties: [...parameters.parties, { id: crypto.randomUUID(), name: `Nueva lista ${parameters.parties.length + 1}`, votes: 0, color: COLORS[parameters.parties.length % COLORS.length] }] })}>Añadir lista</button><button className={buttonClass} onClick={() => { const next = balance(parameters); setParameters(next); setBase(next); setMessage('Parámetros actuales fijados como base de los tres escenarios.'); }}>Fijar como escenario base</button></div>
    </section>
    <section className="space-y-4 rounded-2xl border border-slate-700 bg-slate-900 p-5 text-slate-100">
      <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-bold">Resultado · {isSingle ? 'Mayoría relativa' : parameters.seats === 2 ? 'Cociente y residuos' : 'Cifra repartidora D’Hondt'}</h3><button className={buttonClass} disabled={issues.length > 0} onClick={exportResults}>Exportar resultado CSV</button></div>
      {issues.length > 0 ? <div role="alert" className="rounded-xl border border-amber-600/40 bg-amber-500/10 p-4 text-sm text-amber-200"><p className="mb-2 font-bold">Corrija los datos para calcular la asignación:</p><ul className="list-disc space-y-1 pl-5">{issues.map(issue => <li key={issue}>{issue}</li>)}</ul></div> : <>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[['Sufragantes estimados', result.totalVoters], ['Votos válidos (incluye blancos)', result.totalValidVotes], [isSingle ? 'Umbral de listas: no aplica' : 'Mínimo para superar el umbral', result.thresholdVotes], [isSingle ? 'Cargo en disputa' : parameters.seats === 2 ? 'Cociente electoral' : 'Cifra repartidora', isSingle ? 1 : parameters.seats === 2 ? result.quotient : result.cifraRepartidora]].map(([label, value]) => <div key={String(label)} className="rounded-xl bg-slate-950 p-3"><p className="text-xs text-slate-400">{label}</p><p className="mt-1 text-xl font-bold text-cyan-200">{number(Number(value))}</p></div>)}</div>
        <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-xs text-slate-400"><tr><th className="p-2">Lista / candidatura</th><th>Votos</th><th>% de válidos</th><th>{isSingle ? 'Cargo' : 'Curules'}</th><th>{isSingle ? 'Resultado' : 'Umbral'}</th></tr></thead><tbody>{result.allocationsByParty.map(party => <tr key={party.partyId} className="border-t border-slate-800"><td className="p-2">{party.partyName}</td><td>{number(party.totalVotes)}</td><td>{number(party.votePercentage)}%</td><td className="font-bold text-cyan-200">{party.seatsWon}</td><td>{isSingle ? party.seatsWon ? 'Mayor votación' : 'Sin cargo' : party.passedThreshold ? 'Supera' : 'No supera'}</td></tr>)}</tbody></table></div>
        <div className="h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={result.allocationsByParty}><CartesianGrid stroke="#334155" vertical={false} /><XAxis dataKey="partyName" stroke="#94a3b8" fontSize={10} /><YAxis stroke="#94a3b8" /><Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #475569', color: '#e2e8f0' }} /><Bar dataKey="totalVotes" name="Votos de escenario" fill="#38bdf8" /></BarChart></ResponsiveContainer></div>
        {!isSingle && parameters.seats > 2 && <details><summary className="cursor-pointer text-sm text-cyan-200">Ver cocientes y asignación</summary><div className="mt-3 max-h-72 overflow-auto"><table className="w-full text-left text-xs"><thead><tr><th className="p-2">Lista</th><th>Divisor</th><th>Cociente sin redondear</th><th>Curul</th></tr></thead><tbody>{result.dhondtMatrix.map(step => <tr key={`${step.partyId}-${step.divisor}`} className={`border-t border-slate-800 ${step.isSeatWinner ? 'text-cyan-200' : 'text-slate-400'}`}><td className="p-2">{step.partyName}</td><td>{step.divisor}</td><td>{step.quotient.toLocaleString('es-CO', { maximumFractionDigits: 6 })}</td><td>{step.seatWonNumber ?? '—'}</td></tr>)}</tbody></table></div></details>}
      </>}
      <p className="text-xs text-slate-400">Asignación condicionada a todas las listas y votos. Los empates en el corte requieren el procedimiento oficial. <a href="https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=4125" target="_blank" rel="noreferrer" className="text-cyan-300 underline">Constitución, artículo 263.</a></p>
    </section>
    <section className="space-y-4 rounded-2xl border border-slate-700 bg-slate-900 p-5 text-slate-100">
      <h3 className="font-bold">Comparar escenarios sobre la misma base</h3><p className="text-xs text-slate-400">Supuestos: participación ±5 puntos; peso relativo de nuestra lista ×0,85 o ×1,25. Se redistribuye el total disponible. No son intervalos de confianza ni probabilidades de victoria.</p>
      <div className="grid gap-3 sm:grid-cols-3">{comparisons.map(({ mode, input, result: calculation, issues: errors }) => <article key={mode} className="space-y-2 rounded-xl border border-slate-700 bg-slate-950 p-4"><h4 className="font-bold capitalize">{mode}</h4><p className="text-xs text-slate-400">Participación: {number(input.turnout)}% · Sufragantes: {number(calculation.totalVoters)}</p><p className="text-sm text-cyan-200">{errors.length ? 'Requiere revisar la base' : `Nuestra lista: ${calculation.userPartySeats} ${isSingle ? 'cargo' : 'curules'}`}</p><button className={buttonClass} onClick={() => { setParameters(input); setMessage(`Escenario ${mode} aplicado desde la base guardada.`); }}>Aplicar {mode}</button></article>)}</div>
    </section>
    <section className="space-y-4 rounded-2xl border border-slate-700 bg-slate-900 p-5 text-slate-100">
      <h3 className="font-bold">Guardar y recuperar escenarios</h3><p className="text-xs text-slate-400">Guardado por organización en este navegador. El JSON conserva parámetros y fuentes para otro equipo de la misma organización. No se sincroniza con Firestore.</p>
      <div className="flex flex-wrap gap-2"><input aria-label="Nombre del escenario" placeholder="Nombre del escenario" maxLength={100} value={scenarioName} onChange={event => setScenarioName(event.target.value)} className={`${inputClass} sm:max-w-xs`} /><button className={buttonClass} disabled={!scenarioName.trim()} onClick={() => { if (saved.length >= 30) { setMessage('Límite de 30 escenarios; elimine uno antes de guardar.'); return; } const id = crypto.randomUUID(); if (saveScenarios([...saved, { id, name: scenarioName.trim(), savedAt: new Date().toISOString(), snapshot: snapshot() }])) { setSavedChoice(id); setMessage('Escenario guardado en este navegador.'); } }}>Guardar escenario</button><button className={buttonClass} onClick={() => downloadText(`escenario-${municipality}.json`, JSON.stringify(snapshot(), null, 2), 'application/json')}>Exportar JSON</button><label className={`${buttonClass} cursor-pointer`}>Importar escenario JSON<input aria-label="Importar escenario JSON" type="file" accept=".json,application/json" className="sr-only" onChange={importScenario} /></label></div>
      {saved.length > 0 && <div className="flex flex-wrap gap-2"><select aria-label="Escenarios guardados" className={`${inputClass} sm:max-w-sm`} value={savedChoice} onChange={event => setSavedChoice(event.target.value)}><option value="">Seleccione un escenario</option>{saved.map(item => <option key={item.id} value={item.id}>{item.name} · {item.snapshot.municipality}</option>)}</select><button className={buttonClass} disabled={!savedChoice} onClick={() => { try { const item = saved.find(row => row.id === savedChoice); if (item) restore(item.snapshot); } catch (error) { setMessage((error as Error).message); } }}>Recuperar</button><button className={buttonClass} disabled={!savedChoice} onClick={() => { if (saveScenarios(saved.filter(item => item.id !== savedChoice))) setSavedChoice(''); }}>Eliminar escenario</button></div>}
      {candidates.length > 0 && onNavigateTab && <button className="text-xs text-cyan-300 underline" onClick={() => onNavigateTab('candidates')}>Ver {candidates.length} candidaturas registradas</button>}
      {message && <p role="status" className="text-sm text-amber-200">{message}</p>}
    </section>
  </div>;
}
