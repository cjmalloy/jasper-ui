import { Ref, writeRef } from '../model/ref';
import { diff3Merge, MergeRegion } from 'node-diff3';

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

export type Merge = { mergedComment?: string, conflict?: MergeRegion<string>[] };

export function merge3(ours: string, base: string, theirs: string, delimiter: string = '\n'): Merge {
  const result = diff3Merge<string>(ours, base, theirs, { stringSeparator: delimiter});
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
