export type UserRole = 
  | 'AdminGlobal' 
  | 'Alcalde'
  | 'Gobernador'
  | 'Concejal'
  | 'Diputado'
  | 'JefePolitico'
  | 'LiderVeredal'
  | 'AdminTenant' 
  | 'Supervisor' 
  | 'Operador' 
  | 'Consulta' 
  | 'Invitado';

export interface Tenant {
  tenantId: string;
  name: string;
  primaryColor: string;
  secondaryColor: string;
  logoUrl?: string;
  candidateName?: string;
  createdAt: string;
  active: boolean;
  plan?: 'Gratuito' | 'Profesional' | 'Institucional';
  campaignDate?: string;
  budgetCap?: number;
  dataRegion?: 'southamerica-east1' | 'us-central1';
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  fullName?: string;
  prefix?: string; // Dr., Dra., Ing., Lic., Abg., Sr., Sra.
  tenantId: string;
  role: UserRole;
  electoralLevel?: ElectoralLevel;
  party?: string;
  assignedCandidateId?: string;
  assignedLeaderId?: string;
  municipality?: string;
  department?: string;
  phone?: string;
  avatarUrl?: string;
  createdAt: string;
  active?: boolean;
  requestedRole?: UserRole;
  lastLoginAt?: string;
}

export type WorkspaceMode = 'operativo' | 'administrativo';

export type ElectoralLevel = 
  | 'Gobernación' 
  | 'Alcaldía' 
  | 'Asamblea / Diputación' 
  | 'Concejo Municipal'
  | 'Cámara de Representantes'
  | 'Senado de la República';

export interface Candidate {
  id: string;
  tenantId: string;
  fullName: string;
  district: string;
  chamber: 'Gobernador' | 'Alcalde' | 'Diputado / Asamblea' | 'Concejal' | 'Senado' | 'Cámara de Diputados';
  electoralLevel: ElectoralLevel;
  department: string;
  municipality: string;
  veredaOrBarrio?: string;
  parentCandidateId?: string; // e.g. Alcalde is linked to a Gobernador or Diputado
  party: string;
  coalition: string;
  status: 'Inscrito' | 'En Campaña' | 'Elección Previa' | 'Electo';
  bio: string;
  keyProposals: string[];
  pollingPercentage: number;
  voteTarget?: number;
  votesCommitted?: number;
  photoUrl?: string;
  updatedAt: string;
}

export interface District {
  id: string;
  tenantId: string;
  name: string;
  region: string;
  voterCensus: number;
  seatsAvailable: number;
  keyIssues: string[];
  projectedSupport: number;
  updatedAt: string;
}

export interface Proposal {
  id: string;
  tenantId: string;
  title: string;
  category: string;
  summary: string;
  fullText: string;
  status: 'Borrador' | 'En Revisión' | 'Aprobado' | 'Presentado';
  author: string;
  createdAt: string;
}

export interface DriveFileItem {
  id: string;
  tenantId: string;
  driveFileId?: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
  category: string;
  summary: string;
  syncedAt: string;
  size?: string;
}

export interface AiAnalysisItem {
  id: string;
  tenantId: string;
  title: string;
  type: 'Análisis Electoral' | 'Estrategia Discurso' | 'Debate Prep' | 'Resumen Documento Drive' | 'Proyección Votos';
  content: string;
  createdAt: string;
}

export type CampaignPhase = 
  | 'Precampaña' 
  | 'Campaña Oficial' 
  | 'Día D (Electoral)' 
  | 'Post-Electoral';

export type FinancialRubro = 
  | 'Alimentación y Refrigerios'
  | 'Transporte y Movilización'
  | 'Combustible'
  | 'Publicidad y Propaganda'
  | 'Sedes y Logística'
  | 'Honorarios y Testigos Electorales'
  | 'Eventos, Mítines y Tarimas'
  | 'Material Impreso y Camisetas'
  | 'Tecnología y Asesoría Jurídica'
  | 'Caja Menor e Imprevistos';

export type ExpenseComponent = 
  | 'Alimentación y Refrigerios'
  | 'Transporte y Movilización'
  | 'Combustible'
  | 'Propaganda y Medios'
  | 'Publicidad y Propaganda'
  | 'Eventos y Mítines'
  | 'Sedes y Logística'
  | 'Operación de Líderes'
  | 'Honorarios y Testigos Electorales'
  | 'Tecnología y Asesoría'
  | 'Caja Menor e Imprevistos';

export type DonorType =
  | 'Persona Natural'
  | 'Recursos Propios Candidato'
  | 'Partido o Movimiento Político'
  | 'Crédito Financiero CNE'
  | 'Organización / Simpatizantes';

export type ContributionType =
  | 'Efectivo / Transferencia Bancaria'
  | 'Especie (Alimentación / Refrigerios)'
  | 'Especie (Transporte y Vehículos)'
  | 'Especie (Combustible / Vales Gasolina)'
  | 'Especie (Publicidad / Pauta Radial / Impresión)'
  | 'Especie (Sedes / Inmuebles)'
  | 'Otro Aporte en Especie';

export interface DonorContribution {
  id: string;
  tenantId: string;
  donorName: string;
  donorDocument: string; // Cédula o NIT
  donorPhone?: string;
  donorEmail?: string;
  donorType: DonorType;
  contributionType: ContributionType;
  rubroDestino: FinancialRubro;
  amount: number; // Valor en COP
  date: string;
  supportReceiptNumber: string; // Comprobante CNE / Recibo
  cneStatus: 'Verificado CNE' | 'Reportado Cuentas Claras' | 'En Validación' | 'Pendiente Soporte';
  department?: string;
  municipality?: string;
  notes?: string;
}

export interface CampaignExpense {
  id: string;
  tenantId: string;
  phase?: CampaignPhase; // Precampaña, Campaña, Día D
  component: ExpenseComponent;
  rubro?: FinancialRubro;
  description: string;
  amount: number;
  unitCost?: number;
  quantity?: number;
  unitMeasure?: string; // e.g. 'Galones', 'Refrigerios', 'Viajes', 'Vallas', 'Días'
  date: string;
  status: 'Pagado' | 'Pendiente' | 'Aprobado';
  supplier?: string;
  invoiceNumber?: string;
  department?: string;
  municipality?: string;
  veredaOrBarrio?: string;
  fundedByDonorId?: string; // Optional link to specific donor
  responsibleLeaderId?: string; // Optional link to leader
  vehiclePlate?: string; // Optional link to vehicle
  notes?: string;
}

export interface LeaderRequirement {
  leaderId: string;
  leaderName: string;
  veredaOrBarrio: string;
  municipality: string;
  zone: string;
  voterGoal: number;
  // Physical & Logistics Needs
  refrigeriosCount: number; // Refrigerios solicitados
  refrigeriosCostEstimate: number; // En COP
  fuelGallons: number; // Galones de combustible requeridos
  fuelCostEstimate: number; // En COP
  vehiclesNeeded: number; // Camionetas / Buses
  vehiclesCostEstimate: number; // En COP
  activistsHonorarios: number; // Fondos para activistas
  witnessesCount: number; // Testigos requeridos para mesas
  witnessesCostEstimate: number; // En COP
  totalBudgetRequired: number; // Suma total requerida
  budgetDisbursed: number; // Fondos ya entregados
  budgetPending: number; // Fondos pendientes de giro
  status: 'Completo' | 'Parcial' | 'Crítico Desfinanciado';
}

export interface ElectoralProjection2026 {
  departamento: string;
  municipio?: string;
  subregion?: string;
  censoElectoralOficial2026: number; // Potencial electoral oficial RNEC
  participacionHistoricaPct: number; // Ej. 55.4%
  votosValidosProyectados: number; // Total votos válidos
  umbralLegal3Pct: number; // Umbral 3% Ley 1475
  cuocienteElectoral?: number; // Para corporaciones
  cifraRepartidoraEstimada?: number; // Método D'Hondt
  metaVictoriaUninominal?: number; // Para Gobernación o Alcaldía
  escanosDisputados?: number;
  fuenteOficial: string;
}

export interface Leader {
  id: string;
  tenantId: string;
  fullName: string;
  zoneOrDistrict: string;
  commune: string;
  department?: string;
  municipality?: string;
  veredaOrBarrio?: string;
  assignedCandidateId?: string;
  parentPoliticalChief?: string; // Jefe político asignado
  voteTarget: number;
  votesCommitted: number;
  activistsCount: number;
  phone: string;
  email: string;
  status: 'Activo' | 'Destacado' | 'En Riesgo';
  budgetAllocated: number;
  // Granular needs summary
  refrigeriosNeeded?: number;
  fuelGallonsNeeded?: number;
  vehiclesNeeded?: number;
  witnessesCount?: number;
  photoUrl?: string;
  latitude?: number;
  longitude?: number;
}

export interface TransportVehicle {
  id: string;
  tenantId: string;
  vehicleType: 'Bus Gran Capacidad (45 pas)' | 'Microbús / Van (19 pas)' | 'Camioneta 4x4 Rural (5 pas)' | 'Motocarro / Tricimóvil (3 pas)' | 'Minivan (15 pas)' | 'Automóvil Coordinación' | 'Camioneta Propaganda' | 'Chiva Veredal' | 'Moto Enlace';
  licensePlate: string;
  driverName: string;
  driverPhone: string;
  assignedZone: string;
  department?: string;
  municipality?: string;
  capacity: number;
  dailyCost: number;
  fuelBudget: number;
  status: 'Operativo - Día D' | 'En Mantenimiento' | 'Reservado';
  latitude?: number;
  longitude?: number;
}

export interface LiveTelemetryBeacon {
  id: string;
  tenantId: string;
  userId?: string;
  deviceId?: string;
  driverName: string;
  role: 'Conductor' | 'Supervisor Electoral' | 'Líder Territorial' | 'Coordinador Día D';
  vehiclePlate?: string;
  vehicleType?: string;
  phone?: string;
  assignedRoute?: string;
  latitude: number;
  longitude: number;
  accuracy: number; // en metros
  speed: number; // en km/h
  heading?: number; // 0-360 grados
  batteryLevel?: number; // 0-100%
  status: 'En Movimiento' | 'Detenido en Puesto' | 'En Espera' | 'Alerta Desvío' | 'Desconectado / App Cerrada';
  lastHeartbeat: number; // timestamp en ms
  isScreenLocked?: boolean;
  historyTrail?: { lat: number; lng: number; time: number }[];
  sosAlert?: boolean;
  sosMessage?: string;
}

// ----------------------------------------------------
// ESTRUCTURA ORGANIZACIONAL & COMITÉS DE CAMPAÑA
// ----------------------------------------------------
export interface CampaignCommittee {
  id: string;
  name: string;
  coordinationId: string;
  leadPerson?: string;
  responsibilities: string[];
  tasksCount: number;
  completedTasksCount: number;
  status: 'Activo' | 'En Ejecución' | 'Completado' | 'Planificación';
  membersCount?: number;
}

export interface CampaignCoordination {
  id: string;
  tenantId: string;
  title: string;
  coordinatorName: string;
  coordinatorRole: string;
  coordinatorPhone?: string;
  coordinatorEmail?: string;
  color: string;
  iconName: string;
  summary: string;
  committees: CampaignCommittee[];
}

export interface CampaignTask {
  id: string;
  tenantId: string;
  coordinationId: string;
  committeeId: string;
  title: string;
  description: string;
  assignedTo: string;
  dueDate: string;
  priority: 'Alta' | 'Media' | 'Baja';
  completed: boolean;
  createdAt: string;
}

// ----------------------------------------------------
// JERARQUÍA ELECTORAL & VOTANTE RASO (BOTTOM-UP FEED)
// ----------------------------------------------------
export interface GrassrootsVoter {
  id: string;
  tenantId: string;
  fullName: string;
  documentNumber: string;
  phone: string;
  department: string;
  municipality: string;
  sector: string; // Vereda o Barrio
  pollingStation: string; // Puesto de votación
  tableNumber: number; // Mesa
  leaderId: string; // Líder responsable
  leaderName: string;
  candidateId: string; // Concejal o candidato asignado
  candidateName: string;
  supportLevel: 1 | 2 | 3 | 4 | 5; // 5 = Totalmente Comprometido
  requiresTransport: boolean;
  notes?: string;
  registeredAt: string;
  verified: boolean;
  consentGiven?: boolean;
  consentAt?: string;
  dataSource?: 'Directo' | 'Formulario' | 'Importación autorizada';
}

export interface AuditEvent {
  id: string;
  tenantId: string;
  actorId: string;
  actorEmail?: string;
  action: 'create' | 'update' | 'delete' | 'login' | 'export' | 'analysis';
  entity: string;
  entityId: string;
  createdAt: string;
  metadata?: Record<string, string | number | boolean | null>;
}

export interface SectorVolumeSummary {
  sector: string;
  municipality: string;
  voterCensus: number;
  targetVotes: number;
  committedVotes: number;
  leadersCount: number;
  coveragePct: number;
  status: 'Meta Superada' | 'En Rango' | 'Requiere Refuerzo' | 'Crítico';
}

// ----------------------------------------------------
// CÁLCULO ELECTORAL AVANZADO (LEY 1475 & D'HONDT)
// ----------------------------------------------------
export interface DhondtSimulationParty {
  id: string;
  name: string;
  votes: number;
  isUserParty?: boolean;
  color: string;
  candidatesCount?: number;
  candidateVotes?: { id: string; name: string; position: number; votes: number }[];
}

export interface DhondtQuotientStep {
  partyId: string;
  partyName: string;
  partyColor: string;
  divisor: number;
  quotient: number;
  seatWonNumber?: number; // e.g. 1, 2, ... N
  isSeatWinner: boolean;
}

export interface DhondtSimulationResult {
  totalCensus: number;
  totalVoters: number;
  turnoutPercentage: number;
  blankVotes: number;
  nullVotes: number;
  unmarkedVotes: number;
  totalValidVotes: number;
  thresholdPercentage: number; // e.g. 3% or 50% of quotient
  thresholdVotes: number;
  quotient: number; // Cociente electoral
  seatsInContest: number;
  electoralThresholdPassedParties: DhondtSimulationParty[];
  electoralThresholdFailedParties: DhondtSimulationParty[];
  allocationsByParty: {
    partyId: string;
    partyName: string;
    partyColor: string;
    isUserParty: boolean;
    totalVotes: number;
    votePercentage: number;
    seatsWon: number;
    seatNumbersWon: number[];
    votesPerSeat: number;
    surplusVotes: number;
    passedThreshold: boolean;
  }[];
  dhondtMatrix: DhondtQuotientStep[];
  cifraRepartidora: number;
  userPartySeats: number;
  userPartyMarginForNextSeat: number; // Votos faltantes para otra curul
  userPartySafetyMargin: number; // Votos que le sobran sobre el último escaño
}

// ----------------------------------------------------
// TESTIGOS ELECTORALES & AUDITORÍA DÍA D (ACTAS E-14)
// ----------------------------------------------------
export type WitnessStatus = 
  | 'Acreditado CNE' 
  | 'Mesa Instalada' 
  | 'En Votación' 
  | 'Mesa Cerrada' 
  | 'E-14 Transmitido' 
  | 'Incidencia Reportada';

export interface ElectoralWitness {
  id: string;
  tenantId: string;
  fullName: string;
  documentNumber: string;
  phone: string;
  cneCredentialNumber: string;
  department: string;
  municipality: string;
  pollingStation: string;
  tableNumber: number;
  status: WitnessStatus;
  isCoordinator?: boolean;
  assignedCandidateId?: string;
  assignedLeaderId?: string;
  emergencyPhone?: string;
  attendedTraining: boolean;
  kitDelivered: boolean;
  lastCheckInTime?: string;
  notes?: string;
}

export interface E14FormAudit {
  id: string;
  tenantId: string;
  witnessId: string;
  witnessName: string;
  department: string;
  municipality: string;
  pollingStation: string;
  tableNumber: number;
  totalCensusInTable: number;
  totalVotersInTable: number; // Total sufragantes
  
  // Conteo de Votos
  votesOurCandidate: number;
  votesOurPartyList: number;
  votesRivalPartyA: number;
  votesRivalPartyB: number;
  votesRivalPartyC: number;
  votesOtherParties: number;
  votesBlank: number;
  votesNull: number;
  votesUnmarked: number;
  totalVotesReported: number; // Suma total
  
  // Auditoría y Transmisión
  e14PhotoUrl?: string;
  hasDiscrepancy: boolean;
  discrepancyReason?: string;
  transmittedAt: string;
  verifiedByLegalAuditor: boolean;
  auditorNotes?: string;
}

export type IncidentSeverity = 'Baja' | 'Media' | 'Alta' | 'Crítica';
export type IncidentStatus = 'Abierto' | 'En Gestión Jurídica' | 'Resuelto';

export interface ElectoralIncident {
  id: string;
  tenantId: string;
  witnessId?: string;
  reportedBy: string;
  phone?: string;
  department: string;
  municipality: string;
  pollingStation: string;
  tableNumber?: number;
  incidentType: 
    | 'Impedimento a Testigo' 
    | 'Apertura Tardía de Mesa' 
    | 'Compra de Votos / Proselitismo' 
    | 'Tachadura / Enmendadura en E-14' 
    | 'Faltante de Tarjetones' 
    | 'Alteración de Urnas' 
    | 'Discrepancia en Preconteo'
    | 'Otro';
  severity: IncidentSeverity;
  status: IncidentStatus;
  description: string;
  evidencePhotoUrl?: string;
  reportedAt: string;
  resolvedAt?: string;
  legalResolutionNotes?: string;
}

// ----------------------------------------------------
// EMPRENDIMIENTOS & PROSPECTOS ELECTORALES (LÍDERES EN POTENCIA)
// ----------------------------------------------------
export type ProspectElectoralRole =
  | 'Líder de Equipo en Potencia'
  | 'Votante Comprometido'
  | 'Punto de Encuentro / Logístico'
  | 'Multiplicador Territorial'
  | 'Prospecto Sin Contactar';

export interface EntrepreneurProspect {
  id: string;
  tenantId: string;
  wkt?: string;
  documentId: string;
  fullName: string;
  locationCategory: 'Casco Urbano Astrea' | 'Corregimiento' | 'Vereda' | 'Finca' | string;
  veredaOrBarrio?: string;
  latitude: number;
  longitude: number;
  isViolenceVictim: boolean;
  gender: 'Hombre' | 'Mujer' | 'LBTIQ+' | string;
  economicActivity: string;
  subActivity?: string;
  phone: string;
  electoralRole: ProspectElectoralRole;
  assignedGroupId?: string;
  assignedGroupName?: string;
  assignedLeaderId?: string;
  assignedLeaderName?: string;
  conversionStatus: 'Prospecto' | 'Promovido a Líder' | 'Registrado como Votante' | 'Descartado';
  potentialVotes: number;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}
