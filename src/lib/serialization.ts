/** Firestore rejects undefined properties, including optional nested fields. */
export function omitUndefined<T>(value: T): T {
  if (Array.isArray(value)) return value.map(item => item === undefined ? null : omitUndefined(item)) as T;
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(Object.entries(value).filter(([, field]) => field !== undefined).map(([key, field]) => [key, omitUndefined(field)])) as T;
  }
  return value;
}
