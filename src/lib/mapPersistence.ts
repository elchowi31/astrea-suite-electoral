import {verifySavedRecord} from './saveVerification';
import { doc, runTransaction } from 'firebase/firestore';
import { auth, db } from './firebase';
import { validLocation, type Coordinate, type TerritorialRoute } from './territorialMaps';
import {durableMutation,registerOfflineMutation,isOfflineMutationScopeActive} from './offlineMutations';
import {canonicalStoredValue} from './serialization';
import {validateGeographicFeatures,type GeographicLayer,type GeoFeature} from './geographicImport';

// Update only map fields so a location update never overwrites another member's form or route.
async function updateMapFields(collectionName: 'lideres' | 'vehiculos', id: string, tenantId: string, fields: Record<string, unknown>) {
  const actor = auth.currentUser;
  if (!actor || !id || id.startsWith('demo-')) throw new Error('Inicie sesión y seleccione un registro de su organización.');
  await durableMutation('map-fields',{userId:actor.uid,tenantId},{collectionName,id,tenantId,fields});
}
registerOfflineMutation('map-fields',async({collectionName,id,tenantId,fields},context)=>{
  const actor=auth.currentUser;
  if(!actor||actor.uid!==context.scope.userId||tenantId!==context.scope.tenantId||!['lideres','vehiculos'].includes(collectionName))throw new Error('La sesión cambió; la ubicación se conserva para su cuenta.');
  const reference = doc(db, collectionName, id); const auditId = context.id;
  const receipt=doc(db,'usuarios',actor.uid,'mutaciones_offline',context.id);
  const written=await runTransaction(db, async transaction => {
    if((await transaction.get(receipt)).exists())return false;
    const snapshot = await transaction.get(reference);
    if (!snapshot.exists() || snapshot.data().tenantId !== tenantId) throw new Error('El registro no pertenece a esta organización.');
    if(auth.currentUser?.uid!==actor.uid||!isOfflineMutationScopeActive(context.scope))throw new Error('La cuenta u organización cambió; se conserva la ubicación para su cuenta.');
    const updatedAt = new Date().toISOString();
    transaction.update(reference, { ...fields, updatedAt, updatedBy: actor.uid });
    transaction.set(doc(db, 'auditoria', auditId), { id: auditId, tenantId, actorId: actor.uid,
      entity: collectionName, entityId: id, action: 'update', createdAt: updatedAt });
    transaction.set(receipt,{id:context.id,tenantId,actorId:actor.uid,kind:'map-fields',createdAt:updatedAt});
    return true;
  });
  if(written)await verifySavedRecord(reference,fields);
});
export async function saveGeographicFeature(layer:GeographicLayer,feature:GeoFeature,original:string) {
  const actor=auth.currentUser;if(!actor)throw new Error('Inicie sesión para guardar.');
  if(!feature.name.trim())throw new Error('Complete el nombre.');
  validateGeographicFeatures([feature]);
  await durableMutation('geographic-feature',{userId:actor.uid,tenantId:layer.tenantId},{layerId:layer.id,feature:{...feature,name:feature.name.trim()},original});
}
registerOfflineMutation('geographic-feature',async({layerId,feature,original},context)=>{
  if(auth.currentUser?.uid!==context.scope.userId)throw new Error('Inicie sesión con la cuenta que editó el elemento.');
  validateGeographicFeatures([feature]);
  const reference=doc(db,'capas_geograficas',layerId),receipt=doc(db,'usuarios',context.scope.userId,'mutaciones_offline',context.id);
  const saved=await runTransaction(db,async transaction=>{
    if((await transaction.get(receipt)).exists())return null;
    const current=(await transaction.get(reference)).data() as GeographicLayer|undefined;
    if(!current||current.tenantId!==context.scope.tenantId)throw new Error('No se encontró la capa de esta organización.');
    const existing=current.features.find(item=>item.id===feature.id);
    if(!existing||canonicalStoredValue(existing)!==original)throw new Error('Otra persona modificó este elemento. Revise el registro y el cambio pendiente.');
    const features=current.features.map(item=>item.id===feature.id?feature:item);
    if(new TextEncoder().encode(JSON.stringify(features)).length>600000)throw new Error('La capa supera el límite de tamaño. Divida sus elementos.');
    if(auth.currentUser?.uid!==context.scope.userId||!isOfflineMutationScopeActive(context.scope))throw new Error('La cuenta u organización cambió durante el guardado.');
    const createdAt=new Date().toISOString();
    transaction.update(reference,{features,updatedBy:context.scope.userId,updatedAt:createdAt});
    transaction.set(doc(db,'auditoria',context.id),{id:context.id,tenantId:context.scope.tenantId,actorId:context.scope.userId,entity:'capas_geograficas',entityId:layerId,action:'edit',createdAt});
    transaction.set(receipt,{id:context.id,tenantId:context.scope.tenantId,actorId:context.scope.userId,kind:'geographic-feature',createdAt});
    return {features};
  });
  if(saved)await verifySavedRecord(reference,saved);
});
export async function saveTerritorialLocation(type: 'leader' | 'vehicle', id: string, tenantId: string, location: Coordinate, source: 'GPS' | 'Mapa' | 'Manual' = 'Mapa') {
  if (!validLocation(location)) throw new Error('La ubicación no es válida.');
  await updateMapFields(type === 'leader' ? 'lideres' : 'vehiculos', id, tenantId,
    { latitude: location.latitude, longitude: location.longitude, locationCapturedAt: new Date().toISOString(), locationSource: source });
}
export async function saveVehicleRoute(id: string, tenantId: string, route: TerritorialRoute) {
  if (route.stops.length < 2 || route.stops.length > 5 || !route.stops.every(validLocation) || !route.geometry.every(validLocation)
    || route.geometry.length < 2 || route.geometry.length > 15000 || !Number.isFinite(route.distanceMeters) || !Number.isFinite(route.durationSeconds))
    throw new Error('Calcule una ruta válida antes de guardarla.');
  await updateMapFields('vehiculos', id, tenantId, { plannedRoute: route });
}
