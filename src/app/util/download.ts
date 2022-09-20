import * as FileSaver from 'file-saver';
import { Tag } from '../model/tag';

export function download(tag: Tag) {
  const blob = new Blob([JSON.stringify(tag, null, 2)], {type: 'text/plain;charset=utf-8'});
  FileSaver.saveAs(blob, (tag.name || tag.tag.replace('/', '_')) + '.json');
}
