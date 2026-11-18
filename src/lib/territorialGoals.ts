import {
  doc,
  runTransaction,
  collection,
  query,
  where,
  onSnapshot,
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { requireOnlineMutation } from './offlineMutations';
import { geoKey } from './geographicAttributes';
export type TerritorialGoal = {
  id: string;
  tenantId: string;
  department: string;
  municipality: string;
  mode: 'real' | 'demo';
  ownerId: string;
  targetVotes: number;
  revision: number;
  updatedAt: string;
  updatedBy: string;
};
export const canEditTerritorialGoal = (role: string) =>
  [
    'AdminGlobal',
    'AdminTenant',
    'Gobernador',
    'Diputado',
    'Alcalde',
    'JefePolitico',
  ].includes(role);
export const territorialGoalId = (
  tenantId: string,
  department: string,
  municipality: string,
  owner: string,
) =>
  `${tenantId}--territorial--${owner}--${geoKey(department)}--${geoKey(municipality)}`;
export function subscribeTerritorialGoals(
  tenantId: string,
  uid: string,
  demo: boolean,
  receive: (rows: TerritorialGoal[]) => void,
  fail: (error: Error) => void,
) {
  const filters = [
    where('tenantId', '==', tenantId),
    where('mode', '==', demo ? 'demo' : 'real'),
  ];
  if (demo) filters.push(where('ownerId', '==', uid));
  return onSnapshot(
    query(collection(db, 'metas_territoriales'), ...filters),
    (snapshot) =>
      receive(snapshot.docs.map((row) => row.data() as TerritorialGoal)),
    fail,
  );
}
export async function saveTerritorialGoal(input: {
  tenantId: string;
  department: string;
  municipality: string;
  demo: boolean;
  targetVotes: number;
  revision: number;
}) {
  requireOnlineMutation('Conéctese para guardar la meta territorial.');
  const actor = auth.currentUser;
  if (!actor) throw Error('Inicie sesión antes de editar.');
  if (
    !Number.isSafeInteger(input.targetVotes) ||
    input.targetVotes < 0 ||
    input.targetVotes > 100_000_000 ||
    !input.department.trim() ||
    !input.municipality.trim()
  )
    throw Error(
      'Ingrese una meta entera válida y su departamento y municipio.',
    );
  const id = territorialGoalId(
      input.tenantId,
      input.department,
      input.municipality,
      input.demo ? actor.uid : 'shared',
    ),
    ref = doc(db, 'metas_territoriales', id);
  return runTransaction(db, async (transaction) => {
    const previous = (await transaction.get(ref)).data() as
      | TerritorialGoal
      | undefined;
    if ((previous?.revision || 0) !== input.revision)
      throw Error('La meta cambió en otra sesión. Vuelva a abrir la edición.');
    if (
      previous &&
      (previous.tenantId !== input.tenantId ||
        previous.mode !== (input.demo ? 'demo' : 'real') ||
        (input.demo && previous.ownerId !== actor.uid))
    )
      throw Error('La meta pertenece a otro ámbito.');
    if (auth.currentUser?.uid !== actor.uid)
      throw Error('La cuenta cambió antes de guardar.');
    const next: TerritorialGoal = {
      id,
      tenantId: input.tenantId,
      department: input.department,
      municipality: input.municipality,
      mode: input.demo ? 'demo' : 'real',
      ownerId: previous?.ownerId || actor.uid,
      targetVotes: input.targetVotes,
      revision: input.revision + 1,
      updatedAt: new Date().toISOString(),
      updatedBy: actor.uid,
    };
    transaction.set(ref, next);
    const audit = doc(collection(db, 'auditoria'));
    transaction.set(audit, {
      id: audit.id,
      tenantId: input.tenantId,
      actorId: actor.uid,
      entity: 'metas_territoriales',
      entityId: id,
      action: 'update',
      createdAt: next.updatedAt,
    });
    return next;
  });
}
