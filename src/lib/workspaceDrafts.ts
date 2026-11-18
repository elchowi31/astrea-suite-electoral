import {
  doc,
  runTransaction,
  collection,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { requireOnlineMutation } from './offlineMutations';
import { validateFormDesign, type FormDesign } from './formDesign';
import type { WorkspaceRemoteForm } from './workspaceApi';
export type SavedFormDesign = {
  id: string;
  tenantId: string;
  ownerId: string;
  kind: 'form-design';
  name: string;
  mimeType: string;
  category: string;
  summary: string;
  syncedAt: string;
  revision: number;
  design: FormDesign;
  reviewed: boolean;
  remote?: WorkspaceRemoteForm;
  googleUid?: string;
};
export function subscribeFormDesigns(
  tenantId: string,
  ownerId: string,
  receive: (rows: SavedFormDesign[]) => void,
  fail: (error: Error) => void,
) {
  return onSnapshot(
    query(
      collection(db, 'formularios_diseno'),
      where('tenantId', '==', tenantId),
      where('ownerId', '==', ownerId),
    ),
    (snapshot) =>
      receive(snapshot.docs.map((row) => row.data() as SavedFormDesign)),
    fail,
  );
}
export async function saveFormDesign(input: SavedFormDesign) {
  requireOnlineMutation('Conéctese para guardar el diseño de formulario.');
  const actor = auth.currentUser;
  if (!actor || actor.uid !== input.ownerId)
    throw Error('El diseño pertenece a otra cuenta.');
  const design = validateFormDesign(input.design),
    ref = doc(db, 'formularios_diseno', input.id);
  return runTransaction(db, async (transaction) => {
    const previous = (await transaction.get(ref)).data() as
      | SavedFormDesign
      | undefined;
    if (
      previous &&
      (previous.tenantId !== input.tenantId || previous.ownerId !== actor.uid)
    )
      throw Error('El diseño pertenece a otro ámbito.');
    if ((previous?.revision || 0) !== input.revision)
      throw Error(
        'Otra sesión cambió el diseño. Vuelva a abrir su versión guardada.',
      );
    if (auth.currentUser?.uid !== actor.uid)
      throw Error('La cuenta cambió durante el guardado.');
    const next = {
      ...input,
      design,
      name: design.title,
      revision: input.revision + 1,
      syncedAt: new Date().toISOString(),
    };
    transaction.set(ref, JSON.parse(JSON.stringify(next)));
    return next;
  });
}
