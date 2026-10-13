/** Firestore rejects undefined properties, including optional nested fields. */
export function omitUndefined<T>(value: T): T {
  if (Array.isArray(value)) return value.map(item => item === undefined ? null : omitUndefined(item)) as T;
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(Object.entries(value).filter(([, field]) => field !== undefined).map(([key, field]) => [key, omitUndefined(field)])) as T;
  }
  return value;
}

/** Firestore may reorder map keys. Compare their values, not insertion order. */
export function canonicalStoredValue(value:unknown):string {
  const canonical=(item:unknown):unknown=>Array.isArray(item)?item.map(canonical):item&&typeof item==='object'?Object.fromEntries(Object.entries(item).filter(([,field])=>field!==undefined).sort(([a],[b])=>a.localeCompare(b)).map(([key,field])=>[key,canonical(field)])):item??null;
  return JSON.stringify(canonical(value));
}
