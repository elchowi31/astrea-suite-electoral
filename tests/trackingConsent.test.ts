import {test} from 'node:test';
import assert from 'node:assert/strict';
import {trackingConsentNeeded,gpsOnboardingNeeded,nativeTrackingOnboardingNeeded,type DeviceSeed} from '../src/lib/deviceSeed';
import {readFileSync} from 'node:fs';
test('A GPS permission alone does not authorize automatic tracking',()=>{
  const seed:DeviceSeed={deviceId:'d',createdAt:'',gps:'granted',automaticTracking:true};
  assert.equal(trackingConsentNeeded(seed),true);assert.equal(trackingConsentNeeded(null),true);
  assert.equal(trackingConsentNeeded({...seed,trackingConsentVersion:1,trackingConsentAt:'2026-11-06T12:00:00Z'}),false);
  assert.equal(trackingConsentNeeded({...seed,trackingConsentVersion:1}),true);
});

test('Declining tracking completes onboarding without authorizing GPS or blocking forms',()=>{
  const declined:DeviceSeed={deviceId:'d',createdAt:'',gps:'prompt',automaticTracking:false,automaticPaused:true,trackingSetupCompleted:true};
  assert.equal(trackingConsentNeeded(declined),false);
  assert.equal(gpsOnboardingNeeded(declined,'prompt'),false);
  assert.equal(nativeTrackingOnboardingNeeded(declined),false);
  assert.equal(declined.trackingConsentAt,undefined);
  assert.equal(trackingConsentNeeded({...declined,automaticTracking:true}),true);
});
test('Participant status is mounted while monitor routes remain administrator-only',()=>{
  const app=readFileSync('src/App.tsx','utf8');assert.equal(app.split('<TrackingStatusBanner/>').length-1,1);
  assert.ok(app.includes("isTrackingAdministrator(currentUser) && activeTab === 'routes'"));
});
