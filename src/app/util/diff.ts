import { Ref, writeRef } from '../model/ref';
import { diff3Merge } from 'node-diff3';

/**
 * Format ref for diff display:
 * - Exclude modified and created fields
 * - Fixed order for top-level fields
 * - Alphabetically sorted plugin keys
 */
export function formatRefForDiff(ref: Ref): string {
  const written = writeRef(ref);
  const { modified, created, ...rest } = written as any;

  // Define fixed order for top-level fields
  const ordered: any = {};
  const fieldOrder = ['url', 'origin', 'title', 'comment', 'tags', 'sources', 'alternateUrls', 'published', 'plugins'];

  // Add fields in fixed order
  for (const field of fieldOrder) {
    if (rest[field] !== undefined) {
      if (field === 'plugins' && rest.plugins) {
        // Sort plugin keys alphabetically
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

  // Add any remaining fields not in the fixed order
  for (const key in rest) {
    if (!fieldOrder.includes(key)) {
      ordered[key] = rest[key];
    }
  }

  return JSON.stringify(ordered, null, 2);
}

/**
 * Attempt a simple 3-way merge for comment strings using diff3 algorithm.
 * Returns an object with the merged comment (or null if conflict) and the diff3 result for conflict formatting.
 * 
 * @param base - The original comment (common ancestor)
 * @param theirs - The remote version
 * @param ours - Our attempted update
 * @returns Object with mergedComment (string | null) and diff3Result for formatting conflicts
 */
export function tryMergeRefComment(base: string, theirs: string, ours: string): { mergedComment: string | null, diff3Result: any } {
  const baseComment = base || '';
  const theirComment = theirs || '';
  const ourComment = ours || '';

  // If their comment is the same as base, use ours
  if (theirComment === baseComment) {
    return { mergedComment: ourComment, diff3Result: null };
  }

  // If our comment is the same as base, use theirs
  if (ourComment === baseComment) {
    return { mergedComment: theirComment, diff3Result: null };
  }

  // If both made the same change, accept it
  if (theirComment === ourComment) {
    return { mergedComment: ourComment, diff3Result: null };
  }

  // Use diff3 for line-based 3-way merge
  const baseLines = baseComment.split('\n');
  const theirLines = theirComment.split('\n');
  const ourLines = ourComment.split('\n');

  const result = diff3Merge(ourLines, baseLines, theirLines);
  
  // Check if there are any conflicts
  const hasConflict = result.some(chunk => chunk.conflict);
  
  if (hasConflict) {
    return { mergedComment: null, diff3Result: result };
  }
  
  // Merge successful - combine all ok chunks
  const mergedLines: string[] = [];
  for (const chunk of result) {
    if (chunk.ok) {
      mergedLines.push(...chunk.ok);
    }
  }
  
  return { mergedComment: mergedLines.join('\n'), diff3Result: null };
}

/**
 * Format a merge conflict using the diff3 result.
 * 
 * @param diff3Result - The result from diff3Merge containing conflict information
 * @returns A formatted string showing the conflict
 */
export function formatMergeConflict(diff3Result: any): string {
  if (!diff3Result || !Array.isArray(diff3Result)) {
    return 'Merge conflict: Unable to format conflict';
  }

  const lines: string[] = ['Merge conflict:\n'];
  
  for (const chunk of diff3Result) {
    if (chunk.conflict) {
      // Format conflict chunk with diff3 markers
      const conflict = chunk.conflict;
      lines.push('<<<<<<< OURS (local)');
      if (conflict.a && conflict.a.length > 0) {
        lines.push(...conflict.a);
      }
      lines.push('||||||| BASE');
      if (conflict.o && conflict.o.length > 0) {
        lines.push(...conflict.o);
      }
      lines.push('======= THEIRS (remote)');
      if (conflict.b && conflict.b.length > 0) {
        lines.push(...conflict.b);
      }
      lines.push('>>>>>>>');
    } else if (chunk.ok) {
      // Non-conflict chunks
      lines.push(...chunk.ok);
    }
  }
  
  return lines.join('\n');
}
