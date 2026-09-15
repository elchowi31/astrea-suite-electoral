import React, { useState, useEffect, useMemo } from 'react';
import { Tenant, CampaignExpense, DonorContribution, ExpenseComponent, FinancialRubro, UserProfile, UserRole } from '../types';
import { getTerritorialScope, filterExpensesByScope } from '../lib/permissions';
import {
  DEPARTAMENTOS_COLOMBIA,
  getMunicipiosPorDepartamento,
  calcularProyeccionReal2026
} from '../data/colombiaElectoralData';
import { generarIdDocumentoLegible } from '../lib/slugify';
import { AuthorHeader } from './common/AuthorHeader';
import {
  DollarSign,
  TrendingUp,
  PlusCircle,
  Filter,
  Truck,
  Megaphone,
  Calendar,
  Users,
  CheckCircle2,
  MapPin,
  Sparkles,
  AlertTriangle,
  Zap,
  X,
  PieChart as PieIcon,
  Utensils,
  Fuel,
  Building2,
  FileSpreadsheet,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  Search,
  RotateCcw,
  Receipt,
  Lock,
  Shield
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  CartesianGrid
} from 'recharts';

interface FinancesViewProps {
  currentTenant: Tenant;
  currentUser?: UserProfile | null;
  userRole?: UserRole;
  expenses: CampaignExpense[];
  donorContributions: DonorContribution[];
  onAddExpense: (expense: CampaignExpense) => void;
  onAddDonorContribution: (contribution: DonorContribution) => void;
  onDeleteExpense?: (id: string) => void;
  onDeleteDonorContribution?: (id: string) => void;
  onNavigateTransport: () => void;
}

const RUBROS_LIST: FinancialRubro[] = [
  'Alimentación y Refrigerios',
  'Transporte y Movilización',
  'Combustible',
  'Publicidad y Propaganda',
  'Material Impreso y Camisetas',
  'Honorarios y Testigos Electorales',
  'Sedes y Logística',
  'Eventos, Mítines y Tarimas'
];

const COLORS_RUBRO: Record<string, string> = {
  'Alimentación y Refrigerios': '#f97316', // Orange
  'Transporte y Movilización': '#10b981', // Emerald
  'Combustible': '#eab308', // Amber / Yellow
  'Publicidad y Propaganda': '#3b82f6', // Blue
  'Material Impreso y Camisetas': '#8b5cf6', // Violet
  'Honorarios y Testigos Electorales': '#ec4899', // Pink
  'Sedes y Logística': '#06b6d4', // Cyan
  'Eventos, Mítines y Tarimas': '#a855f7' // Purple
};

export const FinancesView: React.FC<FinancesViewProps> = ({
  currentTenant,
  currentUser = null,
  userRole = 'Alcalde',
  expenses,
  donorContributions,
  onAddExpense,
  onAddDonorContribution,
  onNavigateTransport,
}) => {
  const scope = getTerritorialScope(currentUser, userRole);
  // Navigation Sub-tabs
  const [activeTab, setActiveTab] = useState<'dashboard' | 'aportantes' | 'gastos' | 'topes_cne'>('dashboard');

  // Dynamic Filters for Finances
  const [filterDonorPerson, setFilterDonorPerson] = useState<string>('TODOS');
  const [filterRubro, setFilterRubro] = useState<string>('TODOS');
  const [filterContributionType, setFilterContributionType] = useState<string>('TODOS');
  const [filterCneStatus, setFilterCneStatus] = useState<string>('TODOS');
  const [filterMuni, setFilterMuni] = useState<string>(() => {
    return !scope.canViewAllMunicipalities ? (scope.allowedMunicipality || 'Astrea') : 'TODOS';
  });
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Modals
  const [showExpenseModal, setShowExpenseModal] = useState<boolean>(false);
  const [showDonorModal, setShowDonorModal] = useState<boolean>(false);

  // Form State: Nuevo Gasto
  const [newExpRubro, setNewExpRubro] = useState<FinancialRubro>('Alimentación y Refrigerios');
  const [newExpDesc, setNewExpDesc] = useState('');
  const [newExpAmount, setNewExpAmount] = useState('');
  const [newExpSupplier, setNewExpSupplier] = useState('');
  const [newExpInvoice, setNewExpInvoice] = useState('');
  const [newExpDept, setNewExpDept] = useState(scope.allowedDepartment || 'Cesar');
  const [newExpMuni, setNewExpMuni] = useState(scope.allowedMunicipality || 'Astrea');
  const [newExpNotes, setNewExpNotes] = useState('');
  const [generatedExpDocId, setGeneratedExpDocId] = useState<string>('');

  // Form State: Nuevo Aporte
  const [newDonorName, setNewDonorName] = useState('');
  const [newDonorDoc, setNewDonorDoc] = useState('');
  const [newDonorPhone, setNewDonorPhone] = useState('');
  const [newDonorEmail, setNewDonorEmail] = useState('');
  const [newDonorType, setNewDonorType] = useState<'Persona Natural' | 'Recursos Propios Candidato' | 'Partido o Movimiento Político' | 'Organización / Simpatizantes'>('Persona Natural');
  const [newDonorContribType, setNewDonorContribType] = useState<'Efectivo / Transferencia Bancaria' | 'Especie (Alimentación / Refrigerios)' | 'Especie (Transporte y Vehículos)' | 'Especie (Combustible / Vales Gasolina)' | 'Especie (Publicidad / Pauta Radial / Impresión)' | 'Especie (Sedes / Inmuebles)' | 'Otro Aporte en Especie'>('Efectivo / Transferencia Bancaria');
  const [newDonorRubro, setNewDonorRubro] = useState<FinancialRubro>('Alimentación y Refrigerios');
  const [newDonorAmount, setNewDonorAmount] = useState('');
  const [newDonorReceipt, setNewDonorReceipt] = useState('');
  const [newDonorDept, setNewDonorDept] = useState('Cesar');
  const [newDonorMuni, setNewDonorMuni] = useState('Astrea');
  const [newDonorNotes, setNewDonorNotes] = useState('');
  const [generatedDonorDocId, setGeneratedDonorDocId] = useState<string>('');

  const availableMunicipalities = getMunicipiosPorDepartamento(newExpDept || 'Cesar');

  // Real-time readable ID calculation for Expenses
  useEffect(() => {
    const id = generarIdDocumentoLegible(
      'gasto',
      newExpDesc || 'concepto-campana',
      newExpRubro,
      newExpMuni
    );
    setGeneratedExpDocId(id);
  }, [newExpDesc, newExpRubro, newExpMuni]);

  // Real-time readable ID calculation for Donors
  useEffect(() => {
    const id = generarIdDocumentoLegible(
      'aporte',
      newDonorName || 'aportante-cesar',
      newDonorRubro,
      newDonorMuni
    );
    setGeneratedDonorDocId(id);
  }, [newDonorName, newDonorRubro, newDonorMuni]);

  // Currency Formatter
  const formatCOP = (val: number) => {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(val);
  };

  // Filtered lists for this Tenant and Scope (RBAC)
  const tenantExpenses = useMemo(() => {
    return filterExpensesByScope(expenses, currentUser, userRole, currentTenant.tenantId);
  }, [expenses, currentUser, userRole, currentTenant.tenantId]);

  const tenantContributions = useMemo(() => {
    const list = donorContributions.filter((d) => d.tenantId === currentTenant.tenantId);
    if (!scope.canViewAllMunicipalities && scope.allowedMunicipality) {
      return list.filter((d) => !d.municipality || d.municipality.toLowerCase() === scope.allowedMunicipality?.toLowerCase());
    }
    return list;
  }, [donorContributions, currentTenant.tenantId, scope.canViewAllMunicipalities, scope.allowedMunicipality]);

  // Unique Donors List for Filter Dropdown
  const uniqueDonorsList = useMemo(() => {
    const map = new Map<string, { name: string; doc: string; total: number }>();
    tenantContributions.forEach((c) => {
      const existing = map.get(c.donorName);
      if (existing) {
        existing.total += c.amount;
      } else {
        map.set(c.donorName, { name: c.donorName, doc: c.donorDocument, total: c.amount });
      }
    });
    return Array.from(map.values());
  }, [tenantContributions]);

  // Filtered Donors
  const filteredContributions = useMemo(() => {
    return tenantContributions.filter((c) => {
      const matchPerson = filterDonorPerson === 'TODOS' || c.donorName === filterDonorPerson;
      const matchRubro = filterRubro === 'TODOS' || c.rubroDestino === filterRubro;
      const matchType = filterContributionType === 'TODOS' || c.contributionType === filterContributionType;
      const matchStatus = filterCneStatus === 'TODOS' || c.cneStatus === filterCneStatus;
      const matchMuni = filterMuni === 'TODOS' || (c.municipality && c.municipality.toLowerCase().includes(filterMuni.toLowerCase()));
      const matchSearch = !searchTerm || (
        c.donorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.donorDocument.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.supportReceiptNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.notes?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      return matchPerson && matchRubro && matchType && matchStatus && matchMuni && matchSearch;
    });
  }, [tenantContributions, filterDonorPerson, filterRubro, filterContributionType, filterCneStatus, filterMuni, searchTerm]);

  // Filtered Expenses
  const filteredExpenses = useMemo(() => {
    return tenantExpenses.filter((e) => {
      const matchRubro = filterRubro === 'TODOS' || e.rubro === filterRubro || e.component === filterRubro;
      const matchMuni = filterMuni === 'TODOS' || (e.municipality && e.municipality.toLowerCase().includes(filterMuni.toLowerCase()));
      const matchSearch = !searchTerm || (
        e.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.supplier?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.invoiceNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.notes?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      return matchRubro && matchMuni && matchSearch;
    });
  }, [tenantExpenses, filterRubro, filterMuni, searchTerm]);

  // Aggregated Totals
  const totalAportes = useMemo(() => {
    return tenantContributions.reduce((acc, curr) => acc + curr.amount, 0);
  }, [tenantContributions]);

  const totalAportesEfectivo = useMemo(() => {
    return tenantContributions
      .filter((c) => c.contributionType.includes('Efectivo'))
      .reduce((acc, curr) => acc + curr.amount, 0);
  }, [tenantContributions]);

  const totalAportesEspecie = useMemo(() => {
    return tenantContributions
      .filter((c) => c.contributionType.includes('Especie'))
      .reduce((acc, curr) => acc + curr.amount, 0);
  }, [tenantContributions]);

  const totalGastos = useMemo(() => {
    return tenantExpenses.reduce((acc, curr) => acc + curr.amount, 0);
  }, [tenantExpenses]);

  const saldoNeto = totalAportes - totalGastos;
  const cneTopeLegalEstimado = 280000000; // COP $280M tope alcaldía/asamblea intermedia CNE 2026
  const pctTopeAlcanzado = Math.min(100, (totalGastos / cneTopeLegalEstimado) * 100);

  // Data for Charts: Comparativa Aportes vs Gastos por Rubro
  const chartDataRubros = useMemo(() => {
    return RUBROS_LIST.map((rubro) => {
      const aportesRubro = tenantContributions
        .filter((c) => c.rubroDestino === rubro)
        .reduce((sum, c) => sum + c.amount, 0);

      const gastosRubro = tenantExpenses
        .filter((e) => e.rubro === rubro || e.component === rubro)
        .reduce((sum, e) => sum + e.amount, 0);

      return {
        rubro: rubro.replace(' y ', '/').replace(' Electorales', ''),
        rubroCompleto: rubro,
        Aportes: aportesRubro,
        Gastos: gastosRubro,
        Diferencia: aportesRubro - gastosRubro
      };
    });
  }, [tenantContributions, tenantExpenses]);

  // Data for PieChart: Distribución de Aportes por Tipo
  const chartDataPieAportes = useMemo(() => {
    const mapa = new Map<string, number>();
    tenantContributions.forEach((c) => {
      let key = 'Otros Aportes';
      if (c.contributionType.includes('Efectivo')) key = 'Efectivo / Bancarizado';
      else if (c.contributionType.includes('Alimentación')) key = 'Especie: Alimentación';
      else if (c.contributionType.includes('Transporte')) key = 'Especie: Transporte';
      else if (c.contributionType.includes('Combustible')) key = 'Especie: Combustible';
      else if (c.contributionType.includes('Publicidad')) key = 'Especie: Publicidad';
      else if (c.contributionType.includes('Sedes')) key = 'Especie: Sedes';

      mapa.set(key, (mapa.get(key) || 0) + c.amount);
    });

    const colors = ['#10b981', '#f97316', '#3b82f6', '#eab308', '#8b5cf6', '#06b6d4', '#ec4899'];
    return Array.from(mapa.entries()).map(([name, value], idx) => ({
      name,
      value,
      color: colors[idx % colors.length]
    }));
  }, [tenantContributions]);

  // Data for Timeline AreaChart
  const chartDataTimeline = useMemo(() => {
    const fechasMap = new Map<string, { fecha: string; aportes: number; gastos: number }>();
    
    tenantContributions.forEach(c => {
      const f = c.date || '2026-07-01';
      const item = fechasMap.get(f) || { fecha: f, aportes: 0, gastos: 0 };
      item.aportes += c.amount;
      fechasMap.set(f, item);
    });

    tenantExpenses.forEach(e => {
      const f = e.date || '2026-07-01';
      const item = fechasMap.get(f) || { fecha: f, aportes: 0, gastos: 0 };
      item.gastos += e.amount;
      fechasMap.set(f, item);
    });

    return Array.from(fechasMap.values()).sort((a, b) => a.fecha.localeCompare(b.fecha));
  }, [tenantContributions, tenantExpenses]);

  // Handlers
  const handleSaveExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExpDesc.trim() || !Number.isFinite(Number(newExpAmount)) || Number(newExpAmount) <= 0) return;

    const expense: CampaignExpense = {
      id: generatedExpDocId || `gasto-${Date.now()}`,
      tenantId: currentTenant.tenantId,
      component: newExpRubro as any,
      rubro: newExpRubro,
      description: newExpDesc,
      amount: parseFloat(newExpAmount),
      date: new Date().toISOString().split('T')[0],
      status: 'Pendiente',
      supplier: newExpSupplier.trim(),
      invoiceNumber: newExpInvoice.trim(),
      department: newExpDept,
      municipality: newExpMuni,
      notes: newExpNotes
    };

    onAddExpense(expense);
    setShowExpenseModal(false);
    setNewExpDesc('');
    setNewExpAmount('');
    setNewExpSupplier('');
    setNewExpInvoice('');
    setNewExpNotes('');
  };

  const handleSaveDonor = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDonorName.trim() || !newDonorDoc.trim() || !newDonorReceipt.trim() || !Number.isFinite(Number(newDonorAmount)) || Number(newDonorAmount) <= 0) return;

    const contribution: DonorContribution = {
      id: generatedDonorDocId || `aporte-${Date.now()}`,
      tenantId: currentTenant.tenantId,
      donorName: newDonorName,
      donorDocument: newDonorDoc.trim(),
      donorPhone: newDonorPhone,
      donorEmail: newDonorEmail,
      donorType: newDonorType,
      contributionType: newDonorContribType,
      rubroDestino: newDonorRubro,
      amount: parseFloat(newDonorAmount),
      date: new Date().toISOString().split('T')[0],
      supportReceiptNumber: newDonorReceipt.trim(),
      cneStatus: 'Pendiente Soporte',
      department: newDonorDept,
      municipality: newDonorMuni,
      notes: newDonorNotes
    };

    onAddDonorContribution(contribution);
    setShowDonorModal(false);
    setNewDonorName('');
    setNewDonorDoc('');
    setNewDonorAmount('');
    setNewDonorReceipt('');
    setNewDonorNotes('');
  };

  // Preset Rate Appliers for Fast Data Entry
  const applyDonorPreset = (
    name: string,
    doc: string,
    type: any,
    contribType: any,
    rubro: FinancialRubro,
    amount: number,
    notes: string
  ) => {
    setNewDonorName(name);
    setNewDonorDoc(doc);
    setNewDonorType(type);
    setNewDonorContribType(contribType);
    setNewDonorRubro(rubro);
    setNewDonorAmount(amount.toString());
    setNewDonorNotes(notes);
  };

  const applyExpensePreset = (
    desc: string,
    rubro: FinancialRubro,
    amount: number,
    supplier: string,
    notes: string
  ) => {
    setNewExpDesc(desc);
    setNewExpRubro(rubro);
    setNewExpAmount(amount.toString());
    setNewExpSupplier(supplier);
    setNewExpNotes(notes);
  };

  // Export CNE Cuentas Claras CSV
  const handleExportCneCsv = () => {
    let csv = 'Tipo_Registro,ID,Aportante_O_Proveedor,Documento,Rubro_Inversion,Tipo_Aporte_Gasto,Monto_COP,Fecha,Soporte_Factura_Recibo,Municipio,Estado_CNE,Notas\n';
    
    tenantContributions.forEach(c => {
      csv += `"APORTE","${c.id}","${c.donorName}","${c.donorDocument}","${c.rubroDestino}","${c.contributionType}",${c.amount},"${c.date}","${c.supportReceiptNumber || ''}","${c.municipality || ''}","${c.cneStatus}","${(c.notes || '').replace(/"/g, '""')}"\n`;
    });

    tenantExpenses.forEach(e => {
      csv += `"GASTO","${e.id}","${e.supplier || ''}","N/A","${e.rubro || e.component}","${e.component}",${e.amount},"${e.date}","${e.invoiceNumber || ''}","${e.municipality || ''}","${e.status}","${(e.notes || '').replace(/"/g, '""')}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Libro_Cuentas_Claras_CNE_2026_${currentTenant.tenantId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      
      {/* AUTHOR HEADER */}
      <AuthorHeader 
        title="Dashboard Financiero & Auditoría de Aportantes CNE 2026"
        subtitle="Control Dinámico de Inversión • Desglose Alimentación, Transporte, Combustible y Publicidad • Cuentas Claras CNE"
      />

      {/* Main Bar with Navigation & Quick Actions */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div>
          <div className="flex items-center gap-3">
            <span className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-2xl border border-emerald-500/30">
              <DollarSign className="w-6 h-6" />
            </span>
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Finanzas, Donaciones & Costos Detallados
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Organización: <strong className="text-slate-200 font-semibold">{currentTenant.name}</strong> • Sincronizado en <code className="text-emerald-400 font-mono">/aportes</code> y <code className="text-blue-400 font-mono">/gastos</code>
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleExportCneCsv}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3.5 py-2.5 rounded-xl text-xs font-semibold border border-slate-700 transition cursor-pointer shadow-sm"
            title="Descargar reporte en formato Cuentas Claras CNE"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>Exportar CNE (CSV)</span>
          </button>

          <button
            onClick={() => setShowDonorModal(true)}
            className="flex items-center gap-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold px-4 py-2.5 rounded-xl text-xs shadow-lg shadow-blue-600/20 transition cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>+ Registrar Aportante / Aporte</span>
          </button>

          <button
            onClick={() => setShowExpenseModal(true)}
            className="flex items-center gap-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold px-4 py-2.5 rounded-xl text-xs shadow-lg shadow-emerald-600/20 transition cursor-pointer"
          >
            <Receipt className="w-4 h-4" />
            <span>+ Registrar Costo / Gasto</span>
          </button>
        </div>
      </div>

      {/* Top 5 High-Precision KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Aportes */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4.5 space-y-2 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Aportes</span>
            <span className="p-1.5 bg-blue-500/10 text-blue-400 rounded-lg"><ArrowDownRight className="w-4 h-4" /></span>
          </div>
          <div className="text-2xl font-black text-blue-400 font-mono tracking-tight">{formatCOP(totalAportes)}</div>
          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800">
            <span>Efectivo: <strong className="text-slate-200">{formatCOP(totalAportesEfectivo)}</strong></span>
            <span>Especie: <strong className="text-slate-200">{formatCOP(totalAportesEspecie)}</strong></span>
          </div>
        </div>

        {/* Total Gastos */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4.5 space-y-2 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Gastos</span>
            <span className="p-1.5 bg-emerald-500/10 text-emerald-400 rounded-lg"><ArrowUpRight className="w-4 h-4" /></span>
          </div>
          <div className="text-2xl font-black text-emerald-400 font-mono tracking-tight">{formatCOP(totalGastos)}</div>
          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800">
            <span>{tenantExpenses.length} facturas</span>
            <span>Ejecución: <strong className="text-amber-300">{pctTopeAlcanzado.toFixed(1)}%</strong></span>
          </div>
        </div>

        {/* Saldo Neto en Caja */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4.5 space-y-2 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Saldo en Caja / Balance</span>
            <span className={`p-1.5 rounded-lg ${saldoNeto >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
              <DollarSign className="w-4 h-4" />
            </span>
          </div>
          <div className={`text-2xl font-black font-mono tracking-tight ${saldoNeto >= 0 ? 'text-white' : 'text-red-400'}`}>
            {formatCOP(saldoNeto)}
          </div>
          <div className="text-[11px] text-slate-400 pt-1 border-t border-slate-800">
            {saldoNeto >= 0 ? 'Superávit disponible' : 'Déficit temporal por fondear'}
          </div>
        </div>

        {/* Aportantes Únicos */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4.5 space-y-2 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Aportantes Registrados</span>
            <span className="p-1.5 bg-purple-500/10 text-purple-400 rounded-lg"><Users className="w-4 h-4" /></span>
          </div>
          <div className="text-2xl font-black text-purple-300 font-mono tracking-tight">
            {uniqueDonorsList.length} <span className="text-sm font-normal text-slate-400">personas</span>
          </div>
          <div className="text-[11px] text-slate-400 pt-1 border-t border-slate-800">
            Promedio: <strong className="text-slate-200">{formatCOP(uniqueDonorsList.length ? totalAportes / uniqueDonorsList.length : 0)}</strong>
          </div>
        </div>

        {/* Tope CNE */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4.5 space-y-2 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Tope Legal CNE 2026</span>
            <span className="p-1.5 bg-amber-500/10 text-amber-400 rounded-lg"><ShieldCheck className="w-4 h-4" /></span>
          </div>
          <div className="text-2xl font-black text-amber-300 font-mono tracking-tight">{formatCOP(cneTopeLegalEstimado)}</div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div className="bg-amber-400 h-full rounded-full" style={{ width: `${pctTopeAlcanzado}%` }} />
          </div>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex border-b border-slate-800 space-x-1">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition cursor-pointer flex items-center gap-2 ${
            activeTab === 'dashboard'
              ? 'bg-slate-900 text-emerald-400 border-t-2 border-emerald-400'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
          }`}
        >
          <PieIcon className="w-4 h-4" />
          <span>Gráficas & Comparativas</span>
        </button>

        <button
          onClick={() => setActiveTab('aportantes')}
          className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition cursor-pointer flex items-center gap-2 ${
            activeTab === 'aportantes'
              ? 'bg-slate-900 text-blue-400 border-t-2 border-blue-400'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Aportantes & Donaciones ({tenantContributions.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('gastos')}
          className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition cursor-pointer flex items-center gap-2 ${
            activeTab === 'gastos'
              ? 'bg-slate-900 text-emerald-400 border-t-2 border-emerald-400'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
          }`}
        >
          <Receipt className="w-4 h-4" />
          <span>Costos & Gastos Ejecutados ({tenantExpenses.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('topes_cne')}
          className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition cursor-pointer flex items-center gap-2 ${
            activeTab === 'topes_cne'
              ? 'bg-slate-900 text-amber-300 border-t-2 border-amber-300'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Límites y Alertas CNE 2026</span>
        </button>
      </div>

      {/* DYNAMIC FILTER BAR (Visible across all tabs) */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
          <Filter className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Filtros Dinámicos:</span>
        </div>

        <div className="flex flex-wrap items-center gap-2 flex-1 justify-end">
          {/* Filter by Specific Donor Person */}
          <select
            value={filterDonorPerson}
            onChange={(e) => setFilterDonorPerson(e.target.value)}
            className="bg-slate-800 text-xs text-slate-200 border border-slate-700 rounded-xl px-3 py-1.5 focus:outline-none cursor-pointer max-w-[200px]"
            title="Filtrar por Aportante Específico"
          >
            <option value="TODOS">👤 Todos los Aportantes</option>
            {uniqueDonorsList.map((d) => (
              <option key={d.name} value={d.name}>
                {d.name} ({formatCOP(d.total)})
              </option>
            ))}
          </select>

          {/* Filter by Rubro / Investment Type */}
          <select
            value={filterRubro}
            onChange={(e) => setFilterRubro(e.target.value)}
            className="bg-slate-800 text-xs text-slate-200 border border-slate-700 rounded-xl px-3 py-1.5 focus:outline-none cursor-pointer max-w-[210px]"
            title="Filtrar por Rubro de Inversión"
          >
            <option value="TODOS">🏷️ Todos los Rubros</option>
            {RUBROS_LIST.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>

          {/* Filter by Contribution Mode */}
          <select
            value={filterContributionType}
            onChange={(e) => setFilterContributionType(e.target.value)}
            className="bg-slate-800 text-xs text-slate-200 border border-slate-700 rounded-xl px-3 py-1.5 focus:outline-none cursor-pointer max-w-[190px]"
          >
            <option value="TODOS">💳 Modalidad (Todas)</option>
            <option value="Efectivo / Transferencia Bancaria">Efectivo / Bancario</option>
            <option value="Especie (Alimentación / Refrigerios)">Especie: Alimentación</option>
            <option value="Especie (Transporte y Vehículos)">Especie: Transporte</option>
            <option value="Especie (Combustible / Vales Gasolina)">Especie: Combustible</option>
            <option value="Especie (Publicidad / Pauta Radial / Impresión)">Especie: Publicidad</option>
            <option value="Especie (Sedes / Inmuebles)">Especie: Sedes</option>
          </select>

          {/* Search Box */}
          <div className="relative min-w-[180px]">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              placeholder="Buscar por cédula, recibo, factura..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-slate-800 text-xs text-slate-200 pl-8 pr-3 py-1.5 rounded-xl border border-slate-700 w-full focus:outline-none focus:border-emerald-500"
            />
          </div>

          {(filterDonorPerson !== 'TODOS' || filterRubro !== 'TODOS' || filterContributionType !== 'TODOS' || searchTerm !== '') && (
            <button
              onClick={() => {
                setFilterDonorPerson('TODOS');
                setFilterRubro('TODOS');
                setFilterContributionType('TODOS');
                setSearchTerm('');
              }}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-rose-400 rounded-xl border border-slate-700 text-xs flex items-center gap-1 transition cursor-pointer"
              title="Limpiar todos los filtros"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Limpiar</span>
            </button>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: DASHBOARD & COMPARATIVAS VISUALES CON RECHARTS */}
      {/* ========================================================================= */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          
          {/* Main Comparison BarChart */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-white text-base flex items-center gap-2">
                  <BarChart className="w-5 h-5 text-emerald-400" />
                  Comparativa de Aportes Recibidos vs Gastos Ejecutados por Rubro
                </h3>
                <p className="text-xs text-slate-400">
                  Desglose exacto en COP para Alimentación, Transporte, Combustible, Publicidad, Sedes y Honorarios.
                </p>
              </div>

              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1.5 text-blue-400">
                  <span className="w-3 h-3 rounded-full bg-blue-500"></span> Aportes
                </span>
                <span className="flex items-center gap-1.5 text-emerald-400">
                  <span className="w-3 h-3 rounded-full bg-emerald-500"></span> Gastos
                </span>
              </div>
            </div>

            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartDataRubros} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis 
                    dataKey="rubro" 
                    stroke="#94a3b8" 
                    fontSize={11} 
                    angle={-25} 
                    textAnchor="end" 
                    interval={0}
                  />
                  <YAxis 
                    stroke="#94a3b8" 
                    fontSize={11} 
                    tickFormatter={(val) => `$${(val / 1000000).toFixed(0)}M`}
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', color: '#fff' }}
                    formatter={(value: any) => formatCOP(Number(value))}
                  />
                  <Legend verticalAlign="top" wrapperStyle={{ paddingBottom: '10px' }} />
                  <Bar dataKey="Aportes" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="Gastos" fill="#10b981" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 2-Column Split: Donut Chart + Mini Sparklines by Rubro */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Pie / Donut Chart */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 space-y-4">
              <h3 className="font-bold text-white text-base flex items-center gap-2 border-b border-slate-800 pb-3">
                <PieIcon className="w-5 h-5 text-indigo-400" />
                Distribución de Aportes (Efectivo vs Especie)
              </h3>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartDataPieAportes}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={4}
                      dataKey="value"
                      label={({ name, percent }) => `${name.split(':')[0]} ${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {chartDataPieAportes.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', color: '#fff' }}
                      formatter={(val: any) => formatCOP(Number(val))}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800 text-xs">
                {chartDataPieAportes.map((item) => (
                  <div key={item.name} className="flex items-center justify-between bg-slate-950/60 p-2 rounded-xl border border-slate-800">
                    <span className="flex items-center gap-1.5 text-slate-300 truncate">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }}></span>
                      <span className="truncate">{item.name}</span>
                    </span>
                    <span className="font-mono font-bold text-slate-100 ml-2">{formatCOP(item.value)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Mini-Gráficas & Sparklines por Rubro */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 space-y-4">
              <h3 className="font-bold text-white text-base flex items-center gap-2 border-b border-slate-800 pb-3">
                <Layers className="w-5 h-5 text-amber-400" />
                Mini-Gráficas de Balance por Tipo de Inversión
              </h3>

              <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                {chartDataRubros.map((item) => {
                  const totalRubro = Math.max(item.Aportes, item.Gastos, 1);
                  const pctAporte = Math.min(100, (item.Aportes / totalRubro) * 100);
                  const pctGasto = Math.min(100, (item.Gastos / totalRubro) * 100);

                  return (
                    <div key={item.rubroCompleto} className="bg-slate-950/80 p-3 rounded-2xl border border-slate-800 space-y-2 hover:border-slate-700 transition">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS_RUBRO[item.rubroCompleto] || '#3b82f6' }}></span>
                          {item.rubroCompleto}
                        </span>
                        <span className={`text-[11px] font-mono font-bold ${item.Diferencia >= 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                          {item.Diferencia >= 0 ? `+${formatCOP(item.Diferencia)} disponible` : `${formatCOP(item.Diferencia)} déficit`}
                        </span>
                      </div>

                      {/* Dual Progress Sparkline */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[10px] text-slate-400">
                          <span>Aportes: <strong className="text-blue-400 font-mono">{formatCOP(item.Aportes)}</strong></span>
                          <span>Gastos: <strong className="text-emerald-400 font-mono">{formatCOP(item.Gastos)}</strong></span>
                        </div>
                        <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden flex gap-1">
                          <div className="bg-blue-500 h-full rounded-l-full transition-all" style={{ width: `${pctAporte}%` }}></div>
                          <div className="bg-emerald-500 h-full rounded-r-full transition-all" style={{ width: `${pctGasto}%` }}></div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>

          {/* Area Chart: Flujo Temporal de Caja */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 space-y-4">
            <h3 className="font-bold text-white text-base flex items-center gap-2 border-b border-slate-800 pb-3">
              <TrendingUp className="w-5 h-5 text-cyan-400" />
              Evolución Temporal de Aportes y Gastos Acumulados (Campaña 2026)
            </h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartDataTimeline} margin={{ top: 10, right: 30, left: 20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorAportes" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorGastos" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="fecha" stroke="#94a3b8" fontSize={11} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickFormatter={(val) => `$${(val/1000000).toFixed(0)}M`} />
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px' }} formatter={(val: any) => formatCOP(Number(val))} />
                  <Area type="monotone" dataKey="aportes" stroke="#3b82f6" fillOpacity={1} fill="url(#colorAportes)" name="Aportes ($ COP)" />
                  <Area type="monotone" dataKey="gastos" stroke="#10b981" fillOpacity={1} fill="url(#colorGastos)" name="Gastos ($ COP)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: AUDITORÍA DETALLADA DE APORTANTES & DONACIONES */}
      {/* ========================================================================= */}
      {activeTab === 'aportantes' && (
        <div className="space-y-6">
          
          {/* Top Donor Cards with Mini-graphs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {uniqueDonorsList.slice(0, 3).map((donor, idx) => {
              const donorContribs = tenantContributions.filter(c => c.donorName === donor.name);
              const pctOfTotal = totalAportes > 0 ? (donor.total / totalAportes) * 100 : 0;

              return (
                <div 
                  key={donor.name} 
                  className={`bg-slate-900/90 border rounded-3xl p-5 space-y-3 cursor-pointer transition hover:scale-[1.02] ${
                    filterDonorPerson === donor.name ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-slate-800'
                  }`}
                  onClick={() => setFilterDonorPerson(filterDonorPerson === donor.name ? 'TODOS' : donor.name)}
                >
                  <div className="flex items-center justify-between">
                    <span className="p-2 bg-blue-500/20 text-blue-400 rounded-xl text-xs font-bold">
                      Top #{idx + 1} Aportante
                    </span>
                    <span className="text-[11px] font-mono text-slate-400">{donor.doc}</span>
                  </div>

                  <div>
                    <h4 className="font-bold text-white text-base leading-tight">{donor.name}</h4>
                    <div className="text-xl font-extrabold text-blue-400 font-mono mt-1">
                      {formatCOP(donor.total)}
                    </div>
                  </div>

                  {/* Mini Rubro Distribution Badges */}
                  <div className="flex flex-wrap gap-1 pt-1">
                    {donorContribs.map((c, i) => (
                      <span key={i} className="text-[10px] bg-slate-950 px-2 py-0.5 rounded-md border border-slate-800 text-slate-300">
                        {c.rubroDestino}: <strong className="text-slate-100">{formatCOP(c.amount)}</strong>
                      </span>
                    ))}
                  </div>

                  <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                    <span>Representa el <strong className="text-blue-300">{pctOfTotal.toFixed(1)}%</strong> de la campaña</span>
                    <span className="text-blue-400 underline">{filterDonorPerson === donor.name ? 'Quitar filtro' : 'Aislar aportes'}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Table of Contributions */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-white text-base flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-400" />
                  Registro Individual de Aportes & Donaciones ({filteredContributions.length})
                </h3>
                <p className="text-xs text-slate-400">
                  Cumplimiento Ley 1475 de 2011 • Certificados de donación y bancarización CNE
                </p>
              </div>

              <div className="text-xs text-slate-300 font-mono">
                Total filtrado: <strong className="text-blue-400 font-bold">{formatCOP(filteredContributions.reduce((s, c) => s + c.amount, 0))}</strong>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/70 text-slate-400 font-semibold uppercase text-[10px] tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="p-3.5">Aportante & Cédula</th>
                    <th className="p-3.5">Modalidad de Aporte</th>
                    <th className="p-3.5">Rubro Destinado</th>
                    <th className="p-3.5">Municipio</th>
                    <th className="p-3.5">No. Recibo CNE</th>
                    <th className="p-3.5 text-right">Monto ($ COP)</th>
                    <th className="p-3.5 text-center">Estado CNE</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300">
                  {filteredContributions.map((contrib) => (
                    <tr key={contrib.id} className="hover:bg-slate-850 transition">
                      <td className="p-3.5">
                        <div className="font-bold text-slate-100">{contrib.donorName}</div>
                        <div className="text-[10px] font-mono text-slate-400">{contrib.donorDocument} • {contrib.donorType}</div>
                      </td>
                      <td className="p-3.5">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-medium ${
                          contrib.contributionType.includes('Efectivo') 
                            ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                            : 'bg-blue-500/10 text-blue-300 border border-blue-500/20'
                        }`}>
                          {contrib.contributionType.includes('Alimentación') && <Utensils className="w-3 h-3" />}
                          {contrib.contributionType.includes('Transporte') && <Truck className="w-3 h-3" />}
                          {contrib.contributionType.includes('Combustible') && <Fuel className="w-3 h-3" />}
                          {contrib.contributionType.includes('Publicidad') && <Megaphone className="w-3 h-3" />}
                          {contrib.contributionType.includes('Sedes') && <Building2 className="w-3 h-3" />}
                          {contrib.contributionType}
                        </span>
                      </td>
                      <td className="p-3.5">
                        <span className="font-semibold text-slate-200">{contrib.rubroDestino}</span>
                        {contrib.notes && <div className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">{contrib.notes}</div>}
                      </td>
                      <td className="p-3.5 text-slate-300">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-slate-500" />
                          {contrib.municipality || 'Cesar'}
                        </span>
                      </td>
                      <td className="p-3.5 font-mono text-slate-400">
                        {contrib.supportReceiptNumber || 'En trámite'}
                      </td>
                      <td className="p-3.5 text-right font-mono font-bold text-blue-400 text-sm">
                        {formatCOP(contrib.amount)}
                      </td>
                      <td className="p-3.5 text-center">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          <CheckCircle2 className="w-3 h-3" />
                          {contrib.cneStatus}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: AUDITORÍA DETALLADA DE COSTOS & GASTOS */}
      {/* ========================================================================= */}
      {activeTab === 'gastos' && (
        <div className="space-y-6">
          
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-white text-base flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-emerald-400" />
                  Registro Detallado de Gastos & Cuentas de Cobro ({filteredExpenses.length})
                </h3>
                <p className="text-xs text-slate-400">
                  Facturación electrónica, contratos de combustible, viáticos y transporte rural.
                </p>
              </div>

              <div className="text-xs text-slate-300 font-mono">
                Total Gastos Filtrados: <strong className="text-emerald-400 font-bold">{formatCOP(filteredExpenses.reduce((s, e) => s + e.amount, 0))}</strong>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/70 text-slate-400 font-semibold uppercase text-[10px] tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="p-3.5">Concepto & ID</th>
                    <th className="p-3.5">Rubro de Inversión</th>
                    <th className="p-3.5">Proveedor</th>
                    <th className="p-3.5">Factura / Soporte</th>
                    <th className="p-3.5">Municipio</th>
                    <th className="p-3.5 text-right">Monto ($ COP)</th>
                    <th className="p-3.5 text-center">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300">
                  {filteredExpenses.map((exp) => (
                    <tr key={exp.id} className="hover:bg-slate-850 transition">
                      <td className="p-3.5">
                        <div className="font-bold text-slate-100">{exp.description}</div>
                        <div className="text-[10px] font-mono text-slate-400 mt-0.5">{exp.id}</div>
                      </td>
                      <td className="p-3.5">
                        <span className="flex items-center gap-1.5 font-semibold text-slate-200">
                          {exp.rubro?.includes('Alimentación') && <Utensils className="w-3.5 h-3.5 text-orange-400" />}
                          {exp.rubro?.includes('Transporte') && <Truck className="w-3.5 h-3.5 text-emerald-400" />}
                          {exp.rubro?.includes('Combustible') && <Fuel className="w-3.5 h-3.5 text-amber-400" />}
                          {exp.rubro?.includes('Publicidad') && <Megaphone className="w-3.5 h-3.5 text-blue-400" />}
                          {exp.rubro || exp.component}
                        </span>
                      </td>
                      <td className="p-3.5 text-slate-300">{exp.supplier}</td>
                      <td className="p-3.5 font-mono text-slate-400">{exp.invoiceNumber || 'Comprobante interno'}</td>
                      <td className="p-3.5 text-slate-300">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-slate-500" />
                          {exp.municipality || 'Cesar'}
                        </span>
                      </td>
                      <td className="p-3.5 text-right font-mono font-bold text-emerald-400 text-sm">
                        {formatCOP(exp.amount)}
                      </td>
                      <td className="p-3.5 text-center">
                        <span className="inline-block px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          {exp.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: TOPES CNE & ALERTAS LEGALES */}
      {/* ========================================================================= */}
      {activeTab === 'topes_cne' && (
        <div className="space-y-6">
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 space-y-4">
            <h3 className="font-bold text-white text-base flex items-center gap-2 border-b border-slate-800 pb-3">
              <ShieldCheck className="w-5 h-5 text-amber-400" />
              Auditoría Preventiva y Validación de Topes Individuales (Ley Estatutaria 1475 de 2011)
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800 space-y-2">
                <span className="text-xs font-bold text-slate-400 uppercase">Límite por Donante Individual (10%)</span>
                <div className="text-xl font-black text-amber-300 font-mono">{formatCOP(cneTopeLegalEstimado * 0.1)}</div>
                <p className="text-[11px] text-slate-400">
                  Ningún aportante privado puede superar el 10% del tope total fijado por el CNE.
                </p>
              </div>

              <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800 space-y-2">
                <span className="text-xs font-bold text-slate-400 uppercase">Obligación de Bancarización</span>
                <div className="text-xl font-black text-blue-400 font-mono">100% de Aportes Mayores a 2 SMMLV</div>
                <p className="text-[11px] text-slate-400">
                  Todo aporte superior a ~$2.6M COP debe ingresar exclusivamente por cheque o transferencia a la Cuenta Única de Campaña.
                </p>
              </div>

              <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800 space-y-2">
                <span className="text-xs font-bold text-slate-400 uppercase">Reportes Cuentas Claras</span>
                <div className="text-xl font-black text-emerald-400 font-mono">Tiempo Real Semanal</div>
                <p className="text-[11px] text-slate-400">
                  Los ingresos y gastos deben transmitirse digitalmente durante el transcurso de la campaña.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: REGISTRO PROACTIVO DE APORTANTE / APORTE */}
      {/* ========================================================================= */}
      {showDonorModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-2xl w-full p-6 sm:p-8 space-y-5 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-600/20 text-blue-400 rounded-xl border border-blue-500/30">
                  <Users className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Registrar Aportante & Donación CNE</h3>
                  <p className="text-[11px] text-slate-400">Aportes en efectivo, transferencias y especies con cálculo automático de rubro.</p>
                </div>
              </div>
              <button 
                onClick={() => setShowDonorModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* PRESETS 1-CLICK */}
            <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800 space-y-2">
              <span className="text-[10px] font-bold uppercase text-slate-400 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-blue-400" />
                Plantillas Rápidas (1-Clic Auto-relleno):
              </span>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => applyDonorPreset('', '', 'Persona Natural', 'Especie (Alimentación / Refrigerios)', 'Alimentación y Refrigerios', 0, '')}
                  className="px-2.5 py-1 bg-orange-900/30 hover:bg-orange-800/40 text-orange-200 border border-orange-700/40 rounded-lg text-[10px] font-medium transition cursor-pointer"
                >
                  🥪 Aporte en refrigerios
                </button>
                <button
                  type="button"
                  onClick={() => applyDonorPreset('', '', 'Persona Natural', 'Especie (Transporte y Vehículos)', 'Transporte y Movilización', 0, '')}
                  className="px-2.5 py-1 bg-emerald-900/30 hover:bg-emerald-800/40 text-emerald-200 border border-emerald-700/40 rounded-lg text-[10px] font-medium transition cursor-pointer"
                >
                  🚐 Aporte en transporte
                </button>
                <button
                  type="button"
                  onClick={() => applyDonorPreset('', '', 'Organización / Simpatizantes', 'Especie (Combustible / Vales Gasolina)', 'Combustible', 0, '')}
                  className="px-2.5 py-1 bg-amber-900/30 hover:bg-amber-800/40 text-amber-200 border border-amber-700/40 rounded-lg text-[10px] font-medium transition cursor-pointer"
                >
                  ⛽ Aporte en combustible
                </button>
                <button
                  type="button"
                  onClick={() => applyDonorPreset('', '', 'Recursos Propios Candidato', 'Efectivo / Transferencia Bancaria', 'Publicidad y Propaganda', 0, '')}
                  className="px-2.5 py-1 bg-blue-900/30 hover:bg-blue-800/40 text-blue-200 border border-blue-700/40 rounded-lg text-[10px] font-medium transition cursor-pointer"
                >
                  💰 Recursos propios
                </button>
              </div>
            </div>

            <form onSubmit={handleSaveDonor} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Nombre Completo / Razón Social *</label>
                  <input
                    type="text"
                    required
                    placeholder="Nombre o razón social"
                    value={newDonorName}
                    onChange={(e) => setNewDonorName(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Cédula / NIT *</label>
                  <input
                    type="text"
                    required
                    placeholder="Tipo y número de documento"
                    value={newDonorDoc}
                    onChange={(e) => setNewDonorDoc(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Tipo de Aportante</label>
                  <select
                    value={newDonorType}
                    onChange={(e: any) => setNewDonorType(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="Persona Natural">Persona Natural</option>
                    <option value="Recursos Propios Candidato">Recursos Propios Candidato</option>
                    <option value="Partido o Movimiento Político">Partido o Movimiento Político</option>
                    <option value="Organización / Simpatizantes">Organización / Simpatizantes</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Modalidad del Aporte *</label>
                  <select
                    value={newDonorContribType}
                    onChange={(e: any) => setNewDonorContribType(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="Efectivo / Transferencia Bancaria">Efectivo / Transferencia Bancaria</option>
                    <option value="Especie (Alimentación / Refrigerios)">Especie (Alimentación / Refrigerios)</option>
                    <option value="Especie (Transporte y Vehículos)">Especie (Transporte y Vehículos)</option>
                    <option value="Especie (Combustible / Vales Gasolina)">Especie (Combustible / Vales Gasolina)</option>
                    <option value="Especie (Publicidad / Pauta Radial / Impresión)">Especie (Publicidad / Pauta Radial / Impresión)</option>
                    <option value="Especie (Sedes / Inmuebles)">Especie (Sedes / Inmuebles)</option>
                    <option value="Otro Aporte en Especie">Otro Aporte en Especie</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Rubro de Inversión Destinado</label>
                  <select
                    value={newDonorRubro}
                    onChange={(e: any) => setNewDonorRubro(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                  >
                    {RUBROS_LIST.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Valor Comercial / Monto ($ COP) *</label>
                  <input
                    type="number"
                    required
                    placeholder="15000000"
                    value={newDonorAmount}
                    onChange={(e) => setNewDonorAmount(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-emerald-400 font-mono font-bold focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">No. Comprobante / Recibo CNE</label>
                  <input
                    type="text"
                    placeholder="REC-ESP-ALI-099"
                    value={newDonorReceipt}
                    onChange={(e) => setNewDonorReceipt(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Municipio</label>
                  <select
                    value={newDonorMuni}
                    onChange={(e) => setNewDonorMuni(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                  >
                    {availableMunicipalities.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Descripción / Observaciones</label>
                <textarea
                  rows={2}
                  placeholder="Detalles sobre entrega de alimentos, número de placas de vehículos o comprobante bancario..."
                  value={newDonorNotes}
                  onChange={(e) => setNewDonorNotes(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Readable ID Preview */}
              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between text-[11px] font-mono">
                <span className="text-slate-500">ID Documento Firestore:</span>
                <span className="text-blue-400 font-bold">{generatedDonorDocId}</span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDonorModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-lg shadow-blue-600/30"
                >
                  Guardar Aporte en Firestore
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: REGISTRO PROACTIVO DE GASTO / COSTO */}
      {/* ========================================================================= */}
      {showExpenseModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-2xl w-full p-6 sm:p-8 space-y-5 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-600/20 text-emerald-400 rounded-xl border border-emerald-500/30">
                  <Receipt className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Registrar Costo o Factura de Gasto</h3>
                  <p className="text-[11px] text-slate-400">Contratos de transporte, combustible, publicidad y honorarios.</p>
                </div>
              </div>
              <button 
                onClick={() => setShowExpenseModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* PRESET GASTOS 1-CLICK */}
            <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800 space-y-2">
              <span className="text-[10px] font-bold uppercase text-slate-400 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-emerald-400" />
                Tarifas de Referencia en el Cesar:
              </span>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => applyExpensePreset('', 'Transporte y Movilización', 0, '', '')}
                  className="px-2.5 py-1 bg-emerald-900/30 hover:bg-emerald-800/40 text-emerald-200 border border-emerald-700/40 rounded-lg text-[10px] font-medium transition cursor-pointer"
                >
                  🚌 Transporte
                </button>
                <button
                  type="button"
                  onClick={() => applyExpensePreset('', 'Alimentación y Refrigerios', 0, '', '')}
                  className="px-2.5 py-1 bg-orange-900/30 hover:bg-orange-800/40 text-orange-200 border border-orange-700/40 rounded-lg text-[10px] font-medium transition cursor-pointer"
                >
                  🥪 Alimentación
                </button>
                <button
                  type="button"
                  onClick={() => applyExpensePreset('', 'Combustible', 0, '', '')}
                  className="px-2.5 py-1 bg-amber-900/30 hover:bg-amber-800/40 text-amber-200 border border-amber-700/40 rounded-lg text-[10px] font-medium transition cursor-pointer"
                >
                  ⛽ Combustible
                </button>
                <button
                  type="button"
                  onClick={() => applyExpensePreset('', 'Publicidad y Propaganda', 0, '', '')}
                  className="px-2.5 py-1 bg-blue-900/30 hover:bg-blue-800/40 text-blue-200 border border-blue-700/40 rounded-lg text-[10px] font-medium transition cursor-pointer"
                >
                  📢 Publicidad
                </button>
              </div>
            </div>

            <form onSubmit={handleSaveExpense} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Descripción / Concepto *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Suministro de combustible para vehículos veredales..."
                    value={newExpDesc}
                    onChange={(e) => setNewExpDesc(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Rubro de Inversión *</label>
                  <select
                    value={newExpRubro}
                    onChange={(e: any) => setNewExpRubro(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  >
                    {RUBROS_LIST.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Monto del Gasto ($ COP) *</label>
                  <input
                    type="number"
                    required
                    placeholder="7500000"
                    value={newExpAmount}
                    onChange={(e) => setNewExpAmount(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-emerald-400 font-mono font-bold focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Proveedor / Beneficiario</label>
                  <input
                    type="text"
                    placeholder="Transportes Cesar Ltda."
                    value={newExpSupplier}
                    onChange={(e) => setNewExpSupplier(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Número de Factura</label>
                  <input
                    type="text"
                    placeholder="FAC-9012"
                    value={newExpInvoice}
                    onChange={(e) => setNewExpInvoice(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Departamento</label>
                  <select
                    value={newExpDept}
                    onChange={(e) => setNewExpDept(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  >
                    {DEPARTAMENTOS_COLOMBIA.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Municipio</label>
                  <select
                    value={newExpMuni}
                    onChange={(e) => setNewExpMuni(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  >
                    {availableMunicipalities.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Notas Contables</label>
                <textarea
                  rows={2}
                  placeholder="Detalles sobre retenciones, entregables o firmas de recibido..."
                  value={newExpNotes}
                  onChange={(e) => setNewExpNotes(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Readable ID Preview */}
              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between text-[11px] font-mono">
                <span className="text-slate-500">ID Documento Firestore:</span>
                <span className="text-emerald-400 font-bold">{generatedExpDocId}</span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowExpenseModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-lg shadow-emerald-600/30"
                >
                  Guardar Gasto en Firestore
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
