import { isMoment } from "moment";

/**
 * Format all non-empty properties for HTTP Query params.
 */
export function params(obj?: Record<string, any>): Record<string, any> | undefined {
  if (!obj) return undefined;
  const result: Record<string, any> = {};
  for (const k in obj) {
    let v = obj[k];
    if (isMoment(v)) v = v.toISOString();
    if (v !== null && v !== undefined) {
      result[k] = v;
    }
  }
  return result;
}
