import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Database, ExternalLink, Layers, RefreshCw } from 'lucide-react';
import { DatabaseStats, fetchDatabaseStats } from '../lib/firebase';
import firebaseConfig from '../../firebase-applet-config.json';

interface FirestoreStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRefreshData: () => void;
}

const COLLECTIONS: Array<{ key: keyof DatabaseStats; label: string; path: string; tone: string }> = [
  { key: 'candidates', label: 'Candidatos', path: 'candidatos', tone: 'text-blue-300' },
  { key: 'expenses', label: 'Gastos', path: 'gastos', tone: 'text-emerald-300' },
  { key: 'leaders', label: 'Líderes', path: 'lideres', tone: 'text-amber-300' },
  { key: 'vehicles', label: 'Vehículos', path: 'vehiculos', tone: 'text-purple-300' },
  { key: 'districts', label: 'Territorios', path: 'distritos', tone: 'text-cyan-300' },
  { key: 'proposals', label: 'Propuestas', path: 'propuestas', tone: 'text-indigo-300' },
  { key: 'driveFiles', label: 'Archivos', path: 'archivos_drive', tone: 'text-slate-200' },
  { key: 'users', label: 'Usuarios', path: 'usuarios', tone: 'text-rose-300' },
];

export const FirestoreStatusModal: React.FC<FirestoreStatusModalProps> = ({ isOpen, onClose, onRefreshData }) => {
  const [stats, setStats] = useState<DatabaseStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const projectId = firebaseConfig.projectId;

  const loadStats = async () => {
    setLoading(true);
    setError(null);
    try {
      setStats(await fetchDatabaseStats());
      onRefreshData();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible verificar Firestore.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) void loadStats();
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-2xl space-y-6 overflow-y-auto rounded-3xl border border-slate-700 bg-slate-900 p-6 shadow-2xl sm:p-8">
        <header className="flex items-start justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-2.5 text-amber-300"><Database className="h-6 w-6" /></div>
            <div>
              <h2 className="text-xl font-bold text-white">Estado de Firestore</h2>
              <p className="text-xs text-slate-400">Conteos aislados al tenant de la sesión · {projectId}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="rounded-xl p-2 text-slate-400 hover:bg-slate-800 hover:text-white">✕</button>
        </header>

        <div className={`flex items-center gap-3 rounded-2xl border p-4 ${error ? 'border-rose-800/70 bg-rose-950/40' : 'border-emerald-800/70 bg-emerald-950/30'}`}>
          {error ? <AlertCircle className="h-5 w-5 shrink-0 text-rose-300" /> : <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-300" />}
          <div className="min-w-0 flex-1">
            <p className={`text-sm font-semibold ${error ? 'text-rose-200' : 'text-emerald-200'}`}>{error || 'Sesión conectada y consulta tenant-safe completada'}</p>
            <p className="text-[11px] text-slate-400">Última verificación: {stats?.lastUpdated || 'pendiente'}</p>
          </div>
          <button type="button" onClick={loadStats} disabled={loading} className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-200 disabled:opacity-50">
            <RefreshCw className={`mr-1.5 inline h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />Actualizar
          </button>
        </div>

        <section className="space-y-3">
          <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400"><Layers className="h-4 w-4" />Inventario visible</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {COLLECTIONS.map(({ key, label, path, tone }) => (
              <div key={path} className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                <span className="text-[10px] font-bold uppercase text-slate-500">{label}</span>
                <div className={`mt-1 flex items-end justify-between font-mono text-xl font-bold ${tone}`}>
                  <span>{stats ? String(stats[key]) : '—'}</span><span className="text-[9px] font-normal text-slate-500">/{path}</span>
                </div>
              </div>
            ))}
            <div className="rounded-xl border border-emerald-800/50 bg-emerald-950/20 p-3">
              <span className="text-[10px] font-bold uppercase text-emerald-300">Total visible</span>
              <div className="mt-1 font-mono text-xl font-bold text-white">{stats?.totalDocuments ?? '—'}</div>
            </div>
          </div>
          <p className="text-[11px] leading-relaxed text-slate-500">Los conteos dependen del rol y de las reglas activas. Un valor cero puede indicar una colección vacía o sin permiso para ese perfil.</p>
        </section>

        <footer className="flex flex-col-reverse gap-3 border-t border-slate-800 pt-4 sm:flex-row sm:justify-between">
          <a href={`https://console.firebase.google.com/project/${projectId}/firestore/databases/(default)/data`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800">
            Consola Firebase <ExternalLink className="h-3.5 w-3.5" />
          </a>
          <button type="button" onClick={onClose} className="rounded-xl bg-slate-800 px-5 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700">Cerrar</button>
        </footer>
      </div>
    </div>
  );
};
