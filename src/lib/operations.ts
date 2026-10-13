import type { CampaignExpense, Candidate, GrassrootsVoter, Leader, TransportVehicle, UserProfile, FinancialRubro, ExpenseComponent } from '../types';

export const RESOURCE_CATALOG: { name: string; unit: string; rubro: FinancialRubro; component: ExpenseComponent }[] = [
  { name: 'Transporte de pasajeros', unit: 'personas', rubro: 'Transporte y Movilización', component: 'Transporte y Movilización' },
  { name: 'Alimentación', unit: 'raciones', rubro: 'Alimentación y Refrigerios', component: 'Alimentación y Refrigerios' },
  { name: 'Refrigerios e hidratación', unit: 'unidades', rubro: 'Alimentación y Refrigerios', component: 'Alimentación y Refrigerios' },
  { name: 'Combustible', unit: 'galones', rubro: 'Combustible', component: 'Combustible' },
  { name: 'Avanzada y montaje', unit: 'jornadas', rubro: 'Sedes y Logística', component: 'Operación de Líderes' },
  { name: 'Uniformes del equipo', unit: 'unidades', rubro: 'Material Impreso y Camisetas', component: 'Operación de Líderes' },
  { name: 'Camisetas para asistentes', unit: 'unidades', rubro: 'Material Impreso y Camisetas', component: 'Publicidad y Propaganda' },
  { name: 'Publicidad y medios', unit: 'servicios', rubro: 'Publicidad y Propaganda', component: 'Propaganda y Medios' },
  { name: 'Impresos y señalización', unit: 'unidades', rubro: 'Material Impreso y Camisetas', component: 'Publicidad y Propaganda' },
  { name: 'Sonido, tarima y evento', unit: 'servicios', rubro: 'Eventos, Mítines y Tarimas', component: 'Eventos y Mítines' },
  { name: 'Sede y mobiliario', unit: 'días', rubro: 'Sedes y Logística', component: 'Sedes y Logística' },
  { name: 'Honorarios y testigos', unit: 'jornadas', rubro: 'Honorarios y Testigos Electorales', component: 'Honorarios y Testigos Electorales' },
  { name: 'Tecnología y asesoría', unit: 'servicios', rubro: 'Tecnología y Asesoría Jurídica', component: 'Tecnología y Asesoría' },
  { name: 'Otros e imprevistos', unit: 'unidades', rubro: 'Caja Menor e Imprevistos', component: 'Caja Menor e Imprevistos' },
];
export const TRANSPORT_RESOURCE = RESOURCE_CATALOG[0].name;
// Bound related document reads so Firestore transactions stay within security-rule access limits.
export const MAX_TRIP_REQUESTS = 5;
export interface OperationalEvent {
  id: string; tenantId: string; name: string; type: 'Jornada electoral' | 'Evento' | 'Reunión' | 'Operación de campo';
  department: string; municipality: string; destination: string; startAt: string; endAt: string;
  expectedAttendance: number; status: 'Planificado' | 'En curso' | 'Finalizado' | 'Cancelado'; notes: string; createdBy: string; createdAt: string;
}
export interface ResourceRequest {
  id: string; tenantId: string; eventId: string; leaderId: string; candidateId: string; municipality: string;
  resource: string; description: string; quantity: number; unitCost: number; amount: number;
  status: 'Pendiente' | 'Aprobada' | 'Rechazada' | 'Entregada'; notes: string; createdBy: string; createdAt: string;
  reservedPassengers: number; arrivedPassengers: number; expenseId: string;
  direction?: 'Ida' | 'Regreso'; waitingPassengers?: number; queueUpdatedAt?: string;
  consumedQuantity?: number; transferredIn?: number; transferredOut?: number; confirmedSurplus?: number; deliveredQuantity?: number;
}
export interface TransportAllocation { requestId: string; passengers: number; arrived: number }
export interface TransportTrip {
  id: string; tenantId: string; eventId: string; vehicleId: string; startAt: string; endAt: string;
  origin: string; destination: string; status: 'Programado' | 'En curso' | 'Finalizado' | 'Cancelado';
  allocations: TransportAllocation[]; notes: string; createdBy: string; createdAt: string;
}
export interface LeaderProgressReport {
  id: string; tenantId: string; eventId: string; leaderId: string; reportedVoters: number;
  notes: string; createdBy: string; updatedAt: string; revision: number;
}
export interface OperationsData { events: OperationalEvent[]; requests: ResourceRequest[]; trips: TransportTrip[]; reports: LeaderProgressReport[] }
export const EMPTY_OPERATIONS: OperationsData = { events: [], requests: [], trips: [], reports: [] };
export const canCoordinate = (user: UserProfile | null) => !!user && ['AdminGlobal','AdminTenant','Gobernador','Diputado','Alcalde','Concejal','JefePolitico'].includes(user.role);
export const overlaps = (a: Pick<TransportTrip,'startAt'|'endAt'>, b: Pick<TransportTrip,'startAt'|'endAt'>) => a.startAt < b.endAt && b.startAt < a.endAt;
export const passengerTotal = (trip: TransportTrip) => trip.allocations.reduce((n, a) => n + a.passengers, 0);
export function validateEvent(event: OperationalEvent) {
  if (!event.name.trim() || !event.destination.trim() || !event.municipality.trim()) throw new Error('Complete nombre, municipio y destino.');
  if (!Number.isFinite(Date.parse(event.startAt)) || !Number.isFinite(Date.parse(event.endAt)) || event.endAt <= event.startAt) throw new Error('El final debe ser posterior al inicio.');
  if (!Number.isInteger(event.expectedAttendance) || event.expectedAttendance < 0) throw new Error('Indique una asistencia esperada válida.');
}
export function validateRequest(request: ResourceRequest) {
  if (!RESOURCE_CATALOG.some(item => item.name === request.resource) || !request.description.trim() || (!request.leaderId && !request.candidateId)) throw new Error('Seleccione recurso, responsable y descripción.');
  if (!Number.isFinite(request.quantity) || request.quantity <= 0 || request.quantity > 1000000 || !Number.isFinite(request.unitCost) || request.unitCost < 0 || !Number.isFinite(request.amount) || Math.abs(request.amount - Math.round(request.quantity * request.unitCost)) > 0.01) throw new Error('Revise cantidad, costo unitario y total.');
  if (request.resource === TRANSPORT_RESOURCE && (!request.eventId || !Number.isInteger(request.quantity))) throw new Error('El transporte requiere una jornada y un número entero de personas.');
}
export function uniqueVoters(voters: GrassrootsVoter[]) {
  const records = new Map<string, GrassrootsVoter>();
  [...voters].sort((a,b) => Number(b.verified) - Number(a.verified) || a.registeredAt.localeCompare(b.registeredAt)).forEach(row => {
    const document = row.documentNumber?.replace(/[^\p{L}\p{N}]/gu,'').toUpperCase();
    const key = `${row.tenantId}:${document || row.id}`;
    if (!records.has(key)) records.set(key,row);
  });
  return [...records.values()];
}
const safe = (n: number | undefined) => Number.isFinite(n) ? Math.max(0,n || 0) : 0;
export function accountability(tenantId: string, leaders: Leader[], candidates: Candidate[], voters: GrassrootsVoter[], expenses: CampaignExpense[], now = new Date()) {
  const people = uniqueVoters(voters.filter(v => v.tenantId === tenantId));
  const costs = expenses.filter(e => e.tenantId === tenantId);
  const team = leaders.filter(l => l.tenantId === tenantId);
  const candidatesHere = candidates.filter(c => c.tenantId === tenantId);
  const metric = (id: string, name: string, target: number, reported: number, rows: GrassrootsVoter[], entries: CampaignExpense[]) => {
    const validated = rows.filter(v => v.verified).length;
    const spent = entries.reduce((n,e) => n + safe(e.amount),0);
    const paid = entries.filter(e => e.status === 'Pagado').reduce((n,e) => n + safe(e.amount),0);
    return { id, name, target, reported, registered: rows.length, validated, transport: rows.filter(v=>v.requiresTransport).length,
      compliance: target > 0 ? validated / target * 100 : null, reportedCompliance: target > 0 ? reported / target * 100 : null,
      spent, paid, costPerValidated: validated > 0 ? spent / validated : null, costPerRegistered: rows.length ? spent / rows.length : null };
  };
  const leaderRows = team.map(l => metric(l.id,l.fullName,safe(l.voteTarget),safe(l.votesCommitted),people.filter(v=>v.leaderId===l.id),costs.filter(e=>e.responsibleLeaderId===l.id)));
  const candidateForExpense = (e:CampaignExpense) => e.candidateId || team.find(l=>l.id===e.responsibleLeaderId)?.assignedCandidateId;
  const candidateRows = candidatesHere.map(c => metric(c.id,c.fullName,safe(c.voteTarget),safe(c.votesCommitted),people.filter(v=>v.candidateId===c.id),costs.filter(e=>candidateForExpense(e)===c.id)));
  const daily = Array.from({length:28},(_,index) => {
    const date = new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()-27+index)).toISOString().slice(0,10);
    const registered = people.filter(v=>v.registeredAt.slice(0,10)===date).length;
    // This is a cohort by registration date, not an invented historical validation date.
    const validated = people.filter(v=>v.verified && v.registeredAt.slice(0,10)===date).length;
    return {date,label:date.slice(5),registered,validated,spent:costs.filter(e=>e.date.slice(0,10)===date).reduce((n,e)=>n+safe(e.amount),0),paid:costs.filter(e=>e.date.slice(0,10)===date&&e.status==='Pagado').reduce((n,e)=>n+safe(e.amount),0)};
  });
  const dailyCosts=daily.slice(-14);const activeDays=dailyCosts.filter(d=>d.spent>0).length;
  const forecast7 = activeDays >= 4 ? dailyCosts.reduce((n,d)=>n+d.spent,0)/14*7 : null;
  return {leaderRows,candidateRows,daily,forecast7,registered:people.length,validated:people.filter(v=>v.verified).length,
    duplicates:voters.filter(v=>v.tenantId===tenantId).length-people.length,
    unassignedCost:costs.filter(e=>!e.responsibleLeaderId && !e.candidateId).reduce((n,e)=>n+safe(e.amount),0),
    spent:costs.reduce((n,e)=>n+safe(e.amount),0),paid:costs.filter(e=>e.status==='Pagado').reduce((n,e)=>n+safe(e.amount),0)};
}

/** FIFO by request date, only within the event municipality. No inference about political preferences. */
export function suggestTransport(event: OperationalEvent, requests: ResourceRequest[], vehicles: TransportVehicle[], trips: TransportTrip[]) {
  const pending = requests.filter(r=>r.tenantId===event.tenantId && r.eventId===event.id && r.resource===TRANSPORT_RESOURCE && r.status==='Aprobada')
    .sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id)).map(r=>({request:r,left:Math.max(0,r.quantity-r.reservedPassengers)}));
  const available = vehicles.filter(v=>v.tenantId===event.tenantId && v.municipality===event.municipality && v.status!=='En Mantenimiento' && v.capacity>0 && !trips.some(t=>t.tenantId===event.tenantId&&t.vehicleId===v.id&&['Programado','En curso'].includes(t.status)&&overlaps(t,event)))
    .sort((a,b)=>b.capacity-a.capacity||a.id.localeCompare(b.id));
  const proposals = available.flatMap(vehicle=>{
    let free=Math.floor(vehicle.capacity);const allocations:TransportAllocation[]=[];
    for(const item of pending){if(free<=0||allocations.length===MAX_TRIP_REQUESTS)break;if(item.left<=0||item.request.municipality!==event.municipality)continue;const passengers=Math.min(free,item.left);allocations.push({requestId:item.request.id,passengers,arrived:0});free-=passengers;item.left-=passengers;}
    return allocations.length ? [{vehicleId:vehicle.id,allocations}] : [];
  });
  return {proposals,uncovered:pending.reduce((n,p)=>n+p.left,0),assigned:proposals.reduce((n,p)=>n+p.allocations.reduce((m,a)=>m+a.passengers,0),0)};
}

export function eventControl(event: OperationalEvent, leaders: Leader[], requests: ResourceRequest[], trips: TransportTrip[], reports: LeaderProgressReport[], expenses: CampaignExpense[], now=new Date()) {
  const start=Date.parse(event.startAt),end=Date.parse(event.endAt);
  const elapsed=Math.max(0,Math.min(1,(now.getTime()-start)/(end-start)));
  const inEvent=(r:{tenantId:string;eventId:string})=>r.tenantId===event.tenantId&&r.eventId===event.id;
  const needs=requests.filter(inEvent).filter(r=>r.status!=='Rechazada');
  const rides=trips.filter(inEvent).filter(t=>t.status!=='Cancelado');
  return leaders.filter(l=>l.tenantId===event.tenantId&&(l.municipality===event.municipality||needs.some(r=>r.leaderId===l.id))).map(leader=>{
    const own=needs.filter(r=>r.leaderId===leader.id);const transport=own.filter(r=>r.resource===TRANSPORT_RESOURCE&&r.direction!=='Regreso');
    const reported=reports.find(r=>inEvent(r)&&r.leaderId===leader.id)?.reportedVoters||0;
    const spent=expenses.filter(e=>e.tenantId===event.tenantId&&e.eventId===event.id&&e.responsibleLeaderId===leader.id).reduce((n,e)=>n+safe(e.amount),0);
    const demanded=transport.reduce((n,r)=>n+r.quantity,0),reserved=transport.reduce((n,r)=>n+r.reservedPassengers,0),arrived=transport.reduce((n,r)=>n+r.arrivedPassengers,0);
    const active=rides.filter(t=>t.status==='En curso').reduce((n,t)=>n+t.allocations.filter(a=>transport.some(r=>r.id===a.requestId)).reduce((s,a)=>s+a.passengers,0),0);
    const alerts:string[]=[];
    if(reported>leader.voteTarget&&leader.voteTarget>0)alerts.push(`${reported-leader.voteTarget} reportados sobre la meta. Confirme alimentación adicional y regreso al lugar de origen.`);
    if(event.status!=='Cancelado'&&['En curso','Finalizado'].includes(event.status)&&elapsed>0&&leader.voteTarget>0&&reported<leader.voteTarget*elapsed*.8)alerts.push(`Reporte bajo el avance esperado (${Math.round(leader.voteTarget*elapsed)} a esta hora)`);
    if(demanded>reserved)alerts.push(`${demanded-reserved} personas sin cupo`);
    if(transport.some(r=>r.waitingPassengers===0&&r.reservedPassengers>r.arrivedPassengers))alerts.push('Cupos programados sin personas en espera: revisar posible reasignación.');
    if(own.some(r=>(r.confirmedSurplus||0)>0))alerts.push('Hay sobrantes confirmados que pueden cederse a otra necesidad.');
    const returning=own.filter(r=>r.resource===TRANSPORT_RESOURCE&&r.direction==='Regreso');
    const returnPending=returning.reduce((n,r)=>n+r.quantity-r.arrivedPassengers,0);
    if(returnPending>0)alerts.push(`${returnPending} personas pendientes de completar el regreso`);
    if(leader.budgetAllocated>0&&spent>leader.budgetAllocated)alerts.push('Gasto superior al presupuesto del líder');
    if(own.some(r=>r.status==='Pendiente'))alerts.push('Necesidades pendientes de aprobación');
    return {leader,reported,spent,demanded,reserved,arrived,active,remaining:Math.max(0,leader.voteTarget-reported),compliance:leader.voteTarget?reported/leader.voteTarget*100:null,
      requestedBudget:own.reduce((n,r)=>n+r.amount,0),approvedBudget:own.filter(r=>['Aprobada','Entregada'].includes(r.status)).reduce((n,r)=>n+r.amount,0),delivered:own.filter(r=>r.status==='Entregada').length,requests:own.length,
      costPerReported:reported?spent/reported:null,budgetCompliance:leader.budgetAllocated?spent/leader.budgetAllocated*100:null,alerts};
  });
}

export function unrequestedTransport(event: OperationalEvent, voters: GrassrootsVoter[], requests: ResourceRequest[]) {
  if(event.type!=='Jornada electoral')return [];
  const totals=new Map<string,number>();
  uniqueVoters(voters).filter(v=>v.tenantId===event.tenantId&&v.municipality===event.municipality&&v.requiresTransport&&v.leaderId).forEach(v=>totals.set(v.leaderId,(totals.get(v.leaderId)||0)+1));
  return [...totals].map(([leaderId,registered])=>{const requested=requests.filter(r=>r.tenantId===event.tenantId&&r.eventId===event.id&&r.leaderId===leaderId&&r.resource===TRANSPORT_RESOURCE&&r.direction!=='Regreso'&&r.status!=='Rechazada').reduce((n,r)=>n+r.quantity,0);return {leaderId,registered,requested,missing:Math.max(0,registered-requested)};}).filter(row=>row.missing>0);
}

export const stockAvailable=(r:ResourceRequest)=>Math.max(0,(r.deliveredQuantity??(r.status==='Entregada'?r.quantity:0))+(r.transferredIn||0)-(r.transferredOut||0)-(r.consumedQuantity||0));
export const stockMissing=(r:ResourceRequest)=>Math.max(0,r.quantity-((r.deliveredQuantity??(r.status==='Entregada'?r.quantity:0))+(r.transferredIn||0)-(r.transferredOut||0)));
export function queueIsFresh(r:ResourceRequest,now=Date.now()) { const age=now-Date.parse(r.queueUpdatedAt||'');return age>=0&&age<=30*60000; }
export function releasableTrip(trip:TransportTrip,requests:ResourceRequest[],now=Date.now()) {
  return trip.status==='Programado'&&Date.parse(trip.endAt)>now&&trip.allocations.every(a=>{
    const r=requests.find(r=>r.id===a.requestId);
    return !!r&&queueIsFresh(r,now)&&r.waitingPassengers!==undefined&&Math.max(0,r.reservedPassengers-r.arrivedPassengers-a.passengers)>=r.waitingPassengers;
  });
}
/** Reallocate only unused, unstarted capacity backed by a fresh headcount. Reports never determine access to resources. */
export function suggestReallocation(event:OperationalEvent,requests:ResourceRequest[],trips:TransportTrip[],vehicles:TransportVehicle[],now=Date.now()) {
  const own=requests.filter(r=>r.tenantId===event.tenantId&&r.eventId===event.id&&r.resource===TRANSPORT_RESOURCE&&r.status==='Aprobada');
  const unmet=own.filter(r=>queueIsFresh(r,now)&&r.waitingPassengers!==undefined).map(r=>({r,left:Math.min(r.quantity-r.reservedPassengers,Math.max(0,r.waitingPassengers!-(r.reservedPassengers-r.arrivedPassengers)))})).filter(x=>x.left>0);
  const simulated=own.map(r=>({...r}));
  return trips.filter(t=>t.tenantId===event.tenantId&&t.eventId===event.id).flatMap(trip=>{
    if(!releasableTrip(trip,simulated,now))return [];
    const vehicle=vehicles.find(v=>v.id===trip.vehicleId&&v.tenantId===event.tenantId&&v.municipality===event.municipality&&v.status!=='En Mantenimiento');
    const recipient=unmet.find(x=>x.left>0&&!trip.allocations.some(a=>a.requestId===x.r.id));
    if(!vehicle||!recipient)return [];
    const passengers=Math.min(vehicle.capacity,recipient.left);recipient.left-=passengers;
    trip.allocations.forEach(a=>{const r=simulated.find(r=>r.id===a.requestId)!;r.reservedPassengers-=a.passengers;});
    return [{trip,recipient:recipient.r,passengers}];
  });
}
