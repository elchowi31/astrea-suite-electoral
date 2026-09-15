import { collection, doc, getDocFromServer, getDocsFromServer, limit, query, setDoc, where } from 'firebase/firestore';
import { auth, db } from './firebase';
import type { DemoBundle } from '../data/demoSeed';

export class DemoCloudError extends Error {
  constructor(public stage: string, public code: string) {
    super(code === 'permission-denied' ? `Firestore denegó ${stage}. La demostración no se guardó en la nube.` : `No se pudo completar ${stage}. La demostración no se guardó en la nube.`);
  }
}

async function cloudStep<T>(stage: string, action: () => Promise<T>): Promise<T> {
  try { return await action(); }
  catch (error) {
    const code = String((error as { code?: string })?.code || 'unknown').replace('firestore/', '');
    if (['permission-denied', 'unavailable', 'deadline-exceeded'].includes(code)) throw new DemoCloudError(stage, code);
    throw error;
  }
}

export async function savePresentation(bundle: DemoBundle): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('Inicie sesión para guardar la demostración.');
  const profile = await cloudStep('la lectura del perfil', () => getDocFromServer(doc(db, 'usuarios', user.uid)));
  const data = profile.data();
  if (!data || data.tenantId !== bundle.tenantId || !['AdminGlobal', 'AdminTenant', 'Gobernador', 'Diputado', 'Alcalde', 'Concejal', 'JefePolitico'].includes(data.role)) throw new Error('Este perfil no puede administrar la demostración de esta organización.');
  const names = ['candidatos', 'distritos', 'propuestas', 'archivos_drive', 'gastos', 'aportes', 'lideres', 'vehiculos', 'comites_coordinaciones', 'votantes_rasos'];
  const checks = await Promise.all(names.map(name => cloudStep(`la consulta de ${name}`, () => getDocsFromServer(query(collection(db, name), where('tenantId', '==', bundle.tenantId), limit(1))))));
  if (checks.some(snapshot => !snapshot.empty)) throw new Error('Esta organización tiene registros reales. No se activó la demostración.');
  // Never write fixtures into operational collections; never report a failed write as saved.
  await cloudStep('el guardado de demo', () => setDoc(doc(db, 'demo', `${bundle.tenantId}-presentacion`), { ...bundle, updatedAt: new Date().toISOString(), updatedBy: user.uid }));
}
