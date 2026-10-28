import {getDocFromServer,type DocumentReference} from 'firebase/firestore';
import {canonicalStoredValue} from './serialization';

export type SaveReceipt={path:string;verifiedAt:string;fields:number;demo:boolean};
export function assertStoredFields(actual:Record<string,unknown>|undefined,expected:Record<string,unknown>,removed:string[]=[]) {
  if(!actual)throw new Error('La escritura terminó, pero el registro no aparece en la lectura del servidor. Revise antes de volver a guardar.');
  const changed=Object.keys(expected).filter(key=>canonicalStoredValue(actual[key])!==canonicalStoredValue(expected[key]));
  if(changed.length||removed.some(key=>key in actual))throw new Error('El servidor contiene un cambio posterior o distinto al enviado. Actualice y revise el registro antes de repetir el guardado.');
}
/** Success is emitted only after a fresh server read, never from the local cache. */
export async function verifySavedRecord(reference:DocumentReference,expected:Record<string,unknown>,removed:string[]=[]) {
  let snapshot;
  try{snapshot=await getDocFromServer(reference);}catch{throw new Error('La escritura fue enviada, pero no se pudo verificar desde el servidor. Compruebe la conexión y vuelva a consultar; no duplique el registro.');}
  assertStoredFields(snapshot.exists()?snapshot.data():undefined,expected,removed);
  const receipt:SaveReceipt={path:reference.path,verifiedAt:new Date().toISOString(),fields:Object.keys(expected).length+removed.length,demo:reference.parent.id==='demo'};
  if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent('astrea:save-verified',{detail:receipt}));
  return receipt;
}
