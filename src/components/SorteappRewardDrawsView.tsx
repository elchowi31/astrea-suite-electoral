import React,{useEffect,useMemo,useState} from 'react';
import {collection,limit,onSnapshot,orderBy,query,where} from 'firebase/firestore';
import {Gift,RefreshCw,ShieldCheck} from 'lucide-react';
import {db} from '../lib/firebase';
import type {UserProfile} from '../types';

type Draw={id:string;tenantId:string;source?:string;kind?:string;paid?:boolean;name:string;prize:string;currency?:string;entryPrice?:number;updatedAt?:string};
type Entry={id:string;tenantId:string;drawId:string;source?:string;kind?:string;paid?:boolean;status?:'withdrawn';participant?:{name:string;email?:string;phone?:string};consent?:{accepted:boolean;purpose:string;policyVersion:string;acceptedAt:string};registeredAt?:string};
const date=(value?:string)=>{const time=value?new Date(value).getTime():NaN;return Number.isFinite(time)?new Date(time).toLocaleString('es-CO',{dateStyle:'medium',timeStyle:'short'}):'—';};
export function SorteappRewardDrawsView({user,tenantId}:{user:UserProfile;tenantId:string}){
 const [draws,setDraws]=useState<Draw[]>([]),[selectedId,setSelectedId]=useState(''),[entries,setEntries]=useState<Entry[]>([]),[busy,setBusy]=useState(true),[entriesBusy,setEntriesBusy]=useState(false),[error,setError]=useState(''),[entriesError,setEntriesError]=useState('');
 useEffect(()=>{
  setDraws([]);setSelectedId('');setEntries([]);setBusy(true);setError('');
  if(user.role!=='AdminGlobal'||!tenantId){setBusy(false);setError('Este módulo está disponible para el administrador global.');return;}
  const stop=onSnapshot(query(collection(db,'sorteos_bienestar'),where('tenantId','==',tenantId),limit(100)),snapshot=>{
   const next=snapshot.docs.map(item=>({...(item.data() as Omit<Draw,'id'>),id:item.id} as Draw)).filter(item=>item.source==='sorteapp'&&item.kind==='employee_wellbeing_free'&&item.paid===false).sort((a,b)=>(b.updatedAt||'').localeCompare(a.updatedAt||''));
   setDraws(next);setSelectedId(current=>next.some(item=>item.id===current)?current:next[0]?.id||'');setBusy(false);setError('');
  },()=>{setBusy(false);setError('No se pudieron leer los sorteos de esta organización. Verifique el acceso de administrador.');});
  return()=>stop();
 },[tenantId,user.role]);
 const selected=useMemo(()=>draws.find(item=>item.id===selectedId),[draws,selectedId]);
 useEffect(()=>{
  setEntries([]);setEntriesError('');
  if(!selected||user.role!=='AdminGlobal'){setEntriesBusy(false);return;}
  setEntriesBusy(true);
  const stop=onSnapshot(query(collection(db,'sorteos_bienestar',selected.id,'participantes'),orderBy('registeredAt','desc'),limit(200)),snapshot=>{
   setEntries(snapshot.docs.map(item=>({...(item.data() as Omit<Entry,'id'>),id:item.id} as Entry)).filter(item=>item.status!=='withdrawn'));setEntriesBusy(false);setEntriesError('');
  },()=>{setEntriesBusy(false);setEntriesError('No se pudieron leer las inscripciones de este sorteo.');});
  return()=>stop();
 },[selected?.id,user.role]);
 if(user.role!=='AdminGlobal')return <p className="rounded-xl border border-amber-800 bg-slate-900 p-4 text-sm text-amber-200">Este módulo está reservado al administrador global.</p>;
 return <section className="space-y-5 pb-12 text-slate-100">
  <header className="rounded-2xl border border-violet-800/60 bg-gradient-to-br from-slate-900 via-slate-900 to-violet-950/40 p-5 sm:p-6">
   <div className="flex items-start gap-3"><span className="rounded-xl border border-violet-700/50 bg-violet-950/40 p-3 text-violet-200"><Gift aria-hidden="true"/></span><div><p className="text-xs font-bold uppercase tracking-widest text-violet-300">Bienestar del equipo · Sorteapp</p><h1 className="mt-1 text-2xl font-bold sm:text-3xl">Sorteos gratuitos</h1><p className="mt-2 max-w-3xl text-sm text-slate-300">Inscripciones recibidas desde Sorteapp con consentimiento registrado. Este espacio está separado de las rifas pagadas y de los datos electorales.</p></div></div>
  </header>
  <aside className="flex gap-3 rounded-xl border border-slate-700 bg-slate-900/70 p-4 text-sm text-slate-300"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300"/><p>Astrea solo recibe participantes de sorteos internos gratuitos. El aviso debe acreditar que la persona aceptó el uso de sus datos para inscribirse y gestionar ese sorteo.</p></aside>
  {error&&<p role="alert" className="rounded-xl border border-amber-800 bg-slate-900 p-4 text-sm text-amber-200">{error}</p>}
  <div className="grid gap-4 lg:grid-cols-[minmax(16rem,0.8fr)_minmax(0,1.8fr)]">
   <section className="rounded-2xl border border-slate-700 bg-slate-900 p-4 sm:p-5"><label className="block text-sm font-semibold">Sorteo<select aria-label="Seleccionar sorteo gratuito" className="mt-2 min-h-11 w-full rounded-xl border border-slate-600 bg-slate-950 px-3 text-sm text-white" disabled={busy||!draws.length} value={selectedId} onChange={event=>setSelectedId(event.target.value)}><option value="">{busy?'Cargando sorteos…':'Seleccione un sorteo'}</option>{draws.map(item=><option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
    {busy&&<p className="mt-4 flex items-center gap-2 text-xs text-slate-400"><RefreshCw className="h-3.5 w-3.5 animate-spin"/>Actualizando…</p>}
    {!busy&&!draws.length&&!error&&<p className="mt-4 text-sm text-slate-400">Aún no hay sorteos gratuitos recibidos de Sorteapp para esta organización.</p>}
    {selected&&<dl className="mt-5 space-y-3 border-t border-slate-800 pt-4 text-sm"><div><dt className="text-xs text-slate-500">Premio</dt><dd className="mt-1 font-medium">{selected.prize}</dd></div><div><dt className="text-xs text-slate-500">Participaciones recibidas en esta vista</dt><dd className="mt-1 font-semibold text-violet-200">{entriesBusy?'…':entries.length}</dd></div><div><dt className="text-xs text-slate-500">Última actualización</dt><dd className="mt-1 text-slate-300">{date(selected.updatedAt)}</dd></div></dl>}
   </section>
   <section className="min-w-0 rounded-2xl border border-slate-700 bg-slate-900 p-4 sm:p-5"><div className="mb-4 flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-lg font-semibold">Personas inscritas</h2><p className="text-xs text-slate-400">Se muestran hasta 200 inscripciones recientes.</p></div>{selected&&<span className="rounded-full border border-emerald-800 bg-emerald-950/50 px-3 py-1 text-xs text-emerald-200">Gratis · Sorteapp</span>}</div>
    {entriesError&&<p role="alert" className="mb-3 text-sm text-amber-300">{entriesError}</p>}
    {!selected&&!busy&&<p className="rounded-xl border border-dashed border-slate-700 p-6 text-center text-sm text-slate-400">Las inscripciones aparecerán aquí cuando se habilite la conexión con Sorteapp.</p>}
    {selected&&entriesBusy&&<p className="flex items-center gap-2 py-8 text-sm text-slate-400"><RefreshCw className="h-4 w-4 animate-spin"/>Cargando inscripciones…</p>}
    {selected&&!entriesBusy&&!entries.length&&!entriesError&&<p className="rounded-xl border border-dashed border-slate-700 p-6 text-center text-sm text-slate-400">Este sorteo todavía no tiene inscripciones.</p>}
    {selected&&!entriesBusy&&entries.length>0&&<div className="overflow-x-auto"><table className="w-full min-w-[42rem] text-left text-sm"><thead><tr className="border-b border-slate-700 text-xs text-slate-400"><th className="px-3 py-3">Participante</th><th className="px-3 py-3">Contacto</th><th className="px-3 py-3">Inscripción</th><th className="px-3 py-3">Consentimiento</th></tr></thead><tbody>{entries.map(entry=><tr className="border-b border-slate-800 align-top" key={entry.id}><td className="px-3 py-3 font-medium">{entry.participant?.name||'Sin nombre'}</td><td className="px-3 py-3 text-xs text-slate-300">{entry.participant?.email&&<p>{entry.participant.email}</p>}{entry.participant?.phone&&<p>+{entry.participant.phone}</p>}</td><td className="px-3 py-3 text-xs text-slate-300">{date(entry.registeredAt)}</td><td className="px-3 py-3 text-xs"><span className={entry.consent?.accepted?'text-emerald-300':'text-rose-300'}>{entry.consent?.accepted?'Aceptado':'No consta'}</span><p className="mt-1 text-slate-400">{entry.consent?.policyVersion||'—'} · {date(entry.consent?.acceptedAt)}</p></td></tr>)}</tbody></table></div>}
   </section>
  </div>
 </section>;
}
