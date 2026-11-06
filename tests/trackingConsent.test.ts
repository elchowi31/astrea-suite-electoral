import {test} from 'node:test';
import assert from 'node:assert/strict';
import {trackingConsentNeeded,type DeviceSeed} from '../src/lib/deviceSeed';
import {readFileSync} from 'node:fs';
test('A GPS permission alone does not authorize automatic tracking',()=>{
  const seed:DeviceSeed={deviceId:'d',createdAt:'',gps:'granted',automaticTracking:true};
  assert.equal(trackingConsentNeeded(seed),true);assert.equal(trackingConsentNeeded(null),true);
  assert.equal(trackingConsentNeeded({...seed,trackingConsentVersion:1,trackingConsentAt:'2026-11-06T12:00:00Z'}),false);
  assert.equal(trackingConsentNeeded({...seed,trackingConsentVersion:1}),true);
});
test('Participant status is mounted while monitor routes remain administrator-only',()=>{
  const app=readFileSync('src/App.tsx','utf8');assert.equal(app.split('<TrackingStatusBanner/>').length-1,1);
  assert.ok(app.includes("isTrackingAdministrator(currentUser) && activeTab === 'routes'"));
});
