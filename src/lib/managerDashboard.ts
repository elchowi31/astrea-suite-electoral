import type { CampaignExpense, Candidate, DonorContribution, GrassrootsVoter, Leader, Tenant, TransportVehicle, UserProfile } from '../types';
import { type OperationsData, TRANSPORT_RESOURCE, uniqueVoters } from './operations';

export const FINANCIAL_COLORS: Record<string, string> = {
  'Alimentación y Refrigerios': '#f97316', 'Transporte y Movilización': '#10b981',
  'Combustible': '#eab308', 'Publicidad y Propaganda': '#3b82f6',
  'Material Impreso y Camisetas': '#8b5cf6', 'Honorarios y Testigos Electorales': '#ec4899',
  'Sedes y Logística': '#06b6d4', 'Eventos, Mítines y Tarimas': '#a855f7',
};
export const PRINT_CATEGORY = 'Material Impreso y Camisetas';
export interface DashboardSource extends OperationsData {
  tenant: Tenant; user: UserProfile | null; readOnly: boolean;
  leaders: Leader[]; candidates: Candidate[]; voters: GrassrootsVoter[];
  expenses: CampaignExpense[]; vehicles: TransportVehicle[]; contributions: DonorContribution[];
}
const normal = (s?: string) => (s || '').trim().toLocaleLowerCase('es');
export const safeAmount = (n?: number) => Number.isFinite(n) ? Math.max(0, n || 0) : 0;
const sum = <T,>(rows: T[], get: (r: T) => number | undefined) => rows.reduce((total, row) => total + safeAmount(get(row)), 0);
export const percent = (n: number, total: number) => total > 0 ? n / total * 100 : null;

/** Dashboard reads only the active tenant and the viewer's assigned scope. No data writes or preference inference. */
export function scopeDashboard(source: DashboardSource): DashboardSource {
  const { tenant, user } = source;
  const tenantRows = <T extends { tenantId: string }>(rows: T[]) => rows.filter(r => r.tenantId === tenant.tenantId);
  const publicDemo = source.readOnly && tenant.tenantId === 'tenant-demo-publico' && user?.uid === 'demo-publico';
  if (!user || (!publicDemo && user.role !== 'AdminGlobal' && user.tenantId !== tenant.tenantId)) return {...source,leaders:[],candidates:[],voters:[],expenses:[],vehicles:[],contributions:[],requests:[],events:[],trips:[],reports:[],registrations:[]};
  const full = publicDemo || !!user && ['AdminGlobal', 'AdminTenant'].includes(user.role);
  const department = !!user && ['Gobernador', 'Diputado'].includes(user.role);
  const municipal = !!user && ['Alcalde', 'JefePolitico'].includes(user.role);
  const broad = full || department || municipal;
  const geography = (r: { municipality?: string; department?: string }) => full || (!!user && (department ? !!user.department && normal(r.department) === normal(user.department) : !!user.municipality && normal(r.municipality) === normal(user.municipality)));
  const assignment = (r: { leaderId?: string; candidateId?: string; createdBy?: string }) => !!user && (user.role === 'Concejal' ? !!user.assignedCandidateId && r.candidateId === user.assignedCandidateId : (!!user.assignedLeaderId && r.leaderId === user.assignedLeaderId) || r.createdBy === user.uid);
  const leaders = tenantRows(source.leaders).filter(r => geography(r) && (broad || (user?.role === 'Concejal' ? !!user.assignedCandidateId && r.assignedCandidateId === user.assignedCandidateId : !!user?.assignedLeaderId && r.id === user.assignedLeaderId)));
  const leaderIds = new Set(leaders.map(r => r.id));
  const owned = (r: { leaderId?: string; candidateId?: string; createdBy?: string }) => assignment(r) || !!r.leaderId && leaderIds.has(r.leaderId);
  const voters = tenantRows(source.voters).filter(r => geography(r) && (broad || owned(r)));
  const expenses = tenantRows(source.expenses).filter(r => (geography(r) || !broad && !!r.responsibleLeaderId && leaderIds.has(r.responsibleLeaderId)) && (broad || owned({ ...r, leaderId: r.responsibleLeaderId })));
  const requests = tenantRows(source.requests).filter(r => (full || (department ? source.events.some(e => e.id === r.eventId && e.tenantId === tenant.tenantId && geography(e)) || leaderIds.has(r.leaderId) : geography(r))) && (broad || owned(r)));
  const requestIds = new Set(requests.map(r => r.id));
  const events = tenantRows(source.events).filter(r => geography(r) && (broad || r.createdBy === user?.uid || requests.some(q => q.eventId === r.id)));
  const eventIds = new Set(events.map(r => r.id));
  const trips = tenantRows(source.trips).filter(r => eventIds.has(r.eventId) && (broad || r.createdBy === user?.uid || r.allocations.some(a => requestIds.has(a.requestId))));
  return { ...source, leaders, voters, expenses, requests, events, trips,
    candidates: tenantRows(source.candidates).filter(r => geography(r) && (broad || r.id === user?.assignedCandidateId || leaders.some(l => l.assignedCandidateId === r.id))),
    vehicles: tenantRows(source.vehicles).filter(r => geography(r) && (broad || trips.some(t => t.vehicleId === r.id))),
    contributions: tenantRows(source.contributions).filter(r => geography(r) && broad),
    reports: tenantRows(source.reports).filter(r => eventIds.has(r.eventId) && (broad || owned(r))),
    registrations: tenantRows(source.registrations || []).filter(r => eventIds.has(r.eventId) && (broad || owned(r))),
  };
}

export function dashboardMunicipalities(source: DashboardSource) {
  return [...new Set([...source.leaders, ...source.voters, ...source.expenses, ...source.events, ...source.requests].map(r => r.municipality).filter(Boolean))].sort((a,b) => a!.localeCompare(b!, 'es')) as string[];
}
export function filterDashboard(source: DashboardSource, municipality: string, leaderId: string): DashboardSource {
  const match = (r: { municipality?: string }) => !municipality || normal(r.municipality) === normal(municipality);
  const leaders = source.leaders.filter(r => match(r) && (!leaderId || r.id === leaderId));
  const requests = source.requests.filter(r => match(r) && (!leaderId || r.leaderId === leaderId));
  const ids = new Set(requests.map(r => r.id));
  const events = source.events.filter(r => match(r) && (!leaderId || requests.some(q => q.eventId === r.id)));
  const eventIds = new Set(events.map(r => r.id));
  const trips = source.trips.filter(r => eventIds.has(r.eventId) && (!leaderId || r.allocations.some(a => ids.has(a.requestId))));
  return {...source, leaders, requests, events, trips,
    voters: source.voters.filter(r => match(r) && (!leaderId || r.leaderId === leaderId)),
    expenses: source.expenses.filter(r => match(r) && (!leaderId || r.responsibleLeaderId === leaderId)),
    vehicles: source.vehicles.filter(r => match(r) && (!leaderId || trips.some(t => t.vehicleId === r.id))),
    contributions: source.contributions.filter(r => match(r)),
  };
}

const dayFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota', year:'numeric', month:'2-digit', day:'2-digit' });
export function bogotaDay(date: Date): string {
  const parts = dayFormatter.formatToParts(date);
  return ['year','month','day'].map(k => parts.find(p => p.type === k)!.value).join('-');
}
function recordedDay(s: string | undefined): string | null {
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return Number.isFinite(Date.parse(s)) ? s : null;
  const d = new Date(s); return Number.isFinite(d.getTime()) ? bogotaDay(d) : null;
}

/** All history is grouped by registration/expense date and CURRENT verification, never invented past state. */
export function buildManagerDashboard(source: DashboardSource, days = 28, now = new Date()) {
  const dayCache = new Map<string | undefined, string | null>();
  const dayOf = (value: string | undefined) => { if (!dayCache.has(value)) dayCache.set(value, recordedDay(value)); return dayCache.get(value)!; };
  const people = uniqueVoters(source.voters), verified = people.filter(v => v.verified);
  const registered = people.length, confirmed = verified.length, pending = registered - confirmed;
  const spent = sum(source.expenses, e => e.amount), printExpenses = source.expenses.filter(e => e.rubro === PRINT_CATEGORY);
  const printCost = sum(printExpenses, e => e.amount), target = sum(source.leaders, l => l.voteTarget);
  const activeEvents = new Set(source.events.filter(e => e.status !== 'Cancelado').map(e => e.id));
  const transport = source.requests.filter(r => r.resource === TRANSPORT_RESOURCE && r.direction !== 'Regreso' && r.status !== 'Rechazada' && activeEvents.has(r.eventId));
  const demand = sum(transport, r => r.quantity), reserved = sum(transport, r => Math.min(safeAmount(r.quantity), safeAmount(r.reservedPassengers)));
  const transportRows = ['Pendientes','Aprobadas','Entregadas'].map((name,i) => ({name,value:sum(transport.filter(r => r.status === ['Pendiente','Aprobada','Entregada'][i]),r => r.quantity)}));
  const costs = new Map<string, number>(); source.expenses.forEach(e => costs.set(e.rubro || e.component, (costs.get(e.rubro || e.component) || 0) + safeAmount(e.amount)));
  const categories = [...costs].map(([name,value]) => ({name,value,color:FINANCIAL_COLORS[name] || '#94a3b8'})).sort((a,b)=>b.value-a.value);
  const territories = new Map<string,{name:string;target:number;value:number;registered:number}>();
  const keyOf = (municipality?:string, sector?:string) => `${municipality || 'Sin municipio'} · ${sector || 'Sin sector'}`;
  const get = (key:string) => {if(!territories.has(key))territories.set(key,{name:key,target:0,value:0,registered:0});return territories.get(key)!;};
  source.leaders.forEach(l => get(keyOf(l.municipality,l.veredaOrBarrio || l.zoneOrDistrict)).target += safeAmount(l.voteTarget));
  people.forEach(v => {const row=get(keyOf(v.municipality,v.sector));row.registered++;if(v.verified)row.value++;});
  const leaderRows = source.leaders.map(l => ({id:l.id,name:l.fullName,target:safeAmount(l.voteTarget),value:verified.filter(v=>v.leaderId===l.id).length,registered:people.filter(v=>v.leaderId===l.id).length,budget:safeAmount(l.budgetAllocated),spent:sum(source.expenses.filter(e=>e.responsibleLeaderId===l.id),e=>e.amount)}));
  const today = bogotaDay(now), end = new Date(today+'T12:00:00Z');
  const daily = Array.from({length:days},(_,index)=>{
    const day=new Date(end);day.setUTCDate(day.getUTCDate()-days+1+index);const date=day.toISOString().slice(0,10);
    const cohort=people.filter(v=>dayOf(v.registeredAt)===date), checked=cohort.filter(v=>v.verified).length;
    const cost=sum(source.expenses.filter(e=>dayOf(e.date)===date),e=>e.amount);
    return {date,label:date.slice(5),registered:cohort.length,confirmed:checked,pending:cohort.length-checked,conversion:percent(checked,cohort.length),spent:cost,printCost:sum(printExpenses.filter(e=>dayOf(e.date)===date),e=>e.amount),unitCost:checked?cost/checked:null};
  });
  return { registered,confirmed,pending,spent,printCost,target,conversion:percent(confirmed,registered),unitCost:confirmed?spent/confirmed:null,duplicates:source.voters.length-registered,
    demand,reserved,shortage:Math.max(0,demand-reserved),coverage:percent(reserved,demand),transportRows,
    capacity:sum(source.vehicles.filter(v=>v.status!=='En Mantenimiento'),v=>v.capacity),categories,
    territoryRows:[...territories.values()].sort((a,b)=>b.registered-a.registered || a.name.localeCompare(b.name,'es')),
    leaderRows, daily, historyRecords:daily.reduce((s,d)=>s+d.registered,0),
    undatedRecords:people.filter(v=>!dayOf(v.registeredAt)).length,
    funnel:[{name:'Base registrada',value:registered,color:'#3b82f6'},{name:'Fichas verificadas',value:confirmed,color:'#0ea5e9'},{name:'Con consentimiento',value:verified.filter(v=>v.consentGiven).length,color:'#06b6d4'},{name:'Sin transporte requerido',value:verified.filter(v=>v.consentGiven&&!v.requiresTransport).length,color:'#10b981'}],
    budget:sum(source.leaders,l=>l.budgetAllocated),directSpent:sum(source.expenses.filter(e=>source.leaders.some(l=>l.id===e.responsibleLeaderId)),e=>e.amount),
    printRows:['Pagado','Aprobado','Pendiente'].map(name=>({name,value:sum(printExpenses.filter(e=>e.status===name),e=>e.amount),color:FINANCIAL_COLORS[PRINT_CATEGORY]})),
    eventRows:['Planificado','En curso','Finalizado','Cancelado'].map((name,i)=>({name,value:source.events.filter(e=>e.status===name).length,color:['#60a5fa','#22d3ee','#34d399','#94a3b8'][i]})),
    requestRows:['Pendiente','Aprobada','Entregada','Rechazada'].map((name,i)=>({name,value:source.requests.filter(e=>e.status===name).length,color:['#fbbf24','#60a5fa','#34d399','#94a3b8'][i]})),
    paid:sum(source.expenses.filter(e=>e.status==='Pagado'),e=>e.amount),income:sum(source.contributions,c=>c.amount),
    pendingRequests:source.requests.filter(r=>r.status==='Pendiente').length,
  };
}
