import {collection,doc,getDocs,getDocFromServer,query,where,limit,orderBy,documentId,startAfter} from 'firebase/firestore';
import {auth,db,persistFirestoreBatch,type FirestoreBatchWrite} from './firebase';
import {requireOnlineMutation} from './offlineMutations';
import {BACKUP_COLLECTIONS,createOperationalBackup,validateOperationalBackup,planOperationalRestore,type BackupRecord,type OperationalBackup} from './operationalBackup';
export async function readOperationalBackup(tenantId:string,onProgress?:(message:string)=>void){
 requireOnlineMutation('Conéctese para obtener un respaldo completo del alcance operativo.');
 if(!auth.currentUser)throw new Error('Inicie sesión para respaldar.');
 const owner=auth.currentUser.uid,records:BackupRecord[]=[];let bytes=0;
 for(const name of BACKUP_COLLECTIONS){
  let cursor:any=null;
  while(true){
   if(auth.currentUser?.uid!==owner)throw new Error('La cuenta cambió; se canceló el respaldo.');
   const base=[where('tenantId','==',tenantId),orderBy(documentId()),limit(300)];
   const page=await getDocs(query(collection(db,name),...base,...(cursor?[startAfter(cursor)]:[])));
   for(const item of page.docs){const row={collection:name,id:item.id,data:item.data()};bytes+=new TextEncoder().encode(JSON.stringify(row)).byteLength;if(bytes>20*1024*1024)throw new Error('El respaldo supera 20 MB; utilice una exportación administrativa de Firestore.');records.push(row);}
   if(records.length>10000)throw new Error('El alcance supera 10.000 registros. Utilice una exportación administrativa de Firestore.');
   onProgress?.(`${name}: ${records.filter(r=>r.collection===name).length} registros leídos`);
   if(page.size<300)break;cursor=page.docs.at(-1);
  }
 }
 return createOperationalBackup(tenantId,records);
}
export async function restoreOperationalBackup(value:OperationalBackup,tenantId:string,onProgress?:(message:string)=>void){
 requireOnlineMutation('La restauración necesita conexión y revisión de registros actuales.');
 const backup=validateOperationalBackup(value,tenantId),owner=auth.currentUser?.uid;
 if(!owner)throw new Error('Inicie sesión antes de restaurar.');
 const current=await readOperationalBackup(tenantId,onProgress),plan=planOperationalRestore(backup,current.records);
 let restored=0;
 for(let index=0;index<plan.missing.length;index+=8){
  if(auth.currentUser?.uid!==owner)throw new Error('La cuenta cambió; se detuvo la restauración.');
  const group=plan.missing.slice(index,index+8),writes:FirestoreBatchWrite[]=[];
  for(const row of group){
   if((await getDocFromServer(doc(db,row.collection,row.id))).exists())throw new Error('Un registro fue creado durante la revisión. Vuelva a generar la vista previa.');
   writes.push({collection:row.collection,id:row.id,type:'set',createOnly:true,data:{...row.data,createdBy:owner,updatedBy:owner,updatedAt:new Date().toISOString(),restoredFrom:backup.createdAt}});
  }
  const id=crypto.randomUUID();writes.push({collection:'auditoria',id,type:'set',data:{id,tenantId,actorId:owner,action:'restore',entity:'respaldo_operativo',entityId:backup.createdAt,createdAt:new Date().toISOString(),count:group.length}});
  await persistFirestoreBatch(tenantId,writes);restored+=group.length;onProgress?.(`${restored} registros restaurados; los existentes se conservan.`);
 }
 return {restored,existing:plan.existing.length,blocked:plan.blocked.length};
}
