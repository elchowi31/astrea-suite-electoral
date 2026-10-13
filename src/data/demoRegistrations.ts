import type {DemoBundle} from './demoSeed';
import {mergeRegistration} from '../lib/eventRegistration';

/** Only used inside an explicitly synthetic bundle; existing planilla edits are preserved. */
export function demoRegistrations(bundle:DemoBundle) {
  if(bundle.operations?.registrations)return bundle.operations.registrations;
  const event=bundle.operations?.events.find(e=>e.status==='En curso');if(!event)return [];
  const leaders=bundle.leaders.filter(l=>l.municipality===event.municipality);
  return leaders.flatMap((leader,index)=>{
    const voters=bundle.voters.filter(v=>v.leaderId===leader.id);
    return voters.slice(0,Math.max(1,Math.round(voters.length*(index===0?.25:index===1?1:.7)))).map((voter,i)=>{
      const row=mergeRegistration(event,voter,undefined,voter.requiresTransport?'boarded':'command',true,'Planilla de ejemplo',bundle.ownerUid!,true);
      return {...row,command:row.command||i%3===0};
    });
  });
}
