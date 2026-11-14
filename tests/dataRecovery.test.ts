import test from 'node:test';import assert from 'node:assert/strict';
import {createOperationalBackup,validateOperationalBackup,planOperationalRestore} from '../src/lib/operationalBackup';
import {inspectDataQuality,consentPatch} from '../src/lib/dataQuality';
test('restoration rejects cross-organization, privilege collections, invalid values and duplicate identifiers',()=>{
 const row={collection:'lideres',id:'a--1',data:{id:'a--1',tenantId:'a',fullName:'Ficticio'}} as const;
 const backup=createOperationalBackup('a',[row]);assert.throws(()=>validateOperationalBackup(backup,'b'));
 assert.throws(()=>createOperationalBackup('a',[{...row,collection:'usuarios'} as any]));
 assert.throws(()=>createOperationalBackup('a',[row,row]));assert.throws(()=>createOperationalBackup('a',[{...row,data:{...row.data,amount:NaN}}]));
 assert.throws(()=>createOperationalBackup('a',[{...row,id:'../other'}]));
});
test('restore round-trip retains data and never replaces existing or restores revoked consent',()=>{
 const original=[{collection:'lideres',id:'a--1',data:{tenantId:'a',fullName:'Ficticio'}},{collection:'votantes_rasos',id:'a--2',data:{tenantId:'a',consentGiven:false}}] as any;
 const roundtrip=validateOperationalBackup(JSON.parse(JSON.stringify(createOperationalBackup('a',original))),'a');
 assert.deepEqual(roundtrip.records,original);
 const plan=planOperationalRestore(roundtrip,[original[0]]);assert.equal(plan.existing.length,1);assert.equal(plan.blocked.length,1);assert.equal(plan.missing.length,0);
 assert.equal(planOperationalRestore(roundtrip,[]).missing.length,1);
});
test('quality uses document matches only within the organization, without automatic merging',()=>{
 const rows=[{id:'1',tenantId:'a',documentNumber:'1.234-567',consentGiven:true},{id:'2',tenantId:'a',documentNumber:'1234567',consentGiven:false},{id:'3',tenantId:'b',documentNumber:'1234567'}] as any;
 const result=inspectDataQuality(rows,'a');assert.equal(result.duplicates.length,1);assert.equal(result.duplicates[0].records.length,2);assert.equal(result.missingConsent,1);
 const withdrawal=consentPatch({accepted:false,channels:[],evidence:'Retiro solicitado por el titular',now:'2026-11-13T12:00:00Z'});assert.equal(withdrawal.consentGiven,false);assert.deepEqual(withdrawal.consentChannels,[]);
 assert.throws(()=>consentPatch({accepted:true,channels:[],evidence:'Autorización expresa documentada'}));
});
