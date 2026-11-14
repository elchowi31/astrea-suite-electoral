type Metric={module:string;outcome:'completed'|'error';durationMs:number;at:string};
let scope='',moduleName='dashboard';let rows:Metric[]=[];
export function setOperationMetricsScope(next:string,module:string){if(next!==scope){scope=next;rows=[];}moduleName=module;}
export function recordFormOperation(outcome:Metric['outcome'],durationMs:number){
 if(!scope||!Number.isFinite(durationMs)||durationMs<0)return;
 rows=[...rows,{module:moduleName,outcome,durationMs:Math.round(durationMs),at:new Date().toISOString()}].slice(-1000);
 if(typeof window!=='undefined')window.dispatchEvent(new Event('astrea:operation-metrics'));
}
export function operationMetricsSummary(){
 const groups=new Map<string,Metric[]>();for(const row of rows){const group=groups.get(row.module)||[];group.push(row);groups.set(row.module,group);}
 return {kind:'astrea-session-metrics',scope:'current-session',note:'Duración del guardado del formulario; no mide el tiempo de diligenciamiento, ahorro de trabajo o resultados electorales.',samples:rows.length,modules:[...groups].map(([module,values])=>{const durations=values.filter(v=>v.outcome==='completed').map(v=>v.durationMs).sort((a,b)=>a-b);return {module,completed:durations.length,errors:values.length-durations.length,medianMs:durations.length?durations[Math.floor((durations.length-1)/2)]:null,p95Ms:durations.length?durations[Math.ceil(durations.length*.95)-1]:null};})};
}
