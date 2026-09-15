import type {
  CampaignCoordination,
  CampaignExpense,
  Candidate,
  District,
  DonorContribution,
  DriveFileItem,
  GrassrootsVoter,
  Leader,
  Proposal,
  TransportVehicle
} from '../types';

export interface DemoBundle {
  id: string;
  tenantId: string;
  kind: 'presentation';
  isSynthetic: true;
  version: number;
  createdAt: string;
  candidates: Candidate[];
  districts: District[];
  proposals: Proposal[];
  driveFiles: DriveFileItem[];
  expenses: CampaignExpense[];
  contributions: DonorContribution[];
  leaders: Leader[];
  vehicles: TransportVehicle[];
  coordinations: CampaignCoordination[];
  voters: GrassrootsVoter[];
}

export function buildDemoBundle(tenantId: string): DemoBundle {
  const now = '2026-08-15T12:00:00.000Z';
  const candidates: Candidate[] = [
    { id: 'demo-candidato-01', tenantId, fullName: 'Candidatura Demo Regional', district: 'Cesar', chamber: 'Gobernador', electoralLevel: 'Gobernación', department: 'Cesar', municipality: 'Valledupar', party: 'Movimiento Demostración', coalition: 'Alianza Demo', status: 'En Campaña', bio: 'Perfil completamente ficticio para demostrar indicadores y flujos.', keyProposals: ['Empleo joven', 'Conectividad rural', 'Gestión transparente'], pollingPercentage: 31.8, voteTarget: 128000, votesCommitted: 75400, updatedAt: now },
    { id: 'demo-candidato-02', tenantId, fullName: 'Candidatura Demo Municipal', district: 'Valledupar', chamber: 'Alcalde', electoralLevel: 'Alcaldía', department: 'Cesar', municipality: 'Valledupar', party: 'Movimiento Demostración', coalition: 'Alianza Demo', status: 'En Campaña', bio: 'Registro sintético sin relación con personas reales.', keyProposals: ['Movilidad', 'Seguridad barrial', 'Servicios digitales'], pollingPercentage: 28.4, voteTarget: 72000, votesCommitted: 43800, parentCandidateId: 'demo-candidato-01', updatedAt: now },
    { id: 'demo-candidato-03', tenantId, fullName: 'Candidatura Demo Concejo', district: 'Astrea', chamber: 'Concejal', electoralLevel: 'Concejo Municipal', department: 'Cesar', municipality: 'Astrea', party: 'Movimiento Demostración', coalition: 'Alianza Demo', status: 'En Campaña', bio: 'Datos ficticios para la presentación de la plataforma.', keyProposals: ['Agua rural', 'Economía campesina'], pollingPercentage: 12.6, voteTarget: 3400, votesCommitted: 2260, parentCandidateId: 'demo-candidato-02', updatedAt: now }
  ];

  const districts: District[] = [
    { id: 'demo-distrito-01', tenantId, name: 'Valledupar', region: 'Norte', voterCensus: 328000, seatsAvailable: 19, keyIssues: ['Empleo', 'Movilidad', 'Seguridad'], projectedSupport: 29.4, updatedAt: now },
    { id: 'demo-distrito-02', tenantId, name: 'Astrea', region: 'Centro', voterCensus: 14800, seatsAvailable: 13, keyIssues: ['Agua', 'Vías rurales', 'Productividad'], projectedSupport: 38.7, updatedAt: now },
    { id: 'demo-distrito-03', tenantId, name: 'Bosconia', region: 'Noroccidente', voterCensus: 27100, seatsAvailable: 13, keyIssues: ['Transporte', 'Empleo', 'Espacio público'], projectedSupport: 25.1, updatedAt: now },
    { id: 'demo-distrito-04', tenantId, name: 'Chiriguaná', region: 'Centro', voterCensus: 19300, seatsAvailable: 13, keyIssues: ['Salud', 'Ambiente', 'Educación'], projectedSupport: 33.2, updatedAt: now }
  ];

  const proposals: Proposal[] = [
    { id: 'demo-propuesta-01', tenantId, title: 'Conectividad rural medible', category: 'Infraestructura', summary: 'Plan piloto con metas trimestrales y seguimiento territorial.', fullText: 'Documento demostrativo. Las metas y cifras deben validarse antes de convertirse en propuesta oficial.', status: 'En Revisión', author: 'Equipo Programático Demo', createdAt: now },
    { id: 'demo-propuesta-02', tenantId, title: 'Ruta de empleo joven', category: 'Desarrollo económico', summary: 'Articulación entre formación, empresas y oportunidades locales.', fullText: 'Contenido sintético para probar el flujo de propuestas.', status: 'Aprobado', author: 'Equipo Programático Demo', createdAt: now },
    { id: 'demo-propuesta-03', tenantId, title: 'Tablero ciudadano de resultados', category: 'Transparencia', summary: 'Indicadores públicos de ejecución y compromisos territoriales.', fullText: 'Contenido ficticio de presentación.', status: 'Borrador', author: 'Equipo Programático Demo', createdAt: now }
  ];

  const leaders: Leader[] = [
    ['01', 'Zona Norte', 'Comuna 1', 'Valledupar', 'Barrio Demo Norte', 1200, 810, 24, 10.486, -73.253, 'Destacado'],
    ['02', 'Zona Centro', 'Comuna 3', 'Valledupar', 'Barrio Demo Centro', 950, 570, 18, 10.469, -73.251, 'Activo'],
    ['03', 'Corregimiento Arjona', 'Rural', 'Astrea', 'Arjona (Corregimiento)', 520, 345, 12, 9.575, -73.918, 'Activo'],
    ['04', 'Vereda San Isidro', 'Rural', 'Astrea', 'San Isidro (Vereda)', 480, 218, 9, 9.512, -73.985, 'En Riesgo'],
    ['05', 'Zona Occidente', 'Urbana', 'Bosconia', 'Sector Demo Occidental', 760, 492, 15, 9.971, -73.89, 'Activo'],
    ['06', 'Zona Sur', 'Urbana', 'Chiriguaná', 'Sector Demo Sur', 680, 501, 17, 9.363, -73.603, 'Destacado'],
    ['07', 'Corregimiento Santa Cecilia', 'Rural', 'Astrea', 'Santa Cecilia (Corregimiento)', 610, 420, 14, 9.489, -74.021, 'Destacado'],
    ['08', 'Vereda La Ye', 'Rural', 'Astrea', 'La Ye (Vereda)', 390, 260, 8, 9.551, -73.942, 'Activo']
  ].map((row) => ({ id: `demo-lider-${row[0]}`, tenantId, fullName: `Líder Demo ${row[0]}`, zoneOrDistrict: String(row[1]), commune: String(row[2]), department: 'Cesar', municipality: String(row[3]), veredaOrBarrio: String(row[4]), assignedCandidateId: 'demo-candidato-01', voteTarget: Number(row[5]), votesCommitted: Number(row[6]), activistsCount: Number(row[7]), phone: `00000000${row[0]}`, email: `lider${row[0]}@demo.invalid`, status: row[10] as Leader['status'], budgetAllocated: Number(row[5]) * 18500, refrigeriosNeeded: Number(row[7]) * 8, fuelGallonsNeeded: Number(row[7]) * 2, vehiclesNeeded: Math.max(1, Math.round(Number(row[7]) / 8)), witnessesCount: Math.max(2, Math.round(Number(row[7]) / 3)), latitude: Number(row[8]), longitude: Number(row[9]) }));

  const vehicles: TransportVehicle[] = [
    { id: 'demo-vehiculo-01', tenantId, vehicleType: 'Bus Gran Capacidad (45 pas)', licensePlate: 'DEM-001', driverName: 'Conductor Demo 01', driverPhone: '0000000101', assignedZone: 'Valledupar Norte', department: 'Cesar', municipality: 'Valledupar', capacity: 45, dailyCost: 780000, fuelBudget: 260000, status: 'Operativo - Día D', latitude: 10.481, longitude: -73.252 },
    { id: 'demo-vehiculo-02', tenantId, vehicleType: 'Microbús / Van (19 pas)', licensePlate: 'DEM-002', driverName: 'Conductor Demo 02', driverPhone: '0000000102', assignedZone: 'Corregimiento Arjona', department: 'Cesar', municipality: 'Astrea', capacity: 19, dailyCost: 420000, fuelBudget: 180000, status: 'Reservado', latitude: 9.574, longitude: -73.919 },
    { id: 'demo-vehiculo-03', tenantId, vehicleType: 'Camioneta 4x4 Rural (5 pas)', licensePlate: 'DEM-003', driverName: 'Conductor Demo 03', driverPhone: '0000000103', assignedZone: 'Bosconia', department: 'Cesar', municipality: 'Bosconia', capacity: 5, dailyCost: 350000, fuelBudget: 210000, status: 'Operativo - Día D', latitude: 9.973, longitude: -73.887 },
    { id: 'demo-vehiculo-04', tenantId, vehicleType: 'Moto Enlace', licensePlate: 'DEM-004', driverName: 'Conductor Demo 04', driverPhone: '0000000104', assignedZone: 'Chiriguaná', department: 'Cesar', municipality: 'Chiriguaná', capacity: 2, dailyCost: 110000, fuelBudget: 60000, status: 'En Mantenimiento', latitude: 9.362, longitude: -73.604 },
    { id: 'demo-vehiculo-05', tenantId, vehicleType: 'Camioneta 4x4 Rural (5 pas)', licensePlate: 'DEM-005', driverName: 'Conductor Demo 05', driverPhone: '0000000105', assignedZone: 'Vereda San Isidro', department: 'Cesar', municipality: 'Astrea', capacity: 5, dailyCost: 380000, fuelBudget: 190000, status: 'Operativo - Día D', latitude: 9.513, longitude: -73.984 }
  ];

  const expenses: CampaignExpense[] = [
    ['01', 'Publicidad y Propaganda', 'Pauta digital segmentada', 8400000, 'Pagado', 'Valledupar'],
    ['02', 'Transporte y Movilización', 'Reserva logística territorial', 5200000, 'Aprobado', 'Astrea'],
    ['03', 'Alimentación y Refrigerios', 'Jornada de formación de equipos', 3150000, 'Pagado', 'Bosconia'],
    ['04', 'Tecnología y Asesoría', 'Herramientas de seguimiento', 4600000, 'Aprobado', 'Valledupar'],
    ['05', 'Sedes y Logística', 'Operación de punto territorial', 2800000, 'Pendiente', 'Chiriguaná'],
    ['06', 'Combustible', 'Movilidad rural programada', 1950000, 'Pagado', 'Astrea']
  ].map((row, index) => ({ id: `demo-gasto-${row[0]}`, tenantId, phase: 'Campaña Oficial', component: row[1] as CampaignExpense['component'], rubro: row[1] as CampaignExpense['rubro'], description: String(row[2]), amount: Number(row[3]), date: `2026-08-${String(4 + index * 3).padStart(2, '0')}`, status: row[4] as CampaignExpense['status'], supplier: `Proveedor Demo ${row[0]}`, invoiceNumber: `FACT-DEMO-${row[0]}`, department: 'Cesar', municipality: String(row[5]), notes: 'Registro sintético para presentación; no corresponde a una transacción real.' }));

  const contributions: DonorContribution[] = [
    { id: 'demo-aporte-01', tenantId, donorName: 'Aportante Demo 01', donorDocument: 'DEMO-NIT-001', donorType: 'Organización / Simpatizantes', contributionType: 'Efectivo / Transferencia Bancaria', rubroDestino: 'Publicidad y Propaganda', amount: 12000000, date: '2026-08-03', supportReceiptNumber: 'REC-DEMO-001', cneStatus: 'En Validación', municipality: 'Valledupar', notes: 'Aporte ficticio.' },
    { id: 'demo-aporte-02', tenantId, donorName: 'Aportante Demo 02', donorDocument: 'DEMO-NIT-002', donorType: 'Persona Natural', contributionType: 'Especie (Transporte y Vehículos)', rubroDestino: 'Transporte y Movilización', amount: 6500000, date: '2026-08-10', supportReceiptNumber: 'REC-DEMO-002', cneStatus: 'Pendiente Soporte', municipality: 'Astrea', notes: 'Aporte ficticio.' },
    { id: 'demo-aporte-03', tenantId, donorName: 'Recursos Demo Candidatura', donorDocument: 'DEMO-ID-003', donorType: 'Recursos Propios Candidato', contributionType: 'Efectivo / Transferencia Bancaria', rubroDestino: 'Tecnología y Asesoría Jurídica', amount: 18000000, date: '2026-08-14', supportReceiptNumber: 'REC-DEMO-003', cneStatus: 'Reportado Cuentas Claras', municipality: 'Valledupar', notes: 'Aporte ficticio.' }
  ];

  const voters: GrassrootsVoter[] = Array.from({ length: 24 }, (_, index) => {
    const leader = leaders[index % leaders.length];
    const number = String(index + 1).padStart(2, '0');
    return { id: `demo-votante-${number}`, tenantId, fullName: `Votante Demo ${number}`, documentNumber: `DEMO-DOC-${number}`, phone: `00000100${number}`, department: 'Cesar', municipality: leader.municipality || 'Astrea', sector: leader.veredaOrBarrio || 'Sector Demo', pollingStation: `Puesto Demo ${1 + (index % 4)}`, tableNumber: 1 + (index % 12), leaderId: leader.id, leaderName: leader.fullName, candidateId: index % 3 === 2 ? 'demo-candidato-03' : 'demo-candidato-01', candidateName: index % 3 === 2 ? 'Candidatura Demo Concejo' : 'Candidatura Demo Regional', supportLevel: (3 + (index % 3)) as 3 | 4 | 5, requiresTransport: index % 4 === 0, registeredAt: now, verified: index % 5 !== 0, consentGiven: true, consentAt: now, dataSource: 'Importación autorizada' };
  });

  const coordinations: CampaignCoordination[] = [
    { id: 'demo-coordinacion-01', tenantId, title: 'Coordinación Territorial Demo', coordinatorName: 'Coordinación Demo 01', coordinatorRole: 'Responsable territorial', coordinatorPhone: '0000000201', coordinatorEmail: 'coordinacion01@demo.invalid', color: '#2563eb', iconName: 'Map', summary: 'Coordina despliegue, metas y alertas territoriales.', committees: [{ id: 'demo-comite-01', name: 'Comité de líderes', coordinationId: 'demo-coordinacion-01', leadPerson: 'Responsable Demo', responsibilities: ['Cobertura', 'Seguimiento'], tasksCount: 18, completedTasksCount: 12, status: 'En Ejecución', membersCount: 14 }] },
    { id: 'demo-coordinacion-02', tenantId, title: 'Coordinación Administrativa Demo', coordinatorName: 'Coordinación Demo 02', coordinatorRole: 'Responsable administrativo', coordinatorPhone: '0000000202', coordinatorEmail: 'coordinacion02@demo.invalid', color: '#10b981', iconName: 'Briefcase', summary: 'Control de presupuesto, soportes y cumplimiento.', committees: [{ id: 'demo-comite-02', name: 'Comité financiero', coordinationId: 'demo-coordinacion-02', leadPerson: 'Responsable Demo', responsibilities: ['Soportes', 'Presupuesto'], tasksCount: 11, completedTasksCount: 8, status: 'Activo', membersCount: 7 }] }
  ];

  const driveFiles: DriveFileItem[] = [
    { id: 'demo-drive-01', tenantId, name: 'Matriz territorial DEMO', mimeType: 'application/vnd.google-apps.spreadsheet', category: 'Operación', summary: 'Archivo sintético de ejemplo; no enlaza a un documento real.', syncedAt: now, size: '42 KB' },
    { id: 'demo-drive-02', tenantId, name: 'Plan programático DEMO', mimeType: 'application/vnd.google-apps.document', category: 'Estrategia', summary: 'Documento sintético de presentación.', syncedAt: now, size: '28 KB' }
  ];

  return { id: `${tenantId}-presentacion`, tenantId, kind: 'presentation', isSynthetic: true, version: 1, createdAt: now, candidates, districts, proposals, driveFiles, expenses, contributions, leaders, vehicles, coordinations, voters };
}
