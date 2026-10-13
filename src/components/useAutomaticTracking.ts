import { useEffect, useRef, useState } from 'react';
import type { UserProfile } from '../types';
import { auth } from '../lib/firebase';
import { readSeed, updateSeed, gpsPermission, prepareNativeTracking } from '../lib/deviceSeed';
import { localDataEnabled, queueAutomaticRoute, queueLocation, type QueuedLocation } from '../lib/deviceStorage';
import { automaticRoute, emptyMovement, observeMovement, type MovementState } from '../lib/movementTracking';
import { watchFixes, type Fix, type FixWatcher } from '../lib/nativeTracking';
import type { AssignedRoute } from '../lib/routeTracking';

interface Props {
  user: UserProfile; tenantId: string; deviceId: string; native: boolean; manualActive: boolean;
  flush(): Promise<void>;
  live(route: AssignedRoute, fix: Fix, sample: QueuedLocation, motion?: 'moving'|'stationary', observedAt?: number): void;
  register(extra: {activeRouteId?: string}): void;
}
export function useAutomaticTracking(props: Props) {
  const current=useRef(props);current.current=props;
  const [enabled,setEnabled]=useState(()=>!!readSeed()?.automaticTracking&&!readSeed()?.automaticPaused);
  const [attempt,setAttempt]=useState(0);
  const [ready,setReady]=useState(false);const [moving,setMoving]=useState(false);
  const [route,setRoute]=useState<AssignedRoute>();const [lastFixAt,setLastFixAt]=useState('');const [message,setMessage]=useState('');
  const watcher=useRef<FixWatcher>();const movement=useRef<MovementState>(emptyMovement());
  const active=useRef<AssignedRoute>();const lastRoute=useRef<AssignedRoute>();const busy=useRef(false);const generation=useRef(0);const lastLive=useRef(0);
  const lastPosition=useRef<Fix>();
  const lastSave=useRef(0);
  const save=()=>updateSeed({automaticSession:{userId:props.user.uid,tenantId:props.tenantId,movement:movement.current,route:active.current,lastRoute:lastRoute.current,lastPosition:lastPosition.current}});
  const finish=async(at:number)=>{
    const item=active.current;if(!item)return;
    await queueAutomaticRoute(item,at);
    const closed={...item,status:'Finalizado' as const,finishedAtMillis:at,finishedAt:new Date(at).toISOString()};
    lastRoute.current=closed;active.current=undefined;setRoute(closed);setMoving(false);save();current.current.register({activeRouteId:''});
  };
  const sample=(item:AssignedRoute,fix:Fix):QueuedLocation=>({id:`${props.tenantId}--gps-${crypto.randomUUID()}`,tenantId:props.tenantId,userId:props.user.uid,routeId:item.id,
    latitude:fix.latitude,longitude:fix.longitude,accuracy:fix.accuracy,capturedAt:new Date(fix.timestamp).toISOString(),capturedAtMillis:Math.round(fix.timestamp)});
  const receive=async(fix:Fix)=>{
    if(busy.current||auth.currentUser?.uid!==props.user.uid)return;busy.current=true;
    try{
      const result=observeMovement(movement.current,fix);if(!result.accepted)return;
      setReady(true);
      if(result.stoppedAt)await finish(result.stoppedAt);
      let fixes:Fix[]=[];
      if(result.started){
        const item=automaticRoute(props.tenantId,props.user.uid,props.user.displayName,props.deviceId,`${props.tenantId}--auto-${crypto.randomUUID()}`,result.started[0]);
        await queueAutomaticRoute(item);active.current=item;lastRoute.current=item;setRoute(item);setMoving(true);fixes=result.started;
        current.current.register({activeRouteId:item.id});
      }else if(result.sample&&active.current)fixes=[result.sample];
      movement.current=result.state;
      if(active.current&&fixes.length){
        for(const position of fixes)await queueLocation(sample(active.current,position));
        const latest=fixes.at(-1)!;lastPosition.current=latest;setLastFixAt(new Date(latest.timestamp).toISOString());
        current.current.live(active.current,latest,sample(active.current,latest),'moving',fix.timestamp);lastLive.current=fix.timestamp;
      }else{
        const item=active.current||lastRoute.current;const position=lastPosition.current;
        // Latido de estado, sin añadir puntos estacionarios al historial ni mover el marcador por ruido.
        if(item&&position&&fix.timestamp-lastLive.current>=60_000){current.current.live(item,position,sample(item,position),'stationary',fix.timestamp);lastLive.current=fix.timestamp;}
      }
      const movingNow=result.state.moving&&fix.timestamp-result.state.lastMovementAt<30_000;setMoving(movingNow);
      if(fixes.length||result.stoppedAt||fix.timestamp-lastSave.current>=5_000){save();lastSave.current=fix.timestamp;}
      setMessage(movingNow?'Traslado detectado: guardando solo desplazamientos.':'Seguimiento preparado: esperando movimiento real.');
      if(fixes.length||result.stoppedAt)void current.current.flush();
    }catch(error){setMessage(`No se pudo registrar el traslado: ${(error as Error).message}`);watcher.current?.stop();watcher.current=undefined;setReady(false);}
    finally{busy.current=false;}
  };
  useEffect(()=>{
    if(!props.native||!enabled||props.manualActive||!localDataEnabled()||auth.currentUser?.uid!==props.user.uid||props.user.tenantId!==props.tenantId)return;
    const session=readSeed()?.automaticSession;
    if(session?.userId===props.user.uid&&session.tenantId===props.tenantId){movement.current=session.movement;active.current=session.route;lastRoute.current=session.lastRoute;lastPosition.current=session.lastPosition;setRoute(session.route||session.lastRoute);setMoving(session.movement.moving&&Date.now()-session.movement.lastMovementAt<30_000);}
    else{movement.current=emptyMovement();active.current=undefined;lastRoute.current=undefined;lastPosition.current=undefined;}
    let cancelled=false;const token=++generation.current;
    void (async()=>{
      const permission=await gpsPermission();if(permission!=='granted')throw new Error('Permita la ubicación precisa en los ajustes de Astrea.');
      if(cancelled)return;
      const handle=await watchFixes(fix=>{if(!cancelled&&generation.current===token)void receive(fix);},error=>{
        setReady(false);
        setMessage(error.kind==='denied'?'Active el permiso de ubicación para reanudar el seguimiento automático.':'Active la ubicación del teléfono; esperando señal GPS.');
        if(error.kind==='denied'){watcher.current?.stop();watcher.current=undefined;setReady(false);}
      },{title:'Astrea · seguimiento autorizado',message:'Ubicación y movimiento activos. Solo se registran desplazamientos reales.'});
      if(cancelled){handle.stop();return;}watcher.current=handle;setReady(true);setMessage('Seguimiento preparado: esperando movimiento real.');
    })().catch(error=>{if(!cancelled){setReady(false);setMessage((error as Error).message);}});
    return()=>{cancelled=true;generation.current++;watcher.current?.stop();watcher.current=undefined;setReady(false);};
  },[props.native,enabled,attempt,props.manualActive,props.user.uid,props.tenantId]);
  const pause=async()=>{generation.current++;watcher.current?.stop();watcher.current=undefined;setReady(false);
    // Esperar la escritura local en curso antes de cerrar el traslado.
    while(busy.current)await new Promise(resolve=>setTimeout(resolve,25));
    if(active.current)await finish(movement.current.lastMovementAt);movement.current=emptyMovement();save();
    updateSeed({automaticPaused:true});setEnabled(false);setMoving(false);setMessage('Seguimiento automático pausado.');void props.flush();
  };
  const enable=async()=>{if(!localDataEnabled())throw new Error('Active la conservación de datos en «Mi dispositivo».');
    const result=await prepareNativeTracking();if(result.state!=='granted')throw new Error('Permita la ubicación precisa en los ajustes de Astrea.');
    updateSeed({automaticTracking:true,automaticPaused:false,trackingSetupCompleted:true});setEnabled(true);setAttempt(value=>value+1);
  };
  return {enabled,ready,moving,route,lastFixAt,message,pause,enable};
}
