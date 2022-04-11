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
 * Format all non-empty properties for HTTP Query params.
 */
export function params(obj?: Record<string, any>): Record<string, any> | undefined {
  if (!obj) return undefined;
  const result: Record<string, any> = {};
  for (const k in obj) {
    let v = obj[k];
    if (isMoment(v)) v = v.toISOString();
    if (v) {
      result[k] = v;
    }
  }
  const params = new HttpParams({ encoder });
  return params.appendAll(result);
}

export function printError(res: HttpErrorResponse): string[] {
  let result = [];
  const problem = res.error as Problem;
  if (problem.message === 'error.validation') {
    for (const fe of problem.fieldErrors) {
      result.push(`Error: ${fe.objectName} ${fe.field} ${fe.message}`);
    }
    return result;
  }
  return [problem.detail || res.message];
}
