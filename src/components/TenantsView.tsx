import React, { useState, useEffect, useMemo } from 'react';
import {
  Tenant,
  UserRole,
  UserProfile,
  Candidate,
  CampaignExpense,
  Leader,
  TransportVehicle,
  DonorContribution
} from '../types';
import { generarIdDocumentoLegible } from '../lib/slugify';
import { AuthorHeader } from './common/AuthorHeader';
import {
  Building2,
  Plus,
  Shield,
  CheckCircle2,
  Palette,
  Layers,
  X,
  Database,
  Users,
  DollarSign,
  Truck,
  Target,
  FileSpreadsheet,
  Globe,
  Lock,
  ArrowRight,
  Sparkles,
  RefreshCw,
  Edit2,
  Trash2,
  HelpCircle
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Cell
} from 'recharts';

interface TenantsViewProps {
  tenants: Tenant[];
  currentTenant: Tenant;
  onSelectTenant: (tenant: Tenant) => void;
  onAddTenant: (tenant: Tenant) => void;
  onUpdateTenant?: (tenant: Tenant) => void;
  onDeleteTenant?: (tenantId: string) => void;
  userRole: UserRole;
  users?: UserProfile[];
  candidates?: Candidate[];
  expenses?: CampaignExpense[];
  leaders?: Leader[];
  vehicles?: TransportVehicle[];
  donorContributions?: DonorContribution[];
}

export const TenantsView: React.FC<TenantsViewProps> = ({
  tenants,
  currentTenant,
  onSelectTenant,
  onAddTenant,
  onUpdateTenant,
  onDeleteTenant,
  userRole,
  users = [],
  candidates = [],
  expenses = [],
  leaders = [],
  vehicles = [],
  donorContributions = [],
}) => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [tenantToDelete, setTenantToDelete] = useState<Tenant | null>(null);

  // New Tenant Form State
  const [tenantName, setTenantName] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#2563eb');
  const [secondaryColor, setSecondaryColor] = useState('#3b82f6');
  const [logoUrl, setLogoUrl] = useState('');
  const [generatedTenantId, setGeneratedTenantId] = useState('');

  // Auto generate predictive slug for new tenant
  useEffect(() => {
    const id = generarIdDocumentoLegible('partido', tenantName || 'movimiento-politico');
    setGeneratedTenantId(id);
  }, [tenantName]);

  // Compute Per-Tenant Metrics for Multi-Tenant Isolation comparison
  const tenantMetrics = useMemo(() => {
    return tenants.map((t) => {
      const tCandidates = candidates.filter((c) => c.tenantId === t.tenantId);
      const tExpenses = expenses.filter((e) => e.tenantId === t.tenantId);
      const tLeaders = leaders.filter((l) => l.tenantId === t.tenantId);
      const tVehicles = vehicles.filter((v) => v.tenantId === t.tenantId);
      const tDonations = donorContributions.filter((d) => d.tenantId === t.tenantId);

      const totalSpent = tExpenses.reduce((sum, e) => sum + e.amount, 0);
      const totalPledgedVotes = tLeaders.reduce((sum, l) => sum + l.votesCommitted, 0);
      const totalTargetVotes = tLeaders.reduce((sum, l) => sum + l.voteTarget, 0);

      return {
        tenant: t,
        candidatesCount: tCandidates.length,
        expensesTotal: totalSpent,
        expensesCount: tExpenses.length,
        leadersCount: tLeaders.length,
        vehiclesCount: tVehicles.length,
        donationsCount: tDonations.length,
        pledgedVotes: totalPledgedVotes,
        targetVotes: totalTargetVotes || 5000,
        coveragePct: totalTargetVotes > 0 ? ((totalPledgedVotes / totalTargetVotes) * 100).toFixed(1) : '0.0'
      };
    });
  }, [tenants, candidates, expenses, leaders, vehicles, donorContributions]);

  const handleCreateTenant = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantName.trim()) return;

    const newTenant: Tenant = {
      tenantId: generatedTenantId || `partido-${Date.now()}`,
      name: tenantName.trim(),
      primaryColor,
      secondaryColor,
      logoUrl: logoUrl.trim() || 'https://images.unsplash.com/photo-1540910419892-4a36d2c3266c?w=150',
      createdAt: new Date().toISOString(),
      active: true,
    };

    onAddTenant(newTenant);
    setShowCreateModal(false);
    setTenantName('');
    setLogoUrl('');
  };

  const handleOpenEdit = (t: Tenant) => {
    setEditingTenant(t);
    setTenantName(t.name);
    setPrimaryColor(t.primaryColor);
    setSecondaryColor(t.secondaryColor || '#3b82f6');
    setLogoUrl(t.logoUrl || '');
    setShowEditModal(true);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTenant || !tenantName.trim()) return;

    const updated: Tenant = {
      ...editingTenant,
      name: tenantName.trim(),
      primaryColor,
      secondaryColor,
      logoUrl: logoUrl.trim() || editingTenant.logoUrl,
    };

    if (onUpdateTenant) {
      onUpdateTenant(updated);
    }
    setShowEditModal(false);
    setEditingTenant(null);
  };

  const handleConfirmDelete = () => {
    if (!tenantToDelete) return;
    if (tenants.length <= 1) {
      alert('Debe existir al menos un partido u organización activa en el sistema.');
      setTenantToDelete(null);
      return;
    }
    if (onDeleteTenant) {
      onDeleteTenant(tenantToDelete.tenantId);
    }
    setTenantToDelete(null);
  };

  const formatCOP = (val: number) => `$${val.toLocaleString('es-CO')} COP`;

  return (
    <div className="space-y-6">
      
      {/* AUTHOR HEADER */}
      <AuthorHeader
        title="Gestión de Partidos Políticos & Organizaciones"
        subtitle="Ingresa, modifica el nombre, colores, logo o elimina partidos y movimientos políticos con persistencia en Firestore"
      />

      {/* QUICK INSTRUCTIONAL GUIDE */}
      <div className="bg-gradient-to-r from-blue-950/70 via-slate-900 to-indigo-950/70 border border-blue-500/30 rounded-3xl p-5 shadow-xl">
        <div className="flex items-start gap-3.5">
          <div className="p-2.5 bg-blue-600/30 text-blue-300 rounded-2xl border border-blue-500/40 shrink-0">
            <HelpCircle className="w-5 h-5" />
          </div>
          <div className="space-y-2">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              ¿Dónde y cómo ingresar, modificar o eliminar el nombre de tu partido político?
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs text-slate-300">
              <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 space-y-1">
                <strong className="text-blue-400 block font-semibold">1. Ingresar Nuevo Partido:</strong>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  Haz clic en el botón azul <span className="text-white font-bold">"+ Ingresar Nuevo Partido"</span> para registrar cualquier partido o movimiento.
                </p>
              </div>
              <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 space-y-1">
                <strong className="text-amber-400 block font-semibold">2. Modificar Nombre:</strong>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  Haz clic en el botón <span className="text-white font-bold">"✏️ Modificar"</span> en la tarjeta de tu partido para editar su nombre, colores o logotipo.
                </p>
              </div>
              <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 space-y-1">
                <strong className="text-rose-400 block font-semibold">3. Eliminar Partido:</strong>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  Haz clic en el ícono de basura <span className="text-white font-bold">"🗑️"</span> para remover partidos no requeridos.
                </p>
              </div>
              <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 space-y-1">
                <strong className="text-emerald-400 block font-semibold">4. Activar Partido:</strong>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  Haz clic en <span className="text-white font-bold">"Activar este Partido"</span> para trabajar con los datos de esa organización.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* TOP SUMMARY & TENANT PROVISIONING BANNER */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-5 shadow-xl">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="p-2 bg-blue-500/20 text-blue-400 rounded-xl border border-blue-500/30">
              <Building2 className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-bold text-white tracking-tight">
              Partido / Organización Activa: <span className="text-blue-400">{currentTenant.name}</span>
            </h2>
          </div>
          <p className="text-xs text-slate-400">
            Cada consulta, gráfico, reporte de gastos, líderes y candidatos está estrictamente aislado por <code className="text-blue-300 font-mono bg-slate-950 px-1.5 py-0.5 rounded border border-blue-500/30">tenantId: {currentTenant.tenantId}</code>.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => handleOpenEdit(currentTenant)}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
          >
            <Edit2 className="w-4 h-4 text-blue-400" />
            Modificar Nombre de {currentTenant.name}
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-blue-600/30 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Ingresar Nuevo Partido Político
          </button>
        </div>
      </div>

      {/* ARCHITECTURE ISOLATION PILLARS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4.5 space-y-2">
          <div className="flex items-center gap-2 text-emerald-400">
            <Lock className="w-4 h-4" />
            <h3 className="font-bold text-xs uppercase tracking-wider text-white">1. Aislamiento de Datos</h3>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Ninguna campaña u organización puede leer ni modificar gastos, líderes ni vehículos de otro comando político. Todo documento Firestore incluye clave <span className="font-mono text-emerald-300 font-bold">tenantId</span>.
          </p>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4.5 space-y-2">
          <div className="flex items-center gap-2 text-blue-400">
            <Palette className="w-4 h-4" />
            <h3 className="font-bold text-xs uppercase tracking-wider text-white">2. Branding e Identidad</h3>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Cada organización cuenta con su propio logotipo, paleta cromática (color primario y secundario), municipios asignados y directrices de campaña personalizadas.
          </p>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4.5 space-y-2">
          <div className="flex items-center gap-2 text-indigo-400">
            <Globe className="w-4 h-4" />
            <h3 className="font-bold text-xs uppercase tracking-wider text-white">3. Escalabilidad SaaS</h3>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Capacidad para hospedar simultáneamente a más de 1.000 alcaldías, concejos y gobernaciones bajo la misma infraestructura Serverless de Google Cloud.
          </p>
        </div>
      </div>

      {/* TENANT CARDS GRID */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Building2 className="w-5 h-5 text-blue-400" />
            Organizaciones Registradas ({tenants.length})
          </h3>
          <span className="text-xs text-slate-400">Selecciona un tenant para cambiar de espacio de trabajo</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {tenantMetrics.map(({ tenant: t, candidatesCount, expensesTotal, leadersCount, vehiclesCount, pledgedVotes, coveragePct }) => {
            const isSelected = t.tenantId === currentTenant.tenantId;

            return (
              <div
                key={t.tenantId}
                className={`bg-slate-900 border rounded-3xl p-5 flex flex-col justify-between transition-all relative overflow-hidden ${
                  isSelected
                    ? 'border-blue-500 ring-2 ring-blue-500/30 shadow-xl shadow-blue-500/10'
                    : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                {isSelected && (
                  <div className="absolute top-0 right-0 bg-blue-600 text-white text-[9px] font-bold px-3 py-1 rounded-bl-xl uppercase tracking-wider flex items-center gap-1 shadow-md">
                    <CheckCircle2 className="w-3 h-3" /> Tenant Activo
                  </div>
                )}

                <div>
                  <div className="flex items-center gap-3.5 mb-4">
                    <div
                      className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-black text-lg shadow-inner border border-white/20 shrink-0"
                      style={{ backgroundColor: t.primaryColor }}
                    >
                      {t.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="pr-12">
                      <h4 className="font-bold text-white text-base leading-tight">{t.name}</h4>
                      <p className="text-[10px] font-mono text-slate-400 mt-0.5">{t.tenantId}</p>
                    </div>
                  </div>

                  {/* Metrics Badges */}
                  <div className="grid grid-cols-2 gap-2 my-3 p-3 bg-slate-950/80 rounded-2xl border border-slate-800/80 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-500 block uppercase font-bold">Gasto Registrado</span>
                      <span className="text-xs font-bold text-emerald-400 font-mono">{formatCOP(expensesTotal)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block uppercase font-bold">Líderes Activos</span>
                      <span className="text-xs font-bold text-blue-300 font-mono">{leadersCount} líderes</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block uppercase font-bold">Vehículos</span>
                      <span className="text-xs font-bold text-amber-300 font-mono">{vehiclesCount} unidades</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block uppercase font-bold">Votos Comprometidos</span>
                      <span className="text-xs font-bold text-purple-300 font-mono">{pledgedVotes} ({coveragePct}%)</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: t.primaryColor }}></span>
                      Color de Marca
                    </span>
                    <span className="text-emerald-400 font-bold text-[11px] flex items-center gap-1">
                      <Database className="w-3 h-3" /> Firestore Scoped
                    </span>
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                  <button
                    onClick={() => handleOpenEdit(t)}
                    className="flex items-center gap-1.5 px-3 py-2 text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition text-xs font-bold cursor-pointer"
                    title="Modificar nombre, logo y colores de este partido"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-blue-400" />
                    <span>Modificar</span>
                  </button>

                  {tenants.length > 1 && (
                    <button
                      onClick={() => setTenantToDelete(t)}
                      className="p-2 text-slate-400 hover:text-rose-400 bg-slate-800 hover:bg-rose-950/40 border border-slate-700 hover:border-rose-500/40 rounded-xl transition cursor-pointer"
                      title="Eliminar este partido político"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}

                  <button
                    onClick={() => onSelectTenant(t)}
                    disabled={isSelected}
                    className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition cursor-pointer text-center ${
                      isSelected
                        ? 'bg-slate-800 text-slate-500 cursor-default'
                        : 'bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/20'
                    }`}
                  >
                    {isSelected ? 'Partido Actual' : 'Activar este Partido'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* CROSS-TENANT COMPARISON TABLE (ADMIN GLOBAL VIEW) */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h3 className="font-bold text-white text-base flex items-center gap-2">
              <Shield className="w-5 h-5 text-indigo-400" />
              Consola Central Multi-Tenant (Auditoría Global)
            </h3>
            <p className="text-xs text-slate-400">
              Comparativo de infraestructura, finanzas y cobertura territorial entre organizaciones.
            </p>
          </div>
          <span className="text-xs font-mono bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 px-2.5 py-1 rounded-xl font-bold">
            Total Tenants: {tenants.length}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 uppercase font-bold text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Organización / Tenant ID</th>
                <th className="py-3 px-4">Candidatos</th>
                <th className="py-3 px-4">Líderes Veredales</th>
                <th className="py-3 px-4">Vehículos</th>
                <th className="py-3 px-4">Gasto Total (COP)</th>
                <th className="py-3 px-4">Meta Votos</th>
                <th className="py-3 px-4 text-center">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {tenantMetrics.map(({ tenant: t, candidatesCount, expensesTotal, leadersCount, vehiclesCount, pledgedVotes, coveragePct }) => (
                <tr key={t.tenantId} className="hover:bg-slate-800/40 transition">
                  <td className="py-3 px-4">
                    <div className="font-bold text-white text-xs flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: t.primaryColor }}></span>
                      {t.name}
                    </div>
                    <div className="text-[10px] font-mono text-slate-400">{t.tenantId}</div>
                  </td>
                  <td className="py-3 px-4 font-mono font-bold text-white">{candidatesCount}</td>
                  <td className="py-3 px-4 font-mono font-bold text-blue-300">{leadersCount}</td>
                  <td className="py-3 px-4 font-mono font-bold text-amber-300">{vehiclesCount}</td>
                  <td className="py-3 px-4 font-mono font-bold text-emerald-400">{formatCOP(expensesTotal)}</td>
                  <td className="py-3 px-4 font-mono">
                    <div>{pledgedVotes} votos</div>
                    <div className="text-[10px] text-purple-400">{coveragePct}% cobertura</div>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className="bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 px-2 py-0.5 rounded-full text-[10px] font-bold">
                      Aislado & Activo
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE NEW TENANT MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-500/20 text-blue-400 rounded-xl">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Aprovisionar Nueva Organización</h3>
                  <p className="text-xs text-slate-400">Creación con aislamiento estricto en Firestore</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* PREDICTIVE ID PREVIEW */}
            <div className="bg-slate-950 border border-blue-500/30 p-3 rounded-2xl flex items-center justify-between text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-blue-400 tracking-wider block">
                  Identificador Único Firestore:
                </span>
                <span className="font-mono font-bold text-white text-xs">/organizaciones/{generatedTenantId}</span>
              </div>
              <span className="text-[9px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-md font-bold">
                Auto-generado
              </span>
            </div>

            <form onSubmit={handleCreateTenant} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-300 mb-1">Nombre de la Organización / Comando *</label>
                <input
                  type="text"
                  placeholder="Ej: Pacto Histórico Cesar 2026 / Unidad por Astrea"
                  value={tenantName}
                  onChange={(e) => setTenantName(e.target.value)}
                  className="w-full bg-slate-800 text-white text-xs border border-slate-700 rounded-xl px-3 py-2 focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Color Primario</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                    />
                    <input
                      type="text"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="w-full bg-slate-800 text-white font-mono text-xs border border-slate-700 rounded-xl px-2 py-1.5"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">Color Secundario</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={secondaryColor}
                      onChange={(e) => setSecondaryColor(e.target.value)}
                      className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                    />
                    <input
                      type="text"
                      value={secondaryColor}
                      onChange={(e) => setSecondaryColor(e.target.value)}
                      className="w-full bg-slate-800 text-white font-mono text-xs border border-slate-700 rounded-xl px-2 py-1.5"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">URL de Logotipo / Emblema (Opcional)</label>
                <input
                  type="url"
                  placeholder="https://ejemplo.com/logo-partido.png"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  className="w-full bg-slate-800 text-white text-xs border border-slate-700 rounded-xl px-3 py-2"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 font-bold rounded-xl text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-blue-600/30"
                >
                  Guardar & Aprovisionar en Firestore
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT TENANT MODAL */}
      {showEditModal && editingTenant && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-500/20 text-blue-400 rounded-xl">
                  <Edit2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Editar Parámetros del Tenant</h3>
                  <p className="text-xs text-slate-400">ID: {editingTenant.tenantId}</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-300 mb-1">Nombre de la Organización *</label>
                <input
                  type="text"
                  value={tenantName}
                  onChange={(e) => setTenantName(e.target.value)}
                  className="w-full bg-slate-800 text-white text-xs border border-slate-700 rounded-xl px-3 py-2 focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Color Primario</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                    />
                    <input
                      type="text"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="w-full bg-slate-800 text-white font-mono text-xs border border-slate-700 rounded-xl px-2 py-1.5"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">Color Secundario</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={secondaryColor}
                      onChange={(e) => setSecondaryColor(e.target.value)}
                      className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                    />
                    <input
                      type="text"
                      value={secondaryColor}
                      onChange={(e) => setSecondaryColor(e.target.value)}
                      className="w-full bg-slate-800 text-white font-mono text-xs border border-slate-700 rounded-xl px-2 py-1.5"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 font-bold rounded-xl text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-blue-600/30"
                >
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {tenantToDelete && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-rose-500/40 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-fade-in">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-rose-500/20 text-rose-400 rounded-2xl border border-rose-500/30">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">¿Eliminar Partido Político?</h3>
                <p className="text-xs text-rose-300 font-medium">Esta acción eliminará el partido del sistema.</p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-950 rounded-2xl border border-slate-800 text-xs text-slate-300 space-y-1">
              <p>
                Estás a punto de eliminar el partido: <strong className="text-white">{tenantToDelete.name}</strong>
              </p>
              <p className="text-[11px] text-slate-400 font-mono">
                Identificador: {tenantToDelete.tenantId}
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setTenantToDelete(null)}
                className="px-4 py-2 bg-slate-800 text-slate-300 font-bold rounded-xl text-xs cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-rose-600/30 cursor-pointer"
              >
                Sí, Eliminar Partido
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
