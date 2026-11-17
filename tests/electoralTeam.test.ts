import {test} from 'node:test';import assert from 'node:assert/strict';
import type {Candidate,Leader,GrassrootsVoter} from '../src/types';
import {candidateTeamIds,candidateGoal,candidatePeople,filterElectoralBase,EMPTY_ELECTORAL_FILTERS} from '../src/lib/electoralTeam';
const candidate=(id:string,extra:Partial<Candidate>={}):Candidate=>({id,tenantId:'one',fullName:id,department:'Cesar',municipality:'Astrea',electoralLevel:'Alcaldía',chamber:'Alcalde',voteTarget:1000,...extra} as Candidate);
const leader=(id:string,candidateId:string,extra:Partial<Leader>={}):Leader=>({id,tenantId:'one',fullName:id,department:'Cesar',municipality:'Astrea',veredaOrBarrio:'Centro',assignedCandidateId:candidateId,voteTarget:100,votesCommitted:40,...extra} as Leader);
const person=(id:string,leaderId:string,candidateId:string,extra:Partial<GrassrootsVoter>={}):GrassrootsVoter=>({id,tenantId:'one',fullName:id,department:'Cesar',municipality:'Astrea',sector:'Centro',leaderId,candidateId,...extra} as GrassrootsVoter);
const governor=candidate('governor',{municipality:'Valledupar',chamber:'Gobernador',electoralLevel:'Gobernación'}),mayor=candidate('mayor',{parentCandidateId:governor.id,voteTarget:600}),council=candidate('council',{parentCandidateId:mayor.id,voteTarget:300}),other=candidate('other',{municipality:'El Paso'}),outside=candidate('outside',{tenantId:'two',parentCandidateId:governor.id});
const candidates=[governor,mayor,council,other,outside],a=leader('a',governor.id,{voteTarget:200}),b=leader('b',mayor.id,{voteTarget:300}),c=leader('c',council.id,{voteTarget:250}),unassigned=leader('unassigned',''),d=leader('d',other.id,{municipality:'El Paso'}),leaders=[a,b,c,unassigned,d,leader('foreign',outside.id,{tenantId:'two'})];
test('A general target remains independent of supporting candidates and each linked leader counts once',()=>{
 const goal=candidateGoal(governor,candidates,[...leaders,b]);
 assert.equal(goal.target,1000);assert.equal(goal.teamTarget,750);assert.equal(goal.difference,-250);assert.equal(goal.reported,120);assert.deepEqual(goal.team.map(row=>row.id),['a','b','c']);assert.equal(goal.supporting.length,2);
 assert.equal(candidateGoal({...governor,voteTarget:500},candidates,leaders).difference,250);
 assert.equal(candidateGoal({...governor,voteTarget:750},candidates,leaders).difference,0);
 assert.equal(candidateGoal({...governor,voteTarget:undefined},candidates,leaders).configured,false);
 assert.equal(candidateGoal({...governor,voteTarget:0},candidates,leaders).configured,true);
 assert.equal(b.voteTarget,300);assert.equal(council.voteTarget,300);
});
test('Explicit candidate links tolerate cycles and cannot pull leaders from another tenant',()=>{
 const cyclic=[{...governor,parentCandidateId:council.id},mayor,council,outside];
 assert.deepEqual([...candidateTeamIds(cyclic[0],cyclic)],['governor','mayor','council']);assert.equal(candidateGoal(cyclic[0],cyclic,leaders).teamTarget,750);
});
test('A registered person is counted once; declared commitments are not added and an explicit different candidate wins',()=>{
 const rows=[person('one',a.id,governor.id),person('two',c.id,council.id),person('two',c.id,council.id),person('three',b.id,'missing'),person('different',a.id,other.id),person('foreign',a.id,governor.id,{tenantId:'two'})];
 assert.deepEqual(candidatePeople(governor,candidates,leaders,rows).map(row=>row.id),['one','two','three']);
});
test('Department, municipality, candidate branch, leader and sector intersect across the entire authorized dataset',()=>{
 const voters=[person('one',a.id,governor.id),person('two',c.id,council.id),person('three',d.id,other.id,{municipality:'El Paso'}),person('foreign',a.id,governor.id,{tenantId:'two'}),person('north',c.id,council.id,{sector:'Norte'})];
 const source={tenantId:'one',candidates,leaders,voters};
 const selected=filterElectoralBase(source,{...EMPTY_ELECTORAL_FILTERS,department:'César',municipality:'Astrea',candidateId:governor.id,leaderId:c.id,sector:'Centro'});
 assert.deepEqual(selected.voters.map(row=>row.id),['two']);assert.deepEqual(selected.leaders.map(row=>row.id),['c']);assert.deepEqual(selected.candidates.map(row=>row.id),['governor','mayor','council']);
 const all=filterElectoralBase(source,EMPTY_ELECTORAL_FILTERS);assert.equal(all.voters.length,4);assert.equal(all.candidates.length,4);assert.equal(all.leaders.length,5);
 assert.equal(filterElectoralBase(source,{...EMPTY_ELECTORAL_FILTERS,candidateId:'outside'}).voters.length,0);
 assert.equal(filterElectoralBase(source,{...EMPTY_ELECTORAL_FILTERS,department:'Antioquia'}).leaders.length,0);
});
test('Narrow input from a restricted role is never expanded by a filter or by a missing parent',()=>{
 const source={tenantId:'one',candidates:[council],leaders:[c],voters:[person('one',c.id,council.id)]};
 const result=filterElectoralBase(source,{...EMPTY_ELECTORAL_FILTERS,candidateId:council.id});assert.deepEqual(result.candidates,[council]);assert.deepEqual(result.leaders,[c]);
 assert.equal(candidateGoal(council,source.candidates,source.leaders).teamTarget,250);
});
