import * as XLSX from 'xlsx';
import {calculateRewards,type RewardConfig} from './rewards';
/** Standalone, code-generated workbook. No attached/private document is published. */
export function buildRewardWorkbook(config:RewardConfig){
  const result=calculateRewards(config),book=XLSX.utils.book_new();
  const data=XLSX.utils.aoa_to_sheet([['RECOMPENSAS — DATOS EDITABLES'],['Edite meta, granjas, equipos, producción y horas manuales.'],['Vacío: automático. Cero: no participa. Las frutas previstas no certifican trabajo.']]);
  const calc=XLSX.utils.aoa_to_sheet([['Granja','Producción activa','Meta exacta (centésimas)','Enteros','Resto','Orden','Meta (centésimas)','Horas manuales','Equipos automáticos','Saldo (centésimas)','Base automática','Resto automático','Horas asignadas','Frutas previstas']]);
  const matrix=XLSX.utils.aoa_to_sheet([['RECOMPENSAS — REPARTO AUTOMÁTICO'],['Cada fruta tiene el mismo valor. La asignación de frutas es provisional hasta verificar el trabajo.'],['Granja','Fruto','Equipo','Horas manuales','Horas automáticas','Horas asignadas','Frutas exactas','Frutas base','Resto','Orden','Frutas previstas','Meta de granja','Horas faltantes','Horas excedentes']]);
  const put=(s:XLSX.WorkSheet,a:string,v:string|number)=>{s[a]={t:typeof v==='number'?'n':'s',v};};
  const formula=(s:XLSX.WorkSheet,a:string,f:string,v:number|string=0)=>{s[a]={t:typeof v==='number'?'n':'s',f,v};};
  put(data,'B6','Meta general (horas)');put(data,'C6',config.targetHours);put(data,'B7','Número de granjas (1–100)');put(data,'C7',config.farmCount);put(data,'B8','Equipos por granja (1–10)');put(data,'C8',config.teamCount);
  XLSX.utils.sheet_add_aoa(data,[['N.º','Granja','Fruto','Producción',...Array.from({length:10},(_,j)=>`Equipo ${j+1} (h manuales)`)]],{origin:'B13'});
  for(let i=0;i<100;i++){
    const farm=config.farms[i],d=i+14,c=i+2,start=4+i*10,end=start+9,computed=result.rows[i];
    put(data,`B${d}`,i+1);put(data,`C${d}`,farm?.name||`Granja ${i+1}`);put(data,`D${d}`,farm?.fruit||'Frutas');put(data,`E${d}`,farm?.production??0);
    for(let j=0;j<10;j++){const h=farm?.manualHours[j];if(h!==null&&h!==undefined)put(data,`${String.fromCharCode(70+j)}${d}`,h);}
    put(calc,`A${c}`,i+1);
    formula(calc,`B${c}`,`IF(A${c}<=Datos!$C$7,Datos!E${d},0)`);
    formula(calc,`C${c}`,`IFERROR(ROUND(Datos!$C$6*100,0)*B${c}/SUM(B$2:B$101),0)`);
    formula(calc,`D${c}`,`INT(C${c})`);formula(calc,`E${c}`,`C${c}-D${c}`);
    formula(calc,`F${c}`,`COUNTIF(E$2:E$101,">"&E${c})+COUNTIF(E$2:E${c},E${c})`);
    formula(calc,`G${c}`,`IF(SUM(B$2:B$101)>0,D${c}+IF(F${c}<=ROUND(Datos!$C$6*100,0)-SUM(D$2:D$101),1,0),0)`);
    formula(calc,`H${c}`,`SUM(Datos!F${d}:INDEX(Datos!F${d}:O${d},1,Datos!$C$8))`);
    formula(calc,`I${c}`,`COUNTBLANK(Datos!F${d}:INDEX(Datos!F${d}:O${d},1,Datos!$C$8))`);
    formula(calc,`J${c}`,`MAX(0,G${c}-ROUND(H${c}*100,0))`);formula(calc,`K${c}`,`IFERROR(INT(J${c}/I${c}),0)`);formula(calc,`L${c}`,`J${c}-I${c}*K${c}`);
    formula(calc,`M${c}`,`SUM(Matriz!F${start}:F${end})`);
    formula(calc,`N${c}`,`IFERROR(MIN(B${c},INT(B${c}*MIN(ROUND(M${c}*100,0),G${c})/G${c})),0)`);
    for(let j=0;j<10;j++){
      const r=start+j,input=`Datos!${String.fromCharCode(70+j)}${d}`,active=`AND(${i+1}<=Datos!$C$7,${j+1}<=Datos!$C$8)`,t=computed?.teams[j];
      formula(matrix,`A${r}`,`IF(${active},Datos!C${d},"")`,t?computed.name:'');formula(matrix,`B${r}`,`IF(${active},Datos!D${d},"")`,t?computed.fruit:'');
      formula(matrix,`C${r}`,`IF(${active},${j+1},0)`,t?j+1:0);formula(matrix,`D${r}`,`IF(AND(${active},NOT(ISBLANK(${input}))),${input},"")`,t?.manualHours??'');
      formula(matrix,`E${r}`,`IF(AND(${active},ISBLANK(${input})),(Calculos!K${c}+IF(COUNTBLANK(Datos!F${d}:${String.fromCharCode(70+j)}${d})<=Calculos!L${c},1,0))/100,0)`,t?.manualHours===null?t.hours:0);
      formula(matrix,`F${r}`,`IF(${active},IF(ISBLANK(${input}),E${r},${input}),0)`,t?.hours??0);
      formula(matrix,`G${r}`,`IFERROR(Calculos!N${c}*F${r}/Calculos!M${c},0)`);formula(matrix,`H${r}`,`INT(G${r})`);formula(matrix,`I${r}`,`G${r}-H${r}`);
      formula(matrix,`J${r}`,`COUNTIF(I$${start}:I$${end},">"&I${r})+COUNTIF(I$${start}:I${r},I${r})`);
      formula(matrix,`K${r}`,`IF(${active},H${r}+IF(J${r}<=Calculos!N${c}-SUM(H$${start}:H$${end}),1,0),0)`,t?.expectedFruits??0);
      formula(matrix,`L${r}`,`IF(${active},Calculos!G${c}/100,0)`,t?computed.targetHours:0);
      formula(matrix,`M${r}`,`IF(${active},MAX(0,L${r}-Calculos!M${c}),0)`,t?computed.missingHours:0);formula(matrix,`N${r}`,`IF(${active},MAX(0,Calculos!M${c}-L${r}),0)`,t?computed.excessHours:0);
    }
  }
  data['!ref']='A1:O113';calc['!ref']='A1:N101';matrix['!ref']='A1:N1003';
  data['!cols']=[{wch:3},{wch:29},{wch:25},{wch:22},...Array.from({length:11},()=>({wch:18}))];matrix['!cols']=Array.from({length:14},(_,i)=>({wch:i<2?25:19}));calc['!cols']=Array.from({length:14},()=>({wch:24}));
  matrix['!autofilter']={ref:'A3:N1003'};
  XLSX.utils.book_append_sheet(book,data,'Datos');XLSX.utils.book_append_sheet(book,matrix,'Matriz');XLSX.utils.book_append_sheet(book,calc,'Calculos');
  book.Workbook={CalcPr:{calcMode:'auto',fullCalcOnLoad:true,forceFullCalc:true}} as typeof book.Workbook;
  book.Props={Title:'Matriz de recompensas por horas',Author:'Astrea Suite'};
  return book;
}
