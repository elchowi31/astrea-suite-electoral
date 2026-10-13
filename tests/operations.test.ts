import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildDemoBundle} from '../src/data/demoSeed';
import {accountability,eventControl,suggestTransport,unrequestedTransport,TRANSPORT_RESOURCE,RESOURCE_CATALOG,validateRequest,validateEvent,overlaps,uniqueVoters} from '../src/lib/operations';
import type {UserProfile} from '../src/types';
import {suggestReallocation,stockAvailable,stockMissing,queueIsFresh} from '../src/lib/operations';
import {mergeRegistration} from '../src/lib/eventRegistration';
const profile:UserProfile={uid:'demo-owner',tenantId:'team-a',role:'AdminTenant',displayName:'Demo',email:'demo@example.invalid',department:'Cesar',municipality:'Astrea',createdAt:'2026-10-12'};
const bundle=buildDemoBundle('team-a',profile);

test('Reallocation preserves the last needed vehicle, ignores political reports, and never moves an active trip',()=>{
  const {events,requests,trips}=bundle.operations!;const event=events[0];const now=Date.parse(bundle.createdAt);
  const suggestions=suggestReallocation(event,requests,trips,bundle.vehicles,now);
  assert.equal(suggestions.length,2);assert.equal(suggestions.reduce((n,p)=>n+p.passengers,0),10);
  assert.equal(suggestReallocation(event,requests,trips.map(t=>({...t,status:'En curso'})),bundle.vehicles,now).length,0);
  assert.equal(suggestReallocation(event,requests,trips,bundle.vehicles,now+31*60000).length,0);
  assert.ok(queueIsFresh(suggestions[0].recipient,now));
  const source=requests.find(r=>r.id==='demo-comida-cesion-0')!,target=requests.find(r=>r.id==='demo-comida-cesion-1')!;
  assert.equal(stockAvailable(source),20);assert.equal(stockMissing(target),10);
  assert.equal(stockAvailable({...source,transferredOut:10}),10);assert.equal(stockMissing({...target,transferredIn:10}),0);
});

test('Above-target progress remains above 100 and return journeys never inflate outbound arrival counts',()=>{
  const {events,requests,trips,reports}=bundle.operations!;const event=events[0];const leader=bundle.leaders.find(l=>l.municipality===event.municipality)!;
  const first=eventControl(event,bundle.leaders,requests,trips,reports,bundle.expenses)[0];
  const report={...reports[0],leaderId:leader.id,reportedVoters:leader.voteTarget*2};
  const returnRequest={...requests.find(r=>r.leaderId===leader.id&&r.resource===TRANSPORT_RESOURCE)!,id:'return',direction:'Regreso' as const,quantity:5,reservedPassengers:5,arrivedPassengers:5};
  const voter=bundle.voters.find(v=>v.leaderId===leader.id)!;
  const registrations=Array.from({length:leader.voteTarget*2},(_,i)=>mergeRegistration(event,{...voter,documentNumber:String(80000+i)},undefined,'command',true,'','owner',true));
  const row=eventControl(event,bundle.leaders,[...requests,returnRequest],trips,[report],bundle.expenses,new Date(),registrations)[0];
  assert.equal(row.compliance,200);assert.equal(row.arrived,first.arrived);assert.ok(row.alerts.some(a=>a.includes('alimentación adicional')));
});

test('Complete demo fits one Firestore document and reconciles all modules without live tracking',()=>{
  assert.ok(Buffer.byteLength(JSON.stringify(bundle))<900_000,`Demo size ${Buffer.byteLength(JSON.stringify(bundle))}`);
  assert.ok(bundle.voters.some(v=>v.verified));assert.ok(bundle.voters.some(v=>!v.verified));
  assert.equal(new Set(bundle.expenses.map(e=>e.rubro)).size,10);
  assert.equal(new Set(bundle.operations!.requests.map(r=>r.resource)).size,RESOURCE_CATALOG.length);
  assert.ok(bundle.operations!.events.length);assert.ok(bundle.operations!.trips.length);assert.ok(bundle.operations!.reports.length);
  for(const c of bundle.coordinations)for(const committee of c.committees){assert.equal(committee.tasksCount,committee.tasks!.length);assert.equal(committee.completedTasksCount,committee.tasks!.filter(t=>t.completed).length);}
  for(const r of bundle.operations!.requests){validateRequest(r);assert.ok(bundle.leaders.some(l=>l.id===r.leaderId));assert.ok(bundle.operations!.events.some(e=>e.id===r.eventId));assert.ok(r.arrivedPassengers<=r.reservedPassengers&&r.reservedPassengers<=r.quantity);}
  for(const e of bundle.operations!.events)validateEvent(e);
  for(const trip of bundle.operations!.trips){const vehicle=bundle.vehicles.find(v=>v.id===trip.vehicleId)!;assert.ok(trip.allocations.reduce((n,a)=>n+a.passengers,0)<=vehicle.capacity);}
});
test('Costs use unique validated people, exclude other tenants and retain shared cost separately',()=>{
  const person=bundle.voters.find(v=>v.verified)!;const leader=bundle.leaders.find(l=>l.id===person.leaderId)!;
  const expense={...bundle.expenses[0],responsibleLeaderId:leader.id,candidateId:person.candidateId,amount:120000,status:'Pagado' as const};
  const shared={...expense,id:'shared',responsibleLeaderId:'',candidateId:'',amount:30000};
  const analytics=accountability('team-a',[leader],bundle.candidates,[person,{...person,id:'duplicate',verified:false},{...person,id:'foreign',tenantId:'team-b'}],[expense,shared,{...expense,id:'foreign',tenantId:'team-b'}]);
  assert.equal(analytics.registered,1);assert.equal(analytics.validated,1);assert.equal(analytics.duplicates,1);assert.equal(analytics.spent,150000);assert.equal(analytics.unassignedCost,30000);
  assert.equal(analytics.leaderRows[0].costPerValidated,120000);assert.equal(analytics.candidateRows.find(c=>c.id===person.candidateId)!.spent,120000);
  assert.equal(accountability('team-a',[leader],[],[],[expense]).leaderRows[0].costPerValidated,null);
});
test('Transport proposals respect approval, remaining demand, territory, capacity and existing reservations',()=>{
  const event=bundle.operations!.events[0];const request={...bundle.operations!.requests.find(r=>r.resource===TRANSPORT_RESOURCE&&r.eventId===event.id)!,id:'need-a',quantity:12,reservedPassengers:2,arrivedPassengers:0};
  const vehicle={...bundle.vehicles[0],id:'van',municipality:event.municipality,capacity:5,status:'Reservado' as const};
  const result=suggestTransport(event,[request,{...request,id:'unapproved',status:'Pendiente'},{...request,id:'other',tenantId:'other'}],[vehicle,{...vehicle,id:'broken',status:'En Mantenimiento'},{...vehicle,id:'other-town',municipality:'Elsewhere'}],[]);
  assert.equal(result.assigned,5);assert.equal(result.uncovered,5);assert.equal(result.proposals[0].allocations[0].requestId,'need-a');
  const booked={...bundle.operations!.trips[0],vehicleId:'van',startAt:event.startAt,endAt:event.endAt,status:'Programado' as const};
  assert.equal(suggestTransport(event,[request],[vehicle],[booked]).assigned,0);
  assert.equal(suggestTransport(event,[request],[vehicle],[{...booked,status:'Finalizado'}]).assigned,5);
  assert.equal(overlaps({startAt:'2026-10-12T10:00:00Z',endAt:'2026-10-12T11:00:00Z'},{startAt:'2026-10-12T11:00:00Z',endAt:'2026-10-12T12:00:00Z'}),false);
});
test('Historical declarations remain separate from unique attendance and transportation',()=>{
  const event={...bundle.operations!.events[0],status:'En curso' as const,startAt:'2026-10-12T10:00:00.000Z',endAt:'2026-10-12T20:00:00.000Z'};
  const leader={...bundle.leaders[0],voteTarget:100,budgetAllocated:10000};
  const report={...bundle.operations!.reports[0],leaderId:leader.id,eventId:event.id,reportedVoters:10};
  const expense={...bundle.expenses[0],responsibleLeaderId:leader.id,eventId:event.id,amount:12000};
  const row=eventControl(event,[leader],[],[],[report],[expense],new Date('2026-10-12T15:00:00Z'))[0];
  assert.equal(row.reported,10);assert.equal(row.compliance,0);assert.equal(row.registered,0);assert.equal(row.arrived,0);assert.equal(row.costPerRegistered,null);assert.equal(row.alerts.length,2);
  assert.equal(eventControl(event,[leader],[],[],[{...report,reportedVoters:50}],[expense],new Date('2026-10-12T15:00:00Z'))[0].reported,50);
});
test('Missing history yields no forecast and invalid quantities are rejected',()=>{
  assert.equal(accountability('team-a',[],[],[],[]).forecast7,null);
  const request=bundle.operations!.requests[0];assert.throws(()=>validateRequest({...request,quantity:1.5,amount:1.5*request.unitCost}),/entero/);
  assert.throws(()=>validateRequest({...request,amount:NaN}),/total/);
  assert.throws(()=>validateEvent({...bundle.operations!.events[0],endAt:bundle.operations!.events[0].startAt}),/posterior/);
});

test('Transport list reconciliation uses unique people and subtracts existing requests without assuming event attendance',()=>{
  const voter={...bundle.voters[0],requiresTransport:true};const event={...bundle.operations!.events[0],type:'Jornada electoral' as const,municipality:voter.municipality};
  const missing=unrequestedTransport(event,[voter,{...voter,id:'duplicate'}],[]);assert.equal(missing[0].missing,1);
  const request={...bundle.operations!.requests[0],leaderId:voter.leaderId,eventId:event.id,quantity:1};assert.equal(unrequestedTransport(event,[voter],[request]).length,0);
  assert.equal(unrequestedTransport({...event,type:'Evento'},[voter],[]).length,0);
});
