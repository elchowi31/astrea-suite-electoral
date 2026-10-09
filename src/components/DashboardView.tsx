import React, { useMemo } from 'react';
import { AlertTriangle, ArrowRight, BadgeCheck, BarChart3, CircleDollarSign, ClipboardCheck, Database, Gauge, MapPinned, ShieldCheck, Sparkles, Target, Truck, Users } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CampaignExpense, Candidate, District, DonorContribution, DriveFileItem, GrassrootsVoter, Leader, Proposal, Tenant, TransportVehicle, UserProfile, UserRole } from '../types';
import { calculateExecutiveAnalytics } from '../lib/analytics';
import { getTerritorialScope } from '../lib/permissions';
import { AuthorHeader } from './common/AuthorHeader';

interface DashboardViewProps {
  currentTenant: Tenant;
  currentUser?: UserProfile | null;
  userRole?: UserRole;
  candidates: Candidate[];
  districts: District[];
  proposals: Proposal[];
  driveFiles: DriveFileItem[];
  expenses?: CampaignExpense[];
  contributions?: DonorContribution[];
  leaders?: Leader[];
  vehicles?: TransportVehicle[];
  voters?: GrassrootsVoter[];
  onNavigateTab: (tab: any) => void;
}

const formatCOP = (value: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value);
const formatNumber = (value: number) => new Intl.NumberFormat('es-CO').format(Math.round(value));
const pieColors = ['#22d3ee', '#38bdf8', '#818cf8', '#a78bfa', '#f59e0b', '#fb7185'];

export const DashboardView: React.FC<DashboardViewProps> = ({
  currentTenant,
  currentUser = null,
  userRole = 'Consulta',
  candidates,
  districts,
  proposals,
  driveFiles,
  expenses = [],
  contributions = [],
  leaders = [],
  vehicles = [],
  voters = [],
  onNavigateTab,
}) => {
  const scope = getTerritorialScope(currentUser, userRole);
  const analytics = useMemo(() => calculateExecutiveAnalytics({ tenant: currentTenant, candidates, leaders, vehicles, expenses, contributions, voters, proposals }), [currentTenant, candidates, leaders, vehicles, expenses, contributions, voters, proposals]);
  const healthTone = analytics.healthScore >= 80 ? 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10' : analytics.healthScore >= 60 ? 'text-amber-300 border-amber-500/30 bg-amber-500/10' : 'text-rose-300 border-rose-500/30 bg-rose-500/10';
  const kpis = [
    { label: 'Cobertura de meta', value: `${analytics.coveragePct.toFixed(1)}%`, detail: `${formatNumber(analytics.projectedSupport)} proyectados · faltan ${formatNumber(analytics.remainingVotes)}`, icon: Target, tone: 'text-cyan-300 bg-cyan-500/10 border-cyan-500/20', progress: analytics.coveragePct, destination: 'zone_projections' },
    { label: 'Equipo activo', value: `${analytics.activeLeaders} líderes`, detail: `${analytics.leadersAtRisk} en seguimiento · productividad ${analytics.leaderProductivity}%`, icon: Users, tone: 'text-indigo-300 bg-indigo-500/10 border-indigo-500/20', progress: analytics.leaderProductivity, destination: 'leaders' },
    { label: 'Capacidad logística', value: `${analytics.transportCoveragePct.toFixed(0)}%`, detail: `${formatNumber(analytics.transportCapacity)} cupos · ${formatNumber(analytics.transportDemand)} solicitudes`, icon: Truck, tone: 'text-amber-300 bg-amber-500/10 border-amber-500/20', progress: analytics.transportCoveragePct, destination: 'transport' },
    { label: 'Saldo operativo', value: formatCOP(analytics.availableBalance), detail: `${formatCOP(analytics.totalSpent)} ejecutados · soportes ${analytics.documentedExpensePct.toFixed(0)}%`, icon: CircleDollarSign, tone: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20', progress: analytics.documentedExpensePct, destination: 'finances' },
  ];
  const severityClass = { critical: 'border-rose-500/30 bg-rose-500/[0.07]', warning: 'border-amber-500/30 bg-amber-500/[0.07]', opportunity: 'border-cyan-500/30 bg-cyan-500/[0.07]', healthy: 'border-emerald-500/30 bg-emerald-500/[0.07]' } as const;

  return (
    <div className="space-y-5 pb-20 md:pb-0">
      <AuthorHeader title="Centro de control" subtitle="Una vista gerencial basada únicamente en los registros de la organización activa" />

      <section className="grid grid-cols-1 xl:grid-cols-[1.35fr_.65fr] gap-4">
        <div className="relative overflow-hidden rounded-3xl border border-cyan-500/20 bg-gradient-to-br from-slate-900 via-slate-900 to-cyan-950/40 p-5 sm:p-6 shadow-2xl">
          <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-cyan-400/10 blur-3xl" />
          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-2xl">
              <div className="mb-3 flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em]">
                <span className="rounded-full border border-cyan-400/25 bg-cyan-400/10 px-2.5 py-1 text-cyan-200">{currentTenant.name}</span>
                <span className="rounded-full border border-slate-700 bg-slate-950/70 px-2.5 py-1 text-slate-300">{scope.scopeLevel}</span>
                <span className="rounded-full border border-slate-700 bg-slate-950/70 px-2.5 py-1 text-slate-300">Confianza {analytics.confidence}</span>
              </div>
              <h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl">{analytics.insights.some((item) => item.severity === 'critical') ? 'Hay decisiones que requieren atención hoy.' : 'La operación está bajo control.'}</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-300">La lectura combina avance territorial, productividad del equipo, capacidad logística, soportes financieros y calidad de los datos. Cada alerta muestra la evidencia que la origina.</p>
            </div>
            <div className={`flex min-w-40 items-center gap-4 self-stretch rounded-2xl border p-4 ${healthTone}`}>
              <div className="relative grid h-20 w-20 shrink-0 place-items-center rounded-full" style={{ background: `conic-gradient(currentColor ${analytics.healthScore * 3.6}deg, rgba(100,116,139,.2) 0deg)` }}>
                <div className="grid h-16 w-16 place-items-center rounded-full bg-slate-950"><span className="text-2xl font-black text-white">{analytics.healthScore}</span></div>
              </div>
              <div><p className="text-[10px] font-black uppercase tracking-wider opacity-80">Salud operativa</p><p className="mt-1 text-xs text-slate-300">Índice explicable de 0 a 100</p></div>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-800 bg-slate-900 p-5 shadow-xl">
          <div className="flex items-center gap-3"><div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-2.5 text-emerald-300"><ShieldCheck className="h-5 w-5" /></div><div><p className="text-xs font-black uppercase tracking-wider text-slate-400">Calidad y gobierno</p><p className="text-lg font-black text-white">{analytics.dataQualityPct}% completo</p></div></div>
          <div className="mt-5 space-y-3 text-xs"><MetricLine label="Soportes de gastos" value={analytics.documentedExpensePct} /><MetricLine label="Propuestas aprobadas" value={analytics.proposalProgressPct} /><MetricLine label="Cobertura logística" value={analytics.transportCoveragePct} /></div>
          <button onClick={() => onNavigateTab('costs_report')} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-xs font-bold text-slate-200 transition hover:border-cyan-500/40 hover:text-white">Ver control administrativo <ArrowRight className="h-3.5 w-3.5" /></button>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => { const Icon = kpi.icon; return (
          <button key={kpi.label} onClick={() => onNavigateTab(kpi.destination)} className="group rounded-2xl border border-slate-800 bg-slate-900 p-4 text-left shadow-lg transition hover:-translate-y-0.5 hover:border-slate-700">
            <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{kpi.label}</p><p className="mt-1 text-xl font-black text-white">{kpi.value}</p></div><div className={`rounded-xl border p-2.5 ${kpi.tone}`}><Icon className="h-5 w-5" /></div></div>
            <p className="mt-2 min-h-8 text-[11px] leading-relaxed text-slate-400">{kpi.detail}</p><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-500" style={{ width: `${Math.min(100, Math.max(0, kpi.progress))}%` }} /></div>
          </button>
        ); })}
      </section>

      <section className="rounded-3xl border border-slate-800 bg-slate-900 p-5 shadow-xl">
        <div className="flex flex-col gap-2 border-b border-slate-800 pb-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><div className="rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 p-2.5 text-white"><Sparkles className="h-5 w-5" /></div><div><h3 className="font-black text-white">Prioridades sugeridas por los datos</h3><p className="text-xs text-slate-400">Reglas estadísticas transparentes; no sustituyen la decisión del equipo.</p></div></div><span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Actualización en tiempo real</span></div>
        <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
          {analytics.insights.map((insight) => (
            <article key={insight.id} className={`rounded-2xl border p-4 ${severityClass[insight.severity]}`}><div className="flex items-start gap-3"><AlertTriangle className={`mt-0.5 h-4 w-4 shrink-0 ${insight.severity === 'critical' ? 'text-rose-400' : insight.severity === 'healthy' ? 'text-emerald-400' : 'text-amber-400'}`} /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="text-[9px] font-black uppercase tracking-wider text-slate-400">{insight.area}</span><h4 className="text-sm font-bold text-white">{insight.title}</h4></div><p className="mt-1 text-xs leading-relaxed text-slate-300">{insight.evidence}</p><p className="mt-2 text-xs leading-relaxed text-cyan-200"><strong>Siguiente paso:</strong> {insight.recommendation}</p><button onClick={() => onNavigateTab(insight.destination)} className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-bold text-white hover:text-cyan-200">Abrir módulo <ArrowRight className="h-3 w-3" /></button></div></div></article>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartCard icon={MapPinned} title="Cobertura por territorio" subtitle="Metas y compromisos registrados, sin valores de relleno">
          {analytics.territoryRows.length > 0 ? <ResponsiveContainer width="100%" height="100%"><BarChart data={analytics.territoryRows.slice(0, 10)} margin={{ top: 8, right: 8, left: -12, bottom: 8 }}><CartesianGrid stroke="#1e293b" vertical={false} /><XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} /><YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} /><Tooltip formatter={(value: any) => `${formatNumber(Number(value))} votos`} contentStyle={{ background: '#020617', border: '1px solid #334155', borderRadius: 12 }} /><Bar dataKey="meta" name="Meta" fill="#334155" radius={[5, 5, 0, 0]} /><Bar dataKey="comprometidos" name="Comprometidos" fill="#22d3ee" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer> : <EmptyChart text="Registre candidatos con territorio y meta de votos para activar esta comparación." />}
        </ChartCard>
        <ChartCard icon={BarChart3} title="Distribución del gasto" subtitle="Participación real por componente operativo">
          {analytics.expenseRows.length > 0 ? <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={analytics.expenseRows.slice(0, 6)} dataKey="value" nameKey="name" innerRadius={58} outerRadius={92} paddingAngle={3}>{analytics.expenseRows.slice(0, 6).map((row, index) => <Cell key={row.name} fill={pieColors[index % pieColors.length]} />)}</Pie><Tooltip formatter={(value: any) => formatCOP(Number(value))} contentStyle={{ background: '#020617', border: '1px solid #334155', borderRadius: 12 }} /></PieChart></ResponsiveContainer> : <EmptyChart text="Registre gastos para visualizar la composición presupuestal." />}
        </ChartCard>
      </section>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-3"><QuickModule icon={Gauge} title="Operación territorial" detail={`${leaders.length} líderes · ${voters.length} registros de base`} onClick={() => onNavigateTab('campaign_structure')} /><QuickModule icon={ClipboardCheck} title="Administración" detail={`${expenses.length} gastos · ${contributions.length} aportes`} onClick={() => onNavigateTab('finances')} /><QuickModule icon={Database} title="Conectividad" detail={`${driveFiles.length} archivos · ${districts.length} territorios`} onClick={() => onNavigateTab('workspace')} /></section>
      <div className="flex flex-col gap-2 rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-[11px] text-slate-500 sm:flex-row sm:items-center sm:justify-between"><span className="flex items-center gap-2"><BadgeCheck className="h-4 w-4 text-emerald-400" /> Aislamiento activo: {scope.scopeTitle}</span><span>La confianza aumenta con volumen, completitud, soportes y verificación.</span></div>
    </div>
  );
};

const MetricLine = ({ label, value }: { label: string; value: number }) => <div><div className="mb-1 flex items-center justify-between"><span className="text-slate-400">{label}</span><strong className="text-white">{value.toFixed(0)}%</strong></div><div className="h-1.5 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-emerald-400" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} /></div></div>;
const ChartCard = ({ icon: Icon, title, subtitle, children }: { icon: any; title: string; subtitle: string; children: React.ReactNode }) => <div className="rounded-3xl border border-slate-800 bg-slate-900 p-5 shadow-xl"><div className="mb-4 flex items-center gap-3 border-b border-slate-800 pb-3"><div className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 p-2 text-cyan-300"><Icon className="h-4 w-4" /></div><div><h3 className="text-sm font-black text-white">{title}</h3><p className="text-[11px] text-slate-400">{subtitle}</p></div></div><div className="h-72">{children}</div></div>;
const EmptyChart = ({ text }: { text: string }) => <div className="grid h-full place-items-center rounded-2xl border border-dashed border-slate-700 bg-slate-950/50 p-6 text-center text-xs text-slate-400">{text}</div>;
const QuickModule = ({ icon: Icon, title, detail, onClick }: { icon: any; title: string; detail: string; onClick: () => void }) => <button onClick={onClick} className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-4 text-left transition hover:border-cyan-500/30 hover:bg-slate-800/80"><div className="rounded-xl bg-slate-800 p-2.5 text-cyan-300"><Icon className="h-5 w-5" /></div><div className="min-w-0 flex-1"><h3 className="text-sm font-bold text-white">{title}</h3><p className="truncate text-[11px] text-slate-400">{detail}</p></div><ArrowRight className="h-4 w-4 text-slate-500" /></button>;
