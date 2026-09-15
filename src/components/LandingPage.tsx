import React from 'react';
import { 
  BarChart3, 
  Lock, 
  ShieldCheck, 
  TrendingUp, 
  ArrowRight, 
  Sparkles, 
  Layers3, 
  Cpu, 
  Building2, 
  Vote, 
  Award, 
  Users, 
  Radio, 
  CheckCircle2,
  ChevronRight,
  Database,
  MapPin
} from 'lucide-react';
import { SynapticNeuralBackground } from './SynapticNeuralBackground';

interface LandingPageProps {
  onEnterLogin: () => void;
  onOpenDemo: () => void;
  tenantName: string;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onEnterLogin, onOpenDemo, tenantName }) => {
  // Architectural Hierarchy Flow Diagram Data
  const architecturalHierarchyNodes = [
    {
      id: 'tenant',
      step: '01',
      label: 'Organización',
      scope: 'Tenant Root',
      desc: 'Aislamiento seguro multi-tenant y configuración de partido',
      icon: Building2,
      glow: 'border-cyan-500/40 text-cyan-300 bg-cyan-950/40'
    },
    {
      id: 'campana',
      step: '02',
      label: 'Comité Central',
      scope: 'Estrategia',
      desc: 'Planificación gerencial, presupuesto CNE y simulación',
      icon: Cpu,
      glow: 'border-blue-500/40 text-blue-300 bg-blue-950/40'
    },
    {
      id: 'departamento',
      step: '03',
      label: 'Gobernación & Asamblea',
      scope: 'Cesar Dept.',
      desc: 'Cobertura departamental, umbrales y cifra repartidora',
      icon: Award,
      glow: 'border-indigo-500/40 text-indigo-300 bg-indigo-950/40'
    },
    {
      id: 'municipio',
      step: '04',
      label: 'Alcaldía & Concejo',
      scope: 'Municipal',
      desc: 'Metas por mesas de votación en Astrea y municipios',
      icon: MapPin,
      glow: 'border-emerald-500/40 text-emerald-300 bg-emerald-950/40'
    },
    {
      id: 'lider',
      step: '05',
      label: 'Líderes de Base',
      scope: 'Veredas & Barrios',
      desc: 'Georreferenciación territorial de células operativas',
      icon: Users,
      glow: 'border-amber-500/40 text-amber-300 bg-amber-950/40'
    },
    {
      id: 'votantes',
      step: '06',
      label: 'Célula Electoral',
      scope: 'Día D',
      desc: 'Movilización real de votantes y asignación de transporte',
      icon: Vote,
      glow: 'border-purple-500/40 text-purple-300 bg-purple-950/40'
    }
  ];

  return (
    <div className="min-h-screen bg-[#030712] text-white flex flex-col font-sans relative isolate overflow-hidden">
      
      {/* Living Interactive Synaptic Neural Background with Fluid Physics */}
      <SynapticNeuralBackground interactive={true} />

      {/* Cybernetic Dot-Grid & Axon Glow Canvas */}
      <div className="absolute inset-0 -z-10 opacity-60 [background-size:48px_48px] [background-image:linear-gradient(rgba(34,211,238,.06)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,.06)_1px,transparent_1px)]" />

      {/* Ambient Bioluminescent Radial Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[560px] h-[560px] bg-cyan-500/20 rounded-full blur-[140px] pointer-events-none animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[560px] h-[560px] bg-blue-600/20 rounded-full blur-[140px] pointer-events-none" />

      {/* Hypnotic Axon Wave SVG Background */}
      <svg aria-hidden="true" className="absolute inset-0 -z-10 h-full w-full opacity-70 pointer-events-none" viewBox="0 0 1200 800" preserveAspectRatio="none">
        <defs>
          <linearGradient id="landingSynapse1" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.1" />
            <stop offset="35%" stopColor="#22d3ee" stopOpacity="0.8" />
            <stop offset="70%" stopColor="#818cf8" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#2dd4bf" stopOpacity="0.1" />
          </linearGradient>
          <linearGradient id="landingSynapse2" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.2" />
            <stop offset="50%" stopColor="#c084fc" stopOpacity="0.75" />
            <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.2" />
          </linearGradient>
          <filter id="glow-landing" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        <style>
          {`
            @keyframes pulseTravelLanding {
              0% { stroke-dashoffset: 1400; }
              100% { stroke-dashoffset: 0; }
            }
            @keyframes nodePulseLanding {
              0%, 100% { r: 4px; opacity: 0.7; }
              50% { r: 7.5px; opacity: 1; }
            }
            .landing-wave-1 {
              stroke-dasharray: 24 10 4 10;
              animation: pulseTravelLanding 30s linear infinite;
            }
            .landing-wave-2 {
              stroke-dasharray: 14 14;
              animation: pulseTravelLanding 38s linear infinite reverse;
            }
            .landing-node {
              animation: nodePulseLanding 3.8s ease-in-out infinite;
            }
          `}
        </style>

        <g>
          <path d="M-100 550 C200 420 260 760 500 490 S800 220 1300 370" fill="none" stroke="url(#landingSynapse1)" strokeWidth="2.2" filter="url(#glow-landing)" className="landing-wave-1" />
          <path d="M-80 240 C260 380 320 50 600 230 S1000 560 1280 110" fill="none" stroke="url(#landingSynapse2)" strokeWidth="1.8" filter="url(#glow-landing)" className="landing-wave-2" />
        </g>

        <g fill="#67e8f9">
          <circle cx="260" cy="520" r="5" className="landing-node" style={{ animationDelay: '0s' }} />
          <circle cx="500" cy="490" r="6" className="landing-node" style={{ animationDelay: '1.2s' }} />
          <circle cx="800" cy="290" r="5.5" className="landing-node" style={{ animationDelay: '2.4s' }} />
          <circle cx="1000" cy="340" r="5" className="landing-node" style={{ animationDelay: '1.8s' }} />
        </g>
      </svg>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 lg:px-12 py-10 relative z-10">
        <div className="max-w-6xl mx-auto text-center space-y-8 animate-fade-in">
          
          {/* Top Verification Pill */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-900/90 border border-cyan-500/40 text-xs font-black text-cyan-300 tracking-wide shadow-xl shadow-cyan-950/50 backdrop-blur-md">
            <Radio className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
            <span>Arquitectura Multi-Tenant Aislada · Centro de Mando & Control Territorial</span>
          </div>

          {/* Epic Suite Headline */}
          <div className="space-y-3">
            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight leading-[0.98]">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-sky-200 to-indigo-300 drop-shadow-lg">
                Astrea Suite Electoral
              </span>
            </h1>

            {/* Injected Prominently: Developer Signature in Requested Exact Spot */}
            <div className="flex items-center justify-center gap-2 pt-1 flex-wrap">
              <span className="text-xs sm:text-sm font-semibold text-slate-300">
                Plataforma Gerencial de Control Político, Logística Día D & Finanzas CNE
              </span>
            </div>

            {/* Developer Credit Placement: After Astrea Suite Electoral and Before Departamento del Cesar */}
            <div className="pt-2">
              <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-2xl bg-slate-950/80 border border-cyan-500/30 text-xs font-medium text-slate-300 shadow-md">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-spin-slow" />
                <span>Desarrollado por <strong className="text-white font-bold tracking-wide">Wilson José Arias</strong></span>
                <span className="text-slate-600">|</span>
                <span className="text-cyan-300 font-bold">Departamento del Cesar</span>
              </div>
            </div>

            <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-3xl mx-auto pt-2">
              Sistema integral de inteligencia territorial, simulación de umbral con cifra repartidora, monitoreo en tiempo real de flota para el Día D y gestión de Cuentas Claras.
            </p>
          </div>

          {/* Interactive Architectural Block Diagram (Diagrama de Bloques Operativos Jerárquicos) */}
          <div className="pt-4 space-y-3">
            <div className="flex items-center justify-center gap-2 text-xs font-bold text-cyan-300 uppercase tracking-widest">
              <Layers3 className="w-4 h-4 text-cyan-400" />
              <span>Diagrama Arquitectónico de Flujo Jerárquico</span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 pt-2">
              {architecturalHierarchyNodes.map((node, index) => {
                const Icon = node.icon;
                return (
                  <div 
                    key={node.id}
                    className={`relative group rounded-2xl border p-3.5 text-left shadow-xl backdrop-blur-md transition-all duration-300 hover:-translate-y-1 ${node.glow}`}
                  >
                    <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                      <span className="text-[10px] font-mono font-bold text-slate-400">
                        {node.step}
                      </span>
                      <Icon className="w-4 h-4 opacity-80 group-hover:scale-110 transition-transform" />
                    </div>

                    <div className="pt-2">
                      <h4 className="text-xs font-black text-white leading-tight">
                        {node.label}
                      </h4>
                      <p className="text-[10px] font-bold text-cyan-300 mt-0.5">
                        {node.scope}
                      </p>
                      <p className="text-[9px] text-slate-400 leading-tight mt-1 line-clamp-2">
                        {node.desc}
                      </p>
                    </div>

                    {index < architecturalHierarchyNodes.length - 1 && (
                      <div className="hidden lg:block absolute -right-2 top-1/2 -translate-y-1/2 z-20 pointer-events-none text-cyan-400/40">
                        <ChevronRight className="w-3.5 h-3.5" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Action CTAs with Bioluminescent Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-6">
            <button
              type="button"
              onClick={onEnterLogin}
              className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:via-blue-500 hover:to-indigo-500 text-white font-black rounded-2xl text-sm tracking-wide shadow-2xl shadow-cyan-950/70 border border-cyan-400/30 transition-all duration-300 transform hover:-translate-y-0.5 flex items-center justify-center gap-2.5 cursor-pointer"
            >
              <span>Acceder al Centro de Mando</span>
              <ArrowRight className="w-4 h-4 text-cyan-100" />
            </button>
            
            <button
              type="button"
              onClick={onOpenDemo}
              className="w-full sm:w-auto px-8 py-4 bg-slate-900/90 hover:bg-slate-800/90 border border-cyan-500/30 text-white font-bold rounded-2xl text-sm tracking-wide shadow-xl backdrop-blur-md transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer"
            >
              <BarChart3 className="w-4 h-4 text-amber-300" />
              <span>Ver Presentación Interactiva Demo</span>
            </button>
          </div>

          {/* Security & Verification Badges */}
          <div className="flex items-center justify-center gap-4 sm:gap-6 text-xs text-slate-400 pt-4 flex-wrap">
            <span className="flex items-center gap-1.5 bg-slate-950/60 border border-slate-800 px-3 py-1 rounded-xl">
              <Lock className="w-3.5 h-3.5 text-emerald-400" /> Acceso Restringido por Roles
            </span>
            <span className="flex items-center gap-1.5 bg-slate-950/60 border border-slate-800 px-3 py-1 rounded-xl">
              <Database className="w-3.5 h-3.5 text-cyan-400" /> Firestore Cloud Persistente
            </span>
            <span className="flex items-center gap-1.5 bg-slate-950/60 border border-slate-800 px-3 py-1 rounded-xl">
              <TrendingUp className="w-3.5 h-3.5 text-amber-400" /> Simulación Electoral en Vivo
            </span>
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950/90 py-5 px-6 text-center text-xs text-slate-400 backdrop-blur-xl relative z-10">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-cyan-300 font-bold">Astrea Suite Electoral</span>
          </div>

          <p className="text-[11px] text-slate-400 font-mono">
            Desarrollada por <strong className="text-slate-200">Wilson José Arias</strong> · Departamento del Cesar
          </p>
        </div>
      </footer>

    </div>
  );
};
