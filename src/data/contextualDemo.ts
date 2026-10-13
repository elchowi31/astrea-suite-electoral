import type { Candidate, ElectoralLevel, Leader, UserProfile } from '../types';
import type { DemoBundle, DemoContext } from './demoSeed';
import { COLOMBIA_ELECTORAL_GEOGRAPHY } from './colombiaElectoralData';
import { completeDemo } from './completeDemo';

const levels: ElectoralLevel[] = ['Gobernación', 'Asamblea / Diputación', 'Alcaldía', 'Concejo Municipal'];
const chambers: Record<ElectoralLevel, Candidate['chamber']> = {
  'Gobernación': 'Gobernador', 'Asamblea / Diputación': 'Diputado / Asamblea',
  'Alcaldía': 'Alcalde', 'Concejo Municipal': 'Concejal',
  'Cámara de Representantes': 'Cámara de Diputados', 'Senado de la República': 'Senado'
};
const roleLevels: Partial<Record<UserProfile['role'], ElectoralLevel>> = {
  Gobernador: 'Gobernación', Diputado: 'Asamblea / Diputación', Alcalde: 'Alcaldía', Concejal: 'Concejo Municipal'
};
const normalize = (value: string) => value.normalize('NFD').replace(/\p{Diacritic}/gu, '').trim().toLowerCase();

export function personalDemoId(tenantId: string, uid: string): string {
  if (!tenantId || !uid || tenantId.includes('/') || uid.includes('/')) throw new Error('La demostración requiere una cuenta y organización válidas.');
  return `${tenantId}--demo--${uid}`;
}

export function demoContext(profile: UserProfile): DemoContext {
  const department = profile.department?.trim() || '';
  const municipality = profile.municipality?.trim() || '';
  if (!department || !municipality) throw new Error('Indique el departamento y municipio para cargar datos de prueba de su entorno.');
  const regional = ['AdminGlobal', 'AdminTenant', 'Gobernador', 'Diputado'].includes(profile.role);
  return { role: profile.role, department, municipality,
    electoralLevel: roleLevels[profile.role] || profile.electoralLevel || 'Alcaldía',
    scopeLevel: regional ? 'Departamental' : ['LiderVeredal', 'Operador', 'Supervisor'].includes(profile.role) ? 'Veredal' : 'Municipal' };
}

export function demoMatchesProfile(bundle: DemoBundle | null, profile: UserProfile | null, tenantId: string): boolean {
  if (!bundle || !profile || bundle.ownerUid !== profile.uid || bundle.tenantId !== tenantId || !bundle.context || bundle.version !== 3) return false;
  const context = bundle.context;
  return context.role === profile.role && context.electoralLevel === (roleLevels[profile.role] || profile.electoralLevel || 'Alcaldía')
    && (!profile.department?.trim() || context.department === profile.department.trim())
    && (!profile.municipality?.trim() || context.municipality === profile.municipality.trim());
}

export function buildContextualDemo(tenantId: string, profile: UserProfile): DemoBundle {
  if (profile.role !== 'AdminGlobal' && profile.tenantId !== tenantId) throw new Error('Use la organización de su cuenta para la demostración.');
  const context = demoContext(profile);
  const catalog = Object.values(COLOMBIA_ELECTORAL_GEOGRAPHY).find(item => normalize(item.nombre) === normalize(context.department));
  // Never substitute Cesar or the first municipality when this territory is absent from the catalog.
  const knownHome = Object.values(catalog?.municipios || {}).find(item => normalize(item.nombre) === normalize(context.municipality));
  if (catalog && !knownHome) throw new Error('El municipio indicado no pertenece al departamento seleccionado. Revise su entorno de prueba.');
  const rawMunicipalities = context.scopeLevel === 'Departamental' && catalog
    ? [context.municipality, ...Object.keys(catalog.municipios).filter(name => normalize(name) !== normalize(context.municipality))]
    : [context.municipality];
  const canonicalMunicipality = (name:string) => normalize(name)==='codazzi'?'agustin codazzi':normalize(name);
  const municipalities=rawMunicipalities.filter((name,index,all)=>all.findIndex(item=>canonicalMunicipality(item)===canonicalMunicipality(name))===index);
  const now = new Date().toISOString();
  const selectedLevels = context.scopeLevel === 'Departamental'
    ? levels.filter(level => profile.role !== 'Diputado' || level !== 'Gobernación')
    : profile.role === 'Concejal' ? ['Concejo Municipal'] as ElectoralLevel[]
    : profile.role === 'Alcalde' ? ['Alcaldía', 'Concejo Municipal'] as ElectoralLevel[]
    : Array.from(new Set([context.electoralLevel, 'Concejo Municipal' as ElectoralLevel]));
  const orderedLevels = [context.electoralLevel, ...selectedLevels.filter(level => level !== context.electoralLevel)];
  const candidates: Candidate[] = orderedLevels.flatMap(level => {
    const regional = ['Gobernación', 'Asamblea / Diputación', 'Cámara de Representantes', 'Senado de la República'].includes(level);
    return (regional ? [context.municipality] : municipalities).map((municipality, index) => ({
      id: `demo-candidato-${levels.indexOf(level)}-${index}`, tenantId,
      fullName: `Aspirante DEMO · ${level} · ${regional ? context.department : municipality}`,
      district: regional ? context.department : municipality, chamber: chambers[level], electoralLevel: level,
      department: context.department, municipality, party: 'Movimiento ficticio DEMO', coalition: 'Alianza ficticia DEMO',
      status: 'En Campaña', bio: 'Persona ficticia. Cifras ilustrativas, sin relación con una candidatura real.',
      keyProposals: ['Servicios para el territorio', 'Participación comunitaria'], pollingPercentage: 28,
      voteTarget: regional ? 24000 : level === 'Alcaldía' ? 3200 : 400, votesCommitted: regional ? 12600 : level === 'Alcaldía' ? 1680 : 210, updatedAt: now
    }));
  });
  const leaders: Leader[] = municipalities.flatMap((municipality, index) => {
    const local = Object.values(catalog?.municipios || {}).find(item => normalize(item.nombre) === normalize(municipality));
    const sectors = [...(local?.barriosYComunas || []), ...(local?.veredasYCorregimientos || [])];
    return Array.from({ length: context.scopeLevel === 'Departamental' ? 4 : context.scopeLevel === 'Veredal' ? 1 : 2 }, (_, sectorIndex) => {
      const number = `${index + 1}-${sectorIndex + 1}`;
      return { id: `demo-lider-${number}`, tenantId, fullName: `Líder ficticio DEMO ${number}`,
        department: context.department, municipality, zoneOrDistrict: municipality, commune: 'Sector de demostración',
        veredaOrBarrio: sectors[sectorIndex] || `Sector ficticio DEMO ${sectorIndex + 1}`,
        assignedCandidateId: (candidates.filter(item => item.municipality === municipality || ['Gobernación','Asamblea / Diputación','Cámara de Representantes','Senado de la República'].includes(item.electoralLevel))[sectorIndex % candidates.filter(item => item.municipality === municipality || ['Gobernación','Asamblea / Diputación','Cámara de Representantes','Senado de la República'].includes(item.electoralLevel)).length] || candidates[0]).id,
        voteTarget: 120, votesCommitted: 72, activistsCount: 6, phone: '0000000000', email: `lider-${number}@demo.invalid`,
        status: 'Activo', budgetAllocated: 360000, refrigeriosNeeded: 24, fuelGallonsNeeded: 3, vehiclesNeeded: 1, witnessesCount: 2 };
    });
  });
  const districts = municipalities.map((name, index) => ({ id: `demo-distrito-${index}`, tenantId, name,
    region: context.department, voterCensus: 10000, seatsAvailable: 13, keyIssues: ['Servicios', 'Movilidad', 'Participación'], projectedSupport: 28, updatedAt: now }));
  const vehicles = municipalities.map((municipality, index) => ({ id: `demo-vehiculo-${index}`, tenantId,
    vehicleType: 'Microbús / Van (19 pas)' as const, licensePlate: `DEM-${String(index + 1).padStart(3, '0')}`,
    driverName: `Conductor ficticio DEMO ${index + 1}`, driverPhone: '0000000000', department: context.department,
    municipality, assignedZone: `${municipality} · logística DEMO del día electoral`, capacity: 19, dailyCost: 250000, fuelBudget: 60000, status: 'Reservado' as const }));
  const expenses = leaders.map((leader, index) => ({ id: `demo-gasto-${index}`, tenantId, phase: 'Campaña Oficial' as const,
    component: 'Alimentación y Refrigerios' as const, rubro: 'Alimentación y Refrigerios' as const,
    description: `Jornada ficticia DEMO · ${leader.veredaOrBarrio}`, amount: 120000, date: now.slice(0, 10), status: 'Pendiente' as const,
    department: context.department, municipality: leader.municipality, veredaOrBarrio: leader.veredaOrBarrio,
    responsibleLeaderId: leader.id, notes: 'Cifra sintética. No es una transacción real.' }));
  const voters = leaders.flatMap(leader => Array.from({ length: 4 }, (_, index) => {
    const candidate = candidates.find(item => item.id === leader.assignedCandidateId)!;
    return { id: `demo-votante-${leader.id}-${index}`, tenantId, fullName: `Votante ficticio DEMO ${leader.id.slice(11)}-${index + 1}`,
      documentNumber: `DEMO-DOC-${leader.id}-${index}`, phone: '0000000000', department: context.department,
      municipality: leader.municipality!, sector: leader.veredaOrBarrio!, pollingStation: `Puesto ficticio DEMO · ${leader.municipality}`,
      tableNumber: index + 1, leaderId: leader.id, leaderName: leader.fullName, candidateId: candidate.id,
      candidateName: candidate.fullName, supportLevel: 4 as const, requiresTransport: index % 2 === 0,
      registeredAt: now, verified: false, consentGiven: false, notes: 'Persona inexistente; registro exclusivo de demostración.' };
  }));
  return completeDemo({ id: personalDemoId(tenantId, profile.uid), ownerUid: profile.uid, tenantId, kind: 'presentation', isSynthetic: true,
    version: 2, createdAt: now, context, candidates, leaders, districts, vehicles, expenses, voters,
    contributions: [{ id: 'demo-aporte-1', tenantId, donorName: 'Aportante ficticio DEMO', donorDocument: 'DEMO-DOC-APORTE',
      donorType: 'Persona Natural', contributionType: 'Efectivo / Transferencia Bancaria', rubroDestino: 'Alimentación y Refrigerios',
      amount: 360000, date: now.slice(0, 10), supportReceiptNumber: 'DEMO-REC-1', cneStatus: 'Pendiente Soporte', municipality: context.municipality, notes: 'Aporte inexistente de demostración.' }],
    proposals: [{ id: 'demo-propuesta-1', tenantId, title: `Propuesta DEMO · ${context.electoralLevel} · ${context.scopeLevel === 'Departamental' ? context.department : context.municipality}`,
      category: 'Participación', summary: 'Ejemplo ficticio adaptado al cargo y al territorio.', fullText: 'Contenido de prueba para explorar la plataforma.',
      status: 'Borrador', author: 'Equipo ficticio DEMO', createdAt: now }],
    coordinations: [{ id: 'demo-coordinacion-1', tenantId, title: `Equipo DEMO · ${context.scopeLevel === 'Departamental' ? context.department : context.municipality}`,
      coordinatorName: 'Coordinador ficticio DEMO', coordinatorRole: context.scopeLevel === 'Veredal' ? 'Líder territorial' : 'Coordinación territorial',
      color: '#2563eb', iconName: 'Map', summary: 'Estructura ficticia para este entorno.', committees: [{ id: 'demo-comite-1', name: 'Comité ficticio de logística',
        coordinationId: 'demo-coordinacion-1', leadPerson: leaders[0].fullName, responsibilities: ['Organización territorial'], tasksCount: 6, completedTasksCount: 2, status: 'En Ejecución', membersCount: 6 }] }],
    driveFiles: [{ id: 'demo-drive-1', tenantId, name: `Plan DEMO de ${context.department} · ${context.municipality}`,
      mimeType: 'application/vnd.google-apps.document', category: 'Operación', summary: 'Ejemplo sin archivo ni enlace real.', syncedAt: now }] });
}
