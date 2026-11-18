import React, { useMemo } from 'react';
import {
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from 'recharts';
import { calculateRewards, type RewardPlan } from '../lib/rewards';
const tooltip = {
    background: '#0f172a',
    border: '1px solid #334155',
    borderRadius: 8,
    color: '#e2e8f0',
  },
  colors = ['#22d3ee', '#34d399', '#a78bfa', '#fbbf24'];
export type RewardHistoryEntry = {
  revision: number;
  createdAt: string;
  plan?: RewardPlan;
};
export function RewardExecutiveCharts({
  result,
  history,
  revision,
  dirty,
  farmId,
}: {
  result: ReturnType<typeof calculateRewards>;
  history: RewardHistoryEntry[];
  revision: number;
  dirty: boolean;
  farmId: string;
}) {
  const teams = result.rows.flatMap((farm) =>
      farm.teams.map((team) => ({ ...team, target: farm.targetHours })),
    ),
    hours = teams.reduce((sum, team) => sum + team.hours, 0);
  const farmRows = result.rows.map((farm) => ({
    name: farm.name,
    Registradas: farm.assignedHours,
    'Metas de todos los equipos': farm.targetHours * farm.teams.length,
  }));
  const stateRows = [
    {
      name: 'Meta alcanzada',
      value: teams.filter((team) => team.hours >= team.target).length,
    },
    {
      name: 'En proceso',
      value: teams.filter(
        (team) => team.manualHours !== null && team.hours < team.target,
      ).length,
    },
    {
      name: 'Sin captura',
      value: teams.filter((team) => team.manualHours === null).length,
    },
  ].filter((row) => row.value > 0);
  const distribution = Array.from(
    { length: Math.max(0, ...result.rows.map((farm) => farm.teams.length)) },
    (_, index) => ({
      name: `Equipo ${index + 1}`,
      Horas: result.rows.reduce(
        (sum, farm) => sum + (farm.teams[index]?.hours || 0),
        0,
      ),
    }),
  );
  const trend = useMemo(
    () =>
      history
        .flatMap((item) => {
          try {
            if (!item.plan || item.plan.schemaVersion !== 2) return [];
            const saved = calculateRewards(item.plan);
            return [
              {
                version: `v${item.revision}`,
                Horas: saved.rows
                  .filter((farm) => farmId === 'all' || farm.id === farmId)
                  .reduce((sum, farm) => sum + farm.assignedHours, 0),
                revision: item.revision,
              },
            ];
          } catch {
            return [];
          }
        })
        .sort((a, b) => a.revision - b.revision),
    [history, farmId],
  );
  const chart = (title: string, children: React.ReactNode) => (
    <article className="reward-chart-card" aria-label={title}>
      <h3>{title}</h3>
      <div className="reward-chart-canvas">{children}</div>
    </article>
  );
  return (
    <>
      <div className="reward-management-charts">
        {chart(
          'Horas y metas por granja',
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={farmRows.slice(0, 15)}>
              <CartesianGrid vertical={false} stroke="#334155" />
              <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <Tooltip contentStyle={tooltip} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar
                dataKey="Registradas"
                fill={colors[0]}
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="Metas de todos los equipos"
                fill="#475569"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>,
        )}
        {chart(
          'Cumplimiento de equipos',
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={stateRows}
                dataKey="value"
                nameKey="name"
                innerRadius={52}
                outerRadius={78}
                paddingAngle={3}
              >
                {stateRows.map((row, index) => (
                  <Cell key={row.name} fill={colors[index % colors.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltip} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>,
        )}
        {chart(
          'Esfuerzo registrado por equipo',
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={distribution} layout="vertical">
              <CartesianGrid horizontal={false} stroke="#334155" />
              <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <YAxis
                type="category"
                dataKey="name"
                width={65}
                tick={{ fill: '#94a3b8', fontSize: 10 }}
              />
              <Tooltip contentStyle={tooltip} />
              <Bar dataKey="Horas" fill={colors[2]} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>,
        )}
        {chart(
          'Evolución de horas guardadas',
          trend.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={[
                  ...trend,
                  {
                    version: dirty
                      ? 'Actual · sin guardar'
                      : `v${revision} · actual`,
                    Horas: hours,
                    revision,
                  },
                ]}
              >
                <CartesianGrid stroke="#334155" />
                <XAxis
                  dataKey="version"
                  tick={{ fill: '#94a3b8', fontSize: 10 }}
                />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <Tooltip contentStyle={tooltip} />
                <Line
                  type="linear"
                  dataKey="Horas"
                  stroke={colors[1]}
                  strokeWidth={3}
                  dot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="reward-chart-empty">
              Guarde una versión y luego edítela y guarde otra para formar el
              historial. La evolución utiliza versiones guardadas.
            </p>
          ),
        )}
      </div>
      <p className="mt-2 text-xs text-slate-400">
        Cada equipo mantiene la meta completa.{' '}
        {farmRows.length > 15
          ? 'El primer gráfico muestra 15 granjas; use el filtro para revisar las demás.'
          : ''}
      </p>
    </>
  );
}
