import React,{createContext,useContext,useEffect,useRef,useState} from 'react';
import {authenticatedFetch,db} from '../../lib/firebase';
import {defaultWhatsappConfig,loadWhatsappConfig,saveWhatsappConfig,type WhatsappConfig as Config} from '../../lib/whatsappSetup';
import {runWhatsappTab,type WhatsappEvent} from '../../lib/whatsappTabConnection';
import {useOperations} from './OperationsContext';

type Connection={running:boolean;busy:boolean;connected:boolean;status:string;code:string;error:string;saved:string[];save:(config:Config)=>Promise<Config|undefined>;start:(config:Config)=>Promise<void>;stop:()=>void;reset:()=>void;wake:boolean;config:Config;setConfig:React.Dispatch<React.SetStateAction<Config>>};
const Context=createContext<Connection|null>(null);
const randomHex=(bytes:number)=>Array.from(crypto.getRandomValues(new Uint8Array(bytes)),b=>b.toString(16).padStart(2,'0')).join('');
export function WhatsappConnectionProvider({children}:{children:React.ReactNode}){
 const {user,tenant,readOnly}=useOperations();
 const [config,setConfig]=useState<Config>(()=>defaultWhatsappConfig(user));
 const [busy,setBusy]=useState(true);const preparing=useRef(false),generation=useRef(0);
 const [running,setRunning]=useState(false),[connected,setConnected]=useState(false),[status,setStatus]=useState('Sin conexión'),[code,setCode]=useState(''),[error,setError]=useState(''),[saved,setSaved]=useState<string[]>([]),[wake,setWake]=useState(false);
 const controller=useRef<AbortController|null>(null),identity=useRef<{id:string;key:string;scope:string;paired:boolean}|null>(null),mounted=useRef(true);
 const stop=()=>{controller.current?.abort();if(!identity.current?.paired)identity.current=null;setConnected(false);setCode('');};
 const reset=()=>{stop();identity.current=null;setSaved([]);setError('');setStatus('Nueva vinculación preparada.');};
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;controller.current?.abort();identity.current=null;};},[]);
 useEffect(()=>{
  const current=++generation.current;let cancelled=false;
  stop();identity.current=null;preparing.current=false;setSaved([]);setError('');setStatus('Sin conexión');setConfig(defaultWhatsappConfig(user));
  if(readOnly||user?.role!=='AdminGlobal'){setBusy(false);return;}
  setBusy(true);
  void loadWhatsappConfig(db,user,tenant.tenantId).then(value=>{if(!cancelled&&generation.current===current)setConfig(value);})
   .catch(()=>{if(!cancelled&&generation.current===current)setError('No se pudo cargar la configuración guardada. Revise la conexión antes de guardar.');})
   .finally(()=>{if(!cancelled&&generation.current===current)setBusy(false);});
  return()=>{cancelled=true;};
 },[tenant.tenantId,user?.uid,user?.role,readOnly]);
 useEffect(()=>{
  if(!running)return;
  let lock:WakeLockSentinel|null=null,cancelled=false;
  const acquire=async()=>{if(document.visibilityState!=='visible'||!('wakeLock' in navigator)||lock)return;try{const acquired=await navigator.wakeLock.request('screen');if(cancelled){await acquired.release();return;}lock=acquired;setWake(true);acquired.addEventListener('release',()=>{lock=null;if(!cancelled)setWake(false);});}catch{setWake(false);}};
  const visible=()=>{if(document.visibilityState==='visible'){setConnected(false);setStatus('Comprobando conexión al volver a la pestaña…');void acquire();}};
  void acquire();document.addEventListener('visibilitychange',visible);
  return()=>{cancelled=true;document.removeEventListener('visibilitychange',visible);void lock?.release();setWake(false);};
 },[running]);
 async function save(input:Config){
  if(controller.current||preparing.current||busy||readOnly||user?.role!=='AdminGlobal')return;
  const current=generation.current;preparing.current=true;setBusy(true);setError('');setStatus('Guardando configuración en Firestore…');
  try{
   const verified=await saveWhatsappConfig(db,user,tenant.tenantId,input);
   if(!mounted.current||current!==generation.current)return;
   setConfig(verified);setStatus('Configuración guardada y verificada en Firestore.');return verified;
  }catch(e){if(mounted.current&&current===generation.current){setError(e instanceof Error?e.message:'No se pudo guardar la configuración.');setStatus('Configuración sin confirmar.');}}
  finally{if(mounted.current&&current===generation.current){preparing.current=false;setBusy(false);}}
 }
 async function start(input:Config){
  const config=await save(input);if(!config)return;
  const normalized={phone:config.phone,leaderId:config.leaderId,eventId:config.eventId,municipality:config.municipality,tenantId:tenant.tenantId};
  const scope=JSON.stringify(normalized);
  if(!identity.current||identity.current.scope!==scope)identity.current={id:randomHex(16),key:randomHex(32),scope,paired:false};
  const session={id:identity.current.id,key:identity.current.key,resumeId:randomHex(16)};
  const active=new AbortController();controller.current=active;setRunning(true);setConnected(false);setError('');setCode('');setStatus('Iniciando WhatsApp…');
  const event=(e:WhatsappEvent)=>{
   if(!mounted.current||active.signal.aborted)return;
   if(e.type==='heartbeat'){setConnected(!!e.connected);if(e.connected)setStatus('WhatsApp conectado · recepción activa');return;}
   if(e.resetSession&&identity.current?.id===session.id)identity.current=null;
   if((e.type==='paired'||e.type==='connected')&&identity.current?.id===session.id)identity.current.paired=true;
   if(e.message)setStatus(e.message);
   if(e.type==='pairing'){setCode(e.code||'');setConnected(false);}
   if(e.type==='paired'){setCode('');setConnected(false);}
   if(e.type==='connected'){setCode('');setConnected(true);setError('');}
   if(['retry','renew','fatal'].includes(e.type)){setConnected(false);setCode('');}
   if(e.type==='fatal'||e.type==='notice')setError(e.message||'Revise la conexión.');
   if(e.type==='saved'&&e.requestId)setSaved(ids=>[...new Set([...ids,e.requestId!])].slice(-100));
  };
  try{await runWhatsappTab({body:{...normalized,session},signal:active.signal,request:init=>authenticatedFetch('/api/whatsapp/pilot',init),onEvent:event});}
  catch{if(mounted.current&&!active.signal.aborted)setError('No se pudo mantener la conexión. Intente reanudar.');}
  finally{if(controller.current===active)controller.current=null;if(mounted.current){setRunning(false);setConnected(false);setCode('');if(active.signal.aborted)setStatus('Recepción detenida. Las solicitudes guardadas permanecen en Firestore.');}}
 }
 return <Context.Provider value={{running,busy,connected,status,code,error,saved,save,start,stop,reset,wake,config,setConfig}}>{children}</Context.Provider>;
}
export function useWhatsappConnection(){const value=useContext(Context);if(!value)throw new Error('Falta el contexto de WhatsApp.');return value;}
export function WhatsappConnectionStatus(){
 const wa=useWhatsappConnection();if(!wa.running)return null;
 return <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-800/60 bg-slate-950/90 px-3 py-2 text-xs text-slate-200" role="status"><span className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${wa.connected?'bg-emerald-400':'bg-amber-400'}`}/>WhatsApp · {wa.connected?'recepción activa':wa.status}</span><button type="button" className="min-h-9 rounded-lg border border-slate-600 px-3" onClick={wa.stop}>Detener recepción</button></div>;
}
