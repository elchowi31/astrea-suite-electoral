import {test} from 'node:test';
import assert from 'node:assert/strict';
import {summarizeServiceCosts} from '../src/lib/serviceCosts.ts';
import type {CampaignExpense} from '../src/types';
const expense=(patch:Partial<CampaignExpense>={}):CampaignExpense=>({id:'one',tenantId:'tenant',component:'Transporte y Movilización',amount:200000,quantity:10,unitMeasure:'personas',date:'2026-11-05',status:'Pagado',municipality:'Astrea',responsibleLeaderId:'responsible',...patch});
test('cost per recorded unit divides expenses by quantity and keeps different units separate',()=>{
 const s=summarizeServiceCosts([expense(),expense({id:'two',amount:60000,quantity:3}),expense({id:'three',amount:100000,quantity:1,unitMeasure:'viaje'})],'tenant');
 assert.equal(s.total,360000);assert.equal(s.units.length,2);
 assert.equal(s.units.find(g=>g.unit==='personas')?.unitCost,20000);
 assert.equal(s.units.find(g=>g.unit==='viaje')?.unitCost,100000);
});
test('all filters apply together and foreign tenant data never affects totals',()=>{
 const s=summarizeServiceCosts([expense(),expense({tenantId:'foreign',amount:900000}),expense({date:'2026-11-04'}),expense({municipality:'Bosconia'}),expense({status:'Pendiente'})],'tenant',{municipality:'Astrea',responsible:'responsible',category:'Transporte y Movilización',status:'Pagado',from:'2026-11-05',to:'2026-11-05'});
 assert.equal(s.total,200000);assert.equal(s.records.length,1);
});
test('missing quantities do not dilute unit costs and discrepancies are reported',()=>{
 const s=summarizeServiceCosts([expense({unitCost:1000}),expense({quantity:0,amount:50000}),expense({quantity:undefined,amount:10000}),expense({amount:NaN})],'tenant');
 assert.equal(s.total,260000);assert.equal(s.units[0].unitCost,20000);assert.equal(s.missingQuantity,2);assert.equal(s.invalidCount,1);assert.equal(s.mismatched,1);
});
test('payment statuses are distinct and an empty denominator never produces zero or infinity',()=>{
 const s=summarizeServiceCosts([expense({quantity:undefined}),expense({status:'Aprobado',amount:30000}),expense({status:'Pendiente',amount:50000})],'tenant');
 assert.equal(s.paid,200000);assert.equal(s.approved,30000);assert.equal(s.pending,50000);
 assert.deepEqual(summarizeServiceCosts([],'tenant').units,[]);
});
