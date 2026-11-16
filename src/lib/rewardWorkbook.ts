import * as XLSX from 'xlsx';
import {calculateRewards,calculateLegacyRewards,type RewardConfig} from './rewards';
/** One editable capture; formulas mirror per-team progress and full-pool largest remainders. */
export function buildRewardWorkbook(source:RewardConfig){
 const legacy=source.schemaVersion===2?null:calculateLegacyRewards(source);
 const config:RewardConfig=source.schemaVersion===2?source:{...source,schemaVersion:2,farms:source.farms.map(farm=>({...farm,targetHoursPerTeam:legacy?.rows.find(row=>row.id===farm.id)?.targetHours||source.targetHours}))};
 const result=calculateRewards(config),book=XLSX.utils.book_new();
 const data=XLSX.utils.aoa_to_sheet([['RECOMPENSAS — CAPTURA MANUAL'],['Cada equipo conserva la meta completa. Registre las horas una sola vez.'],['Los frutos se distribuyen por esfuerzo, incluso antes de alcanzar la meta. Sin horas no hay reparto.']]);
 const matrix=XLSX.utils.aoa_to_sheet([['RECOMPENSAS — RESULTADOS PROVISIONALES'],['El avance es individual. Confirmar en Astrea reutiliza la única captura.'],['Granja','Fruto','Equipo','Horas manuales','Meta por equipo','Avance individual','Horas faltantes','Horas adicionales','Frutos exactos','Frutos base','Resto','Orden','Frutos']]);
 const calc=XLSX.utils.aoa_to_sheet([['Granja','Producción activa','Horas registradas (centésimas)','Bolsa a repartir']]);
 const put=(sheet:XLSX.WorkSheet,address:string,value:string|number)=>{sheet[address]={t:typeof value==='number'?'n':'s',v:value};};
 const formula=(sheet:XLSX.WorkSheet,address:string,expression:string,value:string|number=0)=>{sheet[address]={t:typeof value==='number'?'n':'s',f:expression,v:value};};
 put(data,'C4','astrea-rewards-manual-v2');put(data,'B6','Meta predeterminada por equipo (h)');put(data,'C6',config.targetHours);put(data,'B7','Número de granjas (1–100)');put(data,'C7',config.farmCount);put(data,'B8','Equipos por granja (1–10)');put(data,'C8',config.teamCount);
 XLSX.utils.sheet_add_aoa(data,[['N.º','Granja','Fruto','Producción','Meta por equipo',...Array.from({length:10},(_,index)=>`Equipo ${index+1} (h manuales)`)]],{origin:'B13'});
 for(let i=0;i<100;i++){
  const d=i+14,c=i+2,start=4+i*10,end=start+9,farm=config.farms[i],computed=result.rows[i];
  put(data,`B${d}`,i+1);put(data,`C${d}`,farm?.name||`Granja ${i+1}`);put(data,`D${d}`,farm?.fruit||'Frutas');put(data,`E${d}`,farm?.production??0);put(data,`F${d}`,farm?.targetHoursPerTeam??config.targetHours);
  for(let j=0;j<10;j++){const hours=farm?.manualHours[j];if(hours!==null&&hours!==undefined)put(data,`${String.fromCharCode(71+j)}${d}`,hours);}
  put(calc,`A${c}`,i+1);formula(calc,`B${c}`,`IF(A${c}<=Datos!$C$7,Datos!E${d},0)`,computed?.production??0);
  formula(calc,`C${c}`,`ROUND(SUM(Datos!G${d}:INDEX(Datos!G${d}:P${d},1,Datos!$C$8))*100,0)`,Math.round((computed?.assignedHours??0)*100));
  formula(calc,`D${c}`,`IF(C${c}>0,B${c},0)`,computed?.teams.some(team=>team.hours>0)?computed.production:0);
  for(let j=0;j<10;j++){
   const row=start+j,entry=`Datos!${String.fromCharCode(71+j)}${d}`,active=`AND(${i+1}<=Datos!$C$7,${j+1}<=Datos!$C$8)`,team=computed?.teams[j];
   formula(matrix,`A${row}`,`IF(${active},Datos!C${d},"")`,team?computed.name:'');formula(matrix,`B${row}`,`IF(${active},Datos!D${d},"")`,team?computed.fruit:'');formula(matrix,`C${row}`,`IF(${active},${j+1},0)`,team?j+1:0);
   formula(matrix,`D${row}`,`IF(AND(${active},NOT(ISBLANK(${entry}))),${entry},"")`,team?.manualHours??'');
   formula(matrix,`E${row}`,`IF(${active},IF(ISBLANK(Datos!F${d}),Datos!$C$6,Datos!F${d}),0)`,team?computed.targetHours:0);
   formula(matrix,`F${row}`,`IFERROR(D${row}/E${row},0)`,team?team.hours/computed.targetHours:0);matrix[`F${row}`].z='0.00%';
   formula(matrix,`G${row}`,`IF(${active},MAX(0,E${row}-D${row}),0)`,team?Math.max(0,computed.targetHours-team.hours):0);
   formula(matrix,`H${row}`,`IF(${active},MAX(0,D${row}-E${row}),0)`,team?Math.max(0,team.hours-computed.targetHours):0);
   const exact=team&&computed.assignedHours?computed.production*team.hours/computed.assignedHours:0;
   formula(matrix,`I${row}`,`IFERROR(Calculos!D${c}*ROUND(D${row}*100,0)/Calculos!C${c},0)`,exact);formula(matrix,`J${row}`,`INT(I${row})`,Math.floor(exact));formula(matrix,`K${row}`,`I${row}-J${row}`,exact-Math.floor(exact));
   formula(matrix,`L${row}`,`COUNTIF(K$${start}:K$${end},">"&K${row})+COUNTIF(K$${start}:K${row},K${row})`);
   formula(matrix,`M${row}`,`IF(${active},J${row}+IF(L${row}<=Calculos!D${c}-SUM(J$${start}:J$${end}),1,0),0)`,team?.expectedFruits??0);
  }
 }
 data['!ref']='A1:P113';matrix['!ref']='A1:M1003';calc['!ref']='A1:D101';data['!cols']=[{wch:3},{wch:8},{wch:25},{wch:20},...Array.from({length:12},()=>({wch:18}))];matrix['!cols']=Array.from({length:13},(_,index)=>({wch:index<2?24:19}));matrix['!autofilter']={ref:'A3:M1003'};
 XLSX.utils.book_append_sheet(book,data,'Datos');XLSX.utils.book_append_sheet(book,matrix,'Matriz');XLSX.utils.book_append_sheet(book,calc,'Calculos');
 book.Workbook={CalcPr:{calcMode:'auto',fullCalcOnLoad:true,forceFullCalc:true}} as typeof book.Workbook;book.Props={Title:'Recompensas: meta individual y horas manuales',Author:'Astrea Suite'};return book;
}
