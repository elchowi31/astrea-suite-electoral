import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  collection,
  onSnapshot,
  getDocFromServer,
  writeBatch,
  query,
  where
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import {
  Tenant,
  Candidate,
  District,
  Proposal,
  DriveFileItem,
  UserProfile,
  CampaignExpense,
  Leader,
  TransportVehicle,
  DonorContribution
} from '../types';
import { buildDemoBundle, type DemoBundle } from '../data/demoSeed';

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// Use firestoreDatabaseId if specified, or default database
export const db = (firebaseConfig as any).firestoreDatabaseId
  ? getFirestore(app, (firebaseConfig as any).firestoreDatabaseId)
  : getFirestore(app);

export const auth = getAuth(app);

export async function authenticatedFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const user = auth.currentUser;
  if (!user) throw new Error('La sesión venció. Inicie sesión nuevamente.');
  const token = await user.getIdToken();
  const headers = new Headers(init.headers || {});
  headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  return fetch(input, { ...init, headers });
}

async function persistEntity<T extends { tenantId: string }>(collectionName: string, entityId: string, data: T): Promise<void> {
  const actor = auth.currentUser;
  const now = new Date().toISOString();
  const batch = writeBatch(db);
  batch.set(doc(db, collectionName, entityId), {
    ...data,
    updatedAt: now,
    updatedBy: actor?.uid || 'unknown'
  }, { merge: true });
  if (actor) {
    const auditId = `${now.replace(/[^0-9]/g, '')}-${actor.uid.slice(0, 8)}-${entityId.slice(0, 24)}`;
    batch.set(doc(db, 'auditoria', auditId), {
      id: auditId,
      tenantId: data.tenantId,
      actorId: actor.uid,
      actorEmail: actor.email || null,
      action: 'update',
      entity: collectionName,
      entityId,
      createdAt: now
    });
  }
  await batch.commit();
}

async function removeEntity(collectionName: string, entityId: string, tenantId?: string): Promise<void> {
  const actor = auth.currentUser;
  if (!tenantId) {
    const snapshot = await getDoc(doc(db, collectionName, entityId));
    tenantId = snapshot.exists() ? snapshot.data().tenantId : undefined;
  }
  const batch = writeBatch(db);
  batch.delete(doc(db, collectionName, entityId));
  if (actor && tenantId) {
    const now = new Date().toISOString();
    const auditId = `${now.replace(/[^0-9]/g, '')}-${actor.uid.slice(0, 8)}-${entityId.slice(0, 24)}`;
    batch.set(doc(db, 'auditoria', auditId), { id: auditId, tenantId, actorId: actor.uid, actorEmail: actor.email || null, action: 'delete', entity: collectionName, entityId, createdAt: now });
  }
  await batch.commit();
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    tenantId: string | undefined;
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null = null
): FirestoreErrorInfo {
  const message = error instanceof Error ? error.message : String(error);
  const errInfo: FirestoreErrorInfo = {
    error: message,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      tenantId: (auth.currentUser as any)?.tenantId
    },
    operationType,
    path
  };
  console.warn('Firestore Operation Info:', JSON.stringify(errInfo));
  return errInfo;
}

// Test connection on startup
export async function testFirestoreConnection(): Promise<{ connected: boolean; message: string }> {
  try {
    if (!auth.currentUser) return { connected: false, message: 'Inicie sesión para verificar Firestore.' };
    const userRef = doc(db, 'usuarios', auth.currentUser.uid);
    const snap = await getDocFromServer(userRef);
    return { connected: snap.exists(), message: snap.exists() ? 'Conectado a Firestore con sesión verificada' : 'Perfil no autorizado' };
  } catch (error: any) {
    handleFirestoreError(error, OperationType.GET, 'usuarios/perfil_actual');
    return {
      connected: false,
      message: error?.message || 'Error al conectar con Firestore'
    };
  }
}

// Stats counter for collections in Spanish
export interface DatabaseStats {
  tenants: number;
  users: number;
  candidates: number;
  districts: number;
  proposals: number;
  expenses: number;
  leaders: number;
  vehicles: number;
  driveFiles: number;
  totalDocuments: number;
  isSeeded: boolean;
  lastUpdated: string;
}

export async function fetchDatabaseStats(): Promise<DatabaseStats> {
  if (!auth.currentUser) throw new Error('Inicie sesión para consultar el inventario.');
  const profileSnapshot = await getDoc(doc(db, 'usuarios', auth.currentUser.uid));
  const tenantId = profileSnapshot.data()?.tenantId as string | undefined;
  if (!profileSnapshot.exists() || !tenantId) throw new Error('La sesión no tiene un tenant autorizado.');

  const collectionsList = [
    { name: 'usuarios', key: 'users' },
    { name: 'candidatos', key: 'candidates' },
    { name: 'distritos', key: 'districts' },
    { name: 'propuestas', key: 'proposals' },
    { name: 'gastos', key: 'expenses' },
    { name: 'lideres', key: 'leaders' },
    { name: 'vehiculos', key: 'vehicles' },
    { name: 'archivos_drive', key: 'driveFiles' }
  ];

  const counts: Record<string, number> = {};
  let total = 1;

  for (const col of collectionsList) {
    try {
      const snap = await getDocs(query(collection(db, col.name), where('tenantId', '==', tenantId)));
      counts[col.key] = snap.size;
      total += snap.size;
    } catch (e) {
      counts[col.key] = 0;
    }
  }

  return {
    tenants: 1,
    users: counts.users || 0,
    candidates: counts.candidates || 0,
    districts: counts.districts || 0,
    proposals: counts.proposals || 0,
    expenses: counts.expenses || 0,
    leaders: counts.leaders || 0,
    vehicles: counts.vehicles || 0,
    driveFiles: counts.driveFiles || 0,
    totalDocuments: total,
    isSeeded: total > 0,
    lastUpdated: new Date().toLocaleTimeString('es-CO')
  };
}

// ----------------------------------------------------
// CRUD OPERATIONS (COLECCIONES EN ESPAÑOL)
// ----------------------------------------------------

// Candidatos
export async function saveCandidateToFirestore(candidate: Candidate): Promise<void> {
  try {
    await persistEntity('candidatos', candidate.id, candidate);
  } catch (e) {
    handleFirestoreError(e, OperationType.WRITE, `candidatos/${candidate.id}`);
    throw e;
  }
}

export async function deleteCandidateFromFirestore(candidateId: string): Promise<void> {
  try {
    await removeEntity('candidatos', candidateId);
  } catch (e) {
    handleFirestoreError(e, OperationType.DELETE, `candidatos/${candidateId}`);
    throw e;
  }
}

// Gastos
export async function saveExpenseToFirestore(expense: CampaignExpense): Promise<void> {
  try {
    await persistEntity('gastos', expense.id, expense);
  } catch (e) {
    handleFirestoreError(e, OperationType.WRITE, `gastos/${expense.id}`);
    throw e;
  }
}

export async function deleteExpenseFromFirestore(expenseId: string): Promise<void> {
  try {
    await removeEntity('gastos', expenseId);
  } catch (e) {
    handleFirestoreError(e, OperationType.DELETE, `gastos/${expenseId}`);
    throw e;
  }
}

// Aportes & Donantes (CNE Cuentas Claras)
export async function saveDonorContributionToFirestore(contribution: DonorContribution): Promise<void> {
  try {
    await persistEntity('aportes', contribution.id, contribution);
  } catch (e) {
    handleFirestoreError(e, OperationType.WRITE, `aportes/${contribution.id}`);
    throw e;
  }
}

export async function deleteDonorContributionFromFirestore(contributionId: string): Promise<void> {
  try {
    await removeEntity('aportes', contributionId);
  } catch (e) {
    handleFirestoreError(e, OperationType.DELETE, `aportes/${contributionId}`);
    throw e;
  }
}

// Líderes
export async function saveLeaderToFirestore(leader: Leader): Promise<void> {
  try {
    await persistEntity('lideres', leader.id, leader);
  } catch (e) {
    handleFirestoreError(e, OperationType.WRITE, `lideres/${leader.id}`);
    throw e;
  }
}

export async function deleteLeaderFromFirestore(leaderId: string): Promise<void> {
  try {
    await removeEntity('lideres', leaderId);
  } catch (e) {
    handleFirestoreError(e, OperationType.DELETE, `lideres/${leaderId}`);
    throw e;
  }
}

// Vehículos
export async function saveVehicleToFirestore(vehicle: TransportVehicle): Promise<void> {
  try {
    await persistEntity('vehiculos', vehicle.id, vehicle);
  } catch (e) {
    handleFirestoreError(e, OperationType.WRITE, `vehiculos/${vehicle.id}`);
    throw e;
  }
}

export async function deleteVehicleFromFirestore(vehicleId: string): Promise<void> {
  try {
    await removeEntity('vehiculos', vehicleId);
  } catch (e) {
    handleFirestoreError(e, OperationType.DELETE, `vehiculos/${vehicleId}`);
    throw e;
  }
}

// Propuestas
export async function saveProposalToFirestore(proposal: Proposal): Promise<void> {
  try {
    await persistEntity('propuestas', proposal.id, proposal);
  } catch (e) {
    handleFirestoreError(e, OperationType.WRITE, `propuestas/${proposal.id}`);
    throw e;
  }
}

export async function deleteProposalFromFirestore(proposalId: string): Promise<void> {
  try {
    await removeEntity('propuestas', proposalId);
  } catch (e) {
    handleFirestoreError(e, OperationType.DELETE, `propuestas/${proposalId}`);
    throw e;
  }
}

// Organizaciones / Tenants
export async function saveTenantToFirestore(tenant: Tenant): Promise<void> {
  try {
    await persistEntity('organizaciones', tenant.tenantId, tenant);
  } catch (e) {
    handleFirestoreError(e, OperationType.WRITE, `organizaciones/${tenant.tenantId}`);
    throw e;
  }
}

export async function deleteTenantFromFirestore(tenantId: string): Promise<void> {
  try {
    await removeEntity('organizaciones', tenantId, tenantId);
  } catch (e) {
    handleFirestoreError(e, OperationType.DELETE, `organizaciones/${tenantId}`);
    throw e;
  }
}

// Aprovisionamiento mínimo: la organización nace vacía y lista para onboarding.
export async function seedNewTenantInitialData(newTenant: Tenant): Promise<{ success: boolean; message: string }> {
  try {
    await persistEntity('organizaciones', newTenant.tenantId, newTenant);
    return {
      success: true,
      message: `Organización "${newTenant.name}" creada. Complete el onboarding para cargar su información real.`
    };
  } catch (error: any) {
    handleFirestoreError(error, OperationType.WRITE, `seed_tenant_${newTenant.tenantId}`);
    return {
      success: false,
      message: `Error al aprovisionar tenant: ${error?.message || String(error)}`
    };
  }
}

// Archivos Drive
export async function saveDriveFileToFirestore(file: DriveFileItem): Promise<void> {
  try {
    await persistEntity('archivos_drive', file.id, file);
  } catch (e) {
    handleFirestoreError(e, OperationType.WRITE, `archivos_drive/${file.id}`);
    throw e;
  }
}

// Usuarios & Perfiles Políticos
export async function saveUserToFirestore(user: UserProfile): Promise<void> {
  try {
    await persistEntity('usuarios', user.uid, user);
  } catch (e) {
    handleFirestoreError(e, OperationType.WRITE, `usuarios/${user.uid}`);
    throw e;
  }
}

export async function deleteUserFromFirestore(uid: string): Promise<void> {
  try {
    await removeEntity('usuarios', uid);
  } catch (e) {
    handleFirestoreError(e, OperationType.DELETE, `usuarios/${uid}`);
    throw e;
  }
}

// ----------------------------------------------------
// REALTIME SUBSCRIPTIONS
// ----------------------------------------------------
export function subscribeToCollection<T>(
  collectionName: string,
  onData: (items: T[]) => void,
  _fallbackData: T[],
  tenantId?: string,
  additionalFilter?: { field: string; value: unknown }
): () => void {
  if (!tenantId) {
    onData([]);
    return () => {};
  }

  try {
    const colRef = additionalFilter
      ? query(collection(db, collectionName), where('tenantId', '==', tenantId), where(additionalFilter.field, '==', additionalFilter.value))
      : query(collection(db, collectionName), where('tenantId', '==', tenantId));
    const unsubscribe = onSnapshot(
      colRef,
      (snapshot) => {
        const items = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as T));
        onData(items);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, collectionName);
        onData([]);
      }
    );
    return unsubscribe;
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, collectionName);
    onData([]);
    return () => {};
  }
}

export async function saveGrassrootsVoterToFirestore(voter: any): Promise<void> {
  try {
    await persistEntity('votantes_rasos', voter.id, voter);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `votantes_rasos/${voter.id}`);
    throw error;
  }
}

export async function saveCoordinationToFirestore(coordination: any): Promise<void> {
  try {
    await persistEntity('comites_coordinaciones', coordination.id, coordination);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `comites_coordinaciones/${coordination.id}`);
    throw error;
  }
}

export async function saveWorkspaceEventToFirestore(tenantId: string, event: Record<string, unknown>): Promise<void> {
  const id = String(event.id || `workspace-${Date.now()}`);
  await persistEntity('eventos_workspace', id, { ...event, id, tenantId } as any);
}

export async function saveAiAnalysisToFirestore(tenantId: string, analysis: { type: string; title: string; content: string }): Promise<void> {
  const id = `analisis-${Date.now()}`;
  await persistEntity('analisis_ia', id, { ...analysis, id, tenantId, createdAt: new Date().toISOString() } as any);
}

// La demostración vive en una colección aislada. Nunca se mezcla con las
// colecciones operativas y se elimina borrando un único documento por tenant.
export async function createDemoCollection(tenantId: string): Promise<DemoBundle> {
  const bundle = buildDemoBundle(tenantId);
  try {
    await persistEntity('demo', bundle.id, bundle);
  } catch (primaryErr) {
    console.warn('Persistencia en lote para demo tuvo advertencia, aplicando setDoc directo:', primaryErr);
    try {
      await setDoc(doc(db, 'demo', bundle.id), {
        ...bundle,
        updatedAt: new Date().toISOString(),
        updatedBy: auth.currentUser?.uid || 'local'
      }, { merge: true });
    } catch (fallbackErr) {
      console.warn('Advertencia secundaria en demo setDoc:', fallbackErr);
    }
  }
  return bundle;
}

export async function deleteDemoCollection(tenantId: string): Promise<void> {
  try {
    await removeEntity('demo', `${tenantId}-presentacion`, tenantId);
  } catch (primaryErr) {
    console.warn('Borrado en lote de demo tuvo advertencia, aplicando deleteDoc directo:', primaryErr);
    try {
      await deleteDoc(doc(db, 'demo', `${tenantId}-presentacion`));
    } catch (fallbackErr) {
      console.warn('Advertencia secundaria al eliminar documento demo:', fallbackErr);
      throw fallbackErr;
    }
  }
}

export function subscribeToDemoCollection(tenantId: string, onData: (bundle: DemoBundle | null) => void): () => void {
  return subscribeToCollection<DemoBundle>('demo', (items) => {
    onData(items.find((item) => item.kind === 'presentation' && item.isSynthetic === true) || null);
  }, [], tenantId);
}
