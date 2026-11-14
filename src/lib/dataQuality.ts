import type {GrassrootsVoter} from '../types';
export function inspectDataQuality(rows:GrassrootsVoter[],tenantId:string){
 const groups=new Map<string,GrassrootsVoter[]>();let missingConsent=0,missingIdentity=0,missingTerritory=0,revoked=0;
 for(const row of rows.filter(r=>r.tenantId===tenantId)){
  if(!row.consentGiven)missingConsent++;
  if(row.consentRevokedAt)revoked++;
  const document=String(row.documentNumber||'').replace(/[.\s-]/g,'');
  if(!document)missingIdentity++;else{const group=groups.get(document)||[];group.push(row);groups.set(document,group);}
  if(!row.municipality?.trim()||!row.sector?.trim())missingTerritory++;
 }
 return {missingConsent,missingIdentity,missingTerritory,revoked,duplicates:[...groups].filter(([,group])=>group.length>1).map(([document,records])=>({document,records}))};
}
export const CONSENT_POLICY_VERSION='astrea-2026-11';
export type ConsentChannel='internal'|'phone'|'email';
export function consentPatch(options:{accepted:boolean;channels:ConsentChannel[];evidence:string;now?:string}){
 if(options.evidence.trim().length<8||options.evidence.length>500)throw new Error('Describa la constancia o la solicitud de retiro, entre 8 y 500 caracteres.');
 if(options.channels.some(c=>!['internal','phone','email'].includes(c)))throw new Error('Canal de autorización no admitido.');
 if(options.accepted&&!options.channels.length)throw new Error('Seleccione al menos una finalidad/canal autorizado.');
 return {consentGiven:options.accepted,consentAt:options.now||new Date().toISOString(),consentPolicyVersion:CONSENT_POLICY_VERSION,consentChannels:options.accepted?[...new Set(options.channels)]:[],consentPurpose:'organization_operations',consentEvidence:options.evidence.trim(),consentRevokedAt:options.accepted?'':options.now||new Date().toISOString()};
}
