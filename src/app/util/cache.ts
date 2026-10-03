import { isArray, isPlainObject } from 'lodash-es';
import { Ref } from '../model/ref';

export const CACHE_FOLDER = 'cache/';
const CACHE_ID_REGEX = /^[\w-]+(?:\.[\w-]+)*$/;
const CACHE_URL_REGEX = /^cache:([\w-]+(?:\.[\w-]+)*)$/;
const CACHE_URL_TEXT_REGEX = /\bcache:([\w-]+(?:\.[\w-]+)*)(?![\w./-])/g;

const MIME_TYPES: Record<string, string> = {
  apng: 'image/apng',
  avif: 'image/avif',
  bmp: 'image/bmp',
  gif: 'image/gif',
  ico: 'image/x-icon',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  png: 'image/png',
  svg: 'image/svg+xml',
  tif: 'image/tiff',
  tiff: 'image/tiff',
  webp: 'image/webp',
  mp4: 'video/mp4',
  m4v: 'video/mp4',
  mov: 'video/quicktime',
  ogv: 'video/ogg',
  webm: 'video/webm',
  mkv: 'video/x-matroska',
  aac: 'audio/aac',
  flac: 'audio/flac',
  m4a: 'audio/mp4',
  mp3: 'audio/mpeg',
  oga: 'audio/ogg',
  ogg: 'audio/ogg',
  opus: 'audio/opus',
  wav: 'audio/wav',
  pdf: 'application/pdf',
  json: 'application/json',
  zip: 'application/zip',
  txt: 'text/plain',
  md: 'text/markdown',
  csv: 'text/csv',
  html: 'text/html',
};

/**
 * Guess the MIME type of a cache file from the extension of its ID.
 */
export function cacheMimeType(id: string) {
  const dot = id.lastIndexOf('.');
  if (dot < 0) return '';
  return MIME_TYPES[id.substring(dot + 1).toLowerCase()] || '';
}

/**
 * Check if a cache ID is safe to use as a file name in a zip.
 */
export function isCacheId(id?: string): id is string {
  return !!id && CACHE_ID_REGEX.test(id);
}

/**
 * Get the cache ID from a cache: URL.
 */
export function cacheUrlId(url?: string) {
  return url?.match(CACHE_URL_REGEX)?.[1];
}

function visitStrings(value: any, fn: (s: string) => string): any {
  if (typeof value === 'string') return fn(value);
  if (isArray(value)) return value.map(v => visitStrings(v, fn));
  if (isPlainObject(value)) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, visitStrings(v, fn)]));
  }
  return value;
}

/**
 * Collect all cache IDs referenced by a Ref. This includes cache: URLs in the
 * url, sources, alternate URLs, plugin data and comment, as well as the ID
 * of the visible _plugin/cache.
 */
export function refCacheIds(ref: Ref): string[] {
  const ids = new Set<string>();
  const add = (id?: string) => {
    if (isCacheId(id)) ids.add(id);
  };
  add(cacheUrlId(ref.url));
  ref.sources?.forEach(s => add(cacheUrlId(s)));
  ref.alternateUrls?.forEach(s => add(cacheUrlId(s)));
  const cache = ref.plugins?.['_plugin/cache'];
  if (cache?.id && !cache.noStore) add(cache.id);
  visitStrings(ref.plugins, s => {
    add(cacheUrlId(s));
    return s;
  });
  for (const m of ref.comment?.matchAll(CACHE_URL_TEXT_REGEX) || []) add(m[1]);
  return [...ids];
}

/**
 * Rewrite all cache IDs referenced by a Ref using the given mapping of old
 * cache ID to new cache ID.
 */
export function rewriteCacheIds(ref: Ref, ids: Map<string, string>): Ref {
  if (!ids.size) return ref;
  const rewriteUrl = (url: string) => {
    const id = cacheUrlId(url);
    return id && ids.has(id) ? 'cache:' + ids.get(id) : url;
  };
  const result: Ref = { ...ref, url: rewriteUrl(ref.url) };
  if (ref.sources) result.sources = ref.sources.map(rewriteUrl);
  if (ref.alternateUrls) result.alternateUrls = ref.alternateUrls.map(rewriteUrl);
  if (ref.comment) {
    result.comment = ref.comment.replace(CACHE_URL_TEXT_REGEX, (match, id) => ids.has(id) ? 'cache:' + ids.get(id) : match);
  }
  if (ref.plugins) {
    result.plugins = visitStrings(ref.plugins, rewriteUrl);
    const cache = result.plugins!['_plugin/cache'];
    if (cache?.id && !cache.noStore && ids.has(cache.id)) {
      result.plugins!['_plugin/cache'] = { ...cache, id: ids.get(cache.id) };
    }
  }
  return result;
}
