import { RESOURCE_CATALOG, TRANSPORT_RESOURCE, validateRequest, type ResourceRequest } from './operations.js';

export type AgentDraft = Partial<Pick<ResourceRequest, 'resource'|'quantity'|'unitCost'|'description'|'municipality'|'leaderId'|'eventId'|'direction'>>;
export type AgentAction = 'message'|'edit'|'confirm'|'handoff'|'resume'|'cancel';
export type AgentConversation = {
  id:string; tenantId:string; ownerUid:string; revision:number; status:'draft'|'review'|'submitted'|'human'|'cancelled';
  draft:AgentDraft; messages:{role:'user'|'assistant';text:string}[]; updatedAt:string; requestId:string;
};
export type AgentContext = {tenantId:string;uid:string;leaders:{id:string;name:string}[];events:{id:string;name:string}[]};
export type AgentTurn = {conversationId:string;messageId:string;revision:number;action:AgentAction;text?:string;patch?:AgentDraft};
export class AgentError extends Error { constructor(message:string,public status=400){super(message);} }
const normalize=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const fields=['resource','quantity','municipality','description','leaderId','eventId','unitCost','direction'] as const;
export function validateAgentTurn(value:any): asserts value is AgentTurn {
  if(!value||!['message','edit','confirm','handoff','resume','cancel'].includes(value.action)
    || !/^[a-zA-Z0-9_-]{8,100}$/.test(value.conversationId||'') || !/^[a-zA-Z0-9_-]{8,100}$/.test(value.messageId||'')
    || !Number.isSafeInteger(value.revision)||value.revision<0 || (value.text!==undefined&&(typeof value.text!=='string'||value.text.length>1500))) throw new AgentError('Mensaje o identificador inválido.');
  if(value.action==='message'&&!value.text?.trim())throw new AgentError('Escriba un mensaje.');
  if(value.patch!==undefined){
    if(value.action!=='edit'||!value.patch||Array.isArray(value.patch)||typeof value.patch!=='object'||Object.keys(value.patch).some(k=>!fields.includes(k as any)))throw new AgentError('Campos de edición inválidos.');
    validateDraft(value.patch);
  }
}
export function validateDraft(draft:AgentDraft){
  for(const [k,v] of Object.entries(draft)){
    if(!fields.includes(k as any))throw new AgentError('Campo no permitido.');
    if(k==='quantity'||k==='unitCost'){
      if(typeof v!=='number'||!Number.isFinite(v)||(k==='quantity'?(v<=0||v>1000000):(v<0||v>100000000000)))throw new AgentError('Revise cantidad y costo unitario.');
    }else if(typeof v!=='string'||v.length>(k==='description'?500:200))throw new AgentError('Texto inválido o demasiado largo.');
  }
  if(draft.resource&&!RESOURCE_CATALOG.some(r=>r.name===draft.resource))throw new AgentError('Seleccione un recurso del catálogo.');
  if(draft.direction&&!['Ida','Regreso'].includes(draft.direction))throw new AgentError('Seleccione Ida o Regreso.');
  if(draft.resource===TRANSPORT_RESOURCE&&draft.quantity!==undefined&&!Number.isInteger(draft.quantity))throw new AgentError('Los pasajeros deben ser un número entero.');
}
export function missingField(d:AgentDraft):keyof AgentDraft|undefined {
  if(!d.resource)return 'resource';
  if(d.quantity===undefined)return 'quantity';
  if(!d.municipality?.trim())return 'municipality';
  if(!d.description?.trim())return 'description';
  if(!d.leaderId)return 'leaderId';
  if(d.resource===TRANSPORT_RESOURCE&&!d.eventId)return 'eventId';
  if(d.unitCost===undefined)return 'unitCost';
}
export function question(d:AgentDraft,c:AgentContext):string {
  switch(missingField(d)){
    case 'resource':return '¿Qué necesita? Puede escribir «Necesito 20 almuerzos», «Transporte para 8 personas» o elegir un recurso en la ficha.';
    case 'quantity':return '¿Qué cantidad necesita? Escriba solo el número.';
    case 'municipality':return '¿En qué municipio se necesita el recurso?';
    case 'description':return 'Describa la necesidad. Para transporte, indique origen, destino y hora de recogida.';
    case 'leaderId':return c.leaders.length?`Seleccione el responsable en la ficha o escriba su nombre exacto: ${c.leaders.slice(0,12).map(l=>l.name).join('; ')}.`:'No hay líderes disponibles. Registre primero al responsable en la plataforma.';
    case 'eventId':return c.events.length?`Seleccione la jornada en la ficha o escriba su nombre exacto: ${c.events.slice(0,12).map(e=>e.name).join('; ')}.`:'No hay jornadas activas. Cree una jornada antes de solicitar transporte.';
    case 'unitCost':return '¿Cuál es el costo unitario estimado en pesos? Escriba 0 si aún no tiene cotización.';
    default:return `Revise antes de guardar:\n${d.resource}: ${d.quantity}\nMunicipio: ${d.municipality}\nResponsable: ${c.leaders.find(l=>l.id===d.leaderId)?.name||''}\nJornada: ${c.events.find(e=>e.id===d.eventId)?.name||'Operación general'}\nDescripción: ${d.description}\nSentido: ${d.direction||'Ida'}\nCosto unitario: ${d.unitCost} COP · total estimado: ${Math.round(d.quantity!*d.unitCost!)} COP\nPulse «Confirmar y guardar» o escriba «confirmar». Quedará pendiente de aprobación.`;
  }
}
export function parseMessage(text:string,d:AgentDraft,c:AgentContext):AgentDraft {
  const n=normalize(text),next={...d},field=missingField(d);
  if(field==='resource'){
    const exact=RESOURCE_CATALOG.find(r=>normalize(r.name)===n);
    const resource=exact?.name||(/almuerzo|comida|alimentacion|raciones/.test(n)?'Alimentación':/refrigerio|hidratacion|agua/.test(n)?'Refrigerios e hidratación':/transporte|pasajero|cupos/.test(n)?TRANSPORT_RESOURCE:/combustible|gasolina|galones/.test(n)?'Combustible':undefined);
    if(resource){next.resource=resource;const q=n.match(/\b(\d+(?:[.,]\d+)?)\b/);if(q)next.quantity=Number(q[1].replace(',','.'));}
  }else if(field==='quantity'||field==='unitCost'){
    if(!/^\d+(?:[.,]\d+)?$/.test(n))throw new AgentError('Escriba un número sin separadores de miles, por ejemplo 15000.');
    next[field]=Number(n.replace(',','.'));
  }else if(field==='leaderId'||field==='eventId'){
    const list=field==='leaderId'?c.leaders:c.events;
    const found=list.filter(r=>normalize(r.name)===n||r.id===text.trim());
    if(found.length!==1)throw new AgentError('No hay una coincidencia única. Seleccione el registro en la ficha.');
    next[field]=found[0].id;
  }else if(field==='municipality'||field==='description')next[field]=text.trim();
  return next;
}
export function advanceAgent(previous:AgentConversation|undefined,turn:AgentTurn,c:AgentContext):AgentConversation {
  validateAgentTurn(turn);
  const current:AgentConversation=previous||{id:turn.conversationId,tenantId:c.tenantId,ownerUid:c.uid,revision:0,status:'draft',draft:{direction:'Ida'},messages:[],updatedAt:'',requestId:''};
  if(current.tenantId!==c.tenantId||current.ownerUid!==c.uid)throw new AgentError('La conversación pertenece a otro ámbito.',403);
  if(turn.action==='resume')return current;
  if(turn.revision!==current.revision)throw new AgentError('La conversación cambió. Recargue antes de continuar.',409);
  if(['submitted','cancelled'].includes(current.status))throw new AgentError('Esta conversación ya terminó. Inicie una nueva solicitud.',409);
  if(current.status==='human'&&turn.action!=='cancel')throw new AgentError('Atención manual activa. Use el formulario de solicitudes o cancele e inicie otra conversación.',409);
  let draft={...current.draft};let status=current.status;let reply='';
  const command=normalize(turn.text||'');
  if(turn.action==='handoff'||(turn.action==='message'&&/^(humano|asesor|persona)$/.test(command))){status='human';reply='Asistente pausado. Puede continuar con el formulario «Nueva solicitud». Aún no se ha creado ninguna solicitud ni enviado aviso a un coordinador.';}
  else if(turn.action==='cancel'){status='cancelled';reply='Borrador cancelado. No se creó una solicitud.';}
  else {
    const confirm=turn.action==='confirm'||(turn.action==='message'&&command==='confirmar');
    if(confirm){
      if(current.status!=='review'||missingField(draft))throw new AgentError('Complete y revise la ficha antes de confirmar.');
      status='submitted';reply='Solicitud guardada en Firestore, pendiente de aprobación. No representa cupo asignado, entrega ni gasto pagado.';
    }else {
      draft=turn.action==='edit'?{...draft,...turn.patch}:parseMessage(turn.text||'',draft,c);
      validateDraft(draft);status=missingField(draft)?'draft':'review';reply=question(draft,c);
    }
  }
  validateDraft(draft);
  if(draft.leaderId&&!c.leaders.some(l=>l.id===draft.leaderId))throw new AgentError('Seleccione un responsable vigente de esta organización.');
  if(draft.eventId&&!c.events.some(e=>e.id===draft.eventId))throw new AgentError('Seleccione una jornada activa de esta organización.');
  const userText=turn.action==='edit'?'Actualicé los campos de la ficha.':turn.text||({confirm:'Confirmar y guardar',handoff:'Atención manual',cancel:'Cancelar borrador'} as any)[turn.action];
  return {...current,draft,status,revision:current.revision+1,updatedAt:new Date().toISOString(),requestId:status==='submitted'?`agent-${c.uid}-${current.id}`:'',messages:[...current.messages,{role:'user' as const,text:userText},{role:'assistant' as const,text:reply}].slice(-30)};
}
export function agentRequest(c:AgentConversation):ResourceRequest {
  if(c.status!=='submitted'||missingField(c.draft))throw new AgentError('La ficha no está confirmada.');
  const d=c.draft;
  const request:ResourceRequest={id:c.requestId,tenantId:c.tenantId,eventId:d.eventId||'',leaderId:d.leaderId!,candidateId:'',municipality:d.municipality!,resource:d.resource!,description:d.description!,quantity:d.quantity!,unitCost:d.unitCost!,amount:Math.round(d.quantity!*d.unitCost!),status:'Pendiente',notes:'Creada mediante el asistente de solicitudes de Astrea.',createdBy:c.ownerUid,createdAt:c.updatedAt,reservedPassengers:0,arrivedPassengers:0,expenseId:'',direction:d.direction||'Ida'};
  validateRequest(request);return request;
}
