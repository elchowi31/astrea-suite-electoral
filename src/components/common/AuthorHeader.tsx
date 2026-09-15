import React from 'react';
import { Layers3, ShieldCheck, Cpu, ArrowLeft, Sparkles, Radio } from 'lucide-react';

interface AuthorHeaderProps {
  title?: string;
  subtitle?: string;
  onBackToDashboard?: () => void;
  backButtonLabel?: string;
}

export const AuthorHeader: React.FC<AuthorHeaderProps> = ({
  title = "Astrea Suite Electoral 2026",
  subtitle = "Plataforma Gerencial de Control Político, Logística Día D & Finanzas",
  onBackToDashboard,
  backButtonLabel = "Volver al Dashboard"
}) => {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-cyan-500/25 bg-gradient-to-r from-slate-900 via-[#070d1a] to-[#02050e] p-5 sm:p-6 shadow-2xl backdrop-blur-xl">
      {/* Background Neural Glow */}
      <div className="absolute -right-12 -bottom-12 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none animate-pulse" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(34,211,238,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,0.02)_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 relative z-10">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            {onBackToDashboard && (
              <button
                type="button"
                onClick={onBackToDashboard}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 hover:text-white border border-cyan-500/30 shadow-sm transition flex items-center gap-1.5 cursor-pointer mr-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>{backButtonLabel}</span>
              </button>
            )}
            <span className="px-3 py-1 rounded-full text-[10px] font-black tracking-wider uppercase bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 flex items-center gap-1.5 shadow-sm">
              <Cpu className="w-3 h-3 text-cyan-400" /> Multi-Tenant Aislado
            </span>
            <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5">
              <ShieldCheck className="w-3 h-3 text-emerald-400" /> Auditoría CNE 2026
            </span>
            <span className="hidden sm:inline-flex px-2 py-0.5 rounded-md text-[10px] font-mono text-slate-400 bg-slate-950/80 border border-slate-800">
              <Radio className="w-2.5 h-2.5 text-cyan-400 mr-1 animate-pulse" /> Firestore Sincronizado
            </span>
          </div>
          <h1 className="text-xl md:text-2xl lg:text-3xl font-black text-white tracking-tight leading-tight">
            {title}
          </h1>
          <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">{subtitle}</p>
        </div>

        <div className="flex items-center gap-3.5 bg-slate-950/90 border border-cyan-500/25 px-4 py-3 rounded-2xl shrink-0 shadow-lg">
          <div className="p-2.5 bg-gradient-to-br from-cyan-500 via-blue-600 to-indigo-600 rounded-xl text-white shadow-md shadow-cyan-900/30">
            <Layers3 className="w-5 h-5" />
          </div>
          <div className="text-left">
            <p className="text-[9px] font-black uppercase tracking-wider text-cyan-400">Plataforma</p>
            <p className="text-xs font-black text-slate-100">Astrea Suite Electoral</p>
            <p className="text-[10px] text-slate-400 font-medium">Gestión Territorial & Día D</p>
          </div>
        </div>
      </div>
    </div>
  );
};
