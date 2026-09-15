import React, { useState } from 'react';
import { authenticatedFetch, saveAiAnalysisToFirestore } from '../lib/firebase';
import { Candidate, District, Proposal, DriveFileItem, Tenant } from '../types';
import { Bot, Sparkles, Send, Mic, FileSearch, Compass, MessageSquare, Loader2, Copy, Check, RefreshCw } from 'lucide-react';

interface AiAssistantViewProps {
  currentTenant: Tenant;
  candidates: Candidate[];
  districts: District[];
  proposals: Proposal[];
  driveFiles: DriveFileItem[];
  prefilledPrompt?: string;
}

export const AiAssistantView: React.FC<AiAssistantViewProps> = ({
  currentTenant,
  candidates,
  districts,
  proposals,
  driveFiles,
  prefilledPrompt,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'speech' | 'document' | 'strategy' | 'chat'>('speech');

  // Speech Generator State
  const [selectedCandidateId, setSelectedCandidateId] = useState<string>(candidates[0]?.id || '');
  const [speechTopic, setSpeechTopic] = useState('Seguridad Ciudadana Integral, Recuperación Económica y Empleo Joven');
  const [speechTone, setSpeechTone] = useState('Convincente, enérgico y cercano a la ciudadanía');
  const [generatedSpeech, setGeneratedSpeech] = useState<string>('');
  const [loadingSpeech, setLoadingSpeech] = useState(false);

  // Document Analyzer State
  const [selectedDriveFileId, setSelectedDriveFileId] = useState<string>(driveFiles[0]?.id || '');
  const [docPrompt, setDocPrompt] = useState('Analizar impacto político, oportunidades de vocería y riesgos electorales del documento.');
  const [documentAnalysis, setDocumentAnalysis] = useState<string>('');
  const [loadingDoc, setLoadingDoc] = useState(false);

  // Strategy Advisor State
  const [selectedDistrictId, setSelectedDistrictId] = useState<string>(districts[0]?.id || '');
  const [generatedStrategy, setGeneratedStrategy] = useState<string>('');
  const [loadingStrategy, setLoadingStrategy] = useState(false);

  // Chatbot State
  const [chatMessages, setChatMessages] = useState<Array<{ sender: 'user' | 'ai'; text: string }>>([
    {
      sender: 'ai',
      text: `¡Hola! Soy tu Asistente de Inteligencia Electoral y Estrategia Parlamentaria para **${currentTenant.name}**. ¿En qué puedo ayudarte hoy para la campaña 2026?`
    }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [loadingChat, setLoadingChat] = useState(false);

  // Copy status
  const [copied, setCopied] = useState(false);

  const tenantCandidates = candidates.filter((c) => c.tenantId === currentTenant.tenantId);
  const tenantDistricts = districts.filter((d) => d.tenantId === currentTenant.tenantId);

  // Handlers
  const handleGenerateSpeech = async () => {
    setLoadingSpeech(true);
    setGeneratedSpeech('');
    try {
      const candidate = candidates.find((c) => c.id === selectedCandidateId) || candidates[0];
      const res = await authenticatedFetch('/api/ai/generate-speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantName: currentTenant.name,
          candidateName: candidate?.fullName || 'Candidato Parlamentario',
          district: candidate?.district || 'Distrito Central',
          chamber: candidate?.chamber || 'Cámara de Diputados',
          topic: speechTopic,
          tone: speechTone,
        })
      });
      const data = await res.json();
      if (data.success) {
        setGeneratedSpeech(data.speech);
        await saveAiAnalysisToFirestore(currentTenant.tenantId, { type: 'Discurso', title: `Discurso: ${candidate?.fullName || 'Candidatura'}`, content: data.speech });
      } else {
        setGeneratedSpeech('Ocurrió un error al generar el discurso.');
      }
    } catch (err) {
      setGeneratedSpeech('Error de conexión con el servidor de IA.');
    } finally {
      setLoadingSpeech(false);
    }
  };

  const handleAnalyzeDocument = async () => {
    setLoadingDoc(true);
    setDocumentAnalysis('');
    try {
      const file = driveFiles.find((f) => f.id === selectedDriveFileId) || driveFiles[0];
      const res = await authenticatedFetch('/api/ai/analyze-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantName: currentTenant.name,
          fileName: file?.name || 'Documento de Campaña',
          category: file?.category || 'Estrategia',
          promptText: docPrompt,
        })
      });
      const data = await res.json();
      if (data.success) {
        setDocumentAnalysis(data.analysis);
        await saveAiAnalysisToFirestore(currentTenant.tenantId, { type: 'Análisis documental', title: file?.name || 'Documento de campaña', content: data.analysis });
      } else {
        setDocumentAnalysis('Error al procesar el documento.');
      }
    } catch (err) {
      setDocumentAnalysis('Error de red al consultar Gemini API.');
    } finally {
      setLoadingDoc(false);
    }
  };

  const handleGenerateStrategy = async () => {
    setLoadingStrategy(true);
    setGeneratedStrategy('');
    try {
      const dist = districts.find((d) => d.id === selectedDistrictId) || districts[0];
      const res = await authenticatedFetch('/api/ai/electoral-strategy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantName: currentTenant.name,
          districtName: dist?.name || 'Distrito 10',
          keyIssues: dist?.keyIssues || ['Seguridad', 'Empleo'],
          competitorStrength: 'Alta competencia'
        })
      });
      const data = await res.json();
      if (data.success) {
        setGeneratedStrategy(data.strategy);
        await saveAiAnalysisToFirestore(currentTenant.tenantId, { type: 'Estrategia territorial', title: dist?.name || 'Territorio', content: data.strategy });
      } else {
        setGeneratedStrategy('Error al generar recomendación estratégica.');
      }
    } catch (err) {
      setGeneratedStrategy('Error de conexión al servidor de estrategia.');
    } finally {
      setLoadingStrategy(false);
    }
  };

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userMsg = chatInput;
    setChatInput('');
    setChatMessages((prev) => [...prev, { sender: 'user', text: userMsg }]);
    setLoadingChat(true);

    try {
      const res = await authenticatedFetch('/api/ai/analyze-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantName: currentTenant.name,
          fileName: 'Consulta General Campaña 2026',
          category: 'Asistencia Estratégica',
          promptText: userMsg
        })
      });
      const data = await res.json();
      if (data.success) {
        setChatMessages((prev) => [...prev, { sender: 'ai', text: data.analysis }]);
        await saveAiAnalysisToFirestore(currentTenant.tenantId, { type: 'Consulta', title: userMsg.slice(0, 80), content: data.analysis });
      } else {
        setChatMessages((prev) => [...prev, { sender: 'ai', text: 'No se pudo obtener respuesta del modelo.' }]);
      }
    } catch (err) {
      setChatMessages((prev) => [...prev, { sender: 'ai', text: 'Error de comunicación con el servicio de IA.' }]);
    } finally {
      setLoadingChat(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner */}
      <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-indigo-400" />
            <h2 className="text-xl font-bold text-white">Estudio de Inteligencia Electoral IA Studio</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Motor de inteligencia artificial impulsado por Gemini 2.5 Flash para generación de discursos, análisis de documentos Drive y estrategias de campaña para <strong className="text-slate-200">{currentTenant.name}</strong>
          </p>
        </div>
      </div>

      {/* Sub Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3 overflow-x-auto">
        <button
          onClick={() => setActiveSubTab('speech')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
            activeSubTab === 'speech'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
              : 'bg-slate-900 text-slate-400 hover:bg-slate-800 border border-slate-800'
          }`}
        >
          <Mic className="w-4 h-4 text-amber-300" />
          <span>Generador de Discursos</span>
        </button>

        <button
          onClick={() => setActiveSubTab('document')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
            activeSubTab === 'document'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
              : 'bg-slate-900 text-slate-400 hover:bg-slate-800 border border-slate-800'
          }`}
        >
          <FileSearch className="w-4 h-4 text-blue-400" />
          <span>Analizador de Documentos Drive</span>
        </button>

        <button
          onClick={() => setActiveSubTab('strategy')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
            activeSubTab === 'strategy'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
              : 'bg-slate-900 text-slate-400 hover:bg-slate-800 border border-slate-800'
          }`}
        >
          <Compass className="w-4 h-4 text-emerald-400" />
          <span>Estratega Electoral Distrital</span>
        </button>

        <button
          onClick={() => setActiveSubTab('chat')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
            activeSubTab === 'chat'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
              : 'bg-slate-900 text-slate-400 hover:bg-slate-800 border border-slate-800'
          }`}
        >
          <MessageSquare className="w-4 h-4 text-purple-400" />
          <span>Asistente Conversacional</span>
        </button>
      </div>

      {/* 1. SPEECH GENERATOR */}
      {activeSubTab === 'speech' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <h3 className="font-bold text-white text-sm flex items-center gap-2">
              <Mic className="w-4 h-4 text-amber-400" />
              Parámetros del Discurso
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Seleccionar Candidato</label>
                <select
                  value={selectedCandidateId}
                  onChange={(e) => setSelectedCandidateId(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 text-slate-100 p-2.5 rounded-xl focus:outline-none"
                >
                  {tenantCandidates.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.fullName} ({c.chamber} - {c.district})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Tema Principal del Discurso</label>
                <input
                  type="text"
                  value={speechTopic}
                  onChange={(e) => setSpeechTopic(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 text-slate-100 p-2.5 rounded-xl focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Tono Comunicacional</label>
                <select
                  value={speechTone}
                  onChange={(e) => setSpeechTone(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 text-slate-100 p-2.5 rounded-xl focus:outline-none"
                >
                  <option value="Convincente, enérgico y cercano a la ciudadanía">Convincente y cercano</option>
                  <option value="Técnico, estructurado y enfocado en cifras">Técnico e institucional</option>
                  <option value="Inspirador, motivador para militantes y voluntarios">Inspirador y movilizador</option>
                  <option value="Firme y resolutivo ante temas de seguridad">Firme y resolutivo</option>
                </select>
              </div>

              <button
                onClick={handleGenerateSpeech}
                disabled={loadingSpeech}
                className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 mt-4"
              >
                {loadingSpeech ? (
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                ) : (
                  <Sparkles className="w-4 h-4 text-amber-300" />
                )}
                <span>{loadingSpeech ? 'Redactando Discurso...' : 'Generar Discurso con IA'}</span>
              </button>
            </div>
          </div>

          <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                <h4 className="font-bold text-white text-sm">Discurso Político Redactado</h4>
                {generatedSpeech && (
                  <button
                    onClick={() => copyToClipboard(generatedSpeech)}
                    className="flex items-center gap-1.5 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg border border-slate-700 transition-all"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copiado' : 'Copiar Texto'}</span>
                  </button>
                )}
              </div>

              {generatedSpeech ? (
                <div className="text-xs text-slate-200 whitespace-pre-wrap leading-relaxed space-y-3 font-sans bg-slate-950/50 p-5 rounded-xl border border-slate-800 max-h-[500px] overflow-y-auto">
                  {generatedSpeech}
                </div>
              ) : (
                <div className="p-12 text-center text-slate-500 text-xs">
                  Haz clic en "Generar Discurso con IA" para obtener una pieza oratoria lista para plazas públicas, debates o vocerías de prensa.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 2. DOCUMENT ANALYZER */}
      {activeSubTab === 'document' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <h3 className="font-bold text-white text-sm flex items-center gap-2">
              <FileSearch className="w-4 h-4 text-blue-400" />
              Documento de Drive a Analizar
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Archivo registrado por la organización</label>
                <select
                  value={selectedDriveFileId}
                  onChange={(e) => setSelectedDriveFileId(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 text-slate-100 p-2.5 rounded-xl focus:outline-none"
                >
                  {driveFiles.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Pregunta u Enfoque de Análisis</label>
                <textarea
                  rows={3}
                  value={docPrompt}
                  onChange={(e) => setDocPrompt(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 text-slate-100 p-2.5 rounded-xl focus:outline-none"
                />
              </div>

              <button
                onClick={handleAnalyzeDocument}
                disabled={loadingDoc}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center gap-2 mt-4"
              >
                {loadingDoc ? (
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                ) : (
                  <Sparkles className="w-4 h-4 text-amber-300" />
                )}
                <span>{loadingDoc ? 'Procesando con Gemini...' : 'Analizar Documento'}</span>
              </button>
            </div>
          </div>

          <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h4 className="font-bold text-white text-sm border-b border-slate-800 pb-3 mb-4">Informe de Inteligencia de Documento</h4>
            {documentAnalysis ? (
              <div className="text-xs text-slate-200 whitespace-pre-wrap leading-relaxed space-y-3 font-sans bg-slate-950/50 p-5 rounded-xl border border-slate-800 max-h-[500px] overflow-y-auto">
                {documentAnalysis}
              </div>
            ) : (
              <div className="p-12 text-center text-slate-500 text-xs">
                Selecciona un archivo sincronizado de la carpeta Drive para obtener un reporte completo de fortalezas, riesgos y minutas ejecutivas.
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. STRATEGY ADVISOR */}
      {activeSubTab === 'strategy' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <h3 className="font-bold text-white text-sm flex items-center gap-2">
              <Compass className="w-4 h-4 text-emerald-400" />
              Planificación por Distrito
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Distrito Objetivo</label>
                <select
                  value={selectedDistrictId}
                  onChange={(e) => setSelectedDistrictId(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 text-slate-100 p-2.5 rounded-xl focus:outline-none"
                >
                  {tenantDistricts.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.region})
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={handleGenerateStrategy}
                disabled={loadingStrategy}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center gap-2 mt-4"
              >
                {loadingStrategy ? (
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                ) : (
                  <Sparkles className="w-4 h-4 text-amber-300" />
                )}
                <span>{loadingStrategy ? 'Diseñando Plan Estratégico...' : 'Generar Plan Estratégico'}</span>
              </button>
            </div>
          </div>

          <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h4 className="font-bold text-white text-sm border-b border-slate-800 pb-3 mb-4">Recomendación Estratégica Distrital</h4>
            {generatedStrategy ? (
              <div className="text-xs text-slate-200 whitespace-pre-wrap leading-relaxed space-y-3 font-sans bg-slate-950/50 p-5 rounded-xl border border-slate-800 max-h-[500px] overflow-y-auto">
                {generatedStrategy}
              </div>
            ) : (
              <div className="p-12 text-center text-slate-500 text-xs">
                Selecciona un distrito para obtener la estrategia de despliegue territorial, segmentación de votantes y KPIs clave.
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. CHATBOT */}
      {activeSubTab === 'chat' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col h-[550px]">
          <div className="flex-1 overflow-y-auto space-y-3 pr-2">
            {chatMessages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] p-3.5 rounded-2xl text-xs leading-relaxed ${
                    msg.sender === 'user'
                      ? 'bg-blue-600 text-white rounded-br-none'
                      : 'bg-slate-800 text-slate-200 rounded-bl-none border border-slate-700'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.text}</p>
                </div>
              </div>
            ))}
            {loadingChat && (
              <div className="flex justify-start">
                <div className="bg-slate-800 text-slate-400 p-3.5 rounded-2xl text-xs flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                  <span>Consultando inteligencia parlamentaria...</span>
                </div>
              </div>
            )}
          </div>

          <form onSubmit={handleSendChat} className="mt-4 pt-3 border-t border-slate-800 flex gap-2">
            <input
              type="text"
              placeholder="Haz una pregunta sobre candidaturas, estrategia o documentos de Drive..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              className="flex-1 bg-slate-800 border border-slate-700 text-slate-100 text-xs rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              disabled={loadingChat || !chatInput.trim()}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold text-xs rounded-xl shadow-lg transition-all flex items-center gap-1.5 shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}

    </div>
  );
};
