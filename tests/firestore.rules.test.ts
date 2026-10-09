import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { initializeTestEnvironment, assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, query, setDoc, updateDoc, where, writeBatch } from 'firebase/firestore';

const enabled = !!process.env.FIRESTORE_EMULATOR_HOST;
let env: RulesTestEnvironment;
before(async()=>{
  if (!enabled) return;
  const [host, port] = process.env.FIRESTORE_EMULATOR_HOST!.split(':');
  env=await initializeTestEnvironment({projectId:'demo-astrea',firestore:{host,port:Number(port),rules:readFileSync('firestore.rules','utf8')}});
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async ctx=>{
    const db=ctx.firestore();
    for (const tenantId of ['team-a','team-b']) await setDoc(doc(db,'organizaciones',tenantId),{tenantId,active:true});
    for (const [uid,role,tenantId,active,accessVersion] of [['admin','AdminTenant','team-a',true,2],['operator','Operador','team-a',true,2],['reader','Consulta','team-a',true,2],['other','AdminTenant','team-b',true,2],['inactive','Operador','team-a',false,2],['legacy','AdminTenant','team-a',true,1],['mayor','Alcalde','team-a',true,2]] as const)
      await setDoc(doc(db,'usuarios',uid),{uid,email:`${uid}@test.invalid`,displayName:uid,role,tenantId,active,accessVersion});
  });
});
after(async()=>{if (env) await env.cleanup();});
const check=(name:string,fn:()=>Promise<void>)=>test(name,{skip:!enabled},fn);
const dbFor=(uid:string)=>env.authenticatedContext(uid,{email:`${uid}@test.invalid`}).firestore();

check('Registration atomically creates an owned organization and usable administrator',async()=>{
  const db=dbFor('new');const batch=writeBatch(db);
  batch.set(doc(db,'organizaciones','org-new'),{tenantId:'org-new',ownerUid:'new',active:true,plan:'Gratuito'});
  batch.set(doc(db,'usuarios','new'),{uid:'new',email:'new@test.invalid',displayName:'New',tenantId:'org-new',role:'AdminTenant',active:true,accessVersion:2});
  await assertSucceeds(batch.commit());
  await assertSucceeds(getDocs(query(collection(db,'organizaciones'),where('tenantId','==','org-new'))));
  await assertSucceeds(setDoc(doc(db,'lideres','new-leader'),{tenantId:'org-new',fullName:'Leader'}));
});
check('Registration cannot join another tenant or grant global authority',async()=>{
  await assertFails(setDoc(doc(dbFor('intruder'),'usuarios','intruder'),{uid:'intruder',email:'intruder@test.invalid',displayName:'Intruder',tenantId:'team-a',role:'AdminTenant',active:true,accessVersion:2}));
  const db=dbFor('global-forgery');const batch=writeBatch(db);
  batch.set(doc(db,'organizaciones','org-global-forgery'),{tenantId:'org-global-forgery',ownerUid:'global-forgery',active:true,plan:'Gratuito'});
  batch.set(doc(db,'usuarios','global-forgery'),{uid:'global-forgery',email:'global-forgery@test.invalid',displayName:'Forgery',tenantId:'org-global-forgery',role:'AdminGlobal',active:true,accessVersion:2});
  await assertFails(batch.commit());
});
check('Tenant administrators create team profiles; members cannot escalate',async()=>{
  await assertSucceeds(setDoc(doc(dbFor('admin'),'usuarios','member'),{uid:'member',email:'member@test.invalid',displayName:'Member',tenantId:'team-a',role:'Operador',active:true,accessVersion:2}));
  await assertFails(updateDoc(doc(dbFor('operator'),'usuarios','operator'),{role:'AdminTenant'}));
  await assertFails(setDoc(doc(dbFor('mayor'),'usuarios','higher'),{uid:'higher',email:'higher@test.invalid',displayName:'Higher',tenantId:'team-a',role:'Gobernador',active:true,accessVersion:2}));
  await assertFails(setDoc(doc(dbFor('admin'),'usuarios','cross-tenant'),{uid:'cross-tenant',email:'cross@test.invalid',displayName:'Cross',tenantId:'team-b',role:'Operador',active:true,accessVersion:2}));
});
check('An operator saves every operational form together with its audit record',async()=>{
  const db=dbFor('operator');
  for (const name of ['candidatos','lideres','vehiculos','propuestas','gastos','aportes','archivos_drive','comites_coordinaciones','simulaciones','fuentes_estadisticas','equipo_campana']) {
    const batch=writeBatch(db);
    batch.set(doc(db,name,'operator-form'),{tenantId:'team-a',updatedBy:'operator'});
    batch.set(doc(db,'auditoria',`operator-${name}`),{tenantId:'team-a',actorId:'operator'});
    await assertSucceeds(batch.commit());
    await assertSucceeds(getDoc(doc(db,name,'operator-form')));
  }
  await assertSucceeds(setDoc(doc(dbFor('reader'),'propuestas','reader-form'),{tenantId:'team-a'}));
});
check('Territorial submissions require consent and remain retrievable by their creator',async()=>{
  const db=dbFor('operator');const ref=doc(db,'votantes_rasos','own-voter');
  await assertFails(setDoc(ref,{tenantId:'team-a',documentNumber:'123',consentGiven:false,createdBy:'operator'}));
  await assertSucceeds(setDoc(ref,{tenantId:'team-a',documentNumber:'123',consentGiven:true,createdBy:'operator'}));
  await assertSucceeds(getDocs(query(collection(db,'votantes_rasos'),where('tenantId','==','team-a'),where('createdBy','==','operator'))));
  await assertFails(getDoc(doc(dbFor('other'),'votantes_rasos','own-voter')));
});
check('Anonymous, inactive and legacy profiles cannot write, and tenant identity is immutable',async()=>{
  for (const db of [env.unauthenticatedContext().firestore(),dbFor('inactive'),dbFor('legacy')]) await assertFails(setDoc(doc(db,'lideres','forbidden'),{tenantId:'team-a'}));
  await assertFails(updateDoc(doc(dbFor('operator'),'lideres','operator-form'),{tenantId:'team-b'}));
  await assertFails(getDocs(collection(dbFor('operator'),'lideres')));
});
check('Verified owner retains access; a matching unverified email grants none',async()=>{
  const verified=env.authenticatedContext('owner',{email:'expcal@expcal.net',email_verified:true}).firestore();
  const unverified=env.authenticatedContext('fake-owner',{email:'expcal@expcal.net',email_verified:false}).firestore();
  await assertSucceeds(getDocs(collection(verified,'organizaciones')));
  await assertFails(getDocs(collection(unverified,'organizaciones')));
});
