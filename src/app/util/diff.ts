import { diff3Merge, MergeRegion } from 'node-diff3';
import { isObject } from 'lodash-es';

/**
 * Format ref for diff display:
 * - Exclude modified and created fields
 * - Fixed order for top-level fields
 * - Alphabetically sorted plugin keys
 */
export function formatDiff(obj: Record<string, any>): string {
  const { modified, created, ...rest } = obj as any;
  const ordered: any = {};
  const fieldOrder = ['tag', 'config', 'defaults', 'schema', 'url', 'origin', 'title', 'comment', 'tags', 'sources', 'alternateUrls', 'published', 'plugins'];
  for (const field of fieldOrder) {
    if (rest[field] !== undefined) {
      if (isObject(field) && rest[field]) {
        const sorted: any = {};
        Object.keys(rest[field]).sort().forEach(key => {
          sorted[key] = rest[field][key];
        });
        ordered[field] = sorted;
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
