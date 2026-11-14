import React from 'react';
import type {UserProfile,UserRole} from '../types';
import type {ActiveTab} from '../lib/moduleNavigation';
import {availableWorkspaces,workspaceTabLabel} from '../lib/workspaces';

export function WorkspaceNavigation({tab,user,role,onNavigate}:{tab:ActiveTab;user:UserProfile|null;role:UserRole;onNavigate:(tab:ActiveTab)=>void}){
 const workspace=availableWorkspaces(user,role).find(w=>w.tabs.includes(tab));
 if(!workspace||workspace.id==='home')return null;
 return <section aria-label={workspace.label} className="min-w-0 rounded-xl border border-slate-700 bg-slate-900/80 p-3"><h2 className="mb-2 text-sm font-bold text-slate-200">{workspace.label}</h2>{workspace.id==='extensions'&&<p className="mb-3 text-xs text-slate-400">Herramientas independientes de la operación electoral. Sus datos y finalidades se conservan separados.</p>}<nav aria-label={`Secciones de ${workspace.label}`} className="flex flex-wrap gap-2">{workspace.tabs.map(id=><button key={id} type="button" aria-current={id===tab?'page':undefined} onClick={()=>onNavigate(id)} className={`min-h-11 max-w-full rounded-lg border px-3 py-2 text-left text-xs font-semibold ${id===tab?'border-cyan-600 bg-cyan-950 text-cyan-100':'border-slate-700 text-slate-300 hover:bg-slate-800'}`}>{workspaceTabLabel(id)}</button>)}</nav></section>;
}
