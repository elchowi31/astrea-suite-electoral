import React, { useState, useEffect } from 'react';
import { Tenant, TransportVehicle, UserProfile, UserRole } from '../types';
import { getTerritorialScope, filterVehiclesByScope } from '../lib/permissions';
import {
  DEPARTAMENTOS_COLOMBIA,
  getMunicipiosPorDepartamento,
  getVeredasYBarrios
} from '../data/colombiaElectoralData';
import { generarIdDocumentoLegible } from '../lib/slugify';
import { AuthorHeader } from './common/AuthorHeader';
import {
  Truck,
  Bus,
  Car,
  Fuel,
  Users,
  MapPin,
  PlusCircle,
  CheckCircle2,
  AlertTriangle,
  Wrench,
  Navigation,
  Sparkles,
  ShieldAlert,
  Zap,
  X,
  QrCode,
  Lock,
  Shield
} from 'lucide-react';

interface TransportViewProps {
  currentTenant: Tenant;
  currentUser?: UserProfile | null;
  userRole?: UserRole;
  vehicles: TransportVehicle[];
  onAddVehicle: (vehicle: TransportVehicle) => Promise<void>;
}

export const TransportView: React.FC<TransportViewProps> = ({
  currentTenant,
  currentUser = null,
  userRole = 'Alcalde',
  vehicles,
  onAddVehicle,
}) => {
  const scope = getTerritorialScope(currentUser, userRole);
  const [showModal, setShowModal] = useState<boolean>(false);
  const [filterType, setFilterType] = useState<string>('TODOS');
  const [filterMuni, setFilterMuni] = useState<string>(() => {
    return !scope.canViewAllMunicipalities ? (scope.allowedMunicipality || 'Astrea') : 'TODOS';
  });

  // Form state (Predictive & Proactive)
  const [vehicleType, setVehicleType] = useState<TransportVehicle['vehicleType']>('Bus Gran Capacidad (45 pas)');
  const [licensePlate, setLicensePlate] = useState('');
  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [department, setDepartment] = useState(scope.allowedDepartment || 'Cesar');
  const [municipality, setMunicipality] = useState(scope.allowedMunicipality || 'Astrea');
  const [veredaOrRuta, setVeredaOrRuta] = useState(`Ruta Veredal: Casco Urbano ↔ Corregimiento Arjona`);
  const [assignedZone, setAssignedZone] = useState(`${scope.allowedMunicipality || 'Astrea'} - Corregimiento Arjona & Vereda San Isidro`);
  const [capacity, setCapacity] = useState('45');
  const [dailyCost, setDailyCost] = useState('0');
  const [fuelBudget, setFuelBudget] = useState('0');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [generatedDocId, setGeneratedDocId] = useState<string>('');

  const availableMunicipalities = getMunicipiosPorDepartamento(department);
  const availableVeredas = getVeredasYBarrios(department, municipality);

  // Suggest physical capacity only; costs must come from a real quote.
  useEffect(() => {
    if (vehicleType.includes('Bus Gran Capacidad')) {
      setCapacity('45');
    } else if (vehicleType.includes('Microbús / Van')) {
      setCapacity('19');
    } else if (vehicleType.includes('Camioneta 4x4 Rural')) {
      setCapacity('5');
    } else if (vehicleType.includes('Motocarro')) {
      setCapacity('3');
    } else {
      setCapacity('15');
    }
  }, [vehicleType]);

  // Route updates when municipality changes
  useEffect(() => {
    const vereda = availableVeredas[0] || 'Zona Rural';
    setVeredaOrRuta(`Ruta Veredal: ${municipality} Casco Urbano ↔ ${vereda}`);
    setAssignedZone(`${municipality} - Puestos de Votación ${vereda}`);
  }, [municipality, department]);

  // Real-time readable ID calculation
  useEffect(() => {
    const id = generarIdDocumentoLegible(
      'vehiculo',
      vehicleType.split(' ')[0],
      `placa-${licensePlate || 'sin-placa'}`,
      municipality
    );
    setGeneratedDocId(id);
  }, [vehicleType, licensePlate, municipality]);

  const handleDepartmentChange = (newDept: string) => {
    setDepartment(newDept);
    const munis = getMunicipiosPorDepartamento(newDept);
    if (munis.length > 0) {
      setMunicipality(munis[0]);
    }
  };

  const scopedVehicles = filterVehiclesByScope(vehicles, currentUser, userRole, currentTenant.tenantId);
  const filteredVehicles = scopedVehicles.filter((v) => {
    const matchesType = filterType === 'TODOS' || v.vehicleType.includes(filterType);
    const matchesMuni = filterMuni === 'TODOS' || (v.municipality && v.municipality.toLowerCase().includes(filterMuni.toLowerCase()));
    return matchesType && matchesMuni;
  });

  // Totals
  const totalMobilizationCapacity = scopedVehicles.reduce((acc, curr) => acc + curr.capacity, 0);
  const totalDailyVehicleCost = scopedVehicles.reduce((acc, curr) => acc + curr.dailyCost, 0);
  const totalFuelBudget = scopedVehicles.reduce((acc, curr) => acc + curr.fuelBudget, 0);
  const totalFleetCost = totalDailyVehicleCost + totalFuelBudget;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!licensePlate.trim() || !driverName.trim() || !driverPhone.trim()) {
      setFormError('Complete placa, conductor y teléfono.');
      return;
    }
    if ((latitude && !longitude) || (!latitude && longitude)) {
      setFormError('Para georreferenciar, complete latitud y longitud.');
      return;
    }

    const vehicle: TransportVehicle = {
      id: generatedDocId || `veh-${Date.now()}`,
      tenantId: currentTenant.tenantId,
      vehicleType,
      licensePlate: licensePlate.trim().toUpperCase(),
      driverName: driverName.trim(),
      driverPhone: driverPhone.trim(),
      assignedZone: assignedZone || `Ruta Veredal ${municipality}`,
      department,
      municipality,
      capacity: Math.max(1, Number(capacity || 1)),
      dailyCost: Math.max(0, Number(dailyCost || 0)),
      fuelBudget: Math.max(0, Number(fuelBudget || 0)),
      status: 'Operativo - Día D',
      ...(latitude && longitude ? { latitude: Number(latitude), longitude: Number(longitude) } : {}),
    };
    setSaving(true);
    try {
      await onAddVehicle(vehicle);
      setShowModal(false);
      setLicensePlate('');
      setDriverName('');
      setDriverPhone('');
      setLatitude('');
      setLongitude('');
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : 'No fue posible guardar el vehículo.');
    } finally {
      setSaving(false);
    }
  };

  const formatCOP = (val: number) => {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(val);
  };

  return (
    <div className="space-y-6">
      
      {/* AUTHOR HEADER */}
      <AuthorHeader 
        title="Gestión de Transporte, Rutas Veredales & Vales Día D"
        subtitle="Logística de Movilización Votantes • Control Flota Cesar • Alertas de Cobertura RURAL"
      />

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
              <Truck className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-bold text-white tracking-tight">Ecosistema de Movilización Día D</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Gestión de buses, camionetas 4x4, vales de gasolina por QR y rutas de votación en <strong className="text-slate-200">{currentTenant.name}</strong> • Colección <code className="text-emerald-400 font-mono">/vehiculos</code>
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-4 py-2.5 rounded-xl text-xs shadow-lg shadow-emerald-600/20 transition cursor-pointer"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Añadir Vehículo / Ruta Veredal</span>
        </button>
      </div>

      {/* ALERT BANNER */}
      <div className="bg-amber-950/40 border border-amber-500/40 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
        <div className="flex items-start gap-3">
          <ShieldAlert className="w-6 h-6 text-amber-400 shrink-0 mt-0.5 animate-pulse" />
          <div>
            <h4 className="font-bold text-amber-200 text-sm">Control de capacidad registrada</h4>
            <p className="text-slate-300 mt-0.5">
              Capacidad por salida de {totalMobilizationCapacity.toLocaleString('es-CO')} pasajeros. Registre rutas y costos cotizados antes de planificar rotaciones.
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl shadow transition shrink-0 cursor-pointer"
        >
          Asignar Vehículo Adicional
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Capacidad Movilización Día D</span>
          <div className="text-2xl font-extrabold text-emerald-400 font-mono">
            ~{totalMobilizationCapacity.toLocaleString('es-CO')} Votantes
          </div>
          <p className="text-[11px] text-slate-400">Estimando 6 rotaciones por vehículo</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Flota de Vehículos</span>
          <div className="text-2xl font-extrabold text-white font-mono">{scopedVehicles.length} Unidades</div>
          <p className="text-[11px] text-slate-400">Buses, Vans, 4x4 y Motocarros</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Costo Diario Alquiler</span>
          <div className="text-2xl font-extrabold text-blue-400 font-mono">{formatCOP(totalDailyVehicleCost)}</div>
          <p className="text-[11px] text-slate-400">Jornada electoral completa</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Presupuesto Combustible</span>
          <div className="text-2xl font-extrabold text-amber-300 font-mono">{formatCOP(totalFuelBudget)}</div>
          <p className="text-[11px] text-slate-400">Vales QR asignados a estaciones de servicio</p>
        </div>
      </div>

      {/* Filter and Cards */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-3">
          <h3 className="font-bold text-white text-sm flex items-center gap-2">
            <Navigation className="w-4 h-4 text-emerald-400" />
            Flota de Despliegue Electoral y Rutas
          </h3>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={filterMuni}
              onChange={(e) => setFilterMuni(e.target.value)}
              className="bg-slate-800 text-xs text-slate-200 border border-slate-700 rounded-lg px-3 py-1.5 focus:outline-none cursor-pointer"
            >
              <option value="TODOS">Todos los Municipios</option>
              {availableMunicipalities.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredVehicles.map((veh) => (
            <div 
              key={veh.id}
              className="bg-slate-950/80 border border-slate-800 hover:border-slate-700 rounded-xl p-4 space-y-3 transition flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                      {veh.vehicleType}
                    </span>
                    <h4 className="font-bold text-slate-100 text-base font-mono mt-1">
                      Placa: {veh.licensePlate}
                    </h4>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    {veh.status}
                  </span>
                </div>

                {/* Readable Firestore ID */}
                <div className="bg-slate-900 px-2 py-1 rounded text-[10px] text-slate-400 font-mono flex items-center justify-between">
                  <span>ID:</span>
                  <span className="text-slate-300 truncate max-w-[190px]">{veh.id}</span>
                </div>

                {/* Driver & Route Info */}
                <div className="bg-slate-900/60 p-2.5 rounded-lg space-y-1.5 text-xs">
                  <p className="text-slate-300 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    <strong>Conductor:</strong> {veh.driverName}
                  </p>
                  <p className="text-slate-400 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>{veh.municipality} • {veh.assignedZone}</span>
                  </p>
                </div>

                {/* Capacity & Fuel */}
                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="text-slate-300 font-semibold">
                    Capacidad: <span className="text-emerald-400 font-mono">{veh.capacity} pasajeros</span>
                  </span>
                  <span className="text-amber-300 font-mono font-bold flex items-center gap-1">
                    <Fuel className="w-3.5 h-3.5" />
                    {formatCOP(veh.fuelBudget)}
                  </span>
                </div>
              </div>

              <div className="border-t border-slate-800/80 pt-2 flex items-center justify-between text-xs">
                <span className="text-slate-400">Tarifa Día D:</span>
                <span className="font-mono font-bold text-white">
                  {formatCOP(veh.dailyCost)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* MODAL: FORMULARIO PREDICTIVO DE TRANSPORTE */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-2xl w-full p-6 sm:p-8 space-y-5 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-600/20 text-emerald-400 rounded-xl border border-emerald-500/30">
                  <Zap className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">
                    Registro de Vehículo & Ruta Veredal Día D
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Tarifas calculadas en COP, asignación de combustible y generación de ID Firestore en español.
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
                  ID de Documento en Firestore:
                </span>
                <p className="text-xs font-mono font-bold text-emerald-300 truncate max-w-md">
                  /{'vehiculos'}/{generatedDocId}
                </p>
              </div>
              <span className="text-[10px] bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 px-2 py-1 rounded-lg shrink-0">
                Auto-generado
              </span>
            </div>

            <form onSubmit={handleCreate} className="space-y-4 text-xs">
              
              {/* Tipo de Vehículo */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Tipo de vehículo (sugiere capacidad)
                  </label>
                  <select
                    value={vehicleType}
                    onChange={(e) => setVehicleType(e.target.value as any)}
                    className="w-full bg-slate-800 border border-slate-700 text-slate-100 p-2.5 rounded-xl focus:outline-none cursor-pointer font-medium"
                  >
                    <option value="Bus Gran Capacidad (45 pas)">🚌 Bus Gran Capacidad (45 pas)</option>
                    <option value="Microbús / Van (19 pas)">🚐 Microbús / Van (19 pas)</option>
                    <option value="Camioneta 4x4 Rural (5 pas)">🚙 Camioneta 4x4 Rural (5 pas)</option>
                    <option value="Motocarro / Tricimóvil (3 pas)">🛺 Motocarro / Tricimóvil (3 pas)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Placa del Vehículo <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: VLA-821 / ARJ-901"
                    value={licensePlate}
                    onChange={(e) => setLicensePlate(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 text-slate-100 p-2.5 rounded-xl focus:outline-none font-mono uppercase font-bold"
                  />
                </div>
              </div>

              {/* Departamento & Municipio */}
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
                    Municipio de Operación
                  </label>
                  <select
                    value={municipality}
                    onChange={(e) => setMunicipality(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 text-slate-100 p-2.5 rounded-xl focus:outline-none cursor-pointer"
                  >
                    {availableMunicipalities.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Ruta Asignada */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Ruta Veredal Asignada / Puestos de Votación
                </label>
                <input
                  type="text"
                  required
                  value={assignedZone}
                  onChange={(e) => setAssignedZone(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 text-slate-100 p-2.5 rounded-xl focus:outline-none"
                />
              </div>

              {/* Conductor & Teléfono */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Nombre del Conductor(a) <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Nombre y apellidos"
                    value={driverName}
                    onChange={(e) => setDriverName(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 text-slate-100 p-2.5 rounded-xl focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Teléfono Móvil (+57 Colombia)
                  </label>
                  <input
                    type="tel"
                    required
                    value={driverPhone}
                    onChange={(e) => setDriverPhone(e.target.value)}
                    placeholder="Número con código de país"
                    className="w-full bg-slate-800 border border-slate-700 text-slate-100 p-2.5 rounded-xl focus:outline-none font-mono"
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

              {/* Tarifas en COP */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Capacidad (Pasajeros)
                  </label>
                  <input
                    type="number"
                    value={capacity}
                    onChange={(e) => setCapacity(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 text-emerald-400 font-mono font-bold p-2.5 rounded-xl focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Tarifa Alquiler Día D ($ COP)
                  </label>
                  <input
                    type="number"
                    value={dailyCost}
                    onChange={(e) => setDailyCost(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 text-white font-mono font-bold p-2.5 rounded-xl focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Combustible / Vale QR ($ COP)
                  </label>
                  <input
                    type="number"
                    value={fuelBudget}
                    onChange={(e) => setFuelBudget(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 text-amber-300 font-mono font-bold p-2.5 rounded-xl focus:outline-none"
                  />
                </div>
              </div>

              {formError && <p role="alert" className="rounded-xl border border-rose-800 bg-rose-950/40 p-3 text-xs text-rose-200">{formError}</p>}

              {/* Botones */}
              <div className="pt-3 flex items-center justify-between border-t border-slate-800">
                <span className="text-[11px] text-slate-400 font-mono truncate max-w-xs">
                  Doc: /vehiculos/{generatedDocId}
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
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl shadow-lg shadow-emerald-600/30 transition cursor-pointer disabled:opacity-50"
                  >
                    {saving ? 'Guardando…' : 'Guardar Vehículo'}
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
