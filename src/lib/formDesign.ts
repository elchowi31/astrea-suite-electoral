export const FORM_TYPES = [
  'short',
  'paragraph',
  'single',
  'multiple',
  'dropdown',
  'date',
] as const;
export type FormQuestion = {
  id: string;
  title: string;
  help: string;
  type: (typeof FORM_TYPES)[number];
  required: boolean;
  options: string[];
};
export type FormDesign = {
  title: string;
  description: string;
  questions: FormQuestion[];
};
const text = (value: unknown, max: number) =>
  typeof value === 'string' ? value.trim().slice(0, max) : '';
export function validateFormDesign(input: unknown): FormDesign {
  const draft = input as FormDesign;
  if (
    !draft ||
    !text(draft.title, 160) ||
    !Array.isArray(draft.questions) ||
    draft.questions.length < 1 ||
    draft.questions.length > 30
  )
    throw Error('Escriba un título y entre 1 y 30 preguntas.');
  const questions = draft.questions.map((row, index) => {
    if (!row || !FORM_TYPES.includes(row.type) || !text(row.title, 300))
      throw Error(`Revise el título y tipo de la pregunta ${index + 1}.`);
    const options = Array.isArray(row.options)
      ? row.options.map((value) => text(value, 160)).filter(Boolean)
      : [];
    if (
      ['single', 'multiple', 'dropdown'].includes(row.type) &&
      (!options.length ||
        options.length > 30 ||
        new Set(options).size !== options.length)
    )
      throw Error(
        `La pregunta ${index + 1} necesita entre 1 y 30 opciones distintas.`,
      );
    const id =
      typeof row.id === 'string' && /^[a-f0-9]{8}$/.test(row.id)
        ? row.id
        : crypto.randomUUID().replaceAll('-', '').slice(0, 8);
    return {
      id,
      title: text(row.title, 300),
      help: text(row.help, 1000),
      type: row.type,
      required: row.required === true,
      options,
    };
  });
  if (new Set(questions.map((row) => row.id)).size !== questions.length)
    throw Error('Las preguntas tienen identificadores repetidos.');
  return {
    title: text(draft.title, 160),
    description: text(draft.description, 3000),
    questions,
  };
}
export function parseSuggestedForm(raw: string) {
  const clean = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');
  return validateFormDesign(JSON.parse(clean));
}
export function defaultFormDesign(): FormDesign {
  return validateFormDesign({
    title: 'Registro de participantes y coordinación',
    description:
      'Indique el propósito, responsable del tratamiento y forma de contacto antes de publicar.',
    questions: [
      { title: 'Nombre completo', type: 'short', required: true, options: [] },
      {
        title: 'Medio de contacto autorizado',
        type: 'short',
        required: false,
        options: [],
      },
      {
        title: 'Municipio, barrio o vereda',
        type: 'short',
        required: true,
        options: [],
      },
      {
        title: 'Actividad o función de apoyo',
        type: 'single',
        required: true,
        options: [
          'Logística',
          'Transporte',
          'Testigo electoral',
          'Coordinación',
        ],
      },
      {
        title:
          'Autorizo el tratamiento de mis datos para el propósito descrito',
        type: 'multiple',
        required: true,
        options: ['Sí, autorizo.'],
      },
    ],
  });
}
export function formItem(question: FormQuestion) {
  const content =
    question.type === 'date'
      ? { dateQuestion: { includeYear: true, includeTime: false } }
      : ['single', 'multiple', 'dropdown'].includes(question.type)
        ? {
            choiceQuestion: {
              type:
                question.type === 'single'
                  ? 'RADIO'
                  : question.type === 'multiple'
                    ? 'CHECKBOX'
                    : 'DROP_DOWN',
              options: question.options.map((value) => ({ value })),
              shuffle: false,
            },
          }
        : { textQuestion: { paragraph: question.type === 'paragraph' } };
  return {
    itemId: question.id,
    title: question.title,
    description: question.help,
    questionItem: { question: { required: question.required, ...content } },
  };
}
