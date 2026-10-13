import { doc, runTransaction } from 'firebase/firestore';
import { auth, db } from './firebase';
import { personalDemoId } from '../data/contextualDemo';
import { prepareDemoPresentation } from '../data/demoPresentation';
import type { DemoBundle } from '../data/demoSeed';
import type {CampaignTask} from '../types';
import { canonicalStoredValue, omitUndefined } from './serialization';
import { EDIT_FIELDS } from './recordEditing';
import { validateEvent, validateRequest } from './operations';
import {mergeRegistration,registrationId,type RegistrationChannel} from './eventRegistration';

export const DEMO_COLLECTIONS = {
  candidatos:['candidates','Aspirantes'], lideres:['leaders','Líderes'], votantes_rasos:['voters','Personas registradas'],
  vehiculos:['vehicles','Vehículos'], gastos:['expenses','Gastos'], aportes:['contributions','Aportes'],
  distritos:['districts','Territorios'], propuestas:['proposals','Propuestas'], archivos_drive:['driveFiles','Documentos'],
  comites_coordinaciones:['coordinations','Coordinaciones'], jornadas_operativas:['events','Jornadas'],
  solicitudes_recursos:['requests','Solicitudes'], viajes_operativos:['trips','Viajes'], reportes_jornada:['reports','Reportes de jornada'],
  comites:['committees','Comités'], tareas:['tasks','Tareas'],
  pasajeros_viaje:['allocations','Pasajeros y llegadas de viajes'],
} as const;
export type DemoCollection = keyof typeof DEMO_COLLECTIONS;
const operational = new Set(['events','requests','trips','reports']);
export function demoRows(bundle:DemoBundle,collection:string):any[] {
  if(collection==='pasajeros_viaje')return (bundle.operations?.trips||[]).flatMap(trip=>trip.allocations.map((row,index)=>({...row,id:`${trip.id}--${index}`,description:`${trip.origin} → ${trip.destination} · ${bundle.operations?.requests.find(r=>r.id===row.requestId)?.description||'Pasajeros'}`})));
  if(collection==='comites')return bundle.coordinations.flatMap(row=>row.committees);
  if(collection==='tareas')return bundle.coordinations.flatMap(row=>row.committees.flatMap(committee=>committee.tasks||[]));
  const key=DEMO_COLLECTIONS[collection as DemoCollection]?.[0];
  if(!key)return [];
  return operational.has(key)?(bundle.operations as any)?.[key]||[]:(bundle as any)[key]||[];
}
function setRows(bundle:DemoBundle,collection:string,rows:any[]) {
  if(collection==='pasajeros_viaje'){for(const trip of bundle.operations?.trips||[])trip.allocations=trip.allocations.map((row,index)=>{const next=rows.find(item=>item.id===`${trip.id}--${index}`);return next?{requestId:row.requestId,passengers:next.passengers,arrived:next.arrived}:row;});return;}
  if(collection==='comites'){bundle.coordinations=bundle.coordinations.map(row=>({...row,committees:row.committees.map(item=>rows.find(next=>next.id===item.id)||item)}));return;}
  if(collection==='tareas'){bundle.coordinations=bundle.coordinations.map(row=>({...row,committees:row.committees.map(committee=>{const tasks=(committee.tasks||[]).map(item=>rows.find(next=>next.id===item.id)||item);return {...committee,tasks,tasksCount:tasks.length,completedTasksCount:tasks.filter(task=>task.completed).length};})}));return;}
  const key=DEMO_COLLECTIONS[collection as DemoCollection]?.[0];if(!key)throw new Error('Este tipo de registro no pertenece al entorno de prueba.');
  if(operational.has(key))(bundle.operations as any)[key]=rows;else (bundle as any)[key]=rows;
}
function assertBounded(bundle:DemoBundle) {
  if((bundle.operations?.registrations?.length||0)>1500)throw new Error('La planilla de prueba admite hasta 1.500 registros.');
  const limits:Record<string,number>={candidatos:300,lideres:300,votantes_rasos:1500,vehiculos:150,gastos:300,distritos:150,jornadas_operativas:150,solicitudes_recursos:500,viajes_operativos:300,reportes_jornada:300};
  for(const [collection,limit]of Object.entries(limits))if(demoRows(bundle,collection).length>limit)throw new Error('El entorno de prueba alcanzó su capacidad. Elimine registros antes de añadir más.');
  if(new TextEncoder().encode(JSON.stringify(bundle)).length>900000)throw new Error('El entorno de prueba está lleno. Reduzca registros o textos para guardar.');
}
function apply(row:any,patch:Record<string,unknown>) {
  const result={...row};for(const [key,value]of Object.entries(patch))value===null?delete result[key]:result[key]=value;return result;
}
function safePatch(collection:string,patch:Record<string,unknown>) {
  const allowed=new Set([...(EDIT_FIELDS[collection]||[]).map(field=>field.key),'leaderName','candidateName','locationSource','locationCapturedAt']);
  if(Object.keys(patch).some(key=>!allowed.has(key)))throw new Error('La edición contiene un campo protegido.');
  for(const field of EDIT_FIELDS[collection]||[]){if(!(field.key in patch))continue;const value=patch[field.key];
    if(field.required&&(value==null||!String(value).trim()))throw new Error(`Complete ${field.label}.`);
    if(value!=null&&field.type==='number'&&(!Number.isFinite(value)||field.min!==undefined&&Number(value)<field.min||field.max!==undefined&&Number(value)>field.max))throw new Error(`Revise ${field.label}.`);
    if(value!=null&&field.choices&&!field.choices.includes(String(value)))throw new Error(`Revise ${field.label}.`);
  }
}
export function patchDemoBundle(raw:DemoBundle,collection:string,id:string,patch:Record<string,unknown>,original?:object):DemoBundle {
  safePatch(collection,patch);const bundle=prepareDemoPresentation(structuredClone(raw));const rows=demoRows(bundle,collection);const row=rows.find(item=>item.id===id);
  if(!row)throw new Error('El registro ya no existe. Abra de nuevo la edición.');
  if(original)for(const key of Object.keys(patch)){if(['locationSource','locationCapturedAt'].includes(key))continue;if(canonicalStoredValue(row[key])!==canonicalStoredValue((original as Record<string,unknown>)[key]))throw new Error('Este campo cambió en otra ventana. Cierre y vuelva a abrir la edición.');}
  const next=apply(row,patch);
  for(const field of EDIT_FIELDS[collection]||[])if(field.reference&&next[field.key]&&!demoRows(bundle,field.reference).some(item=>item.id===next[field.key]))throw new Error(`Seleccione una opción válida en ${field.label}.`);
  if(collection==='jornadas_operativas')validateEvent(next);
  if(collection==='solicitudes_recursos'){
    next.amount=Math.round(next.quantity*next.unitCost);validateRequest(next);
    if(next.quantity<next.reservedPassengers||next.reservedPassengers<next.arrivedPassengers)throw new Error('La cantidad debe cubrir los cupos y las llegadas ya registrados.');
  }
  if(collection==='viajes_operativos'){
    if(!Number.isFinite(Date.parse(next.startAt))||!Number.isFinite(Date.parse(next.endAt))||next.endAt<=next.startAt)throw new Error('Revise el inicio y final del viaje.');
  }
  if(collection==='gastos'&&('quantity'in patch||'unitCost'in patch)&&Number.isFinite(next.quantity)&&Number.isFinite(next.unitCost))next.amount=Math.round(next.quantity*next.unitCost);
  setRows(bundle,collection,rows.map(item=>item.id===id?next:item));
  if(['viajes_operativos','pasajeros_viaje','vehiculos'].includes(collection)){
    const requests=bundle.operations?.requests||[];
    for(const request of requests){request.reservedPassengers=0;request.arrivedPassengers=0;}
    for(const trip of bundle.operations?.trips||[]){
      const vehicle=bundle.vehicles.find(row=>row.id===trip.vehicleId);if(!vehicle||trip.allocations.reduce((sum,row)=>sum+row.passengers,0)>vehicle.capacity)throw new Error('Los pasajeros del viaje superan la capacidad del vehículo.');
      for(const allocation of trip.allocations){
        if(!Number.isInteger(allocation.passengers)||!Number.isInteger(allocation.arrived)||allocation.arrived<0||allocation.arrived>allocation.passengers)throw new Error('Las llegadas deben ser enteras y no superar los pasajeros del viaje.');
        const request=requests.find(row=>row.id===allocation.requestId);if(!request||request.eventId!==trip.eventId)throw new Error('La solicitud y el viaje deben pertenecer a la misma jornada.');
        if(trip.status==='Finalizado'){request.reservedPassengers+=allocation.arrived;request.arrivedPassengers+=allocation.arrived;}
        else if(trip.status!=='Cancelado')request.reservedPassengers+=allocation.passengers;
      }
    }
    if(requests.some(row=>row.reservedPassengers>row.quantity))throw new Error('Los cupos asignados superan la cantidad solicitada.');
  }
  assertBounded(bundle);return prepareDemoPresentation(bundle);
}
async function mutate(tenantId:string,change:(bundle:DemoBundle)=>DemoBundle) {
  const uid=auth.currentUser?.uid;if(!uid)throw new Error('Inicie sesión para guardar.');
  await runTransaction(db,async tx=>{const ref=doc(db,'demo',personalDemoId(tenantId,uid));const raw=(await tx.get(ref)).data() as DemoBundle|undefined;
    if(!raw||raw.ownerUid!==uid||raw.tenantId!==tenantId||raw.isSynthetic!==true)throw new Error('No se encontró su entorno de prueba.');
    const next=change(prepareDemoPresentation(raw));assertBounded(next);tx.set(ref,omitUndefined(next));
  });
}
export async function updateDemoRecord(tenantId:string,collection:string,id:string,patch:Record<string,unknown>,original?:Record<string,unknown>) {
  await mutate(tenantId,bundle=>patchDemoBundle(bundle,collection,id,patch,original));
}
export async function saveDemoEntity(tenantId:string,collection:string,record:any) {
  if(record.tenantId!==tenantId||!record.id)throw new Error('Registro inválido para este entorno.');
  await mutate(tenantId,raw=>{const bundle=prepareDemoPresentation(structuredClone(raw));const rows=demoRows(bundle,collection);setRows(bundle,collection,rows.some(row=>row.id===record.id)?rows.map(row=>row.id===record.id?record:row):[...rows,record]);return bundle;});
}
export async function deleteDemoExpense(tenantId:string,id:string) {
  await mutate(tenantId,raw=>{const bundle=structuredClone(raw);bundle.expenses=bundle.expenses.filter(row=>row.id!==id);for(const request of bundle.operations?.requests||[])if(request.expenseId===id)request.expenseId='';return bundle;});
}
export async function saveDemoRegistration(tenantId:string,eventId:string,voterId:string,channel:RegistrationChannel,value:boolean,notes:string) {
  await mutate(tenantId,raw=>{
    const bundle=structuredClone(raw),event=bundle.operations?.events.find(e=>e.id===eventId),voter=bundle.voters.find(v=>v.id===voterId);
    if(!event||!voter)throw new Error('No se encontró la jornada o persona.');
    const rows=bundle.operations!.registrations||[],id=registrationId(event,voter),previous=rows.find(r=>r.id===id);
    const next=mergeRegistration(event,voter,previous,channel,value,notes,auth.currentUser!.uid,true);
    bundle.operations!.registrations=[...rows.filter(r=>r.id!==id),next];return bundle;
  });
}
export async function saveDemoTask(tenantId:string,coordinationId:string,committeeId:string,task:CampaignTask) {
  await mutate(tenantId,raw=>{const bundle=structuredClone(raw);const committee=bundle.coordinations.find(row=>row.id===coordinationId)?.committees.find(row=>row.id===committeeId);if(!committee)throw new Error('No se encontró el comité.');
    committee.tasks=(committee.tasks||[]).some(row=>row.id===task.id)?committee.tasks!.map(row=>row.id===task.id?{...row,completed:task.completed}:row):[...(committee.tasks||[]),task];
    committee.tasksCount=committee.tasks.length;committee.completedTasksCount=committee.tasks.filter(row=>row.completed).length;return bundle;});
}
export async function saveDemoExecutive(tenantId:string,team:Record<string,unknown>) {
  await mutate(tenantId,raw=>{const bundle=structuredClone(raw);if(!bundle.coordinations[0])throw new Error('Cree primero una coordinación.');(bundle.coordinations[0] as any).presentationTeam=team;return bundle;});
}
export const PROMOTABLE_COLLECTIONS=new Set(['candidatos','lideres','votantes_rasos','vehiculos','gastos','aportes','distritos','propuestas','archivos_drive','comites_coordinaciones']);
export function realRecordFromDemo(collection:string,source:any,patch:Record<string,unknown>,id:string,uid:string,consent:boolean,now:string) {
  if(!PROMOTABLE_COLLECTIONS.has(collection))throw new Error('Los viajes, solicitudes y reportes se registran en la operación real mediante su flujo de aprobación.');
  safePatch(collection,patch);if(!Object.keys(patch).length)throw new Error('Reemplace los datos de ejemplo antes de registrarlos como reales.');
  const identity={candidatos:'fullName',lideres:'fullName',votantes_rasos:'fullName',vehiculos:'driverName',aportes:'donorName'}[collection];
  if(identity&&(!patch[identity]||patch[identity]===source[identity]))throw new Error('Ingrese el nombre real de la persona para reemplazar el nombre de ejemplo.');
  const row=apply(source,patch);delete row._realRecordId;delete row._promotedAt;
  for(const field of EDIT_FIELDS[collection]||[]){if(field.reference&&String(row[field.key]||'').startsWith('demo-'))throw new Error(`Seleccione un registro real en ${field.label}, o deje el campo sin asignar.`);}
  for(const key of ['phone','driverPhone','donorPhone','email','donorEmail','coordinatorPhone','coordinatorEmail'])if(row[key]&&(/\.invalid$/i.test(row[key])||/^0+$/.test(row[key])))throw new Error('Corrija o vacíe los teléfonos y correos de ejemplo.');
  for(const key of ['notes','bio','summary','invoiceNumber','supportReceiptNumber'])if(typeof row[key]==='string'&&/demo|fictici|simulad|inexistente/i.test(row[key]))row[key]='';
  if(collection==='votantes_rasos'){
    if(!consent)throw new Error('Confirme la autorización de la persona para registrar sus datos.');
    if(!/^\d{5,15}$/.test(row.documentNumber))throw new Error('Ingrese un documento real válido, sin prefijos de ejemplo.');
    row.verified=false;row.consentGiven=true;row.consentAt=now;row.registeredAt=now;row.dataSource='Formulario';
  }
  if(collection==='gastos'){row.status='Pendiente';delete row.requestId;}
  if(collection==='aportes'){if(/demo|fictici/i.test(row.donorDocument||''))throw new Error('Ingrese el documento real del aportante.');row.cneStatus='Pendiente Soporte';}
  if(collection==='comites_coordinaciones')row.committees=[];
  return {...row,id,createdBy:uid,createdAt:now,updatedBy:uid,updatedAt:now};
}
/** Creates one reviewed record and marks its template in the same atomic transaction. */
export async function promoteDemoRecord(tenantId:string,collection:string,sourceId:string,patch:Record<string,unknown>,original:Record<string,unknown>,consent:boolean) {
  const uid=auth.currentUser?.uid;if(!uid)throw new Error('Inicie sesión para guardar.');
  const id=`${tenantId}--${crypto.randomUUID()}`,auditId=crypto.randomUUID(),now=new Date().toISOString();
  await runTransaction(db,async tx=>{const ref=doc(db,'demo',personalDemoId(tenantId,uid));const raw=(await tx.get(ref)).data() as DemoBundle|undefined;
    if(!raw||raw.ownerUid!==uid||raw.tenantId!==tenantId)throw new Error('No se encontró su entorno de prueba.');
    const bundle=prepareDemoPresentation(structuredClone(raw)),rows=demoRows(bundle,collection),source=rows.find(row=>row.id===sourceId);
    if(!source)throw new Error('El registro ya no existe.');if(source._realRecordId)throw new Error('Esta ficha ya se registró. Edítela desde «Usar datos reales».');
    for(const key of Object.keys(patch))if(!['locationSource','locationCapturedAt'].includes(key)&&canonicalStoredValue(source[key])!==canonicalStoredValue(original[key]))throw new Error('El registro cambió. Abra de nuevo la edición.');
    const row=realRecordFromDemo(collection,source,patch,id,uid,consent,now);
    for(const field of EDIT_FIELDS[collection]||[])if(field.reference&&row[field.key]){const linked=(await tx.get(doc(db,field.reference,row[field.key]))).data();if(linked?.tenantId!==tenantId)throw new Error(`Seleccione una opción real de esta organización en ${field.label}.`);}
    if(collection==='votantes_rasos'){if(row.leaderId)row.leaderName=(await tx.get(doc(db,'lideres',row.leaderId))).data()?.fullName||'';if(row.candidateId)row.candidateName=(await tx.get(doc(db,'candidatos',row.candidateId))).data()?.fullName||'';}
    setRows(bundle,collection,rows.map(item=>item.id===sourceId?{...apply(source,patch),_realRecordId:id,_promotedAt:now}:item));assertBounded(bundle);
    tx.set(doc(db,collection,id),omitUndefined(row));tx.set(ref,omitUndefined(bundle));
    tx.set(doc(db,'auditoria',auditId),{id:auditId,tenantId,actorId:uid,action:'create',entity:collection,entityId:id,createdAt:now,metadata:{sourceDemoId:bundle.id,sourceRecordId:sourceId,reviewedByUser:true}});
  });return id;
}
