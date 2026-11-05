/** Event transport has its own passenger registry, routes and fleet. */
export type Leg = 'outbound' | 'return';
export type LegState = 'waiting' | 'assigned' | 'boarded' | 'arrived' | 'cancelled';
export interface Passenger {
  id:string; name:string; pickup:string; locality:string; places:number; accessible:boolean;
  deadline:string; returnRequired:boolean; returnReadyAt:string; returnDeadline:string; createdAt:string; consentAt:string;
  outboundTripId:string; returnTripId:string; outboundState:LegState; returnState:LegState;
}
export interface PassengerTrip {
  id:string; vehicle:string; coordinator:string; pickup:string; direction:Leg; startAt:string; endAt:string;
  capacity:number; accessible:boolean; status:'scheduled'|'running'|'completed'|'cancelled';
  km:number; kmPerLiter:number; fuelPrice:number; hireCost:number;
}
export interface PassengerEvent {
  id:string; tenantId:string; kind:'passenger-logistics-v1'; type:'Logística de eventos';
  title:string; location:string; startAt:string; endAt:string; createdBy:string; createdAt:string;
  revision:number; passengers:Passenger[]; trips:PassengerTrip[];
  history:{at:string; actor:string; action:string}[];
}
export const normalizePoint=(value:string)=>value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ');
export const vehicleKey=(value:string)=>value.trim().toUpperCase().replace(/[^A-Z0-9]/g,'');
const time=(value:string)=>Date.parse(value);
const validTime=(value:string)=>Number.isFinite(time(value));
const overlap=(a:PassengerTrip,b:PassengerTrip)=>time(a.startAt)<time(b.endAt)&&time(b.startAt)<time(a.endAt);
export const legId=(p:Passenger,leg:Leg)=>leg==='outbound'?p.outboundTripId:p.returnTripId;
export const legState=(p:Passenger,leg:Leg)=>leg==='outbound'?p.outboundState:p.returnState;
export const withLeg=(p:Passenger,leg:Leg,id:string,state:LegState):Passenger=>leg==='outbound'?{...p,outboundTripId:id,outboundState:state}:{...p,returnTripId:id,returnState:state};
export function occupied(event:PassengerEvent,tripId:string){return event.passengers.reduce((n,p)=>n+(['outbound','return'] as Leg[]).reduce((sum,leg)=>sum+(legId(p,leg)===tripId&&!['waiting','cancelled'].includes(legState(p,leg))?p.places:0),0),0);}
export function tripCost(t:PassengerTrip){return t.hireCost+(t.km>0&&t.kmPerLiter>0?t.km/t.kmPerLiter*t.fuelPrice:0);}
export function tripDays(t:PassengerTrip){
  if(!validTime(t.startAt)||!validTime(t.endAt)||time(t.endAt)-time(t.startAt)<60000||time(t.endAt)-time(t.startAt)>86400000)throw new Error('Cada trayecto debe durar entre un minuto y 24 horas.');
  return [...new Set([new Date(t.startAt).toISOString().slice(0,10),new Date(time(t.endAt)-1).toISOString().slice(0,10)])];
}
function fits(p:Passenger,t:PassengerTrip,leg:Leg,now:number){
  return t.status==='scheduled'&&t.direction===leg&&time(t.startAt)>=now
    &&normalizePoint(t.pickup)===normalizePoint(p.pickup)&&(!p.accessible||t.accessible)
    &&(leg==='outbound'?time(t.endAt)<=time(p.deadline):time(t.startAt)>=time(p.returnReadyAt)&&time(t.endAt)<=time(p.returnDeadline));
}
function routeMatches(p:Passenger,t:PassengerTrip,leg:Leg){
  return t.direction===leg&&normalizePoint(t.pickup)===normalizePoint(p.pickup)&&(!p.accessible||t.accessible)
    &&(leg==='outbound'?time(t.endAt)<=time(p.deadline):time(t.startAt)>=time(p.returnReadyAt)&&time(t.endAt)<=time(p.returnDeadline));
}
export function validatePassengerEvent(event:PassengerEvent){
  if(event.kind!=='passenger-logistics-v1'||!event.id||!event.tenantId||!event.title.trim()||event.title.length>120||!event.location.trim()||event.location.length>160)throw new Error('Complete el evento y su punto de encuentro.');
  if(!validTime(event.startAt)||!validTime(event.endAt)||time(event.endAt)<=time(event.startAt))throw new Error('Revise el inicio y final del evento.');
  if(!Number.isInteger(event.revision)||event.revision<1||event.passengers.length>300||event.trips.length>100||event.history.length>100)throw new Error('El evento admite hasta 300 reservas y 100 trayectos.');
  if(new Set(event.passengers.map(p=>p.id)).size!==event.passengers.length||new Set(event.trips.map(t=>t.id)).size!==event.trips.length)throw new Error('Hay identificadores duplicados.');
  for(const t of event.trips){
    tripDays(t);
    if(!t.id||!vehicleKey(t.vehicle)||t.vehicle.length>30||!t.coordinator.trim()||t.coordinator.length>100||!t.pickup.trim()||t.pickup.length>160||!['outbound','return'].includes(t.direction)||!['scheduled','running','completed','cancelled'].includes(t.status))throw new Error('Complete vehículo, responsable y recorrido.');
    if(!Number.isInteger(t.capacity)||t.capacity<1||t.capacity>100||typeof t.accessible!=='boolean')throw new Error('Indique entre 1 y 100 cupos y la accesibilidad del vehículo.');
    if([t.km,t.kmPerLiter,t.fuelPrice,t.hireCost].some(n=>!Number.isFinite(n)||n<0||n>1e9)||(t.km>0&&t.kmPerLiter<=0))throw new Error('Revise distancia, rendimiento y costos del trayecto.');
    if(occupied(event,t.id)>t.capacity)throw new Error('El vehículo no tiene cupos suficientes.');
  }
  const active=event.trips.filter(t=>t.status!=='cancelled');
  for(let i=0;i<active.length;i++)for(let j=i+1;j<active.length;j++)if(vehicleKey(active[i].vehicle)===vehicleKey(active[j].vehicle)&&overlap(active[i],active[j]))throw new Error('El vehículo tiene dos trayectos que se cruzan en horario.');
  for(const p of event.passengers){
    if(!p.id||!p.name.trim()||p.name.length>100||!p.pickup.trim()||p.pickup.length>160||p.locality.length>100||!Number.isInteger(p.places)||p.places<1||p.places>30||typeof p.accessible!=='boolean'||typeof p.returnRequired!=='boolean'||!validTime(p.createdAt)||!validTime(p.consentAt)||!validTime(p.deadline))throw new Error('Complete nombre, origen, autorización, plazo de llegada y entre 1 y 30 plazas por reserva.');
    if(p.returnRequired&&(!validTime(p.returnReadyAt)||!validTime(p.returnDeadline)||time(p.returnReadyAt)<time(p.deadline)||time(p.returnDeadline)<=time(p.returnReadyAt)))throw new Error('Revise los horarios de regreso.');
    if(!p.returnRequired&&(p.returnTripId||p.returnState!=='cancelled'))throw new Error('Esta reserva no solicita regreso.');
    for(const leg of ['outbound','return'] as Leg[]){
      const state=legState(p,leg),id=legId(p,leg);
      if(!['waiting','assigned','boarded','arrived','cancelled'].includes(state))throw new Error('Estado de pasajero inválido.');
      if(['waiting','cancelled'].includes(state)){if(id)throw new Error('Un trayecto pendiente o cancelado no debe retener cupo.');continue;}
      const t=event.trips.find(t=>t.id===id);
      if(!t||t.status==='cancelled'||!routeMatches(p,t,leg))throw new Error('La reserva no coincide con el recorrido, horario o accesibilidad del vehículo.');
      if(leg==='return'&&['boarded','arrived'].includes(state)&&p.outboundState!=='arrived')throw new Error('Confirme primero la llegada de ida.');
    }
    if(p.outboundTripId&&p.returnTripId){const a=event.trips.find(t=>t.id===p.outboundTripId)!,b=event.trips.find(t=>t.id===p.returnTripId)!;if(time(a.endAt)>time(b.startAt))throw new Error('La ida y el regreso se superponen.');}
  }
  if(new TextEncoder().encode(JSON.stringify(event)).length>800000)throw new Error('El evento alcanzó el tamaño máximo. Cree otro evento.');
}
export interface Assignment {passengerId:string; outboundTripId:string; returnTripId:string}
export function proposeAssignments(event:PassengerEvent,now=Date.now()):Assignment[]{
  validatePassengerEvent(event);
  let working=structuredClone(event);const proposals:Assignment[]=[];
  const pending=working.passengers.filter(p=>p.outboundState==='waiting'||(p.returnRequired&&p.returnState==='waiting'&&p.outboundState!=='cancelled'))
    .sort((a,b)=>{const ad=a.outboundState==='arrived'?a.returnDeadline:a.deadline,bd=b.outboundState==='arrived'?b.returnDeadline:b.deadline;return time(ad)-time(bd)||time(a.createdAt)-time(b.createdAt)||a.id.localeCompare(b.id);});
  for(const p of pending){
    const choices=(leg:Leg)=>working.trips.filter(t=>fits(p,t,leg,now)&&t.capacity-occupied(working,t.id)>=p.places).sort((a,b)=>time(a.endAt)-time(b.endAt)||tripCost(a)-tripCost(b)||a.id.localeCompare(b.id));
    let out=p.outboundTripId,back=p.returnTripId;
    if(p.outboundState==='waiting'){
      for(const t of choices('outbound')){
        const r=p.returnRequired?(back?working.trips.find(x=>x.id===back):choices('return').find(x=>time(x.startAt)>=time(t.endAt))):undefined;
        if(p.returnRequired&&(!r||time(r.startAt)<time(t.endAt)))continue;
        out=t.id;back=r?.id||'';break;
      }
      if(!out)continue;
    }else if(p.returnRequired&&p.returnState==='waiting'){
      const end=working.trips.find(t=>t.id===out)?.endAt||p.deadline;
      back=choices('return').find(t=>time(t.startAt)>=time(end))?.id||'';
      if(!back)continue;
    }
    if(out===p.outboundTripId&&back===p.returnTripId)continue;
    proposals.push({passengerId:p.id,outboundTripId:out,returnTripId:back});
    working.passengers=working.passengers.map(x=>x.id===p.id?{...x,outboundTripId:out,returnTripId:back,outboundState:x.outboundState==='waiting'?'assigned':x.outboundState,returnState:x.returnRequired&&x.returnState==='waiting'?'assigned':x.returnState}:x);
  }
  return proposals;
}
export function applyAssignments(event:PassengerEvent,proposals:Assignment[],now=Date.now()):PassengerEvent{
  // A preview is not authority: recalculate against the transaction's current document.
  const allowed=proposeAssignments(event,now);
  if(JSON.stringify(allowed)!==JSON.stringify(proposals))throw new Error('La propuesta cambió. Actualice y revise las asignaciones.');
  const next=structuredClone(event);
  next.passengers=next.passengers.map(p=>{const a=proposals.find(a=>a.passengerId===p.id);return a?{...p,outboundTripId:a.outboundTripId,returnTripId:a.returnTripId,outboundState:p.outboundState==='waiting'?'assigned':p.outboundState,returnState:p.returnRequired&&p.returnState==='waiting'?'assigned':p.returnState}:p;});
  validatePassengerEvent(next);return next;
}
export function cancelTrip(event:PassengerEvent,id:string):PassengerEvent{
  const next=structuredClone(event),trip=next.trips.find(t=>t.id===id);
  if(!trip||trip.status!=='scheduled'||next.passengers.some(p=>legId(p,trip.direction)===id&&['boarded','arrived'].includes(legState(p,trip.direction))))throw new Error('Solo se puede retirar un trayecto programado sin pasajeros embarcados.');
  trip.status='cancelled';next.passengers=next.passengers.map(p=>legId(p,trip.direction)===id?withLeg(p,trip.direction,'','waiting'):p);validatePassengerEvent(next);return next;
}
export function changePassengerState(event:PassengerEvent,id:string,leg:Leg,state:'boarded'|'arrived'|'cancelled'):PassengerEvent{
  const next=structuredClone(event),p=next.passengers.find(p=>p.id===id);
  if(!p)throw new Error('La reserva ya no existe.');
  const previous=legState(p,leg);
  if((state==='boarded'&&previous!=='assigned')||(state==='arrived'&&previous!=='boarded')||(state==='cancelled'&&!['waiting','assigned'].includes(previous)))throw new Error('El cambio de estado no está permitido.');
  let changed=withLeg(p,leg,state==='cancelled'?'':legId(p,leg),state);
  if(leg==='outbound'&&state==='cancelled'&&p.returnRequired)changed=withLeg(changed,'return','','cancelled');
  next.passengers=next.passengers.map(x=>x.id===id?changed:x);validatePassengerEvent(next);return next;
}
export function passengerAlerts(event:PassengerEvent,now=Date.now()){
  const alerts:{id:string;name:string;message:string;critical:boolean}[]=[];
  for(const p of event.passengers){
    if(p.outboundState==='cancelled')continue;
    for(const leg of ['outbound','return'] as Leg[]){
      if(leg==='return'&&!p.returnRequired)continue;
      const state=legState(p,leg),label=leg==='outbound'?'Ida':'Regreso';
      if(['cancelled','arrived'].includes(state))continue;
      const t=event.trips.find(t=>t.id===legId(p,leg)),deadline=time(leg==='outbound'?p.deadline:p.returnDeadline);
      if(state==='waiting')alerts.push({id:p.id+leg,name:p.name,message:`${label}: sin cupo compatible${deadline<now?' · plazo vencido':''}`,critical:deadline-now<=3600000});
      else if(state==='assigned'&&t&&time(t.startAt)<now)alerts.push({id:p.id+leg,name:p.name,message:`${label}: salida vencida sin embarque confirmado`,critical:true});
      else if(state==='boarded'&&t&&time(t.endAt)<now)alerts.push({id:p.id+leg,name:p.name,message:`${label}: falta confirmar llegada`,critical:true});
    }
  }
  return alerts.sort((a,b)=>Number(b.critical)-Number(a.critical));
}
