/**
 * Copy all non-empty properties.
 */
export function params(obj: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const k in obj) {
    const v = obj[k];
    if (v !== null && v !== undefined) {
      result[k] = v;
    }
  }
  return result;
}
