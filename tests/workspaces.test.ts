import test from 'node:test';import assert from 'node:assert/strict';
import {WORKSPACES,availableWorkspaces,canOpenModule} from '../src/lib/workspaces';
import {MODULE_LABELS} from '../src/lib/moduleNavigation';
import type {UserProfile} from '../src/types';
test('seven workspaces retain every legacy module and separate administration and other projects',()=>{
 assert.equal(WORKSPACES.filter(w=>!w.secondary).length,7);
 const tabs=WORKSPACES.flatMap(w=>w.tabs);assert.equal(new Set(tabs).size,tabs.length);
 assert.deepEqual([...tabs].sort(),Object.keys(MODULE_LABELS).filter(k=>k!=='login').sort());
 assert.deepEqual(WORKSPACES.find(w=>w.id==='extensions')?.tabs,['rewards','reward_draws']);
});
test('grouped navigation preserves role restrictions and tracking access',()=>{
 const user={uid:'reader',tenantId:'a',role:'Consulta',active:true,accessVersion:2} as UserProfile;
 assert.equal(canOpenModule('data_quality',user),false);assert.equal(canOpenModule('witnesses',user),false);assert.equal(canOpenModule('routes',user),false);
 assert.equal(availableWorkspaces(user).some(w=>w.tabs.includes('users')),false);
 const admin={...user,role:'AdminTenant'} as UserProfile;assert.equal(canOpenModule('data_quality',admin),true);assert.equal(canOpenModule('tenants',admin),false);
});
