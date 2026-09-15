import React, { useState, useEffect } from 'react';
import { Tenant, Leader, UserProfile, UserRole } from '../types';
import { getTerritorialScope, filterLeadersByScope } from '../lib/permissions';
import {
  DEPARTAMENTOS_COLOMBIA,
  getMunicipiosPorDepartamento,
  getVeredasYBarrios,
  inferirDatosElectorales
} from '../data/colombiaElectoralData';
import { generarIdDocumentoLegible } from '../lib/slugify';
import {
  Users,
  Target,
  Award,
  PlusCircle,
  Phone,
  Mail,
  MapPin,
  CheckCircle,
  AlertTriangle,
  Zap,
  CheckCircle2,
  X,
  DollarSign,
  Lock,
  Shield
} from 'lucide-react';

interface LeadersViewProps {
  currentTenant: Tenant;
  currentUser?: UserProfile | null;
  userRole?: UserRole;
  leaders: Leader[];
  onAddLeader: (leader: Leader) => Promise<void>;
}

export const LeadersView: React.FC<LeadersViewProps> = ({
  currentTenant,
  currentUser = null,
  userRole = 'Alcalde',
  leaders,
  onAddLeader,
}) => {
  const scope = getTerritorialScope(currentUser, userRole);
  const [showModal, setShowModal] = useState<boolean>(false);
  const [filterZone, setFilterZone] = useState<string>('TODOS');

  // Form state (Predictive & Proactive)
  const [fullName, setFullName] = useState('');
  const [department, setDepartment] = useState(scope.allowedDepartment || 'Cesar');
  const [municipality, setMunicipality] = useState(scope.allowedMunicipality || 'Astrea');
  const [veredaOrBarrio, setVeredaOrBarrio] = useState('');
  const [zoneOrDistrict, setZoneOrDistrict] = useState(`Subregión Centro - Municipio de ${scope.allowedMunicipality || 'Astrea'}`);
  const [commune, setCommune] = useState(`${scope.allowedMunicipality || 'Astrea'} - Casco Urbano`);
  const [voteTarget, setVoteTarget] = useState('');
  const [votesCommitted, setVotesCommitted] = useState('0');
  const [activistsCount, setActivistsCount] = useState('0');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [budgetAllocated, setBudgetAllocated] = useState('0');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [generatedDocId, setGeneratedDocId] = useState<string>('');

  const availableMunicipalities = getMunicipiosPorDepartamento(department);
  const veredasYBarriosData = getVeredasYBarrios(department, municipality);
  const availableVeredas = veredasYBarriosData.veredas;

  // Auto-fill logic when location changes
  useEffect(() => {
    const infer = inferirDatosElectorales({
      nivel: 'Concejo Municipal',
      departamento: department,
      municipio: municipality,
      veredaOrBarrio: veredaOrBarrio
    });

    if (infer.distritoSugerido) {
      setZoneOrDistrict(infer.distritoSugerido);
    }
    setCommune(`${municipality} - ${veredaOrBarrio || 'Casco Urbano'}`);
  }, [department, municipality, veredaOrBarrio]);

  // Real-time readable ID calculation
  useEffect(() => {
    const id = generarIdDocumentoLegible(
      'lider',
      fullName || 'coordinador',
      municipality,
      veredaOrBarrio || 'zona-rural'
    );
    setGeneratedDocId(id);
  }, [fullName, municipality, veredaOrBarrio]);

  const handleDepartmentChange = (newDept: string) => {
    setDepartment(newDept);
    const munis = getMunicipiosPorDepartamento(newDept);
    if (munis.length > 0) {
      setMunicipality(munis[0]);
      const veredasInfo = getVeredasYBarrios(newDept, munis[0]);
      setVeredaOrBarrio(veredasInfo.veredas[0] || '');
    }
  };

  const handleMunicipalityChange = (newMuni: string) => {
    setMunicipality(newMuni);
    const veredasInfo = getVeredasYBarrios(department, newMuni);
    setVeredaOrBarrio(veredasInfo.veredas[0] || '');
  };

  const scopedLeaders = filterLeadersByScope(leaders, currentUser, userRole, currentTenant.tenantId);
  const filteredLeaders = filterZone === 'TODOS'
    ? scopedLeaders
    : scopedLeaders.filter((l) => l.zoneOrDistrict === filterZone || l.municipality === filterZone);

  // Totals
  const totalVoteTarget = scopedLeaders.reduce((acc, curr) => acc + curr.voteTarget, 0);
  const totalVotesCommitted = scopedLeaders.reduce((acc, curr) => acc + curr.votesCommitted, 0);
  const totalActivists = scopedLeaders.reduce((acc, curr) => acc + curr.activistsCount, 0);
  const overallProgress = totalVoteTarget > 0 ? (totalVotesCommitted / totalVoteTarget) * 100 : 0;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const target = Number(voteTarget);
    const committed = Number(votesCommitted || 0);
    if (!fullName.trim() || !Number.isFinite(target) || target <= 0) {
      setFormError('Ingrese el nombre y una meta de votos mayor que cero.');
      return;
    }
    if (committed < 0 || committed > target) {
      setFormError('Los votos fidelizados deben estar entre cero y la meta.');
      return;
    }
    if ((latitude && !longitude) || (!latitude && longitude)) {
      setFormError('Para georreferenciar, complete latitud y longitud.');
      return;
    }

    const leader: Leader = {
      id: generatedDocId || `lider-${Date.now()}`,
      tenantId: currentTenant.tenantId,
      fullName: fullName.trim(),
      zoneOrDistrict,
      department,
      municipality,
      veredaOrBarrio,
      commune: commune || `${municipality} - Sector Principal`,
      voteTarget: target,
      votesCommitted: committed,
      activistsCount: Math.max(0, Number(activistsCount || 0)),
      phone: phone.trim(),
      email: email.trim().toLowerCase(),
      status: 'Activo',
      budgetAllocated: Math.max(0, Number(budgetAllocated || 0)),
      ...(latitude && longitude ? { latitude: Number(latitude), longitude: Number(longitude) } : {}),
    };
    setSaving(true);
    try {
      await onAddLeader(leader);
      setShowModal(false);
      setFullName('');
      setPhone('');
      setEmail('');
      setLatitude('');
      setLongitude('');
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : 'No fue posible guardar el líder.');
    } finally {
      setSaving(false);
    }
  };

  const formatCOP = (val: number) => {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(val);
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-blue-500/20 text-blue-400 rounded-xl border border-blue-500/30">
              <Users className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-bold text-white tracking-tight">Red de Líderes Territoriales & Veredales</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Coordinación de movilización, seguimiento de votos y brigadistas en <strong className="text-slate-200">{currentTenant.name}</strong> • Colección <code className="text-emerald-400 font-mono">/lideres</code>
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold px-4 py-2.5 rounded-xl text-xs shadow-lg shadow-blue-600/20 transition cursor-pointer"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Registrar Nuevo Líder</span>
        </button>
      </div>

      {/* Territorial Scope & Access Control Banner */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-xl">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                Ámbito Territorial de Coordinación: {scope.scopeLevel.toUpperCase()}
              </span>
              <span className="text-[10px] bg-blue-500/20 text-blue-300 font-semibold px-2 py-0.5 rounded-full border border-blue-500/30">
                Rol: {userRole}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {scope.canViewAllMunicipalities
                ? 'Acceso Departamental Completo: Visualizando líderes de los 25 municipios del Cesar.'
                : `Jurisdicción Municipal Estricta: Visualizando y gestionando líderes de ${scope.allowedMunicipality || 'Astrea'}.`}
            </p>
          </div>
        </div>

        {!scope.canViewAllMunicipalities && (
          <div className="flex items-center gap-1.5 text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-xl font-medium shrink-0">
            <Lock className="w-3.5 h-3.5" />
            <span>Aislamiento Activo ({scope.allowedMunicipality || 'Astrea'})</span>
          </div>
        )}
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Líderes Activos</span>
          <div className="text-2xl font-extrabold text-white font-mono">{scopedLeaders.length} Coordinadores</div>
          <p className="text-[11px] text-slate-400">{totalActivists} brigadistas desplegados</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Meta Total Votos</span>
          <div className="text-2xl font-extrabold text-blue-400 font-mono">{totalVoteTarget.toLocaleString('es-CO')}</div>
          <p className="text-[11px] text-slate-400">Sumatoria de compromisos territoriales</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Votos Fidelizados</span>
          <div className="text-2xl font-extrabold text-emerald-400 font-mono">{totalVotesCommitted.toLocaleString('es-CO')}</div>
          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
            <div 
              className="bg-emerald-500 h-full rounded-full transition-all duration-500" 
              style={{ width: `${overallProgress}%` }}
            />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Avance General</span>
          <div className="text-2xl font-extrabold text-amber-300 font-mono">{overallProgress.toFixed(1)}%</div>
          <p className="text-[11px] text-slate-400">Objetivo del comando central</p>
        </div>
      </div>

      {/* Leaders Table & Cards */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-3">
          <h3 className="font-bold text-white text-sm flex items-center gap-2">
            <Target className="w-4 h-4 text-emerald-400" />
            Monitoreo de Rendimiento por Coordinador Territorial
          </h3>

          <div className="flex items-center gap-2">
            <select
              value={filterZone}
              onChange={(e) => setFilterZone(e.target.value)}
              className="bg-slate-800 text-xs text-slate-200 border border-slate-700 rounded-lg px-3 py-1.5 focus:outline-none font-medium cursor-pointer"
            >
              <option value="TODOS">Todos los Municipios/Zonas</option>
              {availableMunicipalities.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredLeaders.map((lead) => {
            const progress = lead.voteTarget > 0 ? (lead.votesCommitted / lead.voteTarget) * 100 : 0;

            return (
              <div 
                key={lead.id}
                className="bg-slate-950/80 border border-slate-800 hover:border-slate-700 rounded-xl p-4 space-y-3 transition flex flex-col justify-between"
              >
                <div className="space-y-3">
                  {/* Leader top info */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <img 
                        src={lead.photoUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80'} 
                        alt={lead.fullName}
                        className="w-12 h-12 rounded-full object-cover border border-slate-700"
                      />
                      <div>
                        <h4 className="font-bold text-slate-100 text-sm leading-tight">{lead.fullName}</h4>
                        <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3 text-slate-500" />
                          {lead.municipality} • {lead.veredaOrBarrio || lead.commune}
                        </p>
                      </div>
                    </div>

                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                      lead.status === 'Destacado' 
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                        : lead.status === 'En Riesgo'
                        ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                        : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                    }`}>
                      {lead.status}
                    </span>
                  </div>

                  {/* Readable Firestore ID */}
                  <div className="bg-slate-900 px-2 py-1 rounded text-[10px] text-slate-400 font-mono flex items-center justify-between">
                    <span>ID:</span>
                    <span className="text-slate-300 truncate max-w-[190px]">{lead.id}</span>
                  </div>

                  {/* Progress & Target */}
                  <div className="bg-slate-900/60 p-2.5 rounded-lg space-y-1.5 border border-slate-800/80 text-xs">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-400">Meta: {lead.voteTarget.toLocaleString('es-CO')}</span>
                      <span className="font-bold text-emerald-400">{lead.votesCommitted.toLocaleString('es-CO')} votos ({progress.toFixed(0)}%)</span>
                    </div>
                    <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-300 ${
                          progress >= 80 ? 'bg-emerald-500' : progress >= 50 ? 'bg-blue-500' : 'bg-amber-500'
                        }`}
                        style={{ width: `${Math.min(100, progress)}%` }}
                      />
                    </div>
                  </div>

                  {/* Activists & Phone */}
                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                    <span className="flex items-center gap-1 text-slate-300 font-medium">
                      <Users className="w-3.5 h-3.5 text-blue-400" />
                      {lead.activistsCount} brigadistas
                    </span>
                    <span className="font-mono text-slate-400 flex items-center gap-1">
                      <Phone className="w-3 h-3 text-emerald-400" />
                      {lead.phone}
                    </span>
                  </div>
                </div>

                {/* Budget */}
                <div className="border-t border-slate-800/80 pt-2 flex items-center justify-between text-[11px]">
                  <span className="text-slate-500">Caja Operativa:</span>
                  <span className="font-mono font-bold text-amber-300">
                    {formatCOP(lead.budgetAllocated || 2000000)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* MODAL: FORMULARIO PREDICTIVO DE LÍDERES */}
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
                    Registro Predictivo de Líder Veredal / Barrial
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Asignación territorial en Colombia, metas de votantes y presupuesto en COP.
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
                  ID de Documento en Firestore (Español):
                </span>
                <p className="text-xs font-mono font-bold text-emerald-300 truncate max-w-md">
                  /{'lideres'}/{generatedDocId}
                </p>
              </div>
              <span className="text-[10px] bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 px-2 py-1 rounded-lg shrink-0">
                Auto-generado
              </span>
            </div>

            <form onSubmit={handleCreate} className="space-y-4 text-xs">
              
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Nombre Completo del Coordinador(a) <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Nombre y apellidos"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 text-slate-100 p-2.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>

              {/* Departamento & Municipio Dropdowns */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Departamento
                  </label>
                  <select
                    value={department}
                    onChange={(e) => handleDepartmentChange(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 text-slate-100 p-2.5 rounded-xl focus:outline-none cursor-pointer"
                  >
                    {DEPARTAMENTOS_COLOMBIA.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Municipio / Alcaldía
                  </label>
                  <select
                    value={municipality}
                    onChange={(e) => handleMunicipalityChange(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 text-slate-100 p-2.5 rounded-xl focus:outline-none cursor-pointer"
                  >
                    {availableMunicipalities.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Vereda / Corregimiento con Chips */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1 flex items-center justify-between">
                  <span>Vereda, Corregimiento o Barrio Asignado</span>
                  <span className="text-[10px] text-blue-400 font-normal">Chips de 1 clic:</span>
                </label>
                <input
                  type="text"
                  value={veredaOrBarrio}
                  onChange={(e) => setVeredaOrBarrio(e.target.value)}
                  placeholder="Ej: San Isidro (Vereda), Arjona, La Ye..."
                  className="w-full bg-slate-800 border border-slate-700 text-slate-100 p-2.5 rounded-xl focus:outline-none mb-2"
                />

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

              {/* Meta Votos & Brigadistas */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Meta de Votantes
                  </label>
                  <input
                    type="number"
                    required
                    value={voteTarget}
                    onChange={(e) => setVoteTarget(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 text-emerald-400 font-mono font-bold p-2.5 rounded-xl focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Votos Ya Fidelizados
                  </label>
                  <input
                    type="number"
                    value={votesCommitted}
                    onChange={(e) => setVotesCommitted(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 text-slate-100 font-mono p-2.5 rounded-xl focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Brigadistas a Cargo
                  </label>
                  <input
                    type="number"
                    value={activistsCount}
                    onChange={(e) => setActivistsCount(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 text-slate-100 font-mono p-2.5 rounded-xl focus:outline-none"
                  />
                </div>
              </div>

              {/* Contacto & Presupuesto COP */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Teléfono Móvil (+57 Colombia)
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    autoComplete="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Número con código de país"
                    className="w-full bg-slate-800 border border-slate-700 text-slate-100 p-2.5 rounded-xl focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Correo electrónico</label>
                  <input
                    type="email"
                    name="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="lider@organizacion.co"
                    className="w-full bg-slate-800 border border-slate-700 text-slate-100 p-2.5 rounded-xl focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Presupuesto Asignado ($ COP)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={budgetAllocated}
                    onChange={(e) => setBudgetAllocated(e.target.value)}
                    placeholder="2500000"
                    className="w-full bg-slate-800 border border-slate-700 text-amber-300 font-mono font-bold p-2.5 rounded-xl focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Latitud (opcional)</label>
                  <input type="number" min="-90" max="90" step="any" value={latitude} onChange={(e) => setLatitude(e.target.value)} placeholder="Ej: 9.4981" className="w-full bg-slate-800 border border-slate-700 text-slate-100 p-2.5 rounded-xl focus:outline-none font-mono" />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Longitud (opcional)</label>
                  <input type="number" min="-180" max="180" step="any" value={longitude} onChange={(e) => setLongitude(e.target.value)} placeholder="Ej: -73.9785" className="w-full bg-slate-800 border border-slate-700 text-slate-100 p-2.5 rounded-xl focus:outline-none font-mono" />
                </div>
              </div>

              {formError && <p role="alert" className="rounded-xl border border-rose-800 bg-rose-950/40 p-3 text-xs text-rose-200">{formError}</p>}

              {/* Botones */}
              <div className="pt-3 flex items-center justify-between border-t border-slate-800">
                <span className="text-[11px] text-slate-400 font-mono truncate max-w-xs">
                  Doc: /lideres/{generatedDocId}
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
                    disabled={saving}
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl shadow-lg shadow-blue-600/30 transition cursor-pointer disabled:opacity-50"
                  >
                    {saving ? 'Guardando…' : 'Guardar Líder'}
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
