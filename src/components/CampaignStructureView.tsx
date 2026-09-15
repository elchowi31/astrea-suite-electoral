import React, { useState } from 'react';
import { 
  CampaignCoordination, 
  CampaignCommittee, 
  CampaignTask,
  UserProfile, 
  UserRole 
} from '../types';
import { 
  Users, 
  Target, 
  MessageSquare, 
  Scale, 
  DollarSign, 
  HeartHandshake, 
  Truck, 
  Sparkles,
  CheckCircle2, 
  Clock, 
  Plus, 
  Search, 
  FileText, 
  ShieldCheck, 
  Phone, 
  Mail, 
  ChevronRight,
  UserCheck,
  Award,
  ListTodo,
  ExternalLink,
  Crown,
  Briefcase,
  Edit3,
  Layers,
  Network,
  BadgeCheck
} from 'lucide-react';

interface CampaignStructureViewProps {
  coordinations: CampaignCoordination[];
  currentUser?: UserProfile | null;
  userRole?: UserRole;
  onNavigateToHierarchy?: () => void;
  onUpdateCoordination?: (updated: CampaignCoordination) => void;
}

export const CampaignStructureView: React.FC<CampaignStructureViewProps> = ({
  coordinations,
  currentUser,
  userRole = 'Alcalde',
  onNavigateToHierarchy,
  onUpdateCoordination
}) => {
  const [selectedCoordId, setSelectedCoordId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeCommitteeModal, setActiveCommitteeModal] = useState<{
    coordination: CampaignCoordination;
    committee: CampaignCommittee;
  } | null>(null);

  // Executive Leadership State (Candidato, Coordinador General, Gerente al lado)
  const [isEditExecutiveModalOpen, setIsEditExecutiveModalOpen] = useState(false);
  const [candidateInfo, setCandidateInfo] = useState({
    name: 'Sin candidatura configurada',
    role: 'Cargo por definir',
    slogan: '',
    status: 'Pendiente de configuración'
  });

  const [generalCoordinator, setGeneralCoordinator] = useState({
    name: 'Sin coordinador asignado',
    role: 'Coordinador General de Campaña',
    phone: '',
    email: '',
    responsibilities: 'Articulación política, coordinación y supervisión de las 8 coordinaciones temáticas, enlace permanente con jefes de debate y despliegue territorial.',
    focusArea: 'Dirección Política, Estrategia & Comités'
  });

  const [campaignManager, setCampaignManager] = useState({
    name: 'Sin gerente asignado',
    role: 'Gerente General de Campaña',
    phone: '',
    email: '',
    responsibilities: 'Administración de recursos financieros y humanos, rendición de Cuentas Claras CNE, contratación de proveedores, logística operativa y control del cronograma.',
    focusArea: 'Gerencia Administrativa, Financiera & Operaciones'
  });

  // Edit executive form temp state
  const [tempCoordinator, setTempCoordinator] = useState({ ...generalCoordinator });
  const [tempManager, setTempManager] = useState({ ...campaignManager });
  const [tempCandidate, setTempCandidate] = useState({ ...candidateInfo });

  // New task state inside modal
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskAssignee, setNewTaskAssignee] = useState('');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');

  // Icon mapping
  const getCoordIcon = (iconName: string, className = 'w-5 h-5') => {
    switch (iconName) {
      case 'Users': return <Users className={className} />;
      case 'Target': return <Target className={className} />;
      case 'MessageSquare': return <MessageSquare className={className} />;
      case 'Scale': return <Scale className={className} />;
      case 'DollarSign': return <DollarSign className={className} />;
      case 'HeartHandshake': return <HeartHandshake className={className} />;
      case 'Truck': return <Truck className={className} />;
      case 'Sparkles': return <Sparkles className={className} />;
      default: return <Users className={className} />;
    }
  };

  // Filtered Coordinations
  const filteredCoordinations = coordinations.filter((coord) => {
    if (selectedCoordId !== 'all' && coord.id !== selectedCoordId) return false;
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    const matchCoord = 
      coord.title.toLowerCase().includes(query) ||
      coord.coordinatorName.toLowerCase().includes(query) ||
      coord.summary.toLowerCase().includes(query);
    const matchCommittees = coord.committees.some(c => 
      c.name.toLowerCase().includes(query) ||
      c.responsibilities.some(r => r.toLowerCase().includes(query)) ||
      (c.leadPerson && c.leadPerson.toLowerCase().includes(query))
    );
    return matchCoord || matchCommittees;
  });

  // Calculate totals
  const totalCommittees = coordinations.reduce((acc, c) => acc + c.committees.length, 0);
  const totalTasks = coordinations.reduce((acc, c) => acc + c.committees.reduce((t, cm) => t + cm.tasksCount, 0), 0);
  const totalCompletedTasks = coordinations.reduce((acc, c) => acc + c.committees.reduce((t, cm) => t + cm.completedTasksCount, 0), 0);
  const overallProgress = totalTasks > 0 ? Math.round((totalCompletedTasks / totalTasks) * 100) : 0;

  const handleSaveExecutiveLeaders = (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralCoordinator({ ...tempCoordinator });
    setCampaignManager({ ...tempManager });
    setCandidateInfo({ ...tempCandidate });
    setIsEditExecutiveModalOpen(false);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/20 border border-indigo-500/30 rounded-full text-indigo-300 text-xs font-semibold uppercase tracking-wider">
              <ShieldCheck className="w-3.5 h-3.5" />
              Estructura Oficial de Campaña & Comités
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
              Organigrama Operativo & Comités Estratégicos
            </h1>
            <p className="text-slate-300 text-sm max-w-3xl leading-relaxed">
              Gestión articulada del <span className="font-semibold text-white">Mando Central (Coordinador General y Gerente)</span> junto a las <span className="font-semibold text-white">8 Coordinaciones Oficiales</span> y comités especializados 2026.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {false && <button
              id="btn-edit-executive-team"
              onClick={() => {
                setTempCoordinator({ ...generalCoordinator });
                setTempManager({ ...campaignManager });
                setTempCandidate({ ...candidateInfo });
                setIsEditExecutiveModalOpen(true);
              }}
              className="flex items-center gap-2 px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer shadow-md"
            >
              <Edit3 className="w-4 h-4 text-indigo-400" />
              <span>Editar Mando Central</span>
            </button>}

            {onNavigateToHierarchy && (
              <button
                id="btn-nav-hierarchy-pyramid"
                onClick={onNavigateToHierarchy}
                className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-900/30 transition-all cursor-pointer hover:scale-[1.02]"
              >
                <Users className="w-4 h-4" />
                Ver Pirámide Jerárquica de Votos
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Quick KPI Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-slate-800/80">
          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-3">
            <p className="text-xs text-slate-400 font-medium">Mando Central</p>
            <p className="text-xl font-bold text-white mt-0.5">Coordinador + Gerente</p>
          </div>
          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-3">
            <p className="text-xs text-slate-400 font-medium">Coordinaciones</p>
            <p className="text-xl font-bold text-indigo-400 mt-0.5">{coordinations.length} Oficiales</p>
          </div>
          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-3">
            <p className="text-xs text-slate-400 font-medium">Comités Especializados</p>
            <p className="text-xl font-bold text-emerald-400 mt-0.5">{totalCommittees} Comités</p>
          </div>
          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-3">
            <p className="text-xs text-slate-400 font-medium">Avance Global de Tareas</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xl font-bold text-amber-400">{overallProgress}%</span>
              <div className="flex-1 bg-slate-700 rounded-full h-2 overflow-hidden">
                <div className="bg-amber-400 h-2 rounded-full transition-all duration-500" style={{ width: `${overallProgress}%` }}></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* ORGANIGRAMA DE MANDO EJECUTIVO: CANDIDATO -> COORDINADOR GENERAL + GERENTE */}
      {/* ========================================================================= */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-xl border border-indigo-500/30">
              <Network className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">
                Cúpula Directiva & Mando Ejecutivo de Campaña
              </h2>
              <p className="text-xs text-slate-400">
                Estructura de mando superior: Conducción política estratégica y gerencia operativa y financiera
              </p>
            </div>
          </div>

          <span className="px-3 py-1 bg-blue-500/10 text-blue-300 border border-blue-500/30 rounded-full text-xs font-semibold">
            Nivel Directivo 1 & 2
          </span>
        </div>

        {/* Visual Organigram Tree */}
        <div className="flex flex-col items-center space-y-6">
          
          {/* TOP NODE: CANDIDATO */}
          <div className="w-full max-w-xl bg-gradient-to-r from-blue-900/60 via-indigo-900/80 to-blue-900/60 border-2 border-blue-500/50 rounded-2xl p-4 shadow-xl text-center relative hover:border-blue-400 transition-all">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-3 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1 shadow-md">
              <Crown className="w-3 h-3 text-amber-300" />
              Liderazgo & Cúspide de Campaña
            </div>
            <div className="mt-1">
              <h3 className="text-lg font-black text-white">{candidateInfo.name}</h3>
              <p className="text-xs font-semibold text-blue-300">{candidateInfo.role}</p>
              <p className="text-[11px] text-slate-300 italic mt-1 font-serif">"{candidateInfo.slogan}"</p>
            </div>
          </div>

          {/* CONNECTOR LINE FROM CANDIDATE TO EXECUTIVE LEVEL */}
          <div className="w-0.5 h-6 bg-gradient-to-b from-blue-500 to-indigo-500"></div>

          {/* EXECUTIVE LEVEL: COORDINADOR GENERAL (IZQUIERDA) Y GERENTE (DERECHA / AL LADO) */}
          <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-6 relative">
            
            {/* Horizontal Line joining Coordinador General and Gerente */}
            <div className="hidden md:block absolute -top-3 left-1/4 right-1/4 h-0.5 bg-indigo-500/60"></div>
            
            {/* Vertical connector down to Coordinador */}
            <div className="hidden md:block absolute -top-3 left-1/4 w-0.5 h-3 bg-indigo-500/60"></div>

            {/* Vertical connector down to Gerente */}
            <div className="hidden md:block absolute -top-3 right-1/4 w-0.5 h-3 bg-indigo-500/60"></div>

            {/* CARD 1: COORDINADOR GENERAL */}
            <div className="bg-gradient-to-br from-blue-950/70 via-slate-900 to-slate-900 border-2 border-blue-500/40 rounded-2xl p-5 shadow-lg relative overflow-hidden flex flex-col justify-between hover:border-blue-400/80 transition-all">
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-blue-600/30 border border-blue-500/50 flex items-center justify-center text-blue-300 shadow-md shrink-0">
                      <UserCheck className="w-6 h-6 text-blue-400" />
                    </div>
                    <div>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30 uppercase tracking-wider">
                        Liderazgo Político & Territorial
                      </span>
                      <h3 className="text-base font-extrabold text-white mt-1">{generalCoordinator.name}</h3>
                      <p className="text-xs font-semibold text-blue-400">{generalCoordinator.role}</p>
                    </div>
                  </div>
                  <span className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse shrink-0" title="Activo en funciones"></span>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/40 p-3 rounded-xl border border-slate-800">
                  {generalCoordinator.responsibilities}
                </p>

                <div className="space-y-1 text-xs text-slate-300">
                  <div className="flex items-center gap-2">
                    <BadgeCheck className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    <span><strong>Ámbito:</strong> {generalCoordinator.focusArea}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                    <span><strong>Articulación:</strong> Dirige las 8 Coordinaciones y la red de líderes veredales.</span>
                  </div>
                </div>
              </div>

              {/* Direct Contact Bar */}
              <div className="mt-4 pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                <a 
                  href={`tel:${generalCoordinator.phone}`}
                  className="flex items-center gap-1.5 hover:text-blue-400 transition cursor-pointer"
                >
                  <Phone className="w-3.5 h-3.5 text-blue-400" />
                  <span>{generalCoordinator.phone}</span>
                </a>
                <a 
                  href={`mailto:${generalCoordinator.email}`}
                  className="flex items-center gap-1.5 hover:text-blue-400 transition cursor-pointer"
                >
                  <Mail className="w-3.5 h-3.5 text-blue-400" />
                  <span>{generalCoordinator.email}</span>
                </a>
              </div>
            </div>

            {/* CARD 2: GERENTE DE CAMPAÑA (AL LADO) */}
            <div className="bg-gradient-to-br from-emerald-950/70 via-slate-900 to-slate-900 border-2 border-emerald-500/40 rounded-2xl p-5 shadow-lg relative overflow-hidden flex flex-col justify-between hover:border-emerald-400/80 transition-all">
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-emerald-600/30 border border-emerald-500/50 flex items-center justify-center text-emerald-300 shadow-md shrink-0">
                      <Briefcase className="w-6 h-6 text-emerald-400" />
                    </div>
                    <div>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase tracking-wider">
                        Gerencia Administrativa & Financiera
                      </span>
                      <h3 className="text-base font-extrabold text-white mt-1">{campaignManager.name}</h3>
                      <p className="text-xs font-semibold text-emerald-400">{campaignManager.role}</p>
                    </div>
                  </div>
                  <span className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse shrink-0" title="Activo en funciones"></span>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/40 p-3 rounded-xl border border-slate-800">
                  {campaignManager.responsibilities}
                </p>

                <div className="space-y-1 text-xs text-slate-300">
                  <div className="flex items-center gap-2">
                    <BadgeCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span><strong>Ámbito:</strong> {campaignManager.focusArea}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span><strong>Control CNE:</strong> Presupuesto, Cuentas Claras, Contratos y Transporte Día D.</span>
                  </div>
                </div>
              </div>

              {/* Direct Contact Bar */}
              <div className="mt-4 pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                <a 
                  href={`tel:${campaignManager.phone}`}
                  className="flex items-center gap-1.5 hover:text-emerald-400 transition cursor-pointer"
                >
                  <Phone className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{campaignManager.phone}</span>
                </a>
                <a 
                  href={`mailto:${campaignManager.email}`}
                  className="flex items-center gap-1.5 hover:text-emerald-400 transition cursor-pointer"
                >
                  <Mail className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{campaignManager.email}</span>
                </a>
              </div>
            </div>

          </div>

          {/* CONNECTOR LINE DOWN TO FUNCTIONAL COORDINATIONS */}
          <div className="flex items-center gap-2 text-xs font-semibold text-indigo-400 bg-indigo-500/10 px-4 py-1.5 rounded-full border border-indigo-500/30">
            <Layers className="w-3.5 h-3.5" />
            <span>Supervisión y despliegue sobre las 8 Coordinaciones Operativas & 26 Comités Sectoriales</span>
          </div>

        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row gap-3 items-center justify-between bg-slate-900/80 border border-slate-800 p-3 rounded-2xl">
        {/* Coordination Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0 scrollbar-thin">
          <button
            onClick={() => setSelectedCoordId('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              selectedCoordId === 'all'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            Todas las Coordinaciones ({coordinations.length})
          </button>
          {coordinations.map((coord) => (
            <button
              key={coord.id}
              onClick={() => setSelectedCoordId(coord.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                selectedCoordId === coord.id
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: coord.color }}></span>
              {coord.title.replace('Coordinación de ', '').replace('Coordinación ', '')}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full md:w-72 shrink-0">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar comité, tarea o responsable..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-800/90 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Coordinations Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredCoordinations.map((coord) => {
          const coordTasks = coord.committees.reduce((acc, c) => acc + c.tasksCount, 0);
          const coordCompleted = coord.committees.reduce((acc, c) => acc + c.completedTasksCount, 0);
          const coordProgress = coordTasks > 0 ? Math.round((coordCompleted / coordTasks) * 100) : 0;

          return (
            <div 
              key={coord.id}
              className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden hover:border-slate-700 transition-all duration-300 shadow-lg flex flex-col justify-between"
            >
              {/* Header with Coordinator profile */}
              <div className="p-5 border-b border-slate-800 bg-slate-800/30">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-md shrink-0"
                      style={{ backgroundColor: coord.color }}
                    >
                      {getCoordIcon(coord.iconName, 'w-6 h-6')}
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-white tracking-tight">{coord.title}</h2>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs font-semibold text-indigo-400 flex items-center gap-1">
                          <UserCheck className="w-3.5 h-3.5" />
                          {coord.coordinatorName}
                        </span>
                        <span className="text-[10px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full border border-slate-700">
                          {coord.coordinatorRole}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-xs font-bold text-emerald-400">{coordProgress}%</span>
                    <p className="text-[10px] text-slate-400">{coordCompleted}/{coordTasks} tareas</p>
                  </div>
                </div>

                <p className="text-xs text-slate-300 mt-3 leading-relaxed">
                  {coord.summary}
                </p>

                {/* Direct Contact info */}
                {(coord.coordinatorPhone || coord.coordinatorEmail) && (
                  <div className="flex items-center gap-4 mt-2.5 pt-2.5 border-t border-slate-800/60 text-[11px] text-slate-400">
                    {coord.coordinatorPhone && (
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3 text-slate-500" />
                        {coord.coordinatorPhone}
                      </span>
                    )}
                    {coord.coordinatorEmail && (
                      <span className="flex items-center gap-1">
                        <Mail className="w-3 h-3 text-slate-500" />
                        {coord.coordinatorEmail}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Committees List */}
              <div className="p-5 space-y-3 flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Comités Especializados ({coord.committees.length})
                  </h3>
                  <span className="text-[11px] text-slate-500 font-medium">Click para ver tareas y funciones</span>
                </div>

                <div className="space-y-2.5">
                  {coord.committees.map((committee) => {
                    const taskPct = committee.tasksCount > 0 
                      ? Math.round((committee.completedTasksCount / committee.tasksCount) * 100) 
                      : 0;

                    return (
                      <div 
                        key={committee.id}
                        onClick={() => setActiveCommitteeModal({ coordination: coord, committee })}
                        className="p-3.5 bg-slate-950/60 hover:bg-slate-800/80 border border-slate-800 hover:border-indigo-500/50 rounded-xl transition-all cursor-pointer group"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1 flex-1">
                            <div className="flex items-center gap-2">
                              <h4 className="text-xs font-bold text-white group-hover:text-indigo-300 transition-colors">
                                {committee.name}
                              </h4>
                              {committee.status === 'Activo' && (
                                <span className="px-2 py-0.5 text-[9px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-md">
                                  Activo
                                </span>
                              )}
                              {committee.status === 'En Ejecución' && (
                                <span className="px-2 py-0.5 text-[9px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-md">
                                  En Ejecución
                                </span>
                              )}
                              {committee.status === 'Completado' && (
                                <span className="px-2 py-0.5 text-[9px] font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-md">
                                  Completado
                                </span>
                              )}
                            </div>

                            {committee.leadPerson && (
                              <p className="text-[11px] text-slate-400 flex items-center gap-1">
                                <span className="text-slate-500">Líder asignado:</span> 
                                <strong className="text-slate-300">{committee.leadPerson}</strong>
                              </p>
                            )}

                            {/* Responsibilities bullets */}
                            <ul className="mt-2 space-y-1 text-[11px] text-slate-400">
                              {committee.responsibilities.slice(0, 2).map((resp, idx) => (
                                <li key={idx} className="flex items-start gap-1.5">
                                  <span className="text-indigo-400 mt-0.5">•</span>
                                  <span className="line-clamp-1">{resp}</span>
                                </li>
                              ))}
                              {committee.responsibilities.length > 2 && (
                                <li className="text-[10px] text-indigo-400 italic">
                                  +{committee.responsibilities.length - 2} funciones adicionales...
                                </li>
                              )}
                            </ul>
                          </div>

                          {/* Task progress badge */}
                          <div className="text-right shrink-0">
                            <span className="text-xs font-bold text-slate-300">{committee.completedTasksCount}/{committee.tasksCount}</span>
                            <div className="w-16 bg-slate-800 rounded-full h-1.5 mt-1 overflow-hidden">
                              <div 
                                className="bg-indigo-500 h-1.5 rounded-full" 
                                style={{ width: `${taskPct}%` }}
                              ></div>
                            </div>
                            <span className="text-[9px] text-slate-500 mt-0.5 block">{taskPct}%</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Card Footer */}
              <div className="p-4 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                <span>Articulado a la Coordinación General y Gerencia</span>
                <span className="font-semibold text-indigo-400 flex items-center gap-1">
                  Ver detalle
                  <ChevronRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* MODAL: EDITAR MANDO CENTRAL (COORDINADOR GENERAL, GERENTE Y CANDIDATO) */}
      {/* ========================================================================= */}
      {isEditExecutiveModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl animate-fade-in my-8">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-600/20 text-blue-400 rounded-xl border border-blue-500/30">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Editar Mando Central de Campaña</h3>
                  <p className="text-xs text-slate-400">Actualiza los datos del Candidato, Coordinador General y Gerente de Campaña</p>
                </div>
              </div>
              <button
                onClick={() => setIsEditExecutiveModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                ✕
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveExecutiveLeaders} className="p-6 space-y-6 overflow-y-auto flex-1">
              
              {/* Sección Candidato */}
              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-400">
                  <Crown className="w-4 h-4" />
                  <span>Datos del Candidato(a) Principal</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">Nombre Completo</label>
                    <input
                      type="text"
                      value={tempCandidate.name}
                      onChange={(e) => setTempCandidate({ ...tempCandidate, name: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">Rol / Cargo Electoral</label>
                    <input
                      type="text"
                      value={tempCandidate.role}
                      onChange={(e) => setTempCandidate({ ...tempCandidate, role: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                      required
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">Eslogan de Campaña</label>
                    <input
                      type="text"
                      value={tempCandidate.slogan}
                      onChange={(e) => setTempCandidate({ ...tempCandidate, slogan: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Sección Coordinador General */}
              <div className="bg-slate-950/70 border border-blue-500/30 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-400">
                  <UserCheck className="w-4 h-4" />
                  <span>Coordinador General de Campaña (Eje Político)</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">Nombre del Coordinador General</label>
                    <input
                      type="text"
                      value={tempCoordinator.name}
                      onChange={(e) => setTempCoordinator({ ...tempCoordinator, name: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">Título / Cargo</label>
                    <input
                      type="text"
                      value={tempCoordinator.role}
                      onChange={(e) => setTempCoordinator({ ...tempCoordinator, role: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">Teléfono / WhatsApp</label>
                    <input
                      type="text"
                      value={tempCoordinator.phone}
                      onChange={(e) => setTempCoordinator({ ...tempCoordinator, phone: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">Correo Electrónico</label>
                    <input
                      type="email"
                      name="coordinator_email"
                      autoComplete="email"
                      value={tempCoordinator.email}
                      onChange={(e) => setTempCoordinator({ ...tempCoordinator, email: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">Funciones y Responsabilidades Principales</label>
                    <textarea
                      rows={2}
                      value={tempCoordinator.responsibilities}
                      onChange={(e) => setTempCoordinator({ ...tempCoordinator, responsibilities: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Sección Gerente de Campaña */}
              <div className="bg-slate-950/70 border border-emerald-500/30 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-400">
                  <Briefcase className="w-4 h-4" />
                  <span>Gerente de Campaña (Gerente - Eje Administrativo & CNE)</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">Nombre del Gerente de Campaña</label>
                    <input
                      type="text"
                      value={tempManager.name}
                      onChange={(e) => setTempManager({ ...tempManager, name: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">Título / Cargo</label>
                    <input
                      type="text"
                      value={tempManager.role}
                      onChange={(e) => setTempManager({ ...tempManager, role: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">Teléfono / WhatsApp</label>
                    <input
                      type="text"
                      value={tempManager.phone}
                      onChange={(e) => setTempManager({ ...tempManager, phone: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">Correo Electrónico</label>
                    <input
                      type="email"
                      name="manager_email"
                      autoComplete="email"
                      value={tempManager.email}
                      onChange={(e) => setTempManager({ ...tempManager, email: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">Funciones y Responsabilidades Principales</label>
                    <textarea
                      rows={2}
                      value={tempManager.responsibilities}
                      onChange={(e) => setTempManager({ ...tempManager, responsibilities: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              </div>

              {/* Botones de acción */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsEditExecutiveModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-lg transition cursor-pointer"
                >
                  Guardar Cambios del Mando Central
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: DETALLE DEL COMITÉ Y GESTIÓN DE TAREAS */}
      {/* ========================================================================= */}
      {activeCommitteeModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl animate-fade-in">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div 
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-md"
                  style={{ backgroundColor: activeCommitteeModal.coordination.color }}
                >
                  {getCoordIcon(activeCommitteeModal.coordination.iconName, 'w-5 h-5')}
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {activeCommitteeModal.coordination.title}
                  </span>
                  <h3 className="text-lg font-bold text-white tracking-tight">
                    {activeCommitteeModal.committee.name}
                  </h3>
                </div>
              </div>
              <button
                onClick={() => setActiveCommitteeModal(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6 overflow-y-auto flex-1">
              
              {/* Leader & Status Info */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-950/60 p-4 rounded-xl border border-slate-800">
                <div>
                  <p className="text-[10px] font-semibold text-slate-400 uppercase">Responsable / Líder</p>
                  <p className="text-xs font-bold text-white mt-0.5">
                    {activeCommitteeModal.committee.leadPerson || 'Por Asignar'}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-slate-400 uppercase">Estado Operativo</p>
                  <span className="inline-block mt-0.5 px-2 py-0.5 text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-md">
                    {activeCommitteeModal.committee.status}
                  </span>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-slate-400 uppercase">Cumplimiento</p>
                  <p className="text-xs font-bold text-indigo-400 mt-0.5">
                    {activeCommitteeModal.committee.completedTasksCount} de {activeCommitteeModal.committee.tasksCount} tareas
                  </p>
                </div>
              </div>

              {/* Responsibilities */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-indigo-400" />
                  Funciones y Responsabilidades Asignadas
                </h4>
                <ul className="space-y-2 bg-slate-950/40 p-4 rounded-xl border border-slate-800/80">
                  {activeCommitteeModal.committee.responsibilities.map((resp, i) => (
                    <li key={i} className="text-xs text-slate-300 flex items-start gap-2.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5 shrink-0"></span>
                      <span>{resp}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Operational Tasks */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                    <ListTodo className="w-3.5 h-3.5 text-emerald-400" />
                    Tareas Operativas del Plan de Campaña
                  </h4>
                  <span className="text-[11px] text-slate-400">
                    {activeCommitteeModal.committee.completedTasksCount}/{activeCommitteeModal.committee.tasksCount} completadas
                  </span>
                </div>

                <div className="space-y-2">
                  <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <div>
                        <p className="text-xs font-medium text-white">Cronograma y plan de trabajo semanal aprobado</p>
                        <p className="text-[10px] text-slate-400">Asignado a: {activeCommitteeModal.committee.leadPerson}</p>
                      </div>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold">Listo</span>
                  </div>

                  <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Clock className="w-4 h-4 text-amber-400" />
                      <div>
                        <p className="text-xs font-medium text-white">Consolidación de informes y entrega a Coordinación General</p>
                        <p className="text-[10px] text-slate-400">Fecha límite: Viernes 18:00</p>
                      </div>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-semibold">En Curso</span>
                  </div>
                </div>

                {/* Add Quick Task Input */}
                <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 space-y-2">
                  <p className="text-[11px] font-semibold text-slate-300">+ Asignar Nueva Tarea al Comité</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Descripción de la tarea operativa..."
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                      className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (!newTaskTitle.trim()) return;
                        alert(`Tarea "${newTaskTitle}" asignada al comité "${activeCommitteeModal.committee.name}".`);
                        setNewTaskTitle('');
                      }}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                    >
                      Asignar
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
              <span className="text-xs text-slate-400">
                Coordinador a cargo: <strong className="text-white">{activeCommitteeModal.coordination.coordinatorName}</strong>
              </span>
              <button
                onClick={() => setActiveCommitteeModal(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                Cerrar Ventana
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
