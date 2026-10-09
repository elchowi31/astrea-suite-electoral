import React, { useState } from 'react';
import type { Candidate, Leader, Tenant, UserProfile, UserRole } from '../types';
import { saveUserToFirestore } from '../lib/firebase';
import { accountError, assignableRoles, canManageUsers, createTeamUser } from '../lib/userProvisioning';
import { CESAR_MUNICIPALITIES } from '../data/geography';

export function UserManagementView({ currentUser, currentTenant, users, leaders, candidates }: { currentUser: UserProfile; currentTenant: Tenant; users: UserProfile[]; leaders: Leader[]; candidates: Candidate[] }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [municipality, setMunicipality] = useState('Astrea');
  const [role, setRole] = useState<UserRole>('Operador');
  const [leaderId, setLeaderId] = useState('');
  const [candidateId, setCandidateId] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const roles = assignableRoles(currentUser);
  const input = 'mt-1 w-full rounded-xl border border-slate-600 bg-slate-950 p-3 text-sm text-white';
  async function create(event: React.FormEvent) {
    event.preventDefault(); if (busy) return;
    setBusy(true); setMessage('');
    try {
      const profile = await createTeamUser({ displayName: name.trim(), email, role, phone, tenantId: currentTenant.tenantId, municipality, department: 'Cesar', assignedLeaderId: leaderId || undefined, assignedCandidateId: candidateId || undefined }, password, currentUser);
      setMessage(`Cuenta de ${profile.displayName} creada y guardada. Puede ingresar con el correo y la contraseña que definió.`);
      setPassword(''); setName(''); setEmail(''); setPhone('');
    } catch (error) { setMessage(accountError(error)); } finally { setBusy(false); }
  }
  async function update(user: UserProfile, changes: Partial<UserProfile>) {
    if (busy) return; setBusy(true); setMessage('');
    try { await saveUserToFirestore({ ...user, ...changes }); setMessage(`Acceso de ${user.displayName} actualizado.`); }
    catch (error) { setMessage(accountError(error)); } finally { setBusy(false); }
  }
  if (!canManageUsers(currentUser)) return <p className="text-slate-300">Su administrador gestiona los accesos del equipo.</p>;
  return <div className="space-y-6 pb-12 text-slate-100">
    <div><h1 className="text-2xl font-bold">Usuarios y accesos</h1><p className="mt-2 text-sm text-slate-400">Cree cuentas para {currentTenant.name}. Todos los integrantes activos pueden diligenciar y guardar formularios de esta organización. Los responsables autorizados administran los accesos.</p></div>
    {message && <p role="status" className="rounded-xl border border-amber-500/30 bg-slate-900 p-4 text-sm text-amber-200">{message}</p>}
    <form onSubmit={create} className="rounded-2xl border border-slate-700 bg-slate-900 p-5">
      <h2 className="mb-4 font-bold">Crear usuario del equipo</h2>
      <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <label className="text-xs">Nombre completo<input aria-label="Nombre del usuario" required maxLength={150} className={input} value={name} onChange={e=>setName(e.target.value)} autoComplete="off" /></label>
        <label className="text-xs">Correo<input aria-label="Correo del usuario" required type="email" className={input} value={email} onChange={e=>setEmail(e.target.value)} autoComplete="off" /></label>
        <label className="text-xs">Contraseña inicial<input aria-label="Contraseña inicial" required type="password" minLength={8} className={input} value={password} onChange={e=>setPassword(e.target.value)} autoComplete="new-password" /></label>
        <label className="text-xs">Rol<select aria-label="Rol del usuario" className={input} value={role} onChange={e=>setRole(e.target.value as UserRole)}>{roles.map(item=><option key={item}>{item}</option>)}</select></label>
        <label className="text-xs">Municipio<select aria-label="Municipio del usuario" className={input} value={municipality} onChange={e=>setMunicipality(e.target.value)}>{CESAR_MUNICIPALITIES.map(item=><option key={item}>{item}</option>)}</select></label>
        <label className="text-xs">Teléfono<input aria-label="Teléfono del usuario" type="tel" className={input} value={phone} onChange={e=>setPhone(e.target.value)} /></label>
        <label className="text-xs">Líder asignado<select className={input} value={leaderId} onChange={e=>setLeaderId(e.target.value)}><option value="">Sus propios registros territoriales</option>{leaders.map(item=><option key={item.id} value={item.id}>{item.fullName}</option>)}</select></label>
        <label className="text-xs">Candidatura asignada<select className={input} value={candidateId} onChange={e=>setCandidateId(e.target.value)}><option value="">Sin asignación adicional</option>{candidates.map(item=><option key={item.id} value={item.id}>{item.fullName}</option>)}</select></label>
        <button type="submit" className="self-end rounded-xl bg-cyan-500 p-3 text-sm font-bold text-slate-950 disabled:opacity-40">{busy ? 'Guardando…' : 'Crear usuario'}</button>
      </fieldset>
      <p className="mt-3 text-xs text-slate-400">Entregue las credenciales a la persona. Podrá recuperar su contraseña desde la pantalla de ingreso.</p>
    </form>
    <section className="space-y-3 rounded-2xl border border-slate-700 bg-slate-900 p-5"><h2 className="font-bold">Integrantes · {users.length}</h2>
      {users.map(user => <div key={user.uid} className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-700 p-3">
        <div className="min-w-0 flex-1"><p className="font-semibold">{user.displayName}{user.uid===currentUser.uid ? ' · Usted' : ''}</p><p className="break-all text-xs text-slate-400">{user.email} · {user.municipality || 'Sin municipio'} · {user.active===false ? 'Inactivo' : 'Activo'}</p></div>
        <select aria-label={`Rol de ${user.displayName}`} disabled={busy || user.uid===currentUser.uid || !roles.includes(user.role)} className="rounded-lg bg-slate-950 p-2 text-xs" value={user.role} onChange={e=>void update(user,{role:e.target.value as UserRole})}>{[...new Set([user.role,...roles])].map(item=><option key={item}>{item}</option>)}</select>
        <button disabled={busy || user.uid===currentUser.uid || !roles.includes(user.role)} className="rounded-lg border border-slate-600 p-2 text-xs disabled:opacity-40" onClick={()=>void update(user,{active:user.active===false || user.accessVersion!==2,accessVersion:2})}>{user.active===false || user.accessVersion!==2 ? 'Activar' : 'Desactivar'}</button>
      </div>)}
    </section>
  </div>;
}
