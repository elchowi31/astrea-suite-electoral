import {test} from 'node:test';import assert from 'node:assert/strict';
import {ensureSeed,readSeed,updateSeed,gpsPermission,requestGps,gpsOnboardingNeeded,nativeTrackingOnboardingNeeded,prepareNativeTracking,autoResumeDecision,deviceLabel,type SeedEnvironment,type GpsState} from '../src/lib/deviceSeed';

class MemoryStorage{data=new Map<string,string>();getItem(key:string){return this.data.get(key)??null;}setItem(key:string,value:string){this.data.set(key,String(value));}removeItem(key:string){this.data.delete(key);}}
const environment=(options:{persist?:boolean;permission?:GpsState|'throws'|'absent';position?:'ok'|'denied'|'timeout';geolocation?:boolean}={}):SeedEnvironment&{local:MemoryStorage;session:MemoryStorage;prompts:number}=>{
  const env={local:new MemoryStorage(),session:new MemoryStorage(),prompts:0,persist:()=>options.persist??true,
    permissions:options.permission==='absent'?undefined:{query:async()=>{if(options.permission==='throws')throw new Error('unsupported');return {state:options.permission??'prompt'};}},
    geolocation:options.geolocation===false?undefined:{getCurrentPosition:(ok:(position:unknown)=>void,fail:(error:{code:number})=>void)=>{env.prompts++;if(options.position==='denied')fail({code:1});else if(options.position==='timeout')fail({code:3});else ok({coords:{latitude:9.5,longitude:-74,accuracy:8},timestamp:1});}},
    now:()=>new Date('2026-10-10T12:00:00Z'),uuid:()=>'device-1'};
  return env as unknown as SeedEnvironment&{local:MemoryStorage;session:MemoryStorage;prompts:number};
};

test('A device receives one stable seed that survives reopening when data is kept',()=>{
  const env=environment();assert.equal(readSeed(env),null);
  const first=ensureSeed(env);assert.equal(first.deviceId,'device-1');assert.equal(first.gps,'unknown');
  (env as {uuid:()=>string}).uuid=()=>'device-2';assert.equal(ensureSeed(env).deviceId,'device-1');
  assert.ok(env.local.getItem('astrea-device-seed-v1'));assert.equal(env.session.getItem('astrea-device-seed-v1'),null);
});
test('Without permission to keep data the seed lives only for the browser session',()=>{
  const env=environment({persist:false});ensureSeed(env);assert.equal(env.local.getItem('astrea-device-seed-v1'),null);assert.ok(env.session.getItem('astrea-device-seed-v1'));
});
test('A corrupted seed is replaced instead of breaking the app',()=>{
  const env=environment();env.local.setItem('astrea-device-seed-v1','{not json');assert.equal(readSeed(env),null);assert.equal(ensureSeed(env).deviceId,'device-1');
});
test('GPS permission is read from the browser and falls back to the remembered decision',async()=>{
  assert.equal(await gpsPermission(environment({permission:'granted'})),'granted');
  const env=environment({permission:'throws'});assert.equal(await gpsPermission(env),'unknown');updateSeed({gps:'granted'},env);assert.equal(await gpsPermission(env),'granted');
  assert.equal(await gpsPermission(environment({geolocation:false})),'unsupported');
});
test('Authorizing GPS records the decision once; a timeout still means the permission was granted',async()=>{
  const env=environment({position:'ok'});const result=await requestGps(env);assert.equal(result.state,'granted');assert.equal(result.position?.coords.accuracy,8);assert.equal(readSeed(env)?.gps,'granted');assert.equal(readSeed(env)?.gpsAskedAt,'2026-10-10T12:00:00.000Z');
  assert.equal((await requestGps(environment({position:'timeout'}))).state,'granted');
  const denied=environment({position:'denied'});assert.equal((await requestGps(denied)).state,'denied');assert.equal(readSeed(denied)?.gps,'denied');
});
test('The onboarding asks for GPS only the first time on a device',()=>{
  assert.equal(gpsOnboardingNeeded(null,'prompt'),true);
  assert.equal(gpsOnboardingNeeded({deviceId:'d',createdAt:'',gps:'unknown'},'unknown'),true);
  assert.equal(gpsOnboardingNeeded({deviceId:'d',createdAt:'',gps:'prompt',gpsAskedAt:'2026-10-10'},'prompt'),false);
  assert.equal(gpsOnboardingNeeded(null,'granted'),false);assert.equal(gpsOnboardingNeeded(null,'denied'),false);assert.equal(gpsOnboardingNeeded(null,'unsupported'),false);
});
test('Tracking resumes by itself only for the same user, an open route and an already granted GPS',()=>{
  const seed={deviceId:'d',createdAt:'',gps:'granted' as const,activeRouteId:'r1',activeUserId:'u1',activeTenantId:'t1'};
  const route={id:'r1',userId:'u1',tenantId:'t1',status:'En curso' as const};
  assert.equal(autoResumeDecision(seed,[route],'u1','t1','granted'),'resume');
  assert.equal(autoResumeDecision(seed,[route],'u1','t1','prompt'),'ask');
  assert.equal(autoResumeDecision(seed,[route],'u2','t1','granted'),'none');
  assert.equal(autoResumeDecision(seed,[{...route,status:'Finalizado'}],'u1','t1','granted'),'clear');
  assert.equal(autoResumeDecision(seed,[{...route,status:'Pausado'}],'u1','t1','granted'),'clear');
  assert.equal(autoResumeDecision(seed,[],'u1','t1','granted'),'wait');
  assert.equal(autoResumeDecision({...seed,activeRouteId:undefined},[route],'u1','t1','granted'),'none');
  assert.equal(autoResumeDecision(seed,[route],'u1','t1','denied'),'denied');
});
test('Device labels are short and readable',()=>{
  assert.equal(deviceLabel('Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36'),'Android 14 · SM-A546E · Chrome');
  assert.equal(deviceLabel('Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1'),'iPhone · iOS 18.1 · Safari');
  assert.ok(deviceLabel('x'.repeat(500)).length<=120);
});

test('Android onboarding uses native permissions even when the WebView has no geolocation API',async()=>{
  const env=environment({geolocation:false});let requests=0;
  env.nativePermission={check:async()=>'denied',request:async()=>{requests++;return 'granted';}};
  updateSeed({gps:'granted'},env);
  assert.equal(await gpsPermission(env),'denied','a saved grant cannot override a revoked Android permission');assert.equal(requests,0);
  const result=await requestGps(env);assert.equal(result.state,'granted');assert.equal(requests,1);
  assert.equal(readSeed(env)?.gps,'granted');assert.equal(readSeed(env)?.gpsAskedAt,'2026-10-10T12:00:00.000Z');assert.equal(env.prompts,0);
  const revoked=await requestGps(env);assert.equal(revoked.state,'denied');assert.equal(requests,1,'a revoked grant requires Settings, without another Android dialog');
});

test('A denied initial Android location permission is not requested again after reopening',async()=>{
  const env=environment({geolocation:false});let requests=0;
  env.nativePermission={check:async()=>'denied',request:async()=>{requests++;return 'denied';}};
  assert.equal((await requestGps(env)).state,'denied');
  assert.equal((await requestGps(env)).state,'denied');assert.equal(requests,1);
});

test('Initial tracking setup proceeds with GPS granted and notifications denied, without requesting either again',async()=>{
  const env=environment({geolocation:false});let gpsRequests=0;let notificationRequests=0;
  env.nativePermission={check:async()=>'granted',request:async()=>{gpsRequests++;return 'granted';}};
  const notifications={checkPermissions:async()=>({display:'denied'}),requestPermissions:async()=>{notificationRequests++;return {display:'denied'};}};
  assert.equal(nativeTrackingOnboardingNeeded(readSeed(env)),true);
  assert.equal((await prepareNativeTracking(env,notifications)).state,'granted');
  assert.equal(readSeed(env)?.automaticTracking,undefined,'an unfinished attempt must not become a declined decision');
  updateSeed({automaticTracking:true,automaticPaused:false,trackingSetupCompleted:true},env);
  assert.equal(nativeTrackingOnboardingNeeded(readSeed(env)),false);
  assert.equal((await prepareNativeTracking(env,notifications)).state,'granted');
  assert.equal(gpsRequests,1);assert.equal(notificationRequests,1);
});

test('The interrupted 1.0.3 setup is recoverable while completed, declined and paused choices are respected',()=>{
  const env=environment();const seed=ensureSeed(env);
  const interrupted={...seed,automaticTracking:false,gpsAskedAt:'2026-10-10',notificationAskedAt:'2026-10-10'};
  assert.equal(nativeTrackingOnboardingNeeded(interrupted),true);
  assert.equal(nativeTrackingOnboardingNeeded({...interrupted,trackingSetupCompleted:true}),false);
  assert.equal(nativeTrackingOnboardingNeeded({...interrupted,automaticTracking:true}),false);
  assert.equal(nativeTrackingOnboardingNeeded({...interrupted,automaticPaused:true}),false);
  assert.equal(nativeTrackingOnboardingNeeded({...seed,automaticTracking:false,gpsAskedAt:'2026-10-10'}),false,'a previous explicit decline without an interrupted attempt is not reopened');
});
