import { HttpErrorResponse, HttpParameterCodec, HttpParams } from '@angular/common/http';
import { isArray, isObject } from 'lodash-es';
import { DateTime } from 'luxon';
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
    if (DateTime.isDateTime(v)) v = v.toUTC().toISO();
    if ((v || v === false) && !emptyObject(v)) {
      result[k] = v;
    }
  }
  if (emptyObject(result)) return undefined;
  return result;
}

/**
 * Jsonify object and set missing fields to null to remove during merge.
 */
export function patchObj(obj?: Record<string, any>): Record<string, any> | null {
  if (!obj) return {};
  if (!isObject(obj)) return obj;
  const result: Record<string, any> = {};
  for (const k in obj) {
    // @ts-ignore
    let v = obj[k];
    if (DateTime.isDateTime(v)) v = v.toUTC().toISO();
    if ((v || v === false) && !emptyObject(v)) {
      result[k] = v;
    } else {
      result[k] = null;
    }
  }
  if (emptyObject(result)) return null;
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
    if (url.startsWith('https://www.youtube.com/')) {
      if (url.includes('&si=')) {
        url = url.substring(0, url.indexOf('&si='));
      }
    } else if (url.includes('?')) {
      url = url.substring(0, url.indexOf('?'));
    }
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

export function getSearchParams(url: string) {
  try {
    return new URL(url).searchParams;
  } catch {
    try {
      return new URL('http://example.com/' + url).searchParams;
    } catch {
      return new URLSearchParams();
    }
  }
}

export function parseParams(url: string): any {
  const params: any = {};
  const p = getSearchParams(url);
  for (const key of p.keys()) {
    params[key] = p.getAll(key).length > 1 ? p.getAll(key) : p.get(key)
  }
  return params;
}

export function getUrl(url: string): URL | null {
  try {
    return new URL(url);
  } catch (e) {}
  return null;
}

export function getHost(url: string): string | null {
  const parsed = getUrl(url);
  if (!parsed) return null;
  return parsed.host;
}

export function getScheme(url: string) {
  const parsed = getUrl(url);
  if (!parsed) return undefined;
  return parsed.protocol;
}

export function parts(url: string) {
  const parts = new URL('http://test.com/' + url);
  return [parts.pathname, parts.search, parts.hash];
}

export function getPath(url: string): string | null {
  if (!url) return '';
  if ((''+url).startsWith('/')) {
    if (url.includes('#')) url = url.substring(0, url.indexOf('#'));
    if (url.includes('?')) url = url.substring(0, url.indexOf('?'));
    return url;
  }
  const parsed = getUrl(url);
  if (!parsed) return '';
  return parsed.pathname;
}

export function getExtension(url: string): string | null {
  const parsed = getUrl(url);
  if (!parsed) return null;
  if (!parsed.pathname.includes('.')) return parsed.pathname;
  return parsed.pathname.substring(parsed.pathname.lastIndexOf('.'));
}
