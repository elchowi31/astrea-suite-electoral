import React,{useEffect,useRef,useState} from 'react';
import {captureRewardLocation,type RewardDelivery,type RewardLocation} from '../../src/lib/rewardDelivery';

/** Place inside the participant registration <form>. Call the webhook from your server only. */
export function RewardDeliveryFields({onChange,policyVersion}:{onChange:(value:RewardDelivery|undefined)=>void;policyVersion:string}){
 const [address,setAddress]=useState({countryCode:'CO' as const,department:'',municipality:'',line1:'',neighborhood:'',instructions:''});
 const [acceptedAt,setAcceptedAt]=useState(''),[locationAcceptedAt,setLocationAcceptedAt]=useState('');
 const [location,setLocation]=useState<Omit<RewardLocation,'confirmedForDelivery'>>(),[confirmed,setConfirmed]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const generation=useRef(0),callback=useRef(onChange);callback.current=onChange;
 useEffect(()=>()=>{generation.current++;},[]);
 useEffect(()=>{
  const ready=acceptedAt&&address.line1.trim()&&address.department.trim()&&address.municipality.trim()&&(!location||confirmed);
  callback.current(ready?{address:{countryCode:'CO',department:address.department.trim(),municipality:address.municipality.trim(),line1:address.line1.trim(),...(address.neighborhood.trim()?{neighborhood:address.neighborhood.trim()}:{}),...(address.instructions.trim()?{instructions:address.instructions.trim()}:{})},consent:{accepted:true,purpose:'reward_delivery',policyVersion,acceptedAt:locationAcceptedAt||acceptedAt,scopes:locationAcceptedAt?['address','location']:['address']},...(location&&confirmed?{location:{...location,confirmedForDelivery:true}}:{})}:undefined);
 },[address,acceptedAt,locationAcceptedAt,location,confirmed,policyVersion]);
 const discardLocation=()=>{generation.current++;setLocation(undefined);setConfirmed(false);setBusy(false);setMessage('');};
 const capture=async()=>{
  const request=++generation.current;setBusy(true);setMessage('');setConfirmed(false);setLocation(undefined);
  try{const next=await captureRewardLocation({consented:!!acceptedAt&&!!locationAcceptedAt});if(request===generation.current){setLocation(next);setMessage(`Ubicación obtenida. Precisión aproximada: ${Math.round(next.accuracyMeters)} m. Confirme que corresponde al lugar de entrega.`);}}
  catch(error){if(request===generation.current)setMessage((error as Error).message);}
  finally{if(request===generation.current)setBusy(false);}
 };
 return <fieldset className="reward-delivery" style={{minWidth:0,border:'1px solid #64748b',borderRadius:12,padding:16}}>
  <legend>Dirección para entregar el regalo (opcional)</legend>
  <label style={{display:'flex',gap:8,padding:'12px 0'}}><input type="checkbox" checked={!!acceptedAt} onChange={event=>{discardLocation();setLocationAcceptedAt('');setAcceptedAt(event.target.checked?new Date().toISOString():'');}}/>Autorizo que SorteApp comparta con Astrea Suite mi dirección y datos de contacto para gestionar la entrega de este sorteo gratuito. No autoriza uso electoral ni publicidad. Política: {policyVersion}.</label>
  {acceptedAt&&<>
   <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,15rem),1fr))',gap:12}}>
    {(['department','municipality','line1','neighborhood','instructions'] as const).map(key=><label key={key} style={{display:'grid',gap:4}}>{({department:'Departamento',municipality:'Municipio',line1:'Dirección o descripción de la vivienda',neighborhood:'Barrio o vereda',instructions:'Indicaciones de entrega'})[key]}<input required={['department','municipality','line1'].includes(key)} maxLength={key==='instructions'?500:key==='line1'?250:key==='neighborhood'?150:100} autoComplete={key==='line1'?'street-address':key==='department'?'address-level1':key==='municipality'?'address-level2':'off'} value={address[key]} onChange={event=>{discardLocation();setAddress({...address,[key]:event.target.value});}} style={{minWidth:0,minHeight:44,padding:8,borderRadius:8,border:'1px solid #64748b',color:'inherit',background:'transparent'}}/></label>)}
   </div>
   <label style={{display:'flex',gap:8,padding:'12px 0'}}><input type="checkbox" checked={!!locationAcceptedAt} onChange={event=>{discardLocation();setLocationAcceptedAt(event.target.checked?new Date().toISOString():'');}}/>También autorizo compartir una ubicación puntual para facilitar la entrega. Es opcional.</label>
   <p style={{fontSize:13}}>Si está en el lugar de entrega, pulse el botón y permita la ubicación en el navegador. No se abrirá un mapa.</p>
   <button type="button" disabled={busy||!locationAcceptedAt} onClick={capture} style={{minHeight:44,padding:'10px 16px',borderRadius:8,cursor:'pointer'}}> {busy?'Obteniendo ubicación…':'Usar mi ubicación para la entrega'}</button>
   <p role="status" aria-live="polite">{message}</p>
   {location&&<><label style={{display:'flex',gap:8,padding:'12px 0'}}><input type="checkbox" required checked={confirmed} onChange={event=>setConfirmed(event.target.checked)}/>Confirmo que esta ubicación corresponde a la dirección de entrega. {location.accuracyMeters>100?'La precisión es baja; complete las indicaciones de la vivienda.':''}</label><button type="button" onClick={discardLocation} style={{minHeight:44}}>Quitar ubicación y usar solo la dirección</button></>}
   <p style={{fontSize:12}}>Puede retirar su participación y solicitar eliminar estos datos mediante los canales de la política de privacidad.</p>
  </>}
 </fieldset>;
}
