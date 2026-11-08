import {verifySavedRecord} from './saveVerification';
import {doc,getDoc,runTransaction} from 'firebase/firestore';
import {auth,db} from './firebase';
import type {GrassrootsVoter,UserProfile} from '../types';
import type {EventRegistration,OperationalEvent} from './operations';
import {mergeRegistration,registrationId,type RegistrationChannel} from './eventRegistration';
import {durableMutation,registerOfflineMutation} from './offlineMutations';

/** Retrying/concurrent check-ins merge channels, never increment an anonymous total. */
export async function saveRegistration(event:OperationalEvent,voter:GrassrootsVoter,channel:RegistrationChannel,value:boolean,notes:string,user:UserProfile) {
  if(auth.currentUser?.uid!==user.uid)throw new Error('Inicie sesión para registrar la planilla.');
  mergeRegistration(event,voter,undefined,channel,value,notes,user.uid);
  if(!value&&!notes.trim())throw new Error('Explique la corrección para retirar una marca.');
  await durableMutation('attendance-registration',{userId:user.uid,tenantId:event.tenantId},{event,voter,channel,value,notes,user});
}
async function performRegistration(event:OperationalEvent,voter:GrassrootsVoter,channel:RegistrationChannel,value:boolean,notes:string,user:UserProfile,commandId:string) {
  if(auth.currentUser?.uid!==user.uid)throw new Error('Inicie sesión para registrar la planilla.');
  const id=registrationId(event,voter);
  const receipt=doc(db,'usuarios',user.uid,'mutaciones_offline',commandId);
  // A revision rule may reject a stale commit before the SDK receives ABORTED.
  // Retry only when a fresh authorized read proves another writer advanced it.
  for(let attempt=0;attempt<4;attempt++) {
    let readRevision:number|undefined;
    try {const saved=await runTransaction(db,async tx=>{
    if((await tx.get(receipt)).exists())return null;
    const ref=doc(db,'registros_jornada',id);
    const [a,b,c]=await Promise.all([tx.get(doc(db,'jornadas_operativas',event.id)),tx.get(doc(db,'votantes_rasos',voter.id)),tx.get(ref)]);
    if(!a.exists()||!b.exists())throw new Error('La jornada o persona ya no está disponible.');
    const currentVoter=b.data() as GrassrootsVoter;
    if(registrationId(a.data() as OperationalEvent,currentVoter)!==id)throw new Error('Cambió el documento de la persona. Actualice la planilla.');
    const previous=c.data() as EventRegistration|undefined;
    readRevision=previous?.revision||0;
    // An exact repeated action is idempotent, including its audit history.
    if(auth.currentUser?.uid!==user.uid)throw new Error('La sesión cambió; se conserva la planilla para su cuenta.');
    const acknowledged={id:commandId,tenantId:event.tenantId,actorId:user.uid,kind:'attendance-registration',createdAt:new Date().toISOString()};
    if(previous?.[channel]===value&&previous.notes===notes.trim()){tx.set(receipt,acknowledged);return null;}
    const next=mergeRegistration(a.data() as OperationalEvent,currentVoter,previous,channel,value,notes,user.uid);
    tx.set(ref,next);
    const auditId=crypto.randomUUID();tx.set(doc(db,'auditoria',auditId),{id:auditId,tenantId:event.tenantId,actorId:user.uid,entity:'registros_jornada',entityId:id,action:'update',metadata:{channel,previous:previous?.[channel]||false,current:value,revision:next.revision},createdAt:next.updatedAt});
    tx.set(receipt,acknowledged);
    return next;
    });if(saved)await verifySavedRecord(doc(db,'registros_jornada',id),{...saved});return;
    }catch(error){
      if((error as {code?:string}).code!=='permission-denied'||readRevision===undefined||attempt===3)throw error;
      const fresh=await getDoc(doc(db,'registros_jornada',id));
      if((fresh.data()?.revision||0)===readRevision)throw error;
    }
  }
}
registerOfflineMutation('attendance-registration',async(payload,context)=>{
  if(payload.user.uid!==context.scope.userId||payload.event.tenantId!==context.scope.tenantId||auth.currentUser?.uid!==context.scope.userId)throw new Error('La sesión cambió; la planilla se conserva para su cuenta.');
  await performRegistration(payload.event,payload.voter,payload.channel,payload.value,payload.notes,payload.user,context.id);
});
