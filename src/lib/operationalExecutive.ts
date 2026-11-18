import {
  scopeDashboard,
  bogotaDay,
  type DashboardSource,
} from './managerDashboard';
import { summarizeFinances } from './financialSummary';
export type OperationalPriority = {
  id: string;
  priority: 1 | 2 | 3;
  title: string;
  evidence: string;
  action: string;
  owner: string;
  deadline: string;
  indicator: string;
};
const amount = (value: number) =>
  Number.isFinite(value) ? Math.max(0, value) : 0;
const money = (value: number) =>
  value.toLocaleString('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  });
/** Administrative priorities only. No demographic profiles, political persuasion or electoral targeting. */
export function operationalExecutive(input: DashboardSource, now = new Date()) {
  const data = scopeDashboard(input),
    ledger = summarizeFinances(
      data.expenses,
      data.contributions,
      data.tenant.tenantId,
    ),
    today = bogotaDay(now);
  const priorities: OperationalPriority[] = [];
  const active = data.requests.filter((row) => row.status !== 'Rechazada'),
    pending = active.filter((row) => row.status === 'Pendiente'),
    unpriced = active.filter(
      (row) => row.status !== 'Entregada' && amount(row.unitCost) === 0,
    );
  const dueEvents = new Set(
    data.events
      .filter(
        (row) =>
          !['Cancelado', 'Finalizado'].includes(row.status) &&
          Number.isFinite(Date.parse(row.startAt)) &&
          Date.parse(row.startAt) <= now.getTime() + 3 * 86400000,
      )
      .map((row) => row.id),
  );
  const due = active.filter(
    (row) => row.status !== 'Entregada' && dueEvents.has(row.eventId),
  );
  const missingSupport = data.expenses.filter(
    (row) => !row.invoiceNumber?.trim(),
  ).length;
  const invalidDates = data.expenses.filter(
    (row) =>
      !/^\d{4}-\d{2}-\d{2}/.test(row.date) ||
      !Number.isFinite(Date.parse(row.date)),
  ).length;
  const invalidFinancial =
    ledger.invalidRecords + ledger.unknownExpenseStatuses;
  if (due.length)
    priorities.push({
      id: 'delivery',
      priority: 1,
      title: 'Resolver recursos para jornadas próximas',
      evidence: `${due.length} solicitudes sin entrega en jornadas vencidas o previstas dentro de 72 horas.`,
      action:
        'Validar vigencia de la jornada, responsable, existencias y fecha de entrega; cerrar cada solicitud con su comprobante.',
      owner: 'Coordinación operativa',
      deadline: 'Hoy · antes del inicio de cada jornada',
      indicator: 'Solicitudes pendientes de entrega para estas jornadas = 0',
    });
  if (ledger.afterCommitments < 0)
    priorities.push({
      id: 'cash',
      priority: 1,
      title: 'Revisar cobertura financiera de compromisos',
      evidence: `Saldo registrado después de compromisos: ${money(ledger.afterCommitments)}.`,
      action:
        'Conciliar aportes en efectivo, pagos y obligaciones. Revisar disponibilidad antes de autorizar nuevas erogaciones.',
      owner: 'Finanzas',
      deadline: 'Hoy',
      indicator: 'Compromisos con fuente y disponibilidad documentadas',
    });
  if (invalidFinancial || invalidDates)
    priorities.push({
      id: 'quality',
      priority: 1,
      title: 'Corregir registros financieros incompletos',
      evidence: `${invalidFinancial} registros con importe o estado inválido; ${invalidDates} gastos con fecha no utilizable. Los grupos pueden coincidir.`,
      action:
        'Revisar cada registro en Finanzas y completar importe, estado y fecha con su soporte original.',
      owner: 'Finanzas y administración',
      deadline: '24 horas',
      indicator: 'Registros financieros inválidos = 0',
    });
  if (pending.length)
    priorities.push({
      id: 'approval',
      priority: 2,
      title: 'Resolver solicitudes pendientes de aprobación',
      evidence: `${pending.length} de ${active.length} solicitudes activas esperan decisión.`,
      action:
        'Revisar necesidad, cantidad, responsable y presupuesto; registrar aprobación o rechazo motivado.',
      owner: 'Coordinación operativa',
      deadline: '24 horas',
      indicator: 'Solicitudes sin decisión · objetivo operativo: 0',
    });
  if (unpriced.length)
    priorities.push({
      id: 'pricing',
      priority: 2,
      title: 'Completar cotizaciones',
      evidence: `${unpriced.length} solicitudes sin entregar tienen costo unitario cero.`,
      action:
        'Confirmar si el recurso es gratuito o en especie; en los demás casos registrar cotización y costo antes de comprometer recursos.',
      owner: 'Compras y finanzas',
      deadline: '48 horas',
      indicator: 'Solicitudes sin costo o gratuidad documentada = 0',
    });
  if (missingSupport)
    priorities.push({
      id: 'support',
      priority: 2,
      title: 'Completar trazabilidad documental',
      evidence: `${missingSupport} de ${data.expenses.length} gastos no tienen número de soporte registrado.`,
      action:
        'Adjuntar o referenciar factura, recibo o soporte aplicable. La ausencia del número no prueba por sí misma un incumplimiento.',
      owner: 'Finanzas y archivo',
      deadline: '48 horas',
      indicator: 'Gastos con soporte aplicable documentado / gastos revisados',
    });
  if (!priorities.length)
    priorities.push({
      id: 'monitor',
      priority: 3,
      title:
        data.expenses.length || data.requests.length
          ? 'Mantener revisión operativa'
          : 'Completar la base operativa',
      evidence:
        data.expenses.length || data.requests.length
          ? 'No se activaron las reglas administrativas de atención con los registros visibles.'
          : 'No hay gastos ni solicitudes visibles para evaluar estas reglas.',
      action:
        'Revisar jornadas, solicitudes, compromisos y soportes al inicio de cada día; documentar excepciones.',
      owner: 'Administración',
      deadline: 'Revisión diaria',
      indicator: 'Registro de revisión y excepciones actualizado',
    });
  const days = new Set<string>();
  let cost = 0;
  const lower = new Date(now.getTime() - 13 * 86400000)
    .toISOString()
    .slice(0, 10);
  for (const row of data.expenses) {
    const day = row.date?.slice(0, 10);
    if (
      day &&
      day >= lower &&
      day <= today &&
      row.settlementType !== 'Especie' &&
      row.status === 'Pagado' &&
      Number.isFinite(Date.parse(row.date)) &&
      Number.isFinite(row.amount) &&
      row.amount >= 0
    ) {
      days.add(day);
      cost += row.amount;
    }
  }
  const forecast =
    days.size >= 3 && cost > 0
      ? {
          dailyCashCost: cost / 14,
          sevenDayCashCost: cost / 2,
          coverageDays:
            ledger.recordedCashBalance > 0
              ? ledger.recordedCashBalance / (cost / 14)
              : 0,
          observedDays: days.size,
        }
      : null;
  const metrics = {
    requests: active.length,
    pendingRequests: pending.length,
    urgentRequests: due.length,
    unpricedRequests: unpriced.length,
    expenses: data.expenses.length,
    missingSupport,
    invalidFinancial,
    invalidDates,
    cashIncome: ledger.cashIncome,
    cashPaid: ledger.cashPaid,
    commitments: ledger.commitments,
    recordedCashBalance: ledger.recordedCashBalance,
    afterCommitments: ledger.afterCommitments,
  };
  return {
    metrics,
    priorities: priorities.sort((a, b) => a.priority - b.priority),
    forecast,
    requestRows: ['Pendiente', 'Aprobada', 'Entregada', 'Rechazada'].map(
      (name) => ({
        name,
        value: data.requests.filter((row) => row.status === name).length,
      }),
    ),
    mode: input.readOnly ? 'demo' : 'real',
  };
}
