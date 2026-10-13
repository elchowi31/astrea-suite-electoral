import React, { createContext, useContext, useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import type { CampaignExpense, Candidate, DonorContribution, GrassrootsVoter, Leader, Tenant, TransportVehicle, UserProfile } from '../../types';
import { EMPTY_OPERATIONS, type OperationsData } from '../../lib/operations';

interface OperationsContextValue extends OperationsData {
  tenant: Tenant; user: UserProfile | null; leaders: Leader[]; candidates: Candidate[]; voters: GrassrootsVoter[];
  expenses: CampaignExpense[]; vehicles: TransportVehicle[]; contributions: DonorContribution[]; readOnly: boolean; error: string; loading: boolean;
}
const Context=createContext<OperationsContextValue|null>(null);
export function OperationsProvider({children,demo,...props}: Omit<OperationsContextValue,keyof OperationsData|'error'|'loading'> & {children:React.ReactNode;demo?:OperationsData;key?:React.Key}) {
  const [data,setData]=useState<OperationsData>(EMPTY_OPERATIONS);const [errors,setErrors]=useState<Record<string,string>>({});const [loaded,setLoaded]=useState<string[]>([]);
  useEffect(()=>{
    setData(EMPTY_OPERATIONS);setErrors({});setLoaded([]);
    if(props.readOnly||!props.user)return;
    const user=props.user;
    const scope=['AdminGlobal','AdminTenant','Gobernador','Diputado','Alcalde','JefePolitico'].includes(user.role)?[]:user.role==='Concejal'&&user.assignedCandidateId?[where('candidateId','==',user.assignedCandidateId)]:user.assignedLeaderId?[where('leaderId','==',user.assignedLeaderId)]:[where('createdBy','==',user.uid)];
    const stop=(['events','requests','trips','reports','registrations'] as const).map((key,index)=>onSnapshot(query(collection(db,['jornadas_operativas','solicitudes_recursos','viajes_operativos','reportes_jornada','registros_jornada'][index]),where('tenantId','==',props.tenant.tenantId),...(key==='registrations'?scope:[])),snapshot=>{
      setData(prev=>({...prev,[key]:snapshot.docs.map(row=>row.data())}));setLoaded(prev=>[...new Set([...prev,key])]);setErrors(prev=>({...prev,[key]:''}));
    },error=>setErrors(prev=>({...prev,[key]:`No se pudieron cargar ${['las jornadas','las solicitudes','los viajes','los reportes','las planillas'][index]}: ${error.message}`}))));
    return()=>stop.forEach(unsubscribe=>unsubscribe());
  },[props.tenant.tenantId,props.user?.uid,props.user?.role,props.user?.assignedLeaderId,props.user?.assignedCandidateId,props.readOnly]);
  return <Context.Provider value={{...props,...(props.readOnly?demo||EMPTY_OPERATIONS:data),error:Object.values(errors).filter(Boolean).join(' '),loading:!props.readOnly&&!!props.user&&loaded.length<5&&!Object.values(errors).some(Boolean)}}>{children}</Context.Provider>;
}
export function useOperations(){const value=useContext(Context);if(!value)throw new Error('Falta el contexto operativo.');return value;}
