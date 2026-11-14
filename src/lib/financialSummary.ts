import type {CampaignExpense,DonorContribution} from '../types';

export const validFinancialAmount=(amount:number)=>Number.isFinite(amount)&&amount>=0;
/** Recorded monetary balance; not a bank reconciliation. In-kind contributions never enter cash. */
export function summarizeFinances(expenses:CampaignExpense[],contributions:DonorContribution[],tenantId:string){
 const scopedExpenses=expenses.filter(e=>e.tenantId===tenantId),scopedContributions=contributions.filter(c=>c.tenantId===tenantId);
 const validExpenses=scopedExpenses.filter(e=>validFinancialAmount(e.amount));
 const validContributions=scopedContributions.filter(c=>validFinancialAmount(c.amount));
 const sum=<T extends {amount:number}>(rows:T[])=>rows.reduce((s,r)=>s+r.amount,0);
 const cashContributions=validContributions.filter(c=>c.contributionType==='Efectivo / Transferencia Bancaria');
 const inKindContributions=validContributions.filter(c=>String(c.contributionType).includes('Especie'));
 const unknownContributions=validContributions.filter(c=>!cashContributions.includes(c)&&!inKindContributions.includes(c));
 const paid=validExpenses.filter(e=>e.status==='Pagado'),approved=validExpenses.filter(e=>e.status==='Aprobado'),pending=validExpenses.filter(e=>e.status==='Pendiente');
 const cashPaid=sum(paid.filter(e=>e.settlementType!=='Especie'));
 const cashIncome=sum(cashContributions),inKindIncome=sum(inKindContributions);
 return {registeredExpenses:sum(validExpenses),registeredContributions:sum(validContributions),cashIncome,inKindIncome,
  paid:sum(paid),cashPaid,inKindPaid:sum(paid.filter(e=>e.settlementType==='Especie')),approved:sum(approved),pending:sum(pending),
  commitments:sum(approved)+sum(pending),recordedCashBalance:cashIncome-cashPaid,
  afterCommitments:cashIncome-cashPaid-sum(approved.filter(e=>e.settlementType!=='Especie'))-sum(pending.filter(e=>e.settlementType!=='Especie')),
  invalidRecords:scopedExpenses.length-validExpenses.length+scopedContributions.length-validContributions.length,
  unknownContributionAmount:sum(unknownContributions),unknownExpenseStatuses:validExpenses.filter(e=>!['Pagado','Pendiente','Aprobado'].includes(e.status)).length,
  expenseCount:validExpenses.length,contributionCount:validContributions.length,
 };
}
