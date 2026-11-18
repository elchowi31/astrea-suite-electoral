import React, { useEffect, useRef, useState } from 'react';
import { authenticatedFetch } from '../lib/firebase';
import {
  defaultFormDesign,
  validateFormDesign,
  FORM_TYPES,
  type FormQuestion,
} from '../lib/formDesign';
import { currentWorkspaceApi } from '../lib/googleWorkspace';
import { FormSetupError, googleFormLink } from '../lib/workspaceApi';
import {
  subscribeFormDesigns,
  saveFormDesign,
  type SavedFormDesign,
} from '../lib/workspaceDrafts';
const labels = {
  short: 'Texto corto',
  paragraph: 'Texto largo',
  single: 'Una opción',
  multiple: 'Varias opciones',
  dropdown: 'Desplegable',
  date: 'Fecha',
};
export function WorkspaceFormBuilder({
  tenantId,
  ownerId,
  account,
  onExpired,
  onBusy,
}: {
  key?: React.Key;
  tenantId: string;
  ownerId: string;
  account: { email: string; googleUid: string } | null;
  onExpired: () => void;
  onBusy?: (busy: boolean) => void;
}) {
  const fresh = (): SavedFormDesign => ({
    id: `${tenantId}--form-design-${crypto.randomUUID()}`,
    tenantId,
    ownerId,
    kind: 'form-design',
    name: 'Diseño de formulario',
    mimeType: 'application/vnd.astrea.form-design',
    category: 'Diseño de formulario',
    summary: 'Borrador editable',
    syncedAt: '',
    revision: 0,
    design: defaultFormDesign(),
    reviewed: false,
  });
  const [state, setState] = useState(fresh),
    [saved, setSaved] = useState<SavedFormDesign[]>([]),
    [context, setContext] = useState(''),
    [loaded, setLoaded] = useState(false),
    [busy, setBusy] = useState(false),
    [dirty, setDirty] = useState(false),
    [publish, setPublish] = useState(true),
    [error, setError] = useState(''),
    [message, setMessage] = useState('');
  const initialized = useRef(false),
    generation = useRef(0);
  useEffect(() => {
    const current = ++generation.current;
    initialized.current = false;
    setLoaded(false);
    setState(fresh());
    setSaved([]);
    setDirty(false);
    const stop = subscribeFormDesigns(
      tenantId,
      ownerId,
      (rows) => {
        if (generation.current !== current) return;
        setLoaded(true);
        setSaved(rows);
        if (!initialized.current) {
          initialized.current = true;
          const latest = [...rows].sort((a, b) =>
            b.syncedAt.localeCompare(a.syncedAt),
          )[0];
          if (latest) setState(latest);
        }
      },
      () => {
        setLoaded(true);
        setError('No se pudieron cargar los diseños guardados.');
      },
    );
    return () => {
      generation.current++;
      stop();
    };
  }, [tenantId, ownerId]);
  const patch = (design: SavedFormDesign['design']) => {
    setState((previous) => ({ ...previous, design, reviewed: false }));
    setDirty(true);
    setMessage('');
  };
  const question = (index: number, value: Partial<FormQuestion>) =>
    patch({
      ...state.design,
      questions: state.design.questions.map((row, i) =>
        i === index ? { ...row, ...value } : row,
      ),
    });
  const save = async (next = state) => {
    const stored = await saveFormDesign(next);
    setState(stored);
    setDirty(false);
    return stored;
  };
  async function perform(action: () => Promise<void>) {
    setBusy(true);
    setError('');
    setMessage('');
    const current = generation.current;
    try {
      await action();
    } catch (error) {
      if (current === generation.current) {
        setError((error as Error).message);
        if ((error as any).status === 401) onExpired();
      }
    } finally {
      if (current === generation.current) setBusy(false);
    }
  }
  useEffect(() => {
    onBusy?.(busy);
    return () => onBusy?.(false);
  }, [busy]);
  const locked = !!state.remote;
  return (
    <section
      className="workspace-builder space-y-4"
      aria-label="Diseñador de formularios"
    >
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Formularios · diseño y revisión</h2>
          <p className="text-xs text-slate-400">
            Proponga preguntas con IA o edítelas manualmente. La creación en
            Google requiere una revisión explícita.
          </p>
        </div>
        <button
          className="compact-button"
          disabled={busy}
          onClick={() => {
            if (
              dirty &&
              !window.confirm(
                '¿Descartar los cambios sin guardar y crear un diseño nuevo?',
              )
            )
              return;
            setState(fresh());
            setDirty(false);
            setError('');
            setMessage('');
          }}
        >
          Nuevo diseño
        </button>
      </header>
      <label className="block text-xs">
        Diseños guardados
        <select
          aria-label="Diseños de formularios guardados"
          className="compact-input mt-1"
          value={saved.some((row) => row.id === state.id) ? state.id : ''}
          disabled={busy}
          onChange={(event) => {
            const selected = saved.find((row) => row.id === event.target.value);
            if (
              selected &&
              (!dirty ||
                window.confirm(
                  '¿Abrir el diseño guardado y descartar cambios locales?',
                ))
            ) {
              setState(selected);
              setDirty(false);
              setError('');
            }
          }}
        >
          <option value="">Diseño nuevo</option>
          {saved.map((row) => (
            <option key={row.id} value={row.id}>
              {row.name} · v{row.revision}
            </option>
          ))}
        </select>
      </label>
      <details open={!locked} className="compact-disclosure">
        <summary>Contexto para el asistente</summary>
        <textarea
          aria-label="Contexto del formulario"
          className="compact-input mt-2"
          rows={3}
          maxLength={3500}
          placeholder="Propósito, personas que responderán, información necesaria y uso de los datos…"
          value={context}
          disabled={busy || locked || !loaded}
          onChange={(event) => setContext(event.target.value)}
        />
        <button
          className="compact-button mt-2"
          disabled={busy || locked || context.trim().length < 15}
          onClick={() =>
            void perform(async () => {
              const response = await authenticatedFetch('/api/ai/form-design', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ tenantId, context }),
                }),
                data = await response.json();
              if (!response.ok || !data.success)
                throw Error(data.error || 'No se pudo proponer el formulario.');
              patch(validateFormDesign(data.design));
              setMessage(
                'Propuesta recibida. Edite las preguntas y acepte la revisión antes de crear.',
              );
            })
          }
        >
          Proponer preguntas con IA
        </button>
      </details>
      <fieldset disabled={busy || locked || !loaded} className="space-y-3">
        <label className="block text-sm">
          Título del formulario
          <input
            aria-label="Título del formulario"
            className="compact-input mt-1"
            maxLength={160}
            value={state.design.title}
            onChange={(event) =>
              patch({ ...state.design, title: event.target.value })
            }
          />
        </label>
        <label className="block text-sm">
          Descripción y propósito
          <textarea
            aria-label="Descripción del formulario"
            className="compact-input mt-1"
            rows={2}
            maxLength={3000}
            value={state.design.description}
            onChange={(event) =>
              patch({ ...state.design, description: event.target.value })
            }
          />
        </label>
        {state.design.questions.map((row, index) => (
          <article
            key={row.id}
            className="rounded-xl border border-slate-700 bg-slate-950 p-3"
          >
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <strong className="text-sm">Pregunta {index + 1}</strong>
              <div className="flex gap-1">
                <button
                  type="button"
                  aria-label={`Subir pregunta ${index + 1}`}
                  className="compact-button"
                  disabled={index === 0}
                  onClick={() => {
                    const rows = [...state.design.questions];
                    [rows[index - 1], rows[index]] = [
                      rows[index],
                      rows[index - 1],
                    ];
                    patch({ ...state.design, questions: rows });
                  }}
                >
                  ↑
                </button>
                <button
                  type="button"
                  aria-label={`Bajar pregunta ${index + 1}`}
                  className="compact-button"
                  disabled={index === state.design.questions.length - 1}
                  onClick={() => {
                    const rows = [...state.design.questions];
                    [rows[index + 1], rows[index]] = [
                      rows[index],
                      rows[index + 1],
                    ];
                    patch({ ...state.design, questions: rows });
                  }}
                >
                  ↓
                </button>
                <button
                  type="button"
                  aria-label={`Eliminar pregunta ${index + 1}`}
                  className="compact-button"
                  disabled={state.design.questions.length === 1}
                  onClick={() =>
                    patch({
                      ...state.design,
                      questions: state.design.questions.filter(
                        (_, i) => i !== index,
                      ),
                    })
                  }
                >
                  Eliminar
                </button>
              </div>
            </div>
            <label className="block text-xs">
              Pregunta
              <input
                aria-label={`Texto de pregunta ${index + 1}`}
                className="compact-input mt-1"
                value={row.title}
                maxLength={300}
                onChange={(event) =>
                  question(index, { title: event.target.value })
                }
              />
            </label>
            <div className="my-2 grid gap-2 sm:grid-cols-2">
              <label className="text-xs">
                Tipo
                <select
                  aria-label={`Tipo de pregunta ${index + 1}`}
                  className="compact-input mt-1"
                  value={row.type}
                  onChange={(event) =>
                    question(index, {
                      type: event.target.value as FormQuestion['type'],
                      options: row.options.length ? row.options : ['Opción 1'],
                    })
                  }
                >
                  {FORM_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {labels[type]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex min-h-11 items-center gap-2 text-xs">
                <input
                  aria-label={`Pregunta ${index + 1} obligatoria`}
                  type="checkbox"
                  checked={row.required}
                  onChange={(event) =>
                    question(index, { required: event.target.checked })
                  }
                />
                Respuesta obligatoria
              </label>
            </div>
            <label className="block text-xs">
              Ayuda
              <input
                aria-label={`Ayuda de pregunta ${index + 1}`}
                className="compact-input mt-1"
                value={row.help}
                onChange={(event) =>
                  question(index, { help: event.target.value })
                }
              />
            </label>
            {['single', 'multiple', 'dropdown'].includes(row.type) && (
              <label className="mt-2 block text-xs">
                Opciones · una por línea
                <textarea
                  aria-label={`Opciones de pregunta ${index + 1}`}
                  className="compact-input mt-1"
                  rows={3}
                  value={row.options.join('\n')}
                  onChange={(event) =>
                    question(index, { options: event.target.value.split('\n') })
                  }
                />
              </label>
            )}
          </article>
        ))}
        <button
          type="button"
          className="compact-button"
          disabled={state.design.questions.length >= 30}
          onClick={() =>
            patch({
              ...state.design,
              questions: [
                ...state.design.questions,
                {
                  id: crypto.randomUUID().replaceAll('-', '').slice(0, 8),
                  title: 'Nueva pregunta',
                  help: '',
                  type: 'short',
                  required: false,
                  options: [],
                },
              ],
            })
          }
        >
          Añadir pregunta
        </button>
      </fieldset>
      <div className="flex flex-wrap gap-2">
        <button
          className="compact-button"
          disabled={busy || locked || !loaded}
          onClick={() => {
            try {
              const design = validateFormDesign(state.design);
              setState({ ...state, design, reviewed: true });
              setDirty(true);
              setError('');
              setMessage(
                'Preguntas revisadas y aceptadas. Ya puede crear el formulario con la cuenta conectada.',
              );
            } catch (error) {
              setError((error as Error).message);
            }
          }}
        >
          Aceptar preguntas revisadas
        </button>
        <button
          className="compact-button"
          disabled={busy}
          onClick={() =>
            void perform(async () => {
              await save();
              setMessage('Diseño guardado en Firestore.');
            })
          }
        >
          Guardar diseño en Astrea
        </button>
      </div>
      {state.reviewed && (
        <p className="text-sm text-emerald-300">
          Revisión aceptada · {state.design.questions.length} preguntas
        </p>
      )}
      {!state.remote?.published && (
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={publish}
            onChange={(event) => setPublish(event.target.checked)}
          />
          Habilitar respuestas en Google al crear
        </label>
      )}
      <button
        className="compact-button is-primary"
        disabled={
          busy ||
          !state.reviewed ||
          !account ||
          !!state.remote?.published ||
          (!!state.googleUid && state.googleUid !== account?.googleUid)
        }
        onClick={() =>
          void perform(async () => {
            let working = dirty || !state.revision ? await save() : state;
            try {
              const remote = await currentWorkspaceApi().createForm(
                working.design,
                publish,
                working.remote?.formId,
                async (form) => {
                  working = await saveFormDesign({
                    ...working,
                    remote: form,
                    googleUid: account!.googleUid,
                  });
                  setState(working);
                },
              );
              working = { ...working, remote, googleUid: account!.googleUid };
              setState(working);
              await save(working);
              setMessage(
                remote.published
                  ? 'Formulario creado, configurado y con respuestas habilitadas.'
                  : 'Formulario creado y configurado como borrador de Google.',
              );
            } catch (error) {
              if (error instanceof FormSetupError)
                setState({
                  ...working,
                  remote: error.form,
                  googleUid: account!.googleUid,
                });
              throw error;
            }
          })
        }
      >
        {busy
          ? 'Procesando…'
          : state.remote
            ? 'Completar configuración de Google'
            : 'Crear formulario en Google'}
      </button>
      {!account && (
        <p className="text-xs text-slate-400">
          Vincule Google Workspace para crear con esa cuenta. El diseño se puede
          guardar antes de vincular.
        </p>
      )}
      {state.remote && (
        <div className="space-y-2 rounded-xl border border-cyan-700 p-3 text-sm">
          <p>
            {state.remote.published
              ? 'Respuestas habilitadas'
              : 'Formulario creado · consulte su estado de configuración'}
          </p>
          <a
            className="inline-flex min-h-11 items-center text-cyan-300 underline"
            href={googleFormLink(state.remote.editUri) || undefined}
            target="_blank"
            rel="noreferrer"
          >
            Abrir edición en Google Forms
          </a>
          {state.remote.published && state.remote.responderUri && (
            <a
              className="ml-3 text-cyan-300 underline"
              href={googleFormLink(state.remote.responderUri) || undefined}
              target="_blank"
              rel="noreferrer"
            >
              Abrir formulario para responder
            </a>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              className="compact-button"
              disabled={
                busy || !account || state.googleUid !== account.googleUid
              }
              onClick={() =>
                void perform(async () => {
                  const responses = await currentWorkspaceApi().formResponses(
                    state.remote!.formId,
                  );
                  setMessage(
                    `${responses.limited ? 'Al menos ' : ''}${responses.count} respuestas recibidas en Google.`,
                  );
                })
              }
            >
              Consultar cantidad de respuestas
            </button>
            <button
              className="compact-button"
              disabled={busy}
              onClick={() => {
                setState({ ...fresh(), design: structuredClone(state.design) });
                setDirty(true);
                setMessage(
                  'Copia editable abierta. El formulario anterior se conserva.',
                );
              }}
            >
              Crear una copia editable
            </button>
          </div>
        </div>
      )}
      {dirty && (
        <p className="text-xs text-amber-200">
          Cambios del diseño pendientes de guardar.
        </p>
      )}
      {message && (
        <p role="status" className="text-sm text-cyan-200">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-amber-200">
          {error}
        </p>
      )}
    </section>
  );
}
