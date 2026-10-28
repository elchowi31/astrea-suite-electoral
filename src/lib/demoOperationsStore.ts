import {auth} from './firebase';
import {createOperationsStore,type OperationTransaction} from './operationsStore';
import {DEMO_COLLECTIONS,demoRows,setDemoRows,mutateDemoWorkspace} from './demoWorkspace';
import type {DemoBundle} from '../data/demoSeed';

type Ref={collection:string;id:string};
/** Changes a bundle atomically; no operational collection is written in demo mode. */
export async function applyDemoOperation(raw:DemoBundle,callback:(tx:OperationTransaction<Ref>)=>Promise<void>) {
  const bundle=structuredClone(raw),documents=new Map<string,Record<string,any>>();
  const key=(r:Ref)=>`${r.collection}/${r.id}`;
  for(const collection of Object.keys(DEMO_COLLECTIONS))for(const row of demoRows(bundle,collection))documents.set(`${collection}/${row.id}`,row);
  const anchor=bundle.coordinations[0] as typeof bundle.coordinations[number]&{_operationAudit?:Record<string,any>[]};
  for(const row of anchor?._operationAudit||[])documents.set(`auditoria/${row.id}`,row);
  for(const trip of bundle.operations?.trips||[]){
    if(!['Programado','En curso'].includes(trip.status))continue;
    for(const day of new Set([trip.startAt.slice(0,10),new Date(Date.parse(trip.endAt)-1).toISOString().slice(0,10)])){
      const id=`${trip.tenantId}--${trip.vehicleId}--${day}`,k=`agenda_vehiculos/${id}`;
      const book=documents.get(k)||{tenantId:trip.tenantId,vehicleId:trip.vehicleId,day,slots:[]};
      book.slots.push({tripId:trip.id,startAt:trip.startAt,endAt:trip.endAt});documents.set(k,book);
    }
  }
  const changed=new Set<string>();
  const write=(ref:Ref,data:Record<string,any>)=>{
    if(!['auditoria','agenda_vehiculos',...Object.keys(DEMO_COLLECTIONS)].includes(ref.collection))throw new Error('Colección no permitida en las pruebas.');
    documents.set(key(ref),structuredClone(data));changed.add(ref.collection);
  };
  await callback({get:async ref=>({data:()=>structuredClone(documents.get(key(ref))),exists:()=>documents.has(key(ref)),ref}),
    set:write,update:(ref,data)=>{if(!documents.has(key(ref)))throw new Error('El registro ya no existe.');write(ref,{...documents.get(key(ref)),...data});}});
  for(const collection of changed){
    const rows=[...documents.entries()].filter(([path])=>path.startsWith(`${collection}/`)).map(([,row])=>row);
    if(collection==='agenda_vehiculos')continue; // Rebuilt from trips on every transaction.
    if(collection==='auditoria'){
      if(!anchor)throw new Error('Falta la coordinación del entorno de prueba.');
      if(rows.length>500)throw new Error('Se alcanzó el límite de operaciones de prueba. Conserve una copia antes de regenerarlas.');
      anchor._operationAudit=rows;
    }else setDemoRows(bundle,collection,rows);
  }
  return bundle;
}
export function demoOperationsStore(tenantId:string) {
  return createOperationsStore<Ref>({reference:(collection,id)=>({collection,id}),actorUid:()=>auth.currentUser?.uid,
    transaction:callback=>mutateDemoWorkspace(tenantId,bundle=>applyDemoOperation(bundle,callback))});
}
