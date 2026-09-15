/**
 * Generador de identificadores legibles en español para documentos de Firestore.
 * Transforma nombres, descripciones y cargos en slugs limpios y descriptivos:
 * Ej: "candidato-marcos-barrios-alcaldia-astrea"
 */
export function generarIdDocumentoLegible(
  tipo: 'candidato' | 'lider' | 'gasto' | 'vehiculo' | 'distrito' | 'propuesta' | 'tenant' | 'organizacion' | 'usuario' | 'archivo' | string,
  nombreOTexto: string,
  ...contextosExtra: (string | undefined | null)[]
): string {
  const sanitizar = (texto: string) =>
    texto
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Quitar tildes y diacríticos
      .replace(/[^a-z0-9]+/g, '-') // Reemplazar caracteres especiales y espacios por guiones
      .replace(/^-+|-+$/g, '') // Quitar guiones al inicio o final
      .substring(0, 35); // Limitar longitud para evitar IDs gigantes

  const baseLimpia = sanitizar(nombreOTexto || 'sin-nombre');
  const partesContexto = contextosExtra
    .filter((c): c is string => Boolean(c && typeof c === 'string' && c.trim() !== ''))
    .map(c => sanitizar(c))
    .filter(c => c.length > 0)
    .join('-');

  const sufijoContexto = partesContexto ? `-${partesContexto}` : '';
  const hashAleatorio = Math.random().toString(36).substring(2, 6);

  return `${tipo}-${baseLimpia}${sufijoContexto}-${hashAleatorio}`;
}

export function slugifyEspanol(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
