import {useEffect,useState} from 'react';
import {collection,onSnapshot,query,where} from 'firebase/firestore';
import {db} from '../lib/firebase';
import type {UserProfile} from '../types';
import type {LivePosition} from '../lib/livePosition';
import {isTrackingAdministrator} from '../lib/trackingPermissions';

export function useTeamPositions(user:UserProfile|null,tenantId:string,enabled=true){
  const permitted=enabled&&isTrackingAdministrator(user)&&(user?.role==='AdminGlobal'||user?.tenantId===tenantId);
  const [state,setState]=useState({tenantId:'',positions:[] as LivePosition[],loading:true,error:''});
  const [attempt,setAttempt]=useState(0),[now,setNow]=useState(Date.now());
  useEffect(()=>{setState({tenantId,positions:[],loading:permitted,error:''});if(!permitted)return;
    const unsubscribe=onSnapshot(query(collection(db,'posiciones_actuales'),where('tenantId','==',tenantId)),snapshot=>setState({tenantId,positions:snapshot.docs.map(row=>({...row.data(),id:row.id} as LivePosition)),loading:false,error:''}),()=>setState({tenantId,positions:[],loading:false,error:'No se pudieron cargar las posiciones del equipo. Vuelva a intentar.'}));
    const timer=setInterval(()=>setNow(Date.now()),15000);return()=>{unsubscribe();clearInterval(timer);};
  },[tenantId,permitted,attempt]);
  return {...state,positions:permitted&&state.tenantId===tenantId?state.positions:[],loading:permitted&&(state.tenantId!==tenantId||state.loading),now,retry:()=>setAttempt(value=>value+1)};
}
