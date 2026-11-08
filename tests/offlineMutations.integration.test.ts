import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {indexedDB} from 'fake-indexeddb';
import {initializeTestEnvironment} from '@firebase/rules-unit-testing';
import {initializeApp,deleteApp} from 'firebase/app';
import {connectAuthEmulator,createUserWithEmailAndPassword,getAuth,signInWithEmailAndPassword,signOut} from 'firebase/auth';
import {collection,connectFirestoreEmulator,disableNetwork,doc,enableNetwork,getDocFromServer,getDocsFromServer,getFirestore,query,setDoc,terminate,where} from 'firebase/firestore';
import {buildDemoBundle} from '../src/data/demoSeed';
import type {UserProfile} from '../src/types';
import {canonicalStoredValue} from '../src/lib/serialization';
import type {GeographicLayer,GeoFeature} from '../src/lib/geographicImport';
import type {SavedScenario} from '../src/lib/simulationScenarios';

test('Offline forms survive durable storage, reconnect to Firestore and never replay twice or across accounts',
{skip:process.env.ASTREA_FIREBASE_TEST_EMULATORS!=='true',timeout:180000},async t=>{
  assert.equal(process.env.GCLOUD_PROJECT,'demo-astrea');
  assert.equal(process.env.FIRESTORE_EMULATOR_HOST,'127.0.0.1:8088');
  const originals=new Map(['localStorage','indexedDB','navigator'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  const network={onLine:true};
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(key:string)=>key==='astrea-device-storage-v1'?'{"enabled":true}':null}});
  Object.defineProperty(globalThis,'indexedDB',{configurable:true,value:indexedDB});
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:network});
  const {app,auth,db,persistEntity,persistFirestoreBatch,saveCommitteeTask,saveWorkspaceEventToFirestore,saveAiAnalysisToFirestore}=await import('../src/lib/firebase');
  const {queuedOfflineMutations,setOfflineMutationScope,syncOfflineMutations,discardFailedOfflineMutation}=await import('../src/lib/offlineMutations');
  const {saveEvent}=await import('../src/lib/operationsStore');
  const {updateOperationalRecord}=await import('../src/lib/recordEditing');
  const {saveRegistration}=await import('../src/lib/attendanceStore');
  const {saveGeographicFeature}=await import('../src/lib/mapPersistence');
  const {appendSharedRows,saveSharedScenario}=await import('../src/lib/sharedSimulation');
  assert.equal(app.options.projectId,'demo-astrea');
  const env=await initializeTestEnvironment({projectId:'demo-astrea',firestore:{host:'127.0.0.1',port:8088,rules:readFileSync('firestore.rules','utf8')}});
  const email=`offline-${Date.now()}@test.invalid`,password='Emulator-only-481!';
  const {user}=await createUserWithEmailAndPassword(auth,email,password);
  const scope={userId:user.uid,tenantId:`offline-${user.uid}`};
  const profile:UserProfile={uid:user.uid,email,displayName:'Offline forms test',tenantId:scope.tenantId,role:'AdminTenant',active:true,accessVersion:2,createdAt:new Date().toISOString(),department:'Cesar',municipality:'Astrea'};
  await env.withSecurityRulesDisabled(async ctx=>{const setup=ctx.firestore();await setDoc(doc(setup,'usuarios',user.uid),profile);await setDoc(doc(setup,'organizaciones',scope.tenantId),{tenantId:scope.tenantId,active:true});await setup.terminate();});
  setOfflineMutationScope(scope);
  const second=initializeApp(app.options,`offline-observer-${Date.now()}`),secondAuth=getAuth(second),observer=getFirestore(second);
  connectAuthEmulator(secondAuth,'http://127.0.0.1:9098',{disableWarnings:true});connectFirestoreEmulator(observer,'127.0.0.1',8088);
  await signInWithEmailAndPassword(secondAuth,email,password);
  const bundle=buildDemoBundle(scope.tenantId,profile);
  const forms:Record<string,any>={candidatos:bundle.candidates[0],lideres:bundle.leaders[0],vehiculos:bundle.vehicles[0],gastos:bundle.expenses[0],aportes:bundle.contributions[0],propuestas:bundle.proposals[0],distritos:bundle.districts[0],archivos_drive:bundle.driveFiles[0],comites_coordinaciones:bundle.coordinations[0]};
  const records=Object.entries(forms).map(([name,data])=>({name,data:{...data,id:`${scope.tenantId}--${name}`,tenantId:scope.tenantId,createdBy:user.uid}}));
  const voter={...bundle.voters[0],id:`${scope.tenantId}--person`,tenantId:scope.tenantId,createdBy:user.uid,leaderId:`${scope.tenantId}--lideres`,candidateId:`${scope.tenantId}--candidatos`,documentNumber:'123456789',consentGiven:true,consentAt:new Date().toISOString()};
  records.push({name:'votantes_rasos',data:voter});
  try{
    let originalCommand:any;
    await t.test('all standard capture forms commit locally while the Firestore network is disabled',async()=>{
      await disableNetwork(db);network.onLine=false;
      for(const row of records){assert.ok(row.data);await persistEntity(row.name,row.data.id,row.data);}
      const pending=await queuedOfflineMutations(scope);assert.equal(pending.length,records.length);
      originalCommand=pending[0];
      for(const row of records)assert.equal((await getDocFromServer(doc(observer,row.name,row.data.id))).exists(),false);
      setOfflineMutationScope(null);
      assert.equal((await queuedOfflineMutations(scope)).length,records.length,'data survives scope teardown and reopened IndexedDB connections');
    });
    await t.test('reconnect in another account or organization leaves the queue untouched',async()=>{
      network.onLine=true;await enableNetwork(db);
      setOfflineMutationScope({...scope,userId:'another-user'});await syncOfflineMutations(scope);
      assert.equal((await queuedOfflineMutations(scope)).length,records.length);
      setOfflineMutationScope({...scope,tenantId:'another-team'});await syncOfflineMutations(scope);
      assert.equal((await queuedOfflineMutations(scope)).length,records.length);
    });
    await t.test('reconnect with the original account is independently visible in Firestore',async()=>{
      setOfflineMutationScope(scope);await syncOfflineMutations(scope);
      assert.deepEqual(await queuedOfflineMutations(scope),[]);
      for(const row of records){const actual=(await getDocFromServer(doc(observer,row.name,row.data.id))).data();assert.equal(actual?.id,row.data.id);assert.equal(actual?.tenantId,scope.tenantId);assert.equal(actual?.createdBy,user.uid);}
    });
    await t.test('crash after server commit but before local cleanup does not duplicate the audit',async()=>{
      const database=await new Promise<IDBDatabase>((resolve,reject)=>{const req=indexedDB.open('astrea-offline-mutations',1);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
      const {sequence,...replay}=originalCommand;
      await new Promise<void>((resolve,reject)=>{const tx=database.transaction('mutations','readwrite');tx.objectStore('mutations').add(replay);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});database.close();
      await syncOfflineMutations(scope);assert.deepEqual(await queuedOfflineMutations(scope),[]);
      const audit=await getDocsFromServer(query(collection(observer,'auditoria'),where('tenantId','==',scope.tenantId),where('entityId','==',records[0].data.id)));
      assert.equal(audit.size,1);
    });
    await t.test('an offline edit detects a newer server value and preserves the rejected intent',async()=>{
      const leader=records.find(row=>row.name==='lideres')!;
      network.onLine=false;await disableNetwork(db);
      await updateOperationalRecord('lideres',leader.data.id,scope.tenantId,{fullName:'Offline correction'},leader.data);
      await setDoc(doc(observer,'lideres',leader.data.id),{fullName:'Concurrent correction'},{merge:true});
      network.onLine=true;await enableNetwork(db);await syncOfflineMutations(scope);
      const failed=await queuedOfflineMutations(scope);assert.equal(failed.length,1);assert.equal(failed[0].status,'failed');
      assert.equal((await getDocFromServer(doc(observer,'lideres',leader.data.id))).data()?.fullName,'Concurrent correction');
      await discardFailedOfflineMutation(scope,failed[0].id);
    });
    await t.test('committee tasks and operational events also replay after losing connectivity',async()=>{
      const coordination=records.find(row=>row.name==='comites_coordinaciones')!.data;
      const committee=coordination.committees[0],task=committee.tasks[0];
      const event={...bundle.operations!.events[0],id:`scope-event`,tenantId:scope.tenantId};event.id=`${scope.tenantId}--event`;
      network.onLine=false;await disableNetwork(db);
      await saveCommitteeTask(scope.tenantId,coordination.id,committee.id,{...task,completed:!task.completed});
      await saveEvent(event,profile);
      assert.equal((await queuedOfflineMutations(scope)).length,2);
      network.onLine=true;await enableNetwork(db);await syncOfflineMutations(scope);
      assert.deepEqual(await queuedOfflineMutations(scope),[]);
      assert.equal((await getDocFromServer(doc(observer,'comites_coordinaciones',coordination.id))).data()?.committees[0].tasks[0].completed,!task.completed);
      assert.equal((await getDocFromServer(doc(observer,'jornadas_operativas',event.id))).data()?.name,event.name);
      network.onLine=false;await disableNetwork(db);
      await saveRegistration(event,voter,'command',true,'Emulator check-in',profile);
      network.onLine=true;await enableNetwork(db);await syncOfflineMutations(scope);
      assert.deepEqual(await queuedOfflineMutations(scope),[]);
      assert.equal((await getDocFromServer(doc(observer,'registros_jornada',`${scope.tenantId}--${event.id}--${voter.documentNumber}`))).data()?.command,true);
    });
    await t.test('table imports and geographic layers use the same durable batch without adding forbidden fields',async()=>{
      const table={id:`${scope.tenantId}--data-test`,tenantId:scope.tenantId,ownerId:user.uid,importId:'test',filename:'test.csv',name:'Emulator table',sheet:'Data',columns:['name'],rows:[{name:'Synthetic'}],part:0,createdAt:new Date().toISOString()};
      const layer={id:`${scope.tenantId}--geo-test`,tenantId:scope.tenantId,createdBy:user.uid,importId:'test',filename:'test.geojson',name:'Emulator layer',features:[],importedAt:new Date().toISOString()};
      network.onLine=false;await disableNetwork(db);
      await persistFirestoreBatch(scope.tenantId,[{collection:'bases_datos',id:table.id,type:'set',data:table},{collection:'capas_geograficas',id:layer.id,type:'set',data:layer}]);
      network.onLine=true;await enableNetwork(db);await syncOfflineMutations(scope);
      assert.deepEqual(await queuedOfflineMutations(scope),[]);
      assert.deepEqual((await getDocFromServer(doc(observer,'bases_datos',table.id))).data()?.rows,table.rows);
      assert.equal((await getDocFromServer(doc(observer,'capas_geograficas',layer.id))).data()?.name,layer.name);
    });
    await t.test('geographic feature edits survive disconnect and preserve other features',async()=>{
      const feature:GeoFeature={id:'point',name:'Synthetic point',description:'Emulator only',properties:{},geometries:[{type:'Point',coordinates:[{latitude:9.5,longitude:-73.9}]}]};
      const other={...feature,id:'other',name:'Other point'};
      const layer:GeographicLayer={id:`${scope.tenantId}--geo-edit`,tenantId:scope.tenantId,createdBy:user.uid,importId:'test',filename:'test.geojson',name:'Editable',features:[feature,other],importedAt:new Date().toISOString()};
      await setDoc(doc(observer,'capas_geograficas',layer.id),layer);
      network.onLine=false;await disableNetwork(db);
      await saveGeographicFeature(layer,{...feature,name:'Offline point correction'},canonicalStoredValue(feature));
      await setDoc(doc(observer,'capas_geograficas',layer.id),{features:[feature,{...other,name:'Concurrent unrelated correction'}]},{merge:true});
      network.onLine=true;await enableNetwork(db);await syncOfflineMutations(scope);
      assert.deepEqual(await queuedOfflineMutations(scope),[]);
      const saved=(await getDocFromServer(doc(observer,'capas_geograficas',layer.id))).data()!;
      assert.equal(saved.features[0].name,'Offline point correction');assert.equal(saved.features[1].name,'Concurrent unrelated correction');
    });
    await t.test('Workspace metadata and AI results use scoped IDs that an organization administrator can create',async()=>{
      await saveWorkspaceEventToFirestore(scope.tenantId,{id:'external-calendar-id',title:'Synthetic calendar event'});
      await saveAiAnalysisToFirestore(scope.tenantId,{type:'Consulta',title:'Synthetic result',content:'Emulator only'});
      assert.equal((await getDocFromServer(doc(observer,'eventos_workspace',`${scope.tenantId}--external-calendar-id`))).data()?.sourceId,'external-calendar-id');
      const analyses=await getDocsFromServer(query(collection(observer,'analisis_ia'),where('tenantId','==',scope.tenantId)));
      assert.equal(analyses.size,1);assert.equal(analyses.docs[0].data().content,'Emulator only');
    });
    await t.test('statistical imports and saved scenarios replay atomically after disconnection',async()=>{
      const rows=[{municipality:'Astrea',year:2023,metric:'censo' as const,group:'',value:1000,level:'',source:'Synthetic test fixture',url:'https://example.com/synthetic',referenceDate:'2023-01-01',provenance:'aportada' as const}];
      const parameters={census:1000,turnout:50,nullPct:0,blankPct:0,unmarkedPct:0,seats:1,level:'Alcaldía' as const,parties:[{id:'synthetic',name:'Synthetic',color:'#123456',votes:500,isUserParty:true}]};
      const scenario:SavedScenario={id:`${scope.tenantId}--scenario`,name:'Synthetic',savedAt:new Date().toISOString(),snapshot:{version:1,tenantId:scope.tenantId,municipality:'Astrea',referenceYear:2023,parameters,base:parameters,censusOrigin:'Synthetic',historicalOrigin:'Synthetic',imported:rows}};
      network.onLine=false;await disableNetwork(db);await appendSharedRows(scope.tenantId,rows);await saveSharedScenario(scope.tenantId,scenario);
      network.onLine=true;await enableNetwork(db);await syncOfflineMutations(scope);
      assert.deepEqual(await queuedOfflineMutations(scope),[]);
      assert.equal((await getDocFromServer(doc(observer,'simulaciones',scenario.id))).data()?.name,'Synthetic');
      const sources=await getDocsFromServer(query(collection(observer,'fuentes_estadisticas'),where('tenantId','==',scope.tenantId)));
      assert.equal(sources.size,2);assert.equal(sources.docs[0].data().rows[0].value,1000);
    });
    await t.test('a multi-document import can commit more than twenty scoped records',async()=>{
      const writes=Array.from({length:25},(_,index)=>({collection:'propuestas',id:`${scope.tenantId}--bulk-${index}`,type:'set' as const,data:{id:`${scope.tenantId}--bulk-${index}`,tenantId:scope.tenantId,title:`Synthetic ${index}`}}));
      network.onLine=false;await disableNetwork(db);await persistFirestoreBatch(scope.tenantId,writes);
      network.onLine=true;await enableNetwork(db);await syncOfflineMutations(scope);assert.deepEqual(await queuedOfflineMutations(scope),[]);
      assert.equal((await getDocFromServer(doc(observer,'propuestas',writes[24].id))).data()?.title,'Synthetic 24');
    });
  }finally{
    network.onLine=true;setOfflineMutationScope(null);await enableNetwork(db);await signOut(auth);await signOut(secondAuth);await terminate(db);await terminate(observer);await deleteApp(second);await deleteApp(app);await env.cleanup();
    for(const [key,descriptor]of originals)if(descriptor)Object.defineProperty(globalThis,key,descriptor);else Reflect.deleteProperty(globalThis,key);
  }
});
