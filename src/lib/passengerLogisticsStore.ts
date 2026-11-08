import {collection,doc,onSnapshot,query,runTransaction,setDoc,where,type Firestore} from 'firebase/firestore';
import {verifySavedRecord} from './saveVerification';
import {tripDays,validatePassengerEvent,vehicleKey,type PassengerEvent} from './passengerLogistics';
import type {UserProfile} from '../types';
import {requireOnlineMutation} from './offlineMutations';

export const PASSENGER_EVENT_COLLECTION='eventos_workspace';
export const canManagePassengers=(user:UserProfile|null)=>!!user&&user.active!==false&&['AdminGlobal','AdminTenant'].includes(user.role);
function authorize(user:UserProfile,tenantId:string){
  if(!canManagePassengers(user)||(user.role!=='AdminGlobal'&&user.tenantId!==tenantId))throw new Error('El administrador de la organización debe gestionar el transporte del evento.');
}
export function listenPassengerEvents(db:Firestore,tenantId:string,onData:(events:PassengerEvent[],cached:boolean)=>void,onError:(error:Error)=>void){
  return onSnapshot(query(collection(db,PASSENGER_EVENT_COLLECTION),where('tenantId','==',tenantId)),{includeMetadataChanges:true},snapshot=>{
    const events=snapshot.docs.map(d=>d.data()).filter(d=>d.kind==='passenger-logistics-v1') as PassengerEvent[];
    onData(events.sort((a,b)=>b.startAt.localeCompare(a.startAt)),snapshot.metadata.fromCache||snapshot.metadata.hasPendingWrites);
  },onError);
}
export async function createPassengerEvent(db:Firestore,user:UserProfile,event:PassengerEvent){
  requireOnlineMutation('Conéctese para crear el evento de pasajeros. Se conserva el formulario.');
  authorize(user,event.tenantId);validatePassengerEvent(event);
  if(event.createdBy!==user.uid||event.revision!==1||event.passengers.length||event.trips.length)throw new Error('Cree primero el evento vacío.');
  const ref=doc(db,PASSENGER_EVENT_COLLECTION,event.id);
  await setDoc(ref,event);await verifySavedRecord(ref,{revision:1,createdBy:user.uid,kind:event.kind});
}
/** Event and fleet calendars commit together; a concurrent edit cannot overbook. */
export async function updatePassengerEvent(db:Firestore,user:UserProfile,eventId:string,tenantId:string,revision:number,action:string,update:(event:PassengerEvent)=>PassengerEvent){
  requireOnlineMutation('Conéctese para confirmar reservas y cupos de pasajeros. Se conserva el formulario.');
  authorize(user,tenantId);const ref=doc(db,PASSENGER_EVENT_COLLECTION,eventId);
  await runTransaction(db,async tx=>{
    const snapshot=await tx.get(ref),before=snapshot.data() as PassengerEvent|undefined;
    if(!before||before.kind!=='passenger-logistics-v1'||before.tenantId!==tenantId)throw new Error('No se encontró el evento en esta organización.');
    if(before.revision!==revision)throw new Error('Otra persona actualizó el evento. Revise los datos recientes y vuelva a intentarlo.');
    const next=update(structuredClone(before));
    if(next.id!==before.id||next.tenantId!==before.tenantId||next.createdBy!==before.createdBy)throw new Error('No cambie la identidad del evento.');
    next.revision=before.revision+1;
    next.history=[...before.history,{at:new Date().toISOString(),actor:user.displayName||user.uid,action:action.slice(0,250)}].slice(-100);
    validatePassengerEvent(next);
    const calendars=new Map<string,{vehicleId:string;day:string}>();
    const signature=(trip:PassengerEvent['trips'][number])=>JSON.stringify([vehicleKey(trip.vehicle),trip.startAt,trip.endAt,trip.status==='cancelled']);
    const changed=new Set([...before.trips,...next.trips].filter(trip=>{
      const old=before.trips.find(t=>t.id===trip.id),fresh=next.trips.find(t=>t.id===trip.id);
      return !old||!fresh||signature(old)!==signature(fresh);
    }).map(trip=>trip.id));
    for(const trip of [...before.trips,...next.trips].filter(t=>changed.has(t.id)))for(const day of tripDays(trip)){
      const vehicleId='passenger-'+vehicleKey(trip.vehicle);
      calendars.set(`${tenantId}--${vehicleId}--${day}`,{vehicleId,day});
    }
    const rows=await Promise.all([...calendars].map(async([id,meta])=>({id,...meta,snapshot:await tx.get(doc(db,'agenda_vehiculos',id))})));
    for(const row of rows){
      const previous=row.snapshot.data();
      if(previous&&previous.tenantId!==tenantId)throw new Error('Agenda de vehículo fuera de esta organización.');
      const slots:( {tripId:string;eventId:string;startAt:string;endAt:string})[]=(previous?.slots||[]).filter((slot:{eventId:string})=>slot.eventId!==eventId);
      const added=next.trips.filter(t=>t.status!=='cancelled'&&'passenger-'+vehicleKey(t.vehicle)===row.vehicleId&&tripDays(t).includes(row.day));
      for(const trip of added){
        if(slots.some(slot=>Date.parse(trip.startAt)<Date.parse(slot.endAt)&&Date.parse(slot.startAt)<Date.parse(trip.endAt)))throw new Error(`El vehículo ${trip.vehicle} ya está reservado en otro evento durante ese horario.`);
        slots.push({tripId:trip.id,eventId,startAt:trip.startAt,endAt:trip.endAt});
      }
      if(slots.length>100)throw new Error('El vehículo superó 100 trayectos en el día.');
      tx.set(doc(db,'agenda_vehiculos',row.id),{id:row.id,tenantId,vehicleId:row.vehicleId,day:row.day,slots});
    }
    tx.set(ref,next);
  });
  await verifySavedRecord(ref,{revision:revision+1});
}
