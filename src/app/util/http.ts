import { HttpErrorResponse, HttpParameterCodec, HttpParams } from '@angular/common/http';
import { isArray, isObject } from 'lodash-es';
import { isMoment } from 'moment';
import { Problem } from '../model/problem';
import { banlistConfig } from '../mods/banlist';


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
  if (!isObject(obj)) return obj;
  const result: Record<string, any> = {};
  for (const k in obj) {
    // @ts-ignore
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
  let params = new HttpParams({ encoder });
  obj = writeObj(obj);
  for (const k in obj) {
    if (isArray(obj[k])) {
      for (const i in obj[k]) {
        params = params.append(k, obj[k][i]);
      }
    } else {
      params = params.append(k, obj[k]);
    }
  }
  return params;
}

export function printError(res: HttpErrorResponse): string[] {
  let result = [];
  const problem = res.error as Problem;
  if (problem?.fieldErrors) {
    for (const fe of problem.fieldErrors) {
      result.push(`Error: ${fe.objectName} ${fe.field} ${fe.message}`);
    }
    return result;
  }
  if (problem?.violations) {
    for (const v of problem.violations) {
      result.push(`Error: ${v.field} ${v.message}`);
    }
    return result;
  }
  return [problem?.detail || res.message];
}

export function fixUrl(url: string, banlist: typeof banlistConfig) {
  url = (url || '').trim();
  if (url.startsWith('<a')) {
    url = url.substring(url.toLowerCase().indexOf('href="') + 'href="'.length)
    return url.substring(0, url.indexOf('"'));
  }
  if (url.startsWith('<iframe')) {
    url = url.substring(url.toLowerCase().indexOf('src="') + 'src="'.length);
    return url.substring(0, url.indexOf('"'));
  }
  for (const prefix in banlist.config?.expandShorteners || []) {
    if (url.startsWith(prefix)) {
      url = banlist.config!.expandShorteners[prefix] + url.substring(prefix.length);
      const search = url.lastIndexOf('?');
      if (search != url.indexOf('?')) {
        url = url.substring(0, search) + '&' + url.substring(search + 1);
      }
    }
  }
  if (isTracking(url, banlist)) {
    url = url.substring(0, url.indexOf('?'));
  }
  if (isShortener(url, banlist)) {
    throw 'Banned URL';
  }
  return url;
}

export function isShortener(url: string, banlist: typeof banlistConfig) {
  url = url.toLowerCase();
  for (const frag of banlist.config?.bannedUrls || []) {
    if (url.includes(frag)) return true;
  }
  return false;
}

export function isTracking(url: string, banlist: typeof banlistConfig) {
  if (!url.includes('?')) return false;
  url = url.toLowerCase();
  for (const frag of banlist.config?.stripTrackers || []) {
    if (url.includes(frag)) return true;
  }
  return false;
}

export function parseParams(url: string): any {
  const params: any = {};
  let p: URLSearchParams;
  try {
    p = new URL(url).searchParams;
  } catch {}
  try {
    p = new URL('http://example.com/' + url).searchParams;
  } catch {
    return params;
  }
  for (const key of p.keys()) {
    params[key] = p.getAll(key).length > 1 ? p.getAll(key) : p.get(key)
  }
  return params;
}
