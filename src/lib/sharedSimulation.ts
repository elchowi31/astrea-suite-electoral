import { collection, doc, getDocs, onSnapshot, query, where, writeBatch } from 'firebase/firestore';
import { auth, db } from './firebase';
import { validateSnapshot, type SavedScenario } from './simulationScenarios';
import { validateRows, type StatisticalRow } from './statisticalData';
import { omitUndefined } from './serialization';

interface DataChunk { tenantId: string; datasetId: string; index: number; total: number; rows: StatisticalRow[]; updatedAt?: string }
const sourceKey=(row:StatisticalRow)=>[row.source,row.url,row.referenceDate].join('|');
const recordKey=(row:StatisticalRow)=>[row.municipality,row.year,row.metric,row.group,row.level,sourceKey(row)].join('|');
export function splitStatisticalRows(rows: StatisticalRow[]): StatisticalRow[][] {
  const groups: StatisticalRow[][] = []; let chunk: StatisticalRow[] = []; let size = 0;
  for (const row of validateRows(rows)) {
    const length = new TextEncoder().encode(JSON.stringify(row)).length;
    if (size + length > 240_000 || chunk.length >= 300) { groups.push(chunk); chunk = []; size = 0; }
    chunk.push(row); size += length;
  }
  if (chunk.length) groups.push(chunk);
  return groups;
}
export function subscribeSharedSimulation(tenantId: string, onScenarios: (rows: SavedScenario[])=>void, onRows: (rows: StatisticalRow[])=>void, onError: (error: Error)=>void): ()=>void {
  const scenarios = onSnapshot(query(collection(db,'simulaciones'),where('tenantId','==',tenantId)), snap=>{
    try { onScenarios(snap.docs.map(document=>{ const data = document.data() as SavedScenario; return { ...data, id:document.id, snapshot:validateSnapshot(data.snapshot,tenantId) }; }).sort((a,b)=>b.savedAt.localeCompare(a.savedAt))); } catch(error) { onError(error as Error); }
  },onError);
  const data = onSnapshot(query(collection(db,'fuentes_estadisticas'),where('tenantId','==',tenantId),where('datasetId','==','importadas')), snap=>{
    try { const chunks = snap.docs.map(document=>document.data() as DataChunk).filter(chunk=>chunk.datasetId==='importadas').sort((a,b)=>(a.updatedAt || '').localeCompare(b.updatedAt || '') || a.index-b.index); const merged=new Map<string,StatisticalRow>();chunks.flatMap(chunk=>chunk.rows).forEach(row=>merged.set(recordKey(row),row));onRows(validateRows([...merged.values()])); } catch(error) { onError(error as Error); }
  },onError);
  return ()=>{scenarios();data();};
}
/** Independent uploads use distinct documents, so concurrent members never replace each other's sources. */
export async function appendSharedRows(tenantId:string,rows:StatisticalRow[]):Promise<void> {
  if (!auth.currentUser) throw new Error('Inicie sesión para compartir estadísticas.');
  const groups=new Map<string,StatisticalRow[]>();
  for (const row of validateRows(rows)) { const key=sourceKey(row); const group=groups.get(key); if (group) group.push(row); else groups.set(key,[row]); }
  const batch=writeBatch(db);let count=0;const now=new Date().toISOString();
  for (const data of groups.values()) {
    const parts=splitStatisticalRows(data);const uploadId=crypto.randomUUID();
    parts.forEach((rows,index)=>{count++;batch.set(doc(db,'fuentes_estadisticas',`${tenantId}--${uploadId}--${index}`),{tenantId,datasetId:'importadas',index,total:parts.length,rows,updatedAt:now,updatedBy:auth.currentUser!.uid});});
  }
  if (count>450) throw new Error('El archivo contiene demasiadas fuentes. Importe menos fuentes por archivo.');
  const id=crypto.randomUUID();batch.set(doc(db,'auditoria',id),{id,tenantId,actorId:auth.currentUser.uid,action:'create',entity:'fuentes_estadisticas',entityId:'importadas',createdAt:now});
  await batch.commit();
}
export async function removeSharedSource(tenantId:string,key:string):Promise<void> {
  if (!auth.currentUser) throw new Error('Inicie sesión para retirar una fuente.');
  const data=await getDocs(query(collection(db,'fuentes_estadisticas'),where('tenantId','==',tenantId)));
  const batch=writeBatch(db);let count=0;
  for (const document of data.docs) {
    const chunk=document.data() as DataChunk;
    if (chunk.datasetId!=='importadas' || !chunk.rows.some(row=>sourceKey(row)===key)) continue;
    const remaining=chunk.rows.filter(row=>sourceKey(row)!==key);count++;
    if (remaining.length) batch.update(document.ref,{rows:remaining});else batch.delete(document.ref);
  }
  if (count>450) throw new Error('La fuente supera el límite de eliminación en una operación.');
  const id=crypto.randomUUID();batch.set(doc(db,'auditoria',id),{id,tenantId,actorId:auth.currentUser.uid,action:'delete',entity:'fuentes_estadisticas',entityId:key,createdAt:new Date().toISOString()});
  await batch.commit();
}
export async function saveSharedScenario(tenantId: string, scenario: SavedScenario): Promise<void> {
  validateSnapshot(scenario.snapshot,tenantId);
  if (!auth.currentUser) throw new Error('Inicie sesión para compartir escenarios.');
  const sourceDatasetId=`escenario-${scenario.id}`;
  const chunks=splitStatisticalRows(scenario.snapshot.imported);
  const batch=writeBatch(db);
  chunks.forEach((rows,index)=>batch.set(doc(db,'fuentes_estadisticas',`${tenantId}--${sourceDatasetId}--${index}`),{tenantId,datasetId:sourceDatasetId,index,total:chunks.length,rows}));
  batch.set(doc(db,'simulaciones',scenario.id),omitUndefined({...scenario,tenantId,sourceDatasetId,snapshot:{...scenario.snapshot,imported:[]},updatedBy:auth.currentUser.uid}));
  const auditId=crypto.randomUUID();
  batch.set(doc(db,'auditoria',auditId),{id:auditId,tenantId,actorId:auth.currentUser.uid,action:'create',entity:'simulaciones',entityId:scenario.id,createdAt:new Date().toISOString()});
  await batch.commit();
}
export async function loadSharedScenario(tenantId:string,scenario:SavedScenario):Promise<SavedScenario> {
  if (!scenario.sourceDatasetId) return scenario;
  const data=await getDocs(query(collection(db,'fuentes_estadisticas'),where('tenantId','==',tenantId),where('datasetId','==',scenario.sourceDatasetId)));
  const rows=data.docs.map(item=>item.data() as DataChunk).sort((a,b)=>a.index-b.index).flatMap(item=>item.rows);
  return {...scenario,snapshot:validateSnapshot({...scenario.snapshot,imported:rows},tenantId)};
}
export async function deleteSharedScenario(tenantId:string,id:string):Promise<void> {
  const data=await getDocs(query(collection(db,'fuentes_estadisticas'),where('tenantId','==',tenantId),where('datasetId','==',`escenario-${id}`)));
  const batch=writeBatch(db);data.docs.forEach(item=>batch.delete(item.ref));batch.delete(doc(db,'simulaciones',id));
  if (!auth.currentUser) throw new Error('Inicie sesión para eliminar el escenario.');
  const auditId=crypto.randomUUID();batch.set(doc(db,'auditoria',auditId),{id:auditId,tenantId,actorId:auth.currentUser.uid,action:'delete',entity:'simulaciones',entityId:id,createdAt:new Date().toISOString()});
  await batch.commit();
}

