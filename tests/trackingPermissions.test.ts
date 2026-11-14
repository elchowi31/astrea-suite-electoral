import {availableWorkspaces} from '../src/lib/workspaces';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {isTrackingAdministrator} from '../src/lib/trackingPermissions';
import type {UserProfile,UserRole} from '../src/types';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {Sidebar} from '../src/components/Sidebar';
const profile=(role:UserRole):UserProfile=>({uid:'u',displayName:'Ana',email:'a@test.invalid',tenantId:'t',createdAt:'',role,active:true,accessVersion:2});
test('Tracking is exclusive to verified administrators, regardless of political rank',()=>{
  for(const role of ['AdminGlobal','AdminTenant'] as const)assert.equal(isTrackingAdministrator(profile(role)),true);
  for(const role of ['Gobernador','Diputado','Alcalde','Concejal','JefePolitico','Supervisor','Operador','LiderVeredal','Consulta','Invitado'] as const)assert.equal(isTrackingAdministrator(profile(role)),false,role);
  assert.equal(isTrackingAdministrator({...profile('AdminTenant'),active:false}),false);
  assert.equal(isTrackingAdministrator({...profile('AdminTenant'),accessVersion:1}),false);
  assert.equal(isTrackingAdministrator(null),false);
});
test('Members can prepare their device while grouped tracking access remains restricted',()=>{
  for(const role of ['Alcalde','Gobernador','Operador','Consulta','Invitado'] as const){const tabs=availableWorkspaces(profile(role)).flatMap(w=>w.tabs);assert.equal(tabs.includes('routes'),false,role);assert.ok(tabs.includes('device'),role);assert.ok(tabs.includes('transport'),role);}
  assert.ok(availableWorkspaces(profile('AdminTenant')).flatMap(w=>w.tabs).includes('routes'));
});
