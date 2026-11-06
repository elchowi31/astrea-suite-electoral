import type {RewardConfig} from './rewards';
import {DEFAULT_REWARDS,validateRewardConfig} from './rewards';
import {unzipSync} from 'fflate';
export async function importRewardMatrix(file:Pick<File,'size'|'arrayBuffer'>):Promise<RewardConfig>{
  if(file.size>10*1024*1024)throw new Error('La matriz supera 10 MB.');
  const bytes=new Uint8Array(await file.arrayBuffer());let expanded=0;
  unzipSync(bytes,{filter:entry=>{expanded+=entry.originalSize;if(expanded>40*1024*1024)throw new Error('La matriz descomprimida supera 40 MB.');return false;}});
  const XLSX=await import('xlsx'),workbook=XLSX.read(bytes,{type:'array'}),sheet=workbook.Sheets.Datos;
  if(!sheet)throw new Error('Use la plantilla de recompensas con la hoja Datos.');
  const value=(cell:string)=>{if(sheet[cell]?.f)throw new Error(`${cell}: las entradas deben ser valores, no fórmulas.`);return sheet[cell]?.v;};
  const config:RewardConfig={targetHours:Number(value('C6')),farmCount:Number(value('C7')),teamCount:Number(value('C8')),farms:structuredClone(DEFAULT_REWARDS.farms)};
  for(let i=0;i<100;i++){const row=i+14,production=value(`E${row}`);if(production===undefined&&i>=config.farmCount)continue;
    config.farms[i]={id:`farm-${i+1}`,name:String(value(`C${row}`)||`Granja ${i+1}`),fruit:String(value(`D${row}`)||'Frutas'),production:production===undefined?NaN:Number(production),manualHours:Array.from({length:10},(_,j)=>{const n=value(`${String.fromCharCode(70+j)}${row}`);return n===undefined||n===''?null:Number(n);})};
  }
  validateRewardConfig(config);return config;
}
export async function exportRewardMatrix(config:RewardConfig){
  const XLSX=await import('xlsx');const {buildRewardWorkbook}=await import('./rewardWorkbook');
  XLSX.writeFile(buildRewardWorkbook(config),'Matriz_recompensas.xlsx');
}
