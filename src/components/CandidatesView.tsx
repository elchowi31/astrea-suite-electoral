import React, { useState, useEffect } from 'react';
import { Candidate, Tenant, ElectoralLevel, UserProfile, UserRole } from '../types';
import { getTerritorialScope, filterCandidatesByScope } from '../lib/permissions';
import {
  DEPARTAMENTOS_COLOMBIA,
  getMunicipiosPorDepartamento,
  getSubregionesPorDepartamento,
  getVeredasYBarrios,
  getZonasYPuestosVotacion,
  inferirDatosElectorales
} from '../data/colombiaElectoralData';
import { generarIdDocumentoLegible } from '../lib/slugify';
import {
  Search,
  Plus,
  Filter,
  UserCheck,
  Award,
  Sparkles,
  Building2,
  CheckCircle2,
  X,
  Crown,
  Home,
  MapPin,
  Target,
  Zap,
  Tag,
  Info,
  Users,
  Compass,
  Lock,
  Shield
} from 'lucide-react';

interface CandidatesViewProps {
  currentTenant: Tenant;
  currentUser?: UserProfile | null;
  userRole?: UserRole;
  candidates: Candidate[];
  onAddCandidate: (cand: Candidate) => void;
  onGenerateSpeechForCandidate: (candName: string, district: string, chamber: string) => void;
}

export const CandidatesView: React.FC<CandidatesViewProps> = ({
  currentTenant,
  currentUser = null,
  userRole = 'Alcalde',
  candidates,
  onAddCandidate,
  onGenerateSpeechForCandidate,
}) => {
  const scope = getTerritorialScope(currentUser, userRole);
  const [search, setSearch] = useState('');
  const [selectedLevel, setSelectedLevel] = useState<string>('TODOS');
  const [showModal, setShowModal] = useState(false);

  // Form State (Predictive & Proactive)
  const [fullName, setFullName] = useState('');
  const [electoralLevel, setElectoralLevel] = useState<ElectoralLevel>(scope.allowedElectoralLevels[0] || 'Alcaldía');
  const [department, setDepartment] = useState<string>(scope.allowedDepartment || 'Cesar');
  const [municipality, setMunicipality] = useState<string>(scope.allowedMunicipality || 'Astrea');
  const [veredaOrBarrio, setVeredaOrBarrio] = useState<string>('');
  const [district, setDistrict] = useState<string>(`Subregión Centro - Municipio de ${scope.allowedMunicipality || 'Astrea'}`);
  const [party, setParty] = useState(currentTenant.name);
  const [coalition, setCoalition] = useState('');
  const [bio, setBio] = useState('');
  const [voteTarget, setVoteTarget] = useState<number>(0);
  const [pollingPercentage, setPollingPercentage] = useState<number>(0);
  const [generatedDocId, setGeneratedDocId] = useState<string>('');

  // Dropdown options based on active selection
  const availableMunicipalities = getMunicipiosPorDepartamento(department);
  const veredasYBarriosData = getVeredasYBarrios(department, municipality);
  const availableVeredas = veredasYBarriosData.veredas;
  const availableZonas = getZonasYPuestosVotacion(department, municipality);

  // Scoped Candidates List (Hierarchical RBAC)
  const scopedCandidates = filterCandidatesByScope(candidates, currentUser, userRole, currentTenant.tenantId);

  // Trigger Proactive Auto-fill when electoralLevel, department or municipality changes
  useEffect(() => {
    const infer = inferirDatosElectorales({
      nivel: electoralLevel,
      departamento: department,
      municipio: municipality,
      veredaOrBarrio: veredaOrBarrio
    });

    if (infer.municipioSugerido && electoralLevel === 'Gobernación') {
      setMunicipality(infer.municipioSugerido);
    }
    if (infer.distritoSugerido) {
      setDistrict(infer.distritoSugerido);
    }
  }, [electoralLevel, department, municipality]);

  // Update readable Document ID in real time
  useEffect(() => {
    const id = generarIdDocumentoLegible(
      'candidato',
      fullName || 'nuevo-aspirante',
      electoralLevel,
      municipality || department
    );
    setGeneratedDocId(id);
  }, [fullName, electoralLevel, municipality, department]);

  const filteredCandidates = scopedCandidates.filter((c) => {
    const matchesSearch =
      c.fullName.toLowerCase().includes(search.toLowerCase()) ||
      c.district.toLowerCase().includes(search.toLowerCase()) ||
      (c.municipality && c.municipality.toLowerCase().includes(search.toLowerCase())) ||
      (c.veredaOrBarrio && c.veredaOrBarrio.toLowerCase().includes(search.toLowerCase()));
    const matchesLevel = selectedLevel === 'TODOS' || c.electoralLevel === selectedLevel;
    return matchesSearch && matchesLevel;
  });

  const handleDepartmentChange = (newDept: string) => {
    setDepartment(newDept);
    const munis = getMunicipiosPorDepartamento(newDept);
    if (munis.length > 0) {
      const defaultMuni = munis[0];
      setMunicipality(defaultMuni);
      const veredasInfo = getVeredasYBarrios(newDept, defaultMuni);
      setVeredaOrBarrio(veredasInfo.veredas[0] || '');
    }
  };

  const handleMunicipalityChange = (newMuni: string) => {
    setMunicipality(newMuni);
    const veredasInfo = getVeredasYBarrios(department, newMuni);
    setVeredaOrBarrio(veredasInfo.veredas[0] || '');
  };

  const handleSubmitNewCandidate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !district) return;

    let chamberVal: any = 'Alcalde';
    if (electoralLevel === 'Gobernación') chamberVal = 'Gobernador';
    if (electoralLevel === 'Asamblea / Diputación') chamberVal = 'Diputado / Asamblea';
    if (electoralLevel === 'Concejo Municipal') chamberVal = 'Concejal';
    if (electoralLevel === 'Congreso (Cámara / Senado)') chamberVal = 'Senador';

    const infer = inferirDatosElectorales({
      nivel: electoralLevel,
      departamento: department,
      municipio: municipality,
      veredaOrBarrio: veredaOrBarrio
    });

    const newCand: Candidate = {
      id: generatedDocId || `candidato-${Date.now()}`,
      tenantId: currentTenant.tenantId,
      fullName,
      district,
      chamber: chamberVal,
      electoralLevel,
      department,
      municipality,
      veredaOrBarrio,
      party: party || currentTenant.name,
      coalition,
      status: 'En Campaña',
      bio: bio || `Candidatura a ${electoralLevel} en ${municipality}.`,
      keyProposals: [],
      pollingPercentage: Math.max(0, Number(pollingPercentage) || 0),
      voteTarget: Math.max(0, Number(voteTarget) || 0),
      votesCommitted: 0,
      updatedAt: new Date().toISOString()
    };

    onAddCandidate(newCand);
    setShowModal(false);
    setFullName('');
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-blue-400" />
            <h2 className="text-xl font-bold text-white">Plataforma de Candidaturas (Gobernación, Alcaldías, Asambleas, Concejos)</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Estructura electoral articulada para <strong className="text-slate-200">{currentTenant.name}</strong> • Colección Firestore <code className="text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded font-mono">/candidatos</code>
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-blue-600/30 transition-all shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Registrar Nueva Candidatura
        </button>
      </div>

      {/* TERRITORIAL SCOPE & ACCESS CONTROL BANNER */}
      <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-md ${
        scope.canViewAllMunicipalities 
          ? 'bg-gradient-to-r from-blue-950/70 via-indigo-950/60 to-slate-900 border-blue-500/30'
          : 'bg-gradient-to-r from-slate-900 via-amber-950/40 to-slate-900 border-amber-500/40'
      }`}>
        <div className="flex items-start sm:items-center gap-3">
          <div className={`p-2.5 rounded-xl text-white shadow-md shrink-0 ${
            scope.canViewAllMunicipalities ? 'bg-blue-600' : 'bg-amber-600'
          }`}>
            {scope.canViewAllMunicipalities ? <Shield className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-white">
                {scope.scopeTitle}
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                scope.canViewAllMunicipalities 
                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
              }`}>
                {scope.scopeLevel}
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
              {scope.scopeDescription}
            </p>
          </div>
        </div>

        <div className="text-[11px] font-mono text-slate-400 bg-slate-950/60 px-3 py-1.5 rounded-xl border border-slate-800 shrink-0">
          Candidaturas Visibles: <span className="text-emerald-400 font-bold">{filteredCandidates.length}</span>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Buscar candidato por nombre, vereda, municipio o distrito..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-xs text-slate-400">Nivel:</span>
          <select
            value={selectedLevel}
            onChange={(e) => setSelectedLevel(e.target.value)}
            className="bg-transparent text-xs text-slate-200 focus:outline-none cursor-pointer"
          >
            <option value="TODOS" className="bg-slate-900">Todos los Niveles Permitidos</option>
            {scope.canViewHigherHierarchy && (
              <>
                <option value="Gobernación" className="bg-slate-900">👑 Gobernación</option>
                <option value="Asamblea / Diputación" className="bg-slate-900">🏛️ Asamblea / Diputación</option>
              </>
            )}
            <option value="Alcaldía" className="bg-slate-900">🏢 Alcaldía Municipal</option>
            <option value="Concejo Municipal" className="bg-slate-900">🏘️ Concejo Municipal</option>
            {scope.isGlobalAdmin && (
              <option value="Congreso (Cámara / Senado)" className="bg-slate-900">📜 Congreso Nacional</option>
            )}
          </select>
        </div>
      </div>

      {/* Candidates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCandidates.map((cand) => (
          <div
            key={cand.id}
            className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between hover:border-blue-500/40 transition-all shadow-md group"
          >
            <div>
              {/* Profile Header */}
              <div className="flex items-start gap-4">
                <img
                  src={cand.photoUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                  alt={cand.fullName}
                  className="w-16 h-16 rounded-2xl object-cover border-2 border-slate-700 shadow-md group-hover:border-blue-500 transition-all"
                />
                <div className="flex-1">
                  <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-blue-500/20 text-blue-300 border border-blue-500/30 mb-1">
                    {cand.electoralLevel || cand.chamber}
                  </span>
                  <h3 className="font-bold text-slate-100 text-base leading-snug">{cand.fullName}</h3>
                  <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-slate-500 shrink-0" /> {cand.department} • {cand.municipality}
                  </p>
                  {cand.veredaOrBarrio && (
                    <span className="inline-block text-[10px] text-amber-300 bg-amber-950/40 border border-amber-500/30 px-1.5 py-0.5 rounded mt-1">
                      📍 {cand.veredaOrBarrio}
                    </span>
                  )}
                </div>
              </div>

              {/* Firestore Readable ID Badge */}
              <div className="mt-3 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800 text-[10px] text-slate-400 font-mono flex items-center justify-between">
                <span>Doc ID:</span>
                <span className="text-slate-300 truncate max-w-[200px]">{cand.id}</span>
              </div>

              {/* Bio & Key Info */}
              <p className="text-xs text-slate-300 mt-3 line-clamp-3 leading-relaxed bg-slate-800/40 p-3 rounded-xl border border-slate-800">
                {cand.bio}
              </p>

              {/* Vote target & Territory badge */}
              <div className="mt-3 flex items-center justify-between bg-slate-800/80 px-3 py-2 rounded-xl border border-slate-700 text-xs">
                <div className="flex items-center gap-1.5 text-slate-300 font-semibold">
                  <Target className="w-3.5 h-3.5 text-blue-400" />
                  <span>Meta de Votos:</span>
                </div>
                <span className="font-bold font-mono text-emerald-400">
                  {cand.voteTarget ? cand.voteTarget.toLocaleString('es-CO') : 'N/A'} votos
                </span>
              </div>

              {/* Key proposals badges */}
              <div className="mt-3 space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Ejes Prioritarios:</span>
                <div className="flex flex-wrap gap-1.5">
                  {cand.keyProposals?.map((prop, idx) => (
                    <span key={idx} className="text-[10px] bg-slate-800 text-slate-300 border border-slate-700 px-2 py-0.5 rounded-lg">
                      • {prop}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Bottom Stats & Actions */}
            <div className="mt-5 pt-4 border-t border-slate-800/80 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-400 block">Intención Voto</span>
                <span className="text-base font-extrabold text-emerald-400">{cand.pollingPercentage}%</span>
              </div>

              <button
                onClick={() => onGenerateSpeechForCandidate(cand.fullName, cand.district, cand.chamber)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/30 font-semibold text-xs rounded-xl transition-all cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>Discurso IA</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {filteredCandidates.length === 0 && (
        <div className="p-12 text-center bg-slate-900 border border-slate-800 rounded-2xl">
          <UserCheck className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-slate-300 font-bold">No se encontraron candidaturas</h3>
          <p className="text-xs text-slate-500 mt-1">Intenta ajustar tus criterios de búsqueda o registra una nueva candidatura.</p>
        </div>
      )}

      {/* MODAL: FORMULARIO INTUITIVO & PREDICTIVO DE CANDIDATURAS */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-2xl w-full p-6 sm:p-8 space-y-5 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-600/20 text-blue-400 rounded-xl border border-blue-500/30">
                  <Zap className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">
                    Formulario Predictivo de Candidatura Electoral
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Auto-relleno geográfico, cálculo de metas por censo y generación de ID legible en Firestore.
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* PREDICTIVE ID BANNER */}
            <div className="bg-slate-950 border border-emerald-500/30 p-3.5 rounded-2xl flex items-center justify-between gap-3">
              <div className="space-y-0.5">
                <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  ID de Documento Firestore (100% Descriptivo en Español):
                </span>
                <p className="text-xs font-mono font-bold text-emerald-300 truncate max-w-md">
                  /{'candidatos'}/{generatedDocId}
                </p>
              </div>
              <span className="text-[10px] bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 px-2 py-1 rounded-lg shrink-0">
                Auto-generado
              </span>
            </div>

            <form onSubmit={handleSubmitNewCandidate} className="space-y-4 text-xs">
              
              {/* Nombre Completo */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Nombre Completo del Candidato(a) <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Ing. Marcos Barrios / Dra. Camila Quintero"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 text-slate-100 p-2.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>

              {/* Nivel Electoral & Meta Votos */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Nivel Electoral (Auto-ajusta circunscripción)
                  </label>
                  <select
                    value={electoralLevel}
                    onChange={(e) => setElectoralLevel(e.target.value as ElectoralLevel)}
                    className="w-full bg-slate-800 border border-slate-700 text-slate-100 p-2.5 rounded-xl focus:outline-none font-medium cursor-pointer"
                  >
                    <option value="Gobernación">👑 Gobernación</option>
                    <option value="Asamblea / Diputación">🏛️ Asamblea / Diputación</option>
                    <option value="Alcaldía">🏢 Alcaldía Municipal</option>
                    <option value="Concejo Municipal">🏘️ Concejo Municipal</option>
                    <option value="Congreso (Cámara / Senado)">📜 Congreso (Cámara / Senado)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Meta de Votos Sugerida (Calculada por Censo)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={voteTarget}
                      onChange={(e) => setVoteTarget(parseInt(e.target.value) || 0)}
                      className="w-full bg-slate-800 border border-slate-700 text-emerald-400 font-mono font-bold p-2.5 rounded-xl focus:outline-none"
                    />
                    <span className="absolute right-3 top-2.5 text-slate-400 text-xs">votos</span>
                  </div>
                </div>
              </div>

              {/* Departamento & Municipio (Dropdowns predictivos reales) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Departamento de Colombia
                  </label>
                  <select
                    value={department}
                    onChange={(e) => handleDepartmentChange(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 text-slate-100 p-2.5 rounded-xl focus:outline-none cursor-pointer"
                  >
                    {DEPARTAMENTOS_COLOMBIA.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Municipio / Alcaldía
                  </label>
                  <select
                    value={municipality}
                    disabled={electoralLevel === 'Gobernación'}
                    onChange={(e) => handleMunicipalityChange(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 text-slate-100 p-2.5 rounded-xl focus:outline-none cursor-pointer disabled:opacity-60"
                  >
                    {availableMunicipalities.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Vereda / Corregimiento / Barrio con Chips de 1 Clic */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1 flex items-center justify-between">
                  <span>Corregimiento, Vereda o Barrio Prioritario</span>
                  <span className="text-[10px] text-blue-400 font-normal">Sugerencias predictivas:</span>
                </label>
                <input
                  type="text"
                  placeholder="Ej: Arjona (Corregimiento), San Isidro, Santa Cecilia..."
                  value={veredaOrBarrio}
                  onChange={(e) => setVeredaOrBarrio(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 text-slate-100 p-2.5 rounded-xl focus:outline-none mb-2"
                />

                {/* Chips de 1 Clic */}
                {availableVeredas.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {availableVeredas.map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setVeredaOrBarrio(v)}
                        className={`text-[10px] px-2.5 py-1 rounded-lg border transition cursor-pointer ${
                          veredaOrBarrio === v
                            ? 'bg-blue-600 text-white border-blue-500 font-bold'
                            : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                        }`}
                      >
                        📍 {v}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Distrito / Circunscripción Electoral (Auto-rellenado) */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Distrito / Circunscripción Electoral (Auto-rellenado)
                </label>
                <input
                  type="text"
                  required
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 text-slate-100 p-2.5 rounded-xl focus:outline-none font-medium"
                />
              </div>

              {/* Perfil Biográfico & Enfoque */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Perfil Biográfico y Propuestas Clave
                </label>
                <textarea
                  rows={2}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Resumen del candidato, trayectoria y enfoque..."
                  className="w-full bg-slate-800 border border-slate-700 text-slate-100 p-2.5 rounded-xl focus:outline-none leading-relaxed"
                />
              </div>

              {/* Botones de acción */}
              <div className="pt-3 flex items-center justify-between border-t border-slate-800">
                <span className="text-[11px] text-slate-400">
                  Guardará en <code className="text-emerald-400">/candidatos/{generatedDocId}</code>
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl shadow-lg shadow-blue-600/30 transition cursor-pointer"
                  >
                    Guardar Candidatura
                  </button>
                </div>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
};
