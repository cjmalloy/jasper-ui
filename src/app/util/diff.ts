import { diff3Merge, MergeRegion } from 'node-diff3';
import { isArray, isEmpty, isEqual, isObject, sortBy } from 'lodash-es';
import { Ref, writeRef } from '../model/ref';
import { Ext, writeExt } from '../model/ext';
import { User, writeUser } from '../model/user';
import { Template, writeTemplate } from '../model/template';
import { Plugin, writePlugin } from '../model/plugin';
import { clear, Config, Mod } from '../model/tag';
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

export function equalBundle(a?: Mod, b?: Mod) {
  if (!a || !b) return false;
  return isEqual(clearMod(a, false), clearMod(b, false));
}

export function clearMod<T extends Mod | undefined>(mod: T, strict = true): T {
  if (!mod) return mod;
  const result = { } as any;
  if (!isEmpty(mod.ref)) result.ref = sortBy(mod.ref!.map((r: Ref) => writeRef(r)), 'url');
  if (!isEmpty(mod.ext)) result.ext = sortBy(mod.ext!.map((e: Ext) => writeExt(e)), 'tag');
  if (!isEmpty(mod.user)) result.user = sortBy(mod.user!.map((u: User) => writeUser(u)), 'tag');
  if (!isEmpty(mod.plugin)) result.plugin = sortBy(mod.plugin!.map((p: Plugin) => clearConfig(writePlugin(p), strict)), 'tag');
  if (!isEmpty(mod.template)) result.template = sortBy(mod.template!.map((t: Template) => clearConfig(writeTemplate(t), strict)), 'tag');
  return result;
}

function clearConfig<T extends Config>(e: T, strict = false): T {
  const result = {
    ...e,
    config: e.config && { ...e.config },
  } as any;
  if (isEmpty(result.defaults)) delete result.defaults;
  if (result.schema === null) delete result.schema;
  if (!strict) {
    delete result.config?.version;
    delete result.config?.generated;
  }
  delete result.origin;
  return clear(result);
}


export function formatBundleDiff(mod: Mod): string {
  mod = clearMod(mod);
  return JSON.stringify({
    ref: isEmpty(mod.ref) ? undefined : sortBy(mod.ref!, 'url').map(sortEntity),
    ext: isEmpty(mod.ext) ? undefined : sortBy(mod.ext!, 'tag').map(sortEntity),
    user: isEmpty(mod.user) ? undefined : sortBy(mod.user!, 'tag').map(sortEntity),
    plugin: isEmpty(mod.plugin) ? undefined : sortBy(mod.plugin!, 'tag').map(sortEntity),
    template: isEmpty(mod.template) ? undefined : sortBy(mod.template!, 'tag').map(sortEntity),
  }, (key, value) => key === '_parent' ? undefined : value, 2);
}

export type Merge = { result?: string, conflict?: MergeRegion<string>[] };

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
  return { result: mergedLines.join(delimiter) };
}
