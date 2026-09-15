import React, { useMemo, useState } from 'react';
import { ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';
import type { CampaignExpense } from '../types';

const money = (n: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', notation: 'compact', maximumFractionDigits: 1 }).format(n);
const fullMoney = (n: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
const control = 'min-h-10 min-w-0 rounded-lg border border-slate-700 bg-slate-950 px-2 text-xs text-slate-200';

export function AdministrativeOverview({ tenantId, expenses }: { tenantId: string; expenses: CampaignExpense[] }) {
  const [phase, setPhase] = useState('');
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [group, setGroup] = useState<'component' | 'phase' | 'status'>('component');
  const scoped = expenses.filter(e => e.tenantId === tenantId);
  const invalidRange = !!(from && to && from > to);
  const rows = scoped.filter(e => !invalidRange && (!phase || (e.phase || 'Sin fase') === phase) && (!status || e.status === status) && (!from || e.date.slice(0, 10) >= from) && (!to || e.date.slice(0, 10) <= to));
  const model = useMemo(() => {
    const groups = new Map<string, { name: string; amount: number; count: number }>();
    const days = new Map<string, { date: string; total: number; paid: number; pending: number; approved: number }>();
    const totals = { total: 0, paid: 0, pending: 0, approved: 0 };
    for (const row of rows) {
      const amount = Number.isFinite(row.amount) ? row.amount : 0;
      const key = row[group] || 'Sin fase';
      const item = groups.get(key) || { name: key, amount: 0, count: 0 };
      item.amount += amount; item.count++; groups.set(key, item);
      const date = row.date.slice(0, 10);
      const day = days.get(date) || { date, total: 0, paid: 0, pending: 0, approved: 0 };
      const state = row.status === 'Pagado' ? 'paid' : row.status === 'Aprobado' ? 'approved' : 'pending';
      day.total += amount; day[state] += amount; totals.total += amount; totals[state] += amount;
      days.set(date, day);
    }
    return { totals, groups: [...groups.values()].sort((a, b) => b.amount - a.amount), days: [...days.values()].sort((a, b) => a.date.localeCompare(b.date)) };
  }, [rows, group]);
  const cards = [ ['Gasto registrado', 'total', '#22d3ee'], ['Pagado', 'paid', '#34d399'], ['Por aprobar', 'pending', '#fbbf24'], ['Aprobado por pagar', 'approved', '#a78bfa'] ] as const;
  return <section className="space-y-3" aria-label="Resumen administrativo">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-base font-bold text-white">Control administrativo</h2>
      <details className="relative text-xs">
        <summary className="cursor-pointer rounded-lg border border-cyan-800 px-3 py-2 text-cyan-300">Filtros{(phase || status || from || to) ? ' · activos' : ''}</summary>
        <div className="absolute right-0 z-20 mt-2 grid w-[min(20rem,85vw)] gap-2 rounded-xl border border-slate-700 bg-slate-900 p-3 shadow-xl">
          <select aria-label="Fase" className={control} value={phase} onChange={e => setPhase(e.target.value)}><option value="">Todas las fases</option>{[...new Set(scoped.map(e => e.phase || 'Sin fase'))].map(p => <option key={p}>{p}</option>)}</select>
          <select aria-label="Estado del gasto" className={control} value={status} onChange={e => setStatus(e.target.value)}><option value="">Todos los estados</option>{['Pagado', 'Pendiente', 'Aprobado'].map(p => <option key={p}>{p}</option>)}</select>
          <label className="grid gap-1 text-slate-300">Desde<input type="date" className={control} value={from} onChange={e => setFrom(e.target.value)} /></label>
          <label className="grid gap-1 text-slate-300">Hasta<input type="date" className={control} value={to} onChange={e => setTo(e.target.value)} /></label>
          <button className={control} onClick={() => { setPhase(''); setStatus(''); setFrom(''); setTo(''); }}>Limpiar filtros</button>
        </div>
      </details>
    </div>
    {invalidRange && <p role="alert" className="text-xs text-amber-300">La fecha final debe ser posterior a la inicial.</p>}
    <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
      {cards.map(([label, key, color]) => <article key={key} className="min-w-0 rounded-xl border border-slate-800 bg-slate-900 p-3">
        <h3 className="text-xs text-slate-300">{label}</h3>
        <p title={fullMoney(model.totals[key])} className="mt-1 text-xl font-black text-white sm:text-2xl">{money(model.totals[key])}</p>
        <div className="mt-2 h-9" role="img" aria-label={`${label} por fecha de registro`}>
          {model.days.length ? <ResponsiveContainer width="100%" height="100%"><AreaChart data={model.days}><Area dataKey={key} stroke={color} fill={color} fillOpacity={0.15} strokeWidth={2} isAnimationActive={false} dot={model.days.length === 1} /></AreaChart></ResponsiveContainer> : <span className="text-[10px] text-slate-500">Sin registros</span>}
        </div>
      </article>)}
    </div>
    <div className="grid gap-3 lg:grid-cols-2">
      <article className="min-w-0 rounded-xl border border-slate-800 bg-slate-900 p-3">
        <h3 className="mb-2 text-sm font-bold text-white">Gasto por fecha</h3>
        <div className="h-44">
          {model.days.length ? <ResponsiveContainer width="100%" height="100%"><AreaChart data={model.days} margin={{ left: 0, right: 12 }}><XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={v => v.slice(5)} minTickGap={30} /><YAxis width={60} tickFormatter={money} tick={{ fontSize: 10, fill: '#94a3b8' }} /><Tooltip formatter={(v: number) => fullMoney(v)} contentStyle={{ background: '#0f172a', borderColor: '#334155', color: 'white' }} /><Area name="Gasto" dataKey="total" stroke="#22d3ee" fill="#22d3ee" fillOpacity={0.12} /></AreaChart></ResponsiveContainer> : <p className="py-12 text-center text-sm text-slate-500">Sin gastos en este período</p>}
        </div>
      </article>
      <article className="min-w-0 rounded-xl border border-slate-800 bg-slate-900 p-3">
        <div className="mb-2 flex items-center justify-between gap-2"><h3 className="text-sm font-bold text-white">Distribución del gasto</h3><select aria-label="Agrupar gastos" className={control} value={group} onChange={e => setGroup(e.target.value as typeof group)}><option value="component">Componente</option><option value="phase">Fase</option><option value="status">Estado</option></select></div>
        <div className="h-40">{model.groups.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={model.groups.slice(0, 6)} layout="vertical" margin={{ right: 8 }}><XAxis type="number" hide /><YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 10, fill: '#cbd5e1' }} /><Tooltip formatter={(v: number) => fullMoney(v)} contentStyle={{ background: '#0f172a', color: 'white' }} /><Bar name="Gasto" dataKey="amount" fill="#818cf8" radius={[0, 4, 4, 0]} /></BarChart></ResponsiveContainer> : <p className="py-12 text-center text-sm text-slate-500">Sin registros</p>}</div>
        <details className="mt-2 text-xs text-slate-300"><summary className="cursor-pointer">Ver tabla · {rows.length} registros</summary><div className="mt-2 max-h-60 overflow-auto"><table className="w-full text-left"><thead><tr><th scope="col">Grupo</th><th scope="col">Registros</th><th scope="col">COP</th></tr></thead><tbody>{model.groups.map(g => <tr key={g.name} className="border-t border-slate-800"><th scope="row" className="py-2 font-normal">{g.name}</th><td>{g.count}</td><td>{fullMoney(g.amount)}</td></tr>)}</tbody></table></div></details>
      </article>
    </div>
  </section>;
}
