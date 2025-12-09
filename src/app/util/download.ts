import * as FileSaver from 'file-saver';
import JSZip from 'jszip';
import { Observable, take } from 'rxjs';
import { Ext, writeExt } from '../model/ext';
import { Page } from '../model/page';
import { Plugin, writePlugin } from '../model/plugin';
import { Ref, writeRef } from '../model/ref';
import { Resource } from '../model/resource';
import { Tag } from '../model/tag';
import { writeTemplate } from '../model/template';
import { writeUser } from '../model/user';
import { Type } from '../store/view';

export function file(obj: any) {
  return new Blob([JSON.stringify(obj, null, 2)], {type: 'text/plain;charset=utf-8'});
}

export function downloadTag(tag: Tag) {
  FileSaver.saveAs(file(tag), (tag.name || tag.tag.replace('/', '_')) + '.json');
}

/**
 * Extracts the cache ID from a Ref if it has a cache file.
 * Checks both cache: URL scheme and _plugin/cache plugin.
 * 
 * @param ref - The Ref to check for cache ID
 * @returns The cache ID (UUID) if found, undefined otherwise
 */
function getCacheId(ref: Ref): string | undefined {
  if (ref.url?.startsWith('cache:')) {
    return ref.url.substring('cache:'.length);
  } else if (ref.plugins?.['_plugin/cache']?.id) {
    return ref.plugins['_plugin/cache'].id;
  }
  return undefined;
}

/**
 * Downloads a Ref as either a JSON file or a ZIP file containing the ref and its cache file.
 * If the ref has a cache file and cacheFetcher is provided, creates a ZIP with both ref.json 
 * and the cache file in a cache/ folder. Otherwise, downloads as plain JSON.
 * 
 * @param ref - The Ref to download
 * @param cacheFetcher - Optional function to fetch cache files from the server
 * @returns Promise that resolves when the download is complete
 */
export async function downloadRef(
  ref: Ref,
  cacheFetcher?: (url: string, origin: string) => Observable<Resource>
): Promise<void> {
  const cacheId = getCacheId(ref);
  
  // If ref has cache and cacheFetcher is provided, create a zip with ref.json and cache file
  if (cacheId && cacheFetcher) {
    const zip = new JSZip();
    zip.file('ref.json', file([writeRef(ref)]));
    
    const cacheUrl = `cache:${cacheId}`;
    const origin = ref.origin || '';
    
    // Fetch the cache file
    await new Promise<void>((resolve) => {
      cacheFetcher(cacheUrl, origin).pipe(take(1)).subscribe({
        next: (resource) => {
          if (resource.data) {
            // Add the cache file to the cache/ folder with just the UUID as filename
            zip.file(`cache/${cacheId}`, resource.data);
          }
          resolve();
        },
        error: (err) => {
          // If fetch fails, just skip the cache file
          console.warn(`Failed to fetch cache file ${cacheId}:`, err);
          resolve();
        }
      });
    });
    
    return zip.generateAsync({ type: 'blob' })
      .then(content => FileSaver.saveAs(content, (ref.title || ref.url.replace(/[^\[\]\w.(){}!@#$%^&*-]+/g, '_')) + '.zip'));
  }
  
  // Otherwise, download as JSON
  return Promise.resolve(FileSaver.saveAs(file(ref), (ref.title || ref.url.replace(/[^\[\]\w.(){}!@#$%^&*-]+/g, '_')) + '.json'));
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
 * Downloads a page of entities as a ZIP file.
 * For 'ref' type pages, includes cache files in a cache/ folder if cacheFetcher is provided.
 * 
 * @param type - The type of entities being downloaded
 * @param page - The page of entities to download
 * @param exts - Associated extensions
 * @param query - Query string used for filename
 * @param cacheFetcher - Optional function to fetch cache files for refs
 * @returns Promise that resolves when the download is complete
 */
export async function downloadPage(
  type: Type,
  page: Page<any>,
  exts: Ext[],
  query: string,
  cacheFetcher?: (url: string, origin: string) => Observable<Resource>
) {
  const zip = new JSZip();
  zip.file(type + '.json', file(page.content!.map(write(type))));
  if (exts.length) zip.file('ext.json', file(exts.map(writeExt)));
  
  // Add cache files if type is 'ref' and cacheFetcher is provided
  if (type === 'ref' && cacheFetcher && page.content) {
    const cachePromises: Promise<void>[] = [];
    
    for (const ref of page.content as Ref[]) {
      const cacheId = getCacheId(ref);
      
      if (cacheId) {
        const cacheUrl = `cache:${cacheId}`;
        const origin = ref.origin || '';
        
        // Create a promise to fetch the cache file
        const promise = new Promise<void>((resolve) => {
          cacheFetcher(cacheUrl, origin).pipe(take(1)).subscribe({
            next: (resource) => {
              if (resource.data) {
                // Add the cache file to the cache/ folder with just the UUID as filename
                zip.file(`cache/${cacheId}`, resource.data);
              }
              resolve();
            },
            error: (err) => {
              // If fetch fails, just skip this cache file
              console.warn(`Failed to fetch cache file ${cacheId}:`, err);
              resolve();
            }
          });
        });
        
        cachePromises.push(promise);
      }
    }
    
    // Wait for all cache files to be fetched
    await Promise.all(cachePromises);
  }
  
  return zip.generateAsync({ type: 'blob' })
    .then(content => FileSaver.saveAs(content, `${query.replace('/', '_')}` + (page.page.totalPages > 1 ? ` (page ${page.page.number + 1} of ${page.page.totalPages})` : '') + '.zip'));
}

export async function downloadSet(ref: Ref[], ext: Ext[], title: string) {
  const zip = new JSZip();
  zip.file('ref.json', file(ref.map(writeRef)));
  zip.file('ext.json', file(ext.map(writeExt)));
  return zip.generateAsync({ type: 'blob' })
    .then(content => FileSaver.saveAs(content, title + '.zip'));
}

export function downloadPluginExport(plugin: Plugin, html: string) {
  const title = plugin.name || plugin.tag.replace('/', '_');
  const zip = new JSZip();
  zip.file(title + '.html', html);
  return zip.generateAsync({ type: 'blob' })
    .then(content => FileSaver.saveAs(content, title + '.zip'));
}
