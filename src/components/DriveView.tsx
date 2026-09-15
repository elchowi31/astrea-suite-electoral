import React, { useState } from 'react';
import { DriveFileItem, Tenant } from '../types';
import { FolderGit2, RefreshCw, FileText, Sparkles, ExternalLink, Download, CheckCircle2, AlertCircle, FileCheck2, Loader2 } from 'lucide-react';

interface DriveViewProps {
  currentTenant: Tenant;
  driveFiles: DriveFileItem[];
  driveSyncing: boolean;
  onScanDrive: () => void;
  onAnalyzeDriveFileWithAi: (file: DriveFileItem) => void;
}

export const DriveView: React.FC<DriveViewProps> = ({
  currentTenant,
  driveFiles,
  driveSyncing,
  onScanDrive,
  onAnalyzeDriveFileWithAi,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('TODOS');
  const [analyzingFileId, setAnalyzingFileId] = useState<string | null>(null);

  const tenantFiles = driveFiles.filter((f) => f.tenantId === currentTenant.tenantId || !f.tenantId);

  const categories = Array.from(new Set(tenantFiles.map((f) => f.category)));

  const filteredFiles = tenantFiles.filter((f) => {
    return selectedCategory === 'TODOS' || f.category === selectedCategory;
  });

  const handleAnalyzeClick = async (file: DriveFileItem) => {
    setAnalyzingFileId(file.id);
    await onAnalyzeDriveFileWithAi(file);
    setAnalyzingFileId(null);
  };

  return (
    <div className="space-y-6">
      
      {/* Drive Folder Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 p-6 rounded-2xl border border-blue-500/30 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <FolderGit2 className="w-5 h-5 text-blue-400" />
            <span className="text-xs font-mono font-bold text-blue-300 bg-blue-500/20 px-2.5 py-0.5 rounded-full border border-blue-500/30">
              Documentos autorizados de Google Drive
            </span>
          </div>
          <h2 className="text-2xl font-extrabold text-white">
            Explorador de Archivos & Documentación Electoral
          </h2>
          <p className="text-xs text-slate-300 mt-1 max-w-2xl">
            Sincronización en tiempo real con la carpeta de Google Drive del proyecto. Procesa minutas, dossiés de candidatos y censos electorales directamente con IA.
          </p>
        </div>

        <button
          onClick={onScanDrive}
          disabled={driveSyncing}
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold text-xs rounded-xl shadow-lg shadow-blue-600/30 transition-all shrink-0"
        >
          <RefreshCw className={`w-4 h-4 ${driveSyncing ? 'animate-spin' : ''}`} />
          <span>{driveSyncing ? 'Escaneando Drive...' : 'Escanear Carpeta Drive'}</span>
        </button>
      </div>

      {/* Category Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setSelectedCategory('TODOS')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
            selectedCategory === 'TODOS'
              ? 'bg-blue-600 text-white shadow-md'
              : 'bg-slate-900 text-slate-400 hover:bg-slate-800 border border-slate-800'
          }`}
        >
          Todos los Archivos ({tenantFiles.length})
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              selectedCategory === cat
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-slate-900 text-slate-400 hover:bg-slate-800 border border-slate-800'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Drive File Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredFiles.map((file) => {
          const isAnalyzing = analyzingFileId === file.id;

          return (
            <div
              key={file.id}
              className="bg-slate-900 border border-slate-800 hover:border-blue-500/50 rounded-2xl p-5 flex flex-col justify-between transition-all shadow-md group"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0 border border-blue-500/20">
                      <FileCheck2 className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-blue-300 uppercase tracking-wider block">
                        {file.category}
                      </span>
                      <h3 className="font-bold text-slate-100 text-sm leading-snug group-hover:text-blue-300 transition-colors">
                        {file.name}
                      </h3>
                    </div>
                  </div>

                  {file.size && (
                    <span className="text-[10px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded-md font-mono shrink-0">
                      {file.size}
                    </span>
                  )}
                </div>

                <p className="text-xs text-slate-300 mt-3 bg-slate-800/40 p-3 rounded-xl border border-slate-800/80 leading-relaxed">
                  {file.summary}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between">
                <span className="text-[10px] text-slate-400 flex items-center gap-1 font-mono">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  Sincronizado: {new Date(file.syncedAt).toLocaleTimeString()}
                </span>

                <div className="flex items-center gap-2">
                  {file.webViewLink && (
                    <a
                      href={file.webViewLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 text-slate-400 hover:text-white bg-slate-800 rounded-lg hover:bg-slate-700 transition-all"
                      title="Ver en Google Drive"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}

                  <button
                    onClick={() => handleAnalyzeClick(file)}
                    disabled={isAnalyzing}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white font-semibold text-xs rounded-xl shadow-md transition-all"
                  >
                    {isAnalyzing ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    )}
                    <span>{isAnalyzing ? 'Analizando...' : 'Analizar con IA'}</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
};
