import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  Calendar,
  ClipboardList,
  FolderSync,
  Sparkles,
  ExternalLink,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Clock,
  MapPin,
  Users,
  Download,
  Share2,
  Layers,
  ArrowRight
} from 'lucide-react';
import {
  initGoogleWorkspaceAuth,
  signInWithGoogleWorkspace,
  getWorkspaceAccessToken,
  exportCampaignToGoogleSheets,
  createVolunteerGoogleForm,
  getGoogleFormResponses,
  listCampaignCalendarEvents,
  createCampaignCalendarEvent,
  deleteCampaignCalendarEvent,
  CampaignCalendarEvent
} from '../lib/googleWorkspace';
import { CampaignExpense, Leader, TransportVehicle, Candidate } from '../types';
import { saveWorkspaceEventToFirestore } from '../lib/firebase';

interface GoogleWorkspaceHubViewProps {
  tenantName?: string;
  tenantId?: string;
  expenses?: CampaignExpense[];
  leaders?: Leader[];
  vehicles?: TransportVehicle[];
  candidates?: Candidate[];
}

export const GoogleWorkspaceHubView: React.FC<GoogleWorkspaceHubViewProps> = ({
  tenantName = 'Organización',
  tenantId = '',
  expenses = [],
  leaders = [],
  vehicles = [],
  candidates = [],
}) => {
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<'sheets' | 'forms' | 'calendar' | 'drive'>('sheets');
  const [accessToken, setAccessToken] = useState<string | null>(getWorkspaceAccessToken());
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Sheets state
  const [isExportingSheet, setIsExportingSheet] = useState(false);
  const [createdSheetUrl, setCreatedSheetUrl] = useState<string | null>(null);
  const [sheetSuccessMessage, setSheetSuccessMessage] = useState<string | null>(null);

  // Forms state
  const [isCreatingForm, setIsCreatingForm] = useState(false);
  const [createdFormUrl, setCreatedFormUrl] = useState<string | null>(null);
  const [formResponses, setFormResponses] = useState<any[]>([]);
  const [formSuccessMessage, setFormSuccessMessage] = useState<string | null>(null);

  // Calendar state
  const [calendarEvents, setCalendarEvents] = useState<CampaignCalendarEvent[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [showAddEventModal, setShowAddEventModal] = useState(false);
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventDesc, setNewEventDesc] = useState('');
  const [newEventLoc, setNewEventLoc] = useState('');
  const [newEventDate, setNewEventDate] = useState(new Date().toISOString().slice(0, 16));
  const [calendarSuccessMessage, setCalendarSuccessMessage] = useState<string | null>(null);

  // Auto-init Auth listener
  useEffect(() => {
    const unsub = initGoogleWorkspaceAuth(
      (_user, token) => {
        setAccessToken(token);
        setAuthError(null);
      },
      () => {
        setAccessToken(null);
      }
    );
    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, []);

  // Fetch calendar events when token available and tab is calendar
  useEffect(() => {
    if (accessToken && activeWorkspaceTab === 'calendar') {
      fetchEvents();
    }
  }, [accessToken, activeWorkspaceTab]);

  const handleGoogleLogin = async () => {
    setIsLoggingIn(true);
    setAuthError(null);
    try {
      const res = await signInWithGoogleWorkspace();
      if (res?.accessToken) {
        setAccessToken(res.accessToken);
      }
    } catch (err: any) {
      setAuthError(err?.message || 'Error al conectar con Google Workspace');
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Google Sheets Export
  const handleExportExpensesSheet = async () => {
    if (!accessToken) {
      await handleGoogleLogin();
      return;
    }

    setIsExportingSheet(true);
    setSheetSuccessMessage(null);
    try {
      const title = `Libro de Gastos CNE - ${tenantName} (${new Date().toLocaleDateString('es-CO')})`;
      const headers = ['ID Registro', 'Componente CNE', 'Descripción', 'Valor (COP)', 'Fecha', 'Proveedor', 'Municipio', 'Estado'];
      const rows = expenses.map((e) => [
        e.id,
        e.component,
        e.description,
        e.amount,
        e.date,
        e.supplier || 'N/A',
        e.municipality || 'Astrea',
        e.status,
      ]);

      const res = await exportCampaignToGoogleSheets(title, headers, rows, accessToken);
      setCreatedSheetUrl(res.spreadsheetUrl);
      await saveWorkspaceEventToFirestore(tenantId, { id: `sheets-gastos-${Date.now()}`, type: 'Google Sheets', title, status: 'Creado', externalUrl: res.spreadsheetUrl });
      setSheetSuccessMessage(`¡Hoja de cálculo creada exitosamente! Conectada con Google Sheets.`);
    } catch (err: any) {
      alert(`Error al exportar a Google Sheets: ${err?.message || String(err)}`);
    } finally {
      setIsExportingSheet(false);
    }
  };

  const handleExportLeadersSheet = async () => {
    if (!accessToken) {
      await handleGoogleLogin();
      return;
    }

    setIsExportingSheet(true);
    setSheetSuccessMessage(null);
    try {
      const title = `Censo de Líderes y Metas Veredales - ${tenantName}`;
      const headers = ['ID Líder', 'Nombre Completo', 'Municipio', 'Vereda / Barrio', 'Meta Votos', 'Votos Comprometidos', 'Activistas', 'Celular', 'Estado'];
      const rows = leaders.map((l) => [
        l.id,
        l.fullName,
        l.municipality,
        l.veredaOrBarrio || 'Centro',
        l.voteTarget,
        l.votesCommitted,
        l.activistsCount,
        l.phone,
        l.status,
      ]);

      const res = await exportCampaignToGoogleSheets(title, headers, rows, accessToken);
      setCreatedSheetUrl(res.spreadsheetUrl);
      await saveWorkspaceEventToFirestore(tenantId, { id: `sheets-lideres-${Date.now()}`, type: 'Google Sheets', title, status: 'Creado', externalUrl: res.spreadsheetUrl });
      setSheetSuccessMessage(`¡Padrón de líderes exportado a Google Sheets con éxito!`);
    } catch (err: any) {
      alert(`Error al exportar a Google Sheets: ${err?.message || String(err)}`);
    } finally {
      setIsExportingSheet(false);
    }
  };

  // Google Forms Creation
  const handleCreateVolunteerForm = async () => {
    if (!accessToken) {
      await handleGoogleLogin();
      return;
    }

    setIsCreatingForm(true);
    setFormSuccessMessage(null);
    try {
      const title = `Formulario de Registro de Voluntarios & Testigos Electorales - ${tenantName}`;
      const desc = `Formulario oficial de inscripción de simpatizantes, coordinadores de cuadra y testigos electorales para ${tenantName}. Toda la información se recopila de forma confidencial.`;
      const locations = leaders.map((leader) => [leader.municipality, leader.veredaOrBarrio].filter(Boolean).join(' · '));
      const res = await createVolunteerGoogleForm(title, desc, accessToken, locations);
      setCreatedFormUrl(res.responderUri);
      await saveWorkspaceEventToFirestore(tenantId, { id: `forms-${Date.now()}`, type: 'Google Forms', title, status: 'Creado', externalUrl: res.responderUri });
      setFormSuccessMessage(`¡Formulario de Google Forms creado exitosamente! Listo para compartir en WhatsApp y redes sociales.`);
    } catch (err: any) {
      alert(`Error al crear Google Form: ${err?.message || String(err)}`);
    } finally {
      setIsCreatingForm(false);
    }
  };

  // Calendar fetch and create
  const fetchEvents = async () => {
    if (!accessToken) return;
    setIsLoadingEvents(true);
    try {
      const events = await listCampaignCalendarEvents(accessToken);
      setCalendarEvents(events);
    } catch (err: any) {
      console.error('Error al listar eventos de Calendar:', err);
    } finally {
      setIsLoadingEvents(false);
    }
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken) return;
    if (!newEventTitle) return;

    try {
      const startDate = new Date(newEventDate);
      const endDate = new Date(startDate.getTime() + 2 * 60 * 60 * 1000); // 2 hours default
      const createdEvent = await createCampaignCalendarEvent(
        {
          summary: `[${tenantName}] ${newEventTitle}`,
          description: newEventDesc || 'Evento oficial de campaña electoral',
          location: newEventLoc,
          startIso: startDate.toISOString(),
          endIso: endDate.toISOString(),
        },
        accessToken
      );
      await saveWorkspaceEventToFirestore(tenantId, { id: createdEvent.id || `calendar-${Date.now()}`, type: 'Google Calendar', title: newEventTitle, description: newEventDesc, location: newEventLoc, startAt: startDate.toISOString(), endAt: endDate.toISOString(), status: 'Programado' });
      setShowAddEventModal(false);
      setNewEventTitle('');
      setNewEventDesc('');
      setCalendarSuccessMessage('¡Evento agendado en Google Calendar con éxito!');
      await fetchEvents();
    } catch (err: any) {
      alert(`Error al crear evento en Google Calendar: ${err?.message || String(err)}`);
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!accessToken) return;
    const confirmDelete = window.confirm('¿Está seguro de eliminar este evento de su Google Calendar?');
    if (!confirmDelete) return;

    try {
      await deleteCampaignCalendarEvent(eventId, accessToken);
      setCalendarEvents((prev) => prev.filter((ev) => ev.id !== eventId));
    } catch (err: any) {
      alert(`Error al eliminar evento: ${err?.message || String(err)}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-white">Google Workspace Hub</h2>
              <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-full">
                Hojas • Formularios • Calendario • Drive
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Integración nativa con las herramientas de productividad de Google para la campaña de {tenantName}.
            </p>
          </div>
        </div>

        {/* Google Auth Pill / Button */}
        <div>
          {accessToken ? (
            <div className="flex items-center gap-2 px-3 py-2 bg-emerald-950/50 border border-emerald-500/30 rounded-xl">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="text-xs font-semibold text-emerald-300">Conectado a Google Workspace</span>
            </div>
          ) : (
            <button
              onClick={handleGoogleLogin}
              disabled={isLoggingIn}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-white text-slate-900 hover:bg-slate-100 rounded-xl font-bold text-xs shadow-lg transition-all cursor-pointer"
            >
              <svg className="w-4 h-4" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
              </svg>
              <span>{isLoggingIn ? 'Conectando...' : 'Vincular Google Workspace'}</span>
            </button>
          )}
        </div>
      </div>

      {authError && (
        <div className="p-4 bg-rose-950/60 border border-rose-500/40 rounded-xl text-rose-200 text-xs flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          <span>{authError}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-800 space-x-2">
        <button
          onClick={() => setActiveWorkspaceTab('sheets')}
          className={`flex items-center gap-2 py-3 px-4 font-bold text-xs border-b-2 transition-colors cursor-pointer ${
            activeWorkspaceTab === 'sheets'
              ? 'border-emerald-500 text-emerald-400 bg-emerald-500/10 rounded-t-xl'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          Google Sheets (Hojas Oficiales)
        </button>

        <button
          onClick={() => setActiveWorkspaceTab('forms')}
          className={`flex items-center gap-2 py-3 px-4 font-bold text-xs border-b-2 transition-colors cursor-pointer ${
            activeWorkspaceTab === 'forms'
              ? 'border-purple-500 text-purple-400 bg-purple-500/10 rounded-t-xl'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <ClipboardList className="w-4 h-4" />
          Google Forms (Captación de Votos & Testigos)
        </button>

        <button
          onClick={() => setActiveWorkspaceTab('calendar')}
          className={`flex items-center gap-2 py-3 px-4 font-bold text-xs border-b-2 transition-colors cursor-pointer ${
            activeWorkspaceTab === 'calendar'
              ? 'border-blue-500 text-blue-400 bg-blue-500/10 rounded-t-xl'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Calendar className="w-4 h-4" />
          Google Calendar (Agenda Oficial de Campaña)
        </button>
      </div>

      {/* TAB 1: GOOGLE SHEETS */}
      {activeWorkspaceTab === 'sheets' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Action 1: Export Expenses */}
            <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Exportar Libro de Gastos Oficial CNE</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Genera una hoja de cálculo en vivo en Google Sheets con el desglose de gastos en Pesos Colombianos (COP) categorizados por topes CNE.
                </p>
              </div>

              <div className="p-3 bg-slate-950 rounded-xl text-xs space-y-1 text-slate-300 font-mono">
                <div>• {expenses.length} Gastos registrados</div>
                <div>• Total ejecutado: ${(expenses.reduce((acc, e) => acc + e.amount, 0)).toLocaleString('es-CO')} COP</div>
              </div>

              <button
                onClick={handleExportExpensesSheet}
                disabled={isExportingSheet}
                className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-600/20"
              >
                <Download className="w-4 h-4" />
                <span>{isExportingSheet ? 'Generando Google Sheet...' : 'Exportar Gastos a Google Sheets'}</span>
              </button>
            </div>

            {/* Action 2: Export Leaders */}
            <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-4">
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Exportar Padrón de Líderes & Metas Veredales</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Genera una hoja de cálculo con el listado de coordinadores territoriales, metas de votos asignadas y teléfonos de contacto para control del Día D.
                </p>
              </div>

              <div className="p-3 bg-slate-950 rounded-xl text-xs space-y-1 text-slate-300 font-mono">
                <div>• {leaders.length} Líderes territoriales</div>
                <div>• Meta consolidada: {(leaders.reduce((acc, l) => acc + l.voteTarget, 0)).toLocaleString('es-CO')} votos</div>
              </div>

              <button
                onClick={handleExportLeadersSheet}
                disabled={isExportingSheet}
                className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-blue-600/20"
              >
                <Share2 className="w-4 h-4" />
                <span>{isExportingSheet ? 'Generando Google Sheet...' : 'Exportar Líderes a Google Sheets'}</span>
              </button>
            </div>
          </div>

          {sheetSuccessMessage && (
            <div className="p-4 bg-emerald-950/60 border border-emerald-500/40 rounded-xl flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <span className="text-xs font-semibold text-emerald-200">{sheetSuccessMessage}</span>
              </div>
              {createdSheetUrl && (
                <a
                  href={createdSheetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shrink-0"
                >
                  <span>Abrir en Google Sheets</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: GOOGLE FORMS */}
      {activeWorkspaceTab === 'forms' && (
        <div className="space-y-6">
          <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-500/10 text-purple-400 rounded-xl border border-purple-500/20">
                <ClipboardList className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Generador de Formularios de Captación de Votos & Testigos</h3>
                <p className="text-xs text-slate-400">
                  Crea un Google Form conectado a su cuenta con las ubicaciones reales registradas por esta organización.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div className="p-3.5 bg-slate-950/80 rounded-xl border border-slate-800 space-y-1">
                <span className="text-[10px] font-bold uppercase text-purple-400">Pregunta 1</span>
                <p className="text-xs font-semibold text-white">Nombre Completo y Documento</p>
                <span className="text-[10px] text-slate-400">Texto obligatorio</span>
              </div>
              <div className="p-3.5 bg-slate-950/80 rounded-xl border border-slate-800 space-y-1">
                <span className="text-[10px] font-bold uppercase text-purple-400">Pregunta 2</span>
                <p className="text-xs font-semibold text-white">Celular y WhatsApp de Contacto</p>
                <span className="text-[10px] text-slate-400">Validación telefónica</span>
              </div>
              <div className="p-3.5 bg-slate-950/80 rounded-xl border border-slate-800 space-y-1">
                <span className="text-[10px] font-bold uppercase text-purple-400">Pregunta 3</span>
                <p className="text-xs font-semibold text-white">Vereda / Barrio & Rol en Campaña</p>
                <span className="text-[10px] text-slate-400">Selección múltiple (Testigo, Coordinador, Movilizador)</span>
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={handleCreateVolunteerForm}
                disabled={isCreatingForm}
                className="py-2.5 px-5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold text-xs transition-all flex items-center gap-2 cursor-pointer shadow-lg shadow-purple-600/20"
              >
                <Sparkles className="w-4 h-4" />
                <span>{isCreatingForm ? 'Creando Google Form en vivo...' : 'Crear Formulario Oficial en Google Forms'}</span>
              </button>
            </div>

            {formSuccessMessage && (
              <div className="p-4 bg-purple-950/60 border border-purple-500/40 rounded-xl flex items-center justify-between gap-4 mt-4">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-purple-400 shrink-0" />
                  <span className="text-xs font-semibold text-purple-200">{formSuccessMessage}</span>
                </div>
                {createdFormUrl && (
                  <a
                    href={createdFormUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shrink-0"
                  >
                    <span>Ver Formulario en Vivo</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: GOOGLE CALENDAR */}
      {activeWorkspaceTab === 'calendar' && (
        <div className="space-y-6">
          <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-500/10 text-blue-400 rounded-xl border border-blue-500/20">
                <Calendar className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Agenda Oficial de Campaña en Google Calendar</h3>
                <p className="text-xs text-slate-400">
                  Eventos, mítines, caravanas veredales y comités de estrategia sincronizados en tiempo real con Google Calendar.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={fetchEvents}
                disabled={isLoadingEvents}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingEvents ? 'animate-spin' : ''}`} />
                <span>Actualizar</span>
              </button>
              <button
                onClick={() => setShowAddEventModal(true)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-blue-600/20"
              >
                <Plus className="w-4 h-4" />
                <span>Agendar Evento en Google Calendar</span>
              </button>
            </div>
          </div>

          {calendarSuccessMessage && (
            <div className="p-4 bg-emerald-950/60 border border-emerald-500/40 rounded-xl flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <span className="text-xs font-semibold text-emerald-200">{calendarSuccessMessage}</span>
            </div>
          )}

          {/* Modal to add event */}
          {showAddEventModal && (
            <div className="p-6 bg-slate-950 border border-slate-700 rounded-2xl space-y-4">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider text-blue-400">Nuevo Evento de Campaña</h4>
              <form onSubmit={handleCreateEvent} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Título del Evento *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: Gran Mitin en Plaza Principal de Astrea"
                    value={newEventTitle}
                    onChange={(e) => setNewEventTitle(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Lugar / Vereda / Dirección *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: Polideportivo Barrio San Martín, Astrea"
                    value={newEventLoc}
                    onChange={(e) => setNewEventLoc(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Fecha y Hora de Inicio *</label>
                  <input
                    type="datetime-local"
                    required
                    value={newEventDate}
                    onChange={(e) => setNewEventDate(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Descripción / Objetivos</label>
                  <input
                    type="text"
                    placeholder="Ej: Reunión con líderes de juventudes y campesinos"
                    value={newEventDesc}
                    onChange={(e) => setNewEventDesc(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div className="md:col-span-2 flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddEventModal(false)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-blue-600/20"
                  >
                    Guardar en Google Calendar
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* List of Calendar events */}
          <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider text-slate-400">
                Próximos Eventos Sincronizados ({calendarEvents.length})
              </h4>
            </div>

            {calendarEvents.length === 0 ? (
              <div className="p-8 text-center bg-slate-950/40 rounded-xl border border-slate-800/60 text-slate-400 text-xs">
                <Calendar className="w-8 h-8 mx-auto text-slate-600 mb-2" />
                <p>No se encontraron eventos próximos en Google Calendar.</p>
                <p className="text-[10px] text-slate-500 mt-1">Haga clic en "Agendar Evento en Google Calendar" para registrar el primer mitin o caravana.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {calendarEvents.map((ev) => (
                  <div key={ev.id} className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2 relative group">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">
                          {ev.start?.dateTime ? new Date(ev.start.dateTime).toLocaleDateString('es-CO', { weekday: 'short', month: 'short', day: 'numeric' }) : 'Fecha pendiente'}
                        </span>
                        <h5 className="text-xs font-bold text-white mt-0.5">{ev.summary}</h5>
                      </div>
                      {ev.id && (
                        <button
                          onClick={() => handleDeleteEvent(ev.id!)}
                          title="Eliminar evento de Google Calendar"
                          className="p-1.5 text-slate-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    {ev.description && <p className="text-[11px] text-slate-400 line-clamp-2">{ev.description}</p>}
                    <div className="flex items-center gap-4 text-[10px] text-slate-400 pt-1 border-t border-slate-900">
                      {ev.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-slate-500" />
                          <span className="truncate max-w-[160px]">{ev.location}</span>
                        </span>
                      )}
                      {ev.start?.dateTime && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-500" />
                          <span>{new Date(ev.start.dateTime).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</span>
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
