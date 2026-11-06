import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mapTeams,matchesMapTeam} from '../src/lib/mapTeams';
import {teamLocations} from '../src/lib/teamLocations';
import type {UserProfile,Leader} from '../src/types';
import type {LivePosition} from '../src/lib/livePosition';
const now=1_000_000;
const viewer={uid:'admin',role:'AdminGlobal',tenantId:'a',active:true,accessVersion:2} as UserProfile;
const leader={id:'l1',tenantId:'a',fullName:'Líder prueba',email:'leader@example.test',assignedCandidateId:'c1',latitude:9.5,longitude:-73.9} as Leader;
const members=[{uid:'u1',tenantId:'a',email:'leader@example.test',displayName:'Líder prueba',role:'LiderVeredal',active:true,accessVersion:2},
  {uid:'u2',tenantId:'a',email:'worker@example.test',displayName:'Integrante prueba',assignedLeaderId:'l1',role:'Operador',active:true,accessVersion:2},
  {uid:'u3',tenantId:'a',email:'direct@example.test',displayName:'Equipo directo',assignedCandidateId:'c2',role:'Supervisor',active:true,accessVersion:2}] as UserProfile[];
const positions=[{tenantId:'a',userId:'u2',latitude:9.6,longitude:-73.8,capturedAtMillis:now-1000,capturedAt:new Date(now-1000).toISOString()}] as LivePosition[];
const input={viewer,tenantId:'a',leaders:[leader],members,positions,now};
const teams=teamLocations({...input,vehicles:[],routes:[]});
test('Each member keeps their own position and candidate/team assignments; missing GPS is not borrowed',()=>{
  const rows=mapTeams({...input,teams});assert.equal(rows.length,3);
  const worker=rows.find(r=>r.userId==='u2')!;assert.equal(worker.point?.latitude,9.6);assert.equal(worker.candidateId,'c1');assert.equal(worker.leaderId,'l1');
  const direct=rows.find(r=>r.userId==='u3')!;assert.equal(direct.candidateId,'c2');assert.equal(direct.source,'missing');assert.equal(direct.point,undefined);
  assert.equal(rows.filter(r=>r.userId==='u1').length,1);
  assert.equal(rows.filter(r=>matchesMapTeam(r,'c1','l1','gps')).length,1);
  assert.equal(rows.filter(r=>matchesMapTeam(r,'c2','all','missing')).length,1);
  assert.equal(rows.filter(r=>matchesMapTeam(r,'unassigned','all','all')).length,0);
});
test('Nonadministrators and foreign tenant administrators cannot see team positions',()=>{
  for(const profile of [{...viewer,role:'Alcalde'},{...viewer,role:'AdminTenant',tenantId:'other'},{...viewer,role:'AdminTenant',active:false}] as UserProfile[])assert.deepEqual(mapTeams({...input,viewer:profile,teams}),[]);
});
test('Foreign/inactive accounts and invalid or future positions never become member map pins',()=>{
  const result=mapTeams({...input,teams:{leaders:[],vehicles:[]},members:[...members,{...members[1],uid:'foreign',tenantId:'other'},{...members[1],uid:'inactive',active:false}],positions:[{...positions[0],latitude:999},{...positions[0],userId:'u3',capturedAtMillis:now+120000}]});
  assert.equal(result.length,3);assert.equal(result.filter(r=>r.point).length,0);
});
