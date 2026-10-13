import React, { createContext, useContext, useState } from 'react';
import { createPortal } from 'react-dom';
import { Pencil, X } from 'lucide-react';
import { auth } from '../../lib/firebase';
import { EDIT_FIELDS, editableValue, editPatch, updateOperationalRecord } from '../../lib/recordEditing';

type References=Record<string,{id:string;name:string}[]>;
export const EditingReferences=createContext<References>({});
export function EditRecordButton({ collection,record,label='Editar',savePatch }: { collection:string;record:any;label?:string;savePatch?:(patch:Record<string,unknown>,original:Record<string,unknown>)=>Promise<void> }) {
  const references=useContext(EditingReferences);const [editing,setEditing]=useState(false);const [original,setOriginal]=useState<Record<string,unknown>>({});const [values,setValues]=useState<Record<string,string|boolean>>({});const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');
  const fields=(EDIT_FIELDS[collection]||[]).filter(field=>collection!=='usuarios'||record.uid!==auth.currentUser?.uid||['displayName','prefix','phone','avatarUrl'].includes(field.key));
  if(String(record.id||record.uid||'').startsWith('demo-')||!fields.length)return null;
  const open=()=>{setOriginal({...record});setValues(Object.fromEntries(fields.map(field=>[field.key,editableValue(field,record[field.key])])));setMessage('');setEditing(true);};
  return <><button type="button" aria-label={`${label} ${record.fullName || record.name || record.title || record.licensePlate || record.donorName || record.description || record.displayName || 'registro'}`} onClick={event=>{event.stopPropagation();open();}} className="inline-flex items-center gap-1 rounded-lg border border-cyan-700/60 bg-cyan-950/40 px-2 py-1.5 text-xs font-semibold text-cyan-200 hover:bg-cyan-900"><Pencil size={13}/>{label}</button>
  {editing && createPortal(<div className="fixed inset-0 z-[5000] flex items-center justify-center bg-slate-950/90 p-3" onClick={event=>event.stopPropagation()}>
    <section role="dialog" aria-modal="true" aria-labelledby="record-editor-title" className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl border border-slate-600 bg-slate-900 text-slate-200 shadow-2xl">
      <header className="flex items-center justify-between border-b border-slate-700 p-4"><h2 id="record-editor-title" className="font-bold text-white">Editar registro</h2><button aria-label="Cerrar edición" disabled={busy} onClick={()=>setEditing(false)}><X/></button></header>
      <form className="min-h-0 overflow-auto p-4" onSubmit={async event=>{event.preventDefault();setBusy(true);setMessage('');try{const patch=editPatch(fields,original,values);
        for(const [key,reference,nameKey] of [['leaderId','lideres','leaderName'],['candidateId','candidatos','candidateName']])if(key in patch){patch[nameKey]=references[reference]?.find(item=>item.id===patch[key])?.name||'';}
        if(savePatch)await savePatch(patch,original);else await updateOperationalRecord(collection,record.id||record.uid||record.tenantId,record.tenantId,patch,original);setEditing(false);
      }catch(error){setMessage((error as Error).message);}finally{setBusy(false);}}}>
        <div className="grid gap-4 sm:grid-cols-2">{fields.map(field=>{const choices=field.reference ? references[field.reference]?.map(item=>({value:item.id,label:item.name}))||[] : field.choices?.map(value=>({value,label:value}));const value=values[field.key]??'';
          const classes='mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 p-2.5 text-sm text-white';return <label key={field.key} className={`block text-xs text-slate-300 ${['textarea','list'].includes(field.type||'')?'sm:col-span-2':''}`}>{field.label}
            {field.type==='boolean'?<input aria-label={field.label} type="checkbox" className="ml-3" checked={value===true} onChange={event=>setValues({...values,[field.key]:event.target.checked})}/> : choices ? <select aria-label={field.label} className={classes} value={String(value)} onChange={event=>setValues({...values,[field.key]:event.target.value})}><option value="">Sin asignar</option>{!choices.some(choice=>choice.value===value)&&value&&<option value={String(value)}>Asignación actual</option>}{choices.filter(choice=>!(field.key==='parentCandidateId'&&choice.value===record.id)).map(choice=><option key={choice.value} value={choice.value}>{choice.label}</option>)}</select> : ['textarea','list'].includes(field.type||'') ? <textarea aria-label={field.label} className={classes} value={String(value)} rows={4} onChange={event=>setValues({...values,[field.key]:event.target.value})}/> : <input aria-label={field.label} className={classes} type={field.type||'text'} step={field.type==='number'?'any':undefined} min={field.min} max={field.max} required={field.required} value={String(value)} onChange={event=>setValues({...values,[field.key]:event.target.value})}/>}</label>;})}</div>
        {message&&<p role="alert" className="mt-4 text-sm text-amber-300">{message}</p>}<div className="mt-5 flex gap-3"><button type="submit" disabled={busy} className="rounded-xl bg-cyan-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-40">{busy?'Guardando en Firestore…':'Guardar cambios'}</button><button type="button" disabled={busy} className="rounded-xl bg-slate-700 px-4 py-3 text-sm" onClick={()=>setEditing(false)}>Cancelar</button></div>
      </form>
    </section>
  </div>,document.body)}</>;
}
