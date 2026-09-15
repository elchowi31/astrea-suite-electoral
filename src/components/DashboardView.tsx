import React, { useMemo, useState } from 'react';
import { Activity, ArrowDownRight, ArrowUpRight, CircleDollarSign, Filter, MapPinned, Target, Truck, Users, Vote } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CampaignExpense, Candidate, District, DonorContribution, DriveFileItem, GrassrootsVoter, Leader, Proposal, Tenant, TransportVehicle, UserProfile, UserRole } from '../types';
import { calculateExecutiveAnalytics } from '../lib/analytics';

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

const COLORS = ['#22d3ee', '#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#f43f5e'];
const formatCOP = (value: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', notation: Math.abs(value) >= 1_000_000 ? 'compact' : 'standard', maximumFractionDigits: 1 }).format(value);
const formatNumber = (value: number) => new Intl.NumberFormat('es-CO').format(Math.round(value));
const normalize = (value?: string) => (value || '').trim().toLocaleLowerCase('es-CO');
const pct = (value: number, total: number) => total > 0 ? Math.min(100, Math.max(0, (value / total) * 100)) : 0;

const uniqueVoters = (rows: GrassrootsVoter[]) => {
  const unique = new Map<string, GrassrootsVoter>();
  rows.forEach((row) => {
    const key = normalize(row.documentNumber) || row.id;
    const previous = unique.get(key);
    if (!previous || new Date(row.registeredAt).getTime() >= new Date(previous.registeredAt).getTime()) unique.set(key, row);
  });
  return [...unique.values()];
};

export const DashboardView: React.FC<DashboardViewProps> = ({ currentTenant, candidates, districts, proposals, expenses = [], contributions = [], leaders = [], vehicles = [], voters = [], onNavigateTab }) => {
  const tenantCandidates = candidates.filter((row) => row.tenantId === currentTenant.tenantId);
  const tenantDistricts = districts.filter((row) => row.tenantId === currentTenant.tenantId);
  const tenantLeaders = leaders.filter((row) => row.tenantId === currentTenant.tenantId);
  const tenantVehicles = vehicles.filter((row) => row.tenantId === currentTenant.tenantId);
  const tenantExpenses = expenses.filter((row) => row.tenantId === currentTenant.tenantId);
  const tenantContributions = contributions.filter((row) => row.tenantId === currentTenant.tenantId);
  const tenantVoters = voters.filter((row) => row.tenantId === currentTenant.tenantId);
  const tenantProposals = proposals.filter((row) => row.tenantId === currentTenant.tenantId);

  const territories = useMemo(() => {
    const values = new Set<string>();
    tenantDistricts.forEach((row) => row.name && values.add(row.name));
    tenantCandidates.forEach((row) => row.municipality && values.add(row.municipality));
    tenantLeaders.forEach((row) => row.municipality && values.add(row.municipality));
    tenantVoters.forEach((row) => row.municipality && values.add(row.municipality));
    return ['Todos los territorios', ...[...values].sort((a, b) => a.localeCompare(b, 'es'))];
  }, [tenantCandidates, tenantDistricts, tenantLeaders, tenantVoters]);

  const [territory, setTerritory] = useState('Todos los territorios');
  const allTerritories = territory === 'Todos los territorios';
  const matches = (value?: string) => allTerritories || normalize(value) === normalize(territory);
  const scopedCandidates = tenantCandidates.filter((row) => matches(row.municipality));
  const scopedDistricts = tenantDistricts.filter((row) => matches(row.name));
  const scopedLeaders = tenantLeaders.filter((row) => matches(row.municipality));
  const scopedVehicles = tenantVehicles.filter((row) => matches(row.municipality));
  const scopedExpenses = tenantExpenses.filter((row) => matches(row.municipality));
  const scopedContributions = tenantContributions.filter((row) => matches(row.municipality));
  const scopedVoters = uniqueVoters(tenantVoters.filter((row) => matches(row.municipality)));

  const analytics = useMemo(() => calculateExecutiveAnalytics({ tenant: currentTenant, candidates: scopedCandidates, leaders: scopedLeaders, vehicles: scopedVehicles, expenses: scopedExpenses, contributions: scopedContributions, voters: scopedVoters, proposals: tenantProposals }), [currentTenant, scopedCandidates, scopedLeaders, scopedVehicles, scopedExpenses, scopedContributions, scopedVoters, tenantProposals]);
  const confirmed = scopedVoters.filter((row) => row.verified && row.supportLevel >= 4).length;
  const undecided = scopedVoters.filter((row) => row.supportLevel === 3 || (!row.verified && row.supportLevel >= 3)).length;
  const verified = scopedVoters.filter((row) => row.verified).length;
  const managedBase = scopedVoters.length;
  const voteTarget = scopedCandidates.reduce((sum, row) => sum + Math.max(0, row.voteTarget || 0), 0) || scopedLeaders.reduce((sum, row) => sum + Math.max(0, row.voteTarget || 0), 0);
  const electoralPotential = scopedDistricts.reduce((sum, row) => sum + Math.max(0, row.voterCensus || 0), 0);
  const transportDemand = scopedVoters.filter((row) => row.requiresTransport).length;
  const transportCapacity = scopedVehicles.filter((row) => row.status === 'Operativo - Día D' || row.status === 'Reservado').reduce((sum, row) => sum + Math.max(0, row.capacity || 0), 0);
  const transportDeficit = Math.max(0, transportDemand - transportCapacity);
  const logisticExpenses = scopedExpenses.filter((row) => ['Transporte y Movilización', 'Combustible', 'Alimentación y Refrigerios'].includes(row.component));
  const logisticCost = logisticExpenses.reduce((sum, row) => sum + Math.max(0, row.amount || 0), 0);
  const costPerConfirmed = confirmed > 0 ? logisticCost / confirmed : 0;
  const conversionRate = pct(confirmed, confirmed + undecided);
  const funnelData = [{ name: 'Base gestionada', value: managedBase, fill: '#334155' }, { name: 'Verificados', value: verified, fill: '#3b82f6' }, { name: 'Confirmados', value: confirmed, fill: '#22d3ee' }];
  const transportData = transportDemand > 0 ? [{ name: 'Cubiertos', value: Math.min(transportDemand, transportCapacity), fill: '#10b981' }, { name: 'Déficit', value: transportDeficit, fill: '#f43f5e' }] : [{ name: 'Sin solicitudes', value: 1, fill: '#334155' }];

  const logisticsData = useMemo(() => {
    const totals = new Map<string, number>();
    logisticExpenses.forEach((row) => totals.set(row.component, (totals.get(row.component) || 0) + row.amount));
    return [...totals.entries()].map(([name, value]) => ({ name: name.replace(' y ', ' + '), value }));
  }, [logisticExpenses]);

  const territoryData = useMemo(() => {
    const names = new Set<string>();
    scopedDistricts.forEach((row) => names.add(row.name));
    scopedCandidates.forEach((row) => names.add(row.municipality || row.district));
    scopedLeaders.forEach((row) => row.municipality && names.add(row.municipality));
    return [...names].map((name) => {
      const localCandidates = scopedCandidates.filter((row) => normalize(row.municipality || row.district) === normalize(name));
      const localLeaders = scopedLeaders.filter((row) => normalize(row.municipality) === normalize(name));
      const localVoters = scopedVoters.filter((row) => normalize(row.municipality) === normalize(name));
      const meta = localCandidates.reduce((sum, row) => sum + Math.max(0, row.voteTarget || 0), 0) || localLeaders.reduce((sum, row) => sum + Math.max(0, row.voteTarget || 0), 0);
      const candidateVotes = localCandidates.reduce((sum, row) => sum + Math.max(0, row.votesCommitted || 0), 0);
      const leaderVotes = localLeaders.reduce((sum, row) => sum + Math.max(0, row.votesCommitted || 0), 0);
      const verifiedVotes = localVoters.filter((row) => row.verified && row.supportLevel >= 4).length;
      return { name, meta, confirmados: Math.max(candidateVotes, leaderVotes, verifiedVotes) };
    }).filter((row) => row.meta > 0 || row.confirmados > 0).sort((a, b) => b.confirmados - a.confirmados).slice(0, 8);
  }, [scopedCandidates, scopedDistricts, scopedLeaders, scopedVoters]);

  const leaderRanking = useMemo(() => scopedLeaders.map((row) => ({ id: row.id, name: row.fullName, votes: row.votesCommitted, progress: pct(row.votesCommitted, row.voteTarget) })).sort((a, b) => b.votes - a.votes).slice(0, 7), [scopedLeaders]);
  const latestUpdate = useMemo(() => {
    const dates = [...scopedCandidates.map((row) => row.updatedAt), ...scopedVoters.map((row) => row.registeredAt), ...scopedExpenses.map((row) => row.date)].map((value) => new Date(value).getTime()).filter(Number.isFinite);
    return dates.length ? new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(Math.max(...dates))) : 'Sin registros';
  }, [scopedCandidates, scopedExpenses, scopedVoters]);

  return (
    <div className="space-y-4 pb-20 md:pb-8 animate-fade-in">
      <section className="relative overflow-hidden rounded-3xl border border-cyan-500/25 bg-gradient-to-r from-slate-950 via-[#071426] to-slate-950 p-4 shadow-2xl sm:p-5">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300 to-transparent" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div><div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-cyan-300"><Activity className="h-3.5 w-3.5" /> Centro de Dirección Electoral</div><h2 className="mt-1 text-xl font-black text-white sm:text-2xl">{currentTenant.name}</h2></div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-xs text-slate-300"><Filter className="h-3.5 w-3.5 text-cyan-400" /><select value={territory} onChange={(event) => setTerritory(event.target.value)} className="min-w-44 bg-transparent font-bold text-white outline-none" aria-label="Filtrar tablero por territorio">{territories.map((item) => <option key={item} value={item} className="bg-slate-900">{item}</option>)}</select></label>
            <span className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-[10px] font-mono text-slate-400">Actualizado {latestUpdate}</span>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <MetricCard title="Confirmados únicos" value={formatNumber(confirmed)} icon={Vote} tone="cyan" onClick={() => onNavigateTab('hierarchy_pyramid')} />
        <MetricCard title="Indecisos" value={formatNumber(undecided)} icon={Users} tone="amber" badge={`${conversionRate.toFixed(0)}% conversión`} onClick={() => onNavigateTab('hierarchy_pyramid')} />
        <MetricCard title="Avance de meta" value={`${pct(confirmed, voteTarget).toFixed(1)}%`} icon={Target} tone="blue" badge={`${formatNumber(Math.max(0, voteTarget - confirmed))} faltan`} onClick={() => onNavigateTab('zone_projections')} />
        <MetricCard title="Potencial electoral" value={formatNumber(electoralPotential)} icon={MapPinned} tone="violet" badge="Censo territorial" onClick={() => onNavigateTab('districts')} />
        <MetricCard title="Déficit transporte" value={formatNumber(transportDeficit)} icon={Truck} tone={transportDeficit > 0 ? 'rose' : 'emerald'} badge={`${formatNumber(transportCapacity)} cupos`} onClick={() => onNavigateTab('transport')} />
        <MetricCard title="Costo logístico" value={formatCOP(logisticCost)} icon={CircleDollarSign} tone="emerald" badge={`${formatCOP(costPerConfirmed)} / voto`} onClick={() => onNavigateTab('finances')} />
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <ChartCard title="Avance territorial" className="xl:col-span-7"><div className="h-72">{territoryData.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={territoryData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}><CartesianGrid stroke="#1e293b" vertical={false} strokeDasharray="3 3" /><XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} /><YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} /><Tooltip content={<DashboardTooltip formatter={formatNumber} />} /><Bar dataKey="meta" name="Meta" fill="#334155" radius={[5, 5, 0, 0]} /><Bar dataKey="confirmados" name="Confirmados" fill="#22d3ee" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer> : <EmptyChart label="Sin metas territoriales" />}</div></ChartCard>
        <ChartCard title="Embudo electoral" value={`${conversionRate.toFixed(0)}% conversión`} className="xl:col-span-5"><div className="h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={funnelData} layout="vertical" margin={{ top: 16, right: 28, left: 18, bottom: 8 }}><CartesianGrid stroke="#1e293b" horizontal={false} strokeDasharray="3 3" /><XAxis type="number" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} /><YAxis type="category" dataKey="name" width={100} stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} /><Tooltip content={<DashboardTooltip formatter={formatNumber} />} /><Bar dataKey="value" name="Personas" radius={[0, 7, 7, 0]}>{funnelData.map((row) => <Cell key={row.name} fill={row.fill} />)}</Bar></BarChart></ResponsiveContainer></div></ChartCard>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-12">
        <ChartCard title="Cobertura de transporte" value={`${analytics.transportCoveragePct.toFixed(0)}%`} className="xl:col-span-3"><Donut data={transportData} centerValue={transportDemand ? formatNumber(transportDemand) : '0'} centerLabel="solicitudes" /></ChartCard>
        <ChartCard title="Costos logísticos" value={formatCOP(logisticCost)} className="xl:col-span-4">{logisticsData.length ? <Donut data={logisticsData} centerValue={formatCOP(costPerConfirmed)} centerLabel="por voto" currency /> : <EmptyChart label="Sin costos registrados" />}</ChartCard>
        <ChartCard title="Ranking de líderes" value={`${leaderRanking.length} visibles`} className="md:col-span-2 xl:col-span-5"><div className="space-y-3 pt-2">{leaderRanking.length ? leaderRanking.map((row, index) => <button key={row.id} type="button" onClick={() => onNavigateTab('leaders')} className="group grid w-full grid-cols-[28px_1fr_auto] items-center gap-3 text-left"><span className="grid h-7 w-7 place-items-center rounded-lg bg-slate-800 text-[10px] font-black text-slate-400">{index + 1}</span><span className="min-w-0"><span className="flex items-center justify-between gap-3 text-xs"><span className="truncate font-bold text-white group-hover:text-cyan-300">{row.name}</span><span className="text-slate-500">{row.progress.toFixed(0)}%</span></span><span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-slate-800"><span className="block h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400" style={{ width: `${row.progress}%` }} /></span></span><span className="text-sm font-black text-cyan-300">{formatNumber(row.votes)}</span></button>) : <EmptyChart label="Sin líderes registrados" />}</div></ChartCard>
      </section>

      <section className="grid grid-cols-2 gap-3 rounded-2xl border border-slate-800 bg-slate-950/60 p-3 text-center sm:grid-cols-4">
        <MiniStat label="Salud de campaña" value={`${analytics.healthScore}/100`} positive={analytics.healthScore >= 60} />
        <MiniStat label="Calidad de datos" value={`${analytics.dataQualityPct}%`} positive={analytics.dataQualityPct >= 80} />
        <MiniStat label="Líderes activos" value={formatNumber(analytics.activeLeaders)} positive />
        <MiniStat label="Balance disponible" value={formatCOP(analytics.availableBalance)} positive={analytics.availableBalance >= 0} />
      </section>
    </div>
  );
};

const toneClasses: Record<string, string> = { cyan: 'border-cyan-500/25 bg-cyan-500/10 text-cyan-300', blue: 'border-blue-500/25 bg-blue-500/10 text-blue-300', violet: 'border-violet-500/25 bg-violet-500/10 text-violet-300', amber: 'border-amber-500/25 bg-amber-500/10 text-amber-300', emerald: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300', rose: 'border-rose-500/25 bg-rose-500/10 text-rose-300' };
const MetricCard: React.FC<{ title: string; value: string; badge?: string; icon: any; tone: string; onClick: () => void }> = ({ title, value, badge, icon: Icon, tone, onClick }) => <button type="button" onClick={onClick} className="group min-w-0 rounded-2xl border border-slate-800 bg-slate-900/80 p-3.5 text-left shadow-lg transition hover:-translate-y-0.5 hover:border-cyan-500/35"><div className="flex items-center justify-between gap-2"><span className="truncate text-[10px] font-black uppercase tracking-wider text-slate-400">{title}</span><span className={`rounded-lg border p-1.5 ${toneClasses[tone]}`}><Icon className="h-3.5 w-3.5" /></span></div><div className="mt-2 truncate text-xl font-black text-white sm:text-2xl">{value}</div>{badge && <div className="mt-1 truncate text-[10px] font-semibold text-slate-500">{badge}</div>}</button>;
const ChartCard: React.FC<{ title: string; value?: string; className?: string; children: React.ReactNode }> = ({ title, value, className = '', children }) => <article className={`rounded-3xl border border-slate-800 bg-slate-900/80 p-4 shadow-xl ${className}`}><header className="flex items-center justify-between gap-3 border-b border-slate-800 pb-3"><h3 className="text-xs font-black uppercase tracking-wider text-slate-300">{title}</h3>{value && <span className="text-xs font-black text-cyan-300">{value}</span>}</header>{children}</article>;
const Donut: React.FC<{ data: Array<{ name: string; value: number; fill?: string }>; centerValue: string; centerLabel: string; currency?: boolean }> = ({ data, centerValue, centerLabel, currency }) => <div className="relative h-64"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={data} dataKey="value" nameKey="name" innerRadius={62} outerRadius={88} paddingAngle={4}>{data.map((row, index) => <Cell key={row.name} fill={row.fill || COLORS[index % COLORS.length]} />)}</Pie><Tooltip content={<DashboardTooltip formatter={currency ? formatCOP : formatNumber} />} /></PieChart></ResponsiveContainer><div className="pointer-events-none absolute inset-0 grid place-content-center text-center"><strong className="text-xl font-black text-white">{centerValue}</strong><span className="text-[10px] uppercase tracking-wider text-slate-500">{centerLabel}</span></div></div>;
const DashboardTooltip = ({ active, payload, label, formatter }: any) => !active || !payload?.length ? null : <div className="rounded-xl border border-slate-700 bg-slate-950/95 px-3 py-2 text-xs text-white shadow-2xl">{label && <div className="mb-1 font-bold text-slate-300">{label}</div>}{payload.map((item: any) => <div key={`${item.name}-${item.value}`} style={{ color: item.color || item.payload?.fill }}>{item.name}: {formatter(Number(item.value))}</div>)}</div>;
const EmptyChart: React.FC<{ label: string }> = ({ label }) => <div className="grid h-full min-h-40 place-items-center text-xs font-semibold text-slate-600">{label}</div>;
const MiniStat: React.FC<{ label: string; value: string; positive: boolean }> = ({ label, value, positive }) => <div className="min-w-0 rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2"><div className="truncate text-[9px] font-black uppercase tracking-wider text-slate-500">{label}</div><div className={`mt-1 flex items-center justify-center gap-1 text-sm font-black ${positive ? 'text-emerald-300' : 'text-rose-300'}`}>{positive ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}{value}</div></div>;
