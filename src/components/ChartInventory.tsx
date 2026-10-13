import React from 'react';
import type {DemoBundle} from '../data/demoSeed';
import {chartCoverage} from '../data/chartInventory';
export function ChartInventory({bundle}:{bundle:DemoBundle}) {
  const rows=chartCoverage(bundle);
  return <details className="mt-3 rounded-xl border border-slate-700 bg-slate-900 p-3" aria-label="Inventario de gráficos"><summary className="cursor-pointer font-semibold text-cyan-300">Inventario de gráficos · {rows.length} visualizaciones</summary><p className="my-3 text-xs text-slate-400">Cada fila identifica una visualización y su fuente. Los filtros pueden reducir los resultados. El simulador estadístico conserva sus fuentes publicadas y los supuestos del escenario.</p><div className="max-h-96 overflow-auto"><table className="w-full text-left text-xs"><thead><tr>{['Módulo','Gráfico','Tipo','Fuente disponible'].map(label=><th key={label} className="p-2 text-slate-400">{label}</th>)}</tr></thead><tbody>{rows.map(row=><tr key={row.id} className="border-t border-slate-800"><td className="p-2">{row.module}</td><td className="p-2">{row.title}</td><td className="p-2 text-slate-400">{row.type}</td><td className={`p-2 ${row.records===0?'text-amber-300':'text-emerald-300'}`}>{row.records===null?'Referencias estadísticas y escenario':row.records?`${row.records} registros`:'Sin datos para este gráfico'}</td></tr>)}</tbody></table></div></details>;
}
