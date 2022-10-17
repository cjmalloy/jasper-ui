import * as FileSaver from 'file-saver';
import * as JSZip from 'jszip';
import { Page } from '../model/page';
import { Tag } from '../model/tag';

export function download(tag: Tag) {
  const blob = new Blob([JSON.stringify(tag, null, 2)], {type: 'text/plain;charset=utf-8'});
  FileSaver.saveAs(blob, (tag.name || tag.tag.replace('/', '_')) + '.json');
}

export function downloadPage(type: 'ref' | 'ext' | 'user' | 'plugin' | 'template', page: Page<any>, query: String) {
  const blob = new Blob([JSON.stringify(page.content, null, 2)], {type: 'text/plain;charset=utf-8'});
  const zip = new JSZip();
  zip.file(type + '.json', blob);
  zip.generateAsync({ type: 'blob' })
    .then(content => FileSaver.saveAs(content, `${query.replace('/', '_')} (page ${page.number + 1} of ${page.totalPages}).zip`));
}
