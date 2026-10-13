import type {TransportVehicle,UserProfile} from '../types';
import type {TerritorialRoute} from './territorialMaps';
import {validLocation} from './territorialMaps';
import {isTrackingAdministrator} from './trackingPermissions';
export interface ElectionTransportRoute {
  id:string;tenantId:string;vehicleId:string;vehiclePlate:string;electionDate:string;departureTime:string;
  route:TerritorialRoute;notes:string;createdBy:string;createdAt:string;
}
/** Proyección explícita del plan de transporte; nunca contiene posiciones ni datos del empleado. */
export function electionTransportRoute(vehicle:TransportVehicle,actor:UserProfile,id:string,date:string,time:string,notes:string):ElectionTransportRoute {
  if(!isTrackingAdministrator(actor)||(actor.role!=='AdminGlobal'&&actor.tenantId!==vehicle.tenantId))throw new Error('Solo un administrador de la organización puede publicar transporte.');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(`${date}T00:00:00Z`))||new Date(`${date}T00:00:00Z`).toISOString().slice(0,10)!==date)throw new Error('Seleccione la fecha electoral válida.');
  if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))throw new Error('Seleccione la hora de salida.');
  const plan=vehicle.plannedRoute;
  if(!plan||plan.geometry.length<2||plan.stops.length<2||!plan.geometry.every(validLocation)||!plan.stops.every(validLocation))throw new Error('El vehículo necesita una ruta planificada válida.');
  if(notes.trim().length>1000)throw new Error('Las indicaciones no pueden superar 1000 caracteres.');
  return {id,tenantId:vehicle.tenantId,vehicleId:vehicle.id,vehiclePlate:vehicle.licensePlate,electionDate:date,departureTime:time,notes:notes.trim(),createdBy:actor.uid,createdAt:new Date().toISOString(),
    route:{name:plan.name,geometry:plan.geometry.map(({latitude,longitude})=>({latitude,longitude})),stops:plan.stops.map(({name,latitude,longitude})=>({name,latitude,longitude})),distanceMeters:plan.distanceMeters,durationSeconds:plan.durationSeconds,provider:plan.provider,calculatedAt:plan.calculatedAt}};
}
