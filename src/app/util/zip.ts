import * as JSZip from 'jszip';
import { isArray } from 'lodash-es';

export function unzip(file: File) {
  return JSZip.loadAsync(file).catch(() => {
    throw 'Could not read ZIP file.';
  });
}

export function zippedFile(zip: JSZip, fileName: string) {
  return zip.file(fileName)?.async('string')?.catch(() => '') ||
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

export function getModels<T>(json?: string): T[] {
  if (!json) return [];
  const models = JSON.parse(json);
  if (isArray(models)) return models;
  return [models];
}
