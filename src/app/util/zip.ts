import * as JSZip from 'jszip';
import { isArray } from 'lodash-es';
import { Ext, mapExt } from '../model/ext';
import { mapRef, Ref } from '../model/ref';
import { Cursor } from '../model/tag';

export function unzip(file: File) {
  return JSZip.loadAsync(file).catch(() => {
    throw 'Could not read ZIP file.';
  });
}

export function zippedFile(zip: JSZip, fileName: string) {
  return zip.file(fileName)?.async('string')?.catch(err => {
    console.error(err);
      return '';
    }) ||
    Promise.resolve(undefined);
}

export function getTextFile(file: File): Promise<string | undefined> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => {
      resolve(fr.result as string)
    };
    fr.onerror = () => reject('Could not read text file.');
    fr.readAsText(file);
  });
}

export function getZipOrTextFile(file: File, zipFileName: string): Promise<string | undefined> {
  if (file.name.toLowerCase().endsWith('.zip')) {
    return unzip(file).then(zip => zippedFile(zip, zipFileName));
  } else {
    return getTextFile(file);
  }
}

export type FilteredModels = {ref: Ref[], ext: Ext[]};
export function filterModels<T extends Cursor>(models: T[]): FilteredModels {
  return {
    ref: models.filter(m => 'url' in m).map(mapRef),
    ext: models.filter(m => 'tag' in m).map(mapExt),
  };
}

export function getModels<T extends Cursor>(json?: string): T[] {
  if (!json) return [];
  const models = JSON.parse(json);
  return (isArray(models) ? models : [models]).map(m => {
    m.upload = true;
    delete m.created;
    return m;
  });
}

export function parseModels(file: File): Promise<FilteredModels> {
  if (file.name.toLowerCase().endsWith('.zip')) {
    return unzip(file).then(zip => Promise.all([
      zippedFile(zip, 'ext.json')
        .then(json => getModels<Ext>(json))
        .then(exts => exts.map(mapExt)),
      zippedFile(zip, 'ref.json')
        .then(json => getModels<Ref>(json))
        .then(refs => refs.map(mapRef)),
    ]))
      .then(([ext, ref]) => ({ ext, ref }));
  } else {
    return getTextFile(file)
      .then(getModels)
      .then(filterModels);
  }
}
