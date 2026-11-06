import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import {importTableFile,tableChunks,normalizeTable} from '../src/lib/tableImport';
const file=(name:string,bytes:Uint8Array)=>({name,size:bytes.length,arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength) as ArrayBuffer});
test('CSV roundtrip keeps zeroes, identifiers and quoted multiline text',async()=>{
  const r=await importTableFile(file('datos.csv',new TextEncoder().encode('nombre;codigo;horas\n"Equipo\nUno";00123;0')));
  assert.equal(r.rowCount,1);assert.equal(r.tables[0].rows[0].codigo,'00123');assert.equal(r.tables[0].rows[0].horas,'0');assert.equal(r.tables[0].rows[0].nombre,'Equipo\nUno');
});
test('Excel imports every sheet; JSON and empty files validate; chunks preserve all rows',async()=>{
  const wb=XLSX.utils.book_new();for(const sheet of ['Equipos','Recursos'])XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet([{nombre:sheet,cantidad:2}]),sheet);
  for(const bookType of ['xlsx','xls'] as const){const r=await importTableFile(file(`datos.${bookType}`,XLSX.write(wb,{type:'buffer',bookType})));assert.equal(r.tables.length,2);assert.equal(r.rowCount,2);}
  const json=await importTableFile(file('datos.json',new TextEncoder().encode('[{"nombre":"A","horas":0}]')));assert.equal(json.tables[0].rows[0].horas,'0');
  await assert.rejects(importTableFile(file('vacio.csv',new Uint8Array())),/tabla|registros/);
  assert.throws(()=>normalizeTable([{constructor:'bad'}],'Datos'),/reservados/);
  const table=normalizeTable(Array.from({length:501},(_,i)=>({codigo:String(i)})),'Datos');const chunks=tableChunks({filename:'datos.csv',tables:[table],rowCount:501},'t','u','Base','fixed');
  assert.deepEqual(chunks.map(c=>c.rows.length),[200,200,101]);assert.equal(chunks.flatMap(c=>c.rows).at(-1)?.codigo,'500');assert.ok(chunks.every(c=>c.tenantId==='t'&&c.ownerId==='u'));
});
