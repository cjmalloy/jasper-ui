import { HttpErrorResponse, HttpParameterCodec, HttpParams } from '@angular/common/http';
import { isMoment } from 'moment';
import { Problem } from '../model/problem';


export class HttpUrlEncodingCodec implements HttpParameterCodec {
  encodeKey(k: string): string { return encodeURIComponent(k); }
  encodeValue(v: string): string { return encodeURIComponent(v); }
  decodeKey(k: string): string { return decodeURIComponent(k); }
  decodeValue(v: string) { return decodeURIComponent(v); }
}

const encoder = new HttpUrlEncodingCodec();

/**
 * Jsonify object.
 */
export function writeObj(obj?: Record<string, any>): Record<string, any> | undefined {
  if (!obj) return undefined;
  const result: Record<string, any> = {};
  for (const k in obj) {
    let v = obj[k];
    if (isMoment(v)) v = v.toISOString();
    if ((v || v === false) && !emptyObject(v)) {
      result[k] = v;
    }
  }
  if (emptyObject(result)) return undefined;
  return result;
}

export function emptyObject(obj: any) {
  return obj &&
    Object.keys(obj).length === 0 &&
    Object.getPrototypeOf(obj) === Object.prototype;
}

/**
 * Format all non-empty properties for HTTP Query params.
 */
export function params(obj?: Record<string, any>): Record<string, any> | undefined {
  if (!obj) return undefined;
  const params = new HttpParams({ encoder });
  return params.appendAll(writeObj(obj)!);
}

export function printError(res: HttpErrorResponse): string[] {
  let result = [];
  const problem = res.error as Problem;
  if (problem.fieldErrors) {
    for (const fe of problem.fieldErrors) {
      result.push(`Error: ${fe.objectName} ${fe.field} ${fe.message}`);
    }
    return result;
  }
  if (problem.violations) {
    for (const v of problem.violations) {
      result.push(`Error: ${v.field} ${v.message}`);
    }
    return result;
  }
  return [problem?.detail || res.message];
}
