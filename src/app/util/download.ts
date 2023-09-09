import * as FileSaver from 'file-saver';
import * as JSZip from 'jszip';
import { Page } from '../model/page';
import { Ref, writeRef } from '../model/ref';
import { Tag } from '../model/tag';
import { Type } from '../store/view';
import { Ext, writeExt } from '../model/ext';

export function file(obj: any) {
  return new Blob([JSON.stringify(obj, null, 2)], {type: 'text/plain;charset=utf-8'});
}

export function downloadTag(tag: Tag) {
  FileSaver.saveAs(file(tag), (tag.name || tag.tag.replace('/', '_')) + '.json');
}

export function downloadRef(ref: Ref) {
  FileSaver.saveAs(file(ref), (ref.title || ref.url.replace(/[^\[\]\w.(){}!@#$%^&*-]+/, '_')) + '.json');
}

export async function downloadPage(type: Type, page: Page<any>, exts: Ext[], query: String) {
  const zip = new JSZip();
  zip.file(type + '.json', file(page.content!.map(writeRef)));
  if (exts.length) zip.file('ext.json', file(exts.map(writeExt)));
  return zip.generateAsync({ type: 'blob' })
    .then(content => FileSaver.saveAs(content, `${query.replace('/', '_')}` + (page.totalPages > 1 ? ` (page ${page.number + 1} of ${page.totalPages})` : '') + '.zip'));
}

export async function downloadSet(ref: Ref[], ext: Ext[], title: String) {
  const zip = new JSZip();
  zip.file('ref.json', file(ref.map(writeRef)));
  zip.file('ext.json', file(ext.map(writeExt)));
  return zip.generateAsync({ type: 'blob' })
    .then(content => FileSaver.saveAs(content, title + '.zip'));
}
