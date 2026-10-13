import {test} from 'node:test';
import assert from 'node:assert/strict';
import {electionTransportRoute} from '../src/lib/electionTransport';
import type {TransportVehicle,UserProfile} from '../src/types';
const admin:UserProfile={uid:'admin',email:'a@test.invalid',displayName:'Admin',tenantId:'t1',role:'AdminTenant',active:true,accessVersion:2,createdAt:''};
const vehicle:TransportVehicle={id:'bus',tenantId:'t1',licensePlate:'ABC123',driverName:'Private driver',driverPhone:'private-phone',dailyCost:900,fuelBudget:200,capacity:19,assignedZone:'Rural',status:'Operativo - Día D',vehicleType:'Microbús / Van (19 pas)',latitude:9.9,longitude:-74.5,plannedRoute:{name:'Arjona → Astrea',stops:[{name:'Arjona',latitude:9.5,longitude:-74},{name:'Astrea',latitude:9.6,longitude:-74}],geometry:[{latitude:9.5,longitude:-74},{latitude:9.6,longitude:-74}],distanceMeters:11000,durationSeconds:900,provider:'Archivo',calculatedAt:'2026-10-10'}};
test('Election transport publishes only a planned route and passenger instructions, without private GPS, phone or costs',()=>{
  const record=electionTransportRoute(vehicle,admin,'r1','2027-10-31','06:30','Llegar temprano');
  assert.equal(record.vehiclePlate,'ABC123');assert.equal(record.electionDate,'2027-10-31');
  assert.equal(JSON.stringify(record).includes('private-phone'),false);
  for(const field of ['latitude','longitude','driverName','driverPhone','dailyCost','fuelBudget','userId','deviceId'])assert.equal(Object.hasOwn(record,field),false,field);
  assert.deepEqual(record.route,vehicle.plannedRoute);assert.notEqual(record.route,vehicle.plannedRoute);
});
test('Election transport refuses non-admins, other organizations, invalid dates, invalid times and unplanned vehicles',()=>{
  const publish=(actor=admin,date='2027-10-31',time='06:30',bus=vehicle)=>electionTransportRoute(bus,actor,'r1',date,time,'');
  assert.throws(()=>publish({...admin,role:'Alcalde'}),/administrador/);
  assert.throws(()=>publish({...admin,tenantId:'other'}),/administrador/);
  assert.throws(()=>publish(admin,'2027-02-30'),/fecha/);
  assert.throws(()=>publish(admin,'2027-10-31','24:00'),/hora/);
  assert.throws(()=>publish(admin,'2027-10-31','06:30',{...vehicle,plannedRoute:undefined}),/planificada/);
});
