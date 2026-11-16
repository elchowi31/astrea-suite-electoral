import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {initializeTestEnvironment} from '@firebase/rules-unit-testing';
import {createUserWithEmailAndPassword,signOut} from 'firebase/auth';
import {doc,setDoc,getDocFromServer,terminate} from 'firebase/firestore';
import {app,auth,db} from '../src/lib/firebase';
import {saveRewardPlan} from '../src/lib/rewardStore';
import {DEFAULT_REWARDS,calculateRewards,manualRewardHours,convertRewardPlan,type RewardPlan} from '../src/lib/rewards';
const enabled=process.env.ASTREA_FIREBASE_TEST_EMULATORS==='true';
test('Reward save, confirmation, fresh reads, history and conflict detection use actual rules',{skip:!enabled,timeout:180000},async()=>{
 assert.equal(app.options.projectId,'demo-astrea');const env=await initializeTestEnvironment({projectId:'demo-astrea',firestore:{host:'127.0.0.1',port:8088,rules:readFileSync('firestore.rules','utf8')}});
 const {user}=await createUserWithEmailAndPassword(auth,`rewards-${Date.now()}@test.invalid`,'Emulator-only-rewards-481!');const tenantId=`rewards-${user.uid}`;
 await env.withSecurityRulesDisabled(async context=>{await setDoc(doc(context.firestore(),'organizaciones',tenantId),{tenantId,active:true});await setDoc(doc(context.firestore(),'usuarios',user.uid),{uid:user.uid,email:user.email,tenantId,role:'AdminTenant',active:true,accessVersion:2});});
 try{
  const plan:RewardPlan={...structuredClone(DEFAULT_REWARDS),farmCount:1,id:`${tenantId}--rewards-test`,tenantId,ownerId:user.uid,name:'Prueba ficticia',revision:0,updatedAt:''};plan.farms[0].manualHours=[300,400,250,...Array(7).fill(null)];
  const saved=await saveRewardPlan(plan);assert.equal(saved.plan.revision,1);assert.equal(saved.approval,undefined);
  const confirmed=await saveRewardPlan(saved.plan,true);assert.equal(confirmed.plan.revision,2);assert.equal(confirmed.approval?.source,'manual_v2');assert.deepEqual(confirmed.approval?.hours,{});
  const fresh=(await getDocFromServer(doc(db,'planes_recompensas',plan.id))).data() as RewardPlan;assert.deepEqual(calculateRewards(fresh,manualRewardHours(fresh)).rows[0].teams.map(t=>t.earnedFruits),[6,9,5]);
  assert.equal((await getDocFromServer(doc(db,'planes_recompensas',plan.id,'versiones','1'))).data()?.plan.farms[0].manualHours[0],300);
  await assert.rejects(()=>saveRewardPlan(saved.plan),/otra sesión/);
  fresh.farms[0].manualHours[0]=500;const changed=await saveRewardPlan(fresh);assert.equal(changed.plan.revision,3);
  const history=(await getDocFromServer(doc(db,'planes_recompensas',plan.id,'versiones','2'))).data();assert.equal(history?.plan.farms[0].manualHours[0],300);assert.equal(history?.approval.revision,2);
  const legacy={...plan,id:`${tenantId}--rewards-legacy`,schemaVersion:1 as const,revision:1};await env.withSecurityRulesDisabled(async context=>setDoc(doc(context.firestore(),'planes_recompensas',legacy.id),legacy));
  const converted=await saveRewardPlan(convertRewardPlan(legacy));assert.equal(converted.plan.schemaVersion,2);assert.equal((await getDocFromServer(doc(db,'planes_recompensas',legacy.id,'versiones','1'))).data()?.plan.schemaVersion,1);
 }finally{await signOut(auth);await terminate(db);await env.cleanup();}
});
