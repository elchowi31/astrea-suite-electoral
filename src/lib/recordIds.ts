/** Scope new records to their organization and distinguish simultaneous submissions. */
export function createRecordId(tenantId: string, suggested: string): string {
  if (!tenantId || tenantId.includes('/')) throw new Error('Seleccione una organización antes de guardar.');
  return `${tenantId}--${suggested.replaceAll('/', '-').slice(0,250)}-${crypto.randomUUID()}`;
}
