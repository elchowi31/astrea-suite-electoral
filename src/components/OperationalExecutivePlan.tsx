import React, { useEffect, useMemo, useState } from 'react';
import { useOperations } from './operations/OperationsContext';
import { operationalExecutive } from '../lib/operationalExecutive';
import { authenticatedFetch, saveAiAnalysisToFirestore } from '../lib/firebase';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
const money = (value: number) =>
  value.toLocaleString('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  });
export function OperationalExecutivePlan() {
  const source = useOperations(),
    report = useMemo(() => operationalExecutive(source), [source]),
    signature = JSON.stringify({ mode: report.mode, metrics: report.metrics });
  const [analysis, setAnalysis] = useState<{
      summary: string;
      observations: string[];
      signature: string;
    } | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  useEffect(() => {
    setAnalysis(null);
    setError('');
  }, [source.tenant.tenantId, source.user?.uid, report.mode]);
  return (
    <section className="space-y-4" aria-label="Plan ejecutivo basado en datos">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ['Solicitudes por decidir', String(report.metrics.pendingRequests)],
          ['Atención en 72 horas', String(report.metrics.urgentRequests)],
          ['Saldo tras compromisos', money(report.metrics.afterCommitments)],
          [
            'Gastos sin número de soporte',
            String(report.metrics.missingSupport),
          ],
        ].map(([label, value]) => (
          <article
            key={label}
            className="rounded-xl border border-slate-700 bg-slate-900 p-3"
          >
            <p className="text-xs text-slate-400">{label}</p>
            <strong className="mt-1 block text-xl text-cyan-200">
              {value}
            </strong>
          </article>
        ))}
      </div>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-bold">Resumen ejecutivo y plan de acción</h3>
          <p className="text-xs text-slate-400">
            {report.mode === 'demo'
              ? 'Datos de prueba'
              : 'Registros del ámbito autorizado'}{' '}
            · prioridades calculadas con solicitudes, jornadas, gastos y aportes
            visibles.
          </p>
        </div>
        <button
          className="compact-button"
          disabled={busy || source.loading || !!source.error}
          onClick={async () => {
            const captured = signature;
            setBusy(true);
            setError('');
            try {
              const response = await authenticatedFetch(
                  '/api/ai/operational-summary',
                  {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      tenantId: source.tenant.tenantId,
                      snapshot: { mode: report.mode, metrics: report.metrics },
                    }),
                  },
                ),
                data = await response.json();
              if (!response.ok || !data.success)
                throw Error(
                  data.error || 'No se pudo generar la lectura ejecutiva.',
                );
              setAnalysis({ ...data.analysis, signature: captured });
              await saveAiAnalysisToFirestore(source.tenant.tenantId, {
                type: 'Resumen operativo',
                title: `Resumen ejecutivo · ${report.mode === 'demo' ? 'prueba' : 'real'}`,
                content: JSON.stringify({
                  analysis: data.analysis,
                  metrics: report.metrics,
                  mode: report.mode,
                  generatedAt: new Date().toISOString(),
                }),
              });
            } catch (error) {
              setError((error as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? 'Preparando lectura…' : 'Interpretar indicadores con IA'}
        </button>
      </header>
      {source.loading && (
        <p role="status" className="text-sm text-cyan-200">
          Cargando registros operativos…
        </p>
      )}
      {source.error && (
        <p role="alert" className="text-sm text-amber-200">
          {source.error} El informe puede estar incompleto.
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-amber-200">
          {error}
        </p>
      )}
      {analysis && (
        <article className="space-y-2 rounded-xl border border-cyan-800 bg-cyan-950/20 p-4">
          <h4 className="font-bold">Lectura ejecutiva de IA</h4>
          {analysis.signature !== signature && (
            <p className="text-xs text-amber-200">
              Los indicadores cambiaron desde esta lectura. Actualice la
              interpretación.
            </p>
          )}
          <p className="text-sm">{analysis.summary}</p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-slate-300">
            {analysis.observations.map((text, index) => (
              <li key={index}>{text}</li>
            ))}
          </ul>
        </article>
      )}
      <div className="grid gap-4 lg:grid-cols-[1fr_2fr]">
        <article className="rounded-xl border border-slate-700 bg-slate-900 p-4">
          <h4 className="text-sm font-bold">Estado de solicitudes</h4>
          <div
            className="mt-3 h-52"
            role="img"
            aria-label={report.requestRows
              .map((row) => `${row.name}: ${row.value}`)
              .join(', ')}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={report.requestRows}
                layout="vertical"
                margin={{ left: 5, right: 15 }}
              >
                <XAxis type="number" allowDecimals={false} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={85}
                  tick={{ fontSize: 11, fill: '#cbd5e1' }}
                />
                <Tooltip
                  contentStyle={{
                    background: '#0f172a',
                    borderColor: '#475569',
                  }}
                />
                <Bar dataKey="value" name="Solicitudes">
                  {report.requestRows.map((row, index) => (
                    <Cell
                      key={row.name}
                      fill={['#fbbf24', '#60a5fa', '#34d399', '#94a3b8'][index]}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <h4 className="mt-3 text-sm font-bold">
            Escenario preventivo de caja
          </h4>
          {report.forecast ? (
            <p className="mt-2 text-xs text-slate-300">
              Si se mantiene el promedio de pagos de los últimos 14 días:{' '}
              {money(report.forecast.sevenDayCashCost)} en 7 días. Cobertura del
              saldo registrado: {report.forecast.coverageDays.toFixed(1)} días.
              Se observaron pagos en {report.forecast.observedDays} fechas.
            </p>
          ) : (
            <p className="mt-2 text-xs text-slate-400">
              Sin base suficiente: se requieren pagos fechados en al menos 3
              días distintos de los últimos 14 días.
            </p>
          )}
          <p className="mt-2 text-xs text-slate-400">
            Escenario mecánico, sin nuevos ingresos ni cambios de gasto. El
            saldo registrado requiere conciliación bancaria.
          </p>
        </article>
        <div className="space-y-3">
          {report.priorities.map((row, index) => (
            <article
              key={row.id}
              className="space-y-2 rounded-xl border border-slate-700 bg-slate-900 p-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded px-2 py-1 text-xs font-bold ${row.priority === 1 ? 'bg-rose-950 text-rose-200' : row.priority === 2 ? 'bg-amber-950 text-amber-200' : 'bg-cyan-950 text-cyan-200'}`}
                >
                  P{row.priority} · {index + 1}
                </span>
                <h4 className="font-semibold">{row.title}</h4>
              </div>
              <p className="text-sm text-cyan-200">{row.evidence}</p>
              <p className="text-sm text-slate-300">{row.action}</p>
              <p className="text-xs text-slate-400">
                Responsable sugerido: {row.owner} · plazo propuesto:{' '}
                {row.deadline}
              </p>
              <p className="text-xs text-emerald-200">
                Control: {row.indicator}
              </p>
            </article>
          ))}
        </div>
      </div>
      <details className="compact-disclosure">
        <summary>Criterios y alcance del informe</summary>
        <p className="mt-2 text-xs text-slate-400">
          P1: recursos próximos sin entregar, saldo insuficiente o registros
          inválidos. P2: aprobaciones, cotizaciones y soportes. P3: revisión
          preventiva. La prioridad organiza tareas administrativas; no mide
          intención de voto ni segmenta personas. Los objetivos y plazos son
          propuestas de control. Los datos se actualizan con los registros
          visibles de la plataforma; las reglas no sustituyen una auditoría.
        </p>
      </details>
    </section>
  );
}
