import type {DemoBundle} from './demoSeed';
import {TRANSPORT_RESOURCE,RESOURCE_CATALOG} from '../lib/operations';

export const CHART_INVENTORY = [
  ['inicio-validaciones','Inicio','Validaciones por fecha de registro','Minigráfico','voters'],
  ['inicio-altas-meta','Inicio','Registros asociados al indicador de metas','Minigráfico','voters'],
  ['inicio-costo-unitario','Inicio','Costo por registro validado por fecha','Minigráfico','unitCost'],
  ['inicio-gasto','Inicio','Gasto total por fecha','Minigráfico','expenses'],
  ['inicio-comparacion','Inicio','Metas, reportes y validación por líder o aspirante','Barras agrupadas','accountability'],
  ['inicio-cohortes','Inicio','Altas y validación actual por fecha','Áreas','voters'],
  ['inicio-recursos','Inicio','Costos por recurso','Barras por categoría','expenses'],
  ['inicio-salud','Inicio · indicadores','Salud operativa','Indicador circular','quality'],
  ['admin-pagados','Control administrativo','Gastos pagados por fecha','Minigráfico','paid'],
  ['admin-pendientes','Control administrativo','Gastos pendientes por fecha','Minigráfico','pending'],
  ['admin-aprobados','Control administrativo','Gastos aprobados por pagar por fecha','Minigráfico','approved'],
  ['admin-pagos','Control administrativo','Pendientes de pago por fecha y estado','Áreas apiladas','unpaid'],
  ['admin-estados','Control administrativo','Gastos por estado o fase','Barras por categoría','expenses'],
  ['transporte-cobertura','Transporte','Personas sin cupo, asignadas y llegadas','Barras apiladas','transport'],
  ['transporte-jornada','Transporte','Meta frente a embarcados y comando sin transporte','Barras agrupadas y apiladas','registrations'],
  ['solicitudes-presupuesto','Solicitudes','Necesidades presupuestadas por recurso','Barras por categoría','requests'],
  ['territorio-metas','Desempeño territorial','Metas y compromisos por municipio','Barras agrupadas','leaders'],
  ['territorio-gastos','Desempeño territorial','Gasto por componente en el territorio seleccionado','Dona','expenses'],
  ['finanzas-rubros','Finanzas','Aportes frente a gastos por rubro','Barras agrupadas','contributions'],
  ['finanzas-tipos','Finanzas','Aportes en efectivo y por clase de especie','Dona','contributions'],
  ['finanzas-tiempo','Finanzas','Evolución conjunta de aportes y gastos','Áreas','finance'],
  ['simulador-listas','Simulador estadístico','Resultados del escenario por lista','Barras por lista','official'],
  ...[...new Set(RESOURCE_CATALOG.map(row=>row.rubro))].map((rubro,index)=>[`finanzas-saldo-${index}`,'Finanzas',`Saldo o déficit · ${rubro}`,'Minibarra de saldo',`rubro:${rubro}`]),
] as const;

/** Checks the actual sources used by each visual, not an unrelated filler series. */
export function chartCoverage(bundle:DemoBundle) {
  const counts:Record<string,number>={
    voters:bundle.voters.length,expenses:bundle.expenses.length,leaders:bundle.leaders.length,
    accountability:Math.min(bundle.leaders.length,bundle.voters.length),quality:bundle.coordinations.length,
    unitCost:bundle.expenses.filter(e=>bundle.voters.some(v=>v.verified&&v.registeredAt.slice(0,10)===e.date.slice(0,10))).length,
    paid:bundle.expenses.filter(row=>row.status==='Pagado').length,pending:bundle.expenses.filter(row=>row.status==='Pendiente').length,
    approved:bundle.expenses.filter(row=>row.status==='Aprobado').length,unpaid:bundle.expenses.filter(row=>row.status!=='Pagado').length,
    transport:bundle.operations?.requests.filter(row=>row.resource===TRANSPORT_RESOURCE).length||0,
    registrations:bundle.operations?.registrations?.length||0,requests:bundle.operations?.requests.length||0,
    contributions:bundle.contributions.length,finance:Math.min(bundle.contributions.length,bundle.expenses.length),
  };
  return CHART_INVENTORY.map(([id,module,title,type,source])=>({id,module,title,type,source,records:source==='official'?null:source.startsWith('rubro:')?bundle.expenses.filter(row=>row.rubro===source.slice(6)).length+bundle.contributions.filter(row=>row.rubroDestino===source.slice(6)).length:counts[source]||0}));
}
