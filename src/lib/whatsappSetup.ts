import {doc,getDocFromServer,runTransaction,type Firestore} from 'firebase/firestore';
import type {Leader,UserProfile} from '../types';
import type {OperationalEvent} from './operations';
import {PLATFORM_OWNER_EMAIL} from './accessPolicy';
import {verifySavedRecord} from './saveVerification';
import {requireOnlineMutation} from './offlineMutations';

export type WhatsappConfig={phone:string;responsibleName:string;leaderId:string;eventId:string;municipality:string};
const validId=(id:string)=>/^[\w-]{1,120}$/.test(id);
const activeEvent=(data:Record<string,any>|undefined,tenantId:string)=>data?.tenantId===tenantId&&['Planificado','En curso'].includes(data.status);
export function defaultWhatsappConfig(user:UserProfile|null):WhatsappConfig{
 return {phone:'',responsibleName:user?.email?.toLowerCase()===PLATFORM_OWNER_EMAIL?'Wilson José Arias':user?.displayName||'',leaderId:'',eventId:'',municipality:user?.municipality||'Astrea'};
}
function settingsRef(db:Firestore,uid:string,tenantId:string){
 if(!uid||uid.includes('/')||!validId(tenantId))throw new Error('La cuenta o la organización no son válidas.');
 return doc(db,'usuarios',uid,'whatsapp_config',tenantId);
}
export async function loadWhatsappConfig(db:Firestore,user:UserProfile,tenantId:string):Promise<WhatsappConfig>{
 const saved=(await getDocFromServer(settingsRef(db,user.uid,tenantId))).data();
 if(!saved)return defaultWhatsappConfig(user);
 if(saved.ownerUid!==user.uid||saved.tenantId!==tenantId)throw new Error('La configuración pertenece a otro ámbito.');
 const result=defaultWhatsappConfig(user);
 for(const key of Object.keys(result) as (keyof WhatsappConfig)[])if(typeof saved[key]==='string')result[key]=saved[key];
 if(result.eventId){
  if(!validId(result.eventId))throw new Error('La jornada guardada no es válida.');
  const event=await getDocFromServer(doc(db,'jornadas_operativas',result.eventId));
  if(!activeEvent(event.data(),tenantId))result.eventId='';
 }
 return result;
}
/** Atomically provisions explicit reception references; never reassigns an unrelated leader. */
export async function saveWhatsappConfig(db:Firestore,user:UserProfile,tenantId:string,input:WhatsappConfig):Promise<WhatsappConfig>{
 requireOnlineMutation('Conéctese para configurar la recepción de WhatsApp. El formulario se conserva.');
 if(user.role!=='AdminGlobal'||user.active===false)throw new Error('Se requiere una cuenta de administrador global activa.');
 const phone=input.phone.replace(/[+\s()-]/g,''),responsibleName=input.responsibleName.trim(),municipality=input.municipality.trim();
 if(!/^\d{8,15}$/.test(phone))throw new Error('Indique el número con indicativo, entre 8 y 15 dígitos.');
 if(responsibleName.length<3||responsibleName.length>120)throw new Error('Indique el nombre completo del responsable de recepción.');
 if(!municipality||municipality.length>120)throw new Error('Indique un municipio válido.');
 if(input.eventId&&!validId(input.eventId))throw new Error('Seleccione una jornada válida.');
 const settings=settingsRef(db,user.uid,tenantId);
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify([tenantId,user.uid])));
 const leaderId='wa-owner-'+Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('').slice(0,40);
 const leaderRef=doc(db,'lideres',leaderId),newEventId='wa-reception-'+crypto.randomUUID();
 const now=new Date().toISOString();
 const result=await runTransaction(db,async transaction=>{
  const organization=await transaction.get(doc(db,'organizaciones',tenantId));
  const previous=await transaction.get(settings),leader=await transaction.get(leaderRef);
  if(organization.data()?.active!==true)throw new Error('La organización no está activa.');
  const previousData=previous.data(),leaderData=leader.data();
  if(previous.exists()&&(previousData.ownerUid!==user.uid||previousData.tenantId!==tenantId))throw new Error('La configuración pertenece a otro ámbito.');
  if(leader.exists()&&(leaderData.operatorUid!==user.uid||leaderData.tenantId!==tenantId||leaderData.recordKind!=='whatsapp-operator'))throw new Error('La ficha del responsable requiere revisión.');
  let eventId=input.eventId;
  const oldAuto=typeof previousData?.autoEventId==='string'&&validId(previousData.autoEventId)?previousData.autoEventId:'';
  let autoEventId=oldAuto;
  const selectedId=eventId||oldAuto;
  const selected=selectedId?await transaction.get(doc(db,'jornadas_operativas',selectedId)):undefined;
  if(eventId&&!activeEvent(selected?.data(),tenantId))throw new Error('La jornada seleccionada ya no está activa en esta organización.');
  const canReuseAuto=activeEvent(selected?.data(),tenantId)&&selected?.data()?.createdBy===user.uid&&selected?.data()?.source==='whatsapp-setup'&&selected?.data()?.municipality===municipality;
  let createdEvent:OperationalEvent&{source:string}|undefined;
  if(!eventId){
   if(canReuseAuto)eventId=oldAuto;
   else{
    eventId=newEventId;autoEventId=eventId;
    createdEvent={id:eventId,tenantId,name:'Recepción de solicitudes WhatsApp',type:'Operación de campo',department:user.department||'',municipality,destination:municipality,startAt:now,endAt:new Date(Date.parse(now)+86400000).toISOString(),expectedAttendance:0,status:'Planificado',notes:'Recepción de solicitudes por WhatsApp. Las entregas y los gastos requieren aprobación de coordinación.',createdBy:user.uid,createdAt:now,source:'whatsapp-setup'};
   }
  }
  const responsible={id:leaderId,tenantId,fullName:responsibleName,municipality,phone,email:user.email,operatorUid:user.uid,recordKind:'whatsapp-operator',updatedAt:now};
  if(leader.exists())transaction.update(leaderRef,responsible);
  else{
   const initial:Leader={...responsible,zoneOrDistrict:municipality,commune:'',department:user.department||'',voteTarget:0,votesCommitted:0,activistsCount:0,status:'Activo',budgetAllocated:0};
   transaction.set(leaderRef,{...initial,createdAt:now});
  }
  if(createdEvent)transaction.set(doc(db,'jornadas_operativas',eventId),createdEvent);
  const config:WhatsappConfig={phone,responsibleName,leaderId,eventId,municipality};
  const persisted={...config,tenantId,ownerUid:user.uid,autoEventId,updatedAt:now};
  transaction.set(settings,persisted);
  return {config,persisted,responsible,createdEvent};
 });
 await Promise.all([
  verifySavedRecord(settings,result.persisted),
  verifySavedRecord(leaderRef,result.responsible),
  verifySavedRecord(doc(db,'jornadas_operativas',result.config.eventId),result.createdEvent?{...result.createdEvent}:{id:result.config.eventId,tenantId}),
 ]);
 return result.config;
}
