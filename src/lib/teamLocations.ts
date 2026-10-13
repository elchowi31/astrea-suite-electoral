import type {Leader,TransportVehicle,UserProfile} from '../types';
import {isTrackingAdministrator} from './trackingPermissions';
import {liveStatus,normalizeColombianPhone,type LivePosition} from './livePosition';
import {territoryPoints,validLocation,type TerritoryPoint} from './territorialMaps';
import type {AssignedRoute} from './routeTracking';

export interface TeamLocation {
  id:string; name:string; description:string; members:number; userId?:string; point?:TerritoryPoint;
  source:'gps'|'registered'|'missing'; status:string; routeId?:string; accuracy?:number;
}
const statusLabels={'en-vivo':'En movimiento','en-reposo':'En reposo',demorado:'Reporte demorado','sin-senal':'Sin señal reciente'};
/** Vínculos únicos y de la misma organización; los nombres nunca identifican una cuenta GPS. */
export function teamLocations({viewer,tenantId,leaders,vehicles,members,positions,routes,now=Date.now()}:{viewer:UserProfile|null;tenantId:string;leaders:Leader[];vehicles:TransportVehicle[];members:UserProfile[];positions:LivePosition[];routes:AssignedRoute[];now?:number}):{leaders:TeamLocation[];vehicles:TeamLocation[]}{
  if(!isTrackingAdministrator(viewer)||(viewer!.role!=='AdminGlobal'&&viewer!.tenantId!==tenantId))return {leaders:[],vehicles:[]};
  const users=[...new Map(members.filter(member=>member.tenantId===tenantId&&member.active===true&&member.accessVersion===2).map(member=>[member.uid,member])).values()];
  const allowed=new Set(users.map(member=>member.uid));
  const latest=new Map<string,LivePosition>();
  for(const position of positions.filter(row=>row.tenantId===tenantId&&allowed.has(row.userId)&&validLocation(row)&&Number.isFinite(row.capturedAtMillis)&&row.capturedAtMillis<=now+60000).sort((a,b)=>a.capturedAtMillis-b.capturedAtMillis))latest.set(position.userId,position);
  const tenantRoutes=routes.filter(route=>route.tenantId===tenantId);
  const unique=(rows:UserProfile[])=>rows.length===1?rows[0]:undefined;
  const build=(record:Leader|TransportVehicle,type:'leader'|'vehicle',member:UserProfile|undefined,count:number):TeamLocation=>{
    const leader=record as Leader,vehicle=record as TransportVehicle;
    const name=type==='leader'?leader.fullName:`${vehicle.licensePlate} · ${vehicle.driverName}`;
    const description=type==='leader'?leader.veredaOrBarrio||leader.zoneOrDistrict:vehicle.assignedZone;
    const position=member?latest.get(member.uid):undefined;
    const assigned=tenantRoutes.find(route=>route.id===position?.routeId&&route.userId===member?.uid);
    const registered=territoryPoints(type==='leader'?[leader]:[],type==='vehicle'?[vehicle]:[])[0];
    const status=position?statusLabels[liveStatus(position,now)]:registered?'Ubicación registrada':member?'Sin reporte GPS':'Sin cuenta vinculada';
    return {id:record.id,name,description,members:count,userId:member?.uid,source:position?'gps':registered?'registered':'missing',status,accuracy:position?.accuracy,routeId:assigned?.id,
      point:position?{id:`${type}-${record.id}`,recordId:record.id,type,name,subtitle:description,municipality:record.municipality||'',status,latitude:position.latitude,longitude:position.longitude,capturedAt:position.capturedAt}:registered};
  };
  return {
    leaders:leaders.filter(leader=>leader.tenantId===tenantId).map(leader=>{
      const email=leader.email?.trim().toLowerCase();
      const member=email?unique(users.filter(user=>user.email.trim().toLowerCase()===email)):undefined;
      return build(leader,'leader',member,users.filter(user=>user.assignedLeaderId===leader.id||user.uid===member?.uid).length);
    }),
    vehicles:vehicles.filter(vehicle=>vehicle.tenantId===tenantId).map(vehicle=>{
      const assignedUsers=users.filter(user=>{const position=latest.get(user.uid);return position&&tenantRoutes.some(route=>route.id===position.routeId&&route.userId===user.uid&&route.vehicleId===vehicle.id&&route.status==='En curso');});
      const phone=normalizeColombianPhone(vehicle.driverPhone);
      const member=assignedUsers.length?unique(assignedUsers):phone?unique(users.filter(user=>normalizeColombianPhone(user.phone)===phone)):undefined;
      return build(vehicle,'vehicle',member,0);
    })
  };
}
