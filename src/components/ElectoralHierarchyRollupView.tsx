import { createRecordId } from '../lib/recordIds';
import { FormSaveStatus, useFirestoreForm } from './FormSaveStatus';
import React, { useState, useMemo } from 'react';
import {
  Candidate,
  Leader,
  GrassrootsVoter,
  UserProfile,
  UserRole,
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
  ChevronDown
} from 'lucide-react';

interface ElectoralHierarchyRollupViewProps {
  candidates: Candidate[];
  leaders: Leader[];
  grassrootsVoters: GrassrootsVoter[];
  currentUser?: UserProfile | null;
  userRole?: UserRole;
  onAddVoter: (voter: GrassrootsVoter) => Promise<void>;
  onAddLeader?: (leader: Leader) => Promise<void>;
}

export const ElectoralHierarchyRollupView: React.FC<ElectoralHierarchyRollupViewProps> = ({
  candidates,
  leaders,
  grassrootsVoters,
  currentUser,
  userRole = 'Alcalde',
  onAddVoter,
  onAddLeader
}) => {
  // Navigation & Drilldown States
  const { saving, saveError, submit, runSave } = useFirestoreForm();
  const [selectedHierarchyTier, setSelectedHierarchyTier] = useState<
    'all' | 'Gobernacion' | 'Asamblea' | 'Alcaldia' | 'Concejo' | 'Lideres' | 'Votantes'
  >('all');
  const [selectedMunicipality, setSelectedMunicipality] = useState<string>('all');
  const [selectedCandidateId, setSelectedCandidateId] = useState<string>('all');
  const [selectedLeaderId, setSelectedLeaderId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Registration Modal State
  const [isRegisterVoterOpen, setIsRegisterVoterOpen] = useState<boolean>(false);
  const [newVoterName, setNewVoterName] = useState('');
  const [newVoterDoc, setNewVoterDoc] = useState('');
  const [newVoterPhone, setNewVoterPhone] = useState('');
  const [newVoterMun, setNewVoterMun] = useState(currentUser?.municipality || 'Astrea');
  const [newVoterSector, setNewVoterSector] = useState('');
  const [newVoterPollingStation, setNewVoterPollingStation] = useState('');
  const [newVoterTable, setNewVoterTable] = useState<number>(1);
  const [newVoterLeaderId, setNewVoterLeaderId] = useState('');
  const [newVoterCandidateId, setNewVoterCandidateId] = useState('');
  const [newVoterSupportLevel, setNewVoterSupportLevel] = useState<1 | 2 | 3 | 4 | 5>(5);
  const [newVoterTransport, setNewVoterTransport] = useState(false);
  const [newVoterNotes, setNewVoterNotes] = useState('');
  const [newVoterConsent, setNewVoterConsent] = useState(false);

  // Extract Governor candidate (Top of hierarchy)
  const governorCandidate = useMemo(() => {
    return candidates.find(c => c.electoralLevel === 'Gobernación') || candidates[0];
  }, [candidates]);

  // Extract Assembly / Diputados candidates
  const assemblyCandidates = useMemo(() => {
    return candidates.filter(c => c.electoralLevel === 'Asamblea / Diputación');
  }, [candidates]);

  // Extract Mayoral candidates
  const mayoralCandidates = useMemo(() => {
    return candidates.filter(c => c.electoralLevel === 'Alcaldía');
  }, [candidates]);

  // Extract Concejo candidates
  const councilCandidates = useMemo(() => {
    return candidates.filter(c => c.electoralLevel === 'Concejo Municipal');
  }, [candidates]);

  // Municipalities list
  const municipalities = useMemo(() => {
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
  }, [candidates, leaders, grassrootsVoters]);

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

  // Sector Breakdown (Veredas / Barrios)
  const sectorSummaries = useMemo<SectorVolumeSummary[]>(() => {
    const sectorMap = new Map<string, {
      sector: string;
      municipality: string;
      voters: number;
      leaders: Set<string>;
    }>();

    grassrootsVoters.forEach(v => {
      const key = `${v.municipality} - ${v.sector}`;
      if (!sectorMap.has(key)) {
        sectorMap.set(key, {
          sector: v.sector,
          municipality: v.municipality,
          voters: 0,
          leaders: new Set()
        });
      }
      const entry = sectorMap.get(key)!;
      entry.voters += 1;
      if (v.leaderId) entry.leaders.add(v.leaderId);
    });

    // Ensure leaders' sectors are also represented
    leaders.forEach(l => {
      if (l.veredaOrBarrio && l.municipality) {
        const key = `${l.municipality} - ${l.veredaOrBarrio}`;
        if (!sectorMap.has(key)) {
          sectorMap.set(key, {
            sector: l.veredaOrBarrio,
            municipality: l.municipality,
            voters: 0,
            leaders: new Set([l.id])
          });
        } else {
          sectorMap.get(key)!.leaders.add(l.id);
        }
      }
    });

    return Array.from(sectorMap.values()).map(item => {
      const target = item.leaders.size > 0 ? item.leaders.size * 50 : 100;
      const coveragePct = Math.min(100, Math.round((item.voters / Math.max(1, target)) * 100));
      let status: SectorVolumeSummary['status'] = 'Requiere Refuerzo';
      if (coveragePct >= 100) status = 'Meta Superada';
      else if (coveragePct >= 70) status = 'En Rango';
      else if (coveragePct < 30) status = 'Crítico';

      return {
        sector: item.sector,
        municipality: item.municipality,
        voterCensus: target * 4,
        targetVotes: target,
        committedVotes: item.voters,
        leadersCount: item.leaders.size,
        coveragePct,
        status
      };
    });
  }, [grassrootsVoters, leaders]);

  // Filtered Voters for Table
  const filteredVoters = useMemo(() => {
    return grassrootsVoters.filter(voter => {
      if (selectedMunicipality !== 'all' && voter.municipality !== selectedMunicipality) return false;
      if (selectedCandidateId !== 'all' && voter.candidateId !== selectedCandidateId) return false;
      if (selectedLeaderId !== 'all' && voter.leaderId !== selectedLeaderId) return false;
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        voter.fullName.toLowerCase().includes(q) ||
        voter.documentNumber.toLowerCase().includes(q) ||
        voter.sector.toLowerCase().includes(q) ||
        voter.pollingStation.toLowerCase().includes(q) ||
        voter.leaderName.toLowerCase().includes(q) ||
        voter.candidateName.toLowerCase().includes(q)
      );
    });
  }, [grassrootsVoters, selectedMunicipality, selectedCandidateId, selectedLeaderId, searchQuery]);

  // Handle Submit New Voter
  const handleCreateVoter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVoterName.trim() || !newVoterDoc.trim() || !newVoterSector.trim() || !newVoterConsent) {
      alert('Complete los datos obligatorios y confirme la autorización para el tratamiento de datos.');
      return;
    }

    const assignedLeader = leaders.find(l => l.id === newVoterLeaderId);
    const assignedCandidate = candidates.find(c => c.id === newVoterCandidateId);

    const newVoter: GrassrootsVoter = {
      id: createRecordId(currentUser?.tenantId || '', 'votante'),
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

    await onAddVoter(newVoter);
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

        {/* Global Rollup KPI Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-6 pt-6 border-t border-slate-800/80">
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
              Haz clic en cualquier nivel para desplegar los detalles y ver cómo los votos de cada concejal y líder suman verticalmente.
            </p>
          </div>

          {/* Quick Filter Buttons */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-thin">
            <button
              onClick={() => { setSelectedHierarchyTier('all'); setSelectedMunicipality('all'); }}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                selectedHierarchyTier === 'all' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              Todos los Niveles
            </button>
            <button
              onClick={() => setSelectedHierarchyTier('Gobernacion')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                selectedHierarchyTier === 'Gobernacion' ? 'bg-amber-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              👑 Gobernación
            </button>
            <button
              onClick={() => setSelectedHierarchyTier('Alcaldia')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                selectedHierarchyTier === 'Alcaldia' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              🏛️ Alcaldías
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

      {/* Sectorial Breakdown Table (Veredas & Barrios) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              <MapPin className="w-5 h-5 text-indigo-400" />
              Distribución Territorial por Sectores, Veredas & Barrios
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Monitoreo predictivo de metas de votos comprometidos por cada micro-sector geográfico.
            </p>
          </div>

          {/* Municipality Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Filtrar Municipio:</span>
            <select
              value={selectedMunicipality}
              onChange={(e) => setSelectedMunicipality(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-xs text-white rounded-xl px-3 py-1.5 focus:outline-none focus:border-indigo-500"
            >
              <option value="all">Todos los Municipios</option>
              {municipalities.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Sectors Grid/Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {sectorSummaries
            .filter(s => selectedMunicipality === 'all' || s.municipality === selectedMunicipality)
            .map((sec, idx) => (
              <div key={idx} className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">{sec.municipality}</span>
                    <h4 className="text-xs font-bold text-white">{sec.sector}</h4>
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
            ))}
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

            <form onSubmit={event => submit(event, handleCreateVoter)} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto"><FormSaveStatus saving={saving} error={saveError} /><fieldset disabled={saving} className="contents">
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
                  <label className="text-[11px] font-semibold text-slate-300">Municipio *</label>
                  <select
                    value={newVoterMun}
                    onChange={(e) => setNewVoterMun(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                  >
                    {municipalities.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-300">Sector / Vereda / Barrio *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Vereda San Isidro / Arjona"
                    value={newVoterSector}
                    onChange={(e) => setNewVoterSector(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-300">Puesto de Votación</label>
                  <input
                    type="text"
                    placeholder="Nombre del puesto"
                    value={newVoterPollingStation}
                    onChange={(e) => setNewVoterPollingStation(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                  />
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
                  <label className="text-[11px] font-semibold text-slate-300">Líder Responsable</label>
                  <select
                    value={newVoterLeaderId}
                    onChange={(e) => setNewVoterLeaderId(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="">Seleccionar Líder</option>
                    {leaders.map(l => (
                      <option key={l.id} value={l.id}>{l.fullName} ({l.municipality || 'Dptal'})</option>
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
                    {candidates.map(c => (
                      <option key={c.id} value={c.id}>{c.fullName} ({c.chamber})</option>
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
            </fieldset></form>
          </div>
        </div>
      )}
    </div>
  );
};
