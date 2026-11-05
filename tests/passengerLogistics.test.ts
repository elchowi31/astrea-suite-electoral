import {test} from 'node:test';
import assert from 'node:assert/strict';
import {applyAssignments,cancelTrip,changePassengerState,occupied,passengerAlerts,proposeAssignments,tripCost,tripDays,validatePassengerEvent} from '../src/lib/passengerLogistics';
import {at,makeEvent,makePassenger,makeTrip,returnTrip} from './passengerFixtures';
const now=Date.parse(at(7));
test('a return request receives both legs atomically; a missing return leaves the whole reservation pending',()=>{
 const e=makeEvent({passengers:[makePassenger()],trips:[makeTrip()]});assert.deepEqual(proposeAssignments(e,now),[]);
 e.trips.push(returnTrip());const plan=proposeAssignments(e,now);assert.equal(plan.length,1);
 const assigned=applyAssignments(e,plan,now);assert.equal(assigned.passengers[0].outboundState,'assigned');assert.equal(assigned.passengers[0].returnState,'assigned');assert.equal(occupied(assigned,'back1'),1);
});
test('group places and existing reservations never overbook seats',()=>{
 const e=makeEvent({passengers:[makePassenger({places:3}),makePassenger({id:'p2',places:2})],trips:[makeTrip(),returnTrip()]});
 const result=applyAssignments(e,proposeAssignments(e,now),now);assert.equal(occupied(result,'out1'),3);assert.equal(result.passengers[1].outboundState,'waiting');
 result.passengers[1]={...result.passengers[1],outboundTripId:'out1',outboundState:'assigned'};assert.throws(()=>validatePassengerEvent(result),/cupos/);
});
test('route, accessibility, arrival deadline and departed trips are constraints',()=>{
 for(const patch of [{pickup:'Otro punto'},{accessible:true},{deadline:at(8)}]){const e=makeEvent({passengers:[makePassenger(patch)],trips:[makeTrip(),returnTrip()]});assert.deepEqual(proposeAssignments(e,now),[]);}
 const e=makeEvent({passengers:[makePassenger({accessible:true})],trips:[makeTrip({accessible:true}),{...returnTrip(),accessible:true}]});assert.equal(proposeAssignments(e,now).length,1);assert.deepEqual(proposeAssignments(e,Date.parse(at(9))),[]);
});
test('deadline then request age decides allocation, independent of participant identity',()=>{
 const e=makeEvent({passengers:[makePassenger({id:'later',deadline:at(11)}),makePassenger({id:'earlier',deadline:at(10)})],trips:[makeTrip({capacity:1}),{...returnTrip(),capacity:1}]});assert.equal(proposeAssignments(e,now)[0].passengerId,'earlier');
});
test('a cancelled trip releases only its leg and allows reallocation while retaining the return commitment',()=>{
 let e=makeEvent({passengers:[makePassenger()],trips:[makeTrip(),returnTrip(),makeTrip({id:'out2',vehicle:'XYZ789'})]});e=applyAssignments(e,proposeAssignments(e,now),now);e=cancelTrip(e,'out1');
 assert.equal(e.passengers[0].outboundState,'waiting');assert.equal(e.passengers[0].returnTripId,'back1');e=applyAssignments(e,proposeAssignments(e,now),now);assert.equal(e.passengers[0].outboundTripId,'out2');
});
test('boarding cannot be cancelled and return boarding requires confirmed outbound arrival',()=>{
 let e=makeEvent({passengers:[makePassenger()],trips:[makeTrip(),returnTrip()]});e=applyAssignments(e,proposeAssignments(e,now),now);
 assert.throws(()=>changePassengerState(e,'p1','return','boarded'),/primero/);e=changePassengerState(e,'p1','outbound','boarded');assert.throws(()=>cancelTrip(e,'out1'),/embarcados/);assert.throws(()=>changePassengerState(e,'p1','outbound','cancelled'),/no está permitido/);
 e=changePassengerState(e,'p1','outbound','arrived');e=changePassengerState(e,'p1','return','boarded');e=changePassengerState(e,'p1','return','arrived');assert.equal(passengerAlerts(e,Date.parse(at(20))).length,0);
});
test('passenger cancellation releases both legs and repeated assignment is idempotent',()=>{
 let e=makeEvent({passengers:[makePassenger()],trips:[makeTrip(),returnTrip()]});e=applyAssignments(e,proposeAssignments(e,now),now);assert.deepEqual(proposeAssignments(e,now),[]);e=changePassengerState(e,'p1','outbound','cancelled');assert.equal(occupied(e,'out1'),0);assert.equal(occupied(e,'back1'),0);assert.deepEqual(proposeAssignments(e,now),[]);
});
test('stale plans, overlapping vehicle schedules, negative costs and fractional places are rejected',()=>{
 const e=makeEvent({passengers:[makePassenger()],trips:[makeTrip(),returnTrip()]});const plan=proposeAssignments(e,now);assert.throws(()=>applyAssignments(e,plan,Date.parse(at(9))),/propuesta cambió/);
 assert.throws(()=>validatePassengerEvent({...e,trips:[makeTrip(),makeTrip({id:'overlap',vehicle:'ABC-123'})]}),/cruzan/);
 assert.throws(()=>validatePassengerEvent({...e,trips:[makeTrip({hireCost:-1})]}),/costos/);
 assert.throws(()=>validatePassengerEvent({...e,passengers:[makePassenger({places:1.5})]}),/plazas/);
});
test('alerts cover missed departures and late arrivals; fuel uses liters, not gallons',()=>{
 let e=makeEvent({passengers:[makePassenger()],trips:[makeTrip(),returnTrip()]});assert.equal(passengerAlerts(e,now).length,2);e=applyAssignments(e,proposeAssignments(e,now),now);assert.match(passengerAlerts(e,Date.parse(at(9)))[0].message,/sin embarque/);e=changePassengerState(e,'p1','outbound','boarded');assert.match(passengerAlerts(e,Date.parse(at(10)))[0].message,/confirmar llegada/);assert.equal(tripCost(makeTrip()),58000);
});
test('midnight trips reserve both days and zero-duration trips are invalid',()=>{
 assert.deepEqual(tripDays(makeTrip({startAt:'2099-03-01T23:30:00Z',endAt:'2099-03-02T00:30:00Z'})),['2099-03-01','2099-03-02']);assert.throws(()=>tripDays(makeTrip({endAt:at(8)})),/minuto/);
});
