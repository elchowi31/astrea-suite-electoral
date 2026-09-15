import type { DemoBundle } from './demoSeed';

// Test fixtures only. No real people, polling estimates or GPS coordinates.
export const CESAR_MUNICIPALITIES = ['Valledupar', 'Aguachica', 'Agustín Codazzi', 'Astrea', 'Becerril', 'Bosconia', 'Chimichagua', 'Chiriguaná', 'Curumaní', 'El Copey', 'El Paso', 'Gamarra', 'González', 'La Gloria', 'La Jagua de Ibirico', 'Manaure Balcón del Cesar', 'Pailitas', 'Pelaya', 'Pueblo Bello', 'Río de Oro', 'La Paz', 'San Alberto', 'San Diego', 'San Martín', 'Tamalameque'];
export const DEMO_GROUPS = ['expenses', 'contributions', 'vehicles', 'candidates', 'districts', 'leaders', 'voters', 'coordinations', 'proposals', 'driveFiles'] as const;
type Group = typeof DEMO_GROUPS[number];
type Records = Partial<Pick<DemoBundle, Group>>;
export interface DemoPackage {
  format: 'astrea-demo-v2';
  isSynthetic: true;
  packageId: 'costos' | 'capital-humano';
  description: string;
  sources: { title: string; url: string; usage: string }[];
  records: Records;
}
const date = '2026-09-15T12:00:00.000Z';
const tenantId = '__TENANT_ACTIVO__';
const normalize = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
export const packageGroups = (kind: DemoPackage['packageId']): Group[] => kind === 'costos' ? ['expenses', 'contributions', 'vehicles'] : ['candidates', 'districts', 'leaders', 'voters', 'coordinations', 'proposals', 'driveFiles'];

export function buildDemoPackages(): DemoPackage[] {
  const bundle: Pick<DemoBundle, Group> = { expenses: [], contributions: [], vehicles: [], candidates: [], districts: [], leaders: [], voters: [], coordinations: [], proposals: [], driveFiles: [] };
  const special = ['Astrea', 'Bosconia', 'El Paso', 'El Copey', 'Valledupar'];
  CESAR_MUNICIPALITIES.forEach((municipality, m) => {
    const base = { tenantId, department: 'Cesar', municipality };
    const code = String(m + 1).padStart(2, '0');
    const zones = municipality === 'Astrea' ? ['Cabecera', 'Arjona', 'Santa Cecilia', 'La Ye', 'El Hebrón', 'El Yucal', 'El Jobo', 'Montecristo'] : ['Cabecera', 'Sector de prueba'];
    const people = municipality === 'Astrea' ? 64 : special.includes(municipality) ? 32 : 8;
    const candidateId = `demo-${code}-alcaldia`;
    for (const [n, zone] of zones.entries()) {
      bundle.leaders.push({ ...base, id: `demo-${code}-lider-${n}`, fullName: `Líder DEMO ${code}-${n + 1}`, zoneOrDistrict: zone, commune: 'Sector de prueba', veredaOrBarrio: zone, assignedCandidateId: candidateId, voteTarget: Math.ceil(people / zones.length), votesCommitted: 0, activistsCount: 2 + n, phone: '', email: `lider-${code}-${n}@example.invalid`, status: 'Activo', budgetAllocated: 500000, refrigeriosNeeded: 10 + n, fuelGallonsNeeded: 3 + n, vehiclesNeeded: 1, witnessesCount: 2 });
    }
    for (let n = 0; n < people; n++) {
      const leader = bundle.leaders.find(l => l.id === `demo-${code}-lider-${n % zones.length}`)!;
      const verified = n % 5 !== 0;
      const supportLevel = (3 + n % 3) as 3 | 4 | 5;
      if (verified && supportLevel >= 4) leader.votesCommitted++;
      bundle.voters.push({ ...base, id: `demo-${code}-persona-${n}`, fullName: `Persona FICTICIA ${code}-${n + 1}`, documentNumber: `DEMO-${code}-${n}`, phone: '', sector: leader.veredaOrBarrio!, pollingStation: 'Puesto FICTICIO de prueba', tableNumber: 1 + n % 4, leaderId: leader.id, leaderName: leader.fullName, candidateId, candidateName: `Candidatura DEMO Alcaldía ${municipality}`, supportLevel, requiresTransport: n % 2 === 0, registeredAt: `2026-09-${String(1 + n % 14).padStart(2, '0')}T12:00:00.000Z`, verified, consentGiven: false });
    }
    const confirmed = bundle.voters.filter(v => v.municipality === municipality && v.verified && v.supportLevel >= 4).length;
    for (const chamber of ['Alcalde', 'Concejal'] as const) {
      const mayor = chamber === 'Alcalde';
      bundle.candidates.push({ ...base, id: mayor ? candidateId : `demo-${code}-concejo`, fullName: `Candidatura DEMO ${mayor ? 'Alcaldía' : 'Concejo'} ${municipality}`, district: municipality, chamber, electoralLevel: mayor ? 'Alcaldía' : 'Concejo Municipal', party: 'Organización FICTICIA', coalition: 'DEMO', status: 'En Campaña', bio: 'Persona ficticia. No representa candidaturas reales.', keyProposals: [], pollingPercentage: 0, voteTarget: mayor ? people : 0, votesCommitted: mayor ? confirmed : 0, ...(mayor ? {} : { parentCandidateId: candidateId }), updatedAt: date });
    }
    // Deliberately small synthetic universes: never presented as the official census.
    bundle.districts.push({ id: `demo-${code}-distrito`, tenantId, name: municipality, region: 'Cesar · CENSO SIMULADO', voterCensus: people * 10, seatsAvailable: 0, keyIssues: ['Universo ficticio para pruebas; no es censo DANE ni Registraduría'], projectedSupport: 0, updatedAt: date });
    const items = [ ['Alimentación y Refrigerios', 25, 14000, 'ración'], ['Combustible', 12, 16500, 'galón'], ['Transporte y Movilización', 2, 180000, 'jornada'], ['Sedes y Logística', 1, 600000, 'mes'], ['Tecnología y Asesoría', 1, 350000, 'servicio'], ['Caja Menor e Imprevistos', 3, 45000, 'compra'] ] as const;
    for (let phase = 0; phase < 2; phase++) items.forEach(([component, quantity, unitCost, unitMeasure], n) => {
      const qty = quantity + (phase ? 2 : 0);
      bundle.expenses.push({ ...base, id: `demo-${code}-gasto-${phase}-${n}`, phase: phase ? 'Campaña Oficial' : 'Precampaña', component, description: `${component} · EJEMPLO ${municipality}`, quantity: qty, unitCost, unitMeasure, amount: qty * unitCost, date: `2026-${phase ? '09' : '08'}-${String(2 + n * 2).padStart(2, '0')}`, status: (['Pagado', 'Pendiente', 'Aprobado'] as const)[(m + n + phase) % 3], supplier: `Proveedor FICTICIO ${code}-${n}`, invoiceNumber: `DEMO-${code}-${phase}-${n}`, notes: 'Valor supuesto, no cotización. amount = quantity × unitCost. No importar a la operación real.' });
    });
    bundle.contributions.push({ ...base, id: `demo-${code}-aporte`, donorName: `Aportante FICTICIO ${code}`, donorDocument: `DEMO-APORTE-${code}`, donorType: 'Persona Natural', contributionType: 'Efectivo / Transferencia Bancaria', rubroDestino: 'Caja Menor e Imprevistos', amount: 4000000 + m * 10000, date: '2026-08-01', supportReceiptNumber: `DEMO-REC-${code}`, cneStatus: 'En Validación', notes: 'Aporte sintético. Sin comprobante real.' });
    bundle.vehicles.push({ ...base, id: `demo-${code}-vehiculo`, vehicleType: 'Microbús / Van (19 pas)', licensePlate: `DEMO-${code}`, driverName: `Conductor FICTICIO ${code}`, driverPhone: '', assignedZone: 'Sin ruta real', capacity: 19, dailyCost: 360000, fuelBudget: 198000, status: 'Reservado' });
  });
  for (const [i, chamber] of (['Gobernador', 'Diputado'] as const).entries()) bundle.candidates.push({ id: `demo-cesar-regional-${i}`, tenantId, fullName: `Candidatura FICTICIA ${chamber} Cesar`, district: 'Cesar', chamber: i ? 'Diputado / Asamblea' : 'Gobernador', electoralLevel: i ? 'Asamblea / Diputación' : 'Gobernación', department: 'Cesar', municipality: '', party: 'Organización FICTICIA', coalition: 'DEMO', status: 'En Campaña', bio: 'Registro de prueba departamental. Metas en cero para no sumar objetivos de cargos distintos.', keyProposals: [], pollingPercentage: 0, voteTarget: 0, votesCommitted: 0, updatedAt: date });
  bundle.coordinations.push({ id: 'demo-comite-admin', tenantId, title: 'Administración DEMO', coordinatorName: 'Responsable FICTICIO', coordinatorRole: 'Administración', coordinatorPhone: '', coordinatorEmail: 'admin@example.invalid', color: '#06b6d4', iconName: 'Briefcase', summary: 'Equipo de prueba', committees: [{ id: 'demo-comite-finanzas', coordinationId: 'demo-comite-admin', name: 'Finanzas DEMO', leadPerson: 'Responsable FICTICIO', responsibilities: ['Revisar soportes'], tasksCount: 12, completedTasksCount: 7, status: 'En Ejecución', membersCount: 4 }] });
  bundle.proposals.push({ id: 'demo-documento', tenantId, title: 'Documento DEMO', category: 'Administración', summary: 'Contenido ficticio para probar estados documentales.', fullText: 'Solo pruebas.', status: 'En Revisión', author: 'Equipo DEMO', createdAt: date });
  bundle.driveFiles.push({ id: 'demo-archivo', tenantId, name: 'Archivo DEMO sin enlace real', mimeType: 'application/json', category: 'Pruebas', summary: 'Referencia sintética', syncedAt: date });
  const sources = [
    { title: 'DANE · DIVIPOLA', url: 'https://geoportal.dane.gov.co/geovisores/territorio/consulta-divipola-division-politico-administrativa-de-colombia/', usage: 'Nombres municipales. No se importan coordenadas ni delimitaciones.' },
    { title: 'Gobernación del Cesar · división municipal', url: 'https://cesar.gov.co/d/es/nosotros/el-departamento/presentacion', usage: 'Catálogo de 25 municipios.' },
    { title: 'DANE · Censo Nacional de Población y Vivienda', url: 'https://www.dane.gov.co/index.php/estadisticas-por-tema/demografia-y-poblacion/censo-nacional-de-poblacion-y-vivenda-2018', usage: 'Referencia poblacional. Población no equivale a censo electoral. No se atribuyen cifras municipales oficiales a los datos simulados.' },
    { title: 'Registraduría · censo electoral', url: 'https://www.registraduria.gov.co/', usage: 'Las cifras oficiales deben validarse por elección y fecha. voterCensus en este paquete es exclusivamente simulado.' }
  ];
  return (['costos', 'capital-humano'] as const).map(packageId => ({ format: 'astrea-demo-v2', isSynthetic: true, packageId, description: 'DATOS FICTICIOS. Cargar por Datos > Importar paquetes demo. Solo se conservan registros del ámbito elegido y se asignan al tenant activo. No contiene censo electoral oficial, personas reales, coordenadas ni consentimiento real.', sources, records: Object.fromEntries(packageGroups(packageId).map(key => [key, bundle[key]])) }));
}

export function emptyDemoBundle(tenant: string): DemoBundle {
  return { id: `${tenant}-presentacion`, tenantId: tenant, kind: 'presentation', isSynthetic: true, version: 2, createdAt: date, candidates: [], districts: [], proposals: [], driveFiles: [], expenses: [], contributions: [], leaders: [], vehicles: [], coordinations: [], voters: [] };
}

export function readDemoPackage(input: unknown): DemoPackage {
  const p = input as DemoPackage;
  if (!p || p.format !== 'astrea-demo-v2' || p.isSynthetic !== true || !['costos', 'capital-humano'].includes(p.packageId) || !p.records || typeof p.records !== 'object') throw new Error('Archivo incompatible. Seleccione un paquete demo Astrea v2.');
  const canonical = buildDemoPackages().find(item => item.packageId === p.packageId)!;
  for (const group of packageGroups(p.packageId)) {
    const rows = p.records[group];
    if (!Array.isArray(rows) || rows.length > 1000) throw new Error(`Colección inválida: ${group}.`);
    const seen = new Set<string>();
    const template = canonical.records[group]![0];
    for (const row of rows as any[]) {
      if (!row || typeof row !== 'object' || typeof row.id !== 'string' || !row.id.startsWith('demo-') || seen.has(row.id)) throw new Error(`ID demo inválido o repetido: ${group}.`);
      seen.add(row.id);
      for (const [key, value] of Object.entries(template)) {
        if (!(key in row) || (Array.isArray(value) ? !Array.isArray(row[key]) : typeof row[key] !== typeof value)) throw new Error(`Campo inválido: ${group}.${key}.`);
      }
      if ('municipality' in row && row.municipality && !CESAR_MUNICIPALITIES.includes(row.municipality)) throw new Error('Municipio fuera del catálogo Cesar.');
      for (const [key, value] of Object.entries(row)) {
        if (typeof value === 'number' && (!Number.isFinite(value) || value < 0)) throw new Error(`Número inválido: ${key}.`);
        if (typeof value === 'string' && value.length > 3000) throw new Error(`Texto demasiado largo: ${key}.`);
      }
      if (group === 'expenses' && row.amount !== row.quantity * row.unitCost) throw new Error('El costo debe ser cantidad × precio unitario.');
    }
  }
  return p;
}

export function applyDemoPackages(packages: DemoPackage[], tenant: string, municipality: string, previous?: DemoBundle | null): DemoBundle {
  if (municipality !== 'Cesar' && !CESAR_MUNICIPALITIES.includes(municipality)) throw new Error('Seleccione el municipio de demostración.');
  const result = previous?.tenantId === tenant && previous.version === 2 ? structuredClone(previous) : emptyDemoBundle(tenant);
  // Filter retained records too when changing the scope.
  const inScope = (row: any, key: Group) => municipality === 'Cesar' || (key === 'districts' ? normalize(row.name) === normalize(municipality) : !('municipality' in row) || normalize(row.municipality) === normalize(municipality));
  for (const key of DEMO_GROUPS) (result[key] as any[]) = (result[key] as any[]).filter(row => inScope(row, key));
  for (const p of packages) for (const key of packageGroups(p.packageId)) {
    (result[key] as any[]) = (p.records[key] as any[]).filter(row => inScope(row, key)).map(row => ({ ...row, tenantId: tenant }));
  }
  const leaderIds = new Set(result.leaders.map(row => row.id));
  const candidateIds = new Set(result.candidates.map(row => row.id));
  if (result.voters.some(row => !leaderIds.has(row.leaderId) || !candidateIds.has(row.candidateId))) throw new Error('Referencias incompletas: revise líderes y candidaturas del paquete.');
  if (new TextEncoder().encode(JSON.stringify(result)).length > 850000) throw new Error('Paquete demasiado grande. Seleccione un municipio.');
  return result;
}
