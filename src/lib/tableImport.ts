import {unzipSync} from 'fflate';
import {decodeCsvText,parseCsvRows} from './geographicImport';
export interface ImportedTable {sheet:string;columns:string[];rows:Record<string,string>[]}
export interface TableImport {filename:string;tables:ImportedTable[];rowCount:number}
export interface StoredTable extends ImportedTable {id:string;tenantId:string;ownerId:string;importId:string;filename:string;name:string;part:number;createdAt:string}
const LIMIT=5000,BYTES=10*1024*1024;
export function normalizeTable(rows:Record<string,unknown>[],sheet:string):ImportedTable{
  if(rows.length>LIMIT)throw new Error('Máximo 5.000 filas por importación.');
  const columns=[...new Set(rows.flatMap(row=>Object.keys(row)))];
  if(!columns.length||columns.length>100)throw new Error('La tabla debe tener entre 1 y 100 columnas.');
  if(columns.some(k=>!k.trim()||k.length>160||['__proto__','prototype','constructor'].includes(k)))throw new Error('Hay nombres de columna vacíos, reservados o demasiado largos.');
  return {sheet,columns,rows:rows.map((row,i)=>Object.fromEntries(columns.map(key=>{
    const value=row[key];if(value!==null&&value!==undefined&&typeof value==='object'&&!(value instanceof Date))throw new Error(`Fila ${i+2}: use celdas simples.`);
    const text=value instanceof Date?value.toISOString():String(value??'');if(text.length>5000)throw new Error(`Fila ${i+2}: una celda supera 5.000 caracteres.`);return [key,text];
  })))};
}
export async function importTableFile(file:Pick<File,'name'|'size'|'arrayBuffer'>):Promise<TableImport>{
  if(file.size>BYTES)throw new Error('La base supera 10 MB.');
  const extension=file.name.split('.').at(-1)?.toLowerCase();if(!['xlsx','xls','csv','json'].includes(extension||''))throw new Error('Use XLSX, XLS, CSV o JSON. Los KML/KMZ se cargan en Mapa territorial.');
  const bytes=new Uint8Array(await file.arrayBuffer());let tables:ImportedTable[];
  if(extension==='csv')tables=[normalizeTable(parseCsvRows(decodeCsvText(bytes)),'Datos')];
  else if(extension==='json'){
    const data:unknown=JSON.parse(new TextDecoder().decode(bytes));if(!Array.isArray(data)||data.some(r=>!r||typeof r!=='object'||Array.isArray(r)))throw new Error('El JSON debe ser una lista de registros.');
    tables=[normalizeTable(data,'Datos')];
  }else{
    if(extension==='xlsx'){let expanded=0;unzipSync(bytes,{filter:e=>{expanded+=e.originalSize;if(expanded>40*1024*1024)throw new Error('El Excel descomprimido supera 40 MB.');return false;}});}
    const XLSX=await import('xlsx'),book=XLSX.read(bytes,{type:'array',cellDates:true});
    tables=book.SheetNames.flatMap(name=>{const sheet=book.Sheets[name],range=XLSX.utils.decode_range(sheet['!ref']||'A1');if(range.e.r-range.s.r>LIMIT||range.e.c-range.s.c>=100)throw new Error(`Hoja ${name}: máximo 5.000 filas y 100 columnas.`);
      const rows=XLSX.utils.sheet_to_json<Record<string,unknown>>(sheet,{defval:'',raw:true});return rows.length?[normalizeTable(rows,name)]:[];});
  }
  const rowCount=tables.reduce((s,t)=>s+t.rows.length,0);if(!rowCount)throw new Error('No hay registros para importar.');if(rowCount>LIMIT)throw new Error('Máximo 5.000 filas entre todas las hojas.');
  return {filename:file.name,tables,rowCount};
}
export function tableChunks(data:TableImport,tenantId:string,ownerId:string,name:string,importId:string=crypto.randomUUID()):StoredTable[]{
  const result:StoredTable[]=[];const createdAt=new Date().toISOString();
  for(const table of data.tables){let rows:Record<string,string>[]=[],size=0;
    const flush=()=>{if(!rows.length)return;const part=result.length;result.push({...table,rows,id:`${tenantId}--data-${importId}-${part}`,tenantId,ownerId,importId,filename:data.filename,name:name.trim().slice(0,160)||data.filename,part,createdAt});rows=[];size=0;};
    for(const row of table.rows){const bytes=new TextEncoder().encode(JSON.stringify(row)).length;if(bytes>200000)throw new Error('Una fila es demasiado grande.');if(size+bytes>450000||rows.length>=200)flush();rows.push(row);size+=bytes;}flush();
  }
  if(result.length>400)throw new Error('Divida la importación en archivos más pequeños.');return result;
}
