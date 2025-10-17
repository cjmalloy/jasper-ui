import { Ref, writeRef } from '../model/ref';

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
 * Attempt a simple 3-way merge for comment strings.
 * Returns the merged comment or null if there's a conflict.
 * 
 * @param base - The original comment (common ancestor)
 * @param theirs - The server's current version
 * @param ours - Our attempted update
 * @returns The merged comment, or null if there's a conflict
 */
export function tryMergeRefComment(base: string | null, theirs: string, ours: string): string | null {
  const baseComment = base || '';
  const theirComment = theirs || '';
  const ourComment = ours || '';

  // If their comment is the same as base, use ours
  if (theirComment === baseComment) {
    return ourComment;
  }

  // If our comment is the same as base, use theirs
  if (ourComment === baseComment) {
    return theirComment;
  }

  // If both made the same change, accept it
  if (theirComment === ourComment) {
    return ourComment;
  }

  // Simple conflict - both changed
  return null;
}

/**
 * Format a merge conflict as a string that can be thrown and displayed to the user.
 * 
 * @param base - The original comment
 * @param theirs - The server's current version
 * @param ours - Our attempted update
 * @returns A formatted string showing the conflict
 */
export function formatMergeConflict(base: string | null, theirs: string, ours: string): string {
  const baseComment = base || '';
  const theirComment = theirs || '';
  const ourComment = ours;

  return `Merge conflict:\n\n` +
    `<<<<<<< BASE\n${baseComment}\n` +
    `||||||| THEIRS (server)\n${theirComment}\n` +
    `======= OURS (local)\n${ourComment}\n` +
    `>>>>>>>`;
}
