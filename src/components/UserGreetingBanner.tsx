import React from 'react';
import { UserProfile, Tenant } from '../types';
import {
  UserCheck,
  MapPin,
  Flag,
  Building2,
  ShieldCheck,
  UserPlus,
  RefreshCw,
  Sparkles,
  Award,
  ChevronRight,
  Vote,
  Lock
} from 'lucide-react';

interface UserGreetingBannerProps {
  currentUser: UserProfile;
  currentTenant: Tenant;
  onOpenAuthModal: () => void;
}

export const UserGreetingBanner: React.FC<UserGreetingBannerProps> = ({
  currentUser,
  currentTenant,
  onOpenAuthModal,
}) => {
  const userPrefix = currentUser.prefix || 'Dr.';
  const roleName = currentUser.role === 'Alcalde'
    ? 'Candidato a la Alcaldía Municipal'
    : currentUser.role === 'Gobernador'
    ? 'Candidato a la Gobernación'
    : currentUser.role === 'Concejal'
    ? 'Candidato al Concejo Municipal'
    : currentUser.role === 'Diputado'
    ? 'Candidato a la Asamblea Departamental'
    : currentUser.role === 'JefePolitico'
    ? 'Jefe Político & Estratega Territorial'
    : currentUser.role === 'AdminGlobal'
    ? 'Administrador General & Estratega'
    : currentUser.role;

  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-slate-900 to-blue-950/80 border border-slate-800 p-5 shadow-2xl">
      {/* Background Decorative Accent */}
      <div
        className="absolute -right-20 -top-20 w-64 h-64 rounded-full blur-3xl opacity-20 pointer-events-none"
        style={{ backgroundColor: currentTenant.primaryColor }}
      ></div>

      <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-5">

        {/* Left: User Avatar, Formal Salutation & Badges */}
        <div className="flex items-start sm:items-center gap-4">

          {/* Avatar with Prefix */}
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-xl border-2 border-white/20 shrink-0"
            style={{ backgroundColor: currentTenant.primaryColor }}
          >
            {userPrefix}
          </div>

          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-400 bg-blue-500/10 px-2.5 py-0.5 rounded-full border border-blue-500/20 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-400" />
                Perfil Reconocido
              </span>

              <span className="text-[11px] font-bold text-emerald-300 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20 flex items-center gap-1">
                <Lock className="w-3 h-3" />
                Aislamiento por {currentTenant.tenantId}
              </span>
            </div>

            {/* Formal Greeting */}
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex flex-wrap items-center gap-1.5">
              <span>¡Bienvenido(a),</span>
              <span className="text-blue-400 font-extrabold">{userPrefix} {currentUser.displayName}!</span>
            </h1>

            {/* Comprehensive Metadata Chips */}
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300 pt-0.5">

              {/* Role / Electoral Level */}
              <span className="inline-flex items-center gap-1.5 bg-slate-800/90 text-blue-300 px-3 py-1 rounded-xl font-bold border border-slate-700">
                <Award className="w-3.5 h-3.5 text-blue-400" />
                {roleName}
              </span>

              {/* Political Party */}
              {currentUser.party && (
                <span className="inline-flex items-center gap-1.5 bg-slate-800/90 text-amber-300 px-3 py-1 rounded-xl font-semibold border border-slate-700">
                  <Flag className="w-3.5 h-3.5 text-amber-400" />
                  {currentUser.party}
                </span>
              )}

              {/* Territory (Municipality, Department) */}
              <span className="inline-flex items-center gap-1.5 bg-slate-800/90 text-emerald-300 px-3 py-1 rounded-xl font-semibold border border-slate-700">
                <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                {currentUser.municipality || 'Astrea'}, {currentUser.department || 'Cesar'}
              </span>

              {/* Organization Tenant */}
              <span className="inline-flex items-center gap-1.5 bg-slate-800/90 text-slate-300 px-3 py-1 rounded-xl font-semibold border border-slate-700">
                <Building2 className="w-3.5 h-3.5 text-slate-400" />
                {currentTenant.name}
              </span>

            </div>
          </div>
        </div>

        {/* Right: Quick Action Controls */}
        <div className="flex items-center gap-2.5 shrink-0 self-end lg:self-center">
          <button
            onClick={onOpenAuthModal}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs rounded-2xl shadow-lg shadow-blue-600/30 transition cursor-pointer"
          >
            <UserCheck className="w-4 h-4" />
            <span>Cambiar Usuario / Iniciar Sesión</span>
          </button>
        </div>

      </div>
    </div>
  );
};
