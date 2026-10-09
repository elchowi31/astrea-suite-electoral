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
  onLogout,
}) => {
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  const [loading, setLoading] = useState<boolean>(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPin, setLoginPin] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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

  // Scoped list of users based on hierarchy (Candidate cannot see higher hierarchy)
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

  return (
    <div id="auth-modal-overlay" className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div id="auth-modal-content" className="bg-slate-900 border border-slate-700 rounded-3xl max-w-2xl w-full p-6 space-y-5 shadow-2xl relative max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center text-white font-bold shadow-lg shadow-blue-500/20">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 id="auth-modal-title" className="text-lg font-bold text-white tracking-tight">Gestión de Acceso y Perfiles</h2>
              <p className="text-xs text-slate-400">Jerarquías políticas y autenticación segura con Firestore</p>
            </div>
          </div>
          {!currentUser && <button
            id="auth-modal-close-btn"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white bg-slate-800 rounded-xl transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>}
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
        <div className="flex rounded-2xl bg-slate-950 p-1 border border-slate-800 text-xs">
          {!currentUser && <button
            id="auth-modal-tab-login"
            onClick={() => setActiveTab('login')}
            className={`flex-1 py-2 font-bold rounded-xl flex items-center justify-center gap-2 transition cursor-pointer ${
              activeTab === 'login'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            <span>Ingreso & Perfiles Autorizados</span>
          </button>}
          {!currentUser && <button
            id="auth-modal-tab-register"
            onClick={() => { setActiveTab('register'); setErrorMsg(null); }}
            className="flex-1 py-2 font-bold rounded-xl flex items-center justify-center gap-2 transition cursor-pointer text-slate-400 hover:text-slate-200"
          >
            <UserPlus className="w-4 h-4" />
            <span>Crear cuenta y organización</span>
          </button>}
        </div>

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
                  required
                  placeholder="usuario@organizacion.co"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex justify-between items-center pt-2">
                {currentUser && (
                  <button
                    type="button"
                    onClick={() => {
                      onLogout();
                      onClose();
                    }}
                    className="text-xs text-rose-400 hover:text-rose-300 font-bold flex items-center gap-1"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Cerrar Sesión</span>
                  </button>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="ml-auto px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs shadow-lg transition flex items-center gap-2 cursor-pointer"
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
          <form onSubmit={handleRegisterSubmit} className="space-y-3 text-xs"><p className="text-slate-300">Creará una organización propia. Para ingresar a un equipo existente, use la cuenta creada por su administrador.</p>
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

            <div className="pt-3 border-t border-slate-800 flex justify-end">
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
