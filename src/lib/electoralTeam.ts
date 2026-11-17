import type {Candidate,Leader,GrassrootsVoter} from '../types';

export const electoralNumber=(value:unknown)=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=0?value:0;
export const canEditElectoralData=(role?:string)=>!!role&&['AdminGlobal','AdminTenant','Gobernador','Diputado','Alcalde','Concejal','JefePolitico','Supervisor','Operador','LiderVeredal'].includes(role);
const key=(value?:string)=>(value||'').trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es');
const unique=<T extends {id:string}>(rows:T[])=>[...new Map(rows.map(row=>[row.id,row])).values()];

/** Only explicit links count as support. A municipality alone does not establish an alliance. */
export function candidateTeamIds(candidate:Candidate,candidates:Candidate[]):Set<string>{
 const ids=new Set([candidate.id]);let changed=true;
 while(changed){changed=false;for(const row of candidates)if(row.tenantId===candidate.tenantId&&row.parentCandidateId&&ids.has(row.parentCandidateId)&&!ids.has(row.id)){ids.add(row.id);changed=true;}}
 return ids;
}
export function candidateTeam(candidate:Candidate,candidates:Candidate[],leaders:Leader[]){
 const ids=candidateTeamIds(candidate,candidates);
 return unique(leaders.filter(row=>row.tenantId===candidate.tenantId&&!!row.assignedCandidateId&&ids.has(row.assignedCandidateId)));
}
export function candidateGoal(candidate:Candidate,candidates:Candidate[],leaders:Leader[]){
 const team=candidateTeam(candidate,candidates,leaders),target=electoralNumber(candidate.voteTarget),teamTarget=team.reduce((sum,row)=>sum+electoralNumber(row.voteTarget),0);
 const ids=candidateTeamIds(candidate,candidates);
 return {team,target,configured:typeof candidate.voteTarget==='number'&&Number.isSafeInteger(candidate.voteTarget)&&candidate.voteTarget>=0,teamTarget,difference:teamTarget-target,reported:team.reduce((sum,row)=>sum+electoralNumber(row.votesCommitted),0),supporting:unique(candidates.filter(row=>row.tenantId===candidate.tenantId&&row.id!==candidate.id&&ids.has(row.id)))};
}
export function candidatePeople(candidate:Candidate,candidates:Candidate[],leaders:Leader[],voters:GrassrootsVoter[]){
 const ids=candidateTeamIds(candidate,candidates),team=new Set(candidateTeam(candidate,candidates,leaders).map(row=>row.id));
 const known=new Set(candidates.filter(row=>row.tenantId===candidate.tenantId).map(row=>row.id));
 return unique(voters.filter(row=>row.tenantId===candidate.tenantId&&(known.has(row.candidateId)?ids.has(row.candidateId):team.has(row.leaderId))));
}
export type ElectoralBaseFilters={department:string;municipality:string;candidateId:string;leaderId:string;sector:string};
export const EMPTY_ELECTORAL_FILTERS:ElectoralBaseFilters={department:'all',municipality:'all',candidateId:'all',leaderId:'all',sector:'all'};
export type ElectoralBase={tenantId:string;candidates:Candidate[];leaders:Leader[];voters:GrassrootsVoter[]};
/** Receives already-authorized rows; filters can only narrow that input. */
export function filterElectoralBase(source:ElectoralBase,filters:ElectoralBaseFilters){
 const candidates=unique(source.candidates.filter(row=>row.tenantId===source.tenantId)),leaders=unique(source.leaders.filter(row=>row.tenantId===source.tenantId)),voters=unique(source.voters.filter(row=>row.tenantId===source.tenantId));
 const candidate=candidates.find(row=>row.id===filters.candidateId),branch=candidate?candidateTeamIds(candidate,candidates):null;
 const allowedCandidate=filters.candidateId==='all'||!!candidate;
 const territory=(row:{department?:string;municipality?:string},sector?:string)=>(filters.department==='all'||key(row.department)===key(filters.department))&&(filters.municipality==='all'||key(row.municipality)===key(filters.municipality))&&(filters.sector==='all'||key(sector)===key(filters.sector));
 const selectedLeaders=leaders.filter(row=>allowedCandidate&&territory(row,row.veredaOrBarrio)&&(filters.leaderId==='all'||row.id===filters.leaderId)&&(!branch||!!row.assignedCandidateId&&branch.has(row.assignedCandidateId)));
 const leaderMap=new Map(leaders.map(row=>[row.id,row])),candidateMap=new Map(candidates.map(row=>[row.id,row]));
 const selectedVoters=voters.filter(row=>{
  const leader=leaderMap.get(row.leaderId),linked=candidateMap.get(row.candidateId);
  return allowedCandidate&&territory({...row,department:row.department||leader?.department||linked?.department},row.sector)&&(filters.leaderId==='all'||row.leaderId===filters.leaderId)&&(!branch||(linked?branch.has(linked.id):!!leader?.assignedCandidateId&&branch.has(leader.assignedCandidateId)));
 });
 const linkedIds=new Set([...selectedLeaders.flatMap(row=>row.assignedCandidateId?[row.assignedCandidateId]:[]),...selectedVoters.map(row=>row.candidateId)]);
 if(filters.leaderId==='all'&&filters.sector==='all')for(const row of candidates)if(territory(row))linkedIds.add(row.id);
 for(const id of [...linkedIds]){const visited=new Set<string>();let parent=candidateMap.get(id)?.parentCandidateId;while(parent&&!visited.has(parent)){visited.add(parent);linkedIds.add(parent);parent=candidateMap.get(parent)?.parentCandidateId;}}
 const selectedCandidates=candidates.filter(row=>allowedCandidate&&(!branch||branch.has(row.id))&&(filters.department==='all'||key(row.department)===key(filters.department))&&((filters.leaderId!=='all'||filters.sector!=='all')?linkedIds.has(row.id):filters.municipality==='all'||key(row.municipality)===key(filters.municipality)||linkedIds.has(row.id)));
 return {candidates:selectedCandidates,leaders:selectedLeaders,voters:selectedVoters};
}
