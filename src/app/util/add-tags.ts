import { uniq } from 'lodash-es';
import type { Plugin } from '../model/plugin';
import type { RootConfig } from '../mods/root';
import { expandedTagsInclude, localTag, topAnds } from './tag';

/**
 * Tags added to a Ref submitted from a tag page.
 * Entries starting with '!' in addTags are never added.
 */
export function getAddTags(tag: string | undefined, plugin: Plugin | undefined, rootConfig: RootConfig | undefined, home = false): string[] {
  return withoutNegated(rawAddTags(tag, plugin, rootConfig, home), rootConfig?.addTags);
}

function rawAddTags(tag: string | undefined, plugin: Plugin | undefined, rootConfig: RootConfig | undefined, home: boolean): string[] {
  if (!tag || home) return rootConfig?.addTags || plugin?.config?.reply || ['public'];
  if (plugin) {
    return uniq([
      ...rootConfig?.addTags || plugin.config?.reply || ['public'],
      ...plugin.config?.submit ? [plugin.tag] : [],
      ...plugin.config?.internal ? ['internal'] : []]);
  }
  return uniq([...rootConfig?.addTags || ['public'], ...topAnds(tag).map(localTag)]);
}

/**
 * Tags negated with '!' in addTags.
 */
export function negatedTags(addTags?: string[]): string[] {
  return (addTags || []).filter(t => t.startsWith('!')).map(t => t.substring(1)).filter(t => !!t);
}

/**
 * Remove negated entries, and the tags they negate (with children).
 */
export function withoutNegated(tags: string[], addTags?: string[]): string[] {
  const not = negatedTags(addTags);
  return tags.filter(t => !t.startsWith('!') && !not.some(n => expandedTagsInclude(t, n)));
}
