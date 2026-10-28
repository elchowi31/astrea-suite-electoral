import {verifySavedRecord} from './saveVerification';
import { deleteField, doc, runTransaction } from 'firebase/firestore';
import { auth, db } from './firebase';
import { parseLocation } from './territorialMaps';
import {canonicalStoredValue} from './serialization';
import { RESOURCE_CATALOG } from './operations';

export type EditField = { key:string; label:string; type?:'text'|'number'|'date'|'datetime-local'|'email'|'url'|'textarea'|'list'|'boolean'; choices?:string[]; reference?:string; required?:boolean; min?:number; max?:number };
const t=(key:string,label:string,required=false):EditField=>({key,label,required});
const n=(key:string,label:string,min=0,max?:number):EditField=>({key,label,type:'number',min,max,required:['amount','voteTarget','votesCommitted','capacity','budgetAllocated'].includes(key)});
const s=(key:string,label:string,choices:string[]):EditField=>({key,label,choices});
const long=(key:string,label:string):EditField=>({key,label,type:'textarea'});
const ref=(key:string,label:string,reference:string):EditField=>({key,label,reference});
const time=(key:string,label:string):EditField=>({key,label,type:'datetime-local',required:true});
const territory=[t('department','Departamento'),t('municipality','Municipio'),t('veredaOrBarrio','Vereda o barrio')];
const geo=[{key:'latitude',label:'Latitud',type:'number',min:-90,max:90},{key:'longitude',label:'Longitud',type:'number',min:-180,max:180}] satisfies EditField[];
const rubros=['Alimentación y Refrigerios','Transporte y Movilización','Combustible','Publicidad y Propaganda','Sedes y Logística','Honorarios y Testigos Electorales','Eventos, Mítines y Tarimas','Material Impreso y Camisetas','Tecnología y Asesoría Jurídica','Caja Menor e Imprevistos'];
export const EDIT_FIELDS:Record<string,EditField[]>={
  jornadas_operativas:[t('name','Nombre de jornada',true),s('type','Tipo',['Evento','Jornada electoral','Reunión','Operación de campo']),...territory.slice(0,2),t('destination','Destino',true),time('startAt','Inicio'),time('endAt','Final'),n('expectedAttendance','Asistentes previstos'),s('status','Estado',['Planificado','En curso','Finalizado','Cancelado']),long('notes','Observaciones')],
  solicitudes_recursos:[t('description','Descripción',true),ref('eventId','Jornada','jornadas_operativas'),ref('leaderId','Líder','lideres'),ref('candidateId','Aspirante','candidatos'),t('municipality','Municipio'),s('resource','Recurso',RESOURCE_CATALOG.map(row=>row.name)),s('direction','Sentido',['Ida','Regreso']),n('quantity','Cantidad',1,1000000),n('unitCost','Costo unitario (COP)'),s('status','Estado',['Pendiente','Aprobada','Entregada','Rechazada']),long('notes','Observaciones')],
  viajes_operativos:[ref('eventId','Jornada','jornadas_operativas'),ref('vehicleId','Vehículo','vehiculos'),t('origin','Origen',true),t('destination','Destino',true),time('startAt','Inicio'),time('endAt','Final'),s('status','Estado',['Programado','En curso','Finalizado','Cancelado']),long('notes','Observaciones')],
  pasajeros_viaje:[n('passengers','Pasajeros previstos',0,1000000),n('arrived','Llegadas confirmadas',0,1000000)],
  reportes_jornada:[ref('eventId','Jornada','jornadas_operativas'),ref('leaderId','Líder','lideres'),n('reportedVoters','Reporte acumulado',0,1000000),long('notes','Observaciones')],
  gastos:[t('description','Concepto',true),n('amount','Valor total (COP)'),s('component','Componente',['Alimentación y Refrigerios','Transporte y Movilización','Combustible','Propaganda y Medios','Publicidad y Propaganda','Eventos y Mítines','Sedes y Logística','Operación de Líderes','Honorarios y Testigos Electorales','Tecnología y Asesoría','Caja Menor e Imprevistos']),s('rubro','Rubro',rubros),s('phase','Fase',['Precampaña','Campaña Oficial','Día D (Electoral)','Post-Electoral']),{key:'date',label:'Fecha',type:'date',required:true},s('status','Estado',['Pagado','Pendiente','Aprobado']),n('unitCost','Costo unitario'),n('quantity','Cantidad'),t('unitMeasure','Unidad de medida'),t('supplier','Proveedor'),t('invoiceNumber','Factura o comprobante'),...territory,ref('fundedByDonorId','Aporte que financia el gasto','aportes'),ref('responsibleLeaderId','Líder responsable','lideres'),ref('candidateId','Aspirante responsable','candidatos'),ref('eventId','Jornada o evento','jornadas_operativas'),t('vehiclePlate','Placa del vehículo'),long('notes','Observaciones')],
  aportes:[t('donorName','Nombre del aportante',true),t('donorDocument','Documento del aportante',true),t('donorPhone','Teléfono'),{key:'donorEmail',label:'Correo',type:'email'},s('donorType','Tipo de aportante',['Persona Natural','Recursos Propios Candidato','Partido o Movimiento Político','Crédito Financiero CNE','Organización / Simpatizantes']),s('contributionType','Tipo de aporte',['Efectivo / Transferencia Bancaria','Especie (Alimentación / Refrigerios)','Especie (Transporte y Vehículos)','Especie (Combustible / Vales Gasolina)','Especie (Publicidad / Pauta Radial / Impresión)','Especie (Sedes / Inmuebles)','Otro Aporte en Especie']),s('rubroDestino','Rubro de destino',rubros),n('amount','Valor (COP)'),{key:'date',label:'Fecha',type:'date',required:true},t('supportReceiptNumber','Número de soporte'),s('cneStatus','Estado del soporte',['Verificado CNE','Reportado Cuentas Claras','En Validación','Pendiente Soporte']),...territory.slice(0,2),long('notes','Observaciones')],
  lideres:[t('fullName','Nombre completo',true),t('zoneOrDistrict','Zona o distrito'),t('commune','Comuna'),...territory,ref('assignedCandidateId','Candidatura asignada','candidatos'),t('parentPoliticalChief','Jefe político'),n('voteTarget','Meta de votos'),n('votesCommitted','Votos comprometidos'),n('activistsCount','Activistas'),t('phone','Teléfono'),{key:'email',label:'Correo',type:'email'},s('status','Estado',['Activo','Destacado','En Riesgo']),n('budgetAllocated','Presupuesto asignado (COP)'),n('refrigeriosNeeded','Refrigerios necesarios'),n('fuelGallonsNeeded','Galones necesarios'),n('vehiclesNeeded','Vehículos necesarios'),n('witnessesCount','Testigos'),{key:'photoUrl',label:'Fotografía (URL)',type:'url'},...geo],
  vehiculos:[s('vehicleType','Tipo de vehículo',['Bus Gran Capacidad (45 pas)','Microbús / Van (19 pas)','Camioneta 4x4 Rural (5 pas)','Motocarro / Tricimóvil (3 pas)','Minivan (15 pas)','Automóvil Coordinación','Camioneta Propaganda','Chiva Veredal','Moto Enlace']),t('licensePlate','Placa',true),t('driverName','Conductor',true),t('driverPhone','Teléfono del conductor'),t('assignedZone','Zona asignada'),...territory.slice(0,2),n('capacity','Capacidad'),n('dailyCost','Costo diario (COP)'),n('fuelBudget','Presupuesto de combustible (COP)'),s('status','Estado',['Operativo - Día D','En Mantenimiento','Reservado']),...geo],
  candidatos:[t('fullName','Nombre completo',true),t('district','Circunscripción'),s('chamber','Cargo',['Gobernador','Alcalde','Diputado / Asamblea','Concejal','Senado','Cámara de Diputados']),s('electoralLevel','Nivel electoral',['Gobernación','Alcaldía','Asamblea / Diputación','Concejo Municipal','Cámara de Representantes','Senado de la República']),...territory,ref('parentCandidateId','Candidatura superior','candidatos'),t('party','Partido'),t('coalition','Coalición'),s('status','Estado',['Inscrito','En Campaña','Elección Previa','Electo']),long('bio','Biografía'),{key:'keyProposals',label:'Propuestas clave (una por línea)',type:'list'},n('pollingPercentage','Porcentaje de intención',0,100),n('voteTarget','Meta de votos'),n('votesCommitted','Votos comprometidos'),{key:'photoUrl',label:'Fotografía (URL)',type:'url'}],
  propuestas:[t('title','Título',true),t('category','Categoría'),long('summary','Resumen'),long('fullText','Texto completo'),s('status','Estado',['Borrador','En Revisión','Aprobado','Presentado']),t('author','Autor')],
  distritos:[t('name','Nombre',true),t('region','Región'),n('voterCensus','Censo electoral'),n('seatsAvailable','Curules disponibles'),{key:'keyIssues',label:'Problemas principales (uno por línea)',type:'list'},n('projectedSupport','Apoyo proyectado',0,100)],
  archivos_drive:[t('name','Nombre',true),t('mimeType','Tipo de documento'),{key:'webViewLink',label:'Enlace al documento',type:'url'},t('category','Categoría'),long('summary','Resumen'),t('size','Tamaño'),t('driveFileId','Identificador del archivo de Drive')],
  votantes_rasos:[t('fullName','Nombre completo',true),t('documentNumber','Documento',true),t('phone','Teléfono'),...territory.slice(0,2),t('sector','Sector o barrio'),t('pollingStation','Puesto de votación'),n('tableNumber','Mesa'),ref('leaderId','Líder responsable','lideres'),ref('candidateId','Candidatura asignada','candidatos'),n('supportLevel','Nivel de apoyo',1,5),{key:'requiresTransport',label:'Requiere transporte',type:'boolean'},{key:'verified',label:'Datos verificados',type:'boolean'},long('notes','Observaciones'),s('dataSource','Origen de los datos',['Directo','Formulario','Importación autorizada'])],
  usuarios:[t('displayName','Nombre completo',true),t('prefix','Tratamiento'),t('phone','Teléfono'),{key:'avatarUrl',label:'Fotografía (URL)',type:'url'},...territory.slice(0,2),t('party','Partido'),ref('assignedCandidateId','Candidatura asignada','candidatos'),ref('assignedLeaderId','Líder asignado','lideres'),s('electoralLevel','Nivel electoral',['Gobernación','Alcaldía','Asamblea / Diputación','Concejo Municipal','Cámara de Representantes','Senado de la República'])],
  organizaciones:[t('name','Nombre',true),{key:'logoUrl',label:'Logo (URL)',type:'url'},t('primaryColor','Color principal'),t('secondaryColor','Color secundario'),{key:'campaignDate',label:'Fecha de campaña',type:'date'},n('budgetCap','Tope de presupuesto (COP)')],
  comites_coordinaciones:[t('title','Nombre de coordinación',true),t('coordinatorName','Coordinador'),t('coordinatorRole','Cargo'),t('coordinatorPhone','Teléfono'),{key:'coordinatorEmail',label:'Correo',type:'email'},t('color','Color'),t('iconName','Icono'),long('summary','Resumen')],
  comites:[t('name','Nombre del comité',true),t('leadPerson','Responsable'),{key:'responsibilities',label:'Responsabilidades (una por línea)',type:'list'},s('status','Estado',['Activo','En Ejecución','Completado','Planificación']),n('membersCount','Número de integrantes')],
  tareas:[t('title','Título de la tarea',true),long('description','Descripción'),t('assignedTo','Responsable'),{key:'dueDate',label:'Fecha límite',type:'date'},s('priority','Prioridad',['Alta','Media','Baja']),{key:'completed',label:'Tarea completada',type:'boolean'}],
};
export function validateEditablePatch(collection:string,patch:Record<string,unknown>) {
  const fields=EDIT_FIELDS[collection]||[];
  const allowed=new Set([...fields.map(field=>field.key),'leaderName','candidateName','locationSource','locationCapturedAt']);
  if(Object.keys(patch).some(key=>!allowed.has(key)))throw new Error('La edición contiene un campo protegido.');
  for(const field of fields){if(!(field.key in patch))continue;const value=patch[field.key];
    if(field.required&&(value==null||!String(value).trim()))throw new Error(`Complete ${field.label}.`);
    if(value==null)continue;
    if(field.type==='number'&&(typeof value!=='number'||!Number.isFinite(value)||field.min!==undefined&&value<field.min||field.max!==undefined&&value>field.max))throw new Error(`Revise ${field.label}.`);
    if(field.type==='boolean'&&typeof value!=='boolean')throw new Error(`Revise ${field.label}.`);
    if(field.type==='list'&&(!Array.isArray(value)||value.some(item=>typeof item!=='string')))throw new Error(`Revise ${field.label}.`);
    if(field.choices&&!field.choices.includes(String(value)))throw new Error(`Revise ${field.label}.`);
    if(['date','datetime-local'].includes(field.type)&&!Number.isFinite(Date.parse(String(value))))throw new Error(`Revise ${field.label}.`);
  }
}
export function editableValue(field:EditField,value:unknown):string|boolean { if(field.type==='datetime-local'){const date=new Date(String(value));return Number.isFinite(date.getTime())?new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16):'';} if(field.type==='boolean')return value===true; if(field.type==='list')return Array.isArray(value)?value.join('\n'):''; if(field.type==='date')return typeof value==='string'?value.slice(0,10):''; return value===null || value===undefined ? '' : String(value); }
export function editPatch(fields:EditField[],original:Record<string,unknown>,values:Record<string,string|boolean>):Record<string,unknown> {
  const patch:Record<string,unknown>={};
  for(const field of fields){const raw=values[field.key] ?? editableValue(field,original[field.key]); if(raw===editableValue(field,original[field.key]))continue;
    if(field.required && !String(raw).trim())throw new Error(`Complete ${field.label}.`);
    let value:unknown=raw;
    if(field.type==='number'){ if(raw===''){value=null;}else{value=Number(raw);if(!Number.isFinite(value)||field.min!==undefined&&Number(value)<field.min||field.max!==undefined&&Number(value)>field.max)throw new Error(`${field.label}: valor fuera del rango permitido.`);} }
    else if(field.type==='datetime-local'){const date=new Date(String(raw));if(!Number.isFinite(date.getTime()))throw new Error('Revise la fecha y hora.');value=date.toISOString();} else if(field.type==='list')value=String(raw).split('\n').map(item=>item.trim()).filter(Boolean);
    else if(field.type!=='boolean')value=String(raw).trim() || null;
    patch[field.key]=value;
  }
  if('latitude' in patch || 'longitude' in patch) { const point=parseLocation(String(('latitude' in patch?patch.latitude:original.latitude)??''),String(('longitude' in patch?patch.longitude:original.longitude)??'')); patch.latitude=point?.latitude ?? null;patch.longitude=point?.longitude ?? null;patch.locationSource=point?'Manual':null;patch.locationCapturedAt=point?new Date().toISOString():null; }
  return patch;
}
export async function updateOperationalRecord(collection:string,id:string,tenantId:string,patch:Record<string,unknown>,original?:Record<string,unknown>):Promise<void>{
  validateEditablePatch(collection,patch);
  const actor=auth.currentUser;if(!actor)throw new Error('Inicie sesión antes de guardar.');
  if(id.startsWith('demo-'))throw new Error('Los registros de demostración son de solo lectura.');
  if(Object.keys(patch).some(key=>['id','uid','tenantId','createdBy','createdAt','registeredAt','consentGiven','consentAt','accessVersion','email'].includes(key) && !(key==='email' && collection==='lideres')))throw new Error('No se pueden cambiar los identificadores ni los datos de autorización.');
  if(!Object.keys(patch).length)return;
  const auditId=crypto.randomUUID();
  await runTransaction(db,async transaction=>{const reference=doc(db,collection,id);const snapshot=await transaction.get(reference);const data=snapshot.data();
    if(!data || data.tenantId!==tenantId)throw new Error('El registro no pertenece a esta organización.');
    if(original)for(const key of Object.keys(patch)){if(['locationSource','locationCapturedAt'].includes(key))continue;if(canonicalStoredValue(data[key])!==canonicalStoredValue(original[key]))throw new Error('Otra persona cambió este campo. Cierre y vuelva a abrir la edición para revisar el dato actualizado.');}
    for(const field of EDIT_FIELDS[collection]||[])if(field.reference&&patch[field.key]){const linked=(await transaction.get(doc(db,field.reference,String(patch[field.key])))).data();if(linked?.tenantId!==tenantId)throw new Error(`Seleccione un registro de esta organización en ${field.label}.`);}
    transaction.update(reference,{...Object.fromEntries(Object.entries(patch).map(([key,value])=>[key,value===null?deleteField():value])),updatedAt:new Date().toISOString(),updatedBy:actor.uid});
    transaction.set(doc(db,'auditoria',auditId),{id:auditId,tenantId,actorId:actor.uid,entity:collection,entityId:id,action:'edit',fields:Object.keys(patch),createdAt:new Date().toISOString()});
  });
  await verifySavedRecord(doc(db,collection,id),Object.fromEntries(Object.entries(patch).filter(([,v])=>v!==null)),Object.keys(patch).filter(key=>patch[key]===null));
}
export async function updateCommitteeRecord(tenantId:string,coordinationId:string,committeeId:string,taskId:string|undefined,patch:Record<string,unknown>,original:Record<string,unknown>):Promise<void>{
  validateEditablePatch(taskId?'tareas':'comites',patch);
  const actor=auth.currentUser;if(!actor)throw new Error('Inicie sesión antes de guardar.');if(coordinationId.startsWith('demo-'))throw new Error('Los datos de demostración son de solo lectura.');
  const auditId=crypto.randomUUID();const saved=await runTransaction(db,async transaction=>{
    const reference=doc(db,'comites_coordinaciones',coordinationId);const data=(await transaction.get(reference)).data();if(!data||data.tenantId!==tenantId)throw new Error('No se encontró esta coordinación.');
    let found=false;const committees=data.committees.map((committee:any)=>{if(committee.id!==committeeId)return committee;const current=taskId?committee.tasks?.find((task:any)=>task.id===taskId):committee;if(!current)throw new Error('El registro ya no existe.');
      for(const key of Object.keys(patch))if(canonicalStoredValue(current[key])!==canonicalStoredValue(original[key]))throw new Error('Otra persona modificó este campo. Vuelva a abrir la edición.');found=true;
      const apply=(row:any)=>{const next={...row};for(const [key,value]of Object.entries(patch))value===null?delete next[key]:next[key]=value;return next;};
      if(!taskId)return apply(committee);const tasks=committee.tasks.map((task:any)=>task.id===taskId?apply(task):task);return {...committee,tasks,tasksCount:tasks.length,completedTasksCount:tasks.filter((task:any)=>task.completed).length};
    });if(!found)throw new Error('No se encontró el comité.');transaction.update(reference,{committees,updatedBy:actor.uid,updatedAt:new Date().toISOString()});transaction.set(doc(db,'auditoria',auditId),{id:auditId,tenantId,actorId:actor.uid,entity:'comites_coordinaciones',entityId:coordinationId,action:'edit',fields:Object.keys(patch),createdAt:new Date().toISOString()});
    return {committees};
  });
  await verifySavedRecord(doc(db,'comites_coordinaciones',coordinationId),saved);
}
