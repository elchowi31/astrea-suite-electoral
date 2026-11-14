import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeFinances} from '../src/lib/financialSummary';
import type {CampaignExpense,DonorContribution} from '../src/types';
const expense=(id:string,amount:number,status:string,extra={})=>({id,tenantId:'a',amount,status,...extra} as CampaignExpense);
const contribution=(id:string,amount:number,contributionType:string,extra={})=>({id,tenantId:'a',amount,contributionType,...extra} as DonorContribution);
test('cash excludes in-kind, pending and approved expenses and isolates organizations',()=>{
 const summary=summarizeFinances([expense('paid',100,'Pagado'),expense('approved',70,'Aprobado'),expense('pending',30,'Pendiente'),expense('kind',40,'Pagado',{settlementType:'Especie'}),expense('other',999,'Pagado',{tenantId:'b'})],[contribution('cash',500,'Efectivo / Transferencia Bancaria'),contribution('kind',200,'Otro Aporte en Especie'),contribution('other',999,'Efectivo / Transferencia Bancaria',{tenantId:'b'})],'a');
 assert.equal(summary.recordedCashBalance,400);assert.equal(summary.afterCommitments,300);assert.equal(summary.commitments,100);assert.equal(summary.inKindIncome,200);assert.equal(summary.paid,140);assert.equal(summary.registeredExpenses,240);
});
test('invalid amounts and unknown classifications are visible, never invented cash',()=>{
 const summary=summarizeFinances([expense('invalid',NaN,'Pagado'),expense('negative',-3,'Pagado'),expense('unknown',20,'Desconocido')],[contribution('unknown',50,'Desconocido'),contribution('negative',-5,'Efectivo / Transferencia Bancaria')],'a');
 assert.equal(summary.recordedCashBalance,0);assert.equal(summary.invalidRecords,3);assert.equal(summary.unknownExpenseStatuses,1);assert.equal(summary.unknownContributionAmount,50);
});
