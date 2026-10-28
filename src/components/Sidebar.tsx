import React, { useEffect, useRef, useState } from 'react';
import { BarChart3, Bot, Building2, Calculator, ChevronRight, CircleDollarSign, ClipboardList, FileSpreadsheet, FileText, FolderSync, LayoutDashboard, Layers, LogOut, Map, MapPin, Menu, ShieldCheck, Target, Truck, Users, X } from 'lucide-react';
import { UserProfile, UserRole } from '../types';
import { getRoleHierarchyLevel, getTerritorialScope } from '../lib/permissions';
import {isTrackingAdministrator} from '../lib/trackingPermissions';

export type ActiveTab = 'resources' | 'device' | 'routes' | 'users' | 'dashboard' | 'campaign_structure' | 'hierarchy_pyramid' | 'login' | 'simulator' | 'costs_report' | 'zone_projections' | 'workspace' | 'map' | 'finances' | 'leaders' | 'transport' | 'candidates' | 'districts' | 'proposals' | 'drive' | 'ai' | 'tenants';

interface SidebarProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  driveFileCount: number;
  candidateCount: number;
  leaderCount?: number;
  vehicleCount?: number;
  voterCount?: number;
  currentUser?: UserProfile | null;
  userRole?: UserRole;
  onLogout?: () => void;
}

type MenuItem = { id: ActiveTab; label: string; shortLabel?: string; icon: any; badge?: number; minLevel?: number; globalOnly?: boolean; trackingAdminOnly?: boolean };
type MenuGroup = { label: string; tone: string; items: MenuItem[] };

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, onTabChange, driveFileCount, candidateCount, leaderCount = 0, vehicleCount = 0, voterCount = 0, currentUser = null, userRole = 'Consulta', onLogout }) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const desktopRef = useRef<HTMLElement>(null);
  const mobileRef = useRef<HTMLDivElement>(null);
  const mobileTrigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!mobileOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    mobileRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setMobileOpen(false); return; }
      if (event.key !== 'Tab') return;
      const focusable = mobileRef.current?.querySelectorAll<HTMLElement>('button, [href], select, input, [tabindex="0"]');
      if (!focusable?.length) return;
      const first = focusable[0], last = focusable[focusable.length-1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', handleKey);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener('keydown', handleKey); mobileTrigger.current?.focus(); };
  }, [mobileOpen]);
  useEffect(() => {
    const outside = (event: PointerEvent) => { if (!desktopRef.current?.contains(event.target as Node)) setExpanded(false); };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, []);
  const effectiveRole = currentUser?.role || userRole;
  const level = getRoleHierarchyLevel(effectiveRole);
  const scope = getTerritorialScope(currentUser, effectiveRole);
  const groups: MenuGroup[] = [
    { label: 'Resumen', tone: 'text-cyan-300', items: [{ id: 'dashboard', label: 'Centro de control', shortLabel: 'Inicio', icon: LayoutDashboard }] },
    { label: 'Operación', tone: 'text-emerald-300', items: [
      { id: 'campaign_structure', label: 'Equipo y comités', shortLabel: 'Equipo', icon: ShieldCheck, minLevel: 10 },
      { id: 'hierarchy_pyramid', label: 'Base territorial', shortLabel: 'Territorio', icon: Layers, badge: voterCount, minLevel: 10 },
      { id: 'leaders', label: 'Líderes y metas', icon: Target, badge: leaderCount, minLevel: 10 },
      { id: 'map', label: 'Mapa territorial', icon: Map, minLevel: 10 },
      { id: 'routes', label: 'Recorridos y seguimiento', icon: MapPin, trackingAdminOnly: true },
      { id: 'device', label: 'Mi dispositivo', icon: ShieldCheck, trackingAdminOnly: true },
      { id: 'transport', label: 'Transporte', icon: Truck, badge: vehicleCount, minLevel: 10 },
      { id: 'resources', label: 'Solicitudes y jornadas', icon: ClipboardList, minLevel: 10 },
    ] },
    { label: 'Administración', tone: 'text-amber-300', items: [
      { id: 'users', label: 'Usuarios y accesos', icon: Users, minLevel: 35 },
      { id: 'finances', label: 'Finanzas y aportes', shortLabel: 'Finanzas', icon: CircleDollarSign, minLevel: 10 },
      { id: 'costs_report', label: 'Control de gastos', icon: FileSpreadsheet, minLevel: 10 },
      { id: 'candidates', label: 'Candidaturas', icon: Users, badge: candidateCount, minLevel: 10 },
      { id: 'districts', label: 'Territorios y censo', icon: MapPin, minLevel: 40 },
      { id: 'proposals', label: 'Programa y propuestas', icon: FileText, minLevel: 10 },
      { id: 'workspace', label: 'Google Workspace', icon: ClipboardList, minLevel: 50 },
      { id: 'drive', label: 'Archivo documental', icon: FolderSync, badge: driveFileCount, minLevel: 10 },
      { id: 'tenants', label: 'Organizaciones', icon: Building2, globalOnly: true },
    ] },
    { label: 'Inteligencia', tone: 'text-violet-300', items: [
      { id: 'zone_projections', label: 'Proyección territorial', icon: BarChart3, minLevel: 40 },
      { id: 'simulator', label: 'Simulador electoral', icon: Calculator, minLevel: 10 },
      { id: 'ai', label: 'Asistente de análisis', icon: Bot, minLevel: 50 },
    ] },
  ];
  const allowedGroups = groups.map((group) => ({ ...group, items: group.items.filter((item) => item.trackingAdminOnly ? isTrackingAdministrator(currentUser) : item.globalOnly ? scope.isGlobalAdmin : level >= (item.minLevel || 0)) })).filter((group) => group.items.length > 0);
  const allAllowed = allowedGroups.flatMap((group) => group.items);
  const go = (id: ActiveTab) => { onTabChange(id); setMobileOpen(false); setExpanded(false); if (desktopRef.current?.contains(document.activeElement)) (document.activeElement as HTMLElement)?.blur(); };
  const mobileQuick = ['dashboard', 'campaign_structure', 'hierarchy_pyramid', 'finances'].map((id) => allAllowed.find((item) => item.id === id)).filter(Boolean) as MenuItem[];

  return (
    <>
      <aside ref={desktopRef} className="app-rail-slot" aria-label="Menú lateral" onKeyDown={event=>{if(event.key==='Escape'){setExpanded(false);desktopRef.current?.querySelector<HTMLButtonElement>('button')?.focus();}}}>
        <div className={`app-rail ${expanded?'is-expanded':''}`} onPointerEnter={event=>{if(event.pointerType==='mouse')setExpanded(true);}} onPointerLeave={()=>{if(!desktopRef.current?.contains(document.activeElement)||!document.activeElement?.matches(':focus-visible'))setExpanded(false);}} onFocusCapture={event=>{if(!(event.target as HTMLElement).closest('.app-rail-toggle'))setExpanded(true);}} onBlurCapture={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node))setExpanded(false);}}>
          <button type="button" className="app-rail-toggle" aria-label={expanded?'Retraer menú':'Expandir menú'} aria-expanded={expanded} aria-controls="desktop-navigation" onClick={()=>setExpanded(value=>!value)}><Menu size={18}/><span>Menú principal</span></button>
          <nav id="desktop-navigation" className="app-rail-nav" aria-label="Navegación principal">{allowedGroups.map(group=><div key={group.label} className="app-rail-group"><p className={group.tone}>{group.label}</p>{group.items.map(item=><NavItem key={item.id} item={item} active={activeTab===item.id} onClick={()=>go(item.id)} compact={!expanded}/>)}</div>)}</nav>
          <div className="app-rail-footer"><div className="app-rail-profile"><p>{currentUser?.displayName}</p><small>{effectiveRole} · {currentUser?.municipality || 'Sin territorio'}</small></div>{onLogout&&<button type="button" onClick={onLogout} title="Cerrar sesión" aria-label="Cerrar sesión"><LogOut size={18}/><span>Cerrar sesión</span></button>}</div>
        </div>
      </aside>

      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-slate-700 bg-slate-950/95 px-1 pb-[max(.35rem,env(safe-area-inset-bottom))] pt-1 backdrop-blur-xl md:hidden" aria-label="Navegación móvil">
        {mobileQuick.map((item) => <MobileItem key={item.id} item={item} active={activeTab === item.id} onClick={() => go(item.id)} />)}
        <button ref={mobileTrigger} aria-expanded={mobileOpen} aria-controls="mobile-navigation" onClick={() => setMobileOpen(true)} className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-[9px] font-bold text-slate-400"><Menu className="h-5 w-5" />Más</button>
      </nav>

      {mobileOpen && <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm md:hidden" onClick={() => setMobileOpen(false)}>
        <div ref={mobileRef} id="mobile-navigation" role="dialog" aria-modal="true" aria-label="Todos los módulos" className="absolute inset-x-0 bottom-0 max-h-[82vh] overflow-y-auto rounded-t-3xl border-t border-slate-700 bg-slate-900 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]" onClick={(event) => event.stopPropagation()}>
          <div className="mb-4 flex items-center justify-between"><div><h2 className="font-black text-white">Todos los módulos</h2><p className="text-[11px] text-slate-400">{scope.scopeTitle}</p></div><button aria-label="Cerrar menú" onClick={() => setMobileOpen(false)} className="rounded-xl bg-slate-800 p-2 text-slate-300"><X className="h-5 w-5" /></button></div>
          <div className="space-y-5">{allowedGroups.map((group) => <div key={group.label}><p className={`mb-2 text-[10px] font-black uppercase tracking-wider ${group.tone}`}>{group.label}</p><div className="grid grid-cols-2 gap-2">{group.items.map((item) => <NavItem key={item.id} item={item} active={activeTab === item.id} onClick={() => go(item.id)} />)}</div></div>)}</div>
          {onLogout && <button onClick={onLogout} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs font-bold text-rose-300"><LogOut className="h-4 w-4" />Cerrar sesión</button>}
        </div>
      </div>}
    </>
  );
};

const NavItem = ({ item, active, onClick, compact=false }: { key?: React.Key; item: MenuItem; active: boolean; onClick: () => void; compact?: boolean }) => { const Icon = item.icon; return <button title={item.label} aria-label={item.label} aria-current={active?'page':undefined} data-compact={compact} onClick={onClick} className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-xs font-bold transition ${active ? 'bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-950/40' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}><Icon className="h-4 w-4 shrink-0" /><span className="min-w-0 flex-1 truncate">{item.label}</span>{item.badge !== undefined && <span className={`rounded-full px-1.5 py-0.5 text-[9px] ${active ? 'bg-slate-950/15' : 'bg-slate-800 text-slate-400'}`}>{item.badge}</span>}<ChevronRight className="h-3 w-3 opacity-40" /></button>; };
const MobileItem = ({ item, active, onClick }: { key?: React.Key; item: MenuItem; active: boolean; onClick: () => void }) => { const Icon = item.icon; return <button onClick={onClick} className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-[9px] font-bold ${active ? 'bg-cyan-500/15 text-cyan-300' : 'text-slate-400'}`}><Icon className="h-5 w-5" /><span className="max-w-full truncate px-1">{item.shortLabel || item.label}</span></button>; };
