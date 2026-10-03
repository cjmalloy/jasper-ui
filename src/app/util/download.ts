import * as FileSaver from 'file-saver';
import JSZip from 'jszip';
import { firstValueFrom } from 'rxjs';
import { Ext, writeExt } from '../model/ext';
import { Page } from '../model/page';
import { Plugin, writePlugin } from '../model/plugin';
import { Ref, writeRef } from '../model/ref';
import { Tag } from '../model/tag';
import { writeTemplate } from '../model/template';
import { writeUser } from '../model/user';
import { ProxyService } from '../service/api/proxy.service';
import { config } from '../service/config.service';
import { Type } from '../store/view';
import { CACHE_FOLDER, cacheUrlId, refCacheIds } from './cache';
import { getEmbeds } from './editor';
import { getSearchParams } from './http';

export async function saveAs(file: Blob, defaultFilename: string) {
  if (config().electron) {
    // @ts-ignore
    window.electronAPI.saveAs(await file.arrayBuffer(), defaultFilename);
  } else {
    FileSaver.saveAs(file, defaultFilename);
  }
}

export function file(obj: any) {
  return new Blob([JSON.stringify(obj, null, 2)], {type: 'text/plain;charset=utf-8'});
}

export function downloadTag(tag: Tag) {
  saveAs(file(tag), (tag.name || tag.tag.replace('/', '_')) + '.json');
}

export function downloadRef(ref: Ref) {
  saveAs(file(ref), (ref.title || ref.url.replace(/[^\[\]\w.(){}!@#$%^&*-]+/, '_')) + '.json');
}

function write(type: Type): any {
  switch (type) {
    case 'ref': return writeRef;
    case 'ext': return writeExt;
    case 'user': return writeUser;
    case 'plugin': return writePlugin;
    case 'template': return writeTemplate;
  }
}

/**
 * Map over items with at most limit promises running at once.
 */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const result: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      result[i] = await fn(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return result;
}

const FETCH_LIMIT = 6;

/**
 * Add all cache files referenced by the Refs to the cache folder of the zip.
 * This is compatible with the backup format, which has a single cache/<id>
 * namespace. Cache files are identified by origin and ID, so if the same ID
 * is referenced from multiple origins only the first is bundled.
 */
export async function zipCache(zip: JSZip, refs: Ref[], fetchCache: (id: string, origin: string) => Promise<Blob | undefined>) {
  const ids = new Map<string, string>();
  const skipped = new Set<string>();
  for (const ref of refs) {
    const origin = ref.origin || '';
    for (const id of refCacheIds(ref)) {
      if (!ids.has(id)) {
        ids.set(id, origin);
      } else if (ids.get(id) !== origin && !skipped.has(origin + ' ' + id)) {
        skipped.add(origin + ' ' + id);
        console.warn(`Skipping cache file ${id} from origin ${origin || 'default'}, already bundled from origin ${ids.get(id) || 'default'}`);
      }
    }
  }
  await mapLimit([...ids.entries()], FETCH_LIMIT, async ([id, origin]) => {
    try {
      const blob = await fetchCache(id, origin);
      if (blob) zip.file(CACHE_FOLDER + id, blob);
    } catch (error) {
      console.error(`Skipping cache file in zip due to error fetching: ${id}`, error);
    }
  });
}

export interface EmbedOptions {
  fetchRef: (url: string) => Promise<Ref | undefined>;
  wikiPrefix?: string;
  wikiExternal?: boolean;
}

/**
 * Fetch the Refs embedded in the comments of the given Refs that reference
 * cache files. Only one level of embeds is followed, embeds of the embedded
 * Refs are not.
 */
export async function embeddedCacheRefs(refs: Ref[], { fetchRef, wikiPrefix, wikiExternal }: EmbedOptions) {
  const key = (ref: Ref) => ref.url + ' ' + (ref.origin || '');
  const seen = new Set(refs.map(key));
  const urls = new Set(refs.flatMap(ref => getEmbeds(ref.comment || '', wikiPrefix, wikiExternal)).filter(url => !cacheUrlId(url)));
  const fetched = await mapLimit([...urls], FETCH_LIMIT, url => fetchRef(url).catch(error => {
    console.error(`Skipping embed in zip due to error fetching: ${url}`, error);
    return undefined;
  }));
  const result: Ref[] = [];
  for (const ref of fetched) {
    if (!ref || seen.has(key(ref)) || !refCacheIds(ref).length) continue;
    seen.add(key(ref));
    result.push(ref);
  }
  return result;
}

export async function downloadPage(type: Type, page: Page<any>, exts: Ext[], query: string, proxy?: ProxyService, embeds?: EmbedOptions) {
  const zip = new JSZip();
  let content = page.content!;
  if (type === 'ref' && proxy && embeds) {
    content = [...content, ...await embeddedCacheRefs(content, embeds)];
  }
  zip.file(type + '.json', file(content.map(write(type))));
  if (exts.length) zip.file('ext.json', file(exts.map(writeExt)));
  if (type === 'ref' && proxy) {
    await zipCache(zip, content, async (id, origin) => (await firstValueFrom(proxy.download('cache:' + id, origin, id))).blob);
  }
  return zip.generateAsync({ type: 'blob' })
    .then(content => saveAs(content, `${query.replace('/', '_')}` + (page.page.totalPages > 1 ? ` (page ${page.page.number + 1} of ${page.page.totalPages})` : '') + '.zip'));
}

export async function downloadSet(ref: Ref[], ext: Ext[], title: string, cache?: Map<string, JSZip.JSZipObject>) {
  const zip = new JSZip();
  zip.file('ref.json', file(ref.map(writeRef)));
  zip.file('ext.json', file(ext.map(writeExt)));
  if (cache?.size) {
    // Bundled cache files are already in a single namespace
    await zipCache(zip, ref.map(r => ({ ...r, origin: '' })), async id => cache.get(id)?.async('blob'));
  }
  return zip.generateAsync({ type: 'blob' })
    .then(content => saveAs(content, title + '.zip'));
}

export function downloadPluginExport(plugin: Plugin, html: string) {
  const title = plugin.name || plugin.tag.replace('/', '_');
  const zip = new JSZip();
  zip.file(title + '.html', html);
  return zip.generateAsync({ type: 'blob' })
    .then(content => saveAs(content, title + '.zip'));
}

async function fetchUrlAsset(proxy: ProxyService, url: string): Promise<{ blob: Blob, name: string }> {
  if (proxy.isProxied(url)) {
    const cleanUrl = url.split('?')[0].split('#')[0];
    const filename = decodeURIComponent(cleanUrl.substring(cleanUrl.lastIndexOf('/') + 1));
    const proxiedUrl = getSearchParams(url).get('url')!;
    const proxiedOrigin = getSearchParams(url).get('origin') || '';
    return firstValueFrom(proxy.download(proxiedUrl, proxiedOrigin, filename));
  }
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch remote asset: ${response.statusText}`);
  const blob = await response.blob();
  const cleanUrl = url.split('?')[0].split('#')[0];
  let name = decodeURIComponent(cleanUrl.substring(cleanUrl.lastIndexOf('/') + 1));
  if (!name) name = 'file';
  const disposition = response.headers.get('Content-Disposition') || response.headers.get('content-disposition');
  if (disposition) {
    const filenameStarRegex = /filename\*=\s*([^\s;]+)/i;
    const filenameRegex = /filename=\s*((['"]).*?\2|[^;\n]*)/i;
    const starMatch = filenameStarRegex.exec(disposition);
    const standardMatch = filenameRegex.exec(disposition);
    if (starMatch?.[1]) {
      const rawValue = starMatch[1];
      const cleanValue = rawValue.replace(/^utf-8''/i, '');
      name = decodeURIComponent(cleanValue);
    } else if (standardMatch?.[1]) {
      name = standardMatch[1].replace(/['"]/g, '');
    }
  }
  return { blob, name };
}

export async function downloadUrl(proxy: ProxyService, url: string) {
  try {
    const { blob, name } = await fetchUrlAsset(proxy, url);
    await saveAs(blob, name);
  } catch (error) {
    console.error(`Error downloading asset from URL: ${url}`, error);
  }
}

export async function downloadPlaylist(proxy: ProxyService, urls: string[], filename: string) {
  const files = new Set<string>();
  const zip = new JSZip();
  const downloadPromises = urls.map(async (url: string) => {
    try {
      const { blob, name } = await fetchUrlAsset(proxy, url);
      let num = 0;
      let filename = name;
      let ext = name.includes('.') ? name.substring(name.lastIndexOf('.')) : '';
      while (files.has(filename)) {
        num++;
        filename = ext ? `${name.substring(0, name.lastIndexOf('.'))} (${num})${ext}` : `${name} (${num})`;
      }
      zip.file(filename, blob);
      files.add(filename);
    } catch (error) {
      console.error(`Skipping file in bulk zip due to error fetching: ${url}`, error);
    }
  });
  await Promise.all(downloadPromises);
  return zip.generateAsync({ type: 'blob' })
    .then(content => saveAs(content, `${filename}.zip`));
}
