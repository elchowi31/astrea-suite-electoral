import React, { useEffect, useRef, useState } from 'react';
import { BarChart3, Bot, Building2, Calculator, ChevronRight, CircleDollarSign, ClipboardList, FileSpreadsheet, FileText, FolderSync, Gift, LayoutDashboard, Layers, LogOut, Map, MapPin, Menu, ShieldCheck, Target, Truck, Users, X } from 'lucide-react';
import { UserProfile, UserRole } from '../types';
import { getRoleHierarchyLevel, getTerritorialScope } from '../lib/permissions';
import {isTrackingAdministrator} from '../lib/trackingPermissions';

import type { ActiveTab } from '../lib/moduleNavigation';
import {availableWorkspaces,workspaceFor} from '../lib/workspaces';
export type { ActiveTab } from '../lib/moduleNavigation';

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
      if (!mobileRef.current?.contains(document.activeElement)) { event.preventDefault(); (event.shiftKey ? last : first).focus(); return; }
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    const retainFocus = (event: FocusEvent) => { if (!mobileRef.current?.contains(event.target as Node)) mobileRef.current?.querySelector<HTMLButtonElement>('button')?.focus({preventScroll:true}); };
    const closeOnDesktop = () => { if(window.innerWidth >= 768)setMobileOpen(false); };
    document.addEventListener('keydown', handleKey);document.addEventListener('focusin',retainFocus);window.addEventListener('resize',closeOnDesktop);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener('keydown', handleKey);document.removeEventListener('focusin',retainFocus);window.removeEventListener('resize',closeOnDesktop);mobileTrigger.current?.focus(); };
  }, [mobileOpen]);
  useEffect(() => {
    const outside = (event: PointerEvent) => { if (!desktopRef.current?.contains(event.target as Node)) setExpanded(false); };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, []);
  const effectiveRole = currentUser?.role || userRole;
  const level = getRoleHierarchyLevel(effectiveRole);
  const scope = getTerritorialScope(currentUser, effectiveRole);
  const workspaceIcons:Record<string,any>={home:LayoutDashboard,people:Users,territory:Map,operations:Truck,finance:CircleDollarSign,analysis:BarChart3,documents:FolderSync,settings:ShieldCheck,extensions:Gift};
  const workspaceItems=availableWorkspaces(currentUser,effectiveRole).map(workspace=>({workspace,item:{id:(workspace.tabs.includes(activeTab)?activeTab:workspace.tabs[0]),label:workspace.label,shortLabel:workspace.shortLabel,icon:workspaceIcons[workspace.id]} as MenuItem}));
  const allowedGroups:MenuGroup[]=[
    {label:'Espacios de trabajo',tone:'text-cyan-300',items:workspaceItems.filter(x=>!x.workspace.secondary).map(x=>x.item)},
    {label:'Configuración y servicios',tone:'text-slate-400',items:workspaceItems.filter(x=>x.workspace.secondary).map(x=>x.item)},
  ].filter(group=>group.items.length>0);
  const allAllowed = allowedGroups.flatMap((group) => group.items);
  const go = (id: ActiveTab) => { onTabChange(id); setMobileOpen(false); setExpanded(false); if (desktopRef.current?.contains(document.activeElement)) (document.activeElement as HTMLElement)?.blur(); };
  const mobileQuick = ['home','people','operations','finance'].map(id=>workspaceItems.find(x=>x.workspace.id===id)?.item).filter(Boolean) as MenuItem[];

  return (
    <>
      <aside ref={desktopRef} className="app-rail-slot" aria-label="Menú lateral" onKeyDown={event=>{if(event.key==='Escape'){setExpanded(false);desktopRef.current?.querySelector<HTMLButtonElement>('button')?.focus();}}}>
        <div className={`app-rail ${expanded?'is-expanded':''}`} onPointerEnter={event=>{if(event.pointerType==='mouse')setExpanded(true);}} onPointerLeave={()=>{if(!desktopRef.current?.contains(document.activeElement)||!document.activeElement?.matches(':focus-visible'))setExpanded(false);}} onFocusCapture={event=>{if(!(event.target as HTMLElement).closest('.app-rail-toggle'))setExpanded(true);}} onBlurCapture={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node))setExpanded(false);}}>
          <button type="button" className="app-rail-toggle" aria-label={expanded?'Retraer menú':'Expandir menú'} aria-expanded={expanded} aria-controls="desktop-navigation" onClick={()=>setExpanded(value=>!value)}><Menu size={18}/><span>Menú principal</span></button>
          <nav id="desktop-navigation" className="app-rail-nav" aria-label="Navegación principal">{allowedGroups.map(group=><div key={group.label} className="app-rail-group"><p className={group.tone}>{group.label}</p>{group.items.map(item=><NavItem key={item.id} item={item} active={workspaceFor(activeTab)?.id===workspaceFor(item.id)?.id} onClick={()=>go(item.id)} compact={!expanded}/>)}</div>)}</nav>
          <div className="app-rail-footer"><div className="app-rail-profile"><p>{currentUser?.displayName}</p><small>{effectiveRole} · {currentUser?.municipality || 'Sin territorio'}</small></div>{onLogout&&<button type="button" onClick={onLogout} title="Cerrar sesión" aria-label="Cerrar sesión"><LogOut size={18}/><span>Cerrar sesión</span></button>}</div>
        </div>
      </aside>

      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-slate-700 bg-slate-950/95 px-1 pb-[max(.35rem,env(safe-area-inset-bottom))] pt-1 backdrop-blur-xl md:hidden" aria-label="Navegación móvil">
        {mobileQuick.map((item) => <MobileItem key={item.id} item={item} active={workspaceFor(activeTab)?.id===workspaceFor(item.id)?.id} onClick={() => go(item.id)} />)}
        <button ref={mobileTrigger} aria-expanded={mobileOpen} aria-controls="mobile-navigation" onClick={() => setMobileOpen(true)} className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-[9px] font-bold text-slate-400"><Menu className="h-5 w-5" />Más</button>
      </nav>

      {mobileOpen && <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm md:hidden" onClick={() => setMobileOpen(false)}>
        <div ref={mobileRef} id="mobile-navigation" role="dialog" aria-modal="true" aria-label="Todos los módulos" className="absolute inset-x-0 bottom-0 max-h-[82vh] overflow-y-auto rounded-t-3xl border-t border-slate-700 bg-slate-900 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]" onClick={(event) => event.stopPropagation()}>
          <div className="mb-4 flex items-center justify-between"><div><h2 className="font-black text-white">Todos los módulos</h2><p className="text-[11px] text-slate-400">{scope.scopeTitle}</p></div><button aria-label="Cerrar menú" onClick={() => setMobileOpen(false)} className="rounded-xl bg-slate-800 p-2 text-slate-300"><X className="h-5 w-5" /></button></div>
          <div className="space-y-5">{allowedGroups.map((group) => <div key={group.label}><p className={`mb-2 text-[10px] font-black uppercase tracking-wider ${group.tone}`}>{group.label}</p><div className="grid grid-cols-2 gap-2">{group.items.map((item) => <NavItem key={item.id} item={item} active={workspaceFor(activeTab)?.id===workspaceFor(item.id)?.id} onClick={() => go(item.id)} />)}</div></div>)}</div>
          {onLogout && <button onClick={onLogout} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs font-bold text-rose-300"><LogOut className="h-4 w-4" />Cerrar sesión</button>}
        </div>
      </div>}
    </>
  );
};

const NavItem = ({ item, active, onClick, compact=false }: { key?: React.Key; item: MenuItem; active: boolean; onClick: () => void; compact?: boolean }) => { const Icon = item.icon; return <button title={item.label} aria-label={item.label} aria-current={active?'page':undefined} data-compact={compact} onClick={onClick} className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-xs font-bold transition ${active ? 'bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-950/40' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}><Icon className="h-4 w-4 shrink-0" /><span className={`min-w-0 flex-1 ${compact?'truncate':'whitespace-normal break-words'}`}>{item.label}</span>{item.badge !== undefined && <span className={`rounded-full px-1.5 py-0.5 text-[9px] ${active ? 'bg-slate-950/15' : 'bg-slate-800 text-slate-400'}`}>{item.badge}</span>}<ChevronRight className="h-3 w-3 opacity-40" /></button>; };
const MobileItem = ({ item, active, onClick }: { key?: React.Key; item: MenuItem; active: boolean; onClick: () => void }) => { const Icon = item.icon; return <button onClick={onClick} className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-[9px] font-bold ${active ? 'bg-cyan-500/15 text-cyan-300' : 'text-slate-400'}`}><Icon className="h-5 w-5" /><span className="max-w-full truncate px-1">{item.shortLabel || item.label}</span></button>; };
