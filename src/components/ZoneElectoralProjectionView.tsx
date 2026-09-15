import React, { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertTriangle, Bus, DollarSign, MapPin, Target, TrendingUp, Users } from 'lucide-react';
import { CampaignExpense, Candidate, Leader, Tenant, TransportVehicle, UserProfile, UserRole } from '../types';
import { getTerritorialScope } from '../lib/permissions';

interface ZoneElectoralProjectionViewProps {
  currentTenant: Tenant;
  currentUser?: UserProfile | null;
  userRole?: UserRole;
  leaders: Leader[];
  expenses: CampaignExpense[];
  vehicles: TransportVehicle[];
  candidates: Candidate[];
}

const COLORS = ['#22c55e', '#38bdf8', '#f59e0b', '#a78bfa', '#fb7185', '#14b8a6'];
const money = (value: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value);

export const ZoneElectoralProjectionView: React.FC<ZoneElectoralProjectionViewProps> = ({
  currentTenant,
  currentUser = null,
  userRole = 'Consulta',
  leaders = [],
  expenses = [],
  vehicles = [],
  candidates = [],
}) => {
  const scope = getTerritorialScope(currentUser, userRole);
  const [selectedMunicipality, setSelectedMunicipality] = useState('todos');

  const allowedMunicipality = scope.canViewAllMunicipalities ? null : scope.allowedMunicipality;
  const scopedLeaders = allowedMunicipality ? leaders.filter((item) => item.municipality === allowedMunicipality) : leaders;
  const scopedExpenses = allowedMunicipality ? expenses.filter((item) => item.municipality === allowedMunicipality) : expenses;
  const scopedVehicles = allowedMunicipality ? vehicles.filter((item) => item.municipality === allowedMunicipality) : vehicles;
  const scopedCandidates = allowedMunicipality ? candidates.filter((item) => item.municipality === allowedMunicipality) : candidates;

  const municipalities = useMemo(() => Array.from(new Set([
    ...scopedLeaders.map((item) => item.municipality),
    ...scopedExpenses.map((item) => item.municipality),
    ...scopedVehicles.map((item) => item.municipality),
    ...scopedCandidates.map((item) => item.municipality),
  ].filter((item): item is string => Boolean(item)))).sort(), [scopedLeaders, scopedExpenses, scopedVehicles, scopedCandidates]);

  const rows = useMemo(() => municipalities.map((municipality) => {
    const zoneLeaders = scopedLeaders.filter((item) => item.municipality === municipality);
    const zoneCandidates = scopedCandidates.filter((item) => item.municipality === municipality);
    const zoneExpenses = scopedExpenses.filter((item) => item.municipality === municipality);
    const zoneVehicles = scopedVehicles.filter((item) => item.municipality === municipality);
    const leaderTarget = zoneLeaders.reduce((sum, item) => sum + Math.max(0, item.voteTarget || 0), 0);
    const candidateTarget = zoneCandidates.reduce((sum, item) => sum + Math.max(0, item.voteTarget || 0), 0);
    const leaderCommitted = zoneLeaders.reduce((sum, item) => sum + Math.max(0, item.votesCommitted || 0), 0);
    const candidateCommitted = zoneCandidates.reduce((sum, item) => sum + Math.max(0, item.votesCommitted || 0), 0);
    const target = leaderTarget || candidateTarget;
    const committed = leaderCommitted || candidateCommitted;
    const investment = zoneExpenses.reduce((sum, item) => sum + Math.max(0, item.amount || 0), 0);
    return {
      municipality,
      leaders: zoneLeaders.length,
      vehicles: zoneVehicles.length,
      capacity: zoneVehicles.reduce((sum, item) => sum + Math.max(0, item.capacity || 0), 0),
      target,
      committed,
      investment,
      progress: target ? Math.min(100, Math.round((committed / target) * 100)) : 0,
      costPerCommitted: committed ? Math.round(investment / committed) : 0,
    };
  }), [municipalities, scopedLeaders, scopedCandidates, scopedExpenses, scopedVehicles]);

  const visibleRows = selectedMunicipality === 'todos' ? rows : rows.filter((item) => item.municipality === selectedMunicipality);
  const selectedExpenses = selectedMunicipality === 'todos' ? scopedExpenses : scopedExpenses.filter((item) => item.municipality === selectedMunicipality);
  const expenseBreakdown = useMemo(() => {
    const grouped = new Map<string, number>();
    selectedExpenses.forEach((item) => grouped.set(item.component || 'Sin clasificar', (grouped.get(item.component || 'Sin clasificar') || 0) + Math.max(0, item.amount || 0)));
    return Array.from(grouped.entries()).map(([name, value], index) => ({ name, value, color: COLORS[index % COLORS.length] })).sort((a, b) => b.value - a.value);
  }, [selectedExpenses]);

  const totals = visibleRows.reduce((acc, item) => ({
    target: acc.target + item.target,
    committed: acc.committed + item.committed,
    investment: acc.investment + item.investment,
    leaders: acc.leaders + item.leaders,
    vehicles: acc.vehicles + item.vehicles,
  }), { target: 0, committed: 0, investment: 0, leaders: 0, vehicles: 0 });
  const progress = totals.target ? Math.min(100, Math.round((totals.committed / totals.target) * 100)) : 0;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900 p-5 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 p-2.5 text-blue-300"><TrendingUp className="h-6 w-6" /></div>
          <div>
            <h2 className="text-xl font-bold text-white">Desempeño territorial</h2>
            <p className="text-xs text-slate-400">Metas, compromisos, gasto y capacidad construidos con registros de {currentTenant.name}.</p>
          </div>
        </div>
        <label className="text-xs text-slate-400">
          Municipio
          <select value={allowedMunicipality || selectedMunicipality} disabled={Boolean(allowedMunicipality)} onChange={(event) => setSelectedMunicipality(event.target.value)} className="ml-2 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-200 disabled:opacity-60">
            {!allowedMunicipality && <option value="todos">Todos</option>}
            {municipalities.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Metric icon={<Target />} label="Meta" value={totals.target.toLocaleString('es-CO')} tone="text-blue-300" />
        <Metric icon={<TrendingUp />} label="Comprometidos" value={totals.committed.toLocaleString('es-CO')} tone="text-emerald-300" />
        <Metric icon={<DollarSign />} label="Gasto registrado" value={money(totals.investment)} tone="text-amber-300" />
        <Metric icon={<Users />} label="Líderes" value={String(totals.leaders)} tone="text-purple-300" />
        <Metric icon={<Bus />} label="Vehículos" value={String(totals.vehicles)} tone="text-cyan-300" />
      </div>

      {!visibleRows.length ? (
        <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/60 p-10 text-center">
          <MapPin className="mx-auto h-8 w-8 text-slate-500" />
          <h3 className="mt-3 font-bold text-white">Aún no hay datos territoriales</h3>
          <p className="mt-1 text-sm text-slate-400">Registre municipio en candidatos, líderes, gastos o vehículos para activar este análisis.</p>
        </div>
      ) : (
        <>
          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {visibleRows.map((row) => (
              <article key={row.municipality} className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div><p className="text-xs font-bold uppercase tracking-wide text-blue-300">{row.municipality}</p><p className="mt-1 text-[11px] text-slate-500">{row.leaders} líderes · {row.vehicles} vehículos · {row.capacity} plazas/salida</p></div>
                  <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-xs font-bold text-emerald-300">{row.progress}%</span>
                </div>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${row.progress}%` }} /></div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-xs"><div><span className="text-slate-500">Meta</span><p className="font-mono font-bold text-white">{row.target.toLocaleString('es-CO')}</p></div><div><span className="text-slate-500">Comprometidos</span><p className="font-mono font-bold text-emerald-300">{row.committed.toLocaleString('es-CO')}</p></div><div><span className="text-slate-500">Gasto</span><p className="font-mono font-bold text-amber-300">{money(row.investment)}</p></div><div><span className="text-slate-500">Costo/compromiso</span><p className="font-mono font-bold text-purple-300">{row.costPerCommitted ? money(row.costPerCommitted) : 'Sin base'}</p></div></div>
              </article>
            ))}
          </section>

          <section className="grid gap-5 lg:grid-cols-2">
            <ChartCard title="Meta y compromisos por municipio">
              <ResponsiveContainer width="100%" height="100%"><BarChart data={visibleRows}><CartesianGrid stroke="#1e293b" vertical={false} /><XAxis dataKey="municipality" stroke="#64748b" fontSize={10} /><YAxis stroke="#64748b" fontSize={10} /><Tooltip contentStyle={{ background: '#020617', border: '1px solid #334155', borderRadius: 12 }} /><Legend /><Bar dataKey="target" name="Meta" fill="#3b82f6" radius={[4, 4, 0, 0]} /><Bar dataKey="committed" name="Comprometidos" fill="#22c55e" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer>
            </ChartCard>
            <ChartCard title="Gasto real por componente">
              {expenseBreakdown.length ? <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={expenseBreakdown} dataKey="value" nameKey="name" innerRadius={45} outerRadius={85}>{expenseBreakdown.map((item) => <Cell key={item.name} fill={item.color} />)}</Pie><Tooltip formatter={(value: any) => money(Number(value))} contentStyle={{ background: '#020617', border: '1px solid #334155', borderRadius: 12 }} /><Legend wrapperStyle={{ fontSize: 10 }} /></PieChart></ResponsiveContainer> : <div className="flex h-full items-center justify-center text-center text-xs text-slate-500">No hay gastos clasificados para el filtro.</div>}
            </ChartCard>
          </section>

          {progress > 100 && <p className="flex items-center gap-2 text-xs text-amber-300"><AlertTriangle className="h-4 w-4" />Los compromisos superan la meta; revise duplicados o actualice el objetivo.</p>}
        </>
      )}
    </div>
  );
};

const Metric: React.FC<{ icon: React.ReactElement; label: string; value: string; tone: string }> = ({ icon, label, value, tone }) => (
  <div className="rounded-xl border border-slate-800 bg-slate-900 p-4"><div className={`flex items-center gap-2 ${tone}`}>{React.cloneElement(icon, { className: 'h-4 w-4' })}<span className="text-[11px] text-slate-400">{label}</span></div><p className={`mt-2 truncate text-xl font-bold ${tone}`}>{value}</p></div>
);

const ChartCard: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4"><h3 className="text-xs font-bold uppercase tracking-wide text-slate-300">{title}</h3><div className="mt-3 h-72">{children}</div></div>
);
