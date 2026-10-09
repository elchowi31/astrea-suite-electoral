import { doc, runTransaction } from 'firebase/firestore';
import { auth, db } from './firebase';
import { validLocation, type Coordinate, type TerritorialRoute } from './territorialMaps';

// Update only map fields so a location update never overwrites another member's form or route.
async function updateMapFields(collectionName: 'lideres' | 'vehiculos', id: string, tenantId: string, fields: Record<string, unknown>) {
  const actor = auth.currentUser;
  if (!actor || !id || id.startsWith('demo-')) throw new Error('Inicie sesión y seleccione un registro de su organización.');
  const reference = doc(db, collectionName, id); const auditId = crypto.randomUUID();
  await runTransaction(db, async transaction => {
    const snapshot = await transaction.get(reference);
    if (!snapshot.exists() || snapshot.data().tenantId !== tenantId) throw new Error('El registro no pertenece a esta organización.');
    const updatedAt = new Date().toISOString();
    transaction.update(reference, { ...fields, updatedAt, updatedBy: actor.uid });
    transaction.set(doc(db, 'auditoria', auditId), { id: auditId, tenantId, actorId: actor.uid,
      entity: collectionName, entityId: id, action: 'update', createdAt: updatedAt });
  });
}
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
