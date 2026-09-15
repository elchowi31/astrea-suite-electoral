import {
  CampaignExpense,
  Candidate,
  DonorContribution,
  GrassrootsVoter,
  Leader,
  Proposal,
  Tenant,
  TransportVehicle,
} from '../types';

export type InsightSeverity = 'critical' | 'warning' | 'opportunity' | 'healthy';

export interface PredictiveInsight {
  id: string;
  severity: InsightSeverity;
  area: 'Territorio' | 'Equipo' | 'Finanzas' | 'Logística' | 'Datos';
  title: string;
  evidence: string;
  recommendation: string;
  destination: string;
}

export interface ExecutiveAnalytics {
  healthScore: number;
  confidence: 'Baja' | 'Media' | 'Alta';
  coveragePct: number;
  committedVotes: number;
  projectedSupport: number;
  remainingVotes: number;
  activeLeaders: number;
  leadersAtRisk: number;
  leaderProductivity: number;
  transportDemand: number;
  transportCapacity: number;
  transportCoveragePct: number;
  totalSpent: number;
  totalIncome: number;
  availableBalance: number;
  pendingExpenses: number;
  documentedExpensePct: number;
  dataQualityPct: number;
  proposalProgressPct: number;
  insights: PredictiveInsight[];
  territoryRows: Array<{ name: string; meta: number; comprometidos: number; cobertura: number }>;
  expenseRows: Array<{ name: string; value: number }>;
}

const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));
const ratio = (value: number, total: number) => (total > 0 ? (value / total) * 100 : 0);

export function calculateExecutiveAnalytics(input: {
  tenant: Tenant;
  candidates: Candidate[];
  leaders: Leader[];
  vehicles: TransportVehicle[];
  expenses: CampaignExpense[];
  contributions: DonorContribution[];
  voters: GrassrootsVoter[];
  proposals: Proposal[];
}): ExecutiveAnalytics {
  const { tenant } = input;
  const inTenant = <T extends { tenantId: string }>(rows: T[]) => rows.filter((row) => row.tenantId === tenant.tenantId);
  const candidates = inTenant(input.candidates);
  const leaders = inTenant(input.leaders);
  const vehicles = inTenant(input.vehicles);
  const expenses = inTenant(input.expenses);
  const contributions = inTenant(input.contributions);
  const voters = inTenant(input.voters);
  const proposals = inTenant(input.proposals);

  const voteTarget = candidates.reduce((sum, item) => sum + Math.max(0, item.voteTarget || 0), 0);
  const candidateCommitted = candidates.reduce((sum, item) => sum + Math.max(0, item.votesCommitted || 0), 0);
  const weightedVoterSupport = voters.reduce((sum, item) => sum + (item.verified ? item.supportLevel / 5 : item.supportLevel / 10), 0);
  const committedVotes = Math.max(candidateCommitted, Math.round(weightedVoterSupport));
  const projectedSupport = Math.max(committedVotes, Math.round(committedVotes + voters.filter((v) => !v.verified && v.supportLevel >= 3).length * 0.45));
  const coveragePct = clamp(ratio(projectedSupport, voteTarget));

  const activeLeaders = leaders.filter((item) => item.status === 'Activo' || item.status === 'Destacado').length;
  const leadersAtRisk = leaders.filter((item) => item.status === 'En Riesgo' || (item.voteTarget > 0 && item.votesCommitted / item.voteTarget < 0.55)).length;
  const leaderProductivity = leaders.length > 0
    ? Math.round(leaders.reduce((sum, item) => sum + clamp(ratio(item.votesCommitted, item.voteTarget)), 0) / leaders.length)
    : 0;

  const transportDemand = voters.filter((item) => item.requiresTransport).length;
  const transportCapacity = vehicles
    .filter((item) => item.status === 'Operativo - Día D' || item.status === 'Reservado')
    .reduce((sum, item) => sum + Math.max(0, item.capacity), 0);
  const transportCoveragePct = transportDemand > 0 ? clamp(ratio(transportCapacity, transportDemand)) : (vehicles.length > 0 ? 100 : 0);

  const totalSpent = expenses.reduce((sum, item) => sum + Math.max(0, item.amount || 0), 0);
  const totalIncome = contributions.reduce((sum, item) => sum + Math.max(0, item.amount || 0), 0);
  const pendingExpenses = expenses.filter((item) => item.status === 'Pendiente').reduce((sum, item) => sum + item.amount, 0);
  const documentedExpensePct = expenses.length > 0 ? ratio(expenses.filter((item) => Boolean(item.invoiceNumber)).length, expenses.length) : 100;

  const voterQuality = voters.length > 0
    ? ratio(voters.filter((item) => item.consentGiven && item.municipality && item.sector && item.leaderId).length, voters.length)
    : 100;
  const leaderQuality = leaders.length > 0
    ? ratio(leaders.filter((item) => item.fullName && item.phone && item.municipality && item.zoneOrDistrict).length, leaders.length)
    : 100;
  const dataQualityPct = Math.round((voterQuality + leaderQuality + documentedExpensePct) / 3);

  const proposalProgressPct = proposals.length > 0
    ? ratio(proposals.filter((item) => item.status === 'Aprobado' || item.status === 'Presentado').length, proposals.length)
    : 0;

  const operationalScore = (coveragePct * 0.34) + (leaderProductivity * 0.22) + (transportCoveragePct * 0.16);
  const governanceScore = (dataQualityPct * 0.18) + (proposalProgressPct * 0.1);
  const healthScore = Math.round(clamp(operationalScore + governanceScore));

  const recordCount = candidates.length + leaders.length + voters.length + vehicles.length + expenses.length;
  const confidence = recordCount >= 80 ? 'Alta' : recordCount >= 20 ? 'Media' : 'Baja';

  const insights: PredictiveInsight[] = [];
  if (voteTarget === 0) {
    insights.push({ id: 'missing-target', severity: 'warning', area: 'Territorio', title: 'Falta definir la meta electoral', evidence: 'No hay una meta de votos consolidada para las candidaturas activas.', recommendation: 'Defina la meta por candidatura y territorio para habilitar proyecciones comparables.', destination: 'candidates' });
  } else if (coveragePct < 60) {
    insights.push({ id: 'coverage-gap', severity: 'critical', area: 'Territorio', title: 'Brecha relevante frente a la meta', evidence: `La cobertura proyectada es ${coveragePct.toFixed(1)}% y faltan ${Math.max(0, voteTarget - projectedSupport).toLocaleString('es-CO')} apoyos.`, recommendation: 'Priorice los territorios con menor cobertura y asigne metas semanales a sus líderes.', destination: 'zone_projections' });
  } else if (coveragePct < 85) {
    insights.push({ id: 'coverage-watch', severity: 'warning', area: 'Territorio', title: 'Meta alcanzable, pero requiere aceleración', evidence: `La cobertura proyectada está en ${coveragePct.toFixed(1)}%.`, recommendation: 'Concentre el seguimiento diario en líderes por debajo del 70% de su meta.', destination: 'leaders' });
  } else {
    insights.push({ id: 'coverage-healthy', severity: 'healthy', area: 'Territorio', title: 'Cobertura territorial en rango saludable', evidence: `La proyección alcanza ${coveragePct.toFixed(1)}% de la meta registrada.`, recommendation: 'Mantenga verificación de apoyos y reduzca duplicados antes de ampliar la meta.', destination: 'hierarchy_pyramid' });
  }

  if (leadersAtRisk > 0) {
    insights.push({ id: 'leaders-risk', severity: leadersAtRisk / Math.max(leaders.length, 1) > 0.3 ? 'critical' : 'warning', area: 'Equipo', title: `${leadersAtRisk} líder(es) requieren acompañamiento`, evidence: 'Presentan estado de riesgo o avance inferior al 55% de su meta individual.', recommendation: 'Revise barreras, compromisos pendientes y recursos asignados antes de aumentar el gasto.', destination: 'leaders' });
  }

  if (transportDemand > transportCapacity) {
    insights.push({ id: 'transport-gap', severity: 'critical', area: 'Logística', title: 'Capacidad de transporte insuficiente', evidence: `${transportDemand} personas requieren transporte y hay capacidad registrada para ${transportCapacity}.`, recommendation: 'Reasigne rutas y valide vehículos antes de contratar capacidad adicional.', destination: 'transport' });
  }

  if (pendingExpenses > 0 || documentedExpensePct < 80) {
    insights.push({ id: 'finance-control', severity: documentedExpensePct < 60 ? 'critical' : 'warning', area: 'Finanzas', title: 'Control documental financiero pendiente', evidence: `${documentedExpensePct.toFixed(0)}% de los gastos tiene comprobante; pendientes por ${pendingExpenses.toLocaleString('es-CO')} COP.`, recommendation: 'Complete soportes y conciliación antes de aprobar nuevos desembolsos.', destination: 'finances' });
  }

  if (voters.some((item) => !item.consentGiven)) {
    insights.push({ id: 'privacy-gap', severity: 'critical', area: 'Datos', title: 'Registros sin constancia de autorización', evidence: `${voters.filter((item) => !item.consentGiven).length} registro(s) no tienen consentimiento documentado.`, recommendation: 'Suspenda su uso operativo hasta completar autorización, finalidad y origen del dato.', destination: 'hierarchy_pyramid' });
  }

  const expenseMap = new Map<string, number>();
  expenses.forEach((item) => expenseMap.set(item.component, (expenseMap.get(item.component) || 0) + item.amount));
  const expenseRows = [...expenseMap.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

  const territoryMap = new Map<string, { meta: number; comprometidos: number }>();
  candidates.forEach((item) => {
    const name = item.municipality || item.district || 'Sin territorio';
    const row = territoryMap.get(name) || { meta: 0, comprometidos: 0 };
    row.meta += item.voteTarget || 0;
    row.comprometidos += item.votesCommitted || 0;
    territoryMap.set(name, row);
  });
  const territoryRows = [...territoryMap.entries()].map(([name, row]) => ({
    name,
    ...row,
    cobertura: Math.round(clamp(ratio(row.comprometidos, row.meta))),
  })).sort((a, b) => a.cobertura - b.cobertura);

  return {
    healthScore,
    confidence,
    coveragePct,
    committedVotes,
    projectedSupport,
    remainingVotes: Math.max(0, voteTarget - projectedSupport),
    activeLeaders,
    leadersAtRisk,
    leaderProductivity,
    transportDemand,
    transportCapacity,
    transportCoveragePct,
    totalSpent,
    totalIncome,
    availableBalance: totalIncome - totalSpent,
    pendingExpenses,
    documentedExpensePct,
    dataQualityPct,
    proposalProgressPct,
    insights,
    territoryRows,
    expenseRows,
  };
}
