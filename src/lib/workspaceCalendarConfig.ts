import { doc, getDocFromServer, setDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
const id = (tenantId: string, ownerId: string, googleUid: string) =>
  `${tenantId}--${ownerId}--${googleUid}`;
export async function readWorkspaceCalendar(
  tenantId: string,
  ownerId: string,
  googleUid: string,
) {
  if (auth.currentUser?.uid !== ownerId) throw Error('La cuenta cambió.');
  const row = (
    await getDocFromServer(
      doc(db, 'workspace_conexiones', id(tenantId, ownerId, googleUid)),
    )
  ).data();
  return row?.tenantId === tenantId &&
    row.ownerId === ownerId &&
    row.googleUid === googleUid
    ? String(row.calendarId)
    : '';
}
export async function saveWorkspaceCalendar(
  tenantId: string,
  ownerId: string,
  googleUid: string,
  calendarId: string,
) {
  if (auth.currentUser?.uid !== ownerId) throw Error('La cuenta cambió.');
  const key = id(tenantId, ownerId, googleUid);
  await setDoc(doc(db, 'workspace_conexiones', key), {
    id: key,
    tenantId,
    ownerId,
    googleUid,
    calendarId,
    updatedAt: new Date().toISOString(),
  });
}
