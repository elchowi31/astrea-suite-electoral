import React,{createContext,useContext,useEffect,useRef,useState} from 'react';
import {authenticatedFetch,db} from '../../lib/firebase';
import {defaultWhatsappConfig,loadWhatsappConfig,saveWhatsappConfig,type WhatsappConfig as Config} from '../../lib/whatsappSetup';
import {localDataEnabled} from '../../lib/deviceStorage';
import {recalledWhatsappIdentity,rememberWhatsappIdentity,forgetWhatsappIdentity,type WhatsappIdentity} from '../../lib/whatsappDeviceSession';
import {runWhatsappTab,type WhatsappEvent} from '../../lib/whatsappTabConnection';
import {useOperations} from './OperationsContext';
export type PairingMode='qr'|'code';
type Connection={running:boolean;busy:boolean;connected:boolean;status:string;code:string;qr:string;error:string;saved:string[];save:(config:Config)=>Promise<Config|undefined>;start:(config:Config,mode?:PairingMode)=>Promise<void>;stop:()=>void;reset:()=>Promise<void>;wake:boolean;remember:boolean;remembered:boolean;setRemember:(value:boolean)=>void;config:Config;setConfig:React.Dispatch<React.SetStateAction<Config>>};
const Context=createContext<Connection|null>(null);
const randomHex=(bytes:number)=>Array.from(crypto.getRandomValues(new Uint8Array(bytes)),b=>b.toString(16).padStart(2,'0')).join('');
const normalized=(config:Config,tenantId:string)=>({phone:config.phone,leaderId:config.leaderId,eventId:config.eventId,municipality:config.municipality,tenantId});
export function WhatsappConnectionProvider({children}:{children:React.ReactNode}){
 const {user,tenant,readOnly}=useOperations();
 const [config,setConfig]=useState<Config>(()=>defaultWhatsappConfig(user)),[busy,setBusy]=useState(true);
 const [running,setRunning]=useState(false),[connected,setConnected]=useState(false),[status,setStatus]=useState('Sin conexión'),[code,setCode]=useState(''),[qr,setQr]=useState(''),[error,setError]=useState(''),[saved,setSaved]=useState<string[]>([]),[wake,setWake]=useState(false);
 const [remember,setRememberState]=useState(localDataEnabled),[remembered,setRemembered]=useState(false);
 const rememberRef=useRef(remember),preparing=useRef(false),generation=useRef(0),mounted=useRef(true),controller=useRef<AbortController|null>(null),identity=useRef<WhatsappIdentity|null>(null);
 const clearPairing=()=>{setCode('');setQr('');};
 const cancel=()=>{controller.current?.abort();controller.current=null;setRunning(false);setConnected(false);clearPairing();};
 async function preserve(autoResume:boolean){
  if(!user||!identity.current?.paired)return;const currentGeneration=generation.current;
  if(!rememberRef.current){setRemembered(false);return;}
  const saved=await rememberWhatsappIdentity(user.uid,tenant.tenantId,identity.current,autoResume);if(mounted.current&&generation.current===currentGeneration)setRemembered(saved);
 }
 const stop=()=>{const currentGeneration=generation.current;cancel();if(!identity.current?.paired)identity.current=null;setStatus('Recepción pausada. Guardando preferencia…');void preserve(false).then(()=>{if(mounted.current&&generation.current===currentGeneration)setStatus('Recepción pausada. Puede reanudar este vínculo.');}).catch(()=>{if(mounted.current&&generation.current===currentGeneration)setError('La recepción está pausada, pero no se pudo recordar la pausa. Revise este panel antes de cerrar.');});};
 const reset=async()=>{cancel();identity.current=null;setRemembered(false);setSaved([]);setError('');setStatus('Elija QR o código para crear un vínculo nuevo.');if(user&&localDataEnabled())await forgetWhatsappIdentity(user.uid,tenant.tenantId);};
 const setRemember=(value:boolean)=>{const currentGeneration=generation.current;rememberRef.current=value&&localDataEnabled();setRememberState(rememberRef.current);const action=!rememberRef.current&&user?forgetWhatsappIdentity(user.uid,tenant.tenantId).then(()=>{if(mounted.current&&generation.current===currentGeneration)setRemembered(false);}):preserve(running);void action.catch(()=>{if(mounted.current&&generation.current===currentGeneration)setError('No se pudo actualizar el vínculo conservado en este dispositivo.');});};
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;controller.current?.abort();identity.current=null;};},[]);
 useEffect(()=>{
  const current=++generation.current;let cancelled=false;
  cancel();identity.current=null;preparing.current=false;setSaved([]);setError('');setRemembered(false);setStatus('Sin conexión');setConfig(defaultWhatsappConfig(user));rememberRef.current=localDataEnabled();setRememberState(rememberRef.current);
  if(readOnly||user?.role!=='AdminGlobal'){setBusy(false);return;}
  setBusy(true);
  void (async()=>{
   try{
    const loaded=await loadWhatsappConfig(db,user,tenant.tenantId);
    if(cancelled||generation.current!==current)return;setConfig(loaded);
    const recalled=await recalledWhatsappIdentity(user.uid,tenant.tenantId);if(cancelled||generation.current!==current)return;
    if(recalled&&recalled.identity.scope===JSON.stringify(normalized(loaded,tenant.tenantId))){
     identity.current=recalled.identity;setRemembered(true);setStatus('Vínculo recuperado de este dispositivo.');
     if(recalled.autoResume&&loaded.eventId&&loaded.leaderId)void connect(loaded,'qr');
    }
   }catch{if(!cancelled&&generation.current===current)setError('No se pudo recuperar la configuración o el vínculo guardado. Puede revisar los datos y vincular de nuevo.');}
   finally{if(!cancelled&&generation.current===current)setBusy(false);}
  })();
  return()=>{cancelled=true;};
 },[tenant.tenantId,user?.uid,user?.role,readOnly]);
 useEffect(()=>{
  if(!running)return;let lock:WakeLockSentinel|null=null,cancelled=false;
  const acquire=async()=>{if(document.visibilityState!=='visible'||!('wakeLock' in navigator)||lock)return;try{const acquired=await navigator.wakeLock.request('screen');if(cancelled){await acquired.release();return;}lock=acquired;setWake(true);acquired.addEventListener('release',()=>{lock=null;if(!cancelled)setWake(false);});}catch{setWake(false);}};
  const visible=()=>{if(document.visibilityState==='visible')void acquire();};void acquire();document.addEventListener('visibilitychange',visible);
  return()=>{cancelled=true;document.removeEventListener('visibilitychange',visible);void lock?.release();setWake(false);};
 },[running]);
 async function save(input:Config){
  if(controller.current||preparing.current||busy||readOnly||user?.role!=='AdminGlobal')return;
  const current=generation.current;preparing.current=true;setBusy(true);setError('');
  try{const verified=await saveWhatsappConfig(db,user,tenant.tenantId,input);if(!mounted.current||current!==generation.current)return;setConfig(verified);setStatus('Configuración guardada.');return verified;}
  catch(e){if(mounted.current&&current===generation.current){setError(e instanceof Error?e.message:'No se pudo guardar la configuración.');setStatus('Configuración sin confirmar.');}}
  finally{if(mounted.current&&current===generation.current){preparing.current=false;setBusy(false);}}
 }
 async function start(input:Config,mode:PairingMode='qr'){const verified=await save(input);if(verified)await connect(verified,mode);}
 async function connect(input:Config,mode:PairingMode){
  if(controller.current||readOnly||user?.role!=='AdminGlobal')return;
  const currentGeneration=generation.current,body=normalized(input,tenant.tenantId),scope=JSON.stringify(body);
  if(!identity.current||identity.current.scope!==scope){identity.current={id:randomHex(16),key:randomHex(32),scope,paired:false};setRemembered(false);}
  const session={id:identity.current.id,key:identity.current.key,resumeId:randomHex(16)},active=new AbortController();controller.current=active;setRunning(true);setConnected(false);setError('');clearPairing();setStatus(identity.current.paired?'Recuperando el vínculo de WhatsApp…':'Preparando '+(mode==='qr'?'QR…':'código…'));
  const event=(e:WhatsappEvent)=>{
   if(!mounted.current||active.signal.aborted||generation.current!==currentGeneration)return;
   if(e.type==='heartbeat'){setConnected(!!e.connected);if(e.connected)setStatus('WhatsApp conectado · recepción activa');return;}
   if(e.resetSession&&identity.current?.id===session.id){identity.current=null;setRemembered(false);void forgetWhatsappIdentity(user.uid,tenant.tenantId).catch(()=>{});}
   if((e.type==='paired'||e.type==='connected')&&identity.current?.id===session.id)identity.current.paired=true;
   if(e.message)setStatus(e.message);
   if(e.type==='qr'){setQr(e.qr||'');setCode('');setConnected(false);}
   if(e.type==='pairing'){setCode(e.code||'');setQr('');setConnected(false);}
   if(e.type==='paired')clearPairing();
   if(e.type==='connected'){clearPairing();setConnected(true);setError('');void preserve(true).catch(()=>{if(mounted.current)setError('La recepción está activa, pero no se pudo recordar este vínculo. Mantenga Astrea abierta o vuelva a vincular al regresar.');});}
   if(['retry','renew','fatal'].includes(e.type)){setConnected(false);clearPairing();}
   if(e.type==='fatal'||e.type==='notice')setError(e.message||'Revise la conexión.');
   if(e.type==='saved'&&e.requestId)setSaved(ids=>[...new Set([...ids,e.requestId!])].slice(-100));
  };
  try{await runWhatsappTab({body:{...body,session,pairingMode:mode},signal:active.signal,request:init=>authenticatedFetch('/api/whatsapp/pilot',init),onEvent:event,maxFailures:Infinity});}
  catch{if(mounted.current&&!active.signal.aborted)setError('No se pudo mantener la conexión. Puede reanudar desde este panel.');}
  finally{if(controller.current===active){controller.current=null;if(mounted.current&&generation.current===currentGeneration){setRunning(false);setConnected(false);clearPairing();}}}
 }
 return <Context.Provider value={{running,busy,connected,status,code,qr,error,saved,save,start,stop,reset,wake,remember,remembered,setRemember,config,setConfig}}>{children}</Context.Provider>;
}
export function useWhatsappConnection(){const value=useContext(Context);if(!value)throw new Error('Falta el contexto de WhatsApp.');return value;}
