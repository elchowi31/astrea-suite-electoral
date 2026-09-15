import React, { useState, useEffect } from 'react';
import { UserProfile, UserRole, ElectoralLevel, Tenant } from '../types';
import { CESAR_MUNICIPALITIES } from '../data/geography';
import { generarIdDocumentoLegible } from '../lib/slugify';
import { 
  loginWithEmailPassword, 
  registerWithEmailPassword, 
  loginWithGoogle,
  logSessionToFirestore,
  sendPasswordReset
} from '../lib/firebaseAuth';
import { filterUsersByScope, getRoleHierarchyLevel } from '../lib/permissions';
import { SynapticNeuralBackground } from './SynapticNeuralBackground';
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
  Sparkles, 
  Shield, 
  LogOut, 
  KeyRound,
  Phone,
  ExternalLink,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  Zap,
  Globe,
  Loader2,
  AlertCircle
} from 'lucide-react';

interface LoginViewProps {
  users: UserProfile[];
  currentUser: UserProfile | null;
  tenants: Tenant[];
  currentTenant: Tenant;
  onLogin: (user: UserProfile) => void;
  onRegister: (newUser: UserProfile) => void;
  onLogout: () => void;
  onContinueToApp?: () => void;
  onBackToLanding?: () => void;
}

export const LoginView: React.FC<LoginViewProps> = ({
  users,
  currentUser,
  tenants,
  currentTenant,
  onLogin,
  onRegister,
  onLogout,
  onContinueToApp,
  onBackToLanding
}) => {
  const [activeTab, setActiveTab] = useState<'direct' | 'register' | 'switch'>('direct');
  const [loading, setLoading] = useState<boolean>(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Direct login form state
  const [loginEmail, setLoginEmail] = useState(currentUser?.email || '');
  const [loginPassword, setLoginPassword] = useState('');

  // Streamlined Register form state
  const [prefix, setPrefix] = useState<'Dr.' | 'Dra.' | 'Ing.' | 'Lic.' | 'Abg.' | 'Sr.' | 'Sra.' | 'Economista'>('Dr.');
  const [fullName, setFullName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [role, setRole] = useState<UserRole>('Alcalde');
  const [municipality, setMunicipality] = useState('Astrea');
  const [party, setParty] = useState('');
  const [tenantId, setTenantId] = useState(currentTenant.tenantId || tenants[0]?.tenantId);
  const [phone, setPhone] = useState('');
  const [generatedUid, setGeneratedUid] = useState('');

  // Auto-generate predictive clean UID
  useEffect(() => {
    if (fullName) {
      const clean = `${prefix} ${fullName}`.trim();
      setGeneratedUid(generarIdDocumentoLegible('usuario', clean));
    } else {
      setGeneratedUid('usuario-nuevo-perfil');
    }
  }, [prefix, fullName]);

  // Role changes never overwrite organization data entered by the user.
  const handleRoleChange = (newRole: UserRole) => {
    setRole(newRole);
  };

  // 1. Direct Firebase Auth Login
  const handleDirectLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedbackMsg(null);
    setLoading(true);

    const cleanEmail = loginEmail.trim().toLowerCase();
    if (!cleanEmail) {
      setFeedbackMsg({ type: 'error', text: 'Por favor ingrese su correo electrónico institucional o de campaña.' });
      setLoading(false);
      return;
    }

    try {
      const result = await loginWithEmailPassword(cleanEmail, loginPassword);

      if (result.success && result.user) {
        setFeedbackMsg({ 
          type: 'success', 
          text: `¡Bienvenido(a)! Sesión autenticada en Firebase y registrada en Firestore para ${result.user.displayName}.` 
        });
        onLogin(result.user);
        if (onContinueToApp) {
          setTimeout(() => onContinueToApp(), 700);
        }
      } else {
        setFeedbackMsg({ 
          type: 'error', 
          text: result.error || 'Error al autenticar con Firebase.' 
        });
      }
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err?.message || 'Error de conexión con Firebase Auth.' });
    } finally {
      setLoading(false);
    }
  };

  // 2. Google Auth Login
  const handleGoogleLogin = async () => {
    setFeedbackMsg(null);
    setLoading(true);
    try {
      const result = await loginWithGoogle(currentTenant.tenantId);
      if (result.success && result.user) {
        setFeedbackMsg({ 
          type: 'success', 
          text: `Autenticación Google exitosa. Sesión iniciada como ${result.user.displayName}.` 
        });
        onLogin(result.user);
        if (onContinueToApp) {
          setTimeout(() => onContinueToApp(), 700);
        }
      } else {
        setFeedbackMsg({ 
          type: 'error', 
          text: result.error || 'No se pudo completar la autenticación con Google.' 
        });
      }
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err?.message || 'Error con el proveedor de Google.' });
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    try {
      setLoading(true);
      await sendPasswordReset(loginEmail);
      setFeedbackMsg({ type: 'success', text: 'Enviamos un enlace de recuperación a su correo, si la cuenta existe.' });
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err?.message || 'No fue posible enviar la recuperación.' });
    } finally {
      setLoading(false);
    }
  };

  // 3. Register New Candidate / User directly into Firebase Auth & Firestore
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !regEmail.trim() || regPassword.length < 8) {
      setFeedbackMsg({ type: 'error', text: 'Nombre, correo real y contraseña de mínimo 8 caracteres son obligatorios.' });
      return;
    }

    setFeedbackMsg(null);
    setLoading(true);

    try {
      let electoralLevel: ElectoralLevel = 'Alcaldía';
      if (role === 'Gobernador') electoralLevel = 'Gobernación';
      else if (role === 'Concejal') electoralLevel = 'Concejo Municipal';
      else if (role === 'Diputado') electoralLevel = 'Asamblea / Diputación';

      const emailToUse = regEmail.trim().toLowerCase();

      const result = await registerWithEmailPassword({
        displayName: fullName.trim(),
        email: emailToUse,
        prefix,
        tenantId: tenantId || currentTenant.tenantId,
        role,
        electoralLevel,
        party: party.trim() || 'Coalición 2026',
        department: 'Cesar',
        municipality,
        phone: phone.trim()
      }, regPassword);

      if (result.success && result.user) {
        setFeedbackMsg({
          type: 'success',
          text: 'Solicitud creada. El perfil inicia con acceso de consulta hasta que un administrador valide el rol solicitado.'
        });
        onRegister(result.user);
        onLogin(result.user);
        if (onContinueToApp) {
          setTimeout(() => onContinueToApp(), 900);
        }
      } else {
        setFeedbackMsg({
          type: 'error',
          text: result.error || 'Error al registrar el usuario en Firebase.'
        });
      }
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err?.message || 'Error al guardar el nuevo usuario en Firestore.' });
    } finally {
      setLoading(false);
    }
  };

  // Scoped users list (Strict Hierarchical Isolation - Candidates only see themselves and subordinates)
  const scopedUsers = filterUsersByScope(users, currentUser, currentUser?.role || 'Alcalde', currentTenant.tenantId);

  return (
    <div
      id="login-view-container"
      className="min-h-screen relative isolate overflow-hidden flex flex-col items-center justify-center p-4 sm:p-6 lg:p-10 bg-[#030712]"
      style={{ backgroundImage: 'radial-gradient(circle at 15% 18%, rgba(6,182,212,.22), transparent 32%), radial-gradient(circle at 85% 80%, rgba(20,184,166,.18), transparent 36%), radial-gradient(circle at 50% 50%, rgba(99,102,241,.12), transparent 45%)' }}
    >
      {/* Living Interactive Synaptic Canvas */}
      <SynapticNeuralBackground interactive={true} />

      <div className="absolute inset-0 -z-10 opacity-60 [background-size:48px_48px] [background-image:linear-gradient(rgba(34,211,238,.06)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,.06)_1px,transparent_1px)]" />

      {/* Hypnotic Synaptic Waves & Axon Impulse SVG */}
      <svg aria-hidden="true" className="absolute inset-0 -z-10 h-full w-full opacity-80 pointer-events-none" viewBox="0 0 1200 800" preserveAspectRatio="none">
        <defs>
          <linearGradient id="synapseGrad1" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.1" />
            <stop offset="30%" stopColor="#22d3ee" stopOpacity="0.8" />
            <stop offset="70%" stopColor="#818cf8" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#2dd4bf" stopOpacity="0.1" />
          </linearGradient>
          <linearGradient id="synapseGrad2" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.2" />
            <stop offset="50%" stopColor="#c084fc" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.2" />
          </linearGradient>
          <filter id="glow-synapse" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        <style>
          {`
            @keyframes pulseTravel {
              0% { stroke-dashoffset: 1200; }
              100% { stroke-dashoffset: 0; }
            }
            @keyframes synapticPulse {
              0%, 100% { r: 4px; opacity: 0.7; filter: drop-shadow(0 0 4px #22d3ee); }
              50% { r: 7.5px; opacity: 1; filter: drop-shadow(0 0 12px #67e8f9); }
            }
            @keyframes synapticWaveFloat {
              0%, 100% { transform: translateY(0px) scaleY(1); }
              50% { transform: translateY(-12px) scaleY(1.04); }
            }
            .synaptic-wave-1 {
              stroke-dasharray: 20 8 4 8;
              animation: pulseTravel 28s linear infinite;
            }
            .synaptic-wave-2 {
              stroke-dasharray: 12 12;
              animation: pulseTravel 35s linear infinite reverse;
            }
            .synaptic-wave-3 {
              animation: pulseTravel 22s linear infinite;
            }
            .synaptic-node {
              animation: synapticPulse 3.5s ease-in-out infinite;
            }
          `}
        </style>

        {/* Primary Synaptic Axon Waves */}
        <g className="synaptic-wave-float" style={{ animation: 'synapticWaveFloat 8s ease-in-out infinite' }}>
          <path d="M-80 570 C180 440 230 740 450 510 S760 250 1280 390" fill="none" stroke="url(#synapseGrad1)" strokeWidth="2" filter="url(#glow-synapse)" className="synaptic-wave-1" />
          <path d="M-60 260 C240 360 300 70 570 240 S970 540 1260 130" fill="none" stroke="url(#synapseGrad2)" strokeWidth="1.8" filter="url(#glow-synapse)" className="synaptic-wave-2" />
          <path d="M0 400 Q300 620 600 380 T1200 420" fill="none" stroke="rgba(45,212,191,0.3)" strokeWidth="1.2" className="synaptic-wave-3" />
        </g>

        {/* Bioluminescent Synaptic Nodes */}
        <g fill="#67e8f9">
          <circle cx="230" cy="500" r="5" className="synaptic-node" style={{ animationDelay: '0s' }} />
          <circle cx="450" cy="510" r="5.5" className="synaptic-node" style={{ animationDelay: '0.8s' }} />
          <circle cx="760" cy="320" r="6" className="synaptic-node" style={{ animationDelay: '1.6s' }} />
          <circle cx="970" cy="330" r="5" className="synaptic-node" style={{ animationDelay: '2.4s' }} />
          <circle cx="570" cy="240" r="4.5" className="synaptic-node" style={{ animationDelay: '1.2s' }} />
          <circle cx="300" cy="180" r="4" className="synaptic-node" style={{ animationDelay: '2.8s' }} />
        </g>
      </svg>

      {/* Top Navigation: Return to Landing Page */}
      {onBackToLanding && (
        <div className="w-full max-w-2xl flex items-center justify-between mb-4 animate-[fade-in_500ms_ease-out]">
          <button
            type="button"
            onClick={onBackToLanding}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-slate-900/90 hover:bg-slate-800 text-cyan-300 hover:text-white border border-cyan-500/30 text-xs font-bold shadow-xl shadow-cyan-950/40 backdrop-blur-md transition-all duration-300 transform hover:-translate-y-0.5 cursor-pointer group"
          >
            <ArrowLeft className="w-4 h-4 text-cyan-400 group-hover:-translate-x-1 transition-transform" />
            <span>Volver a la Página Principal</span>
          </button>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950/80 border border-slate-800 text-[11px] text-slate-400 font-mono">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span>Astrea Suite · Mando Territorial</span>
          </div>
        </div>
      )}

      <div className="w-full max-w-2xl mb-7 text-center animate-[fade-in_700ms_ease-out]">
        <p className="text-cyan-300 text-xs tracking-[.32em] font-bold uppercase mb-3">Inteligencia territorial conectada</p>
        <h1 className="text-4xl sm:text-6xl font-black leading-[.92] tracking-tight">
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-sky-200 to-indigo-300 drop-shadow-lg">
            Astrea Suite Electoral
          </span>
        </h1>
        <p className="mt-4 text-sm sm:text-base text-slate-300 max-w-xl mx-auto">La plataforma que transforma operación territorial en decisiones de campaña precisas, seguras y medibles.</p>
      </div>
      
      {/* Container Card */}
      <div 
        id="login-main-card"
        className="w-full max-w-2xl bg-slate-950/80 backdrop-blur-xl border border-cyan-300/20 rounded-[2rem] p-6 sm:p-8 shadow-2xl shadow-cyan-950/30 space-y-6 relative overflow-hidden"
      >
        
        {/* Background ambient accents */}
        <div className="absolute -top-24 -right-24 w-72 h-72 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />

        {/* Top Brand & Hierarchy Header */}
        <div id="login-header-section" className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div className="flex items-center gap-3.5">
            <div 
              id="login-tenant-badge"
              className="w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-xl shadow-lg border border-white/20 shrink-0"
              style={{ backgroundColor: currentTenant.primaryColor || '#2563eb' }}
            >
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 id="login-title" className="text-xl font-black text-white tracking-tight flex items-center gap-2">
                Acceso al Comando Electoral Territorial
                <span className="text-[10px] bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded-full font-mono">
                  Multi-Tenant
                </span>
              </h1>
              <p id="login-tenant-info" className="text-xs text-slate-400 mt-0.5">
                Organización: <strong className="text-slate-200">{currentTenant.name}</strong> • Departamento del Cesar
              </p>
            </div>
          </div>

          {currentUser ? (
            <div id="login-current-user-pill" className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-2xl border border-slate-800">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <div className="text-[11px] text-right">
                <p className="font-bold text-white leading-none">{currentUser.prefix ? `${currentUser.prefix} ` : ''}{currentUser.displayName}</p>
                <p className="text-blue-400 text-[10px]">{currentUser.role} ({currentUser.municipality || 'Astrea'})</p>
              </div>
            </div>
          ) : (
            <span className="text-[11px] text-slate-400 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
              🔒 Sesión No Iniciada
            </span>
          )}
        </div>

        {/* Security & Hierarchy Guarantee Notice */}
        <div id="login-security-notice" className="p-3 bg-slate-950/90 border border-blue-500/30 rounded-2xl flex items-start gap-2.5 text-xs text-slate-300">
          <ShieldCheck className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-bold text-white block">Aislamiento Jerárquico y Seguridad Multi-Tenant Activa</span>
            <p className="text-[11px] text-slate-400">
              Cada candidato visualiza estrictamente su información territorial y hacia abajo (municipio, concejales y líderes aliados). No es posible acceder a otros candidatos ni niveles jerárquicos superiores.
            </p>
          </div>
        </div>

        {/* Feedback Messages */}
        {feedbackMsg && (
          <div 
            id="login-feedback-alert"
            className={`p-3.5 rounded-2xl text-xs flex items-center gap-2.5 border ${
              feedbackMsg.type === 'success' 
                ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-200' 
                : 'bg-rose-950/80 border-rose-500/50 text-rose-200'
            }`}
          >
            {feedbackMsg.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span className="font-medium">{feedbackMsg.text}</span>
          </div>
        )}

        {/* Tab Navigation */}
        <div id="login-tab-selector" className="flex rounded-2xl bg-slate-950 p-1.5 border border-slate-800 text-xs">
          <button
            id="tab-btn-direct"
            type="button"
            onClick={() => { setActiveTab('direct'); setFeedbackMsg(null); }}
            className={`flex-1 py-2.5 font-bold rounded-xl flex items-center justify-center gap-2 transition cursor-pointer ${
              activeTab === 'direct'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Mail className="w-4 h-4" />
            <span>Ingreso Directo / Correo</span>
          </button>

          <button
            id="tab-btn-register"
            type="button"
            onClick={() => { setActiveTab('register'); setFeedbackMsg(null); }}
            className={`flex-1 py-2.5 font-bold rounded-xl flex items-center justify-center gap-2 transition cursor-pointer ${
              activeTab === 'register'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <UserPlus className="w-4 h-4" />
            <span>Registrar Nuevo Aspirante</span>
          </button>

          {currentUser && (
            <button
              id="tab-btn-switch"
              type="button"
              onClick={() => { setActiveTab('switch'); setFeedbackMsg(null); }}
              className={`flex-1 py-2.5 font-bold rounded-xl flex items-center justify-center gap-2 transition cursor-pointer ${
                activeTab === 'switch'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <UserCheck className="w-4 h-4" />
              <span>Mi Equipo ({scopedUsers.length})</span>
            </button>
          )}
        </div>

        {/* TAB 1: DIRECT LOGIN (Email & Password + Google) */}
        {activeTab === 'direct' && (
          <form id="form-direct-login" autoComplete="on" onSubmit={handleDirectLogin} className="space-y-4">
            
            <div className="space-y-3">
              <div>
                <label id="lbl-login-email" className="block text-xs font-bold text-slate-300 mb-1">
                  Correo Electrónico del Aspirante o Administrador *
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                  <input
                    id="input-login-email"
                    type="email"
                    autoComplete="username"
                    required
                    placeholder="usuario@organizacion.co"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl pl-10 pr-3 py-2.5 text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Autentica directamente contra Firebase Authentication (<code className="text-amber-300 font-mono">gen-lang-client-0498782352</code>).
                </span>
              </div>

              <div>
                <label id="lbl-login-password" className="block text-xs font-bold text-slate-300 mb-1">
                  Contraseña o PIN de Seguridad
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                  <input
                    id="input-login-password"
                    type="password"
                    autoComplete="current-password"
                    required
                    placeholder="Ingrese su contraseña o PIN"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl pl-10 pr-3 py-2.5 text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={handlePasswordReset}
                disabled={loading}
                className="text-[11px] font-semibold text-cyan-300 hover:text-cyan-100 transition"
              >
                ¿Olvidó su contraseña?
              </button>
            </div>

            {/* Submit & Google Action */}
            <div className="space-y-3 pt-2">
              <button
                id="btn-submit-direct-login"
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs shadow-lg shadow-blue-600/30 transition flex items-center justify-center gap-2 cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Autenticando en Firebase...</span>
                  </>
                ) : (
                  <>
                    <KeyRound className="w-4 h-4" />
                    <span>Iniciar Sesión en Firebase Authentication</span>
                  </>
                )}
              </button>

              <div className="relative flex items-center justify-center">
                <div className="border-t border-slate-800 w-full" />
                <span className="bg-slate-900 px-3 text-[10px] text-slate-400 font-semibold uppercase">O continuar con</span>
                <div className="border-t border-slate-800 w-full" />
              </div>

              <button
                id="btn-google-auth-login"
                type="button"
                onClick={handleGoogleLogin}
                disabled={loading}
                className="w-full py-2.5 bg-slate-950 hover:bg-slate-800 border border-slate-700 text-white font-bold rounded-xl text-xs transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <Globe className="w-4 h-4 text-emerald-400" />
                <span>Acceder con Google</span>
              </button>
            </div>

            {currentUser && onContinueToApp && (
              <div className="pt-3 border-t border-slate-800 flex justify-between items-center">
                <span className="text-[11px] text-slate-400">
                  Sesión activa: <strong className="text-white">{currentUser.displayName}</strong> ({currentUser.role})
                </span>
                <button
                  id="btn-continue-current"
                  type="button"
                  onClick={onContinueToApp}
                  className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition cursor-pointer"
                >
                  <span>Entrar al Tablero</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </form>
        )}

        {/* TAB 2: REGISTER NEW CANDIDATE / USER */}
        {activeTab === 'register' && (
          <form id="form-register-user" autoComplete="on" onSubmit={handleRegister} className="space-y-4 text-xs">
            
            {/* Predictive Firestore ID */}
            <div id="register-firestore-id-badge" className="bg-slate-950 border border-blue-500/30 p-2.5 rounded-xl flex items-center justify-between text-xs">
              <div className="space-y-0.5">
                <span className="text-[10px] uppercase font-bold text-blue-400 tracking-wider block">
                  Documento Firestore Destino:
                </span>
                <span className="font-mono font-bold text-white text-xs">/usuarios/{generatedUid}</span>
              </div>
              <span className="text-[9px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-md font-bold">
                Auto-sincronizado
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Prefix */}
              <div>
                <label id="lbl-reg-prefix" className="block text-slate-300 font-bold mb-1">Tratamiento / Título</label>
                <select
                  id="select-reg-prefix"
                  value={prefix}
                  onChange={(e) => setPrefix(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500"
                >
                  <option value="Dr.">Dr.</option>
                  <option value="Dra.">Dra.</option>
                  <option value="Ing.">Ing.</option>
                  <option value="Lic.">Lic.</option>
                  <option value="Abg.">Abg.</option>
                  <option value="Sr.">Sr.</option>
                  <option value="Sra.">Sra.</option>
                  <option value="Economista">Economista</option>
                </select>
              </div>

              {/* Full Name */}
              <div className="sm:col-span-2">
                <label id="lbl-reg-fullname" className="block text-slate-300 font-bold mb-1">Nombre Completo del Aspirante *</label>
                <input
                  id="input-reg-fullname"
                  type="text"
                  autoComplete="name"
                  required
                  placeholder="Ej: Marcos Pérez / Sandra Castro"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Role */}
              <div>
                <label id="lbl-reg-role" className="block text-slate-300 font-bold mb-1">Aspiración Política (Jerarquía) *</label>
                <select
                  id="select-reg-role"
                  value={role}
                  onChange={(e) => handleRoleChange(e.target.value as UserRole)}
                  className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500 font-medium"
                >
                  <option value="Alcalde">🏛️ Candidato Alcaldía Municipal</option>
                  <option value="Gobernador">🎖️ Candidato Gobernación Departamental</option>
                  <option value="Concejal">📋 Candidato Concejo Municipal</option>
                  <option value="Diputado">🏛️ Candidato Asamblea Departamental</option>
                  <option value="JefePolitico">👔 Jefe Político / Estratega</option>
                  <option value="LiderVeredal">📍 Líder Territorial / Veredal</option>
                  <option value="AdminGlobal">👑 Administrador Global</option>
                </select>
              </div>

              {/* Municipality */}
              <div>
                <label id="lbl-reg-muni" className="block text-slate-300 font-bold mb-1">Municipio Territorial *</label>
                <select
                  id="select-reg-muni"
                  value={municipality}
                  onChange={(e) => setMunicipality(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500 font-medium"
                >
                  {CESAR_MUNICIPALITIES.map((muni) => (
                    <option key={muni} value={muni}>
                      {muni}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Email */}
              <div>
                <label id="lbl-reg-email" className="block text-slate-300 font-bold mb-1">Correo Electrónico (Firebase Auth) *</label>
                <input
                  id="input-reg-email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="usuario@organizacion.co"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Password */}
              <div>
                <label id="lbl-reg-pass" className="block text-slate-300 font-bold mb-1">Contraseña de Acceso</label>
                <input
                  id="input-reg-pass"
                  type="password"
                  autoComplete="new-password"
                  required
                  placeholder="Mínimo 8 caracteres"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Party */}
              <div>
                <label id="lbl-reg-party" className="block text-slate-300 font-bold mb-1">Movimiento Político / Coalición</label>
                <input
                  id="input-reg-party"
                  type="text"
                  placeholder="Ej: Pacto por Astrea 2026"
                  value={party}
                  onChange={(e) => setParty(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Phone */}
              <div>
                <label id="lbl-reg-phone" className="block text-slate-300 font-bold mb-1">Teléfono Móvil / WhatsApp</label>
                <input
                  id="input-reg-phone"
                  type="text"
                  placeholder="Número con código de país"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between border-t border-slate-800">
              <span className="text-[10px] text-slate-400">
                Se sincronizará en Firebase Authentication y colección <code className="text-blue-300 font-mono">/usuarios</code> en Firestore.
              </span>
              
              <button
                id="btn-submit-register"
                type="submit"
                disabled={loading}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs shadow-lg shadow-emerald-600/30 transition flex items-center gap-2 cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Guardando en Firebase...</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    <span>Crear Perfil & Registrar Inicio de Sesión</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* TAB 3: MI EQUIPO Y CAMBIO DE PERFIL AUTORIZADO (STRICT HIERARCHY FILTER) */}
        {activeTab === 'switch' && currentUser && (
          <div id="team-switch-container" className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Perfiles Autorizados en su Ámbito Territorial ({currentUser.municipality || 'Astrea'}):
              </span>
              <span className="text-[11px] text-emerald-400 font-semibold">
                Nivel {getRoleHierarchyLevel(currentUser.role)} hacia abajo
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-72 overflow-y-auto pr-1">
              {scopedUsers.map((u) => {
                const isCurrent = currentUser?.uid === u.uid;
                return (
                  <div
                    key={u.uid}
                    id={`team-user-item-${u.uid}`}
                    onClick={() => {
                      onLogin(u);
                      logSessionToFirestore(u, 'cambio_perfil_autorizado');
                      if (onContinueToApp) onContinueToApp();
                    }}
                    className={`p-3.5 rounded-2xl border text-left cursor-pointer transition flex items-start justify-between gap-3 ${
                      isCurrent
                        ? 'bg-blue-900/30 border-blue-500 ring-2 ring-blue-500/30'
                        : 'bg-slate-950/80 border-slate-800 hover:border-slate-600 hover:bg-slate-800/80'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-md">
                        {u.prefix || 'Dr.'}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-white leading-tight">
                            {u.prefix ? `${u.prefix} ` : ''}{u.displayName}
                          </span>
                          {isCurrent && (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          )}
                        </div>
                        <p className="text-[11px] text-blue-400 font-semibold mt-0.5">
                          {u.role} • {u.electoralLevel || 'Campaña'}
                        </p>
                        <p className="text-[10px] text-slate-400 truncate max-w-[180px]">
                          {u.party || 'Partido 2026'}
                        </p>
                        <p className="text-[10px] text-amber-300 font-mono mt-0.5">
                          📍 {u.municipality || 'Astrea'}, {u.department || 'Cesar'}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="px-2.5 py-1 bg-blue-600/20 text-blue-300 hover:bg-blue-600 hover:text-white border border-blue-500/30 rounded-lg text-[10px] font-bold transition shrink-0"
                    >
                      Seleccionar
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-between items-center">
              <button
                type="button"
                onClick={onLogout}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Cerrar Sesión Activa</span>
              </button>

              {onContinueToApp && (
                <button
                  type="button"
                  onClick={onContinueToApp}
                  className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-emerald-600/20 transition cursor-pointer"
                >
                  <span>Continuar al Tablero</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
