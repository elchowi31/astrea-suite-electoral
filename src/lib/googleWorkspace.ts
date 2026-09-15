import {
  reauthenticateWithPopup,
  GoogleAuthProvider,
  User,
  onAuthStateChanged,
} from 'firebase/auth';
import { auth } from './firebase';

export const WORKSPACE_SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/forms.body',
  'https://www.googleapis.com/auth/forms.responses.readonly',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/calendar.events',
];

const provider = new GoogleAuthProvider();
WORKSPACE_SCOPES.forEach((scope) => provider.addScope(scope));

let cachedAccessToken: string | null = null;
let isSigningIn = false;

export const initGoogleWorkspaceAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        // Token might need user interaction or popup
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const signInWithGoogleWorkspace = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    if (!auth.currentUser) throw new Error('Inicie sesión antes de conectar Google Workspace.');
    const result = await reauthenticateWithPopup(auth.currentUser, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('No se pudo obtener el token de acceso de Google Workspace.');
    }

    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Error al iniciar sesión con Google:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getWorkspaceAccessToken = (): string | null => {
  return cachedAccessToken;
};

export const logoutGoogleWorkspace = async () => {
  cachedAccessToken = null;
};

// ==========================================
// GOOGLE SHEETS API v4 INTEGRATION
// ==========================================
export interface SheetRowData {
  [key: string]: any;
}

export async function exportCampaignToGoogleSheets(
  title: string,
  headers: string[],
  rows: (string | number)[][],
  accessToken: string
): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> {
  // 1. Create new spreadsheet
  const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: {
        title: title,
      },
      sheets: [
        {
          properties: {
            title: 'Reporte Oficial Campaña',
            gridProperties: {
              frozenRowCount: 1,
            },
          },
        },
      ],
    }),
  });

  if (!createRes.ok) {
    const err = await createRes.json();
    throw new Error(`Error al crear Google Sheet: ${err?.error?.message || createRes.statusText}`);
  }

  const sheetData = await createRes.json();
  const spreadsheetId = sheetData.spreadsheetId;
  const spreadsheetUrl = sheetData.spreadsheetUrl;

  // 2. Append headers and rows
  const allValues = [headers, ...rows];
  const appendRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/A1:append?valueInputOption=USER_ENTERED`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: allValues,
      }),
    }
  );

  if (!appendRes.ok) {
    const err = await appendRes.json();
    throw new Error(`Error al insertar datos en Google Sheet: ${err?.error?.message || appendRes.statusText}`);
  }

  return { spreadsheetId, spreadsheetUrl };
}

export async function readGoogleSheetValues(
  spreadsheetId: string,
  range: string,
  accessToken: string
): Promise<any[][]> {
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Error al leer Google Sheet: ${err?.error?.message || res.statusText}`);
  }

  const data = await res.json();
  return data.values || [];
}

// ==========================================
// GOOGLE FORMS API v1 INTEGRATION
// ==========================================
export async function createVolunteerGoogleForm(
  title: string,
  description: string,
  accessToken: string,
  locations: string[] = []
): Promise<{ formId: string; responderUri: string }> {
  const locationOptions = Array.from(new Set(locations.map((item) => item.trim()).filter(Boolean))).slice(0, 50);
  // 1. Create blank form
  const createRes = await fetch('https://forms.googleapis.com/v1/forms', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      info: {
        title: title,
        documentTitle: title,
      },
    }),
  });

  if (!createRes.ok) {
    const err = await createRes.json();
    throw new Error(`Error al crear formulario: ${err?.error?.message || createRes.statusText}`);
  }

  const form = await createRes.json();
  const formId = form.formId;
  const responderUri = form.responderUri;

  // 2. Batch update to add questions for campaign volunteers and witnesses
  const updateRes = await fetch(`https://forms.googleapis.com/v1/forms/${formId}:batchUpdate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      requests: [
        {
          updateFormInfo: {
            info: {
              description: description,
            },
            updateMask: 'description',
          },
        },
        {
          createItem: {
            item: {
              title: 'Nombre Completo del Voluntario / Líder',
              questionItem: {
                question: {
                  required: true,
                  textQuestion: {},
                },
              },
            },
            location: { index: 0 },
          },
        },
        {
          createItem: {
            item: {
              title: 'Número de Celular y WhatsApp',
              questionItem: {
                question: {
                  required: true,
                  textQuestion: {},
                },
              },
            },
            location: { index: 1 },
          },
        },
        {
          createItem: {
            item: {
              title: 'Municipio o Vereda de Residencia',
              questionItem: {
                question: {
                  required: true,
                  ...(locationOptions.length
                    ? { choiceQuestion: { type: 'RADIO', options: locationOptions.map((value) => ({ value })) } }
                    : { textQuestion: {} }),
                },
              },
            },
            location: { index: 2 },
          },
        },
        {
          createItem: {
            item: {
              title: 'Rol de Apoyo en Campaña',
              questionItem: {
                question: {
                  required: true,
                  choiceQuestion: {
                    type: 'CHECKBOX',
                    options: [
                      { value: 'Testigo Electoral en Mesa (Día D)' },
                      { value: 'Coordinador(a) de Cuadra o Vereda' },
                      { value: 'Movilización y Transporte' },
                      { value: 'Redes Sociales y Publicidad' },
                      { value: 'Logística de Eventos y Plazoletas' },
                    ],
                  },
                },
              },
            },
            location: { index: 3 },
          },
        },
        {
          createItem: {
            item: {
              title: 'Autorización de tratamiento de datos personales',
              description: 'Confirme que autoriza a la organización a tratar estos datos exclusivamente para coordinación y contacto, conforme a su aviso de privacidad.',
              questionItem: {
                question: {
                  required: true,
                  choiceQuestion: {
                    type: 'CHECKBOX',
                    options: [{ value: 'Sí, autorizo el tratamiento informado de mis datos.' }],
                  },
                },
              },
            },
            location: { index: 4 },
          },
        },
      ],
    }),
  });

  if (!updateRes.ok) {
    console.warn('Batch update en Google Form parcial:', await updateRes.text());
  }

  return { formId, responderUri };
}

export async function getGoogleFormResponses(formId: string, accessToken: string): Promise<any[]> {
  const res = await fetch(`https://forms.googleapis.com/v1/forms/${formId}/responses`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Error al leer respuestas de Formulario: ${err?.error?.message || res.statusText}`);
  }

  const data = await res.json();
  return data.responses || [];
}

// ==========================================
// GOOGLE CALENDAR API v3 INTEGRATION
// ==========================================
export interface CampaignCalendarEvent {
  id?: string;
  summary: string;
  description?: string;
  location?: string;
  start: { dateTime: string; timeZone?: string };
  end: { dateTime: string; timeZone?: string };
  colorId?: string;
}

export async function listCampaignCalendarEvents(
  accessToken: string,
  timeMin?: string
): Promise<CampaignCalendarEvent[]> {
  const minTime = timeMin || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(minTime)}&orderBy=startTime&singleEvents=true`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Error al listar eventos de Calendar: ${err?.error?.message || res.statusText}`);
  }

  const data = await res.json();
  return (data.items || []).map((item: any) => ({
    id: item.id,
    summary: item.summary,
    description: item.description,
    location: item.location,
    start: item.start,
    end: item.end,
    colorId: item.colorId,
  }));
}

export async function createCampaignCalendarEvent(
  event: {
    summary: string;
    description: string;
    location: string;
    startIso: string;
    endIso: string;
  },
  accessToken: string
): Promise<CampaignCalendarEvent> {
  const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      summary: event.summary,
      description: event.description,
      location: event.location,
      start: {
        dateTime: event.startIso,
        timeZone: 'America/Bogota',
      },
      end: {
        dateTime: event.endIso,
        timeZone: 'America/Bogota',
      },
      colorId: '11', // Red / bold for political events
    }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Error al crear evento en Google Calendar: ${err?.error?.message || res.statusText}`);
  }

  return await res.json();
}

export async function deleteCampaignCalendarEvent(
  eventId: string,
  accessToken: string
): Promise<void> {
  const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok && res.status !== 404 && res.status !== 204) {
    const err = await res.json();
    throw new Error(`Error al eliminar evento en Google Calendar: ${err?.error?.message || res.statusText}`);
  }
}
