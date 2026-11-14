import React,{useEffect,useState} from 'react';
import type {SubscriptionHealth} from '../lib/dataSubscriptionHealth';
export function DataHealthStatus({tenantId,userId}:{tenantId:string;userId:string}){
 const [states,setStates]=useState<Record<string,SubscriptionHealth>>({});
 useEffect(()=>{setStates({});const update=(event:Event)=>{const next=(event as CustomEvent<SubscriptionHealth>).detail;if(next.tenantId===tenantId&&next.userId===userId)setStates(previous=>({...previous,[next.collection]:next}));};window.addEventListener('astrea:data-health',update);return()=>window.removeEventListener('astrea:data-health',update);},[tenantId,userId]);
 const values=Object.values(states) as SubscriptionHealth[];
 const errors=values.filter(s=>s.state==='error'),partial=values.some(s=>s.state==='partial');
 if(!errors.length&&!partial)return null;
 return <aside role="alert" className="mx-3 my-2 rounded-xl border border-amber-700 bg-amber-950/90 p-3 text-sm text-amber-100">{errors.length?'No se pudieron actualizar algunos datos. Las cifras pueden estar incompletas; una lista vacía no confirma ausencia de registros. Revise su conexión y permisos.':'Se alcanzó el límite de consulta en pantalla. Las cifras son parciales; utilice una exportación administrativa para revisar el conjunto completo.'}<button type="button" className="ml-3 min-h-11 rounded-lg border border-amber-600 px-3" onClick={()=>window.location.reload()}>Volver a cargar</button></aside>;
}
