import type {EventRegistration,OperationalEvent} from './operations';
import type {GrassrootsVoter} from '../types';

export type RegistrationChannel = 'boarded'|'command';
export function registrationId(event:OperationalEvent,voter:GrassrootsVoter) {
  return `${event.tenantId}--${event.id}--${voter.documentNumber}`;
}
export function mergeRegistration(event:OperationalEvent,voter:GrassrootsVoter,previous:EventRegistration|undefined,channel:RegistrationChannel,value:boolean,notes:string,uid:string,synthetic=false):EventRegistration {
  if(event.tenantId!==voter.tenantId||event.status==='Cancelado')throw new Error('Seleccione una persona y jornada activa de la misma organización.');
  if(!voter.leaderId&&!voter.candidateId)throw new Error('Asigne un líder o aspirante en la ficha de la persona.');
  if(!synthetic&&(!voter.consentGiven||! /^[1-9]\d{4,14}$/.test(voter.documentNumber)))throw new Error('Revise la autorización y el documento de la persona: de 5 a 15 dígitos, sin puntos ni ceros iniciales.');
  if(previous&&(previous.tenantId!==event.tenantId||previous.eventId!==event.id||previous.documentNumber!==voter.documentNumber||previous.leaderId!==voter.leaderId||previous.candidateId!==voter.candidateId))throw new Error('Esta persona ya está registrada con otra asignación. Revise su planilla original antes de cambiarla.');
  if(previous?.[channel]&&!value&&!notes.trim())throw new Error('Explique la corrección para retirar una marca.');
  const now=new Date().toISOString();
  return {...(previous||{id:registrationId(event,voter),tenantId:event.tenantId,eventId:event.id,voterId:voter.id,documentNumber:voter.documentNumber,leaderId:voter.leaderId,candidateId:voter.candidateId,boarded:false,command:false,createdBy:uid,createdAt:now}),[channel]:value,notes:notes.trim().slice(0,1500),updatedBy:uid,updatedAt:now,revision:(previous?.revision||0)+1};
}
