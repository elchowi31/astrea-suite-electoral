import React, { useState, useMemo } from 'react';
import {
  Tenant,
  CampaignExpense,
  Leader,
  CampaignPhase,
  FinancialRubro,
  ExpenseComponent,
  TransportVehicle,
  DonorContribution,
  UserRole
} from '../types';
import { AuthorHeader } from './common/AuthorHeader';
import {
  DollarSign,
  Plus,
  Edit2,
  Trash2,
  Download,
  Filter,
  Search,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  Fuel,
  Car,
  Utensils,
  Megaphone,
  Users,
  ShieldCheck,
  RotateCcw,
  Sliders,
  Calendar,
  Layers,
  ChevronDown,
  FileText,
  X
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  Cell,
  PieChart,
  Pie
} from 'recharts';

interface CampaignCostsReportViewProps {
  currentTenant: Tenant;
  userRole?: UserRole;
  expenses: CampaignExpense[];
  leaders?: Leader[];
  vehicles?: TransportVehicle[];
  donorContributions?: DonorContribution[];
  onAddExpense: (expense: CampaignExpense) => void;
  onUpdateExpense?: (expense: CampaignExpense) => void;
  onDeleteExpense?: (expenseId: string) => void;
  onNavigateTab?: (tab: any) => void;
}

export const CampaignCostsReportView: React.FC<CampaignCostsReportViewProps> = ({
  currentTenant,
  userRole = 'AdminGlobal',
  expenses,
  leaders = [],
  vehicles = [],
  donorContributions = [],
  onAddExpense,
  onUpdateExpense,
  onDeleteExpense,
  onNavigateTab
}) => {
  // Navigation & Sub-views
  const [activeSubTab, setActiveSubTab] = useState<'gastos_list' | 'leaders_needs' | 'projection_planning'>('gastos_list');

  // Filters State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedPhase, setSelectedPhase] = useState<string>('TODAS');
  const [selectedRubro, setSelectedRubro] = useState<string>('TODOS');
  const [selectedStatus, setSelectedStatus] = useState<string>('TODOS');

  // Modal State for Expense Creation / Modification
  const [showExpenseModal, setShowExpenseModal] = useState<boolean>(false);
  const [editingExpense, setEditingExpense] = useState<CampaignExpense | null>(null);

  // Form State
  const [formPhase, setFormPhase] = useState<CampaignPhase>('Campaña Oficial');
  const [formRubro, setFormRubro] = useState<FinancialRubro>('Combustible');
  const [formDescription, setFormDescription] = useState<string>('');
  const [formAmount, setFormAmount] = useState<number>(0);
  const [formQuantity, setFormQuantity] = useState<number>(1);
  const [formUnitCost, setFormUnitCost] = useState<number>(0);
  const [formUnitMeasure, setFormUnitMeasure] = useState<string>('Unidad');
  const [formSupplier, setFormSupplier] = useState<string>('');
  const [formInvoiceNumber, setFormInvoiceNumber] = useState<string>('');
  const [formDate, setFormDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [formStatus, setFormStatus] = useState<'Pagado' | 'Pendiente' | 'Aprobado'>('Pendiente');
  const [formLeaderId, setFormLeaderId] = useState<string>('');
  const [formVehiclePlate, setFormVehiclePlate] = useState<string>('');
  const [formNotes, setFormNotes] = useState<string>('');

  // Tenant filtered expenses
  const tenantExpenses = useMemo(() => {
    return expenses.filter(e => e.tenantId === currentTenant.tenantId);
  }, [expenses, currentTenant]);

  const tenantLeaders = useMemo(() => {
    return leaders.filter(l => l.tenantId === currentTenant.tenantId);
  }, [leaders, currentTenant]);

  // Filtered List
  const filteredExpenses = useMemo(() => {
    return tenantExpenses.filter(e => {
      const matchSearch = searchQuery === '' || 
        e.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (e.supplier && e.supplier.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (e.invoiceNumber && e.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchPhase = selectedPhase === 'TODAS' || e.phase === selectedPhase;
      const matchRubro = selectedRubro === 'TODOS' || e.rubro === selectedRubro || e.component === selectedRubro;
      const matchStatus = selectedStatus === 'TODOS' || e.status === selectedStatus;
      return matchSearch && matchPhase && matchRubro && matchStatus;
    });
  }, [tenantExpenses, searchQuery, selectedPhase, selectedRubro, selectedStatus]);

  // Aggregate Metrics
  const totalEjecutado = useMemo(() => {
    return tenantExpenses.reduce((sum, e) => sum + e.amount, 0);
  }, [tenantExpenses]);

  const totalPrecampana = useMemo(() => {
    return tenantExpenses.filter(e => e.phase === 'Precampaña').reduce((sum, e) => sum + e.amount, 0);
  }, [tenantExpenses]);

  const totalCampana = useMemo(() => {
    return tenantExpenses.filter(e => e.phase === 'Campaña Oficial' || !e.phase).reduce((sum, e) => sum + e.amount, 0);
  }, [tenantExpenses]);

  const totalDiaD = useMemo(() => {
    return tenantExpenses.filter(e => e.phase === 'Día D (Electoral)').reduce((sum, e) => sum + e.amount, 0);
  }, [tenantExpenses]);

  // Rubro Breakdown for Chart
  const rubroBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    tenantExpenses.forEach(e => {
      const r = e.rubro || e.component || 'Otros';
      map[r] = (map[r] || 0) + e.amount;
    });
    return Object.entries(map).map(([name, total]) => ({
      name,
      total,
      display: `$${(total / 1000000).toFixed(1)}M`
    })).sort((a, b) => b.total - a.total);
  }, [tenantExpenses]);

  // Open Modal for Create or Edit
  const handleOpenCreateModal = () => {
    setEditingExpense(null);
    setFormPhase('Campaña Oficial');
    setFormRubro('Combustible');
    setFormDescription('');
    setFormAmount(0);
    setFormQuantity(1);
    setFormUnitCost(0);
    setFormUnitMeasure('Unidad');
    setFormSupplier('');
    setFormInvoiceNumber('');
    setFormDate(new Date().toISOString().split('T')[0]);
    setFormStatus('Pendiente');
    setFormLeaderId('');
    setFormVehiclePlate('');
    setFormNotes('');
    setShowExpenseModal(true);
  };

  const handleOpenEditModal = (exp: CampaignExpense) => {
    setEditingExpense(exp);
    setFormPhase(exp.phase || 'Campaña Oficial');
    setFormRubro(exp.rubro || (exp.component as FinancialRubro) || 'Combustible');
    setFormDescription(exp.description);
    setFormAmount(exp.amount);
    setFormQuantity(exp.quantity || 1);
    setFormUnitCost(exp.unitCost || exp.amount);
    setFormUnitMeasure(exp.unitMeasure || 'Unidades');
    setFormSupplier(exp.supplier || '');
    setFormInvoiceNumber(exp.invoiceNumber || '');
    setFormDate(exp.date);
    setFormStatus(exp.status);
    setFormLeaderId(exp.responsibleLeaderId || '');
    setFormVehiclePlate(exp.vehiclePlate || '');
    setFormNotes(exp.notes || '');
    setShowExpenseModal(true);
  };

  const handleSaveExpense = (e: React.FormEvent) => {
    e.preventDefault();
    const calculatedAmount = (formQuantity && formUnitCost) ? (formQuantity * formUnitCost) : formAmount;
    if (!formDescription.trim() || !Number.isFinite(calculatedAmount) || calculatedAmount <= 0) return;
    
    const expenseItem: CampaignExpense = {
      id: editingExpense ? editingExpense.id : `gasto-${Date.now()}`,
      tenantId: currentTenant.tenantId,
      phase: formPhase,
      rubro: formRubro,
      component: formRubro as ExpenseComponent,
      description: formDescription.trim(),
      amount: calculatedAmount,
      quantity: formQuantity,
      unitCost: formUnitCost,
      unitMeasure: formUnitMeasure,
      supplier: formSupplier.trim(),
      invoiceNumber: formInvoiceNumber.trim(),
      date: formDate,
      status: formStatus,
      responsibleLeaderId: formLeaderId || undefined,
      vehiclePlate: formVehiclePlate || undefined,
      notes: formNotes.trim() || undefined
    };

    if (editingExpense && onUpdateExpense) {
      onUpdateExpense(expenseItem);
    } else {
      onAddExpense(expenseItem);
    }

    setShowExpenseModal(false);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('¿Confirmas que deseas eliminar este registro de gasto de la campaña?')) {
      if (onDeleteExpense) {
        onDeleteExpense(id);
      }
    }
  };

  // 1-Click Rubro Preset Assistant
  const applyRubroPreset = (rubro: FinancialRubro, defaultMeasure: string, defaultUnitCost: number, defaultDesc: string) => {
    setFormRubro(rubro);
    setFormUnitMeasure(defaultMeasure);
    setFormUnitCost(defaultUnitCost);
    setFormDescription(defaultDesc);
    setFormAmount(defaultUnitCost * formQuantity);
  };

  // EXCEL & CSV UNIVERSAL EXPORT ENGINE
  const handleExportToExcel = () => {
    const headers = [
      'ID Registro',
      'Tenant ID',
      'Fase Campaña',
      'Rubro Oficial',
      'Descripción Detallada',
      'Cantidad',
      'Unidad Medida',
      'Costo Unitario (COP)',
      'Total Gasto (COP)',
      'Fecha',
      'Estado Pago',
      'Proveedor / Establecimiento',
      'Número Factura / Soporte',
      'Líder Responsable',
      'Placa Vehículo',
      'Notas Auditoría CNE'
    ];

    const rows = filteredExpenses.map(e => [
      `"${e.id}"`,
      `"${e.tenantId}"`,
      `"${e.phase || 'Campaña Oficial'}"`,
      `"${e.rubro || e.component}"`,
      `"${(e.description || '').replace(/"/g, '""')}"`,
      e.quantity || 1,
      `"${e.unitMeasure || 'Global'}"`,
      e.unitCost || e.amount,
      e.amount,
      `"${e.date}"`,
      `"${e.status}"`,
      `"${(e.supplier || '').replace(/"/g, '""')}"`,
      `"${(e.invoiceNumber || '').replace(/"/g, '""')}"`,
      `"${e.responsibleLeaderId || 'Coordinación Central'}"`,
      `"${e.vehiclePlate || 'N/A'}"`,
      `"${(e.notes || '').replace(/"/g, '""')}"`
    ]);

    // CSV format with UTF-8 BOM so Excel opens it natively with proper accents and formatting
    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Reporte_Gastos_${currentTenant.tenantId}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Number formatter
  const formatCOP = (val: number) => `$${val.toLocaleString('es-CO')} COP`;

  return (
    <div className="space-y-6">
      
      {/* AUTHOR HEADER */}
      <AuthorHeader 
        title="Centro de Control de Gastos & Necesidades de Campaña"
        subtitle="Registro Completo a Voluntad • Precampaña, Campaña & Día D • Presupuesto Proyectado por Líderes"
      />

      {/* TOP SUMMARY BANNER */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-5 shadow-xl">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="p-2 bg-blue-500/20 text-blue-400 rounded-xl border border-blue-500/30">
              <DollarSign className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-bold text-white tracking-tight">Reporte Financiero Oficial: {currentTenant.name}</h2>
          </div>
          <p className="text-xs text-slate-400">
            Control de gasolina, vehículos, alimentación, publicidad, eventos y cajas menores con auditoría CNE.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleOpenCreateModal}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-blue-600/30 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Registrar Nuevo Gasto
          </button>

          <button
            onClick={handleExportToExcel}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-600/20 transition cursor-pointer"
            title="Descargar todos los datos filtrados en formato Excel / CSV"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Exportar a Excel (.CSV)
          </button>

        </div>
      </div>

      {/* 4 CARDS: FINANCIAL PHASES METRICS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4.5 space-y-1">
          <span className="text-[10px] font-bold uppercase text-slate-400 block">Total Gasto Acumulado</span>
          <div className="text-xl font-black text-white font-mono">{formatCOP(totalEjecutado)}</div>
          <span className="text-[10px] text-slate-500">{tenantExpenses.length} registros auditados</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4.5 space-y-1">
          <span className="text-[10px] font-bold uppercase text-indigo-400 block">1. Precampaña</span>
          <div className="text-xl font-black text-indigo-300 font-mono">{formatCOP(totalPrecampana)}</div>
          <span className="text-[10px] text-slate-500">Sondeos, firmas y logística previa</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4.5 space-y-1">
          <span className="text-[10px] font-bold uppercase text-blue-400 block">2. Campaña Oficial</span>
          <div className="text-xl font-black text-blue-300 font-mono">{formatCOP(totalCampana)}</div>
          <span className="text-[10px] text-slate-500">Publicidad, mítines y gasolina</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4.5 space-y-1">
          <span className="text-[10px] font-bold uppercase text-amber-400 block">3. Operación Día D</span>
          <div className="text-xl font-black text-amber-300 font-mono">{formatCOP(totalDiaD)}</div>
          <span className="text-[10px] text-slate-500">Transporte, refrigerios y testigos</span>
        </div>
      </div>

      {/* SUB-TABS SELECTOR */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
        <button
          onClick={() => setActiveSubTab('gastos_list')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
            activeSubTab === 'gastos_list'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
              : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
          }`}
        >
          <FileText className="w-4 h-4" />
          Registro Detallado de Gastos ({filteredExpenses.length})
        </button>

        <button
          onClick={() => setActiveSubTab('leaders_needs')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
            activeSubTab === 'leaders_needs'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
              : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
          }`}
        >
          <Users className="w-4 h-4" />
          Pirámide de Necesidades por Líder & Vereda ({tenantLeaders.length})
        </button>
      </div>

      {/* VIEW 1: GASTOS LIST & FILTERABLE TABLE */}
      {activeSubTab === 'gastos_list' && (
        <div className="space-y-4">
          
          {/* SEARCH & FILTERS BAR */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por descripción, proveedor, factura o líder..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 text-xs text-white pl-9 pr-4 py-2 border border-slate-700 rounded-xl focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={selectedPhase}
                onChange={(e) => setSelectedPhase(e.target.value)}
                className="bg-slate-950 text-xs text-white px-3 py-2 border border-slate-700 rounded-xl focus:outline-none cursor-pointer"
              >
                <option value="TODAS">Fase: Todas</option>
                <option value="Precampaña">Precampaña</option>
                <option value="Campaña Oficial">Campaña Oficial</option>
                <option value="Día D (Electoral)">Día D (Electoral)</option>
              </select>

              <select
                value={selectedRubro}
                onChange={(e) => setSelectedRubro(e.target.value)}
                className="bg-slate-950 text-xs text-white px-3 py-2 border border-slate-700 rounded-xl focus:outline-none cursor-pointer"
              >
                <option value="TODOS">Rubro: Todos</option>
                <option value="Combustible">Combustible</option>
                <option value="Transporte y Movilización">Transporte</option>
                <option value="Alimentación y Refrigerios">Alimentación</option>
                <option value="Publicidad y Propaganda">Publicidad</option>
                <option value="Eventos, Mítines y Tarimas">Eventos / Tarimas</option>
                <option value="Honorarios y Testigos Electorales">Honorarios / Testigos</option>
                <option value="Sedes y Logística">Sedes</option>
              </select>

              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="bg-slate-950 text-xs text-white px-3 py-2 border border-slate-700 rounded-xl focus:outline-none cursor-pointer"
              >
                <option value="TODOS">Estado: Todos</option>
                <option value="Pagado">Pagado</option>
                <option value="Pendiente">Pendiente</option>
                <option value="Aprobado">Aprobado</option>
              </select>
            </div>
          </div>

          {/* TABLE OF EXPENSES */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 uppercase font-bold text-[10px] tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="py-3.5 px-4">Fecha / Fase</th>
                    <th className="py-3.5 px-4">Rubro & Descripción</th>
                    <th className="py-3.5 px-4">Cantidad & Costo Unitario</th>
                    <th className="py-3.5 px-4">Total (COP)</th>
                    <th className="py-3.5 px-4">Proveedor / Factura</th>
                    <th className="py-3.5 px-4">Líder / Vehículo</th>
                    <th className="py-3.5 px-4 text-center">Estado</th>
                    <th className="py-3.5 px-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredExpenses.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-500">
                        No se encontraron gastos con los filtros aplicados.
                      </td>
                    </tr>
                  ) : (
                    filteredExpenses.map((exp) => (
                      <tr key={exp.id} className="hover:bg-slate-800/40 transition">
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="font-mono text-white text-xs">{exp.date}</div>
                          <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold inline-block mt-0.5 ${
                            exp.phase === 'Precampaña' ? 'bg-indigo-500/20 text-indigo-300' :
                            exp.phase === 'Día D (Electoral)' ? 'bg-amber-500/20 text-amber-300' :
                            'bg-blue-500/20 text-blue-300'
                          }`}>
                            {exp.phase || 'Campaña'}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 max-w-xs">
                          <div className="font-bold text-white text-xs">{exp.description}</div>
                          <div className="text-[10px] text-slate-400 mt-0.5">{exp.rubro || exp.component}</div>
                          {exp.notes && <div className="text-[10px] text-slate-500 italic mt-0.5">"{exp.notes}"</div>}
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap font-mono">
                          {exp.quantity ? (
                            <div>
                              <span className="text-white font-bold">{exp.quantity}</span> {exp.unitMeasure || 'unid'} x {formatCOP(exp.unitCost || 0)}
                            </div>
                          ) : (
                            <span className="text-slate-500">Global</span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap font-mono font-black text-emerald-400 text-sm">
                          {formatCOP(exp.amount)}
                        </td>

                        <td className="py-3.5 px-4 max-w-[150px] truncate">
                          <div className="font-medium text-slate-200">{exp.supplier || 'Proveedor Local'}</div>
                          <div className="text-[10px] font-mono text-slate-400">{exp.invoiceNumber || 'S/N'}</div>
                        </td>

                        <td className="py-3.5 px-4 max-w-[140px] truncate text-slate-400">
                          {exp.responsibleLeaderId && <div>Líder: {exp.responsibleLeaderId}</div>}
                          {exp.vehiclePlate && <div className="text-amber-300 font-mono font-bold">Placa: {exp.vehiclePlate}</div>}
                          {!exp.responsibleLeaderId && !exp.vehiclePlate && <span className="text-slate-600">-</span>}
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            exp.status === 'Pagado' ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20' :
                            exp.status === 'Aprobado' ? 'bg-blue-500/10 text-blue-300 border border-blue-500/20' :
                            'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                          }`}>
                            {exp.status}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-right whitespace-nowrap space-x-1">
                          <button
                            onClick={() => handleOpenEditModal(exp)}
                            className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-slate-800 rounded-lg transition"
                            title="Editar gasto"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(exp.id)}
                            className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition"
                            title="Eliminar gasto"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* VIEW 2: LEADER NEEDS PYRAMID & PROJECTION */}
      {activeSubTab === 'leaders_needs' && (
        <div className="space-y-4">
          
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-white text-base flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-400" />
                  Presupuesto Proyectado & Necesidades de Líderes por Vereda/Barrio
                </h3>
                <p className="text-xs text-slate-400">
                  Visualización jerárquica para que el Candidato y su Jefe Político sepan qué requiere cada líder territorial en combustible, refrigerios y vehículos.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 uppercase font-bold text-[10px] tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="py-3.5 px-4">Líder / Territorio</th>
                    <th className="py-3.5 px-4">Meta de Votos</th>
                    <th className="py-3.5 px-4">Refrigerios Solicitados</th>
                    <th className="py-3.5 px-4">Combustible (Galones)</th>
                    <th className="py-3.5 px-4">Vehículos Asignados</th>
                    <th className="py-3.5 px-4">Presupuesto Asignado</th>
                    <th className="py-3.5 px-4 text-center">Estado Cobertura</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {tenantLeaders.map((leader, idx) => {
                    const estRefrigerios = Math.round(leader.voteTarget * 0.4);
                    const estFuel = Math.round(leader.activistsCount * 3.5);
                    const estVehicles = Math.max(1, Math.ceil(leader.voteTarget / 80));

                    return (
                      <tr key={leader.id} className="hover:bg-slate-800/40 transition">
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-white text-xs">{leader.fullName}</div>
                          <div className="text-[10px] text-slate-400">{leader.veredaOrBarrio || leader.zoneOrDistrict} • {leader.municipality || 'Astrea'}</div>
                          <div className="text-[10px] text-blue-400">Tel: {leader.phone}</div>
                        </td>

                        <td className="py-3.5 px-4 font-mono font-bold text-white">
                          <div>{leader.votesCommitted} / {leader.voteTarget}</div>
                          <div className="text-[9px] text-emerald-400">{((leader.votesCommitted / leader.voteTarget) * 100).toFixed(0)}% asegurado</div>
                        </td>

                        <td className="py-3.5 px-4 font-mono">
                          <span className="text-white font-bold">{estRefrigerios}</span> raciones
                          <div className="text-[10px] text-slate-400">Día D + Mítines</div>
                        </td>

                        <td className="py-3.5 px-4 font-mono">
                          <span className="text-amber-300 font-bold">{estFuel} gal</span>
                          <div className="text-[10px] text-slate-400">Motos y camionetas</div>
                        </td>

                        <td className="py-3.5 px-4 font-mono">
                          <span className="text-blue-300 font-bold">{estVehicles}</span> unidades
                          <div className="text-[10px] text-slate-400">Ruta veredal</div>
                        </td>

                        <td className="py-3.5 px-4 font-mono font-bold text-emerald-400">
                          {formatCOP(leader.budgetAllocated || 1800000)}
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            leader.status === 'Destacado' ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20' :
                            leader.status === 'Activo' ? 'bg-blue-500/10 text-blue-300 border border-blue-500/20' :
                            'bg-red-500/10 text-red-300 border border-red-500/20'
                          }`}>
                            {leader.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* CREATE / EDIT EXPENSE MODAL */}
      {showExpenseModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 max-w-2xl w-full space-y-5 my-8 shadow-2xl animate-fade-in">
            
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-500/20 text-blue-400 rounded-xl">
                  <DollarSign className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">
                    {editingExpense ? 'Modificar Registro de Gasto' : 'Ingresar Nuevo Gasto de Campaña'}
                  </h3>
                  <p className="text-xs text-slate-400">Organización: {currentTenant.name}</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowExpenseModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick 1-Click Rubro Presets */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                Asistente Rápido (1-Click Presets):
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => applyRubroPreset('Combustible', 'Galones', 15500, 'Tanqueo de Gasolina Corriente para Camioneta')}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 rounded-lg text-xs flex items-center gap-1 cursor-pointer"
                >
                  <Fuel className="w-3.5 h-3.5" /> Gasolina ($15.500/gal)
                </button>
                <button
                  type="button"
                  onClick={() => applyRubroPreset('Alimentación y Refrigerios', 'Refrigerios', 12000, 'Refrigerios y Almuerzos para Brigada de Activistas')}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-slate-700 rounded-lg text-xs flex items-center gap-1 cursor-pointer"
                >
                  <Utensils className="w-3.5 h-3.5" /> Refrigerios ($12.000)
                </button>
                <button
                  type="button"
                  onClick={() => applyRubroPreset('Transporte y Movilización', 'Viajes / Días', 180000, 'Alquiler de Camioneta 4x4 Ruta Veredal Astrea')}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-blue-300 border border-slate-700 rounded-lg text-xs flex items-center gap-1 cursor-pointer"
                >
                  <Car className="w-3.5 h-3.5" /> Camioneta Día D ($180.000)
                </button>
                <button
                  type="button"
                  onClick={() => applyRubroPreset('Publicidad y Propaganda', 'Unidades', 45000, 'Microperforados e Impresión de Volantes')}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-purple-300 border border-slate-700 rounded-lg text-xs flex items-center gap-1 cursor-pointer"
                >
                  <Megaphone className="w-3.5 h-3.5" /> Publicidad / Microperforado
                </button>
              </div>
            </div>

            <form onSubmit={handleSaveExpense} className="space-y-4">
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Fase de la Campaña *</label>
                  <select
                    value={formPhase}
                    onChange={(e: any) => setFormPhase(e.target.value)}
                    className="w-full bg-slate-800 text-xs text-white border border-slate-700 rounded-xl px-3 py-2 focus:outline-none focus:border-blue-500 cursor-pointer"
                    required
                  >
                    <option value="Precampaña">Precampaña (Sondeos y firmas)</option>
                    <option value="Campaña Oficial">Campaña Oficial (Mítines y propaganda)</option>
                    <option value="Día D (Electoral)">Día D (Electoral - Testigos y transporte)</option>
                    <option value="Post-Electoral">Post-Electoral (Escrutinios)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Rubro Oficial *</label>
                  <select
                    value={formRubro}
                    onChange={(e: any) => setFormRubro(e.target.value)}
                    className="w-full bg-slate-800 text-xs text-white border border-slate-700 rounded-xl px-3 py-2 focus:outline-none focus:border-blue-500 cursor-pointer"
                    required
                  >
                    <option value="Combustible">Combustible</option>
                    <option value="Transporte y Movilización">Transporte y Movilización</option>
                    <option value="Alimentación y Refrigerios">Alimentación y Refrigerios</option>
                    <option value="Publicidad y Propaganda">Publicidad y Propaganda</option>
                    <option value="Eventos, Mítines y Tarimas">Eventos, Mítines y Tarimas</option>
                    <option value="Honorarios y Testigos Electorales">Honorarios y Testigos</option>
                    <option value="Sedes y Logística">Sedes y Logística</option>
                    <option value="Material Impreso y Camisetas">Material Impreso y Camisetas</option>
                    <option value="Tecnología y Asesoría Jurídica">Tecnología y Jurídica</option>
                    <option value="Caja Menor e Imprevistos">Caja Menor e Imprevistos</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Descripción Detallada *</label>
                <input
                  type="text"
                  placeholder="Ej: 30 galones de gasolina para ruta Arjona - Astrea en camioneta KGM-892"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full bg-slate-800 text-xs text-white border border-slate-700 rounded-xl px-3 py-2 focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              {/* Quantity, Unit Cost and Calculation */}
              <div className="grid grid-cols-3 gap-3 bg-slate-950 p-3 rounded-2xl border border-slate-800">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">Cantidad</label>
                  <input
                    type="number"
                    min={1}
                    value={formQuantity}
                    onChange={(e) => setFormQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full bg-slate-800 text-xs font-mono font-bold text-white border border-slate-700 rounded-xl px-3 py-1.5"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">Unidad Medida</label>
                  <input
                    type="text"
                    placeholder="Galones, Días, etc."
                    value={formUnitMeasure}
                    onChange={(e) => setFormUnitMeasure(e.target.value)}
                    className="w-full bg-slate-800 text-xs text-white border border-slate-700 rounded-xl px-3 py-1.5"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">Costo Unitario (COP)</label>
                  <input
                    type="number"
                    min={0}
                    step={500}
                    value={formUnitCost}
                    onChange={(e) => setFormUnitCost(parseInt(e.target.value) || 0)}
                    className="w-full bg-slate-800 text-xs font-mono font-bold text-amber-300 border border-slate-700 rounded-xl px-3 py-1.5"
                  />
                </div>
              </div>

              {/* Calculated Total Display */}
              <div className="p-3 bg-blue-950/30 border border-blue-500/40 rounded-xl flex items-center justify-between">
                <span className="text-xs text-blue-300 font-bold">Total Calculado a Registrar:</span>
                <span className="text-base font-black text-emerald-400 font-mono">
                  {formatCOP((formQuantity && formUnitCost) ? (formQuantity * formUnitCost) : formAmount)}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Proveedor / Establecimiento</label>
                  <input
                    type="text"
                    placeholder="Ej: Estación de Servicio Terpel Astrea"
                    value={formSupplier}
                    onChange={(e) => setFormSupplier(e.target.value)}
                    className="w-full bg-slate-800 text-xs text-white border border-slate-700 rounded-xl px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Factura / Recibo CNE</label>
                  <input
                    type="text"
                    placeholder="Ej: FAC-8492"
                    value={formInvoiceNumber}
                    onChange={(e) => setFormInvoiceNumber(e.target.value)}
                    className="w-full bg-slate-800 text-xs text-white font-mono border border-slate-700 rounded-xl px-3 py-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Fecha *</label>
                  <input
                    type="date"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full bg-slate-800 text-xs text-white border border-slate-700 rounded-xl px-3 py-2"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Placa Vehículo (Opcional)</label>
                  <input
                    type="text"
                    placeholder="Ej: KGM-892"
                    value={formVehiclePlate}
                    onChange={(e) => setFormVehiclePlate(e.target.value.toUpperCase())}
                    className="w-full bg-slate-800 text-xs text-white font-mono border border-slate-700 rounded-xl px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Estado del Pago</label>
                  <select
                    value={formStatus}
                    onChange={(e: any) => setFormStatus(e.target.value)}
                    className="w-full bg-slate-800 text-xs text-white border border-slate-700 rounded-xl px-3 py-2"
                  >
                    <option value="Pagado">Pagado</option>
                    <option value="Pendiente">Pendiente</option>
                    <option value="Aprobado">Aprobado</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Notas / Justificación CNE (Opcional)</label>
                <textarea
                  rows={2}
                  placeholder="Detalles adicionales para informe de Cuentas Claras..."
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full bg-slate-800 text-xs text-white border border-slate-700 rounded-xl p-3"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowExpenseModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-blue-600/30 transition cursor-pointer"
                >
                  {editingExpense ? 'Guardar Modificaciones' : 'Registrar Gasto en Firestore'}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
};
