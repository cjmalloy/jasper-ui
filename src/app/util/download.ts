import * as FileSaver from 'file-saver';
import * as JSZip from 'jszip';
import { Page } from '../model/page';
import { Ref } from '../model/ref';
import { Tag } from '../model/tag';
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

export function downloadPage(type: Type, page: Page<any>, query: String) {
  const zip = new JSZip();
  zip.file(type + '.json', file(page.content));
  zip.generateAsync({ type: 'blob' })
    .then(content => FileSaver.saveAs(content, `${query.replace('/', '_')}` + (page.totalPages > 1 ? ` (page ${page.number + 1} of ${page.totalPages})` : '') + '.zip'));
}
