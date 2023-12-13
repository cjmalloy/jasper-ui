import * as FileSaver from 'file-saver';
import * as JSZip from 'jszip';
import { Ext, writeExt } from '../model/ext';
import { Page } from '../model/page';
import { writePlugin } from '../model/plugin';
import { Ref, writeRef } from '../model/ref';
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

export async function downloadPage(type: Type, page: Page<any>, exts: Ext[], query: String) {
  const zip = new JSZip();
  zip.file(type + '.json', file(page.content!.map(write(type))));
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
