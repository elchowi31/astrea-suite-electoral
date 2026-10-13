import {test} from 'node:test';
import assert from 'node:assert/strict';
import {keepViewedTenant,type ViewerScope} from '../src/lib/tenantSelection';
const global:ViewerScope={uid:'admin',role:'AdminGlobal',tenantId:'own'};

test('A refreshed global profile preserves the team whose route detail is open',()=>{
  assert.equal(keepViewedTenant(global,{...global}),true);
});
test('Switching accounts must restore the new account scope',()=>{
  assert.equal(keepViewedTenant(global,{...global,uid:'other'}),false);
});
test('A role downgrade cannot retain another team selected by a global administrator',()=>{
  assert.equal(keepViewedTenant(global,{...global,role:'AdminTenant'}),false);
  assert.equal(keepViewedTenant({...global,role:'Consulta'},{...global,role:'Consulta'}),false);
});
test('A change in the account organization resets the viewed team',()=>{
  assert.equal(keepViewedTenant(global,{...global,tenantId:'new-own'}),false);
});
test('A new login or logout cannot inherit the previous team selection',()=>{
  assert.equal(keepViewedTenant(null,global),false);
  assert.equal(keepViewedTenant(global,null),false);
});
