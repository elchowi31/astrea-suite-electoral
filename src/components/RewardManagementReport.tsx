import React from 'react';
import type {calculateRewards} from '../lib/rewards';
export const rewardPercent=(value:number,total:number)=>total>0?value/total*100:0;
export const rewardNumber=(value:number)=>value.toLocaleString('es-CO',{maximumFractionDigits:2});
export function RewardBar({value,label,tone='emerald'}:{value:number;label:string;tone?:'emerald'|'cyan'|'violet'}){
 return <div role="img" aria-label={label} className="reward-bar"><div className={'reward-bar-fill '+tone} style={{width:Math.max(0,Math.min(100,value))+'%'}}/></div>;
}
export function RewardManagementReport({result,official}:{result:ReturnType<typeof calculateRewards>;official:boolean}){
 const teams=result.rows.flatMap(farm=>farm.teams.map(team=>({...team,target:farm.targetHours}))),hours=teams.reduce((sum,team)=>sum+team.hours,0),reached=teams.filter(team=>team.hours>=team.target).length,fruits=teams.reduce((sum,team)=>sum+(official?team.earnedFruits:team.expectedFruits),0);
 return <section className="summary-first reward-report" aria-label="Resumen de recompensas"><dl className="overview-stats"><div><dt>Granjas</dt><dd>{result.rows.length}</dd></div><div><dt>Horas registradas</dt><dd>{rewardNumber(hours)} h</dd></div><div><dt>Metas individuales alcanzadas</dt><dd>{reached} / {teams.length}</dd></div><div><dt>Frutos {official?'confirmados':'provisionales'}</dt><dd>{fruits} / {result.production}</dd></div></dl><details className="compact-disclosure"><summary>Resumen por granja</summary><table className="compact-report-table"><thead><tr><th>Granja</th><th>Meta por equipo</th><th>Equipos que alcanzan la meta</th><th>Horas registradas</th></tr></thead><tbody>{result.rows.map(farm=><tr key={farm.id}><th scope="row">{farm.name}</th><td>{rewardNumber(farm.targetHours)} h</td><td>{farm.teams.filter(team=>team.hours>=farm.targetHours).length} / {farm.teams.length}</td><td>{rewardNumber(farm.assignedHours)} h</td></tr>)}</tbody></table></details></section>;
}
