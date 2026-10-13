import type { Coordinate, TerritorialRoute } from './territorialMaps';
import { distanceBetween } from './geographicImport';
import type { QueuedLocation } from './deviceStorage';
export interface AssignedRoute { id:string;tenantId:string;userId:string;employeeName:string;vehicleId:string;vehiclePlate:string;name:string;instructions:string;scheduledDate:string;route:TerritorialRoute;status:'Asignado'|'En curso'|'Pausado'|'Finalizado'|'Cancelado';createdBy:string;createdAt:string;startedAt?:string;startedAtMillis?:number;finishedAt?:string;finishedAtMillis?:number;updatedAt?:string;kind?:'automatic';deviceId?:string }
export type RouteSample=QueuedLocation;
export function routeCheckpoints(route:TerritorialRoute):Coordinate[] {
  const geometry=route.geometry;if(geometry.length<2)return route.stops;
  const total=geometry.slice(1).reduce((sum,point,index)=>sum+distanceBetween(geometry[index],point),0);
  const spacing=Math.max(200,total/98);const points:Coordinate[]=[geometry[0]];let accumulated=0;
  for(let index=1;index<geometry.length;index++){
    const a=geometry[index-1],b=geometry[index];let length=distanceBetween(a,b);let start=a;
    while(accumulated+length>=spacing){const fraction=(spacing-accumulated)/length;const point={latitude:start.latitude+(b.latitude-start.latitude)*fraction,longitude:start.longitude+(b.longitude-start.longitude)*fraction};points.push(point);start=point;length=distanceBetween(start,b);accumulated=0;}
    accumulated+=length;
  }
  if(distanceBetween(points.at(-1)!,geometry.at(-1)!)>10)points.push(geometry.at(-1)!);else points[points.length-1]=geometry.at(-1)!;
  return points;
}
function distanceToSegment(point:Coordinate,a:Coordinate,b:Coordinate):number{
  const scale=Math.cos(point.latitude*Math.PI/180);const ax=(a.longitude-point.longitude)*scale,ay=a.latitude-point.latitude,bx=(b.longitude-point.longitude)*scale,by=b.latitude-point.latitude;
  const dx=bx-ax,dy=by-ay;const denominator=dx*dx+dy*dy;const t=denominator?Math.min(1,Math.max(0,-(ax*dx+ay*dy)/denominator)):0;
  return Math.hypot(ax+t*dx,ay+t*dy)*111195;
}
export function routeProgress(route:TerritorialRoute,samples:RouteSample[]){
  const ordered=[...samples].sort((a,b)=>a.capturedAt.localeCompare(b.capturedAt));const good=ordered.filter(sample=>sample.accuracy<=100);
  const checkpoints=routeCheckpoints(route);const visits:{index:number;capturedAt:string}[]=[];let next=0;
  for(const sample of good){while(next<checkpoints.length && distanceBetween(sample,checkpoints[next])<=100){visits.push({index:next,capturedAt:sample.capturedAt});next++;}}
  const outside=good.filter(sample=>route.geometry.length>1 && !route.geometry.slice(1).some((point,index)=>distanceToSegment(sample,route.geometry[index],point)<=150));
  const gaps=ordered.slice(1).filter((sample,index)=>Date.parse(sample.capturedAt)-Date.parse(ordered[index].capturedAt)>120000).length;
  const distance=good.slice(1).reduce((sum,sample,index)=>Date.parse(sample.capturedAt)-Date.parse(good[index].capturedAt)<=120000?sum+distanceBetween(good[index],sample):sum,0);
  return {checkpoints,visits,visited:next,total:checkpoints.length,percent:checkpoints.length?Math.round(next/checkpoints.length*100):0,samples:ordered.length,poorAccuracy:ordered.length-good.length,outside:outside.length,gaps,distance,last:ordered.at(-1)};
}
