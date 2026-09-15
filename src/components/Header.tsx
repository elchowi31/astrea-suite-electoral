import React from 'react';
import { 
  Building2, 
  Shield, 
  Sparkles, 
  UserCheck, 
  ChevronDown,
  MapPin,
  Flag,
  Award,
  Lock,
  Layers,
  Activity,
  Cpu,
  Radio
} from 'lucide-react';
import { Tenant, UserRole, UserProfile } from '../types';
import { getTerritorialScope } from '../lib/permissions';

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
  
  const resolveHeaderName = (): string => {
    const emailAlias = currentUser?.email?.split('@')[0].toLowerCase() || '';
    if (currentUser?.fullName && currentUser.fullName.trim() && !currentUser.fullName.includes('@')) {
      return currentUser.fullName.trim();
    }
    if (currentUser?.displayName && currentUser.displayName.trim() && !currentUser.displayName.includes('@') && currentUser.displayName.toLowerCase().replace(/[^a-záéíóúñ0-9]/g, '') !== emailAlias.replace(/[^a-záéíóúñ0-9]/g, '')) {
      return currentUser.displayName.trim();
    }
    if (currentTenant?.candidateName && !currentTenant.candidateName.includes('@')) {
      return currentTenant.candidateName;
    }
    if (currentUser?.email) {
      const emailUser = currentUser.email.split('@')[0].toLowerCase();
      if (emailUser === 'expcal') return 'Wilson José Arias';
      return emailUser.replace(/(alcalde|gobernador|concejal|diputado|astrea|cesar)/g, ' ').replace(/[._-]/g, ' ').replace(/\s+/g, ' ').trim().replace(/\b\w/g, (c) => c.toUpperCase()) || 'Perfil por completar';
    }
    return 'Líder de Campaña';
  };

  const userName = resolveHeaderName();
  const userMuni = currentUser?.municipality || 'Astrea';

  return (
    <header className="relative bg-slate-950/90 border-b border-cyan-500/20 text-white sticky top-0 z-30 shadow-2xl backdrop-blur-xl">
      {/* Top subtle bioluminescent line */}
      <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-80" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
        
        {/* Left: Suite Brand with Neural Pulse */}
        <div className="flex items-center gap-3.5">
          <div 
            onClick={scope.isGlobalAdmin ? onNavigateToTenants : undefined}
            className={`flex items-center gap-2.5 group ${scope.isGlobalAdmin ? 'cursor-pointer' : ''}`}
            title={scope.isGlobalAdmin ? 'Gestionar organizaciones' : currentTenant.name}
          >
            <div 
              className="relative w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg shadow-lg border border-cyan-400/30 transition-all duration-300 shrink-0 group-hover:scale-105"
              style={{ backgroundColor: currentTenant.primaryColor || '#0284c7' }}
            >
              <Sparkles className="w-5 h-5 text-white animate-spin-slow" />
              <span className="absolute -inset-1 rounded-xl bg-cyan-400/20 blur-sm pointer-events-none" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-black text-base sm:text-lg tracking-tight text-white flex items-center gap-1.5">
                  Astrea <span className="text-[10px] bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 px-2 py-0.5 rounded-full font-mono font-bold">Suite Electoral</span>
                </h1>
              </div>
              <p className="text-[10px] text-slate-400 group-hover:text-cyan-300 transition truncate max-w-[180px] sm:max-w-xs font-medium flex items-center gap-1">
                <span>{currentTenant.name}</span>
                {scope.isGlobalAdmin && <span className="text-[9px] bg-slate-900 text-cyan-400 px-1 rounded border border-cyan-500/30">Gestionar</span>}
              </p>
            </div>
          </div>

          {/* Tenant Switcher when Global Admin */}
          {scope.isGlobalAdmin && (
            <div className="hidden md:flex items-center gap-1.5 pl-3 border-l border-slate-800">
              <Building2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <select
                value={currentTenant.tenantId}
                onChange={(e) => {
                  const selected = tenants.find((t) => t.tenantId === e.target.value);
                  if (selected) onSelectTenant(selected);
                }}
                className="bg-slate-900 text-xs text-slate-200 border border-slate-700 rounded-xl px-2.5 py-1.5 focus:border-cyan-500 font-medium cursor-pointer max-w-[200px] truncate"
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
                  className="text-[11px] text-cyan-300 hover:text-cyan-200 bg-cyan-950/60 hover:bg-cyan-900/60 border border-cyan-500/30 px-2 py-1 rounded-lg font-bold transition cursor-pointer"
                  title="Administrar organizaciones"
                >
                  Gestionar
                </button>
              )}
            </div>
          )}
        </div>

        {/* Right: Quick Active User Indicator & Switch Modal */}
        <div className="flex items-center gap-3">
          {currentUser ? (
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onOpenAuthModal}
                className="flex items-center gap-2.5 bg-slate-900/90 hover:bg-slate-800/90 border border-cyan-500/30 rounded-2xl px-3.5 py-1.5 transition text-left cursor-pointer shadow-md group"
                title="Cambiar de usuario o ver credenciales"
              >
                <div 
                  className="w-7 h-7 rounded-xl flex items-center justify-center text-white text-xs font-black shrink-0 border border-white/20 shadow-sm"
                  style={{ backgroundColor: currentTenant.primaryColor || '#0284c7' }}
                >
                  {userPrefix}
                </div>
                <div className="hidden sm:block">
                  <p className="text-xs font-bold text-white group-hover:text-cyan-300 transition-colors leading-tight">
                    {userPrefix} {userName}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    {userRole} · {userMuni}
                  </p>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-cyan-300 transition-transform group-hover:translate-y-0.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onOpenAuthModal}
              className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow-lg shadow-cyan-950/50 transition cursor-pointer"
            >
              <UserCheck className="w-4 h-4" />
              <span>Acceder al Sistema</span>
            </button>
          )}
        </div>

      </div>
    </header>
  );
};
