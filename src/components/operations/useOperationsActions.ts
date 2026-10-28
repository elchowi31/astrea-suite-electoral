import {useContext,useMemo} from 'react';
import {DemoEditing} from '../common/EditRecordButton';
import {useOperations} from './OperationsContext';
import * as real from '../../lib/operationsStore';
import {demoOperationsStore} from '../../lib/demoOperationsStore';
export function useOperationsActions(){
  const data=useOperations(),workspace=useContext(DemoEditing);
  const demo=data.readOnly&&workspace?.bundle.tenantId===data.tenant.tenantId;
  const actions=useMemo(()=>demo?demoOperationsStore(data.tenant.tenantId):real,[demo,data.tenant.tenantId]);
  return {...actions,editable:!!data.user&&(!data.readOnly||!!demo)};
}
