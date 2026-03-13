import { diff3Merge, MergeRegion } from 'node-diff3';
import { Plugin, writePlugin } from '../model/plugin';
import { Ref, writeRef } from '../model/ref';
import { Mod, clear } from '../model/tag';
import { Template, writeTemplate } from '../model/template';

/**
 * Format ref for diff display:
 * - Exclude modified and created fields
 * - Fixed order for top-level fields
 * - Alphabetically sorted plugin keys
 */
export function formatRefForDiff(ref: Ref): string {
  const written = writeRef(ref);
  const { modified, created, ...rest } = written as any;
  const ordered: any = {};
  const fieldOrder = ['url', 'origin', 'title', 'comment', 'tags', 'sources', 'alternateUrls', 'published', 'plugins'];
  for (const field of fieldOrder) {
    if (rest[field] !== undefined) {
      if (field === 'plugins' && rest.plugins) {
        const sortedPlugins: any = {};
        Object.keys(rest.plugins).sort().forEach(key => {
          sortedPlugins[key] = rest.plugins[key];
        });
        ordered.plugins = sortedPlugins;
      } else {
        ordered[field] = rest[field];
      }
    }
  }
  for (const key in rest) {
    if (!fieldOrder.includes(key)) {
      ordered[key] = rest[key];
    }
  }
  return JSON.stringify(ordered, null, 2);
}

function sortJson(value: any): any {
  if (Array.isArray(value)) return value.map(sortJson);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((result, key) => {
    result[key] = sortJson(value[key]);
    return result;
  }, {} as any);
}

function stripInternalFields<T extends Plugin | Template>(entity: T): T {
  return clear(JSON.parse(JSON.stringify(entity)));
}

function formatModForDiff(mod: Mod): string {
  return JSON.stringify(sortJson({
    ref: mod.ref || [],
    ext: mod.ext || [],
    user: mod.user || [],
    plugin: (mod.plugin || [])
      .map(plugin => stripInternalFields(writePlugin({ ...plugin, origin: '' } as Plugin)))
      .sort((a, b) => a.tag.localeCompare(b.tag)),
    template: (mod.template || [])
      .map(template => stripInternalFields(writeTemplate({ ...template, origin: '' } as Template)))
      .sort((a, b) => a.tag.localeCompare(b.tag)),
  }), null, 2);
}

export function formatValueForDiff(value: unknown): string {
  if (value && typeof value === 'object' && 'url' in (value as any)) {
    return formatRefForDiff(value as Ref);
  }
  if (value && typeof value === 'object' &&
    ('ref' in (value as any) || 'ext' in (value as any) || 'user' in (value as any) ||
      'plugin' in (value as any) || 'template' in (value as any))) {
    return formatModForDiff(value as Mod);
  }
  return JSON.stringify(sortJson(value), null, 2);
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
