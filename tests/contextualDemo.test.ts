import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildDemoBundle} from '../src/data/demoSeed';
import {demoMatchesProfile,personalDemoId} from '../src/data/contextualDemo';
import type {UserProfile,UserRole} from '../src/types';
const profile=(role:UserRole,patch:Partial<UserProfile>={}):UserProfile=>({uid:'user-a',tenantId:'team-a',role,email:'test@demo.invalid',displayName:'Test',active:true,accessVersion:2,createdAt:'2026-10-10',department:'Cesar',municipality:'Astrea',...patch});

test('Every role loads a personal synthetic bundle without granting admin or GPS access',()=>{
  for(const role of ['AdminGlobal','AdminTenant','Gobernador','Diputado','Alcalde','Concejal','JefePolitico','LiderVeredal','Supervisor','Operador','Consulta','Invitado'] as UserRole[]){
    const user=profile(role);const bundle=buildDemoBundle('team-a',user);
    assert.equal(bundle.ownerUid,user.uid);assert.equal(bundle.context?.role,role);assert.equal(bundle.id,personalDemoId('team-a',user.uid));
    assert.equal(bundle.isSynthetic,true);assert.equal(bundle.version,3);assert.ok(demoMatchesProfile(bundle,user,'team-a'));
    assert.equal(user.role,role);assert.ok(bundle.voters.length>0);assert.ok(bundle.candidates.length>0);
    for(const item of [...bundle.candidates,...bundle.leaders,...bundle.vehicles,...bundle.expenses,...bundle.voters]){
      assert.equal(item.tenantId,'team-a');assert.equal(item.department,'Cesar');assert.ok(item.id.startsWith('demo-'));
      assert.equal('latitude' in item,false);assert.equal('longitude' in item,false);
      if(!['AdminGlobal','AdminTenant','Gobernador','Diputado'].includes(role))assert.equal(item.municipality,'Astrea');
    }
    for(const voter of bundle.voters){assert.ok(bundle.leaders.some(item=>item.id===voter.leaderId));assert.ok(bundle.candidates.some(item=>item.id===voter.candidateId));assert.equal(voter.consentGiven,false);}
  }
});
test('Aspirant roles choose the correct office and hierarchy in their department or municipality',()=>{
  for(const [role,level] of [['Gobernador','Gobernación'],['Diputado','Asamblea / Diputación'],['Alcalde','Alcaldía'],['Concejal','Concejo Municipal']] as const){
    const bundle=buildDemoBundle('team-a',profile(role));assert.equal(bundle.candidates[0].electoralLevel,level);
    if(role==='Gobernador'||role==='Diputado'){assert.ok(bundle.districts.length>10);assert.ok(bundle.leaders.some(item=>item.municipality==='Valledupar'));}
    if(role==='Diputado')assert.ok(bundle.candidates.every(item=>item.electoralLevel!=='Gobernación'));
    if(role==='Concejal')assert.ok(bundle.candidates.every(item=>item.electoralLevel==='Concejo Municipal'));
    if(role==='Alcalde')assert.deepEqual(new Set(bundle.candidates.map(item=>item.electoralLevel)),new Set(['Alcaldía','Concejo Municipal']));
  }
});
test('Other departments and uncatalogued territories never receive default Cesar towns or coordinates',()=>{
  for(const [department,municipality] of [['Antioquia','Medellín'],['Santander','Bucaramanga'],['Boyacá','Tunja']]){
    const user=profile('Alcalde',{department,municipality});const bundle=buildDemoBundle('team-a',user);
    for(const item of [...bundle.candidates,...bundle.leaders,...bundle.vehicles,...bundle.expenses,...bundle.voters]){assert.equal(item.department,department);assert.equal(item.municipality,municipality);}
    assert.equal(bundle.districts[0].name,municipality);
  }
  assert.throws(()=>buildDemoBundle('team-a',profile('Alcalde',{department:'Cesar',municipality:'Medellín'})),/no pertenece/);
  assert.throws(()=>buildDemoBundle('team-a',profile('Alcalde',{department:''})),/departamento y municipio/);
});
test('Changing role, territory or account makes the old demo unavailable; team members have independent copies',()=>{
  const user=profile('Concejal');const bundle=buildDemoBundle('team-a',user);
  for(const patch of [{role:'Gobernador' as const},{municipality:'Valledupar'},{department:'Magdalena'},{uid:'user-b'}])assert.equal(demoMatchesProfile(bundle,{...user,...patch},'team-a'),false);
  assert.equal(demoMatchesProfile(bundle,user,'team-b'),false);
  assert.notEqual(buildDemoBundle('team-a',profile('LiderVeredal',{uid:'user-b'})).id,bundle.id);
  assert.throws(()=>buildDemoBundle('team-b',user),/organización de su cuenta/);
});
