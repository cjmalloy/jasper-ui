import * as JSZip from 'jszip';
import * as _ from 'lodash-es';

export function getZipOrTextFile(file: File, zipFileName: string): Promise<string | undefined> {
  if (file.name.toLowerCase().endsWith('.zip')) {
    return JSZip.loadAsync(file).catch(() => {
      throw "Could not read ZIP file.";
    }).then(zip => zip.file(zipFileName)?.async('string')?.catch(() => {
      throw "Could not find plugins.json in ZIP file.";
    }));
  } else {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => {
        resolve(fr.result as string)
      };
      fr.onerror = () => reject("Could not read text file.");
      fr.readAsText(file);
    });
  }
}

export function getModels<T>(json?: string): T[] {
  if (!json) return [];
  const plugin = JSON.parse(json);
  if (_.isArray(plugin)) return plugin;
  return [plugin];
}
