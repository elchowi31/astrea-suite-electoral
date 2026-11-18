import { validateFormDesign, formItem, type FormDesign } from './formDesign';
export type WorkspaceCalendar = {
  id: string;
  summary: string;
  accessRole: string;
  primary?: boolean;
  timeZone?: string;
};
export type WorkspaceCalendarEvent = {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  htmlLink?: string;
  start: { dateTime?: string; date?: string; timeZone?: string };
  end: { dateTime?: string; date?: string; timeZone?: string };
  extendedProperties?: { private?: Record<string, string> };
};
export type WorkspaceRemoteForm = {
  formId: string;
  editUri: string;
  responderUri?: string;
  published: boolean;
};
export class FormSetupError extends Error {
  constructor(
    message: string,
    public form: WorkspaceRemoteForm,
  ) {
    super(message);
  }
}
export function googleFormLink(value: string | undefined) {
  try {
    const url = new URL(value || '');
    return url.protocol === 'https:' &&
      ['docs.google.com', 'forms.google.com', 'forms.gle'].includes(
        url.hostname,
      )
      ? url.href
      : '';
  } catch {
    return '';
  }
}
export function workspaceApi(
  token: string,
  assertActive: () => void,
  request: typeof fetch = fetch,
) {
  async function call(url: string, init: RequestInit = {}) {
    assertActive();
    const response = await request(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...init.headers,
      },
      signal: init.signal || AbortSignal.timeout(20000),
    });
    assertActive();
    if (!response.ok) {
      let message = '';
      try {
        message = (await response.json())?.error?.message || '';
      } catch {}
      throw Object.assign(
        new Error(
          response.status === 401
            ? 'La conexión de Google venció. Vuelva a vincular su cuenta.'
            : response.status === 403
              ? `Google no autorizó la operación. Revise los permisos y la cuenta conectada. ${message}`
              : `Google respondió ${response.status}. ${message}`,
        ),
        { status: response.status },
      );
    }
    const data = response.status === 204 ? null : await response.json();
    assertActive();
    return data;
  }
  const formUrl = (id: string) => {
    if (!/^[\w-]{1,200}$/.test(id))
      throw Error('Identificador de formulario inválido.');
    return `https://forms.googleapis.com/v1/forms/${id}`;
  };
  const calendarUrl = (id: string) =>
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(id)}/events`;
  return {
    async createForm(
      input: FormDesign,
      publish: boolean,
      existingId?: string,
      onCreated?: (form: WorkspaceRemoteForm) => Promise<void>,
    ) {
      const draft = validateFormDesign(input);
      let form: WorkspaceRemoteForm | undefined;
      try {
        const created = existingId
          ? await call(formUrl(existingId))
          : await call('https://forms.googleapis.com/v1/forms', {
              method: 'POST',
              body: JSON.stringify({
                info: { title: draft.title, documentTitle: draft.title },
              }),
            });
        form = {
          formId: created.formId,
          editUri: `https://docs.google.com/forms/d/${created.formId}/edit`,
          responderUri: created.responderUri,
          published:
            created.publishSettings?.publishState?.isPublished === true,
        };
        if (existingId && form.published)
          throw new FormSetupError(
            'El formulario ya está publicado. Se conservan sus preguntas; abra Google Forms para revisarlo o cree una copia nueva.',
            form,
          );
        if (onCreated) await onCreated(form);
        const deleteRequests = (created.items || [])
          .map((_: unknown, index: number) => ({
            deleteItem: { location: { index } },
          }))
          .reverse();
        await call(formUrl(form.formId) + ':batchUpdate', {
          method: 'POST',
          body: JSON.stringify({
            requests: [
              ...deleteRequests,
              {
                updateFormInfo: {
                  info: { title: draft.title, description: draft.description },
                  updateMask: 'title,description',
                },
              },
              ...draft.questions.map((question, index) => ({
                createItem: { item: formItem(question), location: { index } },
              })),
            ],
          }),
        });
        await call(formUrl(form.formId) + ':setPublishSettings', {
          method: 'POST',
          body: JSON.stringify({
            publishSettings: {
              publishState: {
                isPublished: publish,
                isAcceptingResponses: publish,
              },
            },
            updateMask: 'publishState',
          }),
        });
        const verified = await call(formUrl(form.formId));
        const complete = {
          ...form,
          responderUri: verified.responderUri || form.responderUri,
          published:
            verified.publishSettings?.publishState?.isPublished === true &&
            verified.publishSettings?.publishState?.isAcceptingResponses ===
              true,
        };
        if (publish && !complete.published)
          throw new FormSetupError(
            'Google todavía no confirmó la habilitación de respuestas.',
            complete,
          );
        return complete;
      } catch (error) {
        if (error instanceof FormSetupError) throw error;
        if (form)
          throw Object.assign(
            new FormSetupError(
              `Google creó el formulario, pero falta completar su configuración. ${(error as Error).message}`,
              form,
            ),
            { status: (error as any).status },
          );
        throw error;
      }
    },
    async formResponses(id: string) {
      let pageToken = '',
        count = 0,
        pages = 0;
      do {
        const data = await call(
          formUrl(id) +
            `/responses?pageSize=500${pageToken ? '&pageToken=' + encodeURIComponent(pageToken) : ''}`,
        );
        count += (data.responses || []).length;
        pageToken = data.nextPageToken || '';
        pages++;
      } while (pageToken && pages < 10);
      return { count, limited: !!pageToken };
    },
    async calendars() {
      let pageToken = '';
      const rows: WorkspaceCalendar[] = [];
      do {
        const data = await call(
          `https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=250${pageToken ? '&pageToken=' + encodeURIComponent(pageToken) : ''}`,
        );
        rows.push(...(data.items || []));
        pageToken = data.nextPageToken || '';
      } while (pageToken);
      return rows;
    },
    async events(calendarId: string, signal?: AbortSignal) {
      let pageToken = '',
        pages = 0;
      const rows: WorkspaceCalendarEvent[] = [];
      const from = new Date(Date.now() - 7 * 86400000).toISOString(),
        until = new Date(Date.now() + 90 * 86400000).toISOString();
      do {
        const params = new URLSearchParams({
          timeMin: from,
          timeMax: until,
          orderBy: 'startTime',
          singleEvents: 'true',
          maxResults: '250',
        });
        if (pageToken) params.set('pageToken', pageToken);
        const data = await call(calendarUrl(calendarId) + '?' + params, {
          signal,
        });
        rows.push(
          ...(data.items || []).filter(
            (row: any) => row.status !== 'cancelled',
          ),
        );
        pageToken = data.nextPageToken || '';
        pages++;
      } while (pageToken && pages < 10);
      return { events: rows, limited: !!pageToken };
    },
    async createEvent(
      calendarId: string,
      event: {
        id: string;
        summary: string;
        description: string;
        location: string;
        startIso: string;
        endIso: string;
        tenantId: string;
        ownerId: string;
      },
    ) {
      if (
        !/^[0-9a-v]{5,1024}$/.test(event.id) ||
        !event.summary.trim() ||
        !Number.isFinite(Date.parse(event.startIso)) ||
        !Number.isFinite(Date.parse(event.endIso)) ||
        Date.parse(event.endIso) <= Date.parse(event.startIso)
      )
        throw Error('Revise título, fecha inicial y fecha final.');
      try {
        return (await call(calendarUrl(calendarId), {
          method: 'POST',
          body: JSON.stringify({
            id: event.id,
            summary: event.summary,
            description: event.description,
            location: event.location,
            start: { dateTime: event.startIso, timeZone: 'America/Bogota' },
            end: { dateTime: event.endIso, timeZone: 'America/Bogota' },
            extendedProperties: {
              private: {
                astreaTenant: event.tenantId,
                astreaOwner: event.ownerId,
              },
            },
          }),
        })) as WorkspaceCalendarEvent;
      } catch (error) {
        if ((error as any).status !== 409) throw error;
        const existing = await call(
          calendarUrl(calendarId) + '/' + encodeURIComponent(event.id),
        );
        if (
          existing.extendedProperties?.private?.astreaTenant !==
            event.tenantId ||
          existing.extendedProperties?.private?.astreaOwner !== event.ownerId
        )
          throw Error(
            'El identificador del evento pertenece a otra operación.',
          );
        return existing as WorkspaceCalendarEvent;
      }
    },
    async deleteEvent(calendarId: string, eventId: string) {
      await call(calendarUrl(calendarId) + '/' + encodeURIComponent(eventId), {
        method: 'DELETE',
      });
    },
  };
}
