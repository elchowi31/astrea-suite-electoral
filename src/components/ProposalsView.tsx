import React, { useState, useEffect } from 'react';
import { Proposal, Tenant } from '../types';
import { generarIdDocumentoLegible } from '../lib/slugify';
import {
  FileText,
  Plus,
  Filter,
  Sparkles,
  CheckCircle2,
  Clock,
  User,
  X,
  Zap,
  Tag,
  BookOpen
} from 'lucide-react';

interface ProposalsViewProps {
  currentTenant: Tenant;
  proposals: Proposal[];
  onAddProposal: (prop: Proposal) => void;
  onAnalyzeProposalWithAi: (title: string, summary: string) => void;
}

export const ProposalsView: React.FC<ProposalsViewProps> = ({
  currentTenant,
  proposals,
  onAddProposal,
  onAnalyzeProposalWithAi,
}) => {
  const [categoryFilter, setCategoryFilter] = useState<string>('TODAS');
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(proposals[0] || null);
  const [showModal, setShowModal] = useState(false);

  // New Proposal Form (Predictive & Proactive)
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Infraestructura y Vías');
  const [summary, setSummary] = useState('');
  const [fullText, setFullText] = useState('');
  const [author, setAuthor] = useState('');
  const [generatedDocId, setGeneratedDocId] = useState<string>('');

  const categories = [
    'Infraestructura y Vías',
    'Salud y Bienestar',
    'Educación y Tecnología',
    'Seguridad y Convivencia',
    'Desarrollo Rural y Agropecuario',
    'Transparencia y Buen Gobierno'
  ];

  // Real-time readable ID calculation
  useEffect(() => {
    const id = generarIdDocumentoLegible(
      'propuesta',
      title || 'iniciativa-programatica',
      category
    );
    setGeneratedDocId(id);
  }, [title, category]);

  const tenantProposals = proposals.filter((p) => p.tenantId === currentTenant.tenantId);

  const filteredProposals = tenantProposals.filter((p) => {
    return categoryFilter === 'TODAS' || p.category === categoryFilter;
  });

  const applyPresetProposal = (presetTitle: string, presetCat: string, presetSummary: string) => {
    setTitle(presetTitle);
    setCategory(presetCat);
    setSummary(presetSummary);
    setFullText(`${presetTitle}\n\nResumen Ejecutivo:\n${presetSummary}\n\nObjetivos Estratégicos:\n1. Asignación presupuestal prioritaria.\n2. Ejecución con veeduría ciudadana comunitaria.\n3. Impacto medible en empleo y conectividad local.`);
  };

  const handleSubmitNewProposal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !summary) return;

    const newProp: Proposal = {
      id: generatedDocId || `prop-${Date.now()}`,
      tenantId: currentTenant.tenantId,
      title,
      category,
      summary,
      fullText: fullText || summary,
      status: 'Borrador',
      author: author || 'Comisión Programática',
      createdAt: new Date().toISOString()
    };

    onAddProposal(newProp);
    setShowModal(false);
    setTitle('');
    setSummary('');
    setFullText('');
  };

  return (
    <div className="space-y-6">
      
      {/* Title & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-purple-400" />
            <h2 className="text-xl font-bold text-white">Programa de Gobierno & Proyectos Estratégicos 2026-2030</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Iniciativas legislativas, acuerdos municipales y ordenanzas para <strong className="text-slate-200">{currentTenant.name}</strong> • Colección <code className="text-emerald-400 font-mono">/propuestas</code>
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-purple-600/30 transition-all shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Nueva Propuesta de Gobierno
        </button>
      </div>

      {/* Category Filter */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setCategoryFilter('TODAS')}
          className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
            categoryFilter === 'TODAS'
              ? 'bg-purple-600 text-white shadow-md'
              : 'bg-slate-900 text-slate-400 hover:bg-slate-800 border border-slate-800'
          }`}
        >
          Todas las Categorías
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategoryFilter(cat)}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              categoryFilter === cat
                ? 'bg-purple-600 text-white shadow-md'
                : 'bg-slate-900 text-slate-400 hover:bg-slate-800 border border-slate-800'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Proposals List */}
        <div className="space-y-3">
          {filteredProposals.map((prop) => {
            const isSelected = selectedProposal?.id === prop.id;
            return (
              <div
                key={prop.id}
                onClick={() => setSelectedProposal(prop)}
                className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-purple-950/40 border-purple-500 shadow-lg shadow-purple-500/10'
                    : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-[10px] font-semibold text-purple-300 bg-purple-500/20 px-2 py-0.5 rounded-full border border-purple-500/30">
                    {prop.category}
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    prop.status === 'Aprobado' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 text-slate-400'
                  }`}>
                    {prop.status}
                  </span>
                </div>

                <h4 className="font-bold text-slate-100 text-sm leading-snug">{prop.title}</h4>
                <div className="text-[10px] font-mono text-slate-400 mt-1">Doc: {prop.id}</div>
                <p className="text-xs text-slate-400 mt-2 line-clamp-2">{prop.summary}</p>

                <div className="mt-3 flex items-center justify-between text-[10px] text-slate-500 pt-2 border-t border-slate-800/60">
                  <span>{prop.author}</span>
                  <span>{new Date(prop.createdAt).toLocaleDateString('es-CO')}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Proposal Detail & AI Analysis */}
        <div className="lg:col-span-2">
          {selectedProposal ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5 sticky top-24">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                    {selectedProposal.category}
                  </span>
                  <h3 className="text-lg font-bold text-white mt-1.5">{selectedProposal.title}</h3>
                  <p className="text-xs text-slate-400 mt-0.5 font-mono">ID Firestore: /{ 'propuestas' }/{selectedProposal.id}</p>
                </div>

                <button
                  onClick={() => onAnalyzeProposalWithAi(selectedProposal.title, selectedProposal.summary)}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-purple-600/30 transition shrink-0 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>Análisis Estratégico IA</span>
                </button>
              </div>

              <div className="space-y-4 text-xs text-slate-300 leading-relaxed">
                <div>
                  <h5 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Resumen Ejecutivo:</h5>
                  <p className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 text-slate-200">
                    {selectedProposal.summary}
                  </p>
                </div>

                <div>
                  <h5 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Texto y Articulado de la Iniciativa:</h5>
                  <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 whitespace-pre-line font-mono text-[11px] text-slate-300 leading-relaxed max-h-80 overflow-y-auto">
                    {selectedProposal.fullText || selectedProposal.summary}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-64 flex flex-col items-center justify-center bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center text-slate-500">
              <BookOpen className="w-10 h-10 mb-2 opacity-50" />
              <p>Selecciona una propuesta del listado para ver sus detalles</p>
            </div>
          )}
        </div>

      </div>

      {/* MODAL: FORMULARIO PREDICTIVO DE PROPUESTAS */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-2xl w-full p-6 sm:p-8 space-y-5 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-purple-600/20 text-purple-400 rounded-xl border border-purple-500/30">
                  <Zap className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">
                    Nueva Iniciativa Programática / Proyecto
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Propuestas estructuradas con plantillas temáticas e ID descriptivo en español.
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

            {/* PRESET PROPOSALS (1-Click Fill) */}
            <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800 space-y-2">
              <span className="text-[10px] font-bold uppercase text-slate-400 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-300" />
                Plantillas Estratégicas Recomendadas para el Cesar:
              </span>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => applyPresetProposal(
                    'Plan Departamental de Placa Huella y Vías Terciarias en Astrea y El Paso',
                    'Infraestructura y Vías',
                    'Pavimentación y mantenimiento de más de 85 km de caminos rurales para conectar a los productores agropecuarios de Arjona y veredas aledañas.'
                  )}
                  className="text-[10px] bg-slate-800 hover:bg-slate-700 text-purple-300 border border-slate-700 px-2 py-1 rounded-lg transition"
                >
                  🚜 Vías Terciarias ($ Plan Placa Huella)
                </button>
                <button
                  type="button"
                  onClick={() => applyPresetProposal(
                    'Fortalecimiento de la Red Hospitalaria y Centros de Salud en el Cesar',
                    'Salud y Bienestar',
                    'Dotación de ambulancias 4x4 y especialistas permanentes para las cabeceras municipales y corregimientos del centro del departamento.'
                  )}
                  className="text-[10px] bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-slate-700 px-2 py-1 rounded-lg transition"
                >
                  🏥 Red Hospitalaria Rural
                </button>
                <button
                  type="button"
                  onClick={() => applyPresetProposal(
                    'Fondo de Crédito Semilla y Riego para Agricultores del Cesar',
                    'Desarrollo Rural y Agropecuario',
                    'Subsidio a tasas de interés y pozos profundos de energía solar para pequeños ganaderos y cultivadores de maíz y yuca.'
                  )}
                  className="text-[10px] bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 px-2 py-1 rounded-lg transition"
                >
                  🌾 Crédito y Riego Agropecuario
                </button>
              </div>
            </div>

            {/* PREDICTIVE ID BANNER */}
            <div className="bg-slate-950 border border-purple-500/30 p-3.5 rounded-2xl flex items-center justify-between gap-3">
              <div className="space-y-0.5">
                <span className="text-[10px] uppercase font-bold text-purple-400 tracking-wider flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  ID de Documento en Firestore:
                </span>
                <p className="text-xs font-mono font-bold text-purple-300 truncate max-w-md">
                  /{'propuestas'}/{generatedDocId}
                </p>
              </div>
              <span className="text-[10px] bg-purple-500/10 text-purple-300 border border-purple-500/20 px-2 py-1 rounded-lg shrink-0">
                Auto-generado
              </span>
            </div>

            <form onSubmit={handleSubmitNewProposal} className="space-y-4 text-xs">
              
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Título de la Propuesta / Proyecto <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Plan Maestro de Vías Terciarias en Astrea y El Paso"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 text-slate-100 p-2.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                />
              </div>

              {/* Categoría & Autor */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Eje Temático / Categoría
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 text-slate-100 p-2.5 rounded-xl focus:outline-none cursor-pointer font-medium"
                  >
                    {categories.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Comisión o Autor Responsable
                  </label>
                  <input
                    type="text"
                    value={author}
                    onChange={(e) => setAuthor(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 text-slate-100 p-2.5 rounded-xl focus:outline-none"
                  />
                </div>
              </div>

              {/* Resumen Ejecutivo */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Resumen Ejecutivo (Impacto y Metas) <span className="text-rose-400">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder="Explica brevemente el alcance, beneficiarios y presupuesto estimado..."
                  className="w-full bg-slate-800 border border-slate-700 text-slate-100 p-2.5 rounded-xl focus:outline-none leading-relaxed"
                />
              </div>

              {/* Texto Completo */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Articulado Detallado / Minuta Técnica
                </label>
                <textarea
                  rows={4}
                  value={fullText}
                  onChange={(e) => setFullText(e.target.value)}
                  placeholder="Detalle de artículos, cronograma de obras o normativa propuesta..."
                  className="w-full bg-slate-800 border border-slate-700 text-slate-100 p-2.5 rounded-xl focus:outline-none font-mono text-xs leading-relaxed"
                />
              </div>

              {/* Botones */}
              <div className="pt-3 flex items-center justify-between border-t border-slate-800">
                <span className="text-[11px] text-slate-400 font-mono truncate max-w-xs">
                  Doc: /propuestas/{generatedDocId}
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
                    className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-xl shadow-lg shadow-purple-600/30 transition cursor-pointer"
                  >
                    Guardar Propuesta
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
