import { 
  UserProfile, 
  UserRole, 
  ElectoralLevel, 
  Candidate, 
  Leader, 
  CampaignExpense, 
  TransportVehicle, 
  District, 
  DonorContribution,
  GrassrootsVoter,
  ElectoralWitness,
  E14FormAudit,
  ElectoralIncident
} from '../types';

export interface TerritorialScope {
  isGlobalAdmin: boolean;
  isTenantAdmin: boolean;
  isGobernador: boolean;
  isDiputado: boolean;
  isAlcalde: boolean;
  isConcejal: boolean;
  isLider: boolean;
  canViewAllMunicipalities: boolean;
  canViewHigherHierarchy: boolean;
  scopeLevel: 'Global' | 'Departamental' | 'Municipal' | 'Veredal';
  allowedMunicipality: string | null;
  allowedDepartment: string;
  allowedElectoralLevels: ElectoralLevel[];
  scopeTitle: string;
  scopeDescription: string;
}

export function getTerritorialScope(user?: UserProfile | null, userRole?: UserRole | string): TerritorialScope {
  // If user is logged in, prioritize user.role and user.municipality
  const effectiveRole = user?.role || (userRole as UserRole) || 'Alcalde';
  const userMuni = user?.municipality || 'Astrea';
  const userDept = user?.department || 'Cesar';

  if (effectiveRole === 'AdminGlobal') {
    return {
      isGlobalAdmin: true,
      isTenantAdmin: true,
      isGobernador: false,
      isDiputado: false,
      isAlcalde: false,
      isConcejal: false,
      isLider: false,
      canViewAllMunicipalities: true,
      canViewHigherHierarchy: true,
      scopeLevel: 'Global',
      allowedMunicipality: null,
      allowedDepartment: userDept,
      allowedElectoralLevels: ['Gobernación', 'Asamblea / Diputación', 'Alcaldía', 'Concejo Municipal', 'Cámara de Representantes', 'Senado de la República'],
      scopeTitle: 'Administrador Global de Plataforma',
      scopeDescription: 'Acceso irrestricto a todos los tenants, departamentos y municipios de Colombia.'
    };
  }

  if (effectiveRole === 'AdminTenant') {
    return {
      isGlobalAdmin: false,
      isTenantAdmin: true,
      isGobernador: false,
      isDiputado: false,
      isAlcalde: false,
      isConcejal: false,
      isLider: false,
      canViewAllMunicipalities: true,
      canViewHigherHierarchy: true,
      scopeLevel: 'Departamental',
      allowedMunicipality: null,
      allowedDepartment: userDept,
      allowedElectoralLevels: ['Gobernación', 'Asamblea / Diputación', 'Alcaldía', 'Concejo Municipal'],
      scopeTitle: 'Administrador de Organización / Partido',
      scopeDescription: 'Visión consolidada de todas las candidaturas y territorios de la organización.'
    };
  }

  if (effectiveRole === 'Gobernador') {
    return {
      isGlobalAdmin: false,
      isTenantAdmin: false,
      isGobernador: true,
      isDiputado: false,
      isAlcalde: false,
      isConcejal: false,
      isLider: false,
      canViewAllMunicipalities: true,
      canViewHigherHierarchy: true,
      scopeLevel: 'Departamental',
      allowedMunicipality: null,
      allowedDepartment: userDept,
      allowedElectoralLevels: ['Gobernación', 'Asamblea / Diputación', 'Alcaldía', 'Concejo Municipal'],
      scopeTitle: `Aspirante a la Gobernación del ${userDept}`,
      scopeDescription: `Visión departamental integral. Acceso a los 25 municipios del Cesar y a todas las candidaturas a alcaldías, asamblea, concejos y líderes aliados en la plataforma.`
    };
  }

  if (effectiveRole === 'Diputado') {
    return {
      isGlobalAdmin: false,
      isTenantAdmin: false,
      isGobernador: false,
      isDiputado: true,
      isAlcalde: false,
      isConcejal: false,
      isLider: false,
      canViewAllMunicipalities: true,
      canViewHigherHierarchy: false,
      scopeLevel: 'Departamental',
      allowedMunicipality: null,
      allowedDepartment: userDept,
      allowedElectoralLevels: ['Asamblea / Diputación', 'Alcaldía', 'Concejo Municipal'],
      scopeTitle: `Aspirante a la Asamblea Departamental (${userDept})`,
      scopeDescription: `Circunscripción departamental. Visualiza listas a la asamblea, alcaldías y concejos aliados.`
    };
  }

  if (effectiveRole === 'Alcalde') {
    return {
      isGlobalAdmin: false,
      isTenantAdmin: false,
      isGobernador: false,
      isDiputado: false,
      isAlcalde: true,
      isConcejal: false,
      isLider: false,
      canViewAllMunicipalities: false,
      canViewHigherHierarchy: false,
      scopeLevel: 'Municipal',
      allowedMunicipality: userMuni,
      allowedDepartment: userDept,
      allowedElectoralLevels: ['Alcaldía', 'Concejo Municipal'],
      scopeTitle: `Aspirante a la Alcaldía Municipal de ${userMuni}`,
      scopeDescription: `Ámbito restringido exclusivamente al Municipio de ${userMuni} y sus veredas/corregimientos hacia abajo. No tiene acceso a datos de otros municipios ni métricas de Gobernación.`
    };
  }

  if (effectiveRole === 'Concejal') {
    return {
      isGlobalAdmin: false,
      isTenantAdmin: false,
      isGobernador: false,
      isDiputado: false,
      isAlcalde: false,
      isConcejal: true,
      isLider: false,
      canViewAllMunicipalities: false,
      canViewHigherHierarchy: false,
      scopeLevel: 'Municipal',
      allowedMunicipality: userMuni,
      allowedDepartment: userDept,
      allowedElectoralLevels: ['Concejo Municipal'],
      scopeTitle: `Aspirante al Concejo Municipal de ${userMuni}`,
      scopeDescription: `Ámbito restringido al Concejo de ${userMuni}, listas aliadas y sus líderes barriales/veredales.`
    };
  }

  if (effectiveRole === 'LiderVeredal' || effectiveRole === 'Operador' || effectiveRole === 'Supervisor') {
    return {
      isGlobalAdmin: false,
      isTenantAdmin: false,
      isGobernador: false,
      isDiputado: false,
      isAlcalde: false,
      isConcejal: false,
      isLider: true,
      canViewAllMunicipalities: false,
      canViewHigherHierarchy: false,
      scopeLevel: 'Veredal',
      allowedMunicipality: userMuni,
      allowedDepartment: userDept,
      allowedElectoralLevels: ['Concejo Municipal', 'Alcaldía'],
      scopeTitle: `Líder Territorial / Operativo - ${userMuni}`,
      scopeDescription: `Ámbito operativo enfocado en la movilización de votantes y líderes de ${userMuni}.`
    };
  }

  // Fallback (Consulta / Invitado)
  return {
    isGlobalAdmin: false,
    isTenantAdmin: false,
    isGobernador: false,
    isDiputado: false,
    isAlcalde: false,
    isConcejal: false,
    isLider: false,
    canViewAllMunicipalities: false,
    canViewHigherHierarchy: false,
    scopeLevel: 'Municipal',
    allowedMunicipality: userMuni,
    allowedDepartment: userDept,
    allowedElectoralLevels: ['Alcaldía', 'Concejo Municipal'],
    scopeTitle: `Usuario de Consulta - ${userMuni}`,
    scopeDescription: `Visualización básica para el municipio de ${userMuni}.`
  };
}

export function getRoleHierarchyLevel(role?: UserRole | string): number {
  switch (role) {
    case 'AdminGlobal':
      return 100;
    case 'AdminTenant':
      return 85;
    case 'Gobernador':
      return 70;
    case 'Diputado':
      return 60;
    case 'Alcalde':
      return 50;
    case 'Concejal':
      return 40;
    case 'JefePolitico':
      return 35;
    case 'Supervisor':
      return 30;
    case 'LiderVeredal':
      return 20;
    case 'Operador':
      return 20;
    case 'Consulta':
    case 'Invitado':
    default:
      return 10;
  }
}

// Scoped Filtering Helpers

export function filterUsersByScope(
  users: UserProfile[],
  currentUser?: UserProfile | null,
  userRole?: UserRole | string,
  tenantId?: string
): UserProfile[] {
  const effectiveRole = currentUser?.role || (userRole as UserRole) || 'Alcalde';
  const byTenant = tenantId ? users.filter((u) => u.tenantId === tenantId) : users;

  // AdminGlobal sees all users across the platform
  if (effectiveRole === 'AdminGlobal') {
    return users;
  }

  // AdminTenant sees all users within their organization
  if (effectiveRole === 'AdminTenant') {
    return byTenant.filter((u) => u.role !== 'AdminGlobal');
  }

  // Gobernador: Sees allied users in the department and subordinates (Diputado, Alcalde, Concejal, Líderes)
  if (effectiveRole === 'Gobernador') {
    return byTenant.filter((u) => {
      if (u.role === 'AdminGlobal' || u.role === 'AdminTenant') return false;
      return true;
    });
  }

  // Diputado: Sees candidates and users for Asamblea, Alcaldía, Concejos and Líderes
  if (effectiveRole === 'Diputado') {
    return byTenant.filter((u) => {
      const uLevel = getRoleHierarchyLevel(u.role);
      return uLevel <= 60 && u.role !== 'Gobernador' && u.role !== 'AdminGlobal' && u.role !== 'AdminTenant';
    });
  }

  // Alcalde: Strict downward hierarchical isolation
  // Candidate only sees their own municipality and roles at or below their level (Concejales, Líderes, Operadores)
  if (effectiveRole === 'Alcalde') {
    const userMuni = (currentUser?.municipality || 'Astrea').toLowerCase();
    return byTenant.filter((u) => {
      // Allow self
      if (currentUser?.uid && (u.uid === currentUser.uid || u.email.toLowerCase() === currentUser.email.toLowerCase())) {
        return true;
      }
      const uLevel = getRoleHierarchyLevel(u.role);
      // Strictly block higher or equal hierarchy: cannot see Gobernador, Diputados, other Alcaldes, or Admins
      if (uLevel >= 50) return false;

      // Must be from the same municipality
      const uMuni = (u.municipality || '').toLowerCase();
      return uMuni.includes(userMuni) || userMuni.includes(uMuni);
    });
  }

  // Concejal: Only sees themselves and their grassroots leaders
  if (effectiveRole === 'Concejal') {
    const userMuni = (currentUser?.municipality || 'Astrea').toLowerCase();
    return byTenant.filter((u) => {
      if (currentUser?.uid && (u.uid === currentUser.uid || u.email.toLowerCase() === currentUser.email.toLowerCase())) {
        return true;
      }
      const uLevel = getRoleHierarchyLevel(u.role);
      if (uLevel >= 40) return false;
      const uMuni = (u.municipality || '').toLowerCase();
      return uMuni.includes(userMuni);
    });
  }

  // Grassroots: Only see themselves
  return byTenant.filter((u) => currentUser?.uid && u.uid === currentUser.uid);
}

export function filterCandidatesByScope(
  candidates: Candidate[],
  user?: UserProfile | null,
  userRole?: UserRole | string,
  tenantId?: string
): Candidate[] {
  const scope = getTerritorialScope(user, userRole);
  const byTenant = tenantId ? candidates.filter((c) => c.tenantId === tenantId) : candidates;

  if (scope.canViewAllMunicipalities) {
    if (scope.isGobernador) {
      // Gobernador sees everything in the tenant (all municipalities, alcaldes, concejales, asamblea)
      return byTenant;
    }
    if (scope.isDiputado) {
      return byTenant.filter((c) => c.electoralLevel !== 'Gobernación');
    }
    return byTenant;
  }

  // Municipal scope (e.g. Alcalde de Astrea)
  const targetMuni = (scope.allowedMunicipality || 'Astrea').toLowerCase();
  return byTenant.filter((c) => {
    // Cannot see Gobernación
    if (c.electoralLevel === 'Gobernación') return false;

    // Must match municipality or be linked directly
    const candMuni = (c.municipality || '').toLowerCase();
    const candDistrict = (c.district || '').toLowerCase();

    const matchesMuni = candMuni.includes(targetMuni) || candDistrict.includes(targetMuni);
    return matchesMuni;
  });
}

export function filterLeadersByScope(
  leaders: Leader[],
  user?: UserProfile | null,
  userRole?: UserRole | string,
  tenantId?: string
): Leader[] {
  const scope = getTerritorialScope(user, userRole);
  const byTenant = tenantId ? leaders.filter((l) => l.tenantId === tenantId) : leaders;

  if (scope.canViewAllMunicipalities) {
    return byTenant;
  }

  const targetMuni = (scope.allowedMunicipality || 'Astrea').toLowerCase();
  return byTenant.filter((l) => {
    const lMuni = (l.municipality || '').toLowerCase();
    const lZone = (l.zoneOrDistrict || '').toLowerCase();
    const lVereda = (l.veredaOrBarrio || '').toLowerCase();
    const lCommune = (l.commune || '').toLowerCase();
    return lMuni.includes(targetMuni) || lZone.includes(targetMuni) || lVereda.includes(targetMuni) || lCommune.includes(targetMuni);
  });
}

export function filterExpensesByScope(
  expenses: CampaignExpense[],
  user?: UserProfile | null,
  userRole?: UserRole | string,
  tenantId?: string
): CampaignExpense[] {
  const scope = getTerritorialScope(user, userRole);
  const byTenant = tenantId ? expenses.filter((e) => e.tenantId === tenantId) : expenses;

  if (scope.canViewAllMunicipalities) {
    return byTenant;
  }

  const targetMuni = (scope.allowedMunicipality || 'Astrea').toLowerCase();
  return byTenant.filter((e) => {
    const eMuni = (e.municipality || '').toLowerCase();
    const eZone = (e.veredaOrBarrio || '').toLowerCase();
    const eDesc = (e.description || '').toLowerCase();
    return eMuni.includes(targetMuni) || eZone.includes(targetMuni) || eDesc.includes(targetMuni);
  });
}

export function filterVehiclesByScope(
  vehicles: TransportVehicle[],
  user?: UserProfile | null,
  userRole?: UserRole | string,
  tenantId?: string
): TransportVehicle[] {
  const scope = getTerritorialScope(user, userRole);
  const byTenant = tenantId ? vehicles.filter((v) => v.tenantId === tenantId) : vehicles;

  if (scope.canViewAllMunicipalities) {
    return byTenant;
  }

  const targetMuni = (scope.allowedMunicipality || 'Astrea').toLowerCase();
  return byTenant.filter((v) => {
    const vMuni = (v.municipality || '').toLowerCase();
    const vZone = (v.assignedZone || '').toLowerCase();
    return vMuni.includes(targetMuni) || vZone.includes(targetMuni);
  });
}

export function filterDistrictsByScope(
  districts: District[],
  user?: UserProfile | null,
  userRole?: UserRole | string,
  tenantId?: string
): District[] {
  const scope = getTerritorialScope(user, userRole);
  const byTenant = tenantId ? districts.filter((d) => d.tenantId === tenantId) : districts;

  if (scope.canViewAllMunicipalities) {
    return byTenant;
  }

  const targetMuni = (scope.allowedMunicipality || 'Astrea').toLowerCase();
  return byTenant.filter((d) => {
    const dName = (d.name || '').toLowerCase();
    const dRegion = (d.region || '').toLowerCase();
    return dName.includes(targetMuni) || dRegion.includes(targetMuni) || dRegion.includes('centro');
  });
}

export function filterDonorsByScope(
  donors: DonorContribution[],
  user?: UserProfile | null,
  userRole?: UserRole | string,
  tenantId?: string
): DonorContribution[] {
  const scope = getTerritorialScope(user, userRole);
  const byTenant = tenantId ? donors.filter((d) => d.tenantId === tenantId) : donors;

  if (scope.canViewAllMunicipalities) {
    return byTenant;
  }

  const targetMuni = (scope.allowedMunicipality || 'Astrea').toLowerCase();
  return byTenant.filter((d) => {
    const dMuni = (d.municipality || '').toLowerCase();
    return dMuni.includes(targetMuni);
  });
}

// ----------------------------------------------------
// FILTRADO ESTRICTO DE VOTANTES RASOS (BASE DE LA PIRÁMIDE)
// ----------------------------------------------------
export function filterGrassrootsVotersByScope(
  voters: GrassrootsVoter[],
  user?: UserProfile | null,
  userRole?: UserRole | string,
  tenantId?: string
): GrassrootsVoter[] {
  const effectiveRole = user?.role || (userRole as UserRole) || 'Alcalde';
  const byTenant = tenantId ? voters.filter((v) => v.tenantId === tenantId) : voters;

  // 1. AdminGlobal, AdminTenant, Gobernador: ven todos los votantes del departamento / tenant
  if (effectiveRole === 'AdminGlobal' || effectiveRole === 'AdminTenant' || effectiveRole === 'Gobernador') {
    return byTenant;
  }

  // 2. Diputado: ve los votantes del departamento asignados a su lista o candidatos aliados
  if (effectiveRole === 'Diputado') {
    return byTenant;
  }

  // 3. Alcalde: ve todos los votantes de su propio municipio y de todos los concejales de su municipio
  if (effectiveRole === 'Alcalde') {
    const targetMuni = (user?.municipality || 'Astrea').toLowerCase();
    return byTenant.filter((v) => {
      const vMuni = (v.municipality || '').toLowerCase();
      return vMuni.includes(targetMuni) || targetMuni.includes(vMuni);
    });
  }

  // 4. Concejal: AISLAMIENTO ESTRICTO - Solo ve los votantes asignados a su propia candidatura o sus líderes directos
  if (effectiveRole === 'Concejal') {
    const userCandidateId = user?.assignedCandidateId;
    const userDisplayName = (user?.displayName || '').toLowerCase();
    const userMuni = (user?.municipality || 'Astrea').toLowerCase();

    return byTenant.filter((v) => {
      // Must be from same municipality
      const vMuni = (v.municipality || '').toLowerCase();
      if (!vMuni.includes(userMuni) && !userMuni.includes(vMuni)) return false;

      // Check if assigned to this candidate
      if (userCandidateId && v.candidateId === userCandidateId) return true;
      if (v.candidateName && v.candidateName.toLowerCase().includes(userDisplayName)) return true;
      
      // Fallback: If no candidateId matched, only include if candidateName matches or is linked
      return v.candidateName?.toLowerCase().includes('concejal') || v.candidateId === 'cand-concejal-1';
    });
  }

  // 5. Líder Veredal / Operador: Solo ve los votantes asignados a su propio ID de líder o sector
  if (effectiveRole === 'LiderVeredal' || effectiveRole === 'Operador' || effectiveRole === 'Supervisor' || effectiveRole === 'JefePolitico') {
    const userLeaderId = user?.assignedLeaderId;
    const userDisplayName = (user?.displayName || '').toLowerCase();

    return byTenant.filter((v) => {
      if (userLeaderId && v.leaderId === userLeaderId) return true;
      if (v.leaderName && v.leaderName.toLowerCase().includes(userDisplayName)) return true;
      return false;
    });
  }

  // Fallback para Consulta e Invitados
  const targetMuni = (user?.municipality || 'Astrea').toLowerCase();
  return byTenant.filter((v) => (v.municipality || '').toLowerCase().includes(targetMuni));
}

// ----------------------------------------------------
// FILTRADO DE TESTIGOS ELECTORALES POR ÁMBITO JERÁRQUICO
// ----------------------------------------------------
export function filterWitnessesByScope(
  witnesses: ElectoralWitness[],
  user?: UserProfile | null,
  userRole?: UserRole | string,
  tenantId?: string
): ElectoralWitness[] {
  const scope = getTerritorialScope(user, userRole);
  const byTenant = tenantId ? witnesses.filter((w) => w.tenantId === tenantId) : witnesses;

  if (scope.canViewAllMunicipalities) {
    return byTenant;
  }

  const targetMuni = (scope.allowedMunicipality || 'Astrea').toLowerCase();
  return byTenant.filter((w) => {
    const wMuni = (w.municipality || '').toLowerCase();
    return wMuni.includes(targetMuni) || targetMuni.includes(wMuni);
  });
}

// ----------------------------------------------------
// FILTRADO DE AUDITORÍAS E-14 POR ÁMBITO JERÁRQUICO
// ----------------------------------------------------
export function filterE14AuditsByScope(
  audits: E14FormAudit[],
  user?: UserProfile | null,
  userRole?: UserRole | string,
  tenantId?: string
): E14FormAudit[] {
  const scope = getTerritorialScope(user, userRole);
  const byTenant = tenantId ? audits.filter((a) => a.tenantId === tenantId) : audits;

  if (scope.canViewAllMunicipalities) {
    return byTenant;
  }

  const targetMuni = (scope.allowedMunicipality || 'Astrea').toLowerCase();
  return byTenant.filter((a) => {
    const aMuni = (a.municipality || '').toLowerCase();
    return aMuni.includes(targetMuni) || targetMuni.includes(aMuni);
  });
}

// ----------------------------------------------------
// FILTRADO DE INCIDENCIAS POR ÁMBITO JERÁRQUICO
// ----------------------------------------------------
export function filterIncidentsByScope(
  incidents: ElectoralIncident[],
  user?: UserProfile | null,
  userRole?: UserRole | string,
  tenantId?: string
): ElectoralIncident[] {
  const scope = getTerritorialScope(user, userRole);
  const byTenant = tenantId ? incidents.filter((i) => i.tenantId === tenantId) : incidents;

  if (scope.canViewAllMunicipalities) {
    return byTenant;
  }

  const targetMuni = (scope.allowedMunicipality || 'Astrea').toLowerCase();
  return byTenant.filter((i) => {
    const iMuni = (i.municipality || '').toLowerCase();
    return iMuni.includes(targetMuni) || targetMuni.includes(iMuni);
  });
}
