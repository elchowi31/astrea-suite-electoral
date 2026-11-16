import React from 'react';
import {FinancesView,type FinancesViewProps} from './FinancesView';
import {CampaignCostsReportView} from './CampaignCostsReportView';
import type {Leader,TransportVehicle,CampaignExpense} from '../types';
type Props=FinancesViewProps&{key?:React.Key;initialControl?:boolean;leaders:Leader[];vehicles:TransportVehicle[];onUpdateExpense:(expense:CampaignExpense)=>Promise<void>;onNavigateTab:(tab:any)=>void};
export function FinanceWorkspaceView(props:Props){
 return props.initialControl?<CampaignCostsReportView currentTenant={props.currentTenant} userRole={props.userRole} expenses={props.expenses} leaders={props.leaders} vehicles={props.vehicles} donorContributions={props.donorContributions} onAddExpense={props.onAddExpense} onUpdateExpense={props.onUpdateExpense} onDeleteExpense={props.onDeleteExpense} onNavigateTab={props.onNavigateTab}/>:<FinancesView {...props}/>;
}
