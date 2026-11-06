import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DEFAULT_REWARDS,calculateRewards,apportion} from '../src/lib/rewards';
import {importRewardMatrix} from '../src/lib/rewardFiles';
test('7,000 hours and 368 fruits: exact cent conservation and whole fruit allocation',()=>{
  const config=structuredClone(DEFAULT_REWARDS),r=calculateRewards(config);
  assert.equal(r.production,368);assert.equal(r.rows.reduce((s,f)=>s+Math.round(f.targetHours*100),0),700000);
  for(const farm of r.rows){assert.equal(Math.round(farm.teams.reduce((s,t)=>s+t.hours,0)*100),Math.round(farm.targetHours*100));assert.equal(farm.teams.reduce((s,t)=>s+t.expectedFruits,0),farm.production);assert.equal(farm.teams.reduce((s,t)=>s+t.earnedFruits,0),0);}
  const hours=Object.fromEntries(r.rows.map(f=>[f.id,f.teams.map(t=>t.hours)]));
  const approved=calculateRewards(config,hours);assert.equal(approved.rows.flatMap(f=>f.teams).reduce((s,t)=>s+t.earnedFruits,0),368);
});
test('Manual zero opts out; blank teams split remainder, oversubscription never creates fruit',()=>{
  const config=structuredClone(DEFAULT_REWARDS);config.farmCount=1;config.targetHours=100;config.farms[0].production=8;config.farms[0].manualHours=[0,20,null,...Array(7).fill(null)];
  let f=calculateRewards(config).rows[0];assert.deepEqual(f.teams.map(t=>t.hours),[0,20,80]);assert.deepEqual(f.teams.map(t=>t.expectedFruits),[0,2,6]);
  config.farms[0].manualHours=[80,80,null,...Array(7).fill(null)];f=calculateRewards(config,{'farm-1':[80,80,0]}).rows[0];
  assert.equal(f.excessHours,60);assert.deepEqual(f.teams.map(t=>t.earnedFruits),[4,4,0]);
});
test('Partial verified hours leave fruits in reserve; inactive farms and teams do not count',()=>{
  const c=structuredClone(DEFAULT_REWARDS);c.farmCount=1;c.teamCount=2;c.targetHours=100;c.farms[0].production=10;c.farms[0].manualHours=[null,null,999999,...Array(7).fill(null)];
  const f=calculateRewards(c,{'farm-1':[10,15,999]}).rows[0];assert.equal(f.pendingFruits,8);assert.equal(f.teams.reduce((s,t)=>s+t.earnedFruits,0),2);
  c.farms[0].production=0;const empty=calculateRewards(c);assert.equal(empty.unassignedHours,100);assert.equal(empty.rows[0].assignedHours,0);
});
test('Invalid numbers and tiny targets do not generate NaN or negative allocations',()=>{
  assert.throws(()=>calculateRewards({...DEFAULT_REWARDS,targetHours:NaN}));assert.throws(()=>calculateRewards({...DEFAULT_REWARDS,farmCount:0}));
  assert.throws(()=>calculateRewards({...DEFAULT_REWARDS,targetHours:1.001}));assert.deepEqual(apportion(2,[1,1,1]),[1,1,0]);
  for(let cents=1;cents<700;cents++){const c={...structuredClone(DEFAULT_REWARDS),targetHours:cents/100};const r=calculateRewards(c);assert.equal(r.rows.reduce((s,f)=>s+Math.round(f.targetHours*100),0),cents);for(const f of r.rows)assert.ok(f.teams.every(t=>t.hours>=0&&Number.isFinite(t.hours)));}
});
test('The editable Excel template imports original production and manual zero distinctly',async()=>{
  const bytes=readFileSync('public/plantilla-recompensas.xlsx');const r=await importRewardMatrix({size:bytes.length,arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)});
  assert.equal(r.farms[0].production,20);assert.equal(r.farms[1].production,300);assert.equal(r.farms[7].production,8);assert.equal(r.farms[0].manualHours[0],null);
});
