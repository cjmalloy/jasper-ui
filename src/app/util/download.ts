import * as FileSaver from 'file-saver';
import JSZip from 'jszip';
import { Ext, writeExt } from '../model/ext';
import { Page } from '../model/page';
import { Plugin, writePlugin } from '../model/plugin';
import { Ref, writeRef } from '../model/ref';
import { Tag } from '../model/tag';
import { writeTemplate } from '../model/template';
import { writeUser } from '../model/user';
import { Type } from '../store/view';
import { getSearchParams } from './http';
import { ProxyService } from '../service/api/proxy.service';
import { firstValueFrom } from 'rxjs';

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

export async function downloadPage(type: Type, page: Page<any>, exts: Ext[], query: string) {
  const zip = new JSZip();
  zip.file(type + '.json', file(page.content!.map(write(type))));
  if (exts.length) zip.file('ext.json', file(exts.map(writeExt)));
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
    FileSaver.saveAs(blob, name);
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
    .then(content => FileSaver.saveAs(content, `${filename}.zip`));
}
