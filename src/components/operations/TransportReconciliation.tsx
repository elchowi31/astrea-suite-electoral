import React,{useState} from 'react';
import { TRANSPORT_RESOURCE,unrequestedTransport,type OperationalEvent } from '../../lib/operations';
import { saveRequest } from '../../lib/operationsStore';
import { useOperations } from './OperationsContext';
import { Panel,secondary } from './OperationsUI';
export function TransportReconciliation({event}:{event?:OperationalEvent}){
  const data=useOperations();const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');
  const omissions=event?unrequestedTransport(event,data.voters.filter(v=>data.readOnly||v.consentGiven===true),data.requests):[];
  if(!omissions.length)return null;
  return <Panel title="Necesidades del listado sin solicitud" subtitle="Cruce con quienes marcaron transporte en su formulario. Las solicitudes existentes del líder se descuentan para evitar sumar la misma necesidad dos veces.">
    <ul className="space-y-2 text-sm">{omissions.map(row=><li key={row.leaderId} className="rounded-xl bg-amber-500/10 p-3 text-amber-300"><strong>{data.leaders.find(l=>l.id===row.leaderId)?.fullName||'Líder del registro'}</strong>: {row.registered} requieren transporte en el listado, {row.requested} solicitados; faltan {row.missing} por solicitar.</li>)}</ul>
    <button className={`${secondary} mt-3`} disabled={busy||data.readOnly} onClick={async()=>{
      setBusy(true);setMessage('');let saved=0;
      try{for(const row of omissions){const leader=data.leaders.find(l=>l.id===row.leaderId);if(!leader)continue;
        await saveRequest({id:`${data.tenant.tenantId}--lista--${event!.id}--${leader.id}`,tenantId:data.tenant.tenantId,eventId:event!.id,leaderId:leader.id,candidateId:leader.assignedCandidateId||'',municipality:event!.municipality,resource:TRANSPORT_RESOURCE,description:`Transporte del listado · ${leader.fullName}`,quantity:row.missing,unitCost:0,amount:0,status:'Pendiente',notes:'Cantidad contrastada con el listado autorizado; confirmar costo y aprobar antes de asignar.',createdBy:data.user!.uid,createdAt:new Date().toISOString(),reservedPassengers:0,arrivedPassengers:0,expenseId:''},data.user!,true);saved++;
      }setMessage(`${saved} solicitudes guardadas. Confirme costo y aprobación en Solicitudes y jornadas.`);}catch(e){setMessage(`${saved} solicitudes guardadas. ${(e as Error).message}`);}finally{setBusy(false);}
    }}>Crear solicitudes pendientes del listado</button>{message&&<p role="status" className="mt-3 text-sm text-amber-300">{message}</p>}
  </Panel>;
}
