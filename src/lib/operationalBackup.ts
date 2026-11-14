export const BACKUP_COLLECTIONS=['candidatos','distritos','lideres','votantes_rasos','vehiculos','gastos','aportes','propuestas','archivos_drive','comites_coordinaciones','equipo_campana','capas_geograficas','bases_datos','simulaciones','fuentes_estadisticas'] as const;
export type BackupCollection=typeof BACKUP_COLLECTIONS[number];
export type BackupRecord={collection:BackupCollection;id:string;data:Record<string,unknown>};
export type OperationalBackup={schemaVersion:1;kind:'astrea-operational-backup';tenantId:string;createdAt:string;records:BackupRecord[]};
const identifier=(value:unknown)=>typeof value==='string'&&value.length>0&&value.length<=200&&!/[\/\x00-\x1f]/.test(value)&&value!=='.'&&value!=='..';
function validateJson(value:unknown,depth=0):void{
 if(depth>18)throw new Error('El respaldo contiene datos demasiado anidados.');
 if(value===null||typeof value==='string'||typeof value==='boolean')return;
 if(typeof value==='number'&&Number.isFinite(value))return;
 if(Array.isArray(value)){for(const v of value)validateJson(v,depth+1);return;}
 if(typeof value==='object'&&value&&Object.getPrototypeOf(value)===Object.prototype){for(const [key,v] of Object.entries(value)){if(['__proto__','prototype','constructor'].includes(key))throw new Error('El respaldo contiene una clave reservada.');validateJson(v,depth+1);}return;}
 throw new Error('El respaldo contiene un tipo no compatible con la restauración operativa.');
}
export function validateOperationalBackup(value:unknown,tenantId:string):OperationalBackup{
 if(!value||typeof value!=='object')throw new Error('El archivo no contiene un respaldo de Astrea.');
 const b=value as OperationalBackup;
 if(b.schemaVersion!==1||b.kind!=='astrea-operational-backup'||b.tenantId!==tenantId)throw new Error('El respaldo no corresponde a esta organización o versión.');
 if(!Number.isFinite(Date.parse(b.createdAt))||!Array.isArray(b.records)||b.records.length>10000)throw new Error('La fecha o cantidad de registros no es válida.');
 const keys=new Set<string>();
 for(const row of b.records){
  if(!row||!BACKUP_COLLECTIONS.includes(row.collection)||!identifier(row.id)||!row.data||Array.isArray(row.data)||typeof row.data!=='object'||row.data.tenantId!==tenantId)throw new Error('El respaldo contiene una colección, identificador u organización no permitida.');
  if(row.data.id!==undefined&&row.data.id!==row.id)throw new Error('Un identificador del respaldo no coincide con su documento.');
  const key=row.collection+'/'+row.id;if(keys.has(key))throw new Error('El respaldo contiene identificadores repetidos.');keys.add(key);validateJson(row.data);
  if(new TextEncoder().encode(JSON.stringify(row.data)).byteLength>700000)throw new Error('Un documento del respaldo supera 700 KB.');
 }
 return b;
}
export function createOperationalBackup(tenantId:string,records:BackupRecord[],createdAt=new Date().toISOString()){
 return validateOperationalBackup({schemaVersion:1,kind:'astrea-operational-backup',tenantId,createdAt,records},tenantId);
}
/** Create-only restoration: existing documents, even different ones, are never replaced. */
export function planOperationalRestore(backup:OperationalBackup,existing:BackupRecord[]){
 const present=new Map(existing.map(r=>[r.collection+'/'+r.id,r]));
 const missing:BackupRecord[]=[],existingRecords:BackupRecord[]=[],blocked:BackupRecord[]=[];
 for(const row of backup.records){if(present.has(row.collection+'/'+row.id))existingRecords.push(row);else if(row.collection==='votantes_rasos'&&row.data.consentGiven!==true)blocked.push(row);else missing.push(row);}
 return {missing,existing:existingRecords,blocked};
}
