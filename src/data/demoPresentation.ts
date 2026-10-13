import type { DemoBundle } from './demoSeed';
import {demoRegistrations} from './demoRegistrations';

const firstNames = ['Laura','Andrés','Camila','Daniel','Valentina','Santiago','Mariana','Felipe','Natalia','Sebastián','Carolina','Julián','Paula','Alejandro','Diana','Mateo','Isabel','David','Adriana','Nicolás','Lucía','Gabriel','Claudia','Tomás'];
const surnames = ['Castro','Rojas','Mendoza','Pérez','Torres','Gómez','Vargas','Morales','Herrera','Romero','Suárez','Acosta','Medina','Ruiz','Pacheco','Cárdenas','Salazar','Duarte','Bermúdez','Navarro','Cabrera','Vega','Molina','Ríos','Delgado','Ortiz','Quintero','Arias','Serrano','León'];

/** Presentation names only: generated people retain their synthetic bundle provenance. */
export function samplePersonName(index: number): string {
  const first = index % firstNames.length;
  const family = Math.floor(index / firstNames.length) % surnames.length;
  const second = (family + 1 + Math.floor(index / (firstNames.length * surnames.length))) % surnames.length;
  return `${firstNames[first]} ${surnames[family]} ${surnames[second]}`;
}
const generated = (value: string) => /\b(demo|fictici[oa]s?|simulad[oa]s?)\b/i.test(value);
const person = (value: string, index: number) => generated(value) ? samplePersonName(index) : value;

/** Upgrades legacy display names without replacing names the user has already edited. */
export function prepareDemoPresentation(bundle: DemoBundle): DemoBundle {
  const candidates = bundle.candidates.map((row,i)=>({...row,fullName:person(row.fullName,5000+i)}));
  const leaders = bundle.leaders.map((row,i)=>({...row,fullName:person(row.fullName,i)}));
  const name = (id:string,rows:{id:string;fullName:string}[],fallback:string) => rows.find(row=>row.id===id)?.fullName||fallback;
  return {...bundle,candidates,leaders,...(bundle.operations?{operations:{...bundle.operations,registrations:demoRegistrations(bundle)}}:{}),
    voters:bundle.voters.map((row,i)=>({...row,fullName:person(row.fullName,1000+i),leaderName:name(row.leaderId,leaders,row.leaderName),candidateName:name(row.candidateId,candidates,row.candidateName)})),
    vehicles:bundle.vehicles.map((row,i)=>({...row,driverName:person(row.driverName,6000+i)})),
    contributions:bundle.contributions.map((row,i)=>({...row,donorName:person(row.donorName,7000+i)})),
    expenses:bundle.expenses.map((row,i)=>({...row,supplier:row.supplier&&generated(row.supplier)?`Servicios ${surnames[i%surnames.length]}`:row.supplier})),
    coordinations:bundle.coordinations.map((row,i)=>({...row,coordinatorName:person(row.coordinatorName,8000+i),committees:row.committees.map((committee,j)=>({...committee,leadPerson:person(committee.leadPerson,8100+i*10+j),tasks:committee.tasks?.map(task=>({...task,assignedTo:person(task.assignedTo||'',8200+i)}))}))})),
  };
}
