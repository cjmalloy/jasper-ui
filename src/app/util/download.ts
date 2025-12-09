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

export function downloadRef(ref: Ref) {
  FileSaver.saveAs(file(ref), (ref.title || ref.url.replace(/[^\[\]\w.(){}!@#$%^&*-]+/, '_')) + '.json');
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
      // Check if ref has a cache: URL or _plugin/cache plugin
      let cacheId: string | undefined;
      
      if (ref.url?.startsWith('cache:')) {
        // Extract UUID from cache:<uuid>
        cacheId = ref.url.substring(6);
      } else if (ref.plugins?.['_plugin/cache']?.id) {
        // Get cache ID from plugin
        cacheId = ref.plugins['_plugin/cache'].id;
      }
      
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
