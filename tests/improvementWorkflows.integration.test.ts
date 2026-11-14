import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {initializeTestEnvironment} from '@firebase/rules-unit-testing';
import {createUserWithEmailAndPassword,signOut} from 'firebase/auth';
import {doc,setDoc,getDocFromServer,deleteDoc,terminate} from 'firebase/firestore';
import {app,auth,db,persistEntity,persistFirestoreBatch} from '../src/lib/firebase';
import {readOperationalBackup,restoreOperationalBackup} from '../src/lib/operationalRecoveryStore';
import {saveWitnessAssignment,saveElectoralEvidence,reviewElectoralEvidence} from '../src/lib/electoralEvidenceStore';
import {witnessAssignmentId,type ElectoralEvidence} from '../src/lib/electoralEvidence';
import {consumeSharedQuota} from '../src/server/sharedQuota';
const enabled=process.env.ASTREA_FIREBASE_TEST_EMULATORS==='true';
test('administrative recovery, evidence and quota persist through actual Firebase rules',{skip:!enabled,timeout:180000},async()=>{
 assert.equal(app.options.projectId,'demo-astrea');assert.equal(process.env.FIRESTORE_EMULATOR_HOST,'127.0.0.1:8088');
 const env=await initializeTestEnvironment({projectId:'demo-astrea',firestore:{host:'127.0.0.1',port:8088,rules:readFileSync('firestore.rules','utf8')}});
 const {user}=await createUserWithEmailAndPassword(auth,`workflow-${Date.now()}@test.invalid`,'Emulator-only-workflow-481!');
 const tenantId=`workflow-${user.uid}`,now=new Date().toISOString();
 await env.withSecurityRulesDisabled(async context=>{const setup=context.firestore();await setDoc(doc(setup,'organizaciones',tenantId),{tenantId,active:true});await setDoc(doc(setup,'usuarios',user.uid),{uid:user.uid,email:user.email,tenantId,role:'AdminTenant',active:true,accessVersion:2,displayName:'Cuenta ficticia'});});
 try{
  const leaderId=`${tenantId}--leader`;
  await persistEntity('lideres',leaderId,{id:leaderId,tenantId,fullName:'Líder ficticio de restauración'});
  const backup=await readOperationalBackup(tenantId);assert.equal(backup.records.filter(r=>r.collection==='lideres').length,1);
  await deleteDoc(doc(db,'lideres',leaderId));
  const restored=await restoreOperationalBackup(backup,tenantId);assert.equal(restored.restored,1);
  assert.equal((await getDocFromServer(doc(db,'lideres',leaderId))).data()?.fullName,'Líder ficticio de restauración');
  const again=await restoreOperationalBackup(backup,tenantId);assert.equal(again.restored,0);assert.equal(again.existing,1);
  await assert.rejects(()=>persistFirestoreBatch(tenantId,[{collection:'lideres',id:leaderId,type:'set',createOnly:true,data:{id:leaderId,tenantId,fullName:'No debe reemplazar'}}]));
  assert.equal((await getDocFromServer(doc(db,'lideres',leaderId))).data()?.fullName,'Líder ficticio de restauración');
  const assignmentId=await witnessAssignmentId(tenantId,'Astrea','Puesto ficticio',1,'Concejo');
  await saveWitnessAssignment({id:assignmentId,tenantId,municipality:'Astrea',pollingStation:'Puesto ficticio',tableNumber:1,contest:'Concejo',assignedUid:user.uid,assignedName:'Cuenta ficticia',createdBy:user.uid,createdAt:now,updatedAt:now,revision:1});
  const evidence:ElectoralEvidence={id:assignmentId,tenantId,assignmentId,assignedUid:user.uid,contest:'Concejo',submittedBy:user.uid,createdAt:now,updatedAt:now,revision:1,status:'En revisión',results:[{label:'Lista ficticia',votes:5}],photo:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ/kAAAAASUVORK5CYII=',notes:'Evidencia sintética de prueba',reviewedBy:'',reviewedAt:''};
  await saveElectoralEvidence(evidence);await reviewElectoralEvidence(evidence);
  const saved=(await getDocFromServer(doc(db,'actas_electorales',assignmentId))).data();assert.equal(saved?.status,'Revisada');assert.equal(saved?.resultsText,'Lista ficticia;5');
  const token=await user.getIdToken();
  const request:typeof fetch=(input,init)=>fetch(String(input).replace('https://firestore.googleapis.com','http://127.0.0.1:8088'),init);
  const options={projectId:'demo-astrea',databaseId:'(default)',uid:user.uid,tenantId,token,maximum:2,request};
  const quota=await Promise.allSettled([consumeSharedQuota(options),consumeSharedQuota(options),consumeSharedQuota(options)]);
  assert.equal(quota.filter(r=>r.status==='fulfilled').length,2);assert.equal((quota.find(r=>r.status==='rejected') as PromiseRejectedResult).reason.status,429);
 }finally{await signOut(auth);await terminate(db);await env.cleanup();}
});
