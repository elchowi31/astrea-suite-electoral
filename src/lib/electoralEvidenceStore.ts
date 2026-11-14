import {collection,doc,getDoc,onSnapshot,query,where} from 'firebase/firestore';
import {auth,db,persistFirestoreBatch} from './firebase';
import type {UserProfile} from '../types';
import {storedElectoralEvidence,readElectoralEvidence,validateActaEvidence,type WitnessAssignment,type ElectoralEvidence} from './electoralEvidence';
export const canCoordinateEvidence=(role:string)=>['AdminGlobal','AdminTenant','Gobernador','Diputado','Alcalde','Concejal','JefePolitico'].includes(role);
export function subscribeEvidence<T>(name:string,tenantId:string,user:UserProfile,onData:(rows:T[])=>void,onError:(error:Error)=>void){
 const constraints=[where('tenantId','==',tenantId),...(canCoordinateEvidence(user.role)?[]:[where('assignedUid','==',user.uid)])];
 return onSnapshot(query(collection(db,name),...constraints),snapshot=>{try{onData(snapshot.docs.map(d=>(name==='actas_electorales'?readElectoralEvidence(d.data()):d.data()) as T));}catch{onError(new Error('Hay evidencia con formato inválido. Se detuvo la actualización para su revisión.'));}},onError);
}
async function writeEvidence(name:string,id:string,tenantId:string,data:object,createOnly=false){
 const actorId=auth.currentUser?.uid;if(!actorId)throw new Error('Inicie sesión para guardar la evidencia.');
 const auditId=crypto.randomUUID();await persistFirestoreBatch(tenantId,[{collection:name,id,type:'set',createOnly,data:{...data}},{collection:'auditoria',id:auditId,type:'set',data:{id:auditId,tenantId,actorId,entity:name,entityId:id,action:createOnly?'create':'update',createdAt:new Date().toISOString()}}]);
}
export async function saveWitnessAssignment(assignment:WitnessAssignment){
 await writeEvidence('asignaciones_testigos',assignment.id,assignment.tenantId,assignment,true);
}
export async function saveElectoralEvidence(value:ElectoralEvidence){
 validateActaEvidence(value);const actorId=auth.currentUser?.uid;
 if(value.submittedBy!==actorId)throw new Error('La cuenta no corresponde a quien captura el acta.');
 const assignment=(await getDoc(doc(db,'asignaciones_testigos',value.assignmentId))).data() as WitnessAssignment|undefined;
 if(!assignment||assignment.tenantId!==value.tenantId||assignment.contest!==value.contest||assignment.assignedUid!==value.assignedUid)throw new Error('La asignación cambió. Vuelva a cargarla.');
 await writeEvidence('actas_electorales',value.id,value.tenantId,storedElectoralEvidence(value),value.revision===1);
}
export async function reviewElectoralEvidence(value:ElectoralEvidence){
 validateActaEvidence(value);const actorId=auth.currentUser?.uid;if(!actorId)throw new Error('Inicie sesión para revisar.');
 await writeEvidence('actas_electorales',value.id,value.tenantId,storedElectoralEvidence({...value,status:'Revisada',reviewedBy:actorId,reviewedAt:new Date().toISOString(),updatedAt:new Date().toISOString(),revision:value.revision+1}));
}
export async function saveElectoralIncident(assignment:WitnessAssignment,notes:string){
 const actorId=auth.currentUser?.uid;if(!actorId||notes.trim().length<8||notes.length>1500)throw new Error('Describa la incidencia entre 8 y 1.500 caracteres.');
 const id=`${assignment.tenantId}--inc-${crypto.randomUUID()}`;
 await writeEvidence('incidencias_electorales',id,assignment.tenantId,{id,tenantId:assignment.tenantId,assignmentId:assignment.id,assignedUid:assignment.assignedUid,notes:notes.trim(),createdBy:actorId,createdAt:new Date().toISOString()},true);
}
