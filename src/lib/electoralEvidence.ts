export type ActaLine={label:string;votes:number};
export type WitnessAssignment={id:string;tenantId:string;municipality:string;pollingStation:string;tableNumber:number;contest:string;assignedUid:string;assignedName:string;createdBy:string;createdAt:string;updatedAt:string;revision:number};
export type ElectoralEvidence={id:string;tenantId:string;assignmentId:string;assignedUid:string;contest:string;submittedBy:string;createdAt:string;updatedAt:string;revision:number;status:'En revisión'|'Revisada';results:ActaLine[];photo:string;notes:string;reviewedBy?:string;reviewedAt?:string};
export function parseActaLines(text:string):ActaLine[]{
 const lines=text.split(/\r?\n/).filter(s=>s.trim());
 if(!lines.length||lines.length>30)throw new Error('Registre entre una y treinta líneas con el formato nombre;cantidad.');
 const seen=new Set<string>();
 return lines.map(line=>{const [rawLabel,rawVotes,...extra]=line.split(';'),label=rawLabel.trim(),votes=rawVotes?.trim();
  if(extra.length||!label||label.length>120||!/^\d{1,7}$/.test(votes||'')||Number(votes)>1000000)throw new Error('Cada línea necesita un nombre y una cantidad entera entre 0 y 1.000.000, separados por punto y coma.');
  const key=label.toLocaleLowerCase('es');if(seen.has(key))throw new Error('Hay nombres repetidos en el acta.');seen.add(key);return {label,votes:Number(votes)};
 });
}
export function validateActaEvidence(value:Pick<ElectoralEvidence,'results'|'photo'|'notes'>){
 if(!Array.isArray(value.results)||value.results.length<1||value.results.length>30||value.results.some(r=>!r.label?.trim()||/[;\r\n]/.test(r.label)||r.label.length>120||!Number.isInteger(r.votes)||r.votes<0||r.votes>1000000))throw new Error('Los resultados del acta no son válidos.');
 if(new Set(value.results.map(r=>r.label.trim().toLocaleLowerCase('es'))).size!==value.results.length)throw new Error('El acta contiene nombres repetidos.');
 if(typeof value.photo!=='string'||value.photo.length>500000||!/^data:image\/(jpeg|png|webp);base64,[a-zA-Z0-9+/=]+$/.test(value.photo))throw new Error('Adjunte una fotografía JPEG, PNG o WebP de hasta 500 KB codificados.');
 if(typeof value.notes!=='string'||value.notes.length>1500)throw new Error('La observación supera 1.500 caracteres.');
}
export async function witnessAssignmentId(tenantId:string,municipality:string,station:string,table:number,contest:string){
 if(!tenantId||!municipality.trim()||!station.trim()||!contest.trim()||!Number.isInteger(table)||table<1||table>10000)throw new Error('Complete territorio, puesto, mesa y elección.');
 const key=[municipality,station,String(table),contest].map(s=>s.normalize('NFC').trim().replace(/\s+/g,' ').toLocaleLowerCase('es')).join('|');
 const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(key)))].map(b=>b.toString(16).padStart(2,'0')).join('');
 return `${tenantId}--mesa--${hash}`;
}
export function consolidateReviewedActas(rows:ElectoralEvidence[],tenantId:string){
 const totals=new Map<string,{contest:string;label:string;votes:number}>(),assignments=new Set<string>();let reviewed=0,invalid=0;
 for(const row of rows.filter(r=>r.tenantId===tenantId&&r.status==='Revisada')){
  try{if(!row.contest?.trim())throw new Error('Sin elección');validateActaEvidence(row);}catch{invalid++;continue;}
  if(assignments.has(row.assignmentId)){invalid++;continue;}assignments.add(row.assignmentId);reviewed++;
  for(const line of row.results){const key=row.contest+'|'+line.label.trim().toLocaleLowerCase('es'),current=totals.get(key)||{contest:row.contest,label:line.label,votes:0};current.votes+=line.votes;totals.set(key,current);}
 }
 return {reviewed,invalid,totals:[...totals.values()].sort((a,b)=>a.contest.localeCompare(b.contest)||b.votes-a.votes)};
}

/** Canonical bounded text keeps all 30 rows verifiable within Firestore's rule budget. */
export function storedElectoralEvidence(value:ElectoralEvidence){
 validateActaEvidence(value);const {results,...rest}=value;
 return {...rest,resultsText:results.map(row=>`${row.label.trim()};${row.votes}`).join('\n')};
}
export function readElectoralEvidence(value:Record<string,unknown>):ElectoralEvidence{
 const {resultsText,...rest}=value;
 if(typeof resultsText!=='string'||resultsText.length>4000)throw new Error('El acta guardada tiene un formato no válido.');
 const result={...rest,results:parseActaLines(resultsText)} as ElectoralEvidence;validateActaEvidence(result);return result;
}
