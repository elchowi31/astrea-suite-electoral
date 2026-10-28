import {verifySavedRecord} from './saveVerification';
import {doc,getDoc,runTransaction} from 'firebase/firestore';
import {auth,db} from './firebase';
import type {GrassrootsVoter,UserProfile} from '../types';
import type {EventRegistration,OperationalEvent} from './operations';
import {mergeRegistration,registrationId,type RegistrationChannel} from './eventRegistration';

/** Retrying/concurrent check-ins merge channels, never increment an anonymous total. */
export async function saveRegistration(event:OperationalEvent,voter:GrassrootsVoter,channel:RegistrationChannel,value:boolean,notes:string,user:UserProfile) {
  if(auth.currentUser?.uid!==user.uid)throw new Error('Inicie sesión para registrar la planilla.');
  const id=registrationId(event,voter);
  // A revision rule may reject a stale commit before the SDK receives ABORTED.
  // Retry only when a fresh authorized read proves another writer advanced it.
  for(let attempt=0;attempt<4;attempt++) {
    let readRevision:number|undefined;
    try {const saved=await runTransaction(db,async tx=>{
    const ref=doc(db,'registros_jornada',id);
    const [a,b,c]=await Promise.all([tx.get(doc(db,'jornadas_operativas',event.id)),tx.get(doc(db,'votantes_rasos',voter.id)),tx.get(ref)]);
    if(!a.exists()||!b.exists())throw new Error('La jornada o persona ya no está disponible.');
    const currentVoter=b.data() as GrassrootsVoter;
    if(registrationId(a.data() as OperationalEvent,currentVoter)!==id)throw new Error('Cambió el documento de la persona. Actualice la planilla.');
    const previous=c.data() as EventRegistration|undefined;
    readRevision=previous?.revision||0;
    // An exact repeated action is idempotent, including its audit history.
    if(previous?.[channel]===value&&previous.notes===notes.trim())return previous;
    const next=mergeRegistration(a.data() as OperationalEvent,currentVoter,previous,channel,value,notes,user.uid);
    tx.set(ref,next);
    const auditId=crypto.randomUUID();tx.set(doc(db,'auditoria',auditId),{id:auditId,tenantId:event.tenantId,actorId:user.uid,entity:'registros_jornada',entityId:id,action:'update',metadata:{channel,previous:previous?.[channel]||false,current:value,revision:next.revision},createdAt:next.updatedAt});
    return next;
    });await verifySavedRecord(doc(db,'registros_jornada',id),{...saved});return;
    }catch(error){
      if((error as {code?:string}).code!=='permission-denied'||readRevision===undefined||attempt===3)throw error;
      const fresh=await getDoc(doc(db,'registros_jornada',id));
      if((fresh.data()?.revision||0)===readRevision)throw error;
    }
  }
}
