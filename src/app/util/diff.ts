import { cloneDeep, get, isArray, isEmpty, isEqual, isObject, isPlainObject, isString, set, sortBy, toPath, uniq, unset } from 'lodash-es';
import { DateTime } from 'luxon';
import { diff3Merge, MergeRegion } from 'node-diff3';
import { Ext } from '../model/ext';
import { Plugin, writePlugin } from '../model/plugin';
import { Ref } from '../model/ref';
import { clear, Config, Mod } from '../model/tag';
import { Template, writeTemplate } from '../model/template';
import { User } from '../model/user';

export function sortEntity(entity: Record<string, any>): Record<string, any> {
  const { origin, modified, metadata, created, modifiedString, ...rest } = entity as any;
  const ordered: any = {};
  const fieldOrder = ['url', 'tag', 'name', 'config', 'defaults', 'schema', 'title', 'comment', 'tags', 'sources', 'alternateUrls', 'published', 'plugins'];
  for (const field of fieldOrder) {
    if (rest[field] !== undefined) {
      ordered[field] = sortValue(rest[field]);
    }
  }
  const remainingKeys = Object.keys(rest)
    .filter((key) => !fieldOrder.includes(key))
    .sort();
  for (const key of remainingKeys) {
    ordered[key] = sortValue(rest[key]);
  }
  return ordered;
}

export function sortObj(entity: Record<string, any>): Record<string, any> {
  const ordered: any = {};
  const fieldOrder = ['version', 'mod'];
  for (const field of fieldOrder) {
    if (entity[field] !== undefined) {
      ordered[field] = sortValue(entity[field]);
    }
  }
  const remainingKeys = Object.keys(entity)
    .filter((key) => !fieldOrder.includes(key))
    .sort();
  for (const key of remainingKeys) {
    ordered[key] = sortValue(entity[key]);
  }
  return ordered;
}

function sortValue(value: any): any {
  if (isArray(value)) return value.map(sortValue);
  if (isObject(value) && !DateTime.isDateTime(value)) return sortObj(value);
  return value;
}

export function formatDiff(obj: Ref | Ext | User | Plugin | Template): string {
  return JSON.stringify(sortEntity(obj), null, 2);
}

export function equalBundle(a?: Mod, b?: Mod) {
  if (!a || !b) return false;
  return formatBundleDiff(a, false) === formatBundleDiff(b, false);
}

export function clearMod<T extends Mod | undefined>(mod: T, strict = true): T {
  if (!mod) return mod;
  const result = { } as any;
  if (!isEmpty(mod.plugin)) result.plugin = sortBy(mod.plugin!.map((p: Plugin) => clearConfig(writePlugin(copyConfig(p)), strict)), 'tag');
  if (!isEmpty(mod.template)) result.template = sortBy(mod.template!.map((t: Template) => clearConfig(writeTemplate(copyConfig(t)), strict)), 'tag');
  return result;
}

function copyConfig<T extends { config?: any }>(e: T): T {
  return {
    ...e,
    config: e.config && { ...e.config },
  };
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
  return clearInternalFields(clear(result));
}

function clearInternalFields<T>(value: T): T {
  if (isArray(value)) return value.map(clearInternalFields) as T;
  if (!isObject(value) || DateTime.isDateTime(value)) return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !key.startsWith('_'))
      .map(([key, nested]) => [key, clearInternalFields(nested)])
  ) as T;
}


export function formatBundleDiff(mod: Mod, strict = true): string {
  mod = clearMod(mod, strict);
  return JSON.stringify({
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

export type BundleMerge = { result?: Mod, conflict?: boolean };

const CONFLICT = Symbol('conflict');

/**
 * Three-way merge of the Plugins and Templates in mod bundles.
 * Refs, Exts and Users are only installed once and never merged.
 * Entities are matched by key and merged field by field, so independent
 * changes to different fields never conflict.
 * String config fields listed in a Plugin or Template config.subDiff are
 * merged line-by-line, so independent changes to different lines
 * of the same script do not conflict.
 */
export function mergeBundle(ours: Mod, base: Mod, theirs: Mod): BundleMerge {
  ours = normalizeBundle(ours);
  base = normalizeBundle(base);
  theirs = normalizeBundle(theirs);
  const result: Mod = {};
  for (const type of ['plugin', 'template'] as const) {
    const find = (m: Mod, tag: string) => (m[type] as Config[] | undefined)?.find(e => e.tag === tag);
    const tags = uniq([...ours[type] || [], ...base[type] || [], ...theirs[type] || []].map(e => e.tag));
    const merged: any[] = [];
    for (const tag of tags) {
      const o = find(ours, tag);
      const b = find(base, tag);
      const t = find(theirs, tag);
      const subDiff = uniq([o, b, t].flatMap(e => isArray(e?.config?.subDiff) ? e.config.subDiff : [])
        .filter(p => isString(p) && p))
        .map(p => ['config', ...toPath(p)]);
      const value = mergeValue(o, b, t, subDiff);
      if (value === CONFLICT) return { conflict: true };
      if (value !== undefined) merged.push(value);
    }
    if (merged.length) result[type] = sortBy(merged, 'tag') as any;
  }
  return { result };
}

function normalizeBundle(mod: Mod): Mod {
  return JSON.parse(formatBundleDiff(mod));
}

function mergeValue(o: any, b: any, t: any, lines: string[][], path: string[] = []): any {
  if (isEqual(o, t)) return cloneDeep(o);
  if (isEqual(o, b)) return cloneDeep(t);
  if (isEqual(t, b)) return cloneDeep(o);
  if (lines.some(l => isEqual(l, path)) && [o, b, t].every(v => v === undefined || isString(v))) {
    const merged = merge3(o ?? '', b ?? '', t ?? '');
    return merged.conflict || merged.result === undefined ? CONFLICT : merged.result;
  }
  if (isPlainObject(o) && isPlainObject(t) && (b === undefined || isPlainObject(b))) {
    const result: any = {};
    for (const k of uniq([...Object.keys(o), ...Object.keys(t), ...Object.keys(b || {})])) {
      const value = mergeValue(o[k], b?.[k], t[k], lines, [...path, k]);
      if (value === CONFLICT) return CONFLICT;
      if (value !== undefined) result[k] = value;
    }
    return result;
  }
  if (isArray(o) && isArray(t) && (b === undefined || isArray(b))) {
    return mergeArray(o, b, t, lines, path);
  }
  return CONFLICT;
}

/**
 * Arrays are merged as text. Declared subDiff strings inside array elements
 * are merged line-by-line first and swapped for placeholders, so the array
 * merge only sees structural changes.
 * An index is only trusted when the element can be matched across versions:
 * every element up to it is unchanged apart from subDiff strings, and it is
 * unique in each version. Otherwise the subDiff string is merged as text.
 */
function mergeArray(o: any[], b: any[] | undefined, t: any[], lines: string[][], path: string[]): any {
  [o, b, t] = [cloneDeep(o), cloneDeep(b), cloneDeep(t)];
  const subs: { rel: string[], placeholder: string, value?: string }[] = [];
  if (b) {
    let rels: string[][] = [];
    for (const line of lines) {
      if (line.length <= path.length || !isEqual(line.slice(0, path.length), path)) continue;
      const rel = line.slice(path.length);
      if (!/^\d+$/.test(rel[0])) continue;
      const parents = [o, b, t].map(v => rel.length === 1 ? v : get(v, rel.slice(0, -1)));
      const values = [o, b, t].map(v => get(v, rel));
      if (parents.every(p => isPlainObject(p))) {
        if (!values.every(v => v === undefined || isString(v))) continue;
      } else if (parents.every(p => isArray(p))) {
        if (!values.every(v => isString(v))) continue;
      } else {
        continue;
      }
      rels.push(rel);
    }
    while (rels.length) {
      const [mo, mb, mt] = [o, b, t].map(v => maskArray(v!, rels));
      const kept = rels.filter(rel => matchedIndex(mo, mb, mt, Number(rel[0])));
      if (kept.length === rels.length) break;
      rels = kept;
    }
    for (const rel of rels) {
      const values = [o, b, t].map(v => get(v, rel));
      const value = mergeValue(values[0], values[1], values[2], lines, [...path, ...rel]);
      if (value === CONFLICT) return CONFLICT;
      const placeholder = `\u0000subDiff:${rel.join('.')}`;
      for (const v of [o, b, t]) set(v!, rel, placeholder);
      subs.push({ rel, placeholder, value });
    }
  }
  const json = (v: any) => v === undefined ? '' : JSON.stringify(v, null, 2);
  const merged = merge3(json(o), json(b), json(t));
  if (merged.conflict || merged.result === undefined) return CONFLICT;
  let result: any[];
  try {
    result = JSON.parse(merged.result);
  } catch {
    return CONFLICT;
  }
  for (const s of subs) {
    if (get(result, s.rel) !== s.placeholder) continue;
    if (s.value === undefined) {
      unset(result, s.rel);
    } else {
      set(result, s.rel, s.value);
    }
  }
  return result;
}

function maskArray(v: any[], rels: string[][]): any[] {
  const result = cloneDeep(v);
  for (const rel of rels) set(result, rel, '\u0000subDiff');
  return result;
}

function matchedIndex(o: any[], b: any[], t: any[], i: number): boolean {
  const unique = (v: any[]) => v.filter(e => isEqual(e, v[i])).length === 1;
  if (!unique(b)) return false;
  return [o, t].every(v => i < v.length && unique(v) && isEqual(v.slice(0, i + 1), b.slice(0, i + 1)));
}
