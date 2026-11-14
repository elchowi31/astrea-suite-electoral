import React,{useEffect,useState} from 'react';
import {FinancesView,type FinancesViewProps} from './FinancesView';
import {CampaignCostsReportView} from './CampaignCostsReportView';
import type {Leader,TransportVehicle,CampaignExpense} from '../types';
import {usePageBack} from './PageNavigation';
type Props=FinancesViewProps&{key?:React.Key;initialControl?:boolean;leaders:Leader[];vehicles:TransportVehicle[];onUpdateExpense:(expense:CampaignExpense)=>Promise<void>;onNavigateTab:(tab:any)=>void};
export function FinanceWorkspaceView(props:Props){
 const [control,setControl]=useState(!!props.initialControl);
 useEffect(()=>setControl(!!props.initialControl),[props.initialControl,props.currentTenant.tenantId]);
 usePageBack('Finanzas y control',()=>setControl(false),control,5);
 return <section className="space-y-4"><nav aria-label="Herramientas financieras" className="flex flex-wrap gap-2">{[[false,'Finanzas y aportes'],[true,'Control detallado de gastos']].map(([value,label])=><button key={String(value)} type="button" aria-pressed={control===value} onClick={()=>setControl(Boolean(value))} className={`min-h-11 rounded-lg border px-4 py-2 text-sm ${control===value?'border-cyan-500 bg-cyan-950 text-cyan-100':'border-slate-700 text-slate-300'}`}>{String(label)}</button>)}</nav>{control?<CampaignCostsReportView currentTenant={props.currentTenant} userRole={props.userRole} expenses={props.expenses} leaders={props.leaders} vehicles={props.vehicles} donorContributions={props.donorContributions} onAddExpense={props.onAddExpense} onUpdateExpense={props.onUpdateExpense} onDeleteExpense={props.onDeleteExpense} onNavigateTab={props.onNavigateTab}/>:<FinancesView {...props}/>}</section>;
}
