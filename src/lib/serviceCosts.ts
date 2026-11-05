import type {CampaignExpense} from '../types';

export type CostFilters={municipality?:string;responsible?:string;category?:string;status?:string;from?:string;to?:string};
export type CostGroup={name:string;amount:number;count:number};
export function summarizeServiceCosts(expenses:CampaignExpense[],tenantId:string,filters:CostFilters={}){
 const inScope=expenses.filter(e=>e.tenantId===tenantId);
 const selected=inScope.filter(e=>{
  const day=e.date?.slice(0,10)||'';
  return (!filters.municipality||(e.municipality||'Sin municipio')===filters.municipality)
   &&(!filters.responsible||(e.responsibleLeaderId||'unassigned')===filters.responsible)
   &&(!filters.category||(e.rubro||e.component)===filters.category)
   &&(!filters.status||e.status===filters.status)
   &&(!filters.from||day>=filters.from)&&(!filters.to||(!!day&&day<=filters.to));
 });
 const invalid=selected.filter(e=>!Number.isFinite(e.amount)||e.amount<0);
 const records=selected.filter(e=>Number.isFinite(e.amount)&&e.amount>=0);
 const group=(key:(e:CampaignExpense)=>string)=>{
  const groups=new Map<string,CostGroup>();
  for(const e of records){const name=key(e);const g=groups.get(name)||{name,amount:0,count:0};g.amount+=e.amount;g.count++;groups.set(name,g);}
  return [...groups.values()].sort((a,b)=>b.amount-a.amount||a.name.localeCompare(b.name));
 };
 const unitGroups=new Map<string,{category:string;unit:string;amount:number;quantity:number;count:number;unitCost:number}>();
 const validQuantity=(e:CampaignExpense)=>Number.isFinite(e.quantity)&&Number(e.quantity)>0&&!!e.unitMeasure?.trim();
 for(const e of records.filter(validQuantity)){
  const category=e.rubro||e.component,unit=e.unitMeasure!.trim().toLocaleLowerCase('es-CO');
  const key=JSON.stringify([category,unit]);const g=unitGroups.get(key)||{category,unit,amount:0,quantity:0,count:0,unitCost:0};
  g.amount+=e.amount;g.quantity+=e.quantity!;g.count++;g.unitCost=g.amount/g.quantity;unitGroups.set(key,g);
 }
 return {
  records,invalidCount:invalid.length,total:records.reduce((s,e)=>s+e.amount,0),
  paid:records.filter(e=>e.status==='Pagado').reduce((s,e)=>s+e.amount,0),
  approved:records.filter(e=>e.status==='Aprobado').reduce((s,e)=>s+e.amount,0),
  pending:records.filter(e=>e.status==='Pendiente').reduce((s,e)=>s+e.amount,0),
  unknownStatus:records.filter(e=>!['Pagado','Pendiente','Aprobado'].includes(e.status)).length,
  missingQuantity:records.filter(e=>!validQuantity(e)).length,
  missingInvoice:records.filter(e=>!e.invoiceNumber?.trim()).length,
  unassigned:records.filter(e=>!e.responsibleLeaderId).length,
  mismatched:records.filter(e=>validQuantity(e)&&Number.isFinite(e.unitCost)&&Math.abs(e.amount-e.quantity!*e.unitCost!)>1).length,
  categories:group(e=>e.rubro||e.component),municipalities:group(e=>e.municipality||'Sin municipio'),
  territories:group(e=>`${e.municipality||'Sin municipio'} · ${e.veredaOrBarrio||'Sin vereda/barrio'}`),
  responsible:group(e=>e.responsibleLeaderId||'unassigned'),statuses:group(e=>e.status||'Sin estado'),
  trend:group(e=>/^\d{4}-\d{2}-\d{2}/.test(e.date||'')?e.date.slice(0,10):'Sin fecha').sort((a,b)=>a.name.localeCompare(b.name)),
  units:[...unitGroups.values()].sort((a,b)=>b.amount-a.amount),
 };
}
