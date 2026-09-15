import React, { useMemo, useState } from 'react';
import { 
  Building2, 
  CheckCircle2, 
  Compass, 
  Download, 
  ExternalLink, 
  Filter, 
  Flame, 
  FolderPlus, 
  HeartHandshake, 
  Layers, 
  Map, 
  MapPin, 
  Phone, 
  Plus, 
  Search, 
  ShieldCheck, 
  Sparkles, 
  Store, 
  Tag, 
  Target, 
  TrendingUp, 
  UserCheck, 
  UserPlus, 
  Users, 
  Utensils, 
  Wrench 
} from 'lucide-react';
import { EntrepreneurProspect, Leader, Tenant, UserProfile, UserRole } from '../types';
import { generateProspectsKml } from '../data/astreaEntrepreneursData';

interface ProspectsElectoralViewProps {
  prospects: EntrepreneurProspect[];
  currentTenant: Tenant;
  currentUser: UserProfile | null;
  userRole?: UserRole;
  onPromoteToLeader?: (prospect: EntrepreneurProspect) => void;
  onConvertToVoter?: (prospect: EntrepreneurProspect) => void;
  onUpdateProspectGroup?: (prospectId: string, newGroup: string) => void;
  onNavigateTab?: (tab: any) => void;
}

export const ProspectsElectoralView: React.FC<ProspectsElectoralViewProps> = ({
  prospects = [],
  currentTenant,
  currentUser,
  userRole,
  onPromoteToLeader,
  onConvertToVoter,
  onUpdateProspectGroup,
  onNavigateTab
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedActivity, setSelectedActivity] = useState<string>('todos');
  const [selectedLocation, setSelectedLocation] = useState<string>('todos');
  const [selectedRole, setSelectedRole] = useState<string>('todos');
  const [selectedGroup, setSelectedGroup] = useState<string>('todos');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [groupModalProspect, setGroupModalProspect] = useState<EntrepreneurProspect | null>(null);
  const [newGroupName, setNewGroupName] = useState('');

  // Available groups
  const existingGroups = useMemo(() => {
    const groups = new Set<string>();
    prospects.forEach((p) => {
      if (p.assignedGroupName) groups.add(p.assignedGroupName);
    });
    return Array.from(groups).sort();
  }, [prospects]);

  // Filtered prospects
  const filteredProspects = useMemo(() => {
    return prospects.filter((p) => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = p.fullName.toLowerCase().includes(q);
        const matchesDoc = p.documentId.toLowerCase().includes(q);
        const matchesPhone = (p.phone || '').includes(q);
        const matchesActivity = (p.economicActivity || '').toLowerCase().includes(q);
        const matchesSub = (p.subActivity || '').toLowerCase().includes(q);
        const matchesLoc = (p.locationCategory || '').toLowerCase().includes(q) || (p.veredaOrBarrio || '').toLowerCase().includes(q);
        if (!matchesName && !matchesDoc && !matchesPhone && !matchesActivity && !matchesSub && !matchesLoc) {
          return false;
        }
      }

      // Activity filter
      if (selectedActivity !== 'todos' && p.economicActivity !== selectedActivity) {
        return false;
      }

      // Location filter
      if (selectedLocation !== 'todos') {
        const loc = p.locationCategory.toLowerCase();
        const ver = (p.veredaOrBarrio || '').toLowerCase();
        const sel = selectedLocation.toLowerCase();
        if (!loc.includes(sel) && !ver.includes(sel)) return false;
      }

      // Role filter
      if (selectedRole !== 'todos' && p.electoralRole !== selectedRole) {
        return false;
      }

      // Group filter
      if (selectedGroup !== 'todos' && p.assignedGroupName !== selectedGroup) {
        return false;
      }

      return true;
    });
  }, [prospects, searchQuery, selectedActivity, selectedLocation, selectedRole, selectedGroup]);

  // Aggregated metrics
  const metrics = useMemo(() => {
    const total = prospects.length;
    const potentialLeaders = prospects.filter((p) => p.electoralRole === 'Líder de Equipo en Potencia').length;
    const totalPotentialVotes = prospects.reduce((acc, p) => acc + (p.potentialVotes || 15), 0);
    const victimsCount = prospects.filter((p) => p.isViolenceVictim).length;
    const storesCount = prospects.filter((p) => p.economicActivity.includes('Tienda') || p.economicActivity.includes('Comercio')).length;
    const foodCount = prospects.filter((p) => p.economicActivity.includes('Alimentos')).length;
    const ruralCount = prospects.filter((p) => p.locationCategory !== 'Casco Urbano Astrea').length;

    return {
      total,
      potentialLeaders,
      totalPotentialVotes,
      victimsCount,
      storesCount,
      foodCount,
      ruralCount
    };
  }, [prospects]);

  // Export KML
  const handleExportKml = () => {
    const kmlString = generateProspectsKml(filteredProspects, `Prospectos ${currentTenant.name} - Astrea 2026`);
    const blob = new Blob([kmlString], { type: 'application/vnd.google-earth.kml+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Prospectos_Emprendimientos_Astrea_2026.kml`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Export CSV
  const handleExportCsv = () => {
    const headers = [
      'WKT',
      'Numero_Identificacion',
      'Nombre_Completo',
      'Ubicacion',
      'Latitud',
      'Longitud',
      'Es_Victima',
      'Genero',
      'Actividad_Economica',
      'Detalle_Actividad',
      'Celular',
      'Rol_Electoral_Potencial',
      'Grupo_Asignado',
      'Votos_Potenciales'
    ];

    const rows = filteredProspects.map((p) => [
      `"${p.wkt || `POINT (${p.longitude} ${p.latitude})`}"`,
      `"${p.documentId}"`,
      `"${p.fullName}"`,
      `"${p.locationCategory} - ${p.veredaOrBarrio || ''}"`,
      p.latitude,
      p.longitude,
      p.isViolenceVictim ? 'Sí' : 'No',
      p.gender,
      `"${p.economicActivity}"`,
      `"${p.subActivity || ''}"`,
      `"${p.phone || ''}"`,
      `"${p.electoralRole}"`,
      `"${p.assignedGroupName || ''}"`,
      p.potentialVotes || 15
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Caracterizacion_Emprendedores_Astrea_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div id="prospects-electoral-view" className="space-y-6">
      {/* Top Banner & Header */}
      <div className="relative overflow-hidden rounded-3xl border border-cyan-500/30 bg-gradient-to-r from-slate-950 via-slate-900 to-cyan-950/40 p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(34,211,238,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,0.03)_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-black uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
              <span>Caracterización Socioeconómica & Electoral Astrea 2026</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-3">
              <span>Emprendimientos & Prospectos de Líderes</span>
              <span className="text-xs px-2.5 py-1 rounded-xl bg-cyan-950 border border-cyan-500/50 text-cyan-300 font-mono">
                {prospects.length} Caracterizados
              </span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-3xl leading-relaxed">
              Base viva georreferenciada con coordenadas reales GPS de comerciantes, artesanos, productores y vendedores de Astrea. 
              Organízalos por <strong>grupos sectoriales</strong>, asigna jefes de equipo y <strong>promuévelos directamente a Líderes de Campaña</strong>.
            </p>
          </div>

          {/* Quick Primary Actions */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {onNavigateTab && (
              <button
                type="button"
                onClick={() => onNavigateTab('map')}
                className="px-4 py-2.5 rounded-2xl bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-black text-xs transition flex items-center gap-2 shadow-lg shadow-cyan-950/50 cursor-pointer"
              >
                <Map className="w-4 h-4" />
                <span>Ver Ubicaciones en Mapa</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleExportKml}
              className="px-4 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs transition flex items-center gap-2 cursor-pointer hover:border-cyan-500/50"
              title="Descargar capa KML para Google Earth"
            >
              <Compass className="w-4 h-4 text-cyan-400" />
              <span>Exportar KML (Google Earth)</span>
            </button>
            <button
              type="button"
              onClick={handleExportCsv}
              className="px-4 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs transition flex items-center gap-2 cursor-pointer hover:border-emerald-500/50"
            >
              <Download className="w-4 h-4 text-emerald-400" />
              <span>Exportar CSV</span>
            </button>
          </div>
        </div>

        {/* Real-time KPI Stats Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-6 pt-6 border-t border-slate-800/80">
          <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800/80">
            <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-cyan-400" />
              Total Registros
            </span>
            <p className="text-xl font-black text-white mt-1">{metrics.total}</p>
            <span className="text-[10px] text-slate-500">100% Georreferenciados</span>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800/80">
            <span className="text-[11px] font-bold text-amber-300 flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-amber-400" />
              Líderes en Potencia
            </span>
            <p className="text-xl font-black text-amber-400 mt-1">{metrics.potentialLeaders}</p>
            <span className="text-[10px] text-amber-500/80">Comercio & Puntos Clave</span>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800/80">
            <span className="text-[11px] font-bold text-emerald-300 flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
              Potencial Electoral
            </span>
            <p className="text-xl font-black text-emerald-400 mt-1">~{metrics.totalPotentialVotes.toLocaleString()}</p>
            <span className="text-[10px] text-emerald-500/80">Votos Movilizables</span>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800/80">
            <span className="text-[11px] font-bold text-rose-300 flex items-center gap-1.5">
              <HeartHandshake className="w-3.5 h-3.5 text-rose-400" />
              Víctimas Conflicto
            </span>
            <p className="text-xl font-black text-rose-400 mt-1">{metrics.victimsCount}</p>
            <span className="text-[10px] text-rose-500/80">Enfoque de Inclusión</span>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800/80">
            <span className="text-[11px] font-bold text-cyan-300 flex items-center gap-1.5">
              <Store className="w-3.5 h-3.5 text-cyan-400" />
              Comercio & Tiendas
            </span>
            <p className="text-xl font-black text-cyan-300 mt-1">{metrics.storesCount}</p>
            <span className="text-[10px] text-cyan-500/80">Puntos de Venta</span>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800/80">
            <span className="text-[11px] font-bold text-indigo-300 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-indigo-400" />
              Área Rural
            </span>
            <p className="text-xl font-black text-indigo-300 mt-1">{metrics.ruralCount}</p>
            <span className="text-[10px] text-indigo-500/80">Arjona & Veredas</span>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="p-5 rounded-3xl bg-slate-900/70 border border-slate-800 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Search Input */}
          <div className="relative flex-1 max-w-lg">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por nombre, cédula, teléfono, vereda o actividad..."
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white"
              >
                ✕
              </button>
            )}
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="inline-flex rounded-xl bg-slate-950 p-1 border border-slate-800">
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  viewMode === 'cards' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Tarjetas</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  viewMode === 'table' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Tabla Detallada</span>
              </button>
            </div>
          </div>
        </div>

        {/* Dropdown Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-slate-800/60">
          {/* Activity */}
          <div>
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
              Sector / Actividad:
            </label>
            <select
              value={selectedActivity}
              onChange={(e) => setSelectedActivity(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 cursor-pointer"
            >
              <option value="todos">Todos los Sectores</option>
              <option value="Tienda o Comercio Local">Tienda o Comercio Local</option>
              <option value="Venta Ambulante">Venta Ambulante</option>
              <option value="Venta de Alimentos">Venta de Alimentos</option>
              <option value="Artesanías">Artesanías & Confección</option>
              <option value="Talleres y Servicios">Talleres & Servicios</option>
              <option value="Agropecuario y Cría">Agropecuario & Cría</option>
              <option value="Otros Emprendimientos">Otros Emprendimientos</option>
            </select>
          </div>

          {/* Location */}
          <div>
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
              Ubicación Territorial:
            </label>
            <select
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 cursor-pointer"
            >
              <option value="todos">Todo el Municipio</option>
              <option value="Casco Urbano">Casco Urbano Astrea</option>
              <option value="Arjona">Corregimiento de Arjona</option>
              <option value="Vereda">Veredas Rurales</option>
              <option value="Finca">Fincas</option>
            </select>
          </div>

          {/* Electoral Role */}
          <div>
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
              Rol Proyectado de Campaña:
            </label>
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 cursor-pointer"
            >
              <option value="todos">Todos los Roles</option>
              <option value="Líder de Equipo en Potencia">Líder de Equipo en Potencia</option>
              <option value="Votante Comprometido">Votante Comprometido</option>
              <option value="Punto de Encuentro / Logístico">Punto de Encuentro / Logístico</option>
              <option value="Multiplicador Territorial">Multiplicador Territorial</option>
            </select>
          </div>

          {/* Group */}
          <div>
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
              Grupo / Equipo Asignado:
            </label>
            <select
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 cursor-pointer"
            >
              <option value="todos">Todos los Grupos</option>
              {existingGroups.map((grp) => (
                <option key={grp} value={grp}>{grp}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Results Counter Bar */}
      <div className="flex items-center justify-between text-xs text-slate-400 px-1">
        <span>Mostrando <strong>{filteredProspects.length}</strong> de <strong>{prospects.length}</strong> registros</span>
        {(selectedActivity !== 'todos' || selectedLocation !== 'todos' || selectedRole !== 'todos' || selectedGroup !== 'todos' || searchQuery) && (
          <button
            type="button"
            onClick={() => {
              setSelectedActivity('todos');
              setSelectedLocation('todos');
              setSelectedRole('todos');
              setSelectedGroup('todos');
              setSearchQuery('');
            }}
            className="text-cyan-400 hover:text-cyan-300 font-bold underline cursor-pointer text-[11px]"
          >
            Limpiar todos los filtros
          </button>
        )}
      </div>

      {/* CARDS VIEW */}
      {viewMode === 'cards' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProspects.map((prospect) => (
            <div
              key={prospect.id}
              className="p-5 rounded-3xl bg-slate-900/50 border border-slate-800/80 hover:border-cyan-500/50 transition-all hover:shadow-xl hover:shadow-cyan-950/30 flex flex-col justify-between space-y-4 group"
            >
              <div className="space-y-3">
                {/* Header with Badges */}
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/80 px-2 py-0.5 rounded-md border border-cyan-800">
                      Cédula: {prospect.documentId}
                    </span>
                    <h3 className="font-bold text-white group-hover:text-cyan-200 transition text-sm leading-snug">
                      {prospect.fullName}
                    </h3>
                  </div>

                  <span className={`px-2.5 py-1 rounded-xl text-[10px] font-black uppercase shrink-0 border ${
                    prospect.electoralRole === 'Líder de Equipo en Potencia'
                      ? 'bg-amber-950/80 text-amber-300 border-amber-500/50'
                      : prospect.electoralRole === 'Punto de Encuentro / Logístico'
                      ? 'bg-purple-950/80 text-purple-300 border-purple-500/50'
                      : 'bg-emerald-950/80 text-emerald-300 border-emerald-500/50'
                  }`}>
                    {prospect.electoralRole}
                  </span>
                </div>

                {/* Location & Coordinates */}
                <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800/60 text-xs space-y-1.5">
                  <div className="flex items-center justify-between text-slate-300">
                    <span className="flex items-center gap-1 text-[11px]">
                      <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                      <strong>{prospect.locationCategory}</strong> {prospect.veredaOrBarrio ? `(${prospect.veredaOrBarrio})` : ''}
                    </span>
                    {prospect.isViolenceVictim && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-rose-950/80 text-rose-300 border border-rose-800 font-bold">
                        Víctima
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                    <span>GPS: {prospect.latitude.toFixed(5)}, {prospect.longitude.toFixed(5)}</span>
                    <a
                      href={`https://www.google.com/maps?q=${prospect.latitude},${prospect.longitude}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-cyan-400 hover:underline flex items-center gap-0.5"
                    >
                      <span>Abrir</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>
                </div>

                {/* Activity & Detail */}
                <div className="space-y-1 text-xs">
                  <div className="flex items-center gap-1.5 text-slate-300">
                    <Store className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span className="font-semibold">{prospect.economicActivity}</span>
                  </div>
                  {prospect.subActivity && (
                    <p className="text-[11px] text-slate-400 pl-5 italic">
                      "{prospect.subActivity}"
                    </p>
                  )}
                </div>

                {/* Assigned Group Pill */}
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                    <Tag className="w-3 h-3 text-cyan-400" />
                    Grupo:
                  </span>
                  <span className="text-[11px] font-semibold text-slate-200 bg-slate-800 px-2 py-0.5 rounded-lg border border-slate-700">
                    {prospect.assignedGroupName || 'Sin grupo'}
                  </span>
                </div>
              </div>

              {/* Bottom Card Actions */}
              <div className="pt-3 border-t border-slate-800/80 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  {prospect.phone ? (
                    <a
                      href={`tel:${prospect.phone}`}
                      className="text-cyan-400 hover:text-cyan-300 font-bold flex items-center gap-1.5 text-[11px]"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      <span>{prospect.phone}</span>
                    </a>
                  ) : (
                    <span className="text-[11px] text-slate-500 italic">Sin teléfono registrado</span>
                  )}
                  <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" />
                    ~{prospect.potentialVotes} votos
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  {onPromoteToLeader && (
                    <button
                      type="button"
                      onClick={() => onPromoteToLeader(prospect)}
                      className="px-3 py-1.5 rounded-xl bg-amber-950/70 hover:bg-amber-900 text-amber-200 border border-amber-600/60 font-bold text-[11px] transition flex items-center justify-center gap-1 cursor-pointer"
                      title="Promover a Líder territorial oficial con meta de votos"
                    >
                      <UserPlus className="w-3.5 h-3.5 text-amber-400" />
                      <span>Hacer Líder</span>
                    </button>
                  )}
                  {onConvertToVoter && (
                    <button
                      type="button"
                      onClick={() => onConvertToVoter(prospect)}
                      className="px-3 py-1.5 rounded-xl bg-cyan-950/70 hover:bg-cyan-900 text-cyan-200 border border-cyan-600/60 font-bold text-[11px] transition flex items-center justify-center gap-1 cursor-pointer"
                      title="Registrar como votante comprometido en la base"
                    >
                      <UserCheck className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Votante</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TABLE VIEW */}
      {viewMode === 'table' && (
        <div className="rounded-3xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3.5">Cédula</th>
                  <th className="px-4 py-3.5">Nombre Completo</th>
                  <th className="px-4 py-3.5">Ubicación & GPS</th>
                  <th className="px-4 py-3.5">Actividad Económica</th>
                  <th className="px-4 py-3.5">Teléfono</th>
                  <th className="px-4 py-3.5">Rol Proyectado</th>
                  <th className="px-4 py-3.5">Grupo</th>
                  <th className="px-4 py-3.5 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {filteredProspects.map((prospect) => (
                  <tr key={prospect.id} className="hover:bg-slate-800/40 transition">
                    <td className="px-4 py-3 font-mono text-cyan-300 whitespace-nowrap">{prospect.documentId}</td>
                    <td className="px-4 py-3 text-white font-bold whitespace-nowrap">{prospect.fullName}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="space-y-0.5">
                        <span className="text-slate-200">{prospect.locationCategory} {prospect.veredaOrBarrio ? `(${prospect.veredaOrBarrio})` : ''}</span>
                        <div className="text-[10px] text-slate-500 font-mono">
                          {prospect.latitude.toFixed(4)}, {prospect.longitude.toFixed(4)}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-slate-200">{prospect.economicActivity}</span>
                      {prospect.subActivity && <span className="text-slate-400 text-[11px] block italic">{prospect.subActivity}</span>}
                    </td>
                    <td className="px-4 py-3 font-mono whitespace-nowrap">
                      {prospect.phone ? (
                        <a href={`tel:${prospect.phone}`} className="text-cyan-400 hover:underline">
                          {prospect.phone}
                        </a>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-800 text-slate-200 border border-slate-700">
                        {prospect.electoralRole}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-[11px] text-slate-300 bg-slate-950 px-2 py-1 rounded-md border border-slate-800">
                        {prospect.assignedGroupName || 'Sin grupo'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        {onPromoteToLeader && (
                          <button
                            type="button"
                            onClick={() => onPromoteToLeader(prospect)}
                            className="px-2 py-1 rounded-lg bg-amber-950 hover:bg-amber-900 text-amber-300 border border-amber-700/60 font-bold text-[10px] transition cursor-pointer"
                          >
                            Hacer Líder
                          </button>
                        )}
                        {onConvertToVoter && (
                          <button
                            type="button"
                            onClick={() => onConvertToVoter(prospect)}
                            className="px-2 py-1 rounded-lg bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-700/60 font-bold text-[10px] transition cursor-pointer"
                          >
                            Votante
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
