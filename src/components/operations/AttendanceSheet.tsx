import React,{useContext,useState} from 'react';
import type {OperationalEvent} from '../../lib/operations';
import {uniqueVoters} from '../../lib/operations';
import {registrationId,type RegistrationChannel} from '../../lib/eventRegistration';
import {saveRegistration} from '../../lib/attendanceStore';
import {saveDemoRegistration} from '../../lib/demoWorkspace';
import {DemoEditing} from '../common/EditRecordButton';
import {useOperations} from './OperationsContext';
import {button,secondary,input,Field} from './OperationsUI';

export function AttendanceSheet({event,initialLeaderId='',initialChannel='command',initialNotes='',onClose}:{event:OperationalEvent;initialLeaderId?:string;initialChannel?:RegistrationChannel;initialNotes?:string;onClose:()=>void;key?:React.Key}) {
  const data=useOperations(),demo=useContext(DemoEditing);
  const [leaderId,setLeaderId]=useState(initialLeaderId),[search,setSearch]=useState(''),[page,setPage]=useState(0);
  const [channel,setChannel]=useState<RegistrationChannel>(initialChannel),[value,setValue]=useState(true),[notes,setNotes]=useState(initialNotes);
  const [selected,setSelected]=useState<string[]>([]),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
  const voters=uniqueVoters(data.voters).filter(v=>(!leaderId||v.leaderId===leaderId)&&(v.fullName+' '+v.documentNumber).toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  const visible=voters.slice(page*30,page*30+30);
  const current=(voter:typeof voters[number])=>data.registrations?.find(r=>r.id===registrationId(event,voter));
  return <form aria-label="Planilla de jornada" className="my-4 rounded-2xl border border-cyan-800 bg-cyan-950/20 p-4" onSubmit={async e=>{
    e.preventDefault();setBusy(true);setMessage('');let saved=0;
    try {
      if(!data.user||!selected.length)throw new Error('Seleccione al menos una persona.');
      if(data.readOnly&&!demo)throw new Error('Abra su entorno editable para guardar.');
      if(!value&&!notes.trim())throw new Error('Indique el motivo de la corrección.');
      for(const id of selected){const voter=data.voters.find(v=>v.id===id);if(!voter)throw new Error('Una persona ya no está disponible.');
        if(demo)await saveDemoRegistration(data.tenant.tenantId,event.id,id,channel,value,notes);
        else await saveRegistration(event,voter,channel,value,notes,data.user);
        saved++;
      }
      setSelected([]);setMessage(`${saved} fichas guardadas. El avance se actualiza sin duplicar personas.`);
    }catch(error){setSelected(ids=>ids.slice(saved));setMessage(`${saved?`${saved} fichas guardadas. `:''}${(error as Error).message}`);}finally{setBusy(false);}
  }}>
    <div className="mb-3 flex justify-between gap-3"><h4 className="font-bold text-cyan-200">Planilla · {event.name}</h4><button type="button" className={secondary} disabled={busy} onClick={onClose}>Cerrar planilla</button></div>
    <p className="mb-3 text-xs text-slate-300">Marque personas que efectivamente se embarcaron o se registraron en comando. Una persona en ambos canales cuenta una vez; reservar un cupo o registrar un regreso no aumenta la meta. Para una persona nueva, complete primero su ficha en el listado de votantes.</p>
    <fieldset disabled={busy} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Responsable de la planilla"><select aria-label="Responsable de la planilla" className={input} value={leaderId} onChange={e=>{setLeaderId(e.target.value);setSelected([]);setPage(0);}}><option value="">Todos los disponibles</option>{data.leaders.map(l=><option key={l.id} value={l.id}>{l.fullName}</option>)}</select></Field>
        <Field label="Canal a registrar"><select aria-label="Canal a registrar" className={input} value={channel} onChange={e=>setChannel(e.target.value as RegistrationChannel)}><option value="command">Registro en comando</option><option value="boarded">Embarque en transporte de ida</option></select></Field>
        <Field label="Acción de planilla"><select aria-label="Acción de planilla" className={input} value={String(value)} onChange={e=>setValue(e.target.value==='true')}><option value="true">Registrar este canal</option><option value="false">Retirar marca por corrección</option></select></Field>
        <Field label="Buscar persona o documento"><input className={input} value={search} onChange={e=>{setSearch(e.target.value);setPage(0);}}/></Field>
      </div>
      <Field label="Referencia de planilla, viaje u observación"><input required={!value} maxLength={1500} className={input} value={notes} onChange={e=>setNotes(e.target.value)}/></Field>
      <div className="max-h-72 overflow-auto rounded-xl border border-slate-700">
        {visible.map(voter=>{const row=current(voter);return <label key={voter.id} className="flex cursor-pointer items-center gap-3 border-b border-slate-800 p-3 text-sm"><input type="checkbox" checked={selected.includes(voter.id)} onChange={e=>setSelected(ids=>e.target.checked?[...ids,voter.id]:ids.filter(id=>id!==voter.id))}/><span className="min-w-0 flex-1"><span className="block font-semibold">{voter.fullName}</span><span className="block text-xs text-slate-400">{voter.documentNumber} · {voter.leaderName||voter.candidateName}</span></span><span className="text-right text-xs text-cyan-300">{row?.boarded?'Embarcado':''}{row?.boarded&&row?.command?' · ':''}{row?.command?'En comando':''}{!row?.boarded&&!row?.command?'Sin registrar':''}</span></label>;})}
        {!voters.length&&<p className="p-4 text-sm text-slate-400">No hay personas en este filtro.</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs"><button type="button" className={secondary} onClick={()=>setSelected(ids=>[...new Set([...ids,...visible.map(v=>v.id)])])}>Seleccionar página</button><button type="button" className={secondary} onClick={()=>setSelected([])}>Limpiar selección</button><button type="button" className={secondary} disabled={!page} onClick={()=>setPage(page-1)}>Anterior</button><button type="button" className={secondary} disabled={(page+1)*30>=voters.length} onClick={()=>setPage(page+1)}>Siguiente</button><span>{voters.length} personas · página {page+1} de {Math.max(1,Math.ceil(voters.length/30))}</span></div>
      <button className={button} disabled={!selected.length}>{busy?'Guardando…':`Guardar planilla (${selected.length})`}</button>
    </fieldset>
    {message&&<p role="status" className="mt-3 text-sm text-amber-200">{message}</p>}
  </form>;
}
