import * as FileSaver from 'file-saver';
import * as JSZip from 'jszip';
import { Page } from '../model/page';
import { Tag } from '../model/tag';

export function file(obj: any) {
  return new Blob([JSON.stringify(obj, null, 2)], {type: 'text/plain;charset=utf-8'});
}

export function download(tag: Tag) {
  FileSaver.saveAs(file(tag), (tag.name || tag.tag.replace('/', '_')) + '.json');
}

export function downloadPage(type: 'ref' | 'ext' | 'user' | 'plugin' | 'template', page: Page<any>, query: String) {
  const zip = new JSZip();
  zip.file(type + '.json', file(page.content));
  zip.generateAsync({ type: 'blob' })
    .then(content => FileSaver.saveAs(content, `${query.replace('/', '_')} (page ${page.number + 1} of ${page.totalPages}).zip`));
}
