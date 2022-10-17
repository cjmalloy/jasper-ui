import * as JSZip from 'jszip';
import * as _ from 'lodash-es';

export function getZipFile(file: File, zipFileName: string): Promise<string | undefined> {
  return JSZip.loadAsync(file).catch(() => {
    throw "Could not read ZIP file.";
  }).then(zip => {
    return zip.file(zipFileName)?.async('string')?.catch(() => {
      throw `Could not find ${zipFileName} in ZIP file.`;
    });
  });
}

export function getTextFile(file: File): Promise<string | undefined> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => {
      resolve(fr.result as string)
    };
    fr.onerror = () => reject("Could not read text file.");
    fr.readAsText(file);
  });
}

export function getZipOrTextFile(file: File, zipFileName: string): Promise<string | undefined> {
  if (file.name.toLowerCase().endsWith('.zip')) {
    return getZipFile(file, zipFileName);
  } else {
    return getTextFile(file);
  }
}

export function getModels<T>(json?: string): T[] {
  if (!json) return [];
  const models = JSON.parse(json);
  if (_.isArray(models)) return models;
  return [models];
}
