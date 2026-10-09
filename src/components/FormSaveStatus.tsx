import React, { useRef, useState } from 'react';
import { accountError } from '../lib/userProvisioning';

export function useFirestoreForm() {
  const lock = useRef(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  async function runSave(operation: () => void | Promise<void>) {
    if (lock.current) return;
    lock.current = true; setSaving(true); setSaveError('');
    try { await operation(); } catch(error) { setSaveError(accountError(error)); }
    finally { lock.current = false; setSaving(false); }
  }
  function submit(event: React.FormEvent, handler: (event: React.FormEvent) => void | Promise<void>) {
    event.preventDefault(); void runSave(()=>handler(event));
  }
  return { saving, saveError, submit, runSave };
}
export function FormSaveStatus({ saving, error }: { saving: boolean; error: string }) {
  return error ? <p role="alert" className="mb-3 rounded-xl border border-rose-500/40 bg-rose-950/30 p-3 text-sm text-rose-200">{error} Los datos del formulario se conservan.</p> : saving ? <p role="status" className="mb-3 text-sm text-cyan-300">Guardando en Firestore…</p> : null;
}
