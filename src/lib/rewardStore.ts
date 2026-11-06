import {collection,doc,runTransaction} from 'firebase/firestore';
import {auth,db} from './firebase';
import {calculateRewards,type RewardPlan,type RewardApproval} from './rewards';
export async function saveRewardPlan(plan:RewardPlan,approvedHours?:Record<string,number[]>):Promise<{plan:RewardPlan;approval?:RewardApproval}>{
  const actor=auth.currentUser;if(!actor)throw new Error('Inicie sesión antes de guardar.');
  calculateRewards(plan,approvedHours);if(!plan.name.trim())throw new Error('Escriba un nombre para el plan.');
  const ref=doc(db,'planes_recompensas',plan.id),now=new Date().toISOString();
  return runTransaction(db,async transaction=>{
    const snapshot=await transaction.get(ref);const previous=snapshot.data() as RewardPlan|undefined;
    if((previous?.revision??0)!==plan.revision)throw new Error('El plan cambió en otra sesión. Vuelva a abrirlo antes de guardar.');
    const next={...plan,revision:plan.revision+1,updatedAt:now};transaction.set(ref,next);
    let approval:RewardApproval|undefined;
    if(approvedHours){approval={id:plan.id,tenantId:plan.tenantId,revision:next.revision,hours:approvedHours,approvedBy:actor.uid,updatedAt:now};transaction.set(doc(db,'validaciones_recompensas',plan.id),approval);}
    const audit=doc(collection(db,'auditoria'));transaction.set(audit,{id:audit.id,tenantId:plan.tenantId,actorId:actor.uid,entity:'planes_recompensas',entityId:plan.id,action:approvedHours?'approve':'update',createdAt:now});
    return {plan:next,approval};
  });
}
