import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {parseSorteappRewardsEvent,processSorteappRewardsEvent,readSorteappRewardsEnvironment,validSorteappSignature,type SorteappRewardsEvent} from '../src/server/sorteappRewards.ts';
import {decodeFields,encodeFields} from '../src/server/requestAgent.ts';

const now=Date.now();
const federationEnvironment={GOOGLE_CLOUD_PROJECT_NUMBER:'123456789012',GOOGLE_WORKLOAD_IDENTITY_POOL_ID:'astrea-vercel',GOOGLE_WORKLOAD_IDENTITY_PROVIDER_ID:'vercel-production',GOOGLE_SERVICE_ACCOUNT_EMAIL:'astrea-firestore@demo.iam.gserviceaccount.com'};
const rewardsEnvironment=(extra:Record<string,string|undefined>={})=>readSorteappRewardsEnvironment({SORTEAPP_REWARDS_ENABLED:'true',SORTEAPP_WEBHOOK_SECRET:'sorteapp-webhook-secret-with-at-least-32-characters',SORTEAPP_REWARDS_TENANT_IDS:'tenant-astrea-2026',...federationEnvironment,...extra});
const created=()=>({schemaVersion:1,eventId:'event-001',eventType:'draw.entry.created',occurredAt:new Date(now).toISOString(),draw:{id:'draw-001',tenantId:'tenant-astrea-2026',title:'Sorteo de bienestar',prize:'Licuadora',kind:'employee_wellbeing_free',paid:false,entryPrice:0,currency:'COP',startsAt:new Date(now-86400000).toISOString(),endsAt:new Date(now+86400000).toISOString()},entry:{id:'entry-001',name:'Participante de prueba',email:'persona@example.com',phone:'+57 300 123 4567',registeredAt:new Date(now).toISOString()},consent:{accepted:true,purpose:'employee_reward_draw',policyVersion:'2026-01',acceptedAt:new Date(now-60000).toISOString()}});

test('Sorteapp signature authenticates the exact request bytes',()=>{
 const raw=Buffer.from('{"eventId":"event-001"}'),secret='sorteapp-webhook-secret-with-at-least-32-characters';
 const signature='sha256='+createHmac('sha256',secret).update(raw).digest('hex');
 assert.equal(validSorteappSignature(raw,signature,secret),true);
 assert.equal(validSorteappSignature(Buffer.from('{"eventId":"other"}'),signature,secret),false);
 assert.equal(validSorteappSignature(raw,'sha256=bad',secret),false);
});

test('only a free internal draw entry with prior consent and minimal contact data is accepted',()=>{
 const event=parseSorteappRewardsEvent(created());
 assert.equal(event.eventType,'draw.entry.created');
 assert.equal(event.draw.paid,false);
 assert.equal(event.consent.purpose,'employee_reward_draw');
 if(event.eventType==='draw.entry.created')assert.equal(event.entry.phone,'573001234567');
});

test('paid raffles, unrelated consent, political fields, and unapproved payload fields are rejected',()=>{
 const paid=created();paid.draw.paid=true;
 assert.throws(()=>parseSorteappRewardsEvent(paid),/gratuitos/);
 const charged=created();charged.draw.entryPrice=1000;
 assert.throws(()=>parseSorteappRewardsEvent(charged),/gratuitos/);
 const marketing=created();marketing.consent.purpose='marketing';
 assert.throws(()=>parseSorteappRewardsEvent(marketing),/consentimiento/);
 const political:any=created();political.entry.voterId='123';
 assert.throws(()=>parseSorteappRewardsEvent(political),/campos no permitidos/);
});

test('a registration without evidenced consent or a usable contact is rejected',()=>{
 const noConsent=created();noConsent.consent.accepted=false;
 assert.throws(()=>parseSorteappRewardsEvent(noConsent),/consentimiento/);
 const futureConsent=created();futureConsent.consent.acceptedAt=new Date(now+60000).toISOString();
 assert.throws(()=>parseSorteappRewardsEvent(futureConsent),/antes de la inscripción/);
 const noContact=created();delete noContact.entry.email;delete noContact.entry.phone;
 assert.throws(()=>parseSorteappRewardsEvent(noContact),/medio de contacto/);
});

test('participant withdrawal accepts identifiers only and cannot include personal data',()=>{
 const event={schemaVersion:1,eventId:'event-delete-1',eventType:'draw.entry.deleted',occurredAt:new Date(now).toISOString(),draw:{id:'draw-001',tenantId:'tenant-astrea-2026'},entry:{id:'entry-001'}};
 assert.equal(parseSorteappRewardsEvent(event).eventType,'draw.entry.deleted');
 const invalid={...event,entry:{id:'entry-001',email:'persona@example.com'}};
 assert.throws(()=>parseSorteappRewardsEvent(invalid),/campos no permitidos/);
});

test('integration remains off until server-side secrets are configured',()=>{
 assert.throws(()=>readSorteappRewardsEnvironment({}),/no está activada/);
 assert.throws(()=>readSorteappRewardsEnvironment({SORTEAPP_REWARDS_ENABLED:'true'}),/configuración segura/);
 const env=rewardsEnvironment();
 assert.equal(env.enabled,true);
 assert.equal(env.federation.poolId,'astrea-vercel');
});

function firestoreMock(){
 const docs=new Map<string,{fields:Record<string,any>;updateTime:string}>(),root='projects/demo/databases/(default)/documents/';let revision=0,commits=0;
 docs.set('organizaciones/tenant-astrea-2026',{fields:encodeFields({tenantId:'tenant-astrea-2026',active:true}),updateTime:'seed'});
 const fetcher=async(input:RequestInfo|URL,init:RequestInit={})=>{
  const path=new URL(String(input)).pathname;
  if(path.endsWith('/documents:commit')){
   commits++;const body=JSON.parse(String(init.body||'{}')),writes=body.writes||[];
   for(const write of writes){const docPath=String(write.update?.name||write.delete||'').slice(root.length),current=docs.get(docPath),precondition=write.currentDocument;if(precondition?.exists===false&&current)return new Response(JSON.stringify({error:{status:'ALREADY_EXISTS'}}),{status:409});if(precondition?.updateTime&&current?.updateTime!==precondition.updateTime)return new Response(JSON.stringify({error:{status:'FAILED_PRECONDITION'}}),{status:409});}
   const writeResults=[];for(const write of writes){const fullPath=String(write.update?.name||write.delete||''),docPath=fullPath.slice(root.length);if(write.delete)docs.delete(docPath);else docs.set(docPath,{fields:write.update.fields,updateTime:`rev-${++revision}`});writeResults.push({updateTime:`rev-${revision}`});}
   return new Response(JSON.stringify({writeResults}),{status:200,headers:{'Content-Type':'application/json'}});
  }
  const docPath=decodeURIComponent(path.split('/documents/')[1]||''),document=docs.get(docPath);
  return document?new Response(JSON.stringify({name:root+docPath,...document}),{status:200,headers:{'Content-Type':'application/json'}}):new Response('',{status:404});
 };
 return {docs,fetcher:fetcher as typeof fetch,get commits(){return commits;}};
}

test('server-to-server persistence is idempotent and withdrawal removes participant details atomically',async()=>{
 const mock=firestoreMock(),environment=rewardsEnvironment(),event=parseSorteappRewardsEvent(created());
 const process=(current:SorteappRewardsEvent)=>processSorteappRewardsEvent({projectId:'demo',databaseId:'(default)',environment,event:current,fetcher:mock.fetcher,bearerToken:'test-only-token'});
 const first=await process(event);assert.deepEqual(first,{accepted:true,duplicate:false});const afterFirst=mock.commits;
 assert.deepEqual(await process(event),{accepted:true,duplicate:true});assert.equal(mock.commits,afterFirst);
 const entryPath=[...mock.docs.keys()].find(path=>path.startsWith('sorteos_bienestar/')&&path.includes('/participantes/'))!;
 const saved=decodeFields(mock.docs.get(entryPath)!.fields);assert.equal(saved.participant.name,'Participante de prueba');assert.equal(saved.consent.accepted,true);
 const replayWithNewEvent=parseSorteappRewardsEvent({...created(),eventId:'event-002'});assert.deepEqual(await process(replayWithNewEvent),{accepted:true,duplicate:true});
 const deleted=parseSorteappRewardsEvent({schemaVersion:1,eventId:'event-delete-1',eventType:'draw.entry.deleted',occurredAt:new Date().toISOString(),draw:{id:'draw-001',tenantId:'tenant-astrea-2026'},entry:{id:'entry-001'}});
 assert.deepEqual(await process(deleted),{accepted:true,duplicate:false,deleted:true});
 const withdrawn=decodeFields(mock.docs.get(entryPath)!.fields);assert.equal(withdrawn.status,'withdrawn');assert.equal(withdrawn.participant,undefined);assert.equal(withdrawn.consent,undefined);
});

test('the receiver rejects organizations outside the server-side allowlist before accessing Firestore',async()=>{
 const event=parseSorteappRewardsEvent(created()),environment=rewardsEnvironment({SORTEAPP_REWARDS_TENANT_IDS:'another-tenant'});
 await assert.rejects(processSorteappRewardsEvent({projectId:'demo',databaseId:'(default)',environment,event,fetcher:async()=>{throw new Error('Firestore should not be called');},bearerToken:'test-only-token'}),(error:any)=>error.status===403);
});
