import React, { useState, useEffect } from 'react';
import { UserProfile, UserRole, ElectoralLevel, Tenant } from '../types';
import { CESAR_MUNICIPALITIES } from '../data/geography';
import { generarIdDocumentoLegible } from '../lib/slugify';
import { filterUsersByScope, getRoleHierarchyLevel } from '../lib/permissions';
import { loginWithEmailPassword, registerWithEmailPassword, logSessionToFirestore } from '../lib/firebaseAuth';
import { 
  User, 
  Lock, 
  Mail, 
  UserCheck, 
  UserPlus, 
  Building2, 
  MapPin, 
  Flag, 
  Award, 
  CheckCircle2, 
  X, 
  Sparkles, 
  Shield, 
  LogOut, 
  KeyRound,
  Phone,
  ExternalLink,
  ShieldCheck,
  Loader2
} from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: UserProfile[];
  currentUser: UserProfile | null;
  tenants: Tenant[];
  onLogin: (user: UserProfile) => void;
  onRegister: (newUser: UserProfile) => void;
  onUpdateProfile: (updatedUser: UserProfile) => Promise<void>;
  onLogout: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  users,
  currentUser,
  tenants,
  onLogin,
  onRegister,
  onUpdateProfile,
  onLogout,
}) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'login' | 'register'>(currentUser ? 'profile' : 'login');
  const [loading, setLoading] = useState<boolean>(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPin, setLoginPin] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Synchronize initial tab when modal opens or user changes
  useEffect(() => {
    if (isOpen) {
      if (currentUser) {
        setActiveTab('profile');
      } else {
        setActiveTab('login');
      }
      setErrorMsg(null);
    }
  }, [isOpen, currentUser]);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Register form state
  const [prefix, setPrefix] = useState<'Dr.' | 'Dra.' | 'Ing.' | 'Lic.' | 'Abg.' | 'Sr.' | 'Sra.' | 'Economista'>('Dr.');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<UserRole>('Alcalde');
  const [electoralLevel, setElectoralLevel] = useState<ElectoralLevel>('Alcaldía');
  const [party, setParty] = useState('');
  const [department, setDepartment] = useState('Cesar');
  const [municipality, setMunicipality] = useState('Astrea');
  const [tenantId, setTenantId] = useState(tenants[0]?.tenantId || 'tenant-astrea-2026');
  const [generatedUid, setGeneratedUid] = useState('');
  const [profileDraft, setProfileDraft] = useState({
    fullName: currentUser?.fullName || currentUser?.displayName || '',
    prefix: currentUser?.prefix || 'Dr.',
    phone: currentUser?.phone || '',
    municipality: currentUser?.municipality || 'Astrea',
    department: currentUser?.department || 'Cesar',
    party: currentUser?.party || '',
  });

  useEffect(() => {
    if (!currentUser) return;
    setProfileDraft({
      fullName: currentUser.fullName || currentUser.displayName || '',
      prefix: currentUser.prefix || 'Dr.',
      phone: currentUser.phone || '',
      municipality: currentUser.municipality || 'Astrea',
      department: currentUser.department || 'Cesar',
      party: currentUser.party || '',
    });
  }, [currentUser]);

  // Scoped list of users based on hierarchy
  const scopedUsers = filterUsersByScope(users, currentUser, currentUser?.role || 'Alcalde', currentUser?.tenantId || tenants[0]?.tenantId);

  // Auto-generate predictive UID for new user
  useEffect(() => {
    if (fullName) {
      const cleanName = `${prefix} ${fullName}`.trim();
      setGeneratedUid(generarIdDocumentoLegible('usuario', cleanName));
    } else {
      setGeneratedUid('usuario-nuevo-perfil');
    }
  }, [prefix, fullName]);

  const handleRoleChange = (newRole: UserRole) => {
    setRole(newRole);
    if (newRole === 'Alcalde') setElectoralLevel('Alcaldía');
    else if (newRole === 'Gobernador') setElectoralLevel('Gobernación');
    else if (newRole === 'Concejal') setElectoralLevel('Concejo Municipal');
    else if (newRole === 'Diputado') setElectoralLevel('Asamblea / Diputación');
  };

  if (!isOpen) return null;

  const handleManualLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    const cleanEmail = loginEmail.trim().toLowerCase();
    try {
      const result = await loginWithEmailPassword(cleanEmail, loginPin);
      if (result.success && result.user) {
        onLogin(result.user);
        onClose();
      } else {
        setErrorMsg(result.error || 'Error al autenticar');
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim() || loginPin.length < 8) {
      setErrorMsg('Ingrese nombre, correo y una contraseña de al menos 8 caracteres.');
      return;
    }
    setErrorMsg(null);
    setLoading(true);

    try {
      const result = await registerWithEmailPassword({
        displayName: fullName.trim(),
        email: email.trim(),
        prefix,
        tenantId,
        role,
        electoralLevel,
        party: party.trim(),
        department,
        municipality,
        phone: phone.trim(),
      }, loginPin);

      if (result.success && result.user) {
        onRegister(result.user);
        onLogin(result.user);
        onClose();
      } else {
        setErrorMsg(result.error || 'Error al registrar usuario');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error al guardar');
    } finally {
      setLoading(false);
    }
  };

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !profileDraft.fullName.trim()) {
      setErrorMsg('El nombre completo es obligatorio.');
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    try {
      await onUpdateProfile({
        ...currentUser,
        displayName: profileDraft.fullName.trim(),
        fullName: profileDraft.fullName.trim(),
        prefix: profileDraft.prefix,
        phone: profileDraft.phone.trim(),
        municipality: profileDraft.municipality,
        department: profileDraft.department,
        party: profileDraft.party.trim(),
      });
    } catch (error: any) {
      setErrorMsg(error?.message || 'No fue posible actualizar el perfil.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      id="auth-modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
    >
      <div
        id="auth-modal-content"
        className="bg-slate-900 border border-slate-700 rounded-3xl max-w-2xl w-full p-6 space-y-5 shadow-2xl relative max-h-[90vh] overflow-y-auto"
      >
        
        {/* Header with Clear Close & Return Button */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center text-white font-bold shadow-lg shadow-blue-500/20">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 id="auth-modal-title" className="text-lg font-bold text-white tracking-tight">
                {currentUser ? 'Mi Perfil y Credenciales de Campaña' : 'Gestión de Acceso y Perfiles'}
              </h2>
              <p className="text-xs text-slate-400">Jerarquías políticas y autenticación segura con Firestore</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              id="auth-modal-return-dashboard-btn"
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 border border-slate-700 shadow-sm cursor-pointer"
              title="Cerrar y volver al Centro de Control"
            >
              <span>← Volver al Dashboard</span>
            </button>
            <button
              id="auth-modal-close-btn"
              type="button"
              onClick={onClose}
              aria-label="Cerrar modal"
              className="p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Security / Hierarchy Notice */}
        <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 flex items-start gap-2.5 text-xs text-slate-300">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <p className="text-[11px] text-slate-400 leading-relaxed">
            <strong className="text-white">Aislamiento por Nivel:</strong> Los candidatos únicamente pueden gestionar accesos de su propio equipo municipal o niveles inferiores.
          </p>
        </div>

        {errorMsg && (
          <div className="p-3 bg-rose-950/80 border border-rose-500/50 rounded-xl text-xs text-rose-200">
            {errorMsg}
          </div>
        )}

        {/* Tabs */}
        <div className="flex rounded-2xl bg-slate-950 p-1 border border-slate-800 text-xs gap-1">
          {currentUser && (
            <button
              id="auth-modal-tab-profile"
              type="button"
              onClick={() => setActiveTab('profile')}
              className={`flex-1 py-2 font-bold rounded-xl flex items-center justify-center gap-2 transition cursor-pointer ${
                activeTab === 'profile'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <UserCheck className="w-4 h-4" />
              <span>Mi Perfil Activo</span>
            </button>
          )}

          <button
            id="auth-modal-tab-login"
            type="button"
            onClick={() => setActiveTab('login')}
            className={`flex-1 py-2 font-bold rounded-xl flex items-center justify-center gap-2 transition cursor-pointer ${
              activeTab === 'login'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <KeyRound className="w-4 h-4" />
            <span>{currentUser ? 'Cambiar Cuenta' : 'Ingreso & Perfiles'}</span>
          </button>

          <button
            id="auth-modal-tab-register"
            type="button"
            onClick={() => setActiveTab('register')}
            className={`flex-1 py-2 font-bold rounded-xl flex items-center justify-center gap-2 transition cursor-pointer ${
              activeTab === 'register'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <UserPlus className="w-4 h-4" />
            <span>Nuevo Aspirante</span>
          </button>
        </div>

        {/* TAB 0: CURRENT USER PROFILE CARD */}
        {activeTab === 'profile' && currentUser && (
          <div className="space-y-4">
            <div className="bg-gradient-to-br from-slate-950 to-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white text-xl font-black shadow-lg shadow-blue-500/20 border border-white/20">
                  {currentUser.prefix || 'Dr.'}
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    {currentUser.prefix ? `${currentUser.prefix} ` : ''}{currentUser.displayName}
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-semibold">
                      Sesión Activa
                    </span>
                  </h3>
                  <p className="text-xs text-blue-400 font-medium">{currentUser.email}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {currentUser.role} • {currentUser.municipality || 'Astrea'} ({currentUser.department || 'Cesar'})
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-800/80 text-xs">
                <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                  <p className="text-[10px] text-slate-500 font-semibold uppercase">Rol de Campaña</p>
                  <p className="font-bold text-white mt-0.5">{currentUser.role}</p>
                </div>
                <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                  <p className="text-[10px] text-slate-500 font-semibold uppercase">Nivel Electoral</p>
                  <p className="font-bold text-cyan-300 mt-0.5">{currentUser.electoralLevel || 'Alcaldía'}</p>
                </div>
                <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                  <p className="text-[10px] text-slate-500 font-semibold uppercase">Jurisdicción</p>
                  <p className="font-bold text-amber-300 mt-0.5">{currentUser.municipality || 'Astrea'}</p>
                </div>
                <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                  <p className="text-[10px] text-slate-500 font-semibold uppercase">Organización / Tenant</p>
                  <p className="font-bold text-slate-300 mt-0.5 truncate">{currentUser.tenantId || 'Astrea 2026'}</p>
                </div>
              </div>
            </div>

            <form onSubmit={handleProfileSave} className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h4 className="text-sm font-black text-white">Editar información personal</h4>
                <span className="text-[10px] text-emerald-400">Guardado en Firestore</span>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="text-xs font-bold text-slate-300 sm:col-span-2">Nombre y apellidos
                  <input value={profileDraft.fullName} onChange={(e) => setProfileDraft((draft) => ({ ...draft, fullName: e.target.value }))} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400" />
                </label>
                <label className="text-xs font-bold text-slate-300">Tratamiento
                  <select value={profileDraft.prefix} onChange={(e) => setProfileDraft((draft) => ({ ...draft, prefix: e.target.value }))} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400">
                    {['Dr.', 'Dra.', 'Ing.', 'Lic.', 'Abg.', 'Sr.', 'Sra.', 'Economista'].map((item) => <option key={item}>{item}</option>)}
                  </select>
                </label>
                <label className="text-xs font-bold text-slate-300">Teléfono
                  <input type="tel" value={profileDraft.phone} onChange={(e) => setProfileDraft((draft) => ({ ...draft, phone: e.target.value }))} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400" />
                </label>
                <label className="text-xs font-bold text-slate-300">Municipio
                  <select value={profileDraft.municipality} onChange={(e) => setProfileDraft((draft) => ({ ...draft, municipality: e.target.value }))} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400">{CESAR_MUNICIPALITIES.map((item) => <option key={item} value={item}>{item}</option>)}</select>
                </label>
                <label className="text-xs font-bold text-slate-300">Departamento
                  <input value={profileDraft.department} onChange={(e) => setProfileDraft((draft) => ({ ...draft, department: e.target.value }))} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400" />
                </label>
                <label className="text-xs font-bold text-slate-300 sm:col-span-2">Partido o movimiento
                  <input value={profileDraft.party} onChange={(e) => setProfileDraft((draft) => ({ ...draft, party: e.target.value }))} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400" />
                </label>
              </div>
              <button type="submit" disabled={loading} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-600 px-4 py-2.5 text-xs font-black text-white transition hover:bg-cyan-500 disabled:opacity-50">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Guardar cambios del perfil
              </button>
            </form>

            {/* Profile Actions: Back to Dashboard & Logout */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  onLogout();
                  onClose();
                }}
                className="w-full sm:w-auto px-4 py-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 hover:text-rose-200 border border-rose-500/30 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Cerrar Sesión</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-blue-600/30 transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>← Volver al Centro de Control (Dashboard)</span>
              </button>
            </div>
          </div>
        )}

        {/* TAB 1: LOGIN */}
        {activeTab === 'login' && (
          <div className="space-y-4">
            
            {/* Scoped Users List */}
            {scopedUsers.length > 0 && (
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-2">
                  Perfiles en su Jurisdicción ({currentUser?.municipality || 'Astrea'}):
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                  {scopedUsers.map((u) => {
                    const isSelected = currentUser?.uid === u.uid;
                    return (
                      <div
                        key={u.uid}
                        className={`p-2.5 rounded-xl border text-left transition flex items-center justify-between ${
                          isSelected
                            ? 'bg-blue-900/30 border-blue-500'
                            : 'bg-slate-950/60 border-slate-800 hover:border-slate-600'
                        }`}
                      >
                        <div className="truncate">
                          <p className="text-xs font-bold text-white truncate">{u.prefix ? `${u.prefix} ` : ''}{u.displayName}</p>
                          <p className="text-[10px] text-blue-400 font-medium">{u.role} ({u.municipality || 'Astrea'})</p>
                        </div>
                        {isSelected && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Direct Login Form */}
            <form onSubmit={handleManualLogin} className="space-y-3 pt-2 border-t border-slate-800">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Correo Electrónico (Firebase Auth)</label>
                <input
                  type="email"
                  name="email"
                  autoComplete="username"
                  required
                  placeholder="usuario@organizacion.co"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Contraseña o PIN de Seguridad</label>
                <input
                  type="password"
                  name="password"
                  autoComplete="current-password"
                  required
                  placeholder="••••••••"
                  value={loginPin}
                  onChange={(e) => setLoginPin(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold rounded-xl border border-slate-700 transition cursor-pointer"
                >
                  ← Cancelar y Volver
                </button>
                
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs shadow-lg transition flex items-center gap-2 cursor-pointer"
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>Autenticar en Firebase</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* TAB 2: REGISTER */}
        {activeTab === 'register' && (
          <form onSubmit={handleRegisterSubmit} className="space-y-3 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <label className="block text-slate-300 font-bold mb-1">Tratamiento</label>
                <select
                  value={prefix}
                  onChange={(e) => setPrefix(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-2.5 py-1.5 text-xs"
                >
                  <option value="Dr.">Dr.</option>
                  <option value="Dra.">Dra.</option>
                  <option value="Ing.">Ing.</option>
                  <option value="Lic.">Lic.</option>
                  <option value="Abg.">Abg.</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-slate-300 font-bold mb-1">Nombre Completo *</label>
                <input
                  type="text"
                  name="name"
                  autoComplete="name"
                  required
                  placeholder="Nombre y apellidos"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-2.5 py-1.5 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="block text-slate-300 font-bold mb-1">Aspiración / Rol</label>
                <select
                  value={role}
                  onChange={(e) => handleRoleChange(e.target.value as UserRole)}
                  className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-2.5 py-1.5 text-xs"
                >
                  <option value="Alcalde">🏛️ Candidato Alcaldía</option>
                  <option value="Concejal">📋 Candidato Concejo</option>
                  <option value="Gobernador">🎖️ Candidato Gobernación</option>
                  <option value="Diputado">🏛️ Candidato Asamblea</option>
                  <option value="LiderVeredal">📍 Líder Territorial</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">Municipio</label>
                <select
                  value={municipality}
                  onChange={(e) => setMunicipality(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-2.5 py-1.5 text-xs"
                >
                  {CESAR_MUNICIPALITIES.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="block text-slate-300 font-bold mb-1">Correo Electrónico *</label>
                <input
                  type="email"
                  name="email"
                  autoComplete="email"
                  placeholder="usuario@organizacion.co"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-2.5 py-1.5 text-xs"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">Partido o Movimiento</label>
                <input
                  type="text"
                  placeholder="Ej: Pacto por Astrea 2026"
                  value={party}
                  onChange={(e) => setParty(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-2.5 py-1.5 text-xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-300 font-bold mb-1">Contraseña (Mínimo 8 caracteres)</label>
              <input
                type="password"
                name="password"
                autoComplete="new-password"
                required
                placeholder="••••••••"
                value={loginPin}
                onChange={(e) => setLoginPin(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-2.5 py-1.5 text-xs"
              />
            </div>

            <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold rounded-xl border border-slate-700 transition cursor-pointer"
              >
                ← Cancelar y Volver
              </button>

              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition flex items-center gap-2 cursor-pointer shadow-lg"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>Guardar y Entrar</span>
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
};
