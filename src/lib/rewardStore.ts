import {collection,doc,runTransaction} from 'firebase/firestore';
import {auth,db} from './firebase';
import {calculateRewards,manualRewardHours,type RewardPlan,type RewardApproval} from './rewards';
import {requireOnlineMutation} from './offlineMutations';
/** The approval certifies this revision of the plan; hours have one storage location. */
export async function saveRewardPlan(plan:RewardPlan,confirm=false):Promise<{plan:RewardPlan;approval?:RewardApproval}>{
  requireOnlineMutation('Conéctese para guardar o confirmar el plan. Sus cambios permanecen en pantalla.');
  const actor=auth.currentUser;if(!actor)throw new Error('Inicie sesión antes de guardar.');
  if(plan.schemaVersion!==2)throw new Error('Revise la conversión al modo manual antes de guardar.');
  calculateRewards(plan);if(!plan.name.trim())throw new Error('Escriba un nombre para el plan.');
  if(confirm)manualRewardHours(plan);
  const ref=doc(db,'planes_recompensas',plan.id),approvalRef=doc(db,'validaciones_recompensas',plan.id),now=new Date().toISOString();
  return runTransaction(db,async transaction=>{
    const snapshot=await transaction.get(ref),oldApproval=await transaction.get(approvalRef),previous=snapshot.data() as RewardPlan|undefined;
    if((previous?.revision??0)!==plan.revision)throw new Error('El plan cambió en otra sesión. Vuelva a abrirlo antes de guardar.');
    if(previous&&(previous.tenantId!==plan.tenantId||previous.ownerId!==plan.ownerId))throw new Error('No se pueden cambiar la organización ni el propietario del plan.');
    if(auth.currentUser?.uid!==actor.uid)throw new Error('La sesión cambió antes de guardar.');
    if(previous){transaction.set(doc(ref,'versiones',String(previous.revision)),{tenantId:previous.tenantId,actorId:actor.uid,revision:previous.revision,plan:previous,approval:oldApproval.data()||null,createdAt:now});}
    const next={...plan,revision:plan.revision+1,updatedAt:now};transaction.set(ref,next);
    let approval:RewardApproval|undefined;
    if(confirm){approval={id:plan.id,tenantId:plan.tenantId,revision:next.revision,source:'manual_v2',hours:{},approvedBy:actor.uid,updatedAt:now};transaction.set(approvalRef,approval);}
    const audit=doc(collection(db,'auditoria'));transaction.set(audit,{id:audit.id,tenantId:plan.tenantId,actorId:actor.uid,entity:'planes_recompensas',entityId:plan.id,action:confirm?'approve':'update',createdAt:now});
    return {plan:next,approval};
  });
}
