import React, { useEffect, useState } from 'react';
import { Check, Edit3, UserRound, X } from 'lucide-react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { UserProfile, Tenant } from '../types';

interface UserGreetingBannerProps {
  currentUser: UserProfile;
  currentTenant: Tenant;
  onOpenAuthModal: () => void;
  onUpdateUserName?: (newName: string) => void;
}

export const UserGreetingBanner: React.FC<UserGreetingBannerProps> = ({ currentUser, currentTenant, onOpenAuthModal, onUpdateUserName }) => {
  const registeredName = (currentUser.fullName?.trim() && !currentUser.fullName.includes('@') ? currentUser.fullName.trim() : '') || [currentUser.displayName].find(name => name?.trim() && !name.includes('@') && name.toLowerCase().trim() !== currentUser.email?.split('@')[0].toLowerCase())?.trim() || '';
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(registeredName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { setName(registeredName); setEditing(false); setError(''); }, [registeredName, currentUser.uid]);
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || !currentUser.uid) return;
    setSaving(true); setError('');
    try {
      await setDoc(doc(db, 'usuarios', currentUser.uid), { displayName: trimmed, fullName: trimmed }, { merge: true });
      onUpdateUserName?.(trimmed);
      setEditing(false);
    } catch {
      setError('No se guardó el nombre. Revisa tu conexión y vuelve a intentar.');
    } finally { setSaving(false); }
  };
  return <section className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-cyan-900 bg-slate-900/80 px-3 py-2" aria-label="Perfil de usuario">
    <div className="min-w-0 flex-1">
      {editing ? <form onSubmit={save} className="flex flex-wrap items-center gap-2">
        <input aria-label="Nombre y apellidos" required maxLength={150} value={name} onChange={e => setName(e.target.value)} autoFocus disabled={saving} className="min-w-0 flex-1 rounded-lg border border-cyan-700 bg-slate-950 px-2 py-2 text-sm text-white" />
        <button disabled={saving || !name.trim()} aria-label="Guardar nombre" className="rounded-lg bg-emerald-700 p-2 text-white disabled:opacity-50"><Check className="h-5 w-5" /></button>
        <button type="button" disabled={saving} aria-label="Cancelar edición" onClick={() => { setEditing(false); setName(registeredName); setError(''); }} className="rounded-lg bg-slate-800 p-2 text-white"><X className="h-5 w-5" /></button>
      </form> : <div className="flex items-center gap-1"><h1 className="break-words text-base font-bold text-white">{registeredName ? `Hola, ${registeredName}` : 'Bienvenido'}</h1><button aria-label="Editar nombre" onClick={() => setEditing(true)} className="shrink-0 p-2 text-cyan-300"><Edit3 className="h-4 w-4" /></button></div>}
      <p className="truncate text-[11px] text-slate-400">{currentUser.role} · {currentTenant.name}</p>
      {error && <p role="alert" className="mt-1 text-xs text-rose-300">{error}</p>}
    </div>
    <button onClick={onOpenAuthModal} className="flex min-h-10 items-center gap-2 rounded-lg border border-slate-700 px-3 text-xs font-bold text-cyan-200"><UserRound className="h-4 w-4" />Perfil</button>
  </section>;
};
