import React, { useState, useMemo, useEffect } from 'react';
import { 
  Candidate, 
  Leader, 
  GrassrootsVoter, 
  UserProfile, 
  UserRole,
  Tenant,
  SectorVolumeSummary
} from '../types';
import { 
  Crown, 
  Building, 
  Users, 
  UserCheck, 
  MapPin, 
  ChevronRight, 
  Plus, 
  Search, 
  Filter, 
  Download, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle2, 
  Sparkles, 
  ArrowUpRight, 
  Layers, 
  Phone, 
  Eye, 
  Car,
  ChevronDown,
  Landmark,
  Trees,
  Home,
  ShieldCheck,
  Compass
} from 'lucide-react';
import { getTerritorialScope } from '../lib/permissions';
import { getTerritoriosRurales, COLOMBIA_ELECTORAL_GEOGRAPHY, RuralTerritoryItem } from '../data/colombiaElectoralData';

interface ElectoralHierarchyRollupViewProps {
  candidates: Candidate[];
  leaders: Leader[];
  grassrootsVoters: GrassrootsVoter[];
  currentUser?: UserProfile | null;
  userRole?: UserRole;
  currentTenant?: Tenant;
  onAddVoter: (voter: GrassrootsVoter) => void;
  onAddLeader?: (leader: Leader) => void;
}

export const ElectoralHierarchyRollupView: React.FC<ElectoralHierarchyRollupViewProps> = ({
  candidates,
  leaders,
  grassrootsVoters,
  currentUser,
  userRole = 'Alcalde',
  currentTenant,
  onAddVoter,
  onAddLeader
}) => {
  // Determine territorial scope and municipal jurisdiction
  const scope = useMemo(() => getTerritorialScope(currentUser, userRole), [currentUser, userRole]);

  // Resolves the exact municipality associated with the current tenant and user
  const tenantMunicipality = useMemo(() => {
    if (scope.allowedMunicipality && scope.allowedMunicipality.trim()) {
      return scope.allowedMunicipality.trim();
    }
    if (currentUser?.municipality && currentUser.municipality.trim()) {
      return currentUser.municipality.trim();
    }
    const tName = (currentTenant?.name || '').toLowerCase();
    const tId = (currentTenant?.tenantId || '').toLowerCase();
    if (tName.includes('astrea') || tId.includes('astrea')) return 'Astrea';
    if (tName.includes('el paso') || tId.includes('el-paso') || tId.includes('elpaso')) return 'El Paso';
    if (tName.includes('bosconia') || tId.includes('bosconia')) return 'Bosconia';
    if (tName.includes('valledupar') || tId.includes('valledupar')) return 'Valledupar';
    if (tName.includes('chiriguaná') || tName.includes('chiriguana') || tId.includes('chiriguana')) return 'Chiriguaná';
    if (tName.includes('aguachica') || tId.includes('aguachica')) return 'Aguachica';
    if (tName.includes('codazzi') || tId.includes('codazzi')) return 'Agustín Codazzi';
    if (tName.includes('jagua') || tId.includes('jagua')) return 'La Jagua de Ibirico';
    return 'Astrea';
  }, [scope, currentUser, currentTenant]);

  const isAlcalde = userRole === 'Alcalde' || currentUser?.role === 'Alcalde' || scope.isAlcalde;
  const isConcejal = userRole === 'Concejal' || currentUser?.role === 'Concejal' || scope.isConcejal;
  const isLocalMunicipal = isAlcalde || isConcejal || !scope.canViewAllMunicipalities;

  // Selected municipality for departamental roles; local roles (Alcalde/Concejal) are strictly locked
  const [selectedMunicipality, setSelectedMunicipality] = useState<string>(isLocalMunicipal ? tenantMunicipality : 'all');
  const effectiveMunicipality = isLocalMunicipal ? tenantMunicipality : (selectedMunicipality === 'all' ? 'Astrea' : selectedMunicipality);

  useEffect(() => {
    if (isLocalMunicipal) {
      setSelectedMunicipality(tenantMunicipality);
    }
  }, [isLocalMunicipal, tenantMunicipality]);

  // Dual Territorial Selectors:
  // 1: Mode/Type ('todos' | 'corregimientos' | 'veredas' | 'barrios')
  const [territorialFilterType, setTerritorialFilterType] = useState<'todos' | 'corregimientos' | 'veredas' | 'barrios'>('todos');
  // 2: Specific territory name ('todos' or specific name)
  const [selectedTerritory, setSelectedTerritory] = useState<string>('todos');

  // Concejal candidacy filter
  const [councilFilterMyVotesOnly, setCouncilFilterMyVotesOnly] = useState<boolean>(false);

  // Navigation & Drilldown States
  const [selectedHierarchyTier, setSelectedHierarchyTier] = useState<
    'all' | 'Gobernacion' | 'Asamblea' | 'Alcaldia' | 'Concejo' | 'Lideres' | 'Votantes'
  >('all');
  const [selectedCandidateId, setSelectedCandidateId] = useState<string>('all');
  const [selectedLeaderId, setSelectedLeaderId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Registration Modal State
  const [isRegisterVoterOpen, setIsRegisterVoterOpen] = useState<boolean>(false);
  const [newVoterName, setNewVoterName] = useState('');
  const [newVoterDoc, setNewVoterDoc] = useState('');
  const [newVoterPhone, setNewVoterPhone] = useState('');
  const [newVoterMun, setNewVoterMun] = useState(tenantMunicipality);
  const [newVoterSector, setNewVoterSector] = useState('');
  const [modalSectorType, setModalSectorType] = useState<'corregimiento' | 'vereda' | 'barrio' | 'manual'>('corregimiento');
  const [newVoterPollingStation, setNewVoterPollingStation] = useState('');
  const [newVoterTable, setNewVoterTable] = useState<number>(1);
  const [newVoterLeaderId, setNewVoterLeaderId] = useState('');
  const [newVoterCandidateId, setNewVoterCandidateId] = useState('');
  const [newVoterSupportLevel, setNewVoterSupportLevel] = useState<1 | 2 | 3 | 4 | 5>(5);
  const [newVoterTransport, setNewVoterTransport] = useState(false);
  const [newVoterNotes, setNewVoterNotes] = useState('');
  const [newVoterConsent, setNewVoterConsent] = useState(false);

  useEffect(() => {
    setNewVoterMun(tenantMunicipality);
  }, [tenantMunicipality]);

  // Load Corregimientos and Veredas for effective municipality
  const ruralData = useMemo(() => {
    return getTerritoriosRurales(effectiveMunicipality);
  }, [effectiveMunicipality]);

  const corregimientos = ruralData.corregimientos;
  const veredas = ruralData.veredas;

  // Load Barrios for effective municipality
  const barrios = useMemo(() => {
    const dpto = COLOMBIA_ELECTORAL_GEOGRAPHY['Cesar'];
    const munKey = Object.keys(dpto?.municipios || {}).find(
      (k) => k.toLowerCase() === effectiveMunicipality.toLowerCase()
    );
    const munData = munKey ? dpto.municipios[munKey] : null;
    return munData?.barriosYComunas || [
      'Barrio Centro (Cabecera)',
      'Barrio 20 de Julio',
      'Barrio San José',
      'Barrio El Carmen',
      'Barrio La Esperanza',
      'Barrio Simón Bolívar',
      'Barrio El Paraíso'
    ];
  }, [effectiveMunicipality]);

  // Extract Governor candidate (Top of hierarchy)
  const governorCandidate = useMemo(() => {
    return candidates.find(c => c.electoralLevel === 'Gobernación') || candidates[0];
  }, [candidates]);

  // Extract Assembly / Diputados candidates
  const assemblyCandidates = useMemo(() => {
    return candidates.filter(c => c.electoralLevel === 'Asamblea / Diputación');
  }, [candidates]);

  // Extract Mayoral candidates (filtered to municipality for local roles)
  const mayoralCandidates = useMemo(() => {
    return candidates.filter(c => {
      if (c.electoralLevel !== 'Alcaldía') return false;
      if (isLocalMunicipal && c.municipality) {
        return c.municipality.toLowerCase() === tenantMunicipality.toLowerCase();
      }
      return true;
    });
  }, [candidates, isLocalMunicipal, tenantMunicipality]);

  // Extract Concejo candidates (filtered to municipality for local roles)
  const councilCandidates = useMemo(() => {
    return candidates.filter(c => {
      if (c.electoralLevel !== 'Concejo Municipal') return false;
      if (isLocalMunicipal && c.municipality) {
        return c.municipality.toLowerCase() === tenantMunicipality.toLowerCase();
      }
      return true;
    });
  }, [candidates, isLocalMunicipal, tenantMunicipality]);

  // My Concejal candidate for Concejal profile
  const myCouncilCandidate = useMemo(() => {
    if (!isConcejal) return null;
    return councilCandidates.find(c => 
      (currentUser?.uid && c.id.includes(currentUser.uid)) ||
      (currentUser?.displayName && c.fullName.toLowerCase().includes(currentUser.displayName.toLowerCase()))
    ) || councilCandidates[0] || null;
  }, [isConcejal, councilCandidates, currentUser]);

  // Municipalities list
  const municipalities = useMemo(() => {
    if (isLocalMunicipal) {
      return [tenantMunicipality];
    }
    const set = new Set<string>();
    candidates.forEach(c => {
      if (c.municipality && !c.municipality.includes('Todo el Departamento')) {
        set.add(c.municipality);
      }
    });
    leaders.forEach(l => {
      if (l.municipality) set.add(l.municipality);
    });
    grassrootsVoters.forEach(v => {
      if (v.municipality) set.add(v.municipality);
    });
    return Array.from(set);
  }, [isLocalMunicipal, tenantMunicipality, candidates, leaders, grassrootsVoters]);

  // Dynamic Hierarchical Roll-Up Metrics
  const hierarchicalMetrics = useMemo(() => {
    // Total Grassroots voters in system
    const totalGrassroots = grassrootsVoters.length;
    
    // Aggregated votes by Leader
    const leaderVoteMap = new Map<string, number>();
    grassrootsVoters.forEach(v => {
      if (v.leaderId) {
        leaderVoteMap.set(v.leaderId, (leaderVoteMap.get(v.leaderId) || 0) + 1);
      }
    });

    // Aggregated votes by Concejal
    const councilVoteMap = new Map<string, number>();
    grassrootsVoters.forEach(v => {
      if (v.candidateId) {
        councilVoteMap.set(v.candidateId, (councilVoteMap.get(v.candidateId) || 0) + 1);
      }
    });

    // Aggregated votes by Municipality (Alcaldía)
    const municipalityVoteMap = new Map<string, number>();
    grassrootsVoters.forEach(v => {
      if (v.municipality) {
        municipalityVoteMap.set(v.municipality, (municipalityVoteMap.get(v.municipality) || 0) + 1);
      }
    });

    // Department total
    const departmentTotalVotes = grassrootsVoters.length;

    return {
      totalGrassroots,
      leaderVoteMap,
      councilVoteMap,
      municipalityVoteMap,
      departmentTotalVotes
    };
  }, [grassrootsVoters]);

  // Sector Breakdown (Veredas / Corregimientos / Barrios) seeded with canonical geography
  const sectorSummaries = useMemo<SectorVolumeSummary[]>(() => {
    const sectorMap = new Map<string, {
      sector: string;
      municipality: string;
      voters: number;
      leaders: Set<string>;
      category: 'Corregimiento' | 'Vereda' | 'Barrio';
    }>();

    // 1. Seed canonical corregimientos
    corregimientos.forEach(c => {
      const key = `${effectiveMunicipality} - ${c.name}`;
      sectorMap.set(key, {
        sector: c.fullName || `${c.name} (Corregimiento)`,
        municipality: effectiveMunicipality,
        voters: 0,
        leaders: new Set(),
        category: 'Corregimiento'
      });
    });

    // 2. Seed canonical veredas
    veredas.forEach(v => {
      const key = `${effectiveMunicipality} - ${v.name}`;
      sectorMap.set(key, {
        sector: v.fullName || `${v.name} (Vereda)`,
        municipality: effectiveMunicipality,
        voters: 0,
        leaders: new Set(),
        category: 'Vereda'
      });
    });

    // 3. Seed canonical barrios
    barrios.forEach(b => {
      const key = `${effectiveMunicipality} - ${b}`;
      sectorMap.set(key, {
        sector: b,
        municipality: effectiveMunicipality,
        voters: 0,
        leaders: new Set(),
        category: 'Barrio'
      });
    });

    // 4. Map grassroots voters
    grassrootsVoters.forEach(v => {
      if (isLocalMunicipal && v.municipality && v.municipality.toLowerCase() !== effectiveMunicipality.toLowerCase()) {
        return;
      }
      const vMun = v.municipality || effectiveMunicipality;
      let foundKey: string | null = null;
      for (const [key, entry] of sectorMap.entries()) {
        if (entry.municipality.toLowerCase() === vMun.toLowerCase()) {
          const sLower = v.sector?.toLowerCase() || '';
          if (sLower && (entry.sector.toLowerCase().includes(sLower) || sLower.includes(entry.sector.toLowerCase()) || sLower.includes(entry.sector.split(' ')[0].toLowerCase()))) {
            foundKey = key;
            break;
          }
        }
      }

      if (foundKey) {
        const entry = sectorMap.get(foundKey)!;
        entry.voters += 1;
        if (v.leaderId) entry.leaders.add(v.leaderId);
      } else if (v.sector) {
        const customKey = `${vMun} - ${v.sector}`;
        if (!sectorMap.has(customKey)) {
          sectorMap.set(customKey, {
            sector: v.sector,
            municipality: vMun,
            voters: 1,
            leaders: new Set(v.leaderId ? [v.leaderId] : []),
            category: v.sector.toLowerCase().includes('corregimiento') ? 'Corregimiento' : v.sector.toLowerCase().includes('vereda') ? 'Vereda' : 'Barrio'
          });
        } else {
          const entry = sectorMap.get(customKey)!;
          entry.voters += 1;
          if (v.leaderId) entry.leaders.add(v.leaderId);
        }
      }
    });

    // 5. Map leaders
    leaders.forEach(l => {
      if (l.veredaOrBarrio) {
        const lMun = l.municipality || effectiveMunicipality;
        for (const [_, entry] of sectorMap.entries()) {
          if (entry.municipality.toLowerCase() === lMun.toLowerCase()) {
            if (entry.sector.toLowerCase().includes(l.veredaOrBarrio.toLowerCase()) || l.veredaOrBarrio.toLowerCase().includes(entry.sector.split(' ')[0].toLowerCase())) {
              entry.leaders.add(l.id);
            }
          }
        }
      }
    });

    return Array.from(sectorMap.values()).map(item => {
      const baseTarget = item.category === 'Corregimiento' ? 450 : item.category === 'Barrio' ? 350 : 180;
      const target = item.leaders.size > 0 ? Math.max(baseTarget, item.leaders.size * 60) : baseTarget;
      const coveragePct = Math.min(100, Math.round((item.voters / Math.max(1, target)) * 100));
      let status: SectorVolumeSummary['status'] = 'Requiere Refuerzo';
      if (coveragePct >= 100) status = 'Meta Superada';
      else if (coveragePct >= 70) status = 'En Rango';
      else if (coveragePct < 25) status = 'Crítico';

      return {
        sector: item.sector,
        municipality: item.municipality,
        voterCensus: target * 3,
        targetVotes: target,
        committedVotes: item.voters,
        leadersCount: item.leaders.size,
        coveragePct,
        status
      };
    });
  }, [corregimientos, veredas, barrios, effectiveMunicipality, isLocalMunicipal, grassrootsVoters, leaders]);

  // Filtered Sector Summaries
  const filteredSectorSummaries = useMemo(() => {
    return sectorSummaries.filter(sec => {
      // Municipal filter
      if (isLocalMunicipal) {
        if (sec.municipality.toLowerCase() !== tenantMunicipality.toLowerCase()) return false;
      } else if (selectedMunicipality !== 'all') {
        if (sec.municipality.toLowerCase() !== selectedMunicipality.toLowerCase()) return false;
      }

      // Territory specific filter
      if (selectedTerritory !== 'todos') {
        const target = selectedTerritory.toLowerCase();
        if (!sec.sector.toLowerCase().includes(target)) return false;
      } else {
        // Mode filter
        if (territorialFilterType === 'corregimientos') {
          const isCorr = corregimientos.some(c => sec.sector.toLowerCase().includes(c.name.toLowerCase()));
          if (!isCorr && !sec.sector.toLowerCase().includes('corregimiento')) return false;
        } else if (territorialFilterType === 'veredas') {
          const isVer = veredas.some(v => sec.sector.toLowerCase().includes(v.name.toLowerCase()));
          if (!isVer && !sec.sector.toLowerCase().includes('vereda')) return false;
        } else if (territorialFilterType === 'barrios') {
          const isBarrio = barrios.some(b => sec.sector.toLowerCase().includes(b.toLowerCase()));
          if (!isBarrio && !sec.sector.toLowerCase().includes('barrio')) return false;
        }
      }

      return true;
    });
  }, [sectorSummaries, isLocalMunicipal, tenantMunicipality, selectedMunicipality, selectedTerritory, territorialFilterType, corregimientos, veredas, barrios]);

  // Filtered Voters for Table
  const filteredVoters = useMemo(() => {
    return grassrootsVoters.filter(voter => {
      // Municipal scope
      if (isLocalMunicipal) {
        if (voter.municipality && voter.municipality.toLowerCase() !== tenantMunicipality.toLowerCase()) {
          return false;
        }
      } else if (selectedMunicipality !== 'all' && voter.municipality !== selectedMunicipality) {
        return false;
      }

      // Concejal filter
      if (isConcejal && councilFilterMyVotesOnly && myCouncilCandidate) {
        if (voter.candidateId !== myCouncilCandidate.id) return false;
      }

      if (selectedCandidateId !== 'all' && voter.candidateId !== selectedCandidateId) return false;
      if (selectedLeaderId !== 'all' && voter.leaderId !== selectedLeaderId) return false;

      // Territory filter
      const textToMatch = `${voter.sector || ''} ${voter.pollingStation || ''} ${voter.notes || ''}`.toLowerCase();
      if (selectedTerritory !== 'todos') {
        if (!textToMatch.includes(selectedTerritory.toLowerCase())) return false;
      } else {
        if (territorialFilterType === 'corregimientos') {
          const matchCorr = corregimientos.some(c => textToMatch.includes(c.name.toLowerCase()) || textToMatch.includes('corregimiento'));
          if (!matchCorr) return false;
        } else if (territorialFilterType === 'veredas') {
          const matchVer = veredas.some(v => textToMatch.includes(v.name.toLowerCase()) || textToMatch.includes('vereda'));
          if (!matchVer) return false;
        } else if (territorialFilterType === 'barrios') {
          const matchBarrio = barrios.some(b => textToMatch.includes(b.toLowerCase()) || textToMatch.includes('barrio'));
          if (!matchBarrio) return false;
        }
      }

      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      const doc = (voter as any).documentNumber || (voter as any).documentId || '';
      return (
        voter.fullName.toLowerCase().includes(q) ||
        doc.toLowerCase().includes(q) ||
        voter.sector.toLowerCase().includes(q) ||
        voter.pollingStation.toLowerCase().includes(q) ||
        voter.leaderName.toLowerCase().includes(q) ||
        voter.candidateName.toLowerCase().includes(q)
      );
    });
  }, [
    grassrootsVoters, 
    isLocalMunicipal, 
    tenantMunicipality, 
    selectedMunicipality, 
    isConcejal, 
    councilFilterMyVotesOnly, 
    myCouncilCandidate, 
    selectedCandidateId, 
    selectedLeaderId, 
    selectedTerritory, 
    territorialFilterType, 
    corregimientos, 
    veredas, 
    barrios, 
    searchQuery
  ]);

  // Handle Submit New Voter
  const handleCreateVoter = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVoterName.trim() || !newVoterDoc.trim() || !newVoterSector.trim() || !newVoterConsent) {
      alert('Complete los datos obligatorios y confirme la autorización para el tratamiento de datos.');
      return;
    }

    const assignedLeader = leaders.find(l => l.id === newVoterLeaderId);
    const assignedCandidate = candidates.find(c => c.id === newVoterCandidateId);

    const newVoter: GrassrootsVoter = {
      id: `votante-${Date.now()}`,
      tenantId: currentUser?.tenantId || '',
      fullName: newVoterName.trim(),
      documentNumber: newVoterDoc.trim(),
      phone: newVoterPhone.trim() || 'No registrada',
      department: 'Cesar',
      municipality: newVoterMun,
      sector: newVoterSector.trim(),
      pollingStation: newVoterPollingStation.trim() || 'Puesto Cabecera Municipal',
      tableNumber: Number(newVoterTable) || 1,
      leaderId: newVoterLeaderId || (assignedLeader?.id || 'lider-general'),
      leaderName: assignedLeader?.fullName || 'Líder Barrial Asignado',
      candidateId: newVoterCandidateId || (assignedCandidate?.id || 'candidato-general'),
      candidateName: assignedCandidate ? `${assignedCandidate.fullName} (${assignedCandidate.chamber})` : 'Candidato General',
      supportLevel: newVoterSupportLevel,
      requiresTransport: newVoterTransport,
      notes: newVoterNotes.trim(),
      registeredAt: new Date().toISOString(),
      verified: false,
      consentGiven: true,
      consentAt: new Date().toISOString(),
      dataSource: 'Directo'
    };

    onAddVoter(newVoter);
    setIsRegisterVoterOpen(false);

    // Reset fields
    setNewVoterName('');
    setNewVoterDoc('');
    setNewVoterPhone('');
    setNewVoterSector('');
    setNewVoterPollingStation('');
    setNewVoterNotes('');
    setNewVoterConsent(false);
  };

  // Export CSV
  const handleExportCSV = () => {
    const headers = ['Nombre', 'Cédula', 'Municipio', 'Sector', 'Puesto', 'Mesa', 'Líder', 'Candidato', 'Compromiso', 'Transporte', 'Fecha'];
    const rows = filteredVoters.map(v => [
      `"${v.fullName}"`,
      `"${v.documentNumber}"`,
      `"${v.municipality}"`,
      `"${v.sector}"`,
      `"${v.pollingStation}"`,
      v.tableNumber,
      `"${v.leaderName}"`,
      `"${v.candidateName}"`,
      `${v.supportLevel}/5`,
      v.requiresTransport ? 'Sí' : 'No',
      `"${v.registeredAt.split('T')[0]}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Padron_Electoral_Jerarquico_${selectedMunicipality}_2026.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/20 border border-emerald-500/30 rounded-full text-emerald-300 text-xs font-semibold uppercase tracking-wider">
              <Layers className="w-3.5 h-3.5" />
              Arquitectura Electoral Piramidal (Bottom-Up Rollup)
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
              Jerarquía Electoral, Líderes & Volumen de Votos
            </h1>
            <p className="text-slate-300 text-sm max-w-3xl leading-relaxed">
              El flujo de datos se alimenta desde el <strong className="text-emerald-300">Votante Raso en territorio</strong>, consolidándose en tiempo real hacia los <strong className="text-white">Líderes</strong>, <strong className="text-white">Concejales</strong>, <strong className="text-white">Alcaldes</strong>, <strong className="text-white">Diputados de Asamblea</strong> y <strong className="text-white">Gobernación</strong>.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              id="btn-register-grassroots-voter"
              onClick={() => setIsRegisterVoterOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-900/30 transition-all cursor-pointer hover:scale-[1.02]"
            >
              <Plus className="w-4 h-4" />
              + Registrar Votante Fidelizado
            </button>

            <button
              onClick={handleExportCSV}
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4" />
              Exportar Padrón
            </button>
          </div>
        </div>

        {/* Rollup KPI Metrics Tailored to Jurisdiction */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-6 pt-6 border-t border-slate-800/80">
          {isConcejal ? (
            <>
              <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Mi Curul Concejo</span>
                  <Users className="w-3.5 h-3.5 text-blue-400" />
                </div>
                <p className="text-base font-bold text-white mt-1 truncate">
                  {myCouncilCandidate?.fullName || 'Aspirante Concejo'}
                </p>
                <span className="text-[10px] text-blue-300 font-medium">{effectiveMunicipality}</span>
              </div>

              <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Votos Comprometidos</span>
                  <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                </div>
                <p className="text-lg font-bold text-emerald-400 mt-1">
                  {(myCouncilCandidate?.votesCommitted || 0) + (myCouncilCandidate ? (hierarchicalMetrics.councilVoteMap.get(myCouncilCandidate.id) || 0) : 0)}
                </p>
                <span className="text-[10px] text-emerald-300 font-medium">Fidelizados Directos</span>
              </div>

              <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Meta Electoral</span>
                  <TrendingUp className="w-3.5 h-3.5 text-indigo-400" />
                </div>
                <p className="text-lg font-bold text-white mt-1">
                  {(myCouncilCandidate?.voteTarget || 1200).toLocaleString()}
                </p>
                <span className="text-[10px] text-indigo-300 font-medium">Umbral estimado</span>
              </div>

              <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Mis Líderes</span>
                  <Users className="w-3.5 h-3.5 text-amber-400" />
                </div>
                <p className="text-lg font-bold text-white mt-1">
                  {leaders.filter(l => !l.municipality || l.municipality.toLowerCase() === effectiveMunicipality.toLowerCase()).length}
                </p>
                <span className="text-[10px] text-amber-300 font-medium">En campo y veredas</span>
              </div>

              <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-3 col-span-2 sm:col-span-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Avance Meta</span>
                  <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                </div>
                <p className="text-lg font-bold text-cyan-400 mt-1">
                  {Math.min(100, Math.round((((myCouncilCandidate?.votesCommitted || 0) + (myCouncilCandidate ? (hierarchicalMetrics.councilVoteMap.get(myCouncilCandidate.id) || 0) : 0)) / (myCouncilCandidate?.voteTarget || 1200)) * 100))}%
                </p>
                <span className="text-[10px] text-slate-300 font-medium">Hacia la curul</span>
              </div>
            </>
          ) : isAlcalde ? (
            <>
              <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Alcaldía Municipal</span>
                  <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                </div>
                <p className="text-base font-bold text-white mt-1 truncate">
                  {mayoralCandidates[0]?.fullName || `Campaña ${effectiveMunicipality}`}
                </p>
                <span className="text-[10px] text-emerald-300 font-medium">{effectiveMunicipality}</span>
              </div>

              <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Concejo Aliado</span>
                  <Users className="w-3.5 h-3.5 text-blue-400" />
                </div>
                <p className="text-lg font-bold text-white mt-1">
                  {councilCandidates.length}
                </p>
                <span className="text-[10px] text-blue-300 font-medium">Candidatos sumando</span>
              </div>

              <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Líderes en Territorio</span>
                  <UserCheck className="w-3.5 h-3.5 text-indigo-400" />
                </div>
                <p className="text-lg font-bold text-white mt-1">
                  {leaders.filter(l => !l.municipality || l.municipality.toLowerCase() === effectiveMunicipality.toLowerCase()).length}
                </p>
                <span className="text-[10px] text-indigo-300 font-medium">Corregimientos & Veredas</span>
              </div>

              <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Micro-Territorios</span>
                  <Trees className="w-3.5 h-3.5 text-amber-400" />
                </div>
                <p className="text-lg font-bold text-white mt-1">
                  {corregimientos.length + veredas.length}
                </p>
                <span className="text-[10px] text-amber-300 font-medium">{corregimientos.length} corr. / {veredas.length} ver.</span>
              </div>

              <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-3 col-span-2 sm:col-span-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Votantes Consolidados</span>
                  <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                </div>
                <p className="text-lg font-bold text-emerald-400 mt-1">
                  {filteredVoters.length}
                </p>
                <span className="text-[10px] text-slate-300 font-medium">En {effectiveMunicipality}</span>
              </div>
            </>
          ) : (
            <>
              <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Gobernación</span>
                  <Crown className="w-3.5 h-3.5 text-amber-400" />
                </div>
                <p className="text-lg font-bold text-white mt-1">
                  {(governorCandidate.votesCommitted || 0) + hierarchicalMetrics.totalGrassroots}
                </p>
                <span className="text-[10px] text-emerald-400 font-medium">Consolidado Dptal.</span>
              </div>

              <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Asamblea</span>
                  <Building className="w-3.5 h-3.5 text-indigo-400" />
                </div>
                <p className="text-lg font-bold text-white mt-1">
                  {assemblyCandidates.reduce((acc, c) => acc + (c.votesCommitted || 0), 0) + hierarchicalMetrics.totalGrassroots}
                </p>
                <span className="text-[10px] text-indigo-300 font-medium">{assemblyCandidates.length} Candidatos</span>
              </div>

              <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Alcaldías</span>
                  <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                </div>
                <p className="text-lg font-bold text-white mt-1">
                  {mayoralCandidates.reduce((acc, c) => acc + (c.votesCommitted || 0), 0) + hierarchicalMetrics.totalGrassroots}
                </p>
                <span className="text-[10px] text-emerald-300 font-medium">{mayoralCandidates.length} Municipios</span>
              </div>

              <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Concejales</span>
                  <Users className="w-3.5 h-3.5 text-blue-400" />
                </div>
                <p className="text-lg font-bold text-white mt-1">
                  {councilCandidates.reduce((acc, c) => acc + (c.votesCommitted || 0), 0) + hierarchicalMetrics.totalGrassroots}
                </p>
                <span className="text-[10px] text-blue-300 font-medium">{councilCandidates.length} Aspirantes</span>
              </div>

              <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-3 col-span-2 sm:col-span-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Votantes Rasos</span>
                  <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                </div>
                <p className="text-lg font-bold text-emerald-400 mt-1">
                  {grassrootsVoters.length}
                </p>
                <span className="text-[10px] text-slate-300 font-medium">{leaders.length} Líderes en Campo</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Visual Interactive Hierarchy Pyramid */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5 shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-400" />
              Pirámide de Mando & Arrastre de Volumen Electoral
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {isConcejal
                ? `Estructura piramidal de tu curul en ${effectiveMunicipality}: Líderes Barriales/Veredales consolidando hacia tu elección.`
                : isAlcalde
                ? `Estructura piramidal municipal de ${effectiveMunicipality}: Votantes en territorio sumando a Concejales y Alcaldía.`
                : 'Haz clic en cualquier nivel para desplegar los detalles y ver cómo los votos de cada concejal y líder suman verticalmente.'}
            </p>
          </div>

          {/* Quick Filter Buttons adapted to role */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-thin">
            <button
              onClick={() => { setSelectedHierarchyTier('all'); }}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                selectedHierarchyTier === 'all' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              Todos los Niveles
            </button>
            {!isLocalMunicipal && (
              <>
                <button
                  onClick={() => setSelectedHierarchyTier('Gobernacion')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    selectedHierarchyTier === 'Gobernacion' ? 'bg-amber-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  👑 Gobernación
                </button>
                <button
                  onClick={() => setSelectedHierarchyTier('Asamblea')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    selectedHierarchyTier === 'Asamblea' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  🏛️ Asamblea
                </button>
              </>
            )}
            <button
              onClick={() => setSelectedHierarchyTier('Alcaldia')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                selectedHierarchyTier === 'Alcaldia' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              🏛️ Alcaldía
            </button>
            <button
              onClick={() => setSelectedHierarchyTier('Concejo')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                selectedHierarchyTier === 'Concejo' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              👥 Concejales
            </button>
            <button
              onClick={() => setSelectedHierarchyTier('Votantes')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                selectedHierarchyTier === 'Votantes' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              🗳️ Votantes Rasos
            </button>
          </div>
        </div>

        {/* Pyramid Graphic Rows */}
        <div className="space-y-3 pt-2">
          {/* LEVEL 1: Gobernación (Peak) */}
          {(selectedHierarchyTier === 'all' || selectedHierarchyTier === 'Gobernacion') && (
            <div className="bg-gradient-to-r from-amber-950/40 via-slate-800/80 to-amber-950/40 border border-amber-500/40 rounded-2xl p-4 transition-all hover:border-amber-400 shadow-md">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                    <Crown className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        Nivel Superior: Gobernación del Cesar
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-white mt-1">
                      {governorCandidate.fullName} <span className="text-xs text-slate-400">({governorCandidate.party})</span>
                    </h3>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <span className="text-xs text-slate-400">Meta Dptal: {governorCandidate.voteTarget?.toLocaleString()} votos</span>
                    <p className="text-base font-extrabold text-amber-400">
                      {((governorCandidate.votesCommitted || 0) + hierarchicalMetrics.totalGrassroots).toLocaleString()} votos consolidados
                    </p>
                  </div>
                  <div className="w-28 bg-slate-700 rounded-full h-2.5 overflow-hidden">
                    <div 
                      className="bg-amber-400 h-2.5 rounded-full" 
                      style={{ width: `${Math.min(100, Math.round((((governorCandidate.votesCommitted || 0) + hierarchicalMetrics.totalGrassroots) / (governorCandidate.voteTarget || 1)) * 100))}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* LEVEL 2: Asamblea / Diputados */}
          {(selectedHierarchyTier === 'all' || selectedHierarchyTier === 'Asamblea') && (
            <div className="bg-gradient-to-r from-indigo-950/40 via-slate-800/80 to-indigo-950/40 border border-indigo-500/40 rounded-2xl p-4 transition-all hover:border-indigo-400">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
                    <Building className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                        Nivel Departamental: Lista a la Asamblea
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-white mt-1">
                      {assemblyCandidates.map(c => c.fullName).join(', ') || 'Lista de Diputados'}
                    </h3>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <span className="text-xs text-slate-400">Sinergia con Gobernación</span>
                    <p className="text-base font-extrabold text-indigo-400">
                      {assemblyCandidates.reduce((a, c) => a + (c.votesCommitted || 0), 0) + hierarchicalMetrics.totalGrassroots} votos
                    </p>
                  </div>
                  <span className="text-xs px-2.5 py-1 bg-indigo-500/20 text-indigo-300 rounded-lg font-bold border border-indigo-500/30">
                    {assemblyCandidates.length} Curules en disputa
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* LEVEL 3: Alcaldías Municipales */}
          {(selectedHierarchyTier === 'all' || selectedHierarchyTier === 'Alcaldia') && (
            <div className="space-y-2">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between px-2">
                <span>Nivel Municipal: Candidatos a Alcaldías ({mayoralCandidates.length})</span>
                <span className="text-emerald-400">Arrastre hacia Gobernación & Asamblea</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                {mayoralCandidates.map((mayor) => {
                  const munVoters = grassrootsVoters.filter(v => v.municipality === mayor.municipality).length;
                  const totalCommitted = (mayor.votesCommitted || 0) + munVoters;
                  const target = mayor.voteTarget || 10000;
                  const pct = Math.min(100, Math.round((totalCommitted / target) * 100));

                  return (
                    <div 
                      key={mayor.id}
                      onClick={() => { setSelectedMunicipality(mayor.municipality); setSelectedCandidateId(mayor.id); }}
                      className={`bg-slate-800/80 border rounded-xl p-4 transition-all cursor-pointer hover:border-emerald-500 ${
                        selectedMunicipality === mayor.municipality ? 'border-emerald-500 ring-1 ring-emerald-500/50 bg-slate-800' : 'border-slate-700'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="text-[10px] font-bold uppercase text-emerald-400">{mayor.municipality}</span>
                          <h4 className="text-xs font-bold text-white mt-0.5">{mayor.fullName}</h4>
                        </div>
                        <span className="text-xs font-extrabold text-white">{pct}%</span>
                      </div>

                      <div className="mt-3 space-y-1.5">
                        <div className="flex items-center justify-between text-[11px] text-slate-400">
                          <span>Votos: {totalCommitted.toLocaleString()}</span>
                          <span>Meta: {target.toLocaleString()}</span>
                        </div>
                        <div className="w-full bg-slate-700 rounded-full h-1.5 overflow-hidden">
                          <div className="bg-emerald-400 h-1.5 rounded-full" style={{ width: `${pct}%` }}></div>
                        </div>
                        <p className="text-[10px] text-slate-400 pt-1">
                          {grassrootsVoters.filter(v => v.municipality === mayor.municipality).length} votantes registrados desde la base
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* LEVEL 4: Concejales Municipales */}
          {(selectedHierarchyTier === 'all' || selectedHierarchyTier === 'Concejo') && (
            <div className="space-y-2 pt-2">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between px-2">
                <span>Nivel Corporación: Concejales & Listas Abiertas ({councilCandidates.length})</span>
                <span className="text-blue-400">Alimentan Alcaldía & Asamblea</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {councilCandidates.map((council) => {
                  const directVoters = grassrootsVoters.filter(v => v.candidateId === council.id).length;
                  const total = (council.votesCommitted || 0) + directVoters;
                  const target = council.voteTarget || 1200;
                  const pct = Math.min(100, Math.round((total / target) * 100));

                  return (
                    <div 
                      key={council.id}
                      onClick={() => { setSelectedCandidateId(council.id); if (council.municipality) setSelectedMunicipality(council.municipality); }}
                      className={`bg-slate-800/60 border rounded-xl p-3.5 transition-all cursor-pointer hover:border-blue-500 ${
                        selectedCandidateId === council.id ? 'border-blue-500 ring-1 ring-blue-500/50 bg-slate-800' : 'border-slate-700/80'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300">
                              {council.municipality}
                            </span>
                            {council.veredaOrBarrio && (
                              <span className="text-[9px] text-slate-400">{council.veredaOrBarrio}</span>
                            )}
                          </div>
                          <h4 className="text-xs font-bold text-white mt-1">{council.fullName}</h4>
                        </div>
                        <span className="text-xs font-bold text-blue-400">{total} votos</span>
                      </div>

                      <div className="mt-2.5 pt-2 border-t border-slate-700/60 flex items-center justify-between text-[10px] text-slate-300">
                        <span>Meta Curul: {target}</span>
                        <span className="text-emerald-400 font-semibold">{directVoters} votantes rasos directos</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sectorial Breakdown Table (Veredas, Corregimientos & Barrios) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5 shadow-lg">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                <MapPin className="w-5 h-5 text-indigo-400" />
                Distribución Territorial por Corregimientos, Veredas & Barrios
              </h2>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-[11px] font-semibold text-indigo-300">
                <Landmark className="w-3 h-3" />
                {effectiveMunicipality} ({currentTenant?.name || currentTenant?.tenantId || 'Tenant Activo'})
              </span>
            </div>
            <p className="text-xs text-slate-400">
              {isLocalMunicipal
                ? `Jurisdicción aislada para ${userRole}: visualizando exclusivamente corregimientos, veredas y sectores de ${effectiveMunicipality}.`
                : 'Monitoreo predictivo de metas de votos comprometidos por cada micro-sector geográfico del departamento.'}
            </p>
          </div>

          {/* Dual Territorial Filters (Filtro 1: Modo/Tipo y Filtro 2: Selector Asistido) */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            {/* Si es Departamental, selector de municipio */}
            {!isLocalMunicipal && (
              <div className="flex items-center gap-1.5 bg-slate-800/80 border border-slate-700 rounded-xl px-2.5 py-1">
                <Compass className="w-3.5 h-3.5 text-slate-400" />
                <select
                  value={selectedMunicipality}
                  onChange={(e) => {
                    setSelectedMunicipality(e.target.value);
                    setSelectedTerritory('todos');
                  }}
                  className="bg-transparent text-xs text-white focus:outline-none cursor-pointer"
                >
                  <option value="all" className="bg-slate-900">Todos los Municipios (Cesar)</option>
                  {municipalities.map(m => (
                    <option key={m} value={m} className="bg-slate-900">{m}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Concejal Curul Filter Toggle */}
            {isConcejal && myCouncilCandidate && (
              <button
                type="button"
                onClick={() => setCouncilFilterMyVotesOnly(!councilFilterMyVotesOnly)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer flex items-center gap-1.5 ${
                  councilFilterMyVotesOnly
                    ? 'bg-blue-600/20 border-blue-500/50 text-blue-300 shadow-sm'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                }`}
              >
                <Users className="w-3.5 h-3.5 text-blue-400" />
                {councilFilterMyVotesOnly ? 'Votos de mi Curul' : 'Todos los Votos'}
              </button>
            )}

            {/* FILTRO 1: Selector de Modo / Tipo de Territorio */}
            <div className="inline-flex items-center p-0.5 bg-slate-800 border border-slate-700 rounded-xl">
              <button
                type="button"
                onClick={() => {
                  setTerritorialFilterType('todos');
                  setSelectedTerritory('todos');
                }}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-all cursor-pointer ${
                  territorialFilterType === 'todos'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Todos
              </button>
              <button
                type="button"
                onClick={() => {
                  setTerritorialFilterType('corregimientos');
                  setSelectedTerritory('todos');
                }}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                  territorialFilterType === 'corregimientos'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Trees className="w-3 h-3" />
                Corregimientos ({corregimientos.length})
              </button>
              <button
                type="button"
                onClick={() => {
                  setTerritorialFilterType('veredas');
                  setSelectedTerritory('todos');
                }}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                  territorialFilterType === 'veredas'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                🌾 Veredas ({veredas.length})
              </button>
              <button
                type="button"
                onClick={() => {
                  setTerritorialFilterType('barrios');
                  setSelectedTerritory('todos');
                }}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                  territorialFilterType === 'barrios'
                    ? 'bg-cyan-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Home className="w-3 h-3" />
                Barrios ({barrios.length})
              </button>
            </div>

            {/* FILTRO 2: Selector Asistido Específico de Corregimientos / Veredas / Barrios */}
            <div className="relative min-w-[220px]">
              <select
                value={selectedTerritory}
                onChange={(e) => setSelectedTerritory(e.target.value)}
                className="w-full bg-slate-800 border border-indigo-500/40 text-xs text-white rounded-xl px-3 py-1.5 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 cursor-pointer font-medium"
              >
                {territorialFilterType === 'todos' && (
                  <>
                    <option value="todos">Todos los Sectores ({effectiveMunicipality})</option>
                    {corregimientos.length > 0 && (
                      <optgroup label={`🌲 Corregimientos de ${effectiveMunicipality} (${corregimientos.length})`}>
                        {corregimientos.map(c => (
                          <option key={`corr-${c.name}`} value={c.name}>
                            {c.name} {c.codeDane ? `(DANE: ${c.codeDane})` : ''}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {veredas.length > 0 && (
                      <optgroup label={`🌾 Veredas de ${effectiveMunicipality} (${veredas.length})`}>
                        {veredas.map(v => (
                          <option key={`ver-${v.name}`} value={v.name}>{v.name}</option>
                        ))}
                      </optgroup>
                    )}
                    {barrios.length > 0 && (
                      <optgroup label={`🏘️ Barrios Urbanos de ${effectiveMunicipality} (${barrios.length})`}>
                        {barrios.map(b => (
                          <option key={`bar-${b}`} value={b}>{b}</option>
                        ))}
                      </optgroup>
                    )}
                  </>
                )}

                {territorialFilterType === 'corregimientos' && (
                  <>
                    <option value="todos">Todos los Corregimientos de {effectiveMunicipality} ({corregimientos.length})</option>
                    {corregimientos.map(c => (
                      <option key={`corr-only-${c.name}`} value={c.name}>
                        {c.name} {c.codeDane ? `(DANE: ${c.codeDane})` : ''}
                      </option>
                    ))}
                  </>
                )}

                {territorialFilterType === 'veredas' && (
                  <>
                    <option value="todos">Todas las Veredas de {effectiveMunicipality} ({veredas.length})</option>
                    {veredas.map(v => (
                      <option key={`ver-only-${v.name}`} value={v.name}>{v.name}</option>
                    ))}
                  </>
                )}

                {territorialFilterType === 'barrios' && (
                  <>
                    <option value="todos">Todos los Barrios Urbanos de {effectiveMunicipality} ({barrios.length})</option>
                    {barrios.map(b => (
                      <option key={`bar-only-${b}`} value={b}>{b}</option>
                    ))}
                  </>
                )}
              </select>
            </div>
          </div>
        </div>

        {/* Sectors Grid/Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredSectorSummaries.length === 0 ? (
            <div className="col-span-full py-8 text-center text-slate-500 bg-slate-800/30 rounded-2xl border border-slate-800">
              <MapPin className="w-6 h-6 mx-auto mb-2 text-slate-600" />
              <p className="text-xs">No se encontraron sectores para los filtros seleccionados en {effectiveMunicipality}.</p>
            </div>
          ) : (
            filteredSectorSummaries.map((sec, idx) => {
              const isCorr = corregimientos.some(c => sec.sector.toLowerCase().includes(c.name.toLowerCase()));
              const isVer = veredas.some(v => sec.sector.toLowerCase().includes(v.name.toLowerCase()));
              const categoryLabel = isCorr ? 'Corregimiento' : isVer ? 'Vereda' : 'Barrio';
              const categoryColor = isCorr ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' : isVer ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30';

              return (
                <div key={idx} className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-4 space-y-3 hover:border-indigo-500/50 transition-all">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">{sec.municipality}</span>
                        <span className={`text-[9px] font-semibold px-1.5 py-0.2 rounded border ${categoryColor}`}>
                          {categoryLabel}
                        </span>
                      </div>
                      <h4 className="text-xs font-bold text-white mt-0.5">{sec.sector}</h4>
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                      sec.status === 'Meta Superada'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                        : sec.status === 'En Rango'
                        ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                        : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                    }`}>
                      {sec.status}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Fidelizados: <strong className="text-white">{sec.committedVotes}</strong></span>
                      <span className="text-slate-400">Meta: <strong className="text-slate-200">{sec.targetVotes}</strong></span>
                    </div>
                    <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
                      <div 
                        className={`h-2 rounded-full ${sec.coveragePct >= 70 ? 'bg-emerald-400' : 'bg-amber-400'}`} 
                        style={{ width: `${Math.min(100, sec.coveragePct)}%` }}
                      ></div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-700/50">
                    <span>{sec.leadersCount} Líderes en este sector</span>
                    <span className="text-emerald-400 font-semibold">{sec.coveragePct}% avance</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Grassroots Voter Registry Table (Base de la Pirámide) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-emerald-400" />
              Padrón de Votantes Rasos Fidelizados ({filteredVoters.length})
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Registro nominal de campo ingresado por líderes y concejales con georreferenciación, puesto y mesa.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por nombre, cédula o sector..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <button
              onClick={() => setIsRegisterVoterOpen(true)}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              Nuevo Votante
            </button>
          </div>
        </div>

        {/* Table Container */}
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-800/90 text-[11px] uppercase font-bold text-slate-400 border-b border-slate-700">
              <tr>
                <th className="p-3.5">Votante Raso</th>
                <th className="p-3.5">Ubicación / Sector</th>
                <th className="p-3.5">Puesto & Mesa</th>
                <th className="p-3.5">Líder Responsable</th>
                <th className="p-3.5">Candidato / Concejo</th>
                <th className="p-3.5 text-center">Fidelización</th>
                <th className="p-3.5 text-center">Transporte</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredVoters.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    No se encontraron votantes con los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                filteredVoters.map((voter) => (
                  <tr key={voter.id} className="hover:bg-slate-800/50 transition-colors">
                    <td className="p-3.5">
                      <p className="font-bold text-white">{voter.fullName}</p>
                      <p className="text-[11px] text-slate-400 font-mono">{voter.documentNumber}</p>
                      {voter.phone && voter.phone !== 'No registrada' && (
                        <p className="text-[10px] text-emerald-400 flex items-center gap-1 mt-0.5">
                          <Phone className="w-2.5 h-2.5" />
                          {voter.phone}
                        </p>
                      )}
                    </td>

                    <td className="p-3.5">
                      <span className="text-[10px] uppercase font-semibold text-slate-400">{voter.municipality}</span>
                      <p className="text-xs text-slate-200 font-medium">{voter.sector}</p>
                    </td>

                    <td className="p-3.5">
                      <p className="text-xs text-slate-200">{voter.pollingStation}</p>
                      <span className="text-[10px] px-2 py-0.5 bg-slate-800 border border-slate-700 rounded text-indigo-300 font-bold inline-block mt-0.5">
                        Mesa #{voter.tableNumber}
                      </span>
                    </td>

                    <td className="p-3.5">
                      <p className="font-medium text-slate-200">{voter.leaderName}</p>
                    </td>

                    <td className="p-3.5">
                      <p className="font-medium text-indigo-300">{voter.candidateName}</p>
                    </td>

                    <td className="p-3.5 text-center">
                      <div className="flex items-center justify-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <span 
                            key={star} 
                            className={`text-xs ${star <= voter.supportLevel ? 'text-amber-400' : 'text-slate-600'}`}
                          >
                            ★
                          </span>
                        ))}
                      </div>
                    </td>

                    <td className="p-3.5 text-center">
                      {voter.requiresTransport ? (
                        <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold">
                          <Car className="w-3 h-3" />
                          Requiere
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-500">No</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Register Grassroots Voter Modal */}
      {isRegisterVoterOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <UserCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Registrar Votante Fidelizado</h3>
                  <p className="text-[11px] text-slate-400">Alimentación directa a la pirámide de votos</p>
                </div>
              </div>
              <button
                onClick={() => setIsRegisterVoterOpen(false)}
                className="w-7 h-7 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateVoter} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-300">Nombre Completo *</label>
                  <input
                    type="text"
                    required
                    placeholder="Nombre y apellidos"
                    value={newVoterName}
                    onChange={(e) => setNewVoterName(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-300">Cédula de Ciudadanía *</label>
                  <input
                    type="text"
                    required
                    placeholder="Tipo y número de documento"
                    value={newVoterDoc}
                    onChange={(e) => setNewVoterDoc(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-300">Teléfono / Celular</label>
                  <input
                    type="tel"
                    placeholder="Número con código de país"
                    value={newVoterPhone}
                    onChange={(e) => setNewVoterPhone(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-semibold text-slate-300">Municipio *</label>
                    {isLocalMunicipal && (
                      <span className="text-[10px] text-amber-400 font-bold flex items-center gap-1">
                        🔒 Bloqueado por Jurisdicción
                      </span>
                    )}
                  </div>
                  {isLocalMunicipal ? (
                    <div className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-emerald-400 font-bold flex items-center justify-between">
                      <span>{effectiveMunicipality}</span>
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded font-mono">
                        {currentTenant?.tenantId || 'Tenant Local'}
                      </span>
                    </div>
                  ) : (
                    <select
                      value={newVoterMun}
                      onChange={(e) => {
                        setNewVoterMun(e.target.value);
                      }}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                    >
                      {municipalities.map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              {/* Selector Asistido de Sector / Corregimiento / Vereda */}
              <div className="space-y-2 bg-slate-800/40 p-3 rounded-xl border border-slate-700/60">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-slate-300 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-indigo-400" />
                    Seleccionar Corregimiento, Vereda o Barrio ({effectiveMunicipality}) *
                  </label>
                  <span className="text-[10px] text-indigo-300 font-medium">Asistido</span>
                </div>

                <select
                  value={newVoterSector}
                  onChange={(e) => {
                    const val = e.target.value;
                    setNewVoterSector(val);
                    if (val && !newVoterPollingStation) {
                      setNewVoterPollingStation(`Puesto Electoral ${val}`);
                    }
                  }}
                  className="w-full bg-slate-800 border border-indigo-500/40 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-400"
                >
                  <option value="">-- Seleccionar Corregimiento o Vereda Oficial --</option>
                  {corregimientos.length > 0 && (
                    <optgroup label={`🌲 Corregimientos Oficiales (${corregimientos.length})`}>
                      {corregimientos.map(c => (
                        <option key={`modal-corr-${c.name}`} value={`Corregimiento ${c.name}`}>
                          Corregimiento {c.name} {c.codeDane ? `(DANE: ${c.codeDane})` : ''}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {veredas.length > 0 && (
                    <optgroup label={`🌾 Veredas Oficiales (${veredas.length})`}>
                      {veredas.map(v => (
                        <option key={`modal-ver-${v.name}`} value={`Vereda ${v.name}`}>
                          Vereda {v.name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {barrios.length > 0 && (
                    <optgroup label={`🏘️ Barrios Urbanos (${barrios.length})`}>
                      {barrios.map(b => (
                        <option key={`modal-bar-${b}`} value={`Barrio ${b}`}>
                          Barrio {b}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <div>
                    <label className="text-[10px] text-slate-400">O especificar manualmente:</label>
                    <input
                      type="text"
                      placeholder="Ej. Vereda El Cascajo Sector La Mina"
                      value={newVoterSector}
                      onChange={(e) => setNewVoterSector(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400">Puesto de Votación asignado:</label>
                    <input
                      type="text"
                      placeholder="Nombre del puesto / I.E."
                      value={newVoterPollingStation}
                      onChange={(e) => setNewVoterPollingStation(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-300">Número de Mesa</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={newVoterTable}
                    onChange={(e) => setNewVoterTable(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-300">Nivel de Compromiso</label>
                  <select
                    value={newVoterSupportLevel}
                    onChange={(e) => setNewVoterSupportLevel(Number(e.target.value) as any)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value={5}>★★★★★ 5 - Totalmente Seguro</option>
                    <option value={4}>★★★★☆ 4 - Muy Favorable</option>
                    <option value={3}>★★★☆☆ 3 - Favorable con Seguimiento</option>
                    <option value={2}>★★☆☆☆ 2 - Indeciso</option>
                    <option value={1}>★☆☆☆☆ 1 - En Conquista</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-300">Líder Responsable en {effectiveMunicipality}</label>
                  <select
                    value={newVoterLeaderId}
                    onChange={(e) => setNewVoterLeaderId(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="">Seleccionar Líder</option>
                    {leaders
                      .filter(l => !isLocalMunicipal || !l.municipality || l.municipality.toLowerCase() === effectiveMunicipality.toLowerCase())
                      .map(l => (
                        <option key={l.id} value={l.id}>{l.fullName} ({l.municipality || 'Territorial'})</option>
                      ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-300">Candidato Concejo / Campaña</label>
                  <select
                    value={newVoterCandidateId}
                    onChange={(e) => setNewVoterCandidateId(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="">Seleccionar Candidato</option>
                    {candidates
                      .filter(c => !isLocalMunicipal || !c.municipality || c.municipality.toLowerCase() === effectiveMunicipality.toLowerCase())
                      .map(c => (
                        <option key={c.id} value={c.id}>{c.fullName} ({c.chamber} - {c.municipality || 'Dptal'})</option>
                      ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="voter-transport-check"
                  checked={newVoterTransport}
                  onChange={(e) => setNewVoterTransport(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-800 text-emerald-600 focus:ring-emerald-500"
                />
                <label htmlFor="voter-transport-check" className="text-xs text-slate-300 cursor-pointer">
                  ¿Requiere vehículo / transporte asignado el Día D?
                </label>
              </div>

              <label className="flex items-start gap-3 rounded-2xl border border-cyan-500/25 bg-cyan-500/[0.06] p-3 text-[11px] leading-relaxed text-slate-300">
                <input
                  type="checkbox"
                  required
                  checked={newVoterConsent}
                  onChange={(e) => setNewVoterConsent(e.target.checked)}
                  className="mt-0.5 rounded border-slate-600 bg-slate-800 text-cyan-500 focus:ring-cyan-500"
                />
                <span><strong className="text-white">Autorización obligatoria:</strong> confirmo que la persona fue informada de la finalidad del registro, autorizó el tratamiento de sus datos y conoce cómo solicitar su consulta, corrección o eliminación.</span>
              </label>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-300">Observaciones / Compromisos</label>
                <textarea
                  rows={2}
                  placeholder="Notas sobre apoyo familiar, necesidad especial o contacto..."
                  value={newVoterNotes}
                  onChange={(e) => setNewVoterNotes(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsRegisterVoterOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-900/30 transition-colors cursor-pointer"
                >
                  Guardar en Pirámide
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
