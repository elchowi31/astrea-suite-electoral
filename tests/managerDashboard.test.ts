import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDemoBundle } from '../src/data/demoSeed';
import { bogotaDay, buildManagerDashboard, filterDashboard, scopeDashboard, PRINT_CATEGORY, type DashboardSource } from '../src/lib/managerDashboard';
import { TRANSPORT_RESOURCE } from '../src/lib/operations';
import type { UserProfile } from '../src/types';
const user:UserProfile={uid:'owner',tenantId:'t',role:'AdminTenant',displayName:'Demo',email:'demo@example.invalid',department:'Cesar',municipality:'Astrea',createdAt:'2026-10-01'};
const b=buildDemoBundle('t',user);
const source:DashboardSource={...b,...b.operations!,tenant:{tenantId:'t',name:'Test',primaryColor:'#000',secondaryColor:'#fff',createdAt:'2026-10-01',active:true},user,readOnly:true,contributions:b.contributions};

test('dashboard excludes other tenants before deduplication and never adds declared totals to verified people',()=>{
 const person={...b.voters[0],verified:true};
 const input={...source,voters:[person,{...person,id:'duplicate',verified:false},{...person,id:'foreign',tenantId:'other'}],leaders:[{...b.leaders[0],voteTarget:100,votesCommitted:9000}],expenses:[]};
 const m=buildManagerDashboard(scopeDashboard(input));
 assert.equal(m.registered,1);assert.equal(m.confirmed,1);assert.equal(m.duplicates,1);assert.equal(m.target,100);assert.equal(m.conversion,100);
 assert.equal(scopeDashboard({...input,user:{...user,tenantId:'foreign'}}).voters.length,0);
 assert.equal(scopeDashboard({...input,user:null}).voters.length,0);
});
test('candidate and leader scopes cannot disclose other responsible people or their expenses',()=>{
 const lead=b.leaders[0],other=b.leaders.find(l=>l.id!==lead.id)!;
 const a={...b.voters[0],leaderId:lead.id,municipality:lead.municipality!,candidateId:'candidate-a'},c={...a,id:'other',documentNumber:'other',leaderId:other.id,candidateId:'candidate-b'};
 const data={...source,leaders:[{...lead,assignedCandidateId:'candidate-a'},{...other,assignedCandidateId:'candidate-b'}],voters:[a,c],expenses:[{...b.expenses[0],id:'a',municipality:lead.municipality,responsibleLeaderId:lead.id,candidateId:'candidate-a'},{...b.expenses[0],id:'b',municipality:lead.municipality,responsibleLeaderId:other.id,candidateId:'candidate-b'}]};
 const candidate=scopeDashboard({...data,user:{...user,role:'Concejal',municipality:lead.municipality,assignedCandidateId:'candidate-a'}});
 assert.deepEqual(candidate.voters.map(v=>v.id),[a.id]);assert.equal(candidate.expenses.length,1);assert.equal(candidate.leaders.length,1);
 const leader=scopeDashboard({...data,user:{...user,role:'LiderVeredal',municipality:lead.municipality,assignedLeaderId:lead.id}});
 assert.equal(leader.voters.length,1);assert.equal(leader.expenses.length,1);
});
test('transport excludes returns, rejected requests and canceled events and caps reservations',()=>{
 const event={...b.operations!.events[0],status:'En curso' as const};
 const req={...b.operations!.requests[0],resource:TRANSPORT_RESOURCE,eventId:event.id,quantity:10,reservedPassengers:12,status:'Aprobada' as const,direction:'Ida' as const};
 const m=buildManagerDashboard({...source,events:[event,{...event,id:'canceled',status:'Cancelado'}],requests:[req,{...req,id:'back',direction:'Regreso'},{...req,id:'rejected',status:'Rechazada'},{...req,id:'canceled',eventId:'canceled'}]});
 assert.equal(m.demand,10);assert.equal(m.reserved,10);assert.equal(m.coverage,100);assert.equal(m.shortage,0);
});
test('no denominators means no fabricated ratios, projections, or print values',()=>{
 const m=buildManagerDashboard({...source,voters:[],expenses:[],leaders:[],requests:[],events:[]});
 assert.equal(m.conversion,null);assert.equal(m.unitCost,null);assert.equal(m.coverage,null);assert.equal(m.printCost,0);assert.equal(m.historyRecords,0);assert.ok(m.daily.every(d=>d.unitCost===null));
});
test('print totals and payment groups use original rubric, not guessed descriptions or quantities',()=>{
 const e={...b.expenses[0],rubro:PRINT_CATEGORY as any,amount:100,status:'Pagado' as const};
 const m=buildManagerDashboard({...source,expenses:[e,{...e,id:'pending',amount:40,status:'Pendiente'},{...e,id:'other',rubro:'Publicidad y Propaganda',description:'Litografía',amount:900}]});
 assert.equal(m.printCost,140);assert.equal(m.printRows.find(r=>r.name==='Pagado')!.value,100);assert.equal(m.printRows.reduce((s,r)=>s+r.value,0),140);assert.equal(m.spent,1040);
});
test('date windows change cohort charts without changing accumulated KPI or inventing validation history',()=>{
 const now=new Date('2026-10-28T02:00:00Z');assert.equal(bogotaDay(now),'2026-10-27');
 const p={...b.voters[0],verified:true,registeredAt:'2026-10-28T01:00:00Z'};
 const old={...p,id:'old',documentNumber:'old',registeredAt:'2026-09-15T12:00:00Z'};
 const data={...source,voters:[p,old],expenses:[]};
 const narrow=buildManagerDashboard(data,28,now),wide=buildManagerDashboard(data,56,now);
 assert.equal(narrow.confirmed,wide.confirmed);assert.equal(narrow.historyRecords,1);assert.equal(wide.historyRecords,2);assert.equal(narrow.daily.at(-1)!.confirmed,1);assert.equal(narrow.daily.at(-1)!.date,'2026-10-27');
});
test('municipality and leader filters change the entire model without mixing global costs or budgets',()=>{
 const l={...b.leaders[0],municipality:'Astrea',budgetAllocated:500},other={...b.leaders[1],municipality:'Other',budgetAllocated:900};
 const input={...source,leaders:[l,other],voters:[{...b.voters[0],leaderId:l.id,municipality:'Astrea'},{...b.voters[1],leaderId:other.id,municipality:'Other'}],expenses:[{...b.expenses[0],municipality:'Astrea',responsibleLeaderId:l.id,amount:100},{...b.expenses[1],municipality:'Other',responsibleLeaderId:other.id,amount:900}]};
 const filtered=filterDashboard(scopeDashboard(input),'Astrea',l.id),m=buildManagerDashboard(filtered);
 assert.equal(m.registered,1);assert.equal(m.budget,500);assert.equal(m.spent,100);assert.equal(m.directSpent,100);assert.ok(filtered.events.every(e=>e.municipality==='Astrea'));
});
test('funnel is nested and territory data reconciles with unique records and leader-only goals',()=>{
 const m=buildManagerDashboard(scopeDashboard(source));
 for(let i=1;i<m.funnel.length;i++)assert.ok(m.funnel[i].value<=m.funnel[i-1].value);
 assert.equal(m.territoryRows.reduce((s,r)=>s+r.value,0),m.confirmed);
 assert.equal(m.territoryRows.reduce((s,r)=>s+r.target,0),m.target);
});
