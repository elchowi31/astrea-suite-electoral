import React, { useState, useMemo } from 'react';
import { District, Tenant } from '../types';
import {
  COLOMBIA_ELECTORAL_GEOGRAPHY,
  DEPARTAMENTOS_COLOMBIA,
  getMunicipiosPorDepartamento,
  calcularProyeccionReal2026
} from '../data/colombiaElectoralData';
import { AuthorHeader } from './common/AuthorHeader';
import {
  MapPin,
  Vote,
  Target,
  Sparkles,
  TrendingUp,
  AlertTriangle,
  ShieldCheck,
  Calculator,
  Sliders,
  CheckCircle2,
  BookOpen,
  Award
} from 'lucide-react';

interface DistrictsViewProps {
  currentTenant: Tenant;
  districts: District[];
  onGenerateDistrictStrategy: (districtName: string, keyIssues: string[]) => void;
}

export const DistrictsView: React.FC<DistrictsViewProps> = ({
  currentTenant,
  districts,
  onGenerateDistrictStrategy,
}) => {
  const [selectedDistrict, setSelectedDistrict] = useState<District | null>(districts[0] || null);

  // Dynamic 2026 Projection Calculator State
  const [calcDept, setCalcDept] = useState<string>('Cesar');
  const [calcMuni, setCalcMuni] = useState<string>('Astrea');
  const [calcNivel, setCalcNivel] = useState<string>('Alcaldía Municipal');
  const [calcParticipacion, setCalcParticipacion] = useState<number>(56.5);
  const [calcCurules, setCalcCurules] = useState<number>(13);

  const tenantDistricts = districts.filter((d) => d.tenantId === currentTenant.tenantId);
  const availableMunis = getMunicipiosPorDepartamento(calcDept);

  // Calculate RNEC 2026 Projection
  const proyeccion2026 = useMemo(() => {
    return calcularProyeccionReal2026({
      nivel: calcNivel,
      departamento: calcDept,
      municipio: calcMuni,
      participacionEstimadaPct: calcParticipacion,
      curulesDisponibles: calcCurules
    });
  }, [calcDept, calcMuni, calcNivel, calcParticipacion, calcCurules]);

  const handleDeptChange = (dept: string) => {
    setCalcDept(dept);
    const munis = getMunicipiosPorDepartamento(dept);
    if (munis.length > 0) {
      setCalcMuni(munis[0]);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* AUTHOR HEADER */}
      <AuthorHeader 
        title="Modelo de censo y proyección electoral"
        subtitle="Escenarios editables • Umbral de referencia • Cuociente y cifra repartidora"
      />

      {/* Title */}
      <div className="bg-slate-900/90 p-5 rounded-3xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-blue-500/20 text-blue-400 rounded-xl border border-blue-500/30">
              <MapPin className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-bold text-white tracking-tight">Geografía & Modelo de Proyección Electoral 2026</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Organización: <strong className="text-slate-200">{currentTenant.name}</strong> • Verifique censo, normativa y supuestos antes de usar el escenario para decisiones oficiales.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1 bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 rounded-full text-xs font-semibold flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            Escenario de referencia
          </span>
        </div>
      </div>

      {/* REAL 2026 PROJECTION CALCULATOR CARD */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-700/80 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/20 text-amber-400 rounded-2xl border border-amber-500/30">
              <Calculator className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-extrabold text-white text-lg sm:text-xl">
                Simulador de Umbral, Cifra Repartidora & Meta de Victoria 2026
              </h3>
              <p className="text-xs text-slate-400">
                Selecciona departamento, municipio y cargo para calcular la meta científica de votos.
              </p>
            </div>
          </div>
        </div>

        {/* Controls Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-slate-950/80 p-4 rounded-2xl border border-slate-800">
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">Departamento</label>
            <select
              value={calcDept}
              onChange={(e) => handleDeptChange(e.target.value)}
              className="w-full bg-slate-800 text-xs text-white border border-slate-700 rounded-xl px-3 py-2 focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              {DEPARTAMENTOS_COLOMBIA.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">Municipio / Territorio</label>
            <select
              value={calcMuni}
              onChange={(e) => setCalcMuni(e.target.value)}
              className="w-full bg-slate-800 text-xs text-white border border-slate-700 rounded-xl px-3 py-2 focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              {availableMunis.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">Corporación / Nivel</label>
            <select
              value={calcNivel}
              onChange={(e) => setCalcNivel(e.target.value)}
              className="w-full bg-slate-800 text-xs text-white border border-slate-700 rounded-xl px-3 py-2 focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="Alcaldía Municipal">Alcaldía Municipal</option>
              <option value="Concejo Municipal">Concejo Municipal</option>
              <option value="Gobernación">Gobernación Departamental</option>
              <option value="Asamblea Departamental">Asamblea Departamental</option>
              <option value="Cámara de Representantes">Cámara de Representantes</option>
              <option value="Senado de la República">Senado de la República</option>
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-slate-300">Participación Estimada</label>
              <span className="text-xs font-mono font-bold text-emerald-400">{calcParticipacion}%</span>
            </div>
            <input
              type="range"
              min={35}
              max={75}
              step={0.5}
              value={calcParticipacion}
              onChange={(e) => setCalcParticipacion(parseFloat(e.target.value))}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />
          </div>
        </div>

        {/* Projection Mathematical Outputs */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-slate-900 p-3.5 rounded-2xl border border-slate-800 space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Censo Oficial</span>
            <div className="text-lg font-black text-white font-mono">{proyeccion2026.censoElectoralOficial2026.toLocaleString()}</div>
            <span className="text-[10px] text-slate-500">votantes habilitados</span>
          </div>

          <div className="bg-slate-900 p-3.5 rounded-2xl border border-slate-800 space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Votantes Esperados</span>
            <div className="text-lg font-black text-blue-400 font-mono">{proyeccion2026.votantesEsperados.toLocaleString()}</div>
            <span className="text-[10px] text-slate-500">{calcParticipacion}% en urnas</span>
          </div>

          <div className="bg-slate-900 p-3.5 rounded-2xl border border-slate-800 space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Votos Válidos</span>
            <div className="text-lg font-black text-indigo-300 font-mono">{proyeccion2026.votosValidosProyectados.toLocaleString()}</div>
            <span className="text-[10px] text-slate-500">descontando nulos/blancos</span>
          </div>

          <div className="bg-slate-900 p-3.5 rounded-2xl border border-slate-800 space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Umbral Legal (3%)</span>
            <div className="text-lg font-black text-amber-300 font-mono">{proyeccion2026.umbralLegal3Pct.toLocaleString()}</div>
            <span className="text-[10px] text-slate-500">piso Ley 1475/2011</span>
          </div>

          <div className="bg-slate-900 p-3.5 rounded-2xl border border-slate-800 space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Cifra Repartidora Est.</span>
            <div className="text-lg font-black text-purple-300 font-mono">
              {proyeccion2026.cifraRepartidoraEstimada > 0 ? proyeccion2026.cifraRepartidoraEstimada.toLocaleString() : 'N/A'}
            </div>
            <span className="text-[10px] text-slate-500">{proyeccion2026.escanosDisputados} curules</span>
          </div>

          <div className="bg-slate-900 p-3.5 rounded-2xl border border-emerald-500/40 bg-emerald-950/20 space-y-1">
            <span className="text-[10px] uppercase font-bold text-emerald-400 block flex items-center gap-1">
              <Award className="w-3 h-3 text-emerald-400" />
              Meta de Victoria
            </span>
            <div className="text-lg font-black text-emerald-400 font-mono">
              {proyeccion2026.metaVictoriaUninominal.toLocaleString()}
            </div>
            <span className="text-[10px] text-emerald-400/80 font-semibold">Votos para ganar</span>
          </div>
        </div>

        <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-slate-500 shrink-0" />
            <span>
              <strong>Fuente declarada por el modelo:</strong> {proyeccion2026.fuenteOficial}. Confirme vigencia y fecha de corte con la autoridad electoral.
            </span>
          </div>
          <span className="text-blue-400 font-mono font-semibold">Subregión: {proyeccion2026.subregion}</span>
        </div>
      </div>

      {/* District Priority Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* District list */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1">Distritos & Subregiones Estratégicas</h3>
          {tenantDistricts.map((dist) => {
            const isSelected = selectedDistrict?.id === dist.id;
            return (
              <div
                key={dist.id}
                onClick={() => setSelectedDistrict(dist)}
                className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-blue-950/40 border-blue-500 shadow-lg shadow-blue-500/10'
                    : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-mono text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">
                      {dist.region}
                    </span>
                    <h4 className="font-bold text-slate-100 text-sm mt-1.5">{dist.name}</h4>
                  </div>
                  <span className="text-xs font-extrabold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-lg">
                    {dist.projectedSupport}%
                  </span>
                </div>

                <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-800/80 pt-2">
                  <span className="flex items-center gap-1">
                    <Vote className="w-3.5 h-3.5 text-slate-400" />
                    {(dist.voterCensus).toLocaleString()} votantes
                  </span>
                  <span className="flex items-center gap-1 font-semibold text-slate-300">
                    <Target className="w-3.5 h-3.5 text-amber-400" />
                    {dist.seatsAvailable} escaños
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Selected District Detail & AI Strategy Panel */}
        {selectedDistrict ? (
          <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6">
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-blue-400">{selectedDistrict.region}</span>
                <h3 className="text-xl font-extrabold text-white mt-0.5">{selectedDistrict.name}</h3>
              </div>

              <button
                onClick={() => onGenerateDistrictStrategy(selectedDistrict.name, selectedDistrict.keyIssues)}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-emerald-600/30 transition-all shrink-0 cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-amber-300" />
                Generar Estrategia IA
              </button>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3.5 bg-slate-800/60 border border-slate-700/60 rounded-xl">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Censo Electoral RNEC</span>
                <span className="text-lg font-bold text-white mt-1 block font-mono">{(selectedDistrict.voterCensus).toLocaleString()}</span>
                <span className="text-[10px] text-slate-400">electores habilitados</span>
              </div>

              <div className="p-3.5 bg-slate-800/60 border border-slate-700/60 rounded-xl">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Escaños en Juego</span>
                <span className="text-lg font-bold text-amber-400 mt-1 block font-mono">{selectedDistrict.seatsAvailable}</span>
                <span className="text-[10px] text-slate-400">curules corporación</span>
              </div>

              <div className="p-3.5 bg-slate-800/60 border border-slate-700/60 rounded-xl">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Apoyo Proyectado</span>
                <span className="text-lg font-bold text-emerald-400 mt-1 block font-mono">{selectedDistrict.projectedSupport}%</span>
                <span className="text-[10px] text-slate-400">meta de votación</span>
              </div>
            </div>

            {/* Key Concerns / Issues */}
            <div className="space-y-3">
              <h4 className="font-bold text-slate-200 text-sm flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                Preocupaciones Ciudadanas Prioritarias en la Zona
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {selectedDistrict.keyIssues.map((issue, idx) => (
                  <div key={idx} className="p-3 bg-slate-800/40 border border-slate-800 rounded-xl flex items-start gap-3">
                    <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <p className="text-xs text-slate-200 font-medium leading-snug">{issue}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Campaign Deployment Checklist */}
            <div className="p-4 bg-slate-800/30 border border-slate-800 rounded-xl space-y-2">
              <h5 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Línea de Acción Territorial Recomendada</h5>
              <ul className="text-xs text-slate-400 space-y-1.5 list-disc list-inside">
                <li>Fortalecer comités de base en zonas urbanas y corregimientos de alta densidad.</li>
                <li>Focalizar vocería en seguridad rural, vías terciarias y apoyo a productores agropecuarios.</li>
                <li>Desplegar ferias de conversación ciudadana y control de transporte Día D con geolocalización.</li>
              </ul>
            </div>

          </div>
        ) : (
          <div className="lg:col-span-2 p-12 text-center bg-slate-900 border border-slate-800 rounded-2xl">
            <MapPin className="w-10 h-10 text-slate-600 mx-auto mb-2" />
            <p className="text-slate-400 text-xs">Selecciona un distrito para ver su análisis detallado.</p>
          </div>
        )}

      </div>

    </div>
  );
};
