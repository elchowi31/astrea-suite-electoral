import React, { useMemo, useState } from 'react';
import type { ElectoralLevel } from '../types';
import { METRICS, CSV_HEADER, downloadText, exportStatisticalCsv, historicalBaseline, historyKey, parseStatisticalCsv, referenceRow, safeSourceUrl, type StatisticalRow } from '../lib/statisticalData';

interface Props {
  scope: string;
  year: number;
  level: ElectoralLevel;
  rows: StatisticalRow[];
  imported: StatisticalRow[];
  onImport: (rows: StatisticalRow[]) => void;
  onRemoveSource: (source: string) => void;
  onYearChange: (year: number) => void;
  onApplyCensus: (row: StatisticalRow) => void;
  onApplyHistory: (history: ReturnType<typeof historicalBaseline>) => void;
}
export function StatisticalDataPanel({ scope, year, level, rows, imported, onImport, onRemoveSource, onYearChange, onApplyCensus, onApplyHistory }: Props) {
  const [pending, setPending] = useState<StatisticalRow[]>([]);
  const [message, setMessage] = useState('');
  const [historyChoice, setHistoryChoice] = useState('');
  const selected = rows.filter(row => row.municipality === scope);
  const census = referenceRow(selected.filter(row => row.year <= year), scope, 'censo');
  const population = referenceRow(selected, scope, 'poblacion', year);
  const populationSource = population ? selected.filter(row => sourceIdentity(row) === sourceIdentity(population)) : [];
  const urban = referenceRow(populationSource, scope, 'poblacion_urbana', year);
  const rural = referenceRow(populationSource, scope, 'poblacion_rural', year);
  const histories = [...new Map(selected.filter(row => row.level === level).map(row => [historyKey(row), row])).entries()];
  const sources = useMemo(() => [...new Map(selected.map(row => [sourceIdentity(row), row])).entries()], [rows, scope]);
  const years = [...new Set([2023, 2026, 2027, ...selected.filter(row => row.metric === 'poblacion').map(row => row.year)])].sort();
  const inputStyle = 'rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100';
  const buttonStyle = 'rounded-lg border border-blue-500/40 bg-blue-500/10 px-3 py-2 text-xs font-semibold text-blue-200 hover:bg-blue-500/20 disabled:opacity-40';
  async function readFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error('El archivo supera 5 MB.');
      const parsed = parseStatisticalCsv(await file.text());
      if (!parsed.length) throw new Error('El archivo no contiene datos.');
      setPending(parsed); setMessage(`${parsed.length} filas listas para incorporar. Revise la vista previa.`);
    } catch (error) { setPending([]); setMessage(error instanceof Error ? error.message : 'No se pudo leer el archivo.'); }
  }
  return <section className="space-y-4 rounded-2xl border border-cyan-700/40 bg-slate-900 p-5 text-slate-100" aria-labelledby="statistics-heading">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h3 id="statistics-heading" className="font-bold text-lg">Datos reales y fuentes · {scope}</h3><p className="text-xs text-slate-400">Censo de referencia y contexto demográfico para el escenario. Cada cifra conserva fuente y fecha.</p></div>
      <label className="flex items-center gap-2 text-xs">Año de población<select aria-label="Año de población" className={inputStyle} value={year} onChange={event => onYearChange(Number(event.target.value))}>{years.map(value => <option key={value}>{value}</option>)}</select></label>
    </div>
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {[['Censo de referencia', census], [`Población proyectada ${year}`, population], ['Cabecera municipal', urban], ['Rural y centros poblados', rural]].map(([label, item]) => {
        const row = item as StatisticalRow | undefined;
        return <div key={String(label)} className="rounded-xl border border-slate-700 bg-slate-950 p-3"><p className="text-xs text-slate-400">{String(label)}</p><p className="mt-1 text-xl font-bold text-cyan-200">{row ? row.value.toLocaleString('es-CO') : 'Sin dato'}</p>{row && <p className="mt-1 text-[11px] text-slate-400">Referencia: {row.referenceDate} · {row.provenance === 'oficial' ? 'Fuente oficial' : 'Fuente aportada'}</p>}</div>;
      })}
    </div>
    {urban && rural && population && population.value > 0 && <div><div className="flex h-3 overflow-hidden rounded-full bg-emerald-500" aria-label={`Cabecera ${Math.round(urban.value / population.value * 100)}%, rural ${Math.round(rural.value / population.value * 100)}%`}><div className="bg-cyan-500" style={{ width: `${Math.min(100, urban.value / population.value * 100)}%` }} /></div><p className="mt-1 text-xs text-slate-400">Cabecera: {(urban.value / population.value * 100).toFixed(1)}% · Rural: {(rural.value / population.value * 100).toFixed(1)}%. La población total incluye menores de edad; no reemplaza el censo electoral.</p></div>}
    <div className="flex flex-wrap items-center gap-2">
      <button className={buttonStyle} disabled={!census} onClick={() => census && onApplyCensus(census)}>Usar censo de referencia</button>
      <label className="text-xs text-slate-300">Histórico del mismo cargo<select aria-label="Histórico electoral" className={`ml-2 ${inputStyle}`} value={historyChoice} onChange={event => setHistoryChoice(event.target.value)}><option value="">Seleccione una fuente</option>{histories.map(([key, row]) => <option key={key} value={key}>{row.year} · {row.source}</option>)}</select></label>
      <button className={buttonStyle} disabled={!histories.some(([key]) => key === historyChoice)} onClick={() => { try { onApplyHistory(historicalBaseline(rows, scope, level, historyChoice)); setMessage('Participación y distribución histórica aplicadas al escenario.'); } catch (error) { setMessage((error as Error).message); } }}>Usar histórico como base</button>
    </div>
    {!histories.length && <p className="text-xs text-amber-200">Faltan resultados históricos verificados para {level} en {scope}. La participación y las listas actuales son supuestos editables.</p>}
    <details className="rounded-xl border border-slate-700 p-3">
      <summary className="cursor-pointer font-semibold text-sm">Gestionar estadísticas, fuentes e importaciones</summary>
      <div className="mt-4 space-y-4">
        <p className="text-xs text-slate-400">Importe datos agregados en CSV. Puede incluir población por edad, pobreza, desempleo y resultados por partido. Los indicadores demográficos describen el territorio; no se convierten automáticamente en preferencias políticas.</p>
        <div className="flex flex-wrap items-center gap-2">
          <label className={`${buttonStyle} cursor-pointer`}>Cargar CSV<input aria-label="Cargar estadísticas CSV" type="file" accept=".csv,text/csv" className="sr-only" onChange={readFile} /></label>
          <button className={buttonStyle} onClick={() => downloadText('plantilla-estadisticas-cesar.csv', CSV_HEADER.join(',') + '\r\n')}>Descargar plantilla</button>
          <button className={buttonStyle} onClick={() => downloadText(`estadisticas-${scope}-${year}.csv`, exportStatisticalCsv(selected))}>Exportar datos del territorio</button>
        </div>
        <p className="text-xs text-slate-400">Indicadores admitidos: {Object.keys(METRICS).join(', ')}. Cargo histórico: {level}. Fecha: AAAA-MM-DD. Números sin separadores de miles.</p>
        {pending.length > 0 && <div className="space-y-2"><div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead><tr>{['Municipio', 'Año', 'Indicador', 'Grupo', 'Valor', 'Fuente'].map(label => <th key={label} className="p-2">{label}</th>)}</tr></thead><tbody>{pending.slice(0, 5).map((row, index) => <tr key={index} className="border-t border-slate-700"><td className="p-2">{row.municipality}</td><td>{row.year}</td><td>{METRICS[row.metric]}</td><td>{row.group || 'Total'}</td><td>{row.value.toLocaleString('es-CO')}</td><td>{row.source}</td></tr>)}</tbody></table></div><button className={buttonStyle} onClick={() => { onImport(pending); setPending([]); setMessage('Datos incorporados en este navegador. Exporte el escenario para trasladarlos a otro equipo.'); }}>Incorporar {pending.length} filas</button><button className="ml-2 text-xs text-slate-400" onClick={() => setPending([])}>Descartar</button></div>}
        <div className="space-y-2">{sources.map(([key, row]) => <div key={key} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-950 p-3 text-xs"><div><a href={safeSourceUrl(row.url)} target="_blank" rel="noreferrer" className="text-cyan-300 underline">{row.source}</a><p className="mt-1 text-slate-400">Referencia: {row.referenceDate} · {row.provenance === 'oficial' ? 'Documento oficial incorporado' : 'Aportada por el usuario; pendiente de verificación'}</p></div>{imported.some(item => sourceIdentity(item) === key) && <button onClick={() => onRemoveSource(key)} className="text-rose-300">Eliminar fuente importada</button>}</div>)}</div>
        {selected.filter(row => ['poblacion_edad', 'pobreza_pct', 'desempleo_pct', 'electoras', 'electores', 'mesas'].includes(row.metric)).length > 0 && <div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead><tr><th className="p-2">Indicador</th><th>Grupo</th><th>Año</th><th>Valor</th><th>Referencia</th></tr></thead><tbody>{selected.filter(row => ['poblacion_edad', 'pobreza_pct', 'desempleo_pct', 'electoras', 'electores', 'mesas'].includes(row.metric) && row.year === year).map((row, index) => <tr key={index} className="border-t border-slate-800"><td className="p-2">{METRICS[row.metric]}</td><td>{row.group || 'Total'}</td><td>{row.year}</td><td>{row.value.toLocaleString('es-CO')}</td><td><a className="text-cyan-300 underline" href={row.url} target="_blank" rel="noreferrer">{row.referenceDate}</a></td></tr>)}</tbody></table></div>}
      </div>
    </details>
    {message && <p role="status" className="text-sm text-amber-200">{message}</p>}
  </section>;
}
export const sourceIdentity = (row: StatisticalRow) => [row.source, row.url, row.referenceDate].join('|');
