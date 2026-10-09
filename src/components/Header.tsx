import React from 'react';
import { Tenant, UserRole, UserProfile } from '../types';
import { getTerritorialScope } from '../lib/permissions';
import {
  Building2,
  Shield,
  Sparkles,
  UserCheck,
  UserPlus,
  LogIn,
  ChevronDown,
  MapPin,
  Flag,
  Award,
  Lock
} from 'lucide-react';

interface HeaderProps {
  tenants: Tenant[];
  currentTenant: Tenant;
  onSelectTenant: (tenant: Tenant) => void;
  currentUser: UserProfile | null;
  onOpenAuthModal: () => void;
  userRole: UserRole;
  onSelectRole: (role: UserRole) => void;
  onNavigateToTenants?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  tenants,
  currentTenant,
  onSelectTenant,
  currentUser,
  onOpenAuthModal,
  userRole,
  onSelectRole,
  onNavigateToTenants,
}) => {
  const scope = getTerritorialScope(currentUser, userRole);
  const userPrefix = currentUser?.prefix || 'Dr.';
  const userName = currentUser?.displayName || 'Usuario de Campaña';
  const userMuni = currentUser?.municipality || 'Astrea';

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-30 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">

        {/* Left: Suite Brand & Tenant Selector */}
        <div className="flex items-center gap-3.5">
          <div
            onClick={scope.isGlobalAdmin ? onNavigateToTenants : undefined}
            className={`flex items-center gap-2.5 group ${scope.isGlobalAdmin ? 'cursor-pointer' : ''}`}
            title={scope.isGlobalAdmin ? 'Gestionar organizaciones' : currentTenant.name}
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg shadow-inner border border-white/20 transition-all duration-300 shrink-0 group-hover:scale-105"
              style={{ backgroundColor: currentTenant.primaryColor }}
            >
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-black text-base sm:text-lg tracking-tight text-white flex items-center gap-1.5">
                  Astrea <span className="text-[10px] bg-cyan-500/20 text-cyan-200 border border-cyan-500/30 px-1.5 py-0.5 rounded-full font-mono font-bold">Suite Electoral</span>
                </h1>
              </div>
              <p className="text-[10px] text-slate-400 group-hover:text-blue-300 transition truncate max-w-[180px] sm:max-w-xs font-medium flex items-center gap-1">
                <span>{currentTenant.name}</span>
                {scope.isGlobalAdmin && <span className="text-[9px] bg-slate-800 text-slate-400 px-1 rounded border border-slate-700">Gestionar</span>}
              </p>
            </div>
          </div>

          {/* Clean Tenant Switcher / Party Actions */}
          {scope.isGlobalAdmin && <div className="hidden md:flex items-center gap-1.5 pl-3 border-l border-slate-800">
            <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <select
              value={currentTenant.tenantId}
              onChange={(e) => {
                const selected = tenants.find((t) => t.tenantId === e.target.value);
                if (selected) onSelectTenant(selected);
              }}
              className="bg-slate-800 text-xs text-slate-200 border border-slate-700 rounded-xl px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium cursor-pointer max-w-[200px] truncate"
              title="Cambiar o seleccionar partido / organización activa"
            >
              {tenants.map((t) => (
                <option key={t.tenantId} value={t.tenantId}>
                  🏢 {t.name}
                </option>
              ))}
            </select>
            {onNavigateToTenants && (
              <button
                onClick={onNavigateToTenants}
                className="text-[11px] text-blue-400 hover:text-blue-300 bg-blue-950/60 hover:bg-blue-900/60 border border-blue-500/30 px-2 py-1 rounded-lg font-bold transition cursor-pointer"
                title="Administrar, modificar y crear partidos políticos"
              >
                Gestionar
              </button>
            )}
          </div>}
        </div>

        {/* Right: Sleek User Profile & Session Controls */}
        <div className="flex items-center gap-2.5">

          {/* User Profile Pill & Recognition */}
          <button
            onClick={onOpenAuthModal}
            className="flex items-center gap-2.5 bg-slate-800/90 hover:bg-slate-800 border border-slate-700/80 hover:border-blue-500/50 p-1.5 sm:px-3 sm:py-1.5 rounded-2xl transition-all shadow-sm cursor-pointer text-left group"
            title="Ver perfil, cambiar usuario o crear nueva cuenta"
          >
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center text-white font-bold text-xs shadow-sm border border-white/20 shrink-0"
              style={{ backgroundColor: currentTenant.primaryColor }}
            >
              {userPrefix}
            </div>

            <div className="hidden sm:block">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-white group-hover:text-blue-300 transition leading-tight">
                  {userPrefix} {userName}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                <span className="text-blue-400 font-semibold">{currentUser?.role || userRole}</span>
                <span>•</span>
                <span className="truncate max-w-[120px] text-amber-300 font-medium">{userMuni}</span>
              </p>
            </div>

            <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-white transition" />
          </button>

          {/* Quick Access: Iniciar Sesión / Crear Usuario Button */}
          <button
            onClick={onOpenAuthModal}
            className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-600/20 transition cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Mi perfil</span>
          </button>

          {/* Role Status or Restricted Selector */}
          <div className="hidden xl:flex items-center gap-1.5 bg-slate-800/60 px-2.5 py-1.5 rounded-xl border border-slate-700/60">
            <Shield className="w-3 h-3 text-emerald-400" />
            {scope.isGlobalAdmin ? (
              <select
                value={userRole}
                onChange={(e) => onSelectRole(e.target.value as UserRole)}
                className="bg-transparent text-[11px] text-slate-300 focus:outline-none font-medium cursor-pointer"
                title="Simular visualización por rol de campaña"
              >
                <option value="AdminGlobal">👑 Admin Global</option>
                <option value="Alcalde">🏛️ Alcaldía</option>
                <option value="Gobernador">🎖️ Gobernación</option>
                <option value="Concejal">📋 Concejo</option>
                <option value="Diputado">🏛️ Asamblea</option>
                <option value="JefePolitico">👔 Jefe Político</option>
                <option value="LiderVeredal">📍 Líder Veredal</option>
                <option value="AdminTenant">🏢 Admin Tenant</option>
                <option value="Supervisor">🔍 Supervisor</option>
                <option value="Operador">⚙️ Operador</option>
              </select>
            ) : (
              <span className="text-[11px] font-bold text-slate-300">
                {currentUser?.role || userRole} ({userMuni})
              </span>
            )}
          </div>

        </div>

      </div>
    </header>
  );
};
