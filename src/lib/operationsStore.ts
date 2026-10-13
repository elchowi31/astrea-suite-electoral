import { doc, runTransaction, type Transaction } from 'firebase/firestore';
import { auth, db } from './firebase';
import { canCoordinate, overlaps, passengerTotal, validateEvent, validateRequest, RESOURCE_CATALOG, TRANSPORT_RESOURCE, type OperationalEvent, type ResourceRequest, type TransportTrip, type LeaderProgressReport } from './operations';
import type { TransportVehicle, UserProfile } from '../types';
import { stockAvailable, stockMissing, releasableTrip, queueIsFresh } from './operations';

const reference = (collection: string, id: string) => doc(db,collection,id);
function actor(user: UserProfile, tenantId: string) {
  if(auth.currentUser?.uid!==user.uid || (user.tenantId!==tenantId && user.role!=='AdminGlobal'))throw new Error('Inicie sesión en esta organización.');
}
function audit(tx: Transaction, tenantId: string, user: UserProfile, entity: string, id: string, metadata:Record<string,string|number>={}) {
  const auditId=crypto.randomUUID();tx.set(reference('auditoria',auditId),{id:auditId,tenantId,actorId:user.uid,entity,entityId:id,action:'update',metadata,createdAt:new Date().toISOString()});
}
export async function saveEvent(event: OperationalEvent, user: UserProfile) {
  actor(user,event.tenantId);validateEvent(event);
  await runTransaction(db,async tx=>{const ref=reference('jornadas_operativas',event.id);const existing=(await tx.get(ref)).data();
    if(existing && (existing.tenantId!==event.tenantId || !canCoordinate(user)))throw new Error('Solo coordinación puede editar la jornada.');
    tx.set(ref,{...event,createdBy:existing?.createdBy||user.uid,createdAt:existing?.createdAt||event.createdAt});audit(tx,event.tenantId,user,'jornadas_operativas',event.id);
  });
}
export async function saveRequest(request: ResourceRequest, user: UserProfile, onlyCreate=false) {
  actor(user,request.tenantId);validateRequest(request);
  await runTransaction(db,async tx=>{
    const ref=reference('solicitudes_recursos',request.id);const old=(await tx.get(ref)).data() as ResourceRequest|undefined;
    if(onlyCreate&&old)throw new Error('Este líder ya tiene una solicitud generada desde el listado. Revísela en Solicitudes y jornadas; registre un ajuste manual si hace falta.');
    if(old && (old.tenantId!==request.tenantId || old.status!=='Pendiente' || old.reservedPassengers>0 || (old.createdBy!==user.uid && !canCoordinate(user))))throw new Error('Solo puede editar solicitudes pendientes sin asignaciones.');
    if(request.leaderId){const l=(await tx.get(reference('lideres',request.leaderId))).data();if(l?.tenantId!==request.tenantId)throw new Error('El líder no pertenece a esta organización.');}
    if(request.candidateId){const c=(await tx.get(reference('candidatos',request.candidateId))).data();if(c?.tenantId!==request.tenantId)throw new Error('La candidatura no pertenece a esta organización.');}
    if(request.eventId){const e=(await tx.get(reference('jornadas_operativas',request.eventId))).data();if(e?.tenantId!==request.tenantId || e.status==='Cancelado')throw new Error('Seleccione una jornada activa de esta organización.');}
    tx.set(ref,{...request,status:'Pendiente',createdBy:old?.createdBy||user.uid,createdAt:old?.createdAt||request.createdAt,reservedPassengers:0,arrivedPassengers:0,expenseId:''});audit(tx,request.tenantId,user,'solicitudes_recursos',request.id);
  });
}
export async function changeRequest(request: ResourceRequest, status: ResourceRequest['status'], user: UserProfile) {
  actor(user,request.tenantId);if(!canCoordinate(user))throw new Error('Coordinación debe aprobar o entregar recursos.');
  await runTransaction(db,async tx=>{
    const ref=reference('solicitudes_recursos',request.id);const data=(await tx.get(ref)).data() as ResourceRequest|undefined;
    if(!data||data.tenantId!==request.tenantId||data.status!==request.status)throw new Error('La solicitud cambió. Revise su estado actualizado.');
    if(!((data.status==='Pendiente'&&['Aprobada','Rechazada'].includes(status))||(data.status==='Aprobada'&&['Entregada','Rechazada'].includes(status))))throw new Error('El cambio de estado no está permitido.');
    if(status==='Rechazada'&&data.reservedPassengers>0)throw new Error('Cancele primero los viajes de esta solicitud.');
    if(status==='Entregada'&&data.resource===TRANSPORT_RESOURCE&&data.arrivedPassengers<data.quantity)throw new Error('Falta registrar la llegada de pasajeros en Transporte.');
    if(status==='Rechazada'&&((data.transferredIn||0)>0||(data.transferredOut||0)>0))throw new Error('Esta solicitud tiene recursos transferidos; conserve su trazabilidad.');
    tx.update(ref,{status,...(status==='Entregada'&&data.resource!==TRANSPORT_RESOURCE?{deliveredQuantity:stockMissing(data)}:{})});audit(tx,data.tenantId,user,'solicitudes_recursos',data.id);
  });
}
/** Deterministic expense id and transaction make repeated clicks safe; a request is never also counted as paid. */
export async function requestToExpense(request: ResourceRequest, user: UserProfile) {
  actor(user,request.tenantId);if(!canCoordinate(user))throw new Error('Coordinación debe registrar este gasto.');
  await runTransaction(db,async tx=>{
    const ref=reference('solicitudes_recursos',request.id);const data=(await tx.get(ref)).data() as ResourceRequest|undefined;
    if(!data||data.tenantId!==request.tenantId||!['Aprobada','Entregada'].includes(data.status)||data.amount<=0)throw new Error('Apruebe una solicitud con valor antes de registrar su gasto.');
    const id=`${request.id}--gasto`;const expenseRef=reference('gastos',id);const existing=await tx.get(expenseRef);
    if(data.expenseId||existing.exists())return;
    const category=RESOURCE_CATALOG.find(item=>item.name===data.resource)!;
    const quantity=Math.max(0,data.quantity-(data.transferredIn||0));
    if(!quantity)throw new Error('La necesidad se cubrió por cesión. El costo permanece en el gasto de origen.');
    tx.set(expenseRef,{id,tenantId:data.tenantId,component:category.component,rubro:category.rubro,phase:'Campaña Oficial',description:data.description,amount:Math.round(quantity*data.unitCost),quantity,unitCost:data.unitCost,unitMeasure:category.unit,date:new Date().toISOString().slice(0,10),status:'Pendiente',municipality:data.municipality,responsibleLeaderId:data.leaderId,candidateId:data.candidateId,eventId:data.eventId,requestId:data.id,notes:data.notes,createdBy:user.uid,createdAt:new Date().toISOString()});
    tx.update(ref,{expenseId:id});audit(tx,data.tenantId,user,'gastos',id);
  });
}
function bookingDays(trip: TransportTrip) {
  const start=Date.parse(trip.startAt),end=Date.parse(trip.endAt);
  if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start||end-start>86400000)throw new Error('Indique un viaje de hasta 24 horas con inicio y final válidos.');
  return [...new Set([new Date(start).toISOString().slice(0,10),new Date(end-1).toISOString().slice(0,10)])];
}
type Booking = {tripId:string;startAt:string;endAt:string};
export async function saveProgressReport(report: LeaderProgressReport, user: UserProfile) {
  actor(user,report.tenantId);
  if(!Number.isInteger(report.reportedVoters)||report.reportedVoters<0||report.reportedVoters>1000000)throw new Error('Indique el total acumulado de votantes reportados, entre 0 y 1.000.000.');
  if(report.id!==`${report.tenantId}--${report.eventId}--${report.leaderId}`)throw new Error('Identificador de reporte inválido.');
  if(!canCoordinate(user)&&user.assignedLeaderId!==report.leaderId)throw new Error('Solo puede reportar por el líder asignado a su cuenta.');
  await runTransaction(db,async tx=>{
    const ref=reference('reportes_jornada',report.id);const previous=(await tx.get(ref)).data();
    const event=(await tx.get(reference('jornadas_operativas',report.eventId))).data();const leader=(await tx.get(reference('lideres',report.leaderId))).data();
    if(event?.tenantId!==report.tenantId||leader?.tenantId!==report.tenantId)throw new Error('Seleccione una jornada y líder de esta organización.');
    if((previous?.revision||0)!==report.revision)throw new Error('Otra persona actualizó el acumulado. Revise el reporte más reciente.');
    if(previous&&report.reportedVoters<previous.reportedVoters&&!report.notes.trim())throw new Error('Explique la corrección al reducir el acumulado.');
    tx.set(ref,{...report,createdBy:previous?.createdBy||user.uid,updatedBy:user.uid,updatedAt:new Date().toISOString(),revision:report.revision+1});
    audit(tx,report.tenantId,user,'reportes_jornada',report.id,{previous:previous?.reportedVoters||0,current:report.reportedVoters,revision:report.revision+1});
  });
}
export async function saveTrip(trip: TransportTrip, user: UserProfile) {
  actor(user,trip.tenantId);if(!canCoordinate(user))throw new Error('Coordinación debe asignar el transporte.');
  if(!trip.origin.trim()||!trip.destination.trim()||!trip.allocations.length||trip.allocations.length>5||new Set(trip.allocations.map(a=>a.requestId)).size!==trip.allocations.length)throw new Error('Complete origen, destino y de una a cinco solicitudes distintas.');
  const days=bookingDays(trip);
  await runTransaction(db,async tx=>{
    const ref=reference('viajes_operativos',trip.id);const old=(await tx.get(ref)).data() as TransportTrip|undefined;
    if(old && (old.tenantId!==trip.tenantId || ['Finalizado','Cancelado'].includes(old.status) || old.vehicleId!==trip.vehicleId || old.eventId!==trip.eventId || old.startAt!==trip.startAt || old.endAt!==trip.endAt || JSON.stringify(old.allocations.map(a=>[a.requestId,a.passengers]))!==JSON.stringify(trip.allocations.map(a=>[a.requestId,a.passengers]))))throw new Error('Cancele el viaje programado para cambiar vehículo, horario o pasajeros.');
    if(!old&&trip.status!=='Programado')throw new Error('Un viaje nuevo debe estar programado.');
    if(old&&trip.status==='Programado'&&old.status!=='Programado')throw new Error('Un viaje iniciado no puede volver a programado.');
    const vehicle=(await tx.get(reference('vehiculos',trip.vehicleId))).data() as TransportVehicle|undefined;
    const event=(await tx.get(reference('jornadas_operativas',trip.eventId))).data() as OperationalEvent|undefined;
    if(vehicle?.tenantId!==trip.tenantId||event?.tenantId!==trip.tenantId)throw new Error('Vehículo y jornada deben pertenecer a la organización.');
    if(trip.status!=='Cancelado'&&(vehicle.status==='En Mantenimiento'||event.status==='Cancelado'||passengerTotal(trip)>vehicle.capacity))throw new Error('El vehículo no está disponible, la jornada está cancelada o se superó su capacidad.');
    const bookingRefs=days.map(day=>reference('agenda_vehiculos',`${trip.tenantId}--${trip.vehicleId}--${day}`));
    const books=await Promise.all(bookingRefs.map(ref=>tx.get(ref)));
    const slots=books.map(book=>(book.data()?.slots||[]) as Booking[]);
    if(trip.status!=='Cancelado'&&slots.some(rows=>rows.some(slot=>slot.tripId!==trip.id&&overlaps(slot,trip))))throw new Error('El vehículo ya está reservado en este horario. Actualice la propuesta.');
    const requests=await Promise.all(trip.allocations.map(a=>tx.get(reference('solicitudes_recursos',a.requestId))));
    if(new Set(requests.map(r=>r.data()?.direction||'Ida')).size>1)throw new Error('Programe ida y regreso en viajes separados.');
    const updated=requests.map((snapshot,index)=>{
      const data=snapshot.data() as ResourceRequest|undefined;const allocation=trip.allocations[index];const before=old?.allocations[index];
      if(!data||data.tenantId!==trip.tenantId||data.eventId!==trip.eventId||data.resource!==TRANSPORT_RESOURCE||(trip.status!=='Cancelado'&&data.status!=='Aprobada'))throw new Error('Una solicitud ya no está aprobada para esta jornada.');
      if(!Number.isInteger(allocation.passengers)||allocation.passengers<=0||!Number.isInteger(allocation.arrived)||allocation.arrived<0||allocation.arrived>allocation.passengers)throw new Error('Revise los pasajeros asignados y las llegadas.');
      if(trip.status!=='Finalizado'&&allocation.arrived!==0)throw new Error('Registre las llegadas al finalizar el viaje.');
      const previousReservation=before?.passengers||0;
      const currentReservation=trip.status==='Cancelado'?0:trip.status==='Finalizado'?allocation.arrived:allocation.passengers;
      const reservedPassengers=data.reservedPassengers-previousReservation+currentReservation;
      const arrivedPassengers=data.arrivedPassengers+(trip.status==='Finalizado'?allocation.arrived:0);
      if(reservedPassengers<0||reservedPassengers>data.quantity||arrivedPassengers>reservedPassengers)throw new Error('La solicitud ya tiene cupos en otro viaje. Revise la disponibilidad.');
      return {ref:snapshot.ref,reservedPassengers,arrivedPassengers};
    });
    slots.forEach((rows,index)=>{const next=rows.filter(slot=>slot.tripId!==trip.id);if(['Programado','En curso'].includes(trip.status))next.push({tripId:trip.id,startAt:trip.startAt,endAt:trip.endAt});if(next.length>100)throw new Error('Se alcanzó el límite de 100 viajes diarios por vehículo.');tx.set(bookingRefs[index],{tenantId:trip.tenantId,vehicleId:trip.vehicleId,day:days[index],slots:next});});
    updated.forEach(item=>tx.update(item.ref,{reservedPassengers:item.reservedPassengers,arrivedPassengers:item.arrivedPassengers,...(trip.status==='En curso'||trip.status==='Finalizado'?{queueUpdatedAt:''}:{})}));
    tx.set(ref,{...trip,createdBy:old?.createdBy||user.uid,createdAt:old?.createdAt||trip.createdAt});audit(tx,trip.tenantId,user,'viajes_operativos',trip.id);
  });
}

export async function confirmResourceCount(request:ResourceRequest,values:{waitingPassengers?:number;consumedQuantity?:number;confirmedSurplus?:number},user:UserProfile) {
  actor(user,request.tenantId);
  await runTransaction(db,async tx=>{
    const ref=reference('solicitudes_recursos',request.id);const r=(await tx.get(ref)).data() as ResourceRequest;
    if(!r||r.tenantId!==request.tenantId||!['Aprobada','Entregada'].includes(r.status)||(!canCoordinate(user)&&user.assignedLeaderId!==r.leaderId))throw new Error('El responsable o coordinación debe confirmar este conteo.');
    let update:Record<string,number|string>;
    if(r.resource===TRANSPORT_RESOURCE){const n=values.waitingPassengers;if(n===undefined||!Number.isInteger(n)||n<0||n>r.quantity-r.arrivedPassengers)throw new Error('El conteo debe estar entre cero y las personas pendientes; registre otra solicitud para personas adicionales.');update={waitingPassengers:n,queueUpdatedAt:new Date().toISOString()};}
    else {const consumed=values.consumedQuantity??0,surplus=values.confirmedSurplus??0;
      if(!Number.isFinite(consumed)||!Number.isFinite(surplus)||consumed<0||surplus<0||consumed<(r.consumedQuantity||0)||consumed-(r.consumedQuantity||0)+surplus>stockAvailable(r))throw new Error('El consumo acumulado no puede disminuir y el sobrante no puede superar la existencia disponible.');
      update={consumedQuantity:consumed,confirmedSurplus:surplus};
    }
    tx.update(ref,update);audit(tx,r.tenantId,user,'solicitudes_recursos',r.id,{...update,operation:'conteo_confirmado'});
  });
}

export async function transferResource(source:ResourceRequest,target:ResourceRequest,quantity:number,note:string,user:UserProfile,operationId:string) {
  actor(user,source.tenantId);if(!canCoordinate(user)||!Number.isFinite(quantity)||quantity<=0||!note.trim()||!operationId.startsWith(`${source.tenantId}--`))throw new Error('Coordinación debe indicar cantidad, motivo e identificador de la cesión.');
  await runTransaction(db,async tx=>{
    const log=reference('auditoria',operationId);if((await tx.get(log)).exists())return;
    const refs=[reference('solicitudes_recursos',source.id),reference('solicitudes_recursos',target.id)];
    const [a,b]=(await Promise.all(refs.map(ref=>tx.get(ref)))).map(s=>s.data() as ResourceRequest);
    if(!a||!b||a.id===b.id||a.tenantId!==source.tenantId||b.tenantId!==a.tenantId||a.eventId!==b.eventId||a.resource!==b.resource||a.resource===TRANSPORT_RESOURCE||(a.leaderId||a.candidateId)===(b.leaderId||b.candidateId)||!['Aprobada','Entregada'].includes(a.status)||b.status!=='Aprobada')throw new Error('La cesión requiere responsables distintos, el mismo recurso y jornada, y una solicitud receptora aprobada.');
    if(quantity>Math.min(a.confirmedSurplus||0,stockAvailable(a),stockMissing(b)))throw new Error('El sobrante o la necesidad disponible cambió. Revise las cantidades.');
    if(b.expenseId)throw new Error('La solicitud receptora ya tiene un gasto. Cree una necesidad sin gasto para recibir la cesión sin duplicar costos.');
    tx.update(refs[0],{transferredOut:(a.transferredOut||0)+quantity,confirmedSurplus:(a.confirmedSurplus||0)-quantity});
    tx.update(refs[1],{transferredIn:(b.transferredIn||0)+quantity});
    tx.set(log,{id:operationId,tenantId:a.tenantId,actorId:user.uid,entity:'solicitudes_recursos',entityId:a.id,action:'transfer',metadata:{targetId:b.id,quantity,resource:a.resource,note:note.trim().slice(0,1500)},createdAt:new Date().toISOString()});
  });
}

export async function reassignTrip(trip:TransportTrip,target:ResourceRequest,passengers:number,origin:string,destination:string,note:string,user:UserProfile) {
  actor(user,trip.tenantId);if(!canCoordinate(user)||!origin.trim()||!destination.trim()||!note.trim()||!Number.isInteger(passengers)||passengers<=0)throw new Error('Complete recogida, destino, pasajeros y motivo de la reasignación.');
  await runTransaction(db,async tx=>{
    const ref=reference('viajes_operativos',trip.id);const current=(await tx.get(ref)).data() as TransportTrip;
    const assignment=(t:TransportTrip)=>JSON.stringify(t.allocations.map(a=>[a.requestId,a.passengers,a.arrived]));
    if(!current||current.tenantId!==trip.tenantId||current.status!==trip.status||current.vehicleId!==trip.vehicleId||current.startAt!==trip.startAt||current.endAt!==trip.endAt||assignment(current)!==assignment(trip))throw new Error('El viaje cambió. Actualice la propuesta.');
    if(current.allocations.some(a=>a.requestId===target.id))throw new Error('Seleccione una solicitud de destino distinta.');
    const original=await Promise.all(current.allocations.map(a=>tx.get(reference('solicitudes_recursos',a.requestId))));
    const donors=original.map(s=>s.data() as ResourceRequest);
    const recipientRef=reference('solicitudes_recursos',target.id);const recipient=(await tx.get(recipientRef)).data() as ResourceRequest;
    const vehicle=(await tx.get(reference('vehiculos',current.vehicleId))).data() as TransportVehicle;
    const event=(await tx.get(reference('jornadas_operativas',current.eventId))).data() as OperationalEvent;
    if(!releasableTrip(current,donors)||!vehicle||vehicle.tenantId!==current.tenantId||vehicle.status==='En Mantenimiento'||!event||event.status==='Cancelado'||!recipient||recipient.tenantId!==current.tenantId||recipient.eventId!==current.eventId||recipient.municipality!==vehicle.municipality||recipient.status!=='Aprobada'||recipient.resource!==TRANSPORT_RESOURCE||!queueIsFresh(recipient))throw new Error('Confirme las colas de espera y la disponibilidad antes de reasignar. Los viajes iniciados se conservan.');
    const needed=Math.min(recipient.quantity-recipient.reservedPassengers,(recipient.waitingPassengers||0)-(recipient.reservedPassengers-recipient.arrivedPassengers));
    if(passengers>needed||passengers>vehicle.capacity)throw new Error('La demanda o capacidad cambió. Genere otra propuesta.');
    original.forEach((s,i)=>tx.update(s.ref,{reservedPassengers:donors[i].reservedPassengers-current.allocations[i].passengers}));
    tx.update(recipientRef,{reservedPassengers:recipient.reservedPassengers+passengers});
    tx.update(ref,{allocations:[{requestId:target.id,passengers,arrived:0}],origin:origin.trim(),destination:destination.trim(),notes:`${current.notes}\nReasignación: ${note.trim()}`.slice(-1500)});
    audit(tx,current.tenantId,user,'viajes_operativos',current.id,{operation:'reasignacion',previousRequests:current.allocations.map(a=>a.requestId).join(','),targetId:target.id,passengers,note:note.trim().slice(0,500)});
  });
}
