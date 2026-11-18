import React, { useCallback, useEffect, useRef, useState } from 'react';
import { currentWorkspaceApi } from '../lib/googleWorkspace';
import type {
  WorkspaceCalendar,
  WorkspaceCalendarEvent,
} from '../lib/workspaceApi';
import {
  readWorkspaceCalendar,
  saveWorkspaceCalendar,
} from '../lib/workspaceCalendarConfig';
import { saveWorkspaceEventToFirestore } from '../lib/firebase';
const local = (value: Date) =>
  new Date(value.getTime() - value.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
export function calendarEventDate(event: WorkspaceCalendarEvent) {
  if (event.start.date)
    return event.start.date.split('-').reverse().join('/') + ' · todo el día';
  return event.start.dateTime
    ? new Date(event.start.dateTime).toLocaleString('es-CO', {
        timeZone: 'America/Bogota',
      })
    : 'Fecha no disponible';
}
export function WorkspaceCalendarPanel({
  tenantId,
  tenantName,
  ownerId,
  account,
  onExpired,
  onBusy,
}: {
  key?: React.Key;
  tenantId: string;
  tenantName: string;
  ownerId: string;
  account: { email: string; googleUid: string } | null;
  onExpired: () => void;
  onBusy?: (busy: boolean) => void;
}) {
  const [calendars, setCalendars] = useState<WorkspaceCalendar[]>([]),
    [calendarId, setCalendarId] = useState(''),
    [events, setEvents] = useState<WorkspaceCalendarEvent[]>([]),
    [error, setError] = useState(''),
    [message, setMessage] = useState(''),
    [loading, setLoading] = useState(false),
    [busy, setBusy] = useState(false),
    [synced, setSynced] = useState(''),
    [limited, setLimited] = useState(false),
    [open, setOpen] = useState(false),
    [title, setTitle] = useState(''),
    [description, setDescription] = useState(''),
    [location, setLocation] = useState(''),
    [start, setStart] = useState(() => local(new Date())),
    [end, setEnd] = useState(() => local(new Date(Date.now() + 2 * 3600000))),
    [eventId, setEventId] = useState(() =>
      crypto.randomUUID().replaceAll('-', ''),
    ),
    [pendingLocal, setPendingLocal] = useState<Record<string, unknown> | null>(
      null,
    );
  useEffect(() => {
    onBusy?.(busy);
    return () => onBusy?.(false);
  }, [busy]);
  const generation = useRef(0),
    controller = useRef<AbortController | null>(null),
    mounted = useRef(true);
  const selected = calendars.find((row) => row.id === calendarId),
    canWrite = !!selected && ['owner', 'writer'].includes(selected.accessRole);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      controller.current?.abort();
    };
  }, []);
  useEffect(() => {
    const current = ++generation.current;
    setCalendars([]);
    setEvents([]);
    setCalendarId('');
    setError('');
    setSynced('');
    setPendingLocal(null);
    if (!account) return;
    setLoading(true);
    void (async () => {
      try {
        const rows = await currentWorkspaceApi().calendars();
        let saved = '';
        try {
          saved = await readWorkspaceCalendar(
            tenantId,
            ownerId,
            account.googleUid,
          );
        } catch {
          if (mounted.current && generation.current === current)
            setMessage(
              'No se pudo recuperar la selección anterior. Puede escoger un calendario.',
            );
        }
        if (!mounted.current || generation.current !== current) return;
        setCalendars(rows);
        setCalendarId(
          rows.some((row) => row.id === saved)
            ? saved
            : rows.find((row) => row.primary)?.id || rows[0]?.id || '',
        );
      } catch (error) {
        if (mounted.current && generation.current === current) {
          setError((error as Error).message);
          if ((error as any).status === 401) onExpired();
        }
      } finally {
        if (mounted.current && generation.current === current)
          setLoading(false);
      }
    })();
    return () => {
      generation.current++;
      controller.current?.abort();
    };
  }, [tenantId, ownerId, account?.googleUid]);
  const refresh = useCallback(async () => {
    if (!account || !calendarId || controller.current) return;
    const request = new AbortController(),
      current = generation.current;
    controller.current = request;
    setLoading(true);
    setError('');
    try {
      const data = await currentWorkspaceApi().events(
        calendarId,
        request.signal,
      );
      if (
        !mounted.current ||
        generation.current !== current ||
        request.signal.aborted
      )
        return;
      setEvents(data.events);
      setLimited(data.limited);
      setSynced(new Date().toISOString());
    } catch (error) {
      if (
        !request.signal.aborted &&
        mounted.current &&
        generation.current === current
      ) {
        setError((error as Error).message);
        if ((error as any).status === 401) onExpired();
      }
    } finally {
      if (controller.current === request) controller.current = null;
      if (mounted.current && generation.current === current) setLoading(false);
    }
  }, [account?.googleUid, calendarId]);
  useEffect(() => {
    controller.current?.abort();
    controller.current = null;
    setEvents([]);
    setSynced('');
    void refresh();
    const visible = () => {
        if (document.visibilityState === 'visible') void refresh();
      },
      timer = setInterval(visible, 60000);
    window.addEventListener('focus', visible);
    document.addEventListener('visibilitychange', visible);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', visible);
      document.removeEventListener('visibilitychange', visible);
      controller.current?.abort();
      controller.current = null;
    };
  }, [refresh]);
  async function recordLocal(row: Record<string, unknown>) {
    await saveWorkspaceEventToFirestore(tenantId, row);
    setPendingLocal(null);
  }
  return (
    <section className="space-y-4" aria-label="Agenda de Google Calendar">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">
            Agenda conectada a Google Calendar
          </h2>
          <p className="text-xs text-slate-400">
            {account
              ? account.email
              : 'Vincule una cuenta para consultar su calendario.'}{' '}
            · Hora mostrada: Bogotá.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            className="compact-button"
            disabled={!calendarId || loading}
            onClick={() => void refresh()}
          >
            Actualizar
          </button>
          <button
            className="compact-button is-primary"
            disabled={!canWrite || busy}
            onClick={() => setOpen(true)}
          >
            Nuevo evento
          </button>
        </div>
      </header>
      {account && (
        <label className="block text-xs">
          Calendario de la cuenta conectada
          <select
            aria-label="Calendario de Google"
            className="compact-input mt-1"
            value={calendarId}
            disabled={busy || !calendars.length}
            onChange={(event) => {
              const value = event.target.value;
              setCalendarId(value);
              setError('');
              void saveWorkspaceCalendar(
                tenantId,
                ownerId,
                account.googleUid,
                value,
              ).catch(() =>
                setMessage(
                  'La selección funciona en esta sesión, pero no se pudo guardar en Astrea.',
                ),
              );
            }}
          >
            {calendars.map((row) => (
              <option key={row.id} value={row.id}>
                {row.summary}
                {row.primary ? ' · principal' : ''}
                {!['owner', 'writer'].includes(row.accessRole)
                  ? ' · solo lectura'
                  : ''}
              </option>
            ))}
          </select>
        </label>
      )}
      {synced && (
        <p className="text-xs text-slate-400">
          Última lectura correcta: {new Date(synced).toLocaleString('es-CO')} ·
          ventana: últimos 7 y próximos 90 días. Se actualiza cada minuto
          mientras esta vista está activa.
        </p>
      )}
      {loading && (
        <p role="status" className="text-sm text-cyan-200">
          Consultando Google Calendar…
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="rounded-xl border border-amber-700 p-3 text-sm text-amber-200"
        >
          {error}
          {synced
            ? ' Se conservan los últimos eventos leídos; la sincronización actual no está confirmada.'
            : ''}
        </p>
      )}
      {limited && (
        <p className="text-xs text-amber-200">
          Se alcanzó el límite de lectura de esta ventana. Consulte Google
          Calendar para revisar el calendario completo.
        </p>
      )}
      {open && (
        <form
          className="space-y-3 rounded-xl border border-slate-600 bg-slate-900 p-4"
          aria-label="Nuevo evento de Calendar"
          onSubmit={async (event) => {
            event.preventDefault();
            setBusy(true);
            setError('');
            try {
              const startIso = new Date(start).toISOString(),
                endIso = new Date(end).toISOString();
              const created = await currentWorkspaceApi().createEvent(
                calendarId,
                {
                  id: eventId,
                  summary: title.trim(),
                  description,
                  location,
                  startIso,
                  endIso,
                  tenantId,
                  ownerId,
                },
              );
              const record = {
                id: created.id,
                type: 'Google Calendar',
                title: title.trim(),
                description,
                location,
                startAt: startIso,
                endAt: endIso,
                status: 'Programado',
                calendarId,
                googleUid: account!.googleUid,
                ownerId,
              };
              setPendingLocal(record);
              setOpen(false);
              setTitle('');
              setEventId(crypto.randomUUID().replaceAll('-', ''));
              setMessage('Evento creado en Google Calendar.');
              try {
                await recordLocal(record);
              } catch {
                setMessage(
                  'Evento creado en Google Calendar; falta guardar su comprobante en Astrea. No necesita crear otro evento.',
                );
              }
              await refresh();
            } catch (error) {
              setError((error as Error).message);
              if ((error as any).status === 401) onExpired();
            } finally {
              setBusy(false);
            }
          }}
        >
          <h3 className="font-bold">Nuevo evento · {selected?.summary}</h3>
          <label className="block text-xs">
            Título
            <input
              aria-label="Título del evento"
              className="compact-input mt-1"
              required
              maxLength={200}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs">
              Inicio · hora del dispositivo
              <input
                aria-label="Inicio del evento"
                className="compact-input mt-1"
                required
                type="datetime-local"
                value={start}
                onChange={(event) => setStart(event.target.value)}
              />
            </label>
            <label className="text-xs">
              Fin · hora del dispositivo
              <input
                aria-label="Fin del evento"
                className="compact-input mt-1"
                required
                type="datetime-local"
                value={end}
                onChange={(event) => setEnd(event.target.value)}
              />
            </label>
          </div>
          <label className="block text-xs">
            Descripción
            <textarea
              className="compact-input mt-1"
              maxLength={3000}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>
          <label className="block text-xs">
            Ubicación
            <input
              className="compact-input mt-1"
              maxLength={300}
              value={location}
              onChange={(event) => setLocation(event.target.value)}
            />
          </label>
          <div className="flex gap-2">
            <button className="compact-button is-primary" disabled={busy}>
              Crear en Google Calendar
            </button>
            <button
              type="button"
              className="compact-button"
              disabled={busy}
              onClick={() => setOpen(false)}
            >
              Cancelar
            </button>
          </div>
          <p className="text-xs text-slate-400">
            El evento se crea en el calendario seleccionado de {account?.email}.
            Este formulario no envía invitaciones.
          </p>
        </form>
      )}
      {pendingLocal && (
        <button
          className="compact-button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await recordLocal(pendingLocal);
              setMessage('Comprobante guardado en Astrea.');
            } catch (error) {
              setError((error as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          Reintentar comprobante local
        </button>
      )}
      <div className="space-y-2">
        {events.map((event) => (
          <article
            key={event.id}
            className="rounded-xl border border-slate-700 bg-slate-900 p-4"
          >
            <div className="flex flex-wrap justify-between gap-2">
              <h3 className="font-semibold">
                {event.summary || 'Evento sin título'}
              </h3>
              <p className="text-xs text-cyan-200">
                {calendarEventDate(event)}
              </p>
            </div>
            {event.location && (
              <p className="mt-2 text-xs text-slate-400">{event.location}</p>
            )}
            {event.description && (
              <details className="mt-2 text-xs">
                <summary>Descripción</summary>
                <p className="mt-2 whitespace-pre-wrap">
                  {event.description.replace(/<[^>]*>/g, ' ')}
                </p>
              </details>
            )}
            {canWrite &&
              event.extendedProperties?.private?.astreaTenant === tenantId &&
              event.extendedProperties?.private?.astreaOwner === ownerId && (
                <button
                  className="compact-button mt-2"
                  disabled={busy}
                  onClick={async () => {
                    if (
                      !window.confirm(
                        `¿Eliminar «${event.summary}» del calendario seleccionado?`,
                      )
                    )
                      return;
                    setBusy(true);
                    try {
                      await currentWorkspaceApi().deleteEvent(
                        calendarId,
                        event.id,
                      );
                      setEvents((rows) =>
                        rows.filter((row) => row.id !== event.id),
                      );
                      setMessage('Evento eliminado de Google Calendar.');
                    } catch (error) {
                      setError((error as Error).message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Eliminar evento de Astrea
                </button>
              )}
          </article>
        ))}
      </div>
      {account && calendarId && !events.length && !loading && !error && (
        <p className="rounded-xl border border-slate-700 p-5 text-sm text-slate-400">
          No hay eventos en la ventana consultada de este calendario.
        </p>
      )}
      {message && (
        <p role="status" className="text-sm text-cyan-200">
          {message}
        </p>
      )}
    </section>
  );
}
