import React,{createContext,useContext,useEffect,useRef,useState} from 'react';
import {authenticatedFetch} from '../../lib/firebase';
import {runWhatsappTab,type WhatsappEvent} from '../../lib/whatsappTabConnection';
import {useOperations} from './OperationsContext';

type Config={phone:string;leaderId:string;eventId:string;municipality:string};
type Connection={running:boolean;connected:boolean;status:string;code:string;error:string;saved:string[];start:(config:Config)=>Promise<void>;stop:()=>void;reset:()=>void;wake:boolean;config:Config;setConfig:React.Dispatch<React.SetStateAction<Config>>};
const Context=createContext<Connection|null>(null);
const randomHex=(bytes:number)=>Array.from(crypto.getRandomValues(new Uint8Array(bytes)),b=>b.toString(16).padStart(2,'0')).join('');
export function WhatsappConnectionProvider({children}:{children:React.ReactNode}){
 const {user,tenant,readOnly}=useOperations();
 const [config,setConfig]=useState<Config>({phone:'',leaderId:'',eventId:'',municipality:''});
 const [running,setRunning]=useState(false),[connected,setConnected]=useState(false),[status,setStatus]=useState('Sin conexión'),[code,setCode]=useState(''),[error,setError]=useState(''),[saved,setSaved]=useState<string[]>([]),[wake,setWake]=useState(false);
 const controller=useRef<AbortController|null>(null),identity=useRef<{id:string;key:string;scope:string}|null>(null),mounted=useRef(true);
 const stop=()=>{controller.current?.abort();setConnected(false);setCode('');};
 const reset=()=>{stop();identity.current=null;setSaved([]);setError('');setStatus('Nueva vinculación preparada. Retire la anterior desde Dispositivos vinculados de WhatsApp.');};
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;controller.current?.abort();identity.current=null;};},[]);
 useEffect(()=>{stop();identity.current=null;setSaved([]);setStatus('Sin conexión');},[tenant.tenantId,user?.uid,user?.role,readOnly]);
 useEffect(()=>{
  if(!running)return;
  let lock:WakeLockSentinel|null=null,cancelled=false;
  const acquire=async()=>{if(document.visibilityState!=='visible'||!('wakeLock' in navigator)||lock)return;try{const acquired=await navigator.wakeLock.request('screen');if(cancelled){await acquired.release();return;}lock=acquired;setWake(true);acquired.addEventListener('release',()=>{lock=null;if(!cancelled)setWake(false);});}catch{setWake(false);}};
  const visible=()=>{if(document.visibilityState==='visible'){setConnected(false);setStatus('Comprobando conexión al volver a la pestaña…');void acquire();}};
  void acquire();document.addEventListener('visibilitychange',visible);
  return()=>{cancelled=true;document.removeEventListener('visibilitychange',visible);void lock?.release();setWake(false);};
 },[running]);
 async function start(config:Config){
  if(controller.current||readOnly||user?.role!=='AdminGlobal')return;
  const normalized={...config,phone:config.phone.replace(/[+\s()-]/g,''),municipality:config.municipality.trim(),tenantId:tenant.tenantId};
  const scope=JSON.stringify(normalized);
  if(!identity.current||identity.current.scope!==scope)identity.current={id:randomHex(16),key:randomHex(32),scope};
  const session={id:identity.current.id,key:identity.current.key,resumeId:randomHex(16)};
  const active=new AbortController();controller.current=active;setRunning(true);setConnected(false);setError('');setCode('');setStatus('Iniciando WhatsApp…');
  const event=(e:WhatsappEvent)=>{
   if(!mounted.current||active.signal.aborted)return;
   if(e.type==='heartbeat'){setConnected(!!e.connected);if(e.connected)setStatus('WhatsApp conectado · recepción activa');return;}
   if(e.message)setStatus(e.message);
   if(e.type==='pairing'){setCode(e.code||'');setConnected(false);}
   if(e.type==='connected'){setCode('');setConnected(true);setError('');}
   if(['retry','renew','fatal'].includes(e.type)){setConnected(false);setCode('');}
   if(e.type==='fatal'||e.type==='notice')setError(e.message||'Revise la conexión.');
   if(e.type==='saved'&&e.requestId)setSaved(ids=>[...new Set([...ids,e.requestId!])].slice(-100));
  };
  try{await runWhatsappTab({body:{...normalized,session},signal:active.signal,request:init=>authenticatedFetch('/api/whatsapp/pilot',init),onEvent:event});}
  catch{if(mounted.current&&!active.signal.aborted)setError('No se pudo mantener la conexión. Intente reanudar.');}
  finally{if(controller.current===active)controller.current=null;if(mounted.current){setRunning(false);setConnected(false);setCode('');if(active.signal.aborted)setStatus('Recepción detenida. Las solicitudes guardadas permanecen en Firestore.');}}
 }
 return <Context.Provider value={{running,connected,status,code,error,saved,start,stop,reset,wake,config,setConfig}}>{children}</Context.Provider>;
}
export function useWhatsappConnection(){const value=useContext(Context);if(!value)throw new Error('Falta el contexto de WhatsApp.');return value;}
export function WhatsappConnectionStatus(){
 const wa=useWhatsappConnection();if(!wa.running)return null;
 return <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-800/60 bg-slate-950/90 px-3 py-2 text-xs text-slate-200" role="status"><span className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${wa.connected?'bg-emerald-400':'bg-amber-400'}`}/>WhatsApp · {wa.connected?'recepción activa':wa.status}</span><button type="button" className="min-h-9 rounded-lg border border-slate-600 px-3" onClick={wa.stop}>Detener recepción</button></div>;
}
