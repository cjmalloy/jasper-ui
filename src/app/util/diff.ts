import { diff3Merge, MergeRegion } from 'node-diff3';
import { isArray, isEmpty, isObject } from 'lodash-es';
import { Ref } from '../model/ref';
import { Ext } from '../model/ext';
import { User } from '../model/user';
import { Template } from '../model/template';
import { Plugin } from '../model/plugin';
import { Mod } from '../model/tag';

export function sortEntity(entity: Record<string, any>): Record<string, any> {
  const { modified, created, ...rest } = entity as any;
  return sortObj(rest);
}

export function sortObj(entity: Record<string, any>): Record<string, any> {
  const ordered: any = {};
  for (const key of Object.keys(entity).sort()) {
    const value = entity[key];
    if (isArray(value)) {
      ordered[key] = value.map((item: any) => isObject(item) ? sortObj(item) : item);
    } else if (isObject(value)) {
      ordered[key] = sortObj(value);
    } else {
      ordered[key] = value;
    }
  }
  return ordered;
}

export function formatDiff(obj: Ref | Ext | User | Plugin | Template): string {
  return JSON.stringify(sortEntity(obj), null, 2);
}

export function formatBundleDiff(mod: Mod): string {
  return JSON.stringify({
    ref: isEmpty(mod.ref) ? undefined : mod.ref!.map(sortEntity),
    ext: isEmpty(mod.ext) ? undefined : mod.ext!.map(sortEntity),
    user: isEmpty(mod.user) ? undefined : mod.user!.map(sortEntity),
    plugin: isEmpty(mod.plugin) ? undefined : mod.plugin!.map(sortEntity),
    template: isEmpty(mod.template) ? undefined : mod.template!.map(sortEntity),
  }, (key, value) => key === '_parent' ? undefined : value, 2);
}

export type Merge = { mergedComment?: string, conflict?: MergeRegion<string>[] };

export function merge3(ours: string, base: string, theirs: string, delimiter = '\n'): Merge {
  const result = diff3Merge<string>(ours, base, theirs, { stringSeparator: delimiter });
  const hasConflict = result.some(chunk => chunk.conflict);
  if (hasConflict) return { conflict: result };
  const mergedLines: string[] = [];
  for (const chunk of result) {
    if (chunk.ok) {
      mergedLines.push(...chunk.ok);
    }
  }
  return { mergedComment: mergedLines.join(delimiter) };
}
