import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: string | number;
  subtext?: string;
  icon: LucideIcon;
  iconColor?: string;
  iconBgColor?: string;
  badgeText?: string;
  badgeType?: 'success' | 'warning' | 'danger' | 'info';
  progressPercentage?: number;
  onClick?: () => void;
}

export const StatsCard: React.FC<StatsCardProps> = ({
  title,
  value,
  subtext,
  icon: Icon,
  iconColor = 'text-blue-400',
  iconBgColor = 'bg-blue-500/10 border-blue-500/20',
  badgeText,
  badgeType = 'info',
  progressPercentage,
  onClick
}) => {
  const getBadgeStyle = () => {
    switch (badgeType) {
      case 'success':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
      case 'warning':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
      case 'danger':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/30';
      default:
        return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
    }
  };

  return (
    <div 
      onClick={onClick}
      className={`bg-slate-900 border border-slate-800 rounded-2xl p-4 transition-all duration-200 hover:border-slate-700 hover:shadow-lg ${onClick ? 'cursor-pointer' : ''}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1">
          <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">{title}</p>
          <p className="text-2xl font-black text-white font-mono tracking-tight">{value}</p>
        </div>
        <div className={`p-2.5 rounded-xl border ${iconBgColor} shrink-0`}>
          <Icon className={`w-5 h-5 ${iconColor}`} />
        </div>
      </div>

      {progressPercentage !== undefined && (
        <div className="mt-3 space-y-1">
          <div className="flex justify-between text-[11px] font-semibold text-slate-400">
            <span>Progreso</span>
            <span className="text-slate-200 font-mono">{progressPercentage.toFixed(1)}%</span>
          </div>
          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all duration-500 ${
                progressPercentage >= 100 
                  ? 'bg-emerald-500' 
                  : progressPercentage >= 70 
                  ? 'bg-blue-500' 
                  : progressPercentage >= 40 
                  ? 'bg-amber-500' 
                  : 'bg-rose-500'
              }`}
              style={{ width: `${Math.min(100, Math.max(0, progressPercentage))}%` }}
            />
          </div>
        </div>
      )}

      {(subtext || badgeText) && (
        <div className="mt-2.5 flex items-center justify-between text-xs pt-1 border-t border-slate-800/60">
          {subtext && <span className="text-slate-400 text-[11px] truncate">{subtext}</span>}
          {badgeText && (
            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${getBadgeStyle()} shrink-0`}>
              {badgeText}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
