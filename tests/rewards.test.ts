import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_REWARDS,calculateRewards,apportion,manualRewardHours,convertRewardPlan,rewardMigrationConflicts,type RewardPlan,type RewardApproval} from '../src/lib/rewards';
const config=()=>({...structuredClone(DEFAULT_REWARDS),farmCount:1});
test('Each team retains 500 h; 300/400/250 distributes the entire 20 fruits as 6/9/5',()=>{
 const c=config();c.farms[0].manualHours=[300,400,250,...Array(7).fill(null)];
 const f=calculateRewards(c,manualRewardHours(c)).rows[0];
 assert.equal(f.targetHours,500);assert.deepEqual(f.teams.map(t=>t.hours/f.targetHours*100),[60,80,50]);
 assert.deepEqual(f.teams.map(t=>t.expectedFruits),[6,9,5]);assert.deepEqual(f.teams.map(t=>t.earnedFruits),[6,9,5]);
 assert.equal(f.assignedHours,950);assert.equal(f.missingHours,550);assert.equal(f.pendingFruits,0);
});
test('No automatic work from blanks; explicit zeros are required only for confirmation',()=>{
 const c=config();let f=calculateRewards(c).rows[0];assert.deepEqual(f.teams.map(t=>t.hours),[0,0,0]);assert.equal(f.teams.reduce((s,t)=>s+t.expectedFruits,0),0);
 assert.throws(()=>manualRewardHours(c),/registre/);c.farms[0].manualHours=[0,0,0,...Array(7).fill(null)];assert.deepEqual(manualRewardHours(c),{'farm-1':[0,0,0]});
 c.farms[0].manualHours[1]=100;f=calculateRewards(c).rows[0];assert.deepEqual(f.teams.map(t=>t.expectedFruits),[0,20,0]);assert.equal(f.teams[1].hours,100);
});
test('Additional hours count; zero production, inactive rows and each farm stay independent',()=>{
 const c=config();c.farmCount=2;c.teamCount=2;c.farms[0].manualHours=[1000,500,999999,...Array(7).fill(null)];c.farms[1].targetHoursPerTeam=2000;c.farms[1].manualHours=[100,300,...Array(8).fill(null)];
 const r=calculateRewards(c);assert.deepEqual(r.rows[0].teams.map(t=>t.expectedFruits),[13,7]);assert.equal(r.rows[0].excessHours,500);assert.equal(r.rows[0].missingHours,0);
 assert.deepEqual(r.rows[1].teams.map(t=>t.expectedFruits),[75,225]);assert.equal(r.rows[1].targetHours,2000);c.farms[0].production=0;assert.equal(calculateRewards(c).rows[0].teams[0].expectedFruits,0);
});
test('Maximum supported plan conserves integer fruit and accepts cent precision',()=>{
 const c=config();c.farmCount=100;c.teamCount=10;for(const [i,f] of c.farms.entries()){f.production=1000000-i;f.targetHoursPerTeam=.01;f.manualHours=Array.from({length:10},(_,j)=>(j+1)*.01);}
 for(const f of calculateRewards(c).rows){assert.equal(f.teams.reduce((s,t)=>s+t.expectedFruits,0),f.production);assert.ok(f.teams.every(t=>Number.isSafeInteger(t.expectedFruits)&&t.expectedFruits>=0));}
 assert.deepEqual(apportion(2,[1,1,1]),[1,1,0]);
 for(const bad of [NaN,Infinity,-1,1000001,.001]){const x=config();x.farms[0].manualHours[0]=bad;assert.throws(()=>calculateRewards(x));}
 for(const bad of [0,NaN,-1,.001]){const x=config();x.farms[0].targetHoursPerTeam=bad;assert.throws(()=>calculateRewards(x));}
});
test('Legacy calculations remain readable; conversion never treats automatic assignment as work',()=>{
 const c=config();c.schemaVersion=1;c.targetHours=7000;c.farmCount=8;const legacy=calculateRewards(c);assert.equal(legacy.rows.reduce((s,f)=>s+Math.round(f.targetHours*100),0),700000);
 const plan:RewardPlan={...c,id:'legacy',tenantId:'t',ownerId:'u',revision:1,name:'Anterior',updatedAt:''};const converted=convertRewardPlan(plan);
 assert.equal(converted.schemaVersion,2);assert.equal(converted.farms[0].targetHoursPerTeam,legacy.rows[0].targetHours);assert.equal(converted.farms[0].manualHours[0],null);assert.equal(calculateRewards(converted).rows[0].assignedHours,0);assert.equal(plan.schemaVersion,1);
});
test('Migration requires resolving disagreements, reuses confirmed values and preserves originals',()=>{
 const plan:RewardPlan={...config(),schemaVersion:1,id:'old',tenantId:'t',ownerId:'u',revision:3,name:'Anterior',updatedAt:''};plan.farms[0].manualHours[0]=300;
 const approval:RewardApproval={id:'old',tenantId:'t',revision:3,hours:{'farm-1':[200,100,0]},approvedBy:'admin',updatedAt:''};
 assert.equal(rewardMigrationConflicts(plan,approval).length,1);assert.throws(()=>convertRewardPlan(plan,approval),/Elija/);
 assert.deepEqual(convertRewardPlan(plan,approval,'confirmed').farms[0].manualHours.slice(0,3),[200,100,0]);assert.deepEqual(convertRewardPlan(plan,approval,'manual').farms[0].manualHours.slice(0,3),[300,null,null]);
 assert.equal(plan.farms[0].manualHours[0],300);assert.equal(approval.hours['farm-1'][0],200);assert.equal(rewardMigrationConflicts(plan,{...approval,revision:2}).length,0);
});
