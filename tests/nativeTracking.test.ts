import {test} from 'node:test';import assert from 'node:assert/strict';
import {toFirestoreFields,createCommitBody,upsertCommitBody,patchCommitBody,firestoreDocumentsUrl,nativeCommit,nativeLocationPermission,requestNotificationPermission,type NativePermissionState} from '../src/lib/nativeTracking';

test('Values are typed for the Firestore REST API exactly as the rules expect',()=>{
  assert.deepEqual(toFirestoreFields({lat:9.5,lng:-74,ms:1760100000000,name:'Ana',battery:null,installed:true,whole:12},['lat','lng']),{
    lat:{doubleValue:9.5},lng:{doubleValue:-74},ms:{integerValue:'1760100000000'},name:{stringValue:'Ana'},battery:{nullValue:null},installed:{booleanValue:true},whole:{integerValue:'12'}});
  assert.deepEqual(toFirestoreFields({lat:9},['lat']),{lat:{doubleValue:9}},'coordinates stay doubles even when whole numbers');
});
test('A GPS sample is created once with the server receipt time; retries cannot overwrite it',()=>{
  const body=createCommitBody('projects/p/databases/d/documents','puntos_recorrido','t1--gps-1',{id:'t1--gps-1',latitude:9.5,longitude:-74,accuracy:5,capturedAtMillis:1},'receivedAt',['latitude','longitude','accuracy']);
  assert.equal(body.writes[0].update.name,'projects/p/databases/d/documents/puntos_recorrido/t1--gps-1');
  assert.deepEqual(body.writes[0].currentDocument,{exists:false});
  assert.deepEqual(body.writes[0].updateTransforms,[{fieldPath:'receivedAt',setToServerValue:'REQUEST_TIME'}]);
  assert.deepEqual(body.writes[0].update.fields.capturedAtMillis,{integerValue:'1'});
});
test('The live position replaces the previous one and stamps the server time',()=>{
  const body=upsertCommitBody('projects/p/databases/d/documents','posiciones_actuales','t1--u1',{id:'t1--u1',latitude:9.5},'updatedAt',['latitude']);
  assert.equal(body.writes[0].currentDocument,undefined);assert.equal(body.writes[0].updateTransforms[0].fieldPath,'updatedAt');
});
test('The REST endpoint targets the named database of the project',()=>{
  assert.equal(firestoreDocumentsUrl('proj','ai-studio-db'),'https://firestore.googleapis.com/v1/projects/proj/databases/ai-studio-db/documents');
});
test('Native trip metadata retains nested arrays, and closure patches preserve its owner and origin',()=>{
  assert.deepEqual(toFirestoreFields({route:{geometry:[],stops:[],distanceMeters:0}},[]),{route:{mapValue:{fields:{geometry:{arrayValue:{values:[]}},stops:{arrayValue:{values:[]}},distanceMeters:{integerValue:'0'}}}}});
  const body=patchCommitBody('projects/p/databases/d/documents','recorridos','r1',{status:'Finalizado',finishedAtMillis:2000},undefined,[]);
  assert.deepEqual(body.writes[0].updateMask,{fieldPaths:['status','finishedAtMillis']});assert.deepEqual(body.writes[0].currentDocument,{exists:true});
  assert.equal(body.writes[0].update.fields.userId,undefined);
});

test('Android permission checks do not prompt; an existing grant is reused',async()=>{
  let prompts=0;
  let permission:NativePermissionState='granted';
  const api={checkPermissions:async()=>({location:permission}),requestPermissions:async()=>{prompts++;return {location:'granted' as const};}};
  assert.equal(await nativeLocationPermission(false,api),'granted');
  assert.equal(await nativeLocationPermission(true,api),'granted');assert.equal(prompts,0);
  permission='prompt-with-rationale';assert.equal(await nativeLocationPermission(false,api),'prompt');assert.equal(prompts,0);
  assert.equal(await nativeLocationPermission(true,api),'granted');assert.equal(prompts,1);
  permission='denied';assert.equal(await nativeLocationPermission(false,api),'denied');
});

test('Background notification checks never reopen the permission dialog',async()=>{
  let prompts=0;let display='prompt';
  const api={checkPermissions:async()=>({display}),requestPermissions:async()=>{prompts++;display='granted';return {display};}};
  assert.equal(await requestNotificationPermission(false,api),false);assert.equal(prompts,0);
  assert.equal(await requestNotificationPermission(true,api),true);assert.equal(prompts,1);
  assert.equal(await requestNotificationPermission(false,api),true);assert.equal(prompts,1);
  display='denied';assert.equal(await requestNotificationPermission(false,api),false);assert.equal(prompts,1);
});

test('Denying notifications during initial setup is a valid choice, not a tracking error',async()=>{
  let prompts=0;
  const api={checkPermissions:async()=>({display:'denied'}),requestPermissions:async()=>{prompts++;return {display:'denied'};}};
  assert.equal(await requestNotificationPermission(true,api),false);
  assert.equal(await requestNotificationPermission(false,api),false);
  assert.equal(prompts,1);
});

test('A native sample is acknowledged only on success or an actual already-existing document',async()=>{
  const commit=(status:number,errorStatus?:string,stringBody=false,mode:'create'|'upsert'='create')=>nativeCommit(
    {projectId:'project',databaseId:'named-db'},'test-token',mode,'puntos_recorrido','sample',{latitude:9.5},'receivedAt',['latitude'],
    {post:async options=>{
      assert.equal(options.url,'https://firestore.googleapis.com/v1/projects/project/databases/named-db/documents:commit');
      const data=errorStatus?{error:{status:errorStatus}}:{};
      return {status,data:stringBody?JSON.stringify(data):data,headers:{},url:options.url};
    }});
  await commit(200);await commit(409,'ALREADY_EXISTS');await commit(409,'ALREADY_EXISTS',true);
  for(const [status,code] of [[400,'FAILED_PRECONDITION'],[409,'ABORTED'],[403,'PERMISSION_DENIED'],[503,'UNAVAILABLE']] as const){
    await assert.rejects(commit(status,code),new RegExp(`Firestore ${status}`));
  }
  await assert.rejects(commit(409,'ALREADY_EXISTS',false,'upsert'),/Firestore 409/);
});
