import type {UserProfile,UserRole} from '../types';
import {getRoleHierarchyLevel,getTerritorialScope} from './permissions';
import {isTrackingAdministrator} from './trackingPermissions';
import {MODULE_LABELS,type ActiveTab} from './moduleNavigation';

export type Workspace={id:string;label:string;shortLabel:string;tabs:ActiveTab[];secondary?:boolean};
export const WORKSPACES:Workspace[]=[
 {id:'home',label:'Inicio',shortLabel:'Inicio',tabs:['dashboard']},
 {id:'people',label:'Personas y equipo',shortLabel:'Personas',tabs:['hierarchy_pyramid','leaders','campaign_structure']},
 {id:'territory',label:'Territorio y campo',shortLabel:'Territorio',tabs:['map','routes','districts']},
 {id:'operations',label:'Operación y eventos',shortLabel:'Operación',tabs:['resources','passengers','transport','witnesses']},
 {id:'finance',label:'Finanzas y control',shortLabel:'Finanzas',tabs:['finances','costs_report']},
 {id:'analysis',label:'Análisis y escenarios',shortLabel:'Análisis',tabs:['simulator','zone_projections','ai']},
 {id:'documents',label:'Documentos y programa',shortLabel:'Documentos',tabs:['drive','proposals','workspace']},
 {id:'settings',label:'Administración',shortLabel:'Ajustes',tabs:['device','data_quality','data_imports','candidates','users','tenants'],secondary:true},
 {id:'extensions',label:'Otros proyectos',shortLabel:'Otros proyectos',tabs:['rewards','reward_draws'],secondary:true},
];
const minimum:Partial<Record<ActiveTab,number>>={witnesses:20,data_quality:85,campaign_structure:10,hierarchy_pyramid:10,leaders:10,map:10,transport:10,rewards:10,data_imports:10,resources:10,passengers:10,users:35,finances:10,costs_report:10,candidates:10,districts:40,proposals:10,workspace:50,drive:10,zone_projections:40,simulator:10,ai:50};
export function canOpenModule(tab:ActiveTab,user:UserProfile|null,role:UserRole=user?.role||'Consulta'){
 if(tab==='routes')return isTrackingAdministrator(user);
 if(tab==='tenants'||tab==='reward_draws')return getTerritorialScope(user,role).isGlobalAdmin;
 return getRoleHierarchyLevel(role)>=(minimum[tab]||0);
}
export function availableWorkspaces(user:UserProfile|null,role:UserRole=user?.role||'Consulta'){
 return WORKSPACES.map(w=>({...w,tabs:w.tabs.filter(tab=>canOpenModule(tab,user,role))})).filter(w=>w.tabs.length>0);
}
export const workspaceFor=(tab:ActiveTab)=>WORKSPACES.find(w=>w.tabs.includes(tab));
export const workspaceTabLabel=(tab:ActiveTab)=>MODULE_LABELS[tab];
