import React from 'react';
import {Calendar, Target} from 'lucide-react';
import type {Tenant, UserRole} from '../types';
import {EditRecordButton} from './common/EditRecordButton';

export function BudgetSettingsButton({tenant,userRole}:{tenant:Tenant;userRole:UserRole}){
  if(!['AdminGlobal','AdminTenant'].includes(userRole))return <p className="text-xs text-slate-400">El administrador de la organización puede configurar este presupuesto.</p>;
  return <EditRecordButton collection="organizaciones" record={tenant} fieldKeys={['budgetCap','campaignDate']} label="Configurar presupuesto" title="Presupuesto y fecha de campaña"/>;
}

export function CampaignPlanningPanel({tenant,userRole,onNavigateCandidates}:{tenant:Tenant;userRole:UserRole;onNavigateCandidates:()=>void}){
 return <section aria-label="Plan de campaña" className="grid gap-4 rounded-2xl border border-cyan-800/60 bg-slate-900 p-4 sm:p-5 md:grid-cols-2">
  <div className="min-w-0 space-y-3"><h2 className="font-bold text-white">Presupuesto general de inversión</h2><p className="text-sm text-slate-300">Registre cuánto planea invertir en {tenant.name}. El presupuesto es propio de esta organización y se compara con sus gastos. El límite legal aplicable debe verificarse por separado.</p><BudgetSettingsButton tenant={tenant} userRole={userRole}/>{tenant.campaignDate&&<p className="flex items-center gap-2 text-xs text-slate-400"><Calendar size={14}/>Fecha de campaña: {tenant.campaignDate}</p>}</div>
  <div className="min-w-0 space-y-3 border-t border-slate-700 pt-4 md:border-l md:border-t-0 md:pl-5 md:pt-0"><h2 className="flex items-center gap-2 font-bold text-white"><Target size={18}/>Metas por aspirante</h2><p className="text-sm text-slate-300">En Aspirantes, cada candidatura tiene su propia meta de votos: alcaldía, gobernación, concejo, asamblea, cámara o senado. Puede crearla o pulsar «Editar meta» en su ficha.</p><button type="button" onClick={onNavigateCandidates} className="min-h-11 rounded-xl border border-cyan-700 bg-cyan-950/40 px-4 py-2 text-sm font-semibold text-cyan-200">Configurar metas de aspirantes</button><p className="text-xs text-slate-400">Las metas de distintos cargos se consultan por separado para evitar contar dos veces a una persona.</p></div>
 </section>;
}
