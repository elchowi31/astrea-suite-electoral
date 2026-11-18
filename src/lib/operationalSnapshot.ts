export function validateOperationalSnapshot(value: unknown) {
  const row = value as Record<string, unknown>;
  if (!row || !['real', 'demo'].includes(String(row.mode)))
    throw Error('Ámbito del informe inválido.');
  const metrics = row.metrics as Record<string, unknown>,
    keys = [
      'requests',
      'pendingRequests',
      'urgentRequests',
      'unpricedRequests',
      'expenses',
      'missingSupport',
      'invalidFinancial',
      'invalidDates',
      'cashIncome',
      'cashPaid',
      'commitments',
      'recordedCashBalance',
      'afterCommitments',
    ];
  if (
    !metrics ||
    keys.some(
      (key) =>
        typeof metrics[key] !== 'number' ||
        !Number.isFinite(metrics[key]) ||
        Math.abs(Number(metrics[key])) > 1e15,
    )
  )
    throw Error('Indicadores inválidos.');
  return {
    mode: row.mode,
    metrics: Object.fromEntries(keys.map((key) => [key, metrics[key]])),
  };
}
