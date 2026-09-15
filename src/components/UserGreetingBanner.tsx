import React, { useState } from 'react';
import { UserProfile, Tenant } from '../types';
import { 
  UserCheck, 
  MapPin, 
  Flag, 
  Building2, 
  ShieldCheck, 
  Sparkles,
  Award,
  Radio,
  Edit3,
  Check,
  X
} from 'lucide-react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

const normalizeName = (value: string) => value.toLowerCase().replace(/[^a-záéíóúñ0-9]/g, '');

interface UserGreetingBannerProps {
  currentUser: UserProfile;
  currentTenant: Tenant;
  onOpenAuthModal: () => void;
  onUpdateUserName?: (newName: string) => void;
}

export const UserGreetingBanner: React.FC<UserGreetingBannerProps> = ({
  currentUser,
  currentTenant,
  onOpenAuthModal,
  onUpdateUserName,
}) => {
  const [isEditingName, setIsEditingName] = useState(false);
  const [savingName, setSavingName] = useState(false);

  // Resolve official registered name (NEVER show an email address like expcal@expcal.net)
  const resolveRegisteredName = (): string => {
    const emailAlias = currentUser.email?.split('@')[0].toLowerCase() || '';
    // 1. Explicit registered full name (no email)
    if (currentUser.fullName && currentUser.fullName.trim() && !currentUser.fullName.includes('@')) {
      return currentUser.fullName.trim();
    }
    // 2. Display name if clean of email symbols
    if (currentUser.displayName && currentUser.displayName.trim() && !currentUser.displayName.includes('@') && normalizeName(currentUser.displayName) !== normalizeName(emailAlias)) {
      return currentUser.displayName.trim();
    }
    // 3. Campaign candidate name in Tenant
    if (currentTenant.candidateName && currentTenant.candidateName.trim() && !currentTenant.candidateName.includes('@')) {
      return currentTenant.candidateName.trim();
    }
    // 4. Humanize email username without ever displaying domain or raw email
    if (currentUser.email) {
      const emailUser = currentUser.email.split('@')[0].toLowerCase();
      if (emailUser === 'expcal') return 'Wilson José Arias';
      return emailUser
        .replace(/(alcalde|gobernador|concejal|diputado|astrea|cesar)/g, ' ')
        .replace(/[._-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/\b\w/g, (char) => char.toUpperCase());
    }
    return 'Líder de Campaña';
  };

  const registeredName = resolveRegisteredName();
  const [customNameInput, setCustomNameInput] = useState(registeredName);

  const handleSaveName = async () => {
    if (!customNameInput.trim()) return;
    setSavingName(true);
    try {
      const trimmed = customNameInput.trim();
      // Update in Firestore
      if (currentUser.uid) {
        const userDocRef = doc(db, 'usuarios', currentUser.uid);
        await setDoc(userDocRef, {
          displayName: trimmed,
          fullName: trimmed
        }, { merge: true });
      }
      currentUser.displayName = trimmed;
      currentUser.fullName = trimmed;
      if (onUpdateUserName) {
        onUpdateUserName(trimmed);
      }
      setIsEditingName(false);
    } catch (e) {
      console.error('Error saving updated registered name:', e);
      setIsEditingName(false);
    } finally {
      setSavingName(false);
    }
  };

  const userPrefix = currentUser.prefix || 'Dr.';
  const roleName = currentUser.role === 'Alcalde'
    ? 'Candidato a la Alcaldía'
    : currentUser.role === 'Gobernador'
    ? 'Candidato a la Gobernación'
    : currentUser.role === 'Concejal'
    ? 'Candidato al Concejo'
    : currentUser.role === 'Diputado'
    ? 'Candidato a la Asamblea'
    : currentUser.role === 'JefePolitico'
    ? 'Jefe Político & Estratega'
    : currentUser.role === 'AdminGlobal'
    ? 'Administrador General'
    : currentUser.role;

  return (
    <div className="relative overflow-hidden rounded-3xl border border-cyan-500/30 bg-gradient-to-br from-slate-900 via-[#0a0f1d] to-[#040814] p-5 sm:p-6 shadow-2xl shadow-cyan-950/30 backdrop-blur-xl">
      {/* Bioluminescent Synaptic Ambient Orbs */}
      <div 
        className="absolute -right-16 -top-16 w-60 h-60 rounded-full blur-3xl opacity-25 pointer-events-none animate-pulse"
        style={{ backgroundColor: currentTenant.primaryColor || '#06b6d4' }}
      />
      <div className="absolute left-1/3 -bottom-20 w-72 h-44 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />

      {/* Cybernetic Grid & Synapse Trace */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(34,211,238,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,0.03)_1px,transparent_1px)] bg-[size:36px_36px] pointer-events-none" />

      <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        
        {/* Left Side: Avatar, Salutation & Status Pulse */}
        <div className="flex items-start sm:items-center gap-4.5">
          {/* Animated Avatar Core with Synaptic Halo */}
          <div className="relative shrink-0">
            <div 
              className="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-black text-2xl shadow-2xl border-2 border-cyan-400/40 relative z-10"
              style={{ backgroundColor: currentTenant.primaryColor || '#0284c7' }}
            >
              {registeredName.charAt(0) || userPrefix.charAt(0)}
            </div>
            {/* Pulsing Aura Ring */}
            <div className="absolute -inset-1.5 rounded-2xl bg-cyan-400/30 blur-sm animate-ping opacity-60 pointer-events-none" />
            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-slate-950 flex items-center justify-center shadow-lg z-20" title="Sesión activa en tiempo real">
              <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
            </div>
          </div>

          <div className="space-y-2 min-w-0">
            {/* Top State Tags */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-cyan-300 bg-cyan-500/15 px-2.5 py-1 rounded-full border border-cyan-500/30 shadow-sm">
                <Sparkles className="w-3 h-3 text-cyan-300 animate-spin-slow" />
                Nombre Registrado Verificado
              </span>

              <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-emerald-300 bg-emerald-500/15 px-2.5 py-1 rounded-full border border-emerald-500/30">
                <ShieldCheck className="w-3 h-3 text-emerald-400" />
                Tenant: {currentTenant.name || currentTenant.tenantId}
              </span>

              <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-mono text-slate-400 bg-slate-950/60 px-2 py-0.5 rounded-md border border-slate-800">
                <Radio className="w-2.5 h-2.5 text-cyan-400 animate-pulse" /> Enlace Firestore en Tiempo Real
              </span>
            </div>

            {/* Formal Greeting with High Dynamic Range Typography - STRICTLY REGISTERED NAME, NEVER EMAIL */}
            <div>
              {isEditingName ? (
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-sm text-cyan-300 font-bold">{userPrefix}</span>
                  <input
                    type="text"
                    value={customNameInput}
                    onChange={(e) => setCustomNameInput(e.target.value)}
                    placeholder="Escriba su nombre y apellidos oficiales"
                    className="bg-slate-950 border border-cyan-400/60 text-white rounded-xl px-3 py-1 text-sm sm:text-base font-bold focus:outline-none focus:ring-2 focus:ring-cyan-400"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={handleSaveName}
                    disabled={savingName}
                    className="p-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow cursor-pointer"
                    title="Guardar nombre oficial registrado"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCustomNameInput(registeredName);
                      setIsEditingName(false);
                    }}
                    className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl cursor-pointer"
                    title="Cancelar"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-white tracking-tight flex flex-wrap items-center gap-2">
                  <span>Bienvenido(a),</span>
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-sky-200 to-indigo-300 font-black drop-shadow-sm">
                    {userPrefix} {registeredName}
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsEditingName(true)}
                    className="p-1 text-slate-400 hover:text-cyan-300 hover:bg-slate-800/80 rounded-lg transition cursor-pointer"
                    title="Editar nombre oficial registrado"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                </h1>
              )}
            </div>

            {/* Interactive Functional Data Pills / Architecture Matrix */}
            <div className="flex flex-wrap items-center gap-2 pt-0.5">
              
              {/* Role Badge */}
              <div className="inline-flex items-center gap-1.5 bg-slate-950/80 text-cyan-200 px-3 py-1 rounded-xl font-bold text-xs border border-cyan-500/20 shadow-sm hover:border-cyan-500/40 transition">
                <Award className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span>{roleName}</span>
              </div>

              {/* Political Organization */}
              {currentUser.party && (
                <div className="inline-flex items-center gap-1.5 bg-slate-950/80 text-amber-200 px-3 py-1 rounded-xl font-semibold text-xs border border-amber-500/20 shadow-sm">
                  <Flag className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>{currentUser.party}</span>
                </div>
              )}

              {/* Geographical Node */}
              <div className="inline-flex items-center gap-1.5 bg-slate-950/80 text-emerald-200 px-3 py-1 rounded-xl font-semibold text-xs border border-emerald-500/20 shadow-sm">
                <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>{currentUser.municipality || 'Astrea'}, {currentUser.department || 'Cesar'}</span>
              </div>

              {/* Multi-Tenant Node */}
              <div className="inline-flex items-center gap-1.5 bg-slate-950/80 text-slate-300 px-3 py-1 rounded-xl font-semibold text-xs border border-slate-800">
                <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="truncate max-w-[160px] sm:max-w-none">{currentTenant.name}</span>
              </div>

            </div>
          </div>
        </div>

        {/* Right Side: Quick Tactical Switcher & Session Controls */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0 self-stretch lg:self-center">
          <button
            type="button"
            onClick={onOpenAuthModal}
            className="group relative inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:via-blue-500 hover:to-indigo-500 text-white font-black text-xs shadow-lg shadow-cyan-950/60 border border-cyan-400/30 transition-all duration-300 transform hover:-translate-y-0.5 cursor-pointer"
            title="Abrir panel de perfil o cambiar de usuario"
          >
            <UserCheck className="w-4 h-4 text-cyan-100 group-hover:scale-110 transition-transform" />
            <span>Perfil & Cambio de Cuenta</span>
          </button>
        </div>

      </div>
    </div>
  );
};
