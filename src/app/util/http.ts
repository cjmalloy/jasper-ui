import { HttpErrorResponse } from '@angular/common/http';
import { isMoment } from 'moment';
import { Problem } from '../model/problem';

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
