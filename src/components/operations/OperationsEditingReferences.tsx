import React from 'react';
import { EditingReferences } from '../common/EditRecordButton';
import { useOperations } from './OperationsContext';
export function OperationsEditingReferences({children}:{children:React.ReactNode}){
  const data=useOperations();return <EditingReferences.Provider value={{vehiculos:data.vehicles.map(v=>({id:v.id,name:v.licensePlate})),candidatos:data.candidates.map(c=>({id:c.id,name:c.fullName})),lideres:data.leaders.map(l=>({id:l.id,name:l.fullName})),aportes:data.contributions.map(c=>({id:c.id,name:c.donorName})),jornadas_operativas:data.events.map(e=>({id:e.id,name:e.name}))}}>{children}</EditingReferences.Provider>;
}
