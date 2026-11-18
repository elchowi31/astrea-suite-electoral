import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDemoBundle } from '../src/data/demoSeed';
import type { DashboardSource } from '../src/lib/managerDashboard';
import type { UserProfile } from '../src/types';
import { operationalExecutive } from '../src/lib/operationalExecutive';
import { validateOperationalSnapshot } from '../src/lib/operationalSnapshot';
const user = {
    uid: 'owner',
    tenantId: 't',
    role: 'AdminTenant',
    department: 'Cesar',
    municipality: 'Astrea',
  } as UserProfile,
  b = buildDemoBundle('t', user),
  source: DashboardSource = {
    ...b,
    ...b.operations!,
    tenant: {
      tenantId: 't',
      name: 'Test',
      primaryColor: '#000',
      secondaryColor: '#fff',
      createdAt: '2026-10-01',
      active: true,
    },
    user,
    readOnly: true,
  };
test('Executive priorities use actual operational records, exclude foreign tenants and label the sample context', () => {
  const event = {
      ...source.events[0],
      startAt: '2026-11-18T10:00:00Z',
      status: 'Planificado' as const,
    },
    request = {
      ...source.requests[0],
      eventId: event.id,
      status: 'Pendiente' as const,
      unitCost: 0,
    };
  const result = operationalExecutive(
    {
      ...source,
      events: [event],
      requests: [request, { ...request, tenantId: 'other', id: 'foreign' }],
    },
    new Date('2026-11-17T12:00:00Z'),
  );
  assert.equal(result.metrics.urgentRequests, 1);
  assert.equal(result.metrics.pendingRequests, 1);
  assert.equal(result.priorities[0].priority, 1);
  assert.equal(result.mode, 'demo');
  assert.ok(!JSON.stringify(result).includes(source.voters[0].fullName));
  assert.equal(
    validateOperationalSnapshot({ ...result, private: 'ignored' }).mode,
    'demo',
  );
});
test('The preventive cash scenario requires at least three observed dates and never invents history', () => {
  const expense = {
    ...b.expenses[0],
    status: 'Pagado' as const,
    amount: 140,
    settlementType: 'Efectivo' as const,
  };
  const data = {
    ...source,
    expenses: [
      { ...expense, date: '2026-11-17' },
      { ...expense, id: 'b', date: '2026-11-16' },
    ],
  };
  assert.equal(
    operationalExecutive(data, new Date('2026-11-17T12:00:00Z')).forecast,
    null,
  );
  const result = operationalExecutive(
    {
      ...data,
      expenses: [
        ...data.expenses,
        { ...expense, id: 'c', date: '2026-11-15' },
        { ...expense, id: 'outside', date: '2026-11-03', amount: 99999 },
      ],
    },
    new Date('2026-11-17T12:00:00Z'),
  );
  assert.equal(result.forecast?.sevenDayCashCost, 210);
  assert.equal(result.forecast?.observedDays, 3);
  assert.throws(() =>
    validateOperationalSnapshot({ mode: 'real', metrics: { requests: NaN } }),
  );
});
