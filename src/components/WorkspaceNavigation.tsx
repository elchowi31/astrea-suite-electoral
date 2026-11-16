import React from 'react';
import type {UserProfile,UserRole} from '../types';
import type {ActiveTab} from '../lib/moduleNavigation';
import {availableWorkspaces,workspaceTabLabel} from '../lib/workspaces';
export function WorkspaceNavigation({tab,user,role,onNavigate}:{tab:ActiveTab;user:UserProfile|null;role:UserRole;onNavigate:(tab:ActiveTab)=>void}){
 const workspace=availableWorkspaces(user,role).find(item=>item.tabs.includes(tab));if(!workspace||workspace.id==='home')return null;
 return <div className="workspace-navigation"><label className="workspace-mobile"><span className="sr-only">Secciones de {workspace.label}</span><select aria-label={`Secciones de ${workspace.label}`} value={tab} onChange={e=>onNavigate(e.target.value as ActiveTab)}>{workspace.tabs.map(id=><option key={id} value={id}>{workspaceTabLabel(id)}</option>)}</select></label><nav aria-label={`Secciones de ${workspace.label}`} className="workspace-desktop"><span>{workspace.shortLabel}</span>{workspace.tabs.map(id=><button key={id} type="button" aria-current={id===tab?'page':undefined} onClick={()=>onNavigate(id)}>{workspaceTabLabel(id)}</button>)}</nav></div>;
}
