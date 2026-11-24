import JSZip from 'jszip';
import { isArray } from 'lodash-es';
import { v4 as uuid } from 'uuid';
import { Ext, mapExt } from '../model/ext';
import { mapRef, Ref } from '../model/ref';
import { Cursor } from '../model/tag';
import { CACHE_FOLDER, isCacheId } from './cache';

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

export function zippedCacheFiles(zip: JSZip) {
  const result = new Map<string, JSZip.JSZipObject>();
  zip.forEach((path, file) => {
    if (file.dir || !path.startsWith(CACHE_FOLDER)) return;
    const id = path.substring(CACHE_FOLDER.length);
    if (isCacheId(id)) result.set(id, file);
  });
  return result;
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

export const notModelsError = () => $localize`JSON is not a Ref, an Ext or a { ref, ext } bundle.`;

export function getModels<T extends Cursor>(json?: string): T[] {
  if (!json) return [];
  const models = toModels(JSON.parse(json));
  if (!models) throw notModelsError();
  return models.map(m => {
    m.upload = true;
    delete m.created;
    if (!('tag' in m) && !m.url) m.url = 'comment:' + uuid();
    return m;
  });
}

export function isModelsJson(text?: string) {
  const json = parseJson(text);
  return json !== undefined && !!toModels(json)?.length;
}

export function isJsonObject(text?: string) {
  const json = parseJson(text);
  return !!json && typeof json === 'object';
}

function parseJson(text?: string) {
  if (!text?.trim()) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function toModels(json: any): any[] | undefined {
  if (isBundle(json)) return [...json.ext ?? [], ...json.ref ?? []];
  const models = isArray(json) ? json : [json];
  return models.every(isModel) ? models : undefined;
}

function isBundle(m: any) {
  if (!m || typeof m !== 'object' || isArray(m)) return false;
  if ('tag' in m || m.url || typeof m.comment === 'string') return false;
  return (isArray(m.ref) || isArray(m.ext))
    && Object.keys(m).every(k => (k === 'ref' || k === 'ext') && isArray(m[k]))
    && (m.ref ?? []).every(isModel)
    && (m.ext ?? []).every(isModel);
}

function isModel(m: any) {
  if (!m || typeof m !== 'object' || isArray(m)) return false;
  if ('tag' in m) return typeof m.tag === 'string';
  if (m.url) return typeof m.url === 'string';
  return typeof m.comment === 'string' && !!m.comment.trim();
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
