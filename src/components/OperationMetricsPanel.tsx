import React,{useEffect,useState} from 'react';
import {operationMetricsSummary} from '../lib/operationMetrics';
import {MODULE_LABELS,type ActiveTab} from '../lib/moduleNavigation';
export function OperationMetricsPanel(){
 const [summary,setSummary]=useState(operationMetricsSummary);
 useEffect(()=>{const update=()=>setSummary(operationMetricsSummary());window.addEventListener('astrea:operation-metrics',update);return()=>window.removeEventListener('astrea:operation-metrics',update);},[]);
 return <section className="space-y-3 rounded-xl border border-slate-700 p-4"><h2 className="font-bold">Medición de esta sesión</h2><p className="text-sm text-slate-400">{summary.note} Solo se guardan temporalmente módulo, resultado y duración; no se incluyen nombres, documentos, contactos o contenidos del formulario.</p><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th>Módulo</th><th>Completados</th><th>Errores</th><th>Mediana</th><th>P95</th></tr></thead><tbody>{summary.modules.map(row=><tr key={row.module} className="border-t border-slate-800"><td className="py-2">{MODULE_LABELS[row.module as ActiveTab]||row.module}</td><td>{row.completed}</td><td>{row.errors}</td><td>{row.medianMs===null?'—':row.medianMs+' ms'}</td><td>{row.p95Ms===null?'—':row.p95Ms+' ms'}</td></tr>)}</tbody></table></div>{!summary.samples&&<p className="text-sm text-slate-400">Aún no hay operaciones de formulario medidas en esta sesión.</p>}</section>;
}
