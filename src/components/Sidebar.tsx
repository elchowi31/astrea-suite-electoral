import React, { useState } from 'react';
import { BarChart3, Bot, Building2, Calculator, ChevronRight, CircleDollarSign, ClipboardList, FileSpreadsheet, FileText, FolderSync, LayoutDashboard, Layers, LogOut, Map, MapPin, Menu, ShieldCheck, Sparkles, Target, Truck, UploadCloud, Users, X } from 'lucide-react';
import { UserProfile, UserRole } from '../types';
import { getRoleHierarchyLevel, getTerritorialScope } from '../lib/permissions';

export type ActiveTab = 'dashboard' | 'campaign_structure' | 'hierarchy_pyramid' | 'login' | 'simulator' | 'costs_report' | 'zone_projections' | 'workspace' | 'map' | 'finances' | 'leaders' | 'prospects' | 'ingestion' | 'transport' | 'candidates' | 'districts' | 'proposals' | 'drive' | 'ai' | 'tenants';

interface SidebarProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  driveFileCount: number;
  candidateCount: number;
  leaderCount?: number;
  vehicleCount?: number;
  voterCount?: number;
  prospectCount?: number;
  currentUser?: UserProfile | null;
  userRole?: UserRole;
  onLogout?: () => void;
}

type MenuItem = { id: ActiveTab; label: string; shortLabel?: string; icon: any; badge?: number; minLevel?: number; globalOnly?: boolean };
type MenuGroup = { label: string; tone: string; items: MenuItem[] };

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, onTabChange, driveFileCount, candidateCount, leaderCount = 0, vehicleCount = 0, voterCount = 0, prospectCount = 0, currentUser = null, userRole = 'Consulta', onLogout }) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const effectiveRole = currentUser?.role || userRole;
  const level = getRoleHierarchyLevel(effectiveRole);
  const scope = getTerritorialScope(currentUser, effectiveRole);
  const groups: MenuGroup[] = [
    { label: 'Resumen', tone: 'text-cyan-300', items: [{ id: 'dashboard', label: 'Centro de control', shortLabel: 'Inicio', icon: LayoutDashboard }] },
    { label: 'Operación', tone: 'text-emerald-300', items: [
      { id: 'campaign_structure', label: 'Equipo y comités', shortLabel: 'Equipo', icon: ShieldCheck, minLevel: 20 },
      { id: 'hierarchy_pyramid', label: 'Base territorial', shortLabel: 'Territorio', icon: Layers, badge: voterCount, minLevel: 20 },
      { id: 'leaders', label: 'Líderes y metas', icon: Target, badge: leaderCount, minLevel: 20 },
      { id: 'prospects', label: 'Prospectos y Emprendimientos', shortLabel: 'Prospectos', icon: Sparkles, badge: prospectCount, minLevel: 20 },
      { id: 'ingestion', label: 'Ingesta Masiva & Audio', shortLabel: 'Ingesta', icon: UploadCloud, minLevel: 20 },
      { id: 'map', label: 'Mapa territorial', icon: Map, minLevel: 20 },
      { id: 'transport', label: 'Transporte', icon: Truck, badge: vehicleCount, minLevel: 20 },
    ] },
    { label: 'Administración', tone: 'text-amber-300', items: [
      { id: 'finances', label: 'Finanzas y aportes', shortLabel: 'Finanzas', icon: CircleDollarSign, minLevel: 40 },
      { id: 'costs_report', label: 'Control de gastos', icon: FileSpreadsheet, minLevel: 40 },
      { id: 'candidates', label: 'Candidaturas', icon: Users, badge: candidateCount, minLevel: 40 },
      { id: 'districts', label: 'Territorios y censo', icon: MapPin, minLevel: 40 },
      { id: 'proposals', label: 'Programa y propuestas', icon: FileText, minLevel: 40 },
      { id: 'workspace', label: 'Google Workspace', icon: ClipboardList, minLevel: 50 },
      { id: 'drive', label: 'Archivo documental', icon: FolderSync, badge: driveFileCount, minLevel: 50 },
      { id: 'tenants', label: 'Organizaciones', icon: Building2, globalOnly: true },
    ] },
    { label: 'Inteligencia', tone: 'text-violet-300', items: [
      { id: 'zone_projections', label: 'Proyección territorial', icon: BarChart3, minLevel: 40 },
      { id: 'simulator', label: 'Simulador electoral', icon: Calculator, minLevel: 40 },
      { id: 'ai', label: 'Asistente de análisis', icon: Bot, minLevel: 50 },
    ] },
  ];
  const allowedGroups = groups.map((group) => ({ ...group, items: group.items.filter((item) => item.globalOnly ? scope.isGlobalAdmin : level >= (item.minLevel || 0)) })).filter((group) => group.items.length > 0);
  const allAllowed = allowedGroups.flatMap((group) => group.items);
  const go = (id: ActiveTab) => { onTabChange(id); setMobileOpen(false); };
  const mobileQuick = ['dashboard', 'campaign_structure', 'hierarchy_pyramid', 'finances'].map((id) => allAllowed.find((item) => item.id === id)).filter(Boolean) as MenuItem[];

  const resolveSidebarName = (): string => {
    if (currentUser?.fullName && currentUser.fullName.trim() && !currentUser.fullName.includes('@')) {
      return currentUser.fullName.trim();
    }
    if (currentUser?.displayName && currentUser.displayName.trim() && !currentUser.displayName.includes('@')) {
      return currentUser.displayName.trim();
    }
    if (currentUser?.email) {
      const emailUser = currentUser.email.split('@')[0].toLowerCase();
      if (emailUser === 'expcal') return 'Wilson Arias';
      return emailUser.replace(/[._-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    }
    return 'Líder de Campaña';
  };

  return (
    <>
      <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-64 shrink-0 flex-col overflow-y-auto border-r border-slate-800 bg-slate-950/95 md:flex">
        <nav className="flex-1 space-y-5 p-3" aria-label="Navegación principal">
          {allowedGroups.map((group) => <div key={group.label}>
            <p className={`px-3 pb-1.5 text-[10px] font-black uppercase tracking-[.18em] ${group.tone}`}>{group.label}</p>
            <div className="space-y-1">{group.items.map((item) => <NavItem key={item.id} item={item} active={activeTab === item.id} onClick={() => go(item.id)} />)}</div>
          </div>)}
        </nav>
        <div className="border-t border-slate-800 p-3">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-3">
            <p className="truncate text-xs font-bold text-white">{resolveSidebarName()}</p>
            <p className="mt-0.5 truncate text-[10px] text-cyan-300">{effectiveRole} · {currentUser?.municipality || 'Sin territorio'}</p>
            {onLogout && <button onClick={onLogout} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-800 px-3 py-2 text-[11px] font-bold text-slate-300 hover:bg-rose-500/10 hover:text-rose-300"><LogOut className="h-3.5 w-3.5" /> Cerrar sesión</button>}
          </div>
        </div>
      </aside>

      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-slate-700 bg-slate-950/95 px-1 pb-[max(.35rem,env(safe-area-inset-bottom))] pt-1 backdrop-blur-xl md:hidden" aria-label="Navegación móvil">
        {mobileQuick.map((item) => <MobileItem key={item.id} item={item} active={activeTab === item.id} onClick={() => go(item.id)} />)}
        <button onClick={() => setMobileOpen(true)} className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-[9px] font-bold text-slate-400"><Menu className="h-5 w-5" />Más</button>
      </nav>

      {mobileOpen && <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm md:hidden" onClick={() => setMobileOpen(false)}>
        <div className="absolute inset-x-0 bottom-0 max-h-[82vh] overflow-y-auto rounded-t-3xl border-t border-slate-700 bg-slate-900 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]" onClick={(event) => event.stopPropagation()}>
          <div className="mb-4 flex items-center justify-between"><div><h2 className="font-black text-white">Todos los módulos</h2><p className="text-[11px] text-slate-400">{scope.scopeTitle}</p></div><button onClick={() => setMobileOpen(false)} className="rounded-xl bg-slate-800 p-2 text-slate-300"><X className="h-5 w-5" /></button></div>
          <div className="space-y-5">{allowedGroups.map((group) => <div key={group.label}><p className={`mb-2 text-[10px] font-black uppercase tracking-wider ${group.tone}`}>{group.label}</p><div className="grid grid-cols-2 gap-2">{group.items.map((item) => <NavItem key={item.id} item={item} active={activeTab === item.id} onClick={() => go(item.id)} />)}</div></div>)}</div>
          {onLogout && <button onClick={onLogout} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs font-bold text-rose-300"><LogOut className="h-4 w-4" />Cerrar sesión</button>}
        </div>
      </div>}
    </>
  );
};

const NavItem = ({ item, active, onClick }: { key?: React.Key; item: MenuItem; active: boolean; onClick: () => void }) => { const Icon = item.icon; return <button onClick={onClick} className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-xs font-bold transition ${active ? 'bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-950/40' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}><Icon className="h-4 w-4 shrink-0" /><span className="min-w-0 flex-1 truncate">{item.label}</span>{item.badge !== undefined && <span className={`rounded-full px-1.5 py-0.5 text-[9px] ${active ? 'bg-slate-950/15' : 'bg-slate-800 text-slate-400'}`}>{item.badge}</span>}<ChevronRight className="h-3 w-3 opacity-40" /></button>; };
const MobileItem = ({ item, active, onClick }: { key?: React.Key; item: MenuItem; active: boolean; onClick: () => void }) => { const Icon = item.icon; return <button onClick={onClick} className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-[9px] font-bold ${active ? 'bg-cyan-500/15 text-cyan-300' : 'text-slate-400'}`}><Icon className="h-5 w-5" /><span className="max-w-full truncate px-1">{item.shortLabel || item.label}</span></button>; };
