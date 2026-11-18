import React, { useEffect, useRef, useState } from 'react';
import { auth, saveWorkspaceEventToFirestore } from '../lib/firebase';
import {
  initGoogleWorkspaceAuth,
  signInWithGoogleWorkspace,
  getWorkspaceAccessToken,
  getWorkspaceAccount,
  logoutGoogleWorkspace,
  exportCampaignToGoogleSheets,
} from '../lib/googleWorkspace';
import type {
  CampaignExpense,
  Leader,
  TransportVehicle,
  Candidate,
} from '../types';
import { WorkspaceFormBuilder } from './WorkspaceFormBuilder';
import { isNativeApp } from '../lib/nativeTracking';
import { WorkspaceCalendarPanel } from './WorkspaceCalendarPanel';

interface Props {
  key?: React.Key;
  tenantName?: string;
  tenantId?: string;
  expenses?: CampaignExpense[];
  leaders?: Leader[];
  vehicles?: TransportVehicle[];
  candidates?: Candidate[];
}
export const GoogleWorkspaceHubView: React.FC<Props> = ({
  tenantName = 'Organización',
  tenantId = '',
  expenses = [],
  leaders = [],
}) => {
  const [tab, setTab] = useState<'sheets' | 'forms' | 'calendar'>('sheets'),
    [account, setAccount] = useState(getWorkspaceAccount),
    [childBusy, setChildBusy] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState(''),
    [sheetUrl, setSheetUrl] = useState('');
  const ownerId = auth.currentUser?.uid || '',
    generation = useRef(0),
    native = isNativeApp();
  const expired = () => {
    void logoutGoogleWorkspace();
    setAccount(null);
    setError('Vuelva a vincular la cuenta de Google para continuar.');
  };
  useEffect(() => {
    generation.current++;
    setAccount(getWorkspaceAccount());
    setSheetUrl('');
    setMessage('');
    setError('');
    const stop = initGoogleWorkspaceAuth(
      () => setAccount(getWorkspaceAccount()),
      () => setAccount(null),
    );
    return () => {
      generation.current++;
      stop();
    };
  }, [tenantId, ownerId]);
  useEffect(() => {
    const timer = setInterval(() => {
      if (!getWorkspaceAccessToken()) setAccount(null);
    }, 30000);
    return () => clearInterval(timer);
  }, []);
  async function connect() {
    const current = generation.current;
    setBusy(true);
    setError('');
    try {
      await signInWithGoogleWorkspace();
      if (current === generation.current) setAccount(getWorkspaceAccount());
    } catch (error) {
      if (current === generation.current) setError((error as Error).message);
    } finally {
      if (current === generation.current) setBusy(false);
    }
  }
  async function exportSheet(kind: 'expenses' | 'leaders') {
    const token = getWorkspaceAccessToken();
    if (!token) {
      expired();
      return;
    }
    const current = generation.current;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const title =
        kind === 'expenses'
          ? `Gastos · ${tenantName}`
          : `Líderes y metas · ${tenantName}`;
      const headers =
        kind === 'expenses'
          ? [
              'ID',
              'Componente',
              'Descripción',
              'Valor COP',
              'Fecha',
              'Proveedor',
              'Municipio',
              'Estado',
            ]
          : [
              'ID',
              'Nombre',
              'Municipio',
              'Vereda / barrio',
              'Meta',
              'Comprometidos',
              'Activistas',
              'Celular',
              'Estado',
            ];
      const rows =
        kind === 'expenses'
          ? expenses.map((e) => [
              e.id,
              e.component,
              e.description,
              e.amount,
              e.date,
              e.supplier || '',
              e.municipality || '',
              e.status,
            ])
          : leaders.map((l) => [
              l.id,
              l.fullName,
              l.municipality,
              l.veredaOrBarrio || '',
              l.voteTarget,
              l.votesCommitted,
              l.activistsCount,
              l.phone || '',
              l.status,
            ]);
      const result = await exportCampaignToGoogleSheets(
        title,
        headers,
        rows,
        token,
      );
      if (current !== generation.current) return;
      setSheetUrl(result.spreadsheetUrl);
      setMessage('Hoja creada en la cuenta de Google conectada.');
      try {
        await saveWorkspaceEventToFirestore(tenantId, {
          id: `sheets-${crypto.randomUUID()}`,
          type: 'Google Sheets',
          title,
          status: 'Creado',
          externalUrl: result.spreadsheetUrl,
          ownerId,
          googleUid: account?.googleUid || '',
        });
      } catch {
        setMessage(
          'La hoja se creó en Google. No se pudo guardar su comprobante en Astrea; use el enlace para abrirla.',
        );
      }
    } catch (error) {
      if (current === generation.current) setError((error as Error).message);
    } finally {
      if (current === generation.current) setBusy(false);
    }
  }
  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Google Workspace</h2>
          <p className="text-xs text-slate-400">
            {native
              ? 'Conecte su cuenta de Google en la versión web. Los diseños también se guardan desde la app.'
              : account
                ? `Cuenta conectada: ${account.email}`
                : 'Elija la cuenta de Google que utilizará para formularios, hojas y calendario.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {native ? (
            <a
              className="compact-button"
              href="https://astrea-suite-electoral.vercel.app/"
              target="_blank"
              rel="noreferrer"
            >
              Abrir Astrea en el navegador
            </a>
          ) : (
            <button
              className="compact-button"
              disabled={busy || childBusy}
              onClick={() => void connect()}
            >
              {busy
                ? 'Conectando…'
                : account
                  ? 'Cambiar cuenta de Google'
                  : 'Vincular Google Workspace'}
            </button>
          )}
          {account && (
            <button
              className="compact-button"
              disabled={busy || childBusy}
              onClick={() => {
                void logoutGoogleWorkspace();
                setAccount(null);
                setSheetUrl('');
              }}
            >
              Desconectar
            </button>
          )}
        </div>
      </header>
      <nav
        className="flex flex-wrap gap-2 border-b border-slate-700 pb-2"
        aria-label="Herramientas de Google"
      >
        {(
          [
            ['sheets', 'Hojas'],
            ['forms', 'Formularios'],
            ['calendar', 'Calendario'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            className={`compact-button ${tab === id ? 'is-primary' : ''}`}
            aria-pressed={tab === id}
            disabled={childBusy}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </nav>
      {error && (
        <p role="alert" className="text-sm text-amber-200">
          {error}
        </p>
      )}
      {tab === 'forms' && ownerId && (
        <WorkspaceFormBuilder
          key={`${tenantId}-${ownerId}`}
          tenantId={tenantId}
          ownerId={ownerId}
          account={account}
          onExpired={expired}
          onBusy={setChildBusy}
        />
      )}
      {tab === 'calendar' && ownerId && (
        <WorkspaceCalendarPanel
          key={`${tenantId}-${ownerId}-${account?.googleUid || 'offline'}`}
          tenantId={tenantId}
          tenantName={tenantName}
          ownerId={ownerId}
          account={account}
          onExpired={expired}
          onBusy={setChildBusy}
        />
      )}
      {tab === 'sheets' && (
        <section className="space-y-3 rounded-xl border border-slate-700 bg-slate-900 p-4">
          <h3 className="font-bold">Exportar los registros visibles</h3>
          <p className="text-sm text-slate-400">
            Crea una hoja con los datos actuales del ámbito autorizado. La
            exportación es una copia; los cambios posteriores en Google no
            modifican Astrea.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              className="compact-button"
              disabled={busy || !account}
              onClick={() => void exportSheet('expenses')}
            >
              Exportar gastos · {expenses.length}
            </button>
            <button
              className="compact-button"
              disabled={busy || !account}
              onClick={() => void exportSheet('leaders')}
            >
              Exportar líderes · {leaders.length}
            </button>
          </div>
          {message && (
            <p role="status" className="text-sm text-cyan-200">
              {message}
            </p>
          )}
          {sheetUrl && (
            <a
              className="inline-flex min-h-11 items-center text-cyan-300 underline"
              href={sheetUrl}
              target="_blank"
              rel="noreferrer"
            >
              Abrir hoja creada
            </a>
          )}
        </section>
      )}
    </div>
  );
};
