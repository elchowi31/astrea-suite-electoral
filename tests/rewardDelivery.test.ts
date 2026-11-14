import {test} from 'node:test';
import assert from 'node:assert/strict';
import {captureRewardLocation,deliveryMapsUrl,type RewardDelivery} from '../src/lib/rewardDelivery.ts';
test('one-shot geolocation requires consent, requests a fresh fix and never starts tracking',async()=>{
 let calls=0;const geolocation={getCurrentPosition:(success:PositionCallback,_error:PositionErrorCallback,options:PositionOptions)=>{calls++;assert.deepEqual(options,{enableHighAccuracy:true,timeout:15000,maximumAge:0});success({coords:{latitude:9.5,longitude:-74,accuracy:20}} as GeolocationPosition);}};
 await assert.rejects(captureRewardLocation({consented:false,geolocation}),/Autorice/);assert.equal(calls,0);
 const result=await captureRewardLocation({consented:true,geolocation,now:()=>1000});assert.equal(calls,1);assert.equal(result.capturedAt,'1970-01-01T00:00:01.000Z');assert.equal(result.accuracyMeters,20);
});
test('a denied permission or unavailable GPS allows a clear manual-address fallback',async()=>{
 for(const code of [1,2,3])await assert.rejects(captureRewardLocation({consented:true,geolocation:{getCurrentPosition:(_success,error)=>error!({code} as GeolocationPositionError)}}),/dirección/);
 await assert.rejects(captureRewardLocation({consented:true,geolocation:{getCurrentPosition:success=>success({coords:{latitude:NaN,longitude:0,accuracy:2}} as GeolocationPosition)}}),/válida/);
});
test('Google directions use own coordinates or an encoded manual address without a Maps API key',()=>{
 const delivery:RewardDelivery={address:{countryCode:'CO',department:'Cesar',municipality:'Astrea',line1:'Calle 1 # 2 & 3'},consent:{accepted:true,purpose:'reward_delivery',policyVersion:'1',acceptedAt:new Date().toISOString(),scopes:['address']}};
 const address=new URL(deliveryMapsUrl(delivery));assert.equal(address.searchParams.get('api'),'1');assert.equal(address.searchParams.get('destination'),'Calle 1 # 2 & 3, Astrea, Cesar, Colombia');
 delivery.location={latitude:0,longitude:0,accuracyMeters:0,capturedAt:new Date().toISOString(),source:'device_geolocation',confirmedForDelivery:true};assert.equal(new URL(deliveryMapsUrl(delivery)).searchParams.get('destination'),'0,0');
});
