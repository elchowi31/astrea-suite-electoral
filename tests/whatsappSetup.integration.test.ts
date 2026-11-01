import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {initializeTestEnvironment} from '@firebase/rules-unit-testing';
import {doc,setDoc,getDoc,updateDoc,collection,getDocs,query,where} from 'firebase/firestore';
import {defaultWhatsappConfig,saveWhatsappConfig,loadWhatsappConfig} from '../src/lib/whatsappSetup';
import type {UserProfile} from '../src/types';
const owner:UserProfile={uid:'wa-setup-owner',email:'expcal@expcal.net',displayName:'Dr. Experiencia Calificada',tenantId:'wa-setup-tenant',role:'AdminGlobal',createdAt:'2026-01-01',department:'Cesar'};
test('reception defaults to the platform owner instead of an unrelated leader',()=>{
 assert.equal(defaultWhatsappConfig(owner).responsibleName,'Wilson José Arias');
 assert.equal(defaultWhatsappConfig({...owner,email:'other@example.com',displayName:'Otro administrador'}).responsibleName,'Otro administrador');
 assert.equal(defaultWhatsappConfig(owner).leaderId,'');
});
test('reception setup persists real configuration and creates valid references from an empty event list',{skip:process.env.ASTREA_AGENT_EMULATOR!=='true',timeout:120000},async t=>{
 assert.equal(process.env.GCLOUD_PROJECT,'demo-astrea');
 const env=await initializeTestEnvironment({projectId:'demo-astrea',firestore:{host:'127.0.0.1',port:8088,rules:readFileSync('firestore.rules','utf8')}});
 const db=env.authenticatedContext(owner.uid,{admin:true,email:owner.email,email_verified:true}).firestore() as any;
 const input={...defaultWhatsappConfig(owner),phone:'+57 301 723 8257'};
 const wendy={id:'wa-setup-wendy',tenantId:owner.tenantId,fullName:'Wendy Fragozo',voteTarget:200,phone:'3000000000'};
 try{
  await env.withSecurityRulesDisabled(async ctx=>{
   await setDoc(doc(ctx.firestore(),'organizaciones',owner.tenantId),{tenantId:owner.tenantId,active:true});
   await setDoc(doc(ctx.firestore(),'lideres',wendy.id),wendy);
  });
  let saved=await saveWhatsappConfig(db,owner,owner.tenantId,input);
  await t.test('first save creates an operational owner and event, never modifies Wendy',async()=>{
   assert.equal(saved.phone,'573017238257');assert.ok(saved.eventId);assert.notEqual(saved.leaderId,wendy.id);
   const leader=(await getDoc(doc(db,'lideres',saved.leaderId))).data()!;
   assert.equal(leader.fullName,'Wilson José Arias');assert.equal(leader.operatorUid,owner.uid);assert.equal(leader.voteTarget,0);
   assert.deepEqual((await getDoc(doc(db,'lideres',wendy.id))).data(),wendy);
   const event=(await getDoc(doc(db,'jornadas_operativas',saved.eventId))).data()!;
   assert.equal(event.name,'Recepción de solicitudes WhatsApp');assert.equal(event.status,'Planificado');assert.doesNotMatch(event.notes,/prueba/i);
   assert.deepEqual(await loadWhatsappConfig(db,owner,owner.tenantId),saved);
  });
  await t.test('repeat save reuses the same references and persists edited fields',async()=>{
   const next=await saveWhatsappConfig(db,owner,owner.tenantId,{...input,phone:'573017238258',responsibleName:'Wilson José Arias'});
   assert.equal(next.leaderId,saved.leaderId);assert.equal(next.eventId,saved.eventId);
   assert.deepEqual(await loadWhatsappConfig(db,owner,owner.tenantId),next);
   const events=await getDocs(query(collection(db,'jornadas_operativas'),where('tenantId','==',owner.tenantId)));assert.equal(events.size,1);
   saved=next;
  });
  await t.test('existing active events are accepted and foreign events leave the configuration intact',async()=>{
   await setDoc(doc(db,'jornadas_operativas','wa-existing-event'),{id:'wa-existing-event',tenantId:owner.tenantId,status:'En curso',name:'Jornada operativa',municipality:'Astrea'});
   const selected=await saveWhatsappConfig(db,owner,owner.tenantId,{...saved,eventId:'wa-existing-event'});
   assert.equal(selected.eventId,'wa-existing-event');
   await setDoc(doc(db,'jornadas_operativas','wa-foreign-event'),{id:'wa-foreign-event',tenantId:'foreign',status:'Planificado'});
   await assert.rejects(saveWhatsappConfig(db,owner,owner.tenantId,{...saved,eventId:'wa-foreign-event'}),/ya no está activa/);
   assert.deepEqual(await loadWhatsappConfig(db,owner,owner.tenantId),selected);
  });
  await t.test('closed automatic events remain closed and get a replacement when requested',async()=>{
   const old=saved.eventId;
   await updateDoc(doc(db,'jornadas_operativas',old),{status:'Finalizado'});
   await assert.rejects(saveWhatsappConfig(db,owner,owner.tenantId,saved),/ya no está activa/);
   saved=await saveWhatsappConfig(db,owner,owner.tenantId,{...saved,eventId:''});
   assert.notEqual(saved.eventId,old);assert.equal((await getDoc(doc(db,'jornadas_operativas',old))).data()!.status,'Finalizado');
   await updateDoc(doc(db,'jornadas_operativas',saved.eventId),{status:'Cancelado'});
   assert.equal((await loadWhatsappConfig(db,owner,owner.tenantId)).eventId,'');
  });
  await t.test('invalid input, inactive organizations and nonadmin claims cannot write',async()=>{
   await assert.rejects(saveWhatsappConfig(db,owner,owner.tenantId,{...input,phone:'123'}),/número/);
   await assert.rejects(saveWhatsappConfig(db,{...owner,role:'Operador'},owner.tenantId,input),/administrador/);
   await assert.rejects(saveWhatsappConfig(env.authenticatedContext('ordinary',{email:'ordinary@example.com'}).firestore() as any,{...owner,uid:'ordinary',email:'ordinary@example.com'},owner.tenantId,input));
   await updateDoc(doc(db,'organizaciones',owner.tenantId),{active:false});
   await assert.rejects(saveWhatsappConfig(db,owner,owner.tenantId,input),/no está activa/);
  });
 }finally{await env.cleanup();}
});
