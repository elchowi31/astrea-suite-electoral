import type {Leader, UserProfile} from '../types';
import type {TeamLocation} from './teamLocations';
import type {LivePosition} from './livePosition';
import {liveStatus} from './livePosition';
import {isTrackingAdministrator} from './trackingPermissions';
import {validLocation} from './territorialMaps';

export type MapTeam = TeamLocation & {kind:'leader'|'vehicle'|'member'; candidateId:string; leaderId:string};
/** Administrative assignments only. A leader's location is never attributed to their members. */
export function mapTeams({viewer,tenantId,leaders,members,positions,teams,now=Date.now()}:{viewer:UserProfile;tenantId:string;leaders:Leader[];members:UserProfile[];positions:LivePosition[];teams:{leaders:TeamLocation[];vehicles:TeamLocation[]};now?:number}):MapTeam[]{
  if(!isTrackingAdministrator(viewer)||(viewer.role!=='AdminGlobal'&&viewer.tenantId!==tenantId))return [];
  const users=new Map(members.filter(user=>user.tenantId===tenantId&&user.active===true&&user.accessVersion===2).map(user=>[user.uid,user]));
  const leaderMap=new Map(leaders.filter(row=>row.tenantId===tenantId).map(row=>[row.id,row]));
  const association=(user?:UserProfile,leaderId='')=>{
    const linked=leaderMap.get(leaderId||user?.assignedLeaderId||'');
    return {leaderId:linked?.id||'',candidateId:linked?.assignedCandidateId||user?.assignedCandidateId||''};
  };
  const rows:MapTeam[]=[...teams.leaders.filter(row=>leaderMap.has(row.id)).map(row=>({...row,kind:'leader' as const,...association(users.get(row.userId||''),row.id)})),
    ...teams.vehicles.map(row=>({...row,kind:'vehicle' as const,...association(users.get(row.userId||''))}))];
  const represented=new Set(rows.filter(row=>row.kind==='leader').map(row=>row.userId));
  const latest=new Map<string,LivePosition>();
  for(const position of positions.filter(row=>row.tenantId===tenantId&&users.has(row.userId)&&validLocation(row)&&Number.isFinite(row.capturedAtMillis)&&row.capturedAtMillis<=now+60000).sort((a,b)=>a.capturedAtMillis-b.capturedAtMillis))latest.set(position.userId,position);
  for(const user of users.values()){
    if(represented.has(user.uid))continue;
    const position=latest.get(user.uid),status=position?({'en-vivo':'En movimiento','en-reposo':'En reposo',demorado:'Reporte demorado','sin-senal':'Sin señal reciente'}[liveStatus(position,now)]):'Sin reporte GPS';
    rows.push({id:user.uid,userId:user.uid,name:user.displayName||user.email,description:user.role,members:1,kind:'member',...association(user),source:position?'gps':'missing',status,accuracy:position?.accuracy,
      point:position?{id:`member-${user.uid}`,recordId:user.uid,type:'member',name:user.displayName||user.email,subtitle:user.role,municipality:user.municipality||'',status,latitude:position.latitude,longitude:position.longitude,capturedAt:position.capturedAt}:undefined});
  }
  return rows;
}
export function matchesMapTeam(row:MapTeam,candidate:string,leader:string,source:string){
  return (candidate==='all'||(candidate==='unassigned'?!row.candidateId:row.candidateId===candidate))
    &&(leader==='all'||row.leaderId===leader)
    &&(source==='all'||row.source===source);
}
