import { diff3Merge, MergeRegion } from 'node-diff3';
import { isArray, isEmpty, isObject, sortBy } from 'lodash-es';
import { Ref } from '../model/ref';
import { Ext } from '../model/ext';
import { User } from '../model/user';
import { Template } from '../model/template';
import { Plugin } from '../model/plugin';
import { Mod } from '../model/tag';
import { DateTime } from 'luxon';

export function sortEntity(entity: Record<string, any>): Record<string, any> {
  const { origin, modified, metadata, created, modifiedString, ...rest } = entity as any;
  const ordered: any = {};
  const fieldOrder = ['url', 'tag', 'name', 'config', 'defaults', 'schema', 'title', 'comment', 'tags', 'sources', 'alternateUrls', 'published', 'plugins'];
  for (const field of fieldOrder) {
    if (rest[field] !== undefined) {
      if (isObject(rest[field]) && !isArray(rest[field]) && !DateTime.isDateTime(rest[field])) {
        ordered[field] = sortObj(rest[field]);
      } else {
        ordered[field] = rest[field];
      }
    }
  }
  const remainingKeys = Object.keys(rest)
    .filter((key) => !fieldOrder.includes(key))
    .sort();
  for (const key of remainingKeys) {
    ordered[key] = rest[key];
  }
  return ordered;
}

export function sortObj(entity: Record<string, any>): Record<string, any> {
  const ordered: any = {};
  const fieldOrder = ['version', 'mod'];
  for (const field of fieldOrder) {
    if (entity[field] !== undefined) {
      if (isArray(entity[field])) {
        ordered[field] = sortBy(entity[field], 'tag');
      } else if (isObject(entity[field]) && !DateTime.isDateTime(entity[field])) {
        ordered[field] = sortObj(entity[field]);
      } else {
        ordered[field] = entity[field];
      }
    }
  }
  const remainingKeys = Object.keys(entity)
    .filter((key) => !fieldOrder.includes(key))
    .sort();
  for (const key of remainingKeys) {
    ordered[key] = entity[key];
  }
  return ordered;
}

export function formatDiff(obj: Ref | Ext | User | Plugin | Template): string {
  return JSON.stringify(sortEntity(obj), null, 2);
}

export function formatBundleDiff(mod: Mod): string {
  return JSON.stringify({
    ref: isEmpty(mod.ref) ? undefined : sortBy(mod.ref!, 'url').map(sortEntity),
    ext: isEmpty(mod.ext) ? undefined : sortBy(mod.ext!, 'tag').map(sortEntity),
    user: isEmpty(mod.user) ? undefined : sortBy(mod.user!, 'tag').map(sortEntity),
    plugin: isEmpty(mod.plugin) ? undefined : sortBy(mod.plugin!, 'tag').map(sortEntity),
    template: isEmpty(mod.template) ? undefined : sortBy(mod.template!, 'tag').map(sortEntity),
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
