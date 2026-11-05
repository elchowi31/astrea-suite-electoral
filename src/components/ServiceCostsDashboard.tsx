import React,{useMemo,useState} from 'react';
import {BarChart,Bar,XAxis,YAxis,Tooltip,ResponsiveContainer,CartesianGrid} from 'recharts';
import type {CampaignExpense,Leader} from '../types';
import {summarizeServiceCosts,type CostGroup} from '../lib/serviceCosts';

const money=(n:number)=>new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:0}).format(n);
const compact=(n:number)=>new Intl.NumberFormat('es-CO',{notation:'compact',maximumFractionDigits:1}).format(n);
const number=(n:number)=>new Intl.NumberFormat('es-CO',{maximumFractionDigits:2}).format(n);
const input='mt-1 min-h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-400';
const card='rounded-2xl border border-slate-800 bg-slate-950/70 p-4 sm:p-5';

function CostChart({title,data,color,chronological=false}:{title:string;data:CostGroup[];color:string;chronological?:boolean}){
 const shown=chronological?data.slice(-30):data.slice(0,8);
 return <section className={card} aria-label={title}>
  <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
  <p className="mt-1 text-xs text-slate-400">Importes en COP · {chronological?'últimas 30 fechas con registros':'hasta 8 grupos de mayor gasto'}{data.length>shown.length?` · ${shown.length} de ${data.length} grupos`:''}</p>
  {shown.length?<><div className="mt-4 h-64" aria-hidden="true"><ResponsiveContainer width="100%" height="100%"><BarChart data={shown} layout={chronological?'horizontal':'vertical'} margin={{left:0,right:15,top:8,bottom:10}}>
   <CartesianGrid stroke="#1e293b" strokeDasharray="3 3"/>
   <XAxis type={chronological?'category':'number'} dataKey={chronological?'name':undefined} tick={{fill:'#94a3b8',fontSize:10}} tickFormatter={chronological?(s:string)=>s.slice(5):compact}/>
   <YAxis type={chronological?'number':'category'} dataKey={chronological?undefined:'name'} width={chronological?60:118} tick={{fill:'#cbd5e1',fontSize:10}} tickFormatter={chronological?compact:(s:string)=>s.length>19?s.slice(0,18)+'…':s}/>
   <Tooltip formatter={value=>[money(Number(value)),'Gasto registrado']} contentStyle={{background:'#0f172a',border:'1px solid #334155',borderRadius:12,color:'#f8fafc'}}/>
   <Bar dataKey="amount" fill={color} radius={[0,4,4,0]} maxBarSize={26}/>
  </BarChart></ResponsiveContainer></div>
  <details className="mt-2 text-xs text-slate-300"><summary className="cursor-pointer py-2">Ver cifras de todos los grupos ({data.length})</summary><div className="max-h-64 overflow-auto"><table className="w-full text-left"><thead><tr><th className="py-2">Grupo</th><th className="text-right">Gasto</th></tr></thead><tbody>{data.map(row=><tr key={row.name} className="border-t border-slate-800"><td className="py-2 pr-3">{row.name}</td><td className="text-right tabular-nums">{money(row.amount)}</td></tr>)}</tbody></table></div></details></>:<p className="py-16 text-center text-sm text-slate-400">No hay gastos con estos filtros.</p>}
 </section>;
}

export function ServiceCostsDashboard({expenses,leaders,tenantId}:{expenses:CampaignExpense[];leaders:Leader[];tenantId:string;key?:React.Key}){
 const [responsible,setResponsible]=useState(''),[status,setStatus]=useState(''),[from,setFrom]=useState(''),[to,setTo]=useState('');
 const [territory,setTerritory]=useState('');
 const names=useMemo(()=>new Map(leaders.filter(l=>l.tenantId===tenantId).map(l=>[l.id,l.fullName])),[leaders,tenantId]);
 const available:CampaignExpense[]=useMemo(()=>expenses.filter(e=>e.tenantId===tenantId),[expenses,tenantId]);
 const responsibleIds=[...new Set(available.map(e=>e.responsibleLeaderId||'unassigned'))];
 const territories=[...new Set(available.map(e=>e.veredaOrBarrio||'Sin vereda/barrio'))].sort();
 const invalidRange=!!from&&!!to&&from>to;
 const summary=useMemo(()=>summarizeServiceCosts(invalidRange?[]:available.filter(e=>!territory||(e.veredaOrBarrio||'Sin vereda/barrio')===territory),tenantId,{responsible,status,from,to}),[available,tenantId,responsible,status,from,to,territory,invalidRange]);
 const label=(id:string)=>id==='unassigned'?'Sin responsable':names.get(id)||'Responsable sin ficha visible';
 const responsibleGroups=summary.responsible.map(row=>({...row,name:label(row.name)+' · '+row.name.slice(-6)}));
 const alerts=[
  [summary.invalidCount,'gastos con importe inválido excluidos de los totales'],
  [summary.unknownStatus,'gastos con estado de pago sin clasificar'],
  [summary.missingQuantity,'gastos sin cantidad o unidad válida para calcular costo unitario'],
  [summary.missingInvoice,'gastos sin número de soporte registrado'],
  [summary.unassigned,'gastos sin responsable atribuido'],
  [summary.mismatched,'gastos cuyo total difiere de cantidad × costo unitario'],
 ].filter(([count])=>Number(count)>0);
 return <section className="space-y-5" aria-label="Tablero de costos por servicio">
  <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-widest text-cyan-300">Control financiero</p><h2 className="mt-1 text-2xl font-bold text-slate-50">Costos por servicio y responsable</h2><p className="mt-2 max-w-3xl text-sm text-slate-400">Gastos registrados, cantidades y soportes. Los filtros de rubro, municipio y búsqueda de arriba también se aplican a este tablero.</p></div><span className="rounded-full border border-cyan-800 bg-cyan-950/40 px-3 py-2 text-xs text-cyan-200">{summary.records.length} gastos en el ámbito filtrado</span></div>
  <div className={card+' grid gap-3 sm:grid-cols-2 xl:grid-cols-5'}>
   <label className="text-xs text-slate-300">Responsable<select className={input} value={responsible} onChange={e=>setResponsible(e.target.value)}><option value="">Todos los responsables</option>{responsibleIds.map(id=><option key={id} value={id}>{label(id)}</option>)}</select></label>
   <label className="text-xs text-slate-300">Vereda / barrio<select className={input} value={territory} onChange={e=>setTerritory(e.target.value)}><option value="">Todos los territorios</option>{territories.map(name=><option key={name}>{name}</option>)}</select></label>
   <label className="text-xs text-slate-300">Estado del gasto<select className={input} value={status} onChange={e=>setStatus(e.target.value)}><option value="">Todos los estados</option>{['Pagado','Aprobado','Pendiente'].map(name=><option key={name}>{name}</option>)}</select></label>
   <label className="text-xs text-slate-300">Desde<input className={input} type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label>
   <label className="text-xs text-slate-300">Hasta<input className={input} type="date" value={to} onChange={e=>setTo(e.target.value)}/></label>
   <button type="button" className="min-h-10 text-left text-xs text-cyan-300 underline" onClick={()=>{setResponsible('');setTerritory('');setStatus('');setFrom('');setTo('');}}>Restablecer estos filtros</button>
  </div>
  {invalidRange&&<p role="alert" className="rounded-xl bg-rose-950/50 p-3 text-sm text-rose-200">La fecha inicial debe ser anterior o igual a la fecha final.</p>}
  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[
   ['Gasto registrado',summary.total,'Suma de los importes filtrados'],['Pagado',summary.paid,'Registros con estado Pagado'],['Aprobado por pagar',summary.approved,'Aprobaciones pendientes de pago'],['Pendiente de aprobación',summary.pending,'Importes aún por revisar'],
  ].map(([title,value,description])=><article key={String(title)} className={card}><p className="text-xs text-slate-400">{title}</p><p className="mt-2 text-2xl font-bold tabular-nums text-slate-50">{money(Number(value))}</p><p className="mt-2 text-xs text-slate-400">{description}</p></article>)}</div>
  <section className="rounded-2xl border border-amber-900/60 bg-amber-950/15 p-4" aria-label="Alertas de calidad financiera"><h3 className="text-sm font-semibold text-amber-200">Revisiones pendientes</h3>{alerts.length?<ul className="mt-2 grid gap-2 text-sm text-slate-300 sm:grid-cols-2">{alerts.map(([count,text])=><li key={String(text)}><strong className="text-amber-200">{count}</strong> {text}</li>)}</ul>:<p className="mt-2 text-sm text-slate-300">{summary.records.length?'Sin inconsistencias detectadas en estos campos.':'Registre gastos para comenzar las comprobaciones.'}</p>}<p className="mt-2 text-xs text-slate-400">Estas señales piden revisión documental; no demuestran desvíos de recursos.</p></section>
  <div className="grid gap-4 xl:grid-cols-2">
   <CostChart title="Composición del gasto por rubro" data={summary.categories} color="#22d3ee"/>
   <CostChart title="Gasto atribuido por responsable" data={responsibleGroups} color="#a78bfa"/>
   <CostChart title="Gasto por municipio" data={summary.municipalities} color="#34d399"/>
   <CostChart title="Gasto por vereda o barrio" data={summary.territories} color="#fbbf24"/>
   <CostChart title="Importes según estado de pago" data={summary.statuses} color="#60a5fa"/>
   <CostChart title="Gastos registrados por fecha" data={summary.trend} color="#2dd4bf" chronological/>
  </div>
  <section className={card} aria-label="Costos unitarios documentados"><h3 className="text-lg font-semibold text-slate-100">Costo por unidad registrada</h3><p className="mt-2 text-sm text-slate-400">Costo unitario = suma de importes con cantidad válida ÷ suma de cantidades del mismo rubro y unidad. Ejemplo: $200.000 ÷ 10 personas = $20.000 por persona. Una cantidad facturada no acredita asistencia ni votos.</p>
   <div className="mt-4 overflow-auto"><table className="w-full min-w-[640px] text-sm"><thead className="bg-slate-900 text-left text-slate-300"><tr><th className="p-3">Rubro / unidad</th><th className="p-3 text-right">Cantidad</th><th className="p-3 text-right">Costo con cantidad válida</th><th className="p-3 text-right">Costo unitario</th></tr></thead><tbody>{summary.units.map(row=><tr key={JSON.stringify([row.category,row.unit])} className="border-t border-slate-800"><td className="p-3 text-slate-200">{row.category}<span className="block text-xs text-slate-400">{row.unit} · {row.count} gastos</span></td><td className="p-3 text-right tabular-nums text-slate-300">{number(row.quantity)}</td><td className="p-3 text-right tabular-nums text-slate-300">{money(row.amount)}</td><td className="p-3 text-right font-semibold tabular-nums text-cyan-200">{money(row.unitCost)}</td></tr>)}</tbody></table></div>
   {!summary.units.length&&<p className="py-8 text-center text-sm text-slate-400">Sin base para calcular costos unitarios. Complete cantidad y unidad al registrar o editar los gastos.</p>}
   <p className="mt-3 text-xs text-slate-400">Cada unidad se calcula por separado: personas, viajes, raciones, galones o piezas. Los gastos sin cantidad válida siguen incluidos en el gasto total.</p>
  </section>
 </section>;
}
