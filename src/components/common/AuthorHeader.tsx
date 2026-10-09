import React from 'react';
import { Layers3, ShieldCheck, Cpu } from 'lucide-react';

interface AuthorHeaderProps {
  title?: string;
  subtitle?: string;
}

export const AuthorHeader: React.FC<AuthorHeaderProps> = ({
  title = "Astrea Suite Electoral 2026",
  subtitle = "Plataforma Gerencial de Control Político, Logística Día D & Finanzas"
}) => {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 md:p-5 shadow-xl relative overflow-hidden">
      <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-blue-600/10 rounded-full blur-2xl pointer-events-none" />
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-blue-500/20 text-blue-300 border border-blue-500/30 flex items-center gap-1">
              <Cpu className="w-3 h-3 text-blue-400" /> Arquitectura multi-tenant
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-emerald-400" /> Datos aislados y auditables
            </span>
          </div>
          <h1 className="text-xl md:text-2xl font-black text-white tracking-tight">{title}</h1>
          <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>
        </div>

        <div className="flex items-center gap-3 bg-slate-950/80 border border-slate-800 px-3.5 py-2 rounded-xl shrink-0">
          <div className="p-2 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg text-white shadow-md">
            <Layers3 className="w-4 h-4" />
          </div>
          <div className="text-left">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Plataforma</p>
            <p className="text-xs font-bold text-slate-100">Astrea Suite Electoral</p>
            <p className="text-[10px] text-blue-400 font-medium">Gestión operativa y administrativa</p>
          </div>
        </div>
      </div>
    </div>
  );
};
