import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import {buildRewardWorkbook} from '../src/lib/rewardWorkbook';
import {importRewardMatrix} from '../src/lib/rewardFiles';
import {DEFAULT_REWARDS,calculateRewards} from '../src/lib/rewards';
const importBook=async(book:XLSX.WorkBook)=>{const bytes=XLSX.write(book,{type:'array',bookType:'xlsx'});return importRewardMatrix({size:bytes.byteLength,arrayBuffer:async()=>bytes});};
test('Manual workbook round-trips targets, blanks and zero with one input column per team',async()=>{
 const config=structuredClone(DEFAULT_REWARDS);config.farms[0].manualHours=[300,400,250,...Array(7).fill(null)];config.farms[1].manualHours[0]=0;config.farms[1].targetHoursPerTeam=2000;
 const book=buildRewardWorkbook(config);assert.deepEqual(await importBook(book),config);
 assert.equal(book.Sheets.Datos.C4.v,'astrea-rewards-manual-v2');assert.equal(book.Sheets.Datos.G14.v,300);assert.equal(book.Sheets.Datos.F15.v,2000);
 assert.deepEqual([4,5,6].map(n=>book.Sheets.Matriz['M'+n].v),[6,9,5]);assert.deepEqual([4,5,6].map(n=>book.Sheets.Matriz['F'+n].v),[.6,.8,.5]);
 assert.ok(book.Sheets.Matriz.M4.f.includes('Calculos!D2'));assert.ok(book.Sheets.Calculos.D2.f.includes('C2>0'));assert.equal(book.Sheets.Matriz.D14.v,0);assert.equal(book.Sheets.Matriz.D15.v,'');
 const expected=calculateRewards(config).rows;for(let i=0;i<expected.length;i++)assert.equal(expected[i].teams.reduce((s,t)=>s+t.expectedFruits,0),Array.from({length:config.teamCount},(_,j)=>book.Sheets.Matriz['M'+(4+i*10+j)].v).reduce((s,n)=>s+Number(n),0));
});
test('Old workbook imports legacy columns without interpreting automatic assignments as hours',async()=>{
 const book=XLSX.utils.book_new(),sheet:XLSX.WorkSheet={'!ref':'C6:O113',C6:{t:'n',v:7000},C7:{t:'n',v:1},C8:{t:'n',v:3},E14:{t:'n',v:20},G14:{t:'n',v:0}};XLSX.utils.book_append_sheet(book,sheet,'Datos');
 const restored=await importBook(book);assert.equal(restored.schemaVersion,1);assert.deepEqual(restored.farms[0].manualHours.slice(0,3),[null,0,null]);
 sheet.F14={t:'n',f:'1+1',v:2};await assert.rejects(()=>importBook(book),/fórmulas/);
});
