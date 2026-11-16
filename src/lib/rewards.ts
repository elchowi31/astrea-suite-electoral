export interface RewardFarm { id: string; name: string; fruit: string; production: number; targetHoursPerTeam?: number; manualHours: (number|null)[] }
export interface RewardConfig { schemaVersion?: 1|2; targetHours: number; farmCount: number; teamCount: number; farms: RewardFarm[] }
export interface RewardPlan extends RewardConfig { id: string; tenantId: string; ownerId: string; name: string; revision: number; updatedAt: string }
export interface RewardApproval { source?: 'manual_v2'; id: string; tenantId: string; revision: number; hours: Record<string, number[]>; approvedBy: string; updatedAt: string }
export const DEFAULT_REWARDS: RewardConfig = {
  schemaVersion:2, targetHours: 500, farmCount: 8, teamCount: 3,
  farms: Array.from({length:100},(_,i)=>({id:`farm-${i+1}`,name:`Granja ${i+1}`,fruit:i===0?'Naranjas':i===1?'Manzanas':'Frutas',production:i===0?20:i===1?300:8,targetHoursPerTeam:500,manualHours:Array(10).fill(null)})),
};
const cents=(value:number)=>Math.round(value*100);
export function validHours(value:unknown): value is number { return typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=1_000_000&&Math.abs(value*100-Math.round(value*100))<0.000001; }
/** Largest remainders, stable tie break by row. Integer input/output preserves the total. */
export function apportion(total:number,weights:number[]):number[]{
  if(!Number.isSafeInteger(total)||total<0||weights.some(w=>!Number.isFinite(w)||w<0))throw new Error('Reparto inválido.');
  const sum=weights.reduce((a,b)=>a+b,0);if(!sum)return weights.map(()=>0);
  const raw=weights.map(w=>total*w/sum),out=raw.map(Math.floor);
  const ranked=raw.map((n,i)=>({i,rest:n-out[i]})).sort((a,b)=>b.rest-a.rest||a.i-b.i);
  const remaining=total-out.reduce((a,b)=>a+b,0);for(let i=0;i<remaining;i++)out[ranked[i].i]++;
  return out;
}
export function validateRewardConfig(config:RewardConfig){
  if(config.schemaVersion!==undefined&&![1,2].includes(config.schemaVersion))throw new Error('Versión de recompensas no compatible.');
  if(!validHours(config.targetHours)||config.targetHours===0)throw new Error('La meta debe ser positiva, hasta 1.000.000 h y con máximo dos decimales.');
  if(!Number.isInteger(config.farmCount)||config.farmCount<1||config.farmCount>100)throw new Error('Use entre 1 y 100 granjas.');
  if(!Number.isInteger(config.teamCount)||config.teamCount<1||config.teamCount>10)throw new Error('Use entre 1 y 10 equipos por granja.');
  const farms=config.farms.slice(0,config.farmCount);
  if(farms.length!==config.farmCount||new Set(farms.map(f=>f.id)).size!==farms.length)throw new Error('Faltan granjas o hay identificadores repetidos.');
  for(const farm of farms){
    if(!farm.name.trim()||farm.name.length>160||!farm.fruit.trim()||farm.fruit.length>80)throw new Error('Complete el nombre y fruto de cada granja.');
    if(!Number.isSafeInteger(farm.production)||farm.production<0||farm.production>1_000_000)throw new Error(`${farm.name}: use una producción entera entre 0 y 1.000.000.`);
    if(config.schemaVersion===2&&(!validHours(farm.targetHoursPerTeam??config.targetHours)||(farm.targetHoursPerTeam??config.targetHours)===0))throw new Error(`${farm.name}: la meta por equipo debe ser positiva y tener hasta dos decimales.`);
    if(farm.manualHours.length<config.teamCount||farm.manualHours.slice(0,config.teamCount).some(h=>h!==null&&!validHours(h)))throw new Error(`${farm.name}: corrija las horas manuales.`);
  }
  return farms;
}
export function calculateLegacyRewards(config:RewardConfig,approved:Record<string,number[]>={}){
  const farms=validateRewardConfig(config),production=farms.reduce((s,f)=>s+f.production,0);
  const targets=apportion(cents(config.targetHours),farms.map(f=>f.production));
  const rows=farms.map((farm,index)=>{
    const target=targets[index],manual=farm.manualHours.slice(0,config.teamCount),manualTotal=manual.reduce<number>((s,h)=>s+(h===null?0:cents(h)),0);
    const automatic=apportion(Math.max(0,target-manualTotal),manual.map(h=>h===null?1:0));
    const planned=manual.map((h,i)=>h===null?automatic[i]:cents(h));
    const sum=planned.reduce((a,b)=>a+b,0);
    const actual=Array.from({length:config.teamCount},(_,i)=>approved[farm.id]?.[i]??0);
    if(actual.some(h=>!validHours(h)))throw new Error(`${farm.name}: horas verificadas inválidas.`);
    const actualCents=actual.map(cents),actualTotal=actualCents.reduce((a,b)=>a+b,0);
    const plannedPool=target>0?Math.min(farm.production,Math.floor(farm.production*Math.min(sum,target)/target)):0;
    const earnedPool=target>0?Math.min(farm.production,Math.floor(farm.production*Math.min(actualTotal,target)/target)):0;
    const expected=apportion(plannedPool,planned),earned=apportion(earnedPool,actualCents);
    return {...farm,targetHours:target/100,assignedHours:sum/100,missingHours:Math.max(0,target-sum)/100,excessHours:Math.max(0,sum-target)/100,verifiedHours:actualTotal/100,pendingFruits:farm.production-earnedPool,
      teams:planned.map((hours,i)=>({number:i+1,manualHours:manual[i],hours:hours/100,verifiedHours:actual[i],expectedFruits:expected[i],earnedFruits:earned[i]}))};
  });
  return {production,hoursPerFruit:production?config.targetHours/production:0,unassignedHours:production?0:config.targetHours,rows};
}

/** Manual mode: a complete target for EVERY team; all available fruit follows relative effort. */
export function calculateManualRewards(config:RewardConfig,approved:Record<string,number[]>={}){
  const farms=validateRewardConfig(config);
  const rows=farms.map(farm=>{
    const targetHours=farm.targetHoursPerTeam??config.targetHours;
    const manual=farm.manualHours.slice(0,config.teamCount),weights=manual.map(value=>cents(value??0));
    const total=weights.reduce((sum,value)=>sum+value,0),expected=apportion(farm.production,weights);
    const confirmed=Array.from({length:config.teamCount},(_,index)=>approved[farm.id]?.[index]??0);
    if(confirmed.some(value=>!validHours(value)))throw new Error(`${farm.name}: horas confirmadas inválidas.`);
    const confirmedCents=confirmed.map(cents),verifiedTotal=confirmedCents.reduce((sum,value)=>sum+value,0),earned=apportion(farm.production,confirmedCents);
    return {...farm,targetHours,assignedHours:total/100,missingHours:manual.reduce<number>((sum,value)=>sum+Math.max(0,cents(targetHours)-cents(value??0)),0)/100,
      excessHours:manual.reduce<number>((sum,value)=>sum+Math.max(0,cents(value??0)-cents(targetHours)),0)/100,
      verifiedHours:verifiedTotal/100,pendingFruits:farm.production-earned.reduce((sum,value)=>sum+value,0),
      teams:manual.map((hours,index)=>({number:index+1,manualHours:hours,hours:hours??0,verifiedHours:confirmed[index],expectedFruits:expected[index],earnedFruits:earned[index]}))};
  });
  const production=farms.reduce((sum,farm)=>sum+farm.production,0);
  return {production,hoursPerFruit:production?rows.reduce((sum,farm)=>sum+farm.targetHours*config.teamCount,0)/production:0,unassignedHours:0,rows};
}
export function calculateRewards(config:RewardConfig,approved:Record<string,number[]>={}){
  return config.schemaVersion===2?calculateManualRewards(config,approved):calculateLegacyRewards(config,approved);
}
/** Confirmation copies the only capture; a blank is not an implicit report of zero hours. */
export function manualRewardHours(config:RewardConfig){
  const farms=validateRewardConfig(config);if(config.schemaVersion!==2)throw new Error('Revise la conversión al modo manual antes de confirmar.');
  return Object.fromEntries(farms.map(farm=>[farm.id,farm.manualHours.slice(0,config.teamCount).map((value,index)=>{
    if(value===null)throw new Error(`${farm.name}, equipo ${index+1}: registre las horas o indique cero antes de confirmar.`);return value;
  })]));
}
export function rewardMigrationConflicts(plan:RewardPlan,approval?:RewardApproval){
  if(plan.schemaVersion===2||!approval||approval.revision!==plan.revision)return [];
  return plan.farms.slice(0,plan.farmCount).flatMap(farm=>farm.manualHours.slice(0,plan.teamCount).flatMap((manual,index)=>{
    const confirmed=approval.hours[farm.id]?.[index];return manual!==null&&confirmed!==undefined&&cents(manual)!==cents(confirmed)?[{farmId:farm.id,farmName:farm.name,team:index+1,manual,confirmed}]:[];
  }));
}
export function convertRewardPlan(plan:RewardPlan,approval?:RewardApproval,source?:'manual'|'confirmed'):RewardPlan{
  if(plan.schemaVersion===2)return structuredClone(plan);
  const currentApproval=approval?.revision===plan.revision?approval:undefined;
  if(rewardMigrationConflicts(plan,currentApproval).length&&!source)throw new Error('Elija qué horas conservar; los valores anteriores quedarán en el historial.');
  const legacy=calculateLegacyRewards(plan),targets=new Map(legacy.rows.map(farm=>[farm.id,farm.targetHours]));
  return {...structuredClone(plan),schemaVersion:2,farms:plan.farms.map(farm=>({...farm,targetHoursPerTeam:targets.get(farm.id)||plan.targetHours,
    manualHours:farm.manualHours.map((manual,index)=>source==='manual'?manual:(currentApproval?.hours[farm.id]?.[index]??manual))}))};
}
