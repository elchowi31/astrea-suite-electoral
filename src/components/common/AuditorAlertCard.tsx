import React from 'react';
import { AlertTriangle, AlertOctagon, CheckCircle2, ArrowRight, ShieldAlert, Sparkles, Truck, DollarSign, Users } from 'lucide-react';

export interface AuditAlert {
  id: string;
  type: 'logistics' | 'budget' | 'leaders' | 'polling';
  severity: 'high' | 'medium' | 'low';
  municipality: string;
  veredaOrBarrio?: string;
  title: string;
  description: string;
  impact: string;
  suggestedAction: string;
  autoExecutable?: boolean;
}

interface AuditorAlertCardProps {
  alert: AuditAlert;
  onExecuteAction: (alertId: string) => void;
}

export const AuditorAlertCard: React.FC<AuditorAlertCardProps> = ({ alert, onExecuteAction }) => {
  const getSeverityBadge = () => {
    switch (alert.severity) {
      case 'high':
        return {
          border: 'border-rose-500/40 bg-rose-950/30',
          icon: <AlertOctagon className="w-5 h-5 text-rose-400 shrink-0" />,
          badge: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
          label: 'CRÍTICO'
        };
      case 'medium':
        return {
          border: 'border-amber-500/40 bg-amber-950/20',
          icon: <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />,
          badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
          label: 'MEDIO'
        };
      default:
        return {
          border: 'border-blue-500/40 bg-blue-950/20',
          icon: <ShieldAlert className="w-5 h-5 text-blue-400 shrink-0" />,
          badge: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
          label: 'INFORMATIVO'
        };
    }
  };

  const getCategoryIcon = () => {
    switch (alert.type) {
      case 'logistics': return <Truck className="w-3.5 h-3.5 text-blue-400" />;
      case 'budget': return <DollarSign className="w-3.5 h-3.5 text-emerald-400" />;
      case 'leaders': return <Users className="w-3.5 h-3.5 text-indigo-400" />;
      default: return <Sparkles className="w-3.5 h-3.5 text-amber-400" />;
    }
  };

  const style = getSeverityBadge();

  return (
    <div className={`border rounded-2xl p-4 transition-all ${style.border}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          {style.icon}
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${style.badge}`}>
                {style.label}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700 flex items-center gap-1">
                {getCategoryIcon()}
                {alert.municipality} {alert.veredaOrBarrio ? `• ${alert.veredaOrBarrio}` : ''}
              </span>
            </div>
            <h4 className="text-sm font-bold text-white">{alert.title}</h4>
            <p className="text-xs text-slate-300 mt-1 leading-relaxed">{alert.description}</p>
          </div>
        </div>
      </div>

      <div className="mt-3 pt-2.5 border-t border-slate-800/80 grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
        <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
          <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Impacto Estimado:</span>
          <span className="text-rose-300 font-medium">{alert.impact}</span>
        </div>
        <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
          <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Solución IA Sugerida:</span>
          <span className="text-emerald-300 font-medium">{alert.suggestedAction}</span>
        </div>
      </div>

      <div className="mt-3 flex justify-end">
        <button
          onClick={() => onExecuteAction(alert.id)}
          className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded-xl shadow-md transition-all cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-300" />
          <span>Ejecutar Acción Correctiva</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
