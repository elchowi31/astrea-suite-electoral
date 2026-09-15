import React, { useState, useMemo } from 'react';
import { 
  Tenant, 
  ElectoralLevel, 
  Candidate, 
  DhondtSimulationParty, 
  DhondtSimulationResult,
  DhondtQuotientStep
} from '../types';
import {
  DEPARTAMENTOS_COLOMBIA,
  getMunicipiosPorDepartamento,
  calcularProyeccionReal2026,
  COLOMBIA_ELECTORAL_GEOGRAPHY
} from '../data/colombiaElectoralData';
import { AuthorHeader } from './common/AuthorHeader';
import {
  Calculator,
  ShieldCheck,
  Award,
  Vote,
  Target,
  Users,
  CheckCircle2,
  AlertTriangle,
  Sliders,
  TrendingUp,
  RotateCcw,
  Sparkles,
  Layers,
  ArrowRight,
  BookOpen,
  FileSpreadsheet,
  Building2,
  Scale,
  Percent,
  Download,
  Plus,
  Trash2,
  Eye,
  Info,
  Zap,
  ArrowUpRight,
  ChevronDown
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

interface ElectoralSimulatorViewProps {
  currentTenant: Tenant;
  candidates?: Candidate[];
  onNavigateTab?: (tab: any) => void;
}

export const ElectoralSimulatorView: React.FC<ElectoralSimulatorViewProps> = ({
  currentTenant,
  candidates = [],
  onNavigateTab
}) => {
  // Electoral Selection
  const [selectedDept, setSelectedDept] = useState<string>('Cesar');
  const [selectedMuni, setSelectedMuni] = useState<string>('Astrea');
  const [electoralLevel, setElectoralLevel] = useState<ElectoralLevel>('Concejo Municipal');
  
  // Custom Sliders / Inputs
  const [customCensus, setCustomCensus] = useState<number>(19500);
  const [participacionPct, setParticipacionPct] = useState<number>(58.5);
  const [nulosPct, setNulosPct] = useState<number>(2.8);
  const [noMarcadosPct, setNoMarcadosPct] = useState<number>(1.4);
  const [blancoPct, setBlancoPct] = useState<number>(2.2);
  const [seatsInContest, setSeatsInContest] = useState<number>(13);

  // Active scenario mode
  const [activeScenario, setActiveScenario] = useState<'realista' | 'optimista' | 'conservador'>('realista');

  // Competitor Parties for D'Hondt Simulation
  const [parties, setParties] = useState<DhondtSimulationParty[]>([
    { 
      id: 'p1', 
      name: `${currentTenant.name} (Nuestra Lista)`, 
      votes: 3620, 
      isUserParty: true, 
      color: '#2563eb',
      candidatesCount: 13,
      candidateVotes: [
        { id: 'c1', name: 'Candidato Cabeza de Lista (101)', position: 1, votes: 1150 },
        { id: 'c2', name: 'Segundo Candidato (102)', position: 2, votes: 780 },
        { id: 'c3', name: 'Tercer Candidato (103)', position: 3, votes: 540 },
        { id: 'c4', name: 'Cuarto Candidato (104)', position: 4, votes: 410 },
        { id: 'c5', name: 'Voto Solo por el Logo / Partido', position: 0, votes: 740 }
      ]
    },
    { 
      id: 'p2', 
      name: 'Partido Tradicional A', 
      votes: 3120, 
      color: '#dc2626',
      candidatesCount: 13
    },
    { 
      id: 'p3', 
      name: 'Movimiento Cívico B', 
      votes: 2180, 
      color: '#16a34a',
      candidatesCount: 13
    },
    { 
      id: 'p4', 
      name: 'Coalición Regional C', 
      votes: 1450, 
      color: '#d97706',
      candidatesCount: 13
    },
    { 
      id: 'p5', 
      name: 'Partido Independiente D', 
      votes: 680, 
      color: '#9333ea',
      candidatesCount: 13
    }
  ]);

  // Tab view within calculator
  const [calcViewTab, setCalcViewTab] = useState<'dhondt_results' | 'matrix_step_by_step' | 'preferente_candidates' | 'sensitivity_analysis'>('dhondt_results');

  // Municipalities list
  const availableMunicipalities = getMunicipiosPorDepartamento(selectedDept);

  // Sync census when municipality or department changes
  const handleMuniChange = (muni: string) => {
    setSelectedMuni(muni);
    const deptData = COLOMBIA_ELECTORAL_GEOGRAPHY[selectedDept];
    if (deptData && deptData.municipios[muni]) {
      setCustomCensus(deptData.municipios[muni].censoAproximado);
    }
  };

  const handleDeptChange = (dept: string) => {
    setSelectedDept(dept);
    const munis = getMunicipiosPorDepartamento(dept);
    if (munis.length > 0) {
      setSelectedMuni(munis[0]);
      const deptData = COLOMBIA_ELECTORAL_GEOGRAPHY[dept];
      if (deptData && deptData.municipios[munis[0]]) {
        setCustomCensus(deptData.municipios[munis[0]].censoAproximado);
      }
    }
  };

  const handleLevelChange = (lvl: ElectoralLevel) => {
    setElectoralLevel(lvl);
    if (lvl === 'Alcaldía' || lvl === 'Gobernación') {
      setSeatsInContest(1);
    } else if (lvl === 'Concejo Municipal') {
      setSeatsInContest(13);
    } else if (lvl === 'Asamblea / Diputación') {
      setSeatsInContest(11);
    } else if (lvl === 'Cámara de Representantes') {
      setSeatsInContest(4);
    } else if (lvl === 'Senado de la República') {
      setSeatsInContest(100);
    }
  };

  // Scenario presets
  const applyScenario = (type: 'realista' | 'optimista' | 'conservador') => {
    setActiveScenario(type);
    if (type === 'optimista') {
      setParticipacionPct(62.0);
      setParties(prev => prev.map(p => p.isUserParty ? { ...p, votes: Math.round(p.votes * 1.25) } : { ...p, votes: Math.round(p.votes * 0.95) }));
    } else if (type === 'conservador') {
      setParticipacionPct(53.0);
      setParties(prev => prev.map(p => p.isUserParty ? { ...p, votes: Math.round(p.votes * 0.85) } : { ...p, votes: Math.round(p.votes * 1.05) }));
    } else {
      setParticipacionPct(58.5);
      setParties([
        { 
          id: 'p1', 
          name: `${currentTenant.name} (Nuestra Lista)`, 
          votes: 3620, 
          isUserParty: true, 
          color: '#2563eb',
          candidatesCount: 13,
          candidateVotes: [
            { id: 'c1', name: 'Candidato Cabeza de Lista (101)', position: 1, votes: 1150 },
            { id: 'c2', name: 'Segundo Candidato (102)', position: 2, votes: 780 },
            { id: 'c3', name: 'Tercer Candidato (103)', position: 3, votes: 540 },
            { id: 'c4', name: 'Cuarto Candidato (104)', position: 4, votes: 410 },
            { id: 'c5', name: 'Voto Solo por el Logo / Partido', position: 0, votes: 740 }
          ]
        },
        { id: 'p2', name: 'Partido Tradicional A', votes: 3120, color: '#dc2626', candidatesCount: 13 },
        { id: 'p3', name: 'Movimiento Cívico B', votes: 2180, color: '#16a34a', candidatesCount: 13 },
        { id: 'p4', name: 'Coalición Regional C', votes: 1450, color: '#d97706', candidatesCount: 13 },
        { id: 'p5', name: 'Partido Independiente D', votes: 680, color: '#9333ea', candidatesCount: 13 }
      ]);
    }
  };

  // ----------------------------------------------------
  // MOTOR DE CÁLCULO ELECTORAL (LEY 1475 & D'HONDT)
  // ----------------------------------------------------
  const calculationResult: DhondtSimulationResult = useMemo(() => {
    const totalCensus = customCensus;
    const totalVoters = Math.round(totalCensus * (participacionPct / 100));
    
    // Votos en Blanco, Nulos y No Marcados
    const nullVotes = Math.round(totalVoters * (nulosPct / 100));
    const unmarkedVotes = Math.round(totalVoters * (noMarcadosPct / 100));
    const blankVotes = Math.round(totalVoters * (blancoPct / 100));
    
    // Votos válidos = Votos por listas/candidatos + Votos en blanco
    // Total sufragantes válidos
    const totalValidVotes = totalVoters - nullVotes - unmarkedVotes;

    const isUninominal = electoralLevel === 'Alcaldía' || electoralLevel === 'Gobernación';
    const isSenadoOrCamaraNacional = electoralLevel === 'Senado de la República';

    // 1. Cociente Electoral
    // Cuociente = Votos Válidos / Número de Curules
    const quotient = seatsInContest > 0 ? Math.round(totalValidVotes / seatsInContest) : totalValidVotes;

    // 2. Umbral Legal Colombiano (Ley 1475 de 2011 / Art. 263 Constitución Política)
    // Para corporaciones públicas de más de 2 curules (Concejo / Asamblea / Cámara): Umbral = 50% del Cociente Electoral
    // Para Senado y circunscripciones nacionales especiales: Umbral = 3% de los votos válidos
    let thresholdVotes = 0;
    let thresholdPercentage = 0;

    if (isUninominal) {
      thresholdVotes = Math.round(totalValidVotes * 0.40); // Proyección de mayoría relativa
      thresholdPercentage = 40;
    } else if (isSenadoOrCamaraNacional) {
      thresholdVotes = Math.round(totalValidVotes * 0.03); // 3% Ley 1475
      thresholdPercentage = 3.0;
    } else {
      // 50% del cociente electoral
      thresholdVotes = Math.round(quotient * 0.50);
      thresholdPercentage = totalValidVotes > 0 ? Number(((thresholdVotes / totalValidVotes) * 100).toFixed(2)) : 0;
    }

    // 3. Filtrado de Partidos que Superan el Umbral
    const passedParties: DhondtSimulationParty[] = [];
    const failedParties: DhondtSimulationParty[] = [];

    parties.forEach(p => {
      if (p.votes >= thresholdVotes) {
        passedParties.push(p);
      } else {
        failedParties.push(p);
      }
    });

    // 4. Algoritmo D'Hondt (Cálculo de la Cifra Repartidora y Asignación de Curules)
    const dhondtSteps: DhondtQuotientStep[] = [];

    // Generar divisores de 1 hasta el número de curules para cada lista que superó el umbral
    passedParties.forEach(party => {
      for (let divisor = 1; divisor <= seatsInContest; divisor++) {
        const q = Math.floor(party.votes / divisor);
        dhondtSteps.push({
          partyId: party.id,
          partyName: party.name,
          partyColor: party.color,
          divisor,
          quotient: q,
          isSeatWinner: false
        });
      }
    });

    // Ordenar todos los cocientes de mayor a menor
    dhondtSteps.sort((a, b) => b.quotient - a.quotient);

    // Los primeros 'seatsInContest' cocientes obtienen curul
    const seatsToAssign = Math.min(seatsInContest, dhondtSteps.length);
    let cifraRepartidora = 0;

    for (let i = 0; i < seatsToAssign; i++) {
      dhondtSteps[i].isSeatWinner = true;
      dhondtSteps[i].seatWonNumber = i + 1;
    }

    if (seatsToAssign > 0 && dhondtSteps[seatsToAssign - 1]) {
      cifraRepartidora = dhondtSteps[seatsToAssign - 1].quotient;
    }

    // 5. Asignaciones por Partido
    const allocations = parties.map(party => {
      const isPassed = party.votes >= thresholdVotes;
      const partySteps = dhondtSteps.filter(s => s.partyId === party.id && s.isSeatWinner);
      const seatsWon = isPassed ? partySteps.length : 0;
      const seatNumbersWon = partySteps.map(s => s.seatWonNumber!).sort((a, b) => a - b);
      const votePercentage = totalValidVotes > 0 ? Number(((party.votes / totalValidVotes) * 100).toFixed(2)) : 0;
      const votesPerSeat = seatsWon > 0 ? Math.round(party.votes / seatsWon) : 0;
      const surplusVotes = cifraRepartidora > 0 ? party.votes - (cifraRepartidora * seatsWon) : 0;

      return {
        partyId: party.id,
        partyName: party.name,
        partyColor: party.color,
        isUserParty: !!party.isUserParty,
        totalVotes: party.votes,
        votePercentage,
        seatsWon,
        seatNumbersWon,
        votesPerSeat,
        surplusVotes,
        passedThreshold: isPassed
      };
    });

    const userAllocation = allocations.find(a => a.isUserParty) || allocations[0];
    const userPartySeats = userAllocation ? userAllocation.seatsWon : 0;

    // 6. Análisis de Sensibilidad: Votos faltantes para una curul más
    // Para ganar una curul más, el cociente con el divisor (curules_actuales + 1) debe superar la cifra repartidora actual
    const nextDivisor = userPartySeats + 1;
    const neededVotesForNext = (cifraRepartidora + 1) * nextDivisor;
    const userPartyMarginForNextSeat = Math.max(0, neededVotesForNext - (userAllocation?.totalVotes || 0));

    // Margen de seguridad: ¿cuántos votos le sobran a nuestro último escaño sobre el primer escaño perdedor?
    const firstLosingStep = dhondtSteps.find(s => !s.isSeatWinner);
    const highestLosingQuotient = firstLosingStep ? firstLosingStep.quotient : 0;
    const lowestWinningUserStep = dhondtSteps
      .filter(s => s.partyId === userAllocation?.partyId && s.isSeatWinner)
      .sort((a, b) => a.quotient - b.quotient)[0];
    
    const userPartySafetyMargin = lowestWinningUserStep ? Math.max(0, lowestWinningUserStep.quotient - highestLosingQuotient) : 0;

    return {
      totalCensus,
      totalVoters,
      turnoutPercentage: participacionPct,
      blankVotes,
      nullVotes,
      unmarkedVotes,
      totalValidVotes,
      thresholdPercentage,
      thresholdVotes,
      quotient,
      seatsInContest,
      electoralThresholdPassedParties: passedParties,
      electoralThresholdFailedParties: failedParties,
      allocationsByParty: allocations,
      dhondtMatrix: dhondtSteps,
      cifraRepartidora,
      userPartySeats,
      userPartyMarginForNextSeat,
      userPartySafetyMargin
    };
  }, [
    customCensus, 
    participacionPct, 
    nulosPct, 
    noMarcadosPct, 
    blancoPct, 
    seatsInContest, 
    electoralLevel, 
    parties, 
    currentTenant.name
  ]);

  // Handle party vote change
  const handlePartyVotesChange = (id: string, newVotes: number) => {
    setParties(prev => prev.map(p => p.id === id ? { ...p, votes: Math.max(0, newVotes) } : p));
  };

  // Add new competitor party
  const handleAddParty = () => {
    const newId = `p-${Date.now()}`;
    const colors = ['#ec4899', '#06b6d4', '#84cc16', '#6366f1', '#eab308'];
    const randomColor = colors[parties.length % colors.length];
    setParties(prev => [
      ...prev,
      {
        id: newId,
        name: `Nuevo Partido ${prev.length + 1}`,
        votes: 1200,
        color: randomColor,
        candidatesCount: seatsInContest
      }
    ]);
  };

  const handleRemoveParty = (id: string) => {
    if (parties.length <= 2) return;
    setParties(prev => prev.filter(p => p.id !== id));
  };

  // Export results to CSV
  const handleExportCSV = () => {
    const rows = [
      ['COLOMBIA 2026 - REPORTE DE CÁLCULO ELECTORAL Y CIFRA REPARTIDORA (LEY 1475)'],
      ['Departamento', selectedDept],
      ['Municipio', selectedMuni],
      ['Corporacion / Nivel', electoralLevel],
      ['Censo Electoral', calculationResult.totalCensus.toString()],
      ['Participacion Estimada', `${calculationResult.turnoutPercentage}%`],
      ['Votos Validos Totales', calculationResult.totalValidVotes.toString()],
      ['Cociente Electoral', calculationResult.quotient.toString()],
      ['Umbral Legal', `${calculationResult.thresholdVotes} votos (${calculationResult.thresholdPercentage}%)`],
      ['Cifra Repartidora D\'Hondt', calculationResult.cifraRepartidora.toString()],
      [''],
      ['PARTIDO', 'VOTOS', '% VOTOS', 'SUPERO UMBRAL', 'CURULES GANADAS', 'ESCAÑOS #'],
      ...calculationResult.allocationsByParty.map(a => [
        a.partyName,
        a.totalVotes.toString(),
        `${a.votePercentage}%`,
        a.passedThreshold ? 'SI' : 'NO',
        a.seatsWon.toString(),
        a.seatNumbersWon.join(' - ')
      ])
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(e => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Calculo_Electoral_${selectedMuni}_${electoralLevel.replace(/\s+/g, '_')}_2026.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div id="electoral-calculator-view" className="space-y-6 pb-12">
      {/* Header */}
      <AuthorHeader
        title="Calculadora Electoral en Tiempo Real & Cifra Repartidora D'Hondt"
        subtitle="Ingeniería electoral de alta precisión basada en la Ley 1475 de 2011 y Art. 263 de la Constitución Política de Colombia"
        badgeText="Ley 1475 / D'Hondt 2026"
      />

      {/* Top Banner with Quick Actions */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 border border-blue-800/40 rounded-xl p-5 text-white shadow-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-blue-600/30 border border-blue-500/50 flex items-center justify-center text-blue-300">
            <Calculator className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-lg text-white">Simulador Estratégico de Curules y Umbrales</h2>
              <span className="bg-blue-600/60 text-blue-200 text-xs px-2.5 py-0.5 rounded-full border border-blue-400/30 font-mono">
                {selectedMuni} • {selectedDept}
              </span>
            </div>
            <p className="text-xs text-slate-300">
              Modela el número mágico de victoria, cociente electoral y reparto de escaños con datos del censo oficial 2026.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Scenario Buttons */}
          <div className="bg-slate-800/90 p-1 rounded-lg border border-slate-700 flex items-center text-xs">
            <button
              onClick={() => applyScenario('conservador')}
              className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                activeScenario === 'conservador' ? 'bg-amber-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              Conservador
            </button>
            <button
              onClick={() => applyScenario('realista')}
              className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                activeScenario === 'realista' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              Realista
            </button>
            <button
              onClick={() => applyScenario('optimista')}
              className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                activeScenario === 'optimista' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              Optimista
            </button>
          </div>

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold px-3 py-2 rounded-lg border border-slate-700 transition-colors"
          >
            <Download className="w-4 h-4 text-blue-400" />
            <span>Exportar CSV</span>
          </button>
        </div>
      </div>

      {/* Control Panel Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Col: Territory & Level Selector */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Scale className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold text-slate-800 text-sm">1. Parámetros de la Elección</h3>
          </div>

          {/* Department */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Departamento</label>
            <select
              value={selectedDept}
              onChange={(e) => handleDeptChange(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              {DEPARTAMENTOS_COLOMBIA.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          {/* Municipality */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Municipio</label>
            <select
              value={selectedMuni}
              onChange={(e) => handleMuniChange(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              {availableMunicipalities.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          {/* Electoral Level */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Corporación / Cargo</label>
            <select
              value={electoralLevel}
              onChange={(e) => handleLevelChange(e.target.value as ElectoralLevel)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold text-blue-700 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value="Concejo Municipal">Concejo Municipal (Plurinominal)</option>
              <option value="Alcaldía">Alcaldía Municipal (Uninominal)</option>
              <option value="Asamblea / Diputación">Asamblea Departamental (Plurinominal)</option>
              <option value="Gobernación">Gobernación Departamental (Uninominal)</option>
              <option value="Cámara de Representantes">Cámara de Representantes (Plurinominal)</option>
              <option value="Senado de la República">Senado de la República (Nacional)</option>
            </select>
          </div>

          {/* Curules / Seats */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-semibold text-slate-600">Curules a Proveer</label>
              <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                {seatsInContest} {seatsInContest === 1 ? 'Curul / Cargo' : 'Curules'}
              </span>
            </div>
            <input
              type="range"
              min="1"
              max="21"
              step="1"
              value={seatsInContest}
              onChange={(e) => setSeatsInContest(parseInt(e.target.value))}
              disabled={electoralLevel === 'Alcaldía' || electoralLevel === 'Gobernación'}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              {electoralLevel === 'Concejo Municipal' ? 'Astrea: 13 concejales según población.' : ''}
              {electoralLevel === 'Asamblea / Diputación' ? 'Cesar: 11 curules a la Asamblea.' : ''}
            </p>
          </div>

          {/* Official Census input */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Censo Electoral Oficial</label>
            <input
              type="number"
              value={customCensus}
              onChange={(e) => setCustomCensus(Math.max(100, parseInt(e.target.value) || 0))}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Middle Col: Voting Turnout & Behavior Sliders */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Sliders className="w-5 h-5 text-indigo-600" />
            <h3 className="font-bold text-slate-800 text-sm">2. Proyección de Comportamiento Electoral</h3>
          </div>

          {/* Participacion Slider */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-semibold text-slate-600">Participación Electoral</label>
              <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                {participacionPct}% ({calculationResult.totalVoters.toLocaleString()} votantes)
              </span>
            </div>
            <input
              type="range"
              min="30"
              max="85"
              step="0.5"
              value={participacionPct}
              onChange={(e) => setParticipacionPct(parseFloat(e.target.value))}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
            />
            <div className="flex justify-between text-[10px] text-slate-400 mt-1">
              <span>Baja (30%)</span>
              <span>Promedio Histórico (58%)</span>
              <span>Alta (85%)</span>
            </div>
          </div>

          {/* Nulos & No Marcados */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Votos Nulos ({nulosPct}%)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="15"
                value={nulosPct}
                onChange={(e) => setNulosPct(parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800"
              />
              <span className="text-[10px] text-slate-400">{calculationResult.nullVotes.toLocaleString()} votos</span>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">No Marcados ({noMarcadosPct}%)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="10"
                value={noMarcadosPct}
                onChange={(e) => setNoMarcadosPct(parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800"
              />
              <span className="text-[10px] text-slate-400">{calculationResult.unmarkedVotes.toLocaleString()} votos</span>
            </div>
          </div>

          {/* Voto en Blanco */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-[11px] font-semibold text-slate-600">Voto en Blanco</label>
              <span className="text-[11px] font-bold text-slate-700">{blancoPct}% ({calculationResult.blankVotes.toLocaleString()} votos)</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="15"
              step="0.1"
              value={blancoPct}
              onChange={(e) => setBlancoPct(parseFloat(e.target.value))}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-slate-600"
            />
          </div>

          {/* Summary Box */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1.5 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Votantes Totales (Sufragantes):</span>
              <span className="font-semibold text-slate-800">{calculationResult.totalVoters.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Votos Válidos Proyectados:</span>
              <span className="font-bold text-emerald-700">{calculationResult.totalValidVotes.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Right Col: Ley 1475 Legal Metrics Box */}
        <div className="bg-gradient-to-br from-blue-900 to-indigo-950 rounded-xl p-5 text-white shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-blue-800/60 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-blue-400" />
                <h3 className="font-bold text-sm text-white">Métricas Legales Ley 1475</h3>
              </div>
              <span className="bg-blue-800/80 text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded text-blue-200">
                Oficial
              </span>
            </div>

            <div className="space-y-3">
              {/* Cociente Electoral */}
              <div className="bg-blue-950/60 border border-blue-800/40 rounded-lg p-3">
                <div className="text-[11px] text-blue-300 uppercase font-semibold">Cociente Electoral (Válidos / Curules)</div>
                <div className="text-2xl font-black text-white mt-0.5">
                  {calculationResult.quotient.toLocaleString()} <span className="text-xs font-normal text-blue-300">votos</span>
                </div>
                <div className="text-[10px] text-blue-300 mt-1">
                  Formula: {calculationResult.totalValidVotes.toLocaleString()} ÷ {seatsInContest} curules
                </div>
              </div>

              {/* Umbral Legal */}
              <div className="bg-blue-950/60 border border-blue-800/40 rounded-lg p-3">
                <div className="flex justify-between items-center">
                  <div className="text-[11px] text-amber-300 uppercase font-semibold">Umbral Legal Requerido</div>
                  <span className="text-xs font-bold bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded border border-amber-500/30">
                    {calculationResult.thresholdPercentage}%
                  </span>
                </div>
                <div className="text-2xl font-black text-amber-400 mt-0.5">
                  {calculationResult.thresholdVotes.toLocaleString()} <span className="text-xs font-normal text-amber-200">votos mínimos</span>
                </div>
                <div className="text-[10px] text-blue-200 mt-1">
                  50% del Cociente Electoral (Art. 263 CN / Ley 1475)
                </div>
              </div>

              {/* Cifra Repartidora Oficial */}
              <div className="bg-blue-950/60 border border-blue-800/40 rounded-lg p-3">
                <div className="text-[11px] text-emerald-300 uppercase font-semibold">Cifra Repartidora D'Hondt Oficial</div>
                <div className="text-2xl font-black text-emerald-400 mt-0.5">
                  {calculationResult.cifraRepartidora.toLocaleString()} <span className="text-xs font-normal text-emerald-200">votos</span>
                </div>
                <div className="text-[10px] text-blue-200 mt-1">
                  Cociente correspondiente a la curul #{seatsInContest}
                </div>
              </div>
            </div>
          </div>

          {/* User Party summary */}
          <div className="mt-4 pt-3 border-t border-blue-800/60 flex items-center justify-between text-xs">
            <div>
              <span className="text-blue-300">Curules Obtenidas por Nuestra Lista:</span>
              <div className="text-lg font-black text-white">{calculationResult.userPartySeats} de {seatsInContest} curules</div>
            </div>
            <div className="text-right">
              <span className="text-blue-300">Votos Faltantes para Otra Curul:</span>
              <div className="text-sm font-bold text-amber-300">
                {calculationResult.userPartyMarginForNextSeat > 0 ? `+${calculationResult.userPartyMarginForNextSeat.toLocaleString()} votos` : 'Límite Máximo'}
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Competitor Parties Configuration Bar */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            <div>
              <h3 className="font-bold text-slate-800 text-sm">3. Votación Proyectada por Lista / Partido en Contienda</h3>
              <p className="text-xs text-slate-500">Edita los votos estimados de cada fuerza política para recalcular D'Hondt en tiempo real</p>
            </div>
          </div>

          <button
            onClick={handleAddParty}
            className="flex items-center gap-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold px-3 py-1.5 rounded-lg border border-blue-200 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Agregar Partido Rival</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {parties.map((p) => {
            const isPassed = p.votes >= calculationResult.thresholdVotes;
            const partyAlloc = calculationResult.allocationsByParty.find(a => a.partyId === p.id);
            const seats = partyAlloc ? partyAlloc.seatsWon : 0;

            return (
              <div
                key={p.id}
                className={`rounded-xl border p-4 transition-all relative ${
                  p.isUserParty 
                    ? 'border-blue-500 bg-blue-50/50 shadow-md ring-1 ring-blue-400' 
                    : 'border-slate-200 bg-slate-50/70 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span 
                      className="w-3.5 h-3.5 rounded-full inline-block shrink-0 shadow-sm" 
                      style={{ backgroundColor: p.color }} 
                    />
                    <span className="font-bold text-xs text-slate-800 truncate max-w-[180px]">
                      {p.name}
                    </span>
                  </div>

                  {p.isUserParty && (
                    <span className="bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                      Nuestra Lista
                    </span>
                  )}

                  {!p.isUserParty && parties.length > 2 && (
                    <button
                      onClick={() => handleRemoveParty(p.id)}
                      className="text-slate-400 hover:text-rose-600 transition-colors p-1"
                      title="Eliminar partido"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="space-y-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">Votos Estimados</label>
                    <input
                      type="number"
                      value={p.votes}
                      onChange={(e) => handlePartyVotesChange(p.id, parseInt(e.target.value) || 0)}
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>

                  {/* Status Badges */}
                  <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/80">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      isPassed ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                    }`}>
                      {isPassed ? '✓ Supera Umbral' : '✗ No Supera Umbral'}
                    </span>

                    <span className="font-black text-xs text-slate-800">
                      {seats} {seats === 1 ? 'Curul' : 'Curules'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tabs for Analysis Views */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="border-b border-slate-200 bg-slate-50 px-5 pt-3 flex flex-wrap gap-2">
          <button
            onClick={() => setCalcViewTab('dhondt_results')}
            className={`px-4 py-2.5 text-xs font-bold rounded-t-lg transition-all flex items-center gap-2 border-b-2 ${
              calcViewTab === 'dhondt_results'
                ? 'border-blue-600 bg-white text-blue-700 shadow-sm'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Award className="w-4 h-4" />
            <span>Asignación de Curules & Gráficas</span>
          </button>

          <button
            onClick={() => setCalcViewTab('matrix_step_by_step')}
            className={`px-4 py-2.5 text-xs font-bold rounded-t-lg transition-all flex items-center gap-2 border-b-2 ${
              calcViewTab === 'matrix_step_by_step'
                ? 'border-blue-600 bg-white text-blue-700 shadow-sm'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Tabla de Divisores D'Hondt Paso a Paso</span>
          </button>

          <button
            onClick={() => setCalcViewTab('preferente_candidates')}
            className={`px-4 py-2.5 text-xs font-bold rounded-t-lg transition-all flex items-center gap-2 border-b-2 ${
              calcViewTab === 'preferente_candidates'
                ? 'border-blue-600 bg-white text-blue-700 shadow-sm'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Vote className="w-4 h-4" />
            <span>Voto Preferente & Candidatos de Lista</span>
          </button>

          <button
            onClick={() => setCalcViewTab('sensitivity_analysis')}
            className={`px-4 py-2.5 text-xs font-bold rounded-t-lg transition-all flex items-center gap-2 border-b-2 ${
              calcViewTab === 'sensitivity_analysis'
                ? 'border-blue-600 bg-white text-blue-700 shadow-sm'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>Análisis de Sensibilidad & Margen Seguro</span>
          </button>
        </div>

        <div className="p-6">
          {/* TAB 1: Results & Charts */}
          {calcViewTab === 'dhondt_results' && (
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                  <span className="text-xs text-slate-500 font-semibold">Total Curules Disputadas</span>
                  <div className="text-2xl font-black text-slate-800 mt-1">{seatsInContest}</div>
                  <span className="text-[11px] text-slate-400">{electoralLevel}</span>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <span className="text-xs text-blue-600 font-semibold">Curules Nuestra Coalición</span>
                  <div className="text-2xl font-black text-blue-700 mt-1">{calculationResult.userPartySeats}</div>
                  <span className="text-[11px] text-blue-500">
                    {seatsInContest > 0 ? ((calculationResult.userPartySeats / seatsInContest) * 100).toFixed(1) : 0}% de la corporación
                  </span>
                </div>

                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                  <span className="text-xs text-emerald-600 font-semibold">Cifra Repartidora Final</span>
                  <div className="text-2xl font-black text-emerald-700 mt-1">{calculationResult.cifraRepartidora.toLocaleString()}</div>
                  <span className="text-[11px] text-emerald-600">Cociente de corte oficial</span>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <span className="text-xs text-amber-600 font-semibold">Umbral Legal (50% Cociente)</span>
                  <div className="text-2xl font-black text-amber-700 mt-1">{calculationResult.thresholdVotes.toLocaleString()}</div>
                  <span className="text-[11px] text-amber-600">{calculationResult.thresholdPercentage}% del total válido</span>
                </div>
              </div>

              {/* Table of allocations */}
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Partido / Lista</th>
                      <th className="py-3 px-4 text-right">Votos Obtenidos</th>
                      <th className="py-3 px-4 text-right">% Votos</th>
                      <th className="py-3 px-4 text-center">Estado Umbral</th>
                      <th className="py-3 px-4 text-center">Curules Ganadas</th>
                      <th className="py-3 px-4 text-left">Escaños Obtenidos</th>
                      <th className="py-3 px-4 text-right">Costo Voto / Curul</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {calculationResult.allocationsByParty.map((alloc) => (
                      <tr 
                        key={alloc.partyId}
                        className={alloc.isUserParty ? 'bg-blue-50/70 font-semibold' : 'hover:bg-slate-50'}
                      >
                        <td className="py-3 px-4 flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: alloc.partyColor }} />
                          <span className="text-slate-800">{alloc.partyName}</span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-800">
                          {alloc.totalVotes.toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-right text-slate-600 font-mono">
                          {alloc.votePercentage}%
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                            alloc.passedThreshold ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                          }`}>
                            {alloc.passedThreshold ? 'Superó' : 'Sin Umbral'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-black ${
                            alloc.seatsWon > 0 ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-200 text-slate-600'
                          }`}>
                            {alloc.seatsWon}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex flex-wrap gap-1">
                            {alloc.seatNumbersWon.map(num => (
                              <span 
                                key={num}
                                className="bg-slate-800 text-white text-[10px] font-bold px-1.5 py-0.5 rounded font-mono"
                              >
                                #{num}
                              </span>
                            ))}
                            {alloc.seatNumbersWon.length === 0 && (
                              <span className="text-slate-400 text-[11px]">-</span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-slate-600">
                          {alloc.votesPerSeat > 0 ? `${alloc.votesPerSeat.toLocaleString()} votos/curul` : 'N/A'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Chart Comparison */}
              <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
                <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider mb-4">
                  Distribución Gráfica de Curules Asignadas
                </h4>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={calculationResult.allocationsByParty} margin={{ top: 10, right: 30, left: 0, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f8" />
                      <XAxis dataKey="partyName" tick={{ fontSize: 11 }} />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="seatsWon" name="Curules Asignadas" radius={[6, 6, 0, 0]}>
                        {calculationResult.allocationsByParty.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.partyColor} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Step by step Divisors matrix */}
          {calcViewTab === 'matrix_step_by_step' && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs text-blue-900 flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-sm mb-1">¿Cómo funciona el método D'Hondt de la Cifra Repartidora?</h4>
                  <p className="leading-relaxed">
                    1. Se eliminan las listas que no alcancen el umbral legal ({calculationResult.thresholdVotes.toLocaleString()} votos).<br/>
                    2. Los votos de las listas restantes se dividen sucesivamente por 1, 2, 3, 4... hasta el número de curules ({seatsInContest}).<br/>
                    3. Se ordenan todos los cocientes resultantes de mayor a menor. El cociente ubicado en la posición #{seatsInContest} es la <strong>Cifra Repartidora ({calculationResult.cifraRepartidora.toLocaleString()})</strong>.<br/>
                    4. Las celdas en verde corresponden a los cocientes que obtuvieron escaño parlamentario.
                  </p>
                </div>
              </div>

              {/* Step Matrix Table */}
              <div className="border border-slate-200 rounded-xl overflow-x-auto shadow-sm">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3 border-r border-slate-200">Lista / Partido</th>
                      <th className="py-2.5 px-3 text-right border-r border-slate-200">Votos Base</th>
                      {Array.from({ length: Math.min(10, seatsInContest) }).map((_, idx) => (
                        <th key={idx} className="py-2.5 px-3 text-center border-r border-slate-200">
                          ÷ {idx + 1}
                        </th>
                      ))}
                      <th className="py-2.5 px-3 text-center">Curules</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {calculationResult.electoralThresholdPassedParties.map((party) => {
                      const partySteps = calculationResult.dhondtMatrix.filter(s => s.partyId === party.id);
                      const wonCount = partySteps.filter(s => s.isSeatWinner).length;

                      return (
                        <tr key={party.id} className="hover:bg-slate-50">
                          <td className="py-2.5 px-3 font-semibold text-slate-800 border-r border-slate-200 flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: party.color }} />
                            <span>{party.name}</span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-700 border-r border-slate-200">
                            {party.votes.toLocaleString()}
                          </td>
                          {Array.from({ length: Math.min(10, seatsInContest) }).map((_, idx) => {
                            const divisor = idx + 1;
                            const step = partySteps.find(s => s.divisor === divisor);
                            const isWin = step?.isSeatWinner;
                            const seatNum = step?.seatWonNumber;

                            return (
                              <td 
                                key={idx} 
                                className={`py-2 px-2 text-center font-mono border-r border-slate-200 text-xs ${
                                  isWin 
                                    ? 'bg-emerald-100 text-emerald-900 font-bold border-emerald-300' 
                                    : 'text-slate-500 bg-white'
                                }`}
                              >
                                <div>{step ? step.quotient.toLocaleString() : '-'}</div>
                                {isWin && (
                                  <span className="bg-emerald-600 text-white text-[9px] font-bold px-1.5 py-0.2 rounded mt-0.5 inline-block">
                                    Curul #{seatNum}
                                  </span>
                                )}
                              </td>
                            );
                          })}
                          <td className="py-2.5 px-3 text-center font-black text-sm text-blue-700">
                            {wonCount}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: Preferente Candidates Simulation */}
          {calcViewTab === 'preferente_candidates' && (
            <div className="space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="font-bold text-sm text-slate-800">
                    Asignación Nominal de Curules dentro de Nuestra Lista ({currentTenant.name})
                  </h4>
                  <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2.5 py-0.5 rounded-full">
                    {calculationResult.userPartySeats} Curules Ganadas
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  En el sistema de voto preferente colombiano, las curules ganadas por la lista se asignan a los candidatos con mayor votación individual.
                </p>
              </div>

              {/* Candidates list table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Posición / Número</th>
                      <th className="py-3 px-4">Nombre del Candidato</th>
                      <th className="py-3 px-4 text-right">Votos Preferentes</th>
                      <th className="py-3 px-4 text-right">% del Voto de Lista</th>
                      <th className="py-3 px-4 text-center">Estado de Elección</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {parties.find(p => p.isUserParty)?.candidateVotes?.map((c, idx) => {
                      const isElected = idx < calculationResult.userPartySeats && c.position !== 0;
                      const userPartyVotes = parties.find(p => p.isUserParty)?.votes || 1;
                      const pct = ((c.votes / userPartyVotes) * 100).toFixed(1);

                      return (
                        <tr 
                          key={c.id}
                          className={isElected ? 'bg-emerald-50/70 font-semibold' : 'hover:bg-slate-50'}
                        >
                          <td className="py-3 px-4 font-mono font-bold text-slate-700">
                            {c.position === 0 ? 'Logo Partido' : `#${c.position}`}
                          </td>
                          <td className="py-3 px-4 text-slate-800">
                            {c.name}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-slate-800">
                            {c.votes.toLocaleString()}
                          </td>
                          <td className="py-3 px-4 text-right text-slate-500 font-mono">
                            {pct}%
                          </td>
                          <td className="py-3 px-4 text-center">
                            {c.position === 0 ? (
                              <span className="text-slate-400 text-[10px]">Voto al Partido</span>
                            ) : isElected ? (
                              <span className="inline-flex items-center gap-1 bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                                <Award className="w-3 h-3" />
                                <span>ELECTO (Curul #{idx + 1})</span>
                              </span>
                            ) : (
                              <span className="text-slate-400 text-[10px]">No Electo</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: Sensitivity & Safety Margins */}
          {calcViewTab === 'sensitivity_analysis' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Margin to gain 1 more seat */}
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <Zap className="w-5 h-5 text-blue-600" />
                    <h4 className="font-bold text-slate-800 text-sm">Meta para Conquistar una Curul Adicional</h4>
                  </div>
                  <p className="text-xs text-slate-600">
                    Calcula cuántos votos netos debe movilizar nuestra campaña para superar el último cociente repartidor y arrebatar una curul más:
                  </p>

                  <div className="bg-white rounded-lg p-4 border border-blue-100 shadow-sm space-y-2">
                    <div className="flex justify-between items-center text-xs text-slate-600">
                      <span>Curules Actuales:</span>
                      <span className="font-bold text-slate-800">{calculationResult.userPartySeats} curules</span>
                    </div>
                    <div className="flex justify-between items-center text-xs text-slate-600">
                      <span>Meta para la Curul #{calculationResult.userPartySeats + 1}:</span>
                      <span className="font-bold text-blue-700">
                        {((calculationResult.cifraRepartidora + 1) * (calculationResult.userPartySeats + 1)).toLocaleString()} votos totales
                      </span>
                    </div>
                    <div className="border-t border-slate-100 pt-2 flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-800">Votos Adicionales Requeridos:</span>
                      <span className="text-lg font-black text-blue-600">
                        +{calculationResult.userPartyMarginForNextSeat.toLocaleString()} votos
                      </span>
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-500">
                    💡 Recomendación: Asignar 2 líderes territoriales adicionales en corregimientos con alta abstención (ej. Arjona) para capturar estos {calculationResult.userPartyMarginForNextSeat.toLocaleString()} votos.
                  </div>
                </div>

                {/* Safety Margin against losing current last seat */}
                <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-emerald-600" />
                    <h4 className="font-bold text-slate-800 text-sm">Margen de Blindaje de Nuestra Última Curul</h4>
                  </div>
                  <p className="text-xs text-slate-600">
                    Evalúa la ventaja que tiene el cociente de nuestra última curul asignada sobre el primer cociente derrotado del rival:
                  </p>

                  <div className="bg-white rounded-lg p-4 border border-emerald-100 shadow-sm space-y-2">
                    <div className="flex justify-between items-center text-xs text-slate-600">
                      <span>Cociente de Nuestro Último Escaño:</span>
                      <span className="font-bold text-emerald-800 font-mono">
                        {calculationResult.userPartySeats > 0 ? Math.floor(parties.find(p => p.isUserParty)!.votes / calculationResult.userPartySeats).toLocaleString() : 0}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs text-slate-600">
                      <span>Cifra Repartidora de Corte:</span>
                      <span className="font-bold text-slate-700 font-mono">{calculationResult.cifraRepartidora.toLocaleString()}</span>
                    </div>
                    <div className="border-t border-slate-100 pt-2 flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-800">Colchón de Seguridad:</span>
                      <span className="text-lg font-black text-emerald-600">
                        {calculationResult.userPartySafetyMargin.toLocaleString()} votos de ventaja
                      </span>
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-500">
                    🛡️ Estado de Seguridad: {calculationResult.userPartySafetyMargin > 200 ? 'Zona Segura y Estable' : 'Zona de Riesgo - Requiere Auditoría Día D'}
                  </div>
                </div>

              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
